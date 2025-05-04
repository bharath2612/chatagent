import { AgentConfig, AgentMetadata } from "@/types/types"; // Adjusted path
// import supabaseAdmin from "@/app/lib/supabaseClient"; // Supabase client needs setup

// Required Environment Variables: NEXT_PUBLIC_SCHEDULE_VISIT_FUNC_URL, NEXT_PUBLIC_SCHEDULE_VISIT_FUNC_KEY

const scheduleVisitFuncUrl = process.env.NEXT_PUBLIC_SCHEDULE_VISIT_FUNC_URL || "https://dsakezvdiwmoobugchgu.supabase.co/functions/v1/schedule-visit-whatsapp";
const scheduleVisitFuncKey = process.env.NEXT_PUBLIC_SCHEDULE_VISIT_FUNC_KEY; // Needs to be set!

// Function to generate instructions based on metadata
const getScheduleMeetingInstructions = (metadata: AgentMetadata | undefined | null): string => {
  const language = metadata?.language || "English";
  const isVerified = metadata?.is_verified ?? false;
  const customerName = metadata?.customer_name;
  const phoneNumber = metadata?.phone_number;
  const propertyIdForScheduling = (metadata as any)?.property_id_to_schedule; // Access the passed property ID

  return `You are a helpful assistant that schedules property visits for users who have already been verified.

IMPORTANT: Only proceed if the user is verified (${isVerified ? 'they ARE verified' : 'they are NOT verified - explain and transfer silently back to realEstate'}).

PROPERTY CONTEXT: You should schedule the visit for property ID: '${propertyIdForScheduling || '[UNKNOWN - USE getAvailableSlots TO CONFIRM]'}'.

Your goal is a multi-step process:
1.  Retrieve Available Slots: Your **FIRST ACTION** MUST BE to call the 'getAvailableSlots' tool. Use the property ID: '${propertyIdForScheduling || '[TOOL WILL USE DEFAULT IF MISSING]'}'. Do NOT skip this step.
2.  Present Slots: Inform the user about the available slots (e.g., "Here are the available slots..."). The UI will display cards for selection.
3.  Receive User Selection: The user will respond by selecting a time slot (e.g., "Monday 2pm to 5pm sounds good").
4.  Check for User Details (AFTER user selects a slot):
    - Check if you already know the user's name ('${customerName || 'unknown'}') and phone number ('${phoneNumber || 'unknown'}').
    - If EITHER name or phone number is missing, ask the user for BOTH (e.g., "To confirm the booking for [Selected Slot], please provide your full name and phone number."). Wait for their response.
5.  Receive User Details (if needed): The user will provide their name and phone number.
6.  Schedule the Visit: Once you have the selected slot AND the user's name and phone number (from metadata or their latest message), call the 'scheduleVisit' tool. Pass 'visitDateTime', 'property_id' ('${propertyIdForScheduling || '[TOOL WILL USE DEFAULT IF MISSING]'}'), 'customer_name', and 'phone_number'.
7.  Confirm Booking & Transfer: After 'scheduleVisit' succeeds (it will return success: true), confirm the booking details (e.g., "OK, I've scheduled your visit for [Selected Slot].") and mention the main agent will take over. The transfer back will be silent.

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
      name: "getAvailableSlots",
      description: "Retrieves available time slots for a property visit in the current week.",
      parameters: {
        type: "object",
        properties: {
          property_id: { type: "string", description: "The ID of the property to check slots for." },
        },
        required: ["property_id"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "scheduleVisit", // Renamed for consistency
      description: "Schedules a property visit for a verified user AFTER getting available slots and confirming user details.",
      parameters: {
        type: "object",
        properties: {
          visitDateTime: {
            type: "string",
            description: "The specific date and time slot selected by the user (e.g., 'Monday, July 29th, 2024 at 2:00 PM')",
          },
          property_id: { type: "string", description: "The ID of the property for the visit." },
           customer_name: { type: "string", description: "The customer's full name (required if not already in metadata)." },
           phone_number: { type: "string", description: "The customer's phone number (required if not already in metadata)." },
           // Metadata (chatbot_id, session_id, potentially verified status) accessed internally
        },
        required: ["visitDateTime", "property_id"],
        additionalProperties: false,
      },
    },
  ],
  toolLogic: {
    getAvailableSlots: async ({ property_id }: { property_id: string }) => {
      console.log(`[getAvailableSlots] Fetching slots for property ID: ${property_id || 'UNDEFINED - Using default'}`);
      
      // Add debugging for property ID
      const metadata = scheduleMeetingAgent.metadata;
      console.log("[getAvailableSlots] DEBUG - metadata info:");
      console.log("  - property_id from param:", property_id);
      console.log("  - property_id_to_schedule from metadata:", (metadata as any)?.property_id_to_schedule);
      console.log("  - project_ids from metadata:", metadata?.project_ids);
      
      // Use property_id_to_schedule from metadata if property_id is missing
      let effectivePropertyId = property_id;
      if (!effectivePropertyId && (metadata as any)?.property_id_to_schedule) {
        effectivePropertyId = (metadata as any).property_id_to_schedule;
        console.log(`[getAvailableSlots] Using property_id_to_schedule from metadata: ${effectivePropertyId}`);
      }
      
      // Fallback to first project_id if still missing
      if (!effectivePropertyId && metadata?.project_ids && metadata.project_ids.length > 0) {
        effectivePropertyId = metadata.project_ids[0];
        console.log(`[getAvailableSlots] Falling back to first project_id: ${effectivePropertyId}`);
      }
      
      // --- TODO: Implement API call to backend to fetch actual slots --- 
      // Replace with actual API call
      // const response = await fetch(SLOTS_API_URL, { property_id: effectivePropertyId, ... });
      // const data = await response.json();

      // --- Dummy data for now --- 
      const dummySlots = {
        "Monday": ["8:00 am - 12:00 pm", "2:00 pm - 5:00 pm"],
        "Tuesday": ["9:00 am - 1:00 pm"],
        "Wednesday": ["10:00 am - 4:00 pm"],
        "Thursday": ["8:00 am - 12:00 pm", "2:00 pm - 5:00 pm"],
        "Friday": ["9:00 am - 1:00 pm"]
      };

      return { 
        slots: dummySlots, 
        message: "Here are the available time slots for this week. Please select one.", // Message for LLM
        property_id: effectivePropertyId, // Return the effective property ID
        // UI hint: maybe add a flag like displaySlots: true?
      };
    },
    scheduleVisit: async ({ visitDateTime, property_id: propertyIdFromArgs, customer_name: nameFromArgs, phone_number: phoneFromArgs }: { visitDateTime: string; property_id?: string; customer_name?: string; phone_number?: string }) => {
      console.log(`[scheduleVisit] Attempting to schedule visit for: ${visitDateTime} at property ${propertyIdFromArgs}`);

      const metadata: AgentMetadata | undefined = scheduleMeetingAgent.metadata;

      if (!metadata) {
           console.error("[scheduleVisit] Agent metadata is missing.");
           return { error: "Missing required agent information for scheduling." };
      }

      // Add extra debugging
      console.log("[scheduleVisit] DEBUG - metadata info:");
      console.log("  - property_id from args:", propertyIdFromArgs);
      console.log("  - property_id_to_schedule from metadata:", (metadata as any)?.property_id_to_schedule);
      console.log("  - project_ids from metadata:", metadata?.project_ids);

      // Determine property ID: prioritize args, fallback to metadata passed during transfer
      let property_id = propertyIdFromArgs || (metadata as any)?.property_id_to_schedule;
      
      // If still no property ID, check if one exists in the transcript (getAvailableSlots response)
      if (!property_id && (metadata as any)?.lastReturnedPropertyId) {
        property_id = (metadata as any).lastReturnedPropertyId;
        console.log(`[scheduleVisit] Using property ID from previous getAvailableSlots call: ${property_id}`);
      }
      
      // Fallback to first project_id if still missing
      if (!property_id && metadata?.project_ids && metadata.project_ids.length > 0) {
        property_id = metadata.project_ids[0];
        console.log(`[scheduleVisit] Falling back to first project_id: ${property_id}`);
      }

      // Ensure user is verified (redundant check, but safe)
      if (!metadata.is_verified) {
           console.warn("[scheduleVisit] User is not verified. Cannot schedule visit.");
           return { error: "Sorry, I can only schedule visits for verified users. Let me transfer you back.", destination_agent: "realEstate", silentTransfer: true };
      }

      // Determine customer details: prioritize args, fallback to metadata
      const customer_name = nameFromArgs || metadata.customer_name;
      const phone_number = phoneFromArgs || metadata.phone_number;

      console.log("[scheduleVisit] Using details - Name:", customer_name, "Phone:", phone_number);

      // Check if details are missing
      if (!customer_name || !phone_number) {
        console.log("[scheduleVisit] Missing customer name or phone number.");
        return {
          needDetails: true,
          message: "To confirm the booking for [Selected Slot], please provide your full name and phone number.", // LLM asks this
          // UI hint: display name/phone input fields
        };
      }

      // Check if property_id is missing
      if (!property_id) {
          console.error("[scheduleVisit] Missing property ID (not in args or metadata).");
          return { error: "Cannot schedule visit without knowing the property." };
      }

      const { chatbot_id, session_id } = metadata;

       console.log("[scheduleVisit] Using metadata:", { chatbot_id, session_id });

       if (!chatbot_id || !session_id) {
         console.error("[scheduleVisit] Missing critical metadata:", { chatbot_id, session_id });
         return { error: "Missing required session information." };
       }

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
                  "Authorization": `Bearer ${scheduleVisitFuncKey}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  customerName: customer_name, // Use determined name
                  phoneNumber: phone_number, // Use determined phone
                  propertyId: property_id,
                  visitDateTime: visitDateTime,
                  chatbotId: chatbot_id,
                  sessionId: session_id
                })
              }
            );

            const result = await response.json();

            if (!response.ok) {
              console.error("[scheduleVisit] Schedule API error:", result?.error || response.statusText);
              return { error: result?.error || "Failed to schedule the visit via the API." };
            }

            console.log("[scheduleVisit] Schedule visit successful:", result);

            // Update agent state
            if (scheduleMeetingAgent.metadata) {
                 scheduleMeetingAgent.metadata.has_scheduled = true;
                 // Store confirmed details if they came from args
                 if (nameFromArgs) scheduleMeetingAgent.metadata.customer_name = nameFromArgs;
                 if (phoneFromArgs) scheduleMeetingAgent.metadata.phone_number = phoneFromArgs;
            }

            return {
              success: true,
              message: `OK, I've scheduled your visit for ${visitDateTime}. The real estate agent will take over now.`, // Confirmation message
              destination_agent: "realEstate",
              silentTransfer: true, // Silent transfer back
              has_scheduled: true // Pass back for metadata update on transfer
            };

        } catch (error: any) {
           console.error("[scheduleVisit] Exception calling schedule API:", error);
           return { error: `Failed to schedule visit due to an exception: ${error.message}` };
        }
    }
  }
};

export default scheduleMeetingAgent; 