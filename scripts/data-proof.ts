/*
==================================================
  SLAYER TERMINAL - THE DATA PROOF
  (scripts/data-proof.ts)

  The builders every page reads, run and checked.
==================================================

  WHERE logic-proof asserts arithmetic on inputs it chose, this runs the real
  builders against the real synthetic market and asserts the things that must
  be true of ANY book: that a share adds to one, that a count of parts equals
  the whole, that a wall is on the side of spot it is named for, that no cell
  anywhere is NaN, and — the one that actually catches drift — that two
  surfaces reading the same fact agree about it.

  TWO SURFACES DISAGREEING IS THE HOUSE'S OLDEST BUG. core/walls.ts exists
  because a gamma flip was written four times; the levels the map draws and
  the levels the exposure page prints come off the same book and were picked
  by different rules for months. Nothing here re-implements a rule. It asks
  the modules and compares their answers.

  Run with `npm run proof:data`.
*/

import './lib/browser-shim';
import Simulator from '../src/core/simulator';
import { buildLevelsFor, buildLadderFor, exposureNowFor, spotChangePct } from '../src/data/gex';
import { pickWalls, pickFlip } from '../src/core/walls';
import { buildIndices, buildSectors, buildBreadth, buildMovers, tideRead, moveOf } from '../src/data/marketTide';
import { buildCatalysts, catalystDays, catalystRead, whenWords } from '../src/data/catalysts';
import { buildDeskChain, deskExpiries } from '../src/data/weigherDesk';
import { buildBasisBand, buildStrikeBasis } from '../src/data/costBasis';
import { isoDate, today as engineToday } from '../src/core/calendar';
import { buildExposureProfile } from '../src/data/exposure';
import { buildExpiryLadder, wallOwnership } from '../src/data/expiryLadder';
import { buildStability } from '../src/data/stability';
import { buildSpotScenario } from '../src/data/spotScenario';
import { buildFlipGauge, buildExpiryFlips, countFlipCrossings } from '../src/data/flipGauge';
import { buildWallConviction, convictionGrade, touchesAndBreaks } from '../src/data/wallConviction';

let pass = 0;
const fails: string[] = [];
let group = '(none)';
const section = (n: string) => {
  group = n;
};
const ok = (cond: boolean, what: string, detail?: unknown): void => {
  if (cond) pass++;
  else fails.push(`${group} · ${what}${detail !== undefined ? `   ${JSON.stringify(detail)}` : ''}`);
};
const near = (a: number, b: number, tol: number, what: string): void =>
  ok(Number.isFinite(a) && Math.abs(a - b) <= tol, what, { got: a, want: b });

/** Every number reachable from an object, with the path that reached it. */
function numbers(v: unknown, path = '', out: [string, number][] = [], seen = new Set<unknown>()): [string, number][] {
  if (typeof v === 'number') out.push([path || '(root)', v]);
  else if (Array.isArray(v)) v.forEach((x, i) => numbers(x, `${path}[${i}]`, out, seen));
  else if (v && typeof v === 'object' && !(v instanceof Date)) {
    if (seen.has(v)) return out;
    seen.add(v);
    for (const [k, x] of Object.entries(v)) numbers(x, path ? `${path}.${k}` : k, out, seen);
  }
  return out;
}
/* `allow` names the paths where an infinity is the ANSWER — a histogram's
   outermost bucket really does run to the edge of the number line. Nothing
   is ever allowed to be NaN. */
const noNaN = (v: unknown, what: string, allow: RegExp = /$^/): void => {
  const bad = numbers(v).filter(([path, n]) => Number.isNaN(n) || (!Number.isFinite(n) && !allow.test(path)));
  ok(bad.length === 0, `${what} has no NaN and no stray infinity`, bad.slice(0, 5).map(([p2, n]) => `${p2}=${n}`));
};

const TICKERS = ['SPY', 'QQQ', 'AAPL', 'NVDA'];

/* ============================== KEY LEVELS ================================== */

