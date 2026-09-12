import { sessionStarts } from './indicators';
import type { Candle, GexSnapshot } from '../types/market';

/*
==================================================
  SLAYER TERMINAL - ΔOI HEAT (data/oiHeat.ts)

  Which strikes are being BUILT and UNWOUND right
  now — P-8.
==================================================

  EVERY OTHER EXPOSURE SURFACE ON THIS DESK IS A SNAPSHOT OF A STOCK. This
  one is the flow. The map answers "where is the gamma"; it cannot answer
  "is that wall growing or dying", and those are different trades: a shelf
  being added to all morning is one a desk is committed to, and one bleeding
  since the open is one that will not be there this afternoon.

  CHANGE, NOT LEVEL. Cells carry the DIFFERENCE between consecutive
  snapshots, which is the whole point — a strike sitting at 40,000 contracts
  all day is invisible here, and should be. The heat scale is therefore
  symmetric around zero: building and unwinding are opposite readings of the
  same magnitude, not a big number and a small one.

  THE COLUMNS ARE THE SNAPSHOT GRID, SUBSAMPLED. Snapshots arrive per bar,
  which is far more columns than a reader can use or a table can show, so
  the session is divided into BUCKETS and each cell is the NET change across
  its bucket. Net, not sum-of-absolutes: a strike built and unwound inside
  one bucket did nothing, and should read as nothing.

  TODAY ONLY. The question is "right now", and a grid spanning the whole
  buffer would answer a different one while wearing the same label. The
  session cut is the bars' own — the same one every session feature uses —
  so this cannot disagree with the tape about where the day began.

  ── THE FLEX GAP, STATED RATHER THAN PAPERED OVER ────────────────────────

  The directive's differentiator here is the FLEX OI TRANSFER field:
  everyone computes ΔOI from raw open interest, but FLEX transfers move OI
  between books with no trade behind them and corrupt exactly that
  computation. The field that separates them comes from the feed's
  oi-change endpoint, which is not on this account.

  So `flexTransfer` is on the row and is always null today, and the surface
  renders that as an em-dash rather than a zero — because zero is a claim
  ("no transfers happened") and null is the truth ("we cannot see them").
  When the endpoint lands, the engine fills the field and the two values
  show side by side exactly as the directive asks. Nothing else changes.
*/

export interface OiHeatCell {
  /** Bucket start, unix seconds. */
  time: number;
  /** Net change in total OI (calls + puts) across the bucket. */
  deltaOi: number;
  /** Net change, calls only. */
  deltaCall: number;
  /** Net change, puts only. */
  deltaPut: number;
  /*
    The part of deltaOi that moved between books WITHOUT a trade. Null until
    the feed's oi-change endpoint is on the account — never zero, because
    zero would be a claim we cannot support. See the header.
  */
  flexTransfer: number | null;
}

export interface OiHeatRow {
  strike: number;
  cells: OiHeatCell[];
  /** Net change across the whole session — the row's own verdict. */
  netToday: number;
}

export interface OiHeat {
  rows: OiHeatRow[];
  /** Bucket starts, in order — the column headings. */
  columns: number[];
  /** Largest |cell| anywhere, for the symmetric heat scale. */
  maxAbs: number;
  /** True when the snapshots carry OI at all — false on an older fixture. */
  hasOi: boolean;
  /** True once a feed supplies the FLEX split. */
  hasFlex: boolean;
}

const EMPTY: OiHeat = { rows: [], columns: [], maxAbs: 0, hasOi: false, hasFlex: false };

/**
 * The heat grid for today.
 *
 * @param snaps  the ticker's GEX snapshots, oldest first (they carry OI)
 * @param bars   the ticker's 1-minute bars — supplies the session cut
 * @param buckets how many columns to divide the session into
 */
export function buildOiHeat(
  snaps: readonly GexSnapshot[],
  bars: readonly Candle[],
  buckets = 8
): OiHeat {
  if (snaps.length < 2 || buckets < 1) return EMPTY;

  /* Today's snapshots, by the bars' own session cut. */
  const starts = sessionStarts(bars, 1);
  const dayStart = starts.length > 0 && bars.length > 0 ? bars[starts[starts.length - 1]].time : -Infinity;
  const today = snaps.filter(s => s.time >= dayStart);
  if (today.length < 2) return EMPTY;

  /* OI has to actually be there. A snapshot without it must not be read as
     "no change" — that is the difference between absence and zero. */
  const hasOi = today.some(s => s.levels.some(l => l.callOI !== undefined || l.putOI !== undefined));
  if (!hasOi) return { ...EMPTY, columns: [], hasOi: false };

  const first = today[0].time;
  const last = today[today.length - 1].time;
  const span = Math.max(1, last - first);
  const width = span / buckets;
  const columns = Array.from({ length: buckets }, (_, i) => Math.round(first + i * width));

  /* Every strike that appears at any point today — a strike that entered the
     window mid-session is exactly the kind of building this surface exists
     to show, so it must not be dropped for missing the first snapshot. */
  const strikes = new Set<number>();
  for (const s of today) for (const l of s.levels) strikes.add(l.strike);

  const oiAt = (snap: GexSnapshot, strike: number): { c: number; p: number } | null => {
    const l = snap.levels.find(x => x.strike === strike);
    if (!l || (l.callOI === undefined && l.putOI === undefined)) return null;
    return { c: l.callOI ?? 0, p: l.putOI ?? 0 };
  };

  let maxAbs = 0;
  const rows: OiHeatRow[] = [];
  for (const strike of [...strikes].sort((a, b) => b - a)) {
    const cells: OiHeatCell[] = columns.map((colStart, i) => {
      const colEnd = i + 1 < columns.length ? columns[i + 1] : last + 1;
      /* The bucket's net change: its last reading minus the one before its
         first. Consecutive differencing inside the bucket would sum to the
         same thing but cost a pass; this states the intent directly. */
      const inBucket = today.filter(s => s.time >= colStart && s.time < colEnd);
      if (inBucket.length === 0) return { time: colStart, deltaOi: 0, deltaCall: 0, deltaPut: 0, flexTransfer: null };
      const beforeIdx = today.findIndex(s => s.time >= colStart) - 1;
      const before = beforeIdx >= 0 ? oiAt(today[beforeIdx], strike) : oiAt(inBucket[0], strike);
      const after = oiAt(inBucket[inBucket.length - 1], strike);
      if (!before || !after) return { time: colStart, deltaOi: 0, deltaCall: 0, deltaPut: 0, flexTransfer: null };
      const deltaCall = after.c - before.c;
      const deltaPut = after.p - before.p;
      const deltaOi = deltaCall + deltaPut;
      if (Math.abs(deltaOi) > maxAbs) maxAbs = Math.abs(deltaOi);
      return { time: colStart, deltaOi, deltaCall, deltaPut, flexTransfer: null };
    });
    rows.push({ strike, cells, netToday: cells.reduce((a, c) => a + c.deltaOi, 0) });
  }

  return { rows, columns, maxAbs, hasOi: true, hasFlex: false };
}

/** What a row's session says, in the desk's voice. */
export function rowWords(row: OiHeatRow): string {
  if (row.netToday === 0) return 'unchanged today';
  const n = Math.abs(row.netToday).toLocaleString();
  return row.netToday > 0
    ? `+${n} contracts built here today — this shelf is being added to`
    : `−${n} contracts unwound here today — this shelf is bleeding`;
}
