/*
  THE SPEED BUDGETS (the owner's Section I, 2026-10-14: "any switch (window, timeframe, ticker) < 150 ms; hover < 50 ms;
  pan 60 fps; 1Y and Max jumps < 2 s. They must hold on the full 14-year history … A budget test runs on every push and
  fails on any miss … Report the budgets from your workspace and from a run on my always-on machine, each with its
  sample: date range, tickers, machine").

  Measured INSIDE the page, never by the clock of the script driving it: every input's own event time (the browser's
  `timeStamp` on keydown, pointerdown, pointermove) to the end of the frame that paints the change — the change seen at
  the start of a frame, the time read at the start of the next one, so a reading is at most one frame long, never short.
  What "done" means for each:
    window, timeframe, ticker switch — the chart's root says the new world (StrikeChart `data-chart-state`: the name,
      the timeframe, the bars and the field's columns handed) and the header and strip say it too;
    hover — the crosshair readout prints the bar under the pointer;
    pan — the frame times while the plot is dragged for two seconds;
    1Y and Max — the view (`data-chart-view`) covers the span asked.
  A ticker switch is measured WARM — to a name this page has shown (Section I item 5 prefetches them); the first visit
  to a name never seen asks the vendor and is reported beside, not budgeted (a network round trip is not a switch).

    node scripts/speed-budget.mjs [--url http://127.0.0.1:5180] [--serve preview] [--names SPY,QQQ] [--out <dir>]
                                  [--runs 3] [--no-fail]
    npm run speed:check            (the build served by `vite preview` on 5183, the budgets enforced — before every push)
    npm run speed:budget           (the owner's machine: against the dev server already running on 5173, a report kept)

  Writes <out>/speed-<stamp>.json and .md with the sample (the names, the bars' and the field's date range at each
  timeframe, the machine, the mode) and exits 1 on any miss unless --no-fail.
*/
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : dflt;
};
const flag = name => args.includes(`--${name}`);
const SERVE = opt('serve', '');
const PORT = Number(opt('port', SERVE === 'preview' ? 5183 : 5180));
const URL = opt('url', `http://127.0.0.1:${PORT}`);
const OUT = opt('out', join(process.cwd(), '.feed-cache', 'speed'));
const RUNS = Math.max(1, Number(opt('runs', 3)) || 3);
const NO_FAIL = flag('no-fail');
const EXE = opt('chromium', existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

export const BUDGETS = { switchMs: 150, hoverMs: 50, panFps: 60, jumpMs: 2000 };
/* A frame at 60 fps is 16.7 ms; the pan passes when the median frame is one frame and no more than 5% run past 20 ms */
const PAN_SLOW_FRAME_MS = 20;
const PAN_SLOW_SHARE = 0.05;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitUp(url, ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return true;
    } catch {
      /* not yet */
    }
    await sleep(400);
  }
  return false;
}

let server = null;
if (SERVE === 'preview') {
  if (!existsSync('dist/index.html')) {
    console.error('speed-budget: no build in dist/ — run `npm run build` first');
    process.exit(2);
  }
  server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  server.stdout.on('data', () => undefined);
  server.stderr.on('data', () => undefined);
}
const stop = () => {
  try {
    server?.kill();
  } catch {
    /* gone */
  }
};
process.on('exit', stop);

if (!(await waitUp(`${URL}/terrain`, 60_000))) {
  console.error(`speed-budget: nothing answers at ${URL}`);
  stop();
  process.exit(2);
}

/* the page's own clock: every trusted input stamps the time; a wait resolves at the start of the frame after the one
   whose start first saw the condition — the change's paint is inside the reading */
