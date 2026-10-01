/*
  THE LANDING'S PICTURES (2026-09-19) — `npm run landing:shots`, with the dev server up.

  The landing's window shows STILLS of the terminal, not the terminal itself (Noah: "keep our interactive visuals but then
  make them static… a static image breeds mystery and desire"). They are still THE REAL THING — photographs of this app,
  never drawings: this opens every page the tour names, the way the landing's live window used to (the embed seam: the
  rail folded, no launch gate, no sound, the theme named by the address), and photographs it

      in both themes      the window turns with the page half way down the tour
      at two sizes        a desk's screen (1440 × 1000) and the terminal's own phone layout (390 × 760)

  into public/landing/<page>-<theme>-<desk|phone>.webp. The pages are READ FROM THE TOUR'S OWN LIST in Landing.tsx, so a
  page added to the tour is photographed the next time this runs. Re-run it when a page's look changes.

  SINCE 2026-10-01 THE WINDOW PLAYS FILMS (scripts/make-landing-clips.mjs, `npm run landing:clips`), and a still is the
  film's first frame — that script writes both, so a still and its film never disagree. This one stays for a still
  wanted on its own. What both set up on a page (SEED, PREPARE) lives in scripts/landing-stage.mjs, and what is written
  below about each page is now that file's.

  WHAT EACH PAGE OPENS ON is a first-time visitor's terminal, with the exceptions Noah set by picture:
      Terrain      two charts side by side, SPY on the dark candles and QQQ on Stone, each with its strike rail open
      the Map      the ladder with all five greeks (its own first view since 2026-09-21), a row under the pointer with its card
      the Weigher  a desk in use (2026-09-20: "right now all 3 sections are blank") — contracts watched and positions held
                   across a few names, one position open in the card at the right; see PREPARE below
*/
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_PAGES, SIZES, SEED, PREPARE, slug } from './landing-stage.mjs';

const BASE = process.argv[2] ?? 'http://localhost:5199';
/* after the address: pages to re-take ("/terrain"), and/or a size ("desk" | "phone"), and/or a theme ("dark" | "light") */
const ARGS = process.argv.slice(3);
const ONLY = ARGS.filter(a => a.startsWith('/'));
const FORMS = ARGS.filter(a => a === 'desk' || a === 'phone');
const ONLY_THEMES = ARGS.filter(a => a === 'dark' || a === 'light');
const OUT = resolve(process.cwd(), 'public/landing');
mkdirSync(OUT, { recursive: true });

const PAGES = ALL_PAGES.filter(p => !ONLY.length || ONLY.includes(p));
const THEMES = ['dark', 'light'].filter(t => !ONLY_THEMES.length || ONLY_THEMES.includes(t));

/* Chrome where it is installed; else the Chromium Playwright brings (PW_CHROMIUM names another) */
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}));
let made = 0;
let bytes = 0;
for (const size of SIZES.filter(z => !FORMS.length || FORMS.includes(z.form))) {
  for (const theme of THEMES) {
    for (const path of PAGES) {
      /* a fresh visitor every time: nothing one page did is left for the next */
      const ctx = await browser.newContext({ viewport: { width: size.w + 40, height: size.h + 40 }, deviceScaleFactor: size.dpr });
      await ctx.addInitScript(seed => {
        try {
          for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
        } catch {}
      }, SEED);
      const page = await ctx.newPage();
      /* THE TERMINAL IN A WINDOW (src/embed.ts): a frame, asked for with ?embed — exactly how the landing used to hold it.
         The page that holds the frame is served FROM THE SAME ORIGIN (a made-up address, answered here): in a frame under a
         blank page the browser denies the terminal its storage, and it opened as a stranger's — the seed above never read
         (measured: Terrain came out as the default three charts). */
      await page.route(`${BASE}/__shot-host`, r =>
        r.fulfill({
          contentType: 'text/html',
          /* `photo=1` (embed.ts PHOTO): the photographer's window — the paper desk may start a throwaway account for its picture */
          body: `<html><body style="margin:0;background:#000"><iframe id="t" src="${path}?embed=1&photo=1&theme=${theme}" style="border:0;display:block;width:${size.w}px;height:${size.h}px"></iframe></body></html>`,
        })
      );
      await page.goto(`${BASE}/__shot-host`);
      await page.waitForTimeout(size.form === 'desk' ? 6500 : 5500);
      await PREPARE[path]?.(page, theme, size);
      const png = await page.locator('#t').screenshot({ type: 'png' });
      /* WebP, encoded by the browser itself — no image library to install */
      const webp = await page.evaluate(async b64 => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        const blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.8));
        const buf = new Uint8Array(await blob.arrayBuffer());
        let s = '';
        for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        return btoa(s);
      }, png.toString('base64'));
      const file = `${slug(path)}-${theme}-${size.form}.webp`;
      const data = Buffer.from(webp, 'base64');
      writeFileSync(resolve(OUT, file), data);
      made++;
      bytes += data.length;
      console.log(`${file}  ${Math.round(data.length / 1024)} KB`);
      await ctx.close();
    }
  }
}
console.log(`\n${made} pictures · ${(bytes / 1024 / 1024).toFixed(1)} MB in public/landing`);
await browser.close();
