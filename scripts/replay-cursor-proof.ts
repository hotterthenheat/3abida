/*
  Acceptance test for Terrain's replay (the owner's item 8, 2026-10-14: "Point-in-time: the data layer asserts every read
  <= cursor; brightness reference, cone and sigma lines are all recomputed as of the cursor. Acceptance: (i) an
  instrumented full-session replay makes zero reads > cursor; (ii) at 20 random minutes on recorder sessions, the replay
  frame equals the live frame; (iii) random start never lands on a session with missing inputs").

  The replay draws the live chart on a tape cut at the cursor (data/replayFrame.ts): every bar, every column of the field,
  the day bars, the ghost dots, the bead reference and the straddle the priced move stands on are read through a guard
  stamped with the moment each became knowable, and every observation a column of the field priced on reports its own
  moment through the model's probe (trailModel setPitProbe).

  - the cursor's helpers: a bar on and back on a five-minute chart, a day on 1D, a typed time on the reader's clock, the
    session's span on a half day, the day bar folded so far, the cut grown in place
  - (i) a whole synthetic session replayed minute by minute — chain reads every ten minutes from 04:00, the day's count
    published at 07:00 — and, where this machine holds one, a whole session the server rebuilt: zero reads past the
    cursor in every frame; three planted look-aheads are caught
  - (ii) on the recorder's own sessions (.feed-cache/field/<NAME>/<DAY>/shown.jsonl, what Terrain drew live): the frame at
    20 random minutes — its field's column priced the way the page prices it, from the recorder's own reads — against the
    shown row of the same minute: the cells, the walls, the flip, the heaviest strikes, the net, the price, the straddle
    and the bead reference
  - (iii) the random start over sessions missing a bar, a column, the priced move, or still open: 10,000 draws, none lands
    on one; every ready session is reached; the cursor leaves half an hour to play
  - the recorder kept a session whole only with its seed and chain reads from the open to the close, no gap over 25 min
*/
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import {
  GrowingCut,
  cutAt,
  dailyAt,
  frameAt,
  knowableAt,
  laggedAt,
  minuteFromText,
  pitGuard,
  pitRead,
  randomStart,
  readinessOf,
  recordingComplete,
  sessionSpan,
  stepCursor,
  type PitGuard,
} from '../src/data/replayFrame';
import { columnSummary, modelColumn, pastInputs, setPitProbe, straddleExpiries, straddleOfMinute, universeOf, type ChainRow, type SeedRow, type ServerInputs, type Universe } from '../src/data/feed/trailModel';
import { columnMax, stepOf, strengthOf, minuteRefs } from '../src/data/feed/beadScale';
import { rng } from '../src/data/feed/trackRecord';
import { nyIsoDate, nyWallTime } from '../src/core/nyTime';
import type { Candle, GexSnapshot } from '../src/types/market';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (ok) pass++;
  else fail++;
};
/* the reader's clock in these checks is New York's, printed the house's way */
const nyClockText = (ms: number) => {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ms));
  return p.replace(/\s*(AM|PM)$/i, (_, x: string) => ` ${x.toLowerCase()}`);
};

/* ---- a synthetic day: Monday 2026-10-19, SPY round 600 ---------------------------------------------------------- */
const DAY = '2026-10-19';
const at = (h: number, m: number) => nyWallTime(2026, 10, 19, h, m);
const EXPS = ['261019', '261021', '261023', '261120'];
const STRIKES = Array.from({ length: 15 }, (_, i) => 593 + i);
const occ = (exp: string, r: 'C' | 'P', k: number) => `SPY${exp}${r}${String(k * 1000).padStart(8, '0')}`;
const syms = EXPS.flatMap(e => STRIKES.flatMap(k => (['C', 'P'] as const).map(r => occ(e, r, k))));
const oiOf = (s: string, today: boolean) => 400 + ((s.charCodeAt(s.length - 3) * 37 + s.charCodeAt(9) * 11) % 2000) + (today ? 150 : 0);
const ivOf = (s: string, base: number) => base + ((s.charCodeAt(s.length - 4) + s.charCodeAt(8)) % 9) / 100;
const reads: ServerInputs['chains'] = [];
for (let m = 4 * 60; m <= 16 * 60; m += 10) {
  const t = at(Math.floor(m / 60), m % 60);
  const base = 0.12 + (m % 70) / 1000;
  reads.push({ receivedAt: t + 7_000, rows: syms.map(s => [s, oiOf(s, t >= at(7, 0)), ivOf(s, base), t - 30_000, 1.1, 1.2, 10] as ChainRow) });
}
const seed = { date: '2026-10-16', receivedAt: at(4, 1), rows: syms.map(s => [s, ivOf(s, 0.15), at(4, 1) - 60_000, oiOf(s, false)] as SeedRow) };
const inputs: ServerInputs = { chains: reads, seed, total: null };
/* minute bars 04:00 to 20:00, a slow drift round 600 */
const bars: Candle[] = [];
for (let m = 4 * 60; m < 20 * 60; m++) {
  const t = at(Math.floor(m / 60), m % 60) / 1000;
  const c = 600 + Math.sin(m / 37) * 1.8 + (m - 600) / 400;
  bars.push({ time: t, open: c - 0.05, high: c + 0.2, low: c - 0.2, close: c, volume: 1000 });
}

