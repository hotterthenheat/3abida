/*
  AN INDEX'S ROOTS (scripts/index-roots-proof.ts, in `npm test`) — 2026-10-15, the owner: "SPXW was being dropped.
  Check whether anything stored used that filter … Rebuild whatever did, and tell me what changed."

  The field's model .6 and the Theta rebuild .2 are held to:
    1. an index's weekly root is in its universe (SPXW under SPX), a stock's universe never takes another root;
    2. an AM-settled contract (SPX's monthly) counts until its settlement at the expiry date's 9:30 am and not after;
       a PM weekly to its 4:00 pm close; with no seed the prior count stands from the trading day's first session (SPX's
       8:15 pm the evening before);
    3. a straddle reads the PM root where both list the expiry, the AM one where it stands alone;
    4. a monthly dated a Saturday (OCC before February 2015) is its Friday;
    5. what an older model wrote is known wrong for an index and for a day a Saturday-dated expiry could reach, and
       stands as before everywhere else (staleBeforeIndexRoots; the caches' stricter modelStands; the Theta builds');
    6. the scorecard's loader does not read an index's final rows written before .6 — it rebuilds the session from its
       kept inputs — and `npm run field:reindex -- --rebuild` rewrites them, the old file kept beside.
*/
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { nyWallTime } from '../src/core/nyTime';
import {
  AM_ROOTS,
  endOf,
  lastTradeOf,
  modelColumn,
  modelStands,
  MODEL_BEFORE_INDEX_ROOTS,
  parseOcc,
  staleBeforeIndexRoots,
  straddleAt,
  straddleFromChain,
  TRAIL_MODEL,
  universeOf,
  type ChainRow,
  type ServerInputs,
} from '../src/data/feed/trailModel';
import { createFeedClient } from '../server/feed';
import { createFieldBackfill, PAST_FORMAT, type PastDay } from '../server/fieldBackfill';
import { createFieldStore, type StoreRow } from '../server/fieldStore';
import { isLoaded, loadSession } from '../server/scorecard';
import { thetaBuildStands, thetaStaleBeforeIndexRoots, THETA_REBUILD } from '../server/thetaRebuild';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass++;
  else fail++;
};

/* ---- 4: the dates ------------------------------------------------------------------------------------------------ */
check('a monthly dated a Saturday (OCC before February 2015) is its Friday; a Friday is itself', parseOcc('SPY140222C00180000')?.expiry === '2014-02-21' && parseOcc('SPY261016C00180000')?.expiry === '2026-10-16', `${parseOcc('SPY140222C00180000')?.expiry}`);

/* ---- 2: the ends ------------------------------------------------------------------------------------------------- */
const DAY = '2026-10-16'; /* a third Friday: SPX's AM monthly and SPXW's PM weekly both expire on it */
const at = (h: number, m: number) => nyWallTime(2026, 10, 16, h, m);
check('the AM-settled roots: SPX, NDX, RUT, VIX and VIXW — never SPXW, NDXP or RUTW', ['SPX', 'NDX', 'RUT', 'VIX', 'VIXW'].every(r => AM_ROOTS.has(r)) && !['SPXW', 'NDXP', 'RUTW', 'SPY'].some(r => AM_ROOTS.has(r)));
check('an AM contract ends at its expiry date\'s 9:30 am, a PM one at its 4:00 pm close', endOf('SPX', DAY) === at(9, 30) && endOf('SPXW', DAY) === at(16, 0) && endOf('SPXW', DAY) === lastTradeOf(DAY));

