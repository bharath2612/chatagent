import { AgentConfig, AgentMetadata as BaseAgentMetadata, TranscriptItem } from "@/types/types"; // Adjusted path
// Supabase/Langchain imports commented out - using edge function instead
// import supabaseAdmin from "@/app/lib/supabaseClient"; // Requires setup in new project
// import { OpenAIEmbeddings } from "@langchain/openai";
// import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";

// Extend the AgentMetadata type to include project_id_map
interface AgentMetadata extends BaseAgentMetadata {
  project_id_map?: Record<string, string>; // Map project names to their IDs
  active_project_id?: string; // Current active project ID for direct reference
}

// Add interface for property detection response
interface PropertyDetectionResult {
  propertyDetected: boolean;
  detectedProperty?: string;
  shouldUpdateActiveProject?: boolean;
  message?: string;
  isScheduleRequest?: boolean;
  schedulePropertyId?: string | null;
}

// Define necessary UI prop types locally for mapping
/*
interface PropertyLocation {
  city?: string;
  mapUrl?: string;
  coords?: string;
}

interface PropertyImageForMapping {
  url?: string;
  alt?: string;
  description?: string;
}

interface PropertyUnitForMapping {
  type: string;
}

interface AmenityForMapping {
  name: string;
}

interface PropertyProps {
  id?: string;
  name?: string;
  price?: string;
  area?: string;
  location?: PropertyLocation;
  mainImage?: string;
  galleryImages?: PropertyImageForMapping[];
  units?: PropertyUnitForMapping[];
  amenities?: AmenityForMapping[];
  description?: string;
  websiteUrl?: string;
}
*/

// Required Environment Variables: NEXT_PUBLIC_SUPABASE_ANON_KEY
// Optional Environment Variables: NEXT_PUBLIC_TOOLS_EDGE_FUNCTION_URL (defaults provided)

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const toolsEdgeFunctionUrl = process.env.NEXT_PUBLIC_TOOLS_EDGE_FUNCTION_URL || "https://dashboard.propzing.in/functions/v1/realtime_tools";

// Track question count - Reset on agent initialization or context change
let questionCount = 0;

