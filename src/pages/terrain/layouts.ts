/*
==================================================
  SLAYER TERMINAL - NAMED LAYOUTS (terrain/layouts.ts)

  Save and recall whole desk arrangements — T-18.
==================================================

  A reader who builds a four-pane 0DTE desk in the morning and a two-pane
  swing desk at lunch should not rebuild either by hand. A named layout is
  the WHOLE arrangement — pane count, symbols, timeframes, overlays,
  indicators, styles — snapshotted under a name and recalled in one click.

  VALIDATION IS INJECTED, NOT COPIED. The desk already owns the one
  field-by-field pane validator (`readPane`), and this module takes it as an
  argument instead of holding a second enumeration of the pane's fields —
  the drawings validator was rebuilt around exactly that lesson (T-0: a
  kind-list copied inline dropped every stored measure). Same for the legal
  layout list. The proof stages its own validator, which is the point: this
  module's own logic is storage, names and caps, and that is what it proves.

  THE CAP REFUSES, IT DOES NOT EVICT. Twelve named desks is a workshop;
  silently dropping the oldest to admit a thirteenth is how a reader loses
  the one they built in March without being told. `saveNamedLayout` returns
  null at the cap and the menu says why.
*/

export interface NamedLayoutEntry<P> {
  layout: number;
  panes: P[];
  savedAt: number;
}

export const NAMED_LAYOUTS_KEY = 'slayer_terrain_layouts_v1';
export const MAX_NAMED_LAYOUTS = 12;
export const LAYOUT_NAME_MAX = 24;

export function loadNamedLayouts<P>(
  readPaneFn: (raw: unknown, def: P) => P,
  defaultPane: P,
  validLayouts: readonly number[]
): Record<string, NamedLayoutEntry<P>> {
  try {
    const raw = localStorage.getItem(NAMED_LAYOUTS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, NamedLayoutEntry<P>> = {};
    for (const [name, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (!name.trim() || !val || typeof val !== 'object') continue;
      const v = val as Partial<NamedLayoutEntry<unknown>>;
      if (!validLayouts.includes(v.layout as number) || !Array.isArray(v.panes)) continue;
      out[name] = {
        layout: v.layout as number,
        /* Each stored pane through the ONE validator — a malformed field
           falls back per field, never takes the whole layout down. */
        panes: v.panes.map(p => readPaneFn(p, defaultPane)),
        savedAt: typeof v.savedAt === 'number' ? v.savedAt : 0,
      };
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * The map with `name` saved — or null when the save is REFUSED: a blank
 * name, or the cap reached with a NEW name (overwriting an existing name is
 * always allowed; it costs no slot).
 */
export function saveNamedLayout<P>(
  existing: Record<string, NamedLayoutEntry<P>>,
  nameRaw: string,
  layout: number,
  panes: P[],
  savedAt: number
): Record<string, NamedLayoutEntry<P>> | null {
  const name = nameRaw.trim().slice(0, LAYOUT_NAME_MAX);
  if (!name) return null;
  if (!(name in existing) && Object.keys(existing).length >= MAX_NAMED_LAYOUTS) return null;
  return { ...existing, [name]: { layout, panes, savedAt } };
}

export function deleteNamedLayout<P>(
  existing: Record<string, NamedLayoutEntry<P>>,
  name: string
): Record<string, NamedLayoutEntry<P>> {
  if (!(name in existing)) return existing;
  const next = { ...existing };
  delete next[name];
  return next;
}

export function persistNamedLayouts<P>(map: Record<string, NamedLayoutEntry<P>>): void {
  try {
    if (Object.keys(map).length === 0) localStorage.removeItem(NAMED_LAYOUTS_KEY);
    else localStorage.setItem(NAMED_LAYOUTS_KEY, JSON.stringify(map));
  } catch {
    /* storage full/blocked — the desk still works, the shelf just won't
       survive a reload */
  }
}
