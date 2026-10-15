/*
==================================================
  SLAYER TERMINAL - THE POINT-IN-TIME STORE (server/fieldStore.ts)

  TWO ROWS A MINUTE, A NAME A DAY, NEVER REWRITTEN
  (2026-10-13 — the owner's item 1: "Append-only store,
  per ticker per minute … Never rewritten after the
  fact", and the decision after the data was read:
  "two rows per minute. (a) 'shown': what Terrain
  displayed live, never edited. (b) 'final': written
  by the rebuild path once inputs with event time ≤
  that minute have arrived (at the next chain read).
  Final rows must equal the rebuild exactly (same code
  path). Shown vs final is checked to a tolerance …
  The scorecard reads final rows only").

  A ROW is one minute's column read the way Terrain
  reads it: the minute's spot (its bar's close), the
  flip (the zero crossing nearest spot), the call and
  put walls, the five heaviest strikes with their
  signed dollars a 1% move, the column's net (every
  strike summed — the regime; NOT the flip's side, the
  two agreed in 46% of 330 live columns on 2026-10-13),
  the bead scale's reference (the session's 85th
  percentile of per-column maxima so far, this column
  in — data/feed/beadScale.ts, the renderer's own
  count), every strike drawn, the at-the-money straddle
  for the expiry settling today and for the weekly
  (the NBBO mids at a chain read, the model's price
  between reads — labelled), and the data's age.

  SHOWN rows are written by the recorder a minute at a
  time, from the inputs it had received by the minute's
  end — the same inputs it serves Terrain, through the
  same model (data/feed/trailField.ts universeOf and
  modelColumn) — so a row is the column Terrain drew.
  Written within three minutes of its minute or not at
  all: a minute the recorder missed is a gap, never
  filled in later (a later write could stand on a count
  that landed in between). Pre-market and after-hours
  minutes have rows too, as Terrain draws them.

  FINAL rows are written by the rebuild path (server/
  fieldBackfill.ts today(): the dated chain, the session
  before's close vols, each traded contract's minute
  vols) at each chain read, for the regular session's
  minutes that ended a minute before the inputs were
  asked. The same functions build a past session, so
  the day's final rows and its rebuild after the close
  are one computation on one data set — npm run
  field:agree checks it to the cell, and shown against
  final to the tolerance (median ≤ 1%, p90 ≤ 5%, walls
  and flip equal in ≥ 95% of columns, on a gap-free day).

  ON DISK: .feed-cache/field/<NAME>/<day>/shown.jsonl and
  final.jsonl, append-only (git-ignored; gzipped in
  place as the day turns, never deleted). Served by
  GET /feed/field/<NAME>/store?day=&kind=&since=.
==================================================
*/

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { columnSummary, modelColumn, pastInputs, readAt, straddleExpiries, straddleOfMinute, TRAIL_MODEL, universeOf, type ServerInputs, type StraddleRead, PARTS, PART_STRIDE } from '../src/data/feed/trailModel';
import { RunningMax, RunningScale, columnGross, columnMax } from '../src/data/feed/beadScale';
/** A column's net by expiry partition — every strike's gamma parts summed */
const partNets = (snap: { levels: readonly unknown[]; parts?: Float32Array }): number[] | undefined => {
  const p = snap.parts;
  if (!p || p.length !== snap.levels.length * PART_STRIDE) return undefined;
  const out = new Array(PARTS).fill(0);
  for (let i = 0; i < snap.levels.length; i++) for (let q = 0; q < PARTS; q++) out[q] += p[i * PART_STRIDE + q];
  return out;
};
/** A column's largest |delta exposure| */
const deltaMax = (levels: readonly { dex?: number }[]): number => {
  let m = 0;
  for (const l of levels) {
    const a = Math.abs(l.dex ?? 0);
    if (a > m) m = a;
  }
  return m;
};
import { nyWallTime } from '../src/core/nyTime';
import type { MinuteBar, PastDay } from './fieldBackfill';

const ROOT = join(process.cwd(), '.feed-cache', 'field');
/** The row's own format — a change of what a row holds is a new number */
/* 2 since 2026-10-14 (the owner's B3): a cell carries its gross gamma as a third figure, and a row its largest gross (maxG)
   and the size reference (refG) — a row of format 1 reads as before, the map sizing by |net| where no gross is kept.
   3 since 2026-10-15 (the owner's orbs round 2, item 1): refG is the session's largest node so far (beadScale RunningMax),
   no longer the 85th percentile of the minutes' peaks — a row of format 2 keeps the reference it was drawn against */
export const STORE_FORMAT = 3;
/** A shown row is written this long after its minute at the latest; later, the minute is a gap */
export const SHOWN_LATE_MS = 3 * 60_000;
/** A minute is complete this long after its end (its bar in, its prints reported) */
export const SHOWN_SETTLE_MS = 5_000;
/** A final row waits this long past its minute for a print reported late */
export const FINAL_GRACE_MS = 60_000;

