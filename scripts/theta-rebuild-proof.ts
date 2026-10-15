/*
  THE THETA REBUILD'S PROOF (scripts/theta-rebuild-proof.ts, in `npm test`) — section C3, 2026-10-14. A small history
  is written in the downloader's own files (scripts/theta-history's names and keys), its quotes priced by the model's
  own pricer at a known vol on the rebuild's clock and rate, and the rebuild is held to:
    1. the vols it inverts are the vols the quotes were priced at (the clock, the rate and the pricer agree);
    2. the extras a minute — spread, top-of-book size, volume, VIX and the ATM vol — are the history's own;
    3. the rate is the day's DTB3-derived r from the newest observation at or before the day (FRED, or Theta's);
    4. the quote clock (4b) moves a row's minute, the SPX source (4a) chooses the underlying, each root's contracts
       stand under their own root (SPXW beside SPX's AM monthly of the same strike and date — two contracts, the AM one
       priced to its settlement at the open);
    5. the walk is newest first, resumable, and THE TRUST GATE: a recorder day equal to the rebuild passes, one that
       differs FAILS and stops the walk before an older day is built; finalRowsOf prefers UW's final rows.
*/
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { blackScholesPrice } from '../src/core/greeks';
import { nyWallTime } from '../src/core/nyTime';
import { UW_VOL_CONVENTION } from '../src/data/feed/trailModel';
import { buildThetaDay, finalRowsOf, historyDays, rateFromDtb3, rateOnDay, rebuildTheta, tauAt, THETA_REBUILD, type ThetaRebuildConfig } from '../server/thetaRebuild';
import type { StoreRow } from '../server/fieldStore';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass++;
  else fail++;
};
const near = (a: number | null | undefined, b: number, tol: number) => a != null && Math.abs(a - b) <= tol;

/* ---- the history ------------------------------------------------------------------------------------------------- */
const root = join(tmpdir(), `slayer-theta-rebuild-${process.pid}`);
const hist = join(root, 'history');
const field = join(root, 'field');
rmSync(root, { recursive: true, force: true });
const days = ['2026-10-12', '2026-10-13', '2026-10-14'];
const spotOf: Record<string, number> = { '2026-10-12': 99, '2026-10-13': 100, '2026-10-14': 101 };
const EXPS = ['2026-10-14', '2026-10-16'];
const STRIKES = [95, 100, 105, 130];
const RATE_BY_DAY: Record<string, number> = { '2026-10-12': 4.1, '2026-10-13': 4.05, '2026-10-14': 4.05 };
const stamp = (day: string, h: number, mi: number) => `${day}T${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:00.000`;
const gz = (path: string, rows: Record<string, unknown>[]) => {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, gzipSync(rows.map(r => JSON.stringify(r)).join('\n') + '\n'));
};
const minutesOf = (day: string): { h: number; mi: number; m: number }[] => {
  const [y, mo, d] = day.split('-').map(Number);
  const out: { h: number; mi: number; m: number }[] = [];
  for (let t = 9 * 60 + 30; t < 16 * 60; t++) out.push({ h: Math.floor(t / 60), mi: t % 60, m: nyWallTime(y, mo, d, Math.floor(t / 60), t % 60) });
  return out;
};
/** The vol a contract is priced at in minute i: a step a minute, so every minute's tick is kept (VOL_STEP 0.001) */
const volAt = (right: 'C' | 'P', i: number) => (right === 'C' ? 0.2 : 0.25) + 0.002 * i;
for (const day of days) {
  const S = spotOf[day];
  const mins = minutesOf(day);
  const r = rateFromDtb3(RATE_BY_DAY[day] / 100);
  /* the stock: flat bars with a volume, a pre-market row to be left out */
  gz(join(hist, 'SPY', day, 'stock-1m.ndjson.gz'), [{ timestamp: stamp(day, 9, 0), open: S, high: S, low: S, close: S, volume: 1 }, ...mins.map((x, i) => ({ timestamp: stamp(day, x.h, x.mi), open: S, high: S, low: S, close: S, volume: 1000 + i }))]);
  gz(join(hist, 'SPY', day, 'stock-quote-1m.ndjson.gz'), mins.map(x => ({ timestamp: stamp(day, x.h, x.mi), bid: S - 0.01, ask: S + 0.01, bid_size: 40, ask_size: 60 })));
  gz(join(hist, 'SPY', day, 'chain-contracts.ndjson.gz'), EXPS.flatMap(e => STRIKES.flatMap(k => ['C', 'P'].map(right => ({ symbol: 'SPY', expiration: e.replace(/-/g, ''), strike: k, right })))));
  gz(join(hist, 'SPY', day, 'chain-oi.ndjson.gz'), EXPS.flatMap(e => STRIKES.flatMap(k => ['C', 'P'].map(right => ({ timestamp: stamp(day, 6, 30), expiration: e.replace(/-/g, ''), strike: k, right, open_interest: k === 100 ? 5000 : 1000 })))));
  for (const e of EXPS) {
    if (e < day) continue;
    const rows: Record<string, unknown>[] = [];
    for (const k of STRIKES)
      for (const right of ['C', 'P'] as const)
        mins.forEach((x, i) => {
          const mid = blackScholesPrice(S, k, tauAt(x.m, e, day), volAt(right, i), right, r, UW_VOL_CONVENTION.q);
          if (!(mid > 0.02)) return;
          rows.push({ timestamp: stamp(day, x.h, x.mi), expiration: e.replace(/-/g, ''), strike: k, right, bid: mid - 0.01, ask: mid + 0.01, bid_size: 10, ask_size: 12 });
        });
    gz(join(hist, 'SPY', day, `chain-quotes-${e}.ndjson.gz`), rows);
  }
  gz(join(hist, 'VIX', day, 'index-price-1m.ndjson.gz'), mins.filter((_, i) => i % 5 === 0).map((x, i) => ({ timestamp: stamp(day, x.h, x.mi), price: 15 + i * 0.1 })));
}
mkdirSync(join(hist, 'RATES'), { recursive: true });
writeFileSync(join(hist, 'RATES', 'fred-dtb3.csv'), 'DATE,DTB3\n2026-10-09,4.10\n2026-10-13,4.05\n2026-10-15,3.90\n');
/* UW's series for one day (the residual's reference) */
mkdirSync(join(field, 'SPY', '2026-10-13'), { recursive: true });
writeFileSync(join(field, 'SPY', '2026-10-13', 'series.json'), JSON.stringify({ receivedAt: 1, rows: minutesOf('2026-10-13').map(x => ({ start_time: new Date(x.m).toISOString(), price: '100', gamma_per_one_percent_move_oi: '1000000', gamma_per_one_percent_move_vol: '0', gamma_per_one_percent_move_dir: '0' })) }));

