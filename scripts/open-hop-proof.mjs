// The open-time hop, every Trace subpage: a tab switch INTO each page and a
// cold open of each, sampled per frame. A change is a HOP when it lands after
// the page has already mounted (the mount frame itself is the one legitimate
// change). Charts are watched through their largest canvas.
import { chromium } from 'playwright';

const PAGES = ['live-tape', 'screener', 'net-flow', 'footprints', 'flow-alerts', 'windows', 'odte', 'multi-leg', 'tracker'];
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

const arm = ms =>
  page.evaluate(ms => {
    window.__ev = [];
    window.__t0 = performance.now();
    const h = el => (el ? Math.round(el.getBoundingClientRect().height) : null);
    const snap = () => {
      const main = document.querySelector('main');
      const table = document.querySelector('table');
      const rows = [...document.querySelectorAll('tbody tr')].slice(0, 4);
      const canvases = [...document.querySelectorAll('canvas')].map(c => c.getBoundingClientRect()).sort((a, b) => b.width * b.height - a.width * a.height);
      const wrap = main?.querySelector('[style*="opacity"]');
      return {
        scrollTop: main?.scrollTop,
        scrollH: main?.scrollHeight,
        readH: h(document.querySelector('p.line-clamp-2')?.parentElement),
        statsH: h(document.querySelector('.select-none.border')),
        tableTop: table ? Math.round(table.getBoundingClientRect().top + (main?.scrollTop ?? 0)) : null,
        tableW: table ? Math.round(table.getBoundingClientRect().width) : null,
        rowsH: rows.map(r => Math.round(r.getBoundingClientRect().height)).join(','),
        canvas: canvases[0] ? `${Math.round(canvases[0].width)}x${Math.round(canvases[0].height)}` : null,
        canvases: canvases.length,
        fonts: document.fonts.status,
        opacity: wrap ? getComputedStyle(wrap).opacity : null,
        gate: document.body.innerText.includes('ENTERING TERMINAL'),
      };
    };
    let last = snap();
    const tick = () => {
      const now = snap();
      for (const k of Object.keys(now)) if (now[k] !== last[k]) window.__ev.push({ t: Math.round(performance.now() - window.__t0), what: k, from: last[k], to: now[k] });
      last = now;
      if (performance.now() - window.__t0 < ms) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, ms);

const classify = (ev, mode) => {
  // The mount frame: the LAST frame in the first 1.2s where something appeared
  // or vanished outright (null ↔ value) — the old page leaving, the new arriving.
  // A swap frame is one where something appears/vanishes outright, OR where
  // three or more metrics change at once (a table page replacing a table page).
  const byT = new Map();
  for (const e of ev) if (e.t < 1200) byT.set(e.t, (byT.get(e.t) ?? 0) + 1);
  const swaps = ev.filter(
    e => e.t < 1200 && (e.from == null || e.to == null || e.from === '' || e.to === '' || (byT.get(e.t) ?? 0) >= 3)
  );
  const mountT = mode === 'switch' ? (swaps.length ? Math.max(...swaps.map(e => e.t)) : 0) : 0;
  const ignore = new Set(['opacity', 'fonts', 'gate']);
  const hops = ev.filter(e => !ignore.has(e.what) && e.t > mountT + 40 && !(mode === 'cold' && e.what === 'scrollH' && e.from === undefined));
  return { mountT, hops };
};

for (const p of PAGES) {
  // Switch INTO the page from a neighbour.
  const from = p === 'screener' ? 'live-tape' : 'screener';
  await page.goto(`http://localhost:5199/trace/${from}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.body.innerText.includes('ENTERING TERMINAL'), null, { timeout: 8000 });
  await page.waitForTimeout(900);
  await arm(2600);
  await page.locator('nav a[href="/trace/' + p + '"]').click();
  await page.waitForTimeout(2800);
  const sw = classify(await page.evaluate(() => window.__ev), 'switch');

  // Cold open, watched through the gate.
  await page.goto(`http://localhost:5199/trace/${p}`, { waitUntil: 'domcontentloaded' });
  await arm(5000);
  await page.waitForTimeout(5200);
  const cold = classify(await page.evaluate(() => window.__ev), 'cold');

  const fmt = hops => (hops.length ? hops.map(e => `${e.what} ${e.from}→${e.to} @${e.t}ms`).join('; ') : 'none');
  console.log(`${p.padEnd(12)} switch: mount @${String(sw.mountT).padStart(4)}ms, hops after: ${fmt(sw.hops)}`);
  console.log(`${''.padEnd(12)} cold  : hops: ${fmt(cold.hops)}`);
}
await browser.close();