section('key levels');
for (const t of TICKERS) {
  const sym = Simulator.ensureTicker(t);
  const spot = Simulator.TICKERS[sym].currentPrice;
  const snaps = Simulator.getGexHistory(sym);
  const latest = snaps?.[snaps.length - 1];
  const lv = buildLevelsFor(t);
  noNaN(lv, `${t} levels`);
  near(lv.spot, spot, 1e-6, `${t}: the levels carry the same spot the sim has`);
  if (!latest || latest.levels.length === 0) continue;

  /* ONE RULE FOR ONE FACT. The map, the ladder, the exposure page and the
     terrain all read a call wall; core/walls.ts is the only place allowed to
     decide what one is. This asks both and compares. */
  const w = pickWalls(latest.levels, spot, l => l.value);
  const flip = pickFlip(latest.levels, spot, l => l.value);
  ok(lv.callWall === (w.callWall ?? spot), `${t}: the call wall is the shared rule's`, { levels: lv.callWall, walls: w.callWall });
  ok(lv.putWall === (w.putWall ?? spot), `${t}: the put wall is the shared rule's`, { levels: lv.putWall, walls: w.putWall });
  ok(Math.abs(lv.flip - (flip ?? spot)) < 1e-9, `${t}: the flip is the shared rule's`, { levels: lv.flip, walls: flip });

  // A wall is on the side of spot it is named for, or it is spot.
  ok(lv.callWall >= spot - 1e-9, `${t}: the call wall is not below spot`, { callWall: lv.callWall, spot });
  ok(lv.putWall <= spot + 1e-9, `${t}: the put wall is not above spot`, { putWall: lv.putWall, spot });
  // And it is a strike that exists, or spot.
  const strikes = new Set(latest.levels.map(l => l.strike));
  ok(lv.callWall === spot || strikes.has(lv.callWall), `${t}: the call wall is a listed strike`, lv.callWall);
  ok(lv.putWall === spot || strikes.has(lv.putWall), `${t}: the put wall is a listed strike`, lv.putWall);
  ok(strikes.has(lv.supreme) || lv.supreme === spot, `${t}: the heaviest strike is a listed one`, lv.supreme);
  // The heaviest is genuinely the heaviest.
  const heaviest = latest.levels.reduce((a, b) => (Math.abs(b.value) > Math.abs(a.value) ? b : a));
  ok(lv.supreme === heaviest.strike, `${t}: the heaviest strike is the heaviest`, { got: lv.supreme, want: heaviest.strike });
}

section('the ladder');
for (const t of TICKERS) {
  const lad = buildLadderFor(t, 30, 10);
  noNaN(lad, `${t} ladder`);
  ok(lad.maxAbs > 0, `${t}: the bar scale is positive`, lad.maxAbs);
  ok(lad.step > 0, `${t}: the strike step is positive`, lad.step);
  ok(lad.rows.length >= lad.core.length, `${t}: the drawn window is at least the scaling one`, { rows: lad.rows.length, core: lad.core.length });
  ok(
    lad.rows.every((r, i) => i === 0 || r.strike <= lad.rows[i - 1].strike),
    `${t}: the ladder runs high to low, the way a price axis does`
  );
  /* THE SCALE COMES FROM THE CORE, not the drawn window — a bar that
     shortens when a far heavy strike scrolls into view is a lie about size. */
  const coreMax = lad.core.reduce((m, r) => Math.max(m, Math.abs(r.value)), 1);
  near(lad.maxAbs, coreMax, 1e-6, `${t}: the bar scale is the near-spot window's`);
  ok(lad.core.every(r => Math.abs(r.value) <= lad.maxAbs + 1e-9), `${t}: no core bar overflows its scale`);
  // The window is centred on spot: spot is inside it, or the chain ends first.
  if (lad.rows.length > 1) {
    const hi = lad.rows[0].strike;
    const lo = lad.rows[lad.rows.length - 1].strike;
    ok(lad.spot >= lo - lad.step * 2 && lad.spot <= hi + lad.step * 2, `${t}: the window is centred near spot`, { lo, spot: lad.spot, hi });
  }
}

section('exposure now');
for (const t of TICKERS) {
  const e = exposureNowFor(t);
  if (e == null) continue;
  noNaN(e, `${t} exposure`);
  ok(Number.isFinite(spotChangePct(t)), `${t}: the session change is a number`, spotChangePct(t));
}

/* ================================ THE TIDE ================================== */