/* ---- 1–3: one day built --------------------------------------------------------------------------------------- */
const cfg: ThetaRebuildConfig = { ...THETA_REBUILD, version: 'proof-1' };
const b13 = buildThetaDay(hist, field, 'SPY', '2026-10-13', cfg, () => 1);
check('a session builds from the downloader\'s files', !('why' in b13), 'why' in b13 ? b13.why : `${b13.counts.minutes} minutes, ${b13.counts.quoted} quoted of ${b13.counts.contracts}`);
if (!('why' in b13)) {
  const mins = minutesOf('2026-10-13');
  check('the regular session\'s minutes are the bars, the pre-market row left out', b13.counts.minutes === 390 && b13.bars.filter(b => b.session === 'r').length === 390);
  const occC = 'SPY261016C00100000';
  const ticks = b13.past.ticks[occC] ?? [];
  const firstIv = ticks[1];
  const lastIv = ticks[ticks.length - 1];
  check('the vols inverted are the vols the quotes were priced at (clock, rate and pricer agree)', ticks.length === 780 && near(firstIv, volAt('C', 0), 2e-4) && near(lastIv, volAt('C', 389), 2e-4), `${ticks.length / 2} minutes, first ${firstIv}, last ${lastIv}`);
  check('a strike past the band (130 at 100 ± 15%) is left out; the day\'s expiry and the weekly are in', !b13.past.ticks['SPY261016C00130000'] && !!b13.past.ticks['SPY261014P00095000'] && b13.counts.quoted === 12, `${b13.counts.quoted} quoted`);
  check('the day\'s rate is the newest DTB3 at or before it (FRED 2026-10-13, 4.05)', near(b13.rate?.r ?? null, rateFromDtb3(0.0405), 1e-12) && /FRED DTB3 2026-10-13/.test(b13.rate?.source ?? '') && near(b13.past.rate ?? null, rateFromDtb3(0.0405), 1e-12), b13.rate?.source);
  check('the seed is the session before\'s last minute, inverted the same way, with its count', b13.past.seed?.date === '2026-10-12' && near(b13.past.seed?.rows.find(x => x[0] === occC)?.[1] ?? null, volAt('C', 389), 2e-4) && b13.past.seed?.rows.find(x => x[0] === occC)?.[3] === 5000, JSON.stringify(b13.past.seed?.rows.find(x => x[0] === occC)));
  check('the vols are marked theta and UW\'s series stands as the total', b13.past.vols === 'theta' && b13.past.total?.rows.length === 390);
  const e0 = b13.extras[0];
  const e7 = b13.extras[7];
  check('the extras a minute: spread, top-of-book size, volume, VIX carried, 390 minutes', b13.extras.length === 390 && near(e0.spread, 0.02, 1e-9) && e0.bidSize === 40 && e0.askSize === 60 && e0.volume === 1000 && e7.volume === 1007 && near(e0.vix, 15, 1e-9) && near(e7.vix, 15.1, 1e-9), JSON.stringify(e0));
  check('no expiry on the day: the ATM vol is "—"', b13.extras.every(e => e.atmIv == null));
  check('the ATM vol on a day with its own expiry: the call and the put at the strike nearest the price', (() => {
    const b14 = buildThetaDay(hist, field, 'SPY', '2026-10-14', cfg, () => 1);
    if ('why' in b14) return false;
    const e = b14.extras[0];
    return near(e.atmIv, (volAt('C', 0) + volAt('P', 0)) / 2, 2e-4) && b14.extras.every(x => x.atmIv != null);
  })());
  check('τ on the model\'s clock: today\'s expiry on calendar time to its close, a later one on whole days', near(tauAt(mins[0].m, '2026-10-13', '2026-10-13') * 365 * 24, 6.5 - 1 / 120, 1e-6) && near(tauAt(mins[0].m, '2026-10-16', '2026-10-13') * 365, 3, 1e-9));
}

