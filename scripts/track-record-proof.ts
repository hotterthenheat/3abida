/*
  Acceptance test for the track record (data/feed/trackRecord.ts, 2026-10-13 — the owner's item 2):
  (i)   on a synthetic random walk with arbitrary levels, the real levels show no edge over the random baseline — the
        bootstrap's interval covers zero
  (ii)  a planted level that turns the price back 70% of the time is recovered at about 70%
  (iii) a rerun is byte-identical
  (iv)  a cell with fewer touches or months than the config asks says "insufficient data" and carries no rate
  and the rules under them: a level counts only once it has stood a minute, a touch is counted once an approach, the
  strike-matched baseline is never a real level.
*/
import { readFileSync } from 'node:fs';
import { recordLine, rng, touchesOf, trackRecord, type TrackBar, type TrackConfig, type TrackRow, type TrackSession } from '../src/data/feed/trackRecord';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (ok) pass++;
  else fail++;
};
const cfg = JSON.parse(readFileSync('server/scorecard.config.json', 'utf8')) as TrackConfig;
const quick: TrackConfig = { ...cfg, bootstrap: { ...cfg.bootstrap, reps: 300 } };

/* ---- a synthetic day: a random walk, a column a minute on a $1 grid, arbitrary levels ------------------------------ */
const OPEN_NY = Date.UTC(2026, 0, 5, 14, 30); // 9:30 am New York in January (UTC−5)
const dayStart = (i: number) => {
  const d = new Date(OPEN_NY + i * 864e5);
  /* weekdays only */
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);

interface Plant {
  level: number;
  bounce: number;
  /** The generator's own count of touches and bounces, to set against the engine's */
  seen: { touches: number; bounces: number };
}
function synthDay(idx: number, draw: () => number, plant: Plant | null, startPrice: number, levelChurn = false): TrackSession {
  const t0 = dayStart(idx);
  const bars: TrackBar[] = [];
  const rows: TrackRow[] = [];
  let price = startPrice;
  let forced: { until: number; dir: 1 | -1 } | null = null;
  let touching = false;
  const dayBase = Math.round(startPrice);
  const dayValues = new Map<number, number>();
  for (let k = dayBase - 40; k <= dayBase + 40; k++) dayValues.set(k, (draw() - 0.5) * 2e9 * Math.exp(-Math.abs(k - startPrice) / 12));
  for (let i = 0; i < 390; i++) {
    const open = price;
    let hi = open;
    let lo = open;
    let p = open;
    for (let k = 0; k < 4; k++) {
      const noise = (draw() - 0.5) * 0.0006 * p;
      const push = forced && i <= forced.until ? forced.dir * 0.00015 * p : 0;
      /* a planted day pulls the price back toward its open once the push is over, so the level is met again */
      const pull = plant && !(forced && i <= forced.until) ? -0.0004 * (p - startPrice) : 0;
      p += noise + push + pull;
      hi = Math.max(hi, p);
      lo = Math.min(lo, p);
    }
    const close = p;
    bars.push({ time: (t0.getTime() + i * 60_000) / 1000, open, high: hi, low: lo, close });
    /* the planted level: when a bar touches it fresh, the next fifteen bars are pushed back 70% of the time */
    if (plant && i > 0) {
      const tol = cfg.tol.default;
      const touched = lo <= plant.level * (1 + tol) && hi >= plant.level * (1 - tol);
      if (touched && !touching && bars[i - 1].close !== plant.level) {
        const side = bars[i - 1].close > plant.level ? 1 : -1;
        /* seven of every ten touches turn back — by count, not by chance, so the rate is 70% by construction */
        const back = plant.seen.touches % 10 < 7;
        plant.seen.touches++;
        if (back) plant.seen.bounces++;
        forced = { until: i + 16, dir: (back ? side : -side) as 1 | -1 };
      }
      touching = touched;
    }
    price = close;
    /* the column: a $1 grid thirty strikes each side, values arbitrary, the levels arbitrary (or planted) */
    const base = Math.round(close);
    const cells: [number, number][] = [];
    for (let k = base - 30; k <= base + 30; k++) cells.push([k, (dayValues.get(k) ?? (draw() - 0.5) * 2e8) * (1 + (draw() - 0.5) * 0.02)]);
    /* the levels stand near the price (one to four strikes), so the walk reaches them often enough to count */
    const above = cells.filter(c => c[0] > close && c[0] <= close + 4).map(c => c[0]);
    const below = cells.filter(c => c[0] < close && c[0] >= close - 4).map(c => c[0]);
    const pick = (arr: number[]) => arr[Math.floor(draw() * arr.length)];
    const cw = plant ? plant.level : levelChurn ? close + 1 + (i % 2) : rows.length && draw() > 0.02 ? rows[rows.length - 1].cw : pick(above);
    const pw = rows.length && draw() > 0.02 && !levelChurn ? rows[rows.length - 1].pw : pick(below);
    const flip = rows.length && draw() > 0.05 ? rows[rows.length - 1].flip : close + (draw() - 0.5) * 4;
    const top: [number, number][] = [...cells].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5).map(c => [c[0], c[1]]);
    rows.push({ m: bars[i].time * 1000, spot: close, flip, cw, pw, top, net: (draw() - 0.5) * 4e9, cells, str0: { value: 0.004 * close } });
  }
  return { day: iso(t0), rows, bars, prevClose: startPrice * (1 + (draw() - 0.5) * 0.01) };
}

