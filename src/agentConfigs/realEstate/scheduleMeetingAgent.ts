import { AgentConfig, AgentMetadata } from "@/types/types"; // Adjusted path
// import supabaseAdmin from "@/app/lib/supabaseClient"; // Supabase client needs setup

// Required Environment Variables: NEXT_PUBLIC_SCHEDULE_VISIT_FUNC_URL, NEXT_PUBLIC_SCHEDULE_VISIT_FUNC_KEY

const scheduleVisitFuncUrl = process.env.NEXT_PUBLIC_SCHEDULE_VISIT_FUNC_URL || "https://dsakezvdiwmoobugchgu.supabase.co/functions/v1/schedule-visit-whatsapp";
const scheduleVisitFuncKey = process.env.NEXT_PUBLIC_SCHEDULE_VISIT_FUNC_KEY; // Needs to be set!

// Function to generate instructions based on metadata
const getScheduleMeetingInstructions = (metadata: AgentMetadata | undefined | null): string => {
  // Determine language, default to English
  const language = metadata?.language || "English";
  const isVerified = metadata?.is_verified ?? false;

  return `You are a helpful assistant that schedules property visits for users who have already been verified.

Your goal:
1. Confirm the user wants to schedule a visit.
2. Ask the user for their preferred date and time.
3. Format the date and time clearly (e.g., "Monday, July 29th, 2024 at 2:00 PM").
4. Use the scheduleVisit tool to book the appointment.
5. Confirm the booking details with the user.
6. Inform the user that the main real estate agent will take over again.

IMPORTANT: Only proceed if the user is verified (${isVerified ? 'they ARE verified' : 'they are NOT verified - explain and transfer'}). If not verified, politely explain verification is needed and suggest transferring back to the main agent or authentication agent.

LANGUAGE INSTRUCTIONS:
- Respond ONLY in ${language}.
`;
};

const scheduleMeetingAgent: AgentConfig = {
  name: "scheduleMeeting", // Renamed from schedule_meeting for consistency
  publicDescription: "Helps schedule property visits for verified users.",
  // Initialize instructions using the function
  instructions: getScheduleMeetingInstructions(undefined),
  tools: [
    {
      type: "function",
      name: "scheduleVisit", // Renamed for consistency
      description: "Schedules a property visit for a verified user.",
      parameters: {
        type: "object",
        properties: {
          visitDateTime: {
            type: "string",
            description: "The date and time for the visit, clearly formatted (e.g., 'Monday, July 29th, 2024 at 2:00 PM')",
          },
           // Metadata (customer_name, phone_number, chatbot_id, active_project/property_id, session_id) accessed internally
        },
        required: ["visitDateTime"],
        additionalProperties: false,
      },
    },
  ],
  toolLogic: {
    scheduleVisit: async ({ visitDateTime }: { visitDateTime: string }) => {
      console.log(`[scheduleVisit] Attempting to schedule visit for: ${visitDateTime}`);

      const metadata: AgentMetadata | undefined = scheduleMeetingAgent.metadata;

      if (!metadata) {
           console.error("[scheduleVisit] Agent metadata is missing.");
           return { error: "Missing required agent information for scheduling." };
      }

      if (!metadata.is_verified) {
           console.warn("[scheduleVisit] User is not verified. Cannot schedule visit.");
           return { error: "Sorry, I can only schedule visits for verified users. Let me transfer you back to the main agent.", destination_agent: "realEstate" };
      }

      const { 
        customer_name, 
        phone_number, 
        chatbot_id, 
        active_project, 
        project_ids = [],
        session_id
      } = metadata;

       console.log("[scheduleVisit] Using metadata:", { customer_name, phone_number, chatbot_id, active_project, session_id });

       if (!customer_name || !phone_number || !chatbot_id || !session_id) {
         console.error("[scheduleVisit] Missing critical metadata:", { customer_name, phone_number, chatbot_id, session_id });
         return { error: "Missing required customer or session information." };
       }

        // Determine the property ID to schedule for
        let property_id = active_project;
        if (!property_id || property_id === "N/A") {
          if (project_ids.length > 0) {
            property_id = project_ids[0]; // Fallback to the first project ID if active_project is not set
            console.log("[scheduleVisit] No active project set, using first project ID as property ID:", property_id);
          } else {
            console.error("[scheduleVisit] No active_project or project_ids available in metadata.");
            return { error: "I don't have information about the specific property for scheduling." };
          }
        }

        console.log(`[scheduleVisit] Scheduling visit for property ID: ${property_id}`);

        if (!scheduleVisitFuncKey) {
            console.error("[scheduleVisit] Missing NEXT_PUBLIC_SCHEDULE_VISIT_FUNC_KEY environment variable.");
            return { error: "Server configuration error prevents scheduling." };
        }

        try {
            const response = await fetch(
              scheduleVisitFuncUrl,
              {
                method: "POST",
                headers: {
                  // Use the specific API key for this function
                  "Authorization": `Bearer ${scheduleVisitFuncKey}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  customerName: customer_name,
                  phoneNumber: phone_number,
                  propertyId: property_id,
                  visitDateTime: visitDateTime,
                  chatbotId: chatbot_id,
                  sessionId: session_id // Include session ID if the API needs it
                })
              }
            );

            const result = await response.json();

            if (!response.ok) {
              console.error("[scheduleVisit] Schedule API error:", result?.error || response.statusText);
              return { error: result?.error || "Failed to schedule the visit via the API." };
            }

            console.log("[scheduleVisit] Schedule visit successful:", result);

            // Update agent state to reflect scheduling
            if (scheduleMeetingAgent.metadata) {
                 scheduleMeetingAgent.metadata.has_scheduled = true;
            }
            // Also update the realEstateAgent's metadata if possible (might need event bus or context)
            // Consider how to propagate this state change back

            // Signal transfer back to realEstate agent after success
            return { 
              success: true, 
              message: `OK, I've scheduled your visit for ${visitDateTime}.`, // Confirmation message
              destination_agent: "realEstate",
              has_scheduled: true // Pass this back so metadata gets updated on transfer
            };

        } catch (error: any) {
           console.error("[scheduleVisit] Exception calling schedule API:", error);
           return { error: `Failed to schedule visit due to an exception: ${error.message}` };
        }
    }
  }
};

export default scheduleMeetingAgent; 