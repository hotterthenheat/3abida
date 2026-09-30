/*
  THE BRAND'S STATIC FILES, made from the real things (2026-09-19):

    public/favicon-32.png         the tab icon where an SVG one is not taken
    public/apple-touch-icon.png   180, square — iOS rounds its own corners
    public/icon-192.png · 512     the web manifest's
    public/og.jpg                 1200 × 630 — what a link to the site shows on X, iMessage, Slack

  The icons are rendered from public/favicon.svg, so the mark is drawn once. The link preview is a photograph of the LANDING
  ITSELF, dark, at the size the cards are shown — not a drawn banner (the house rule: show the real thing).

  Run with the dev server up:   node scripts/make-brand-assets.mjs [http://localhost:5199]
  Re-run whenever the mark or the landing's hero changes.
*/
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:5199';
const PUBLIC = resolve(process.cwd(), 'public');
const svg = readFileSync(resolve(PUBLIC, 'favicon.svg'), 'utf8');
const square = svg.replace('rx="14"', 'rx="0"');

const browser = await chromium.launch({ channel: 'chrome' });

const icon = async (file, size, source) => {
  const ctx = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(`<html><body style="margin:0;background:transparent">${source.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: resolve(PUBLIC, file), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  await ctx.close();
  console.log('made', file);
};
await icon('favicon-32.png', 32, svg);
await icon('icon-192.png', 192, svg);
await icon('icon-512.png', 512, svg);
await icon('apple-touch-icon.png', 180, square);

{
  /* reduced motion: the headline's marked word holds still on its first word, so the photograph never catches it mid-change */
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => localStorage.setItem('slayer_theme', 'dark'));
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  /* the launch gate, then the terminal in the window */
  await page.waitForTimeout(7000);
  await page.screenshot({ path: resolve(PUBLIC, 'og.jpg'), type: 'jpeg', quality: 86 });
  await ctx.close();
  console.log('made og.jpg');
}
await browser.close();
