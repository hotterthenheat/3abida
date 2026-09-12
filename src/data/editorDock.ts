/*
==================================================
  SLAYER TERMINAL - THE EDITOR'S DOCK (data/editorDock.ts)

  One editor for the whole terminal, docked at the
  RIGHT of a full-screen chart the way TradingView
  sets its Pine Editor (Noah, 2026-09-10: "look how
  trading view has theirs placed. i want it to be
  like that which can be dragged to increase the
  width") — the chart gives it the room through one
  CSS variable, `--editor-w`, that every full-screen
  takeover reads for its right edge. This is its
  state: open or not, which script and which pane,
  the dock's width (remembered), the drafts a closed
  dock keeps, and the scripts recently opened for
  the menu.

  The editor is a full-screen thing only: a desk of
  panes has no room beside a chart, so the library
  keeps its doors shut until the chart fills the
  screen, and the dock closes when the chart leaves
  full screen — the draft stays.
==================================================
*/

import { useSyncExternalStore } from 'react';
import type { PaneId, Script } from '../types/scripts';

export interface DockState {
  open: boolean;
  /** null = a new script on the template */
  script: Script | null;
  paneId?: PaneId;
  /** Bumps on every open so the panel resets to the script asked for */
  nonce: number;
  width: number;
}

const WIDTH_KEY = 'slayer_editor_dock_w';
const RECENT_KEY = 'slayer_scripts_recent';
export const DOCK_MIN = 360;
export const DOCK_DEFAULT = 520;
/** The dock never takes more than this share of the window */
export const DOCK_MAX_SHARE = 0.7;
/** The variable the full-screen takeovers read for their right edge */
export const DOCK_VAR = '--editor-w';

const readWidth = (): number => {
  try {
    const v = Number(localStorage.getItem(WIDTH_KEY));
    return Number.isFinite(v) && v >= DOCK_MIN ? v : DOCK_DEFAULT;
  } catch {
    return DOCK_DEFAULT;
  }
};

let state: DockState = { open: false, script: null, nonce: 0, width: readWidth() };
const subs = new Set<() => void>();
const emit = () => subs.forEach(fn => fn());

/** The room the chart leaves: the dock's width while it is open, nothing otherwise */
const room = () => {
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  if (!root) return;
  if (state.open) root.style.setProperty(DOCK_VAR, `${state.width}px`);
  else root.style.removeProperty(DOCK_VAR);
};

export function openEditor(script: Script | null, paneId?: PaneId): void {
  state = { ...state, open: true, script, paneId: paneId ?? state.paneId, nonce: state.nonce + 1 };
  if (script) remember(script);
  room();
  emit();
}

export function closeEditor(): void {
  if (!state.open) return;
  state = { ...state, open: false };
  room();
  emit();
}

export function setDockWidth(w: number): void {
  const max = Math.floor(window.innerWidth * DOCK_MAX_SHARE);
  const next = Math.max(DOCK_MIN, Math.min(max, Math.round(w)));
  if (next === state.width) return;
  state = { ...state, width: next };
  try {
    localStorage.setItem(WIDTH_KEY, String(next));
  } catch {
    /* non-fatal */
  }
  room();
  emit();
}

export function useEditorDock(): DockState {
  return useSyncExternalStore(
    fn => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => state,
    () => state
  );
}

export const getEditorDock = (): DockState => state;

/* ---- drafts: what a closed dock keeps ---------------------------------------------- */

const drafts = new Map<string, { title: string; source: string }>();
export const draftKey = (script: Script | null) => script?.id ?? 'new';
export const getDraft = (script: Script | null) => drafts.get(draftKey(script));
export const setDraft = (script: Script | null, draft: { title: string; source: string }) => drafts.set(draftKey(script), draft);
export const clearDraft = (script: Script | null) => drafts.delete(draftKey(script));

/* ---- recently used ------------------------------------------------------------------- */

export interface RecentScript {
  id: string;
  title: string;
}

export function recentScripts(): RecentScript[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter(r => r && typeof r.id === 'string' && typeof r.title === 'string').slice(0, 6) : [];
  } catch {
    return [];
  }
}

/** A script opened, saved or ADDED TO A CHART goes to the top of the recently
    used — the editor's menu and the library's shelf read the same list
    (Noah, 2026-09-10: "for the indicators there should be a recents
    section"). A chart tool counts too, by its library key. */
export function remember(script: Pick<Script, 'id' | 'title'>): void {
  const next = [{ id: script.id, title: script.title }, ...recentScripts().filter(r => r.id !== script.id)].slice(0, 6);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* non-fatal */
  }
}

/** The style a full-screen takeover wears so the dock has its room */
export const DOCK_ROOM = { right: `var(${DOCK_VAR}, 0px)` } as const;