const DAYS = 400;
const draw = rng(7);
const sessions: TrackSession[] = [];
let price = 600;
for (let i = 0; i < DAYS; i++) {
  const s = synthDay(i, draw, null, price);
  sessions.push(s);
  price = s.bars[s.bars.length - 1].close;
}
const t0 = Date.now();
const rec = trackRecord(sessions, quick);
console.log(`record over ${rec.sessions} sessions (${rec.months} months), ${rec.touches} real touches, ${rec.variantsTried} variants, in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const cell = (kind: string, split = 'all', h = 15) => rec.cells.find(c => c.kind === kind && c.split === split && c.horizon === h && c.tol === cfg.tol.default)!;

/* (i) no edge on arbitrary levels */
for (const kind of ['call wall', 'put wall', 'flip', 'top strike'] as const) {
  const c = cell(kind);
  const covers = c.ci != null && c.ci[0] <= 0 && c.ci[1] >= 0;
  const nearRandom = Math.abs(c.real.rate - c.B1.rate) < 0.06;
  check(`arbitrary ${kind}s show no edge: real ${(c.real.rate * 100).toFixed(1)}% vs random ${(c.B1.rate * 100).toFixed(1)}% vs strike-matched ${(c.B2.rate * 100).toFixed(1)}%, diff ${c.diff != null ? (c.diff * 100).toFixed(1) : '—'} pts, CI ${c.ci ? `${(c.ci[0] * 100).toFixed(1)} to ${(c.ci[1] * 100).toFixed(1)}` : '—'} (${c.real.n} touches)`, c.real.n > 500 && covers && nearRandom);
}

/* (ii) a planted level recovered */
const draw2 = rng(11);
const planted: TrackSession[] = [];
const seen = { touches: 0, bounces: 0 };
price = 600;
for (let i = 0; i < 160; i++) {
  const level = Math.ceil(price + 0.5);
  const s = synthDay(i, draw2, { level, bounce: 0.7, seen }, price);
  planted.push(s);
  price = s.bars[s.bars.length - 1].close;
}
const rec2 = trackRecord(planted, quick);
const pc = rec2.cells.find(c => c.kind === 'call wall' && c.split === 'all' && c.horizon === 15 && c.tol === cfg.tol.default)!;
const realPlanted = rec2.cells.find(c => c.kind === 'call wall' && c.split === 'all' && c.horizon === 15 && c.tol === cfg.tol.default)!;
console.log(`planted: the generator counted ${seen.touches} touches (${seen.bounces} turned back); the engine ${realPlanted.real.n} with a bounce read, rate ${(realPlanted.real.rate * 100).toFixed(1)}%`);
check(`a level planted to turn the price back 70% of the time reads ${(pc.real.rate * 100).toFixed(1)}% on ${pc.real.n} touches (random ${(pc.B1.rate * 100).toFixed(1)}%)`, pc.real.n > 100 && Math.abs(pc.real.rate - 0.7) < 0.05 && pc.real.rate - pc.B1.rate > 0.1);
check('the engine finds the touches the generator planted, within the ones the session\u2019s end cut off', Math.abs(seen.touches - pc.real.n) <= planted.length);
check('and its interval against the strike-matched baseline sits above zero', pc.ci != null && pc.ci[0] > 0);

/* (iii) byte-identical */
const again = trackRecord(sessions, quick);
check('a rerun is byte-identical', JSON.stringify(again) === JSON.stringify(rec));

/* (iv) insufficient data */
const few = trackRecord(sessions.slice(0, 12), quick);
const fc = few.cells.find(c => c.kind === 'call wall' && c.split === 'all' && c.horizon === 15 && c.tol === cfg.tol.default)!;
check(`twelve sessions: "insufficient data (${fc.insufficient?.touches} touches, ${fc.insufficient?.months} month)", no rate printed`, fc.insufficient != null && recordLine(fc).includes('insufficient data') && !recordLine(fc).includes('%'));
check('a full cell prints the owner’s line: touched N times, the rate against strike-matched, the difference with its interval, the months', /touched \d+ times · on the approach side after 15 min \d+% vs \d+% strike-matched · diff [+−][\d.]+ pts \(95% CI/.test(recordLine(cell('put wall'))) && /\d+\/\d+ months/.test(recordLine(cell('put wall'))));

/* the rules */
const churn = synthDay(0, rng(3), null, 600, true);
const churnTouches = touchesOf(churn, quick, cfg.tol.default, null, null);
check('a level that changes every minute never counts (it must have stood a minute before the bar)', !churnTouches.some(t => t.kind === 'call wall' && t.base === 'real'));
const one = [5, 6, 7, 8, 9, 10].flatMap(i => touchesOf(sessions[i], quick, cfg.tol.default, 3, null));
const rowsAt = new Map([5, 6, 7, 8, 9, 10].flatMap(i => sessions[i].rows.map(r => [r.m, r] as [number, TrackRow])));
const realCw = one.filter(t => t.base === 'real' && t.kind === 'call wall');
check('a touch is counted once an approach, numbered within the session', realCw.every(t => t.nth >= 1 && t.nth <= 3) && realCw.length < (6 * sessions[5].bars.length) / 4);
const b2 = one.filter(t => t.base === 'B2');
const bad = b2.find(t => { const row = rowsAt.get(t.m - 60_000); return !row || !Number.isInteger(t.level) || t.level === row.cw || t.level === row.pw; });
if (bad) console.log('  a strike-matched touch off the rule:', JSON.stringify({ level: bad.level, id: bad.id, row: rowsAt.get(bad.m - 60_000) ? { cw: rowsAt.get(bad.m - 60_000)!.cw, pw: rowsAt.get(bad.m - 60_000)!.pw } : null }));
check('a strike-matched level is a listed strike and never the real level of its minute', b2.length > 0 && !bad);
check('random levels stand from the open and are drawn within the band', one.filter(t => t.base === 'B1').every(t => sessions.slice(5, 11).some(s => s.day === t.day && Math.abs(t.level - s.bars[0].open) <= 3)));
check('the regime tests run: ranges by tercile over 30 and 60 minutes, the last half hour by sign', rec.regime.ranges.length === 2 && rec.regime.ranges[0].terciles.every(t => t.n > 0) && rec.regime.lastHalfHour.some(l => l.source === 'house' && l.n > 10));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
