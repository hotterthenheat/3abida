/*
  Acceptance test for Terrain's modeled field (data/feed/trailField.ts, 2026-10-13) and its scale (gexNodesPrimitive) —
  pure rules, no browser, no vendor. The research's gates (reports/Dealer exposure reconstruction.md §8):
  1. NO LOOK-AHEAD: perturb every input knowable after a minute — a later chain read's vols — and the minute's cell is
     unchanged; the minute after that read moves
  2. Before the day's first read a cell stands on the session before's close vols and says so ('carried'); after it,
     'modeled'
  3. A contract with no vol stays out (its strike's coverage drops, nothing zero-filled); a strike with none is a gap
  4. A vol read in its expiry's last hour is not used; a contract past its last-trading instant holds nothing
  5. The bead scale runs forward: columns added to the right never change a column's reference on the left
  6. UW'S CONVENTION: a contract is priced on the clock and carry UW solved its vol under, so its gamma at UW's vol is
     UW's own — checked on four real SPY prints of 2026-10-12 (UW's /option-trades: price, vol, gamma as UW answered);
     on calendar time to the close the day-after contract misses by more, so the check tells the two apart
  7. A vol stamped after the close is a bound: its print's time is said as "at or before", never as a time
  8. A PAST SESSION'S MINUTE VOLS (server/fieldBackfill.ts `ticks`): a minute's vol is the field's from that minute's
     end — never the minute before — and makes the cell 'modeled'; one in its expiry's last hour is not used
  10. OPEN INTEREST AS RECEIVED (the owner's second review, 2026-10-13, item 4): a column stands on the count of the
      newest chain read received at or before its end — before the day's first read, on the seed's count, dated the
      session before; a count received after a minute never moves it; with no count received and no seed count there
      is no cell
  11. A BAR'S CELL IS ITS PEAK MINUTE (item 6): on a five-minute texture each strike keeps the minute of the bar with
      the largest magnitude, with that minute's own time and vols — a minute past the bar's end belongs to the next bar
  9. THE TERRAIN AUDIT (2026-10-13): the flip is the linear zero crossing between the two strikes of opposite sign, never
     their midpoint; the residual measures the field against UW's book on the SAME strikes and expiries (the 60-day
     books), never its whole-book series — the sign agrees where the books agree; the card's measured line names its
     universe, the 60-day book within ten minutes before the every-expiry book
*/
import { fieldResidual, measuredAt, modelColumn, residualFigures, setMeasuredSource, universeOf, uwYears, UW_VOL_CONVENTION, type SeedRow, type ServerInputs } from '../src/data/feed/trailField';
import { aggregateSnapshots } from '../src/data/timeframe';
import { pickFlip, zeroCrossings } from '../src/core/walls';
import type { FeedBook, FeedBook60 } from '../src/data/feed/levels';
import { blackScholesGreeks } from '../src/core/greeks';
import { nyWallTime } from '../src/core/nyTime';
import { GexTrailsPrimitive } from '../src/components/gex/gexNodesPrimitive';
import type { GexSnapshot } from '../src/types/market';

let pass = 0, fail = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (ok) pass++;
  else fail++;
};

const day = '2026-10-12';
const at = (h: number, m: number) => nyWallTime(2026, 10, 12, h, m);
const sec = (h: number, m: number) => at(h, m) / 1000;
/* SPY round 600: today's expiry and Friday's, calls and puts at 595–605; 603 has no vol anywhere */
const syms: string[] = [];
for (const exp of ['261012', '261016'])
  for (const k of [595, 596, 597, 598, 599, 600, 601, 602, 603, 604, 605])
    for (const r of ['C', 'P']) syms.push(`SPY${exp}${r}${String(k * 1000).padStart(8, '0')}`);
const noVol = (s: string) => s.includes('00603000');
const read = (h: number, m: number, iv: number) => ({
  receivedAt: at(h, m),
  rows: syms.map(s => [s, s.includes('C0') ? 1000 : 1500, noVol(s) ? null : iv, at(h, m) - 60_000] as [string, number, number | null, number | null]),
});
/* the seed carries the session before's dated count — the pre-market stands on it until today's is received */
const seedOi = (s: string) => (s.includes('C0') ? 1000 : 1500);
const seed = { date: '2026-10-09', receivedAt: at(8, 0), rows: syms.map(s => [s, noVol(s) ? null : 0.15, at(8, 0), seedOi(s)] as SeedRow) };
const base: ServerInputs = { chains: [read(10, 0, 0.12), read(12, 0, 0.12)], seed, total: null };
const bar = (h: number, m: number, close: number) => ({ time: sec(h, m), close });