export type Session = 'pre' | 'r' | 'post';
export type RowKind = 'shown' | 'final';
export interface StoreRow {
  f: number;
  kind: RowKind;
  /** The minute's start, epoch ms */
  m: number;
  /** Written, epoch ms */
  at: number;
  model: string;
  session: Session;
  spot: number;
  flip: number | null;
  cw: number | null;
  pw: number | null;
  /** The heaviest strikes, [strike, value] in the house's sign, |value| descending */
  top: [number, number][];
  /** Every strike the column holds summed — the regime (estimated dealer gamma, assumed sign) */
  net: number;
  /** The net by expiry partition (trailModel partOf: the day, to Friday, to monthly OPEX, the rest) — a window's net is
      the sum up to its partition (item 6); absent on rows written before 2026-10-14 */
  netP?: number[];
  /** The column's largest |value| — what the scale counts */
  max: number;
  /** The column's largest |delta exposure| — the delta field's count (item 5's fixed and prior references); absent on
      rows written before 2026-10-14 */
  maxD?: number;
  /** The bead scale's reference: the session's 85th percentile of column maxima so far, this one in */
  ref: number;
  /** The column's largest gross gamma at a strike, and the size reference over it (the session's p85 of per-minute
      peak gross so far, this one in) — a mark's size on the map (the owner's B3); absent on rows of format 1 */
  maxG?: number;
  refG?: number;
  /** Every strike drawn, [strike, value, gross] ascending by strike — the gross since format 2 */
  cells: [number, number, number?][];
  /** The share of the strikes on carried vols */
  carried: number;
  /** The at-the-money straddle for the expiry settling today; null when none is listed or priced */
  str0: StraddleRead | null;
  /** The weekly's */
  strW: StraddleRead | null;
  /** Minutes from the minute's end back to the newest chain read and book it stood on; null on a final row */
  age: { vols: number | null; book: number | null } | null;
}
/** A minute bar as the rows read it (fieldBackfill MinuteBar: the minute's start in seconds, its close, its session) */
export type Bar = MinuteBar;
export interface StoreDay {
  name: string;
  day: string;
  kind: RowKind;
  rows: StoreRow[];
  /** Minutes the recorder missed (shown) or found no column for */
  gaps: number;
}

interface State {
  written: Set<number>;
  scale: RunningScale;
  /** the size reference: the session's largest gross so far */
  scaleG: RunningMax;
  /** The newest minute written — a row never goes in before one already written */
  last: number;
  gaps: number;
  loaded: boolean;
  /** The file's size as this store last saw it — grown by another writer, it is read again before a write */
  size: number;
}

