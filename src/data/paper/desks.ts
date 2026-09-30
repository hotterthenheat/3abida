/*
==================================================
  SLAYER TERMINAL - PAPER · THE READER'S DESKS
  (data/paper/desks.ts)

  What the partner's page called multiple desks (Noah
  liked them: "multiple desks"): a desk is a LAYOUT of one
  to four charts, each pane its own name and interval, the
  one on the desk, and what keeps them in step. The reader
  keeps as many as they like, names them, and moves
  between them; the one in use is remembered. Kept on
  this machine (`slayer_paper_desks_v1`) — they are the
  reader's arrangement, not the account's.

    KEEP IN STEP   the NAME (every pane shows the one the
                   pane on the desk shows — one name at
                   several intervals), the INTERVAL (every
                   pane at the one the pane on the desk is
                   at — several names side by side), and
                   the CROSSHAIR (a moment hovered on one
                   is marked on the others)

  A GROWING LAYOUT gives the new panes the next intervals
  of the pane on the desk's name — the classic "one name,
  four intervals" — and a shrinking one keeps the first.
==================================================
*/

import { useSyncExternalStore } from 'react';
import type { GridLayout } from '../../components/review/DeskShell';
import type { Timeframe } from '../timeframe';

export interface DeskPaneSpec {
  /** A name — a stock, a fund or an index — whose options the pane trades */
  name: string;
  timeframe: Timeframe;
}
export interface SavedDesk {
  id: string;
  name: string;
  layout: GridLayout;
  panes: DeskPaneSpec[];
  /** The pane on the desk */
  active: number;
  sync: { name: boolean; timeframe: boolean; crosshair: boolean };
}
interface DesksState {
  desks: SavedDesk[];
  current: string;
  /** THE QUICK SIZE: what the chart's menu, the order keys and the ladder trade — contracts, 1 by rest */
  quick?: number;
}

const KEY = 'slayer_paper_desks_v1';
const LEGACY = 'slayer_paper_desk_v1';
export const PANES_OF: Record<GridLayout, number> = { '1': 1, '2h': 2, '2v': 2, '3': 3, '4': 4 };
/** The intervals a growing layout hands out, after the pane on the desk's own */
const LADDER: Timeframe[] = ['1m', '5m', '15m', '1h', '30m', '1D'];

const deskAtRest = (name = 'SPY'): SavedDesk => ({ id: 'd1', name: 'Main', layout: '1', panes: [{ name, timeframe: '1m' }], active: 0, sync: { name: false, timeframe: false, crosshair: true } });
/* A PANE THAT SHOWED A FUTURE shows the index it followed: Paper trades options only since 2026-09-30, and the index is
   the same market the reader was watching, now with a chain beside it */
const INDEX_OF_FUTURE: Record<string, string> = { ES: 'SPX', MES: 'SPX', NQ: 'NDX', MNQ: 'NDX', RTY: 'RUT', M2K: 'RUT' };
const optionsName = (name: string): string => INDEX_OF_FUTURE[name.toUpperCase()] ?? name;
const onOptions = (d: SavedDesk): SavedDesk => (d.panes.some(p => optionsName(p.name) !== p.name) ? { ...d, panes: d.panes.map(p => ({ ...p, name: optionsName(p.name) })) } : d);
function load(): DesksState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as DesksState | null;
    if (raw && Array.isArray(raw.desks) && raw.desks.length) return { desks: raw.desks.map(onOptions), current: raw.desks.some(d => d.id === raw.current) ? raw.current : raw.desks[0].id, quick: typeof raw.quick === 'number' ? raw.quick : undefined };
    /* the desk before it had desks: its one name carries over */
    const old = JSON.parse(localStorage.getItem(LEGACY) ?? 'null') as { name?: string } | null;
    const first = deskAtRest(optionsName(old?.name ?? 'SPY'));
    return { desks: [first], current: first.id };
  } catch {
    const first = deskAtRest();
    return { desks: [first], current: first.id };
  }
}
let state: DesksState = typeof localStorage === 'undefined' ? { desks: [deskAtRest()], current: 'd1' } : load();
const listeners = new Set<() => void>();
const commit = (next: DesksState) => {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* a private window: the desks last as long as the page */
  }
  listeners.forEach(fn => fn());
};
export const useDesks = (): DesksState =>
  useSyncExternalStore(
    fn => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
    () => state
  );
