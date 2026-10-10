/*
==================================================
  SLAYER TERMINAL - PAPER · THE POSITION ON ITS CHART'S FOOT
  (components/paper/PositionBar.tsx)

  The partner's position bar (Noah liked it: "see your
  equity in real time"), in the house's floating-card
  grammar — the replay bar's place at the foot of the
  price pane (PaneFoot), where a live desk has no clock
  to show. A line a position of the chart's own name:
  what it is, where it came in and where it is now, what
  it is up or down, WHERE IT BREAKS EVEN (fees both ways
  in), the target and the stop riding it with the reward
  to the risk — and the hand a trader reaches for there:
  Close. (Reverse went with the futures, 2026-09-30 —
  a long option has no other way to be turned.) Two
  lines at the most; the rest are in the book.

  The chip on the chart's line (PositionLayer) still says
  what it is up or down beside the price; this is the
  whole of it, in one place, without a pointer.
==================================================
*/

import { X } from 'lucide-react';
import { dirInk, rWords, usdSigned } from '../review/words';

export interface BarLine {
  key: string;
  /** "1 × SPY 495C" */
  label: string;
  tone: 'bull' | 'bear';
  /** The figures, in order: in at, now, breaks even, the ways out, reward to risk */
  facts: { label: string; value: string; ink?: string }[];
  pnl: number;
  r: number | null;
  onClose: () => void;
  /** Why the hands wait (another tab holds the account, the account is closed) */
  locked?: string | null;
}

const MAX_LINES = 2;

const PositionBar = ({ lines }: { lines: BarLine[] }) => {
  if (!lines.length) return null;
  const shown = lines.slice(0, MAX_LINES);
  const rest = lines.length - shown.length;
  return (
    <div className="inline-flex flex-col gap-1 pointer-events-auto max-w-full" data-paper-position-bar={lines.length}>
      {shown.map(l => (
        <div key={l.key} className="inline-flex items-center gap-3 h-8 pl-1.5 pr-1.5 max-w-full overflow-hidden rounded-lg border border-borderMuted bg-panel/80 backdrop-blur-md backdrop-saturate-150 shadow-[0_8px_24px_rgba(0,0,0,0.35)] font-mono text-[10px] tnum whitespace-nowrap" data-paper-position-line={l.key}>
          <span className={`shrink-0 h-5 px-1.5 inline-flex items-center rounded font-bold text-[11px] ${l.tone === 'bull' ? 'bg-bull/[0.14] text-bull' : 'bg-bear/[0.14] text-bear'}`}>{l.label}</span>
          <span className={`shrink-0 text-[12px] font-semibold ${dirInk(l.pnl)}`}>
            {usdSigned(l.pnl)} {l.r != null && <span className="text-[10px] font-normal text-textSecondary">{rWords(l.r)}</span>}
          </span>
          {/* the facts give way first, and on a phone stay in the book — Close is never cut (the audit's PR-15: "× Cl") */}
          <span className="min-w-0 flex-1 inline-flex items-center gap-3 overflow-hidden max-sm:hidden">
            {l.facts.map(f => (
              <span key={f.label} className="min-w-0 truncate">
                <span className="text-textMuted">{f.label}</span> <span className={f.ink ?? 'text-textPrimary'}>{f.value}</span>
              </span>
            ))}
          </span>
          <span className="ml-1 inline-flex items-center gap-1 shrink-0">
            <button type="button" onClick={l.onClose} disabled={!!l.locked} title={l.locked ?? 'Close all of it at the market — what is working on it goes first'} className="hit inline-flex items-center gap-1 h-6 px-2 rounded-md border border-borderSubtle text-textSecondary hover:text-bear hover:border-bear/50 disabled:opacity-30 transition-colors" data-paper-bar-close={l.key}>
              <X className="w-3 h-3" /> Close
            </button>
          </span>
        </div>
      ))}
      {rest > 0 && <span className="self-start px-2 h-5 inline-flex items-center rounded border border-borderSubtle bg-panel/80 font-mono text-[10px] text-textMuted">+{rest} more in the book</span>}
    </div>
  );
};

export default PositionBar;