const INSTRUMENT = `(() => {
  const sb = (window.__sb = { input: 0, kind: '' });
  for (const t of ['keydown', 'pointerdown', 'pointermove', 'mousedown'])
    addEventListener(t, e => { if (e.isTrusted) { sb.input = e.timeStamp; sb.kind = t; } }, true);
  window.__sbWait = (src, timeoutMs) => new Promise(res => {
    const pred = new Function('return (' + src + ')')();
    const t0 = performance.now();
    /* the chart's state as it moved, each change with its time from the input — said beside a reading */
    const trace = [];
    let lastState = '';
    const tick = () => {
      const st = document.querySelector('[data-chart-state]')?.getAttribute('data-chart-state') ?? '';
      if (st !== lastState && trace.length < 12) { trace.push([Math.round(performance.now() - sb.input), st]); lastState = st; }
      let ok = false;
      /* nothing counts before the input has arrived (the wait is armed first) */
      if (sb.input > 0) try { ok = !!pred(); } catch { ok = false; }
      if (ok) return requestAnimationFrame(ts => res({ ok: true, ms: ts - sb.input, input: sb.kind, trace }));
      if (performance.now() - t0 > timeoutMs) return res({ ok: false, ms: performance.now() - sb.input, input: sb.kind, trace });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
})();`;

const browser = await chromium.launch({ executablePath: EXE });
const chromiumVersion = browser.version();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/New_York', deviceScaleFactor: 1 });
await ctx.addInitScript(INSTRUMENT);
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e).slice(0, 300)));

const state = () => page.evaluate(() => document.querySelector('[data-chart-state]')?.getAttribute('data-chart-state') ?? '');
const view = () => page.evaluate(() => document.querySelector('[data-chart-view]')?.getAttribute('data-chart-view') ?? '');
const parse = s => {
  const [ticker, tf, n, first, last, f, r] = s.split('|');
  return { ticker, tf, bars: Number(n), first: Number(first), last: Number(last), field: f && f !== 'f-' ? Number(f.slice(1)) : null, rev: r };
};
/* arm a wait in the page BEFORE the input, then send the input, then read it */
async function timed(pred, input, timeoutMs = 8000) {
  await page.evaluate(([src, t]) => {
    window.__sb.input = 0;
    window.__sbPending = window.__sbWait(src, t);
  }, [pred, timeoutMs]);
  await input();
  return page.evaluate(() => window.__sbPending);
}
const dayOf = t => new Date(t * 1000).toISOString().slice(0, 10);

await page.goto(`${URL}/terrain`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-pane-head]', { timeout: 60_000 });
await sleep(600);
await page.keyboard.press('1');
/* settled: the chart holds bars and the field is handed */
const settleUntil = Date.now() + 40_000;
while (Date.now() < settleUntil) {
  const s = parse(await state());
  if (s.bars > 0 && s.field != null) break;
  await sleep(500);
}
await sleep(4000);
const plot = await page.locator('[data-chart-ink]').first().boundingBox();
const results = { switches: [], hover: [], pan: null, jumps: [], cold: [] };
const sample = { tickers: new Set(), byTf: {} };
const note = s => {
  const p = parse(s);
  if (!p.ticker) return;
  sample.tickers.add(p.ticker);
  const k = `${p.ticker} ${p.tf}`;
  sample.byTf[k] = { bars: p.bars, from: p.first ? dayOf(p.first) : null, to: p.last ? dayOf(p.last) : null, fieldColumns: p.field };
};
note(await state());

/* a point inside the plot, off the axis and the toolbar */
const inPlot = (fx, fy) => ({ x: plot.x + plot.width * fx, y: plot.y + plot.height * fy });
await page.mouse.click(inPlot(0.5, 0.55).x, inPlot(0.5, 0.55).y);
await page.keyboard.press('Escape');

/* a switch is done when the part it changes reads the new value (the name, or the timeframe; the window: the header's
   window and a new revision of the chart's tape) and the field's columns are handed */
