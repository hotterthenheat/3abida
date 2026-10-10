import React from 'react';
import { toneBadge, toneDot, type Tone } from './tones';

interface SignalBadgeProps {
  tone?: Tone;
  /** Render a small status dot before the label */
  dot?: boolean;
  pulse?: boolean;
  children: React.ReactNode;
  className?: string;
}

const SignalBadge = ({ tone = 'neutral', dot = false, pulse = false, children, className = '' }: SignalBadgeProps) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider ${toneBadge[tone]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${toneDot[tone]} ${pulse ? 'custom-pulse' : ''}`} />}
      {children}
    </span>
  );
};

export default SignalBadge;
