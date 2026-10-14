/*
==================================================
  SLAYER TERMINAL - THE PRICED MOVE (data/feed/pricedMove.ts)

  WHAT THE OPTIONS PRICED FOR TODAY, AND HOW IT WENT
  (2026-10-13 — the owner's item 4: "implied ranges are
  the best-calibrated forward-looking object available";
  intraday vol has a strong time-of-day pattern, Andersen
  and Bollerslev 1997, "so a sqrt(clock-time) cone is
  wrong"; a hard-edged cone reads as safe and unsafe,
  Padilla, Kay and Hullman, "hence gradients and touch
  rates").

  Pure: the server's nightly job (server/pricedMove.ts)
  and the chart run these on the same numbers.

  THE DAY'S BUDGET is fixed at the prior close: 1σ_day is
  the at-the-money straddle for the expiry settling today,
  priced at the session before's 4:00 pm (server/
  pricedMove.ts says where each price came from), its
  vol solved at its strike and applied at the money on
  UW's clock (trailModel `sigmaOf` — straddle ÷ 0.798 when
  spot sits on a strike). Lines at ±1σ and ±2σ from the
  prior close stand the whole session. The weekly's the
  same way. Close-to-close, overnight included.

  THE REMAINING MOVE is the live straddle on today's
  expiry (the NBBO mids at a chain read, the model's price
  between — labelled), t to the close, never mixed with
  the day's budget in one number. IT IS THE ONE σ_remaining
  (the owner, 2026-10-14, the Terrain UI pass: "σ_remaining
  = the store's live straddle … Use it in the strip
  distances, axis chips, ladder σ column, hover cards and
  the cone. The formula σ_day × √(1 − used) is a fallback
  only when no straddle exists, labelled 'budget' when
  used … Never one number made from both"): sigmaRemOf
  below, and the Priced move box's two lines, remLines.

  THE CONE spreads the remaining variance over the minutes
  left by a TIME-OF-DAY PROFILE — the mean squared 1-minute
  return for each minute of the session over the trailing
  sessions before the day, rescaled to the total — and
  draws 50%, 68% and 95% bands (z 0.674, 1, 1.96).

  THE CALIBRATION, per name: how often the close stayed
  inside ±1σ and ±2σ (the prior close's budget, and the
  10:00 am straddle to the close), how often the session
  touched ±1σ and ±2σ, the median |close − prior close| ÷
  σ_day — each beside theory for a driftless normal walk
  (68.3% and 95.4% inside; a touch about twice the finish
  outside, 63.5% and 9.1%; the median |Z| 0.674), marked
  provisional under 60 sessions.
==================================================
*/
import { usd } from '../../core/format';

/** The regular session's minutes */
export const SESSION_MINUTES = 390;
/** E|Z| for a standard normal — a straddle at the money is about 0.798 σ */
export const EAM = Math.sqrt(2 / Math.PI);
/** The bands the cone draws */
export const CONE_BANDS = [
  { q: 50, z: 0.6745 },
  { q: 68, z: 1 },
  { q: 95, z: 1.96 },
] as const;
/** The calibration is provisional under this many sessions */
export const CALIBRATION_MIN = 60;
/** UW's implied move is 85% of the straddle (2026-10-13: implied_move ÷ (S·σ·√(dte/365)) is 0.679 to 0.682 across six
    expiries — 0.85 × 0.798); the cross-check sets the straddle against implied_move ÷ 0.85 */
export const UW_IMPLIED_SHARE = 0.85;

/** A minute bar: its start (seconds), open, high, low, close */
export interface MoveBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** The New York minute of the session a moment falls in, 0 at 9:30 — null outside it */
export function sessionMinuteOf(ms: number, nyMinute: (ms: number) => number): number | null {
  const m = nyMinute(ms) - (9 * 60 + 30);
  return m >= 0 && m < SESSION_MINUTES ? m : null;
}

/** THE PROFILE: each session minute's share of the session's variance — the mean squared 1-minute log return for that
    minute over the sessions given, the first minute's from its own open — summing to 1. Uniform where no session has a
    minute (a gap reads as an average minute, never as none) */
