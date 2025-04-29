"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageSquare, X, Mic, MicOff, Phone, Send, PhoneOff, Loader } from "lucide-react"
import { v4 as uuidv4 } from 'uuid';

// UI Components (existing)
import PropertyList from "../PropertyComponents/PropertyList"
import PropertyConfirmation from "../Appointment/confirmProperty" // Updated import
import AppointmentConfirmed from "../Appointment/Confirmations"
import { VoiceWaveform } from "./VoiceWaveForm"

// Agent Logic Imports
import { 
    SessionStatus, 
    TranscriptItem, 
    AgentConfig, 
    AgentMetadata, 
    ServerEvent 
} from "@/types/types";
import { allAgentSets, defaultAgentSetKey } from "@/agentConfigs";
import { createRealtimeConnection } from "@/libs/realtimeConnection";
import { useHandleServerEvent } from "@/hooks/useHandleServerEvent";

interface PropertyUnit {
  type: string
}

interface Amenity {
  name: string
}

interface PropertyLocation {
  city: string
  mapUrl: string
}

interface PropertyImage {
  url: string
  alt: string
}

interface PropertyProps {
  name: string
  price: string
  area :string
  location: PropertyLocation
  mainImage: string
  galleryImages: PropertyImage[]
  units: PropertyUnit[]
  amenities: Amenity[]
  onClose?: () => void
}

// --- Add Props Interface --- 
interface RealEstateAgentProps {
    chatbotId: string; // Receive chatbotId from parent page
}

