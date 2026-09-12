/*
==================================================
  SLAYER TERMINAL - EARNINGS ENGINE (earnings.ts)
  The earnings hub's brain: for every upcoming
  report, price the implied move against realized
  history, weigh revisions, flow and technicals,
  and land on PLAY / FADE / SKIP with the strategy
  that matches the mispricing.
==================================================
*/

import { dayKey, hGauss, h01, hRange } from '../core/rng';
import { tickerSentiment } from './news';
import { UNIVERSE } from './universe';
import type { Sector } from './universe';

export type EarningsVerdict = 'PLAY' | 'FADE' | 'SKIP';
export type ReportSlot = 'BMO' | 'AMC';

export interface EarningsEvent {
  ticker: string;
  name: string;
  sector: Sector;
  price: number;
  /** Sessions until the report, 0 = today */
  daysOut: number;
  dateLabel: string;
  /** 1 = Monday … 5 = Friday (reports never land on weekends) */
  weekday: number;
  /** 0 = this calendar week, 1 = next — the calendar board's two pages */
  weekIdx: 0 | 1;
  /** true = company has officially set the date; false = still an analyst estimate */
  confirmed: boolean;
  slot: ReportSlot;
  /** Straddle-implied move for the print, % */
  impliedMovePct: number;
  /** Average absolute move over the last 8 prints, % */
  histAvgMovePct: number;
  /** The last 8 earnings-day moves, signed %, oldest first — the receipts */
  pastMoves: { label: string; movePct: number }[];
  /** implied ÷ realized — the mispricing everything hangs on */
  richness: number;
  /** % of the last 8 quarters beaten */
  beatRate8q: number;
  /** −1…+1 — analyst estimate drift into the print */
  revisionTrend: number;
  ivRank: number;
  /** 0–100 setup quality into the report */
  technicalScore: number;
  /** −1…+1 — options flow lean into the event */
  flowLean: number;
  verdict: EarningsVerdict;
  strategy: string;
  rationale: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Today rolled forward to the nearest trading day. */
function tradingToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

/** Advance N trading sessions from (trading) today — weekends never count. */
function tradingDate(sessionsOut: number): Date {
  const d = tradingToday();
  let left = sessionsOut;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  return d;
}

function mondayOf(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.getTime();
}

function labelFor(d: Date): string {
  return `${DAY_NAMES[d.getDay()]} ${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

/** The calendar date of a board cell — the week list needs the real day to
    seat the macro calendar beside the reports (2026-09-03). */
export function weekDayDate(weekIdx: 0 | 1, weekday: number): Date {
  const today = tradingToday();
  return new Date(mondayOf(today) + weekIdx * 7 * 86400000 + (weekday - 1) * 86400000);
}

/** Column header for the week board — date math stays in one module. */
export function weekDayLabel(weekIdx: 0 | 1, weekday: number): { label: string; isToday: boolean } {
  const today = tradingToday();
  const d = weekDayDate(weekIdx, weekday);
  return { label: labelFor(d), isToday: d.getTime() === today.getTime() };
}

/** "Q2'26"-style labels for the last N quarters, oldest first. */
function quarterLabels(count: number): string[] {
  const now = new Date();
  let q = Math.floor(now.getMonth() / 3) + 1;
  let y = now.getFullYear() % 100;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.unshift(`Q${q}'${String(y).padStart(2, '0')}`);
    q -= 1;
    if (q === 0) {
      q = 4;
      y -= 1;
    }
  }
  return out;
}

/** Eight signed earnings-day moves whose average magnitude IS histAvgMovePct —
    the chart and the number can never disagree. */
function pastMovesFor(seed: (tag: string) => string, histAvg: number): { label: string; movePct: number }[] {
  const labels = quarterLabels(8);
  const raw = labels.map((_, i) => {
    const mag = 0.35 + h01(seed(`pm-${i}`)) * 1.3;
    const sign = h01(seed(`pmd-${i}`)) > 0.45 ? 1 : -1;
    return mag * sign;
  });
  const meanAbs = raw.reduce((a, v) => a + Math.abs(v), 0) / raw.length;
  const scale = histAvg / Math.max(meanAbs, 0.01);
  return labels.map((label, i) => ({ label, movePct: Number((raw[i] * scale).toFixed(1)) }));
}

