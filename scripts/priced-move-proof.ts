/*
  Acceptance test for the priced move (data/feed/pricedMove.ts, server/pricedMove.ts — the owner's item 4, 2026-10-13):
  (i)   the remaining 1σ goes to 0 at the close; it is straddle ÷ 0.798 when spot sits on a strike
  (ii)  the day's budget reads the session before alone — no call names day D — and takes the 4:00 pm straddle in
        order: the recorder's last read before 4:00 pm, else the legs' traded price in the 3:59 pm minute, else the
        dated chain's closing quotes
  and the engine: the profile sums to one and follows the minutes' variance, the cone ends at z × the remaining 1σ,
  the readout is the owner's sentence, the calibration of simulated normal days lands on theory.
*/
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { calibrate, calibrationLines, coneOf, EAM, profileOf, readoutOf, readoutWords, SESSION_MINUTES, shareBetween, type CalibrationDay, type MoveBar } from '../src/data/feed/pricedMove';
import { sigmaOf, straddleVol, UW_VOL_CONVENTION, type StraddleRead } from '../src/data/feed/trailModel';
import { blackScholesPrice } from '../src/core/greeks';
import { nyMinuteOf, rng } from '../src/data/feed/trackRecord';
import { createPricedMove } from '../server/pricedMove';
import { createFieldBackfill } from '../server/fieldBackfill';
import type { FeedClient } from '../server/feed';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (ok) pass++;
  else fail++;
};
const straddle = (S: number, K: number, tau: number, iv: number) =>
  blackScholesPrice(S, K, tau, iv, 'C', UW_VOL_CONVENTION.r, UW_VOL_CONVENTION.q) + blackScholesPrice(S, K, tau, iv, 'P', UW_VOL_CONVENTION.r, UW_VOL_CONVENTION.q);

/* (i) */
{
  const S = 600;
  const iv = 0.15;
  const day = 1 / 365;
  const at = (tau: number, K = 600): StraddleRead => {
    const v = straddle(S, K, tau, iv);
    return { expiry: 'x', strike: K, value: v, src: 'model', call: iv, put: iv, iv: straddleVol(S, K, tau, v), tau, spot: S };
  };
  const full = sigmaOf(at(day))!;
  check(`on the strike the priced 1σ is the straddle ÷ 0.798: ${full.toFixed(3)} against ${(at(day).value / EAM).toFixed(3)}`, Math.abs(full / (at(day).value / EAM) - 1) < 0.01);
  const off = sigmaOf(at(day, 600.5))!;
  check(`half a strike away it still reads the money's 1σ (${off.toFixed(3)}), where the straddle ÷ 0.798 reads ${(at(day, 600.5).value / EAM).toFixed(3)}`, Math.abs(off / full - 1) < 0.02);
  const series = [390, 60, 10, 1, 0.1].map(mins => sigmaOf(at(mins / (365 * 24 * 60), 600.5))!);
  check(`the remaining 1σ falls to 0 into the close: ${series.map(x => x.toFixed(3)).join(' → ')} → ${sigmaOf({ ...at(day), tau: 0 })}`, series.every((x, i) => i === 0 || x < series[i - 1]) && series[series.length - 1] < 0.05 && sigmaOf({ ...at(day), tau: 0 }) === 0);
}

