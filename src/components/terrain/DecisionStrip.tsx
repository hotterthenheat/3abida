/*
  THE DECISION STRIP (the Terrain UI pass, 2026-10-14 — the owner: "a trader answers five questions in under 2 seconds
  without hovering"): five small boxes under the header — Regime, Nearest levels, Priced move, Track record, Freshness —
  each one line of the pane's own figures, and each a door that opens the ladder's "How sure" card at its own section.
  The words are the host's (every figure comes from what the pane already computes); this lays them out by the
  column's width — labelled, then figures alone, then the short words, then the short words on a second line — and
  never clips a figure: a box that would not fit two lines is left to How sure. Width in, content out: the estimate is
  the words' length at the row's type, never a rendered width.
*/
import { HowSureBook, type HowSureSection } from '../levels/HowSure';
import type { Sureness } from '../../data/levelSureness';

export interface DecisionBox {
  key: HowSureSection;
  label: string;
  /** The one line — "—" where the pane has no figure yet */
  words: string;
  /** The same read in fewer characters, for a narrow column */
  short: string;
  /** The hover's longer words */
  title: string;
  /** The leading word's ink: the puts' violet (amplify), the calls' gold (absorb), the warn ink; plain otherwise */
  tone?: 'puts' | 'calls' | 'warn' | null;
}

interface DecisionStripProps {
  boxes: DecisionBox[];
  sures: Sureness[];
  /** The row's usable width, px; 0 before the first measurement (everything draws, labelled) */
  room: number;
  className?: string;
}

/* the row's type: 11 px mono at ~6.6 px a character; a box's padding and border 14, the gap between boxes 6 */
const CH = 6.6;
const PAD = 14;
const GAP = 6;
const LINE_H = 20;
const boxPx = (text: string, label: string | null) => Math.ceil(text.length * CH + PAD + (label ? label.length * CH + 6 : 0));

const toneClass = (t: DecisionBox['tone']) => (t === 'puts' ? 'text-[rgb(var(--amplify))]' : t === 'calls' ? 'text-[rgb(var(--absorb))]' : t === 'warn' ? 'text-warn' : 'text-textPrimary');

/** First-fit packing of the boxes into lines of `room`, in order — the lines each box lands on, or -1 past `maxLines` */
const pack = (widths: number[], room: number, maxLines: number): number[] => {
  const lines: number[] = [];
  let line = 0;
  let used = 0;
  for (const w of widths) {
    if (used > 0 && used + GAP + w > room) {
      line++;
      used = 0;
    }
    if (line >= maxLines) {
      lines.push(-1);
      continue;
    }
    used += (used > 0 ? GAP : 0) + w;
    lines.push(line);
  }
  return lines;
};

const DecisionStrip = ({ boxes, sures, room, className = '' }: DecisionStripProps) => {
  const sum = (f: (b: DecisionBox) => number) => boxes.reduce((s, b) => s + f(b), 0) + GAP * (boxes.length - 1);
  const form: 'labelled' | 'figures' | 'short' | 'wrap' = room === 0 || sum(b => boxPx(b.words, b.label)) <= room ? 'labelled' : sum(b => boxPx(b.words, null)) <= room ? 'figures' : sum(b => boxPx(b.short, null)) <= room ? 'short' : 'wrap';
  const labelled = form === 'labelled';
  const text = (b: DecisionBox) => (form === 'labelled' || form === 'figures' ? b.words : b.short);
  const placed = form === 'wrap' ? pack(boxes.map(b => boxPx(b.short, null)), room, 2) : boxes.map(() => 0);
  const shown = boxes.filter((_, i) => placed[i] >= 0);
  if (!shown.length) return null;
  const lines = Math.max(...placed) + 1;
  return (
    <div
      className={`pointer-events-none select-none flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0 ${className}`}
      style={{ maxHeight: lines * LINE_H + (lines - 1) * 2, overflow: 'hidden' }}
      role="group"
      aria-label="The pane's five reads"
      data-decision-strip
      data-decision-form={form}
      data-decision-lines={lines}
    >
      {shown.map(b => {
        const door = (
          <button
            type="button"
            title={`${b.label} · ${b.title} — opens How sure at this section`}
            aria-label={`${b.label}: ${b.words}. How sure, at this section`}
            className="hit pointer-events-auto inline-flex items-center gap-1.5 h-[20px] px-1.5 rounded-[3px] border border-ink/[0.10] bg-canvas/25 backdrop-blur-[3px] text-left whitespace-nowrap transition-colors hover:border-ink/[0.22] aria-expanded:border-silver/50"
            data-decision-box={b.key}
          >
            {labelled && <span className="font-mono text-[11px] text-textMuted">{b.label}</span>}
            <span className={`font-mono text-[11px] tnum ${toneClass(b.tone)}`} data-decision-words>
              {text(b)}
            </span>
          </button>
        );
        return <HowSureBook key={b.key} sures={sures} align="start" trigger={door} focus={b.key} />;
      })}
    </div>
  );
};

export default DecisionStrip;
