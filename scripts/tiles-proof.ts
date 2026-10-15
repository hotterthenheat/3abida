/*
  THE TILES (src/data/feed/tiles.ts, server/fieldTiles.ts — the owner's Section I, 2026-10-15: "Precompute every
  timeframe (1m, 5m, 15m, 1h, 1D) at rebuild time, so a zoomed-out view never aggregates minute rows on the fly"), on a
  synthetic session with an expiry in every window partition:
  - a column survives the codec: strikes exact, money within a twenty-thousandth of the column's largest figure, shares
    to a thousandth, the times to the second
  - every timeframe's columns are the page's own fold of the same minutes (timeframe.ts aggregateSnapshots), every
    window's the page's own window view (trailModel windowView) folded the same way
  - each column carries the renderer's own counts as of its last minute: the session's p85 and p95 of per-minute peaks
    (beadScale RunningScale), the gross's p85, the delta's p85 and p95, and the walls the one stick held (WallStick)
  - the walls' events are the chips' own (stickyWallMoves, wallStateEventsOf) at the minute
  - the bars are the page's fold (aggregateCandles); the day's bar closes at the official close
  - the server writes, serves a range, lists the day's bar and the sessions it can tile, and a changed model is built again
  - the merge keeps the server's fold where both hold a time, and costs nothing on a second ask

    tsx scripts/tiles-proof.ts     (in `npm test`)
*/
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { buildDayTiles, dayBarOf, decodeBar, decodeColumn, encodeColumn, mergeByTime, modelDay, TILE_TFS, TILE_WINDOWS, type TileMinuteBar } from '../src/data/feed/tiles';
import { stickyWalls, wallObsOf, wallStateEventsOf, stickyWallMoves, windowView, type SeedRow } from '../src/data/feed/trailModel';
import { aggregateCandles, aggregateSnapshots } from '../src/data/timeframe';
import { RunningScale, columnGross, columnMax } from '../src/data/feed/beadScale';
import { nyWallTime } from '../src/core/nyTime';
import { createFieldTiles } from '../server/fieldTiles';
import type { GexSnapshot } from '../src/types/market';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (ok) pass++;
  else fail++;
};

/* a Monday with an expiry in every partition (the expiry-window proof's day) */
const day = '2026-10-19';
const at = (h: number, m: number) => nyWallTime(2026, 10, 19, h, m);
const EXPS = ['261019', '261021', '261023', '261106', '261120', '261218'];
const STRIKES = [595, 596, 597, 598, 599, 600, 601, 602, 603, 604, 605];
const occ = (exp: string, r: 'C' | 'P', k: number) => `SPY${exp}${r}${String(k * 1000).padStart(8, '0')}`;
const syms = EXPS.flatMap(e => STRIKES.flatMap(k => (['C', 'P'] as const).map(r => occ(e, r, k))));
const oiOf = (s: string) => 500 + ((s.charCodeAt(s.length - 3) * 37 + s.charCodeAt(9) * 11) % 2000);
const ivOf = (s: string, base: number) => base + ((s.charCodeAt(s.length - 4) + s.charCodeAt(8)) % 9) / 100;
const seed = { date: '2026-10-16', receivedAt: at(8, 0), rows: syms.map(s => [s, ivOf(s, 0.15), at(8, 0), oiOf(s)] as SeedRow) };
const past = { day, oi: syms.map(s => [s, oiOf(s)] as [string, number]), seed, ticks: {} as Record<string, number[]>, total: null };
/* the day's minutes, 8:00 to 17:59 New York, a walk through the strikes (the price crosses 600 and back) */
const bars: TileMinuteBar[] = [];
{
  let p = 600.2;
  for (let m = 8 * 60; m < 18 * 60; m++) {
    const t = at(Math.floor(m / 60), m % 60) / 1000;
    const step = Math.sin(m / 23) * 0.18 + Math.cos(m / 7) * 0.05;
    const open = p;
    p = Math.max(596, Math.min(604, p + step));
    bars.push({ time: t, open, high: Math.max(open, p) + 0.03, low: Math.min(open, p) - 0.03, close: p, volume: 1000 + (m % 17) * 10, session: m < 570 ? 'pre' : m < 960 ? 'r' : 'post' });
  }
}
const close = 601.37;
const minutes = modelDay({ name: 'SPY', day, past, bars });
const { tiles, bars: barTiles } = buildDayTiles({ name: 'SPY', day, past, bars, close }, minutes);
const tile = (w: string, tf: number) => tiles.find(t => t.window === w && t.tf === tf)!;

