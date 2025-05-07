import { RefObject } from "react";

export async function createRealtimeConnection(
  EPHEMERAL_KEY: string,
  audioElement: RefObject<HTMLAudioElement | null>
): Promise<{ pc: RTCPeerConnection; dc: RTCDataChannel }> {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // Add STUN server for better NAT traversal
  });

  // Log ICE connection state changes for debugging
  pc.oniceconnectionstatechange = () => {
    console.log(`[realtimeConnection] ICE connection state: ${pc.iceConnectionState}`);
  };

  pc.ontrack = (e) => {
    console.log(`[realtimeConnection] Track received:`, e.track.kind, e.streams);
    if (audioElement.current) {
        // Ensure any previous srcObject is removed
        if (audioElement.current.srcObject) {
            audioElement.current.srcObject = null;
        }
        
        // Set the new stream
        audioElement.current.srcObject = e.streams[0];
        
        // Explicitly attempt to play
        audioElement.current.play().then(() => {
            console.log(`[realtimeConnection] Audio playback started successfully`);
        }).catch(error => {
            console.error(`[realtimeConnection] Audio playback failed:`, error);
        });
    } else {
        console.error("[realtimeConnection] audioElement ref is null when track received");
    }
  };

  try {
    console.log("[realtimeConnection] Requesting microphone access...");
    const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("[realtimeConnection] Microphone access granted");
    
    // Check if we have audio tracks
    if (ms.getAudioTracks().length === 0) {
      console.error("[realtimeConnection] No audio tracks in media stream");
      throw new Error("No audio tracks available");
    }
    
    // Log audio track details
    const audioTrack = ms.getAudioTracks()[0];
    console.log("[realtimeConnection] Audio track:", audioTrack.label, "enabled:", audioTrack.enabled);
    
    // Add track to peer connection
    const sender = pc.addTrack(audioTrack, ms);
    console.log("[realtimeConnection] Added audio track to peer connection", sender);
  } catch (error) {
    console.error("[realtimeConnection] Error accessing microphone:", error);
    throw error;
  }

  const dc = pc.createDataChannel("oai-events");
  
  // Add data channel event handlers
  dc.onopen = () => console.log("[realtimeConnection] Data channel opened");
  dc.onclose = () => console.log("[realtimeConnection] Data channel closed");
  dc.onerror = (e) => console.error("[realtimeConnection] Data channel error:", e);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  
  console.log("[realtimeConnection] Created and set local offer");

  const baseUrl = "https://api.openai.com/v1/realtime";
  const model = "gpt-4o-mini-realtime-preview-2024-12-17";

  console.log(`[realtimeConnection] Sending offer to ${baseUrl}`);
  const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
    method: "POST",
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${EPHEMERAL_KEY}`,
      "Content-Type": "application/sdp",
    },
  });

  if (!sdpResponse.ok) {
    const errorText = await sdpResponse.text();
    console.error(`[realtimeConnection] SDP response error: ${sdpResponse.status}`, errorText);
    throw new Error(`Failed to establish connection: ${sdpResponse.status} ${errorText}`);
  }

  const answerSdp = await sdpResponse.text();
  const answer: RTCSessionDescriptionInit = {
    type: "answer",
    sdp: answerSdp,
  };

  console.log("[realtimeConnection] Received and setting remote description");
  await pc.setRemoteDescription(answer);
  console.log("[realtimeConnection] Connection setup complete");

  return { pc, dc };
} 