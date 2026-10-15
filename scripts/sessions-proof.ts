/*
  THE SESSIONS AND SPX OUTSIDE ITS INDEX'S HOURS (the owner's "SPX OVERNIGHT FIELD", 2026-10-15 — core/sessions.ts,
  data/feed/forward.ts, server/overnightReader.ts, the recorder):
  - the sessions: SPY's regular hours alone; SPX's overnight session (8:15 pm the evening before to 9:25 am, none into a
    weekend or a holiday), regular hours to 4:15 pm, the curb to 5:00 pm; the half day; the trading day a minute belongs to
  - the forward: K + e^{rT}(C − P) at the three strikes nearest parity, its median — exact on quotes priced at a forward,
    unmoved by one bad strike, and 7718.10 on UW's own SPX quotes after the curb of 2026-10-14 (kept below as read)
  - a wide quote: its width in vol over 2 points is wide, under it not
  - the model: a strike priced on wide vols carries the share, a session's columns follow its name's sessions
  - the recorder at 9:00 pm New York on a Wednesday: SPX's trading day is Thursday's; Theta's quotes give the minute's
    forward (a bar "from options", session 'gth') and a chain read solved at it (the eighth figure the width); the shown
    row stands on the forward; SPY's recorder writes no row outside regular hours

    tsx scripts/sessions-proof.ts     (in `npm test`)
*/
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fieldDayOf, fieldSessionAt, fieldSpansOf, indexPrintsAt, rthCloseOf } from '../src/core/sessions';
import { forwardOf, solveQuote, volWidth, WIDE_VOL, type QuoteLeg } from '../src/data/feed/forward';
import { blackScholesGreeks, blackScholesPrice } from '../src/core/greeks';
import { lastTradeOf, modelColumn, universeOf, uwYears, UW_VOL_CONVENTION, type ChainRow } from '../src/data/feed/trailModel';
import { modelDay } from '../src/data/feed/tiles';
import { nyWallTime } from '../src/core/nyTime';
import { createFieldRecorder } from '../server/fieldRecorder';
import { createFieldStore } from '../server/fieldStore';
import { createFieldBackfill } from '../server/fieldBackfill';
import { occOf, quoteOfRow } from '../server/overnightReader';
import type { FeedClient } from '../server/feed';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (ok) pass++;
  else fail++;
};
const ny = (y: number, mo: number, d: number, h: number, m: number) => nyWallTime(y, mo, d, h, m);
const ses = (name: string, ms: number) => {
  const s = fieldSessionAt(name, ms);
  return s ? `${s.session} ${s.day}` : 'none';
};

