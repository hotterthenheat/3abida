/*
==================================================
  SLAYER TERMINAL - THE WORKSPACE (core/paper/workspace.ts)

  TABS ACROSS THE TOP, PANES INSIDE ONE. A tab is a
  context — a name, a layout, the charts in it —
  and the plus at the end of the strip opens
  another. Each pane holds its OWN chart state:
  its instrument, its interval, its frame. Two
  panes on the same name at two intervals is the
  whole reason the thing exists.

  WHAT SYNCS, and only what the reader asks for:

    SYMBOL      change the instrument in one pane
                and every synced pane follows
    INTERVAL    the same for the timeframe
    CROSSHAIR   a moment hovered in one pane is
                marked in the others
    TIME RANGE  pan or zoom one and the rest ride
                along

  The first two are state and live in this store.
  The last two are per-frame and would cost a
  render each if they went through React, so they
  ride a small BUS instead (syncBus below) that the
  charts subscribe to directly.

  THE WHOLE WORKSPACE IS ONE JSON — tabs, layouts,
  instruments, intervals, the sync switches AND the
  lines the reader has drawn — saved on every change
  and read back on the next load, so a desk comes
  back exactly as it was left.
==================================================
*/

import { useSyncExternalStore } from 'react';
import { futureInstrument, stockInstrument, type Instrument } from './instruments';
import type { Timeframe } from '../../data/timeframe';
import { syncAcrossTabs } from '../../data/crossTab';

export type PaneLayout = '1' | '2h' | '2v' | '3' | '4';

export const LAYOUTS: { key: PaneLayout; label: string; panes: number; hint: string }[] = [
  { key: '1', label: 'One', panes: 1, hint: 'A single chart' },
  { key: '2h', label: 'Two across', panes: 2, hint: 'Side by side' },
  { key: '2v', label: 'Two down', panes: 2, hint: 'One over the other' },
  { key: '3', label: 'Three', panes: 3, hint: 'One wide over two' },
  { key: '4', label: 'Four', panes: 4, hint: 'A quartet' },
];

export interface Pane {
  id: string;
  instrument: Instrument;
  timeframe: Timeframe;
}

export interface Tab {
  id: string;
  name: string;
  layout: PaneLayout;
  panes: Pane[];
  /** Which pane the ticket and the keys are pointed at */
  activePane: string;
}

export interface SyncSwitches {
  symbol: boolean;
  interval: boolean;
  crosshair: boolean;
  timeRange: boolean;
}

export interface Workspace {
  tabs: Tab[];
  activeTab: string;
  sync: SyncSwitches;
}

const KEY = 'slayer_paper_workspace_v1';
const TIMEFRAMES = new Set<string>(['15s', '1m', '5m', '15m', '30m', '1h', '1D', '1W']);

let seq = 0;
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const defaultInstrument = (): Instrument => futureInstrument('NQ') ?? stockInstrument('SPY');

function freshTab(name = 'Desk', inst?: Instrument): Tab {
  const pane: Pane = { id: newId('pane'), instrument: inst ?? defaultInstrument(), timeframe: '1m' };
  return { id: newId('tab'), name, layout: '1', panes: [pane], activePane: pane.id };
}

function fresh(): Workspace {
  const tab = freshTab();
  return { tabs: [tab], activeTab: tab.id, sync: { symbol: false, interval: false, crosshair: true, timeRange: false } };
}

/** A stored instrument is rebuilt so a futures front month rolls with the calendar */
function reviveInstrument(v: unknown): Instrument | null {
  const o = v as Partial<Instrument> & { root?: string };
  if (!o || typeof o !== 'object' || typeof o.kind !== 'string') return null;
  if (o.kind === 'future') return futureInstrument(String(o.root ?? '')) ?? null;
  if (o.kind === 'stock' || o.kind === 'option' || o.kind === 'spread') return o as Instrument;
  return null;
}