section('breadth');
{
  const b = buildBreadth();
  noNaN(b, 'breadth', /^(spread\[\d+\]\.(from|to)|ratio)$/);
  ok(b.up + b.down + b.flat === b.total, 'every name is counted exactly once', { up: b.up, down: b.down, flat: b.flat, total: b.total });
  ok(b.total > 0, 'the universe is not empty', b.total);
  ok(b.upPct >= 0 && b.upPct <= 100, 'the advancing share is a percentage', b.upPct);
  ok(b.strongUp <= b.up, 'a strong advance is an advance', { strongUp: b.strongUp, up: b.up });
  ok(b.strongDown <= b.down, 'a strong decline is a decline', { strongDown: b.strongDown, down: b.down });
  /* THE HISTOGRAM IS THE WHOLE TAPE. Contiguous buckets that leave a gap
     would drop names silently — the shape would look thin and read fine. */
  const binned = b.spread.reduce((a, s) => a + s.n, 0);
  ok(binned === b.total, 'every name falls in exactly one bucket', { binned, total: b.total });
  ok(b.best.changePct >= b.worst.changePct, 'the best is not below the worst', { best: b.best.changePct, worst: b.worst.changePct });
  ok(Number.isFinite(b.ratio) || b.down === 0, 'the A/D ratio is only infinite when nothing declined', { ratio: b.ratio, down: b.down });
  ok(b.ratio !== b.up || b.down === 1 || b.up === 0, 'the A/D ratio is not the advancer count', { ratio: b.ratio, up: b.up, down: b.down });

  const m = buildMovers(8);
  noNaN(m, 'movers');
  ok(m.gainers.length <= 8 && m.losers.length <= 8, 'the movers are capped');
  ok(m.gainers.every((g, i) => i === 0 || g.changePct <= m.gainers[i - 1].changePct), 'the gainers descend');
  ok(m.losers.every((l, i) => i === 0 || l.changePct >= m.losers[i - 1].changePct), 'the losers ascend');
  ok(m.gainers[0].changePct >= m.losers[0].changePct, 'the best gainer beats the worst loser');

  const idx = buildIndices();
  noNaN(idx, 'indices');
  ok(idx.length > 0, 'the index strip carries names');
  const sec = buildSectors();
  noNaN(sec, 'sectors');
  ok(sec.length > 0, 'the sector strip carries names');
  ok(sec.every((s, i) => i === 0 || s.changePct <= sec[i - 1].changePct), 'the sectors are ranked');
  const read = tideRead(idx, b, sec);
  ok(typeof read === 'string' && read.length > 20, 'the tide reads as a sentence', read);
  ok(!/NaN|undefined|Infinity/.test(read), 'the sentence carries no broken number', read);

  for (const t of TICKERS) {
    const mv = moveOf(t);
    noNaN(mv, `${t} move`);
    ok(mv.ticker === t, `${t}: the move knows its name`);
  }
}

/* ============================== THE CALENDAR ================================ */

