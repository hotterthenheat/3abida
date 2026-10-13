/*
  Acceptance test for the field's past sessions (server/fieldBackfill.ts, 2026-10-13) — a stand-in client, no vendor:
  1. A session is rebuilt from what was dated it: the open interest dated the session, the session before's close
     vols, each traded contract's minute vols inside the regular session (a minute outside it is not kept), a minute
     kept only when its vol moved a tenth of a vol point
  2. Only contracts that traded, within the strikes the field can draw, are asked
  3. A session with too many calls refused is not written; one before the plan's window says so
  4. The ask answers which sessions are ready, building and queued, and a built one is served whole
*/
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compressTicks, createFieldBackfill, TAPE_UNTIL, type PastDay } from '../server/fieldBackfill';
import { csvFields, tapeReader } from '../server/tapeBackfill';
import { createServer } from 'node:http';
import { deflateRawSync } from 'node:zlib';
import type { FeedClient } from '../server/feed';

let pass = 0, fail = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (ok) pass++;
  else fail++;
};

const DAY = '2026-10-09'; // a Friday; the session before is Thursday the 8th
const z = (h: number, m: number) => `2026-10-09T${String(h + 4).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`; // New York + 4 in October
const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }), from: 'upstream' as const });
const sym = (k: number, r: 'C' | 'P', exp = '261016') => `SPY${exp}${r}${String(k * 1000).padStart(8, '0')}`;
const STRIKES = Array.from({ length: 121 }, (_, i) => 540 + i); // 540–660
const chainRows = (date: string) =>
  STRIKES.flatMap(k =>
    (['C', 'P'] as const).map(r => ({
      option_symbol: sym(k, r),
      expires: '2026-10-16',
      strike: String(k),
      open_interest: k === 650 ? 0 : 100,
      /* strikes 590–610 traded on the session, and 545 — beyond the 35 strikes each side of the session's range */
      volume: date === DAY && ((k >= 590 && k <= 610) || k === 545) ? 10 : 0,
      implied_volatility: '0.15',
      last_tape_time: `${date}T21:42:38Z`,
    }))
  );

function fakeClient(opts: { refuseIntraday?: boolean; outOfWindow?: boolean } = {}) {
  const asked: string[] = [];
  const client = {
    hasKey: () => true,
    get: async (_p: string, path: string) => {
      asked.push(path);
      if (path.includes('/ohlc/1m'))
        return opts.outOfWindow
          ? { status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'historic_data_access_missing' }), from: 'upstream' as const }
          : ok([
              { start_time: z(9, 30), open: '600', high: '601', low: '599', close: '600.5', market_time: 'r' },
              { start_time: z(15, 59), open: '600.5', high: '602', low: '598', close: '601', market_time: 'r' },
              { start_time: z(17, 0), open: '601', high: '640', low: '560', close: '601', market_time: 'po' },
            ]);
      if (path.includes('/option-chains?date=')) {
        const date = /date=([\d-]+)/.exec(path)![1];
        const page = Number(/page=(\d+)/.exec(path)![1]);
        const rows = chainRows(date);
        return ok(rows.slice(page * 500, page * 500 + 500));
      }
      if (path.includes('/spot-exposures?date=')) return ok([{ start_time: z(9, 30), price: '600', gamma_per_one_percent_move_oi: '1000' }]);
      if (path.includes('/intraday?date=')) {
        if (opts.refuseIntraday) return { status: 429, contentType: 'application/json', body: '{}', from: 'upstream' as const };
        return ok([
          { start_time: z(9, 0), iv_low: '0.50', iv_high: '0.50' }, // pre-market: not kept
          { start_time: z(9, 30), iv_low: '0.15', iv_high: '0.17' }, // 0.16
          { start_time: z(9, 31), iv_low: '0.1600', iv_high: '0.1608' }, // 0.1604: moved under a tenth of a point — not kept
          { start_time: z(9, 32), iv_low: '0.17', iv_high: '0.17' }, // kept
          { start_time: z(16, 30), iv_low: '0.40', iv_high: '0.40' }, // after 16:15: not kept
        ]);
      }
      return { status: 404, contentType: 'application/json', body: '{}', from: 'upstream' as const };
    },
  };
  return { client: client as unknown as FeedClient, asked };
}

