import { TIMEFRAMES, type Timeframe } from '../../data/timeframe';
import type {
  ChartIndicators,
  ChartOverlays,
  ChartStyle,
  CompareEntry,
  CompareMode,
  PriceScale,
} from '../../components/gex/StrikeChart';

/*
==================================================
  SLAYER TERMINAL - SYMBOL SETUPS (terrain/setups.ts)

  How a symbol remembers the way it was last set
  up, so picking it again brings that back.
==================================================

  WHY THIS EXISTS.

  A reader's NVDA trendlines already follow the NAME — drawings are stored per
  ticker. Their NVDA interval followed the SLOT. So switching a pane to NVDA
  restored the drawings and lost everything else, which is the kind of
  half-memory that reads as forgetfulness rather than as a decision.

  WHAT FOLLOWS THE SYMBOL, AND WHAT DOES NOT.

  Only the five chart fields in SETUP_KEYS. `ticker` and `ladder` stay with the
  slot: the rail is a 132px WIDTH decision that belongs to the arrangement, and
  the desk-wide Strikes button reads the panes precisely so it can never
  disagree with the screen — make the rail per-symbol and that button starts
  lying one symbol-switch later.

  AN ENTRY IS EARNED BY TOUCH, NOT BY DISPLAY.

  A symbol enters this map only when the reader moves a control while it is up,
  never because a pane happened to show it. That one rule is what makes the
  feature unsurprising: a pane can only ever be moved back to a setting the
  reader themselves chose for that name, and a symbol that has never been
  configured inherits whatever pane it lands in — which is byte-for-byte the
  behaviour before any of this existed. It also means there is no
  default-valued noise to prune later.

  This module holds no storage and no React. It is pure enough to be proved by
  a script, and its imports from StrikeChart are TYPE-ONLY on purpose: a value
  import would drag the charting library in and a plain `tsx` run could not
  load it.
*/

export interface SymbolSetup {
  timeframe: Timeframe;
  overlays: ChartOverlays;
  indicators: ChartIndicators;
  chartStyle: ChartStyle;
  compares: CompareEntry[];
  /* The main price axis's mode (T-7). It follows the SYMBOL rather than the
     slot for the same reason the interval does: log is a decision about a
     name's price behaviour, not about which box on the desk it landed in. */
  priceScale: PriceScale;
}

/** What is actually on disk. Every field optional, because validation drops
    fields rather than whole records — see `readSetup`. */
export type StoredSetup = Partial<SymbolSetup> & { seen: number };
export type SetupMap = Record<string, StoredSetup>;

/** THE list. Capture, apply and the touched-a-control test all read it, so a
    field either follows the symbol in all three or in none of them. */
export const SETUP_KEYS = ['timeframe', 'overlays', 'indicators', 'chartStyle', 'compares', 'priceScale'] as const;

/*
  Key lists written as `satisfies Record<keyof T, …>` rather than as a bare
  array: a missing key is a compile error here (TS1360) and an extra one is
  too (TS2353). Add a fifth overlay to StrikeChart and this file fails the
  build, instead of silently never persisting it.
*/
const OVERLAY_KEYS = Object.keys({
  trails: 0, levels: 0, darkpool: 0, volume: 0, flow: 0, netDrift: 0, volDrift: 0, dexStrike: 0, session: 0, cone: 0, events: 0, alerts: 0,
} satisfies Record<keyof ChartOverlays, number>) as (keyof ChartOverlays)[];

const INDICATOR_KEYS = Object.keys({
  ema9: 0, ema21: 0, ema50: 0, vwap: 0, bb: 0, vwapBands: 0, sma: 0, rsi: 0, macd: 0, atrPane: 0,
} satisfies Record<keyof ChartIndicators, number>) as (keyof ChartIndicators)[];

const STYLE_KEYS = Object.keys({
  candles: 0, hollow: 0, bars: 0, line: 0, step: 0, area: 0, baseline: 0,
} satisfies Record<ChartStyle, number>) as ChartStyle[];