export function profileOf(sessions: readonly (readonly MoveBar[])[], nyMinute: (ms: number) => number): { share: number[]; sessions: number } {
  const sum = new Float64Array(SESSION_MINUTES);
  const n = new Float64Array(SESSION_MINUTES);
  let used = 0;
  for (const bars of sessions) {
    const sorted = [...bars].sort((a, b) => a.time - b.time);
    let prev: number | null = null;
    let any = false;
    for (const b of sorted) {
      const m = sessionMinuteOf(b.time * 1000, nyMinute);
      if (m == null) continue;
      const from = prev ?? b.open;
      if (from > 0 && b.close > 0) {
        const r = Math.log(b.close / from);
        sum[m] += r * r;
        n[m]++;
        any = true;
      }
      prev = b.close;
    }
    if (any) used++;
  }
  const mean = Array.from(sum, (s, i) => (n[i] ? s / n[i] : NaN));
  const known = mean.filter(Number.isFinite);
  const fill = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 1;
  const filled = mean.map(v => (Number.isFinite(v) ? v : fill));
  const total = filled.reduce((a, b) => a + b, 0) || 1;
  return { share: filled.map(v => v / total), sessions: used };
}

/** The profile's share from session minute a (inclusive) to b (exclusive) */
export function shareBetween(share: readonly number[], a: number, b: number): number {
  let s = 0;
  for (let i = Math.max(0, Math.floor(a)); i < Math.min(SESSION_MINUTES, Math.ceil(b)); i++) s += share[i];
  return s;
}

export interface ConePoint {
  /** Minutes ahead of the last bar's end */
  minutesAhead: number;
  /** Half-widths, dollars, by band (50, 68, 95) */
  half: [number, number, number];
}
/** THE CONE from the minute `now` (session minutes elapsed, the last bar's end) to the close: the remaining 1σ (dollars)
    spread over the minutes left by the profile, a point every `step` minutes and at the close */
export function coneOf(sigmaRem: number, now: number, share: readonly number[], step = 5): ConePoint[] {
  const left = SESSION_MINUTES - now;
  if (!(sigmaRem > 0) || left <= 0) return [];
  const rest = shareBetween(share, now, SESSION_MINUTES) || 1;
  const out: ConePoint[] = [{ minutesAhead: 0, half: [0, 0, 0] }];
  for (let m = step; m < left + step; m += step) {
    const ahead = Math.min(m, left);
    const sd = sigmaRem * Math.sqrt(shareBetween(share, now, now + ahead) / rest);
    out.push({ minutesAhead: ahead, half: CONE_BANDS.map(b => b.z * sd) as [number, number, number] });
    if (ahead === left) break;
  }
  return out;
}

export interface Readout {
  /** (spot − prior close) ÷ σ_day */
  sigmas: number;
  /** The share of the session's variance the profile puts before now, 0–1 */
  used: number;
  /** |sigmas| ÷ used (the owner's "pace = sigma used / variance-time used"); null before the first minute */
  pace: number | null;
}
export function readoutOf(spot: number, prevClose: number, sigmaDay: number, now: number, share: readonly number[]): Readout | null {
  if (!(sigmaDay > 0) || !(prevClose > 0)) return null;
  const sigmas = (spot - prevClose) / sigmaDay;
  const used = shareBetween(share, 0, Math.max(0, Math.min(SESSION_MINUTES, now)));
  return { sigmas, used, pace: used > 0 ? Math.abs(sigmas) / used : null };
}
/** "+0.6σ · 41% of the day's variance used · pace 1.5×" */
export function readoutWords(r: Readout | null): string {
  if (!r) return '';
  /* a move that rounds to nothing wears no sign ("0.0σ", never "−0.0σ") */
  const shown = Math.abs(r.sigmas).toFixed(1);
  const sign = Number(shown) === 0 ? '' : r.sigmas > 0 ? '+' : '−';
  return `${sign}${shown}σ · ${Math.round(r.used * 100)}% of the day's variance used${r.pace != null ? ` · pace ${r.pace.toFixed(1)}×` : ''}`;
}

