/*
==================================================
  SLAYER TERMINAL - THE TILT MANAGER (core/paper/tilt.ts)

  A prop firm blows you up when the number hits the
  floor. By then the damage is done, and the number
  was never the problem — the BEHAVIOUR was. This
  watches the behaviour instead, and it is the one
  thing on this desk that will stop a trader who is
  still inside every rule.

  THE PATTERNS IT FLAGS, and why each one is a tell:

    DRAGGING THE STOP   a working stop moved FURTHER
                        from the entry while the
                        position is offside. Not a
                        stop moved up behind a
                        winner, not a stop set wider
                        before the trade is on —
                        the specific act of giving
                        a loser more room while it
                        is already losing.
    REVENGE EXECUTION   stopped out, then back in
                        the SAME direction within a
                        few seconds at more than
                        one and a half times the
                        size. The clock and the
                        multiple are both settings.
    SIZE SPIRAL         a third pattern the first
                        two imply: any entry at more
                        than double the size of the
                        day's average, immediately
                        after a loss.

  THE SCORE AND THE LOCK. Flags inside a rolling
  window add up; at the threshold the desk stops
  taking new orders for a cool-off — a guard on the
  engine, so it refuses at submit with the reason.
  Closing a position is never blocked: a lock-out
  that traps a reader in a trade would be a worse
  rule than the one it enforces.
==================================================
*/

import { useSyncExternalStore } from 'react';
import { getPaperState, markPosition, registerGuard, registerObserver, type EngineEvent, type Order } from './engine';
import { getModes } from './modes';

export type TiltPattern = 'stop-dragged' | 'revenge' | 'size-spiral';

export interface TiltFlag {
  at: number;
  pattern: TiltPattern;
  symbol: string;
  words: string;
}

export interface TiltState {
  flags: TiltFlag[];
  /** Set while the desk is refusing new orders */
  lockedUntil: number | null;
  lockReason: string | null;
  /** How many times the desk has locked this session */
  locks: number;
}

export const PATTERN_WORDS: Record<TiltPattern, string> = {
  'stop-dragged': 'Stop dragged',
  revenge: 'Revenge entry',
  'size-spiral': 'Size spiral',
};

const KEY = 'slayer_paper_tilt_v1';
const KEEP = 60;

function load(): TiltState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<TiltState>;
      return { flags: Array.isArray(v.flags) ? v.flags.slice(0, KEEP) : [], lockedUntil: v.lockedUntil ?? null, lockReason: v.lockReason ?? null, locks: v.locks ?? 0 };
    }
  } catch {
    /* fresh */
  }
  return { flags: [], lockedUntil: null, lockReason: null, locks: 0 };
}

let tilt: TiltState = load();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const getTilt = (): TiltState => tilt;
export const useTilt = (): TiltState => useSyncExternalStore(subscribe, getTilt, getTilt);

function commit(next: Partial<TiltState>): void {
  tilt = { ...tilt, ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(tilt));
  } catch {
    /* the session keeps it */
  }
  listeners.forEach(fn => fn());
}

/** Flags inside the window — the score the threshold is measured against */
export function tiltScore(now = Date.now()): number {
  const w = getModes().tilt.windowMin * 60_000;
  return tilt.flags.filter(f => now - f.at <= w).length;
}

/** True while the desk is refusing new orders */
export function tiltLocked(now = Date.now()): boolean {
  return tilt.lockedUntil != null && tilt.lockedUntil > now;
}

export function clearTilt(): void {
  commit({ flags: [], lockedUntil: null, lockReason: null });
}

/** Let the reader take the cool-off off early — it is a guard rail, not a cage */
export function endLockout(): void {
  commit({ lockedUntil: null, lockReason: null });
}

function flag(pattern: TiltPattern, symbol: string, words: string): void {
  const now = Date.now();
  const flags = [{ at: now, pattern, symbol, words }, ...tilt.flags].slice(0, KEEP);
  commit({ flags });
  const s = getModes().tilt;
  if (!s.on) return;
  if (tiltScore(now) >= s.threshold && !tiltLocked(now)) {
    commit({
      lockedUntil: now + s.lockoutMin * 60_000,
      lockReason: `${tiltScore(now)} flagged actions in ${s.windowMin} minutes`,
      locks: tilt.locks + 1,
    });
  }
}