function load(): Workspace {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const v = JSON.parse(raw) as Partial<Workspace>;
    if (!Array.isArray(v.tabs) || v.tabs.length === 0) return fresh();
    const tabs: Tab[] = [];
    for (const t of v.tabs) {
      const panes: Pane[] = [];
      for (const p of t.panes ?? []) {
        const inst = reviveInstrument(p.instrument);
        if (!inst) continue;
        panes.push({ id: typeof p.id === 'string' ? p.id : newId('pane'), instrument: inst, timeframe: TIMEFRAMES.has(String(p.timeframe)) ? (p.timeframe as Timeframe) : '1m' });
      }
      if (panes.length === 0) continue;
      const layout = (LAYOUTS.find(l => l.key === t.layout)?.key ?? '1') as PaneLayout;
      tabs.push({ id: typeof t.id === 'string' ? t.id : newId('tab'), name: typeof t.name === 'string' && t.name ? t.name : 'Desk', layout, panes, activePane: panes.some(p => p.id === t.activePane) ? t.activePane : panes[0].id });
    }
    if (tabs.length === 0) return fresh();
    return {
      tabs,
      activeTab: tabs.some(t => t.id === v.activeTab) ? String(v.activeTab) : tabs[0].id,
      sync: { symbol: !!v.sync?.symbol, interval: !!v.sync?.interval, crosshair: v.sync?.crosshair !== false, timeRange: !!v.sync?.timeRange },
    };
  } catch {
    return fresh();
  }
}

let ws: Workspace = load();
const listeners = new Set<() => void>();
/* ANOTHER TAB'S WRITE IS THIS TAB'S NEWS (data/crossTab.ts). The store
   above reads storage once and writes the whole object back, so without
   this a second tab silently overwrites the first one's work. */
syncAcrossTabs(KEY, () => {
  ws = load();
  listeners.forEach(fn => fn());
});

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const getWorkspace = (): Workspace => ws;
export const useWorkspace = (): Workspace => useSyncExternalStore(subscribe, getWorkspace, getWorkspace);

function commit(next: Workspace): void {
  ws = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* the session keeps the layout */
  }
  listeners.forEach(fn => fn());
}

export const activeTab = (w: Workspace = ws): Tab => w.tabs.find(t => t.id === w.activeTab) ?? w.tabs[0];
export const activePane = (w: Workspace = ws): Pane => {
  const t = activeTab(w);
  return t.panes.find(p => p.id === t.activePane) ?? t.panes[0];
};

const mapTab = (id: string, fn: (t: Tab) => Tab): Workspace => ({ ...ws, tabs: ws.tabs.map(t => (t.id === id ? fn(t) : t)) });

/* ---- tabs ------------------------------------------------------------------------------------ */

export function addTab(inst?: Instrument): void {
  const t = freshTab(`Desk ${ws.tabs.length + 1}`, inst);
  commit({ ...ws, tabs: [...ws.tabs, t], activeTab: t.id });
}
export function closeTab(id: string): void {
  if (ws.tabs.length <= 1) return;
  const tabs = ws.tabs.filter(t => t.id !== id);
  commit({ ...ws, tabs, activeTab: ws.activeTab === id ? tabs[tabs.length - 1].id : ws.activeTab });
}
export function pickTab(id: string): void {
  if (!ws.tabs.some(t => t.id === id)) return;
  commit({ ...ws, activeTab: id });
}
export function renameTab(id: string, name: string): void {
  commit(mapTab(id, t => ({ ...t, name: name.trim().slice(0, 24) || t.name })));
}

/* ---- panes ----------------------------------------------------------------------------------- */

export function setLayout(tabId: string, layout: PaneLayout): void {
  const want = LAYOUTS.find(l => l.key === layout)?.panes ?? 1;
  commit(
    mapTab(tabId, t => {
      const panes = [...t.panes];
      while (panes.length < want) panes.push({ id: newId('pane'), instrument: panes[panes.length - 1]?.instrument ?? defaultInstrument(), timeframe: panes[panes.length - 1]?.timeframe ?? '1m' });
      const cut = panes.slice(0, want);
      return { ...t, layout, panes: cut, activePane: cut.some(p => p.id === t.activePane) ? t.activePane : cut[0].id };
    })
  );
}

export function pickPane(tabId: string, paneId: string): void {
  commit(mapTab(tabId, t => (t.panes.some(p => p.id === paneId) ? { ...t, activePane: paneId } : t)));
}

/** Point a pane at an instrument — every synced pane in the tab follows */
export function setPaneInstrument(tabId: string, paneId: string, instrument: Instrument): void {
  commit(mapTab(tabId, t => ({ ...t, panes: t.panes.map(p => (p.id === paneId || ws.sync.symbol ? { ...p, instrument } : p)) })));
}

