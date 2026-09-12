// Drag the PRICE AXIS, release, and log every chart/series API call the
// component makes in the next 1.5s, alongside the visible price range —
// the call right before the range jumps is the culprit.
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5199/weigher', { waitUntil: 'networkidle' });
await page.waitForSelector('tr[aria-selected]');
await page.waitForFunction(() => !document.body.innerText.includes('ENTERING TERMINAL'), null, { timeout: 8000 });
await page.waitForTimeout(1500);

const box = await page.evaluate(() => {
  const el = [...document.querySelectorAll('div')].find(d => d.__chart);
  const r = el.getBoundingClientRect();
  window.__el = el;
  window.__log = [];
  const log = (what, arg) => window.__log.push({ t: performance.now(), what, arg: arg === undefined ? '' : JSON.stringify(arg).slice(0, 90) });
  const chart = el.__chart;
  const series = el.__series;
  // Wrap the series' mutators (same instance the component holds).
  for (const m of ['update', 'setData', 'applyOptions', 'createPriceLine', 'removePriceLine', 'setMarkers']) {
    if (typeof series[m] !== 'function') continue;
    const orig = series[m].bind(series);
    series[m] = (...a) => {
      log(`series.${m}`, m === 'setData' ? `${a[0]?.length} pts` : m === 'update' ? a[0]?.time : a[0]);
      return orig(...a);
    };
  }
  // Wrap chart.priceScale(id).applyOptions and chart.timeScale() mutators.
  const origPS = chart.priceScale.bind(chart);
  chart.priceScale = id => {
    const ps = origPS(id);
    const ao = ps.applyOptions.bind(ps);
    ps.applyOptions = o => {
      log(`priceScale(${id}).applyOptions`, o);
      return ao(o);
    };
    return ps;
  };
  const origTS = chart.timeScale.bind(chart);
  chart.timeScale = () => {
    const ts = origTS();
    for (const m of ['applyOptions', 'setVisibleLogicalRange', 'scrollToPosition', 'fitContent', 'setVisibleRange']) {
      const orig = ts[m].bind(ts);
      ts[m] = (...a) => {
        log(`timeScale.${m}`, a[0]);
        return orig(...a);
      };
    }
    return ts;
  };
  const origCA = chart.applyOptions.bind(chart);
  chart.applyOptions = o => {
    log('chart.applyOptions', Object.keys(o));
    return origCA(o);
  };
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
const range = () =>
  page.evaluate(() => {
    const el = window.__el;
    const s = el.__series;
    const h = el.getBoundingClientRect().height;
    return `${s.coordinateToPrice(h * 0.84 - 8)?.toFixed(2)}..${s.coordinateToPrice(8)?.toFixed(2)}`;
  });

const ax = box.x + box.w - 28;
const y0 = box.y + box.h * 0.45;
await page.mouse.move(ax, y0);
await page.waitForTimeout(100);
await page.mouse.down();
for (let i = 1; i <= 20; i++) {
  await page.mouse.move(ax, y0 - i * 6);
  await page.waitForTimeout(16);
}
const mid = await range();
await page.evaluate(() => {
  window.__log.length = 0;
  window.__t0 = performance.now();
  window.__ranges = [];
  const el = window.__el;
  const s = el.__series;
  const h = el.getBoundingClientRect().height;
  const r = () => `${s.coordinateToPrice(h * 0.84 - 8)?.toFixed(2)}..${s.coordinateToPrice(8)?.toFixed(2)}`;
  let last = r();
  const tick = () => {
    const now = r();
    if (now !== last) window.__ranges.push({ t: performance.now(), what: `RANGE ${last} → ${now}` });
    last = now;
    if (performance.now() - window.__t0 < 1500) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await page.mouse.up();
await page.waitForTimeout(1600);
const out = await page.evaluate(() => {
  const all = [...window.__log, ...window.__ranges].sort((a, b) => a.t - b.t);
  return all.map(e => `+${String(Math.round(e.t - window.__t0)).padStart(5)}ms  ${e.what} ${e.arg ?? ''}`);
});
console.log('mid-drag range:', mid, '\nafter release:');
for (const line of out) console.log('  ' + line);
await browser.close();