/* ---- the cursor's helpers ---------------------------------------------------------------------------------------- */
{
  const t = (h: number, m: number) => at(h, m) / 1000;
  check('a bar on, on 5m: from inside a bar to its end (10:31 → 10:34), then the next bar\'s end (→ 10:39)', stepCursor(bars, t(10, 31), 5, 1) === t(10, 34) && stepCursor(bars, t(10, 34), 5, 1) === t(10, 39));
  check('a bar back, on 5m: to the end of the bar before (10:31 → 10:29), and again (→ 10:24)', stepCursor(bars, t(10, 31), 5, -1) === t(10, 29) && stepCursor(bars, t(10, 29), 5, -1) === t(10, 24));
  check('a bar on 1m is the next minute; a step at the tape\'s last minute stays', stepCursor(bars, t(10, 31), 1, 1) === t(10, 32) && stepCursor(bars, bars[bars.length - 1].time, 1, 1) === bars[bars.length - 1].time);
  const mins = bars.filter(b => nyIsoDate(b.time * 1000) === DAY).map(b => b.time);
  check('a typed time on the reader\'s clock: "10:42 am", "10:42am", "1042", "1:05 pm", and "1:05" taken as the one the session holds', minuteFromText('10:42 am', mins, nyClockText) === t(10, 42) && minuteFromText('10:42am', mins, nyClockText) === t(10, 42) && minuteFromText('1042', mins, nyClockText) === t(10, 42) && minuteFromText('1:05 pm', mins, nyClockText) === t(13, 5) && minuteFromText('1:05', mins, nyClockText) === t(13, 5));
  check('a time the session does not hold names nothing ("11:05 pm", "noon", "25:00")', minuteFromText('11:05 pm', mins, nyClockText) === null && minuteFromText('noon', mins, nyClockText) === null && minuteFromText('25:00', mins, nyClockText) === null);
  const half = sessionSpan('2026-11-27');
  check('a half day\'s session: 09:30 to 13:00, 210 minutes (the Friday after Thanksgiving)', half.minutes === 210 && half.last === nyWallTime(2026, 11, 27, 12, 59) / 1000);
  const daily: Candle[] = [{ time: Date.UTC(2026, 9, 16, 12) / 1000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 1 }, { time: Date.UTC(2026, 9, 19, 12) / 1000, open: 9, high: 9, low: 9, close: 9, volume: 9 }];
  const g = pitGuard(t(10, 30));
  const d = dailyAt(daily, bars, t(10, 30), g);
  const reg = bars.filter(b => b.time >= t(9, 30) && b.time <= t(10, 30));
  check('the day bar at 10:30: the days before whole, today\'s folded from 09:30 to 10:30 — never the day\'s own finished bar', d.length === 2 && d[0].close === 1.5 && d[1].open === reg[0].open && d[1].close === reg[reg.length - 1].close && d[1].high === Math.max(...reg.map(b => b.high)) && g.late.length === 0);
  const cut = new GrowingCut<Candle>(b => b.time);
  const a1 = cut.cut(bars, t(10, 0));
  const v1 = cut.version;
  const a2 = cut.cut(bars, t(10, 5));
  const v2 = cut.version;
  const a3 = cut.cut([...bars], t(10, 5));
  const v3 = cut.version;
  const a4 = cut.cut(bars, t(9, 50));
  check('the cut grows in place as the cursor moves on (the same list, five more), stands when a poll brings the same past, and is cut afresh going back', a1 === a2 && a2.length === countUpTo(bars, t(10, 5)) && v2 === v1 + 1 && a3 === a2 && v3 === v2 && a4 !== a2 && a4.length === countUpTo(bars, t(9, 50)) && cut.version === v3 + 1);
}
function countUpTo(list: readonly Candle[], t: number) {
  return list.filter(b => b.time <= t).length;
}

