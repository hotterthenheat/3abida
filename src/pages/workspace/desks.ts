/*
==================================================
  SLAYER TERMINAL - PULSE DESKS
  Named, saved layouts for the Pulse desk (Mo,
  2026-08-19: "save a Pulse layout and come back
  to it instead of rebuilding it").

  Three curated PRESETS ship as starting desks —
  Market Structure, Flow, 0DTE — and the user can
  save any arrangement under their own name. Every
  desk, preset or custom, autosaves its own working
  state as you go (the house "it saves as you go"
  contract), and a preset can always be reset to
  its curated template.

  Migration: the single desk the page kept before
  this (slayer_workspace_v1) is imported once as
  "My Setup" so nobody's arrangement is lost.
==================================================
*/

import type { Layout } from 'react-grid-layout';
import { widgetByKey } from './registry';

export interface WidgetInstance {
  id: string;
  key: string;
  /** Pinned (UNLINKED) to its own name; undefined = linked to the terminal. */
  ticker?: string;
}

export interface SavedWorkspace {
  instances: WidgetInstance[];
  layout: Layout[];
}

export interface DeskStore {
  active: string;
  desks: Record<string, SavedWorkspace>;
}

export const DESKS_KEY = 'slayer_desks_v1';
const LEGACY_KEY = 'slayer_workspace_v1';
export const LEGACY_DESK_NAME = 'My Setup';

/** A preset cell — min sizes come from the registry so a template can never
    violate a widget's own floor. */
const cell = (id: string, key: string, x: number, y: number, w: number, h: number): { inst: WidgetInstance; l: Layout } => {
  const def = widgetByKey(key);
  return {
    inst: { id, key },
    l: { i: id, x, y, w, h, minW: def?.minW, minH: def?.minH, maxH: def?.maxH },
  };
};

const assemble = (cells: { inst: WidgetInstance; l: Layout }[]): SavedWorkspace => ({
  instances: cells.map(c => c.inst),
  layout: cells.map(c => c.l),
});

/** Curated starting desks, in the order the rail shows them. */
export const PRESETS: Record<string, SavedWorkspace> = {
  // The session-opening pair top row, the strike-by-strike inventory beneath
  // (Noah, 2026-08-17; the dealer positioning map that sat beneath is gone
  // from the terminal, 2026-09-03)
  'Market Structure': assemble([
    cell('live-chart-1', 'live-chart', 0, 0, 6, 5),
    cell('gex-heatmap-1', 'gex-heatmap', 6, 0, 6, 5),
    cell('exposure-matrix-1', 'exposure-matrix', 0, 5, 12, 5),
  ]),
  // THE DAY AHEAD (2026-09-08): the Pinpoint pages' answers as one desk —
  // the range and where it closes up top, the agenda and the wall beneath
  'The Day Ahead': assemble([
    cell('the-range-1', 'the-range', 0, 0, 7, 5),
    cell('where-it-closes-1', 'where-it-closes', 7, 0, 5, 5),
    cell('ranked-targets-1', 'ranked-targets', 0, 5, 5, 6),
    cell('at-the-wall-1', 'at-the-wall', 5, 5, 7, 6),
  ]),
  // What's hitting the tape, against the chart, with the walls heading and the setups it feeds
  Flow: assemble([
    cell('live-chart-1', 'live-chart', 0, 0, 7, 5),
    cell('order-flow-1', 'order-flow', 7, 0, 5, 5),
    cell('wall-drift-1', 'wall-drift', 0, 5, 6, 4),
    cell('top-setups-1', 'top-setups', 6, 5, 6, 4),
  ]),
  // Today's expiry: the ladder big, the order flow beside it, the
  // strike-by-strike inventory beneath
  '0DTE': assemble([
    cell('gex-heatmap-1', 'gex-heatmap', 0, 0, 7, 6),
    cell('order-flow-1', 'order-flow', 7, 0, 5, 6),
    cell('exposure-matrix-1', 'exposure-matrix', 0, 6, 12, 4),
  ]),
};

/** One line per preset for the hover peek — what the desk is FOR. */
export const PRESET_BLURBS: Record<string, string> = {
  'Market Structure': 'The session opener — chart and pressure ladder up top (levels ride inside the ladder), the strike-by-strike inventory beneath.',
  'The Day Ahead': 'From now to the close — the range and where it closes up top, the agenda and the wall in focus beneath.',
  Flow: 'What is hitting the tape, against the chart, with where the walls are heading and the setups it feeds.',
  '0DTE': 'Today’s expiry — the pressure ladder big with its levels view, the order flow beside it, strike-by-strike inventory beneath.',
};

export const PRESET_NAMES = Object.keys(PRESETS);
export const isPreset = (name: string) => name in PRESETS;

