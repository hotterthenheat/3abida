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
*/
import { modelColumn, universeOf, type ServerInputs } from '../src/data/feed/trailField';
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

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