/* ---- (i) zero reads past the cursor ----------------------------------------------------------------------------- */
/** The day's columns as the page prices them (the live trail: one universe on the day's inputs, a column a minute), each
    with its horizon — the newest moment any observation it priced on became knowable (the model's probe) */
function columnsWithHorizon(name: string, day: string, inp: ServerInputs, mins: readonly Candle[]): { cols: GexSnapshot[]; horizon: Map<number, number>; u: Universe } {
  const u = universeOf(name, day, inp);
  const cols: GexSnapshot[] = [];
  const horizon = new Map<number, number>();
  for (const b of mins) {
    let h = 0;
    setPitProbe((_w, t) => {
      if (t > h) h = t;
    });
    const c = modelColumn(u, b);
    setPitProbe(null);
    if (!c.levels.length) continue;
    cols.push(c);
    horizon.set(c.time, h);
  }
  return { cols, horizon, u };
}
/** One frame at the cursor, every read through the guard: the cut tape, the frame, the ghost dots, the day bars, the
    straddle under the priced move (its own observations probed), each column's own observations */
function auditFrame(g: PitGuard, day: string, inp: ServerInputs, u: Universe, tape: readonly Candle[], cols: readonly GexSnapshot[], horizon: Map<number, number>, daily: readonly Candle[]) {
  const c = g.cursor;
  const b = cutAt(tape, c, x => x.time, 'bar', g);
  const k = cutAt(cols, c, x => x.time, 'column', g);
  for (const col of k) pitRead(g, 'a column\'s own observations', horizon.get(col.time) ?? Infinity);
  const f = frameAt(b, k, c, g);
  laggedAt(k, c, undefined, 2, g);
  dailyAt(daily, b, c, g);
  if (f.bar) {
    setPitProbe((w, t) => pitRead(g, `the straddle's ${w}`, t));
    const exps = straddleExpiries(u.expiry, day);
    if (exps.today) straddleOfMinute(u, inp.chains, day, f.bar, exps.today, 'shown');
    setPitProbe(null);
  }
  /* the priced move's budget stands on the session before's close, its profile on the sessions before the day */
  const [y, m, d] = day.split('-').map(Number);
  pitRead(g, 'the budget (the session before\'s 4:00 pm straddle)', nyWallTime(y, m, d, 0, 0) - 1);
  return f;
}
{
  const { cols, horizon, u } = columnsWithHorizon('SPY', DAY, inputs, bars);
  const span = sessionSpan(DAY);
  let frames = 0;
  let reads = 0;
  let late = 0;
  let sample = '';
  for (let c = span.first; c <= span.last; c += 60) {
    const g = pitGuard(c);
    auditFrame(g, DAY, inputs, u, bars, cols, horizon, []);
    frames++;
    reads += g.reads;
    late += g.late.length;
    if (g.late.length && !sample) sample = `${g.late[0].what} at ${new Date(g.late[0].at).toISOString()}`;
  }
  check(`(i) a whole session replayed minute by minute (synthetic, ${frames} frames, chain reads every ten minutes from 04:00, the count published at 07:00): ${reads.toLocaleString('en-US')} reads, ${late} past the cursor${sample ? ` — first: ${sample}` : ''}`, frames === 390 && reads > 100_000 && late === 0);

  /* three planted look-aheads, each caught */
  const g1 = pitGuard(at(10, 30) / 1000);
  cutAt(bars, g1.cursor + 60, x => x.time, 'bar', g1);
  const g2 = pitGuard(at(10, 30) / 1000);
  const ahead = modelColumn(u, { time: g2.cursor + 1200, close: 600 });
  const ahor = (() => {
    let h = 0;
    setPitProbe((_w, t) => (h = Math.max(h, t)));
    modelColumn(u, { time: g2.cursor + 1200, close: 600 });
    setPitProbe(null);
    return h;
  })();
  pitRead(g2, 'a column priced twenty minutes on, placed at the cursor', ahor);
  void ahead;
  const g3 = pitGuard(at(10, 30) / 1000);
  dailyAt([{ time: Date.UTC(2026, 9, 19, 12) / 1000, open: 1, high: 1, low: 1, close: 1, volume: 1 }, { time: Date.UTC(2026, 9, 20, 12) / 1000, open: 1, high: 1, low: 1, close: 1, volume: 1 }], bars, g3.cursor, g3);
  check(`the guard catches a cut one minute long (${g1.late.length} late), a column priced on observations from twenty minutes on (${g2.late.length}), and is not fooled by a day bar of the cursor's own day (the day's bar is folded from its minutes, ${g3.late.length} late)`, g1.late.length === 1 && g2.late.length === 1 && g3.late.length === 0);
}

