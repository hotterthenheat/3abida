/*
==================================================
  SLAYER TERMINAL - THE THEME (theme/theme.ts)

  The reader's choice — dark, light, or the
  machine's — kept in one place and applied as ONE
  attribute on <html> (tokens.css does the rest).
  index.html sets the same attribute before the
  first paint from the same key, so a stored theme
  never flashes the other one on load.

  What a component needs from here:
    useThemeChoice()    the choice, for the control
    useResolvedTheme()  'dark' | 'light', for code
                        that holds colours in JS
                        (a chart's axis ink, a
                        canvas fill) and must redo
                        them when the theme moves
    readToken(name)     a token as a CSS colour,
                        for canvas and chart APIs
                        that cannot read var()
    subscribeTheme(fn)  the module-level hook the
                        candle theme uses to
                        re-stamp the chart ground
    useColourVision()   the direction pair: the
                        house's green and red, or
                        blue and orange with ▲/▼
                        (Settings › Appearance,
                        2026-10-09) — `data-cvd` on
                        <html>, tokens.css does the
                        rest

  'system' follows prefers-color-scheme live — the
  machine's own toggle moves the terminal too.
==================================================
*/

import { useSyncExternalStore } from 'react';
import { EMBEDDED, EMBED_THEME } from '../embed';
import { isTerminalPath } from '../core/terminalPath';

export type ThemeChoice = 'dark' | 'light' | 'system';
export type Theme = 'dark' | 'light';

/** The one key — index.html's boot script reads it too */
export const THEME_KEY = 'slayer_theme';

const CHOICES: ThemeChoice[] = ['dark', 'light', 'system'];

function loadChoice(): ThemeChoice {
  /* in the landing's window the page outside names the theme (embed.ts) */
  if (EMBED_THEME) return EMBED_THEME;
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw && (CHOICES as string[]).includes(raw)) return raw as ThemeChoice;
  } catch {
    /* storage blocked — the dark terminal */
  }
  return 'dark';
}

const media = typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const systemTheme = (): Theme => (media && !media.matches ? 'light' : 'dark');
const resolve = (choice: ThemeChoice): Theme => (choice === 'system' ? systemTheme() : choice);

let choice: ThemeChoice = loadChoice();
let resolved: Theme = resolve(choice);
const listeners = new Set<() => void>();
/** Colours read out of the tokens, per theme — a canvas asks once per frame, not the style engine */
const tokenCache = new Map<string, string>();

/* THE LANDING STANDS ON ITS OWN GROUND (2026-10-03): on a first visit it follows the machine while the terminal with no
   choice made stays dark (pages/landing/ground.tsx readBase). While it is up it stamps the root with that ground
   (stampRoot), so the house's root-written rules and readToken answer for the page on screen; leaving, it hands the root
   back to the reader's choice. The stamp starts here as index.html set it before the first paint — set to dark here, the
   root went black under a light landing until the landing's own code had come. THE PAGES OUTSIDE THE TERMINAL TOO (the
   about, legal and account pages, a wrong address's prompt — the audit's OU-T1, 2026-10-09): every address but the
   terminal's (core/terminalPath.ts) stands on the same ground from this first word; the page's frame
   (pages/outside/OutsideFrame.tsx) holds it once its code has come. */
const firstGround = (): Theme | null => {
  if (typeof window === 'undefined' || EMBEDDED || isTerminalPath(window.location.pathname)) return null;
  try {
    if (localStorage.getItem(THEME_KEY) != null) return null;
  } catch {
    /* storage blocked: no choice made */
  }
  return systemTheme();
};
let stamp: Theme | null = firstGround();

/* ── COLOUR VISION (2026-10-09) ─────────────────────────────────────────────────────────────────────────────────── */
export type ColourVision = 'standard' | 'blue-orange';
export const CVD_KEY = 'slayer_cvd';
function loadCvd(): ColourVision {
  try {
    return localStorage.getItem(CVD_KEY) === 'blue-orange' ? 'blue-orange' : 'standard';
  } catch {
    return 'standard';
  }
}
let cvd: ColourVision = loadCvd();

