import React from 'react';
import { toneText, type Tone } from './tones';

interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Secondary line under the value (context, units, delta) */
  sub?: React.ReactNode;
  tone?: Tone;
  className?: string;
}

/** Compact data-first metric cell. */
const StatCard = ({ label, value, sub, tone = 'neutral', className = '' }: StatCardProps) => {
  return (
    <div className={`border border-borderSubtle bg-panel rounded-lg px-3.5 py-3 min-w-0 ${className}`}>
      <div className="font-mono text-[10px] uppercase tracking-widest text-textSecondary truncate">{label}</div>
      <div className={`mt-1.5 font-mono text-lg font-semibold leading-none ${toneText[tone]}`}>{value}</div>
      {sub && <div className="mt-1.5 text-[11px] text-textMuted leading-tight truncate">{sub}</div>}
    </div>
  );
};

export default StatCard;
