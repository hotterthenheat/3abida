/*
==================================================
  SLAYER TERMINAL - REVIEW · THE SHAPE OF A TRADE
  (data/review/shape.ts)

  Noah, 2026-09-29, with a radar of six account
  figures beside the journal's "While you held it":
  "can you turn this section of the journal analysis
  into the hexogram look? … a cooler hexogram."

  Six reads of ONE trade, each a share from nothing
  to whole, so a trade has a shape — and the reader's
  trades together have a usual shape to hold it
  against. Nothing here is a grade of ours: these
  are the reader's own numbers about their own trade
  ([[no-public-grades]] does not reach the journal),
  and every axis says its figure and its sentence in
  plain words.

    KEPT    of the best it was up, what was taken
            (the excursion's `kept`)
    HEAT    how much of the risk it sat through at
            its worst — whole when it was never under
    RESULT  what it made against what was at risk:
            R where a stop set one, else against the
            cost or the trade's own reach
    ENTRY   how much of the name's run lay AHEAD of
            the way in — in at the low of an up-run
            is whole
    PLAN    the ways out that rode it (a stop, a
            target), how it ended, and what the
            reader said about the plan
    WORDS   what the reader wrote: the three
            questions and the tags

  The usual: the same six, averaged over a cut of the
  reader's trades — drawn behind the trade's shape.
==================================================
*/

import { ENDED, directionOf, entryOf, type JournalEntry, type JournalRow } from './journal';
import { excursionOf, type Excursion } from './excursion';
import { pct, rWords, usd, usdSigned } from '../../components/review/words';

export type ShapeKey = 'kept' | 'heat' | 'result' | 'entry' | 'plan' | 'words';
export const SHAPE_KEYS: ShapeKey[] = ['kept', 'heat', 'result', 'entry', 'plan', 'words'];
export const SHAPE_LABEL: Record<ShapeKey, string> = { kept: 'Kept', heat: 'Heat', result: 'Result', entry: 'Entry', plan: 'Plan', words: 'Words' };
/** What each axis asks, in one line */
export const SHAPE_ASKS: Record<ShapeKey, string> = {
  kept: 'Of the best it was up, what you took',
  heat: 'How much of the risk it sat through at its worst',
  result: 'What it made against what was at risk',
  entry: "How much of the name's run lay ahead of the way in",
  plan: 'The ways out that rode it, and how it ended',
  words: 'What you wrote about it',
};