/* ---- the sessions ------------------------------------------------------------------------------------------------- */
{
  const cases: [string, number, string][] = [
    ['SPX Wed 8:30 pm', ny(2026, 10, 14, 20, 30), 'gth 2026-10-15'],
    ['SPX Wed 8:14 pm', ny(2026, 10, 14, 20, 14), 'none'],
    ['SPX Thu 9:20 am', ny(2026, 10, 15, 9, 20), 'gth 2026-10-15'],
    ['SPX Thu 9:27 am', ny(2026, 10, 15, 9, 27), 'none'],
    ['SPX Thu 9:30 am', ny(2026, 10, 15, 9, 30), 'rth 2026-10-15'],
    ['SPX Thu 4:10 pm', ny(2026, 10, 15, 16, 10), 'rth 2026-10-15'],
    ['SPX Thu 4:30 pm', ny(2026, 10, 15, 16, 30), 'curb 2026-10-15'],
    ['SPX Thu 5:05 pm', ny(2026, 10, 15, 17, 5), 'none'],
    ['SPX Fri 8:30 pm (no session into Saturday)', ny(2026, 10, 16, 20, 30), 'none'],
    ['SPX Sun 8:30 pm (Monday\'s overnight session)', ny(2026, 10, 18, 20, 30), 'gth 2026-10-19'],
    ['SPX Wed 8:30 pm before Thanksgiving', ny(2026, 11, 25, 20, 30), 'none'],
    ['SPX Thanksgiving 8:30 pm (the half day after it)', ny(2026, 11, 26, 20, 30), 'gth 2026-11-27'],
    ['SPX the half day 1:10 pm', ny(2026, 11, 27, 13, 10), 'rth 2026-11-27'],
    ['SPX the half day 1:20 pm (no curb)', ny(2026, 11, 27, 13, 20), 'none'],
    ['SPY Thu 4:10 pm', ny(2026, 10, 15, 16, 10), 'none'],
    ['SPY Thu 9:30 am', ny(2026, 10, 15, 9, 30), 'rth 2026-10-15'],
    ['SPY Wed 8:30 pm', ny(2026, 10, 14, 20, 30), 'none'],
  ];
  const bad = cases.filter(([n, ms, want]) => ses(n.split(' ')[0], ms) !== want);
  check(`the sessions at ${cases.length} moments (${bad.length ? bad.map(([n, ms, w]) => `${n}: ${ses(n.split(' ')[0], ms)} not ${w}`).join('; ') : 'every one as Cboe and the exchanges keep them'})`, bad.length === 0);
  const spx = fieldSpansOf('SPX', '2026-10-19').map(s => `${s.session} ${new Date(s.from).toISOString().slice(5, 16)}–${new Date(s.to).toISOString().slice(5, 16)}`);
  const spy = fieldSpansOf('SPY', '2026-10-19').map(s => s.session);
  check(`a trading day's spans: SPX Monday ${spx.join(', ')} (UTC — Sunday 8:15 pm to Monday 9:25 am New York, then 9:30 to 4:15, then to 5:00); SPY ${spy.join(', ')}`, spx.length === 3 && spx[0].startsWith('gth 10-19T00:15') && spx[0].endsWith('10-19T13:25') && spx[1] === 'rth 10-19T13:30–10-19T20:15' && spx[2] === 'curb 10-19T20:15–10-19T21:00' && spy.join() === 'rth');
  check(`the index prints 9:30 to 4:00 (3:59 pm ${indexPrintsAt(ny(2026, 10, 15, 15, 59))}, 4:00 pm ${indexPrintsAt(ny(2026, 10, 15, 16, 0))}); SPX's regular close 4:15 pm, SPY's 4:00, a half day's 1:15 and 1:00`, indexPrintsAt(ny(2026, 10, 15, 15, 59)) && !indexPrintsAt(ny(2026, 10, 15, 16, 0)) && rthCloseOf('SPX', '2026-10-15') === 975 && rthCloseOf('SPY', '2026-10-15') === 960 && rthCloseOf('SPX', '2026-11-27') === 795 && rthCloseOf('SPY', '2026-11-27') === 780);
  check(`the trading day a minute belongs to: SPX Wed 9:00 pm → ${fieldDayOf('SPX', ny(2026, 10, 14, 21, 0))}, SPY → ${fieldDayOf('SPY', ny(2026, 10, 14, 21, 0))}`, fieldDayOf('SPX', ny(2026, 10, 14, 21, 0)) === '2026-10-15' && fieldDayOf('SPY', ny(2026, 10, 14, 21, 0)) === '2026-10-14');
}

