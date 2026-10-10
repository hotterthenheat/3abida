/*
==================================================
  SLAYER TERMINAL - THE JOURNAL'S CUTS
  (components/review/JournalLanes.tsx)

  A card a way of cutting the period's trades — the hour
  they were opened, the weekday, the name, long or short,
  the size of the result (data/review/journalFigures.ts)
  — in the house's row grammar (the Map's ladder, not a
  chart): a row a lane, its bar what the lane made, green
  to the right of nothing and red to the left, the
  longest the card's biggest; or, for the sizes, how many
  trades it holds, in the ink of its side. The figure at
  the row's end, then how many.

  THE POINTER ON A ROW SAYS IT IN FULL at the card's foot
  (where the eye already is): what the lane is, how many
  closed and won, what it made, what a trade in it was
  worth. At rest the foot says the card's own line.
==================================================
*/

import { useState } from 'react';
import { card, headWord } from './DeskShell';
import { dirInk, pct, usdSigned } from './words';
import type { Lane } from '../../data/review/journalFigures';

interface Props {
  title: string;
  lanes: Lane[];
  /** What a bar measures: what the lane made (round nothing), or how many trades it holds (from the left) */
  measure?: 'net' | 'count';
  /** The foot's words while the pointer is on no row */
  rest: string;
  /** The label column's width — the sizes' words are longer than an hour's */
  labelW?: number;
  testId: string;
}

const JournalLanes = ({ title, lanes, measure = 'net', rest, labelW = 92, testId }: Props) => {
  const [over, setOver] = useState<string | null>(null);
  const biggest = Math.max(0, ...lanes.map(l => (measure === 'net' ? Math.abs(l.net) : l.n)));
  const lit = lanes.find(l => l.key === over) ?? null;
  const any = lanes.some(l => l.n > 0);
  return (
    <div className={`${card} flex flex-col min-w-0`} data-journal-lanes={testId}>
      <div className="px-5 pt-4 pb-2">
        <span className={headWord}>{title}</span>
      </div>
      <div className="py-1 flex-1" onPointerLeave={() => setOver(null)}>
        {!any ? (
          <div className="px-5 py-8 text-center font-mono text-[11px] text-textMuted">Nothing closed in this period</div>
        ) : (
          lanes.map(l => {
            const w = biggest > 0 ? ((measure === 'net' ? Math.abs(l.net) : l.n) / biggest) * 100 : 0;
            const on = l.key === over;
            return (
              <div
                key={l.key}
                onPointerEnter={() => setOver(l.key)}
                className={`grid items-center gap-3 h-8 px-5 transition-colors ${on ? 'bg-ink/[0.05]' : ''} ${l.n === 0 ? 'opacity-75' : ''}`}
                style={{ gridTemplateColumns: `minmax(0,${labelW}px) minmax(0,1fr) 68px 22px` }}
                data-journal-lane={l.key}
                data-n={l.n}
              >
                <span className={`font-mono text-[11px] truncate ${on ? 'text-textPrimary' : 'text-textSecondary'}`} title={l.hint}>
                  {l.label}
                </span>
                {measure === 'net' ? (
                  /* round nothing: made to the right, lost to the left */
                  <span className="relative h-2.5" aria-hidden="true">
                    <span className="absolute left-1/2 top-[-3px] bottom-[-3px] w-px bg-borderMuted" />
                    {l.n > 0 && l.net !== 0 && <span className={`absolute top-0 bottom-0 rounded-[2px] ${l.net > 0 ? 'left-1/2 bg-bull' : 'right-1/2 bg-bear'}`} style={{ width: `${w / 2}%`, opacity: on ? 1 : 0.8 }} />}
                  </span>
                ) : (
                  <span className="relative h-2.5 rounded-[2px] bg-ink/[0.04]" aria-hidden="true">
                    {l.n > 0 && <span className={`absolute left-0 top-0 bottom-0 rounded-[2px] ${l.tone === 'bear' ? 'bg-bear' : 'bg-bull'}`} style={{ width: `${w}%`, opacity: on ? 1 : 0.8 }} />}
                  </span>
                )}
                <span className={`font-mono text-[11px] font-semibold tnum text-right ${l.n ? dirInk(l.net) : 'text-textMuted'}`}>{l.n ? usdSigned(l.net, 0) : '—'}</span>
                <span className="font-mono text-[11px] tnum text-right text-textMuted" title={`${l.n} closed`}>
                  {l.n}
                </span>
              </div>
            );
          })
        )}
      </div>
      <div className="min-h-9 px-5 py-2 border-t border-borderSubtle/70 font-mono text-[11px] leading-snug tnum text-textMuted" data-journal-lanes-foot>
        {lit ? (
          lit.n ? (
            <>
              <span className="text-textPrimary">{lit.hint}</span> · {lit.n} closed · {lit.wins} won ({pct(lit.wins / lit.n)}) · <span className={dirInk(lit.net)}>{usdSigned(lit.net)}</span> · <span className={dirInk(lit.net)}>{usdSigned(lit.net / lit.n)}</span> a trade
            </>
          ) : (
            <>
              <span className="text-textPrimary">{lit.hint}</span> · nothing closed
            </>
          )
        ) : (
          rest
        )}
      </div>
    </div>
  );
};

export default JournalLanes;