/* a whole session the server rebuilt, where this machine holds one */
{
  const root = join(process.cwd(), '.feed-cache', 'field');
  const gz = (f: string) => (existsSync(f) ? gunzipSync(readFileSync(f)).toString('utf8') : null);
  let done = false;
  for (const name of existsSync(root) ? readdirSync(root).filter(n => /^[A-Z]/.test(n)) : [])
    for (const day of readdirSync(join(root, name)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse()) {
      if (done) break;
      const past = gz(join(root, name, day, 'past.json.gz'));
      const barsText = gz(join(root, name, day, 'bars.json.gz'));
      if (!past || !barsText) continue;
      const p = JSON.parse(past);
      const raw = JSON.parse(barsText) as { time: number; open: number; high: number; low: number; close: number; session?: string }[];
      const span = sessionSpan(day);
      const reg = raw.filter(b => b.time >= span.first && b.time <= span.last).map(b => ({ ...b, volume: 0 }));
      if (reg.length < 300) continue;
      const inp = pastInputs({ day, oi: p.oi, seed: p.seed, total: p.total, ticks: p.ticks ?? {} });
      const t0 = Date.now();
      const { cols, horizon, u } = columnsWithHorizon(name, day, inp, reg);
      let reads = 0;
      let late = 0;
      for (const b of reg) {
        const g = pitGuard(b.time);
        auditFrame(g, day, inp, u, reg, cols, horizon, []);
        reads += g.reads;
        late += g.late.length;
      }
      check(`(i) a session the server rebuilt, replayed minute by minute (${name} ${day}, ${reg.length} minutes, ${cols.length} columns, ${((Date.now() - t0) / 1000).toFixed(1)} s): ${reads.toLocaleString('en-US')} reads, ${late} past the cursor`, late === 0 && reads > 10_000);
      done = true;
    }
  if (!done) console.log('SKIP  (i) on a rebuilt session: none on this machine');
}

/* ---- (ii) the replay frame equals the live frame on the recorder's sessions ------------------------------------- */
{
  const root = join(process.cwd(), '.feed-cache', 'field');
  const text = (f: string) => (existsSync(f) ? readFileSync(f, 'utf8') : existsSync(`${f}.gz`) ? gunzipSync(readFileSync(`${f}.gz`)).toString('utf8') : null);
  const lines = <T>(t: string | null): T[] =>
    (t ?? '')
      .split('\n')
      .filter(Boolean)
      .flatMap(l => {
        try {
          return [JSON.parse(l) as T];
        } catch {
          return [];
        }
      });
  type Row = { m: number; spot: number; flip: number | null; cw: number | null; pw: number | null; top: [number, number][]; net: number; max: number; ref: number; cells: [number, number][]; str0: { value: number; src: string } | null; model: string };
  let sessions = 0;
  let minutes = 0;
  const off: Record<string, number> = { cells: 0, walls: 0, flip: 0, top: 0, net: 0, price: 0, straddle: 0, reference: 0 };
  const notes: string[] = [];
  for (const name of existsSync(root) ? readdirSync(root).filter(n => /^[A-Z]/.test(n)) : [])
    for (const day of readdirSync(join(root, name)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))) {
      const dir = join(root, name, day);
      const all = lines<Row>(text(join(dir, 'shown.jsonl')));
      const chains = lines<{ receivedAt: number; rows: ChainRow[] }>(text(join(dir, 'chain.jsonl')));
      const seedT = text(join(dir, 'seed.json'));
      const barsT = existsSync(join(dir, 'bars.json.gz')) ? gunzipSync(readFileSync(join(dir, 'bars.json.gz'))).toString('utf8') : null;
      if (!all.length || !chains.length || !seedT || !barsT) continue;
      /* a minute written twice is two recorders' (before 2026-10-13's lock): the capture is read up to the first one */
      const seen = new Set<number>();
      let firstDup = Infinity;
      for (const r of all) {
        if (seen.has(r.m)) firstDup = Math.min(firstDup, r.m);
        seen.add(r.m);
      }
      const once = new Set<number>();
      const rows = all.filter(r => r.m < firstDup && !once.has(r.m) && (once.add(r.m), true)).sort((a, b) => a.m - b.m);
      /* the reads the recorder held then: those before the first minute two recorders wrote */
      const uniq = new Map<number, { receivedAt: number; rows: ChainRow[] }>();
      for (const c of chains) if (!uniq.has(c.receivedAt) && c.receivedAt < firstDup) uniq.set(c.receivedAt, c);
      const inp: ServerInputs = { chains: [...uniq.values()].sort((a, b) => a.receivedAt - b.receivedAt), seed: JSON.parse(seedT), total: null };
      if (inp.seed && inp.seed.receivedAt >= firstDup) continue;
      const tape = (JSON.parse(barsT) as Candle[]).map(b => ({ ...b, volume: 0 })).sort((a, b) => a.time - b.time);
      const u = universeOf(name, day, inp);
      const exps = straddleExpiries(u.expiry, day);
      if (Number.isFinite(firstDup)) notes.push(`${name} ${day}: read to ${nyClockText(firstDup)} New York (${rows.length} minutes), where two recorders wrote the same minutes`);
      if (rows.length < 3) continue;
      sessions++;
      const pick = rng(20261014);
      const order = rows.map((_, i) => i).sort(() => pick() - 0.5);
      const chosen = order.slice(0, Math.min(20, rows.length)).sort((a, b) => a - b);
      /* the bead reference counts the minutes the recorder counted: its own shown minutes, so the replay's columns there */
      const replayCols: GexSnapshot[] = [];
      for (const r of rows) {
        const b = tape.find(x => x.time * 1000 === r.m);
        if (b) replayCols.push(modelColumn(u, b));
      }
      const refs = minuteRefs(replayCols.map(c => c.time), replayCols.map(c => columnMax(c.levels)), t => nyIsoDate(t * 1000)).ref;
      for (const i of chosen) {
        const r = rows[i];
        const cursor = r.m / 1000;
        const cut = cutAt(tape, cursor, x => x.time, 'bar');
        const f = frameAt(cut, replayCols.filter(c => c.time <= cursor), cursor);
        minutes++;
        if (!f.column) {
          off.cells++;
          continue;
        }
        const close = (a: number | null, b: number | null) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b)));
        const cells = new Map(f.column.levels.map(l => [l.strike, l.value]));
        if (r.cells.length !== cells.size || r.cells.some(([k, v]) => !close(cells.get(k) ?? null, v))) off.cells++;
        if (!close(f.cw, r.cw) || !close(f.pw, r.pw)) off.walls++;
        if (!close(f.flip, r.flip)) off.flip++;
        if (r.top.some(([k, v], j) => f.top[j]?.[0] !== k || !close(f.top[j]?.[1] ?? null, v))) off.top++;
        if (!close(f.net, r.net)) off.net++;
        if (!close(f.spot, r.spot)) off.price++;
        const st = exps.today && f.bar ? straddleOfMinute(u, inp.chains, day, f.bar, exps.today, 'shown') : null;
        if (!close(st?.value ?? null, r.str0?.value ?? null) || (st?.src ?? null) !== (r.str0?.src ?? null)) off.straddle++;
        const j = replayCols.findIndex(c => c.time === cursor);
        if (j < 0 || stepOf(strengthOf(columnMax(f.column.levels), r.ref)) !== stepOf(strengthOf(columnMax(f.column.levels), refs[j]))) off.reference++;
        void columnSummary;
      }
    }
  for (const n of notes) console.log(`NOTE  ${n}`);
  if (!sessions) console.log('SKIP  (ii) replay against live: no recorder session on this machine');
  else {
    const bad = Object.entries(off).filter(([, n]) => n > 0);
    check(`(ii) the replay frame equals the live frame: ${minutes} minute${minutes === 1 ? '' : 's'} of ${sessions} recorder session${sessions === 1 ? '' : 's'} (20 random a session, or every clean minute where it holds fewer) — the cells, the walls, the flip, the five heaviest strikes, the net, the price, the straddle under the priced move and the bead reference's step: ${bad.length ? bad.map(([k, n]) => `${k} differ at ${n}`).join(', ') : 'every one equal'}`, minutes > 0 && bad.length === 0);
    if (minutes < 20) console.log(`NOTE  (ii) ran on ${minutes} minutes, fewer than the 20 asked: this machine's recorder sessions hold no more clean minutes — the always-on recorder's days run it on 20 a session`);
  }
}

