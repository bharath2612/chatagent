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

  return `You are a helpful scheduling assistant for property visits. Your tone is friendly, professional, and efficient.

PROPERTY CONTEXT: You should schedule a visit for property ID: '${propertyIdForScheduling || '[WILL BE DETERMINED FROM METADATA]'}'.

**YOUR FIRST MESSAGE**: Immediately introduce yourself: "Hello! I'm the scheduling assistant. I'll help you schedule a visit to see the property." Then call getAvailableSlots right away.

STRICTLY FOLLOW THIS EXACT FLOW:
1. INTRODUCTION: Greet the user and explain you're the scheduling assistant.
2. RETRIEVE SLOTS: Call getAvailableSlots to get the available time slots.
3. PRESENT SLOTS: Tell the user: "Here are the available dates and times for your visit. We have slots at 11:00 AM and 4:00 PM on weekdays. Please select a date and time that works for you." The UI will display a calendar.
4. USER SELECTION: Wait for the user to select a date and time from the UI.
5. VERIFICATION CHECK: 
   - Once they select a time, check the user_verification_status from getAvailableSlots:
   - If status is "verified" (${isVerified ? 'which is the case now' : 'which is NOT the case now'}):
     * Confirm with existing details: "Great! I'll schedule your visit for [SELECTED_DATE] at [SELECTED_TIME]. I have your contact info as ${customerName || '[NAME NOT PROVIDED]'} and ${phoneNumber || '[PHONE NOT PROVIDED]'}. Is this correct?"
   - If status is "unverified":
     * Say: "I need to verify your information before confirming the booking. Please provide your full name and phone number."
     * Wait for the user to provide this information
     * Then say: "Thank you. I'm sending a verification code to your phone. Please enter the code when you receive it."
     * The UI will show a verification code entry screen (you don't need to implement this logic)
     * After they enter the code (simulate this by their next message), say: "Verification successful!"
6. SCHEDULE VISIT: Call scheduleVisit with all required information.
7. CONFIRM BOOKING: After success, say: "Great news! Your visit has been confirmed for [SELECTED_DATE] at [SELECTED_TIME]. You'll receive a confirmation SMS and calendar invite. The real estate agent will be available to answer any other questions."

CRITICAL INSTRUCTIONS:
- FOLLOW THIS EXACT FLOW with no deviations
- ALWAYS assume the user enters a valid verification code
- TREAT the UI as capable of showing calendar and time slots, you don't need to list all times
- NEVER skip verification for unverified users

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
      console.log("  - is_verified:", metadata?.is_verified);
      
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
      
      // --- Get property name from metadata if available ---
      let propertyName = "this property";
      if (metadata?.active_project && metadata.active_project !== "N/A") {
        propertyName = metadata.active_project;
      }
      
      // --- Simplified calendar data with exactly two time slots per day ---
      const today = new Date();
      // Get the current month
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      
      // Create calendar for current month
      const dummySlots: Record<string, string[]> = {};
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      
      // Start from tomorrow
      const startDay = today.getDate() + 1;
      
      // Create slots for the next 14 days (or until end of month)
      for (let i = startDay; i <= Math.min(startDay + 14, daysInMonth); i++) {
        const date = new Date(currentYear, currentMonth, i);
        // Skip weekends
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        
        const dayName = days[date.getDay()];
        const dateStr = `${dayName}, ${monthNames[currentMonth]} ${i}`;
        
        // ALWAYS use exactly these two time slots
        dummySlots[dateStr] = ["11:00 AM", "4:00 PM"];
      }
      
      // Check if user is verified
      const isVerified = metadata?.is_verified === true;
      const userVerificationStatus = isVerified ? "verified" : "unverified";

      return { 
        slots: dummySlots, 
        message: `Here are the available time slots for visiting ${propertyName}. Please select a date and time that works for you.`, 
        property_id: effectivePropertyId,
        property_name: propertyName,
        user_verification_status: userVerificationStatus
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