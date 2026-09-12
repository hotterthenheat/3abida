/*
  Candlestick color themes — now a live, app-wide store. The picker on Pulse
  writes here; every chart (StrikeChart, MiniPane, CampaignChart) subscribes
  and recolors in place. Persisted so the choice survives reloads.

  Palette rules: lime/red are the bull/bear TOKENS (badges, bars, direction
  text) — candles must read up/down instantly WITHOUT stealing those tokens,
  and without colliding with level colors (lime wall / red wall / baby-blue
  flip / silver supreme / white spot).
*/

import { useSyncExternalStore } from 'react';

export interface CandleTheme {
  up: string;
  down: string;
  wickUp: string;
  wickDown: string;
  volUp: string;
  volDown: string;
  /** Body border overrides. A theme draws HOLLOW bodies by filling with the
      canvas color and bordering with the real ink (see `wire`). */
  borderUp?: string;
  borderDown?: string;
  /** Chart surface tint. Absent = transparent, the house canvas shows through.
      `light` marks a LIGHT ground (Stone, 2026-09-11): the chart's own ink
      (the axis text, the scale borders, the crosshair — see `chartSurface`)
      flips to dark cuts, and the store stamps `<html data-chart-ground>` so
      every strip the hosts float over the tape flips with it (index.css).
      The overlays drawn ON the tape (dark-pool dashes, level lines, trail
      alphas) still assume a dark surface — their pass is separate. */
  canvas?: { bg: string; grid: string; light?: boolean };
}

/** Everything a chart paints its frame with, on the theme's ground */
export interface ChartSurface {
  bg: string;
  grid: string;
  /** The axis ink — lightweight-charts `layout.textColor` */
  text: string;
  /** The price and time scales' border */
  line: string;
  /** The crosshair's hairline */
  crosshair: string;
  /** The crosshair's label box */
  label: string;
  /** A light ground — the inks above are the dark cuts */
  light: boolean;
}

/** One applyOptions payload for a candlestick series — every chart uses this
    so hollow-body themes can't be half-applied. */
export function candleSeriesOptions(t: CandleTheme) {
  return {
    upColor: t.up,
    downColor: t.down,
    borderUpColor: t.borderUp ?? t.up,
    borderDownColor: t.borderDown ?? t.down,
    wickUpColor: t.wickUp,
    wickDownColor: t.wickDown,
  };
}

/** Chart surface colors with the house defaults filled in. On a dark ground
    the frame's inks are the house ones (#7d7d7d axis ink, #1c1c1c scale
    borders, the white hairline crosshair); on a light ground each is its dark
    cut, so the numbers read. THE GROUND is the theme's own: Stone is light;
    a theme with no canvas shows its host through, and every chart host is a
    dark island whatever the page wears (Noah, 2026-09-12: "the charts to by
    default always be black") — so that ground is dark. */
export function chartSurface(t: CandleTheme): ChartSurface {
  const light = t.canvas?.light === true;
  return {
    bg: t.canvas?.bg ?? 'transparent',
    grid: t.canvas?.grid ?? 'rgba(255,255,255,0.03)',
    text: light ? '#3b3e45' : '#7d7d7d',
    line: light ? 'rgba(0,0,0,0.18)' : '#1c1c1c',
    crosshair: light ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.3)',
    label: light ? '#3a3d44' : '#262626',
    light,
  };
}