check(`the session is modeled on its regular minutes alone: ${minutes.length} of ${bars.length} bars (9:30 to 4:00)`, minutes.length === 390);
check(`a tile a window and timeframe: ${tiles.length} (${TILE_WINDOWS.length} windows × ${TILE_TFS.length} timeframes), bars once a timeframe (${barTiles.length})`, tiles.length === TILE_WINDOWS.length * TILE_TFS.length && barTiles.length === TILE_TFS.length);

/* the codec */
{
  let worstV = 0;
  let worstD = 0;
  let worstShare = 0;
  let cells = 0;
  let strikesOk = true;
  let timesOk = true;
  for (const snap of minutes.slice(0, 120)) {
    const enc = encodeColumn(snap, { ref: 1, ring: 2, refG: 3, refD: 4, ringD: 5, minutes: 6, at: snap.time, net: 7, cw: 600, pw: 598, cwState: 'holding', pwState: 'broken' });
    const dec = decodeColumn(JSON.parse(JSON.stringify(enc)));
    let mV = 0;
    let mD = 0;
    for (const l of snap.levels) {
      mV = Math.max(mV, Math.abs(l.value), Math.abs(l.gross ?? 0));
      mD = Math.max(mD, Math.abs(l.dex ?? 0));
    }
    snap.levels.forEach((l, i) => {
      const d = dec.levels[i];
      cells++;
      if (!d || d.strike !== l.strike) strikesOk = false;
      if (!d) return;
      worstV = Math.max(worstV, Math.abs(d.value - l.value) / mV, Math.abs((d.gross ?? 0) - (l.gross ?? 0)) / mV);
      worstD = Math.max(worstD, Math.abs((d.dex ?? 0) - (l.dex ?? 0)) / Math.max(1, mD));
      worstShare = Math.max(worstShare, Math.abs((d.staleShare ?? 0) - (l.staleShare ?? 0)), Math.abs((d.coverage ?? 0) - (l.coverage ?? 0)));
      if ((l.freshAt != null && Math.abs((d.freshAt ?? 0) - l.freshAt) > 1000) || (l.staleSince != null && Math.abs((d.staleSince ?? 0) - l.staleSince) > 1000) || d.prov !== l.prov) timesOk = false;
    });
    if (dec.time !== snap.time || dec.pre?.pw !== 598 || dec.pre?.pwState !== 'broken' || dec.pre?.net !== 7) timesOk = false;
  }
  check(`the codec: ${cells} cells, strikes exact, money within ${worstV.toExponential(1)} of the column's largest (the delta ${worstD.toExponential(1)}), shares within ${worstShare.toFixed(4)}, provenance and times kept, the pre and walls kept`, strikesOk && worstV <= 5e-5 && worstD <= 5e-5 && worstShare <= 0.0005 + 1e-9 && timesOk);
}

/* the folds: every timeframe and window is the page's own fold of the same minutes */
{
  let worst = 0;
  let mismatch = 0;
  for (const w of TILE_WINDOWS) {
    const ws = w === 'all' ? minutes : minutes.map(s => windowView(s, w));
    for (const tf of [1, 5, 15, 30, 60] as const) {
      const want = tf === 1 ? ws : aggregateSnapshots(ws, tf);
      const got = tile(w, tf).cols.map(decodeColumn);
      if (got.length !== want.length) {
        mismatch++;
        continue;
      }
      got.forEach((g, i) => {
        const e = want[i];
        if (g.time !== e.time || g.levels.length !== e.levels.length) {
          mismatch++;
          return;
        }
        const m = Math.max(1, columnMax(e.levels), columnGross(e.levels));
        e.levels.forEach((l, j) => {
          if (g.levels[j].strike !== l.strike || g.levels[j].at !== l.at) mismatch++;
          worst = Math.max(worst, Math.abs(g.levels[j].value - l.value) / m);
        });
      });
    }
  }
  check(`every window × timeframe (1m to 1h) is the page's own fold (aggregateSnapshots of the window's view): ${mismatch} cells differ in strike, time or peak minute; money within ${worst.toExponential(1)} of the column's largest`, mismatch === 0 && worst <= 5e-5);
}

