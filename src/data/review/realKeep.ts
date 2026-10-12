/*
==================================================
  SLAYER TERMINAL - REVIEW · WHAT A REAL DAY WRITES
  DOWN (data/review/realKeep.ts)

  A session on real days (market.ts) reads Massive's
  record while its desk is open. What has to outlast
  the visit is written into the session as it changes,
  so the session list, the report and the journal never
  ask the record again — and never fall back on the
  house's tape for a trade that was not made on it:

    marks   what each open contract last showed — the
            list's "worth now" while the record is out
    held    a closed trade, walked once on the record
            that priced it: what it was worth minute by
            minute (only minutes it traded count), its
            best and its worst — the paper account's
            HeldRecord shape, so the journal reads both
            alike (excursion.ts)
    paths   the name's candles from the way in's open to
            the way out's bell — TradePath, what the
            journal's chart draws
==================================================
*/

import { bookOf, type Session } from './engine';
import { walkOption } from './excursion';
import { marketOf } from './market';
import { barTime } from './tape';
import { pathOf, type HeldRecord, type TradePath } from '../paper/engine';
import type { Candle } from '../../types/market';

/** A closed trade keeps this many of its points, and this many candles; a session keeps this many trades' candles */
const HELD_KEEP = 120;
const PATH_KEEP = 400;
const PATHS_MOST = 200;

/** The session after a change, with what a real day writes down — a house session comes back as it went in */
export function keepReal(before: Session, after: Session): Session {
  if (after.src !== 'feed' || !after.real) return after;
  const mk = marketOf(after);
  if (!mk.ready) return after;
  const { positions, trades } = bookOf(after);
  const marks: Record<string, number> = {};
  for (const p of positions) marks[p.key] = mk.quoteAt(p.contract, after.cursor.day, after.cursor.minute).mark;
  const had = new Set(bookOf(before).trades.map(t => t.id));
  const fresh = trades.filter(t => !had.has(t.id) && !after.real?.held?.[t.id]);
  if (!fresh.length) return { ...after, real: { ...after.real, marks } };
  const held: Record<string, HeldRecord> = { ...after.real.held };
  const paths: Record<string, TradePath> = { ...after.real.paths };
  for (const t of fresh) {
    const pts = walkOption(after, t, mk);
    if (pts.length) {
      let best = pts[0];
      let worst = pts[0];
      for (const p of pts) {
        if (p.pnl > best.pnl) best = p;
        if (p.pnl < worst.pnl) worst = p;
      }
      const every = Math.max(1, Math.ceil(pts.length / HELD_KEEP));
      held[t.id] = {
        pts: pts.filter((_, i) => i % every === 0 || i === pts.length - 1).map(p => [p.time * 1000, p.pnl, p.value, p.name]),
        best: best.pnl,
        bestAt: best.time * 1000,
        worst: worst.pnl,
        worstAt: worst.time * 1000,
      };
    }
    /* the name's candles: the way in's whole day to the way out's bell */
    const bars: Candle[] = [];
    for (let d: string | null = t.opened.day, n = 0; d && n < 40; d = mk.nextDay(d), n++) {
      bars.push(...mk.dayBars(t.contract.ticker, d));
      if (d >= t.closed.day) break;
    }
    const path = pathOf(bars, barTime(t.opened.day, 0), barTime(t.closed.day, 389), 0.01, PATH_KEEP);
    if (path) paths[t.id] = path;
  }
  /* at most PATHS_MOST trades' candles: the oldest go first */
  const ids = Object.keys(paths);
  if (ids.length > PATHS_MOST) for (const id of trades.map(t => t.id).filter(id => paths[id]).slice(0, ids.length - PATHS_MOST)) delete paths[id];
  return { ...after, real: { ...after.real, marks, held, paths } };
}
