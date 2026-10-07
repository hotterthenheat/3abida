/*
  THE LANDING'S SESSION (2026-10-03) — `npm run landing:session`, with the dev server up.

  The landing's demonstration (src/pages/landing/Session.tsx): ONE RUN of the terminal's own Pulse desk, a picture and a
  reading at every step, from which the page takes five beats. The owner's brief: "Take one real historical market
  situation … Before → Positioning changes → Key level changes → Compass updates → Price interacts with the level … The
  point is not to claim 'Slayer predicted the move.' The point is: 'Look at what the terminal was able to show.'"

  HOW IT IS TAKEN. The desk is opened (the stage's first visit, landing-stage.mjs SEED) with the page's clock held at AT —
  09:31 in New York — and its live ticks drawn from a seeded stream (Math.random, seeded in every frame), so a run is the
  same run every time it is taken, on either theme (measured: three runs, tick for tick). The clock is then stepped STEP
  of the page's time at a time; after each step the desk is photographed and read: SPY's price, the walls, the flip and
  the heaviest strike (data/gex.ts buildLevelsFor — what the desk itself reads), Compass's top cards, and where on the
  desk each thing stands. A loop that runs for ever (the mark's foil, a breathing dot) is held on the run's clock.

  WHAT IT WRITES —
      public/landing/session/<theme>/f000.webp …   every step, 1152 wide: the session the scroll plays
      public/landing/session/<theme>/beat-1.webp … each beat's own picture, full size
      public/landing/session/<theme>/beat-1-focus.webp …  each beat's focus, cut at three times its size: what a held
                                                  beat's window shows (FOCUS below)
      src/pages/landing/session.json              the steps' times, the beats (their step, time, marks, focus, level and
                                                  call) and the readings the beats' words were read off

  THE BEATS ARE CHOSEN BY HAND (BEATS below): a new run — another day, another seed, a real feed — is read first
  (`READ=1` prints every step's reading and writes nothing), its beats picked, and the words in Session.tsx rewritten off
  the new readings. Until the terminal reads a real feed, no date is printed with the session.

  The encoder is ffmpeg with libwebp: FFMPEG names one, else `ffmpeg` on the PATH.
*/
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { SEED } from './landing-stage.mjs';

const BASE = process.argv[2] ?? 'http://localhost:5199';
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const READ = !!process.env.READ;
/** the run: its day and minute, the stream its live ticks draw on, and how many steps of how much page time */
const AT = '2026-10-01T13:31:00Z';
const RANDOM = 7654321;
const STEPS = 86;
const STEP = 20000;
const W = 1440;
const H = 1000;
const DPR = 1.5;

const pad = (b, p = 5) => [b[0] - p, b[1] - p, b[2] + 2 * p, b[3] + 2 * p];
/* THE FIVE BEATS of the run taken on 2026-10-03 — each a step, and what is marked on its picture. Since 2026-10-06 (the
   owner's directive: "zoom each beat to what its copy talks about … a 2 px silver rule on the exact level and a label
   chip, for example 'Call wall 475 → 477'") a beat also names THE LEVEL its words are about — the ladder's row for it —
   and THE CALL, the chip's words, read off this beat's reading and the one before it (`was`) */
const BEATS = [
  /* Before: SPY 470.29, the call wall overhead at 475 */
  { step: 0, mark: r => [pad(r.rows.cw)], level: r => r.rows.cw, call: r => `Call wall ${r.cw}` },
  /* Positioning shifts: the heaviest strike swings from the 475 calls to the 470 puts — the ladder's head says so */
  { step: 28, mark: r => [pad(r.readline, 4)], level: r => r.rows.sup, call: (r, was) => `Heaviest strike ${was.sup} → ${r.sup}` },
  /* Compass updates: the SPY 475 call is its top pick */
  { step: 30, mark: r => [pad(r.cards[0].box, 4)] },
  /* The level moves: the call wall steps up to 477 */
  { step: 33, mark: r => [pad(r.rows.cw)], level: r => r.rows.cw, call: (r, was) => `Call wall ${was.cw} → ${r.cw}` },
  /* Price meets the level: 475 the put wall, price back on it */
  { step: 72, mark: r => [pad(r.chart, 4), pad(r.rows.pw)], level: r => r.rows.pw, call: (r, was) => `Put wall ${was.pw} → ${r.pw}` },
];

