/*
==================================================
  SLAYER TERMINAL - THE TRACK RECORD (data/feed/trackRecord.ts)

  THE LEVELS AND THE REGIME SCORED AGAINST BASELINES
  (2026-10-13 — the owner's item 2: "nightly event
  study over the snapshot store … shown in a 'Track
  record' tab inside How sure … Never show a bare
  'held %'"; Osler, FRBNY 2000: random levels bounced
  56.2% against 60.8% for published ones, so a hit
  rate means nothing without its baseline).

  Pure, no DOM, no vendor: the server's nightly job
  (server/scorecard.ts) and the proof (scripts/
  track-record-proof.ts) run this one function on the
  store's FINAL rows (server/fieldStore.ts — a rebuilt
  session's rows are the same code's) and the sessions'
  minute bars.

  A LEVEL counts only if it existed before the bar: the
  level a bar is tested against is the row of the
  minute BEFORE it (that row's inputs ended as the bar
  began), and its age is the minutes it had stood
  unchanged. A TOUCH is a bar whose low–high reaches
  within `tol` of the level, counted once per approach
  (the bar before did not touch), numbered within the
  session. A BOUNCE at h minutes: the close h minutes
  on is on the side price came from (the bar before's
  close). MFE/MAE: the farthest the price went back to
  the approach side and the farthest through the level,
  in points, over 5, 15 and 30 minutes.

  BASELINES on the same days, by the same rules:
    B1 random — twenty levels above and twenty below
       the open, drawn uniformly within the largest
       open-to-high or open-to-low distance of the
       prior month's sessions (Osler), seeded;
    B2 strike-matched — at each minute, for each real
       level, a listed strike on the same side at the
       same distance (within a step) whose |gamma| is
       under the column's median: round numbers and
       distance alike, the gamma not;
    B3 distance-matched — the mirror: a price at the
       real level's distance from spot when the level
       formed, on the other side, kept until the level
       changes.
  The real level's bounce rate minus B2's carries a
  95% interval from a day-block bootstrap (days drawn
  with replacement, seeded) and the months won (real
  above B2) as k of n with a two-sided binomial p.

  MULTIPLE TESTING: every parameter is in the config
  (server/scorecard.config.json), the variants tried
  are counted beside every result, and the most recent
  months are a HOLD-OUT the job evaluates once per
  config version (server/scorecard.ts). A cell with
  fewer touches or months than the config asks says
  "insufficient" and carries no rate.
==================================================
*/

export interface TrackBar {
  /** Unix seconds, the minute's start */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}