/* ---- THE ONE σ_remaining (the owner, 2026-10-14) ----------------------------------------------------------------- */

export interface SigmaRem {
  /** Dollars of 1σ left to the close */
  sigma: number;
  /** 'straddle': the live straddle's (the owner's Oct 13 rule); 'budget': σ_day × √(1 − used), standing in only where no
      straddle has been read, and said so */
  src: 'straddle' | 'budget';
  /** The straddle's own source and minute, where it is one */
  from?: 'nbbo' | 'model';
  at?: number;
}
/** THE BUDGET'S LEFTOVER: σ_day × √(1 − the share of the session's variance the profile puts before now) — the fallback,
    and the Priced move box's second line; never added to or averaged with the straddle's */
export const budgetLeftOf = (sigmaDay: number, used: number): number => (sigmaDay > 0 && Number.isFinite(used) ? sigmaDay * Math.sqrt(Math.max(0, 1 - Math.min(1, used))) : NaN);
/** The one σ_remaining every distance reads: the straddle's where one stands, else the budget's leftover; null with
    neither (the session over, or nothing priced) */
export function sigmaRemOf(rem: { sigma: number; src: 'nbbo' | 'model'; at: number } | null | undefined, sigmaDay: number, used: number | null): SigmaRem | null {
  if (rem && rem.sigma > 0) return { sigma: rem.sigma, src: 'straddle', from: rem.src, at: rem.at };
  if (used != null && sigmaDay > 0) {
    const b = budgetLeftOf(sigmaDay, used);
    return b > 0 ? { sigma: b, src: 'budget' } : null;
  }
  return null;
}
/** A level's distance from the price in σ_remaining — signed, the level's side; null without one */
export const sigmasAway = (level: number, price: number, rem: SigmaRem | null | undefined): number | null => (rem && rem.sigma > 0 && Number.isFinite(level) && Number.isFinite(price) ? (level - price) / rem.sigma : null);
/** the house's own dollars (core/format): "$1,234.56" — never a formatter of this module's */
const dollars = (v: number): string => usd(v);
/** The chart readout's own line for the σ it draws the cone from */
export const remLine = (sr: SigmaRem): string => (sr.src === 'straddle' ? `market now ±${dollars(sr.sigma)} to the close (${sr.from === 'nbbo' ? 'quotes' : 'the model'})` : `budget left ±${dollars(sr.sigma)} (no straddle read)`);
/** THE PRICED MOVE BOX'S TWO LINES — "Market now ±$X to the close" (the straddle) and "Budget left ±$Y" (the formula),
    each its own number, never one made from both. `at` prints the straddle's minute on the reader's clock. */
export function remLines(rem: { sigma: number; src: 'nbbo' | 'model'; at: number } | null | undefined, sigmaDay: number, used: number | null, at?: (ms: number) => string): string[] {
  const out: string[] = [];
  if (rem && rem.sigma > 0) out.push(`Market now ±${dollars(rem.sigma)} to the close — the straddle on today's expiry (${rem.src === 'nbbo' ? 'quotes' : 'the model'}${at ? `, ${at(rem.at)}` : ''})`);
  else out.push('Market now: no straddle read for today’s expiry yet');
  if (used != null && sigmaDay > 0) {
    const b = budgetLeftOf(sigmaDay, used);
    if (Number.isFinite(b)) out.push(`Budget left ±${dollars(b)} — σ_day ${dollars(sigmaDay)} × √(1 − ${Math.round(Math.min(1, used) * 100)}% of the day’s variance used)`);
  }
  return out;
}

/* ---- the calibration -------------------------------------------------------------------------------------------- */