// Dynamic instructions function - receives metadata object
const getInstructions = (metadata: AgentMetadata | undefined | null) => {
  // Default values if metadata is missing
  const defaultMetadata = {
    org_id: "N/A",
    org_name: "the company",
    active_project: "N/A",
    property_location: "N/A",
    project_names: [] as string[],
    chatbot_id: "N/A",
    session_id: "N/A",
    is_verified: false,
    customer_name: "",
    phone_number: "",
    project_ids: [] as string[],
    project_locations: {} as Record<string, string>,
    has_scheduled: false,
    language: "English",
    project_id_map: {} as Record<string, string>, // Map project names to their IDs
  };
  const safeMetadata = { ...defaultMetadata, ...(metadata || {}) }; // Merge defaults with provided metadata

  // Determine the active project for focus
  const activeProject = safeMetadata.active_project !== "N/A" ? safeMetadata.active_project :
                      (safeMetadata.project_names.length > 0 ? safeMetadata.project_names[0] : "N/A");

  const projectList = safeMetadata.project_names.length > 0 ? safeMetadata.project_names.join(", ") : "(No projects specified)";

  // Restore instructions closer to the original logic provided, adding UI hint guidance
  return `You are a helpful real estate agent representing ${safeMetadata.org_name}. 

Your company manages the following properties: ${projectList}

Currently focused property (for internal use): ${activeProject}

${safeMetadata.customer_name ? `You are currently assisting ${safeMetadata.customer_name}.` : ""}
${safeMetadata.is_verified ? `The user is verified.` : `The user is NOT verified.`}
${safeMetadata.has_scheduled ? `The user has already scheduled a property visit.` : ''}

Your responsibilities include:
1. Answering questions about properties managed by ${safeMetadata.org_name}.
2. Providing directions to properties using 'calculateRoute'.
3. Finding nearest places of interest using 'findNearestPlace'.
4. Tracking user messages using 'trackUserMessage'. Transfer to 'authentication' agent if needed.
5. If the user agrees to schedule a visit, use 'initiateScheduling'.
6. Updating the internally focused property using 'updateActiveProject'.
7. Retrieving property images using 'getPropertyImages'.

LANGUAGE INSTRUCTIONS:
- Respond ONLY in ${safeMetadata.language || "English"}.
- Keep answers concise, especially when property cards (PROPERTY_LIST) or images (IMAGE_GALLERY) are being displayed by the UI based on your tool results. Let the UI show the details.

TOOL USAGE & UI HINTS:
- ALWAYS use 'trackUserMessage' at the start of handling ANY user message.
- ALWAYS use 'detectPropertyInMessage' *after* 'trackUserMessage'.
- Use 'updateActiveProject' ONLY IF 'detectPropertyInMessage' indicates it's needed.
- **General Property List Request:** When the user asks for a general list (e.g., "show me your properties"), use 'getProjectDetails' without filters. It returns ui_display_hint: 'PROPERTY_LIST'. Your text MUST be brief: "Here are the properties I found. You can click on the cards below for more details."
- **Specific Property Details Request:** When the user asks about ONE specific property, use 'getProjectDetails' with the project_id/name. It returns ui_display_hint: 'PROPERTY_DETAILS'. Your text message can be slightly more descriptive but still concise.
- **Lookup Property (Vector Search):** Use 'lookupProperty' for vague or feature-based searches (e.g., "find properties near the park"). It returns ui_display_hint: 'CHAT'. Summarize the findings from the tool's 'search_results' in your text response.
- **Image Request:** Use 'getPropertyImages'. It returns ui_display_hint: 'IMAGE_GALLERY'. Your text MUST be brief: "Here are the images."
- **Scheduling:** Use 'initiateScheduling' ONLY when the user confirms. It transfers silently (no ui_display_hint needed from it, handled by the receiving agent).
- **Other Tools ('calculateRoute', 'findNearestPlace'):** These likely return ui_display_hint: 'CHAT'. Present their results textually.

CRITICAL FLOW RULES: 
- If the user is ALREADY VERIFIED, NEVER transfer to authentication.
- ONLY transfer to authentication if is_verified is false AND 'trackUserMessage' indicates it.
- ONLY ask about scheduling a visit if is_verified is true AND has_scheduled is false AND 'trackUserMessage' indicates it.
- After calling 'initiateScheduling', YOU MUST NOT generate any text response.
- **IMPORTANT AGENT TRANSFER RULE:** If ANY tool you call (e.g., 'trackUserMessage', 'initiateScheduling') returns a 'destination_agent' field in its result (signaling an agent transfer), YOU MUST NOT generate any text response yourself. Your turn ends silently, and the system will activate the destination agent.
`;
};