/** A final row's fields the record reads (server/fieldStore.ts StoreRow) */
export interface TrackRow {
  m: number;
  spot: number;
  flip: number | null;
  cw: number | null;
  pw: number | null;
  top: [number, number][];
  net: number;
  cells: [number, number][];
  /** The at-the-money straddle for the expiry settling today, dollars a share — the implied-move control */
  str0?: { value: number } | null;
}
export interface TrackSession {
  day: string;
  rows: TrackRow[];
  bars: TrackBar[];
  /** The session before's official close */
  prevClose: number | null;
  /** UW's directionalized whole-book gamma a minute, [minute ms, value] — the attribution check's regime */
  dir?: [number, number][];
}
export interface TrackConfig {
  version: string;
  tol: { default: number; variants: number[] };
  /** Bounce horizons, minutes */
  horizons: number[];
  /** Excursion horizons, minutes */
  excursions: number[];
  topK: number;
  random: { perSide: number; seed: number; lookbackSessions: number };
  bootstrap: { reps: number; seed: number };
  regime: { trailingSessions: number; rangeHorizons: number[] };
  holdoutMonths: number;
  minTouches: number;
  minMonths: number;
}
export type LevelKind = 'call wall' | 'put wall' | 'flip' | 'top strike';
export const LEVEL_KINDS: LevelKind[] = ['call wall', 'put wall', 'flip', 'top strike'];
export type Baseline = 'real' | 'B1' | 'B2' | 'B3';
export type Bucket = 'open' | 'mid' | 'close';
export interface Touch {
  day: string;
  m: number;
  kind: LevelKind;
  base: Baseline;
  level: number;
  /** The level's identity within the session (a strike, a random index, a formation minute) */
  id: string;
  /** The side price came from: 1 above the level, −1 below */
  side: 1 | -1;
  /** Which touch of this level in the session: 1, 2, 3 (3 = third or later) */
  nth: 1 | 2 | 3;
  /** Minutes the level had stood before the bar */
  age: number;
  /** The level's sign in the house's sign (0 for the flip and a random level) and size, dollars a 1% move */
  sign: -1 | 0 | 1;
  size: number;
  /** The regime tercile at the touch, 1 the most negative third, null before enough history */
  regime: 1 | 2 | 3 | null;
  bucket: Bucket;
  /** Bounce by horizon (minutes): on the approach side h minutes on; null past the session's end */
  bounce: Record<number, boolean | null>;
  mfe: Record<number, number | null>;
  mae: Record<number, number | null>;
}
export interface Rate {
  n: number;
  /** The share on the approach side, 0–1 */
  rate: number;
}
export interface Cell {
  kind: LevelKind;
  split: string;
  horizon: number;
  tol: number;
  real: Rate;
  B1: Rate;
  B2: Rate;
  B3: Rate;
  /** real − B2, in points of rate (0–1), with the bootstrap's 95% interval */
  diff: number | null;
  ci: [number, number] | null;
  /** Months the real level's rate stood above B2's: k of n, and the two-sided binomial p */
  months: { won: number; of: number; p: number } | null;
  mfe: Record<number, number | null>;
  mae: Record<number, number | null>;
  /** The record is too thin to carry a rate: touches under minTouches or months under minMonths */
  insufficient: { touches: number; months: number } | null;
}
export interface RegimeRange {
  horizon: number;
  /** Per tercile: minutes counted, the median range as a share of spot, and the median range over the straddle's
      implied move (null without straddles) */
  terciles: { tercile: 1 | 2 | 3; n: number; range: number | null; overImplied: number | null }[];
}
export interface LastHalfHour {
  /** The regime sign at 3:30 pm New York: the net's for the house's, UW's _dir for the vendor's */
  source: 'house' | 'uw-dir';
  sign: 'negative' | 'positive';
  n: number;
  /** The slope of the 3:30 to 4:00 return on the prior-close to 3:30 return, and its t-statistic */
  slope: number | null;
  t: number | null;
}
export interface TrackRecord {
  config: TrackConfig;
  sessions: number;
  firstDay: string | null;
  lastDay: string | null;
  months: number;
  /** Every parameter combination evaluated — printed beside every result */
  variantsTried: number;
  cells: Cell[];
  touches: number;
  regime: { ranges: RegimeRange[]; lastHalfHour: LastHalfHour[] };
}

/* ---- the randomness, seeded ------------------------------------------------------------------------------------ */

/** mulberry32 — a small seeded generator; the same seed, the same draws, so a rerun is byte-identical */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashDay = (day: string): number => {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 16777619);
  return h >>> 0;
};

/* ---- helpers ---------------------------------------------------------------------------------------------------- */

const NY_FMT = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: 'numeric', minute: 'numeric' });
/** A moment's minute of New York's day */
export function nyMinuteOf(ms: number): number {
  let h = 0;
  let mi = 0;
  for (const p of NY_FMT.formatToParts(new Date(ms))) {
    if (p.type === 'hour') h = Number(p.value) % 24;
    if (p.type === 'minute') mi = Number(p.value);
  }
  return h * 60 + mi;
}
export const bucketOf = (ms: number): Bucket => {
  const mi = nyMinuteOf(ms);
  return mi < 10 * 60 + 30 ? 'open' : mi < 15 * 60 ? 'mid' : 'close';
};
const median = (a: readonly number[]): number | null => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};
const monthOf = (day: string) => day.slice(0, 7);
/** The strike grid's step: the smallest gap between the column's strikes */
const stepOf = (cells: readonly [number, number][]): number => {
  let step = Infinity;
  for (let i = 1; i < cells.length; i++) {
    const d = cells[i][0] - cells[i - 1][0];
    if (d > 0 && d < step) step = d;
  }
  return Number.isFinite(step) ? step : 1;
};
/** The two-sided binomial p for k wins of n at a fair coin */
export function binomialTwoSided(k: number, n: number): number {
  if (n <= 0) return 1;
  const logC = (nn: number, kk: number) => {
    let s = 0;
    for (let i = 1; i <= kk; i++) s += Math.log(nn - kk + i) - Math.log(i);
    return s;
  };
  const p = (x: number) => Math.exp(logC(n, x) + n * Math.log(0.5));
  const expected = n / 2;
  const d = Math.abs(k - expected);
  let sum = 0;
  for (let x = 0; x <= n; x++) if (Math.abs(x - expected) >= d - 1e-12) sum += p(x);
  return Math.min(1, sum);
}

