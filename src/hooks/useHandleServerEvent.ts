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

        // Handle potential agent transfer signaled by tool logic
        if (fnResult && fnResult.destination_agent) {
          // Set the transferring flag to true - used to prevent multiple response.create events
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
            setTimeout(() => {
              isTransferringAgentRef.current = false;
              console.log("[handleFunctionCall] Reset transferring flag after timeout");
            }, 500);
            
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
        let text =
          serverEvent.item?.content?.[0]?.text ??
          serverEvent.item?.content?.[0]?.transcript ??
          "";
        const role = serverEvent.item?.role as "user" | "assistant";
        const itemId = serverEvent.item?.id;

        if (!itemId || !role) break;

        // Avoid adding duplicate items if processing is slightly delayed
        if (transcriptItems?.some((item) => item.itemId === itemId)) {
             console.log(`[Transcript] Skipping duplicate item creation: ${itemId}`);
             break;
        }

        // Skip adding simulated "hi" messages to the transcript
        if (role === "user" && text === "hi" && serverEvent.item?.content?.[0]?.type === "input_text") {
          console.log(`[Transcript] Skipping simulated "hi" message: ${itemId}`);
          // Store this ID to filter out related events
          simulatedMessageIdRef.current = itemId;
          break;
        }

        // Handle function_call_output specifically for getProjectDetails
        if (serverEvent.item?.type === "function_call_output" && serverEvent.item?.name === "getProjectDetails") {
          // Type assertion to handle function_call_output which has 'output' property
          const outputString = (serverEvent.item as any).output;
          if (outputString) {
            try {
              const outputData = JSON.parse(outputString);
              
              // Check if this is output from getProjectDetails with properties array
              if (outputData.properties && Array.isArray(outputData.properties)) {
                console.log(`[Transcript] Found properties in function_call_output: ${itemId}`);
                // Let our callback handle displaying the properties
                // Pass properties as the fourth argument
                addTranscriptMessage(
                  itemId, 
                  "assistant", 
                  outputData.message || "Here are the properties I found:", 
                  outputData.properties
                );
                return; // Skip further processing for this event
              }
            } catch (error) {
              console.error("[Transcript] Error parsing function output:", error);
            }
          }
        }

        console.log(
          `[Transcript] Item created: role=${role}, itemId=${itemId}, has text=${!!text}`
        );

        if (
          role === "user" &&
          !text &&
          serverEvent.item?.content?.[0]?.type !== "input_text"
        ) {
          text = "[Transcribing...]";
          console.log(
            `[Transcript] Setting initial transcribing state for itemId=${itemId}`
          );
        }
        // Use the passed-in function
        addTranscriptMessage(itemId, role, text);

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
        // Mark that the response is complete
        hasActiveResponseRef.current = false;
        console.log(`[Server Event] Response done, marked as inactive`);
        
        // Don't trigger function calls during agent transfers
        if (isTransferringAgentRef.current) {
          console.log(`[Server Event] Skipping function call execution during agent transfer`);
          return;
        }
        
        if (serverEvent.response?.output) {
          serverEvent.response.output.forEach((outputItem) => {
            if (
              outputItem.type === "function_call" &&
              outputItem.name &&
              outputItem.arguments
            ) {
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
        console.log(`[Server Event] Audio/transcript complete for item: ${(serverEvent as any).item_id}`);
        break;

      // Handle potential errors from the session
       case "session.error": {
           console.error("[Session Error Event] Received session.error:", serverEvent);
           // Access error details correctly based on ServerEvent type
           const errorMessage = serverEvent.response?.status_details?.error?.message || 'Unknown session error';
           addTranscriptMessage(generateSafeId(), 'system', `Session Error: ${errorMessage}`);
           setSessionStatus("DISCONNECTED"); // Disconnect on session error
           break;
       }

       // Add specific handling for the top-level 'error' event type
       case "error": { 
           console.error("[Top-Level Error Event] Received error event:", serverEvent);
           // Access error details - structure might vary, logging the whole event
           const errorDetails = (serverEvent as any).error; // Use type assertion as structure is unknown
           const errorMessage = errorDetails?.message || JSON.stringify(serverEvent) || 'Unknown error structure from server';
           const errorCode = errorDetails?.code || 'N/A';
           console.error(`[Top-Level Error Event] Code: ${errorCode}, Message: ${errorMessage}`, errorDetails, serverEvent);
           
           // If we get a "conversation_already_has_active_response" error, update our tracking state
           if (errorCode === "conversation_already_has_active_response") {
             hasActiveResponseRef.current = true;
             console.log("[Error Handler] Marked response as active due to error");
           }
           
           // Add error message to transcript
           // Only add visible error message for non-"conversation_already_has_active_response" errors
           if (errorCode !== "conversation_already_has_active_response") {
             addTranscriptMessage(generateSafeId(), 'system', `Server Error (${errorCode}): ${errorMessage}`);
           }
           break;
       }

      default:
         console.log(`[handleServerEvent] Unhandled event type: ${serverEvent.type}`);
        break;
    }
  };

  // Use a ref to ensure the latest handler function is always called by listeners
  const handleServerEventRef = useRef(handleServerEvent);

  // Update the ref whenever the handler function potentially changes
  // Dependencies include everything the handler function closes over
  useEffect(() => {
    handleServerEventRef.current = handleServerEvent;
  }, [
      setSessionStatus,
      selectedAgentName,
      selectedAgentConfigSet,
      sendClientEvent,
      setSelectedAgentName,
      transcriptItems, // Include state used within the handler
      addTranscriptMessage,
      updateTranscriptMessage,
      updateTranscriptItemStatus
  ]);

  // Expose a function to check if a response is active before creating a new one
  const canCreateResponse = () => !hasActiveResponseRef.current && !isTransferringAgentRef.current;

  // Return both the event handler ref and the canCreateResponse function
  return {
    handleServerEvent: handleServerEventRef,
    canCreateResponse,
    setSimulatedMessageId: (id: string) => { simulatedMessageIdRef.current = id; }
  };
} 