const SCALE_KEYS = Object.keys({
  normal: 0, log: 0, percent: 0, indexed: 0,
} satisfies Record<PriceScale, number>) as PriceScale[];

const TF_VALUES = new Set<string>(TIMEFRAMES.map(t => t.value));
const STYLE_VALUES = new Set<string>(STYLE_KEYS);
const SCALE_VALUES = new Set<string>(SCALE_KEYS);
const COMPARE_MODES = new Set<string>(['percent', 'scale', 'pane'] satisfies CompareMode[]);

/*
  Sixty, argued from bytes rather than taste: one full entry with a comparison
  serialises to about 360 bytes, so sixty of them is ~21 KB against a 5 MB
  quota — four thousandths of it. A reader who has hand-configured more than
  sixty distinct names will not miss the sixty-first-oldest, and eviction drops
  a SETUP, never a pane — an evicted symbol simply inherits the pane again next
  time it is picked.

  The figures are MEASURED by `terrain-setups-proof.ts`, which prints both and
  holds the total under one percent of the quota. They were "240 bytes, ~14 KB"
  here until T-7's sixth field moved them, which is how a number written in a
  comment goes quietly wrong; the proof prints the live pair every run.
*/
export const SETUP_CAP = 60;

/** Symbols are compared and stored upper-case, so `spy` and `SPY` are one
    name rather than two entries that overwrite each other's work. */
export const symKey = (t: string): string => t.trim().toUpperCase();

export const captureSetup = (p: SymbolSetup, now: number): StoredSetup => ({
  timeframe: p.timeframe,
  overlays: { ...p.overlays },
  indicators: { ...p.indicators },
  chartStyle: p.chartStyle,
  compares: p.compares.map(c => ({ ...c })),
  priceScale: p.priceScale,
  seen: now,
});

/*
  With nothing saved this reduces to `base` — which is why the first time a
  reader picks a symbol they have never configured, the pane keeps exactly the
  settings it already had. That is the old behaviour, preserved on purpose.
*/
export const applySetup = <T extends SymbolSetup>(base: T, saved: StoredSetup | undefined): T => ({
  ...base,
  ...(saved ?? {}),
});

const isStr = (v: unknown): v is string => typeof v === 'string';