/* the profile, the cone, the readout */
{
  const t0 = Date.UTC(2026, 0, 6, 14, 30) / 1000;
  const sessions: MoveBar[][] = [];
  const draw = rng(5);
  for (let d = 0; d < 20; d++) {
    const bars: MoveBar[] = [];
    let p = 100;
    for (let i = 0; i < SESSION_MINUTES; i++) {
      /* the first and last half hour twice as wide a minute */
      const wide = i < 30 || i >= 360 ? Math.SQRT2 : 1;
      const open = p;
      p = p * Math.exp((draw() < 0.5 ? -1 : 1) * 0.0005 * wide);
      bars.push({ time: t0 + d * 86400 + i * 60, open, high: Math.max(open, p), low: Math.min(open, p), close: p });
    }
    sessions.push(bars);
  }
  const prof = profileOf(sessions, nyMinuteOf);
  const sum = prof.share.reduce((a, b) => a + b, 0);
  const edge = shareBetween(prof.share, 0, 30) / 30;
  const mid = shareBetween(prof.share, 30, 360) / 330;
  check(`the profile sums to one (${sum.toFixed(6)}) over ${prof.sessions} sessions, and a minute twice the variance takes twice the share (${(edge / mid).toFixed(2)}×)`, Math.abs(sum - 1) < 1e-9 && prof.sessions === 20 && Math.abs(edge / mid - 2) < 0.05);
  const cone = coneOf(4, 200, prof.share, 5);
  const end = cone[cone.length - 1];
  check(`the cone ends at the close (${end.minutesAhead} minutes on) with half-widths z × the remaining 1σ: ${end.half.map(h => h.toFixed(2)).join(', ')}`, end.minutesAhead === 190 && Math.abs(end.half[1] - 4) < 1e-9 && Math.abs(end.half[0] - 0.6745 * 4) < 1e-9 && Math.abs(end.half[2] - 1.96 * 4) < 1e-9 && cone.every((p, i) => i === 0 || p.half[1] >= cone[i - 1].half[1]));
  check('after the close there is no cone', coneOf(4, SESSION_MINUTES, prof.share).length === 0);
  const flat = Array.from({ length: SESSION_MINUTES }, () => 1 / SESSION_MINUTES);
  const r = readoutOf(103, 100, 5, Math.round(0.41 * SESSION_MINUTES), flat)!;
  check(`the readout: "${readoutWords(r)}"`, readoutWords(r) === "+0.6σ · 41% of the day's variance used · pace 1.5×");
  const still = readoutOf(99.98, 100, 5, SESSION_MINUTES, flat)!;
  check(`a move that rounds to nothing wears no sign: "${readoutWords(still)}"`, readoutWords(still).startsWith('0.0σ ·'));
}

/* the calibration against theory on simulated normal days */
{
  const draw = rng(9);
  const normal = () => {
    const u = Math.max(1e-12, draw());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * draw());
  };
  const days: CalibrationDay[] = [];
  for (let d = 0; d < 20000; d++) {
    /* a driftless walk of 390 steps whose close is N(0, 1σ) */
    let p = 0;
    let hi = 0;
    let lo = 0;
    for (let i = 0; i < 390; i++) {
      p += normal() / Math.sqrt(390);
      hi = Math.max(hi, p);
      lo = Math.min(lo, p);
    }
    days.push({ day: `d${d}`, prevClose: 100, sigmaDay: 1, close: 100 + p, high: 100 + hi, low: 100 + lo, at10: null });
  }
  const c = calibrate(days);
  const lines = calibrationLines(c);
  check(`20,000 simulated days close inside ±1σ / ±2σ at ${(c.closeInside.budget[0].rate! * 100).toFixed(1)}% / ${(c.closeInside.budget[1].rate! * 100).toFixed(1)}% (theory 68.3% / 95.4%)`, Math.abs(c.closeInside.budget[0].rate! - 0.6827) < 0.01 && Math.abs(c.closeInside.budget[1].rate! - 0.9545) < 0.005);
  check(`touch ±1σ / ±2σ at ${(c.touch[0].rate! * 100).toFixed(1)}% / ${(c.touch[1].rate! * 100).toFixed(1)}% — about twice the finish outside (63.5% / 9.1%, a little under on a discrete walk)`, c.touch[0].rate! > 0.55 && c.touch[0].rate! < 0.66 && c.touch[1].rate! > 0.07 && c.touch[1].rate! < 0.1);
  check(`the median |close − prior close| ÷ σ is ${c.medianRatio.value!.toFixed(3)} (theory 0.674); not provisional over 60 sessions`, Math.abs(c.medianRatio.value! - 0.6745) < 0.02 && !c.provisional);
  check('a dozen sessions are provisional, and the lines say so', calibrate(days.slice(0, 12)).provisional && calibrationLines(calibrate(days.slice(0, 12)))[0].includes('provisional'));
  void lines;
  /* the plan's (iii): Wednesdays alone, judged against 60–80% from 30 sessions — dates walk the calendar from a
     Monday, the 10:00 am straddle on the same walk */
  const dated: CalibrationDay[] = days.slice(0, 700).map((d, i) => {
    const iso = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
    return { ...d, day: iso, at10: { spot: d.prevClose, sigma: 1, src: 'nbbo' } };
  });
  const w = calibrate(dated).wednesdays;
  const wLine = calibrationLines(calibrate(dated)).at(-1)!;
  check(`Wednesdays only: ${w.n} of 700 dated days, ${(w.rate! * 100).toFixed(1)}% inside ±1σ, the line judges it ("${wLine.replace(/^.*\(/, '(')}")`, w.n === 100 && w.rate! > 0.55 && w.rate! < 0.8 && /a published study of 193: 71%/.test(wLine) && /inside 60–80%|outside 60–80%/.test(wLine));
  const few = calibrationLines(calibrate(dated.slice(0, 40))).at(-1)!;
  check('under 30 Wednesdays the line gives the rate and does not judge it', /judged against 60–80% from 30 sessions/.test(few));
}