export const currentDesk = (s: DesksState = state): SavedDesk => s.desks.find(d => d.id === s.current) ?? s.desks[0];
const patchDesk = (fn: (d: SavedDesk) => SavedDesk) => commit({ ...state, desks: state.desks.map(d => (d.id === state.current ? fn(d) : d)) });

/** A new layout: panes added take the pane on the desk's name at the next intervals; panes gone are the last ones */
export function setLayout(layout: GridLayout): void {
  patchDesk(d => {
    const n = PANES_OF[layout];
    const lead = d.panes[d.active] ?? d.panes[0];
    const panes = d.panes.slice(0, n);
    for (let i = panes.length; i < n; i++) {
      const used = new Set(panes.map(p => p.timeframe));
      panes.push({ name: lead.name, timeframe: LADDER.find(t => !used.has(t)) ?? lead.timeframe });
    }
    return { ...d, layout, panes, active: Math.min(d.active, n - 1) };
  });
}
/** The name on a pane — on every pane where the names are kept in step */
export function setPaneName(i: number, name: string): void {
  patchDesk(d => ({ ...d, panes: d.panes.map((p, j) => (j === i || d.sync.name ? { ...p, name } : p)) }));
}
/** A pane's interval — every pane's where the intervals are kept in step */
export function setPaneTimeframe(i: number, timeframe: Timeframe): void {
  patchDesk(d => ({ ...d, panes: d.panes.map((p, j) => (j === i || d.sync.timeframe ? { ...p, timeframe } : p)) }));
}
export const setActivePane = (i: number) => patchDesk(d => ({ ...d, active: Math.max(0, Math.min(d.panes.length - 1, i)) }));
/** A switch of keeping in step: turned on, every pane takes the pane on the desk's name (or interval) at once */
export function setSync(key: keyof SavedDesk['sync'], on: boolean): void {
  patchDesk(d => {
    const lead = d.panes[d.active] ?? d.panes[0];
    const panes = on && key === 'name' ? d.panes.map(p => ({ ...p, name: lead.name })) : on && key === 'timeframe' ? d.panes.map(p => ({ ...p, timeframe: lead.timeframe })) : d.panes;
    return { ...d, panes, sync: { ...d.sync, [key]: on } };
  });
}
/** A new desk — the one in use, copied, under a new name — and it becomes the one in use */
export function newDesk(name?: string): void {
  const from = currentDesk();
  const id = `d${Date.now().toString(36)}`;
  commit({ desks: [...state.desks, { ...from, id, name: name?.trim() || `Desk ${state.desks.length + 1}` }], current: id });
}
export const switchDesk = (id: string) => state.desks.some(d => d.id === id) && commit({ ...state, current: id });
export const renameDesk = (id: string, name: string) => commit({ ...state, desks: state.desks.map(d => (d.id === id ? { ...d, name: name.trim() || d.name } : d)) });
/** The quick size, 1 to 999 */
export const quickOf = (s: DesksState = state): number => Math.max(1, Math.min(999, Math.round(s.quick ?? 1)));
export const setQuick = (n: number) => commit({ ...state, quick: Math.max(1, Math.min(999, Math.round(n))) });
/** A desk goes — never the last one */
export function deleteDesk(id: string): void {
  if (state.desks.length < 2) return;
  const desks = state.desks.filter(d => d.id !== id);
  commit({ desks, current: state.current === id ? desks[0].id : state.current });
}