/* ---- what it watches ----------------------------------------------------------------------- */

interface StopOut {
  at: number;
  instrumentId: string;
  /** The side the CLOSED position was on: + long, − short */
  wasLong: boolean;
  qty: number;
}
let lastStopOut: StopOut | null = null;
/** Sizes of the day's entries, for the spiral read */
let entrySizes: number[] = [];
let lastLossAt = 0;

let stopGuard: (() => void) | null = null;
let stopObserver: (() => void) | null = null;

/** Is this order's position currently under water? */
function offside(o: Order): boolean {
  const st = getPaperState();
  const p = st.positions.find(x => x.id === o.instrumentId && x.qty !== 0);
  if (!p) return false;
  return markPosition(p, st.quotes[p.id]).unrealized < 0;
}

function onEvent(e: EngineEvent): void {
  const s = getModes().tilt;
  if (!s.on) return;

  /* ── the stop dragged further into the red ── */
  if (e.kind === 'modified' && e.order.role === 'stop' && e.source !== 'engine') {
    const before = e.before.stopPrice;
    const now = e.order.stopPrice;
    if (before != null && now != null) {
      const st = getPaperState();
      const p = st.positions.find(x => x.id === e.order.instrumentId && x.qty !== 0);
      if (p) {
        const wider = p.qty > 0 ? now < before : now > before;
        if (wider && offside(e.order)) {
          const away = Math.round(Math.abs(now - before) / e.order.instrument.tickSize);
          flag('stop-dragged', symbolOf(e.order), `the stop was moved ${away} ${away === 1 ? 'tick' : 'ticks'} further out while the trade was losing`);
        }
      }
    }
  }

  /* ── stopped out, then straight back in the same way ── */
  if (e.kind === 'positionClosed') {
    const t = e.trade;
    if (t.realized < 0) lastLossAt = t.closedAt;
    if (e.byRole === 'stop') lastStopOut = { at: t.closedAt, instrumentId: t.instrumentId, wasLong: t.side === 'long', qty: t.qty };
  }

  if (e.kind === 'positionOpened') {
    const p = e.position;
    entrySizes = [...entrySizes.slice(-19), Math.abs(p.qty)];
    const now = Date.now();
    if (lastStopOut && lastStopOut.instrumentId === p.id) {
      const sameWay = lastStopOut.wasLong === p.qty > 0;
      const quick = now - lastStopOut.at <= s.revengeSeconds * 1000;
      const bigger = Math.abs(p.qty) > lastStopOut.qty * s.revengeSizeX;
      if (sameWay && quick && bigger) {
        flag('revenge', p.instrument.symbol, `back in the same direction ${Math.round((now - lastStopOut.at) / 100) / 10}s after the stop, at ${Math.abs(p.qty)} against ${lastStopOut.qty}`);
      }
    }
    if (entrySizes.length >= 4 && now - lastLossAt < 60_000) {
      const avg = entrySizes.slice(0, -1).reduce((a, b) => a + b, 0) / Math.max(1, entrySizes.length - 1);
      if (Math.abs(p.qty) > avg * 2) flag('size-spiral', p.instrument.symbol, `${Math.abs(p.qty)} on the heels of a loss, against a ${avg.toFixed(1)} average`);
    }
  }
}

function symbolOf(o: Order): string {
  return o.instrument.kind === 'future' ? o.instrument.symbol : o.instrument.underlying;
}


export function startTilt(): () => void {
  if (stopGuard) return stopTilt;
  stopGuard = registerGuard('tilt', (req, ctx) => {
    const s = getModes().tilt;
    if (!s.on || !tiltLocked()) return null;
    /* closing is always allowed — a cool-off must never trap a reader in a trade */
    if (req.reduceOnly || ctx.opens === 0) return null;
    const left = Math.max(0, Math.ceil(((tilt.lockedUntil ?? 0) - Date.now()) / 60_000));
    return `Tilt cool-off — ${tilt.lockReason}. New orders in ${left} minute${left === 1 ? '' : 's'}; closing is still open to you`;
  });
  stopObserver = registerObserver(onEvent);
  return stopTilt;
}

export function stopTilt(): void {
  stopGuard?.();
  stopObserver?.();
  stopGuard = null;
  stopObserver = null;
}
