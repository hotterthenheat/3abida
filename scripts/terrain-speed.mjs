/* THE SPEED BUDGETS (the Terrain UI pass, 2026-10-14): measured in a real browser on the sessions this machine holds —
   a pan's frame rate, the hover's latency to the readout, a 1Y jump, and a window, ticker and timeframe switch */
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--enable-gpu-rasterization'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Los_Angeles' });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5180/terrain', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-pane-head]', { timeout: 20000 });
await page.waitForTimeout(500);
await page.keyboard.press('1');
await page.waitForTimeout(15000);
const pane = page.locator('[data-pane-head-row]').first().locator('xpath=ancestor::*[contains(@class,"group")][1]');
const plot = await page.locator('[data-chart-ink]').first().boundingBox();
const results = {};
// 1. pan: frame times during a 2 s drag
await page.evaluate(() => { window.__frames = []; let last = performance.now(); const tick = t => { window.__frames.push(t - last); last = t; if (window.__frames.length < 600) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
await page.mouse.move(plot.x + 600, plot.y + 400); await page.mouse.down();
for (let i = 0; i < 60; i++) { await page.mouse.move(plot.x + 600 - i * 6, plot.y + 400); await page.waitForTimeout(16); }
await page.mouse.up();
const frames = await page.evaluate(() => window.__frames.slice(5));
const sorted = [...frames].sort((a, b) => a - b);
results.pan = { frames: frames.length, medianMs: +sorted[Math.floor(sorted.length / 2)].toFixed(1), p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1), over20ms: frames.filter(f => f > 20).length, fpsEquivalent: +(1000 / (frames.reduce((a, b) => a + b, 0) / frames.length)).toFixed(1) };
// 2. hover: mousemove → the readout's text change
const hoverLat = [];
for (let i = 0; i < 10; i++) {
  const x = plot.x + 400 + i * 20;
  const before = await page.evaluate(() => document.querySelector('[data-crosshair-readout]')?.textContent ?? '');
  const t0 = Date.now();
  await page.mouse.move(x, plot.y + 420);
  await page.waitForFunction(b => (document.querySelector('[data-crosshair-readout]')?.textContent ?? '') !== b, before, { timeout: 2000 }).catch(() => null);
  hoverLat.push(Date.now() - t0);
}
results.hover = { samplesMs: hoverLat, medianMs: [...hoverLat].sort((a, b) => a - b)[5] };
// 3. the 1Y jump
const jumpVia = async span => {
  const t0 = Date.now();
  const jt = page.locator('[data-jump-trigger]');
  if (await jt.count()) { await jt.first().click(); await page.locator(`[data-jump="${span}"]`).first().click(); } else await page.locator(`[data-jump="${span}"]`).first().click({ timeout: 5000 });
  await page.waitForFunction(() => (document.querySelector('[data-pane-tf]')?.getAttribute('data-pane-tf') ?? document.querySelector('[data-confluence-tabs] [aria-pressed="true"]')?.textContent ?? '').startsWith('1D'), null, { timeout: 5000 }).catch(() => null);
  await page.waitForTimeout(100);
  return Date.now() - t0;
};
results.jump1Y = { ms: await jumpVia('1y') };
await page.waitForTimeout(500);
console.log('after 1Y', JSON.stringify(await page.evaluate(() => ({ panes: document.querySelectorAll('[data-pane-head]').length, forms: [...document.querySelectorAll('[data-pane-head]')].map(h => [h.getAttribute('data-jump-form'), h.getAttribute('data-window-form')]), triggers: document.querySelectorAll('[data-jump-trigger]').length, jumps: document.querySelectorAll('[data-jump]').length, tf: document.querySelector('[data-pane-tf]')?.getAttribute('data-pane-tf') ?? [...document.querySelectorAll('[data-confluence-tabs] [aria-pressed="true"]')].map(e => e.textContent), rowW: Math.round(document.querySelector('[data-pane-head-row]')?.getBoundingClientRect().width ?? 0) }))));
results.jumpToday = { ms: await (async () => { const t0 = Date.now(); const jt = page.locator('[data-jump-trigger]'); if (await jt.count()) { await jt.first().click(); await page.locator('[data-jump="today"]').first().click(); } else await page.locator('[data-jump="today"]').first().click({ timeout: 5000 }); await page.waitForTimeout(100); return Date.now() - t0; })() };
// 4. the window switch: click a window → the strip's regime words change (the field is re-summed) or the attribute
/* the W key: one press → the header's window attribute and the strip's words (the field re-summed through the window) */
await page.mouse.click(plot.x + 300, plot.y + 300);
const winSwitch = async () => {
  const before = await page.evaluate(() => [document.querySelector('[data-pane-window]')?.getAttribute('data-pane-window'), document.querySelector('[data-decision-box="regime"] [data-decision-words]')?.textContent]);
  const t0 = performance.now();
  await page.keyboard.press('w');
  await page.waitForFunction(b => document.querySelector('[data-pane-window]')?.getAttribute('data-pane-window') !== b[0], before, { timeout: 3000 }).catch(() => null);
  const tAttr = performance.now() - t0;
  await page.waitForFunction(b => (document.querySelector('[data-decision-box="regime"] [data-decision-words]')?.textContent ?? '') !== b[1], before, { timeout: 3000 }).catch(() => null);
  return { attrMs: Math.round(tAttr), stripMs: Math.round(performance.now() - t0) };
};
results.windowSwitch = await winSwitch();
await page.keyboard.press('w'); await page.keyboard.press('w'); await page.keyboard.press('w'); await page.waitForTimeout(300);
// 5. the timeframe switch: '=' steps the timeframe
const tfSwitch = async () => {
  const before = await page.evaluate(() => document.querySelector('[data-pane-tf]')?.getAttribute('data-pane-tf') ?? document.querySelector('[data-confluence-tabs] [aria-pressed="true"]')?.textContent ?? '');
  const t0 = Date.now();
  await page.keyboard.press('=');
  await page.waitForFunction(b => (document.querySelector('[data-pane-tf]')?.getAttribute('data-pane-tf') ?? document.querySelector('[data-confluence-tabs] [aria-pressed="true"]')?.textContent ?? '') !== b, before, { timeout: 3000 }).catch(() => null);
  return Date.now() - t0;
};
await page.mouse.click(plot.x + 300, plot.y + 300);
results.timeframeSwitch = { ms: await tfSwitch() };
await page.keyboard.press('-');
// 6. the ticker switch: ArrowDown flips the name
const tickerSwitch = async () => {
  const before = await page.evaluate(() => [document.querySelector('[data-pane-head] button')?.textContent ?? '', document.querySelector('[data-decision-box="levels"] [data-decision-words]')?.textContent ?? '']);
  const t0 = performance.now();
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(b => (document.querySelector('[data-pane-head] button')?.textContent ?? '') !== b[0], before, { timeout: 3000 }).catch(() => null);
  const tHead = performance.now() - t0;
  await page.waitForFunction(b => (document.querySelector('[data-decision-box="levels"] [data-decision-words]')?.textContent ?? '') !== b[1], before, { timeout: 6000 }).catch(() => null);
  return { headMs: Math.round(tHead), stripMs: Math.round(performance.now() - t0) };
};
results.tickerSwitch = await tickerSwitch();
await page.keyboard.press('ArrowUp');
console.log(JSON.stringify(results, null, 1));
await browser.close();