const switchDone = part => `() => {
  const s = (document.querySelector('[data-chart-state]')?.getAttribute('data-chart-state') ?? '').split('|');
  const b = (window.__sbBefore ?? '').split('|');
  if (!s[0] || !s[5] || s[5] === 'f-') return false;
  ${part === 'ticker' ? 'return s[0] !== b[0];' : part === 'timeframe' ? 'return s[1] !== b[1];' : `return (document.querySelector('[data-pane-window]')?.getAttribute('data-pane-window') ?? '') !== window.__sbWindow && s[6] !== b[6];`}
}`;
const armBefore = () => page.evaluate(() => {
  window.__sbBefore = document.querySelector('[data-chart-state]')?.getAttribute('data-chart-state') ?? '';
  window.__sbWindow = document.querySelector('[data-pane-window]')?.getAttribute('data-pane-window') ?? '';
});

for (let run = 0; run < RUNS; run++) {
  /* THE TIMEFRAME: down a step and back up (− and =, the pane's own keys) */
  for (const key of ['Minus', 'Equal', 'Equal', 'Minus']) {
    await armBefore();
    const r = await timed(switchDone('timeframe'), () => page.keyboard.press(key));
    const s = await state();
    note(s);
    results.switches.push({ kind: 'timeframe', key, ...r, to: parse(s).tf });
    await sleep(900);
  }
  /* THE WINDOW: W cycles the expiry window (four presses come back) */
  for (let i = 0; i < 4; i++) {
    await armBefore();
    const r = await timed(switchDone('window'), () => page.keyboard.press('w'));
    results.switches.push({ kind: 'window', key: 'w', ...r, to: await page.evaluate(() => document.querySelector('[data-pane-window]')?.getAttribute('data-pane-window') ?? '') });
    await sleep(700);
  }
  /* THE TICKER: ArrowDown to the next name and ArrowUp back — the first visit to a name is cold and reported apart */
  for (const key of ['ArrowDown', 'ArrowUp']) {
    await armBefore();
    const before = parse(await state()).ticker;
    const r = await timed(switchDone('ticker'), () => page.keyboard.press(key), 20_000);
    const after = parse(await state()).ticker;
    note(await state());
    const seen = sample.tickers.has(after) && run > 0;
    (seen ? results.switches : results.cold).push({ kind: 'ticker', key, from: before, to: after, ...r });
    sample.tickers.add(after);
    await sleep(1500);
  }
}

/* THE HOVER: across the bars, a sample each time the readout changes */
for (let i = 0; i < 24; i++) {
  const p = inPlot(0.2 + i * 0.025, 0.5);
  const r = await timed(`() => { const t = document.querySelector('[data-crosshair-readout]')?.textContent ?? ''; if (window.__sbHover === undefined) window.__sbHover = t; if (t && t !== window.__sbHover) { window.__sbHover = t; return true; } return false; }`, () => page.mouse.move(p.x, p.y), 600);
  if (r.ok) results.hover.push(r.ms);
}
await page.mouse.move(inPlot(0.5, 0.97).x, inPlot(0.5, 0.97).y);

/* THE PAN: two seconds of drag, every frame's time */
{
  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    const tick = t => {
      window.__frames.push(t - last);
      last = t;
      if (!window.__stopFrames) requestAnimationFrame(tick);
    };
    window.__stopFrames = false;
    requestAnimationFrame(tick);
  });
  const a = inPlot(0.7, 0.5);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < 2000) {
    await page.mouse.move(a.x - (i % 120) * 4, a.y);
    i++;
    await sleep(8);
  }
  await page.mouse.up();
  const frames = await page.evaluate(() => {
    window.__stopFrames = true;
    return window.__frames.slice(3);
  });
  const sorted = [...frames].sort((x, y) => x - y);
  const total = frames.reduce((x, y) => x + y, 0);
  results.pan = {
    frames: frames.length,
    fps: +(frames.length / (total / 1000)).toFixed(1),
    medianMs: +sorted[Math.floor(sorted.length / 2)].toFixed(1),
    p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
    slowShare: +(frames.filter(f => f > PAN_SLOW_FRAME_MS).length / frames.length).toFixed(3),
  };
}

