/*
  Acceptance test for the session recap (data/feed/sessionRecap.ts, server/recap.ts — the owner's item 9, 2026-10-14):
  "Acceptance: the recap's numbers equal the item-2 and item-4 rows for that session."
  - the rules on built sessions: the flip crossings (the level alerts' side rule, every crossing), the wall moves (the
    field's chips' rule), the regime path's percentiles, the version keys;
  - the levels touched ARE the track record's rows: for every session, the recap's touches equal the scorecard's own
    rows for that session (trackRecord sessionTouches, the real levels', every field but the tercile) and its
    strike-matched counts equal the baseline's;
  - the close against ±σ IS the priced move's row: the verdict the calibration counts (pricedMove dayVerdict);
  - on this machine's sessions, through the server's own build (a copy of each session's files, no network): every
    recap's touches against the scorecard's rows over the same session list, and its move against the row
    move-calibration.json holds for the day;
  - the times: a session is over at 4:05 pm New York (no recap before), the official close is read from 4:01 pm and
    kept from 4:30 pm, a session's minute bars are kept only once it has closed.
*/
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nyWallTime } from '../src/core/nyTime';
import { calibrate, dayVerdict, type CalibrationDay } from '../src/data/feed/pricedMove';
import { buildRecap, flipCrossesOf, recapTouchesOf, recapWallsOf, regimePathOf, stripRegime, type RecapInput } from '../src/data/feed/sessionRecap';
import { LEVEL_KINDS, nyMinuteOf, rng, sessionTouches, type TrackBar, type TrackConfig, type TrackRow, type TrackSession } from '../src/data/feed/trackRecord';
import { buildRegimeReference, regimeBucketOf, regimeBucketsFor, regimePercentile, regimeQuantiles, regimeReachFor, wallMovesOf } from '../src/data/feed/trailModel';
import { createFieldBackfill } from '../server/fieldBackfill';
import { createFieldStore } from '../server/fieldStore';
import { createPricedMove } from '../server/pricedMove';
import { createRecap } from '../server/recap';
import { isLoaded, loadSession } from '../server/scorecard';
import type { FeedClient } from '../server/feed';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (ok) pass++;
  else fail++;
};
const cfg = JSON.parse(readFileSync('server/scorecard.config.json', 'utf8')) as TrackConfig;

/* ---- built sessions: a walk, a column a minute on a $1 grid, walls that stand and move -------------------------------- */
const OPEN = Date.UTC(2026, 0, 5, 14, 30); // 9:30 am New York in January
function built(idx: number, draw: () => number, start: number): TrackSession {
  const t0 = OPEN + idx * 864e5;
  const bars: TrackBar[] = [];
  const rows: TrackRow[] = [];
  let p = start;
  let cw = Math.round(start) + 3;
  let pw = Math.round(start) - 3;
  const base = new Map<number, number>();
  for (let k = Math.round(start) - 40; k <= Math.round(start) + 40; k++) base.set(k, (draw() - 0.5) * 2e9 * Math.exp(-Math.abs(k - start) / 10));
  for (let i = 0; i < 390; i++) {
    const open = p;
    let hi = open;
    let lo = open;
    for (let k = 0; k < 4; k++) {
      p += (draw() - 0.5) * 0.0006 * p;
      hi = Math.max(hi, p);
      lo = Math.min(lo, p);
    }
    bars.push({ time: (t0 + i * 60_000) / 1000, open, high: hi, low: lo, close: p });
    if (draw() < 0.03) cw = Math.round(p) + 1 + Math.floor(draw() * 4);
    if (draw() < 0.03) pw = Math.round(p) - 1 - Math.floor(draw() * 4);
    const mid = Math.round(p);
    const cells: [number, number][] = [];
    for (let k = mid - 30; k <= mid + 30; k++) cells.push([k, (base.get(k) ?? (draw() - 0.5) * 1e8) * (1 + (draw() - 0.5) * 0.04)]);
    const top = [...cells].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5);
    const flip = draw() < 0.1 ? null : p + (draw() - 0.5) * 1.5;
    rows.push({ m: bars[i].time * 1000, spot: p, flip, cw, pw, top, net: (draw() - 0.45) * 4e9, cells, str0: { value: 0.004 * p } });
  }
  return { day: new Date(t0).toISOString().slice(0, 10), rows, bars, prevClose: start };
}
const draw = rng(91);
const sessions: TrackSession[] = [];
let price = 600;
for (let i = 0; i < 30; i++) {
  const s = built(i, draw, price);
  sessions.push(s);
  price = s.bars[s.bars.length - 1].close;
}

