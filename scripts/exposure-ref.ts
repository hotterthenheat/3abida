/*
  THE EXPOSURE BOOK'S PARITY FIXTURE (2026-09-17). Runs the TypeScript exposure
  engines — the simulator's chain builder, buildExposureProfile,
  buildExposureSurface, the walls and the air pockets — over the simulator's
  seeded books and writes INPUTS and OUTPUTS to
  engine/tests/fixtures/exposure_ref.json for engine/tests/test_exposure_parity.py.

  Every number the Python is held to comes from calling the engine. The
  simulator's texture (the leg jitter, the volume hash, the desk's modelled
  chains per expiry) is written as INPUT, so the port takes it the way the live
  loop will take a real chain: as given.

    npx tsx scripts/exposure-ref.ts
    cd engine && .venv/Scripts/python -m pytest -q
*/

import { mkdirSync, writeFileSync } from 'node:fs';
import Simulator from '../src/core/simulator';
import { setEngineClock } from '../src/core/clock';
import { isoDate } from '../src/core/calendar';
import { pickFlip, pickWalls } from '../src/core/walls';
import { findAirPockets } from '../src/data/airPockets';
import { buildExposureProfile, legJitter, strikeVolume, type StrikeWindow } from '../src/data/exposure';
import { buildExposureSurface, CALENDAR_DTES } from '../src/data/exposureSurface';
import { spotChangePct } from '../src/data/gex';
import { buildDeskChain, DESK_DTES, type DeskContract } from '../src/data/weigherDesk';
import type { ExposureExpiry, StrikeExposure } from '../src/types/gex';

/* a Thursday session, pinned, so every horizon resolves the same way on every run */
setEngineClock(() => new Date(2026, 8, 17, 10, 30));

const NAMES = ['SPY', 'QQQ', 'AAPL', 'NVDA', 'TSLA'];
/* (the window's half, the lens, the calendar to draw — null draws no surface) */
const CASES: [StrikeWindow, ExposureExpiry, readonly number[] | null][] = [
  [10, '0DTE', DESK_DTES],
  [15, 'OPEX', null],
  [20, 'ALL', null],
];
/* one name also draws the whole book and the ledger's own calendar (the fixture stays under 1.5 MB) */
const WIDE: typeof CASES = [
  [30, '0DTE', DESK_DTES],
  [20, '0DTE', CALENDAR_DTES],
];

/* one expiry's contracts as the port reads them: iv as a FRACTION, the rest as the desk states it */
const leg = (x: DeskContract) => ({ oi: x.oi, iv: x.iv / 100, gamma: x.gamma, delta: x.delta, vega: x.vega });
const desk = (ticker: string, dte: number, half: number) => {
  const c = buildDeskChain(ticker, dte, half);
  return { dte, sessions: c.expiry.sessions, date: isoDate(c.expiry.date), rows: c.rows.map(r => ({ strike: r.strike, put: leg(r.put), call: leg(r.call) })) };
};

const books = NAMES.map(name => {
  const snapshot = Simulator.snapshotFor(name);
  const { ticker, spot, chain } = snapshot;
  const cases = [...CASES, ...(name === 'SPY' ? WIDE : [])].map(([half, expiry, dtes]) => {
    const profile = buildExposureProfile(snapshot, expiry, half);
    const jitter = chain.map(n => legJitter(ticker, n.strike, expiry));
    let surface: unknown = null;
    if (dtes) {
      const { front: _front, ...out } = buildExposureSurface(snapshot, half, dtes);
      surface = { dtes: [...dtes], desk: dtes.map(dte => desk(ticker, dte, half)), out };
    }
    return { half, expiry, jitter, profile, surface };
  });
  return {
    ticker,
    spot,
    iv: Simulator.TICKERS[ticker].iv,
    changePct: spotChangePct(ticker),
    chain,
    volume: chain.map(n => strikeVolume(ticker, n.strike, n.callOI + n.putOI)),
    cases,
  };
});