/* THE JUMPS: 1Y and Max, from the header's jump (a menu when the header is narrow) — done when the view covers it */
for (const span of ['1y', 'max', 'today']) {
  const click = async () => {
    const direct = page.locator(`[data-pane-head] [data-jump="${span}"]`);
    if (await direct.count()) return direct.first().click();
    await page.locator('[data-jump-trigger]').first().click();
    await page.locator(`[data-jump="${span}"]`).first().click();
  };
  await page.evaluate(() => (window.__sbView = document.querySelector('[data-chart-view]')?.getAttribute('data-chart-view') ?? ''));
  const need = span === '1y' ? 300 * 86_400 : span === 'max' ? 0 : -1;
  const pred = `() => {
    const v = document.querySelector('[data-chart-view]')?.getAttribute('data-chart-view') ?? '';
    const s = (document.querySelector('[data-chart-state]')?.getAttribute('data-chart-state') ?? '').split('|');
    if (!v) return false;
    const [from, to] = v.split('-').map(Number);
    /* a view that already covered the span (Max right after a 1Y on a year of bars) is done at the first frame */
    ${need > 0 ? `return to - from >= ${need};` : need === 0 ? `return from <= Number(s[3]) + 7 * 86400;` : 'return v !== window.__sbView;'}
  }`;
  const r = await timed(pred, click, 10_000);
  const s = await state();
  note(s);
  results.jumps.push({ span, ...r, view: await view(), tf: parse(s).tf });
  await sleep(1500);
}

await browser.close();
stop();

/* THE VERDICT */
const med = xs => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);
const max = xs => (xs.length ? Math.max(...xs) : null);
const sw = kind => results.switches.filter(s => s.kind === kind);
const misses = [];
for (const kind of ['timeframe', 'window', 'ticker']) {
  const rows = sw(kind);
  if (!rows.length) misses.push(`${kind}: not measured`);
  for (const r of rows) if (!r.ok || r.ms >= BUDGETS.switchMs) misses.push(`${kind} ${r.key}${r.to ? ` → ${r.to}` : ''}: ${r.ok ? `${r.ms.toFixed(0)} ms` : 'never finished'}`);
}
if (results.hover.length < 5) misses.push(`hover: only ${results.hover.length} samples`);
for (const h of results.hover) if (h >= BUDGETS.hoverMs) misses.push(`hover: ${h.toFixed(0)} ms`);
if (!results.pan || results.pan.medianMs > 1000 / BUDGETS.panFps + 0.5 || results.pan.slowShare > PAN_SLOW_SHARE) misses.push(`pan: median ${results.pan?.medianMs} ms a frame, ${((results.pan?.slowShare ?? 1) * 100).toFixed(1)}% over ${PAN_SLOW_FRAME_MS} ms`);
for (const j of results.jumps) if (j.span !== 'today' && (!j.ok || j.ms >= BUDGETS.jumpMs)) misses.push(`jump ${j.span}: ${j.ok ? `${j.ms.toFixed(0)} ms` : 'never finished'}`);
if (pageErrors.length) misses.push(`page errors: ${pageErrors.length}`);

