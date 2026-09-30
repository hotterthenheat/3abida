/*
==================================================
  SLAYER TERMINAL - A DEFAULT THAT CHANGED UNDER
  STORED STATE (core/storedDefaults.ts)

  Some hosts write a chart's overlays to storage the
  first time they save, so a changed default reaches
  only a browser that has never opened the page. When
  a default changes and the change is meant for
  everyone, it is carried into storage here — ONCE,
  behind a flag, before the app reads anything. After
  that the reader's own switch is theirs again.

  KEY LEVELS OPEN OFF (Noah, 2026-09-19: "every chart
  should have key levels off to begin with for the
  overlays, even the landing page one"). The default
  itself is StrikeChart's DEFAULT_OVERLAYS; this turns
  the stored copies off to match:
    · Terrain's panes, its per-symbol setups, and the
      old flat shape        (slayer_terrain_v1)
    · the four-chart board  (slayer_pulse_board)
  NOT touched: Terrain's SAVED LAYOUTS — an
  arrangement the reader named and kept is their
  choice, not a default that was written for them.
  The Pulse chart tile and the Weigher's chart hold
  their overlays in memory, so the default alone
  reaches them — and the landing's window, which is
  the Pulse tile.

  A TERRAIN PANE FOLLOWS THE STORE UNTIL IT IS GIVEN A
  THEME (Noah, 2026-09-19: "the chart backgrounds
  should be the 'stone' one on default for the light
  theme"). Every pane used to be written with a theme
  the day it was made — 'glacier', the default — so a
  stored 'glacier' is a default that was written for
  the reader, not a choice. It is let go once, here,
  and the pane wears the page's default (Glacier on
  the dark terminal, Stone on paper — never the
  store's pick, so the dark terminal does not move). Any other stored theme is
  a pick and stays on both pages. Saved layouts are
  left alone, as above.
==================================================
*/

const LEVELS_OFF_FLAG = 'slayer_levels_off_v1';
const PANE_THEME_FOLLOWS_FLAG = 'slayer_pane_theme_follows_v1';

type Bag = Record<string, unknown>;
const isBag = (v: unknown): v is Bag => !!v && typeof v === 'object' && !Array.isArray(v);
const levelsOff = (holder: unknown): void => {
  if (isBag(holder) && isBag(holder.overlays)) holder.overlays.levels = false;
};

const rewrite = (key: string, edit: (parsed: unknown) => void): void => {
  const raw = localStorage.getItem(key);
  if (!raw) return;
  const parsed: unknown = JSON.parse(raw);
  edit(parsed);
  localStorage.setItem(key, JSON.stringify(parsed));
};

/** One pass, once, behind its flag */
const once = (flag: string, pass: () => void): void => {
  try {
    if (localStorage.getItem(flag)) return;
    localStorage.setItem(flag, '1');
    pass();
  } catch {
    /* storage off, or a value that will not parse — each page's own loader already copes with both */
  }
};

/** Run before the first render. Safe to call on every load: each pass does its work once. */
export function applyStoredDefaults(): void {
  once(LEVELS_OFF_FLAG, () => {
    rewrite('slayer_terrain_v1', c => {
      if (!isBag(c)) return;
      levelsOff(c);
      if (Array.isArray(c.panes)) c.panes.forEach(levelsOff);
      if (isBag(c.setups)) Object.values(c.setups).forEach(levelsOff);
    });
    rewrite('slayer_pulse_board', cells => {
      if (Array.isArray(cells)) cells.forEach(levelsOff);
    });
  });
  once(PANE_THEME_FOLLOWS_FLAG, () => {
    rewrite('slayer_terrain_v1', c => {
      if (!isBag(c) || !Array.isArray(c.panes)) return;
      c.panes.forEach(p => {
        if (isBag(p) && p.theme === 'glacier') delete p.theme;
      });
    });
  });
}