const u = universeOf('SPY', day, base);
const early = modelColumn(u, bar(9, 45, 600.2));
const mid = modelColumn(u, bar(11, 0, 600.2));
const late = modelColumn(u, bar(12, 30, 600.2));

/* 1. look-ahead: the 12:00 read's vols changed — 11:00 must not move, 12:30 must */
{
  const moved: ServerInputs = { ...base, chains: [read(10, 0, 0.12), read(12, 0, 0.3)] };
  const u2 = universeOf('SPY', day, moved);
  const mid2 = modelColumn(u2, bar(11, 0, 600.2));
  const late2 = modelColumn(u2, bar(12, 30, 600.2));
  check('a later read never moves an earlier minute', JSON.stringify(mid2.levels) === JSON.stringify(mid.levels));
  check('…and moves the minutes after it', JSON.stringify(late2.levels) !== JSON.stringify(late.levels));
  /* and a read received during a bar's minute is not that minute's: knowable at the bar's end */
  const u3 = universeOf('SPY', day, { ...base, chains: [read(10, 0, 0.12), { ...read(11, 0, 0.3), receivedAt: at(11, 0) + 61_000 }] });
  check('a read received after a bar ends is not that bar\'s', JSON.stringify(modelColumn(u3, bar(11, 0, 600.2)).levels) === JSON.stringify(mid.levels));
}
/* 2. carried before the first read, modeled after */
check("before the day's first read every cell is 'carried'", early.levels.length > 0 && early.levels.every(l => l.prov === 'carried'));
check("after it, 'modeled'", mid.levels.every(l => l.prov === 'modeled'));
check('a carried cell is stale since the close it came from', early.levels.every(l => l.staleSince === at(8, 0)));
/* 3. no vol, no contract — a gap, never a nought */
check('a strike with no vol anywhere is left out (a gap)', !mid.levels.some(l => l.strike === 603));
{
  const partial: ServerInputs = { ...base, chains: [{ ...read(10, 0, 0.12), rows: read(10, 0, 0.12).rows.map(r => (r[0].startsWith('SPY261016C') && r[0].includes('00600000') ? [r[0], r[1], null, null] : r) as [string, number, number | null, number | null]) }], seed: null };
  const c = modelColumn(universeOf('SPY', day, partial), bar(11, 0, 600.2)).levels.find(l => l.strike === 600);
  const full = mid.levels.find(l => l.strike === 600);
  /* the Friday 600 call's gamma (negative in the house's sign) is out of the sum, so the strike's net rises */
  check("a contract with no vol stays out of its strike's sum", !!c && !!full && c.value > full.value);
}
/* 4. the last hour, and past the expiry */
{
  /* a 15:30 read of today's expiry alone, at 500%: inside its last hour, so the 12:00 read's vols stand */
  const late530 = read(15, 30, 5);
  const lateRead: ServerInputs = { ...base, chains: [read(10, 0, 0.12), read(12, 0, 0.12), { ...late530, rows: late530.rows.filter(r => r[0].startsWith('SPY261012')) }] };
  const c = modelColumn(universeOf('SPY', day, lateRead), bar(15, 45, 600.2));
  const ref = modelColumn(universeOf('SPY', day, base), bar(15, 45, 600.2));
  check("a vol read in its expiry's last hour is not used", JSON.stringify(c.levels.map(l => [l.strike, l.value])) === JSON.stringify(ref.levels.map(l => [l.strike, l.value])));
  const after = modelColumn(u, bar(16, 30, 600.2));
  const before = modelColumn(u, bar(15, 58, 600.2));
  const at600 = (s: GexSnapshot) => Math.abs(s.levels.find(l => l.strike === 600)?.value ?? 0);
  check("today's expiry holds nothing past its last-trading instant", at600(after) < at600(before) / 3);
}
/* 5. the scale runs forward */
{
  const snaps = (n: number, big: number): GexSnapshot[] =>
    Array.from({ length: n }, (_, i) => ({ time: 1_000_000 + i * 60, levels: [{ strike: 600, value: i >= 10 ? big : 1e6 + i * 1e4 }, { strike: 601, value: -5e5 }] }));
  const a = snaps(10, 0);
  const prim = new GexTrailsPrimitive();
  prim.setData(a, 1, true, 60, 'gex');
  const refsA = [...(prim as unknown as { refs: number[] }).refs];
  prim.setData([...a, ...snaps(20, 1e9).slice(10)], 1, true, 60, 'gex');
  const refsB = (prim as unknown as { refs: number[] }).refs;
  check('columns added on the right never rescale those on the left', refsA.every((r, i) => r === refsB[i]) && refsB[19] > refsA[9]);
}
/* 5b. the scale is per session, and square-root on magnitude (the owner, 2026-10-13) */
{
  const mon = (i: number) => nyWallTime(2026, 10, 12, 10, i) / 1000;
  const tue = (i: number) => nyWallTime(2026, 10, 13, 10, i) / 1000;
  const loud = Array.from({ length: 10 }, (_, i) => ({ time: mon(i), levels: [{ strike: 600, value: 1e10 }, { strike: 601, value: -1e9 }] }));
  const quiet = Array.from({ length: 10 }, (_, i) => ({ time: tue(i), levels: [{ strike: 600, value: 1e8 }, { strike: 601, value: -2.5e7 }] }));
  const prim = new GexTrailsPrimitive();
  prim.setData([...loud, ...quiet], 1, true, 60, 'gex');
  const refs = (prim as unknown as { refs: number[] }).refs;
  check("a session's scale is its own — a loud session before it does not dim it", refs[10] < 2e8 && refs[9] > 5e9);
  const col = prim.columnAt(15);
  const t600 = col.all.get(600)!.t;
  const t601 = col.all.get(601)!.t;
  check('brightness is the square root of size against the reference', Math.abs(t601 / t600 - Math.sqrt(2.5e7 / 1e8)) < 1e-9);
}

