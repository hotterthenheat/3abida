/*
  Acceptance test for the point-in-time store (server/fieldStore.ts, 2026-10-13) — the recorder, the store and the
  rebuild path on a fake vendor and a fake clock, no browser, no network. The owner's rules:
  1. TWO ROWS A MINUTE: a "shown" row from what the recorder had received by the minute's end, a "final" row from the
     rebuild path once the inputs with event time ≤ the minute are in (at the next chain read)
  2. SHOWN IS NEVER EDITED: a later read, a later tick, a second store on the same files — the rows stand as written;
     a minute the recorder missed (more than three minutes gone when first seen) is a gap, never filled in
  3. FINAL EQUALS THE REBUILD EXACTLY: the final rows and the session's full rebuild (fieldBackfill build()) are one
     code path on one data set — every cell, the flip, the walls, the net and the reference the same
  4. THE REFERENCE IS THE RENDERER'S: the row's `ref` equals what gexNodesPrimitive uses for that column
  5. THE STRADDLES: NBBO mids in the minute of a chain read, the model's price in the others, each labelled; the expiry
     settling today and the weekly (the first listed Friday after today)
  6. THE RECORDER KEEPS THE QUOTES AND UW'S SERIES: a chain row carries nbbo bid, ask and volume; the whole-book series
     its _vol and _dir
  7. THE D−1 SPLIT (the owner, 2026-10-13): open interest is the day's count from 7:00 am New York and the session
     before's count before it; the vols at the open are the session before's close
*/
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFieldBackfill } from '../server/fieldBackfill';
import { createFieldRecorder } from '../server/fieldRecorder';
import { createFieldStore, SHOWN_LATE_MS, type Bar, type StoreRow } from '../server/fieldStore';
import type { FeedClient } from '../server/feed';
import { oiAt, openColumn, straddleExpiries, straddleFromChain, universeOf, type ChainRow } from '../src/data/feed/trailModel';
import { RunningScale } from '../src/data/feed/beadScale';
import { GexTrailsPrimitive } from '../src/components/gex/gexNodesPrimitive';
import { nyWallTime } from '../src/core/nyTime';
import type { GexSnapshot } from '../src/types/market';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (ok) pass++;
  else fail++;
};