/* ---- the levels at each minute --------------------------------------------------------------------------------- */

interface Live {
  kind: LevelKind;
  base: Baseline;
  id: string;
  level: number;
  sign: -1 | 0 | 1;
  size: number;
}
/** The levels standing before bar i (row i − 1's), with each one's identity, sign and size */
function levelsBefore(row: TrackRow, cfg: TrackConfig): Live[] {
  const out: Live[] = [];
  const valueAt = new Map(row.cells);
  const signOf = (k: number): -1 | 0 | 1 => {
    const v = valueAt.get(k) ?? 0;
    return v > 0 ? 1 : v < 0 ? -1 : 0;
  };
  if (row.cw != null) out.push({ kind: 'call wall', base: 'real', id: `cw`, level: row.cw, sign: signOf(row.cw), size: Math.abs(valueAt.get(row.cw) ?? 0) });
  if (row.pw != null) out.push({ kind: 'put wall', base: 'real', id: `pw`, level: row.pw, sign: signOf(row.pw), size: Math.abs(valueAt.get(row.pw) ?? 0) });
  if (row.flip != null) out.push({ kind: 'flip', base: 'real', id: 'flip', level: row.flip, sign: 0, size: Math.abs(row.net) });
  for (const [k, v] of row.top.slice(0, cfg.topK)) out.push({ kind: 'top strike', base: 'real', id: `top:${k}`, level: k, sign: v > 0 ? 1 : v < 0 ? -1 : 0, size: Math.abs(v) });
  return out;
}

/** B2 — for each real level, a listed strike on the same side at the same distance (within a step) with |gamma| under
    the column's median, never a real level; the nearest in distance, the lower strike on a tie */
function strikeMatched(row: TrackRow, real: Live[]): Live[] {
  const out: Live[] = [];
  if (!row.cells.length) return out;
  const step = stepOf(row.cells);
  const med = median(row.cells.map(c => Math.abs(c[1]))) ?? 0;
  const taken = new Set(real.map(l => l.level));
  for (const r of real) {
    const d = Math.abs(r.level - row.spot);
    const above = r.level >= row.spot;
    let best: [number, number] | null = null;
    let bestGap = Infinity;
    for (const c of row.cells) {
      if (taken.has(c[0]) || (c[0] >= row.spot) !== above) continue;
      const gap = Math.abs(Math.abs(c[0] - row.spot) - d);
      if (gap > step || Math.abs(c[1]) >= med) continue;
      if (gap < bestGap - 1e-9 || (Math.abs(gap - bestGap) <= 1e-9 && best && c[0] < best[0])) {
        best = c;
        bestGap = gap;
      }
    }
    if (best) out.push({ kind: r.kind, base: 'B2', id: `B2:${r.id}:${best[0]}`, level: best[0], sign: best[1] > 0 ? 1 : best[1] < 0 ? -1 : 0, size: Math.abs(best[1]) });
  }
  return out;
}

/* ---- the event study -------------------------------------------------------------------------------------------- */

interface Formed {
  /** B3's level: the real level's distance from spot when it formed, kept until the real one changes */
  level: number;
  since: number;
}

