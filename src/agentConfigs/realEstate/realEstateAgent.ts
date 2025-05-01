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

  return `You are a helpful real estate agent representing ${safeMetadata.org_name}. 

Your company manages the following properties: ${projectList}

Currently focused property (for internal use): ${activeProject}

${safeMetadata.customer_name ? `You are currently assisting ${safeMetadata.customer_name}.` : ""}
${safeMetadata.is_verified ? `The user is verified.` : `The user is NOT verified.`}
${safeMetadata.has_scheduled ? `The user has already scheduled a property visit.` : ''}

Your responsibilities include:
1. Answering questions about properties managed by ${safeMetadata.org_name}. When providing a list of properties (e.g., from lookupProperty), keep your text brief and mention that the user can click on the cards shown below for more details.
2. Providing directions to properties using 'calculateRoute'.
3. Finding nearest places of interest using 'findNearestPlace'.
4. Tracking user messages using 'trackUserMessage'. If the user is NOT verified, transfer to the 'authentication' agent after 7 questions.
5. Asking the user if they'd like to schedule a visit after 12 questions (using the result from 'trackUserMessage'), but ONLY if they are verified AND haven't scheduled yet.
6. Updating the internally focused property using 'updateActiveProject' whenever the user asks specifically about one property.
7. Retrieving property images using 'getPropertyImages' when asked. The UI will display these.

LANGUAGE INSTRUCTIONS:
- The conversation language is set to ${safeMetadata.language || "English"}. Respond ONLY in ${safeMetadata.language || "English"}.
- Keep answers concise, especially when property cards or images are being displayed by the UI based on your tool results. Let the UI show the details.

CRITICAL INSTRUCTIONS: 
- When the user asks about properties in general (triggering 'lookupProperty'), ALWAYS list ALL available properties (${projectList}) briefly in text and mention the interactive cards.
- Anytime a user asks SPECIFICALLY about one property (e.g., "tell me about ${safeMetadata.project_names[0] || 'Property A'}"), FIRST call 'detectPropertyInMessage'. If it returns 'shouldUpdateActiveProject: true', THEN call 'updateActiveProject' BEFORE generating your text response.
- If the user is ALREADY VERIFIED (is_verified is true), NEVER transfer to authentication.
- ONLY transfer to authentication if is_verified is false AND the question count reaches 7 (indicated by 'trackUserMessage' result).
- ONLY ask about scheduling a visit if is_verified is true AND has_scheduled is false AND the question count reaches 12 (indicated by 'trackUserMessage' result).

TOOL USAGE:
- ALWAYS use 'trackUserMessage' at the start of handling ANY user message.
- ALWAYS use 'detectPropertyInMessage' *after* 'trackUserMessage' to see if the user mentioned a specific property.
- Use 'updateActiveProject' ONLY IF 'detectPropertyInMessage' indicates it's needed.
- Use 'lookupProperty' for general property details or lists. The UI will display results in cards. Your text should be brief.
- Use 'getProjectDetails' for precise property information from the database when you need guaranteed up-to-date details about a specific property. This is preferred over lookupProperty when the user asks specifically about one property.
  * IMPORTANT: When using getProjectDetails, ALWAYS use project_id when available in project_id_map rather than project_name.
- Use 'calculateRoute' for directions.
- Use 'findNearestPlace' for nearby amenities.
- Use 'getPropertyImages' if the user asks to see images/pictures. The UI will display them.
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
  ],

  // Tool Logic Implementation
  toolLogic: {
    // --- Internal Tools --- 
    trackUserMessage: async ({ message }: { message: string }) => {
        const metadata = realEstateAgent.metadata;
        const is_verified = metadata?.is_verified ?? false;
        const has_scheduled = metadata?.has_scheduled ?? false;

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
             shouldAskScheduling: true, 
             message: "Would you like to schedule a visit to see a property in person?" 
           };
        }

        return { success: true, questionCount }; // Return success and current count
    },

    detectPropertyInMessage: async ({ message }: { message: string }) => {
        console.log(`[detectPropertyInMessage] Analyzing message: "${message}"`);
        const metadata = realEstateAgent.metadata;
        const project_names = metadata?.project_names || [];
        console.log(`[detectPropertyInMessage] Available properties:`, project_names);

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

            return metadataResult; // Return fetched metadata

        } catch (error: any) {
            console.error("[fetchOrgMetadata] Exception calling edge function:", error);
            return { error: `Exception fetching metadata: ${error.message}` };
        }
    },

    // --- User Facing Tools --- 

    lookupProperty: async ({ query, k = 3 }: { query: string; k?: number }, transcript: TranscriptItem[] = []) => {
        console.log(`[lookupProperty] Querying edge function: "${query}", k=${k}`);
        const metadata = realEstateAgent.metadata;
        const project_ids = metadata?.project_ids || [];

        if (!supabaseAnonKey) {
            console.error("[lookupProperty] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");
            return { error: "Server configuration error." };
        }
         if (!project_ids.length) {
             console.warn("[lookupProperty] No project_ids in metadata to filter by.");
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
                        project_ids,
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok || result.error) {
                console.error("[lookupProperty] Edge function error:", result.error || response.statusText);
                return { error: result.error || "Error looking up property." };
            }

            console.log("[lookupProperty] Received property results:", result);
            return result;

        } catch (error: any) {
            console.error("[lookupProperty] Exception calling edge function:", error);
            return { error: `Exception looking up property: ${error.message}` };
        }
    },

    getProjectDetails: async ({ project_id, project_name }: { project_id?: string; project_name?: string }, transcript: TranscriptItem[] = []) => {
        console.log(`[getProjectDetails] Fetching project details: project_id=${project_id || 'none'}, project_name=${project_name || 'none'}`);
        
        const metadata = realEstateAgent.metadata;
        const project_ids = [] as string[];
        
        // If specific project_id is provided, use it as an array item
        if (project_id) {
            project_ids.push(project_id);
            console.log(`[getProjectDetails] Using specific project_id: ${project_id}`);
        }
        // If no project_id but project_name matches active project, use active_project_id if available
        else if (project_name && metadata && metadata.active_project === project_name) {
            const metadataAny = metadata as any;
            if (metadataAny.active_project_id) {
                project_ids.push(metadataAny.active_project_id);
                console.log(`[getProjectDetails] Using active_project_id: ${metadataAny.active_project_id} for active project: ${project_name}`);
            }
        }
        // If no project_id but project_name is provided, try to get ID from project_id_map
        else if (project_name && metadata) {
            const metadataAny = metadata as any;
            if (metadataAny.project_id_map && metadataAny.project_id_map[project_name]) {
                project_ids.push(metadataAny.project_id_map[project_name]);
                console.log(`[getProjectDetails] Found project_id: ${metadataAny.project_id_map[project_name]} for project_name: ${project_name} in project_id_map`);
            }
        }
        // If no specific project specified, use all available project IDs
        if (project_ids.length === 0 && metadata?.project_ids && metadata.project_ids.length > 0) {
            project_ids.push(...metadata.project_ids);
            console.log(`[getProjectDetails] Using all available project_ids: ${project_ids.join(', ')}`);
        }
        
        if (project_ids.length === 0) {
            console.error("[getProjectDetails] No project IDs available");
            return { error: "No project IDs available. Please specify a project or check your configuration." };
        }
        
        if (!supabaseAnonKey) {
            console.error("[getProjectDetails] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");
            return { error: "Server configuration error." };
        }

        try {
            // Build payload with project_ids array to match the new format
            const payload = {
                action: "getProjectDetails",
                project_ids: project_ids
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
                return { error: result.error || "Error fetching project details." };
            }

            console.log("[getProjectDetails] Received project details:", result);
            
            // Update UI state with property list data
            if (result.properties && result.properties.length > 0) {
                console.log(`[getProjectDetails] Setting propertyListData with ${result.properties.length} properties`);
                
                // Transform property data to match frontend expected format
                const formattedProperties = result.properties.map((property: any) => ({
                    id: property.id,
                    name: property.name || "Property",
                    price: property.price || "Price on request",
                    area: property.area || "Area unavailable",
                    location: {
                        city: property.location?.city || "Location unavailable",
                        mapUrl: property.location?.coords ? 
                            `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d500!2d${property.location.coords.split(',')[1]}!3d${property.location.coords.split(',')[0]}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2z!5e0!3m2!1sen!2sin!4v1599999999999!5m2!1sen!2sin` : 
                            ""
                    },
                    mainImage: property.images?.length > 0 ? property.images[0].url : "/placeholder.svg",
                    galleryImages: (property.images || []).map((img: any) => ({
                        url: img.url || "/placeholder.svg",
                        alt: img.alt || property.name || "Property image"
                    })),
                    units: (property.units || []).map((unit: any) => ({
                        type: typeof unit === 'string' ? unit : (unit.type || "Unit")
                    })),
                    amenities: (property.amenities || []).map((amenity: any) => ({
                        name: typeof amenity === 'string' ? amenity : (amenity.name || "Amenity")
                    })),
                    description: property.description || "No description available",
                    websiteUrl: property.websiteUrl || ""
                }));
                
                result.properties = formattedProperties;
            }
            
            return result;

        } catch (error: any) {
            console.error("[getProjectDetails] Exception calling edge function:", error);
            return { error: `Exception fetching project details: ${error.message}` };
        }
    },

    calculateRoute: async ({ origin, destination_property }: { origin: string; destination_property: string; }) => {
        console.log(`[calculateRoute] Requesting route from "${origin}" to property "${destination_property}"`);
        const metadata = realEstateAgent.metadata;
        const destinationLatLng = metadata?.project_locations?.[destination_property];

        if (!destinationLatLng) {
            console.error(`[calculateRoute] Location not found for destination property: "${destination_property}"`);
            return { error: `Sorry, I don't have the location information for ${destination_property}.` };
        }
        if (!supabaseAnonKey) {
             console.error("[calculateRoute] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");
             return { error: "Server configuration error." };
        }

        console.log(`[calculateRoute] Destination LatLng: ${destinationLatLng}`);

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
                        action: "calculateRoute",
                        origin,
                        destination: destinationLatLng, // Send lat,lng
                    }),
                }
            );
            const data = await response.json();

            if (response.ok && data.routeSummary) {
                console.log(`[calculateRoute] Route summary: ${data.routeSummary}`);
                return { routeSummary: data.routeSummary }; // Expects { routeSummary: "..." }
            } else {
                console.error("[calculateRoute] Edge function error:", data.error || response.statusText);
                return { error: data.error || "Error calculating route." };
            }
        } catch (error: any) {
            console.error("[calculateRoute] Exception calling edge function:", error);
            return { error: `Exception calculating route: ${error.message}` };
        }
    },

    findNearestPlace: async ({ query, reference_property }: { query: string; reference_property: string; }) => {
        console.log(`[findNearestPlace] Finding "${query}" near property "${reference_property}"`);
        const metadata = realEstateAgent.metadata;
        const referenceLatLng = metadata?.project_locations?.[reference_property];

        if (!referenceLatLng) {
            console.error(`[findNearestPlace] Location not found for reference property: "${reference_property}"`);
            return { error: `Sorry, I don't have the location information for ${reference_property}.` };
        }
         if (!supabaseAnonKey) {
             console.error("[findNearestPlace] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");
             return { error: "Server configuration error." };
         }

        console.log(`[findNearestPlace] Reference LatLng: ${referenceLatLng}`);

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
                        action: "findNearestPlace",
                        query,
                        location: referenceLatLng, // Send lat,lng
                    }),
                }
            );
            const data = await response.json();

            if (response.ok && data.nearestPlace) {
                console.log(`[findNearestPlace] Result: ${data.nearestPlace}`);
                return { nearestPlace: data.nearestPlace }; // Expects { nearestPlace: "..." }
            } else {
                console.error("[findNearestPlace] Edge function error:", data.error || response.statusText);
                return { error: data.error || "Error finding nearest place." };
            }
        } catch (error: any) {
            console.error("[findNearestPlace] Exception calling edge function:", error);
            return { error: `Exception finding nearest place: ${error.message}` };
        }
    },

    getPropertyImages: async ({ property_name, query }: { property_name?: string; query?: string }) => {
        const metadata = realEstateAgent.metadata;
        const targetProperty = property_name || metadata?.active_project;

        if (!targetProperty || targetProperty === "N/A") {
            console.error("[getPropertyImages] No property specified and no active project.");
            return { error: "Please specify a property or select one first." };
        }
        if (!supabaseAnonKey) {
            console.error("[getPropertyImages] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");
            return { error: "Server configuration error." };
        }

        const project_ids = metadata?.project_ids || [];
        console.log(`[getPropertyImages] Searching images for "${targetProperty}", query: "${query || 'any'}", projects: ${project_ids.join(',')}`);

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
                        property_name: targetProperty,
                        query: query || "",
                        project_ids,
                    }),
                }
            );
            const data = await response.json();

            if (response.ok && data.images) {
                console.log(`[getPropertyImages] Found ${data.images.length} images.`);
                 // Expects { property_name: string, images: string[], message?: string }
                return {
                    property_name: data.property_name || targetProperty,
                    images: data.images,
                    message: data.message || (data.images.length ? `Here are some images for ${targetProperty}.` : `Sorry, I couldn't find images for ${targetProperty}.`)
                };
            } else {
                console.error("[getPropertyImages] Edge function error:", data.error || response.statusText);
                return { error: data.error || "Error retrieving property images." };
            }
        } catch (error: any) {
            console.error("[getPropertyImages] Exception calling edge function:", error);
            return { error: `Exception retrieving images: ${error.message}` };
        }
    },
  },
};

// Make getInstructions available globally for potential use (though direct passing is preferred)
if (typeof window !== 'undefined') {
  (window as any).getInstructions = getInstructions;
}

export default realEstateAgent; 