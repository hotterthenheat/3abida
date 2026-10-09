/*
==================================================
  SLAYER TERMINAL - PAPER · THE DAY'S PACE
  (data/paper/pace.ts)

  A calm line, never a streak or a badge (the ideas of
  2026-10-09: "a calm '12 trades today; your usual is 4'
  line is the most the evidence supports"): how many
  ways in the reader has made this trading day against
  their own usual — the middle count of the trading days
  before it that had any. Said only when today runs well
  past the usual; nothing is refused, nothing is scored.
==================================================
*/

import type { PaperAccount } from './engine';

export interface Pace {
  today: number;
  usual: number;
}

/** Ways in a trading day (a buy that filled — every add counts once), across the reader's accounts */
function entriesByDay(accounts: PaperAccount[]): Map<string, number> {
  const by = new Map<string, number>();
  for (const a of accounts) for (const f of a.opt.fills) if (f.side === 'buy') by.set(f.at.day, (by.get(f.at.day) ?? 0) + 1);
  return by;
}

/** Today's count and the usual — null when there is too little history to have a usual (three days) or today is not past
    it by enough to say (twice the usual and three more) */
export function paceOf(accounts: PaperAccount[], day: string): Pace | null {
  const by = entriesByDay(accounts);
  const today = by.get(day) ?? 0;
  const before = [...by.entries()].filter(([d, n]) => d < day && n > 0).sort((x, y) => (x[0] < y[0] ? 1 : -1)).slice(0, 20).map(([, n]) => n).sort((x, y) => x - y);
  if (before.length < 3) return null;
  const mid = before.length / 2;
  const usual = Math.round(before.length % 2 ? before[Math.floor(mid)] : (before[mid - 1] + before[mid]) / 2);
  if (today < Math.max(usual * 2, usual + 3)) return null;
  return { today, usual };
}

/** "12 trades today; your usual is 4." */
export const paceWords = (p: Pace): string => `${p.today} trades today; your usual is ${p.usual}.`;
