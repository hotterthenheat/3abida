/*
==================================================
  SLAYER TERMINAL - TARGETS, THE AGENDA (data/agenda.ts)

  The Targets page rebuilt on the numbers the other
  pages now produce (2026-09-08). A target is a
  strike, and the question the page answers is the
  one a trader asks at the open: which levels do I
  watch today, in what order?

  THE ORDER IS ONE SENTENCE: how likely price gets
  there × how much happens if it does.

    reach   the odds price touches the strike by the
            close — the expected move for the minutes
            left, priced the way a barrier is (wall.ts)
    stake   the dollars that move when it does: the
            hedging sitting at the strike (pushing back
            or pushing along) plus what a move through
            it forces dealers to trade on the way to the
            next shelf (the hedge-flow ladder), against
            what it takes to move this name 1% today

    matters = reach × stake / what moves the name 1%

  A wall two expected moves away outranks nothing; a
  thin strike at spot outranks nothing; a wall at
  0.3σ holding a market's worth of hedging with a
  pocket behind it leads the day. Everything else on
  the row is the other pages' answers for that strike
  — holds or breaks (At the wall), built or drained
  today (Building), the odds the close lands there
  (Ahead) — so the reader never has to leave the
  list to know what a level is.

  The old five-factor composite (rankedtargets.ts —
  gamma, open interest, volume, neighbours, distance
  on uncalibrated weights) is gone: the Pulse Targets
  panel reads this too, so a strike is #1 on the desk
  for the same reason it is #1 on Pinpoint.
==================================================
*/

import { buildCloseOdds, fmtDollars, fmtStrike, type AheadClock } from './ahead';
import { SHELF_SHARE } from './airPockets';
import { buildWallContext, oddsAt, type WallContext, type WallOdds, type WallRole, type WallSide } from './wall';
import type { Building, BuildVerdict } from './building';
import type { ExposureSurface } from './exposureSurface';
import type { ExposureProfileData } from '../types/gex';
import type { Candle, MarketSnapshot } from '../types/market';

/* ---- the orders --------------------------------------------------------------- */

export type AgendaOrder = 'matters' | 'nearest' | 'reached' | 'weakest' | 'biggest';

export const AGENDA_ORDERS: { value: AgendaOrder; label: string; hint: string }[] = [
  { value: 'matters', label: 'Matters most', hint: 'How likely price gets there × how much happens if it does' },
  { value: 'nearest', label: 'Nearest', hint: 'Closest to where price is now, first' },
  { value: 'reached', label: 'Most likely reached', hint: 'The odds price touches it by the close, highest first' },
  { value: 'weakest', label: 'Weakest wall', hint: 'The wall most likely to break when reached, first' },
  { value: 'biggest', label: 'Most at stake', hint: 'The most dollars moving if price gets there, first' },
];

/* ---- types ------------------------------------------------------------------------ */

export interface Target {
  /** In the chosen order, from 1 */
  rank: number;
  strike: number;
  side: WallSide;
  role: WallRole;
  pin: boolean;
  /** Hedging here pushes back. Else a trapdoor: it pushes the move along */
  isWall: boolean;
  /** Pushes back AND holds at least a third of the heaviest strike — a wall or a shelf,
      the wall board's own rule. A thinner absorbing strike is not a wall and gets no odds */
  isShelf: boolean;
  /** Signed, percent of spot */
  distancePct: number;
  distanceSigma: number;
  /** Odds price touches it by the close, 0..1 */
  reach: number;
  /** Odds it holds when reached, 0..1 — the floor for a trapdoor */
  hold: number;
  /** Dollars per 1% move at the strike: positive pushes back, negative pushes along */
  weight: number;
  weightEff: number;
  breakTo: number | null;
  breakFlow: number;
  pocket: boolean;
  holdTo: number | null;
  /** Today's change in the hedging here, dollars, and Building's word for it */
  build: number;
  verdict: BuildVerdict;
  /** Odds the close lands on this strike, percent — 0 outside the band the close can reach */
  closes: number;
  /** Dollars that move if price gets there */
  stake: number;
  /** reach × stake against what moves the name 1% — the rank */
  matters: number;
  /** One clause: why it sits where it does under the chosen order */
  why: string;
  /** One clause: what happens there */
  words: string;
  odds: WallOdds;
  /** THE ROW'S CARD (2026-09-09, the three facts worth taking from the partner's
      ranked page — the contracts behind the dollars, the neighbours, the driver):
      open interest at the strike, in contracts */
  oi: { calls: number; puts: number };
  /** The strike against the two beside it, in words: "stands 2.8× above 489 and 491" */
  beside: string;
  /** Which half of reach × stake carried the rank */
  driver: 'odds' | 'size' | 'both';
}

export const DRIVER_WORDS: Record<Target['driver'], string> = {
  odds: 'on odds more than size',
  size: 'on size more than odds',
  both: 'on odds and size alike',
};