// --- Agent Component ---
export default function RealEstateAgent({ chatbotId }: RealEstateAgentProps) { // Accept chatbotId prop
  // --- Existing UI State --- 
  const [inputVisible, setInputVisible] = useState(false)
  const [micMuted, setMicMuted] = useState(false) // Placeholder for UI toggle
  const [inputValue, setInputValue] = useState("")
  const [showProperties, setShowProperties] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [appointment, setAppointment] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState<PropertyProps | null>(null)
  const [selectedDay, setSelectedDay] = useState<string>("Monday")
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false)

  // --- Agent & Connection State --- 
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("DISCONNECTED");
  const [transcriptItems, setTranscriptItems] = useState<TranscriptItem[]>([]);
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] = useState<AgentConfig[] | null>(
    allAgentSets[defaultAgentSetKey] || null
  );
  const [selectedAgentName, setSelectedAgentName] = useState<string>(
     selectedAgentConfigSet?.[0]?.name || ""
  );
  // Store agent metadata directly in state, initialize with chatbotId
  const [agentMetadata, setAgentMetadata] = useState<AgentMetadata | null>(null); // Initialize as null initially

  // --- Refs for WebRTC --- 
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null); // Ref to scroll transcript
  const initialSessionSetupDoneRef = useRef<boolean>(false); // Ref to track initial setup

  // Helper to generate safe IDs (32 chars max)
  const generateSafeId = () => uuidv4().replace(/-/g, '').slice(0, 32);

  // Update transcript management functions to use safe IDs
  const addTranscriptMessage = useCallback((itemId: string, role: "user" | "assistant" | "system", text: string) => {
      // If a new ID is being generated (like for system messages), make sure it's safe
      if (itemId === 'new' || itemId.length > 32) {
          itemId = generateSafeId();
      }
      
      setTranscriptItems((prev) => [
          ...prev,
          {
              itemId,
              type: "MESSAGE",
              role,
              text,
              createdAtMs: Date.now(),
              status: role === 'assistant' ? 'IN_PROGRESS' : 'DONE',
          },
      ]);
  }, []);

  const updateTranscriptMessage = useCallback((itemId: string, textDelta: string, isDelta: boolean) => {
      setTranscriptItems((prev) =>
          prev.map((item) => {
              if (item.itemId === itemId && item.type === 'MESSAGE') {
                  return {
                      ...item,
                      text: isDelta ? (item.text || "") + textDelta : textDelta, // Append if delta, replace otherwise
                      status: 'IN_PROGRESS', // Keep in progress while updating
                  };
              }
              return item;
          })
      );
  }, []);

  const updateTranscriptItemStatus = useCallback((itemId: string, status: "IN_PROGRESS" | "DONE" | "ERROR") => {
      setTranscriptItems((prev) =>
          prev.map((item) => {
              if (item.itemId === itemId) {
                  return { ...item, status };
              }
              return item;
          })
      );
  }, []);

  // --- Send Client Events --- 
  const sendClientEvent = useCallback((eventObj: any, eventNameSuffix = "") => {
    if (dcRef.current && dcRef.current.readyState === "open") {
      console.log(`[Send Event] ${eventObj.type} ${eventNameSuffix}`, eventObj);
      dcRef.current.send(JSON.stringify(eventObj));
    } else {
      console.error(
        `[Send Event Error] Data channel not open. Attempted to send: ${eventObj.type} ${eventNameSuffix}`,
        eventObj
      );
      // Optionally add an error message to the transcript
       addTranscriptMessage(generateSafeId(), 'system', `Error: Could not send message. Connection lost.`);
       setSessionStatus("DISCONNECTED"); // Consider disconnecting if send fails
    }
  }, [addTranscriptMessage]); // Updated dependency

  // --- Initialize Event Handler Hook --- 
  const handleServerEventRef = useHandleServerEvent({
      setSessionStatus,
      selectedAgentName,
      selectedAgentConfigSet,
      sendClientEvent,
      setSelectedAgentName,
      // Pass transcript state and functions
      transcriptItems,
      addTranscriptMessage,
      updateTranscriptMessage,
      updateTranscriptItemStatus,
  });

  // --- Fetch Org Metadata (Modified) --- 
  const fetchOrgMetadata = useCallback(async () => {
      // Use the chatbotId passed via props
      if (!selectedAgentConfigSet || !chatbotId) {
           console.warn("[Metadata] Agent config set or chatbotId missing.");
           if (!chatbotId) addTranscriptMessage(generateSafeId(), 'system', 'Configuration Error: Chatbot ID missing.');
           return;
      }
      console.log("[Metadata] Attempting to fetch org metadata...");
      
      const agentWithFetch = selectedAgentConfigSet.find(a => a.toolLogic?.fetchOrgMetadata);
      const fetchTool = agentWithFetch?.toolLogic?.fetchOrgMetadata;

      if (fetchTool) {
          try {
              // Use the existing session ID from metadata state
              const sessionId = agentMetadata?.session_id || generateSafeId(); // Fallback if metadata not set yet
              
              console.log(`[Metadata] Calling fetch tool with session: ${sessionId}, chatbot: ${chatbotId}`);
              const result = await fetchTool({ session_id: sessionId, chatbot_id: chatbotId }, transcriptItems);
              console.log("[Metadata] fetchOrgMetadata result:", result);
              
              if (result && !result.error) {
                  // Update agent metadata state, ensuring session_id and chatbot_id are preserved/set
                  setAgentMetadata(prev => ({ ...(prev || {}), ...result, session_id: sessionId, chatbot_id: chatbotId })); 
                  addTranscriptMessage(generateSafeId(), 'system', 'Agent context updated.');
              } else {
                   addTranscriptMessage(generateSafeId(), 'system', `Error fetching agent context: ${result?.error || 'Unknown error'}`);
                   // Ensure metadata has session/chatbot ID even if fetch fails
                   setAgentMetadata(prev => ({ ...(prev || {}), session_id: sessionId, chatbot_id: chatbotId }));
              }
          } catch (error: any) {
              console.error("[Metadata] Error executing fetchOrgMetadata:", error);
               addTranscriptMessage(generateSafeId(), 'system', `Error fetching agent context: ${error.message}`);
               // Ensure metadata has session/chatbot ID on exception
                const sessionId = agentMetadata?.session_id || generateSafeId();
                setAgentMetadata(prev => ({ ...(prev || {}), session_id: sessionId, chatbot_id: chatbotId }));
          }
      } else {
          console.warn("[Metadata] No agent found with fetchOrgMetadata tool.");
           addTranscriptMessage(generateSafeId(), 'system', 'Agent configuration error: Metadata fetch tool missing.');
      }
  }, [selectedAgentConfigSet, chatbotId, agentMetadata?.session_id, addTranscriptMessage, transcriptItems]); // Add transcriptItems dependency

  // --- Session Update Logic --- 
   const updateSession = useCallback(async (shouldTriggerResponse: boolean = false) => {
       if (sessionStatus !== 'CONNECTED' || !selectedAgentConfigSet || !dcRef.current) {
           console.log("[Update Session] Cannot update, not connected or config missing.");
           return;
       }
       
       const currentAgent = selectedAgentConfigSet.find(a => a.name === selectedAgentName);
       if (!currentAgent) {
           console.error(`[Update Session] Agent config not found for: ${selectedAgentName}`);
           return;
       }
       
       // Ensure agent metadata state is merged into the agent config before sending
       if (agentMetadata) {
            currentAgent.metadata = { ...(currentAgent.metadata || {}), ...agentMetadata };
       } else {
            // If agentMetadata is still null, ensure chatbotId is present
             currentAgent.metadata = { ...(currentAgent.metadata || {}), chatbot_id: chatbotId, session_id: generateSafeId() };
             console.warn("[Update Session] agentMetadata state was null, initializing from props/new session.")
       }

       console.log(`[Update Session] Updating server session for agent: ${selectedAgentName}`);

       // Prepare instructions, potentially injecting metadata dynamically
       let instructions = currentAgent.instructions;
       // Check if getInstructions function exists (copied from realEstateAgent.ts setup)
       if (currentAgent.name === 'realEstate' && typeof (window as any).getInstructions === 'function') {
            try {
                instructions = (window as any).getInstructions(currentAgent.metadata);
                console.log("[Update Session] Dynamically generated instructions applied for realEstate agent.");
            } catch (e) {
                 console.error("[Update Session] Error running getInstructions:", e);
            }
       } else {
            // Basic interpolation for other agents if needed
             if (agentMetadata?.language) {
                 instructions = instructions.replace(/\$\{metadata\?.language \|\| "English"\}/g, agentMetadata.language);
             }
       }

       const languageCode = "en"; // TODO: Make language selectable if needed

       // Configure turn detection (disable for now, like PTT active in old code)
       const turnDetection = null; 

       // Clear any existing audio buffer before updating
       sendClientEvent({ type: "input_audio_buffer.clear" }, "clear audio buffer on session update");

       // Prepare the session update payload - Mirroring oldCode/App.tsx structure
       const sessionUpdatePayload = {
            type: "session.update",
            session: {
                // Add fields from old code
                modalities: ["text", "audio"], // Enable audio
                instructions: instructions, // Use potentially updated instructions
                voice: "coral", // Default voice (adjust if needed)
                input_audio_format: "pcm16",
                output_audio_format: "pcm16",
                input_audio_transcription: {
                    model: "whisper-1", // Default model (adjust if needed)
                    language: languageCode,
                },
                turn_detection: turnDetection, // Default to null (no VAD)
                tools: currentAgent.tools || [], // Include agent tools

                // DO NOT explicitly send metadata object here
                // Server should use session ID context
            },
        };

       sendClientEvent(sessionUpdatePayload, `(agent: ${selectedAgentName})`);

       // If shouldTriggerResponse is true, follow the old code's approach of sending a simulated message
       if (shouldTriggerResponse) {
           console.log("[Update Session] Triggering initial response with simulated 'hi' message");
           sendSimulatedUserMessage("hi");
       }
   }, [sessionStatus, selectedAgentName, selectedAgentConfigSet, agentMetadata, chatbotId, sendClientEvent, addTranscriptMessage]); 

   // Add the sendSimulatedUserMessage function to match old code
   const sendSimulatedUserMessage = useCallback((text: string) => {
       // Generate a truncated ID (32 chars max as required by API)
       const id = generateSafeId();
       
       // DO NOT add simulated message to transcript (it shouldn't be visible)
       // addTranscriptMessage(id, "user", text);

       // Send the message event
       sendClientEvent(
           {
               type: "conversation.item.create",
               item: {
                   id,
                   type: "message",
                   role: "user",
                   content: [{ type: "input_text", text }],
               },
           },
           "(simulated user text message)"
       );

       // After sending message, trigger response
       sendClientEvent(
           { type: "response.create" },
           "(trigger response after simulated user message)"
       );
   }, [sendClientEvent]);

  // --- Connection Management --- 
  const connectToRealtime = useCallback(async () => {
    if (sessionStatus !== "DISCONNECTED") return;
    setSessionStatus("CONNECTING");
    setTranscriptItems([]); // Clear transcript on new connection
    addTranscriptMessage(generateSafeId(), 'system', 'Connecting...');

    try {
      console.log("Fetching ephemeral key from /api/session...");
      const tokenResponse = await fetch("/api/session", { method: "POST" });
      const data = await tokenResponse.json();

      // Check for the nested .value property
      if (!tokenResponse.ok || !data.client_secret?.value) { 
        console.error("Failed to get session token:", data);
         const errorMsg = data?.error || 'Could not get session token (missing client_secret.value)';
         addTranscriptMessage(generateSafeId(), 'system', `Connection failed: ${errorMsg}`);
        setSessionStatus("DISCONNECTED");
        return;
      }

      // Extract the actual key string from .value
      const EPHEMERAL_KEY = data.client_secret.value;
      console.log("Ephemeral key value received."); // Updated log message

      // Create audio element if it doesn't exist
      if (!audioElementRef.current) {
        audioElementRef.current = document.createElement("audio");
        // IMPORTANT: Set these properties for audio to work properly
        audioElementRef.current.autoplay = true;
        // Use correct TypeScript attribute name
        (audioElementRef.current as any).playsInline = true; // Type assertion to bypass TypeScript error
        // For debugging purposes, we can add it to the DOM with controls
        document.body.appendChild(audioElementRef.current);
        audioElementRef.current.style.display = 'none'; // Hide it but keep in DOM
        // audioElementRef.current.controls = true; // Enable for debugging
      }

      console.log("Creating Realtime Connection...");
      const { pc, dc } = await createRealtimeConnection(
        EPHEMERAL_KEY,
        audioElementRef
      );
      pcRef.current = pc;
      dcRef.current = dc;

      // --- Setup Data Channel Listeners ---
      dc.addEventListener("open", () => {
        console.log("Data Channel Opened");
        // Do NOT add a "Connection established" message here
        // Let the server event handler do it to avoid duplication
      });

      dc.addEventListener("close", () => {
        console.log("Data Channel Closed");
         addTranscriptMessage(generateSafeId(), 'system', 'Connection closed.');
        setSessionStatus("DISCONNECTED");
        // Clean up refs
        pcRef.current = null;
        dcRef.current = null;
      });

      dc.addEventListener("error", (err: any) => {
        console.error("Data Channel Error:", err);
         addTranscriptMessage(generateSafeId(), 'system', `Connection error: ${err?.message || 'Unknown DC error'}`);
        setSessionStatus("DISCONNECTED");
      });

      dc.addEventListener("message", (e: MessageEvent) => {
          try {
              const serverEvent: ServerEvent = JSON.parse(e.data);
              handleServerEventRef.current(serverEvent); // Call the handler from the hook
          } catch (error) {
               console.error("Error parsing server event:", error, e.data);
          }
      });

    // Note: setSessionStatus("CONNECTED") is handled by the session.created event via the hook

    } catch (err: any) {
      console.error("Error connecting to realtime:", err);
       addTranscriptMessage(generateSafeId(), 'system', `Connection failed: ${err.message}`);
      setSessionStatus("DISCONNECTED");
    }
  }, [sessionStatus, addTranscriptMessage, handleServerEventRef]); // Dependencies

  const disconnectFromRealtime = useCallback(() => {
    if (!pcRef.current) return;
    console.log("[Disconnect] Cleaning up WebRTC connection");
    addTranscriptMessage(generateSafeId(), 'system', 'Disconnecting...');

    // Reset the setup flag on disconnect
    initialSessionSetupDoneRef.current = false; 

    try {
      // Properly cleanup audio element
      if (audioElementRef.current) {
        audioElementRef.current.srcObject = null;
        audioElementRef.current.pause();
        // Remove from DOM if it was added
        if (audioElementRef.current.parentNode) {
          audioElementRef.current.parentNode.removeChild(audioElementRef.current);
        }
        audioElementRef.current = null;
      }

      // Cleanup WebRTC
      pcRef.current.getSenders().forEach((sender) => {
        sender.track?.stop();
      });
      pcRef.current.close();
    } catch (error) {
      console.error("[Disconnect] Error closing peer connection:", error);
    }

    // dcRef listener for 'close' should handle setting status and clearing refs
     if (dcRef.current && dcRef.current.readyState === 'open') {
         dcRef.current.close();
     } else {
        // If DC wasn't open or already closed, manually update state
         setSessionStatus("DISCONNECTED");
         pcRef.current = null;
         dcRef.current = null;
     }
     setAgentMetadata(null); // Clear metadata on disconnect
     // Don't clear transcript immediately, let user see history

  }, [addTranscriptMessage]); // Dependencies

  // --- Effects --- 

  // Effect to initialize agentMetadata when chatbotId is first available
  useEffect(() => {
      if (chatbotId && !agentMetadata) { // Only run if chatbotId is present and metadata is not yet set
          console.log(`[Effect] Initializing agentMetadata with chatbotId: ${chatbotId}`);
          setAgentMetadata({ 
              chatbot_id: chatbotId, 
              session_id: generateSafeId() // Generate a new session ID
          });
      }
  }, [chatbotId]); // Rerun only if chatbotId changes (should be stable after load)

  // Effect to fetch metadata and update session when connected or agent changes
  useEffect(() => {
      // Goal: Run fetchOrgMetadata and updateSession(true) *once* per connection/agent setup.

      // Condition: Connected, have config, have basic metadata (chatbotId/session_id)
      if (sessionStatus === 'CONNECTED' && selectedAgentConfigSet && agentMetadata) { 
          // Check if setup has already been done for this specific agent and connection instance
          if (!initialSessionSetupDoneRef.current) {
              console.log("[Effect] Connected & Setup Needed: Fetching metadata and updating session.");
              
              // Mark setup as *starting* immediately to prevent race conditions within this effect run
              // We'll set it back to false if fetch/update fails.
              initialSessionSetupDoneRef.current = true; 
              
              fetchOrgMetadata().then(() => {
                  // Check if still connected *after* async fetch completes
                  if (sessionStatus === 'CONNECTED') { 
                       // Now update the session and trigger the initial response
                       updateSession(true); 
                       // Mark setup truly complete *after* successful updateSession
                       // initialSessionSetupDoneRef.current = true; // Already set above
                       console.log("[Effect] Initial session setup complete.");
                  } else {
                       console.log("[Effect] Session disconnected after metadata fetch, aborting initial session update.");
                       initialSessionSetupDoneRef.current = false; // Reset flag if disconnected during fetch
                  }
              }).catch(error => {
                   console.error("[Effect] Error during initial fetchOrgMetadata or updateSession in effect:", error);
                   addTranscriptMessage(generateSafeId(), 'system', 'Error during initial setup.');
                   initialSessionSetupDoneRef.current = false; // Reset flag on error to allow retry if appropriate
              });
          } else {
               // This log confirms the ref is preventing re-runs for the *same* agent/connection.
               console.log("[Effect] Connected, but initial session setup already marked as done/in-progress.");
          }
      } else {
          // Log why the effect isn't running the setup
          if (sessionStatus !== 'CONNECTED') console.log("[Effect] Waiting for connection...");
          // else if (!selectedAgentConfigSet) console.log("[Effect] Waiting for agent config set...");
          // else if (!agentMetadata) console.log("[Effect] Waiting for initial agent metadata (chatbotId/session_id)...");
      }
      // Dependencies: 
      // - sessionStatus: Trigger when connected/disconnected.
      // - selectedAgentName: Trigger when agent changes (flag reset handled in separate effect).
      // - agentMetadata: Trigger *only* when the essential initial metadata (chatbotId/session_id) is first available.
      // - selectedAgentConfigSet: Ensure config is loaded.
      // Dependencies fetchOrgMetadata and updateSession are stable useCallback refs.
  }, [sessionStatus, selectedAgentName, agentMetadata?.chatbot_id, agentMetadata?.session_id, selectedAgentConfigSet, fetchOrgMetadata, updateSession, addTranscriptMessage]); 

  // Separate effect to reset the setup flag when the agent name changes
  const previousAgentNameRef = useRef<string | null>(null);
  useEffect(() => {
      if (selectedAgentName !== previousAgentNameRef.current && previousAgentNameRef.current !== null) {
          console.log(`[Effect] Agent changed from ${previousAgentNameRef.current} to ${selectedAgentName}. Resetting setup flag.`);
          initialSessionSetupDoneRef.current = false;
          // The main effect above will then run the setup for the new agent.
      }
      previousAgentNameRef.current = selectedAgentName;
  }, [selectedAgentName]);

  // Effect for cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("[Cleanup] Component unmounting, disconnecting...");
      disconnectFromRealtime();
      // Clean up audio element if needed
       if (audioElementRef.current) {
           audioElementRef.current.srcObject = null;
           // Optional: remove from DOM if appended
           // audioElementRef.current.remove(); 
       }
    };
  }, [disconnectFromRealtime]);

   // Effect to scroll transcript to bottom
   useEffect(() => {
       transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
   }, [transcriptItems]);

  // --- UI Handlers --- 
  const toggleInput = () => {
    setInputVisible(!inputVisible)
    if (!inputVisible) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 300)
    }
  }

  // Placeholder Mic Toggle
  const toggleMic = () => {
    setMicMuted(!micMuted)
    // TODO: Add PTT logic here if needed, calling sendClientEvent
     addTranscriptMessage(generateSafeId(), 'system', 'Microphone control not fully implemented yet.');
  }

  // Updated Send Handler
  const handleSend = useCallback(() => {
    const textToSend = inputValue.trim();
    if (!textToSend || sessionStatus !== 'CONNECTED' || !dcRef.current) return;

    console.log(`[Send Text] Sending: "${textToSend}"`);
    const userMessageId = generateSafeId();

    // Add user message optimistically to transcript
     addTranscriptMessage(userMessageId, 'user', textToSend);

    // Send message event to server
    sendClientEvent(
      {
        type: "conversation.item.create",
        item: {
          id: userMessageId,
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: textToSend }],
        },
      },
      "(user text message)"
    );
    setInputValue("");

    // Trigger agent response
    sendClientEvent({ type: "response.create" }, "(trigger response)");

  }, [inputValue, sessionStatus, sendClientEvent, addTranscriptMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSend()
    }
  }

  // Call Button Handler
  const handleCallButtonClick = () => {
      if (sessionStatus === 'DISCONNECTED') {
          // Ensure chatbotId is available before connecting
           if (chatbotId) {
               connectToRealtime();
           } else {
               addTranscriptMessage(generateSafeId(), 'system', 'Cannot connect: Chatbot ID is missing.');
               console.error("Attempted to connect without a chatbotId.");
           }
      } else {
          disconnectFromRealtime();
      }
  };

  // Existing UI handlers (keep as is)
  const handleScheduleVisit = (property: PropertyProps) => {
    setShowProperties(false)
    setSelectedProperty(property)
    setAppointment(true)
    setSelectedTime(null) // Reset time selection
    setIsConfirmed(false) // Reset confirmation
    // TODO: Potentially trigger agent interaction here if needed
  }
  const handleTimeClick = (time: string) => {
    setSelectedTime(time)
  }
  const handleCloseConfirmation = () => {
    setSelectedTime(null)
    // Maybe reset appointment state?
    // setAppointment(false);
    // setSelectedProperty(null);
  }
  const handleConfirmBooking = () => {
    setIsConfirmed(true)
    // TODO: Potentially trigger agent interaction here to confirm
     // Example: addTranscriptMessage(uuidv4(), 'user', `Confirm booking for ${selectedProperty?.name} on ${selectedDay} at ${selectedTime}.`); sendClientEvent({type: "response.create"});
  }
  const handleReset = () => {
    setAppointment(false)
    setSelectedProperty(null)
    setSelectedTime(null)
    setIsConfirmed(false)
  }

  // --- Render --- 
  // Placeholder: Fetch properties (replace with actual logic or agent interaction)
   const properties: PropertyProps[] = [
         {
             name: "Emaar Beachfront", price: "AED 5M", area: "1,200 sqft",
             location: { city: "Dubai", mapUrl: "#" }, mainImage: "/property1.jpg",
             galleryImages: [{ url: "/property1.jpg", alt: "Living room" }],
             units: [{ type: "2BR" }, { type: "3BR" }], amenities: [{ name: "Pool" }, { name: "Gym" }]
         },
         // Add more properties if needed
     ];

  return (
    <div
      className="relative bg-blue-900 rounded-3xl overflow-hidden text-white flex flex-col"
      style={{ width: "329px", height: "611px" }}
    >
      {/* Header - Keep as is */}
      <div className="flex items-center p-4 border-b border-blue-800 flex-shrink-0">
        <div className="flex items-center">
          <div className="bg-white rounded-full p-1 mr-2">
            <div className="text-blue-800 w-8 h-8 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42" fill="none">
                <circle cx="21" cy="21" r="21" fill="white" />
                <path d="M15.9833 12.687L11 16.2194V30.1284H15.9833V12.687Z" fill="#2563EB" />
                <rect width="9.58318" height="4.98325" transform="matrix(-1 0 0 1 31.3162 25.1455)" fill="#2563EB" />
                <rect width="4.79159" height="7.85821" transform="matrix(-1 0 0 1 31.3162 17.2871)" fill="#2563EB" />
                <path d="M20.4589 9.45097L16.3664 12.0161L28.2862 21.0735L31.3162 17.2868L20.4589 9.45097Z" fill="#2563EB" />
                <g filter="url(#filter0_i_3978_26224)">
                  <path d="M15.9833 12.687L16.7499 13.262V29.5534L15.9833 30.1284V12.687Z" fill="#6193FF" />
                </g>
                <g filter="url(#filter1_i_3978_26224)">
                  <path d="M16.2157 12.7009L16.3665 12.0161L26.5735 19.773L25.8041 20.0584L16.2157 12.7009Z" fill="#3B71E6" />
                </g>
                <g filter="url(#filter2_i_3978_26224)">
                  <path d="M25.7582 19.9701L26.5248 19.6826V25.145H25.7582V19.9701Z" fill="#3B71E6" />
                </g>
                <g filter="url(#filter3_i_3978_26224)">
                  <path d="M21.7331 25.1455L20.9665 24.3789H25.7581L26.5247 25.1455H21.7331Z" fill="#3B71E6" />
                </g>
                <g filter="url(#filter4_i_3978_26224)">
                  <path d="M20.9665 24.3779L21.7331 25.1446V30.1278L20.9665 29.5528V24.3779Z" fill="#6193FF" />
                </g>
                <path d="M25.7582 24.3779L26.5248 25.1446" stroke="#4B83FC" strokeWidth="0.0134678" strokeLinecap="round" />
                <path d="M25.7582 19.9701L26.5248 19.6826" stroke="#4B83FC" strokeWidth="0.0134678" strokeLinecap="round" />
                <defs>
                  <filter id="filter0_i_3978_26224" x="15.9833" y="12.687" width="0.766663" height="17.8005" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                    <feOffset dy="0.359141" />
                    <feGaussianBlur stdDeviation="0.17957" />
                    <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.4 0" />
                    <feBlend mode="normal" in2="shape" result="effect1_innerShadow_3978_26224" />
                  </filter>
                  <filter id="filter1_i_3978_26224" x="16.2156" y="12.0161" width="10.3578" height="8.40162" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                    <feOffset dy="0.359141" />
                    <feGaussianBlur stdDeviation="0.17957" />
                    <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.4 0" />
                    <feBlend mode="normal" in2="shape" result="effect1_innerShadow_3978_26224" />
                  </filter>
                  <filter id="filter2_i_3978_26224" x="25.7582" y="19.6826" width="0.766663" height="5.82154" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                    <feOffset dy="0.359141" />
                    <feGaussianBlur stdDeviation="0.17957" />
                    <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.4 0" />
                    <feBlend mode="normal" in2="shape" result="effect1_innerShadow_3978_26224" />
                  </filter>
                  <filter id="filter3_i_3978_26224" x="20.9665" y="24.3789" width="5.55823" height="1.12574" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                    <feOffset dy="0.359141" />
                    <feGaussianBlur stdDeviation="0.17957" />
                    <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.4 0" />
                    <feBlend mode="normal" in2="shape" result="effect1_innerShadow_3978_26224" />
                  </filter>
                  <filter id="filter4_i_3978_26224" x="20.9665" y="24.3779" width="0.766663" height="6.10914" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                    <feOffset dy="0.359141" />
                    <feGaussianBlur stdDeviation="0.17957" />
                    <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.4 0" />
                    <feBlend mode="normal" in2="shape" result="effect1_innerShadow_3978_26224" />
                  </filter>
                </defs>
              </svg>
            </div>
          </div>
          <span className="font-medium">Real Estate AI Agent</span>
        </div>
        <button className="ml-auto p-2 hover:bg-blue-800 rounded-full">
          <X size={20} />
        </button>
      </div>
      
      {/* Voice Waveform (conditional?) */}
      {sessionStatus === 'CONNECTED' && (
           <div className="border-1 h-10 rounded-3xl w-72 p-4 justify-evenly ml-5 my-2 flex-shrink-0">
       <VoiceWaveform/>
       </div>
      )}

      {/* --- Main Content Area --- */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-blue-700 scrollbar-track-blue-800">
        {/* Render Transcript Items */}
        {transcriptItems.map((item) => (
           item.type === 'MESSAGE' && (
               <div key={item.itemId} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                   <div 
                       className={`max-w-[80%] p-3 rounded-2xl text-sm ${ 
                           item.role === 'user' 
                           ? 'bg-blue-600 rounded-br-none' 
                           : 'bg-gray-600 rounded-bl-none'
                       } ${item.status === 'IN_PROGRESS' && item.role ==='assistant' ? 'opacity-80' : ''}`}
                   >
                       {item.text || (item.role === 'assistant' && item.status === 'IN_PROGRESS' ? '...' : '')}
                        {/* Optionally show status indicator */} 
                        {/* {item.status === 'IN_PROGRESS' && <Loader size={10} className="inline-block ml-1 animate-spin" />} */}
                   </div>
               </div>
           )
        ))}
         {/* Element to scroll to */} 
         <div ref={transcriptEndRef} />
      </div>

      {/* Existing UI for properties/appointments (conditional rendering) */}
        {appointment && selectedProperty && (
            <div className="absolute inset-0 bg-blue-900 bg-opacity-90 flex items-center justify-center z-10 p-4">
           <PropertyConfirmation
           onClose={handleCloseConfirmation}
           selectedTime={selectedTime || ""}
           selectedDay={selectedDay}
           onConfirm={handleConfirmBooking}
           property={selectedProperty}
         />
        </div>
        )}
        {showProperties && (
            <div className="absolute inset-0 bg-blue-900 bg-opacity-90 flex items-center justify-center z-10 p-4 overflow-auto">
                 <button onClick={() => setShowProperties(false)} className="absolute top-4 right-4 p-2 bg-red-500 rounded-full z-20"><X size={18}/></button>
                 <PropertyList properties={properties} onScheduleVisit={handleScheduleVisit}/>
            </div>
        )}
        {isConfirmed && selectedProperty && (
             <div className="absolute inset-0 bg-blue-900 bg-opacity-95 flex items-center justify-center z-10 p-4">
                  <AppointmentConfirmed 
                    onClose={handleReset} 
                    property={selectedProperty}
                    date={selectedDay} // Pass selected date/time
                    time={selectedTime || ""}
                />
          </div>
          )}

      {/* --- Bottom Controls Area --- */}
      <div className="mt-auto flex-shrink-0 z-20">
        <AnimatePresence>
          {inputVisible && (
            <motion.div /* Keep animation as is */
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="rounded-xl w-[320px] -mb-1 ml-1 h-[48px] shadow-lg bg-[#47679D]"
            >
              <div className="flex items-center justify-between w-full px-4 py-2 rounded-lg">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={sessionStatus === 'CONNECTED' ? "Type your message..." : "Connect call to type"}
                  className="flex-1 mt-1 bg-transparent outline-none text-white placeholder:text-white placeholder:opacity-50 text-sm"
                  disabled={sessionStatus !== 'CONNECTED'}
                />
                <button 
                    onClick={handleSend} 
                    className="ml-2 mt-1 text-white disabled:opacity-50"
                    disabled={sessionStatus !== 'CONNECTED' || !inputValue.trim()}
                 >
                  <Send size={18} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Button Bar */}
        <div className="flex justify-between items-center p-3 bg-blue-900">
          <button onClick={toggleInput} className="bg-[#47679D] p-3 rounded-full hover:bg-blue-600 transition-colors">
            <MessageSquare size={20} />
          </button>

           {/* Placeholder dots - keep as is */}
          <div className="flex justify-center space-x-1">
             {/* ... (keep existing dots) ... */} 
               {Array(15).fill(0).map((_, i) => (<div key={i} className="w-1 h-1 bg-white rounded-full opacity-50"></div>))}
          </div>

          <button 
              onClick={toggleMic} 
              className={`p-3 rounded-full transition-colors ${micMuted ? 'bg-gray-600' : 'bg-[#47679D] hover:bg-blue-600'}`}
              disabled={sessionStatus !== 'CONNECTED'} // Disable mic if not connected
           >
            {micMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Call Button */}
          <button 
              onClick={handleCallButtonClick}
              className={`${sessionStatus === 'CONNECTED' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} p-3 rounded-full transition-colors disabled:opacity-70`}
              disabled={sessionStatus === 'CONNECTING' || (!chatbotId && sessionStatus === 'DISCONNECTED')} // Disable connect if no chatbotId
           >
             {sessionStatus === 'CONNECTING' ? <Loader size={18} className="animate-spin"/> : 
              sessionStatus === 'CONNECTED' ? <PhoneOff size={18} /> : 
              <Phone size={18} />
             }
          </button>
        </div>
      </div>
      {/* Hidden Audio Element */}
      <audio ref={audioElementRef} playsInline />
    </div>
  )
}