// THE PERF SWEEP METER (2026-09-06, Noah: "the laggyness and stutters of this
// entire website... from the sidebar being dragged for the first time, opening
// the pulse page, dragging, opening the weigher"). One run, every scenario he
// named, three numbers each: long tasks (count · total · worst), frame gaps
// (mean · p95 · worst · dropped >32ms) and, for the worst scenarios, the top
// self-time functions from a CPU profile.
//   node scripts/perf-sweep-proof.mjs [--profile]
import { chromium } from 'playwright';

const PROFILE = process.argv.includes('--profile');
/** The dev server by default; BASE=http://localhost:5200 measures a `vite preview` of the production build */
const BASE = process.env.BASE ?? 'http://localhost:5199';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1900, height: 1000 } });
await page.addInitScript(() => {
  window.__lt = [];
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) window.__lt.push({ t: e.startTime, d: e.duration });
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
  window.__gaps = [];
  window.__gapId = 0;
});
const cdp = await page.context().newCDPSession(page);
if (PROFILE) {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
}

const gapsStart = () =>
  page.evaluate(() => {
    window.__gaps = [];
    const id = ++window.__gapId;
    let last = performance.now();
    const tick = t => {
      if (window.__gapId !== id) return;
      window.__gaps.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
const gapsStop = () =>
  page.evaluate(() => {
    window.__gapId++;
    return window.__gaps.slice(1);
  });
const ltReset = () => page.evaluate(() => { window.__lt = []; window.__gapT0 = performance.now(); });
const ltRead = () => page.evaluate(() => window.__lt.slice());
/** The three worst frame gaps with the long tasks that overlapped them — a gap
    with no task under it is the harness (or the compositor), not the page. */
const explainGaps = async (label) => {
  const info = await page.evaluate(() => {
    const t0 = window.__gapT0 ?? 0;
    const gaps = window.__gaps.slice(1);
    let t = t0;
    const stamped = gaps.map(g => { const s = t; t += g; return { at: s, g }; });
    const worst = [...stamped].sort((a, b) => b.g - a.g).slice(0, 3).filter(w => w.g > 40);
    return worst.map(w => ({ at: Math.round(w.at - t0), gap: Math.round(w.g), tasks: window.__lt.filter(l => l.t + l.d > w.at && l.t < w.at + w.g).map(l => Math.round(l.d)) }));
  });
  if (info.length) console.log(`   ↳ ${label} gaps: ` + info.map(w => `${w.gap}ms @${w.at}ms [tasks ${w.tasks.join('+') || 'none'}]`).join(' · '));
};

const fmt = (n, w = 6) => String(n).padStart(w);
const report = (label, lt, gaps, extra = '') => {
  const s = [...gaps].sort((a, b) => a - b);
  const p = q => (s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0);
  const mean = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
  const dropped = s.filter(g => g > 32).length;
  const total = lt.reduce((a, b) => a + b.d, 0);
  const worst = lt.reduce((a, b) => Math.max(a, b.d), 0);
  console.log(
    `${label.padEnd(26)} longtasks ${fmt(lt.length, 2)} · ${fmt(total.toFixed(0), 5)}ms · worst ${fmt(worst.toFixed(0), 4)}ms   frames ${fmt(s.length, 4)} · mean ${mean.toFixed(1).padStart(5)} · p95 ${p(0.95).toFixed(0).padStart(4)} · max ${p(1).toFixed(0).padStart(4)} · dropped ${fmt(dropped, 3)}${extra ? '   ' + extra : ''}`
  );
};

const profileStart = async () => { if (PROFILE) await cdp.send('Profiler.start'); };
/** Top self time over the scenario, then the functions INSIDE each long task
    (samples anchored to the task clock by a performance.now() read right after
    the stop). A native frame (no url) is named by its nearest JS caller. */
const profileStop = async label => {
  if (!PROFILE) return;
  const { profile } = await cdp.send('Profiler.stop');
  const now = await page.evaluate(() => performance.now());
  const lt = await ltRead();
  const byId = new Map(profile.nodes.map(n => [n.id, n]));
  const parentOf = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parentOf.set(c, n);
  const frameKey = f => {
    const file = (f.url || '').split('/').slice(-2).join('/').split('?')[0];
    return `${f.functionName || '(anonymous)'}  ${file}${f.lineNumber >= 0 ? ':' + (f.lineNumber + 1) : ''}`;
  };
  const keyOf = node => {
    const f = node.callFrame;
    if (f.url) return frameKey(f);
    let p = parentOf.get(node.id);
    while (p && !p.callFrame.url) p = parentOf.get(p.id);
    return p ? `${f.functionName || '(native)'} ← ${frameKey(p.callFrame)}` : frameKey(f);
  };
  const skip = k => k.startsWith('(idle)') || k.startsWith('(program)') || k.startsWith('(garbage') || k.startsWith('(root)');
  const rank = (m, n) => [...m.entries()].filter(([k]) => !skip(k)).sort((a, b) => b[1] - a[1]).slice(0, n);
  const times = [];
  let t = profile.startTime;
  for (let i = 0; i < profile.samples.length; i++) {
    t += profile.timeDeltas[i] ?? 0;
    times.push(now - (profile.endTime - t) / 1000);
  }
  const self = new Map();
  for (let i = 0; i < profile.samples.length; i++) {
    const k = keyOf(byId.get(profile.samples[i]));
    self.set(k, (self.get(k) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000);
  }
  console.log(`  ↳ ${label}: top self time`);
  for (const [k, ms] of rank(self, 10)) console.log(`      ${ms.toFixed(1).padStart(7)}ms  ${k}`);
  for (const task of lt) {
    const inside = new Map();
    for (let i = 0; i < profile.samples.length; i++) {
      if (times[i] < task.t || times[i] > task.t + task.d) continue;
      const k = keyOf(byId.get(profile.samples[i]));
      inside.set(k, (inside.get(k) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000);
    }
    console.log(`     inside the ${Math.round(task.d)}ms task:`);
    for (const [k, ms] of rank(inside, 8)) console.log(`        ${ms.toFixed(1).padStart(6)}ms  ${k}`);
  }
};

const settle = async () => {
  await page.waitForFunction(() => !document.body.innerText.includes('ENTERING TERMINAL'), null, { timeout: 12000 }).catch(() => {});
};

/** Navigate by clicking the sidebar (the way a person does) and measure the 2.5s after */
const openVia = async (label, navSel, readySel) => {
  await ltReset();
  await gapsStart();
  await profileStart();
  const t0 = Date.now();
  await page.click(navSel);
  await page.waitForSelector(readySel, { timeout: 15000 }).catch(() => {});
  const ready = Date.now() - t0;
  await page.waitForTimeout(2500);
  const gaps = await gapsStop();
  report(label, await ltRead(), gaps, `ready ${ready}ms`);
  await explainGaps(label);
  await profileStop(label);
};

// ---- cold load of the desk ------------------------------------------------
await ltReset();
await gapsStart();
const t0 = Date.now();
await page.goto(`${BASE}/pulse`, { waitUntil: 'networkidle' });
await settle();
await page.waitForSelector('.react-grid-item', { timeout: 15000 }).catch(() => {});
const coldReady = Date.now() - t0;
await page.waitForTimeout(2500);
report('cold load /pulse', await ltRead(), await gapsStop(), `ready ${coldReady}ms (${BASE.includes('5199') ? 'dev server, modules included' : 'production build'})`);

// ---- idle on the desk: the tick's own cost, and the 10s scan ----------------
await ltReset();
await gapsStart();
await profileStart();
await page.waitForTimeout(12000);
report('idle /pulse (12s)', await ltRead(), await gapsStop());
await profileStop('idle /pulse (12s)');
await explainGaps('idle /pulse');

// ---- the sidebar collapse and expand ----------------------------------------
for (const round of [1, 2]) {
  await ltReset();
  await gapsStart();
  if (round === 1) await profileStart();
  await page.click('[data-sidenav-toggle]');
  await page.waitForTimeout(700);
  report(`sidebar collapse #${round}`, await ltRead(), await gapsStop());
  await explainGaps(`sidebar collapse #${round}`);
  if (round === 1) await profileStop('sidebar collapse');
  await ltReset();
  await gapsStart();
  await page.click('[data-sidenav-toggle]');
  await page.waitForTimeout(700);
  report(`sidebar expand #${round}`, await ltRead(), await gapsStop());
}

// ---- dragging a widget on the desk, then resizing one ------------------------
// The head is grabbed by its TITLE (x+120): the first version pressed at x+8,
// which is the nw resize handle's square, and measured a corner resize.
const gesture = async (label, sel, dx, dy, at = 120) => {
  const h = await page.$(sel);
  if (!h) return console.log(`${label}: no ${sel}`);
  const b = await h.boundingBox();
  const x0 = b.x + Math.min(at, b.width / 2);
  const y0 = b.y + b.height / 2;
  await page.mouse.move(x0, y0);
  await ltReset();
  await gapsStart();
  await profileStart();
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) {
    await page.mouse.move(x0 + (dx * i) / 30, y0 + (dy * i) / 30);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(600);
  report(`${label} (30 moves)`, await ltRead(), await gapsStop());
  await explainGaps(label);
  await profileStop(label);
  // and back
  const b2 = await page.$(sel).then(x => x.boundingBox());
  const x1 = b2.x + Math.min(at, b2.width / 2);
  const y1 = b2.y + b2.height / 2;
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) { await page.mouse.move(x1 - (dx * i) / 30, y1 - (dy * i) / 30); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(500);
};
await gesture('widget drag', '.widget-drag', 360, 180);
await gesture('widget resize', '.react-grid-item .react-resizable-handle-se', -240, -120, 8);

// ---- opening the other pages from the sidebar --------------------------------
await openVia('open /weigher', '[data-nav-item="/weigher"]', 'tr[aria-selected]');
await ltReset();
await gapsStart();
await page.waitForTimeout(3000);
report('idle /weigher (3s)', await ltRead(), await gapsStop());
await openVia('open /pinpoint (map)', '[data-nav-item="/pinpoint"]', '[data-profile-panel] canvas');
await openVia('open /pinpoint/ahead', '[data-nav-sub="/pinpoint/ahead"]', '[data-corridor-svg]');
await openVia('open /terrain', '[data-nav-item="/terrain"]', '[data-map-box], .tv-lightweight-charts, canvas');
await openVia('open /trace', '[data-nav-item="/trace"]', 'tbody tr');
await openVia('open /compass', '[data-nav-item="/compass"]', 'main');
await openVia('back to /pulse', '[data-nav-item="/pulse"]', '.react-grid-item');
await openVia('open /weigher again', '[data-nav-item="/weigher"]', 'tr[aria-selected]');

await browser.close();
