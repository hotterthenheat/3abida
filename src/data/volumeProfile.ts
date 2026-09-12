import { sessionStarts } from './indicators';
import type { Candle } from '../types/market';

/*
==================================================
  SLAYER TERMINAL - VOLUME PROFILE (data/volumeProfile.ts)

  Volume by PRICE for the session — VPOC and the
  value area, T-10's engine.
==================================================

  The rail's exposure column says where the BOOK is heavy; this says where
  the TAPE has actually traded. A gamma wall with no traded volume behind it
  is a different animal from one where price has spent hours — which is why
  the directive wants the two on one axis, and why this engine exists.

  BARS, NOT TRADES. The feed seam carries OHLCV bars, so each bar's volume
  is spread across the price bins its high–low range covers, proportional to
  overlap — a bar that spent its minute across three bins leaves a third of
  its volume in each; a bar that never left one bin leaves everything there.
  When a per-trade feed lands, the same bins accept exact prices and nothing
  downstream moves.

  THE SESSION'S, by the same gap cut every session feature uses. A profile
  spanning many days answers a different question (composite value), and the
  rail is a today instrument.

  VPOC is the heaviest bin — ties resolve toward the LAST CLOSE, because a
  flat-topped profile read from the market's own position is the honest tie.
  THE VALUE AREA is the standard 70%: start at the VPOC, repeatedly annex
  the heavier adjacent bin (ties upward, the TPO convention), stop when the
  area holds at least 70% of the session's volume. VAH/VAL are the outer
  EDGES of the area's end bins — the prices value runs to, not the centres
  of the bins that happen to hold it.
*/

export const VALUE_AREA_FRACTION = 0.7;
/** Bin count the wrapper aims the session's range at. */
export const TARGET_BINS = 48;

export interface VolumeProfileBin {
  /** Bin centre price. */
  price: number;
  volume: number;
}

export interface VolumeProfile {
  bins: VolumeProfileBin[];
  binSize: number;
  totalVolume: number;
  /** Heaviest bin's centre — null on an empty or volumeless session. */
  vpoc: number | null;
  /** Value-area high/low — outer edges of the 70% area. Null with vpoc. */
  vah: number | null;
  val: number | null;
}

const EMPTY: VolumeProfile = { bins: [], binSize: 0, totalVolume: 0, vpoc: null, vah: null, val: null };

/**
 * The profile of the CURRENT session in `bars1m`, at an explicit bin size.
 * `sessionVolumeProfile` below picks the size; proofs pin this directly.
 */
export function buildVolumeProfile(sessionBars: readonly Candle[], binSize: number): VolumeProfile {
  if (sessionBars.length === 0 || !(binSize > 0)) return EMPTY;
  let lo = Infinity;
  let hi = -Infinity;
  for (const b of sessionBars) {
    if (b.low < lo) lo = b.low;
    if (b.high > hi) hi = b.high;
  }
  if (!(hi >= lo)) return EMPTY;

  const base = Math.floor(lo / binSize) * binSize;
  const n = Math.max(1, Math.floor((hi - base) / binSize) + 1);
  const vols = new Array<number>(n).fill(0);

  for (const b of sessionBars) {
    if (!(b.volume > 0)) continue;
    if (b.high === b.low) {
      const i = Math.min(n - 1, Math.max(0, Math.floor((b.high - base) / binSize)));
      vols[i] += b.volume;
      continue;
    }
    /* Overlap-proportional spread across the bins the bar's range covers. */
    const span = b.high - b.low;
    const first = Math.max(0, Math.floor((b.low - base) / binSize));
    const last = Math.min(n - 1, Math.floor((b.high - base) / binSize));
    for (let i = first; i <= last; i++) {
      const binLo = base + i * binSize;
      const overlap = Math.min(b.high, binLo + binSize) - Math.max(b.low, binLo);
      if (overlap > 0) vols[i] += b.volume * (overlap / span);
    }
  }

  const total = vols.reduce((a, v) => a + v, 0);
  const bins: VolumeProfileBin[] = vols.map((v, i) => ({ price: base + (i + 0.5) * binSize, volume: v }));
  if (!(total > 0)) return { bins, binSize, totalVolume: 0, vpoc: null, vah: null, val: null };

  /* VPOC — heaviest, ties toward the last close. */
  const lastClose = sessionBars[sessionBars.length - 1].close;
  let poc = 0;
  for (let i = 1; i < n; i++) {
    if (vols[i] > vols[poc] || (vols[i] === vols[poc] && Math.abs(bins[i].price - lastClose) < Math.abs(bins[poc].price - lastClose))) {
      poc = i;
    }
  }

  /* The 70% area, annexed bin by bin from the VPOC — ties upward. */
  let loI = poc;
  let hiI = poc;
  let held = vols[poc];
  const target = total * VALUE_AREA_FRACTION;
  while (held < target && (loI > 0 || hiI < n - 1)) {
    const up = hiI < n - 1 ? vols[hiI + 1] : -1;
    const dn = loI > 0 ? vols[loI - 1] : -1;
    if (up >= dn) {
      hiI++;
      held += up;
    } else {
      loI--;
      held += dn;
    }
  }

  return {
    bins,
    binSize,
    totalVolume: total,
    vpoc: bins[poc].price,
    vah: base + (hiI + 1) * binSize,
    val: base + loI * binSize,
  };
}

/** Today's profile for a ticker's base bars — the session cut plus a bin
    size aimed at TARGET_BINS across the session's own range. */
export function sessionVolumeProfile(bars1m: readonly Candle[]): VolumeProfile {
  if (bars1m.length === 0) return EMPTY;
  const starts = sessionStarts(bars1m, 1);
  const sess = bars1m.slice(starts[starts.length - 1]);
  let lo = Infinity;
  let hi = -Infinity;
  for (const b of sess) {
    if (b.low < lo) lo = b.low;
    if (b.high > hi) hi = b.high;
  }
  const range = hi - lo;
  if (!(range >= 0)) return EMPTY;
  /* A one-price session still gets one bin rather than a zero division. */
  const binSize = range > 0 ? range / TARGET_BINS : Math.max(0.01, hi * 0.0005);
  return buildVolumeProfile(sess, binSize);
}