const root = mkdtempSync(join(tmpdir(), 'slayer-backfill-'));
const now = () => Date.parse('2026-10-13T08:00:00Z');
try {
  /* 1 and 2 */
  {
    const { client, asked } = fakeClient();
    const bf = createFieldBackfill(client, { now, root });
    const p: PastDay = await bf.build('SPY', DAY);
    check('positions are the open interest dated the session, within 15% of the open, none at zero', p.oi.length === 2 * 120 && !p.oi.some(([s]) => s.includes('00650000')));
    check("the vols at the open are the session before's close", p.seed?.date === '2026-10-08' && p.seed.rows.length === p.oi.length);
    const intraday = asked.filter(a => a.includes('/intraday?'));
    check('only contracts that traded are asked, within the strikes the field can draw', intraday.length === 2 * 21 && !intraday.some(a => a.includes('00545000')));
    const one = p.ticks[sym(600, 'C')];
    check('a minute vol is kept inside the regular session, when it moved a tenth of a point', JSON.stringify(one) === JSON.stringify([Date.parse(z(9, 30)), 0.16, Date.parse(z(9, 32)), 0.17]));
    check("the validation series is UW's whole book that day", p.total?.rows.length === 1);
  }
  /* 3 */
  {
    const bf = createFieldBackfill(fakeClient({ refuseIntraday: true }).client, { now, root });
    let threw = '';
    await bf.build('SPY', DAY).catch(e => (threw = String(e)));
    check('a session with its calls refused is not written', threw.includes('refused'));
    const out = createFieldBackfill(fakeClient({ outOfWindow: true }).client, { now, root });
    let why = '';
    await out.build('SPY', '2023-11-01').catch(e => (why = String(e)));
    check("a session before the plan's window says so", why.includes('window'));
  }
  /* 4 */
  {
    const bf = createFieldBackfill(fakeClient().client, { now, root });
    const first = JSON.parse(bf.ask('spy', `${DAY},2026-10-10,2026-10-13,bad`).body);
    check('the ask queues the weekdays before today alone', JSON.stringify([first.working, ...first.queued]) === JSON.stringify([null, DAY]) || first.working === DAY);
    for (let i = 0; i < 200 && !bf.idle(); i++) await new Promise(r => setTimeout(r, 5));
    const second = JSON.parse(bf.ask('SPY', DAY).body);
    check('…and answers it ready once built', second.ready.includes(DAY));
    const served = bf.day('SPY', DAY);
    check('a built session is served whole', served.status === 200 && (JSON.parse(served.body) as PastDay).day === DAY);
    check('a session not built is a 404', bf.day('SPY', '2026-10-01').status === 404);
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}


/* ---- THE TAPE (server/tapeBackfill.ts, 2026-10-13): a day's prints streamed from a zip, into /intraday's shape ------- */
{
  check('csvFields: a quoted field keeps its commas, a doubled quote is one', JSON.stringify(csvFields('a,"{bid_side,bullish}",b,"x""y"')) === JSON.stringify(['a', '{bid_side,bullish}', 'b', 'x"y']) && csvFields('1,2,3').length === 3);
  const D = '2024-06-12';
  const header = 'id,underlying_symbol,executed_at,nbbo_bid,nbbo_ask,size,price,option_chain_id,tags,expiry,option_type,open_interest,strike,premium,volume,underlying_price,implied_volatility,canceled,trading_hours';
  const row = (sym: string, at: string, chain: string, up: string, iv: string, canceled = 'f') => `x,${sym},${D} ${at}+00,1,1.2,1,1.1,${chain},"{bid_side,bullish}",2024-06-14,call,10,540,110,1,${up},${iv},${canceled},rth`;
  const lines = [
    header,
    row('SPY', '13:30:00.100000', 'SPY240614C00540000', '540.10', '0.20'),
    row('SPY', '13:30:30.100000', 'SPY240614C00540000', '540.20', '0.22'),
    row('SPY', '13:31:00.100000', 'SPY240614C00540000', '540.30', '0.30', 't'),
    row('SPY', '13:31:05.100000', 'SPY240614C00540000', '540.25', '0.25'),
    row('SPXW', '13:30:01.000000', 'SPXW240614C05400000', '5401.5', '0.15'),
    row('SPX', '13:30:40.000000', 'SPX240614C05400000', '5403.25', '0.16'),
    row('SPXW', '13:31:20.000000', 'SPXW240614C05400000', '5399.75', '0.15'),
    row('QQQ', '13:30:02.000000', 'QQQ240614C00460000', '460.1', '0.3'),
    row('AAPL', '13:30:02.000000', 'AAPL240614C00200000', '200', '0.3'),
  ];
  const csv = Buffer.from(lines.join('\n') + '\n');
  const deflated = deflateRawSync(csv);
  const name = Buffer.from(`${D}-option_trades.csv`);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(deflated.length, 18);
  local.writeUInt32LE(csv.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  const central = Buffer.from('PK\x01\x02trailing bytes the reader never needs');
  const zip = Buffer.concat([local, name, deflated, central]);
  const server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/zip');
    res.end(zip);
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as { port: number }).port;
  const tapeClient = {
    hasKey: () => true,
    get: async () => ({ status: 404, contentType: 'application/json', body: '{}', from: 'upstream' as const }),
    redirectOf: async (_p: string, path: string) => (path.includes(`/full-tape/${D}`) ? { status: 302, location: `http://127.0.0.1:${port}/${D}.zip` } : { status: 404, location: null }),
  } as unknown as FeedClient;
  const tapeRoot = mkdtempSync(join(tmpdir(), 'slayer-tape-'));
  try {
    const read = tapeReader(tapeClient, { root: tapeRoot });
    const day = await read(D, ['SPY', 'SPX']);
    check('the tape is streamed from the archive’s link: nine prints, the wanted names kept, the canceled one dropped, the other name left', day != null && day.prints === 9 && day.canceled === 1 && day.kept === 6 && !('QQQ' in day.contracts) && !('AAPL' in day.contracts));
    const spy = day?.contracts.SPY?.['SPY240614C00540000'] ?? [];
    check("a contract's minute is its lowest and highest print vol, in /intraday's shape", spy.length === 2 && spy[0].start_time === `${D}T13:30:00.000Z` && spy[0].iv_low === '0.2' && spy[0].iv_high === '0.22' && spy[1].iv_low === '0.25' && spy[1].iv_high === '0.25');
    const spx = day?.prices.SPX ?? [];
    check("an index's minute is its prints' underlying price — SPXW's and SPX's together: first, high, low, last, how many", spx.length === 2 && spx[0][1] === 5401.5 && spx[0][2] === 5403.25 && spx[0][3] === 5401.5 && spx[0][4] === 5403.25 && spx[0][5] === 2 && spx[1][4] === 5399.75 && existsSync(join(tapeRoot, 'SPX', D, 'tape-price.json')));
    check('the same compression as the minute-vol path: the tape rows and /intraday rows alike give [minute, midpoint]', JSON.stringify(compressTicks(spy, D)) === JSON.stringify(compressTicks(spy.map(r => ({ ...r })), D)) && compressTicks(spy, D).length === 4 && Math.abs(compressTicks(spy, D)[1] - 0.21) < 1e-9);
    {
      const { client: c2, asked: asked2 } = fakeClient();
      const bf2 = createFieldBackfill(c2, { now, root: tapeRoot });
      const one = sym(600, 'C');
      const tapeDay = { day: DAY, contracts: { SPY: { [one]: [{ start_time: `${DAY}T13:30:00.000Z`, iv_low: '0.2', iv_high: '0.2' }, { start_time: `${DAY}T13:33:00.000Z`, iv_low: '0.24', iv_high: '0.26' }] }, SPX: { [one]: [{ start_time: `${DAY}T13:31:00.000Z`, iv_low: '0.3', iv_high: '0.3' }] } }, prices: { SPX: [[Date.parse(`${DAY}T13:30:00Z`), 600, 600.4, 599.8, 600.1, 40], [Date.parse(`${DAY}T13:31:00Z`), 600.1, 600.3, 599.9, 600.2, 35], [Date.parse(`${DAY}T19:59:00Z`), 601, 601.2, 600.8, 601.1, 20], [Date.parse(`${DAY}T20:10:00Z`), 601.1, 601.1, 601.1, 601.1, 2]] as [number, number, number, number, number, number][] }, prints: 0, kept: 0, canceled: 0, bytes: 0, seconds: 0 };
      const built = await bf2.build('SPY', DAY, tapeDay);
      check('a session built from the tape says so, its ticks the tape’s, and asks no per-contract minutes of the vendor', built.vols === 'tape' && JSON.stringify(built.ticks[one]) === JSON.stringify([Date.parse(`${DAY}T13:30:00.000Z`), 0.2, Date.parse(`${DAY}T13:33:00.000Z`), 0.25]) && built.refused === 0 && !asked2.some(p => p.includes('/intraday')));
      /* an index: no bars on the plan — its minutes are the tape's prints' underlying price, the regular session alone */
      const before = asked2.length;
      const spx = await bf2.build('SPX', DAY, tapeDay);
      const askedBars = asked2.slice(before).some(p => p.includes('/ohlc/1m'));
      check("an index's day is built on the tape's prices: three regular minutes as bars (the one past 4:00 pm left out), the open the first print's, no bar asked of the vendor", !askedBars && spx.bars.length === 3 && spx.bars[0].open === 600 && spx.bars[0].high === 600.4 && spx.bars[0].low === 599.8 && spx.bars[0].close === 600.1 && spx.bars.every(b => b.session === 'r') && spx.vols === 'tape');
    }
    check(`a day before ${TAPE_UNTIL} is the tape's, a day from it UW's minutes`, '2025-03-31' < TAPE_UNTIL && !('2025-04-01' < TAPE_UNTIL));
    const refused = await read('2023-01-03', ['SPY']);
    check('a day the archive refuses builds nothing', refused === null);
  } finally {
    server.close();
    rmSync(tapeRoot, { recursive: true, force: true });
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