/* the wall and flip rules on books drawn to hit their edges — the inputs are chosen, the answers are the engine's */
const wallBooks: { name: string; spot: number; points: [number, number][] }[] = [
  { name: 'two-sided', spot: 100, points: [[95, 3], [97, 1], [99, -0.5], [101, -2], [103, -4], [105, -1]] },
  { name: 'one-sided, all call-dominant: no put wall, no flip', spot: 100, points: [[95, -3], [97, -1], [99, -0.5], [101, -2], [103, -4]] },
  { name: 'one-sided, all put-dominant: no call wall, no flip', spot: 100, points: [[95, 3], [97, 1], [99, 0.5], [101, 2], [103, 4]] },
  { name: 'a zero at spot flips against both neighbours', spot: 100, points: [[98, 2], [99, 1], [100, 0], [101, -1], [102, -2]] },
  { name: 'tied magnitudes: the first wins', spot: 100, points: [[96, 5], [98, 5], [102, -5], [104, -5]] },
  { name: 'a sticky book: the call shelf sits below spot', spot: 100, points: [[95, 2], [97, -6], [99, -1], [101, 1], [103, -3]] },
  { name: 'two crossings: the near one is the flip', spot: 100, points: [[90, 1], [92, -1], [94, -1], [99, -1], [101, 1], [110, 1]] },
  { name: 'unsorted input', spot: 100, points: [[103, -4], [95, 3], [101, -2], [97, 1], [99, -0.5]] },
  { name: 'a strike at spot belongs to neither side', spot: 100, points: [[99, 1], [100, -9], [101, -1]] },
  { name: 'one strike', spot: 100, points: [[100, 1]] },
  { name: 'empty', spot: 100, points: [] },
];
const walls = wallBooks.map(b => {
  const points = b.points.map(([strike, v]) => ({ strike, v }));
  return { name: b.name, spot: b.spot, strikes: points.map(p => p.strike), values: points.map(p => p.v), ...pickWalls(points, b.spot, p => p.v), flip: pickFlip(points, b.spot, p => p.v) };
});

/* the air pockets on windows drawn to hit the definition's three tests (rows DESCENDING) */
const pocketBooks: { name: string; net: number[] }[] = [
  { name: 'a pocket between two shelves', net: [100, 40, 5, 3, 8, 50, 100] },
  { name: 'a quiet run at the edge is the edge of the book', net: [2, 3, 4, 60, 100, 40] },
  { name: 'two quiet strikes are texture', net: [100, 5, 5, 60, 90] },
  { name: 'a shelf under the wall bar still bounds a pocket', net: [100, 36, 1, 1, 1, 36, 20] },
  { name: 'a shelf too light to bound', net: [100, 30, 1, 1, 1, 30, 100] },
  { name: 'two pockets', net: [100, 1, 1, 1, 50, 2, 2, 2, 2, 80, 30] },
  { name: 'signs do not matter, magnitudes do', net: [-100, 4, -5, 3, -60] },
  { name: 'all zero', net: [0, 0, 0, 0, 0, 0] },
  { name: 'too few rows', net: [100, 1, 1, 1] },
];
const pockets = pocketBooks.map(b => {
  const rows = b.net.map((v, i) => ({ strike: 200 - i, gex: { net: v } })) as unknown as StrikeExposure[];
  return { name: b.name, strikes: rows.map(r => r.strike), net: b.net, out: findAirPockets(rows) };
});

const out = { generatedBy: 'scripts/exposure-ref.ts', clock: '2026-09-17T10:30 local', books, walls, pockets };
mkdirSync('engine/tests/fixtures', { recursive: true });
const json = JSON.stringify(out);
writeFileSync('engine/tests/fixtures/exposure_ref.json', json);
const surfaces = books.reduce((n, b) => n + b.cases.filter(c => c.surface).length, 0);
console.log(`wrote ${books.length} books, ${books.reduce((n, b) => n + b.cases.length, 0)} profiles, ${surfaces} surfaces, ${walls.length} wall books, ${pockets.length} pocket windows (${(json.length / 1024).toFixed(0)} KB)`);