/* THE FLIP: the level alerts' side rule at one confirmation minute — every crossing, the side carried over a minute with
   no flip, a close on the flip deciding nothing */
{
  const at = (i: number, spot: number, flip: number | null) => ({ m: i * 60_000, spot, flip });
  const rows = [at(0, 101, 100), at(1, 101, 100), at(2, 99, 100), at(3, 99, 100), at(4, 101, null), at(5, 101, 100), at(6, 100, 100), at(7, 99, 100), at(8, 99.5, 99.4)];
  const x = flipCrossesOf(rows);
  check(`flip crossings: down at 2, up at 5 (across a minute with no flip), a close on the flip deciding nothing, down at 7, up at 8 — ${x.map(c => `${c.m / 60_000}${c.dir === 'up' ? '↑' : '↓'}`).join(' ')}`, JSON.stringify(x.map(c => [c.m / 60_000, c.dir])) === JSON.stringify([[2, 'down'], [5, 'up'], [7, 'down'], [8, 'up']]) && x.every(c => rows.find(r => r.m === c.m)!.flip === c.flip));
  /* against a plain count on the built sessions: each crossing's flip is its own row's */
  let ok = true;
  for (const s of sessions) {
    const x2 = flipCrossesOf(s.rows);
    let side = 0;
    let n = 0;
    for (const r of s.rows) {
      if (r.flip == null) continue;
      const v = Math.sign(r.spot - r.flip);
      if (!v) continue;
      if (side && v !== side) n++;
      side = v;
    }
    if (x2.length !== n || !x2.every(c => s.rows.find(r => r.m === c.m)?.flip === c.flip)) ok = false;
  }
  check('on thirty built sessions every crossing is counted once, at the row whose flip it crossed', ok);
}

/* THE WALLS: the chips' rule — a new strike counts once it has held three minutes; a moment's swap is no move */
{
  const row = (i: number, cw: number) => ({ m: i * 60_000, cw, pw: 770, cells: [[779, 1], [780, 1], [781, 1], [785, 1]] as [number, number][] });
  const rows = [...Array.from({ length: 10 }, (_, i) => row(i, 780)), row(10, 785), row(11, 785), row(12, 780), row(13, 785), row(14, 785), row(15, 785), row(16, 785)];
  const w = recapWallsOf(rows);
  check(`a wall that went to 785 for two minutes did not move; held three from 13, it moved 780 → 785, five strikes on the column's $1 grid: ${JSON.stringify(w)}`, w.length === 1 && w[0].kind === 'call' && w[0].from === 780 && w[0].to === 785 && w[0].m === 13 * 60_000 && w[0].strikes === 5);
  let same = true;
  for (const s of sessions) {
    const mine = recapWallsOf(s.rows);
    const chips = wallMovesOf(s.rows.length, i => ({ cw: s.rows[i].cw, pw: s.rows[i].pw, time: s.rows[i].m }));
    if (mine.length !== chips.length || !chips.every(c => mine.some(x => x.m === c.time && x.from === c.from && x.to === c.to && (c.kind === 'CW') === (x.kind === 'call')))) same = false;
  }
  check("on thirty built sessions the recap's moves are the field chips' (trailModel wallMovesOf), one for one", same);
}

