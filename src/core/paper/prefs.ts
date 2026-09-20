/*
==================================================
  SLAYER TERMINAL - THE PAPER DESK'S PREFERENCES
  (core/paper/prefs.ts)

  How the reader likes to trade: the size the
  ticket opens on, the quick sizes, whether a drag
  on the chart asks before it moves an order,
  whether the ticket asks before it sends, the
  default bracket, the levels overlay — and the
  hotkeys, every one of them rebindable (the
  directive: "do not force these exact bindings").
  One store, useSyncExternalStore, persisted.
==================================================
*/

import { useSyncExternalStore } from 'react';

const KEY = 'slayer_paper_prefs_v1';

export type HotkeyAction =
  | 'buyMarket'
  | 'sellMarket'
  | 'buyLimit'
  | 'sellLimit'
  | 'buyStop'
  | 'sellStop'
  | 'closePosition'
  | 'reverse'
  | 'cancelSelected'
  | 'cancelAll'
  | 'flatten'
  | 'stopToBreakeven'
  | 'ticket';

export const HOTKEY_ACTIONS: { key: HotkeyAction; label: string; hint: string }[] = [
  { key: 'buyMarket', label: 'Buy market', hint: 'The ticket size, at the ask' },
  { key: 'sellMarket', label: 'Sell market', hint: 'The ticket size, at the bid' },
  { key: 'buyLimit', label: 'Buy limit at cursor', hint: 'A limit where the pointer sits on the chart' },
  { key: 'sellLimit', label: 'Sell limit at cursor', hint: 'A limit where the pointer sits on the chart' },
  { key: 'buyStop', label: 'Buy stop at cursor', hint: 'A stop where the pointer sits' },
  { key: 'sellStop', label: 'Sell stop at cursor', hint: 'A stop where the pointer sits' },
  { key: 'closePosition', label: 'Close position', hint: 'Flatten this instrument at the market' },
  { key: 'reverse', label: 'Reverse position', hint: 'Close and open the other way' },
  { key: 'cancelSelected', label: 'Cancel selected order', hint: 'The order last touched on the chart' },
  { key: 'cancelAll', label: 'Cancel all orders', hint: 'Every working order on this instrument' },
  { key: 'flatten', label: 'Flatten everything', hint: 'Close every position and cancel every order' },
  { key: 'stopToBreakeven', label: 'Stop to breakeven', hint: 'Move the stop to the average entry' },
  { key: 'ticket', label: 'Show or hide the ticket', hint: 'The order ticket at the right' },
];

/** A binding: keys separated by "+" for a chord held together ("Shift+X"), by a space for a sequence ("B L") */
export type Bindings = Record<HotkeyAction, string>;

export const DEFAULT_BINDINGS: Bindings = {
  buyMarket: 'B',
  sellMarket: 'S',
  buyLimit: 'B L',
  sellLimit: 'S L',
  buyStop: 'B T',
  sellStop: 'S T',
  closePosition: 'C',
  reverse: 'R',
  cancelSelected: 'X',
  cancelAll: 'Shift+X',
  flatten: 'Shift+F',
  stopToBreakeven: 'E',
  ticket: 'T',
};

export interface PaperPrefs {
  /** The size the ticket opens on */
  defaultQty: number;
  quickQtys: number[];
  /** A drag on the chart shows the new price and waits for a yes */
  confirmDrag: boolean;
  /** The ticket and the right-click card ask once more before sending */
  confirmOrders: boolean;
  /** Attach a stop and a target to every entry, in ticks from the fill */
  bracket: { on: boolean; stopTicks: number; targetTicks: number };
  /** The dealer levels drawn on the tape */
  levels: boolean;
  /** Where fills print on the tape */
  fillMarks: boolean;
  /** Hotkeys live */
  hotkeys: boolean;
  bindings: Bindings;
  /** The ticket rail is out */
  ticketOpen: boolean;
  /** The price ladder sits between the tape and the rail */
  ladderOpen: boolean;
  /*
    WHICH EDGE THE ORDER LABELS LIVE ON.

    A real chart trader offers both, and the two references I was given show
    one each — so it is a preference and not a fact. The default is the RIGHT,
    for one reason: the price scale draws every line's price as a chip on the
    right, and a label on the left leaves those two halves of the same object
    a whole pane apart. Against the axis they read as one thing.
  */
  orderLabelSide: 'left' | 'right';
  /** The dealer positioning overlay — heat-mapped zones behind the tape */
  dealer: { on: boolean; greek: 'gex' | 'dex' | 'vanna'; expiry: string; labels: boolean };
}

