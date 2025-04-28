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
- You must immediately ask for the user's first name when the conversation is transferred to you. Do NOT wait for the user to say anything first.
- Begin by saying: " Before we Proceed further May I have your name, please?"
- After receiving the name, ask for the user's phone number in E.164 format (e.g., +1234567890).
  - IMPORTANT: The phone number MUST start with a plus sign and country code (e.g., +1, +91)
  - Valid examples: "+12345678901", "+911234567890", "+447123456789"
  - Make sure to extract the EXACT phone number from the user's message, preserving the plus sign
  - If a user responds with something like "My number is +1234567890", you MUST extract ONLY "+1234567890"

- After receiving the phone number, you MUST:
  1. Double-check that the phone number starts with "+" and contains only digits after that
  2. Extract ONLY the phone number pattern (e.g., "+12345678901") from the user's message
  3. Submit EXACTLY this extracted phone number using the submitPhoneNumber tool
  4. DO NOT modify the phone number format in any way

- Ask the user to provide the OTP they received.
- Use the verifyOTP tool with the SAME phone number you saved earlier.
- After successful authentication, automatically transfer the conversation back to the real estate agent.

# LANGUAGE INSTRUCTIONS
- The conversation language is set to \${metadata?.language || "English"}. Respond in \${metadata?.language || "English"}.
- If the user changes the language, update your responses accordingly.
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

      const serviceRoleKey = process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        console.error("[submitPhoneNumber] Missing NEXT_PUBLIC_SERVICE_ROLE_KEY environment variable.");
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
              "Authorization": `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify(requestBody),
          }
        );

        const data = await response.json();
        console.log("[submitPhoneNumber] PhoneAuth response:", data);
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

       const serviceRoleKey = process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY;
       if (!serviceRoleKey) {
         console.error("[verifyOTP] Missing NEXT_PUBLIC_SERVICE_ROLE_KEY environment variable.");
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
               "Authorization": `Bearer ${serviceRoleKey}`,
             },
             body: JSON.stringify(requestBody),
           }
         );

        const data = await response.json();
        console.log("[verifyOTP] PhoneAuth response:", data);

        // If OTP verification is successful (server indicates success/verified)
        if (response.ok && (data.success || data.verified)) {
          console.log("[verifyOTP] OTP verified successfully, preparing transfer to realEstate agent");

          // Return structure indicating agent transfer is needed
          // The handleFunctionCall in useHandleServerEvent will catch destination_agent
          // and copy metadata before calling setSelectedAgentName.
          return {
              destination_agent: "realEstate", // Signal to transfer
              // Pass verification details to be included in the new agent's metadata
              is_verified: true,
              customer_name: data.customer_name || "", // Get name from response if available
              phone_number: phone_number, // Pass the verified phone number
              message: "OTP verified successfully."
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
    // transferToRealEstate logic is now handled by the presence of `destination_agent`
    // in the return value of verifyOTP and the `useHandleServerEvent` hook.
    // The tool definition remains so the LLM knows it *can* transfer.
    transferToRealEstate: async () => {
         console.log("[authentication.transferToRealEstate] Tool called - this should be handled by destination_agent return value.");
         // This function primarily exists for the LLM's tool schema.
         // The actual transfer happens when verifyOTP returns destination_agent.
         return { success: true, message: "Transfer initiated." };
     }
  },
};

export default authentication; 