export const CANDLE_THEMES = {
  // Neutral, premium — near-white up / slate down (the launch default)
  mono: {
    up: '#eef1f5',
    down: '#565c68',
    wickUp: '#eef1f5',
    wickDown: '#565c68',
    volUp: 'rgba(238,241,245,0.22)',
    volDown: 'rgba(86,92,104,0.30)',
  },
  /* THE FOIL (Noah, 2026-08-29: "even the candles on the live charts should
     incorporate the holographic foil gradient"). The chart engine paints a
     candle body as ONE solid color — a per-candle animated gradient is not a
     thing it can do — so the theme is drawn FROM the foil's own stops:
     the gradient's chrome-white crest up, its pale-violet steel down, ice
     wicks. The tape as a whole IS the foil, laid flat. */
  foil: {
    up: '#EEF1F8',
    down: '#8B84B4',
    wickUp: '#C9D9F0',
    wickDown: '#A79FC9',
    volUp: 'rgba(238,241,248,0.20)',
    volDown: 'rgba(139,132,180,0.26)',
  },
  // Liquid metal — ice-silver up / gunmetal down. Ties into the holo brand.
  chrome: {
    up: '#DCE6F5',
    down: '#414B5C',
    wickUp: '#EAF0F9',
    wickDown: '#5A6577',
    volUp: 'rgba(220,230,245,0.22)',
    volDown: 'rgba(65,75,92,0.34)',
  },
  // Arctic — soft glacier blue up / deep slate-navy down. Calm, readable.
  // THE HOUSE DEFAULT since 2026-08-29 (Noah: "yes it should be baby blue" —
  // the baby-blue tape he picked for the candles themselves).
  glacier: {
    up: '#93C9F2',
    down: '#3B4A61',
    wickUp: '#B4DAF8',
    wickDown: '#53647e',
    volUp: 'rgba(147,201,242,0.20)',
    volDown: 'rgba(59,74,97,0.34)',
  },
  // Velvet — warm ivory up / muted violet down. Echoes the pastel heat family.
  velvet: {
    up: '#F2EFE6',
    down: '#8F7BB8',
    wickUp: '#F7F5EE',
    wickDown: '#A490C9',
    volUp: 'rgba(242,239,230,0.20)',
    volDown: 'rgba(143,123,184,0.26)',
  },
  // House neon — lime up / hot red down (loud; doubles the token colors)
  classic: {
    up: '#CFFFB1',
    down: '#FF3B30',
    wickUp: '#CFFFB1',
    wickDown: '#FF3B30',
    volUp: 'rgba(207,255,177,0.28)',
    volDown: 'rgba(255,59,48,0.28)',
  },
  // ---- gallery (2026-08-01, from Noah's TradingView references) ------------
  // The real green/red every retail chart speaks — house bull/bear tokens.
  market: {
    up: '#30D158',
    down: '#FF3B30',
    wickUp: '#4ADE6E',
    wickDown: '#FF5F55',
    volUp: 'rgba(48,209,88,0.24)',
    volDown: 'rgba(255,59,48,0.24)',
    canvas: { bg: '#060907', grid: 'rgba(255,255,255,0.04)' },
  },
  // Two blues on blue-black — pale ice up / saturated steel down.
  tide: {
    up: '#C9E8F7',
    down: '#4A82D9',
    wickUp: '#DDF1FB',
    wickDown: '#6B9AE3',
    volUp: 'rgba(201,232,247,0.20)',
    volDown: 'rgba(74,130,217,0.26)',
    canvas: { bg: '#05080D', grid: 'rgba(151,193,235,0.05)' },
  },
  // Cream up / harbor blue down on navy. Velvet's cousin with blue, not violet.
  harbor: {
    up: '#EDE4CD',
    down: '#4B80D6',
    wickUp: '#F4EEDD',
    wickDown: '#6C99E0',
    volUp: 'rgba(237,228,205,0.18)',
    volDown: 'rgba(75,128,214,0.24)',
    canvas: { bg: '#0A101C', grid: 'rgba(237,228,205,0.05)' },
  },
  // Periwinkle up / royal purple down on deep violet. (Reference had a light
  // lavender surface — adapted to the dark family, see CandleTheme.canvas.)
  whipsaw: {
    up: '#BBB2E8',
    down: '#5E2D92',
    wickUp: '#CFC8F0',
    wickDown: '#7A4BAE',
    volUp: 'rgba(187,178,232,0.20)',
    volDown: 'rgba(94,45,146,0.30)',
    canvas: { bg: '#120D1D', grid: 'rgba(187,178,232,0.06)' },
  },
  // Green up / violet down on pure black — the loud high-contrast pair.
  contrast: {
    up: '#2FD05E',
    down: '#8A55D6',
    wickUp: '#52DB79',
    wickDown: '#A374E4',
    volUp: 'rgba(47,208,94,0.22)',
    volDown: 'rgba(138,85,214,0.26)',
    canvas: { bg: '#050505', grid: 'rgba(255,255,255,0.045)' },
  },
  // Monochrome wireframe — hollow white up (fill = canvas), solid white down.
  wire: {
    up: '#0B0B0F',
    down: '#E8EAF0',
    wickUp: '#E8EAF0',
    wickDown: '#E8EAF0',
    volUp: 'rgba(232,234,240,0.14)',
    volDown: 'rgba(232,234,240,0.28)',
    borderUp: '#E8EAF0',
    borderDown: '#E8EAF0',
    canvas: { bg: '#0B0B0F', grid: 'rgba(255,255,255,0.05)' },
  },
  /* STONE (Noah, 2026-09-11, from his TradingView screenshot: "i love this
     color type — blue 6887de, black 000000, canvas bebdb8"): periwinkle blue
     up, black down, on a warm stone-grey ground. THE ONE LIGHT GROUND in the
     family — `light` flips the chart's frame inks and every strip floating
     over the tape to their dark cuts (Noah, same day: "everything looks
     invisible on this theme"). The overlays drawn on the tape itself (the
     white dark-pool dashes, the lime level lines) still wait for their pass. */
  stone: {
    up: '#6887DE',
    down: '#000000',
    wickUp: '#6887DE',
    wickDown: '#000000',
    volUp: 'rgba(104,135,222,0.38)',
    volDown: 'rgba(0,0,0,0.28)',
    canvas: { bg: '#BEBDB8', grid: 'rgba(0,0,0,0.06)', light: true },
  },
} as const satisfies Record<string, CandleTheme>;