const machine = { platform: `${os.platform()} ${os.release()}`, cpu: os.cpus()[0]?.model ?? '?', cores: os.cpus().length, memoryGB: +(os.totalmem() / 2 ** 30).toFixed(1), node: process.version, chromium: chromiumVersion };
const report = {
  at: new Date().toISOString(),
  url: URL,
  mode: SERVE === 'preview' ? 'production build (vite preview)' : 'the server at the url (development unless it is a preview)',
  runs: RUNS,
  budgets: BUDGETS,
  machine,
  sample: { tickers: [...sample.tickers], byTimeframe: sample.byTf },
  results: {
    switches: results.switches.map(s => ({ ...s, ms: +s.ms.toFixed(1) })),
    coldTickerVisits: results.cold.map(s => ({ ...s, ms: +s.ms.toFixed(1) })),
    hoverMs: results.hover.map(h => +h.toFixed(1)),
    pan: results.pan,
    jumps: results.jumps.map(j => ({ ...j, ms: +j.ms.toFixed(1) })),
  },
  summary: {
    timeframe: { median: med(sw('timeframe').map(s => s.ms)), max: max(sw('timeframe').map(s => s.ms)) },
    window: { median: med(sw('window').map(s => s.ms)), max: max(sw('window').map(s => s.ms)) },
    ticker: { median: med(sw('ticker').map(s => s.ms)), max: max(sw('ticker').map(s => s.ms)) },
    hover: { median: med(results.hover), max: max(results.hover) },
  },
  pageErrors,
  misses,
};
mkdirSync(OUT, { recursive: true });
const stamp = report.at.replace(/[:.]/g, '-').slice(0, 19);
writeFileSync(join(OUT, `speed-${stamp}.json`), JSON.stringify(report, null, 1));
const f0 = x => (x == null ? '—' : `${Math.round(x)} ms`);
const md = [
  `# Terrain speed budgets — ${report.at}`,
  '',
  `${report.mode}, ${URL}; ${RUNS} run${RUNS === 1 ? '' : 's'}; ${machine.cpu} × ${machine.cores}, ${machine.memoryGB} GB, ${machine.platform}, Node ${machine.node}.`,
  '',
  '| budget | median | worst | limit |',
  '|---|---|---|---|',
  `| timeframe switch | ${f0(report.summary.timeframe.median)} | ${f0(report.summary.timeframe.max)} | < ${BUDGETS.switchMs} ms |`,
  `| window switch | ${f0(report.summary.window.median)} | ${f0(report.summary.window.max)} | < ${BUDGETS.switchMs} ms |`,
  `| ticker switch (warm) | ${f0(report.summary.ticker.median)} | ${f0(report.summary.ticker.max)} | < ${BUDGETS.switchMs} ms |`,
  `| hover | ${f0(report.summary.hover.median)} | ${f0(report.summary.hover.max)} | < ${BUDGETS.hoverMs} ms |`,
  `| pan | ${results.pan ? `${results.pan.fps} fps, median frame ${results.pan.medianMs} ms` : '—'} | p95 frame ${results.pan?.p95Ms ?? '—'} ms, ${((results.pan?.slowShare ?? 0) * 100).toFixed(1)}% over ${PAN_SLOW_FRAME_MS} ms | ${BUDGETS.panFps} fps |`,
  ...results.jumps.map(j => `| jump ${j.span} | ${f0(j.ms)} | ${j.ok ? `view ${j.view}, ${j.tf}` : 'never finished'} | ${j.span === 'today' ? '—' : `< ${BUDGETS.jumpMs} ms`} |`),
  '',
  `Cold first visits (not budgeted): ${results.cold.map(c => `${c.from} → ${c.to} ${f0(c.ms)}`).join(', ') || 'none'}.`,
  '',
  '**The sample**',
  '',
  '| name · timeframe | bars | from | to | field columns |',
  '|---|---|---|---|---|',
  ...Object.entries(sample.byTf).map(([k, v]) => `| ${k} | ${v.bars} | ${v.from ?? '—'} | ${v.to ?? '—'} | ${v.fieldColumns ?? '—'} |`),
  '',
  misses.length ? `**MISSED (${misses.length})**: ${misses.join('; ')}` : '**Every budget held.**',
].join('\n');
writeFileSync(join(OUT, `speed-${stamp}.md`), md + '\n');
console.log(md);
console.log(`\nkept: ${join(OUT, `speed-${stamp}.md`)}`);
process.exit(misses.length && !NO_FAIL ? 1 : 0);