export interface Agenda {
  ticker: string;
  spot: number;
  marketPer1Pct: number;
  sigmaLeft: number;
  inSession: boolean;
  order: AgendaOrder;
  /** Every strike in the window, in the chosen order */
  targets: Target[];
  /** The first three by what matters, whatever the order — the day's sentence */
  first: Target[];
  mostReached: Target | null;
  weakestWall: Target | null;
  closesNear: { strike: number; odds: number } | null;
  sentence: string;
}

/* ---- helpers --------------------------------------------------------------------- */

const pct = (v: number) => `${Math.round(v * 100)}%`;
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${fmtDollars(v)}`;
/** A wall in reach is one the day can plausibly get to */
const IN_REACH = 0.15;

const flowWords = (flow: number) => (flow === 0 ? '' : `, ${fmtDollars(flow)} of forced dealer ${flow > 0 ? 'buying' : 'selling'} on the way`);

function whyOf(t: Target, order: AgendaOrder, marketPer1Pct: number): string {
  const ratio = t.stake / Math.max(1, marketPer1Pct);
  switch (order) {
    case 'matters':
      return `${pct(t.reach)} reached × ${fmtDollars(t.stake)} at stake`;
    case 'nearest':
      return `${Math.abs(t.distancePct).toFixed(2)}% ${t.side === 'call' ? 'above' : 'below'} · ${t.distanceSigma.toFixed(1)}× the expected move`;
    case 'reached':
      return `${pct(t.reach)} reached · ${t.distanceSigma.toFixed(1)}× the expected move away`;
    case 'weakest':
      return t.isShelf ? `holds ${pct(t.hold)} when reached · ${pct(t.reach)} reached` : t.isWall ? 'too thin to be a wall' : 'a trapdoor — pushes the move along';
    case 'biggest':
      return `${fmtDollars(Math.abs(t.weight))} here + ${fmtDollars(Math.abs(t.breakFlow))} on the way through · ${ratio.toFixed(1)}× the market`;
  }
}

/** A strike against the strikes beside it — a spike is a sharper level than a step in a shelf */
function besideOf(strikes: readonly { strike: number; gex: { net: number } }[], i: number): string {
  const me = Math.abs(strikes[i].gex.net);
  const below = strikes[i - 1];
  const above = strikes[i + 1];
  const near = [below, above].filter((s): s is (typeof strikes)[number] => !!s);
  if (!near.length) return '';
  const heaviest = near.reduce((a, b) => (Math.abs(b.gex.net) > Math.abs(a.gex.net) ? b : a));
  const ratio = me / Math.max(1, Math.abs(heaviest.gex.net));
  const names = near.map(s => fmtStrike(s.strike)).join(' and ');
  if (ratio >= 2) return `stands ${ratio >= 10 ? ratio.toFixed(0) : ratio.toFixed(1)}× above ${names}`;
  if (ratio <= 0.5) return `in the shadow of ${fmtStrike(heaviest.strike)}, ${(1 / Math.max(ratio, 0.01)) >= 10 ? (1 / Math.max(ratio, 0.01)).toFixed(0) : (1 / Math.max(ratio, 0.01)).toFixed(1)}× heavier`;
  return `part of a shelf with ${names}`;
}

function wordsOf(o: WallOdds, shelf: boolean): string {
  const dir = o.side === 'call' ? 'above' : 'below';
  const to = o.breakPath.to;
  const run = to == null ? `no shelf behind it on the strikes shown` : `runs to ${fmtStrike(to)}${o.breakPath.pocket ? ' with almost nothing in between' : ''}${flowWords(o.breakPath.flow)}`;
  return shelf ? `holds ${pct(o.hold)} when reached; a break ${dir} ${run}` : o.weight > 0 ? `too thin to be a wall; a move ${dir} ${run}` : `a trapdoor — a move ${dir} through it ${run}`;
}

/* ---- the build ----------------------------------------------------------------- */

export function buildAgenda(
  snapshot: MarketSnapshot,
  profile: ExposureProfileData,
  building: Building,
  surface: ExposureSurface | null,
  bars: readonly Candle[],
  clock: AheadClock,
  iv: number,
  order: AgendaOrder = 'matters'
): Agenda {
  const { ticker, spot } = snapshot;
  const ctx: WallContext = buildWallContext(snapshot, profile, building, surface, bars, clock, iv);
  const { marketPer1Pct, sigmaLeft } = ctx;
  /* Where the close lands, on the same expected move the reach odds use — the
     two questions (touch vs close) never disagree on the ruler */
  const close = buildCloseOdds(profile, spot, sigmaLeft, clock);
  const closesAt = new Map(close.rows.map(r => [r.strike, r.odds]));
  const buildAt = new Map(building.rows.map(r => [r.strike, r]));
  const nodeAt = new Map(snapshot.chain.map(n => [n.strike, n]));
  const asc = [...profile.strikes].sort((a, b) => a.strike - b.strike);

  const targets: Target[] = asc
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => Math.abs(s.strike - spot) > 1e-9)
    .map(({ s, i }) => {
      const o = oddsAt(s.strike, ctx);
      const stake = Math.abs(o.weight) + Math.abs(o.breakPath.flow);
      const brow = buildAt.get(s.strike);
      const node = nodeAt.get(s.strike);
      const isShelf = o.weight > 0 && (Math.abs(s.gex.net) >= SHELF_SHARE * ctx.heaviest || o.role != null);
      const t: Target = {
        rank: 0,
        strike: s.strike,
        side: o.side,
        role: o.role,
        pin: !!s.pin,
        isWall: o.weight > 0,
        isShelf,
        distancePct: ((s.strike - spot) / spot) * 100,
        distanceSigma: o.distanceSigma,
        reach: o.reach,
        hold: o.hold,
        weight: o.weight,
        weightEff: o.weightEff,
        breakTo: o.breakPath.to,
        breakFlow: o.breakPath.flow,
        pocket: !!o.breakPath.pocket,
        holdTo: o.holdPath.to,
        build: brow?.sizeChange ?? 0,
        verdict: brow?.verdict ?? 'steady',
        closes: closesAt.get(s.strike) ?? 0,
        stake,
        matters: (o.reach * stake) / Math.max(1, marketPer1Pct),
        why: '',
        words: wordsOf(o, isShelf),
        odds: o,
        oi: { calls: node?.callOI ?? 0, puts: node?.putOI ?? 0 },
        beside: besideOf(asc, i),
        driver: 'both',
      };
      return t;
    });
  /* THE DRIVER: each half of reach × stake against the window's best of it */
  const maxReach = Math.max(1e-9, ...targets.map(t => t.reach));
  const maxStake = Math.max(1, ...targets.map(t => t.stake));
  for (const t of targets) {
    const r = t.reach / maxReach;
    const s = t.stake / maxStake;
    t.driver = r >= s * 1.3 ? 'odds' : s >= r * 1.3 ? 'size' : 'both';
  }

  const byMatters = [...targets].sort((a, b) => b.matters - a.matters);
  const sorters: Record<AgendaOrder, (a: Target, b: Target) => number> = {
    matters: (a, b) => b.matters - a.matters,
    nearest: (a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct),
    reached: (a, b) => b.reach - a.reach || b.matters - a.matters,
    weakest: (a, b) => Number(b.isShelf) - Number(a.isShelf) || a.hold - b.hold || b.reach - a.reach,
    biggest: (a, b) => b.stake - a.stake,
  };
  const ordered = [...targets].sort(sorters[order]).map((t, i) => ({ ...t, rank: i + 1, why: whyOf(t, order, marketPer1Pct) }));

  const first = byMatters.slice(0, 3).map(t => ordered.find(x => x.strike === t.strike) ?? t);
  const mostReached = ordered.length ? ordered.reduce((a, b) => (b.reach > a.reach ? b : a)) : null;
  const wallsInReach = ordered.filter(t => t.isShelf && t.reach >= IN_REACH);
  const weakestWall = wallsInReach.length ? wallsInReach.reduce((a, b) => (b.hold < a.hold ? b : a)) : null;
  const closesNear = close.top[0] ? { strike: close.top[0].strike, odds: close.top[0].odds } : null;

  const lead = first[0];
  const sentence = lead
    ? `Watch ${fmtStrike(lead.strike)} first${lead.role ? `, the ${lead.role}` : ''}: reached ${pct(lead.reach)} of the time by ${clock.inSession ? 'the close' : 'the next close'}, ${lead.isShelf ? `holds ${pct(lead.hold)} when it is` : lead.isWall ? 'too thin to be a wall' : 'a trapdoor'}; a ${lead.isShelf ? 'break' : 'move'} ${lead.side === 'call' ? 'above' : 'below'} ${lead.breakTo != null ? `runs to ${fmtStrike(lead.breakTo)}${flowWords(lead.breakFlow)}` : 'has no shelf behind it'}.${
        first.length > 1 ? ` Then ${first.slice(1).map(t => fmtStrike(t.strike)).join(' and ')}.` : ''
      }`
    : 'No strikes on the window.';

  return { ticker, spot, marketPer1Pct, sigmaLeft, inSession: clock.inSession, order, targets: ordered, first, mostReached, weakestWall, closesNear, sentence };
}

/** Building's word for today's change at a strike, for the row */
export const buildWords = (t: Target, inSession: boolean): string =>
  t.verdict === 'steady' ? 'steady' : `${t.verdict === 'switched' ? 'changed sides' : t.verdict === 'new' ? 'new' : t.verdict} ${signed(t.build)}${inSession ? '' : ' last session'}`;