/* the references and walls as of each column's last minute */
for (const w of ['all', '0dte'] as const) {
  const ws = w === 'all' ? minutes : minutes.map(s => windowView(s, w));
  const run = new RunningScale();
  const runG = new RunningScale();
  const runD = new RunningScale();
  const ref: number[] = [];
  const ring: number[] = [];
  const refG: number[] = [];
  const refD: number[] = [];
  for (const s of ws) {
    ref.push(run.push(columnMax(s.levels)));
    ring.push(run.ring());
    refG.push(runG.push(columnGross(s.levels)));
    let dm = 0;
    for (const l of s.levels) dm = Math.max(dm, Math.abs(l.dex ?? 0));
    refD.push(runD.push(dm));
  }
  const held = stickyWalls(ws.map(s => wallObsOf(s.time, s.spot ?? NaN, s.levels)));
  const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1, Math.abs(b));
  let worst = 0;
  let wallsOff = 0;
  let n = 0;
  for (const tf of [5, 15, 60] as const) {
    for (const c of tile(w, tf).cols.map(decodeColumn)) {
      const end = c.time + tf * 60 - 1;
      let j = -1;
      for (let i = 0; i < ws.length; i++) if (ws[i].time <= end) j = i;
      const p = c.pre!;
      worst = Math.max(worst, rel(p.ref, ref[j]), rel(p.ring, ring[j]), rel(p.refG, refG[j]), rel(p.refD, refD[j]));
      if (p.cw !== held.cw[j] || p.pw !== held.pw[j] || p.cwState !== held.shown[j].cwState || p.pwState !== held.shown[j].pwState || p.minutes !== j + 1) wallsOff++;
      n++;
    }
  }
  check(`${w}: each folded column carries the renderer's own references at its last minute (${n} columns at 5m, 15m and 1h, worst ${worst.toExponential(1)}) and the walls the one stick held then (${wallsOff} differ)`, n > 30 && worst <= 1e-3 && wallsOff === 0);
  /* the events */
  const shown = held.shown.map((s, i) => ({ ...s, time: ws[i].time }));
  const moves = stickyWallMoves(shown.length, i => shown[i]);
  const states = wallStateEventsOf(shown.length, i => shown[i]);
  const ev = tile(w, 5).events;
  const evMoves = ev.filter(e => e[2] != null);
  const evStates = ev.filter(e => e[2] == null);
  const same = evMoves.length === moves.length && evMoves.every((e, i) => e[1] === moves[i].to && e[2] === moves[i].from && e[4] === moves[i].time && (e[0] === 0) === (moves[i].kind === 'CW')) && evStates.length === states.length && evStates.every((e, i) => e[1] === states[i].strike && e[4] === states[i].time && (e[3] === 2) === (states[i].state === 'broken'));
  check(`${w}: the walls' events are the chips' own at the minute (${moves.length} moves, ${states.length} states — ${states.map(s => `${s.kind} ${s.strike} ${s.state}`).join(', ') || 'none'})`, same && moves.length + states.length > 0);
}

/* the bars */
{
  const candles = bars.map(b => ({ time: b.time, open: b.open!, high: b.high!, low: b.low!, close: b.close, volume: b.volume! }));
  let ok = true;
  for (const tf of [5, 15, 30, 60] as const) {
    const want = aggregateCandles(candles, tf);
    const got = barTiles.find(b => b.tf === tf)!.bars.map(decodeBar);
    if (got.length !== want.length || got.some((g, i) => g.time !== want[i].time || g.open !== want[i].open || g.high !== want[i].high || g.low !== want[i].low || g.close !== want[i].close || g.volume !== want[i].volume)) ok = false;
  }
  const d1 = barTiles.find(b => b.tf === 1440)!.bars.map(decodeBar)[0];
  const want = dayBarOf(day, bars, close)!;
  check(`the bars at 5m, 15m, 30m and 1h are the page's fold (every session's minutes, ${bars.length}); the day's bar closes at the official close (${d1.close}), at noon UTC, its range over the regular minutes`, ok && d1.close === close && d1.time === Date.UTC(2026, 9, 19, 12) / 1000 && d1.open === want.open && d1.high === want.high && d1.low === want.low);
}