export interface ShapeAxis {
  key: ShapeKey;
  /** Nothing to whole, 0..1 */
  value: number;
  /** The figure, short — under the axis's name */
  figure: string;
  /** The sentence — the card's */
  words: string;
}
export interface TradeShape {
  axes: ShapeAxis[];
  /** How much of the whole hexagon the shape fills, 0..1 — for words, never a digit */
  area: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function shapeOf(r: JournalRow, ex: Excursion, entry: JournalEntry): TradeShape {
  const t = r.t;
  const pnl = t.pnl;
  const best = Math.max(0, ex.best.pnl);
  const worstAbs = Math.max(0, -ex.worst.pnl);
  /* what was at risk: an option's cost (its 1R) — or, with nothing paid, the trade's own reach */
  const risk = r.t.cost;
  const hasRisk = risk != null && risk > 0;
  const base = hasRisk ? (risk as number) : Math.max(1, best, worstAbs, Math.abs(pnl));
  const riskWord = hasRisk ? 'what it cost' : 'its own reach';

  /* KEPT */
  const keptV = best > 0 ? clamp01(ex.kept ?? 0) : 0;
  const kept: ShapeAxis = {
    key: 'kept',
    value: keptV,
    figure: best > 0 ? (pnl > 0 ? pct(keptV) : 'none') : 'never up',
    words: best > 0 ? (pnl > 0 ? `took ${usd(pnl, 0)} of the ${usd(best, 0)} it was up at its best` : `up ${usd(best, 0)} at its best · none of it kept`) : 'it was never up',
  };
  /* HEAT */
  const heatShare = clamp01(worstAbs / base);
  const heat: ShapeAxis = {
    key: 'heat',
    value: 1 - heatShare,
    figure: worstAbs > 0 ? usdSigned(-worstAbs, 0) : 'never under',
    words: worstAbs > 0 ? `the worst it was down was ${usd(worstAbs, 0)} · ${pct(heatShare)} of ${riskWord}` : 'never under water',
  };
  /* RESULT */
  const rr = t.r;
  const result: ShapeAxis =
    rr != null && hasRisk
      ? { key: 'result', value: clamp01((rr + 1) / 3), figure: rWords(rr), words: `${rWords(rr)} · ${usdSigned(pnl, 0)} against ${riskWord}` }
      : { key: 'result', value: clamp01((pnl / base + 1) / 2), figure: usdSigned(pnl, 0), words: `${usdSigned(pnl, 0)} · ${pct(Math.abs(pnl) / base)} of ${riskWord}` };
  /* ENTRY */
  const names = ex.points.map(p => p.name).filter(v => Number.isFinite(v));
  const spotIn = r.t.spotIn;
  let entryAxis: ShapeAxis = { key: 'entry', value: 0.5, figure: '—', words: 'no path to read the way in against' };
  if (names.length > 1) {
    const lo = Math.min(spotIn, ...names);
    const hi = Math.max(spotIn, ...names);
    const range = hi - lo;
    if (range > 0) {
      const v = clamp01(directionOf(r) === 'up' ? (hi - spotIn) / range : (spotIn - lo) / range);
      entryAxis = {
        key: 'entry',
        value: v,
        figure: pct(v),
        words: v >= 0.95 ? 'in at the best end of its run' : v <= 0.05 ? 'in at the worst end of its run' : `${pct(v)} of the name's run lay ahead of the way in`,
      };
    }
  }
  /* PLAN */
  const stopRode = !!ex.stop || ex.stops.length > 0;
  const targetRode = !!ex.target || ex.targets.length > 0;
  const how: string = t.how;
  const byPlan = how === 'target' || how === 'stopped' || how === 'scaled' || how === 'rule';
  let planV = (stopRode ? 0.4 : 0) + (targetRode ? 0.3 : 0) + (byPlan ? 0.3 : 0);
  if (entry.plan === 'yes') planV = Math.max(planV, 0.7);
  if (entry.plan === 'no') planV = Math.min(planV, 0.3);
  const rode = [stopRode ? 'a stop' : '', targetRode ? 'a target' : ''].filter(Boolean).join(' and ');
  /* the figure follows the value: a tag that lifted or cut it is what the axis shows */
  const rodeFigure = stopRode && targetRode ? 'stop + target' : stopRode ? 'stop' : targetRode ? 'target' : 'no ways out';
  const plan: ShapeAxis = {
    key: 'plan',
    value: planV,
    figure: entry.plan === 'yes' && !rode ? 'followed' : entry.plan === 'no' ? 'not followed' : rodeFigure,
    words: `${rode ? `${rode} rode it` : 'no way out rode it'} · ${ENDED[t.how].toLowerCase()}${entry.plan ? ` · the plan was ${entry.plan === 'yes' ? 'followed' : 'not followed'}, you said` : ''}`,
  };
  /* WORDS */
  const answered = [entry.why, entry.saw, entry.again].filter(w => (w ?? '').trim()).length;
  const tagged = !!entry.setup || (entry.mistakes?.length ?? 0) > 0 || !!entry.plan;
  const words: ShapeAxis = {
    key: 'words',
    value: (answered + (tagged ? 1 : 0)) / 4,
    figure: `${answered} of 3`,
    words: `${answered} of 3 questions answered${tagged ? ' · tagged' : ' · no tags yet'}`,
  };

  const axes = [kept, heat, result, entryAxis, plan, words];
  const vs = axes.map(a => a.value);
  const area = vs.reduce((s, v, i) => s + v * vs[(i + 1) % vs.length], 0) / vs.length;
  return { axes, area };
}

/** The reader's usual shape over a cut of their trades — null under two trades, where "usual" says nothing */
export function usualShape(rows: JournalRow[]): number[] | null {
  if (rows.length < 2) return null;
  const sums = SHAPE_KEYS.map(() => 0);
  for (const r of rows) shapeOf(r, excursionOf(r), entryOf(r)).axes.forEach((a, i) => (sums[i] += a.value));
  return sums.map(v => v / rows.length);
}

/** This trade against the usual: the axes it stands clearly above, and clearly under */
export function againstUsual(shape: TradeShape, usual: number[] | null): { above: ShapeKey[]; below: ShapeKey[] } {
  if (!usual) return { above: [], below: [] };
  const above: ShapeKey[] = [];
  const below: ShapeKey[] = [];
  shape.axes.forEach((a, i) => {
    const d = a.value - usual[i];
    if (d >= 0.12) above.push(a.key);
    else if (d <= -0.12) below.push(a.key);
  });
  return { above, below };
}