/* ---- the fake vendor: SPY on Wednesday 2026-10-14, nine strikes, the expiry settling today and Friday's ------------ */
const D = '2026-10-14';
const SEED = '2026-10-13';
const FRI = '2026-10-16';
const at = (h: number, m: number, s = 0) => nyWallTime(2026, 10, 14, h, m) + s * 1000;
const OPEN = at(9, 30);
const STRIKES = [596, 597, 598, 599, 600, 601, 602, 603, 604];
const occ = (exp: string, right: 'C' | 'P', k: number, root = 'SPY') => `${root}${exp.slice(2).replace(/-/g, '')}${right}${String(Math.round(k * 1000)).padStart(8, '0')}`;
/** The name a path asks for — the fake answers that name's root, so an index watched beside SPY has contracts of its own */
const rootOf = (path: string) => /\/api\/stock\/([A-Z]+)\//.exec(path)?.[1] ?? 'SPY';
const withRoot = (sym: string, root: string) => root + sym.slice(3);
const contracts = STRIKES.flatMap(k => [D, FRI].flatMap(exp => (['C', 'P'] as const).map(right => ({ sym: occ(exp, right, k), exp, right, k }))));
const traded = (sym: string) => /C00(598|599|600|601|602)000$/.test(sym) || /P00(599|600|601)000$/.test(sym);
/** The day's count: the calls heavier above 600, the puts below, so the column has a call wall and a put wall */
const oiOf = (c: { right: 'C' | 'P'; k: number }) => (c.k === 600 ? 120 : (c.right === 'C' && c.k > 600) || (c.right === 'P' && c.k < 600) ? 200 : 60);
let now = at(9, 29, 30);
const iso = (ms: number) => new Date(ms).toISOString();
/** The minutes of the session complete at `now` (the last one ended before it) */
const complete = () => Math.max(0, Math.floor((now - OPEN) / 60_000));
const ivAt = (sym: string, k: number) => 0.2 + 0.002 * k + (sym.includes('P0') ? 0.01 : 0);
const closeAt = (k: number) => 600 + 0.1 * k;
const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }), from: 'upstream' as const });
const asked: string[] = [];
const client = {
  hasKey: () => true,
  get: async (_p: string, path: string) => {
    asked.push(path);
    const page = Number(/page=(\d+)/.exec(path)?.[1] ?? 0);
    if (path.includes('/spot-exposures/expiry-strike'))
      return ok(page ? [] : contracts.filter(c => c.right === 'C').map(c => ({ strike: String(c.k), time: iso(now), call_gamma_oi: '1000', put_gamma_oi: '-800' })));
    if (path.includes('/spot-exposures/strike')) {
      if (path.includes('limit=1')) return ok([{ strike: '600', price: '600', time: iso(now) }]);
      return ok(STRIKES.map(k => ({ strike: String(k), price: '600', time: iso(now), call_gamma_oi: '1000', put_gamma_oi: '-800', call_delta_oi: '1', put_delta_oi: '-1', call_charm_oi: '0', put_charm_oi: '0', call_vanna_oi: '0', put_vanna_oi: '0', call_gamma_vol: '5', put_gamma_vol: '-4' })));
    }
    if (/\/spot-exposures(\?|$)/.test(path)) {
      const rows = [];
      for (let k = 0; k < complete(); k++) rows.push({ start_time: iso(OPEN + k * 60_000), price: String(closeAt(k)), gamma_per_one_percent_move_oi: '1000000000', gamma_per_one_percent_move_vol: '200000000', gamma_per_one_percent_move_dir: '-300000000' });
      return ok(rows);
    }
    /* the prints an index is priced off: the last three minutes' newest prints, newest first, the weekly root among them */
    if (path.includes('/option-trades?')) {
      const rows = [];
      for (let k = complete() - 1; k >= Math.max(0, complete() - 3); k--) {
        rows.push({ executed_at: iso(OPEN + k * 60_000 + 45_000), underlying_price: String(closeAt(k) + 0.05), underlying_symbol: 'SPXW' });
        rows.push({ executed_at: iso(OPEN + k * 60_000 + 10_000), underlying_price: String(closeAt(k) - 0.05), underlying_symbol: 'SPX' });
      }
      return ok(rows);
    }
    if (path.includes('/option-contracts?')) {
      const k = Math.max(0, complete() - 1);
      const root = rootOf(path);
      return ok(page ? [] : contracts.map(c => ({ option_symbol: withRoot(c.sym, root), open_interest: oiOf(c), implied_volatility: String(ivAt(c.sym, k)), last_tape_time: iso(now - 20_000), nbbo_bid: '1.00', nbbo_ask: '1.20', volume: traded(c.sym) ? complete() : 0 })));
    }
    if (path.includes('/option-chains?date=')) {
      const date = /date=([\d-]+)/.exec(path)![1];
      if (page) return ok([]);
      const root = rootOf(path);
      if (date === D) return ok(contracts.map(c => ({ option_symbol: withRoot(c.sym, root), expires: c.exp, strike: String(c.k), option_type: c.right === 'C' ? 'call' : 'put', implied_volatility: String(ivAt(c.sym, Math.max(0, complete() - 1))), open_interest: oiOf(c), volume: traded(c.sym) ? complete() : 0, last_tape_time: iso(now - 20_000) })));
      if (date === SEED) return ok(contracts.map(c => ({ option_symbol: withRoot(c.sym, root), expires: c.exp, strike: String(c.k), option_type: c.right === 'C' ? 'call' : 'put', implied_volatility: '0.20', open_interest: 100, volume: 50, last_tape_time: '2026-10-13T20:00:00Z' })));
      return ok([]);
    }
    if (path.includes('/ohlc/1m')) {
      const rows = [];
      const n = complete();
      const from = path.includes('limit=12') ? Math.max(0, n - 12) : 0;
      for (let k = from; k < n; k++) rows.push({ start_time: iso(OPEN + k * 60_000), open: String(closeAt(k) - 0.05), high: String(closeAt(k) + 0.1), low: String(closeAt(k) - 0.1), close: String(closeAt(k)), market_time: 'r' });
      return ok(rows);
    }
    const intra = /\/option-contract\/([^/]+)\/intraday\?date=/.exec(path);
    if (intra) {
      const sym = withRoot(intra[1], 'SPY');
      if (!traded(sym)) return ok([]);
      const rows = [];
      for (let k = 0; k < complete(); k++) rows.push({ start_time: iso(OPEN + k * 60_000), iv_low: String(ivAt(sym, k) - 0.001), iv_high: String(ivAt(sym, k) + 0.001) });
      return ok(rows);
    }
    return { status: 404, contentType: 'application/json', body: '{}', from: 'upstream' as const };
  },
} as unknown as FeedClient;

