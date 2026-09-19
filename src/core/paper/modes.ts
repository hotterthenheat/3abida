/*
==================================================
  SLAYER TERMINAL - THE DESK'S MODES
  (core/paper/modes.ts)

  Three ways to run the same engine:

    STANDARD    the desk as it is — a real spread, a
                real walk past the touch, real fees
    PROP FIRM   an evaluation account: futures only,
                a trailing drawdown that liquidates
                and locks, a bell you cannot hold
                through (core/paper/propFirm.ts)
    FREE REIN   a sandbox: set the balance, trade
                anything, and switch the market's
                friction off one piece at a time

  ONLY THE SETTINGS LIVE HERE. What they DO lives in
  the interceptors that read them (propFirm.ts,
  queue.ts, tilt.ts) and plugs into the engine's
  seams. This file is a store and nothing else, so
  a mode can be read from a panel without dragging
  a daemon in with it.
==================================================
*/

import { useSyncExternalStore } from 'react';

export type PaperMode = 'standard' | 'prop' | 'free';

export interface PropSettings {
  /** The evaluation's starting balance */
  accountSize: number;
  /** The trailing drawdown, in dollars under the peak */
  drawdownLimit: number;
  /** INTRADAY trails the highest equity the account has ever touched, unrealised
      included; EOD trails the REALISED balance as it stood at the 17:00 bell */
  drawdownKind: 'intraday' | 'eod';
  /** A separate loss limit for the day, measured from the day's opening equity; 0 = none */
  dailyLossLimit: number;
  /** The profit that passes the evaluation; 0 = none */
  profitTarget: number;
  /** Futures only — the asset lock */
  futuresOnly: boolean;
  /** Flatten every position at this ET time so nothing is held overnight */
  flattenAt: string;
  /** The ET time the EOD baseline rolls */
  eodAt: string;
  /** Maximum contracts across all open futures positions; 0 = none */
  maxContracts: number;
}

export interface FreeSettings {
  /** Fill the whole size at one price — no walk past the touch */
  bypassSlippage: boolean;
  /** Fill at the midpoint — no spread to cross */
  bypassSpread: boolean;
  /** No commissions */
  zeroFees: boolean;
}

export interface TiltSettings {
  on: boolean;
  /** Flags inside the window that trip the lock */
  threshold: number;
  /** The window the flags are counted over, minutes */
  windowMin: number;
  /** How long the desk stops taking orders, minutes */
  lockoutMin: number;
  /** Re-entry the same way inside this many seconds counts as revenge */
  revengeSeconds: number;
  /** ...at more than this multiple of the size that was stopped out */
  revengeSizeX: number;
}

export interface ModeState {
  mode: PaperMode;
  prop: PropSettings;
  free: FreeSettings;
  tilt: TiltSettings;
  /** THE QUEUE (core/paper/queue.ts) — a limit waits its turn instead of
      filling the instant price touches it. On in every mode by choice. */
  realisticFills: boolean;
}

const KEY = 'slayer_paper_modes_v1';

export const DEFAULT_PROP: PropSettings = {
  accountSize: 50_000,
  drawdownLimit: 2_000,
  drawdownKind: 'intraday',
  dailyLossLimit: 1_000,
  profitTarget: 3_000,
  futuresOnly: true,
  flattenAt: '16:59',
  eodAt: '17:00',
  maxContracts: 5,
};
export const DEFAULT_FREE: FreeSettings = { bypassSlippage: false, bypassSpread: false, zeroFees: false };
export const DEFAULT_TILT: TiltSettings = { on: true, threshold: 3, windowMin: 10, lockoutMin: 15, revengeSeconds: 5, revengeSizeX: 1.5 };

const DEFAULT: ModeState = { mode: 'standard', prop: DEFAULT_PROP, free: DEFAULT_FREE, tilt: DEFAULT_TILT, realisticFills: false };

function load(): ModeState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const v = JSON.parse(raw) as Partial<ModeState>;
    return {
      mode: v.mode === 'prop' || v.mode === 'free' ? v.mode : 'standard',
      prop: { ...DEFAULT_PROP, ...(v.prop ?? {}) },
      free: { ...DEFAULT_FREE, ...(v.free ?? {}) },
      tilt: { ...DEFAULT_TILT, ...(v.tilt ?? {}) },
      realisticFills: !!v.realisticFills,
    };
  } catch {
    return DEFAULT;
  }
}

let modes: ModeState = load();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const getModes = (): ModeState => modes;
export const useModes = (): ModeState => useSyncExternalStore(subscribe, getModes, getModes);

/** A patch may reach as deep as one field of one mode — everything else is kept */
export type ModePatch = Partial<Omit<ModeState, 'prop' | 'free' | 'tilt'>> & { prop?: Partial<PropSettings>; free?: Partial<FreeSettings>; tilt?: Partial<TiltSettings> };

export function updateModes(patch: ModePatch): void {
  modes = {
    ...modes,
    ...patch,
    prop: { ...modes.prop, ...(patch.prop ?? {}) },
    free: { ...modes.free, ...(patch.free ?? {}) },
    tilt: { ...modes.tilt, ...(patch.tilt ?? {}) },
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(modes));
  } catch {
    /* storage off — the mode lives for the session */
  }
  listeners.forEach(fn => fn());
}

export const MODE_WORDS: Record<PaperMode, { label: string; blurb: string }> = {
  standard: { label: 'Standard', blurb: 'The desk as it is — a real spread, a real walk past the touch, real fees' },
  prop: { label: 'Prop firm', blurb: 'An evaluation account: futures only, a trailing drawdown that liquidates, no overnight' },
  free: { label: 'Free rein', blurb: 'A sandbox: set the balance, trade anything, and switch the friction off' },
};

/* ---- the clock the prop firm keeps ------------------------------------------------------- */

const ET = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit' });

/** Minutes since midnight in New York, and the weekday there */
export function easternNow(now: Date = new Date()): { minutes: number; weekday: string; hhmm: string } {
  const parts = Object.fromEntries(ET.formatToParts(now).map(p => [p.type, p.value]));
  const h = Number(parts.hour) % 24;
  const m = Number(parts.minute);
  return { minutes: h * 60 + m, weekday: String(parts.weekday ?? ''), hhmm: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
}

/** "16:59" as minutes since midnight */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}