/** One session's touches, the real levels' and the baselines', at one tolerance */
export function touchesOf(s: TrackSession, cfg: TrackConfig, tol: number, randomBand: number | null, regimeCuts: [number, number] | null): Touch[] {
  const out: Touch[] = [];
  if (s.bars.length < 2 || !s.rows.length) return out;
  const rowAt = new Map(s.rows.map(r => [r.m, r]));
  const bars = [...s.bars].sort((a, b) => a.time - b.time);
  const open = bars[0].open;
  /* B1: the random levels, drawn once for the session */
  const random: Live[] = [];
  if (randomBand != null && randomBand > 0) {
    const draw = rng((cfg.random.seed ^ hashDay(s.day)) >>> 0);
    for (let i = 0; i < cfg.random.perSide; i++) random.push({ kind: 'flip', base: 'B1', id: `B1:up:${i}`, level: open + draw() * randomBand, sign: 0, size: 0 });
    for (let i = 0; i < cfg.random.perSide; i++) random.push({ kind: 'flip', base: 'B1', id: `B1:dn:${i}`, level: open - draw() * randomBand, sign: 0, size: 0 });
  }
  const age = new Map<string, { level: number; since: number }>();
  const touching = new Set<string>();
  const counts = new Map<string, number>();
  const formed = new Map<string, Formed>();
  const horizonMax = Math.max(...cfg.horizons, ...cfg.excursions);
  for (let i = 1; i < bars.length; i++) {
    const bar = bars[i];
    const prev = bars[i - 1];
    const row = rowAt.get(prev.time * 1000) ?? null;
    const live: Live[] = [];
    if (row) {
      const real = levelsBefore(row, cfg);
      live.push(...real, ...strikeMatched(row, real));
      /* B3: the mirror — a price at the real level's distance from spot when it formed, on the other side, kept until
         the real level changes: the distance is the real level's, the gamma is nobody's */
      for (const r of real) {
        const had = formed.get(r.id);
        const a = age.get(r.id);
        const changed = !a || Math.abs(a.level - r.level) > 1e-9;
        if (changed || !had) formed.set(r.id, { level: row.spot - (r.level - row.spot), since: i });
        const f = formed.get(r.id)!;
        live.push({ kind: r.kind, base: 'B3', id: `B3:${r.id}:${f.since}`, level: f.level, sign: 0, size: 0 });
      }
    }
    live.push(...random);
    /* ages: a level unchanged since the minute before keeps its age; a changed one is new (random levels stand from the open) */
    const seen = new Set<string>();
    for (const l of live) {
      seen.add(l.id);
      const a = age.get(l.id);
      const same = a && (l.base === 'B1' || Math.abs(a.level - l.level) <= 1e-9);
      if (!same) age.set(l.id, { level: l.level, since: i - 1 });
    }
    for (const id of [...age.keys()]) if (!seen.has(id)) age.delete(id);
    for (const l of live) {
      const a = age.get(l.id)!;
      const standing = i - 1 - a.since;
      /* the level must have existed at least a minute before the bar */
      if (l.base !== 'B1' && standing < 1) {
        touching.delete(l.id);
        continue;
      }
      const lo = l.level * (1 - tol);
      const hi = l.level * (1 + tol);
      const touched = bar.low <= hi && bar.high >= lo;
      const fresh = touched && !touching.has(l.id);
      if (touched) touching.add(l.id);
      else touching.delete(l.id);
      if (!fresh) continue;
      const side: 1 | -1 | 0 = prev.close > l.level ? 1 : prev.close < l.level ? -1 : 0;
      if (side === 0) continue;
      const nth = (counts.get(l.id) ?? 0) + 1;
      counts.set(l.id, nth);
      const bounce: Record<number, boolean | null> = {};
      for (const h of cfg.horizons) {
        const b = bars[i + h];
        bounce[h] = b ? (side === 1 ? b.close > l.level : b.close < l.level) : null;
      }
      const mfe: Record<number, number | null> = {};
      const mae: Record<number, number | null> = {};
      for (const h of cfg.excursions) {
        if (!bars[i + h]) {
          mfe[h] = null;
          mae[h] = null;
          continue;
        }
        let fav = 0;
        let adv = 0;
        for (let j = i + 1; j <= i + h && j <= i + horizonMax; j++) {
          const b = bars[j];
          fav = Math.max(fav, side === 1 ? b.high - l.level : l.level - b.low);
          adv = Math.max(adv, side === 1 ? l.level - b.low : b.high - l.level);
        }
        mfe[h] = fav;
        mae[h] = adv;
      }
      const net = row?.net ?? null;
      const regime: 1 | 2 | 3 | null = regimeCuts && net != null ? (net <= regimeCuts[0] ? 1 : net <= regimeCuts[1] ? 2 : 3) : null;
      out.push({ day: s.day, m: bar.time * 1000, kind: l.kind, base: l.base, level: l.level, id: l.id, side, nth: nth >= 3 ? 3 : (nth as 1 | 2), age: standing, sign: l.sign, size: l.size, regime, bucket: bucketOf(bar.time * 1000), bounce, mfe, mae });
    }
  }
  return out;
}

/* ---- the rates and their intervals ------------------------------------------------------------------------------ */

const rateOf = (ts: readonly Touch[], h: number): Rate => {
  let n = 0;
  let k = 0;
  for (const t of ts) {
    const b = t.bounce[h];
    if (b == null) continue;
    n++;
    if (b) k++;
  }
  return { n, rate: n ? k / n : NaN };
};

