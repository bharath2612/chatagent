'use client';

import { useEffect, useRef } from 'react';

type VerticalDotWaveformProps = {
  active?: boolean;
  barCount?: number;
  dotCount?: number;
  color?: string;
  maxHeight?: number;
  className?: string;
};

export function VoiceWaveform({
  active = true,
  barCount = 25, // Number of animated bars
  dotCount = 0, // Number of dots
  color = '#ffffff', // White to match the image
  maxHeight = 20, // Reduced height to fit the design
  className = 'h-4'
}: VerticalDotWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const barsRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(animationRef.current);
      // Reset bars to minimal height when inactive
      barsRef.current.forEach(bar => {
        if (bar) bar.style.height = '4px';
      });
      return;
    }

    const animateBars = () => {
      const time = Date.now();

      barsRef.current.forEach((bar, index) => {
        if (!bar) return;

        // Vertical wave pattern for bars
        const wave1 = Math.sin(time / 500 + index * 0.3);
        const wave2 = Math.cos(time / 700 + index * 0.2) * 0.5;
        const wave3 = Math.sin(time / 300) * 0.3;

        const waveHeight = (wave1 + wave2 + wave3 + 1.5) / 3;
        const height = 4 + waveHeight * (maxHeight - 4); // Min 4px, max based on prop

        bar.style.height = `${height}px`;
        bar.style.marginTop = `${(maxHeight - height) / 2}px`; // Center vertically
      });

      animationRef.current = requestAnimationFrame(animateBars);
    };

    animationRef.current = requestAnimationFrame(animateBars);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [active, maxHeight]);

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
          className="transition-all duration-100 ease-out rounded-full"
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