import React from 'react';

interface ProgressRingProps {
  /** Fill fraction 0–1. Values ≥ 1 are treated as complete (green ring). */
  progress: number;
  /** Outer diameter in px. Default 56. */
  size?: number;
  /** Stroke width in px. Default 4. */
  strokeWidth?: number;
  /** Icon/emoji rendered at the centre of the ring. */
  children: React.ReactNode;
}

export function ProgressRing({
  progress,
  size = 56,
  strokeWidth = 4,
  children,
}: ProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);
  const cx = size / 2;
  const cy = size / 2;
  const isReady = clamped >= 1;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* SVG ring sits behind the children */}
      <svg
        width={size}
        height={size}
        className="absolute inset-0"
        aria-hidden="true"
        focusable="false"
      >
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          className="text-farm-soil/50"
        />
        {/* Progress arc — starts at 12 o'clock via rotate(-90) */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          stroke="currentColor"
          className={isReady ? 'text-farm-grass' : 'text-farm-gold'}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.3s ease, color 0.2s ease' }}
        />
      </svg>

      {/* Centre content */}
      <div className="relative flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
