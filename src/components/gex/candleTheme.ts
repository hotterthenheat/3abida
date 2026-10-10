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
import { getColourVision, getResolvedTheme, subscribeTheme, type ColourVision, type Theme } from '../../theme/theme';

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
  /** Up bodies drawn hollow — the border and the wick in `up`, no fill — while `up` stays the ink a line or a bar is
      drawn in (the colour-vision cut, `themeFor`) */
  hollowUp?: boolean;
  /** Chart surface tint. Absent = transparent, the house canvas shows through.
      `light` marks a LIGHT ground (Stone, 2026-09-11): the chart's own ink
      (the axis text, the scale borders, the crosshair — see `chartSurface`)
      flips to dark cuts, and every host stamps `data-chart-ground` from
      `chartGround()` on the box that holds its chrome, so the strips and
      chips over the tape wear the tape's ground by CSS (index.css) — the
      drawing rail alone stays black (Noah, 2026-09-13).
      The overlays drawn ON the tape (dark-pool dashes, level lines, trail
      alphas) still assume a dark surface — their pass is separate. */
  canvas?: {
    bg: string;
    grid: string;
    light?: boolean;
    /** THE SAME GROUND, CUT FOR THE LIGHT PAGE (Noah, 2026-09-19, the hour Stone became the light page's default: "the
        charts need to be a lighter gray"). Stone's grey was mixed to sit on a BLACK page, where it is the one light thing;
        on a white page the same grey is the darkest thing in the room. So on the light page the ground is a paler grey —
        the candles, the inks and the theme's name are the same. On the dark page nothing moves (his Terrain picture:
        QQQ on Stone beside SPY on black). index.css lifts the chrome's light set to match, under `html[data-theme=light]`. */
    bgOnLightPage?: string;
  };
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
    upColor: t.hollowUp ? 'rgba(0,0,0,0)' : t.up,
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
    bg: (getResolvedTheme() === 'light' ? t.canvas?.bgOnLightPage : undefined) ?? t.canvas?.bg ?? 'transparent',
    grid: t.canvas?.grid ?? 'rgba(255,255,255,0.03)',
    text: light ? '#3b3e45' : '#7d7d7d',
    line: light ? 'rgba(0,0,0,0.18)' : '#1c1c1c',
    crosshair: light ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.3)',
    label: light ? '#3a3d44' : '#262626',
    light,
  };
}

/* A FIGURE IS NOT A TAPE (Noah, 2026-09-20, the pair grey on his dark page: "you fixed the light theme but those changes
   went into the dark theme so the dark theme has a light background" — the second time). The candle theme is THE CANDLES'
   — the tapes that draw candles and carry (or share) the Theme menu. A chart with no candles — the small figure chart
   (record/SessionsChart: the pair, the simulated returns, the stock page's sessions) and "Since the open" — used to take
   the candle theme's GROUND all the same, so a Stone pick made for the tapes turned every figure on the dark terminal
   grey. They follow THE PAGE and nothing else now: paper on the light page, and on the dark terminal THIS surface — the
   dark island on the panel, which is exactly what they were under the default (Glacier has no ground of its own), so
   nobody on the default sees a change. The values are chartSurface's own for a dark theme without a ground. */
export const DARK_FIGURE_SURFACE: ChartSurface = { bg: 'transparent', grid: 'rgba(255,255,255,0.03)', text: '#7d7d7d', line: '#1c1c1c', crosshair: 'rgba(255,255,255,0.3)', label: '#262626', light: false };

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
     white dark-pool dashes, the accent's level lines) still wait for their pass. */
  stone: {
    up: '#6887DE',
    down: '#000000',
    wickUp: '#6887DE',
    wickDown: '#000000',
    volUp: 'rgba(104,135,222,0.38)',
    volDown: 'rgba(0,0,0,0.28)',
    canvas: { bg: '#BEBDB8', bgOnLightPage: '#DDDCD7', grid: 'rgba(0,0,0,0.06)', light: true },
  },
} as const satisfies Record<string, CandleTheme>;

export type CandleThemeKey = keyof typeof CANDLE_THEMES;

/* THE TAPES IN GREEN AND RED, FOR A READER WHO CANNOT TELL THEM APART (Settings › Appearance, the blue–orange pair,
   2026-10-10): Neon and Market are the two themes whose up and down are the green and the red, so under `data-cvd` they
   take the blue and the orange the house's direction inks become (tokens.css), and their up bodies are drawn HOLLOW — a
   rise and a fall told apart by shape as well as hue, as a signed figure wears ▲/▼. Every other theme is a pair of
   lightness already and is left as picked. */
const CVD_BLUE = '#50A4FF';
const CVD_ORANGE = '#FF8526';
const RED_GREEN: readonly CandleThemeKey[] = ['classic', 'market'];
const CVD_CUTS: Partial<Record<CandleThemeKey, CandleTheme>> = Object.fromEntries(
  RED_GREEN.map(k => [
    k,
    {
      ...CANDLE_THEMES[k],
      up: CVD_BLUE,
      down: CVD_ORANGE,
      wickUp: CVD_BLUE,
      wickDown: CVD_ORANGE,
      borderUp: CVD_BLUE,
      borderDown: CVD_ORANGE,
      volUp: 'rgba(80,164,255,0.26)',
      volDown: 'rgba(255,133,38,0.26)',
      hollowUp: true,
    } satisfies CandleTheme,
  ])
);