const DEFAULT: PaperPrefs = {
  defaultQty: 1,
  quickQtys: [1, 2, 5, 10],
  confirmDrag: false,
  confirmOrders: false,
  bracket: { on: false, stopTicks: 40, targetTicks: 80 },
  levels: true,
  fillMarks: true,
  hotkeys: true,
  bindings: DEFAULT_BINDINGS,
  ticketOpen: true,
  ladderOpen: false,
  orderLabelSide: 'right',
  dealer: { on: false, greek: 'gex', expiry: '0DTE', labels: true },
};

function load(): PaperPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const v = JSON.parse(raw) as Partial<PaperPrefs>;
    return {
      ...DEFAULT,
      ...v,
      bracket: { ...DEFAULT.bracket, ...(v.bracket ?? {}) },
      dealer: { ...DEFAULT.dealer, ...(v.dealer ?? {}) },
      bindings: { ...DEFAULT_BINDINGS, ...(v.bindings ?? {}) },
      quickQtys: Array.isArray(v.quickQtys) && v.quickQtys.length ? v.quickQtys.filter(n => Number.isFinite(n) && n > 0).slice(0, 6) : DEFAULT.quickQtys,
    };
  } catch {
    return DEFAULT;
  }
}

let prefs: PaperPrefs = load();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const getPaperPrefs = (): PaperPrefs => prefs;
export const usePaperPrefs = (): PaperPrefs => useSyncExternalStore(subscribe, getPaperPrefs, getPaperPrefs);

export type PrefsPatch = Partial<Omit<PaperPrefs, 'bracket' | 'bindings' | 'dealer'>> & {
  bracket?: Partial<PaperPrefs['bracket']>;
  bindings?: Partial<Bindings>;
  dealer?: Partial<PaperPrefs['dealer']>;
};

export function updatePaperPrefs(patch: PrefsPatch): void {
  prefs = {
    ...prefs,
    ...patch,
    bracket: { ...prefs.bracket, ...(patch.bracket ?? {}) },
    bindings: { ...prefs.bindings, ...(patch.bindings ?? {}) },
    dealer: { ...prefs.dealer, ...(patch.dealer ?? {}) },
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage off — the choice lives for the session */
  }
  listeners.forEach(fn => fn());
}

export function bindHotkey(action: HotkeyAction, combo: string): void {
  updatePaperPrefs({ bindings: { ...prefs.bindings, [action]: combo } as Bindings });
}

export function resetHotkeys(): void {
  updatePaperPrefs({ bindings: DEFAULT_BINDINGS });
}

/* ---- the key grammar ------------------------------------------------------------------ */

/** One pressed key as the desk spells it: "Shift+X", "B", "Escape" */
export function comboOf(e: KeyboardEvent): string | null {
  const k = e.key;
  if (k === 'Shift' || k === 'Control' || k === 'Alt' || k === 'Meta') return null;
  const mods = [e.ctrlKey || e.metaKey ? 'Ctrl' : '', e.altKey ? 'Alt' : '', e.shiftKey ? 'Shift' : ''].filter(Boolean);
  const base = k.length === 1 ? k.toUpperCase() : k;
  return [...mods, base].join('+');
}

/** Split a binding into its sequence of chords */
export const sequenceOf = (binding: string): string[] => binding.trim().split(/\s+/).filter(Boolean);