function decide(e: Omit<EarningsEvent, 'verdict' | 'strategy' | 'rationale'>): Pick<EarningsEvent, 'verdict' | 'strategy' | 'rationale'> {
  const im = e.impliedMovePct.toFixed(1);
  const hm = e.histAvgMovePct.toFixed(1);
  const rich = e.richness;

  // Directional edge: do revisions, flow and the chart agree?
  const dirScore =
    (e.revisionTrend > 0.15 ? 1 : e.revisionTrend < -0.15 ? -1 : 0) +
    (e.flowLean > 0.2 ? 1 : e.flowLean < -0.2 ? -1 : 0) +
    (e.technicalScore >= 62 ? 1 : e.technicalScore <= 40 ? -1 : 0);

  // States, not orders: the strings DESCRIBE the pricing and the sleeves —
  // they never name instruments or tell anyone what to do. The verdict enum
  // stays internal loop-scoring vocabulary.
  if (rich >= 1.3) {
    if (Math.abs(dirScore) >= 3) {
      const up = dirScore > 0;
      return {
        verdict: 'PLAY',
        strategy: `Premium is rich AND every sleeve leans ${up ? 'up' : 'down'} together — the rare print where pricing and story both say something.`,
        rationale: `Implied ${im}% vs ${hm}% realized (${rich.toFixed(2)}×) is expensive, but revisions, flow and the chart all point the same way — direction has unanimous support here.`,
      };
    }
    return {
      verdict: 'FADE',
      strategy: `The straddle charges ${im}% for a name that averages ${hm}% — the surprise is already paid for.`,
      rationale: `${rich.toFixed(2)}× realized history, with a ${e.beatRate8q}% beat rate the street already knows. The pricing is the story on this one, not the direction.`,
    };
  }

  if (rich <= 0.85) {
    return {
      verdict: 'PLAY',
      strategy: `Implied ${im}% under-prices an ${hm}% average mover — volatility is on sale into this print.`,
      rationale: `Rare setup: the market is charging less than this name historically moves (${rich.toFixed(2)}×). ${
        e.beatRate8q >= 60
          ? `A ${e.beatRate8q}% beat rate adds a directional skew on top.`
          : 'Direction is unclear — the print itself will pick a side.'
      }`,
    };
  }

  if (Math.abs(dirScore) >= 2) {
    const up = dirScore > 0;
    // Describe each sleeve as it actually is — the BALANCE leans, not
    // necessarily all three (the old copy could say "up" beside a -12).
    const rev =
      e.revisionTrend > 0.15
        ? `analyst estimates drifting up (+${(e.revisionTrend * 100).toFixed(0)})`
        : e.revisionTrend < -0.15
          ? `analyst estimates drifting down (${(e.revisionTrend * 100).toFixed(0)})`
          : 'analyst estimates flat';
    const flow =
      e.flowLean > 0.2 ? 'options flow accumulating' : e.flowLean < -0.2 ? 'options flow distributing' : 'options flow quiet';
    return {
      verdict: 'PLAY',
      strategy: `Premium is fair at ${rich.toFixed(2)}× — the story here is directional: the balance of revisions, flow and the chart leans ${up ? 'up' : 'down'}.`,
      rationale: `${rev[0].toUpperCase()}${rev.slice(1)}, ${flow}, chart setup ${
        e.technicalScore >= 62 ? 'constructive' : e.technicalScore <= 40 ? 'heavy' : 'mixed'
      } — the balance leans ${up ? 'up' : 'down'} while pricing stays neutral.`,
    };
  }

  return {
    verdict: 'SKIP',
    strategy: `Fair premium and disagreeing sleeves — no mispricing into this print.`,
    rationale: `${rich.toFixed(2)}× with the directional sleeves split — nothing here argues louder than the day-two reaction will.`,
  };
}

// ---- per-company dossier ----------------------------------------------------

export interface EarningsQuarter {
  label: string;
  epsEst: number;
  epsActual: number;
  epsBeat: boolean;
  revEstB: number;
  revActualB: number;
  revBeat: boolean;
  /** The stock's move the session after that report, signed % */
  movePct: number;
}

/** One of the name's busiest contracts into the print — market FACT, not an
    idea. The old ContractIdea carried a "why" argument per contract, which
    read as us telling people what to enter (Noah, 2026-08-19: "this is not a
    gambling service... we simply provide information like bloomberg"). */
export interface ActiveContract {
  id: string;
  right: 'CALL' | 'PUT';
  strike: number;
  /** "GS $500 call · exp 07/25" */
  label: string;
  /** Rough mid, dollars per share */
  mid: number;
  volume: number;
  oi: number;
  volOverOi: number;
  ivPct: number;
  /** Strike distance from spot, signed % */
  fromSpotPct: number;
  /** Move needed by expiry to break even on the mid, % */
  breakevenPct: number;
}