// Agent Definition
const realEstateAgent: AgentConfig = {
  name: "realEstate",
  publicDescription:
    "Real Estate Agent that provides detailed property information.",
  instructions: getInstructions(undefined), // Initial default instructions
  tools: [
    {
      type: "function",
      name: "trackUserMessage",
      description: "Internal tool: Tracks user messages, increments question count, and triggers authentication or scheduling prompts based on count and user status.",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string", description: "The user's message (for logging/context)" },
          // is_verified, has_scheduled, project_names are accessed from agent metadata internally
        },
        required: ["message"],
        additionalProperties: false,
      },
    },
     {
       type: "function",
       name: "detectPropertyInMessage",
       description: "Internal tool: Analyzes the user's message to detect if a specific known property is mentioned.",
       parameters: {
         type: "object",
         properties: {
           message: { type: "string", description: "The user's message to analyze" },
           // project_names is accessed from agent metadata internally
         },
         required: ["message"],
         additionalProperties: false,
       },
     },
    {
      type: "function",
      name: "updateActiveProject",
      description: "Internal tool: Updates the agent's internal focus to a specific project when the user expresses clear interest in it.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description: "The name of the project the user is interested in.",
          },
          // session_id is accessed from agent metadata internally
        },
        required: ["project_name"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "lookupProperty",
      description:
        "Queries for property details (e.g., address, price, features). Use when the user asks specifics about properties.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "A natural language query describing the property or information needed.",
          },
          k: {
            type: "number",
            description:
              "Optional: The number of results to retrieve. Defaults to 3.",
          },
           // project_ids are accessed from agent metadata internally
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "calculateRoute",
      description:
        "Calculates a driving route to a property. Use when the user asks for directions.",
      parameters: {
        type: "object",
        properties: {
          origin: {
            type: "string",
            description:
              "The starting location (can be text like 'my current location' or 'lat,lng').",
          },
          destination_property: {
            type: "string",
            description: "The name of the destination property.",
             // enum will be dynamically populated if possible
          },
           // destination lat/lng and is_verified are accessed from agent metadata internally
        },
        required: ["origin", "destination_property"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "findNearestPlace",
      description:
        "Finds the nearest place/amenity (e.g., 'park', 'hospital') relative to a property. Use when the user asks about nearby places.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The type of place to find (e.g., 'nearest park', 'hospital nearby').",
          },
          reference_property: {
            type: "string",
            description: "The name of the property to use as the reference location.",
             // enum will be dynamically populated if possible
          },
          // reference lat/lng and is_verified are accessed from agent metadata internally
        },
        required: ["query", "reference_property"],
        additionalProperties: false,
      },
    },
    {
       type: "function",
       name: "fetchOrgMetadata",
       description:
         "Internal tool: Fetches essential organizational and project data needed for the agent to function.",
       parameters: {
         type: "object",
         properties: {
           session_id: { type: "string", description: "The current session ID." },
           chatbot_id: { type: "string", description: "The chatbot's ID." },
         },
         required: ["session_id", "chatbot_id"],
         additionalProperties: false,
       },
     },
    {
      type: "function",
      name: "getPropertyImages",
      description:
        "Retrieves images for a specific property. Use when the user asks to see images or pictures.",
      parameters: {
        type: "object",
        properties: {
          property_name: {
            type: "string",
            description: "The name of the property to get images for. If not provided, uses the currently active project.",
            // enum will be dynamically populated if possible
          },
          query: {
            type: "string",
            description: "Optional: Additional description to refine the image search (e.g., 'exterior', 'living room').",
          },
          // project_ids are accessed from agent metadata internally
        },
        // property_name is effectively required unless active_project is set
        required: [],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "getProjectDetails",
      description:
        "Retrieves comprehensive details about a specific property directly from the database. Use when you need precise property information without semantic search.",
      parameters: {
        type: "object",
        properties: {
          project_id: {
            type: "string",
            description: "The unique ID of the project to get details for. This is the preferred parameter and should be used whenever available.",
          },
          project_name: {
            type: "string",
            description: "Alternative to project_id: The name of the property to get details for. Partial matches work. Only use if project_id is not available.",
          },
          // Note: Either project_id OR project_name must be provided
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "initiateScheduling",
      description: "Internal tool: Triggers the scheduling flow by transferring to the scheduleMeeting agent silently. Use when the user explicitly agrees to schedule a visit (e.g., says 'yes' after being asked) or requests it directly.",
      parameters: {
        type: "object",
        properties: {
          property_id: { type: "string", description: "Optional. The ID of the specific property to schedule for. If omitted, the agent will use the active project." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  ],

  // Tool Logic Implementation
  toolLogic: {
    // --- Internal Tools --- 
    trackUserMessage: async ({ message }: { message: string }) => {
        const metadata = realEstateAgent.metadata;
        const is_verified = metadata?.is_verified ?? false;
        const has_scheduled = metadata?.has_scheduled ?? false;

        // Check if this is a scheduling message by running scheduling regex directly
        const scheduleRegex = /^Yes, I'd like to schedule a visit for (.+?)[.!]?$/i;
        const scheduleRequestFromUiButton = message.startsWith("Yes, I'd like to schedule a visit for"); // More generic check for UI button

        if (scheduleRequestFromUiButton) {
            console.log("[trackUserMessage] Direct scheduling pattern match detected from UI button or similar phrasing");
            
            const propertyNameMatch = message.match(scheduleRegex);
            const propertyName = propertyNameMatch ? propertyNameMatch[1]?.trim() : metadata?.active_project || ((metadata as any)?.project_id_map ? Object.keys((metadata as any).project_id_map)[0] : null);

            console.log(`[trackUserMessage] Extracted/active property name for scheduling: ${propertyName}`);
            
            const metadataAny = metadata as any;
            let propertyIdToSchedule = metadataAny?.active_project_id; // Prefer active project ID

            if (!propertyIdToSchedule && propertyName && metadataAny?.project_id_map) {
                propertyIdToSchedule = metadataAny.project_id_map[propertyName];
            }
            
            // Fallback if no specific ID found yet
            if (!propertyIdToSchedule && metadata?.project_ids && metadata.project_ids.length > 0) {
                propertyIdToSchedule = metadata.project_ids[0];
                console.log(`[trackUserMessage] No specific property ID, falling back to first project ID: ${propertyIdToSchedule}`);
            }

            if (propertyIdToSchedule) {
                console.log(`[trackUserMessage] Transferring to scheduleMeeting with property_id_to_schedule: ${propertyIdToSchedule}`);
                return {
                    destination_agent: "scheduleMeeting",
                    property_id_to_schedule: propertyIdToSchedule,
                    property_name_to_schedule: propertyName, // Pass name for greeting
                    silentTransfer: true,
                    message: null // CRITICAL for silent transfer
                };
            } else {
                console.log("[trackUserMessage] No property ID found for scheduling, transferring without specific property, scheduling agent will ask.");
                return {
                    destination_agent: "scheduleMeeting",
                    silentTransfer: true,
                    message: null // CRITICAL for silent transfer
                };
            }
        }

        questionCount++;
        console.log(`[trackUserMessage] Q#: ${questionCount}, Verified: ${is_verified}, Scheduled: ${has_scheduled}, Msg: "${message}"`);

        // Trigger authentication check only if NOT verified
        if (!is_verified && questionCount >= 7) {
          console.log("[trackUserMessage] User not verified after 7 questions, transferring to authentication");
          // Reset count for next time, maybe?
          questionCount = 0;
          return { destination_agent: "authentication" };
        }

        // Trigger scheduling prompt only if VERIFIED and NOT already scheduled
        if (is_verified && !has_scheduled && questionCount >= 12) {
           console.log("[trackUserMessage] Asking user about scheduling visit.");
           // Reset count after asking
           questionCount = 0; 
           return { 
             askToSchedule: true, // Flag for UI to potentially show buttons
             message: "Would you like to schedule a visit to see a property in person?" // LLM will say this
           };
        }

        return { success: true, questionCount }; // Return success and current count
    },

    detectPropertyInMessage: async ({ message }: { message: string }) => {
        console.log(`[detectPropertyInMessage] Analyzing message: "${message}"`);
        const metadata = realEstateAgent.metadata;
        const project_names = metadata?.project_names || [];
        console.log(`[detectPropertyInMessage] Available properties:`, project_names);

        // ADDITION: Direct check for scheduling messages
        const scheduleRegex = /^Yes, I'd like to schedule a visit for (.+?)[.!]?$/i;
        const scheduleMatch = message.match(scheduleRegex);
        
        if (scheduleMatch) {
            const propertyName = scheduleMatch[1].trim();
            console.log(`[detectPropertyInMessage] Detected scheduling request for: "${propertyName}"`);
            
            // Find property ID if possible
            let propertyId = null;
            // Use type assertion to access these properties
            const metadataAny = metadata as any;
            if (metadataAny?.project_id_map && metadataAny.project_id_map[propertyName]) {
                propertyId = metadataAny.project_id_map[propertyName];
            } else if (metadataAny?.active_project_id && 
                      (propertyName.toLowerCase() === metadata?.active_project?.toLowerCase())) {
                propertyId = metadataAny.active_project_id;
            }
            
            // Return special flag for scheduling
            return {
                propertyDetected: true,
                detectedProperty: propertyName,
                shouldUpdateActiveProject: true,
                isScheduleRequest: true,
                schedulePropertyId: propertyId
            };
        }

        if (!project_names.length) {
          return { propertyDetected: false, message: "No properties available" };
        }

        const normalizedMessage = message.toLowerCase().trim();
        let detectedProperty: string | null = null;

        // Function to check for match (exact or spaceless)
        const isMatch = (prop: string, msg: string) => {
            const trimmedProp = prop.trim().toLowerCase();
            const propNoSpaces = trimmedProp.replace(/\s+/g, '');
            const msgNoSpaces = msg.replace(/\s+/g, '');
            // Check for whole word match (exact) or spaceless containment
            const regex = new RegExp(`\\b${trimmedProp.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`); // Escape special chars
            return regex.test(msg) || msgNoSpaces.includes(propNoSpaces);
        };

        // Check for matches
        for (const property of project_names) {
           if (isMatch(property, normalizedMessage)) {
              detectedProperty = property; // Use original casing
              console.log(`[detectPropertyInMessage] Match found for: "${property}"`);
              break;
           }
        }

        if (detectedProperty && metadata?.active_project !== detectedProperty) {
          console.log(`[detectPropertyInMessage] Detected property "${detectedProperty}" is different from active "${metadata?.active_project}".`);
          // Return detected property; updateActiveProject should be called next by LLM if needed
          return {
            propertyDetected: true,
            detectedProperty: detectedProperty,
            shouldUpdateActiveProject: true, // Hint to LLM to call updateActiveProject
          };
        } else if (detectedProperty) {
            console.log(`[detectPropertyInMessage] Detected property "${detectedProperty}" is already active.`);
            return { propertyDetected: true, detectedProperty: detectedProperty, shouldUpdateActiveProject: false };
        } else {
             console.log(`[detectPropertyInMessage] No specific property detected.`);
             return { propertyDetected: false };
        }
    },

    updateActiveProject: async ({ project_name }: { project_name: string }) => {
        console.log(`[updateActiveProject] Attempting to set active project to: "${project_name}"`);
        const metadata = realEstateAgent.metadata;
        if (!metadata) {
            console.error("[updateActiveProject] Agent metadata is missing.");
            return { success: false, message: "Agent metadata unavailable." };
        }

        const availableProjects = metadata.project_names || [];
        const trimmedProjectName = project_name.trim();

        // Find the project in available projects (case-insensitive)
        const matchedProject = availableProjects.find(
           p => p.trim().toLowerCase() === trimmedProjectName.toLowerCase()
        );

        if (!matchedProject) {
           console.error(`[updateActiveProject] Project "${trimmedProjectName}" not found in available list: ${availableProjects.join(", ")}`);
           return { success: false, message: `Project "${trimmedProjectName}" is not recognized.` };
        }

        // Update metadata
        const previousProject = metadata.active_project;
        metadata.active_project = matchedProject; // Use original casing
        
        // Store the project_id too if available in project_id_map
        const metadataAny = metadata as any;
        if (metadataAny.project_id_map && metadataAny.project_id_map[matchedProject]) {
            metadataAny.active_project_id = metadataAny.project_id_map[matchedProject];
            console.log(`[updateActiveProject] Set active_project_id to: ${metadataAny.active_project_id}`);
        }

        // Update instructions (important!)
        realEstateAgent.instructions = getInstructions(metadata);

        console.log(`[updateActiveProject] Success: Active project changed from "${previousProject}" to "${matchedProject}"`);
        return { 
            success: true, 
            active_project: matchedProject,
            active_project_id: (metadata as any).active_project_id || null
        };
    },

    fetchOrgMetadata: async ({ session_id, chatbot_id }: { session_id: string; chatbot_id: string; }) => {
        console.log(`[fetchOrgMetadata] Fetching metadata via edge function for session: ${session_id}, chatbot: ${chatbot_id}`);
        if (!supabaseAnonKey) {
            console.error("[fetchOrgMetadata] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");
            return { error: "Server configuration error." };
        }
        try {
            const response = await fetch(
                toolsEdgeFunctionUrl,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${supabaseAnonKey}`,
                    },
                    body: JSON.stringify({
                        action: "fetchOrgMetadata",
                        session_id,
                        chatbot_id,
                    }),
                }
            );

            const metadataResult: AgentMetadata & { error?: string } = await response.json();

            if (!response.ok || metadataResult.error) {
                console.error("[fetchOrgMetadata] Edge function error:", metadataResult.error || response.statusText);
                return { error: metadataResult.error || "Error fetching organizational metadata." };
            }

            console.log("[fetchOrgMetadata] Received metadata:", metadataResult);
            
            // Log critical IDs for debugging
            console.log("[fetchOrgMetadata] Critical ID fields in response:", {
                chatbot_id: metadataResult.chatbot_id,
                org_id: metadataResult.org_id,
                session_id: metadataResult.session_id
            });
            
            // Ensure org_id is preserved from the API response
            if (!metadataResult.org_id) {
                console.warn("[fetchOrgMetadata] No org_id in response, this will cause issues with authentication");
            }
            
            // Create project_id_map from returned data if not already present
            if (!metadataResult.project_id_map && metadataResult.project_ids && metadataResult.project_names) {
                // Make sure arrays are the same length
                const minLength = Math.min(metadataResult.project_ids.length, metadataResult.project_names.length);
                const project_id_map: Record<string, string> = {};
                
                // Create mapping from project name to ID
                for (let i = 0; i < minLength; i++) {
                    const name = metadataResult.project_names[i];
                    const id = metadataResult.project_ids[i];
                    if (name && id) {
                        project_id_map[name] = id;
                    }
                }
                
                metadataResult.project_id_map = project_id_map;
                console.log("[fetchOrgMetadata] Created project_id_map:", project_id_map);
            }

            // Reset question count when metadata is fetched/refreshed
            questionCount = 0;
            console.log("[fetchOrgMetadata] Reset question count to 0.");

            // Update the agent's internal state and instructions
            realEstateAgent.metadata = { ...metadataResult, session_id }; // Overwrite existing, ensure session_id persists
            realEstateAgent.instructions = getInstructions(realEstateAgent.metadata);
            console.log("[fetchOrgMetadata] Updated agent instructions based on new metadata.");
            
            // Log the final metadata state for debugging
            console.log("[fetchOrgMetadata] Final metadata state:", {
                chatbot_id: realEstateAgent.metadata.chatbot_id,
                org_id: realEstateAgent.metadata.org_id,
                session_id: realEstateAgent.metadata.session_id
            });

            return metadataResult; // Return fetched metadata

        } catch (error: any) {
            console.error("[fetchOrgMetadata] Exception calling edge function:", error);
            return { error: `Exception fetching metadata: ${error.message}` };
        }
    },

    // --- User Facing Tools --- 

    getProjectDetails: async ({ project_id, project_name }: { project_id?: string; project_name?: string }, transcript: TranscriptItem[] = []) => {
        console.log(`[getProjectDetails] Fetching project details: project_id=${project_id || 'none'}, project_name=${project_name || 'none'}`);
        
        const metadata = realEstateAgent.metadata;
        const project_ids_to_fetch = [] as string[];
        
        if (project_id) {
            project_ids_to_fetch.push(project_id);
        } else if (project_name && metadata && (metadata as any).project_id_map && (metadata as any).project_id_map[project_name]) {
            project_ids_to_fetch.push((metadata as any).project_id_map[project_name]);
        } else if (project_name && metadata && metadata.active_project === project_name && (metadata as any).active_project_id) {
            project_ids_to_fetch.push((metadata as any).active_project_id);
        } else if (metadata?.project_ids && metadata.project_ids.length > 0 && !project_id && !project_name) {
            // If no specific ID or name, fetch all. This implies a list view.
            project_ids_to_fetch.push(...metadata.project_ids);
        } else if (project_name) {
            // Attempt to fetch by name if ID wasn't found, edge function might handle partial match
            // This case is ambiguous for UI hint, might need more info or default to list
            // For now, we let the edge function decide what to return. If it returns one, we show details, else list.
            // The edge function needs to return a consistent structure. Let's assume it always returns a `properties` array.
        }

        if (project_ids_to_fetch.length === 0 && !project_name) {
            console.error("[getProjectDetails] No project IDs to fetch and no project name provided.");
            return {
                error: "No project specified for details.",
                ui_display_hint: 'CHAT',
                message: "Please specify which project you'd like details for."
            };
        }
        
        if (!supabaseAnonKey) {
            return { error: "Server configuration error.", ui_display_hint: 'CHAT', message: "Server configuration error." };
        }

        try {
            const payload = {
                action: "getProjectDetails",
                project_ids: project_ids_to_fetch.length > 0 ? project_ids_to_fetch : undefined,
                project_name: project_ids_to_fetch.length === 0 ? project_name : undefined,
            };

            console.log(`[getProjectDetails] Sending payload: ${JSON.stringify(payload)}`);

            const response = await fetch(
                toolsEdgeFunctionUrl,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${supabaseAnonKey}`,
                    },
                    body: JSON.stringify(payload),
                }
            );

            const result = await response.json();

            if (!response.ok || result.error) {
                console.error("[getProjectDetails] Edge function error:", result.error || response.statusText);
                return { 
                  error: result.error || "Error fetching project details.",
                  ui_display_hint: 'CHAT',
                  message: result.error ? `Failed to get details: ${result.error}` : "Could not fetch project details."
                };
            }

            console.log("[getProjectDetails] Received raw project details result:", result);

            if (result.properties && Array.isArray(result.properties)) {
                 if (result.properties.length === 1 && (project_id || (project_ids_to_fetch.length === 1 && !project_name) ) ) {
                     // Single property detail view
                     const property = result.properties[0];
                     const mainImage = property.images && property.images.length > 0 ? property.images[0].url : "/placeholder.svg";
                     const galleryImages = property.images && property.images.length > 1 ? property.images.slice(1).map((img: any) => ({ url: img.url, alt: img.alt || property.name, description: img.description })) : [];
                     const amenities = Array.isArray(property.amenities) ? property.amenities.map((amenity: any) => (typeof amenity === 'string' ? { name: amenity } : amenity)) : [];

                     return {
                         property_details: {
                            ...property,
                            mainImage,
                            galleryImages,
                            amenities
                         },
                         message: result.message || `Here are the details for ${property.name}.`,
                         ui_display_hint: 'PROPERTY_DETAILS',
                     };
                 } else if (result.properties.length > 0) {
                     // Multiple properties list view
                     const processedProperties = result.properties.map((property: any) => {
                        const mainImage = property.images && property.images.length > 0 ? property.images[0].url : "/placeholder.svg";
                        const galleryImages = property.images && property.images.length > 1 ? property.images.slice(1).map((img: any) => ({ url: img.url, alt: img.alt || property.name, description: img.description })) : [];
                        const amenities = Array.isArray(property.amenities) ? property.amenities.map((amenity: any) => (typeof amenity === 'string' ? { name: amenity } : amenity)) : [];
                        return {
                            ...property,
                            mainImage,
                            galleryImages,
                            amenities
                        };
                     });
                     return {
                         properties: processedProperties,
                         message: "Here are the properties I found. You can click on the cards below for more details.",
                         ui_display_hint: 'PROPERTY_LIST',
                     };
                 } else {
                      return { message: result.message || "I couldn't find any project details.", ui_display_hint: 'CHAT' };
                 }
             } else {
                 return { 
                    error: "Unexpected response structure from server.",
                    message: "I received an unexpected response while fetching details.",
                    ui_display_hint: 'CHAT',
                 };
             }

        } catch (error: any) {
            console.error("[getProjectDetails] Exception calling edge function:", error);
            return { 
              error: `Exception fetching project details: ${error.message}`,
              ui_display_hint: 'CHAT',
              message: "An error occurred while fetching project details."
            };
        }
    },

    getPropertyImages: async ({ property_name, query }: { property_name?: string; query?: string }, transcript: TranscriptItem[] = []) => {
        console.log(`[getPropertyImages] Fetching images for property: ${property_name || 'active project'}`);
        const metadata = realEstateAgent.metadata;
        const project_ids = metadata?.project_ids || [];
        const active_project = metadata?.active_project || "N/A";
        const targetPropertyForName = property_name || active_project;

        if (!supabaseAnonKey) {
            console.error("[getPropertyImages] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");
            return { 
              error: "Server configuration error.", 
              ui_display_hint: 'CHAT', // Revert to chat on error
              message: "Sorry, I couldn't fetch images due to a server configuration issue."
            };
        }

        if (targetPropertyForName === "N/A") {
            return {
                error: "No property specified or active.",
                ui_display_hint: 'CHAT',
                message: "Please specify which property's images you'd like to see."
            };
        }

        try {
            const response = await fetch(
                toolsEdgeFunctionUrl,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${supabaseAnonKey}`,
                    },
                    body: JSON.stringify({
                        action: "getPropertyImages",
                        property_name: targetPropertyForName, // Use the determined name
                        query,
                        project_ids,
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok || result.error) {
                console.error("[getPropertyImages] Edge function error:", result.error || response.statusText);
                return { 
                  error: result.error || "Error fetching property images.",
                  ui_display_hint: 'CHAT',
                  message: result.error ? `Sorry, I couldn't fetch images: ${result.error}` : "Sorry, an error occurred while fetching images."
                };
            }

            console.log("[getPropertyImages] Received property images result:", result);

            if (result.images && result.images.length > 0) {
              return {
                  property_name: result.property_name || targetPropertyForName,
                  images: result.images,
                  message: "Here are the images you requested.",
                  ui_display_hint: 'IMAGE_GALLERY',
                  images_data: {
                      propertyName: result.property_name || targetPropertyForName,
                      images: result.images.map((img: any) => ({ url: img.image_url || img.url, alt: img.description || img.alt, description: img.description }))
                  }
              };
            } else {
              return {
                property_name: result.property_name || targetPropertyForName,
                images: [],
                message: result.message || `I couldn't find any images for ${result.property_name || targetPropertyForName}.`,
                ui_display_hint: 'CHAT'
              };
            }

        } catch (error: any) {
            console.error("[getPropertyImages] Exception calling edge function:", error);
            return { 
              error: `Exception fetching property images: ${error.message}`,
              ui_display_hint: 'CHAT',
              message: "Sorry, an unexpected error occurred while trying to fetch images."
            };
        }
    },

    initiateScheduling: async ({ property_id }: { property_id?: string }, transcript: TranscriptItem[] = []) => {
        const metadata = realEstateAgent.metadata as AgentMetadata; // Added type assertion
        const metadataAny = metadata as any;
        
        // Log available metadata for debugging
        console.log("[initiateScheduling] DEBUG - Available metadata:");
        console.log("  - property_id param:", property_id);
        console.log("  - active_project_id:", metadataAny?.active_project_id);
        console.log("  - active_project:", metadata?.active_project);
        console.log("  - project_ids:", metadata?.project_ids);
        
        // Try multiple fallbacks for property ID
        let targetPropertyId = property_id;
        
        if (!targetPropertyId && metadataAny?.active_project_id) {
            console.log("[initiateScheduling] Using active_project_id:", metadataAny.active_project_id);
            targetPropertyId = metadataAny.active_project_id;
        }
        
        if (!targetPropertyId && metadata?.project_ids && metadata.project_ids.length > 0) {
            console.log("[initiateScheduling] Falling back to first project_id:", metadata.project_ids[0]);
            targetPropertyId = metadata.project_ids[0];
        }
        
        // If we still don't have a property ID, proceed anyway and let the scheduling agent handle it
        if (!targetPropertyId) {
            console.log("[initiateScheduling] No property ID available, proceeding with transfer anyway");
            } else {
            console.log(`[initiateScheduling] Transferring to scheduleMeeting agent for property ID: ${targetPropertyId}`);
        }
        
        return {
            destination_agent: "scheduleMeeting",
            property_id_to_schedule: targetPropertyId, // This might be undefined, but that's OK
            silentTransfer: true,
            message: null // Setting this to null ensures the agent doesn't say anything
        };
    },

    lookupProperty: async ({ query, k = 3 }: { query: string; k?: number }, transcript: TranscriptItem[] = []) => {
        console.log(`[lookupProperty] Querying edge function: "${query}", k=${k}`);
        const metadata = realEstateAgent.metadata;
        const project_ids_for_filter = metadata?.project_ids || []; // For filtering in vector search

        if (!supabaseAnonKey) {
            return { error: "Server configuration error.", ui_display_hint: 'CHAT', message: "Server error during lookup." };
        }

        try {
            const response = await fetch(
                toolsEdgeFunctionUrl,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${supabaseAnonKey}`,
                    },
                    body: JSON.stringify({
                        action: "lookupProperty",
                        query,
                        k,
                        project_ids: project_ids_for_filter, // Pass current project_ids for context/filtering
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok || result.error) {
                console.error("[lookupProperty] Edge function error:", result.error || response.statusText);
                return {
                  error: result.error || "Error looking up property.",
                  ui_display_hint: 'CHAT',
                  message: result.error ? `Lookup failed: ${result.error}` : "Could not find properties."
                };
            }

            console.log("[lookupProperty] Received raw property results:", result);

            if (result.properties && Array.isArray(result.properties) && result.properties.length > 0) {
                // Keep CHAT hint, provide results for agent summary
                return {
                    search_results: result.properties, 
                    message: result.message || `Regarding "${query}", I found information about ${result.properties.length} item(s).`,
                    ui_display_hint: 'CHAT',
                };
            } else {
                 return { message: result.message || "I couldn't find specific details matching that query.", ui_display_hint: 'CHAT' };
            }

        } catch (error: any) {
            console.error("[lookupProperty] Exception calling edge function:", error);
            return { 
              error: `Exception looking up property: ${error.message}`,
              ui_display_hint: 'CHAT',
              message: "An error occurred during property lookup."
            };
        }
    },

    calculateRoute: async (args: any) => {
        // ... fetch route from Google Maps API ...
        // Assuming result is stored in routeSummary
        return {
            routeSummary: "Driving directions: ...", // The actual summary
            ui_display_hint: 'CHAT', // <<< Display result in chat
            message: "Here are the driving directions:" // Agent's intro text
        };
    },
    findNearestPlace: async (args: any) => {
        // ... fetch nearest place from Google Maps API ...
        // Assuming result is stored in placeInfo
        return {
            placeInfo: "The nearest park is Central Park, 0.5 miles away.", // The actual result
            ui_display_hint: 'CHAT', // <<< Display result in chat
            message: "Regarding the nearest place:" // Agent's intro text
        };
    }
  },
};

// Re-apply instructions after definition
realEstateAgent.instructions = getInstructions(realEstateAgent.metadata);

export default realEstateAgent; 