export function createFieldStore(opts: { root?: string; now?: () => number } = {}) {
  const root = opts.root ?? ROOT;
  const clock = opts.now ?? Date.now;
  const states = new Map<string, State>();
  const fileOf = (name: string, day: string, kind: RowKind) => join(root, name, day, `${kind}.jsonl`);

  function readRows(name: string, day: string, kind: RowKind): StoreRow[] {
    const file = fileOf(name, day, kind);
    let text: string | null = null;
    try {
      if (existsSync(file)) text = readFileSync(file, 'utf8');
      else if (existsSync(`${file}.gz`)) text = gunzipSync(readFileSync(`${file}.gz`)).toString('utf8');
    } catch {
      text = null;
    }
    if (!text) return [];
    const out: StoreRow[] = [];
    /* ONE ROW A MINUTE: a minute written twice (two writers before 2026-10-13's lock — a dev server's in-process
       restart left the old recorder ticking) keeps its FIRST row, the one written first — what was shown first */
    const seen = new Set<number>();
    for (const line of text.split('\n')) {
      if (!line) continue;
      try {
        const r = JSON.parse(line) as StoreRow;
        if (seen.has(r.m)) continue;
        seen.add(r.m);
        out.push(r);
      } catch {
        /* a line cut short by a restart: the rest of the file stands */
      }
    }
    return out;
  }
  const sizeOf = (file: string): number => {
    try {
      return statSync(file).size;
    } catch {
      return 0;
    }
  };

  /** The day's state, replayed from its file once: the minutes written and the scale's count */
  function stateOf(name: string, day: string, kind: RowKind): State {
    const key = `${name}|${day}|${kind}`;
    let st = states.get(key);
    const size = sizeOf(fileOf(name, day, kind));
    /* a file another writer grew since this store last saw it is read again — its minutes are written */
    if (!st || st.size !== size) {
      const gaps = st?.gaps ?? 0;
      st = { written: new Set(), scale: new RunningScale(), scaleG: new RunningMax(), last: 0, gaps, loaded: false, size };
      for (const r of readRows(name, day, kind)) {
        st.written.add(r.m);
        st.scale.push(r.max);
        st.scaleG.push(r.maxG ?? r.max);
        if (r.m > st.last) st.last = r.m;
      }
      st.loaded = true;
      states.set(key, st);
    }
    return st;
  }

  function append(name: string, day: string, kind: RowKind, row: StoreRow) {
    try {
      mkdirSync(join(root, name, day), { recursive: true });
      appendFileSync(fileOf(name, day, kind), JSON.stringify(row) + '\n');
    } catch {
      /* a refused disk: the row is lost, the next minute's is tried */
    }
    const st = states.get(`${name}|${day}|${kind}`);
    if (st) st.size = sizeOf(fileOf(name, day, kind));
  }

  const sortedCells = (levels: readonly { strike: number; value: number; gross?: number }[]): [number, number, number?][] => [...levels].sort((a, b) => a.strike - b.strike).map(l => (l.gross != null ? [l.strike, l.value, l.gross] : [l.strike, l.value]));

  /**
   * THE SHOWN ROWS for the minutes ended: the recorder's live inputs (its chain reads and seed, as served to Terrain)
   * and the day's bars so far. Writes and returns the new rows. A minute more than SHOWN_LATE_MS past is a gap.
   */
  function shown(name: string, day: string, inputs: ServerInputs, bars: readonly Bar[], books: readonly { receivedAt: number }[]): StoreRow[] {
    const st = stateOf(name, day, 'shown');
    const now = clock();
    const out: StoreRow[] = [];
    const sorted = [...bars].sort((a, b) => a.time - b.time);
    let u: ReturnType<typeof universeOf> | null = null;
    let exps: { today: string | null; weekly: string | null } | null = null;
    for (const bar of sorted) {
      const m = bar.time * 1000;
      const end = m + 60_000;
      if (end > now - SHOWN_SETTLE_MS) break;
      if (st.written.has(m)) continue;
      if (now - end > SHOWN_LATE_MS || m < st.last) {
        /* the recorder was not here for it: a gap, never filled in */
        st.written.add(m);
        st.gaps++;
        continue;
      }
      if (!u) {
        u = universeOf(name, day, inputs);
        exps = straddleExpiries(u.expiry, day);
      }
      const snap = modelColumn(u, bar);
      st.written.add(m);
      st.last = m;
      if (!snap.levels.length) {
        st.gaps++;
        continue;
      }
      const sum = columnSummary(snap, bar.close);
      const max = columnMax(snap.levels);
      const maxD = deltaMax(snap.levels);
      const ref = st.scale.push(max);
      const maxG = columnGross(snap.levels);
      const refG = st.scaleG.push(maxG);
      /* a chain read inside the minute: the straddles are its NBBO mids; else the model's price at the minute — the one
         rule the replay reads too (trailModel straddleOfMinute) */
      const straddle = (expiry: string | null): StraddleRead | null => (expiry ? straddleOfMinute(u!, inputs.chains, day, bar, expiry, 'shown') : null);
      const r = readAt(u, end);
      let book = 0;
      for (const b of books) if (b.receivedAt <= end && b.receivedAt > book) book = b.receivedAt;
      const row: StoreRow = {
        f: STORE_FORMAT,
        kind: 'shown',
        m,
        at: now,
        model: TRAIL_MODEL.version,
        session: bar.session,
        spot: bar.close,
        flip: sum.flip,
        cw: sum.cw,
        pw: sum.pw,
        top: sum.top,
        net: sum.net,
        max,
        maxD,
        maxG,
        netP: partNets(snap),
        ref,
        refG,
        cells: sortedCells(snap.levels),
        carried: sum.carried,
        str0: straddle(exps!.today),
        strW: straddle(exps!.weekly),
        age: { vols: r > 0 ? (end - r) / 60_000 : null, book: book > 0 ? (end - book) / 60_000 : null },
      };
      append(name, day, 'shown', row);
      out.push(row);
    }
    return out;
  }

  /** The rebuild path's inputs for a day — one mapping, the page's (data/feed/levels.ts loadPastDay) and the store's */
  const inputsOf = (past: PastDay): ServerInputs => pastInputs(past);

  /**
   * THE FINAL ROWS from today's rebuild so far (fieldBackfill today().advance()): the regular session's minutes that
   * ended FINAL_GRACE_MS before `through`, the moment the inputs were asked — the same functions a past session is
   * built with, so the rows equal the session's rebuild. Writes and returns the new rows.
   */
  function final(name: string, day: string, past: PastDay & { through: number }, bars: readonly Bar[]): StoreRow[] {
    const st = stateOf(name, day, 'final');
    const [y, mo, d] = day.split('-').map(Number);
    const from = nyWallTime(y, mo, d, 9, 30);
    const to = nyWallTime(y, mo, d, 16, 0);
    const u = universeOf(name, day, inputsOf(past));
    const exps = straddleExpiries(u.expiry, day);
    const out: StoreRow[] = [];
    for (const bar of [...bars].sort((a, b) => a.time - b.time)) {
      const m = bar.time * 1000;
      if (m < from || m >= to) continue;
      const end = m + 60_000;
      if (end > past.through - FINAL_GRACE_MS) break;
      if (st.written.has(m)) continue;
      if (m < st.last) {
        st.written.add(m);
        st.gaps++;
        continue;
      }
      const snap = modelColumn(u, bar);
      st.written.add(m);
      st.last = m;
      if (!snap.levels.length) {
        st.gaps++;
        continue;
      }
      const sum = columnSummary(snap, bar.close);
      const max = columnMax(snap.levels);
      const maxD = deltaMax(snap.levels);
      const ref = st.scale.push(max);
      const maxG = columnGross(snap.levels);
      const refG = st.scaleG.push(maxG);
      const row: StoreRow = {
        f: STORE_FORMAT,
        kind: 'final',
        m,
        at: clock(),
        model: TRAIL_MODEL.version,
        session: 'r',
        spot: bar.close,
        flip: sum.flip,
        cw: sum.cw,
        pw: sum.pw,
        top: sum.top,
        net: sum.net,
        max,
        maxD,
        maxG,
        netP: partNets(snap),
        ref,
        refG,
        cells: sortedCells(snap.levels),
        carried: sum.carried,
        str0: exps.today ? straddleOfMinute(u, [], day, bar, exps.today, 'final') : null,
        strW: exps.weekly ? straddleOfMinute(u, [], day, bar, exps.weekly, 'final') : null,
        age: null,
      };
      append(name, day, 'final', row);
      out.push(row);
    }
    return out;
  }

  /** A whole session's rows from a finished rebuild (the agree check, and a past day's final rows): the same code
      as final(), every regular minute, nothing written */
  function rowsOf(past: PastDay, bars: readonly Bar[]): StoreRow[] {
    const [y, mo, d] = past.day.split('-').map(Number);
    const from = nyWallTime(y, mo, d, 9, 30);
    const to = nyWallTime(y, mo, d, 16, 0);
    const u = universeOf(past.name, past.day, inputsOf(past));
    const exps = straddleExpiries(u.expiry, past.day);
    const scale = new RunningScale();
    const scaleG = new RunningMax();
    const out: StoreRow[] = [];
    for (const bar of [...bars].sort((a, b) => a.time - b.time)) {
      const m = bar.time * 1000;
      if (m < from || m >= to) continue;
      const snap = modelColumn(u, bar);
      if (!snap.levels.length) continue;
      const sum = columnSummary(snap, bar.close);
      const max = columnMax(snap.levels);
      const maxG = columnGross(snap.levels);
      out.push({ f: STORE_FORMAT, kind: 'final', m, at: 0, model: TRAIL_MODEL.version, session: 'r', spot: bar.close, flip: sum.flip, cw: sum.cw, pw: sum.pw, top: sum.top, net: sum.net, max, maxD: deltaMax(snap.levels), maxG, netP: partNets(snap), ref: scale.push(max), refG: scaleG.push(maxG), cells: sortedCells(snap.levels), carried: sum.carried, str0: exps.today ? straddleOfMinute(u, [], past.day, bar, exps.today, 'final') : null, strW: exps.weekly ? straddleOfMinute(u, [], past.day, bar, exps.weekly, 'final') : null, age: null });
    }
    return out;
  }

  /** GET /feed/field/<NAME>/store?day=<D>&kind=shown|final&since=<minute ms> */
  function serve(rawName: string, day: string, kind: string, since = 0): { status: number; body: string } {
    const name = rawName.toUpperCase();
    if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(name) || !/^\d{4}-\d{2}-\d{2}$/.test(day) || (kind !== 'shown' && kind !== 'final')) return { status: 400, body: JSON.stringify({ error: 'bad-request' }) };
    const st = stateOf(name, day, kind);
    const rows = readRows(name, day, kind).filter(r => r.m > since);
    const answer: StoreDay = { name, day, kind, rows, gaps: st.gaps };
    return { status: 200, body: JSON.stringify(answer) };
  }

  /** The days a name has store rows for, ascending */
  function days(name: string): string[] {
    try {
      return readdirSync(join(root, name.toUpperCase()))
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && (['shown.jsonl', 'final.jsonl', 'shown.jsonl.gz', 'final.jsonl.gz'].some(f => existsSync(join(root, name.toUpperCase(), d, f)))))
        .sort();
    } catch {
      return [];
    }
  }

  return { shown, final, rowsOf, serve, days, readRows, inputsOf };
}
export type FieldStore = ReturnType<typeof createFieldStore>;