/** real − B2 with the day-block bootstrap's 95% interval; null with nothing on either side. The days' counts are
    summed once, so a rep is a sum over days, not over touches. */
function diffWithCi(real: Touch[], b2: Touch[], h: number, cfg: TrackConfig): { diff: number | null; ci: [number, number] | null } {
  const r = rateOf(real, h);
  const b = rateOf(b2, h);
  if (!r.n || !b.n) return { diff: null, ci: null };
  const byDay = new Map<string, [number, number, number, number]>();
  const add = (t: Touch, k: 0 | 2) => {
    const v = t.bounce[h];
    if (v == null) return;
    const d = byDay.get(t.day) ?? [0, 0, 0, 0];
    d[k]++;
    if (v) d[k + 1]++;
    byDay.set(t.day, d);
  };
  for (const t of real) add(t, 0);
  for (const t of b2) add(t, 2);
  const days = [...byDay.keys()].sort().map(d => byDay.get(d)!);
  const draw = rng(cfg.bootstrap.seed);
  const diffs: number[] = [];
  for (let rep = 0; rep < cfg.bootstrap.reps; rep++) {
    let rn = 0;
    let rk = 0;
    let bn = 0;
    let bk = 0;
    for (let i = 0; i < days.length; i++) {
      const d = days[Math.floor(draw() * days.length)];
      rn += d[0];
      rk += d[1];
      bn += d[2];
      bk += d[3];
    }
    if (rn && bn) diffs.push(rk / rn - bk / bn);
  }
  diffs.sort((x, y) => x - y);
  if (!diffs.length) return { diff: r.rate - b.rate, ci: null };
  const at = (q: number) => diffs[Math.min(diffs.length - 1, Math.max(0, Math.floor(q * diffs.length)))];
  return { diff: r.rate - b.rate, ci: [at(0.025), at(0.975)] };
}

function monthsWon(real: Touch[], b2: Touch[], h: number): Cell['months'] {
  const months = [...new Set([...real, ...b2].map(t => monthOf(t.day)))].sort();
  let won = 0;
  let of = 0;
  for (const mo of months) {
    const r = rateOf(
      real.filter(t => monthOf(t.day) === mo),
      h
    );
    const b = rateOf(
      b2.filter(t => monthOf(t.day) === mo),
      h
    );
    if (!r.n || !b.n) continue;
    of++;
    if (r.rate > b.rate) won++;
  }
  return of ? { won, of, p: binomialTwoSided(won, of) } : null;
}

function cellOf(kind: LevelKind, split: string, pick: (t: Touch) => boolean, h: number, tol: number, all: Touch[], cfg: TrackConfig): Cell {
  const of = (base: Baseline) => all.filter(t => t.base === base && (base === 'B1' || t.kind === kind) && pick(t));
  const real = of('real');
  const b1 = of('B1');
  const b2 = of('B2');
  const b3 = of('B3');
  const months = new Set(real.map(t => monthOf(t.day))).size;
  const d = diffWithCi(real, b2, h, cfg);
  const mfe: Record<number, number | null> = {};
  const mae: Record<number, number | null> = {};
  for (const e of cfg.excursions) {
    mfe[e] = median(real.map(t => t.mfe[e]).filter((v): v is number => v != null));
    mae[e] = median(real.map(t => t.mae[e]).filter((v): v is number => v != null));
  }
  const n = rateOf(real, h).n;
  return {
    kind,
    split,
    horizon: h,
    tol,
    real: rateOf(real, h),
    B1: rateOf(b1, h),
    B2: rateOf(b2, h),
    B3: rateOf(b3, h),
    diff: d.diff,
    ci: d.ci,
    months: monthsWon(real, b2, h),
    mfe,
    mae,
    insufficient: n < cfg.minTouches || months < cfg.minMonths ? { touches: n, months } : null,
  };
}

/* ---- the regime ------------------------------------------------------------------------------------------------- */

/** The terciles' cut points of the net over the sessions before (point in time), null without enough */
function regimeCutsBefore(prior: TrackSession[], cfg: TrackConfig): [number, number] | null {
  const recent = prior.slice(-cfg.regime.trailingSessions);
  if (recent.length < 5) return null;
  const nets: number[] = [];
  for (const s of recent) for (const r of s.rows) nets.push(r.net);
  if (nets.length < 30) return null;
  nets.sort((a, b) => a - b);
  return [nets[Math.floor(nets.length / 3)], nets[Math.floor((2 * nets.length) / 3)]];
}