/* (ii) the budget reads the session before alone, the 4:00 pm straddle first */
{
  const D = '2026-10-14';
  const PREV = '2026-10-13';
  const asked: string[] = [];
  const occ = (exp: string, right: 'C' | 'P', k: number) => `SPY${exp.slice(2).replace(/-/g, '')}${right}${String(k * 1000).padStart(8, '0')}`;
  const chainRows = [D, '2026-10-16'].flatMap(exp =>
    [599, 600, 601].flatMap(k => (['C', 'P'] as const).map(right => ({ option_symbol: occ(exp, right, k), expires: exp, strike: String(k), option_type: right === 'C' ? 'call' : 'put', open_interest: 10, implied_volatility: '0.15', nbbo_bid: right === 'C' ? '1.90' : '1.80', nbbo_ask: right === 'C' ? '2.00' : '1.90', volume: 5 })))
  );
  const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }), from: 'upstream' as const });
  const makeClient = (trades: boolean) =>
    ({
      hasKey: () => true,
      get: async (_p: string, path: string) => {
        asked.push(path);
        if (path.includes('/option-chains?date=')) return ok(path.includes(`date=${PREV}`) && path.includes('page=0') ? chainRows : []);
        if (path.includes('/ohlc/1d')) return ok([{ date: PREV, market_time: 'r', close: '600.10' }, { date: PREV, market_time: 'po', close: '599.00' }]);
        if (path.includes('/intraday?date=')) return ok(trades ? [{ start_time: `${PREV}T19:58:00Z`, avg_price: '2.2' }, { start_time: `${PREV}T19:59:00Z`, avg_price: path.includes('C006') ? '2.10' : '2.00' }, { start_time: `${PREV}T20:10:00Z`, avg_price: '9.99' }] : []);
        if (path.includes('/term-structure?date=')) return ok([{ expiry: D, implied_move: String(0.85 * 4.1) }]);
        if (path.includes('/interpolated-iv?date=')) return ok([{ days: 1, implied_move_perc: '0.005' }]);
        return { status: 404, contentType: 'application/json', body: '{}', from: 'upstream' as const };
      },
    }) as unknown as FeedClient;
  const root = mkdtempSync(join(tmpdir(), 'slayer-move-'));
  try {
    const c1 = makeClient(true);
    const m1 = createPricedMove(c1, createFieldBackfill(c1, { root }), { root });
    const b1 = (await m1.budget('SPY', D))!;
    const dated = asked.filter(p => /date=/.test(p));
    check(`every dated call names the session before (${PREV}), never ${D}: ${dated.length} calls`, dated.length > 0 && dated.every(p => !p.includes(`date=${D}`)) && dated.filter(p => !p.includes('/ohlc/1d')).every(p => p.includes(`date=${PREV}`)));
    check(`the prior close is the official close (600.10, not the after-hours 599.00) and the 4:00 pm straddle is the legs' 3:59 pm trades: ${b1.today?.read.value.toFixed(2)} (${b1.today?.from})`, b1.prevClose === 600.1 && b1.closeFrom === 'daily-bar' && b1.today?.from === 'trades-4pm' && Math.abs(b1.today.read.value - 4.1) < 1e-9 && b1.today.read.strike === 600);
    check(`the cross-check sets it against UW's implied move ÷ 0.85: ${b1.cross?.uwStraddle?.toFixed(2)} (${((b1.cross?.diff ?? NaN) * 100).toFixed(1)}%)`, Math.abs((b1.cross?.uwStraddle ?? 0) - 4.1) < 1e-9 && Math.abs(b1.cross?.diff ?? 1) < 1e-9);
    /* the session's official close: nothing before 4:00 pm New York is over, the daily bar's after, kept */
    const early = await createPricedMove(c1, createFieldBackfill(c1, { root }), { root, now: () => Date.UTC(2026, 9, 13, 19, 30) }).officialClose('SPY', PREV);
    const late = await createPricedMove(c1, createFieldBackfill(c1, { root }), { root, now: () => Date.UTC(2026, 9, 13, 22, 0) }).officialClose('SPY', PREV);
    const nCalls = asked.length;
    const kept = await createPricedMove(c1, createFieldBackfill(c1, { root }), { root, now: () => Date.UTC(2026, 9, 14, 3, 0) }).officialClose('SPY', PREV);
    check(`the official close: none while the session runs, the daily bar's after (${late?.close}, not the after-hours 599.00), kept`, early === null && late?.close === 600.1 && late.from === 'daily-bar' && kept?.close === 600.1 && asked.length === nCalls);
    /* no trades: the closing quotes, said so */
    const root2 = mkdtempSync(join(tmpdir(), 'slayer-move-'));
    const c2 = makeClient(false);
    const b2 = (await createPricedMove(c2, createFieldBackfill(c2, { root: root2 }), { root: root2 }).budget('SPY', D))!;
    check(`with no 3:59 pm trades the dated chain's closing quotes stand, said so: ${b2.today?.read.value.toFixed(2)} (${b2.today?.from})`, b2.today?.from === 'closing-quotes' && Math.abs(b2.today.read.value - 3.8) < 1e-9);
    /* a recorder's read at 3:55 pm wins */
    const root3 = mkdtempSync(join(tmpdir(), 'slayer-move-'));
    mkdirSync(join(root3, 'SPY', PREV), { recursive: true });
    const read355 = { receivedAt: Date.UTC(2026, 9, 13, 19, 55), rows: chainRows.filter(r => r.expires === D).map(r => [r.option_symbol, 10, 0.15, null, r.option_type === 'call' ? 2.2 : 2.0, r.option_type === 'call' ? 2.3 : 2.1, 5]) };
    const read405 = { receivedAt: Date.UTC(2026, 9, 13, 20, 5), rows: read355.rows.map(r => [r[0], 10, 0.15, null, 9, 9.1, 5]) };
    writeFileSync(join(root3, 'SPY', PREV, 'chain.jsonl'), `${JSON.stringify(read355)}\n${JSON.stringify(read405)}\n`);
    const c3 = makeClient(true);
    const b3 = (await createPricedMove(c3, createFieldBackfill(c3, { root: root3 }), { root: root3 }).budget('SPY', D))!;
    check(`the recorder's last read before 4:00 pm wins (its 3:55 pm NBBO mids, ${b3.today?.read.value.toFixed(2)}), the 4:05 pm read never`, b3.today?.from === 'live-read' && Math.abs(b3.today.read.value - 4.3) < 1e-9);
    rmSync(root2, { recursive: true, force: true });
    rmSync(root3, { recursive: true, force: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