export interface CalibrationDay {
  day: string;
  prevClose: number;
  /** 1σ priced at the prior close, dollars */
  sigmaDay: number;
  close: number;
  high: number;
  low: number;
  /** 10:00 am New York: the spot and the remaining 1σ to the close off the straddle then */
  at10?: { spot: number; sigma: number; src: 'nbbo' | 'model' } | null;
  /** Where the close came from: the session's official close, or its last regular minute's while the official one was
      not in yet (server/pricedMove.ts officialClose) — absent on a row written before 2026-10-14 */
  closeFrom?: 'official' | 'bar';
}
/** ONE SESSION AGAINST ITS BUDGET — the calibration counts these and the session recap (item 9) prints them, so the two
    never disagree on a day */
export interface DayVerdict {
  /** (close − prior close) ÷ σ_day */
  sigmas: number;
  /** The close inside ±1σ and ±2σ of the prior close */
  inside: [boolean, boolean];
  /** The session's highs and lows reached ±1σ and ±2σ */
  touched: [boolean, boolean];
  /** The farthest the session went from the prior close, in σ_day, signed (+ above): the high's or the low's, the larger */
  max: number;
  /** From 10:00 am: the close against the spot then, in the 1σ left to the close then, and inside ±1σ and ±2σ of it */
  at10: { sigmas: number; inside: [boolean, boolean] } | null;
}
export function dayVerdict(d: CalibrationDay): DayVerdict | null {
  if (!(d.sigmaDay > 0 && d.prevClose > 0 && Number.isFinite(d.close))) return null;
  const inside = (k: 1 | 2) => Math.abs(d.close - d.prevClose) <= k * d.sigmaDay;
  const touch = (k: 1 | 2) => d.high >= d.prevClose + k * d.sigmaDay || d.low <= d.prevClose - k * d.sigmaDay;
  const up = (d.high - d.prevClose) / d.sigmaDay;
  const down = (d.prevClose - d.low) / d.sigmaDay;
  const a = d.at10 && d.at10.sigma > 0 ? d.at10 : null;
  return {
    sigmas: (d.close - d.prevClose) / d.sigmaDay,
    inside: [inside(1), inside(2)],
    touched: [touch(1), touch(2)],
    max: up >= down ? up : -down,
    at10: a ? { sigmas: (d.close - a.spot) / a.sigma, inside: [Math.abs(d.close - a.spot) <= a.sigma, Math.abs(d.close - a.spot) <= 2 * a.sigma] } : null,
  };
}
export interface CalibrationRate {
  k: number;
  n: number;
  rate: number | null;
  theory: number;
}
export interface Calibration {
  sessions: number;
  provisional: boolean;
  closeInside: { budget: [CalibrationRate, CalibrationRate]; at10: [CalibrationRate, CalibrationRate] };
  touch: [CalibrationRate, CalibrationRate];
  /** The plan's sanity check (iii): Wednesdays' close inside ±1σ of the 10:00 am straddle, against a published study
      of 193 Wednesday sessions (July 2022 to April 2026: 71.0%, the close against the 10:00 spot — the same measure);
      outside 60–80% is read as a pricing or close-source fault until shown otherwise, judged from 30 sessions */
  wednesdays: CalibrationRate & { study: number; band: [number, number]; judgedFrom: number };
  /** The median |close − prior close| ÷ σ_day, and theory's 0.674 */
  medianRatio: { value: number | null; theory: number; n: number };
}
const rate = (k: number, n: number, theory: number): CalibrationRate => ({ k, n, rate: n ? k / n : null, theory });
/** P(|Z| ≤ z) for the standard normal */
const PHI_IN = { 1: 0.6826895, 2: 0.9544997 } as const;
export function calibrate(days: readonly CalibrationDay[]): Calibration {
  const ok = days.filter(d => d.sigmaDay > 0 && d.prevClose > 0 && Number.isFinite(d.close));
  /* each day's verdict, the one the session recap prints */
  const verdict = new Map(ok.map(d => [d, dayVerdict(d)!]));
  const inside = (k: 1 | 2) => ok.filter(d => verdict.get(d)!.inside[k - 1]).length;
  const touch = (k: 1 | 2) => ok.filter(d => verdict.get(d)!.touched[k - 1]).length;
  const tens = ok.filter(d => d.at10 && d.at10.sigma > 0);
  const inside10 = (k: 1 | 2) => tens.filter(d => verdict.get(d)!.at10!.inside[k - 1]).length;
  const weds = tens.filter(d => new Date(`${d.day}T12:00:00Z`).getUTCDay() === 3);
  const ratios = ok.map(d => Math.abs(d.close - d.prevClose) / d.sigmaDay).sort((a, b) => a - b);
  const med = ratios.length ? (ratios.length % 2 ? ratios[ratios.length >> 1] : (ratios[ratios.length / 2 - 1] + ratios[ratios.length / 2]) / 2) : null;
  return {
    sessions: ok.length,
    provisional: ok.length < CALIBRATION_MIN,
    closeInside: {
      budget: [rate(inside(1), ok.length, PHI_IN[1]), rate(inside(2), ok.length, PHI_IN[2])],
      at10: [rate(inside10(1), tens.length, PHI_IN[1]), rate(inside10(2), tens.length, PHI_IN[2])],
    },
    touch: [rate(touch(1), ok.length, 2 * (1 - PHI_IN[1])), rate(touch(2), ok.length, 2 * (1 - PHI_IN[2]))],
    wednesdays: { ...rate(weds.filter(d => verdict.get(d)!.at10!.inside[0]).length, weds.length, PHI_IN[1]), study: 0.71, band: [0.6, 0.8], judgedFrom: 30 },
    medianRatio: { value: med, theory: 0.6745, n: ratios.length },
  };
}
/** The calibration as How sure prints it — each rate beside theory, provisional said */
export function calibrationLines(c: Calibration): string[] {
  const pc = (r: CalibrationRate) => (r.rate == null ? '—' : `${Math.round(r.rate * 100)}%`);
  const th = (x: number) => `${(x * 100).toFixed(1)}%`;
  const head = `${c.sessions} session${c.sessions === 1 ? '' : 's'}${c.provisional ? ` · provisional (under ${CALIBRATION_MIN})` : ''}`;
  return [
    head,
    `Close inside ±1σ / ±2σ priced at the prior close: ${pc(c.closeInside.budget[0])} / ${pc(c.closeInside.budget[1])} (theory ${th(c.closeInside.budget[0].theory)} / ${th(c.closeInside.budget[1].theory)})`,
    `Close inside ±1σ / ±2σ of the 10:00 am straddle: ${pc(c.closeInside.at10[0])} / ${pc(c.closeInside.at10[1])} on ${c.closeInside.at10[0].n} session${c.closeInside.at10[0].n === 1 ? '' : 's'} (theory ${th(c.closeInside.at10[0].theory)} / ${th(c.closeInside.at10[1].theory)})`,
    `Touched ±1σ / ±2σ during the session: ${pc(c.touch[0])} / ${pc(c.touch[1])} (theory about twice the finish outside: ${th(c.touch[0].theory)} / ${th(c.touch[1].theory)})`,
    `Median |close − prior close| ÷ σ: ${c.medianRatio.value == null ? '—' : c.medianRatio.value.toFixed(2)} (theory ${c.medianRatio.theory.toFixed(2)})`,
    wednesdayLine(c.wednesdays),
  ];
}
function wednesdayLine(w: Calibration['wednesdays']): string {
  const [lo, hi] = w.band;
  const verdict =
    w.rate == null || w.n < w.judgedFrom
      ? `judged against ${Math.round(lo * 100)}–${Math.round(hi * 100)}% from ${w.judgedFrom} sessions`
      : w.rate >= lo && w.rate <= hi
        ? `inside ${Math.round(lo * 100)}–${Math.round(hi * 100)}%`
        : `outside ${Math.round(lo * 100)}–${Math.round(hi * 100)}%: read as a pricing or close-source fault until shown otherwise`;
  return `Wednesdays, close inside ±1σ of the 10:00 am straddle: ${w.rate == null ? '—' : `${Math.round(w.rate * 100)}%`} on ${w.n} session${w.n === 1 ? '' : 's'} (a published study of 193: ${Math.round(w.study * 100)}%; ${verdict})`;
}