/* ---- the forward ------------------------------------------------------------------------------------------------- */
const r = UW_VOL_CONVENTION.r;
const legsAt = (F: number, t: number, strikes: number[], half = 0.05, vol = (k: number) => 0.15 + Math.abs(k - F) / 5000): QuoteLeg[] =>
  strikes.flatMap(k =>
    (['C', 'P'] as const).map(right => {
      /* priced at the forward: a spot S with S·e^{rT} = F (no dividend), so parity gives F back */
      const S = F * Math.exp(-r * t);
      const p = blackScholesPrice(S, k, t, vol(k), right, r, 0);
      return { strike: k, right, bid: Math.max(0.05, p - half), ask: p + half };
    })
  );
{
  const t = 18 / (24 * 365);
  const F = 6651.37;
  const strikes = Array.from({ length: 25 }, (_, i) => 6590 + i * 5);
  const f = forwardOf(legsAt(F, t, strikes), t, r);
  check(`on quotes priced at a forward of ${F}: ${f?.forward} off strikes ${f?.strikes.join(', ')} (${f?.pairs} pairs)`, !!f && Math.abs(f.forward - F) <= 0.02);
  const legs = legsAt(F, t, strikes);
  /* one strike's call quoted badly: 6650 C at twice its price */
  const badLegs = legs.map(q => (q.strike === 6650 && q.right === 'C' ? { ...q, bid: q.bid * 2, ask: q.ask * 2 } : q));
  const g = forwardOf(badLegs, t, r);
  check(`one strike quoted wrong does not move it: ${g?.forward} (the median of the three nearest parity)`, !!g && Math.abs(g.forward - F) <= 0.05);
  check(`a book with no two-sided pair gives none`, forwardOf(legs.map(q => ({ ...q, bid: 0 })), t, r) === null);
  /* UW's SPX quotes after the curb of 2026-10-14 (read live at 10:50 pm New York; the Oct 15 expiry, 7710 to 7730):
     the three strikes nearest parity gave 7718.10, 7718.15 and 7718.10 */
  const uw: QuoteLeg[] = [
    { strike: 7715, right: 'C', bid: 10.4, ask: 10.8 },
    { strike: 7715, right: 'P', bid: 7.3, ask: 7.8 },
    { strike: 7720, right: 'C', bid: 7.8, ask: 8.2 },
    { strike: 7720, right: 'P', bid: 9.7, ask: 10.1 },
    { strike: 7725, right: 'C', bid: 5.7, ask: 6.0 },
    { strike: 7725, right: 'P', bid: 12.5, ask: 13.0 },
  ];
  const tu = 0.00198;
  const fu = forwardOf(uw, tu, r);
  check(`on a book shaped as UW's after the curb (7715, 7720, 7725): ${fu?.forward}`, !!fu && Math.abs(fu.forward - 7718.12) < 0.1);
}

/* ---- a wide quote ------------------------------------------------------------------------------------------------- */
{
  const S = 6650;
  const t = 18 / (24 * 365);
  const k = 6650;
  const iv = 0.15;
  const vega = blackScholesGreeks(S, k, t, iv, r, 0).vega * 100;
  const p = blackScholesPrice(S, k, t, iv, 'C', r, 0);
  const narrow = { strike: k, right: 'C' as const, bid: p - (vega * 0.015) / 2, ask: p + (vega * 0.015) / 2 };
  const wide = { strike: k, right: 'C' as const, bid: p - (vega * 0.025) / 2, ask: p + (vega * 0.025) / 2 };
  const a = solveQuote(narrow, S, t, r);
  const b = solveQuote(wide, S, t, r);
  check(`a quote 1.5 vol points wide is not wide (${a ? (a.width * 100).toFixed(2) : '—'} points), one 2.5 wide is (${b ? (b.width * 100).toFixed(2) : '—'}); the mid solves back to ${a ? (a.iv * 100).toFixed(2) : '—'}% (asked 15.00%); the threshold ${WIDE_VOL * 100} points`, !!a && !!b && !a.wide && b.wide && Math.abs(a.iv - iv) < 1e-4 && Math.abs(volWidth(narrow, S, t, iv, r) - 0.015) < 1e-6);
}

