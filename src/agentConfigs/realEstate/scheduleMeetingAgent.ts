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
  const propertyIdForScheduling = (metadata as any)?.property_id_to_schedule;
  const propertyName = (metadata as any)?.property_name || "the property"; // Get name if available

  return `You are a helpful scheduling assistant for ${propertyName}. Your tone is friendly and efficient.

**VERY FIRST ACTION**: Your absolute FIRST task, BEFORE saying anything, is to call 'getAvailableSlots'.

STRICTLY FOLLOW THIS EXACT FLOW:
1. CALL TOOL: Immediately call getAvailableSlots. Output ONLY the tool call.
2. GREET & ASK DATE: After getAvailableSlots returns, THEN greet the user ("Hello! I'm here to help you schedule a visit to ${propertyName}.") and ask them to select a date: "Please select a date for your visit from the calendar below." The UI will display the calendar.
3. WAIT FOR DATE: User selects a date from the UI.
4. ASK TIME: Once date is selected (user will message like "Selected Tuesday, May 21"), ask for time: "Great. Please select a time from the available options." The UI will show time buttons.
5. WAIT FOR TIME: User selects a time (user will message like "Selected 4:00 PM").
6. CHECK VERIFICATION (using status from getAvailableSlots result):
   - If user_verification_status was "verified":
     * Confirm details: "Perfect! I have your details as ${customerName || '[Name not provided]'} and ${phoneNumber || '[Phone not provided]'}. To confirm your visit for ${propertyName} on [Selected Date] at [Selected Time], please reply 'Confirm'."
     * Wait for user confirmation (e.g., "Confirm", "Yes").
     * On confirmation, CALL TOOL: scheduleVisit.
   - If user_verification_status was "unverified":
     * CALL TOOL: requestAuthentication. DO NOT add any explanation about authentication.
     * Your turn ends immediately.
7. HANDLE scheduleVisit RESULT:
   * If scheduleVisit tool succeeds (returns booking_confirmed: true):
     * Confirm to user: "Great news! Your visit to ${propertyName} on [Selected Date] at [Selected Time] is confirmed! You'll receive details shortly."
     * CALL TOOL: completeScheduling. Your turn ends.
   * If scheduleVisit tool fails:
     * Inform user: "I encountered an issue scheduling your visit. Please try again later or contact support."
     * CALL TOOL: completeScheduling. Your turn ends.

CRITICAL RULES:
- Step 1 (getAvailableSlots) MUST be your first output.
- Follow the flow exactly.
- Let the authentication agent handle name/phone collection if needed.
- End your turn immediately after calling requestAuthentication or completeScheduling.
- NEVER mention "transferring" to another agent or that another agent will handle verification.

LANGUAGE: Respond ONLY in ${language}.
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
      description: "MUST be called first. Retrieves available dates/times for a property visit.",
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
      name: "scheduleVisit",
      description: "Schedules the visit AFTER date/time selection and verification (if needed).",
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
    {
      type: "function",
      name: "requestAuthentication", // NEW TOOL
      description: "Transfers to the authentication agent when user details need verification.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    {
      type: "function",
      name: "completeScheduling", // NEW TOOL
      description: "Transfers back to the real estate agent after successful booking confirmation.",
      parameters: { type: "object", properties: {}, required: [] },
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
      
      // Instead of generating dummy dates, return an empty object 
      // This will allow the UI to show the full calendar for user selection
      // We'll just specify the time slots to show after date selection
      const slots: Record<string, string[]> = {};
      
      // We only need to specify the available time slots
      // These will be shown after the user selects any date
      // Fixed standard time slots for all dates
      const standardTimeSlots = ["11:00 AM", "4:00 PM"];
      
      // If the UI has previously stored a selected date, add it to the slots
      // This makes it compatible with the existing UI code
      if ((metadata as any)?.selectedDate) {
        slots[(metadata as any).selectedDate] = standardTimeSlots;
      }
      
      // Check if user is verified
      const isVerified = metadata?.is_verified === true;
      const userVerificationStatus = isVerified ? "verified" : "unverified";

      return { 
        slots: slots,  // Empty object - will let UI show full calendar
        timeSlots: standardTimeSlots, // Provide standard time slots for ALL dates
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
      console.log("  - selectedDate from metadata:", (metadata as any)?.selectedDate);
      console.log("  - selectedTime from metadata:", (metadata as any)?.selectedTime);

      // Check if we have stored date and time in metadata
      let actualVisitDateTime = visitDateTime;
      if (!actualVisitDateTime && (metadata as any)?.selectedDate && (metadata as any)?.selectedTime) {
        actualVisitDateTime = `${(metadata as any).selectedDate} at ${(metadata as any).selectedTime}`;
        console.log(`[scheduleVisit] Using date/time from metadata: ${actualVisitDateTime}`);
      }

      // If we still don't have a date/time, report an error
      if (!actualVisitDateTime) {
        console.error("[scheduleVisit] No visit date/time provided.");
        return { error: "No date and time selected for the visit." };
      }

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

      // Ensure user is verified (check metadata updated after potential auth flow)
      if (!metadata.is_verified) {
           console.warn("[scheduleVisit] User is not verified AFTER potential auth flow. Should not happen.");
           // This case ideally shouldn't be reached if the flow is correct
           return { error: "Verification still pending. Please complete verification first."};
      }

      // Determine customer details: prioritize args, fallback to metadata (which should be updated now)
      const customer_name = nameFromArgs || metadata.customer_name;
      const phone_number = phoneFromArgs || metadata.phone_number;

      console.log("[scheduleVisit] Using details - Name:", customer_name, "Phone:", phone_number);

      // Check if details are STILL missing (should not happen after verification)
      if (!customer_name || !phone_number) {
        console.error("[scheduleVisit] Missing customer name or phone number AFTER verification flow.");
        return { error: "Missing required customer details even after verification." };
      }

      // Check if property_id is missing
      if (!property_id) {
          console.error("[scheduleVisit] Missing property ID (not in args or metadata). Cannot schedule.");
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
                  visitDateTime: actualVisitDateTime,
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

            console.log("[scheduleVisit] Schedule visit successful via API:", result);

            // Return structure indicating completion and transfer is needed
            return {
              booking_confirmed: true, // Signal confirmation
              confirmed_date: actualVisitDateTime, // Pass back details for confirmation message
              // Let the agent decide to call completeScheduling based on this tool's success
              message: "Booking successful via API." // Internal message, agent will generate final confirmation
            };

        } catch (error: any) {
           console.error("[scheduleVisit] Exception calling schedule API:", error);
           return { error: `Failed to schedule visit due to an exception: ${error.message}` };
        }
    },
    requestAuthentication: async () => {
      console.log("[scheduleMeeting.requestAuthentication] Transferring to authentication agent.");
      return {
        destination_agent: "authentication",
        silentTransfer: true,
        // Pass necessary context implicitly via metadata copy
        came_from: 'scheduling' 
      };
    },
    completeScheduling: async () => {
      console.log("[scheduleMeeting.completeScheduling] Scheduling complete, transferring back to realEstate agent.");
      return {
        destination_agent: "realEstate",
        silentTransfer: true,
        // Pass updated has_scheduled flag implicitly via metadata copy
        has_scheduled: true 
      };
    },
    // Add mock implementation for trackUserMessage (used by realEstate agent)
    // This prevents the "Tool logic not found" error if LLM tries to call it
    trackUserMessage: async ({ message }: { message: string }) => {
      console.log("[ScheduleMeeting] Received trackUserMessage call (ignoring):", message);
      // Return success without side effects - this is a no-op in scheduling agent
      return { success: true, message: "Scheduling agent acknowledges message" };
    },
    
    // Add mock implementation for detectPropertyInMessage (used by realEstate agent)
    detectPropertyInMessage: async ({ message }: { message: string }) => {
      console.log("[ScheduleMeeting] Received detectPropertyInMessage call (ignoring):", message);
      // Return "no property detected" to avoid confusing the LLM
      return { propertyDetected: false, message: "Scheduling agent does not detect properties" };
    }
  }
};

// Update getInstructions function (below scheduleMeetingAgent definition)
const updatedInstructions = (metadata: AgentMetadata | undefined | null): string => {
   const language = metadata?.language || "English";
   const isVerified = metadata?.is_verified ?? false;
   const customerName = metadata?.customer_name;
   const phoneNumber = metadata?.phone_number;
   const propertyIdForScheduling = (metadata as any)?.property_id_to_schedule;
   const propertyName = (metadata as any)?.property_name || "the property"; // Get name if available
 
   return `You are a helpful scheduling assistant for ${propertyName}. Your tone is friendly and efficient.
 
 **VERY FIRST ACTION**: Your absolute FIRST task, BEFORE saying anything, is to call 'getAvailableSlots'.
 
 STRICTLY FOLLOW THIS EXACT FLOW:
 1. CALL TOOL: Immediately call getAvailableSlots. Output ONLY the tool call.
 2. GREET & ASK DATE: After getAvailableSlots returns, THEN greet the user ("Hello! I'm here to help you schedule a visit to ${propertyName}.") and ask them to select a date: "Please select a date for your visit from the calendar below." The UI will display the calendar.
 3. WAIT FOR DATE: User selects a date from the UI.
 4. ASK TIME: Once date is selected (user will message like "Selected Tuesday, May 21"), ask for time: "Great. Please select a time from the available options." The UI will show time buttons.
 5. WAIT FOR TIME: User selects a time (user will message like "Selected 4:00 PM").
 6. CHECK VERIFICATION (using status from getAvailableSlots result):
    - If user_verification_status was "verified":
      * Confirm details: "Perfect! I have your details as ${customerName || '[Name not provided]'} and ${phoneNumber || '[Phone not provided]'}. To confirm your visit for ${propertyName} on [Selected Date] at [Selected Time], please reply 'Confirm'."
      * Wait for user confirmation (e.g., "Confirm", "Yes").
      * On confirmation, CALL TOOL: scheduleVisit.
    - If user_verification_status was "unverified":
      * CALL TOOL: requestAuthentication. DO NOT add any explanation about authentication.
      * Your turn ends immediately.
 7. HANDLE scheduleVisit RESULT:
    * If scheduleVisit tool succeeds (returns booking_confirmed: true):
      * Confirm to user: "Great news! Your visit to ${propertyName} on [Selected Date] at [Selected Time] is confirmed! You'll receive details shortly."
      * CALL TOOL: completeScheduling. Your turn ends.
    * If scheduleVisit tool fails:
      * Inform user: "I encountered an issue scheduling your visit. Please try again later or contact support."
      * CALL TOOL: completeScheduling. Your turn ends.
 
 CRITICAL RULES:
 - Step 1 (getAvailableSlots) MUST be your first output.
 - Follow the flow exactly.
 - Let the authentication agent handle name/phone collection if needed.
 - End your turn immediately after calling requestAuthentication or completeScheduling.
 - NEVER mention "transferring" to another agent or that another agent will handle verification.
 
 LANGUAGE: Respond ONLY in ${language}.
 `;
 };
 
 // Assign the updated instructions function
 scheduleMeetingAgent.instructions = updatedInstructions(undefined); 
 // We'll rely on session updates to refresh instructions with live metadata

export default scheduleMeetingAgent; 