/** The theme a chart paints for a key, cut for the reader's colour vision (the same object every time, so a ref compare holds) */
export function themeFor(key: CandleThemeKey, vision: ColourVision = getColourVision()): CandleTheme {
  return (vision === 'blue-orange' ? CVD_CUTS[key] : undefined) ?? CANDLE_THEMES[key];
}

// Noah's pick order: Chrome is the locked house default; Velvet then Glacier
// are the sanctioned fallbacks if it wears badly. The gallery block (with
// themed surfaces) follows the originals.
/* Each with one line for the Theme menu's list (2026-09-11: the menu shows the
   chart itself in the hovered theme, the Pulse widget-preview grammar) */
export const CANDLE_THEME_OPTIONS: { value: CandleThemeKey; label: string; hint: string }[] = [
  { value: 'glacier', label: 'Glacier', hint: 'Glacier blue up, slate down — the default on the dark theme' },
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
  { value: 'stone', label: 'Stone', hint: 'Blue up, black down, on a stone-grey ground — the default on the light theme' },
];

// ---- store ------------------------------------------------------------------

/* A PICK PER PAGE THEME (Noah, 2026-09-19, the light sweep: "the chart backgrounds should be the 'stone' one on default
   for the light theme"). A black tape on a white page is a hole in the paper; Stone is the tape cut for a light room. So
   the store keeps TWO picks — the one made on the dark page (the old key, untouched) and the one made on the light page —
   and answers with the pick of the page theme that is up. Glacier is the dark page's default, Stone the light page's; a
   flip of the page re-inks every chart through the same listeners a pick does. A pick made on one page never moves the
   other: everyone already holds a stored 'glacier' from the day it became the default, and one shared key would have
   read that as a choice and kept Stone off the light page for good. */
const STORAGE_KEY = 'slayer_candle_theme';
const LIGHT_STORAGE_KEY = 'slayer_candle_theme_light';
const PAGE_DEFAULT: Record<Theme, CandleThemeKey> = { dark: 'glacier', light: 'stone' };
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

function loadLightKey(): CandleThemeKey {
  try {
    const raw = localStorage.getItem(LIGHT_STORAGE_KEY);
    if (raw && raw in CANDLE_THEMES) return raw as CandleThemeKey;
  } catch {
    /* storage unavailable — fall through to default */
  }
  return PAGE_DEFAULT.light;
}

/* THE GROUND ON THE HOST (2026-09-11 as a stamp on <html> from the store;
   re-cut 2026-09-13 PER HOST): each chart host puts `data-chart-ground` on
   the box that holds its chrome, from the theme IT resolved — Terrain's pane
   from its own theme, the Pulse tile and the Weigher from the store — and
   index.css re-scopes the tokens on every strip and chip inside (the
   data-chart-chrome blocks, the chart's own data-chart-ink box) to that
   ground, so a Stone pane's chrome is stone with dark ink while the pane
   beside it on Glacier keeps black with light ink. A stamp on <html> could
   not do that: a Terrain pane holds a theme the store does not. */
export function chartGround(key: CandleThemeKey): 'light' | 'dark' {
  return chartSurface(CANDLE_THEMES[key]).light ? 'light' : 'dark';
}

const picks: Record<Theme, CandleThemeKey> = { dark: loadKey(), light: loadLightKey() };
const listeners = new Set<() => void>();

/** The tape a page opens on when nothing was picked: Glacier on the dark terminal, Stone on paper */
export function pageDefaultCandleKey(): CandleThemeKey {
  return PAGE_DEFAULT[getResolvedTheme()];
}
/** The same, reactive to a flip of the page */
export function usePageDefaultCandleKey(): CandleThemeKey {
  return useSyncExternalStore(subscribeTheme, pageDefaultCandleKey, pageDefaultCandleKey);
}

/** The candle theme of the page theme that is up */
export function getCandleThemeKey(): CandleThemeKey {
  return picks[getResolvedTheme()];
}

export function getCandleTheme(): CandleTheme {
  return themeFor(getCandleThemeKey());
}

/** A pick belongs to the page theme it was made on */
export function setCandleTheme(key: CandleThemeKey): void {
  const page = getResolvedTheme();
  if (key === picks[page]) return;
  picks[page] = key;
  try {
    localStorage.setItem(page === 'light' ? LIGHT_STORAGE_KEY : STORAGE_KEY, key);
  } catch {
    /* non-fatal */
  }
  listeners.forEach(fn => fn());
}

/* the page flipped: the other pick is the answer now, and every chart re-inks */
subscribeTheme(() => listeners.forEach(fn => fn()));

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Reactive theme key — charts recolor in place when the picker changes it. */
export function useCandleThemeKey(): CandleThemeKey {
  return useSyncExternalStore(subscribe, getCandleThemeKey, getCandleThemeKey);
}
