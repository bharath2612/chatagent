"use client";

import { ServerEvent, SessionStatus, AgentConfig, TranscriptItem } from "@/types/types"; // Adjusted import path, added TranscriptItem
import { useRef, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

// Helper function to create safe IDs (must be 32 chars or less)
const generateSafeId = () => {
    // Remove hyphens and truncate to 32 chars
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
};

// Add delay utility function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Define types for transcript management functions
type AddTranscriptMessageType = (itemId: string, role: "user" | "assistant" | "system", text: string, properties?: any[]) => void;
type UpdateTranscriptMessageType = (itemId: string, textDelta: string, isDelta: boolean) => void;
type UpdateTranscriptItemStatusType = (itemId: string, status: "IN_PROGRESS" | "DONE" | "ERROR") => void;

// Add type for gallery state setter
type SetGalleryStateType = (state: { isOpen: boolean; propertyName: string; images: any[] }) => void;

// Define PropertyProps and PropertyImage if not already (simplified example)
interface PropertyProps { id?: string; name?: string; [key: string]: any; }
interface PropertyImage { url?: string; alt?: string; description?: string; }

// Redefine ActiveDisplayMode if not imported or defined globally
type ActiveDisplayMode = 
  | 'CHAT' 
  | 'PROPERTY_LIST' 
  | 'PROPERTY_DETAILS' 
  | 'IMAGE_GALLERY' 
  | 'SCHEDULING_FORM'
  | 'VERIFICATION_FORM'
  | 'OTP_FORM';

interface PropertyGalleryData {
  propertyName: string;
  images: PropertyImage[];
}

export interface UseHandleServerEventParams {
  // Required state setters and config
  setSessionStatus: (status: SessionStatus) => void;
  selectedAgentName: string;
  selectedAgentConfigSet: AgentConfig[] | null;
  sendClientEvent: (eventObj: any, eventNameSuffix?: string) => void;
  setSelectedAgentName: (name: string) => void;

  // Transcript state and functions passed from component
  transcriptItems: TranscriptItem[];
  addTranscriptMessage: AddTranscriptMessageType;
  updateTranscriptMessage: UpdateTranscriptMessageType;
  updateTranscriptItemStatus: UpdateTranscriptItemStatusType;

  // Optional configuration
  shouldForceResponse?: boolean;

  // --- New setters for UI control ---
  setActiveDisplayMode: (mode: ActiveDisplayMode) => void;
  setPropertyListData: (data: PropertyProps[] | null) => void;
  setSelectedPropertyDetails: (data: PropertyProps | null) => void;
  setPropertyGalleryData: (data: PropertyGalleryData | null) => void;
}

export function useHandleServerEvent({
  setSessionStatus,
  selectedAgentName,
  selectedAgentConfigSet,
  sendClientEvent,
  setSelectedAgentName,
  // Destructure transcript functions from params
  transcriptItems,
  addTranscriptMessage,
  updateTranscriptMessage,
  updateTranscriptItemStatus,
  shouldForceResponse,
  // Destructure new setters
  setActiveDisplayMode,
  setPropertyListData,
  setSelectedPropertyDetails,
  setPropertyGalleryData,
}: UseHandleServerEventParams) {
  // Removed context hook calls
  // const { logServerEvent } = useEvent(); // Placeholder call - Logging can be added back if needed

  // Add state to track active responses
  const hasActiveResponseRef = useRef(false);
  
  // Track the ID of the simulated message to filter it out
  const simulatedMessageIdRef = useRef<string | null>(null);
  
  // Add a new ref to track if we're currently transferring agents
  const isTransferringAgentRef = useRef(false);

  const handleFunctionCall = async (functionCallParams: {
    name: string;
    call_id?: string;
    arguments: string;
  }) => {
    try {
      console.log(
        `[handleFunctionCall] Raw arguments for ${functionCallParams.name}:`,
        functionCallParams.arguments
      );

      const args = JSON.parse(functionCallParams.arguments);
      console.log(
        `[handleFunctionCall] Parsed arguments for ${functionCallParams.name}:`,
        args
      );

      if (functionCallParams.name === "submitPhoneNumber") {
        console.log(
          `[handleFunctionCall] Phone number in submitPhoneNumber:`,
          args.phone_number
        );
        if (args.phone_number && !args.phone_number.startsWith("+")) {
          if (
            typeof args.phone_number === "string" &&
            args.phone_number.trim()
          ) {
            args.phone_number =
              "+" + args.phone_number.trim().replace(/^\+/, "");
            console.log(
              `[handleFunctionCall] Fixed phone number:`,
              args.phone_number
            );
          }
        }
      }

      const currentAgent = selectedAgentConfigSet?.find(
        (a) => a.name === selectedAgentName
      );

      if (!currentAgent) {
        console.error(`[handleFunctionCall] Agent configuration not found for name: ${selectedAgentName}`);
        const errorResult = { error: `Agent ${selectedAgentName} configuration not found.` };
        sendClientEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: functionCallParams.call_id,
            output: JSON.stringify(errorResult),
          },
        });
        sendClientEvent({ type: "response.create" });
        return; // Stop processing if agent config is missing
      }

      if (currentAgent.metadata) {
        const phoneNumberFromArgs = args.phone_number;
        const metadata = { ...currentAgent.metadata }; // Copy metadata

        // Apply metadata to args, preserving args values if they exist
        for (const key in metadata) {
             if (!(key in args) || args[key] === undefined || args[key] === null || args[key] === '') {
                args[key] = metadata[key as keyof typeof metadata];
             }
        }

        // Restore phone number from args if it was provided and different from metadata
        if (phoneNumberFromArgs && phoneNumberFromArgs.trim() !== "" && phoneNumberFromArgs !== metadata.phone_number) {
          args.phone_number = phoneNumberFromArgs;
          // Update the agent's metadata in memory
          currentAgent.metadata.phone_number = phoneNumberFromArgs;
          console.log(
            `[handleFunctionCall] Restored/Updated phone_number from args: ${phoneNumberFromArgs}`
          );
        }

        console.log(
          `[handleFunctionCall] Merged args with metadata:`,
          args
        );
      }


      // Check if the tool logic actually exists on the current agent
      const toolFunction = currentAgent?.toolLogic?.[functionCallParams.name];

      if (typeof toolFunction === 'function') {
        // Tool logic exists, proceed to call it
        console.log(`[handleFunctionCall] Executing tool logic for "${functionCallParams.name}" on agent "${selectedAgentName}"`);
        const fnResult = await toolFunction(args, transcriptItems || []);
        console.log(`[handleFunctionCall] Tool "${functionCallParams.name}" result:`, fnResult);

        // --- Centralized UI Update Logic based on fnResult ---
        if (fnResult && fnResult.ui_display_hint) {
          console.log(`[handleFunctionCall] Received UI display hint: ${fnResult.ui_display_hint}`);
          setActiveDisplayMode(fnResult.ui_display_hint as ActiveDisplayMode); // Cast to ensure type safety

          // Clear all view-specific data first for a clean slate unless specified otherwise
          setPropertyListData(null);
          setSelectedPropertyDetails(null);
          setPropertyGalleryData(null);
          // Other view-specific data setters can be called here with null

          // Populate data for the target mode
          if (fnResult.ui_display_hint === 'PROPERTY_LIST' && fnResult.properties) {
            setPropertyListData(fnResult.properties);
          } else if (fnResult.ui_display_hint === 'PROPERTY_DETAILS' && fnResult.property_details) {
            setSelectedPropertyDetails(fnResult.property_details);
          } else if (fnResult.ui_display_hint === 'IMAGE_GALLERY' && fnResult.images_data) {
            setPropertyGalleryData(fnResult.images_data);
          } else if (fnResult.ui_display_hint === 'SCHEDULING_FORM') {
            // Logic for scheduling form, e.g., if fnResult.scheduling_data exists
            // This might involve setting state for availableSlots, selectedProperty in chat.tsx
            // For now, just logging. The actual state update for slots happens in chat.tsx's handleServerEvent
            console.log("[handleFunctionCall] SCHEDULING_FORM hint. Data:", fnResult.scheduling_data);
          } else if (fnResult.ui_display_hint === 'VERIFICATION_FORM') {
            console.log("[handleFunctionCall] VERIFICATION_FORM hint.");
          } else if (fnResult.ui_display_hint === 'OTP_FORM') {
            console.log("[handleFunctionCall] OTP_FORM hint.");
          }
          // If the mode is CHAT, data was already cleared.
        } else if (fnResult && !fnResult.destination_agent) {
          // If no specific UI hint, but not a transfer, default to CHAT to ensure messages are visible.
          // Avoids getting stuck on a previous UI if a tool runs silently or only returns a message.
          console.log("[handleFunctionCall] No UI hint from tool, defaulting to CHAT display mode.");
          setActiveDisplayMode('CHAT');
          setPropertyListData(null);
          setSelectedPropertyDetails(null);
          setPropertyGalleryData(null);
        }
        // --- End of Centralized UI Update Logic ---

        if (fnResult && fnResult.destination_agent) {
          // ... (agent transfer logic - ensure it correctly resets or sets UI for the new agent context) ...
          // The new agent, upon activation, might send an initial message/tool call that sets its own UI mode.
          // For example, scheduleMeetingAgent immediately calls getAvailableSlots.
          // Consider if setActiveDisplayMode('CHAT') is needed here before transfer, or if new agent handles it.
          isTransferringAgentRef.current = true;
          
          const isSilent = fnResult.silentTransfer === true;

          console.log(
            `[handleFunctionCall] ${isSilent ? 'Silently transferring' : 'Transferring'} to agent: ${fnResult.destination_agent}`
          );
          const newAgentConfig = selectedAgentConfigSet?.find(
            (a) => a.name === fnResult.destination_agent
          );

          if (newAgentConfig) {
            if (currentAgent.metadata) {
               // Create a clean copy for the new agent, merge specific fields passed back
              newAgentConfig.metadata = { ...(currentAgent.metadata || {}) }; // Ensure metadata object exists
              if (fnResult.is_verified !== undefined) newAgentConfig.metadata.is_verified = fnResult.is_verified;
              if (fnResult.customer_name) newAgentConfig.metadata.customer_name = fnResult.customer_name;
              if (fnResult.phone_number) newAgentConfig.metadata.phone_number = fnResult.phone_number;
              if (fnResult.has_scheduled !== undefined) newAgentConfig.metadata.has_scheduled = fnResult.has_scheduled;
              // Safely add property_to_schedule if metadata allows extra properties
              if (fnResult.property_id_to_schedule && typeof newAgentConfig.metadata === 'object') {
                 (newAgentConfig.metadata as any).property_id_to_schedule = fnResult.property_id_to_schedule;
              }
              
              // IMPORTANT: Ensure chatbot_id is properly preserved during transfers
              if (currentAgent.metadata.chatbot_id) {
                newAgentConfig.metadata.chatbot_id = currentAgent.metadata.chatbot_id;
                console.log(`[handleFunctionCall] Preserved chatbot_id during transfer: ${newAgentConfig.metadata.chatbot_id}`);
              }
              
              // IMPORTANT: Ensure org_id is properly preserved during transfers
              if (currentAgent.metadata.org_id) {
                newAgentConfig.metadata.org_id = currentAgent.metadata.org_id;
                console.log(`[handleFunctionCall] Preserved org_id during transfer: ${newAgentConfig.metadata.org_id}`);
              }
              
              // IMPORTANT: Ensure session_id is properly preserved during transfers
              if (currentAgent.metadata.session_id) {
                newAgentConfig.metadata.session_id = currentAgent.metadata.session_id;
                console.log(`[handleFunctionCall] Preserved session_id during transfer: ${newAgentConfig.metadata.session_id}`);
              }
              
              // Add metadata to indicate where the agent came from (for return path)
              if (currentAgent.name) {
                newAgentConfig.metadata.came_from = currentAgent.name;
                console.log(`[handleFunctionCall] Set came_from=${currentAgent.name} in metadata`);
              }

              // Log the critical metadata fields for debugging
              console.log("[handleFunctionCall] Transfer metadata summary:", {
                destination: fnResult.destination_agent,
                chatbot_id: newAgentConfig.metadata.chatbot_id,
                org_id: newAgentConfig.metadata.org_id,
                session_id: newAgentConfig.metadata.session_id,
                is_verified: newAgentConfig.metadata.is_verified
              });
            }
            
            // First cancel any active response to avoid the "conversation_already_has_active_response" error
            if (hasActiveResponseRef.current) {
              console.log("[handleFunctionCall] Cancelling active response before transfer");
              sendClientEvent({ type: "response.cancel" }, "(cancelling before transfer)");
              // Short delay to ensure the cancellation is processed
              await delay(100);
              hasActiveResponseRef.current = false;
            }
            
            // Update the agent state in the parent component
            setSelectedAgentName(fnResult.destination_agent);

            // ALL transfers should be silent by default
            let silentTransfer = isSilent || true; // Force silent transfers - ALL agent transfers should be silent
            // Check if this is the scheduling agent (should be silent)
            if (newAgentConfig && newAgentConfig.name === "scheduleMeeting") {
              console.log("[handleFunctionCall] Always performing silent transfer to scheduling agent");
              silentTransfer = true; // Always silent transfer for scheduleMeeting
            }
            
            // Authentication agent transfers should also be silent
            if (newAgentConfig && newAgentConfig.name === "authentication") {
              console.log("[handleFunctionCall] Always performing silent transfer to authentication agent");
              silentTransfer = true; // Always silent transfer for authentication
            }

            // Use silentTransfer variable for the condition
            if (silentTransfer) {
              console.log("[handleFunctionCall] Silent transfer - skipping function_call_output event.");
              
              // ADD BACK: Automatic response trigger specifically for scheduleMeeting agent
              if (newAgentConfig && newAgentConfig.name === "scheduleMeeting") {
                console.log("[handleFunctionCall] Scheduling agent transfer - triggering automatic welcome/slot fetch");
                // Allow a small delay for the transfer to complete before triggering the response
                setTimeout(() => {
                  // Before creating a new response, make sure there's no active one
                  if (hasActiveResponseRef.current) {
                    console.log("[handleFunctionCall] Cancelling active response before triggering new one");
                    sendClientEvent({ type: "response.cancel" }, "(cancelling before new response)");
                    // Short delay to ensure the cancellation is processed
                    setTimeout(() => {
                      sendClientEvent({ type: "response.create" }, "(auto-trigger response after scheduling transfer)");
                    }, 100);
                  } else {
                    sendClientEvent({ type: "response.create" }, "(auto-trigger response after scheduling transfer)");
                  }
                }, 200); // Increased delay
              }
              
              // Also trigger automatic response for authentication agent transfers
              if (newAgentConfig && newAgentConfig.name === "authentication") {
                console.log("[handleFunctionCall] Authentication agent transfer - triggering automatic response");
                setTimeout(() => {
                  // Before creating a new response, make sure there's no active one
                  if (hasActiveResponseRef.current) {
                    console.log("[handleFunctionCall] Cancelling active response before triggering new one");
                    sendClientEvent({ type: "response.cancel" }, "(cancelling before new response)");
                    // Short delay to ensure the cancellation is processed
                    setTimeout(() => {
                      sendClientEvent({ type: "response.create" }, "(auto-trigger response after authentication transfer)");
                    }, 100);
                  } else {
                    sendClientEvent({ type: "response.create" }, "(auto-trigger response after authentication transfer)");
                  }
                }, 200);
              }
            } else {
              // Only send non-silent transfers (should be rare or never used now)
              sendClientEvent({
                type: "conversation.item.create",
                item: {
                  id: generateSafeId(),
                  type: "function_call_output",
                  call_id: functionCallParams.call_id,
                  output: JSON.stringify({
                    status: newAgentConfig ? "Transfer successful" : "Transfer failed: Agent not found",
                    transferred_to: fnResult.destination_agent,
                    ...(newAgentConfig ? {} : {error: `Agent ${fnResult.destination_agent} not found`})
                  }),
                },
              });
            }

            // Set a timeout to reset the transferring flag
            // setTimeout(() => {
            //   isTransferringAgentRef.current = false;
            //   console.log("[handleFunctionCall] Reset transferring flag after timeout");
            // }, 500); // REMOVED TIMEOUT
            
            return; // Stop further processing in this handler
          } else {
              console.error(`[handleFunctionCall] Destination agent "${fnResult.destination_agent}" not found.`);
              // Inform the LLM about the failure
               sendClientEvent({
                   type: "conversation.item.create",
                   item: {
                       type: "function_call_output",
                       call_id: functionCallParams.call_id,
                       output: JSON.stringify({ error: `Agent ${fnResult.destination_agent} not found.` }),
                   },
               });
               sendClientEvent({ type: "response.create" }); // Let the current agent respond to the failure
               // Reset transferring flag
               isTransferringAgentRef.current = false;
               return;
          }
          // No return here if newAgentConfig was not found initially
        } // End of agent transfer logic


        // Handle silent tool calls (non-transfer)
        if (fnResult && fnResult.silent === true) {
          console.log(
            `[handleFunctionCall] Silent mode for ${functionCallParams.name}, not sending output to LLM.`
          );
          // Optional: Decide if a response.create is still needed even for silent tools
          // sendClientEvent({ type: "response.create" });
          return;
        }

        // Specific handling for getAvailableSlots (might be redundant now but keep for safety)
        if (functionCallParams.name === "getAvailableSlots") {
          // No need to call fn again, we already have fnResult
          console.log("[handleFunctionCall] getAvailableSlots result:", fnResult);
          
          // Store the property_id in the agent's metadata for later use
          if (fnResult.property_id && currentAgent.metadata) {
            console.log(`[handleFunctionCall] Storing property_id from getAvailableSlots: ${fnResult.property_id}`);
            (currentAgent.metadata as any).lastReturnedPropertyId = fnResult.property_id;
          }
          
          // Send function output
          sendClientEvent({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: functionCallParams.call_id,
              output: JSON.stringify(fnResult),
            },
          });
          sendClientEvent({ type: "response.create" });
          return; // Skip the regular function handling below
        }

        // Send regular function output for other non-silent, non-transferring tools
        sendClientEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: functionCallParams.call_id,
            output: JSON.stringify(fnResult),
          },
        });
        sendClientEvent({ type: "response.create" });

      } else {
        // Handle case where tool logic is NOT found for the current agent
        console.error(`[handleFunctionCall] Tool logic for function "${functionCallParams.name}" not found on agent "${selectedAgentName}".`);
        const errorResult = { error: `Agent ${selectedAgentName} cannot perform action ${functionCallParams.name}.` };
        sendClientEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: functionCallParams.call_id,
            output: JSON.stringify(errorResult),
          },
        });
        // Trigger a response so the agent can explain the error
         sendClientEvent({ type: "response.create" }); 
      }
    } catch (error: any) {
      console.error(
        `[handleFunctionCall] Error parsing arguments or executing ${functionCallParams.name}:`,
        error
      );
      const errorResult = { error: `Failed to process function call ${functionCallParams.name}: ${error.message}` };

      sendClientEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: functionCallParams.call_id,
          output: JSON.stringify(errorResult),
        },
      });
      // Decide if we should trigger a response even if the tool failed
       sendClientEvent({ type: "response.create" });
    }
  };


  const handleServerEvent = (serverEvent: ServerEvent) => {
     console.log("[Server Event]", serverEvent.type, serverEvent); // Basic logging

    switch (serverEvent.type) {
      case "session.created": {
        if (serverEvent.session?.id) {
          setSessionStatus("CONNECTED");
          // Match old code by adding a system message with connection info
          addTranscriptMessage(generateSafeId(), 'system', 'Connection established.');
        }
        break;
      }

      case "session.updated": {
        // Session was updated successfully, no action needed
        console.log(`[Server Event] Session updated successfully`);
        break;
      }

      case "input_audio_buffer.cleared": {
        // Audio buffer cleared, no action needed
        console.log(`[Server Event] Input audio buffer cleared`);
        break;
      }

      case "response.function_call_arguments.delta":
      case "response.function_call_arguments.done": {
        // Function call arguments streaming events, can be ignored for now
        // These are used for streaming updates during function call argument formation
        console.log(`[Server Event] Function call arguments ${serverEvent.type === 'response.function_call_arguments.done' ? 'completed' : 'updated'}`);
        break;
      }

      case "output_audio_buffer.stopped": {
        // Audio playback stopped
        console.log(`[Server Event] Audio playback stopped`);
        break;
      }

      case "conversation.item.created": {
        const itemId = serverEvent.item?.id;
        const role = serverEvent.item?.role as "user" | "assistant" | "system";
        let text = serverEvent.item?.content?.[0]?.text ?? serverEvent.item?.content?.[0]?.transcript ?? "";
        const itemType = serverEvent.item?.type;

        if (!itemId || !role) break;
        if (transcriptItems?.some((item) => item.itemId === itemId && item.status !== 'IN_PROGRESS')) {
             console.log(`[Transcript] Skipping duplicate non-IN_PROGRESS item creation: ${itemId}`);
             break;
        }
        if (role === "user" && text === "hi" && serverEvent.item?.content?.[0]?.type === "input_text") {
          simulatedMessageIdRef.current = itemId;
          break;
        }

        // If this is a function_call_output, its primary data (for UI state) should have been processed
        // by handleFunctionCall via fnResult.ui_display_hint.
        // Here, we mainly focus on adding the *message* part of the output to the transcript.
        if (itemType === "function_call_output") {
          const functionName = (serverEvent.item as any).name;
          const outputString = (serverEvent.item as any).output;
          console.log(`[Server Event Hook] function_call_output for ${functionName}:`, outputString);
          if (outputString) {
            try {
              const outputData = JSON.parse(outputString);
              // Add message to transcript if present in the outputData from the tool.
              // The actual UI display (gallery, list, details) is driven by setActiveDisplayMode from handleFunctionCall.
              if (outputData.message) {
                if (!transcriptItems?.some(item => item.itemId === itemId)) {
                    addTranscriptMessage(itemId, "assistant", outputData.message, outputData.properties || outputData.images || []);
                } else {
                    updateTranscriptMessage(itemId, outputData.message, false);
                }
              } else if (outputData.error) {
                 if (!transcriptItems?.some(item => item.itemId === itemId)) {
                    addTranscriptMessage(itemId, "assistant", `Error: ${outputData.error}`);
                 } else {
                    updateTranscriptMessage(itemId, `Error: ${outputData.error}`, false);
                 }
              } else if (functionName === 'getAvailableSlots' && outputData.slots) {
                 // For getAvailableSlots, the UI update (showing slots) is triggered by setActiveDisplayMode('SCHEDULING_FORM').
                 // The agent should also provide a textual message.
                 const defaultSlotsMessage = "Please select a date and time for your visit.";
                 if (!transcriptItems?.some(item => item.itemId === itemId)) {
                    addTranscriptMessage(itemId, "assistant", outputData.text_message || defaultSlotsMessage); 
                 } else {
                    updateTranscriptMessage(itemId, outputData.text_message || defaultSlotsMessage, false);
                 }
                 // Actual slot data (outputData.slots) is handled via chat.tsx state if needed by TimePick directly,
                 // or passed via property in fnResult.scheduling_data if that pattern is used.
              }
              // Do not return here for all function_call_outputs, let general message handling proceed if no specific message was added.
            } catch (error) {
              console.error(`[Transcript] Error parsing ${functionName} output in item.created:`, error);
              // Add a generic error to transcript if parsing fails
              if (!transcriptItems?.some(item => item.itemId === itemId)) {
                addTranscriptMessage(itemId, "assistant", "An error occurred processing the tool's response.");
              }
            }
          }
          // After processing the message part, if it was a function_call_output, often we don't want to fall through to general text processing
          // However, if the outputData.message was empty, we might want to. This logic needs care.
          // For now, if a message was added from outputData.message, we can break.
          if (JSON.parse(outputString || '{}').message || JSON.parse(outputString || '{}').error) break;
        }

        // General message handling (user messages, or assistant messages not from function_call_output with a .message field)
        if (role === "user" && !text && serverEvent.item?.content?.[0]?.type !== "input_text") {
          text = "[Transcribing...]";
        }
        // Ensure item is not already in transcript from optimistic update or previous processing pass
        if (!transcriptItems?.some((item) => item.itemId === itemId)) {
            addTranscriptMessage(itemId, role, text, (serverEvent.item?.type === "function_call_output" && JSON.parse((serverEvent.item as any).output || "{}").properties) || []);
        } else if (itemType !== "function_call_output") { // Only update if not a func call output (already handled message part)
            const existingItem = transcriptItems.find(item => item.itemId === itemId);
            if (existingItem && existingItem.status === 'IN_PROGRESS') {
                updateTranscriptMessage(itemId, text, false);
            }
        }
        break;
      }

      case "conversation.item.input_audio_transcription.completed": {
        const itemId = serverEvent.item_id;
        const finalTranscript =
          !serverEvent.transcript || serverEvent.transcript === ""
            ? "[inaudible]"
            : serverEvent.transcript;

        console.log(
          `[Transcript] Completed: itemId=${itemId}, transcript="${finalTranscript}"`
        );

        if (itemId) {
          try {
             // Use the passed-in function
            updateTranscriptMessage(itemId, finalTranscript, false);
            if (finalTranscript === "[inaudible]") {
              console.warn("[Transcript] Audio detected as inaudible");
            }
          } catch (error) {
            console.error(
              "[Transcript] Error updating transcript message:",
              error
            );
             try {
                 // Use the passed-in function
                 updateTranscriptMessage(
                     itemId,
                     "[Error transcribing audio]",
                     false
                 );
             } catch (innerError) {
                 console.error("[Transcript] Failed to update with error message:", innerError);
             }
          }
        }
        break;
      }

      case "response.audio_transcript.delta": {
        const itemId = serverEvent.item_id || "";
        const deltaText = serverEvent.delta || "";

        if (itemId) {
             // Use the passed-in function
            updateTranscriptMessage(itemId, deltaText, true);
        }
        break;
      }

      case "response.created": {
        // Mark that we have an active response
        hasActiveResponseRef.current = true;
        console.log(`[Server Event] Response created, marked as active`);
        break;
      }

      case "response.done": {
        hasActiveResponseRef.current = false;
        console.log(`[Server Event Hook] Response done. Agent: ${selectedAgentName}. Transferring flag before check: ${isTransferringAgentRef.current}`);

        if (isTransferringAgentRef.current) {
          console.log(`[Server Event Hook] This response.done is for agent ${selectedAgentName} which just initiated a transfer. Clearing flag and stopping its tool processing.`);
          isTransferringAgentRef.current = false; // Clear the flag, transfer is now in effect for the next agent.
          // Any new tool calls in serverEvent.response.output here were from the OLD agent; skip them.
          break; 
        }

        // If not transferring, process tool calls for the CURRENT agent.
        console.log(`[Server Event Hook] Response done for agent ${selectedAgentName}. Transfer flag is false. Processing output tools for this agent.`);
        if (serverEvent.response?.output) {
          serverEvent.response.output.forEach((outputItem) => {
            if (outputItem.type === "function_call" && outputItem.name && outputItem.arguments) {
              // This handleFunctionCall will execute for the selectedAgentName.
              // If a transfer previously occurred and setSelectedAgentName was called, this should be the NEW agent.
              handleFunctionCall({
                name: outputItem.name,
                call_id: outputItem.call_id,
                arguments: outputItem.arguments,
              });
            }
          });
        }
        break;
      }

      case "response.output_item.done": {
        const itemId = serverEvent.item?.id;
        if (itemId) {
           // Use the passed-in function
          updateTranscriptItemStatus(itemId, "DONE");
        }
        break;
      }

      // Handle the previously unhandled event types
      case "rate_limits.updated":
        // These events can be logged but don't require specific handling
        console.log(`[Server Event] ${serverEvent.type} received and acknowledged`);
        break;
        
      case "response.output_item.added":
        // This event signals a new output item (like text or function call) is being added to the response
        console.log(`[Server Event] Output item added, index: ${(serverEvent as any).output_index}`);
        break;

      case "response.content_part.added":
      case "response.content_part.done":
        // These events relate to content parts within output items
        if ((serverEvent as any).item_id) {
          console.log(`[Server Event] Content part event for item: ${(serverEvent as any).item_id}`);
        }
        break;
        
      case "output_audio_buffer.started":
        // Audio playback is starting
        console.log(`[Server Event] Audio buffer started for response: ${(serverEvent as any).response_id}`);
        break;
        
      case "response.audio.done":
      case "response.audio_transcript.done":
        // Audio playback and transcript are complete
        console.log(`[Server Event] Audio playback and transcript are complete`);
        break;

      case "session.error": {
           console.error("[Session Error Event] Received session.error:", serverEvent);
           const errorMessage = serverEvent.response?.status_details?.error?.message || 'Unknown session error';
           addTranscriptMessage(generateSafeId(), 'system', `Session Error: ${errorMessage}`);
           setSessionStatus("DISCONNECTED"); 
           break;
       }
       case "error": { 
           console.error("[Top-Level Error Event] Received error event:", serverEvent);
           const errorDetails = (serverEvent as any).error;
           const errorMessage = errorDetails?.message || JSON.stringify(serverEvent) || 'Unknown error structure from server';
           const errorCode = errorDetails?.code || 'N/A';
           console.error(`[Top-Level Error Event] Code: ${errorCode}, Message: ${errorMessage}`, errorDetails, serverEvent);
           if (errorCode === "conversation_already_has_active_response") {
             hasActiveResponseRef.current = true;
             console.log("[Error Handler] Marked response as active due to error");
           }
           if (errorCode !== "conversation_already_has_active_response") {
             addTranscriptMessage(generateSafeId(), 'system', `Server Error (${errorCode}): ${errorMessage}`);
           }
           break;
       }
      default:
         console.log(`[Server Event Hook] Unhandled event type: ${serverEvent.type}`);
        break;
    }
  };

  const handleServerEventRef = useRef(handleServerEvent);

  useEffect(() => {
    handleServerEventRef.current = handleServerEvent;
  }, [
      setSessionStatus,
      selectedAgentName,
      selectedAgentConfigSet,
      sendClientEvent,
      setSelectedAgentName,
      transcriptItems,
      addTranscriptMessage,
      updateTranscriptMessage,
      updateTranscriptItemStatus,
      setActiveDisplayMode,
      setPropertyListData,
      setSelectedPropertyDetails,
      setPropertyGalleryData,
  ]);

  const canCreateResponse = () => !hasActiveResponseRef.current && !isTransferringAgentRef.current;

  return {
    handleServerEvent: handleServerEventRef,
    canCreateResponse,
    setSimulatedMessageId: (id: string) => { simulatedMessageIdRef.current = id; }
  };
}