/* 6. UW's convention, on real prints (SPY, 2026-10-12, 09:59:5x New York: [symbol, expiry, print time, price, strike,
   vol, gamma] as UW answered) */
{
  const prints: [string, string, string, number, number, number, number][] = [
    ['SPY261012P00777000', '2026-10-12', '2026-10-12T13:59:59.880Z', 778.54, 777, 0.1144769715320563, 0.1364808588349014],
    ['SPY261013P00772000', '2026-10-13', '2026-10-12T13:59:59.799Z', 778.54, 772, 0.128168583568504, 0.03376845975134069],
    ['SPY261016P00782000', '2026-10-16', '2026-10-12T13:59:59.440Z', 778.5542, 782, 0.1093515573612423, 0.04224104173145146],
    ['SPY261106P00775000', '2026-11-06', '2026-10-12T13:59:55.865Z', 778.5401, 775, 0.1283530614439347, 0.01483321462715531],
  ];
  const close = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return nyWallTime(y, m, d, 16, 0);
  };
  let worst = 0;
  let calMiss = 0;
  for (const [, exp, when, S, K, iv, g] of prints) {
    const t = Date.parse(when);
    const mine = blackScholesGreeks(S, K, uwYears(t, close(exp), exp, day), iv, UW_VOL_CONVENTION.r, UW_VOL_CONVENTION.q).gamma;
    worst = Math.max(worst, Math.abs(mine / g - 1));
    if (exp === '2026-10-13') calMiss = Math.abs(blackScholesGreeks(S, K, (close(exp) - t) / (365 * 864e5), iv).gamma / g - 1);
  }
  check(`a contract's gamma at UW's vol is UW's own (worst of four ${(worst * 100).toFixed(3)}%)`, worst < 0.001);
  check(`…where calendar time to the close and the house's carry miss the next day's by ${(calMiss * 100).toFixed(1)}%`, calMiss > 0.03);
  /* a later expiry's clock is whole days, the same all session; today's runs down */
  const fri = (h: number) => modelColumn(universeOf('SPY', day, { ...base, chains: [read(9, 30, 0.12)], seed: null }), bar(h, 0, 600.2));
  const tue = (s: GexSnapshot) => s.levels.find(l => l.strike === 600)?.value ?? 0;
  const friOnly = (h: number) => {
    const inputs: ServerInputs = { chains: [{ ...read(9, 30, 0.12), rows: read(9, 30, 0.12).rows.filter(r => r[0].startsWith('SPY261016')) }], seed: null, total: null };
    return tue(modelColumn(universeOf('SPY', day, inputs), bar(h, 0, 600.2)));
  };
  check("a later expiry's clock is the same all session (whole days)", friOnly(10) === friOnly(15));
  check("today's expiry's clock runs down through the session", tue(fri(10)) !== tue(fri(15)));
}
/* 7. a vol stamped after the close: a bound, its time the close's last print at the latest */
{
  const stamp = at(17, 42);
  const r = read(10, 0, 0.12);
  const u4 = universeOf('SPY', day, { chains: [{ ...r, rows: r.rows.map(x => [x[0], x[1], x[2], stamp] as [string, number, number | null, number | null]) }], seed: null, total: null });
  const c = modelColumn(u4, bar(11, 0, 600.2)).levels.find(l => l.strike === 600);
  check('a vol stamped after the close is a bound at the session\'s last print, never the stamp', !!c && c.staleBound === true && c.staleSince === at(16, 15));
  check('a vol with its own print time is not a bound', mid.levels.every(l => !l.staleBound));
}

