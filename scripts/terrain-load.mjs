/*
  TERRAIN'S LOAD (the owner, 2026-10-15, the audit's item g: "Measure room open → candles, room open → ovals, and memory
  after 10 minutes. Measure in your workspace and with a script I run on my machine. Targets: candles under 1 s, ovals
  under 2 s.")

    npm run terrain:load                                         the dev server on 5173 (your machine), 10 minutes
    npm run terrain:load -- --url=http://127.0.0.1:5180           another address
    npm run terrain:load -- --minutes=2 --runs=3 --layouts=1,4    a shorter watch, more opens, the desks measured

  Measured INSIDE THE PAGE from the navigation's start (performance.timeOrigin), a frame at a time:
    · candles — the first frame whose chart root says it holds bars (StrikeChart `data-chart-state`, its bar count);
    · ovals   — the first frame whose chart root says the field's columns are handed (its `f<N>`, N > 0); the renderer
                draws them in the next frame, so the figure is at most one frame short of the first oval on screen;
    · every pane's own two times on a desk of several (the slowest is the desk's).
  COLD is a fresh browser profile (nothing cached in the browser; the server's caches as they stand); WARM the next open
  in the same profile. MEMORY: the JS heap in use, DOM nodes and event listeners (Chrome's own counters, CDP
  Performance.getMetrics) at the open and every minute after with the page live and in view, for --minutes.
  The desk the page had is put back. Writes <out>/terrain-load-<stamp>.json and .md (the sample: the address, the
  layouts and names, the machine, the date) — docs/terrain-audit-2026-10-15/load/ by default.
*/
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, totalmem, platform, release } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, def) => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? def;
const base = flag('url', process.env.TERRAIN_URL ?? 'http://127.0.0.1:5173').replace(/\/+$/, '');
const minutes = Number(flag('minutes', '10'));
const runs = Math.max(1, Number(flag('runs', '3')));
const layouts = flag('layouts', '1,4').split(',').map(Number).filter(n => n >= 1 && n <= 4);
const names = flag('names', 'SPY,QQQ,IWM,SPX').split(',');
const tf = flag('tf', '1m');
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const out = flag('out', join('docs', 'terrain-audit-2026-10-15', 'load'));
mkdirSync(out, { recursive: true });
const exe = process.env.PW_CHROMIUM ?? (process.platform === 'linux' ? '/opt/pw-browsers/chromium' : undefined);

const desk = n => ({ layout: n, panes: names.slice(0, 4).map(ticker => ({ ticker, timeframe: tf, overlays: { trails: true }, ladder: true })) });
/* the first frame each pane says it holds bars, and the field's columns — a chart counts only when it is one of the desk's
   (its name and timeframe): the launch screen's preview is a chart too */