function regimeRanges(sessions: TrackSession[], cfg: TrackConfig): RegimeRange[] {
  const out: RegimeRange[] = [];
  for (const h of cfg.regime.rangeHorizons) {
    const by: Record<1 | 2 | 3, { ranges: number[]; over: number[] }> = { 1: { ranges: [], over: [] }, 2: { ranges: [], over: [] }, 3: { ranges: [], over: [] } };
    sessions.forEach((s, idx) => {
      const cuts = regimeCutsBefore(sessions.slice(0, idx), cfg);
      if (!cuts) return;
      const bars = [...s.bars].sort((a, b) => a.time - b.time);
      const rowAt = new Map(s.rows.map(r => [r.m, r]));
      for (let i = 0; i + h < bars.length; i++) {
        const row = rowAt.get(bars[i].time * 1000);
        if (!row) continue;
        const t: 1 | 2 | 3 = row.net <= cuts[0] ? 1 : row.net <= cuts[1] ? 2 : 3;
        let hi = -Infinity;
        let lo = Infinity;
        for (let j = i + 1; j <= i + h; j++) {
          hi = Math.max(hi, bars[j].high);
          lo = Math.min(lo, bars[j].low);
        }
        const range = (hi - lo) / row.spot;
        by[t].ranges.push(range);
        if (row.str0 && row.str0.value > 0) by[t].over.push(range / (row.str0.value / row.spot));
      }
    });
    out.push({ horizon: h, terciles: ([1, 2, 3] as const).map(t => ({ tercile: t, n: by[t].ranges.length, range: median(by[t].ranges), overImplied: median(by[t].over) })) });
  }
  return out;
}

/** The 3:30 to 4:00 return on the prior-close to 3:30 return, by the regime's sign at 3:30 (Baltussen et al. 2021) */
function lastHalfHour(sessions: TrackSession[]): LastHalfHour[] {
  const out: LastHalfHour[] = [];
  for (const source of ['house', 'uw-dir'] as const) {
    const groups: Record<'negative' | 'positive', { x: number[]; y: number[] }> = { negative: { x: [], y: [] }, positive: { x: [], y: [] } };
    for (const s of sessions) {
      if (s.prevClose == null || !(s.prevClose > 0)) continue;
      const bars = [...s.bars].sort((a, b) => a.time - b.time);
      const at = (minute: number) => bars.find(b => nyMinuteOf(b.time * 1000) === minute) ?? null;
      const b1530 = at(15 * 60 + 29);
      const b1600 = at(15 * 60 + 59);
      if (!b1530 || !b1600) continue;
      let sign = 0;
      if (source === 'house') {
        const row = s.rows.find(r => nyMinuteOf(r.m) === 15 * 60 + 29) ?? s.rows.find(r => nyMinuteOf(r.m) === 15 * 60 + 30);
        if (!row) continue;
        sign = Math.sign(row.net);
      } else {
        const d = s.dir?.find(x => nyMinuteOf(x[0]) === 15 * 60 + 29 || nyMinuteOf(x[0]) === 15 * 60 + 30);
        if (!d) continue;
        sign = Math.sign(d[1]);
      }
      if (!sign) continue;
      const g = groups[sign < 0 ? 'negative' : 'positive'];
      g.x.push(b1530.close / s.prevClose - 1);
      g.y.push(b1600.close / b1530.close - 1);
    }
    for (const sign of ['negative', 'positive'] as const) {
      const { x, y } = groups[sign];
      const n = x.length;
      if (n < 3) {
        out.push({ source, sign, n, slope: null, t: null });
        continue;
      }
      const mx = x.reduce((a, b) => a + b, 0) / n;
      const my = y.reduce((a, b) => a + b, 0) / n;
      let sxx = 0;
      let sxy = 0;
      for (let i = 0; i < n; i++) {
        sxx += (x[i] - mx) ** 2;
        sxy += (x[i] - mx) * (y[i] - my);
      }
      if (sxx <= 0) {
        out.push({ source, sign, n, slope: null, t: null });
        continue;
      }
      const slope = sxy / sxx;
      const a = my - slope * mx;
      let sse = 0;
      for (let i = 0; i < n; i++) sse += (y[i] - a - slope * x[i]) ** 2;
      const se = Math.sqrt(sse / Math.max(1, n - 2) / sxx);
      out.push({ source, sign, n, slope, t: se > 0 ? slope / se : null });
    }
  }
  return out;
}

