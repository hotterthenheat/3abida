/*
==================================================
  SLAYER TERMINAL - PINE COLOURS (core/pine/colors.ts)

  Pine's named colours (TradingView's own values, so a
  pasted script draws what its author saw), hex
  literals with and without alpha, `color.new` /
  `color.rgb` / `color.from_gradient`, and the CSS a
  chart can take.
==================================================
*/

import type { PineColor } from './types';

export const NAMED: Record<string, string> = {
  aqua: '#00BCD4',
  black: '#363A45',
  blue: '#2962FF',
  fuchsia: '#E040FB',
  gray: '#787B86',
  green: '#4CAF50',
  lime: '#00E676',
  maroon: '#880E4F',
  navy: '#311B92',
  olive: '#808000',
  orange: '#FF9800',
  purple: '#9C27B0',
  red: '#F23645',
  silver: '#B2B5BE',
  teal: '#00897B',
  white: '#FFFFFF',
  yellow: '#FFEB3B',
};

/* READ ONCE, KEPT (2026-10-15): a colour literal is read on every bar it is reached, and a colour is never changed in
   place (color.new and the rest make a new one), so a hex's colour and a colour's CSS are kept and handed out again —
   they were a tenth of a run in the profile. */
const hexKept = new Map<string, PineColor>();
const cssKept = new Map<number, Map<number, string>>();

export const fromHex = (hex: string): PineColor => {
  const kept = hexKept.get(hex);
  if (kept) return kept;
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  const c = { r, g, b, a };
  if (hexKept.size > 4096) hexKept.clear();
  hexKept.set(hex, c);
  return c;
};

export const named = (name: string): PineColor | null => (NAMED[name] ? fromHex(NAMED[name]) : null);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** `color.new(c, transp)` — transp 0 opaque … 100 invisible */
export const withTransp = (c: PineColor, transp: number): PineColor => ({ ...c, a: clamp(1 - transp / 100, 0, 1) });

export const rgb = (r: number, g: number, b: number, transp = 0): PineColor => ({ r: clamp(Math.round(r), 0, 255), g: clamp(Math.round(g), 0, 255), b: clamp(Math.round(b), 0, 255), a: clamp(1 - transp / 100, 0, 1) });

/** `color.from_gradient(value, bottom, top, bottomColor, topColor)` */
export const gradient = (value: number, bottom: number, top: number, c0: PineColor, c1: PineColor): PineColor => {
  const t = top === bottom ? 0 : clamp((value - bottom) / (top - bottom), 0, 1);
  return { r: Math.round(c0.r + (c1.r - c0.r) * t), g: Math.round(c0.g + (c1.g - c0.g) * t), b: Math.round(c0.b + (c1.b - c0.b) * t), a: c0.a + (c1.a - c0.a) * t };
};

const cssOf = (c: PineColor): string => (c.a >= 1 ? `#${[c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('')}` : `rgba(${c.r}, ${c.g}, ${c.b}, ${Number(c.a.toFixed(3))})`);

export const toCss = (c: PineColor): string => {
  const rgbKey = (c.r * 256 + c.g) * 256 + c.b;
  if (!Number.isInteger(c.r) || !Number.isInteger(c.g) || !Number.isInteger(c.b)) return cssOf(c);
  let byAlpha = cssKept.get(rgbKey);
  if (!byAlpha) {
    if (cssKept.size > 4096) cssKept.clear();
    byAlpha = new Map();
    cssKept.set(rgbKey, byAlpha);
  }
  let css = byAlpha.get(c.a);
  if (css === undefined) {
    css = cssOf(c);
    if (byAlpha.size > 256) byAlpha.clear();
    byAlpha.set(c.a, css);
  }
  return css;
};

export const isColor = (v: unknown): v is PineColor => !!v && typeof v === 'object' && 'r' in (v as object) && 'a' in (v as object);