export type CandleThemeKey = keyof typeof CANDLE_THEMES;

// Noah's pick order: Chrome is the locked house default; Velvet then Glacier
// are the sanctioned fallbacks if it wears badly. The gallery block (with
// themed surfaces) follows the originals.
/* Each with one line for the Theme menu's list (2026-09-11: the menu shows the
   chart itself in the hovered theme, the Pulse widget-preview grammar) */
export const CANDLE_THEME_OPTIONS: { value: CandleThemeKey; label: string; hint: string }[] = [
  { value: 'glacier', label: 'Glacier', hint: 'Glacier blue up, slate down — the house default' },
  { value: 'foil', label: 'Foil', hint: 'The holo foil laid flat — chrome up, pale violet down' },
  { value: 'chrome', label: 'Chrome', hint: 'Liquid metal — ice silver up, gunmetal down' },
  { value: 'velvet', label: 'Velvet', hint: 'Warm ivory up, muted violet down' },
  { value: 'mono', label: 'Mono', hint: 'Near-white up, slate down — no colour at all' },
  { value: 'classic', label: 'Neon', hint: 'Lime up, hot red down — the house tokens, loud' },
  { value: 'market', label: 'Market', hint: "Green up, red down — the market's own, on a green-black ground" },
  { value: 'tide', label: 'Tide', hint: 'Two blues — pale ice up, steel down, on blue-black' },
  { value: 'harbor', label: 'Harbor', hint: 'Cream up, harbor blue down, on navy' },
  { value: 'whipsaw', label: 'Whipsaw', hint: 'Periwinkle up, royal purple down, on deep violet' },
  { value: 'contrast', label: 'Contrast', hint: 'Green up, violet down, on pure black' },
  { value: 'wire', label: 'Wire', hint: 'Hollow white up, solid white down — a wireframe' },
  { value: 'stone', label: 'Stone', hint: 'Blue up, black down, on a stone-grey ground — the light one' },
];

// ---- store ------------------------------------------------------------------

const STORAGE_KEY = 'slayer_candle_theme';
/* One-time flip to the baby-blue tape (2026-08-29, "yes it should be baby
   blue" — supersedes the same-day foil flip, whose flag is left inert): a
   stored older pick would silently keep the new default invisible. Runs
   once — after that the picker's word is law again. */
const SKY_FLAG = 'slayer_candle_theme_sky1';

function loadKey(): CandleThemeKey {
  try {
    if (!localStorage.getItem(SKY_FLAG)) {
      localStorage.setItem(SKY_FLAG, '1');
      localStorage.setItem(STORAGE_KEY, 'glacier');
      return 'glacier';
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && raw in CANDLE_THEMES) return raw as CandleThemeKey;
  } catch {
    /* storage unavailable — fall through to default */
  }
  return 'glacier';
}

/* THE GROUND ON THE DOCUMENT (2026-09-11): `<html data-chart-ground="light">`
   while a light theme is on, so the DOM over the tape — the strips the hosts
   float (data-chart-chrome) and everything inside a chart's own box
   (data-chart-ink) — flips to dark inks by CSS (index.css) without every
   host learning the theme. The dark family stamps "dark", the default look. */
function stampGround(key: CandleThemeKey): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.chartGround = chartSurface(CANDLE_THEMES[key]).light ? 'light' : 'dark';
}

let currentKey: CandleThemeKey = loadKey();
stampGround(currentKey);
const listeners = new Set<() => void>();

export function getCandleThemeKey(): CandleThemeKey {
  return currentKey;
}

export function getCandleTheme(): CandleTheme {
  return CANDLE_THEMES[currentKey];
}

export function setCandleTheme(key: CandleThemeKey): void {
  if (key === currentKey) return;
  currentKey = key;
  stampGround(key);
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    /* non-fatal */
  }
  listeners.forEach(fn => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Reactive theme key — charts recolor in place when the picker changes it. */
export function useCandleThemeKey(): CandleThemeKey {
  return useSyncExternalStore(subscribe, getCandleThemeKey, getCandleThemeKey);
}
