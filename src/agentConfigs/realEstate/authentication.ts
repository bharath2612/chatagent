import { AgentConfig, AgentMetadata } from "@/types/types";
// import supabaseAdmin from "@/app/lib/supabaseClient"; // Supabase client needs setup in new project

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Use the Supabase function URL from the "old" working code
const supabaseFuncUrl = process.env.NEXT_PUBLIC_SUPABASE_FUNC_URL || "https://dsakezvdiwmoobugchgu.supabase.co/functions/v1/phoneAuth";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // This was in the old code's logic

// Function to get instructions based on metadata
const getAuthInstructions = (metadata: AgentMetadata | undefined | null) => {
  const language = metadata?.language || "English";
  const cameFrom = (metadata as any)?.came_from || "the main agent";
  const customerName = metadata?.customer_name;

  return `You are an authentication assistant. Your primary goal is to verify the user's phone number via OTP.
- **STYLE:** fun-casual, like you're chatting with a friend.
- **LENGTH:** absolute maximum 2 short sentences (≈ 30 words). Never write paragraphs.

***IMPORTANT: YOUR VERY FIRST MESSAGE MUST ALWAYS BE EXACTLY: "Welcome! To continue, please fill out the form below." DO NOT SAY ANYTHING ELSE IN YOUR FIRST MESSAGE.***

**AVAILABLE TOOLS: You have access to these tools ONLY:**
- submitPhoneNumber (used to submit the user's phone number and trigger an OTP)
- verifyOTP (used to verify the OTP code entered by the user)

***IMPORTANT: You DO NOT have access to these tools that other agents might use:***
- completeScheduling (only available to scheduleMeeting agent)
- initiateScheduling (only available to realEstate agent)
- getAvailableSlots (only available to scheduleMeeting agent)

**Current Status**:
- Came from: ${cameFrom}
${customerName ? `- User Name Provided: ${customerName}` : `- User Name: Not yet provided`}

**Strict Flow:**
1.  ${customerName ? "You already have the user's name." : "**ASK NAME:** If you don't have the user's name yet, ask ONLY for their name first: \"What is your full name, please?\""}
2.  **WAIT FOR NAME (if asked):** User will reply with their name.
3.  **ASK PHONE:** Once you have the name (or if you started with it), ask for the phone number: "Thank you, ${customerName || '[User Name]'}. Please provide your phone number, including the country code, so I can send a verification code." (UI will show VERIFICATION_FORM).
4.  **WAIT FOR PHONE:** User submits phone number via the form. You will call 'submitPhoneNumber'.
5.  **HANDLE submitPhoneNumber RESULT:**
    *   If successful (OTP sent), the tool result includes ui_display_hint: 'OTP_FORM' and a message like "I've sent a 6-digit code...". YOUR RESPONSE SHOULD BE EMPTY OR A VERY BRIEF ACKNOWLEDGEMENT like "Okay." The UI will show the OTP form.
    *   If failed, the tool result includes ui_display_hint: 'VERIFICATION_FORM' or 'CHAT' and an error message. Relay the error message and potentially ask them to re-enter the number.
6.  **WAIT FOR OTP:** User submits OTP via the form. You will call 'verifyOTP'.
7.  **HANDLE verifyOTP RESULT:**
    *   If successful (verified: true), the tool result includes ui_display_hint: 'CHAT', a success message, and destination_agent details. Your response MUST BE EMPTY. The transfer back will happen automatically.
    *   If failed (verified: false), the tool result includes ui_display_hint: 'OTP_FORM' and an error message. Relay the error message (e.g., "That code doesn't seem right. Please try again.") and the user can re-enter the OTP.

**CRITICAL RULES:**
- YOUR VERY FIRST MESSAGE MUST BE EXACTLY: "Welcome! To continue, please fill out the form below."
- Follow the flow exactly. Do not skip steps.
- Ask for NAME first, THEN phone number.
- Rely on the tool results' messages and ui_display_hints to manage the flow.
- DO NOT generate your own messages when the tool provides one (e.g., after sending OTP or confirming verification).
- Your response MUST BE EMPTY when verifyOTP succeeds, as the transfer handles the next step.
- Respond ONLY in ${language}.
`;
};