/* THE LEVELS TOUCHED ARE THE TRACK RECORD'S ROWS */
{
  let rows = 0;
  let sameAll = true;
  let baseSame = true;
  let b2 = 0;
  for (let idx = 0; idx < sessions.length; idx++) {
    const mine = recapTouchesOf(sessions[idx], cfg);
    const record = sessionTouches(sessions, idx, cfg);
    const real = record.filter(t => t.base === 'real').map(stripRegime);
    rows += real.length;
    if (JSON.stringify(mine.touches) !== JSON.stringify(real)) sameAll = false;
    for (const kind of LEVEL_KINDS) {
      const r2 = record.filter(t => t.base === 'B2' && t.kind === kind);
      b2 += r2.length;
      const want = Object.fromEntries(cfg.horizons.map(h => [h, [r2.filter(t => t.bounce[h] === true).length, r2.filter(t => t.bounce[h] != null).length]]));
      if (mine.baseline[kind].n !== r2.length || JSON.stringify(mine.baseline[kind].back) !== JSON.stringify(want)) baseSame = false;
    }
  }
  check(`the recap's touches ARE the track record's rows for each session (every field but the tercile): ${rows} rows over ${sessions.length} sessions`, sameAll && rows > 100);
  check(`its strike-matched counts are the baseline's own, by kind and horizon: ${b2} strike-matched touches`, baseSame && b2 > 0);
}

