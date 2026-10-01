/*
  THE BRAND'S STATIC FILES, drawn from the brand module itself (2026-10-01, the Logo System pass — was
  make-brand-assets.mjs, which rendered the old ">_" tile):

    public/favicon.svg            the still frame — the tab's SVG icon before the app swaps it by state (brand/favicon.tsx)
    public/favicon.ico            16, 32 and 48 in one file, for whatever does not take an SVG
    public/favicon-32.png         the PNG fallback — "PNG fallbacks stay still"
    public/apple-touch-icon.png   180, edge to edge — iOS rounds its own corners
    public/icon-192.png · 512     the web manifest's: the whole tile, its brackets and the ">"
    public/icon-maskable-512.png  edge to edge, ">S|" inside the middle 80%
    public/shortcut-*.png         96 — the manifest's long-press shortcuts: Pulse, Trace, Pinpoint, on their glyphs
    public/og.jpg                 1200 × 630 — the link preview: the mark, the line, the signature, a real still

  Every picture is the same drawing the app shows (brand/iconSvg.ts, brand/ProductGlyph.tsx), so the mark is drawn once.

  Run:   npm run brand:assets
  Re-run whenever the mark, a glyph or the landing's still changes.
*/
import { chromium, type Browser } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { markSvg } from '../src/brand/iconSvg';
import ProductGlyph from '../src/brand/ProductGlyph';
import Wordmark from '../src/brand/Wordmark';
import type { GlyphName } from '../src/brand/paths';

const ROOT = process.cwd();
const PUBLIC = resolve(ROOT, 'public');
/* the tokens, so a glyph drawn from the app's own component finds its colours (rgb(var(--tile)) and the rest) */
const TOKENS = readFileSync(resolve(ROOT, 'src/theme/tokens.css'), 'utf8');

const launch = async (): Promise<Browser> => {
  try {
    return await chromium.launch({ channel: 'chrome' });
  } catch {
    /* no Chrome on this machine — the Chromium Playwright brings (PW_CHROMIUM names another) */
    return chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  }
};
const browser = await launch();

const png = async (svg: string, size: number): Promise<Buffer> => {
  const ctx = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(
    `<html data-theme="dark"><head><style>${TOKENS} html,body{margin:0;background:transparent} svg{display:block;width:${size}px;height:${size}px}</style></head><body>${svg}</body></html>`
  );
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  await ctx.close();
  return buf;
};
const save = (file: string, data: Buffer | string) => {
  writeFileSync(resolve(PUBLIC, file), data);
  console.log('made', file);
};

/* the still frame — the tab, the PNG fallbacks */
const still = markSvg({ state: 'idle' });
save('favicon.svg', `${still}\n`);
const fav16 = await png(still, 16);
const fav32 = await png(still, 32);
const fav48 = await png(still, 48);
save('favicon-32.png', fav32);

/* favicon.ico: an ICO directory over three PNGs (every browser since 2007 reads a PNG inside an ICO) */
{
  const imgs = [
    { size: 16, data: fav16 },
    { size: 32, data: fav32 },
    { size: 48, data: fav48 },
  ];
  const head = Buffer.alloc(6 + 16 * imgs.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(imgs.length, 4);
  let offset = head.length;
  imgs.forEach((im, i) => {
    const o = 6 + 16 * i;
    head.writeUInt8(im.size, o);
    head.writeUInt8(im.size, o + 1);
    head.writeUInt8(0, o + 2);
    head.writeUInt8(0, o + 3);
    head.writeUInt16LE(1, o + 4);
    head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(im.data.length, o + 8);
    head.writeUInt32LE(offset, o + 12);
    offset += im.data.length;
  });
  save('favicon.ico', Buffer.concat([head, ...imgs.map(im => im.data)]));
}

/* the manifest's icons: the whole tile from 64 px up, edge to edge for the maskable and for iOS */
const whole = markSvg({ state: 'idle', full: true });
save('icon-192.png', await png(whole, 192));
save('icon-512.png', await png(whole, 512));
const edge = markSvg({ state: 'idle', maskable: true });
save('icon-maskable-512.png', await png(edge, 512));
save('apple-touch-icon.png', await png(edge, 180));

/* the long-press shortcuts — each product on its glyph's tile */
for (const name of ['pulse', 'trace', 'pinpoint'] as GlyphName[]) {
  const svg = renderToStaticMarkup(createElement(ProductGlyph, { name, size: 96 }));
  save(`shortcut-${name}.png`, await png(svg, 96));
}

/* THE LINK PREVIEW (Slayer Logo System, "Link preview · 1200×630"): the mark and the product's line on the left, the
   signature at the foot, a real still on the right — the landing's own desk, never a mock */
{
  const still = readFileSync(resolve(PUBLIC, 'landing/pinpoint-map-dark-desk.webp')).toString('base64');
  const mark = markSvg({ state: 'idle', full: true });
  const wordmark = renderToStaticMarkup(createElement(Wordmark, { height: 22, label: '' }));
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(`<html data-theme="dark"><head><style>${TOKENS}
    html,body{margin:0;width:1200px;height:630px;background:#050505;color:#ededed;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;overflow:hidden}
    .card{position:absolute;inset:28px;border:1px solid #1c1c1c;border-radius:14px;overflow:hidden}
    .br{position:absolute;width:26px;height:26px;border-color:#3a3d42;border-style:solid}
    .tl{top:18px;left:18px;border-width:2px 0 0 2px}.tr{top:18px;right:18px;border-width:2px 2px 0 0}
    .bl{bottom:18px;left:18px;border-width:0 0 2px 2px}.brr{bottom:18px;right:18px;border-width:0 2px 2px 0}
    .left{position:absolute;left:64px;top:64px;bottom:64px;width:440px;display:flex;flex-direction:column}
    .mark svg{width:88px;height:88px;display:block}
    h1{margin:34px 0 0;font-weight:300;font-size:58px;line-height:1.02;letter-spacing:-0.02em}
    h1 b{font-weight:500}
    p{margin:18px 0 0;font-size:19px;line-height:1.45;color:#a3a3a3}
    .sig{margin-top:auto;display:flex;align-items:center;gap:10px;font-family:"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace;font-size:15px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.14);align-self:flex-start}
    .dot{width:8px;height:8px;border-radius:50%;background:rgb(210 255 0)}
    .still{position:absolute;left:560px;top:58px;width:760px;border-radius:12px;border:1px solid #2a2a2a;box-shadow:0 24px 80px rgba(0,0,0,0.6)}
  </style></head><body><div class="card">
    <span class="br tl"></span><span class="br tr"></span><span class="br bl"></span><span class="br brr"></span>
    <div class="left">
      <div class="mark">${mark}</div>
      <h1>Trade what you can <b>see.</b></h1>
      <p>The prints, the positions, the levels, the filings.<br>One terminal.</p>
      <div style="margin-top:22px">${wordmark}</div>
      <div class="sig"><span>slayer:~ $</span><span class="dot"></span><span style="color:rgb(210 255 0)">live</span></div>
    </div>
    <img class="still" src="data:image/webp;base64,${still}" alt="">
  </div></body></html>`);
  await page.waitForTimeout(300);
  save('og.jpg', await page.screenshot({ type: 'jpeg', quality: 88 }));
  await ctx.close();
}

await browser.close();