export interface EarningsDossier {
  event: EarningsEvent;
  quarters: EarningsQuarter[];
  /** Market-implied odds the stock closes inside the priced band, % */
  probInsidePct: number;
  probBeyondPct: number;
  /** Direction skew from flow + revisions, % chance the move is up */
  probUpPct: number;
  /** Typical overnight IV deflation after this name reports, % */
  ivCrushPct: number;
  /** Extrinsic value an ATM option typically loses by next open, % */
  premiumLostPct: number;
  /** The 3 busiest calls on the name into the print, by volume */
  activeCalls: ActiveContract[];
  /** The 3 busiest puts */
  activePuts: ActiveContract[];
}

function roundStrike(px: number, offPct: number): number {
  const step = px > 400 ? 5 : px > 120 ? 2.5 : px > 40 ? 1 : 0.5;
  return Math.round((px * (1 + offPct / 100)) / step) * step;
}

/**
 * @param tick The dossier page's 10s scan counter. Everything structural
 * (event, quarters, strikes, OI) ignores it; the actives' VOLUME grows
 * monotonically with it — a session accumulates, it never gives volume back —
 * and mid/IV wobble gently. OI stays put: open interest only updates
 * overnight, and pretending otherwise would be the tell that this is fake.
 */
export function buildEarningsDossier(ticker: string, tick = 0): EarningsDossier | null {
  const event = buildEarningsCalendar().find(e => e.ticker === ticker.toUpperCase());
  if (!event) return null;

  const day = dayKey();
  const s = (tag: string) => `${event.ticker}-${day}-erd-${tag}`;
  const im = event.impliedMovePct;
  const px = event.price;

  // ---- beats & misses: which quarters beat is pinned to the beat rate ------
  const beats = Math.round((event.beatRate8q / 100) * 8);
  const order = event.pastMoves
    .map((_, i) => ({ i, k: h01(s(`bo-${i}`)) }))
    .sort((a, b) => b.k - a.k)
    .map(x => x.i);
  const beatSet = new Set(order.slice(0, beats));

  const epsBase = Math.max(0.2, px / 28);
  const revBase = Math.max(0.8, px * 0.085);
  const quarters: EarningsQuarter[] = event.pastMoves.map((pm, i) => {
    const growth = 1 + i * 0.015;
    const epsEst = epsBase * growth * (0.92 + h01(s(`ee-${i}`)) * 0.16);
    const epsBeat = beatSet.has(i);
    const epsActual = epsEst * (epsBeat ? 1 + 0.015 + h01(s(`ea-${i}`)) * 0.1 : 1 - 0.005 - h01(s(`ea-${i}`)) * 0.07);
    const revEstB = revBase * growth * (0.95 + h01(s(`re-${i}`)) * 0.1) * 0.01;
    const revBeat = h01(s(`rb-${i}`)) > 0.3 ? epsBeat : !epsBeat; // mostly correlated
    const revActualB = revEstB * (revBeat ? 1 + 0.005 + h01(s(`ra-${i}`)) * 0.04 : 1 - 0.002 - h01(s(`ra-${i}`)) * 0.03);
    return {
      label: pm.label,
      epsEst: Number(epsEst.toFixed(2)),
      epsActual: Number(epsActual.toFixed(2)),
      epsBeat,
      revEstB: Number((revEstB * 100).toFixed(2)),
      revActualB: Number((revActualB * 100).toFixed(2)),
      revBeat,
      movePct: pm.movePct,
    };
  });

  // ---- probabilities --------------------------------------------------------
  const probInsidePct = Math.round(65 + h01(s('pin')) * 6);
  const probUpPct = Math.round(Math.max(32, Math.min(68, 50 + event.flowLean * 14 + event.revisionTrend * 10)));

  // ---- IV crush -------------------------------------------------------------
  const ivCrushPct = Math.round(25 + event.ivRank * 0.22 + h01(s('crush')) * 8);
  const premiumLostPct = Math.round(ivCrushPct * (0.72 + h01(s('kept')) * 0.16));

  // ---- most active contracts ------------------------------------------------
  // Information, not ideas (Noah, 2026-08-19): the 3 busiest calls and 3
  // busiest puts by volume, with only market facts on them. ATM trades
  // heaviest; activity decays with distance from spot.
  const expiryLabel = weekDayLabel(event.weekIdx, 5).label.slice(4); // "07/25"
  const straddleCost = (px * im) / 100;

  const mkActive = (right: 'CALL' | 'PUT', distPct: number, seed: string): ActiveContract => {
    const strike = roundStrike(px, distPct);
    const away = Math.abs(distPct);
    const decay = Math.exp(-away / (im * 0.9));
    const base = 9000 + px * 16;
    // Session accumulation: starts the view at ~55% of the day's pace and
    // creeps up every scan — monotonic, per-contract rate.
    const grow = 0.55 + 0.45 * (1 - Math.exp(-tick / 60)) + tick * 0.0018 * (0.6 + h01(s(`agr-${seed}`)) * 0.8);
    const dayVolume = Math.round(base * decay * (0.65 + h01(s(`av-${seed}`)) * 0.7));
    const volume = Math.round(dayVolume * grow);
    const oi = Math.round(dayVolume * (1.1 + h01(s(`ao-${seed}`)) * 2.4));
    const phase = h01(s(`aph-${seed}`)) * Math.PI * 2;
    const mid = Math.max(
      0.05,
      straddleCost * (0.52 * Math.exp(-away / (im * 0.75)) + 0.02) * (1 + 0.025 * Math.sin(tick * 0.6 + phase))
    );
    const breakevenPct = away + (mid / px) * 100;
    const ivPct = Math.round(im * 4.4 * (0.88 + h01(s(`ai-${seed}`)) * 0.28) + 1.5 * Math.sin(tick * 0.5 + phase));
    return {
      id: `${right}-${strike}`,
      right,
      strike,
      label: `${event.ticker} $${strike} ${right.toLowerCase()} · exp ${expiryLabel}`,
      mid: Number(mid.toFixed(2)),
      volume,
      oi,
      volOverOi: Number((volume / oi).toFixed(2)),
      ivPct,
      fromSpotPct: Number((((strike - px) / px) * 100).toFixed(1)),
      breakevenPct: Number(breakevenPct.toFixed(1)),
    };
  };

  const activeCalls = [0, im * 0.5, im * 1.0]
    .map((dPct, i) => mkActive('CALL', dPct, `c${i}`))
    .sort((a, b) => b.volume - a.volume);
  const activePuts = [0, -im * 0.5, -im * 1.0]
    .map((dPct, i) => mkActive('PUT', dPct, `p${i}`))
    .sort((a, b) => b.volume - a.volume);

  return {
    event,
    quarters,
    probInsidePct,
    probBeyondPct: 100 - probInsidePct,
    probUpPct,
    ivCrushPct,
    premiumLostPct,
    activeCalls,
    activePuts,
  };
}

