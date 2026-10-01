/*
==================================================
  SLAYER TERMINAL - THE MARK AS A FILE (brand/iconSvg.ts)

  The mark drawn as one still SVG string — for the places that cannot run the living mark: the browser tab (the app
  swaps the SVG favicon by state; "PNG fallbacks stay still"), and the static files scripts/make-brand-assets.ts
  renders (favicon.svg, the PNG icons, the maskable icon, the share image's corner). Pure strings, no DOM, so a Node
  script can import it.

  The tab's five frames (Slayer Logo System, "Favicon states"): still, loading, live, alert, closed. Offline shows the
  still frame without its cursor.
==================================================
*/

import { MARK } from './paths';
import type { MarkState } from './markState';

export type IconTheme = 'dark' | 'light';

const FOIL: Record<IconTheme, string[]> = {
  dark: ['#eef1f8', '#c2d6f0', '#e4d8f4', '#ffffff', '#c8d8ec'],
  light: ['#586078', '#505e78', '#605870', '#283038', '#525c74'],
};
/* the pan at speed, caught bright — the loading frame */
const FOIL_FAST = ['#ffffff', '#dde8f8', '#f2ecfa', '#ffffff', '#e2ecf8'];
const GROUND: Record<IconTheme, { tile: string; edge: string; bracket: string; chevron: string; cursor: string; rest: string; restCursor: string }> = {
  dark: { tile: '#111111', edge: '#1e1f22', bracket: '#3a3d42', chevron: '#6b7077', cursor: '#f4f5f7', rest: '#5c616c', restCursor: '#3a3d42' },
  light: { tile: '#fbfaf7', edge: '#cdcbc5', bracket: '#8c8a84', chevron: '#6b6e75', cursor: '#0e0f11', rest: '#787c86', restCursor: '#b4b6bb' },
};

export interface MarkSvgOptions {
  state?: MarkState;
  theme?: IconTheme;
  /** the whole 64-unit tile with its brackets and ">" — otherwise the S| centred on its tile */
  full?: boolean;
  /** one colour, no tile — print and mail */
  solid?: 'black' | 'white';
  /** the maskable icon: the tile fills the square edge to edge, ">S|" inside the middle 80% (the safe circle) — also
      the iOS icon, which rounds its own corners */
  maskable?: boolean;
  /** square corners */
  square?: boolean;
}

const CONTENT = { x0: 24.4, y0: 15.49, x1: 51.9, y1: 48.49 };

/** The mark as an SVG document */
export function markSvg({ state = 'idle', theme = 'dark', full = false, solid, maskable = false, square = false }: MarkSvgOptions = {}): string {
  const g = GROUND[theme];
  let vx = 0;
  let vy = 0;
  let side = 64;
  if (maskable) {
    /* ">S|" whole — 11.9 → 51.9 across — its diagonal inside the middle 80% of the square, so any mask's crop keeps it */
    const x0 = 11.9;
    const w = CONTENT.x1 - x0;
    const h = CONTENT.y1 - CONTENT.y0;
    side = Math.hypot(w, h) / 0.78;
    vx = (x0 + CONTENT.x1) / 2 - side / 2;
    vy = (CONTENT.y0 + CONTENT.y1) / 2 - side / 2;
  } else if (!full) {
    side = Math.max(CONTENT.x1 - CONTENT.x0, CONTENT.y1 - CONTENT.y0) * 1.42;
    vx = (CONTENT.x0 + CONTENT.x1) / 2 - side / 2;
    vy = (CONTENT.y0 + CONTENT.y1) / 2 - side / 2;
  }
  const r = square || maskable ? 0 : full ? 3 : side * 0.14;
  const closed = state === 'closed';
  const stops = state === 'loading' ? FOIL_FAST : FOIL[theme];
  const sFill = solid ? (solid === 'black' ? '#000' : '#fff') : closed ? g.rest : 'url(#f)';
  const showCursor = state !== 'alert' && state !== 'offline';
  const cursorFill = solid ? sFill : closed ? g.restCursor : g.cursor;
  const [cx, cy, cw, ch] = MARK.cursor;
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx.toFixed(2)} ${vy.toFixed(2)} ${side.toFixed(2)} ${side.toFixed(2)}">`);
  parts.push('<defs>');
  parts.push(`<linearGradient id="f" x1="0" y1="0" x2="1" y2="1">${stops.map((c, i) => `<stop offset="${[0, 0.3, 0.55, 0.75, 1][i]}" stop-color="${c}"/>`).join('')}</linearGradient>`);
  if (state === 'live' && theme === 'dark' && !solid) parts.push('<filter id="glow" x="-2" y="-1" width="5" height="3"><feGaussianBlur stdDeviation="1.6"/></filter>');
  parts.push('</defs>');
  if (!solid) {
    parts.push(`<rect x="${vx.toFixed(2)}" y="${vy.toFixed(2)}" width="${side.toFixed(2)}" height="${side.toFixed(2)}" rx="${r.toFixed(2)}" fill="${g.tile}"/>`);
    if (theme === 'light' && !maskable) {
      parts.push(`<rect x="${(vx + 0.6).toFixed(2)}" y="${(vy + 0.6).toFixed(2)}" width="${(side - 1.2).toFixed(2)}" height="${(side - 1.2).toFixed(2)}" rx="${Math.max(0, r - 0.6).toFixed(2)}" fill="none" stroke="${g.edge}" stroke-width="1.2"/>`);
    }
  }
  if (full && !maskable) parts.push(`<path d="${MARK.brackets}" fill="none" stroke="${solid ? sFill : g.bracket}" stroke-width="0.7"/>`);
  if (full || maskable) parts.push(`<path d="${MARK.chevron}" fill="${solid ? sFill : g.chevron}"/>`);
  parts.push(`<path d="${MARK.s}" fill="${sFill}"/>`);
  if (showCursor) {
    if (state === 'live' && theme === 'dark' && !solid) parts.push(`<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="#ffffff" opacity="0.6" filter="url(#glow)"/>`);
    parts.push(`<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="${cursorFill}"/>`);
  }
  if (state === 'alert') parts.push(`<circle cx="${cx + cw / 2}" cy="${cy + 3.4}" r="3.4" fill="${theme === 'dark' ? '#ff9500' : '#dc4600'}"/>`);
  parts.push('</svg>');
  return parts.join('');
}

/** The SVG as a data: URL, for a <link rel="icon"> */
export const svgDataUrl = (svg: string): string => `data:image/svg+xml,${encodeURIComponent(svg)}`;
