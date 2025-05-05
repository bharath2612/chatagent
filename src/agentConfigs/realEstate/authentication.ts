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
      console.log("[submitPhoneNumber] Starting phone submission with org_id:", org_id, "chatbot_id:", chatbot_id);

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

      if (!UUID_REGEX.test(org_id)) {
        console.error("[submitPhoneNumber] Invalid org_id format:", org_id);
        return { error: "Invalid organization ID format" };
      }

      // Use the chatbot_id directly from metadata if it's a UUID
      const final_chatbot_id = chatbot_id;
      if (!UUID_REGEX.test(chatbot_id)) {
        console.error("[submitPhoneNumber] Invalid chatbot_id format:", chatbot_id);
        return { error: "Invalid chatbot ID format" };
      }

      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!anonKey) {
        console.error("[submitPhoneNumber] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.");
        return { error: "Server configuration error." };
      }

      console.log("[submitPhoneNumber] Making request to phoneAuth with org_id:", org_id, "chatbot_id:", final_chatbot_id);
      console.log("[submitPhoneNumber] Phone number being sent:", phone_number);

      const requestBody = {
        session_id,
        phone_number,
        org_id,
        name,
        platform: "WebChat", // Updated platform
        chat_mode: "voice",
        chatbot_id: final_chatbot_id,
      };

      console.log("request body", JSON.stringify(requestBody));
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

        // Update metadata after successful submission
        if (response.ok && data.success !== false) {
            if (authentication.metadata) {
                authentication.metadata.customer_name = name;
                authentication.metadata.phone_number = phone_number;
            }
        }

        return { success: response.ok && data.success !== false, message: data.message || (response.ok ? "OTP Sent" : "Failed to send OTP") };

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
      console.log("[verifyOTP] Starting OTP verification with org_id:", org_id);

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

      if (!UUID_REGEX.test(org_id)) {
        console.error("[verifyOTP] Invalid org_id format:", org_id);
        return { error: "Invalid organization ID format" };
      }

      if (!UUID_REGEX.test(chatbot_id)) {
        console.error("[verifyOTP] Invalid chatbot_id format:", chatbot_id);
        return { error: "Invalid chatbot ID format" };
      }

       const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
       if (!anonKey) {
         console.error("[verifyOTP] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.");
         return { error: "Server configuration error." };
       }

      console.log("[verifyOTP] Making request to phoneAuth with org_id:", org_id);
      console.log("[verifyOTP] Phone number being verified:", phone_number);

      const requestBody = {
        session_id,
        phone_number,
        org_id,
        otp,
        platform: "WebChat", // Updated platform
        chat_mode: "voice",
        chatbot_id,
      };

      console.log("Request body for otp verification", JSON.stringify(requestBody));
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

        // If OTP verification is successful (server indicates success/verified)
        if (response.ok && (data.success || data.verified)) {
          console.log("[verifyOTP] OTP verified successfully.");
          
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
          };

          return {
              destination_agent: destination, // Signal to transfer
              ...updatedMetadata, // Pass updated metadata fields
              message: "OTP verified successfully." // Internal message
          };
        } else {
            // OTP verification failed
            return { error: data.error || "Invalid OTP or verification failed." };
        }

      } catch (error: any) {
        console.error("[verifyOTP] Error:", error);
        return { error: `Failed to verify OTP: ${error.message}` };
      }
    },
    // Remove transferToRealEstate and transferToScheduleMeeting tool logic - transfers are handled by verifyOTP
    // transferToRealEstate: async () => { ... },
    // transferToScheduleMeeting: async () => { ... }
  },
};

export default authentication; 