/* THE CLOSE AGAINST ±σ IS THE PRICED MOVE'S ROW — the verdict the calibration counts */
{
  const d2 = rng(5);
  const days: CalibrationDay[] = Array.from({ length: 400 }, (_, i) => {
    const prev = 600;
    const s = 4;
    const close = prev + (d2() - 0.5) * 20;
    return { day: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, prevClose: prev, sigmaDay: s, close, high: Math.max(close, prev) + d2() * 6, low: Math.min(close, prev) - d2() * 6, at10: d2() < 0.8 ? { spot: prev + (d2() - 0.5) * 4, sigma: 3, src: 'model' } : null };
  });
  const c = calibrate(days);
  const v = days.map(d => dayVerdict(d)!);
  const counts = [v.filter(x => x.inside[0]).length, v.filter(x => x.inside[1]).length, v.filter(x => x.touched[0]).length, v.filter(x => x.touched[1]).length, v.filter(x => x.at10?.inside[0]).length];
  check(`the calibration counts the days' verdicts: inside ±1σ ${counts[0]}, ±2σ ${counts[1]}, touched ±1σ ${counts[2]}, ±2σ ${counts[3]}, from 10:00 am ${counts[4]}`, c.closeInside.budget[0].k === counts[0] && c.closeInside.budget[1].k === counts[1] && c.touch[0].k === counts[2] && c.touch[1].k === counts[3] && c.closeInside.at10[0].k === counts[4]);
  check('the farthest the session went agrees with the touches: |max| ≥ 1 exactly where ±1σ was touched, ≥ 2 where ±2σ was', v.every(x => (Math.abs(x.max) >= 1 - 1e-9) === x.touched[0] && (Math.abs(x.max) >= 2 - 1e-9) === x.touched[1]));
  const s = sessions[3];
  const row: CalibrationDay = { day: s.day, prevClose: s.prevClose!, sigmaDay: 3.2, close: s.bars[s.bars.length - 1].close + 0.07, high: Math.max(...s.bars.map(b => b.high)), low: Math.min(...s.bars.map(b => b.low)), at10: null, closeFrom: 'official' };
  const input: RecapInput = { name: 'TEST', day: s.day, builtAt: 1, session: s, source: 'final', why: null, bars: s.bars, cfg, calib: row, calibFrom: 'trades-4pm', moveWhy: null, quantiles: null, ref: null, minuteOf: nyMinuteOf };
  const r = buildRecap(input);
  const far = r.move!.verdict.max >= 0 ? s.bars.find(b => b.high >= row.high - 1e-9) : s.bars.find(b => b.low <= row.low + 1e-9);
  check(`the recap's close is the row's: close ${r.move!.close.toFixed(2)} (${r.move!.closeFrom}), ${r.move!.verdict.sigmas.toFixed(2)}σ, farthest ${r.move!.verdict.max.toFixed(2)}σ at the bar that set it`, JSON.stringify(r.move!.verdict) === JSON.stringify(dayVerdict(row)) && r.move!.close === row.close && r.move!.prevClose === row.prevClose && r.move!.sigma === row.sigmaDay && r.move!.farthestAt === far!.time * 1000);

  /* THE VERSIONS: a rebuild that changed nothing keeps its version; a figure changed is a new one, a picture's input a new
     chart key */
  const again = buildRecap({ ...input, builtAt: 2 });
  const closer = buildRecap({ ...input, calib: { ...row, close: row.close + 0.01 } });
  const barMoved = buildRecap({ ...input, session: { ...s, bars: s.bars.map((b, i) => (i === 100 ? { ...b, close: b.close + 0.01 } : b)) } });
  check('the version is the figures: built again it stands; a close a cent off is a new version, the same picture; a bar moved is a new picture', again.version === r.version && again.chartKey === r.chartKey && closer.version !== r.version && closer.chartKey === r.chartKey && barMoved.chartKey !== r.chartKey);

  /* THE REGIME PATH: each half-hour's last row, its percentile against the quantiles handed in */
  const qs = Array.from({ length: 13 }, (_, b) => regimeQuantiles(Array.from({ length: 50 }, (_, i) => (i - 25) * 1e8 + b * 1e7)));
  const withQ = buildRecap({ ...input, quantiles: qs, ref: { through: '2026-01-01', sessions: 50 } });
  const ok = withQ.regime.steps.length === 13 && withQ.regime.steps.every(st => {
    const inB = s.rows.filter(rw => regimeBucketOf(nyMinuteOf(rw.m)) === st.b);
    const last = inB[inB.length - 1];
    return last.m === st.m && last.net === st.net && st.pct === regimePercentile(last.net, qs[st.b]!);
  });
  check(`the regime path: thirteen half-hours, each its last minute's net and that net's percentile against the half-hour's own quantiles; none without a reference (${r.regime.steps.every(x => x.pct === null)})`, ok && r.regime.steps.every(x => x.pct === null));
  /* WHAT THE PERCENTILES STAND ON: on the day itself the reference answers with the sessions before it, and says so; a
     reference rewritten through the day (the 4:05 pm scorecard) changes nothing a recap says */
  {
    const D = sessions[20].day;
    const throughBefore = buildRegimeReference('TEST', sessions.slice(0, 20), 250, nyMinuteOf);
    const throughDay = buildRegimeReference('TEST', sessions.slice(0, 21), 250, nyMinuteOf);
    const reachA = regimeReachFor(throughBefore, D);
    const reachB = regimeReachFor(throughDay, D);
    const s20 = sessions[20];
    const make = (ref: ReturnType<typeof buildRegimeReference>) => buildRecap({ ...input, day: D, session: s20, bars: s20.bars, calib: null, moveWhy: 'none', quantiles: regimeBucketsFor(ref, D), ref: regimeReachFor(ref, D) });
    check(`the percentiles' reach is what they read: before the day ${JSON.stringify(reachA)}, through the day ${JSON.stringify(reachB)}, the same 20 sessions through ${sessions[19].day}; a recap built on either keeps its version`, JSON.stringify(reachA) === JSON.stringify({ through: sessions[19].day, sessions: 20 }) && JSON.stringify(reachB) === JSON.stringify(reachA) && make(throughBefore).version === make(throughDay).version && regimeReachFor(throughDay, sessions[5].day) === null);
  }
  check('a session the track record cannot read still has its close, and no touches, walls or crossings', (() => {
    const none = buildRecap({ ...input, session: null, source: null, why: 'no rows' });
    return none.move != null && none.touches.length === 0 && none.walls.length === 0 && none.flips.length === 0 && none.bars.length === s.bars.length && none.why === 'no rows';
  })());
}