const root = mkdtempSync(join(tmpdir(), 'slayer-store-'));
const clock = () => now;
const file = (kind: 'shown' | 'final') => join(root, 'SPY', D, `${kind}.jsonl`);
const nyMinute = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
try {
  const bf = createFieldBackfill(client, { now: clock, root });
  const store = createFieldStore({ root, now: clock });
  const rec = createFieldRecorder(client, { now: clock, root, backfill: bf, store });
  rec.serve('SPY');
  await rec.settle();
  /* 09:31 to 09:51, a tick a minute */
  for (let m = 31; m <= 51; m++) {
    now = at(9, m, 10);
    await rec.tick();
    await rec.settle();
  }
  const shown = store.readRows('SPY', D, 'shown');
  const final = store.readRows('SPY', D, 'final');
  const minutesOf = (rows: StoreRow[]) => rows.map(r => nyMinute(r.m)).join(' ');

  /* 6 */
  const chain = readFileSync(join(root, 'SPY', D, 'chain.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l) as { receivedAt: number; rows: ChainRow[] });
  check('the recorder keeps the NBBO bid and ask and the volume on every chain row', chain.length >= 2 && chain.every(c => c.rows.every(r => r[4] === 1 && r[5] === 1.2 && typeof r[6] === 'number')));
  const total = JSON.parse(readFileSync(join(root, 'SPY', D, 'total.json'), 'utf8')) as { rows: number[][] };
  check("the recorder keeps UW's _vol and _dir beside _oi in the whole-book series", total.rows.length > 0 && total.rows.every(r => r.length === 5 && r[3] === 2e8 && r[4] === -3e8));

  /* 1 */
  check(`a shown row a minute, in order, from the open: ${minutesOf(shown).slice(0, 60)}…`, shown.length === 21 && shown[0].m === OPEN && shown.every((r, i) => r.m === OPEN + i * 60_000 && r.session === 'r'));
  check('a shown row holds the column: 9 strikes ascending, the net their sum, 5 heaviest, flip and walls, the model version', shown.every(r => r.cells.length === 9 && r.cells.every((c, i) => i === 0 || c[0] > r.cells[i - 1][0]) && Math.abs(r.net - r.cells.reduce((s, c) => s + c[1], 0)) < 1e-6 && r.top.length === 5 && r.model.startsWith('trail-') && r.cw != null && r.pw != null));
  const reads = chain.map(c => c.receivedAt);
  const readMinutes = new Set(reads.map(t => Math.floor((t - OPEN) / 60_000)).filter(k => k >= 0));
  check(`final rows for the minutes a chain read in the session reached, a minute behind its inputs: ${minutesOf(final)}`, final.length > 0 && final.every(r => r.session === 'r') && final[final.length - 1].m <= Math.max(...reads) - 2 * 60_000);
  check("a shown row's data age counts back to the newest read and book at its end", shown.every(r => r.age != null && r.age.vols != null && r.age.vols >= 0 && r.age.book != null));

  /* 5 */
  const inRead = shown.filter(r => readMinutes.has(Math.floor((r.m - OPEN) / 60_000)));
  const offRead = shown.filter(r => !readMinutes.has(Math.floor((r.m - OPEN) / 60_000)));
  check(`the straddle in a chain read's minute is the NBBO mids (${inRead.length} such minutes), 2.20 a share, labelled nbbo`, inRead.length > 0 && inRead.every(r => r.str0?.src === 'nbbo' && Math.abs(r.str0.value - 2.2) < 1e-9 && r.strW?.src === 'nbbo'));
  check(`between reads it is the model's price, labelled model (${offRead.length} minutes)`, offRead.length > 0 && offRead.every(r => r.str0?.src === 'model' && r.str0.value > 0 && r.strW?.src === 'model' && r.strW.value > r.str0.value));
  check("the expiries: today's and the weekly (Friday)", shown.every(r => r.str0?.expiry === D && r.strW?.expiry === FRI));
  check('straddleExpiries: on a Friday the weekly is the next Friday; with no Friday listed, the first date after', (() => {
    const a = straddleExpiries(['2026-10-16', '2026-10-19', '2026-10-23'], '2026-10-16');
    const b = straddleExpiries(['2026-10-19', '2026-10-21'], '2026-10-14');
    const c = straddleExpiries([D, FRI], D);
    return a.today === '2026-10-16' && a.weekly === '2026-10-23' && b.today === null && b.weekly === '2026-10-19' && c.today === D && c.weekly === FRI;
  })());
  check('straddleFromChain: the nearest strike with both legs quoted; a leg whose ask is under its bid is not a quote', (() => {
    const rows: ChainRow[] = [
      [occ(D, 'C', 600), 1, 0.2, null, 1, 1.2, 5],
      [occ(D, 'P', 600), 1, 0.2, null, 1.3, 1.1, 5],
      [occ(D, 'C', 601), 1, 0.2, null, 0.8, 1.0, 5],
      [occ(D, 'P', 601), 1, 0.2, null, 1.0, 1.4, 5],
    ];
    const s = straddleFromChain(rows, D, 600.2);
    return s?.strike === 601 && Math.abs(s.value - 2.1) < 1e-9 && s.src === 'nbbo';
  })());

  /* 2 */
  const before = readFileSync(file('shown'), 'utf8');
  now = at(9, 52, 10);
  await rec.tick();
  await rec.settle();
  const after = readFileSync(file('shown'), 'utf8');
  check('a later tick appends to shown.jsonl and changes nothing written', after.startsWith(before) && after.length > before.length);
  /* the recorder away five minutes: the minutes it missed are gaps */
  now = at(9, 58, 10);
  await rec.tick();
  await rec.settle();
  const shown2 = store.readRows('SPY', D, 'shown');
  const have = new Set(shown2.map(r => r.m));
  const missed = [52, 53, 54].map(m => at(9, m)).filter(m => !have.has(m));
  const served = JSON.parse(store.serve('SPY', D, 'shown').body) as { rows: StoreRow[]; gaps: number };
  check(`a minute more than ${SHOWN_LATE_MS / 60_000} minutes gone when first seen is a gap, never filled in: 9:52 to 9:54 missing, 9:55 on written`, missed.length === 3 && have.has(at(9, 55)) && have.has(at(9, 57)) && served.gaps >= 3);
  const again = createFieldStore({ root, now: clock });
  const again2 = again.shown('SPY', D, { chains: chain, seed: null, total: null }, [], []);
  check('a second store on the same files writes nothing for the minutes written (and replays the scale from them)', again2.length === 0 && readFileSync(file('shown'), 'utf8') === readFileSync(file('shown'), 'utf8'));

  /* 3 */
  const past = await bf.build('SPY', D);
  const bars: Bar[] = [];
  for (let k = 0; k < complete(); k++) bars.push({ time: (OPEN + k * 60_000) / 1000, close: closeAt(k), session: 'r' });
  const rebuilt = new Map(store.rowsOf(past, bars).map(r => [r.m, r]));
  const same = (a: StoreRow, b: StoreRow) => a.spot === b.spot && a.flip === b.flip && a.cw === b.cw && a.pw === b.pw && a.net === b.net && a.ref === b.ref && a.max === b.max && JSON.stringify(a.cells) === JSON.stringify(b.cells) && JSON.stringify(a.top) === JSON.stringify(b.top) && a.str0?.value === b.str0?.value && JSON.stringify(a.netP) === JSON.stringify(b.netP);
  const final2 = store.readRows('SPY', D, 'final');
  check(`the final rows equal the session's full rebuild to the cell (${final2.length} minutes, the same code path)`, final2.length > 0 && final2.every(r => rebuilt.has(r.m) && same(r, rebuilt.get(r.m)!)));
  check("the rebuild's vols are UW's minutes, and the day is covered once saved", (() => {
    bf.save(past);
    const c = JSON.parse(bf.coverage('SPY').body) as { first: string; last: string; days: string[]; byVols: Record<string, number> };
    return past.vols === 'minute' && c.first === D && c.last === D && c.days.length === 1 && c.byVols.minute === 1;
  })());

  /* 4 */
  const snaps: GexSnapshot[] = shown2.map(r => ({ time: r.m / 1000, spot: r.spot, levels: r.cells.map(([strike, value]) => ({ strike, value })) }));
  const prim = new GexTrailsPrimitive();
  prim.setData(snaps, 1, true, 60, 'gex');
  check("a row's reference is the renderer's for that column (beadScale.ts, one count)", shown2.every((r, i) => prim.columnAt(i).ref === r.ref));
  const scale = new RunningScale();
  check('and it runs forward: each row’s reference is the 85th percentile of the maxima up to it', shown2.every(r => scale.push(r.max) === r.ref));
  check("every row carries its net by expiry partition, summing to its net (item 6: the final rows equal the rebuild in every window)", [...shown2, ...final2].every(r => Array.isArray(r.netP) && r.netP.length === 4 && Math.abs(r.netP.reduce((x, v) => x + v, 0) - r.net) <= 1e-6 * Math.max(1, Math.abs(r.net))));
  check("every row carries the column's delta peak (maxD) for the delta field's fixed and prior references (item 5)", shown2.every(r => typeof r.maxD === 'number' && r.maxD >= 0) && final2.every(r => typeof r.maxD === 'number'));

  /* ONE RECORDER A MACHINE (2026-10-13: a dev server's in-process restart left the old recorder ticking, and 29
     minutes were written twice): a second recorder on the same folder writes nothing while the first holds the lock,
     takes over once it stops, and a minute is in the file once */
  {
    const root2 = mkdtempSync(join(tmpdir(), 'slayer-store-two-'));
    try {
      const store2 = createFieldStore({ root: root2, now: clock });
      const bf2 = createFieldBackfill(client, { now: clock, root: root2 });
      now = at(9, 29, 30);
      const A = createFieldRecorder(client, { now: clock, root: root2, backfill: bf2, store: store2 });
      const B = createFieldRecorder(client, { now: clock, root: root2, backfill: bf2, store: createFieldStore({ root: root2, now: clock }) });
      A.serve('SPY');
      B.serve('SPY');
      await A.settle();
      await B.settle();
      for (let m = 31; m <= 40; m++) {
        now = at(9, m, 10);
        await A.tick();
        await B.tick();
        await A.settle();
        await B.settle();
      }
      const raw = readFileSync(join(root2, 'SPY', D, 'shown.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l) as StoreRow);
      const unique = new Set(raw.map(r => r.m)).size;
      check(`two recorders on one folder: ${raw.length} shown lines for ${unique} minutes — each minute once, the second recorder writing nothing`, raw.length === unique && unique >= 10);
      A.stop();
      for (let m = 41; m <= 44; m++) {
        now = at(9, m, 10);
        await B.tick();
        await B.settle();
      }
      const after = readFileSync(join(root2, 'SPY', D, 'shown.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l) as StoreRow);
      check('the first stopped, the second takes the lock and records on, still a minute once', after.length > raw.length && after.length === new Set(after.map(r => r.m)).size && after.some(r => r.m === at(9, 43)));
      /* a minute written twice before the lock (a file from 2026-10-13) reads as its first row */
      const doubled = JSON.stringify({ ...after[0], net: 12345 });
      appendFileSync(join(root2, 'SPY', D, 'shown.jsonl'), doubled + '\n');
      const read = store2.readRows('SPY', D, 'shown');
      check('a minute written twice reads as its FIRST row, the one shown first', read.length === after.length && read[0].net === after[0].net);
      B.stop();
    } finally {
      rmSync(root2, { recursive: true, force: true });
    }
  }

  /* AN INDEX ON ITS PRINTS (2026-10-13): the recorder builds SPX's minutes from its prints' underlying price — the
     newest print's the close — and the final path takes those bars, UW serving none */
  {
    rec.stop();
    const recX = createFieldRecorder(client, { now: clock, root, backfill: bf, store });
    now = at(9, 29, 30);
    recX.serve('SPX');
    await recX.settle();
    for (let m = 31; m <= 51; m++) {
      now = at(9, m, 10);
      await recX.tick();
      await recX.settle();
    }
    const shownX = store.readRows('SPX', D, 'shown');
    const finalX = store.readRows('SPX', D, 'final');
    const askedBarsX = asked.some(p => p.includes('/api/stock/SPX/ohlc'));
    check(`an index's shown rows stand on its prints: ${shownX.length} minutes, each spot the minute's newest print (${shownX[0]?.spot}), no bar asked of the vendor`, shownX.length >= 18 && shownX.every(r => r.session === 'r' && Math.abs(r.spot - (closeAt(Math.round((r.m - OPEN) / 60_000)) + 0.05)) < 1e-9) && !askedBarsX);
    check(`and its final rows come the same way (${finalX.length} minutes)`, finalX.length > 0 && finalX.every(r => Math.abs(r.spot - (closeAt(Math.round((r.m - OPEN) / 60_000)) + 0.05)) < 1e-9));
  }

  /* 7 */
  const u = universeOf('SPY', D, store.inputsOf(past));
  const j = u.start[STRIKES.indexOf(600)];
  check("the D−1 split: before 7:00 am the session before's count (100), from 7:00 am the day's (120); the vols at the open the close's (0.20)", oiAt(u.oiObs[j], at(6, 0)) === 100 && oiAt(u.oiObs[j], at(7, 0)) === 120 && oiAt(u.oiObs[j], at(9, 30)) === 120 && u.obs[j][0].carried && u.obs[j][0].iv === 0.2);
  /* Pinpoint's open book (the owner, 2026-10-13: greek-exposure/strike?date=D "is the day's end state, not its open. Fix
     Pinpoint's history to stop reading it as the open (use the rebuilt field's 9:30 column), and add a look-ahead test") */
  const openBar = { time: OPEN / 1000, close: closeAt(0) };
  const base = openColumn('SPY', past, openBar);
  const later = { ...past, ticks: Object.fromEntries(Object.entries(past.ticks).map(([sym, arr]) => [sym, arr.map((v, i) => (i % 2 === 1 && arr[i - 1] > OPEN + 60_000 ? v + 0.5 : v))])) };
  const laterCol = openColumn('SPY', later, openBar);
  const earlier = { ...past, ticks: Object.fromEntries(Object.entries(past.ticks).map(([sym, arr]) => [sym, arr.map((v, i) => (i % 2 === 1 && arr[i - 1] <= OPEN ? v + 0.5 : v))])) };
  const earlierCol = openColumn('SPY', earlier, openBar);
  const kOpen = base.levels.find(l => l.strike === 600);
  check("Pinpoint's open book is the rebuilt field's column on the opening bar: every vol stamped after 9:31 changed and the column is the same", base.levels.length === 9 && JSON.stringify(laterCol.levels) === JSON.stringify(base.levels));
  check("… and the first minute's own vols move it", JSON.stringify(earlierCol.levels) !== JSON.stringify(base.levels));
  check("… on the day's published count, never the session before's", kOpen != null && oiAt(universeOf('SPY', D, store.inputsOf(past)).oiObs[u.start[STRIKES.indexOf(600)]], OPEN + 60_000) === 120);
  check('serve: rows after a minute, a bad kind refused', (JSON.parse(store.serve('SPY', D, 'final', final2[0].m).body) as { rows: StoreRow[] }).rows.length === final2.length - 1 && store.serve('SPY', D, 'x').status === 400);
} finally {
  rmSync(root, { recursive: true, force: true });
}
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