/* ---- the model: a strike on wide vols carries its share; a session's columns follow its name's sessions ----------- */
{
  const day = '2026-10-15';
  const at = (h: number, m: number) => ny(2026, 10, 15, h, m);
  const rows: ChainRow[] = [];
  for (const k of [6640, 6645, 6650, 6655, 6660])
    for (const right of ['C', 'P'] as const) {
      const sym = occOf({ root: 'SPXW', expiry: '2026-10-16', right, strike: k });
      /* 6660's quotes wide, the rest narrow */
      rows.push([sym, 500, 0.15, at(2, 0), 1, 1.1, 0, k === 6660 ? 0.04 : 0.005]);
    }
  const u = universeOf('SPX', day, { chains: [{ receivedAt: at(2, 0), rows }], seed: null, total: null });
  const col = modelColumn(u, { time: at(2, 5) / 1000, close: 6650 });
  const w = col.levels.find(l => l.strike === 6660)?.wideShare ?? 0;
  const n = col.levels.find(l => l.strike === 6650)?.wideShare ?? 0;
  check(`a strike priced on wide vols carries the share (6660: ${w.toFixed(2)}), one on narrow ones none (6650: ${n.toFixed(2)})`, Math.abs(w - 1) < 1e-9 && n === 0);
  /* a day's minutes, 8:15 pm the evening before to 5:00 pm: SPX's columns stand in its three sessions, SPY's in its regular hours */
  const bars = [];
  for (let t = ny(2026, 10, 14, 20, 0); t < ny(2026, 10, 15, 17, 30); t += 60_000) bars.push({ time: t / 1000, close: 6650 });
  const past = { day, oi: rows.map(x => [x[0], 500] as [string, number]), seed: { date: '2026-10-14', receivedAt: at(0, 0), rows: rows.map(x => [x[0], 0.15, at(0, 0), 500] as [string, number, number, number]) }, ticks: {}, total: null };
  const spx = modelDay({ name: 'SPX', day, past, bars });
  const spyRows = rows.map(x => [`SPY${x[0].slice(4)}`, 500] as [string, number]);
  const spy = modelDay({ name: 'SPY', day, past: { ...past, oi: spyRows, seed: { ...past.seed, rows: spyRows.map(([s]) => [s, 0.15, at(0, 0), 500] as [string, number, number, number]) } }, bars });
  const minuteOf = (sec: number) => {
    const m = Math.round((sec * 1000 - ny(2026, 10, 14, 0, 0)) / 60_000);
    return m;
  };
  const gth = spx.filter(c => minuteOf(c.time) < 24 * 60 + 9 * 60 + 25).length;
  const rth = spx.filter(c => minuteOf(c.time) >= 24 * 60 + 570 && minuteOf(c.time) < 24 * 60 + 975).length;
  const curb = spx.filter(c => minuteOf(c.time) >= 24 * 60 + 975).length;
  check(`SPX's day: ${gth} overnight columns (8:15 pm to 9:25 am — 790), ${rth} regular (9:30 to 4:15 — 405), ${curb} curb (to 5:00 — 45), none between; SPY's ${spy.length} (9:30 to 4:00 — 390)`, gth === 790 && rth === 405 && curb === 45 && spx.length === 1240 && spy.length === 390);
}

/* ---- the reader's parsing ---------------------------------------------------------------------------------------- */
{
  const q = quoteOfRow({ symbol: 'SPXW', expiration: '20261015', strike: 6650.0, right: 'CALL', bid: 12.3, ask: 12.9, timestamp: '2026-10-14T21:00:01.250' }, 'SPXW');
  const q2 = quoteOfRow({ symbol: 'SPXW', expiration: '2026-10-15', strike: 6650000, right: 'P', bid: 10, ask: 10.5, timestamp: '2026-10-14T21:00:01.250' }, 'SPXW');
  check(`Theta's quote rows read either way (v3 dollars and CALL, v2 thousandths and P): ${q && occOf(q)} at ${q && new Date(q.at).toISOString()}; ${q2 && occOf(q2)}`, !!q && occOf(q) === 'SPXW261015C06650000' && q.at === ny(2026, 10, 14, 21, 0) + 1250 && !!q2 && occOf(q2) === 'SPXW261015P06650000');
}