const probe = want => {
  const t = { panes: {} };
  window.__load = t;
  const tick = () => {
    const now = performance.now();
    for (const el of document.querySelectorAll('[data-chart-state]')) {
      const p = (el.getAttribute('data-chart-state') ?? '').split('|');
      if (!want.includes(`${p[0]}|${p[1]}`)) continue;
      const pane = (t.panes[p[0]] ??= { name: p[0], candles: null, ovals: null });
      if (pane.candles == null && Number(p[2]) > 0) pane.candles = now;
      if (pane.ovals == null && /^f\d+$/.test(p[5] ?? '') && Number(p[5].slice(1)) > 0) pane.ovals = now;
    }
    const all = Object.values(t.panes);
    if (all.length < want.length || all.some(x => x.candles == null || x.ovals == null)) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
const wantOf = n => names.slice(0, n).map(x => `${x}|${tf}`);

const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const results = [];
let had = null;
let hadName;
for (const n of layouts) {
  const profile = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await profile.newPage();
  await page.addInitScript(probe, wantOf(n));
  await page.goto(`${base}/terrain`, { waitUntil: 'domcontentloaded' });
  if (had === null) had = await page.evaluate(() => localStorage.getItem('slayer_terrain_v1') ?? '__none__');
  if (hadName === undefined) hadName = await page.evaluate(() => localStorage.getItem('slayer_name'));
  await page.evaluate(cfg => {
    localStorage.setItem('slayer_terrain_v1', JSON.stringify(cfg));
    localStorage.setItem('slayer_name', cfg.panes[0].ticker);
  }, desk(n));
  for (let r = 0; r < runs; r++) {
    const kind = r === 0 ? 'cold' : 'warm';
    /* the first open of a fresh profile is cold; later opens in it are warm */
    if (r === 0) {
      const fresh = await browser.newContext({ viewport: { width: 1600, height: 900 } });
      const p0 = await fresh.newPage();
      await p0.addInitScript(probe, wantOf(n));
      /* the desk, and the name a returning reader last had (the first pane follows it — context/marketStore slayer_name) */
      await p0.addInitScript(cfg => {
        localStorage.setItem('slayer_terrain_v1', JSON.stringify(cfg));
        localStorage.setItem('slayer_name', cfg.panes[0].ticker);
      }, desk(n));
      await p0.goto(`${base}/terrain`, { waitUntil: 'domcontentloaded' });
      await p0.waitForFunction(k => { const ps = Object.values(window.__load?.panes ?? {}); return ps.length >= k && ps.every(x => x.candles != null && x.ovals != null); }, n, { timeout: 60_000 }).catch(() => null);
      const got = await p0.evaluate(() => window.__load);
      results.push({ layout: n, kind, panes: Object.values(got?.panes ?? {}) });
      await fresh.close();
      continue;
    }
    await page.goto(`${base}/terrain`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(k => { const ps = Object.values(window.__load?.panes ?? {}); return ps.length >= k && ps.every(x => x.candles != null && x.ovals != null); }, n, { timeout: 60_000 }).catch(() => null);
    const got = await page.evaluate(() => window.__load);
    results.push({ layout: n, kind, panes: Object.values(got?.panes ?? {}) });
  }
  /* memory with the page live, every minute */
  const cdp = await profile.newCDPSession(page);
  await cdp.send('Performance.enable');
  const mem = [];
  const sample = async m => {
    const { metrics } = await cdp.send('Performance.getMetrics');
    const v = k => metrics.find(x => x.name === k)?.value ?? null;
    mem.push({ minute: m, heapMB: +(v('JSHeapUsedSize') / 1048576).toFixed(1), nodes: v('Nodes'), listeners: v('JSEventListeners') });
  };
  await sample(0);
  for (let m = 1; m <= minutes; m++) {
    await page.waitForTimeout(60_000);
    await sample(m);
  }
  results.push({ layout: n, kind: 'memory', mem });
  await profile.close();
}
/* the desk put back */
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${base}/terrain`, { waitUntil: 'domcontentloaded' });
  await p.evaluate(v => (v === '__none__' || v == null ? localStorage.removeItem('slayer_terrain_v1') : localStorage.setItem('slayer_terrain_v1', v)), had);
  await p.evaluate(v => (v == null ? localStorage.removeItem('slayer_name') : localStorage.setItem('slayer_name', v)), hadName ?? null);
  await ctx.close();
}
await browser.close();

const ms = v => (v == null ? '—' : `${Math.round(v)} ms`);
const lines = [`# Terrain's load — ${new Date().toISOString().slice(0, 16)} UTC`, '', `Sample: ${base}, the desk at ${layouts.join(' and ')} pane${layouts.length > 1 ? 's' : ''} (${names.slice(0, 4).join(', ')} at ${tf}), ${runs} opens a desk (the first cold), memory over ${minutes} minutes; machine ${platform()} ${release()}, ${cpus().length} CPUs (${cpus()[0]?.model ?? '?'}), ${(totalmem() / 2 ** 30).toFixed(0)} GB. Targets: candles under 1 s, ovals under 2 s.`, ''];
lines.push('| desk | open | pane | candles | ovals |', '|---|---|---|---|---|');
for (const r of results.filter(x => x.kind !== 'memory'))
  for (const p of r.panes) lines.push(`| ${r.layout} pane${r.layout > 1 ? 's' : ''} | ${r.kind} | ${p.name} | ${ms(p.candles)}${p.candles != null && p.candles > 1000 ? ' (over 1 s)' : ''} | ${ms(p.ovals)}${p.ovals != null && p.ovals > 2000 ? ' (over 2 s)' : ''} |`);
lines.push('', '| desk | minute | JS heap | DOM nodes | listeners |', '|---|---|---|---|---|');
for (const r of results.filter(x => x.kind === 'memory')) for (const m of r.mem) lines.push(`| ${r.layout} | ${m.minute} | ${m.heapMB} MB | ${m.nodes} | ${m.listeners} |`);
const text = lines.join('\n');
console.log(text);
writeFileSync(join(out, `terrain-load-${stamp}.md`), text + '\n');
writeFileSync(join(out, `terrain-load-${stamp}.json`), JSON.stringify({ base, layouts, names, tf, runs, minutes, results }, null, 1));
console.log(`written: ${join(out, `terrain-load-${stamp}.md`)}`);