/** Drop widgets whose keys left the registry; ground off-grid coords; and
    re-apply every panel's size bounds from the registry — a desk saved
    before the caps existed (or with a panel stretched past one) comes back
    clamped, so the rule holds on disk as well as on the grid. */
export function sanitize(ws: SavedWorkspace): SavedWorkspace {
  const instances = (ws.instances ?? []).filter(w => w && widgetByKey(w.key));
  return {
    instances,
    layout: (ws.layout ?? [])
      .filter(l => instances.some(w => w.id === l.i))
      .map(l => {
        const def = widgetByKey(instances.find(w => w.id === l.i)?.key ?? '');
        const bounded = def
          ? {
              minW: def.minW,
              minH: def.minH,
              maxH: def.maxH,
              w: Math.max(def.minW, l.w),
              h: Math.min(def.maxH, Math.max(def.minH, l.h)),
            }
          : {};
        return { ...l, x: Number.isFinite(l.x) ? l.x : 0, y: Number.isFinite(l.y) ? l.y : 0, ...bounded };
      }),
  };
}

const clone = (ws: SavedWorkspace): SavedWorkspace => JSON.parse(JSON.stringify(ws));

export function loadDesks(): DeskStore {
  let store: DeskStore | null = null;
  try {
    const raw = localStorage.getItem(DESKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DeskStore;
      if (parsed && typeof parsed.active === 'string' && parsed.desks && typeof parsed.desks === 'object') store = parsed;
    }
  } catch {
    store = null;
  }

  if (!store) {
    // First run on this key — import the legacy single desk as "My Setup"
    // and make it active, so the upgrade changes nothing on screen.
    store = { active: PRESET_NAMES[0], desks: {} };
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy) as SavedWorkspace;
        if (Array.isArray(parsed.instances) && Array.isArray(parsed.layout)) {
          store.desks[LEGACY_DESK_NAME] = sanitize(parsed);
          store.active = LEGACY_DESK_NAME;
        }
      }
    } catch {
      /* no legacy desk — presets it is */
    }
  }

  // Seed any preset that's missing (first run, or a preset added later)
  for (const name of PRESET_NAMES) if (!store.desks[name]) store.desks[name] = clone(PRESETS[name]);
  // Sanitize everything that came off disk
  for (const name of Object.keys(store.desks)) store.desks[name] = sanitize(store.desks[name]);
  if (!store.desks[store.active]) store.active = PRESET_NAMES[0];
  return store;
}

export function saveDesks(store: DeskStore): void {
  try {
    localStorage.setItem(DESKS_KEY, JSON.stringify(store));
  } catch {
    /* quota or private mode — the desk still works for the session */
  }
}

export const presetTemplate = (name: string): SavedWorkspace | null => (isPreset(name) ? clone(PRESETS[name]) : null);

export const GRID_COLS = 12;

/**
 * Where a new panel lands (Noah, 2026-08-19: "it should fill the closest
 * empty space from the top → down... the nearest empty box that is a
 * reasonable size"). `y: Infinity` always dropped it at the very bottom,
 * blind to a hole beside a tall column.
 *
 * Scans rows top-down and columns left-right; at each cell, the biggest size
 * that fits — the widget's default first, shrinking toward its minimum when
 * the hole is narrower or shorter. The first cell with ANY fit wins, so
 * height (being near the top) beats size. Nothing fits above the occupied
 * band → the bottom, at default size, as before.
 */
export function firstFit(
  layout: Layout[],
  def: { w: number; h: number; minW?: number; minH?: number }
): { x: number; y: number; w: number; h: number } {
  const occupied = new Set<string>();
  let bottom = 0;
  for (const l of layout) {
    for (let x = l.x; x < l.x + l.w; x++) for (let y = l.y; y < l.y + l.h; y++) occupied.add(`${x},${y}`);
    bottom = Math.max(bottom, l.y + l.h);
  }
  const minW = Math.max(1, def.minW ?? def.w);
  const minH = Math.max(1, def.minH ?? def.h);
  const fits = (x: number, y: number, w: number, h: number) => {
    if (x + w > GRID_COLS) return false;
    for (let cx = x; cx < x + w; cx++) for (let cy = y; cy < y + h; cy++) if (occupied.has(`${cx},${cy}`)) return false;
    return true;
  };

  for (let y = 0; y < bottom; y++) {
    for (let x = 0; x <= GRID_COLS - minW; x++) {
      // Largest size at this cell: widest first, then tallest — a panel
      // would rather be its full width and a little short than a sliver.
      for (let w = def.w; w >= minW; w--) {
        for (let h = def.h; h >= minH; h--) {
          if (fits(x, y, w, h)) return { x, y, w, h };
        }
      }
    }
  }
  return { x: 0, y: bottom, w: def.w, h: def.h };
}