/*
  FIELD-level validation, and that is the whole point of it.

  A record-level check would throw away a reader's whole NVDA setup because one
  interval was retired. Here each field stands or falls alone.

  Conditional ASSIGNMENT, never `{ timeframe: ok ? v : undefined }`: applySetup
  spreads the stored object over the pane's current settings, and a key whose
  value is literally `undefined` overwrites rather than falls through — it
  would blank the very field it was trying to skip.
*/
export function readSetup(raw: unknown, key: string): StoredSetup | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: StoredSetup = { seen: typeof r.seen === 'number' && Number.isFinite(r.seen) ? r.seen : 0 };

  if (isStr(r.timeframe) && TF_VALUES.has(r.timeframe)) out.timeframe = r.timeframe as Timeframe;
  if (isStr(r.chartStyle) && STYLE_VALUES.has(r.chartStyle)) out.chartStyle = r.chartStyle as ChartStyle;
  /* Absent on every record written before T-7, and that is the whole design of
     this function: a missing field is simply not assigned, so `applySetup`
     spreads over it and the pane keeps the scale it already had. No migration,
     no default written into a reader's stored setup. */
  if (isStr(r.priceScale) && SCALE_VALUES.has(r.priceScale)) out.priceScale = r.priceScale as PriceScale;

  /* Rebuilt key by key rather than taken whole, so junk keys are dropped
     instead of multiplied across up to sixty symbols. */
  if (typeof r.overlays === 'object' && r.overlays !== null) {
    const src = r.overlays as Record<string, unknown>;
    const o: Partial<ChartOverlays> = {};
    for (const k of OVERLAY_KEYS) if (typeof src[k] === 'boolean') o[k] = src[k] as boolean;
    /*
      MIGRATED, not discarded — and the difference is a reader's stored work.

      This was `length === OVERLAY_KEYS.length`: a record had to carry EVERY
      overlay or the whole field was thrown away. That is fine until an overlay
      is ADDED, at which point every setup ever saved is one key short and every
      symbol silently loses all of its overlays at once — up to sixty of them,
      for a key the reader has never heard of. Measured before the fix: adding
      `flow` dropped the overlays field from every stored symbol.

      A missing key now falls back to FALSE rather than to DEFAULT_OVERLAYS, and
      that is deliberate twice over. An overlay a reader never saw cannot have
      been chosen by them, so off is the honest reading of their intent. And
      importing the defaults here would pull a React component module into a
      file whose whole point is running headless in the proof.

      The floor stays at ONE recognised boolean, which is what keeps junk out:
      `{ trails: 'yes', ghost: true }` still yields no overlays at all rather
      than a full set of invented ones.
    */
    if (Object.keys(o).length > 0) {
      const filled = {} as ChartOverlays;
      for (const k of OVERLAY_KEYS) filled[k] = o[k] ?? false;
      out.overlays = filled;
    }
  }
  /*
    THE SAME MIGRATION, and it is here because the fix above was applied to one
    of the two fields that needed it.

    This read `length === INDICATOR_KEYS.length` — the exact test the overlay
    block above was rewritten to stop using, sitting two lines below the comment
    explaining why it is wrong. `INDICATOR_KEYS` is currently the four EMAs and
    VWAP; the moment a fifth is added — RSI, MACD, Bollinger, anything — every
    stored record is one key short, fails the equality, and every symbol loses
    all of its indicators at once. Up to sixty of them, silently, for a key the
    reader has never heard of.

    Identical rule to the overlays, for the identical reason: a missing key
    falls back to FALSE (an indicator a reader never saw cannot have been chosen
    by them), and the floor stays at ONE recognised boolean so junk still yields
    nothing rather than a full set of invented values.
  */
  if (typeof r.indicators === 'object' && r.indicators !== null) {
    const src = r.indicators as Record<string, unknown>;
    const o: Partial<ChartIndicators> = {};
    for (const k of INDICATOR_KEYS) if (typeof src[k] === 'boolean') o[k] = src[k] as boolean;
    if (Object.keys(o).length > 0) {
      const filled = {} as ChartIndicators;
      for (const k of INDICATOR_KEYS) filled[k] = o[k] ?? false;
      out.indicators = filled;
    }
  }

  if (Array.isArray(r.compares)) {
    out.compares = r.compares
      .filter((c): c is CompareEntry => {
        if (typeof c !== 'object' || c === null) return false;
        const e = c as Record<string, unknown>;
        if (!isStr(e.ticker) || !isStr(e.ink) || !isStr(e.mode) || !COMPARE_MODES.has(e.mode)) return false;
        /* A symbol cannot be crossed onto its own tape. The pane guards this
           when a comparison is ADDED; the stored copy has to guard it too, or
           a setup written before a rename could put a symbol against itself. */
        return symKey(e.ticker) !== key;
      })
      .slice(0, 4);
  }
  return out;
}

/** Symbols are 1–8 of A–Z, 0–9, dot or dash. Anything else is not a ticker and
    is not something this map should be carrying. */
const KEY_RE = /^[A-Z0-9.\-]{1,8}$/;

export function readSetups(raw: unknown): SetupMap {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: SetupMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = symKey(k);
    if (!KEY_RE.test(key)) continue;
    const setup = readSetup(v, key);
    if (setup) out[key] = setup;
  }
  return evict(out);
}

export function evict(map: SetupMap, cap = SETUP_CAP): SetupMap {
  const keys = Object.keys(map);
  if (keys.length <= cap) return map;
  /* Oldest-touched go first. Ties fall back to insertion order, which only
     ever matters at the cap and where either answer is defensible. */
  const ordered = keys.sort((a, b) => map[a].seen - map[b].seen).slice(keys.length - cap);
  const out: SetupMap = {};
  for (const k of ordered) out[k] = map[k];
  return out;
}