/* ---- 1: the universe --------------------------------------------------------------------------------------------- */
const READ_AT = at(7, 30); /* after the day's count is published */
const occ = (root: string, exp: string, right: 'C' | 'P', k: number) => `${root}${exp.slice(2, 4)}${exp.slice(5, 7)}${exp.slice(8, 10)}${right}${String(k * 1000).padStart(8, '0')}`;
const SPOT = 7700;
/* [symbol, oi, vol, bid, ask] — the AM monthly heavy, the PM weekly light, a PM-only strike, a later weekly */
const book: [string, number, number, number, number][] = [
  [occ('SPX', DAY, 'C', 7700), 9000, 0.15, 30, 31],
  [occ('SPX', DAY, 'P', 7700), 9000, 0.15, 29, 30],
  [occ('SPXW', DAY, 'C', 7700), 1000, 0.12, 20, 21],
  [occ('SPXW', DAY, 'P', 7700), 1000, 0.12, 19, 20],
  [occ('SPXW', DAY, 'C', 7750), 500, 0.12, 5, 6],
  [occ('SPXW', DAY, 'P', 7750), 500, 0.12, 54, 55],
  [occ('SPXW', '2026-10-23', 'C', 7700), 300, 0.13, 80, 81],
];
const rowsOf = (keep: (sym: string) => boolean): ChainRow[] => book.filter(b => keep(b[0])).map(([s, oi, iv, bid, ask]) => [s, oi, iv, READ_AT, bid, ask, 0]);
const inputs = (keep: (sym: string) => boolean = () => true): ServerInputs => ({ chains: [{ receivedAt: READ_AT, rows: rowsOf(keep) }], seed: null, total: null }) as ServerInputs;
const u = universeOf('SPX', DAY, inputs());
check('SPX\'s universe holds SPXW with its own AM monthly (7 contracts, 2 AM)', u.expiry.length === 7 && [...u.am].filter(Boolean).length === 2, `${u.expiry.length} contracts, ${[...u.am].filter(Boolean).length} AM`);
check('a stock\'s universe never takes another root (SPY over the same chain: none)', universeOf('SPY', DAY, inputs()).expiry.length === 0);

/* ---- 2: the AM contract in the column ---------------------------------------------------------------------------- */
const uPm = universeOf('SPX', DAY, inputs(s => parseOcc(s)?.root === 'SPXW'));
/* gross gamma at the strike: the AM monthly's call and put counts are equal, so its net is nil by construction */
const v = (snap: ReturnType<typeof modelColumn>, k: number) => snap.levels.find(l => l.strike === k)?.gross ?? 0;
const bar = (h: number, m: number) => ({ time: at(h, m) / 1000, close: SPOT });
const at9 = v(modelColumn(u, bar(9, 0)), 7700);
const at9Pm = v(modelColumn(uPm, bar(9, 0)), 7700);
const at10 = v(modelColumn(u, bar(10, 0)), 7700);
const at10Pm = v(modelColumn(uPm, bar(10, 0)), 7700);
check('before its settlement (9:00 am) the AM monthly is in the column', Math.abs(at9) > Math.abs(at9Pm) * 1.5, `7700: ${(at9 / 1e9).toFixed(2)}B with it, ${(at9Pm / 1e9).toFixed(2)}B without`);
check('after its settlement (10:00 am) it is not: the column equals the PM contracts\' alone', Math.abs(at10 - at10Pm) <= Math.abs(at10Pm) * 1e-9 && at10Pm !== 0, `7700: ${(at10 / 1e9).toFixed(3)}B, PM alone ${(at10Pm / 1e9).toFixed(3)}B`);

/* with no seed, the prior count is knowable from the trading day's first session — SPX's overnight session from 8:15 pm
   the evening before, not midnight (a night recorded without a seed drew nothing before midnight) */
{
  const early: ServerInputs = { chains: [{ receivedAt: nyWallTime(2026, 10, 15, 20, 16), rows: rowsOf(() => true).map(r => [...r.slice(0, 3), nyWallTime(2026, 10, 15, 20, 16), ...r.slice(4)] as ChainRow) }], seed: null, total: null } as ServerInputs;
  const ue = universeOf('SPX', DAY, early);
  const evening = modelColumn(ue, { time: nyWallTime(2026, 10, 15, 20, 30) / 1000, close: SPOT });
  check('with no seed, an overnight minute before midnight stands on the prior count (8:30 pm the evening before has cells)', evening.levels.length > 0, `${evening.levels.length} cells`);
}