const REPORT_COUNT = 14;

export function buildEarningsCalendar(): EarningsEvent[] {
  const day = dayKey();
  // Deterministically choose which names report in the window
  const reporters = [...UNIVERSE]
    .map(u => ({ u, k: h01(`${u.ticker}-${day}-er-pick`) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, REPORT_COUNT)
    .map(x => x.u);

  return reporters
    .map(u => {
      const s = (tag: string) => `${u.ticker}-${day}-er-${tag}`;
      const daysOut = Math.floor(h01(s('d')) * 10);
      const reportDate = tradingDate(daysOut);
      const weekIdx: 0 | 1 = mondayOf(reportDate) === mondayOf(tradingToday()) ? 0 : 1;
      const histAvgMovePct = hRange(s('hist'), 2.2, 9.5) * (0.7 + u.beta * 0.35);
      const richness = hRange(s('rich'), 0.7, 1.75);
      const impliedMovePct = histAvgMovePct * richness;
      const base = {
        ticker: u.ticker,
        name: u.name,
        sector: u.sector,
        price: u.px,
        daysOut,
        dateLabel: labelFor(reportDate),
        weekday: ((reportDate.getDay() + 6) % 7) + 1,
        weekIdx,
        // Near-dated reports are officially confirmed; the further out, the more
        // likely the date is still an analyst estimate. Deterministic per name.
        confirmed: daysOut <= 2 ? true : h01(s('confirm')) < (daysOut <= 4 ? 0.78 : daysOut <= 6 ? 0.5 : 0.3),
        slot: (h01(s('slot')) > 0.45 ? 'AMC' : 'BMO') as ReportSlot,
        impliedMovePct,
        histAvgMovePct,
        pastMoves: pastMovesFor(s, histAvgMovePct),
        richness,
        beatRate8q: Math.round(hRange(s('beat'), 25, 95) / 12.5) * 12.5,
        revisionTrend: Math.max(-1, Math.min(1, hGauss(s('rev')) * 0.45 + tickerSentiment(u.ticker) * 0.4)),
        ivRank: Math.round(hRange(s('ivr'), 35, 96)),
        technicalScore: Math.round(hRange(s('tech'), 22, 92)),
        flowLean: Math.max(-1, Math.min(1, hGauss(s('flow')) * 0.5)),
      };
      return { ...base, ...decide(base) };
    })
    .sort((a, b) => a.daysOut - b.daysOut || b.impliedMovePct - a.impliedMovePct);
}