function apply(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const on = stamp ?? resolved;
  root.dataset.theme = on;
  /* the direction pair, on every page — the landing included, whose only colour is the market's */
  if (cvd === 'blue-orange') root.dataset.cvd = cvd;
  else delete root.dataset.cvd;
  tokenCache.clear();
  /* a phone's browser bar takes the ground (index.html sets it before the first paint) */
  const ground = getComputedStyle(root).getPropertyValue('--canvas').trim();
  if (ground) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${ground})`);
}

/** A page on its own ground stamps the root with it while it is up; null hands the root back to the reader's choice */
export function stampRoot(next: Theme | null): void {
  if (next === stamp) return;
  stamp = next;
  apply();
}

function settle(): void {
  const next = resolve(choice);
  if (next === resolved) return;
  resolved = next;
  apply();
  listeners.forEach(fn => fn());
}

/* The attribute is on <html> already (index.html) — this keeps it honest if
   storage and the boot script ever disagree, and clears the reader's cache */
apply();
media?.addEventListener('change', () => {
  if (choice === 'system') settle();
});

export const getThemeChoice = (): ThemeChoice => choice;
export const getResolvedTheme = (): Theme => resolved;

export function setThemeChoice(next: ThemeChoice): void {
  if (next === choice) return;
  choice = next;
  /* the landing's window shares the visitor's storage — a tour never rewrites their theme (embed.ts) */
  if (!EMBEDDED) {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* non-fatal */
    }
  }
  const before = resolved;
  resolved = resolve(choice);
  apply();
  /* The choice changed even when the theme did not (dark → system on a dark machine) */
  listeners.forEach(fn => fn());
  if (before !== resolved) tokenCache.clear();
}

export const getColourVision = (): ColourVision => cvd;

/** Swap the direction pair — every token reader hears it as a theme change, so a chart re-reads its inks */
export function setColourVision(next: ColourVision): void {
  if (next === cvd) return;
  cvd = next;
  if (!EMBEDDED) {
    try {
      if (next === 'standard') localStorage.removeItem(CVD_KEY);
      else localStorage.setItem(CVD_KEY, next);
    } catch {
      /* non-fatal — the choice lives for the visit */
    }
  }
  apply();
  cvdListeners.forEach(fn => fn());
  listeners.forEach(fn => fn());
}
const cvdListeners = new Set<() => void>();
const subscribeCvd = (fn: () => void) => {
  cvdListeners.add(fn);
  return () => {
    cvdListeners.delete(fn);
  };
};
export const useColourVision = (): ColourVision => useSyncExternalStore(subscribeCvd, getColourVision, getColourVision);

/** The direction a signed figure carries, for its `data-dir` (tokens.css draws ▲/▼ from it under the blue–orange pair) */
export const dirOf = (n: number): 'up' | 'down' | undefined => (n > 0 ? 'up' : n < 0 ? 'down' : undefined);

export function subscribeTheme(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const useThemeChoice = (): ThemeChoice => useSyncExternalStore(subscribeTheme, getThemeChoice, getThemeChoice);
export const useResolvedTheme = (): Theme => useSyncExternalStore(subscribeTheme, getResolvedTheme, getResolvedTheme);

/** A token ("--text-muted") as a CSS colour string ("rgb(125 125 125)"), with an
    optional alpha — for canvas fills and chart options that cannot read var().
    Read from the document's computed style, so a scoped theme on an element
    is NOT seen here; pass the element whose scope should answer. */
export function readToken(name: string, alpha?: number, from?: Element | null): string {
  const key = `${name}|${alpha ?? ''}|${from ? 'el' : ''}`;
  if (!from) {
    const hit = tokenCache.get(key);
    if (hit) return hit;
  }
  const el = from ?? (typeof document !== 'undefined' ? document.documentElement : null);
  const raw = el ? getComputedStyle(el).getPropertyValue(name).trim() : '';
  const channels = raw || '237 237 237';
  const out = alpha == null ? `rgb(${channels})` : `rgb(${channels} / ${alpha})`;
  if (!from) tokenCache.set(key, out);
  return out;
}