/* 8. a past session's minute vols */
{
  const positions: ServerInputs = { chains: [{ receivedAt: at(9, 30), rows: syms.map(s => [s, s.includes('C0') ? 1000 : 1500, null, null] as [string, number, number | null, number | null]) }], seed, total: null };
  const ticks: Record<string, number[]> = {};
  /* every contract traded at 10:42 at 30% vol; today's expiry also at 15:30, inside its last hour, at 500% */
  for (const sym of syms) ticks[sym] = sym.startsWith('SPY261012') ? [at(10, 42), 0.3, at(15, 30), 5] : [at(10, 42), 0.3];
  const withTicks = universeOf('SPY', day, { ...positions, ticks });
  const without = universeOf('SPY', day, positions);
  const same = (a: GexSnapshot, b: GexSnapshot) => JSON.stringify(a.levels.map(l => [l.strike, l.value])) === JSON.stringify(b.levels.map(l => [l.strike, l.value]));
  check("a past minute's vol is not the minute before's", same(modelColumn(withTicks, bar(10, 41, 600.2)), modelColumn(without, bar(10, 41, 600.2))));
  const m42 = modelColumn(withTicks, bar(10, 42, 600.2));
  check("…it is that minute's own (knowable at its end), and the cell is 'modeled'", !same(m42, modelColumn(without, bar(10, 42, 600.2))) && m42.levels.every(l => l.prov === 'modeled'));
  const only1042: Record<string, number[]> = Object.fromEntries(syms.map(s => [s, [at(10, 42), 0.3]]));
  check("a past minute's vol in its expiry's last hour is not used", same(modelColumn(withTicks, bar(15, 40, 600.2)), modelColumn(universeOf('SPY', day, { ...positions, ticks: only1042 }), bar(15, 40, 600.2))));
}

/* 9. the audit: the flip's crossing, the residual's universe, the card's reference */
{
  /* 9a. a +3 at 777 and a −1 at 778 cross zero at 777.75 — the midpoint 777.50 would be wrong */
  const pts = [
    { strike: 776, value: 5 },
    { strike: 777, value: 3 },
    { strike: 778, value: -1 },
    { strike: 779, value: -4 },
    { strike: 780, value: 2 },
  ];
  const xs = zeroCrossings(pts, p => p.value);
  check('the flip is the linear zero crossing between the strikes of opposite sign, never the midpoint', xs[0] === 777.75 && xs[1] === 779.67);
  check('…and the flip is the crossing nearest spot', pickFlip(pts, 779.9, p => p.value) === 779.67 && pickFlip(pts, 777.2, p => p.value) === 777.75);
  check('a strike at exactly zero is a crossing; a one-sided book has none', zeroCrossings([{ strike: 1, value: 2 }, { strike: 2, value: 0 }, { strike: 3, value: 1 }], p => p.value)[0] === 2 && pickFlip([{ strike: 1, value: 2 }, { strike: 2, value: 1 }], 1.5, p => p.value) === null);

  /* 9b. the residual: the model's columns against a 60-day book on the strikes both hold */
  const col = modelColumn(u, bar(10, 30, 600.2));
  const t = sec(10, 30) * 1000 + 30_000;
  const agree: FeedBook60 = { at: t, spot: 600.2, expiries: ['2026-10-12', '2026-10-16'], rows: col.levels.map(l => ({ strike: l.strike, net: l.value * 1.25, call: 0, put: 0 })) };
  const flipped: FeedBook60 = { ...agree, rows: col.levels.map(l => ({ strike: l.strike, net: -l.value * 1.25, call: 0, put: 0 })) };
  const wider: FeedBook60 = { ...agree, rows: [...agree.rows, { strike: 10, net: 1e12, call: 0, put: 0 }, { strike: 5000, net: -1e12, call: 0, put: 0 }] };
  const fig = residualFigures([col], [agree]);
  check('a book 1.25× the model on every strike: gap 20% of its size, the same sign, 0.80× summed', fig.books === 1 && Math.abs(fig.gaps[0] - 0.2) < 1e-9 && fig.same === 1 && Math.abs(fig.ratios[0] - 0.8) < 1e-9);
  check('a book of the other sign disagrees in sign', residualFigures([col], [flipped]).same === 0);
  check('strikes the model does not hold are left out of the comparison', JSON.stringify(residualFigures([col], [wider])) === JSON.stringify(fig));
  check('a book at a minute the model has no column for is not counted', residualFigures([col], [{ ...agree, at: t + 3_600_000 }]).books === 0);
  const line = fieldResidual([col], [agree]);
  check('the line names the universe and says the sign and the ratio', !!line && line.includes('same strikes and expiries') && line.includes('within 60 days') && line.includes('1 of 1') && line.includes('0.80×') && !line.includes('whole-book'));
  check('no 60-day book read yet → no line', fieldResidual([col], []) === null);

  /* 9c. the card's reference: the 60-day book within ten minutes, else the every-expiry book, each named */
  const every: FeedBook = {
    at: t - 60_000,
    spot: 600.2,
    rows: [{ strike: 600, time: t - 60_000, gex: { net: -7e8, call: 0, put: 0 } }],
  } as unknown as FeedBook;
  setMeasuredSource(() => [every], () => [agree]);
  const m600 = measuredAt('SPY', 600, sec(10, 30));
  check("within ten minutes of a 60-day book the card shows UW's 60-day figure, named", !!m600 && m600.universe === '60 days' && m600.value === agree.rows.find(r => r.strike === 600)!.net);
  const later = measuredAt('SPY', 600, sec(10, 50));
  check('twenty minutes on, the every-expiry book stands, named', !!later && later.universe === 'every expiry' && later.value === -7e8);
  check('no book at all → null', measuredAt('SPY', 600, sec(10, 0)) === null);
  setMeasuredSource(() => [], () => []);
}

