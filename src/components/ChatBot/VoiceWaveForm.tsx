'use client';

import { useEffect, useRef, useState } from 'react';

type VoiceWaveformProps = {
  active?: boolean;
  barCount?: number;
  dotCount?: number;
  color?: string;
  maxHeight?: number;
  className?: string;
  mediaStream?: MediaStream | null;
};

export function VoiceWaveform({
  active = true,
  barCount = 25, // Number of animated bars
  dotCount = 0, // Number of dots
  color = '#ffffff', // White to match the image
  maxHeight = 20, // Reduced height to fit the design
  className = 'h-4',
  mediaStream = null
}: VoiceWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const barsRef = useRef<HTMLDivElement[]>([]);
  
  // Audio analyzer refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  
  // Track connection state to avoid repeated connections
  const [isAudioConnected, setIsAudioConnected] = useState(false);

  // Setup analyzer when a new mediaStream arrives
  useEffect(() => {
    // Cleanup function
    const cleanup = () => {
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }
      dataArrayRef.current = null;
      setIsAudioConnected(false);
    };

    if (mediaStream && active) {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;

        // Create analyser if not exists
        if (!analyserRef.current) {
          analyserRef.current = ctx.createAnalyser();
          analyserRef.current.fftSize = 64;
          const bufferLen = analyserRef.current.frequencyBinCount;
          dataArrayRef.current = new Uint8Array(bufferLen);
        }

        // Create and connect the source
        if (!sourceRef.current && analyserRef.current) {
          sourceRef.current = ctx.createMediaStreamSource(mediaStream);
          sourceRef.current.connect(analyserRef.current);
          setIsAudioConnected(true);
        }
      } catch (e) {
        console.error('VoiceWaveform: error setting up analyzer', e);
        cleanup();
      }
    }

    return cleanup;
  }, [mediaStream, active]);

  // Animation effect that uses audio volume if available, or falls back to simulation
  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(animationRef.current);
      // Reset bars to minimal height when inactive
      barsRef.current.forEach(bar => {
        if (bar) bar.style.height = '4px';
      });
      return;
    }

    // Function to detect if audio is actually playing
    const isAudioPlaying = () => {
      return mediaStream !== null && mediaStream.active;
    };

    const animateBars = () => {
      // Create a simulated audio pattern that approximates speech
      const simulateAudio = () => {
        const time = Date.now();
        const basePattern = Math.sin(time / 400) * 0.5 + 0.5; // 0-1 oscillation
        
        // Create a speech-like pattern with pauses
        const speaking = (Math.sin(time / 2000) + 1) / 2 > 0.3;
        
        return speaking ? basePattern : 0;
      };

      // Try to get real audio data if possible
      if (isAudioConnected && analyserRef.current && dataArrayRef.current && isAudioPlaying()) {
        try {
          // Get frequency data
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          
          // Update bars based on frequency data
          const bufferLength = dataArrayRef.current.length;
          
          // Calculate the energy in the signal - helpful for speech
          let totalEnergy = 0;
          for (let i = 0; i < bufferLength; i++) {
            totalEnergy += dataArrayRef.current[i] / 255.0;
          }
          const averageEnergy = totalEnergy / bufferLength;
          
          // Use a sliding window to smooth transitions
          const barStep = Math.ceil(bufferLength / barCount);
          
          barsRef.current.forEach((bar, index) => {
            if (!bar) return;
            
            // Map frequencies with emphasis on speech range
            const startFreq = Math.min(index * barStep, bufferLength - 1);
            const endFreq = Math.min(startFreq + barStep, bufferLength - 1);
            
            // Calculate average for this frequency band
            let sum = 0;
            for (let i = startFreq; i <= endFreq; i++) {
              // Apply a speech-focused weighting (boost mid-range frequencies)
              const weight = i > bufferLength * 0.1 && i < bufferLength * 0.7 ? 1.5 : 0.8;
              sum += dataArrayRef.current![i] * weight;
            }
            const value = sum / (endFreq - startFreq + 1);
            
            // Apply non-linear mapping for better visualization
            const scaleFactor = (maxHeight - 4) / 255;
            const height = 4 + Math.pow(value * 0.01, 0.7) * (maxHeight - 4);
            
            bar.style.height = `${height}px`;
            bar.style.marginTop = `${(maxHeight - height) / 2}px`; // Center vertically
          });
        } catch (error) {
          // Fall back to simulation if analysis fails
          console.warn("Audio analysis failed, using simulation:", error);
          simulateWaveform();
        }
      } else {
        // Fall back to simulated waveform
        simulateWaveform();
      }

      function simulateWaveform() {
        const time = Date.now();
        const speechSimulation = simulateAudio();

        barsRef.current.forEach((bar, index) => {
          if (!bar) return;

          // Vertical wave pattern for bars with phase shift
          const wave1 = Math.sin(time / 500 + index * 0.3) * speechSimulation;
          const wave2 = Math.cos(time / 700 + index * 0.2) * 0.5 * speechSimulation;
          const wave3 = Math.sin(time / 300) * 0.3 * speechSimulation;

          // Add a base minimum value and randomness for natural look
          const randomFactor = Math.random() * 0.2;
          const waveHeight = ((wave1 + wave2 + wave3) * 0.8 + randomFactor + 1.0) / 3;
          const height = 4 + waveHeight * (maxHeight - 4); // Min 4px, max based on prop

          bar.style.height = `${height}px`;
          bar.style.marginTop = `${(maxHeight - height) / 2}px`; // Center vertically
        });
      }

      animationRef.current = requestAnimationFrame(animateBars);
    };

    animationRef.current = requestAnimationFrame(animateBars);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [active, maxHeight, barCount, isAudioConnected, mediaStream]);

  return (
    <div
      ref={containerRef}
      className={`flex items-center justify-start gap-1 w-full ml-14 -mt-2 ${className}`}
      style={{ height: `${maxHeight}px` }}
    >
      {/* Animated Bars */}
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={`bar-${i}`}
          ref={el => { if (el) barsRef.current[i] = el }}
          className="transition-all duration-75 ease-out rounded-full"
          style={{
            width: '2px',
            height: '4px',
            backgroundColor: color,
            marginTop: `${(maxHeight - 4) / 2}px`,
          }}
        />
      ))}
      {/* Static Dots */}
      {Array.from({ length: dotCount }).map((_, i) => (
        <div
          key={`dot-${i}`}
          className="rounded-full"
          style={{
            width: '4px',
            height: '4px',
            backgroundColor: color,
            marginTop: `${(maxHeight - 4) / 2}px`,
          }}
        />
      ))}
    </div>
  );
}