section('catalysts');
{
  const rows = buildCatalysts();
  noNaN(rows.map(r => ({ sessionsOut: r.sessionsOut, implied: r.impliedMovePct ?? 0, hist: r.histAvgMovePct ?? 0 })), 'catalysts');
  ok(rows.length > 0, 'the window carries something', rows.length);
  ok(
    rows.every((r, i) => i === 0 || r.sessionsOut >= rows[i - 1].sessionsOut),
    'the stream is sorted by when'
  );
  for (const r of rows) {
    ok(/^\d{4}-\d{2}-\d{2}$/.test(r.iso), `${r.label}: the date is a padded ISO date`, r.iso);
    ok(!Number.isNaN(new Date(`${r.iso}T12:00:00`).getTime()), `${r.label}: the date parses`, r.iso);
    ok(Number.isInteger(r.sessionsOut), `${r.label}: the session count is whole`, r.sessionsOut);
    ok(r.kind === 'macro' ? r.ticker === null : typeof r.ticker === 'string', `${r.label}: a release lands on everything, a report on a name`);
  }
  /* A DAY KEY IS NOT A DATE. `2026-9-21` parses as Invalid, every arithmetic
     on it is NaN, and a weekday walk against NaN never terminates — which is
     what once pinned the tab on this page. The bound is the fix; this is the
     tripwire. */
  const days = catalystDays(rows);
  ok(days.every(d => !Number.isNaN(new Date(`${d.iso}T12:00:00`).getTime())), 'every strip day parses');
  ok(days.every(d => d.sessionsOut >= 0), 'the strip is only what is ahead');
  ok(days.every((d, i) => i === 0 || d.sessionsOut >= days[i - 1].sessionsOut), 'the strip is in order');
  ok(days.every(d => d.macro.length + d.earnings.length > 0), 'no empty day is on the strip');
  const inStrip = days.reduce((a, d) => a + d.macro.length + d.earnings.length, 0);
  ok(inStrip === rows.filter(r => r.sessionsOut >= 0).length, 'every row ahead is on exactly one day', { inStrip, ahead: rows.filter(r => r.sessionsOut >= 0).length });
  const read = catalystRead(rows, 'SPY');
  ok(!/NaN|undefined|Invalid/.test(read), 'the calendar reads without a broken number', read);
  ok(whenWords(0) === 'today' && whenWords(1) === 'tomorrow', 'today and tomorrow are words');
  ok(/1 session ago/.test(whenWords(-1)), 'yesterday counts backwards', whenWords(-1));
  ok(/^\d{4}-\d{2}-\d{2}$/.test(isoDate(engineToday())), "the engine's today is a padded ISO date");
}

/* ================================ THE CHAIN ================================= */

section('the chain');
{
  const exp = deskExpiries();
  ok(exp.length > 0, 'the desk lists expiries');
  ok(exp.every(e => !Number.isNaN(e.date.getTime())), 'every listed expiry is a real date');
  ok(exp.every((e, i) => i === 0 || e.dte >= exp[i - 1].dte), 'the expiries run near to far', exp.map(e => e.dte));

  for (const dte of [0, 2, 7, 30]) {
    const ch = buildDeskChain('SPY', dte, 10);
    const cs = ch.rows.flatMap(r => [r.call, r.put]).filter(Boolean) as NonNullable<typeof ch.rows[0]['call']>[];
    ok(cs.length > 0, `dte ${dte}: the chain has contracts`, cs.length);
    ok(
      ch.rows.every((r, i) => i === 0 || r.strike >= ch.rows[i - 1].strike),
      `dte ${dte}: the strikes ascend`
    );
    for (const c of cs) {
      const tag = `dte ${dte} ${c.strike}${c.right}`;
      ok(c.bid >= 0, `${tag}: no negative bid`, c.bid);
      ok(c.ask >= c.bid, `${tag}: the ask is not under the bid`, { bid: c.bid, ask: c.ask });
      ok(c.mark >= c.bid - 1e-9 && c.mark <= c.ask + 1e-9, `${tag}: the mark sits inside the market`, { bid: c.bid, mark: c.mark, ask: c.ask });
      ok(c.iv > 0, `${tag}: the contract carries a vol`, c.iv);
      /* A VOL READ BACK FROM A QUOTE IS EITHER A VOL OR NOTHING. The
         estimator floors at a nickel, so a wing quoted at or under one
         prices the same at every vol; a bracket that keeps answering there
         printed 0.01% beside a 15% ask. */
      ok(c.bidIv == null || c.bidIv > 0.5, `${tag}: the bid's vol is a reading, not a bracket floor`, c.bidIv);
      ok(c.askIv == null || c.askIv > 0.5, `${tag}: the ask's vol is a reading, not a bracket floor`, c.askIv);
      if (c.bidIv != null && c.askIv != null) {
        ok(c.bidIv <= c.askIv + 1e-9, `${tag}: the bid's vol is not above the ask's`, { bidIv: c.bidIv, askIv: c.askIv });
      }
      ok(c.right === 'C' ? c.delta >= -0.001 : c.delta <= 0.001, `${tag}: the delta faces the right way`, c.delta);
      ok(Math.abs(c.delta) <= 1.001, `${tag}: the delta is inside one`, c.delta);
      ok(c.gamma >= 0, `${tag}: gamma is not negative`, c.gamma);
      ok(c.vega >= 0, `${tag}: vega is not negative`, c.vega);
      ok(c.volume >= 0 && c.oi >= 0, `${tag}: no negative size`, { volume: c.volume, oi: c.oi });
      ok(c.high >= c.low, `${tag}: the session high is not under its low`, { high: c.high, low: c.low });
    }
  }
}