/* 10. open interest as received */
{
  const v600 = (c: GexSnapshot) => c.levels.find(l => l.strike === 600)?.value ?? NaN;
  const sameV = (a: GexSnapshot, b: GexSnapshot) => JSON.stringify(a.levels.map(l => [l.strike, l.value])) === JSON.stringify(b.levels.map(l => [l.strike, l.value]));
  const withSeed = (k: number): ServerInputs => ({ ...base, seed: { ...seed, rows: seed.rows.map(([s, iv, t]) => [s, iv, t, seedOi(s) * k] as SeedRow) } });
  const u1 = universeOf('SPY', day, withSeed(1));
  const u2 = universeOf('SPY', day, withSeed(2));
  const e1 = modelColumn(u1, bar(9, 45, 600.2));
  const e2 = modelColumn(u2, bar(9, 45, 600.2));
  check("before the day's first chain read a column stands on the seed's count (twice the count, twice the cell)", Math.abs(v600(e2) / v600(e1) - 2) < 1e-9);
  check("…and a column after the first read stands on the read's count, whatever the seed held", sameV(modelColumn(u1, bar(11, 0, 600.2)), modelColumn(u2, bar(11, 0, 600.2))));
  const tripled = read(12, 0, 0.12);
  tripled.rows = tripled.rows.map(r => [r[0], r[1] * 3, r[2], r[3]] as typeof r);
  const ub = universeOf('SPY', day, { ...base, chains: [read(10, 0, 0.12), tripled] });
  check('a count received at 12:00 never moves the 11:00 column', sameV(modelColumn(ub, bar(11, 0, 600.2)), mid));
  check('…and the 12:30 column stands on it (three times the count, three times the cell)', Math.abs(v600(modelColumn(ub, bar(12, 30, 600.2))) / v600(late) - 3) < 1e-9);
  check('no count received yet and no seed count → no cell', modelColumn(universeOf('SPY', day, { ...base, seed: null }), bar(9, 45, 600.2)).levels.length === 0);
}

/* 11. a bar's cell is its peak minute */
{
  const minute = (h: number, m: number, value: number): GexSnapshot => ({ time: sec(h, m), levels: [{ strike: 600, value, prov: 'modeled', freshAt: at(h, m) - 20_000 }], spot: 600 });
  const snaps = [minute(15, 35, 1e8), minute(15, 36, -2e8), minute(15, 37, 5e8), minute(15, 38, 3e8), minute(15, 39, 4e8), minute(15, 40, 9e8)];
  const bars = aggregateSnapshots(snaps, 5);
  const b = bars.find(x => x.time === sec(15, 35));
  const l = b?.levels.find(x => x.strike === 600);
  check("a five-minute bar's cell is its heaviest minute, with that minute's own time and vols", !!l && l.value === 5e8 && l.at === sec(15, 37) && l.freshAt === at(15, 37) - 20_000);
  check("a minute past the bar's end is the next bar's, never this one's", bars.length === 2 && bars[1].time === sec(15, 40) && bars[1].levels[0].value === 9e8);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
