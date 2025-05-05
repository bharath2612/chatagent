import { AgentConfig } from "@/types/types"; // Adjusted path
// import supabaseAdmin from "@/app/lib/supabaseClient"; // Supabase client needs setup in new project

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const authentication: AgentConfig = {
  name: "authentication",
  publicDescription:
    "The initial agent that greets and authenticates the user for real estate inquiries. It collects the user's name and phone number, then verifies it through OTP.",
  instructions: `
# Authentication Instructions

CONTEXT: You might be called from the main real estate agent OR from the scheduling agent.

# FLOW 1: Called from Real Estate Agent (User needs initial verification)
- If the user needs initial verification (typically the first time they interact or after 7 questions), you must immediately ask for the user's first name.
- Say: "Before we proceed further, may I have your name, please?"
- After receiving the name, ask for the user's phone number in E.164 format (e.g., +1234567890). Explain the format if necessary.
- After receiving the phone number, call the submitPhoneNumber tool.
- Then ask the user for the OTP: "Thank you. I've sent a verification code to your phone. Please enter the code when you receive it."
- When the user provides the OTP, call the verifyOTP tool.
- If verifyOTP succeeds:
  * It will return destination_agent: "realEstate". DO NOT generate any text response yourself.
  * The system will automatically transfer the user back to the real estate agent.
- If verifyOTP fails:
  * Inform the user: "Sorry, that code is incorrect. Please try again or request a new code."

# FLOW 2: Called from Scheduling Agent (User needs verification DURING scheduling)
- If the user is being verified during scheduling (transferred via requestAuthentication tool):
  * Greet briefly: "Okay, let's get you verified to complete the booking."
  * Immediately ask for BOTH name and phone number: "Please provide your full name and phone number."
  * Wait for user to provide details.
  * Call the submitPhoneNumber tool with the provided name and phone number.
  * Ask for OTP: "Thank you. Please enter the verification code sent to your phone."
  * Wait for user to provide OTP.
  * Call the verifyOTP tool.
  * If verifyOTP succeeds:
    * It will return destination_agent: "scheduleMeeting". DO NOT generate any text response yourself.
    * The system will automatically transfer the user back to the scheduling agent.
  * If verifyOTP fails:
    * Inform the user: "Sorry, that code is incorrect. Please try again."

# GENERAL TOOL USAGE:
- submitPhoneNumber: Use after getting name (Flow 1) or name & phone (Flow 2).
- verifyOTP: Use after the user provides the OTP code.
- transferToRealEstate: This tool is now DEPRECATED. The transfer happens automatically when verifyOTP succeeds and returns destination_agent: "realEstate". DO NOT CALL THIS TOOL.
- transferToScheduleMeeting: This tool is now DEPRECATED. The transfer happens automatically when verifyOTP succeeds and returns destination_agent: "scheduleMeeting". DO NOT CALL THIS TOOL.

# LANGUAGE INSTRUCTIONS
- The conversation language is set to \${metadata?.language || "English"}. Respond ONLY in \${metadata?.language || "English"}.
`,
  tools: [
    {
      type: "function",
      name: "submitPhoneNumber",
      description: "Submit the user's phone number for OTP verification",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The user's first name.",
          },
          phone_number: {
            type: "string",
            description: "The user's phone number in E.164 format (e.g., +1234567890).",
            pattern: "^\\+\\d{10,15}$",
          },
          session_id: {
            type: "string",
            description: "The current session ID",
          },
          org_id: {
            type: "string",
            description: "The organization ID",
          },
          chatbot_id: {
            type: "string",
            description: "The chatbot ID",
          }
        },
        required: ["name", "phone_number", "session_id", "org_id", "chatbot_id"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "verifyOTP",
      description: "Verify the OTP sent to the user's phone number",
      parameters: {
        type: "object",
        properties: {
          phone_number: {
            type: "string",
            description: "The user's phone number in E.164 format",
          },
          otp: {
            type: "string",
            description: "The OTP code received by the user",
          },
          session_id: {
            type: "string",
            description: "The current session ID",
          },
          org_id: {
            type: "string",
            description: "The organization ID",
          },
          chatbot_id: {
            type: "string",
            description: "The chatbot ID",
          }
        },
        required: ["phone_number", "otp", "session_id", "org_id", "chatbot_id"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "transferToRealEstate",
      description: "Transfers the conversation back to the real estate agent after successful authentication.",
      parameters: {
        type: "object",
        properties: {
          destination_agent: {
            type: "string",
            description: "The agent to transfer to (realEstate)",
            enum: ["realEstate"] // Explicitly define destination
          },
          // is_verified, customer_name, phone_number are passed implicitly via metadata copy
        },
        required: ["destination_agent"],
        additionalProperties: false,
      },
    },
  ],
  toolLogic: {
    submitPhoneNumber: async ({
      name,
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
      // Clear, focused logging of critical metadata
      console.log("=== AUTHENTICATION AGENT METADATA (submitPhoneNumber) ===");
      console.log(`Agent metadata:`, {
        stored_chatbot_id: authentication.metadata?.chatbot_id || 'undefined',
        stored_org_id: authentication.metadata?.org_id || 'undefined',
        stored_session_id: authentication.metadata?.session_id || 'undefined',
        came_from: authentication.metadata?.came_from || 'undefined'
      });
      console.log(`Received args:`, {
        arg_chatbot_id: chatbot_id,
        arg_org_id: org_id,
        arg_session_id: session_id
      });

      // Validate phone number format
      if (!phone_number || phone_number.trim() === "") {
        console.error("[submitPhoneNumber] Phone number is empty or missing");
        return { error: "Phone number is required and cannot be empty" };
      }

      // Check that phone number starts with + and contains only digits after that
      if (!phone_number.startsWith("+") || !/^\+\d+$/.test(phone_number)) {
        console.error("[submitPhoneNumber] Invalid phone number format:", phone_number);
        return { error: "Phone number must be in E.164 format starting with + followed by country code and number" };
      }

      // Fix for org_id - prioritize metadata value if available and valid
      let final_org_id = org_id;
      if (!UUID_REGEX.test(org_id)) {
        if (authentication.metadata?.org_id && UUID_REGEX.test(authentication.metadata.org_id)) {
          final_org_id = authentication.metadata.org_id;
          console.log(`[submitPhoneNumber] Using org_id from metadata: ${final_org_id}`);
        } else {
          console.error("[submitPhoneNumber] Invalid org_id format and no valid fallback:", org_id);
          return { error: "Invalid organization ID format" };
        }
      }

      // Fix for chatbot_id issue
      let final_chatbot_id = chatbot_id;
      if (chatbot_id === "default" || !UUID_REGEX.test(chatbot_id)) {
        console.log("[submitPhoneNumber] Invalid or default chatbot_id detected:", chatbot_id);
        // Use a fallback UUID or retrieve it from auth agent metadata
        if (authentication.metadata?.chatbot_id && UUID_REGEX.test(authentication.metadata.chatbot_id)) {
          final_chatbot_id = authentication.metadata.chatbot_id;
          console.log("[submitPhoneNumber] Using chatbot_id from agent metadata:", final_chatbot_id);
        } else {
          // Use the first fallback UUID - this should be replaced with a valid UUID in production
          final_chatbot_id = "00000000-0000-0000-0000-000000000000";
          console.warn("[submitPhoneNumber] Using fallback UUID due to invalid chatbot_id");
        }
      }
      
      // Fix for session_id - prioritize metadata value if available
      let final_session_id = session_id;
      if (session_id.startsWith('session_') || !session_id.match(/^[a-zA-Z0-9]+$/)) {
        if (authentication.metadata?.session_id) {
          final_session_id = authentication.metadata.session_id;
          console.log(`[submitPhoneNumber] Using session_id from metadata: ${final_session_id}`);
        } else {
          console.warn("[submitPhoneNumber] Session ID looks like a dummy value, but no metadata fallback available");
        }
      }

      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!anonKey) {
        console.error("[submitPhoneNumber] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.");
        return { error: "Server configuration error." };
      }

      console.log("[submitPhoneNumber] Making request with: org_id:", final_org_id, "chatbot_id:", final_chatbot_id, "session_id:", final_session_id);

      const requestBody = {
        session_id: final_session_id,
        phone_number,
        org_id: final_org_id,
        name,
        platform: "WebChat", 
        chat_mode: "voice",
        chatbot_id: final_chatbot_id,
      };

      try {
        // Ensure Supabase URL is in environment variables or config
        const supabaseFuncUrl = process.env.NEXT_PUBLIC_SUPABASE_FUNC_URL || "https://dsakezvdiwmoobugchgu.supabase.co/functions/v1/phoneAuth";
        const response = await fetch(
          supabaseFuncUrl,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${anonKey}`,
            },
            body: JSON.stringify(requestBody),
          }
        );

        const data = await response.json();
        console.log("[submitPhoneNumber] PhoneAuth response:", data);
        console.log("[submitPhoneNumber] Response details - status:", response.status, "success:", data.success);
        
        // Expanded debugging to see exact response structure
        console.log("[submitPhoneNumber] Full response data:", JSON.stringify(data));

        // Update metadata after successful submission
        if (response.ok && data.success !== false) {
            if (authentication.metadata) {
                authentication.metadata.customer_name = name;
                authentication.metadata.phone_number = phone_number;
                
                // Store the successful IDs in our metadata for future calls
                authentication.metadata.chatbot_id = final_chatbot_id;
                authentication.metadata.org_id = final_org_id;
                authentication.metadata.session_id = final_session_id;
                console.log("[submitPhoneNumber] Updated metadata with valid IDs");
            }
            return { 
                success: true, 
                message: data.message || "OTP sent successfully"
            };
        } else {
            // OTP send failed
            const errorMsg = data.error || data.message || "Failed to send OTP";
            console.error("[submitPhoneNumber] Failed to send OTP:", errorMsg);
            return { 
                success: false, 
                error: errorMsg 
            };
        }

      } catch (error: any) {
        console.error("[submitPhoneNumber] Error:", error);
        return { error: `Failed to submit phone number: ${error.message}` };
      }
    },
    verifyOTP: async ({
      session_id,
      phone_number,
      otp,
      org_id,
      chatbot_id,
    }: {
      session_id: string;
      phone_number: string;
      otp: string;
      org_id: string;
      chatbot_id: string;
    }) => {
      // Clear, focused logging of critical metadata
      console.log("=== AUTHENTICATION AGENT METADATA (verifyOTP) ===");
      console.log(`Agent metadata:`, {
        stored_chatbot_id: authentication.metadata?.chatbot_id || 'undefined',
        stored_org_id: authentication.metadata?.org_id || 'undefined',
        stored_session_id: authentication.metadata?.session_id || 'undefined',
        came_from: authentication.metadata?.came_from || 'undefined'
      });
      console.log(`Received args:`, {
        arg_chatbot_id: chatbot_id,
        arg_org_id: org_id,
        arg_session_id: session_id
      });

      // Validate phone number format
      if (!phone_number || phone_number.trim() === "") {
        console.error("[verifyOTP] Phone number is empty or missing");
        return { error: "Phone number is required and cannot be empty" };
      }

      // Check that phone number starts with + and contains only digits after that
      if (!phone_number.startsWith("+") || !/^\+\d+$/.test(phone_number)) {
        console.error("[verifyOTP] Invalid phone number format:", phone_number);
        return { error: "Phone number must be in E.164 format starting with + followed by country code and number" };
      }

      // Fix for org_id - prioritize metadata value if available and valid
      let final_org_id = org_id;
      if (!UUID_REGEX.test(org_id)) {
        if (authentication.metadata?.org_id && UUID_REGEX.test(authentication.metadata.org_id)) {
          final_org_id = authentication.metadata.org_id;
          console.log(`[verifyOTP] Using org_id from metadata: ${final_org_id}`);
        } else {
          console.error("[verifyOTP] Invalid org_id format and no valid fallback:", org_id);
          return { error: "Invalid organization ID format" };
        }
      }

      // Fix for chatbot_id issue
      let final_chatbot_id = chatbot_id;
      if (chatbot_id === "default" || !UUID_REGEX.test(chatbot_id)) {
        console.log("[verifyOTP] Invalid or default chatbot_id detected:", chatbot_id);
        // Use a fallback UUID or retrieve it from auth agent metadata
        if (authentication.metadata?.chatbot_id && UUID_REGEX.test(authentication.metadata.chatbot_id)) {
          final_chatbot_id = authentication.metadata.chatbot_id;
          console.log("[verifyOTP] Using chatbot_id from agent metadata:", final_chatbot_id);
        } else {
          // Use the first fallback UUID - this should be replaced with a valid UUID in production
          final_chatbot_id = "00000000-0000-0000-0000-000000000000";
          console.warn("[verifyOTP] Using fallback UUID due to invalid chatbot_id");
        }
      }
      
      // Fix for session_id - prioritize metadata value if available
      let final_session_id = session_id;
      if (session_id.startsWith('session_') || !session_id.match(/^[a-zA-Z0-9]+$/)) {
        if (authentication.metadata?.session_id) {
          final_session_id = authentication.metadata.session_id;
          console.log(`[verifyOTP] Using session_id from metadata: ${final_session_id}`);
        } else {
          console.warn("[verifyOTP] Session ID looks like a dummy value, but no metadata fallback available");
        }
      }

       const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
       if (!anonKey) {
         console.error("[verifyOTP] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.");
         return { error: "Server configuration error." };
       }

      console.log("[verifyOTP] Making request with: org_id:", final_org_id, "chatbot_id:", final_chatbot_id, "session_id:", final_session_id);

      const requestBody = {
        session_id: final_session_id,
        phone_number,
        org_id: final_org_id,
        otp,
        platform: "WebChat",
        chat_mode: "voice",
        chatbot_id: final_chatbot_id,
      };

      try {
         // Ensure Supabase URL is in environment variables or config
         const supabaseFuncUrl = process.env.NEXT_PUBLIC_SUPABASE_FUNC_URL || "https://dsakezvdiwmoobugchgu.supabase.co/functions/v1/phoneAuth";
         const response = await fetch(
           supabaseFuncUrl,
           {
             method: "POST",
             headers: {
               "Content-Type": "application/json",
               "Authorization": `Bearer ${anonKey}`,
             },
             body: JSON.stringify(requestBody),
           }
         );

        const data = await response.json();
        console.log("[verifyOTP] PhoneAuth response:", data);
        console.log("[verifyOTP] Response details - status:", response.status, "success:", data.success, "verified:", data.verified);
        
        // Expanded debugging to see exact response structure
        console.log("[verifyOTP] Full response data:", JSON.stringify(data));

        // If OTP verification is successful (server indicates success/verified)
        // Fix: The edge function may use different properties to indicate success
        // Check for multiple possible success indicators
        const isVerified = 
          (response.ok && data.success === true) || 
          (response.ok && data.verified === true) ||
          (response.ok && data.status === "success") ||
          (response.ok && data.success === "true") || // String "true" check
          (response.ok && data.verified === "true") || // String "true" check
          (response.ok && data.message && data.message.toLowerCase().includes("verif")); // Message about verification
          
        if (isVerified) {
          console.log("[verifyOTP] OTP verified successfully based on response.");
          
          // Determine which agent to transfer back to based on metadata (if available)
          // Default to realEstate if no specific context
          const cameFromScheduling = (authentication.metadata as any)?.came_from === 'scheduling';
          const destination = cameFromScheduling ? "scheduleMeeting" : "realEstate";
          console.log(`[verifyOTP] Preparing transfer back to: ${destination}`);

          // Update metadata for the destination agent
          const updatedMetadata = {
            is_verified: true,
            customer_name: data.customer_name || authentication.metadata?.customer_name || "", // Use name from response or previous metadata
            phone_number: phone_number, // Pass the verified phone number
            org_id: final_org_id, // Preserve the working org_id
            chatbot_id: final_chatbot_id, // Preserve the working chatbot_id
            session_id: final_session_id // Preserve the working session_id
          };

          return {
              destination_agent: destination, // Signal to transfer
              ...updatedMetadata, // Pass updated metadata fields
              message: "OTP verified successfully." // Internal message
          };
        } else {
            // OTP verification failed
            const errorMsg = data.error || data.message || "Invalid OTP or verification failed.";
            console.error("[verifyOTP] Verification failed:", errorMsg);
            return { error: errorMsg };
        }

      } catch (error: any) {
        console.error("[verifyOTP] Error:", error);
        return { error: `Failed to verify OTP: ${error.message}` };
      }
    },
    // Add mock implementation for trackUserMessage (used by realEstate agent)
    // This prevents the "Tool logic not found" error if LLM tries to call it
    trackUserMessage: async ({ message }: { message: string }) => {
      console.log("[Authentication] Received trackUserMessage call (ignoring):", message);
      // Return success without side effects - this is a no-op in authentication agent
      return { success: true, message: "Authentication agent acknowledges message" };
    },
    
    // Add mock implementation for detectPropertyInMessage (used by realEstate agent)
    detectPropertyInMessage: async ({ message }: { message: string }) => {
      console.log("[Authentication] Received detectPropertyInMessage call (ignoring):", message);
      // Return "no property detected" to avoid confusing the LLM
      return { propertyDetected: false, message: "Authentication agent does not detect properties" };
    },
  },
};

export default authentication; 