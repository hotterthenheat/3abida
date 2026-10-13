/*
  Acceptance test for the field's past sessions (server/fieldBackfill.ts, 2026-10-13) — a stand-in client, no vendor:
  1. A session is rebuilt from what was dated it: the open interest dated the session, the session before's close
     vols, each traded contract's minute vols inside the regular session (a minute outside it is not kept), a minute
     kept only when its vol moved a tenth of a vol point
  2. Only contracts that traded, within the strikes the field can draw, are asked
  3. A session with too many calls refused is not written; one before the plan's window says so
  4. The ask answers which sessions are ready, building and queued, and a built one is served whole
*/
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFieldBackfill, type PastDay } from '../server/fieldBackfill';
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

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