/* the server */
{
  const root = join(tmpdir(), `slayer-tiles-proof-${process.pid}`);
  rmSync(root, { recursive: true, force: true });
  const write = (d: string) => {
    mkdirSync(join(root, 'SPY', d), { recursive: true });
    writeFileSync(join(root, 'SPY', d, 'past.json.gz'), gzipSync(Buffer.from(JSON.stringify({ ...past, day: d }))));
  };
  write(day);
  write('2026-10-20');
  const tiles2 = createFieldTiles({ minutes: async () => bars.map(b => ({ ...b, session: b.session ?? 'r' })) as never }, { root });
  const before = JSON.parse(tiles2.daily('SPY').body) as { days: string[]; pending: string[] };
  check(`before any build the server lists both sessions as ones it can tile (${before.pending.join(', ')}) and none as tiled`, before.days.length === 0 && before.pending.length === 2);
  const meta = tiles2.buildFrom('SPY', day, past, bars, close);
  const r = JSON.parse(tiles2.serve('SPY', '5', '0dte', '2026-10-01', '2026-10-31').body) as { days: { day: string; tile: { cols: unknown[]; window: string }; bars: { bars: unknown[] } }[]; building: string[] };
  check(`a range answers the tiled session whole (${r.days.length}: ${r.days[0]?.tile.cols.length} columns through 0DTE at 5m, ${r.days[0]?.bars.bars.length} bars) and builds the other (${r.building.join(', ')}); ${(meta.bytes / 1024).toFixed(0)} KB on disk`, r.days.length === 1 && r.days[0].tile.window === '0dte' && r.days[0].tile.cols.length === 78 && r.building.includes('2026-10-20'));
  const after = JSON.parse(tiles2.daily('SPY').body) as { days: string[]; bars: number[][] };
  check(`every tiled session's day bar (${after.days.join(', ')}: close ${after.bars[0]?.[4]})`, after.days.includes(day) && after.bars[0]?.[4] === close);
  /* a changed model version: the tiles of the session are no longer taken */
  const metaFile = join(root, 'SPY', day, 'tiles', 'tiles.json');
  const m = JSON.parse(readFileSync(metaFile, 'utf8'));
  writeFileSync(metaFile, JSON.stringify({ ...m, model: 'an-older-model' }));
  const fresh = createFieldTiles(null, { root });
  check('a session tiled under another model is built again (has: false, listed as one the server can tile)', !fresh.has('SPY', day) && (JSON.parse(fresh.daily('SPY').body) as { pending: string[] }).pending.includes(day));
  check('a bad range is refused', tiles2.serve('SPY', '7', 'all', day, day).status === 400 && tiles2.serve('SPY', '5', 'all', '2026-10-20', '2026-10-19').status === 400);
  rmSync(root, { recursive: true, force: true });
}

/* the merge */
{
  const a = [{ time: 1, v: 'pre' }, { time: 3, v: 'pre' }, { time: 5, v: 'pre' }];
  const b = [{ time: 2, v: 'live' }, { time: 3, v: 'live' }, { time: 6, v: 'live' }];
  const m1 = mergeByTime(a, b);
  const m2 = mergeByTime(a, b);
  check(`the merge orders by time and keeps the server's fold where both hold a time (${m1.map(x => `${x.time}${x.v[0]}`).join(' ')}), the same array on a second ask`, m1.map(x => x.time).join() === '1,2,3,5,6' && m1[2].v === 'pre' && m1 === m2 && mergeByTime(a, []) === a);
}

/* a session's 1m columns are the minutes themselves (the 1m tile is no fold) */
{
  const got = tile('all', 1).cols.map(decodeColumn) as GexSnapshot[];
  check(`the 1m tile holds every regular minute (${got.length}) at its own time`, got.length === 390 && got.every((g, i) => g.time === minutes[i].time));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