/* THE FOCUS (2026-10-06): what a held beat's window shows — the ladder round the beat's level, as wide as keeps the
   ladder's smallest words (8 px) at 11 px or more in a window about 780 px wide, at the window's own shape. It is cut
   from the desk at three times its CSS size, so it stays sharp on any screen (the ladder is the page's own words, which
   the browser draws afresh at the scale it is asked for). A beat with no level is focused on its marks. */
const FOCUS_W = 560;
const FOCUS_H = Math.round(FOCUS_W / (W / H));
const FOCUS_SCALE = 3;
const focusOf = (b, r) => {
  const lv = b.level?.(r);
  const at = lv ?? b.mark(r)[0];
  const cy = at[1] + at[3] / 2;
  const x = Math.max(0, Math.min(W - FOCUS_W, lv ? lv[0] - 8 : at[0] + at[2] / 2 - FOCUS_W / 2));
  const y = Math.max(0, Math.min(H - FOCUS_H, Math.round(cy - FOCUS_H / 2)));
  return [x, y, FOCUS_W, FOCUS_H];
};

const et = t => new Date(t * 1000).toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

const take = async (browser, theme) => {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, timezoneId: 'America/New_York', locale: 'en-US' });
  await ctx.addInitScript(
    ([seed, n]) => {
      try {
        for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      } catch {}
      let a = n | 0;
      Math.random = () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    [SEED, RANDOM]
  );
  /* held from the first moment: nothing the load does in real time reaches the run */
  await ctx.clock.install({ time: new Date(AT) });
  await ctx.clock.pauseAt(new Date(AT).getTime() + 10);
  const page = await ctx.newPage();
  await page.route(`${BASE}/__session-host`, r =>
    r.fulfill({ contentType: 'text/html', body: `<html><body style="margin:0;background:#000;overflow:hidden"><iframe id="t" src="/pulse?embed=1&photo=1&theme=${theme}" style="border:0;display:block;width:${W}px;height:${H}px"></iframe></body></html>` })
  );
  await page.goto(`${BASE}/__session-host`);
  await page.waitForTimeout(7000);
  /* the desk boots on the held clock, a tenth of a second at a time */
  for (let i = 0; i < 100; i++) {
    await ctx.clock.runFor(100);
    await page.waitForTimeout(15);
  }
  const frame = page.frames().find(f => f.url().includes('/pulse'));
  const hold = dt =>
    frame
      .evaluate(dt => {
        const held = (window.__held ??= new WeakSet());
        for (const a of document.getAnimations()) {
          if (a.effect?.getComputedTiming?.().iterations !== Infinity) continue;
          if (a.playState === 'running') {
            a.pause();
            held.add(a);
          } else if (held.has(a) && dt > 0) a.currentTime = (Number(a.currentTime) || 0) + dt;
        }
      }, dt)
      .catch(() => {});
  const read = () =>
    frame.evaluate(async () => {
      const gex = await import('/src/data/gex.ts');
      const c = window.__sim.getCandles('SPY');
      const l = c[c.length - 1];
      const L = gex.buildLevelsFor('SPY');
      const box = el => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
      };
      const row = s => box(document.querySelector(`[data-ladder-row="${s}"]`));
      const panel = document.querySelector('.react-grid-item');
      const canvases = panel ? [...panel.querySelectorAll('canvas')].map(box).filter(Boolean) : [];
      /* the chart and its price axis, one box */
      const chart = canvases.length ? [Math.min(...canvases.map(b => b[0])), Math.min(...canvases.map(b => b[1])), Math.max(...canvases.map(b => b[0] + b[2])) - Math.min(...canvases.map(b => b[0])), Math.max(...canvases.map(b => b[1] + b[3])) - Math.min(...canvases.map(b => b[1]))] : null;
      return {
        time: l.time,
        close: l.close,
        cw: L.callWall,
        pw: L.putWall,
        flip: L.flip,
        sup: L.supreme,
        verdict: document.querySelector('[data-read-verdict]')?.textContent ?? null,
        rows: { cw: row(L.callWall), pw: row(L.putWall), sup: row(L.supreme) },
        readline: box(document.querySelector('[data-ladder-readline]')),
        chart,
        cards: [...document.querySelectorAll('[data-compass-card]')].slice(0, 3).map(e => ({ text: e.innerText.replace(/\s+/g, ' ').slice(0, 120), box: box(e) })),
      };
    });
  const dir = resolve(tmpdir(), `slayer-session-${theme}-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await ctx.newCDPSession(page);
  await hold(0);
  const rows = [];
  for (let i = 0; i <= STEPS; i++) {
    if (i > 0) {
      await ctx.clock.runFor(STEP);
      await hold(STEP);
    }
    await page.waitForTimeout(80);
    rows.push({ step: i, ...(await read()) });
    if (READ) {
      const r = rows[i];
      console.log(`${String(i).padStart(3)} ${et(r.time)} ${r.close} cw ${r.cw} pw ${r.pw} flip ${r.flip} sup ${r.sup} · ${r.verdict ?? ''} | ${r.cards.map(c => c.text.slice(0, 30)).join(' || ')}`);
      continue;
    }
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: DPR } });
    writeFileSync(resolve(dir, `f${String(i).padStart(3, '0')}.png`), Buffer.from(shot.data, 'base64'));
    /* a beat's focus, cut at three times its size */
    const k = BEATS.findIndex(b => b.step === i);
    if (k >= 0) {
      const [x, y, w, h] = focusOf(BEATS[k], rows[i]);
      const near = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x, y, width: w, height: h, scale: FOCUS_SCALE } });
      writeFileSync(resolve(dir, `focus-${k + 1}.png`), Buffer.from(near.data, 'base64'));
    }
  }
  await ctx.close();
  return { rows, dir };
};

const webp = (from, to, width, quality) =>
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', from, ...(width ? ['-vf', `scale=${width}:-2:flags=lanczos`] : []), '-c:v', 'libwebp', '-quality', String(quality), '-compression_level', '6', to]);

/* Chrome where it is installed; else the Chromium Playwright brings (PW_CHROMIUM names another) */
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}));
const runs = {};
for (const theme of READ ? ['dark'] : ['dark', 'light']) runs[theme] = await take(browser, theme);
await browser.close();

if (!READ) {
  const { rows } = runs.dark;
  /* the two themes are one run, or the beats' words would be true of one of them only */
  const same = runs.light.rows.every((r, i) => r.close === rows[i].close && r.cw === rows[i].cw && r.pw === rows[i].pw);
  if (!same) throw new Error('the dark and light runs differ — nothing written');
  for (const theme of ['dark', 'light']) {
    const out = resolve(process.cwd(), 'public/landing/session', theme);
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    const { dir } = runs[theme];
    for (let i = 0; i <= STEPS; i++) webp(resolve(dir, `f${String(i).padStart(3, '0')}.png`), resolve(out, `f${String(i).padStart(3, '0')}.webp`), 1152, 58);
    BEATS.forEach((b, k) => webp(resolve(dir, `f${String(b.step).padStart(3, '0')}.png`), resolve(out, `beat-${k + 1}.webp`), 0, 80));
    BEATS.forEach((b, k) => webp(resolve(dir, `focus-${k + 1}.png`), resolve(out, `beat-${k + 1}-focus.webp`), 0, 82));
    rmSync(dir, { recursive: true, force: true });
  }
  const session = {
    w: W,
    h: H,
    frames: rows.length,
    times: rows.map(r => et(r.time)),
    beats: BEATS.map((b, k) => {
      const r = rows[b.step];
      const was = rows[BEATS[Math.max(0, k - 1)].step];
      return {
        step: b.step,
        boxes: b.mark(r),
        time: et(r.time),
        focus: focusOf(b, r),
        ...(b.level ? { level: b.level(r), call: b.call(r, was) } : {}),
      };
    }),
    readings: BEATS.map(b => {
      const r = rows[b.step];
      return { step: b.step, close: r.close, callWall: r.cw, putWall: r.pw, flip: r.flip, supreme: r.sup, verdict: r.verdict, top: r.cards[0]?.text.slice(0, 60) ?? null };
    }),
  };
  writeFileSync(resolve(process.cwd(), 'src/pages/landing/session.json'), JSON.stringify(session, null, 1) + '\n');
  console.log(`${rows.length} steps · ${BEATS.length} beats · ${session.beats.map(b => b.time).join(', ')}`);
}
