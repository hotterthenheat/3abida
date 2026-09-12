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

  'system' follows prefers-color-scheme live — the
  machine's own toggle moves the terminal too.
==================================================
*/

import { useSyncExternalStore } from 'react';

export type ThemeChoice = 'dark' | 'light' | 'system';
export type Theme = 'dark' | 'light';

/** The one key — index.html's boot script reads it too */
export const THEME_KEY = 'slayer_theme';

const CHOICES: ThemeChoice[] = ['dark', 'light', 'system'];

function loadChoice(): ThemeChoice {
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

function apply(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = resolved;
  tokenCache.clear();
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
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* non-fatal */
  }
  const before = resolved;
  resolved = resolve(choice);
  apply();
  /* The choice changed even when the theme did not (dark → system on a dark machine) */
  listeners.forEach(fn => fn());
  if (before !== resolved) tokenCache.clear();
}

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