/* ---- the server's build on this machine's sessions, against the item-2 and item-4 rows ---------------------------------- */
const deny = () => {
  throw new Error('network');
};
const offline = { get: async () => deny(), hasKey: () => true, redirectOf: deny } as unknown as FeedClient;
{
  const real = join(process.cwd(), '.feed-cache', 'field');
  const names = existsSync(real) ? readdirSync(real).filter(n => /^[A-Z]+$/.test(n) && existsSync(join(real, n, 'move-calibration.json'))) : [];
  if (!names.length) console.log('SKIP  the recaps against the item-2 and item-4 rows on this machine: no sessions here');
  for (const name of names) {
    const tmp = mkdtempSync(join(tmpdir(), 'slayer-recap-'));
    try {
      /* a copy of each session's files: the server's build reads them as it would, and asks no vendor */
      mkdirSync(join(tmp, name), { recursive: true });
      for (const f of ['regime.json']) if (existsSync(join(real, name, f))) copyFileSync(join(real, name, f), join(tmp, name, f));
      const days = readdirSync(join(real, name)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
      for (const d of days) {
        mkdirSync(join(tmp, name, d), { recursive: true });
        for (const f of ['past.json.gz', 'bars.json.gz', 'move.json', 'close.json', 'final.jsonl', 'final.jsonl.gz', 'tape-price.json']) if (existsSync(join(real, name, d, f))) copyFileSync(join(real, name, d, f), join(tmp, name, d, f));
      }
      const backfill = createFieldBackfill(offline, { root: tmp });
      const store = createFieldStore({ root: tmp });
      const move = createPricedMove(offline, backfill, { root: tmp });
      const recap = createRecap(backfill, store, move, { root: tmp, config: cfg });
      /* the scorecard's session list, ascending, by its own loader */
      const loaded: TrackSession[] = [];
      for (const d of days) {
        const got = await loadSession(backfill, store, tmp, name, d, null);
        if (isLoaded(got)) loaded.push(got.session);
      }
      const calib = JSON.parse(readFileSync(join(real, name, 'move-calibration.json'), 'utf8')) as { days: CalibrationDay[] };
      let compared = 0;
      let touchesSame = 0;
      let moveSame = 0;
      let moveRows = 0;
      const lines: string[] = [];
      for (const d of days) {
        const b = await recap.build(name, d, true);
        if (!('recap' in b)) continue;
        const x = b.recap;
        compared++;
        const idx = loaded.findIndex(s => s.day === d);
        const want = idx >= 0 ? sessionTouches(loaded, idx, cfg).filter(t => t.base === 'real').map(stripRegime) : [];
        if (JSON.stringify(x.touches) === JSON.stringify(want)) touchesSame++;
        const row = calib.days.find(r => r.day === d);
        if (row) {
          moveRows++;
          const v = dayVerdict(row);
          if (x.move && x.move.prevClose === row.prevClose && x.move.close === row.close && x.move.high === row.high && x.move.low === row.low && x.move.sigma === row.sigmaDay && JSON.stringify(x.move.at10 ?? null) === JSON.stringify(row.at10 ?? null) && JSON.stringify(x.move.verdict) === JSON.stringify(v)) moveSame++;
        }
        const mv = x.move;
        lines.push(`  ${name} ${d}  ${x.source ?? 'no rows'}  ${x.rows} rows · ${x.flips.length} flip crossings · ${x.walls.length} wall moves · ${x.touches.length} touches${mv ? ` · close ${mv.verdict.sigmas >= 0 ? '+' : ''}${mv.verdict.sigmas.toFixed(2)}σ inside ±1σ ${mv.verdict.inside[0] ? 'yes' : 'no'} · touched ±1σ ${mv.verdict.touched[0] ? 'yes' : 'no'} · farthest ${mv.verdict.max.toFixed(2)}σ` : ` · ${x.moveWhy}`}`);
      }
      for (const l of lines) console.log(l);
      check(`${name}: every recap's touches are the scorecard's rows for its session (${touchesSame} of ${compared})`, compared > 0 && touchesSame === compared);
      check(`${name}: every recap's close against ±σ is move-calibration.json's row for the day (${moveSame} of ${moveRows})`, moveRows > 0 && moveSame === moveRows);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
}

/* ---- the times: over at 4:05 pm, the official close read from 4:01 and kept from 4:30, the bars kept once closed ------ */
{
  const D = '2026-10-13';
  const ok = (rows: unknown[]) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: rows }), from: 'upstream' as const });
  const client = {
    get: async (_p: string, path: string) =>
      path.includes('/ohlc/1d')
        ? ok([{ date: D, market_time: 'r', close: '778.01' }])
        : path.includes('/ohlc/1m')
          ? ok(Array.from({ length: 390 }, (_, i) => ({ start_time: new Date(nyWallTime(2026, 10, 13, 9, 30) + i * 60_000).toISOString(), open: '778', high: '778.5', low: '777.5', close: '778.1', market_time: 'r' })))
          : { status: 404, contentType: 'application/json', body: '{}', from: 'upstream' as const },
    hasKey: () => true,
  } as unknown as FeedClient;
  const tmp = mkdtempSync(join(tmpdir(), 'slayer-recap-t-'));
  try {
    const at = (h: number, m: number) => () => nyWallTime(2026, 10, 13, h, m);
    const read = async (h: number, m: number) => createPricedMove(client, createFieldBackfill(client, { root: tmp }), { root: tmp, now: at(h, m) }).officialClose('SPY', D);
    const before = await read(15, 59);
    const early = await read(16, 10);
    const keptEarly = existsSync(join(tmp, 'SPY', D, 'close.json'));
    const late = await read(16, 40);
    const keptLate = existsSync(join(tmp, 'SPY', D, 'close.json'));
    check(`the official close: none at 3:59 pm, read at 4:10 pm (${early?.close}) and not kept, kept from 4:30 pm (${late?.close})`, before === null && early?.close === 778.01 && !keptEarly && late?.close === 778.01 && keptLate);
    const midday = await createFieldBackfill(client, { root: tmp, now: at(14, 0) }).minutes('SPY', D);
    const keptMid = existsSync(join(tmp, 'SPY', D, 'bars.json.gz'));
    const after = await createFieldBackfill(client, { root: tmp, now: at(16, 10) }).minutes('SPY', D);
    const keptAfter = existsSync(join(tmp, 'SPY', D, 'bars.json.gz'));
    check(`a session's minute bars: handed back at 2:00 pm (${midday?.length}) and not kept, kept at 4:10 pm (${after?.length})`, midday?.length === 390 && !keptMid && after?.length === 390 && keptAfter);
    const open = await createRecap(createFieldBackfill(client, { root: tmp }), createFieldStore({ root: tmp }), createPricedMove(client, createFieldBackfill(client, { root: tmp }), { root: tmp }), { root: tmp, config: cfg, now: at(16, 4) }).build('SPY', D);
    const over = createRecap(createFieldBackfill(client, { root: tmp }), createFieldStore({ root: tmp }), createPricedMove(client, createFieldBackfill(client, { root: tmp }), { root: tmp }), { root: tmp, config: cfg, now: at(16, 5) });
    check('no recap while the session runs: at 4:04 pm "session-open", over at 4:05 pm', 'why' in open && open.why === 'session-open' && over.over(D) && !createRecap(createFieldBackfill(client, { root: tmp }), createFieldStore({ root: tmp }), createPricedMove(client, createFieldBackfill(client, { root: tmp }), { root: tmp }), { root: tmp, config: cfg, now: at(16, 4) }).over(D));
    /* the list names the recorded names alone: a name with store rows, not one Terrain only rebuilt */
    mkdirSync(join(tmp, 'AAPL', D), { recursive: true });
    writeFileSync(join(tmp, 'AAPL', D, 'past.json.gz'), '');
    writeFileSync(join(tmp, 'SPY', D, 'shown.jsonl'), '');
    const idx = JSON.parse(over.index('7').body) as { sessions: { name: string }[] };
    check(`the list: the recorded names' sessions alone (${idx.sessions.map(s => s.name).join(', ')})`, idx.sessions.length === 1 && idx.sessions[0].name === 'SPY');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