/* ---- 4: the clock, the source, the root ---------------------------------------------------------------------- */
const atStamp = buildThetaDay(hist, field, 'SPY', '2026-10-13', { ...cfg, quoteClock: 'at-stamp' }, () => 1);
check('the quote clock (4b): at-stamp reads a row for the minute before its stamp (389 minutes from 390 rows)', !('why' in atStamp) && (atStamp.past.ticks['SPY261016C00100000']?.length ?? 0) === 778 && !('why' in b13) && atStamp.past.ticks['SPY261016C00100000'][0] === b13.past.ticks['SPY261016C00100000'][0]);
/* SPX: its weekly root's chain beside the index's own, its price series as the underlying, or the tape's */
for (const day of ['2026-10-13']) {
  const mins = minutesOf(day);
  gz(join(hist, 'SPX', day, 'index-price-1m.ndjson.gz'), mins.filter((_, i) => i % 2 === 0).map(x => ({ timestamp: stamp(day, x.h, x.mi), price: 5000 })));
  gz(join(hist, 'SPXW', day, 'chain-contracts.ndjson.gz'), [{ symbol: 'SPXW', expiration: '20261016', strike: 5000, right: 'C' }]);
  gz(join(hist, 'SPXW', day, 'chain-oi.ndjson.gz'), [{ expiration: '20261016', strike: 5000, right: 'C', open_interest: 700 }, { expiration: '20261016', strike: 5000, right: 'P', open_interest: 300 }]);
  const r = rateFromDtb3(0.0405);
  gz(join(hist, 'SPXW', day, 'chain-quotes-2026-10-16.ndjson.gz'), mins.flatMap((x, i) => (['C', 'P'] as const).map(right => {
    const mid = blackScholesPrice(5000, 5000, tauAt(x.m, '2026-10-16', day), volAt(right, i), right, r, UW_VOL_CONVENTION.q);
    return { timestamp: stamp(day, x.h, x.mi), expiration: '20261016', strike: 5000, right, bid: mid - 0.05, ask: mid + 0.05 };
  })));
  /* SPX's AM monthly of the same strike and date (a third Friday): its own count, its own vol (0.1 above the weekly's),
     priced to its settlement at the open */
  gz(join(hist, 'SPX', day, 'chain-contracts.ndjson.gz'), [{ symbol: 'SPX', expiration: '20261016', strike: 5000, right: 'C' }]);
  gz(join(hist, 'SPX', day, 'chain-oi.ndjson.gz'), [{ expiration: '20261016', strike: 5000, right: 'C', open_interest: 9000 }, { expiration: '20261016', strike: 5000, right: 'P', open_interest: 8000 }]);
  gz(join(hist, 'SPX', day, 'chain-quotes-2026-10-16.ndjson.gz'), mins.flatMap((x, i) => (['C', 'P'] as const).map(right => {
    const mid = blackScholesPrice(5000, 5000, tauAt(x.m, '2026-10-16', day, 'SPX'), volAt(right, i) + 0.1, right, r, UW_VOL_CONVENTION.q);
    return { timestamp: stamp(day, x.h, x.mi), expiration: '20261016', strike: 5000, right, bid: mid - 0.05, ask: mid + 0.05 };
  })));
}
const spx = buildThetaDay(hist, field, 'SPX', '2026-10-13', cfg, () => 1);
check('an index: each root\'s contracts under their own root — SPXW and SPX\'s AM monthly of one strike and date are two contracts with their own counts and vols; its price series carried a minute is the underlying', !('why' in spx) && spx.past.oi.length === 4 && spx.past.oi.find(o => o[0] === 'SPXW261016C05000000')?.[1] === 700 && spx.past.oi.find(o => o[0] === 'SPX261016C05000000')?.[1] === 9000 && spx.bars.length === 390 && spx.bars.every(b => b.close === 5000) && near(spx.past.ticks['SPXW261016C05000000']?.[1] ?? null, volAt('C', 0), 2e-4) && near(spx.past.ticks['SPX261016C05000000']?.[1] ?? null, volAt('C', 0) + 0.1, 2e-4), 'why' in spx ? spx.why : `${spx.past.oi.map(o => o.join(' ')).join(', ')}; SPXW vol ${spx.past.ticks['SPXW261016C05000000']?.[1]}, SPX AM vol ${spx.past.ticks['SPX261016C05000000']?.[1]}`);
mkdirSync(join(field, 'SPX', '2026-10-13'), { recursive: true });
writeFileSync(join(field, 'SPX', '2026-10-13', 'tape-price.json'), JSON.stringify({ bars: minutesOf('2026-10-13').map(x => [x.m, 5001, 5001, 5001, 5001, 0]) }));
const spxTape = buildThetaDay(hist, field, 'SPX', '2026-10-13', { ...cfg, spxSource: 'tape' }, () => 1);
check('the SPX source (4a): tape reads the field\'s per-print underlying, theta the price series', !('why' in spxTape) && spxTape.bars.every(b => b.close === 5001) && !('why' in spx) && spx.bars[0].close === 5000);
/* Theta's own rate file stands over FRED's where it is kept */
gz(join(hist, 'RATES', 'theta-treasury_m3-2026.ndjson.gz'), [{ date: '20261009', rate: 4.2 }, { date: '20261013', rate: 4.0 }, { date: '20261015', rate: 3.8 }]);
const rTheta = rateOnDay(hist, '2026-10-14');
check('Theta\'s TREASURY_M3 stands over FRED where the year is kept, the newest at or before the day', near(rTheta?.r ?? null, rateFromDtb3(0.04), 1e-12) && /Theta TREASURY_M3 2026-10-13/.test(rTheta?.source ?? ''), rTheta?.source);
rmSync(join(hist, 'RATES', 'theta-treasury_m3-2026.ndjson.gz'));
check('r = −ln(1 − d·91/360) × 365/91 (d = 4% → 4.0762%)', near(rateFromDtb3(0.04), 0.040762, 1e-6), String(rateFromDtb3(0.04)));