/* ---- the recorder at 9:00 pm New York on a Wednesday --------------------------------------------------------------- */
{
  const F = 6651.37;
  const D = '2026-10-15';
  let now = ny(2026, 10, 14, 21, 0) + 5_000;
  const strikes = Array.from({ length: 41 }, (_, i) => 6550 + i * 5);
  const exps = ['2026-10-15', '2026-10-16'];
  const iso = (ms: number) => new Date(ms).toISOString();
  const okUw = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }), from: 'upstream' as const });
  const nyStamp = (ms: number) => {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms));
    const g = (t: string) => p.find(x => x.type === t)!.value;
    return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}:${g('second')}.000`;
  };
  const thetaRows = (front: boolean) =>
    exps.flatMap(e => {
      if (front && e !== exps[0]) return [];
      const t = uwYears(now, lastTradeOf(e), e, D);
      /* far strikes quoted wide (4 vol points), the money's narrow */
      return legsAt(F, t, strikes, 0.05).map(q => {
        const far = Math.abs(q.strike - F) > 60;
        const S = F * Math.exp(-r * t);
        const vega = blackScholesGreeks(S, q.strike, t, 0.15 + Math.abs(q.strike - F) / 5000, r, 0).vega * 100;
        const mid = (q.bid + q.ask) / 2;
        const half = far ? Math.max(0.05, vega * 0.02) : 0.05;
        return { symbol: 'SPXW', expiration: e.replace(/-/g, ''), strike: q.strike, right: q.right === 'C' ? 'CALL' : 'PUT', bid: Math.max(0.01, mid - half), ask: mid + half, timestamp: nyStamp(now - 2_000) };
      });
    });
  const asked: string[] = [];
  const client = {
    hasKey: () => true,
    get: async (p: string, path: string) => {
      asked.push(`${p} ${path}`);
      if (p === 'theta') {
        if (path.includes('expiration=*')) return { status: 200, contentType: 'application/json', body: JSON.stringify({ rows: path.includes('symbol=SPXW') ? thetaRows(false) : [] }), from: 'upstream' as const };
        if (path.includes('/snapshot/quote')) return { status: 200, contentType: 'application/json', body: JSON.stringify({ rows: thetaRows(true) }), from: 'upstream' as const };
        return { status: 404, contentType: 'application/json', body: '{}', from: 'upstream' as const };
      }
      const page = Number(/page=(\d+)/.exec(path)?.[1] ?? 0);
      if (path.includes('/spot-exposures/strike')) return okUw([{ strike: '6650', price: '6650', time: iso(now) }]);
      if (path.includes('/option-contracts?')) return okUw(page ? [] : exps.flatMap(e => strikes.flatMap(k => (['C', 'P'] as const).map(rt => ({ option_symbol: occOf({ root: 'SPXW', expiry: e, right: rt, strike: k }), open_interest: 700, implied_volatility: '0.16', last_tape_time: '2026-10-14T21:45:00Z', nbbo_bid: '1', nbbo_ask: '1.2', volume: 0 })))));
      if (path.includes('/option-chains?date=')) return okUw(page ? [] : exps.flatMap(e => strikes.flatMap(k => (['C', 'P'] as const).map(rt => ({ option_symbol: occOf({ root: 'SPXW', expiry: e, right: rt, strike: k }), expires: e, strike: String(k), implied_volatility: '0.16', open_interest: 650, last_tape_time: '2026-10-14T20:00:00Z' })))));
      return okUw([]);
    },
  } as unknown as FeedClient;
  const root = mkdtempSync(join(tmpdir(), 'slayer-sessions-'));
  try {
    const clock = () => now;
    const bf = createFieldBackfill(client, { now: clock, root });
    const store = createFieldStore({ root, now: clock });
    const rec = createFieldRecorder(client, { now: clock, root, backfill: bf, store });
    const first = JSON.parse(rec.serve('SPX').body) as { day: string };
    await rec.settle();
    now = ny(2026, 10, 14, 21, 1) + 10_000;
    await rec.tick();
    await rec.settle();
    now = ny(2026, 10, 14, 21, 2) + 10_000;
    await rec.tick();
    await rec.settle();
    const served = JSON.parse(rec.serve('SPX').body) as { day: string; bars: [number, number, number, number, number, string, number][]; fwd: { forward: number }[]; chains: { src?: string; rows: ChainRow[] }[]; theta: { state: string } | null };
    const fwdLines = readFileSync(join(root, 'SPX', D, 'fwd.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l) as { forward: number; strikes: number[] });
    const S0 = F * Math.exp(-r * uwYears(ny(2026, 10, 14, 21, 1) + 10_000, lastTradeOf(exps[0]), exps[0], D));
    check(`SPX at 9:00 pm Wednesday is Thursday's trading day (${first.day}); the forward a minute off Theta's front-expiry quotes: ${fwdLines.map(f => f.forward).join(', ')} (the quotes priced at ${F})${fwdLines[1] ? `, its spot on the carry ${(fwdLines[1] as { spot?: number }).spot}` : ''}; Theta ${served.theta?.state}`, first.day === D && fwdLines.length === 3 && fwdLines.every(f => Math.abs(f.forward - F) < 0.05) && served.theta?.state === 'ok');
    const bar = served.bars.find(b => b[0] === Math.floor((ny(2026, 10, 14, 21, 1) + 10_000) / 60_000) * 60);
    check(`the minute's bar is the spot the forward implies (${S0.toFixed(2)}), session overnight, priced from options: ${bar ? `[${bar.slice(4).join(', ')}]` : 'none'}`, !!bar && Math.abs(bar[4] - S0) < 0.05 && bar[5] === 'gth' && bar[6] === 1);
    const tq = served.chains.filter(c => c.src === 'theta');
    const rowsQ = tq[0]?.rows ?? [];
    const wideN = rowsQ.filter(x => (x[7] ?? 0) > WIDE_VOL).length;
    const atm = rowsQ.find(x => x[0] === occOf({ root: 'SPXW', expiry: '2026-10-16', right: 'C', strike: 6650 }));
    check(`one chain read off Theta's quotes in the ten minutes (${tq.length}), ${rowsQ.length} contracts solved at the forward, ${wideN} of them wide (the far strikes, quoted 4 points wide); 6650 C Friday at ${atm ? ((atm[2] ?? 0) * 100).toFixed(2) : '—'}% (asked ${(0.15 + Math.abs(6650 - F) / 5000) * 100}%), its count UW's (${atm?.[1]})`, tq.length === 1 && rowsQ.length > 100 && wideN > 0 && wideN < rowsQ.length && !!atm && Math.abs((atm[2] ?? 0) - (0.15 + Math.abs(6650 - F) / 5000)) < 0.002 && atm[1] === 700);
    const shown = store.readRows('SPX', D, 'shown');
    const r1 = shown.find(x => x.m === Math.floor(ny(2026, 10, 14, 21, 1) / 60_000) * 60_000);
    check(`the shown row at 9:01 pm stands on the options' price in the overnight session: ${r1 ? `${r1.session} at ${r1.spot}` : 'none'} (${shown.length} rows)`, !!r1 && r1.session === 'gth' && Math.abs(r1.spot - S0) < 0.05);
    const thetaAsks = asked.filter(a => a.startsWith('theta')).length;
    check(`Theta asked ${thetaAsks} times in three minutes: a forward a minute and one chain (two roots)`, thetaAsks === 5);
    /* SPY watched the same evening writes no row: outside its regular hours */
    rec.serve('SPY');
    await rec.settle();
    now = ny(2026, 10, 14, 21, 4) + 10_000;
    await rec.tick();
    await rec.settle();
    check(`SPY writes no row outside its regular hours (${store.readRows('SPY', '2026-10-14', 'shown').length})`, store.readRows('SPY', '2026-10-14', 'shown').length === 0);
    rec.stop();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
