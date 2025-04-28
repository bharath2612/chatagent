import { RefObject } from "react";

export async function createRealtimeConnection(
  EPHEMERAL_KEY: string,
  audioElement: RefObject<HTMLAudioElement | null>
): Promise<{ pc: RTCPeerConnection; dc: RTCDataChannel }> {
  const pc = new RTCPeerConnection();

  pc.ontrack = (e) => {
    if (audioElement.current) {
        audioElement.current.srcObject = e.streams[0];
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
    
    pc.addTrack(audioTrack);
  } catch (error) {
    console.error("[realtimeConnection] Error accessing microphone:", error);
    throw error;
  }

  const dc = pc.createDataChannel("oai-events");

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const baseUrl = "https://api.openai.com/v1/realtime";
  const model = "gpt-4o-mini-realtime-preview-2024-12-17";

  const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
    method: "POST",
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${EPHEMERAL_KEY}`,
      "Content-Type": "application/sdp",
    },
  });

  const answerSdp = await sdpResponse.text();
  const answer: RTCSessionDescriptionInit = {
    type: "answer",
    sdp: answerSdp,
  };

  await pc.setRemoteDescription(answer);

  return { pc, dc };
} 