const authenticationAgent: AgentConfig = {
  name: "authentication",
  publicDescription: "Handles user phone number verification.",
  instructions: getAuthInstructions(undefined),
  tools: [
    {
      type: "function",
      name: "submitPhoneNumber",
      description: "Submits the user's name and phone number to the backend to trigger an OTP code send.",
      parameters: {
        type: "object",
        properties: {
          // Matching "old" code parameters
          name: { type: "string", description: "The user's first name." },
          phone_number: { type: "string", description: "The user's phone number in E.164 format (e.g., +1234567890).", pattern: "^\\+\\d{10,15}$" },
          session_id: { type: "string", description: "The current session ID" },
          org_id: { type: "string", description: "The organization ID" },
          chatbot_id: { type: "string", description: "The chatbot ID" }
        },
        required: ["name", "phone_number", "session_id", "org_id", "chatbot_id"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "verifyOTP", // Renamed from submitOtp
      description: "Verify the OTP sent to the user's phone number",
      parameters: {
        type: "object",
        properties: {
          // Matching "old" code parameters
          phone_number: { type: "string", description: "The user's phone number in E.164 format" },
          otp: { type: "string", description: "The OTP code received by the user" }, // Renamed from otp_code
          session_id: { type: "string", description: "The current session ID" },
          org_id: { type: "string", description: "The organization ID" },
          chatbot_id: { type: "string", description: "The chatbot ID" }
        },
        required: ["phone_number", "otp", "session_id", "org_id", "chatbot_id"],
        additionalProperties: false,
      },
    },
    // Removed deprecated transferToRealEstate tool
  ],
  toolLogic: {
    submitPhoneNumber: async ({
      name, // Matches old param name
      phone_number,
      session_id,
      org_id,
      chatbot_id,
    }: {
      name: string;
      phone_number: string;
      session_id: string;
      org_id: string;
      chatbot_id: string;
    }) => {
      console.log("=== AUTHENTICATION AGENT METADATA (submitPhoneNumber) ===");
      console.log(`Agent metadata:`, {
        stored_chatbot_id: authenticationAgent.metadata?.chatbot_id || 'undefined',
        stored_org_id: authenticationAgent.metadata?.org_id || 'undefined',
        stored_session_id: authenticationAgent.metadata?.session_id || 'undefined',
        came_from: (authenticationAgent.metadata as any)?.came_from || 'undefined'
      });
      console.log(`Received args:`, { name, phone_number, session_id, org_id, chatbot_id });

      if (!anonKey) {
        console.error("[submitPhoneNumber] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");
        return { error: "Server configuration error.", ui_display_hint: 'CHAT', message: "Server configuration error." };
      }
      if (!name || !name.trim()) {
        return { error: "Name is required.", ui_display_hint: 'VERIFICATION_FORM', message: "Please provide your name." };
      }
      if (!phone_number || !/^\+[1-9]\d{1,14}$/.test(phone_number)) {
          return { 
              error: "Invalid phone number format.", 
              ui_display_hint: 'VERIFICATION_FORM', 
              message: "Please enter a valid phone number including the country code (e.g., +14155552671)."
          };
      }

      // ID Validation logic from "old" code
      let final_org_id = org_id;
      if (!UUID_REGEX.test(org_id)) {
        if (authenticationAgent.metadata?.org_id && UUID_REGEX.test(authenticationAgent.metadata.org_id)) {
          final_org_id = authenticationAgent.metadata.org_id;
        } else {
          return { error: "Invalid organization ID format", ui_display_hint: 'CHAT', message: "Internal error: Invalid organization ID." };
        }
      }
      let final_chatbot_id = chatbot_id;
      if (chatbot_id === "default" || !UUID_REGEX.test(chatbot_id) || chatbot_id === org_id) {
        if (authenticationAgent.metadata?.chatbot_id && UUID_REGEX.test(authenticationAgent.metadata.chatbot_id)) {
          final_chatbot_id = authenticationAgent.metadata.chatbot_id;
        } else {
          final_chatbot_id = "00000000-0000-0000-0000-000000000000"; // Fallback, should be valid
        }
      }
      let final_session_id = session_id;
      const isValidUUID = UUID_REGEX.test(session_id) || /^[0-9a-f]{32}$/i.test(session_id);
      const isSimpleDummyId = session_id.startsWith('session_') || session_id.includes('123') || session_id.length < 16 || !session_id.match(/^[a-zA-Z0-9-_]+$/) || session_id === org_id || session_id === chatbot_id;
      if (!isValidUUID || isSimpleDummyId) {
        if (authenticationAgent.metadata?.session_id && authenticationAgent.metadata.session_id.length > 16) {
          final_session_id = authenticationAgent.metadata.session_id;
        } else {
          final_session_id = Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
          if (authenticationAgent.metadata) authenticationAgent.metadata.session_id = final_session_id;
        }
      }
      // Ensure different IDs
      if (final_session_id === final_org_id || final_chatbot_id === final_org_id || final_session_id === final_chatbot_id) {
         // Simplified error, complex recovery might be too risky here
         console.error("[submitPhoneNumber] CRITICAL ERROR: Detected duplicate IDs.");
         return { error: "Internal ID conflict.", ui_display_hint: 'CHAT', message: "An internal error occurred. Please try again."};
      }
      
      console.log("[submitPhoneNumber] FINAL VALIDATED VALUES:", { final_session_id, final_org_id, final_chatbot_id, phone_number, name });

      const requestBody = {
        session_id: final_session_id,
        phone_number,
        org_id: final_org_id,
        name,
        platform: "WebChat",
        chat_mode: "voice", // Assuming voice, can be dynamic
        chatbot_id: final_chatbot_id,
      };

      try {
        console.log(`[submitPhoneNumber] Using phoneAuth URL: ${supabaseFuncUrl}`);
        const response = await fetch(supabaseFuncUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}` },
          body: JSON.stringify(requestBody),
        });
        const data = await response.json();
        console.log("[submitPhoneNumber] PhoneAuth response:", data);

        if (response.ok && data.success !== false) { // data.success could be true or undefined if not explicitly set to false
            if (authenticationAgent.metadata) {
                authenticationAgent.metadata.customer_name = name; // Use 'name' as per old code
                authenticationAgent.metadata.phone_number = phone_number;
                authenticationAgent.metadata.chatbot_id = final_chatbot_id;
                authenticationAgent.metadata.org_id = final_org_id;
                authenticationAgent.metadata.session_id = final_session_id;
            }
            return {
                success: true,
                message: data.message || "I've sent a 6-digit verification code to your phone. Please enter it below.",
                ui_display_hint: 'OTP_FORM',
            };
        } else {
            const errorMsg = data.error || data.message || "Failed to send OTP.";
            return {
                success: false,
                error: errorMsg,
                ui_display_hint: 'VERIFICATION_FORM',
                message: `Error: ${errorMsg}`
            };
        }
      } catch (error: any) {
        console.error("[submitPhoneNumber] Exception:", error);
        return { error: `Exception: ${error.message}`, ui_display_hint: 'VERIFICATION_FORM', message: "An unexpected error occurred." };
      }
    },

    verifyOTP: async ({ // Renamed from submitOtp
      phone_number,
      otp, // Renamed from otp_code
      session_id,
      org_id,
      chatbot_id,
    }: {
      phone_number: string;
      otp: string;
      session_id: string;
      org_id: string;
      chatbot_id: string;
    }) => {
        console.log("=== AUTHENTICATION AGENT METADATA (verifyOTP) ===");
        console.log(`Agent metadata:`, {
            stored_chatbot_id: authenticationAgent.metadata?.chatbot_id || 'undefined',
            stored_org_id: authenticationAgent.metadata?.org_id || 'undefined',
            stored_session_id: authenticationAgent.metadata?.session_id || 'undefined',
            came_from: (authenticationAgent.metadata as any)?.came_from || 'undefined',
            current_phone: authenticationAgent.metadata?.phone_number || 'undefined',
            current_name: authenticationAgent.metadata?.customer_name || 'undefined',
        });
        console.log(`Received args:`, { phone_number, otp, session_id, org_id, chatbot_id });


      if (!anonKey) {
        console.error("[verifyOTP] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");
        return { error: "Server configuration error.", ui_display_hint: 'CHAT', message: "Server configuration error." };
      }
      if (!otp || !/^\d{6}$/.test(otp)) { // Check for 6 digits
           return { 
               verified: false, // Ensure verified flag is present on failure
               error: "Invalid OTP format.", 
               ui_display_hint: 'OTP_FORM', 
               message: "Please enter the 6-digit code."
           };
      }
       // Use the phone number from metadata if not explicitly passed or different
      const effective_phone_number = authenticationAgent.metadata?.phone_number || phone_number;
      if (!effective_phone_number || !/^\+[1-9]\d{1,14}$/.test(effective_phone_number)) {
          return { 
              verified: false,
              error: "Invalid phone number for OTP verification.", 
              ui_display_hint: 'VERIFICATION_FORM', // Go back to phone form if number is bad
              message: "There's an issue with the phone number for verification. Please re-enter your phone number."
          };
      }


      // ID Validation logic from "old" code - crucial for correct backend interaction
      let final_org_id = org_id;
      if (!UUID_REGEX.test(org_id)) {
        if (authenticationAgent.metadata?.org_id && UUID_REGEX.test(authenticationAgent.metadata.org_id)) {
          final_org_id = authenticationAgent.metadata.org_id;
        } else {
          return { verified: false, error: "Invalid organization ID format", ui_display_hint: 'CHAT', message: "Internal error: Invalid organization ID." };
        }
      }
      let final_chatbot_id = chatbot_id;
      if (chatbot_id === "default" || !UUID_REGEX.test(chatbot_id) || chatbot_id === org_id) {
        if (authenticationAgent.metadata?.chatbot_id && UUID_REGEX.test(authenticationAgent.metadata.chatbot_id)) {
          final_chatbot_id = authenticationAgent.metadata.chatbot_id;
        } else {
          final_chatbot_id = "00000000-0000-0000-0000-000000000000"; // Fallback
        }
      }
      let final_session_id = session_id;
      const isValidUUID = UUID_REGEX.test(session_id) || /^[0-9a-f]{32}$/i.test(session_id);
      const isSimpleDummyId = session_id.startsWith('session_') || session_id.includes('123') || session_id.length < 16 || !session_id.match(/^[a-zA-Z0-9-_]+$/) || session_id === org_id || session_id === chatbot_id;

      if (!isValidUUID || isSimpleDummyId) {
        if (authenticationAgent.metadata?.session_id && authenticationAgent.metadata.session_id.length > 16) {
          final_session_id = authenticationAgent.metadata.session_id;
        } else {
          // If submitPhoneNumber didn't run or failed to set a good session ID, we might have an issue.
          // For verifyOTP, we *must* use the session ID that submitPhoneNumber used.
          // If it's bad here, it means submitPhoneNumber likely failed or used a bad one.
          console.error("[verifyOTP] Potentially bad session_id and no good fallback from metadata. This OTP verification might fail.");
          // We proceed with the given session_id, but this is a warning sign.
        }
      }
        // Ensure different IDs
      if (final_session_id === final_org_id || final_chatbot_id === final_org_id || final_session_id === final_chatbot_id) {
         console.error("[verifyOTP] CRITICAL ERROR: Detected duplicate IDs.");
         return { verified: false, error: "Internal ID conflict.", ui_display_hint: 'CHAT', message: "An internal error occurred. Please try again."};
      }

      console.log("[verifyOTP] FINAL VALIDATED VALUES:", { final_session_id, final_org_id, final_chatbot_id, effective_phone_number, otp });

      const requestBody = {
        session_id: final_session_id,
        phone_number: effective_phone_number,
        org_id: final_org_id,
        otp,
        platform: "WebChat",
        chat_mode: "voice", // Assuming voice
        chatbot_id: final_chatbot_id,
      };

      try {
        console.log(`[verifyOTP] Using phoneAuth URL: ${supabaseFuncUrl}`);
        console.log("[verifyOTP] Sending OTP verification request:", requestBody); // Added log
        const response = await fetch(supabaseFuncUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}` },
          body: JSON.stringify(requestBody),
        });
        const data = await response.json();
        console.log("[verifyOTP] Raw PhoneAuth VERIFY response status:", response.status, "ok:", response.ok); // Added log
        console.log("[verifyOTP] PhoneAuth response:", data);

        const isVerifiedByServer =
          (response.ok && data.success === true) ||
          (response.ok && data.verified === true) ||
          (response.ok && data.status === "success") ||
          (response.ok && data.success === "true") ||
          (response.ok && data.verified === "true") ||
          (response.ok && data.message && data.message.toLowerCase().includes("verif"));
        console.log("[verifyOTP] Server verification result (isVerifiedByServer):", isVerifiedByServer); // Added log

        if (isVerifiedByServer) {
          console.log("[verifyOTP] OTP verified successfully based on server response.");
          
          const cameFrom = (authenticationAgent.metadata as any)?.came_from;
          const metadataAny = authenticationAgent.metadata as any; // Cache for convenience

          let destinationAgentName: string;
          // Initialize transferData with common fields for successful verification
          let transferData: any = {
            is_verified: true,
            customer_name: metadataAny?.customer_name || "",
            phone_number: effective_phone_number,
            silentTransfer: true, // Default to silent for cleaner UX
            ui_display_hint: 'CHAT', // Default, realEstateAgent will control UI via its context handling
            message: null, // Default to null, realEstateAgent will provide user-facing messages
          };

          if (cameFrom === 'scheduling') {
            destinationAgentName = 'realEstate'; // Transfer to realEstate for final confirmation
            transferData.flow_context = 'from_full_scheduling'; // Key for realEstateAgent
            
            // Add all scheduling-related data needed by realEstateAgent for its confirmation message
            transferData.property_id_to_schedule = metadataAny?.property_id_to_schedule;
            transferData.property_name = metadataAny?.property_name;
            transferData.selectedDate = metadataAny?.selectedDate;
            transferData.selectedTime = metadataAny?.selectedTime;
            transferData.has_scheduled = true; // Mark as scheduled, verification was the last step
            
          } else { // Came from realEstateAgent directly for general auth or other flows
            destinationAgentName = 'realEstate';
            transferData.flow_context = 'from_direct_auth'; // Flag for realEstateAgent
            // is_verified, customer_name, phone_number are already in transferData
            // has_scheduled is not applicable or should remain as per existing metadata state (likely false/undefined)
          }
          
          console.log(`[verifyOTP] Preparing transfer to: ${destinationAgentName} with data:`, transferData);

          // IMPORTANT: Update agent's own metadata before returning transfer info
          if (authenticationAgent.metadata) {
            authenticationAgent.metadata.is_verified = true;
            if (cameFrom === 'scheduling') { // If scheduling flow, also mark as scheduled in auth agent's own state
                (authenticationAgent.metadata as any).has_scheduled = true; 
            }
            // customer_name and phone_number should have been set by submitPhoneNumber or already exist
          }

          return {
            verified: true, // This is the primary result of verifyOTP tool itself
            destination_agent: destinationAgentName,
            ...transferData // Spread all other necessary fields for the transfer
          };
        } else {
          const errorMsg = data.error || data.message || "Invalid OTP or verification failed.";
          console.error("[verifyOTP] Verification failed:", errorMsg);
          return {
            verified: false,
            error: errorMsg,
            ui_display_hint: 'OTP_FORM', // Stay on OTP form
            message: `Verification failed: ${errorMsg}`
          };
        }
      } catch (error: any) {
        console.error("[verifyOTP] Exception:", error);
        return {
          verified: false,
          error: `Exception: ${error.message}`,
          ui_display_hint: 'OTP_FORM',
          message: "An unexpected error occurred during verification."
        };
      }
    },
     // Mock tools from other agents to prevent "tool not found" if LLM miscalls
    trackUserMessage: async ({ message }: { message: string }) => {
      console.log("[Authentication] Received trackUserMessage call (ignoring):", message);
      return { success: true, message: "Authentication agent acknowledges message", ui_display_hint: 'CHAT' };
    },
    detectPropertyInMessage: async ({ message }: { message: string }) => {
      console.log("[Authentication] Received detectPropertyInMessage call (ignoring):", message);
      return { propertyDetected: false, message: "Authentication agent does not detect properties", ui_display_hint: 'CHAT' };
    },
    // Add mock implementation for completeScheduling
    completeScheduling: async () => {
      console.log("[Authentication] Received completeScheduling call (redirecting to verifyOTP)");
      return {
        error: "The authentication agent cannot complete scheduling directly. Please use verifyOTP to complete the authentication process.",
        message: "Please complete the verification process first.",
        ui_display_hint: 'VERIFICATION_FORM' // Maintain verification form
      };
    }
  }
};

// Update instructions after defining agent, especially if tool names changed
authenticationAgent.instructions = getAuthInstructions(authenticationAgent.metadata);

export default authenticationAgent; 