/* ---- 5: the walk and the trust gate --------------------------------------------------------------------------- */
let tick = 1000;
const clock = () => ++tick;
const lines: string[] = [];
const log = (l: string) => lines.push(l);
const run = (again = false, version = 'proof-1') => rebuildTheta({ histRoot: hist, fieldRoot: field, names: ['SPY'], maxDays: 0, cfg: { ...cfg, version }, log, again, now: clock });
const t1 = (await run())['SPY'];
const builtOrder = lines.filter(l => / rows from /.test(l)).map(l => l.split(' ')[1].replace(':', ''));
check('the walk is newest first, over every session the history holds, and writes the rows, the extras and the build note', builtOrder.join(',') === '2026-10-14,2026-10-13,2026-10-12' && days.every(d => existsSync(join(field, 'SPY', d, 'theta-final.jsonl')) && existsSync(join(field, 'SPY', d, 'theta-extras.jsonl')) && existsSync(join(field, 'SPY', d, 'theta-build.json'))) && historyDays(hist, 'SPY').length === 3, builtOrder.join(','));
check('no recorder day among them: reached the oldest, nothing checked, the trust file says so', t1.reached === '2026-10-12' && t1.checked.length === 0 && t1.trusted && lines.some(l => /stand unchecked/.test(l)));
const rows14 = finalRowsOf(field, 'SPY', '2026-10-14');
check('finalRowsOf serves the rebuilt rows (390, session r, the model\'s version) where UW built nothing', rows14.source === 'theta' && rows14.rows.length === 390 && rows14.rows.every(r => r.session === 'r' && r.kind === 'final') && rows14.rows[0].cells.length > 0, `${rows14.rows.length} rows, ${rows14.rows[0]?.cells.length} cells`);
const builtAt12 = (JSON.parse(readFileSync(join(field, 'SPY', '2026-10-12', 'theta-build.json'), 'utf8')) as { builtAt: number }).builtAt;
lines.length = 0;
const t2 = (await run())['SPY'];
check('a second run builds nothing (resumable); the trust file is kept', lines.filter(l => / rows from /.test(l)).length === 0 && t2.reached === '2026-10-12' && lines.some(l => /0 built this run/.test(l)));
/* a recorder day equal to the rebuild: PASS */
const shownOf = (rows: StoreRow[], scale = 1): string => rows.map(r => JSON.stringify({ ...r, kind: 'shown', at: r.m + 1000, cells: r.cells.map(c => [c[0], c[1] * scale, c[2] != null ? c[2] * scale : undefined]), net: r.net * scale, max: r.max * scale, cw: scale === 1 ? r.cw : r.cw != null ? r.cw + 5 : null })).join('\n') + '\n';
writeFileSync(join(field, 'SPY', '2026-10-14', 'shown.jsonl'), shownOf(rows14.rows));
lines.length = 0;
const t3 = (await run(true))['SPY'];
check('THE TRUST GATE: a recorder day the rebuild matches passes (the tolerance of server/agree.ts)', t3.checked.length === 1 && t3.checked[0].day === '2026-10-14' && t3.checked[0].pass && t3.checked[0].judged && t3.trusted && t3.reached === '2026-10-12', t3.checked[0]?.lines.join(' · '));
/* a recorder day the rebuild does not match: FAIL, and the older day is not built again */
const rows13 = finalRowsOf(field, 'SPY', '2026-10-13').rows;
writeFileSync(join(field, 'SPY', '2026-10-13', 'shown.jsonl'), shownOf(rows13, 2));
const builtAt12b = (JSON.parse(readFileSync(join(field, 'SPY', '2026-10-12', 'theta-build.json'), 'utf8')) as { builtAt: number }).builtAt;
lines.length = 0;
const t4 = (await run(true))['SPY'];
const builtAt12c = (JSON.parse(readFileSync(join(field, 'SPY', '2026-10-12', 'theta-build.json'), 'utf8')) as { builtAt: number }).builtAt;
check('a recorder day the rebuild does not match FAILS and STOPS the walk: the older day is not built, the trust file says where and why', t4.checked.some(c => c.day === '2026-10-13' && !c.pass && c.judged) && !t4.trusted && t4.stoppedAt?.day === '2026-10-13' && builtAt12c === builtAt12b && builtAt12b > builtAt12 && lines.some(l => /STOPPED at 2026-10-13/.test(l)), t4.stoppedAt?.why);
/* UW's final rows stand over the rebuild's */
writeFileSync(join(field, 'SPY', '2026-10-14', 'final.jsonl'), JSON.stringify({ ...rows14.rows[0], kind: 'final' }) + '\n');
check('finalRowsOf prefers UW\'s final rows where the backfill built them', finalRowsOf(field, 'SPY', '2026-10-14').source === 'uw' && finalRowsOf(field, 'SPY', '2026-10-14').rows.length === 1);
/* a new version begins the trust afresh */
rmSync(join(field, 'SPY', '2026-10-13', 'shown.jsonl'));
lines.length = 0;
const t5 = (await run(false, 'proof-2'))['SPY'];
check('a changed version builds every day again and begins the trust afresh', t5.checked.length === 1 && t5.checked[0].day === '2026-10-14' && t5.trusted && lines.filter(l => / rows from /.test(l)).length === 3 && (JSON.parse(readFileSync(join(field, 'SPY', '2026-10-13', 'theta-build.json'), 'utf8')) as { version: string }).version === 'proof-2');

rmSync(root, { recursive: true, force: true });
console.log(`\n${pass} of ${pass + fail} pass`);
if (fail) process.exit(1);