/* ============================== THE COST BASIS ============================== */

section('cost basis');
{
  const band = buildBasisBand([], 'C', 500, 0.1, 0.2);
  ok(band.basis === null && band.contracts === 0 && band.breakevenSpot === null, 'no prints, no basis');
  const one = buildStrikeBasis([], 500, 'C', 500, 0.1, 0.2);
  noNaN({ ...one, basis: one.basis ?? 0, mark: one.mark ?? 0, unrealized: one.unrealized ?? 0 }, 'an empty strike basis');
  ok(one.contracts === 0 && one.basis === null, 'no prints at the strike, no basis');
  ok(one.coverage === 0, 'and no coverage to divide by');
  // A degenerate market must refuse rather than divide.
  for (const [spot, t, iv] of [[0, 0.1, 0.2], [500, 0, 0.2], [500, 0.1, 0]] as const) {
    const b = buildBasisBand([], 'C', spot, t, iv);
    ok(b.breakevenSpot === null, `a market with no ${spot === 0 ? 'spot' : t === 0 ? 'time' : 'vol'} has no breakeven`);
  }
}

/* ============================ THE EXPOSURE FAMILY =========================== */

section('exposure');
for (const t of TICKERS) {
  const snap = Simulator.snapshotFor(t);
  noNaN({ spot: snap.spot, changePercent: snap.changePercent }, `${t} snapshot`);
  ok(snap.chain.length > 0, `${t}: the snapshot carries a chain`, snap.chain.length);
  ok(snap.spot > 0, `${t}: and a spot`, snap.spot);

  for (const lens of ['0DTE', '7D', 'ALL'] as const) {
    const prof = buildExposureProfile(snap, lens, 10);
    noNaN(prof, `${t} exposure ${lens}`);
    ok(prof.strikes.length > 0, `${t} ${lens}: the profile has strikes`, prof.strikes.length);
    ok(
      prof.strikes.every((x, i) => i === 0 || x.strike <= prof.strikes[i - 1].strike),
      `${t} ${lens}: the strikes run high to low, the way a price axis does`
    );
    /* A WALL IS ON THE SIDE OF SPOT IT IS NAMED FOR — the whole reason
       core/walls.ts exists, asserted against a real book each time rather
       than trusted because it was true when it was written. */
    ok(prof.levels.callWall >= snap.spot - 1e-6, `${t} ${lens}: the call wall is overhead or is spot`, { wall: prof.levels.callWall, spot: snap.spot });
    ok(prof.levels.putWall <= snap.spot + 1e-6, `${t} ${lens}: the put wall is below or is spot`, { wall: prof.levels.putWall, spot: snap.spot });
    /* AND THE WALL IS THE WHOLE BOOK'S, not the drawn window's — a wall
       that moves when the reader resizes the panel is a drawing choice
       wearing an answer's name. */
    const shared = pickWalls(snap.chain, snap.spot, n => n.netGex);
    ok(prof.levels.callWall === (shared.callWall ?? snap.spot), `${t} ${lens}: the call wall is the shared rule's, off the full chain`, { got: prof.levels.callWall, want: shared.callWall });
    ok(prof.levels.putWall === (shared.putWall ?? snap.spot), `${t} ${lens}: the put wall is the shared rule's`, { got: prof.levels.putWall, want: shared.putWall });
    ok(Math.abs(prof.levels.flip - (pickFlip(snap.chain, snap.spot, n => n.netGex) ?? snap.spot)) < 1e-9, `${t} ${lens}: and so is the flip`);
    // Exactly one strike is the pin, and the split adds up.
    ok(prof.strikes.filter(x => x.pin).length <= 1, `${t} ${lens}: at most one strike is the pin`, prof.strikes.filter(x => x.pin).length);
    for (const g of ['gex', 'dex', 'vex', 'vanna', 'charm'] as const) {
      ok(
        prof.strikes.every(x => Math.abs(x[g].net - (x[g].call + x[g].put)) < Math.max(1e-6, Math.abs(x[g].net) * 1e-9)),
        `${t} ${lens}: ${g} net is its two legs added`
      );
    }
    ok(prof.strikes.every(x => x.oi >= 0 && x.volume >= 0), `${t} ${lens}: no negative size on a strike`);
  }
  // A WIDER WINDOW DRAWS MORE AND ANSWERS THE SAME.
  const narrow = buildExposureProfile(snap, 'ALL', 10);
  const wide = buildExposureProfile(snap, 'ALL', 30);
  ok(wide.strikes.length >= narrow.strikes.length, `${t}: a wider window draws more strikes`, { narrow: narrow.strikes.length, wide: wide.strikes.length });
  ok(narrow.levels.callWall === wide.levels.callWall && narrow.levels.putWall === wide.levels.putWall && narrow.levels.flip === wide.levels.flip, `${t}: resizing the window does not move the walls`, { narrow: [narrow.levels.callWall, narrow.levels.putWall], wide: [wide.levels.callWall, wide.levels.putWall] });

  const lad = buildExpiryLadder(snap, 10);
  noNaN(lad, `${t} expiry ladder`);
  ok(lad.rows.length > 0, `${t}: the ladder has rows`, lad.rows.length);
  ok(lad.rows.every(r => r.cells.length === lad.columns.length), `${t}: every row is as wide as its header`, lad.rows.map(r => r.cells.length).slice(0, 3));
  ok(
    lad.rows.every((r, i) => i === 0 || r.strike <= lad.rows[i - 1].strike),
    `${t}: the ladder runs high to low`
  );
  ok(lad.maxAbs >= 0, `${t}: the ladder's bar scale is not negative`, lad.maxAbs);
  noNaN(wallOwnership(lad), `${t} wall ownership`);

  const stab = buildStability(snap.chain, snap.spot, 0.2);
  if (stab) noNaN(stab, `${t} stability`);
  ok(buildStability([], snap.spot, 0.2) === null, `${t}: no chain, no stability read`);

  const gauge = buildFlipGauge(snap);
  noNaN(gauge, `${t} flip gauge`);
  noNaN(buildExpiryFlips(snap), `${t} expiry flips`);
  ok(countFlipCrossings([], []) === 0, 'no bars and no snapshots is no crossings');

  const snaps = Simulator.getGexHistory(Simulator.ensureTicker(t)) ?? [];
  for (const side of ['call', 'put'] as const) {
    const conv = buildWallConviction(snaps, [], snap.spot, side);
    if (conv) {
      noNaN(conv, `${t} ${side} conviction`);
      ok(['STRONG', 'HOLDING', 'THIN'].includes(convictionGrade(conv)), `${t}: the ${side} wall grades`, convictionGrade(conv));
    }
    ok(buildWallConviction([], [], snap.spot, side) === null, `${t}: no snapshots, no ${side} conviction`);
    const tb = touchesAndBreaks([], snap.spot, side);
    ok(tb.touches === 0 && tb.breaks === 0, `${t}: no bars, no ${side} touches`);
  }

  /* A SPOT SCENARIO IS A MOVE, and it has to be finite at every distance. */
  for (const pct of [-0.08, -0.02, 0.02, 0.08]) {
    const sc = buildSpotScenario(snap.chain, snap.spot, snap.spot * (1 + pct));
    if (sc == null) continue;
    noNaN(sc, `${t} scenario ${pct}`);
    ok(sc.at > 0, `${t} scenario ${pct}: the destination is a price`, sc.to);
    ok(sc.callWall == null || sc.callWall >= sc.at - 1e-6, `${t} scenario ${pct}: the wall is re-picked at the NEW spot, not the old one`, { wall: sc.callWall, at: sc.at });
    ok(sc.putWall == null || sc.putWall <= sc.at + 1e-6, `${t} scenario ${pct}: and so is the put wall`, { wall: sc.putWall, at: sc.at });
  }
  ok(buildSpotScenario([], snap.spot, snap.spot * 1.02) === null, `${t}: an empty chain has no scenario`);
}

console.log(`\n${pass} passed, ${fails.length} FAILED`);
for (const f of fails) console.log('  ✗ ' + f);
if (fails.length) process.exitCode = 1;
process.exit(fails.length ? 1 : 0);