/* ---- the record ------------------------------------------------------------------------------------------------- */

/** The random band for a session: the largest open-to-high or open-to-low distance over the prior month's sessions */
function randomBandOf(prior: TrackSession[], cfg: TrackConfig): number | null {
  const recent = prior.slice(-cfg.random.lookbackSessions);
  if (!recent.length) return null;
  let band = 0;
  for (const s of recent) {
    if (!s.bars.length) continue;
    const open = s.bars[0].open;
    for (const b of s.bars) band = Math.max(band, b.high - open, open - b.low);
  }
  return band > 0 ? band : null;
}

/** The whole record over these sessions (ascending by day) at the config's parameters */
export function trackRecord(input: TrackSession[], cfg: TrackConfig): TrackRecord {
  const sessions = [...input].sort((a, b) => a.day.localeCompare(b.day));
  const tols = [cfg.tol.default, ...cfg.tol.variants.filter(t => t !== cfg.tol.default)];
  const touchesByTol = new Map<number, Touch[]>();
  for (const tol of tols) {
    const all: Touch[] = [];
    sessions.forEach((s, idx) => {
      const prior = sessions.slice(0, idx);
      all.push(...touchesOf(s, cfg, tol, randomBandOf(prior, cfg), regimeCutsBefore(prior, cfg)));
    });
    touchesByTol.set(tol, all);
  }
  const cells: Cell[] = [];
  const splits: { name: string; pick: (t: Touch) => boolean }[] = [
    { name: 'all', pick: () => true },
    { name: 'touch 1', pick: t => t.nth === 1 },
    { name: 'touch 2', pick: t => t.nth === 2 },
    { name: 'touch 3+', pick: t => t.nth === 3 },
    { name: 'open', pick: t => t.bucket === 'open' },
    { name: 'mid', pick: t => t.bucket === 'mid' },
    { name: 'close', pick: t => t.bucket === 'close' },
    { name: 'regime 1', pick: t => t.regime === 1 },
    { name: 'regime 2', pick: t => t.regime === 2 },
    { name: 'regime 3', pick: t => t.regime === 3 },
  ];
  let variants = 0;
  for (const tol of tols)
    for (const h of cfg.horizons)
      for (const split of splits) {
        /* the variants of tolerance stand on the whole alone — the splits are read at the default */
        if (tol !== cfg.tol.default && split.name !== 'all') continue;
        for (const kind of LEVEL_KINDS) {
          cells.push(cellOf(kind, split.name, split.pick, h, tol, touchesByTol.get(tol)!, cfg));
          variants++;
        }
      }
  const months = new Set(sessions.map(s => monthOf(s.day))).size;
  return {
    config: cfg,
    sessions: sessions.length,
    firstDay: sessions[0]?.day ?? null,
    lastDay: sessions[sessions.length - 1]?.day ?? null,
    months,
    variantsTried: variants,
    cells,
    touches: touchesByTol.get(cfg.tol.default)!.filter(t => t.base === 'real').length,
    regime: { ranges: regimeRanges(sessions, cfg), lastHalfHour: lastHalfHour(sessions) },
  };
}

/** One line a level type, as How sure prints it — never a bare rate */
export function recordLine(c: Cell): string {
  const name = c.kind === 'top strike' ? 'Top strike' : c.kind[0].toUpperCase() + c.kind.slice(1);
  if (c.insufficient) return `${name} · insufficient data (${c.insufficient.touches} touches, ${c.insufficient.months} month${c.insufficient.months === 1 ? '' : 's'})`;
  const pc = (x: number) => `${(x * 100).toFixed(0)}%`;
  const pts = (x: number) => `${x >= 0 ? '+' : '−'}${(Math.abs(x) * 100).toFixed(1)} pts`;
  const ci = c.ci ? ` (95% CI ${pts(c.ci[0])} to ${pts(c.ci[1])})` : '';
  const months = c.months ? ` · ${c.months.won}/${c.months.of} months` : '';
  return `${name} · touched ${c.real.n} times · on the approach side after ${c.horizon} min ${pc(c.real.rate)} vs ${pc(c.B2.rate)} strike-matched · diff ${c.diff != null ? pts(c.diff) : '—'}${ci}${months}`;
}