export function setPaneTimeframe(tabId: string, paneId: string, timeframe: Timeframe): void {
  commit(mapTab(tabId, t => ({ ...t, panes: t.panes.map(p => (p.id === paneId || ws.sync.interval ? { ...p, timeframe } : p)) })));
}

export function setSync(patch: Partial<SyncSwitches>): void {
  commit({ ...ws, sync: { ...ws.sync, ...patch } });
}

/** Everything, as the JSON it is stored as — the door's Export, drawings and all */
export const exportWorkspace = (): string => JSON.stringify({ ...ws, drawings: levels }, null, 2);

/** Read a workspace back in; throws with a readable reason */
export function importWorkspace(text: string): void {
  const v = JSON.parse(text) as Workspace & { drawings?: Record<string, number[]> };
  if (!Array.isArray(v.tabs) || v.tabs.length === 0) throw new Error('That JSON carries no tabs');
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* non-fatal */
  }
  ws = load();
  listeners.forEach(fn => fn());
  if (v.drawings && typeof v.drawings === 'object' && !Array.isArray(v.drawings)) {
    const clean: Record<string, number[]> = {};
    for (const [k, arr] of Object.entries(v.drawings)) if (Array.isArray(arr)) clean[k] = arr.filter(n => typeof n === 'number' && Number.isFinite(n));
    commitLevels(clean);
  }
}

export function resetWorkspace(): void {
  commit(fresh());
  commitLevels({});
}

/* ---- the lines the reader has drawn ----------------------------------------------------------- 
   They live here rather than in the chart because they are WORKSPACE state:
   a layout written out as JSON that came back without its levels would not be
   the desk that was left. Kept per instrument, under their own key, so the
   chart can read them without waking the whole workspace. */

const LEVELS_KEY = 'slayer_paper_levels_v1';

function loadLevels(): Record<string, number[]> {
  try {
    const raw = localStorage.getItem(LEVELS_KEY);
    const v = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const out: Record<string, number[]> = {};
    for (const [k, arr] of Object.entries(v)) if (Array.isArray(arr)) out[k] = arr.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
    return out;
  } catch {
    return {};
  }
}

let levels: Record<string, number[]> = loadLevels();
const levelListeners = new Set<() => void>();
const subLevels = (fn: () => void) => {
  levelListeners.add(fn);
  return () => {
    levelListeners.delete(fn);
  };
};

function commitLevels(next: Record<string, number[]>): void {
  levels = next;
  try {
    localStorage.setItem(LEVELS_KEY, JSON.stringify(next));
  } catch {
    /* the session keeps them */
  }
  levelListeners.forEach(fn => fn());
}

export const getUserLevels = (): Record<string, number[]> => levels;
export const useUserLevels = (): Record<string, number[]> => useSyncExternalStore(subLevels, getUserLevels, getUserLevels);
export const levelsFor = (instrumentId: string): number[] => levels[instrumentId] ?? [];
export function setUserLevels(instrumentId: string, next: number[]): void {
  commitLevels({ ...levels, [instrumentId]: next });
}

/* ---- the per-frame bus ----------------------------------------------------------------------- */

/*
  THE CROSSHAIR AND THE FRAME DO NOT GO THROUGH REACT.

  A hovered bar and a panned range change many times a second. Pushing either
  into a store would re-render every pane on every mouse move — the exact
  stutter the desk's charts are built to avoid. They ride this bus instead:
  a pane publishes, the others apply it to their own chart objects directly,
  and React never hears about it.
*/
export interface CrosshairMsg {
  from: string;
  time: number | null;
}
export interface RangeMsg {
  from: string;
  from_: number;
  to: number;
}

type Handler<T> = (m: T) => void;
const crosshairs = new Set<Handler<CrosshairMsg>>();
const ranges = new Set<Handler<RangeMsg>>();

export const onCrosshair = (fn: Handler<CrosshairMsg>): (() => void) => {
  crosshairs.add(fn);
  return () => {
    crosshairs.delete(fn);
  };
};
export const publishCrosshair = (m: CrosshairMsg): void => {
  if (!ws.sync.crosshair) return;
  for (const fn of crosshairs) fn(m);
};

export const onRange = (fn: Handler<RangeMsg>): (() => void) => {
  ranges.add(fn);
  return () => {
    ranges.delete(fn);
  };
};
export const publishRange = (m: RangeMsg): void => {
  if (!ws.sync.timeRange) return;
  for (const fn of ranges) fn(m);
};