/* ---- 3: the straddle --------------------------------------------------------------------------------------------- */
const st = straddleAt(u, bar(9, 0), DAY);
const stAm = straddleAt(universeOf('SPX', DAY, inputs(s => parseOcc(s)?.root === 'SPX')), bar(9, 0), DAY);
check('the model\'s straddle reads the PM root where both list the expiry, the AM one where it stands alone', st?.call === 0.12 && st?.put === 0.12 && stAm?.call === 0.15, `PM ${st?.call}/${st?.put}, AM alone ${stAm?.call}`);
const ch = straddleFromChain(rowsOf(() => true), DAY, SPOT);
const chAm = straddleFromChain(rowsOf(s => parseOcc(s)?.root === 'SPX'), DAY, SPOT);
check('the chain\'s straddle (NBBO mids) the same', ch?.value === 20.5 + 19.5 && chAm?.value === 30.5 + 29.5, `PM ${ch?.value}, AM alone ${chAm?.value}`);

/* ---- 5: what an older model wrote -------------------------------------------------------------------------------- */
const OLD = MODEL_BEFORE_INDEX_ROOTS;
check('rows .6 knows wrong: an index\'s before .6, a stock\'s on a day a Saturday-dated expiry could reach', staleBeforeIndexRoots(OLD, 'SPX', '2026-10-14') && staleBeforeIndexRoots('trail-2026-10-13.4', 'NDX', '2026-10-13') && staleBeforeIndexRoots(OLD, 'SPY', '2016-06-01'));
check('and every other row stands as it did: a stock\'s from 2017 under any older model, a stamp no field model wrote, the current one', !staleBeforeIndexRoots(OLD, 'SPY', '2026-10-14') && !staleBeforeIndexRoots('trail-2026-10-13.4', 'SPY', '2026-10-13') && !staleBeforeIndexRoots(undefined, 'SPX', '2026-10-14') && !staleBeforeIndexRoots(TRAIL_MODEL.version, 'SPX', '2026-10-14'));
check('a cache (tiles, bins) stands on its own version, or on .5 where .6 changed nothing — never on an older one', modelStands(TRAIL_MODEL.version, 'SPX') && modelStands(OLD, 'SPY', '2026-10-14') && modelStands(OLD, 'QQQ') && !modelStands(OLD, 'SPX', '2026-10-14') && !modelStands('trail-2026-10-13.4', 'SPY', '2026-10-13'));
check('a Theta day built under .1 stands for a stock from 2017 (a CLI override\'s suffix kept), not for an index', thetaBuildStands('theta-rebuild-2026-10-14.1', 'SPY', '2026-10-14') && thetaBuildStands('theta-rebuild-2026-10-14.1+clock-at-stamp', 'SPY', '2026-10-14', `${THETA_REBUILD.version}+clock-at-stamp`) && !thetaBuildStands('theta-rebuild-2026-10-14.1', 'SPX', '2026-10-14') && !thetaBuildStands('theta-rebuild-2026-10-14.1', 'SPY', '2015-03-02'));
check('a Theta day .2 knows wrong is not served; another version name (a proof\'s) is', thetaStaleBeforeIndexRoots('theta-rebuild-2026-10-14.1', 'SPX', '2026-10-14') && !thetaStaleBeforeIndexRoots('theta-rebuild-2026-10-14.1', 'SPY', '2026-10-14') && !thetaStaleBeforeIndexRoots('proof-1', 'SPX', '2026-10-14'));

