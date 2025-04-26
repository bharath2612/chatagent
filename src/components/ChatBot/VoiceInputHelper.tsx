"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"

interface VoiceInputHelperProps {
  language: string
  orgId: string
  onTranscription: (transcription: string) => void
}

const VoiceInputHelper = forwardRef<{ toggleMic: () => void }, VoiceInputHelperProps>(
  ({ language, orgId, onTranscription }, ref) => {
    const [isRecording, setIsRecording] = useState<boolean>(false)
    const [autoDetect, setAutoDetect] = useState(true) // Enable VAD by default
    const [error, setError] = useState<string | null>(null)

    // WebSocket and Recording Refs
    const websocketRef = useRef<WebSocket | null>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioStreamRef = useRef<MediaStream | null>(null)
    const isStreamActiveRef = useRef<boolean>(false)

    // VAD Refs
    const analyserRef = useRef<AnalyserNode | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const isRecordingRef = useRef<boolean>(false)
    const silenceStartRef = useRef<number | null>(null)
    const speechStartCandidateRef = useRef<number | null>(null)
    const stopMonitoringRef = useRef<boolean>(false)

    // Silence Detection Parameters
    const SILENCE_DURATION_MS = 1300
    const silenceThreshold = 0.02
    const REQUIRED_SPEECH_MS = 200

    // Expose toggleMic to parent via ref
    useImperativeHandle(ref, () => ({
      toggleMic: () => {
        if (isRecording) {
          stopRecording()
        } else {
          setAutoDetect(true) // Ensure VAD is enabled when mic is turned on
          startRecording()
        }
      },
    }))

    // WebSocket Connection
    useEffect(() => {
      if (!orgId) return
      connectWebSocket()
      return cleanup
    }, [orgId])

    const connectWebSocket = () => {
      if (websocketRef.current?.readyState === WebSocket.OPEN) return
      const wsUrl = process.env.NEXT_PUBLIC_VOICE_AGENT_URL || "wss://your-websocket-url" // Replace with your WebSocket URL
      const ws = new WebSocket(wsUrl)
      websocketRef.current = ws
      ws.binaryType = "arraybuffer"

      ws.onopen = () => {
        console.log("WebSocket connected")
        const session_id = localStorage.getItem("session_id") || crypto.randomUUID()
        localStorage.setItem("session_id", session_id)
        ws.send(
          JSON.stringify({
            type: "init",
            org_id: orgId,
            session_id,
            language,
            config: { stream_config: { enable_keep_alive: true, keep_alive_interval: 1000 } },
          })
        )
      }

      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          try {
            const message = JSON.parse(event.data)
            console.log("WebSocket message:", message)
            // Handle transcription (adjust based on your server's response format)
            if (message.type === "transcription") {
              const transcription = message.text || message.transcription || ""
              if (transcription) {
                onTranscription(transcription)
                stopRecording() // Stop recording after transcription
              }
            }
          } catch (err) {
            console.error("Failed to parse JSON message:", err)
          }
        }
      }

      ws.onerror = (err) => {
        console.error("WebSocket error:", err)
        setError("WebSocket connection error.")
      }

      ws.onclose = () => {
        console.log("WebSocket closed")
      }
    }

    // Recording Functions
    const startRecording = async () => {
      console.log("startRecording called")
      setError(null)

      if (!audioStreamRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          })
          audioStreamRef.current = stream
        } catch (err) {
          console.error("Microphone error:", err)
          setError("Failed to access microphone.")
          return
        }
      }

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/ogg;codecs=opus"
      if (!mimeType) {
        setError("No supported MIME type found for MediaRecorder.")
        return
      }

      const mediaRecorder = new MediaRecorder(audioStreamRef.current, {
        mimeType,
        audioBitsPerSecond: 128000,
      })
      mediaRecorderRef.current = mediaRecorder
      isStreamActiveRef.current = true

      mediaRecorder.ondataavailable = (event) => {
        if (
          isStreamActiveRef.current &&
          websocketRef.current?.readyState === WebSocket.OPEN &&
          event.data.size > 50
        ) {
          console.log("Sending audio chunk to server")
          websocketRef.current.send(event.data)
        }
      }

      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({ type: "start_of_utterance" }))
      } else {
        setError("WebSocket is not connected.")
        return
      }

      mediaRecorder.start(100)
      setIsRecording(true)
      isRecordingRef.current = true
      console.log("Recording started")
    }

    const stopRecording = () => {
      console.log("stopRecording called")
      if (!mediaRecorderRef.current) return

      if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop()
      }

      if (!autoDetect && audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop())
        audioStreamRef.current = null
      }

      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({ type: "end_of_utterance" }))
      }

      isStreamActiveRef.current = false
      setIsRecording(false)
      isRecordingRef.current = false
      console.log("Recording stopped")
    }

    // VAD Logic
    useEffect(() => {
      if (autoDetect) {
        console.log("Starting volume monitoring")
        stopMonitoringRef.current = false
        startAudioContextAndAnalyser().then((success) => {
          if (success) startVolumeMonitoring()
          else {
            setError("Failed to initialize audio context for auto-detect.")
            setAutoDetect(false)
          }
        })
      } else {
        console.log("Stopping volume monitoring")
        cleanupAutoDetect()
      }
      return () => {
        if (autoDetect) stopMonitoringRef.current = true
      }
    }, [autoDetect])

    const startAudioContextAndAnalyser = async () => {
      try {
        if (!audioContextRef.current || audioContextRef.current.state === "closed") {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        }
        const audioContext = audioContextRef.current

        if (
          !audioStreamRef.current ||
          audioStreamRef.current.getTracks().some((track) => track.readyState === "ended")
        ) {
          if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach((track) => track.stop())
          }
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          })
          audioStreamRef.current = stream
        }

        if (!analyserRef.current || !analyserRef.current.context) {
          const source = audioContext.createMediaStreamSource(audioStreamRef.current)
          const analyser = audioContext.createAnalyser()
          analyser.fftSize = 2048
          source.connect(analyser)
          analyserRef.current = analyser
        }

        if (audioContext.state === "suspended") {
          await audioContext.resume()
        }
        return true
      } catch (err) {
        console.error("Error in startAudioContextAndAnalyser:", err)
        return false
      }
    }

    const startVolumeMonitoring = () => {
      const analyser = analyserRef.current
      if (!analyser) return
      const dataArray = new Uint8Array(analyser.fftSize)

      const checkVolume = async () => {
        if (stopMonitoringRef.current) return

        if (!(await startAudioContextAndAnalyser())) return

        analyser.getByteTimeDomainData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128
          sum += val * val
        }
        const rms = Math.sqrt(sum / dataArray.length)

        if (rms > silenceThreshold) {
          if (!isRecordingRef.current) {
            if (speechStartCandidateRef.current === null) {
              speechStartCandidateRef.current = performance.now()
            } else {
              const elapsed = performance.now() - speechStartCandidateRef.current
              if (elapsed >= REQUIRED_SPEECH_MS) {
                console.log("Detected sustained speech => startRecording")
                startRecording()
                speechStartCandidateRef.current = null
              }
            }
          }
          silenceStartRef.current = null
        } else {
          speechStartCandidateRef.current = null
          if (isRecordingRef.current) {
            if (silenceStartRef.current === null) {
              silenceStartRef.current = performance.now()
            } else {
              const now = performance.now()
              if (now - silenceStartRef.current >= SILENCE_DURATION_MS) {
                console.log("1.3s of silence => stopRecording")
                stopRecording()
                silenceStartRef.current = null
              }
            }
          }
        }

        requestAnimationFrame(checkVolume)
      }

      requestAnimationFrame(checkVolume)
    }

    const cleanupAutoDetect = () => {
      stopMonitoringRef.current = true
      if (isRecordingRef.current) stopRecording()
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop())
        audioStreamRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      analyserRef.current = null
      silenceStartRef.current = null
      speechStartCandidateRef.current = null
    }

    const cleanup = () => {
      if (isRecordingRef.current) stopRecording()
      if (websocketRef.current) {
        websocketRef.current.close()
        websocketRef.current = null
      }
      if (autoDetect) cleanupAutoDetect()
    }

    return null // No UI rendering
  }
)

VoiceInputHelper.displayName = "VoiceInputHelper"

export default VoiceInputHelper