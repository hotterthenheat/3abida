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
*/
import { modelColumn, universeOf, uwYears, UW_VOL_CONVENTION, type ServerInputs } from '../src/data/feed/trailField';
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
const seed = { date: '2026-10-09', receivedAt: at(8, 0), rows: syms.map(s => [s, noVol(s) ? null : 0.15, at(8, 0)] as [string, number | null, number | null]) };
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

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