/* ---- 6: the stored session --------------------------------------------------------------------------------------- */
const root = join(tmpdir(), `slayer-index-roots-${process.pid}`);
rmSync(root, { recursive: true, force: true });
const D = '2026-10-13';
const [y, mo, d] = D.split('-').map(Number);
const dir = join(root, 'SPX', D);
mkdirSync(dir, { recursive: true });
const minutes: number[] = [];
for (let t = 9 * 60 + 30; t < 16 * 60; t++) minutes.push(nyWallTime(y, mo, d, Math.floor(t / 60), t % 60));
/* the tape's SPX price a minute, flat */
writeFileSync(join(dir, 'tape-price.json'), JSON.stringify({ bars: minutes.map(m => [m, SPOT, SPOT, SPOT, SPOT, 1]) }));
/* the session's inputs: SPXW beside the AM monthly (Oct 16), their vols the session before's close */
const contracts = book.filter(b => b[0].includes('261016') || b[0].includes('261023'));
const past: PastDay = {
  format: PAST_FORMAT,
  name: 'SPX',
  day: D,
  builtAt: 1,
  oi: contracts.map(([s, oi]) => [s, oi]),
  seed: { date: '2026-10-12', receivedAt: 1, rows: contracts.map(([s, oi, iv]) => [s, iv, nyWallTime(2026, 10, 12, 15, 59), oi]) },
  ticks: {},
  total: null,
  calls: 0,
  asked: contracts.length,
  refused: 0,
  vols: 'close',
};
writeFileSync(join(dir, 'past.json.gz'), gzipSync(JSON.stringify(past)));
/* the final rows .5 wrote: the AM monthly alone — 7750 (SPXW only) absent from every row */
const oldRows: StoreRow[] = minutes.map(m => ({ f: 3, kind: 'final', m, at: 0, model: OLD, session: 'r', spot: SPOT, flip: null, cw: null, pw: 7700, top: [7700], net: 1, max: 1, maxD: 1, maxG: 1, netP: null, ref: 1, refG: 1, cells: [[7700, 1, 1]], carried: 1, str0: null, strW: null, age: null }) as unknown as StoreRow);
writeFileSync(join(dir, 'final.jsonl'), oldRows.map(r => JSON.stringify(r)).join('\n') + '\n');
const store = createFieldStore({ root });
const backfill = createFieldBackfill(createFeedClient({ keys: {} as never }), { root });
const got = await loadSession(backfill, store, root, 'SPX', D, null);
const cellsOf = (x: typeof got) => (isLoaded(x) ? x.session.rows[0]?.cells.map(c => c[0]) ?? [] : []);
check('the scorecard\'s loader does not read the index\'s .5 rows: it rebuilds the session from its inputs, SPXW\'s 7750 in it', isLoaded(got) && got.source === 'rebuilt' && got.session.rows.length === 390 && cellsOf(got).includes(7750), isLoaded(got) ? `${got.source}, ${got.session.rows.length} rows, strikes ${cellsOf(got).join(', ')}` : got.why);

/* the reindex, listed and then rebuilt */
const run = (args: string[]) => execFileSync('npx', ['tsx', 'scripts/field-reindex.ts', ...args], { env: { ...process.env, FIELD_ROOT: root }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const listed = run(['SPX']);
check('`npm run field:reindex` lists the index\'s .5 final rows as rebuildable and changes nothing', /SPX\s+2026-10-13\s+final rows \(390\)\s+trail-2026-10-13\.5\s+--rebuild rewrites them/.test(listed) && store.readRows('SPX', D, 'final').every(r => r.model === OLD), listed.split('\n').find(l => l.includes('final rows')) ?? listed);
const rebuilt = run(['--rebuild', 'SPX']);
const after = createFieldStore({ root }).readRows('SPX', D, 'final');
const keptOld = readdirSync(dir).find(f => /^final\.trail-2026-10-13\.5\.jsonl\.gz$/.test(f));
check('with --rebuild it rewrites them under .6 — SPXW\'s 7750 in every row — and keeps the old file beside', after.length === 390 && after.every(r => r.model === TRAIL_MODEL.version && r.cells.some(c => c[0] === 7750)) && !!keptOld, `${after.length} rows under ${after[0]?.model}; kept ${keptOld}; ${rebuilt.split('\n').find(l => l.includes('final rows')) ?? ''}`);
const again = run(['SPX']);
check('a second look finds nothing an older model wrote wrong', /Everything stored stands/.test(again), again.trim().split('\n').pop());
rmSync(root, { recursive: true, force: true });
check('the temporary store is gone', !existsSync(root));

console.log(`\n${pass} of ${pass + fail} pass`);
process.exit(fail ? 1 : 0);