/* ---- (iii) the random start never lands on a session with an input missing ---------------------------------------- */
{
  const days = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-11-27'];
  const tape: Candle[] = [];
  const cols: GexSnapshot[] = [];
  for (const d of days) {
    const span = sessionSpan(d);
    for (let t = span.first; t <= span.last; t += 60) {
      /* Oct 13 misses one minute's bar; Oct 14 one minute's column */
      if (d === '2026-10-13' && t === span.first + 3600) continue;
      tape.push({ time: t, open: 1, high: 1, low: 1, close: 1, volume: 0 });
      if (d === '2026-10-14' && t === span.first + 7200) continue;
      cols.push({ time: t, levels: [{ strike: 600, value: 1 }] });
    }
  }
  const now = nyWallTime(2026, 11, 27, 16, 30);
  const budget = (d: string) => d !== '2026-10-15';
  const ready = days.map(d => readinessOf(d, tape, cols, budget(d), now));
  /* and a session still open */
  ready.push(readinessOf('2026-11-30', tape, cols, true, now));
  const draw = rng(8);
  const landed = new Map<string, number>();
  let bad = 0;
  let room = true;
  for (let n = 0; n < 10_000; n++) {
    const s = randomStart(ready, draw);
    if (!s) {
      bad++;
      continue;
    }
    landed.set(s.day, (landed.get(s.day) ?? 0) + 1);
    if (!ready.find(r => r.day === s.day)?.ready) bad++;
    const span = sessionSpan(s.day);
    if (s.cursor < span.first || s.cursor > span.last - 30 * 60 + 60) room = false;
  }
  const whys = ready.filter(r => !r.ready).map(r => `${r.day}: ${r.why}`);
  check(`(iii) 10,000 random starts never land on a session with an input missing (${whys.join('; ')}) — ${bad} did`, bad === 0 && whys.length === 4);
  check(`every ready session is reached (${[...landed.entries()].map(([d, n]) => `${d} ${n}`).join(', ')}), the half day among them, and every start leaves half an hour to play`, landed.size === 3 && landed.has('2026-10-12') && landed.has('2026-10-16') && landed.has('2026-11-27') && room);
  check('with no session ready, no start (and the page says why)', randomStart([readinessOf('2026-10-13', tape, cols, true, now)], draw) === null);
}

/* ---- the recorder's whole sessions ------------------------------------------------------------------------------ */
{
  const d = '2026-10-19';
  const every10 = Array.from({ length: 40 }, (_, i) => at(9, 25) + i * 10 * 60_000);
  check('a recording with its seed and a chain read every ten minutes from 09:25 to the close is whole', recordingComplete(d, every10, true).complete);
  check('no seed, a first read at 09:51, a gap of 40 minutes, or nothing near the close: not whole, and it says which', !recordingComplete(d, every10, false).complete && recordingComplete(d, every10.filter(t => t >= at(9, 51)), true).why === 'no chain read by the open' && /gap of 40/.test(recordingComplete(d, every10.filter(t => t < at(11, 0) || t >= at(11, 30)), true).why ?? '') && recordingComplete(d, every10.filter(t => t < at(15, 0)), true).why === 'no chain read near the close');
}

void knowableAt;
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
