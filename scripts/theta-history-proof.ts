/*
  THE DOWNLOADER'S RULES (scripts/theta-history, the owner's section C, 2026-10-14) against a stand-in terminal on
  127.0.0.1 — never the real one, which this proof never starts: the walk is newest first over the terminal's own
  dates; a chain-day keeps the window's expirations and the band's strikes only; every file is written whole; the
  manifest checkpoints a ticker a day a feed; a second run asks no data call again; an empty answer (472) and a denied
  one (471) are logged with their URLs; the report after N sessions names GB and minutes a session and the projection.

    tsx scripts/theta-history-proof.ts     (in `npm test`)
*/
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (ok) pass++;
  else fail++;
};

/* the stand-in terminal: the v3 paths the downloader asks, in the shapes the probe recorded */
const calls: string[] = [];
const sessions = ['2026-10-09', '2026-10-12', '2026-10-13'];
const nd = (rows: Record<string, unknown>[]) => rows.map(r => JSON.stringify(r)).join('\n') + '\n';
const server = createServer((req, res) => {
  const u = new URL(req.url ?? '/', 'http://127.0.0.1');
  const p = u.pathname.replace(/^\/v3/, '');
  const q = Object.fromEntries(u.searchParams);
  calls.push(`${p}?${u.searchParams}`);
  const send = (status: number, body: string) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'text/plain');
    res.end(body);
  };
  if (p === '/terminal/mdds/status') return send(200, 'CONNECTED');
  if (q.format !== 'ndjson') return send(473, 'INVALID_PARAMS: no format');
  const sym = q.symbol ?? '';
  if (p === '/stock/list/dates/trade') return send(200, nd(sessions.map(d => ({ date: d.replace(/-/g, '') }))));
  if (p === '/index/list/dates') return send(200, nd(sessions.map(d => ({ date: d.replace(/-/g, '') }))));
  if (p === '/option/list/expirations') return send(200, nd([{ expiration: '20261016' }, { expiration: '20261120' }, { expiration: '20270115' }]));
  if (p === '/option/list/dates/quote') return send(200, nd([{ date: '20260901' }, { date: '20261009' }]));
  if (p === '/interest_rate/history/eod') return send(471, 'PERMISSION: not entitled');
  if (p === '/stock/history/eod' || p === '/index/history/eod') return send(200, nd(sessions.map(d => ({ created: d, open: 100, high: 102, low: 98, close: 101, volume: 1000 }))));
  if (p === '/stock/history/ohlc' || p === '/index/history/ohlc') {
    const rows: Record<string, unknown>[] = [];
    for (const d of sessions) for (const m of ['09:30', '09:31', '09:32']) rows.push({ timestamp: `${d}T${m}:00.000`, open: 100, high: 101, low: 99, close: 100.5, volume: 10 });
    return send(200, nd(rows));
  }
  if (p === '/stock/history/quote') {
    if (q.date === '20261012') return send(472, 'NO_DATA');
    return send(200, nd([{ timestamp: `${q.date}T09:30:00.000`, bid: 100, ask: 100.02, bid_size: 5, ask_size: 7 }]));
  }
  if (p === '/index/history/price') return send(200, nd([{ timestamp: `${q.date}T09:30:00.000`, price: 5000 }]));
  if (p === '/option/list/contracts/quote') {
    /* six contracts: two in the window and band, one past the window, one outside the band, one in 1/10-cent units in band, one in 1/10-cent units out of band */
    return send(200, nd([
      { symbol: sym, expiration: '20261016', strike: 100, right: 'C' },
      { symbol: sym, expiration: '20261120', strike: 95, right: 'P' },
      { symbol: sym, expiration: '20270115', strike: 100, right: 'C' },
      { symbol: sym, expiration: '20261016', strike: 150, right: 'C' },
      { symbol: sym, expiration: '20261016', strike: 101000, right: 'P' },
      { symbol: sym, expiration: '20261016', strike: 60000, right: 'P' },
    ]));
  }
  if (p === '/option/history/open_interest') return send(200, nd([{ timestamp: `${q.date}T06:30:00.000`, expiration: '20261016', strike: 100, right: 'C', open_interest: 1200 }, { timestamp: `${q.date}T06:30:00.000`, expiration: '20270115', strike: 100, right: 'C', open_interest: 5 }]));
  if (p === '/option/history/quote') return send(200, nd([{ timestamp: `${q.date}T09:30:00.000`, expiration: q.expiration, strike: 100, right: 'C', bid: 1, ask: 1.1, bid_size: 10, ask_size: 12 }, { timestamp: `${q.date}T09:30:00.000`, expiration: q.expiration, strike: 150, right: 'C', bid: 0.1, ask: 0.2, bid_size: 1, ask_size: 1 }]));
  return send(404, 'NO_IMPL');
});
await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
const port = (server.address() as { port: number }).port;
process.env.THETA_PROBE_BASE = `http://127.0.0.1:${port}/v3`;

const { optionsFromEnv, runHistory } = await import('./theta-history/index');
const root = join(tmpdir(), `slayer-history-proof-${process.pid}`);
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });
const lines: string[] = [];
const opts = optionsFromEnv({ HISTORY_ROOT: root, HISTORY_TICKERS: 'SPY', HISTORY_CHAIN_ROOTS: 'SPY', HISTORY_NBBO: 'SPY', HISTORY_INDICES: 'VIX', HISTORY_SESSIONS: '2', HISTORY_REPORT_AFTER: '2', HISTORY_RATES: 'none' }, l => lines.push(l));
const r1 = await runHistory(opts);
const dataCalls = () => calls.filter(c => !c.startsWith('/terminal/') && !c.includes('/list/'));
const n1 = dataCalls().length;
check(`the walk is newest first over the terminal's dates (${r1.sessions.join(', ')})`, r1.sessions.join(',') === '2026-10-13,2026-10-12');
const gz = (p: string) => (existsSync(p) ? gunzipSync(readFileSync(p)).toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Record<string, unknown>) : null);
const contracts = gz(join(root, 'SPY', '2026-10-13', 'chain-contracts.ndjson.gz'));
check(`a chain-day keeps the window's expirations and the band's strikes only (${contracts?.length ?? 0} of 6 contracts: ${contracts?.map(c => `${c.expiration}/${c.strike}`).join(', ')})`, !!contracts && contracts.length === 3 && contracts.every(c => c.expiration !== '20270115' && Number(c.strike) !== 150 && Number(c.strike) !== 60000));
const oi = gz(join(root, 'SPY', '2026-10-13', 'chain-oi.ndjson.gz'));
check('open interest is filtered to the same window', !!oi && oi.length === 1 && oi[0].expiration === '20261016');
const quotes = gz(join(root, 'SPY', '2026-10-13', 'chain-quotes-2026-10-16.ndjson.gz'));
check(`the quotes are asked an expiration at a time, the band's strikes kept (${quotes?.length ?? 0} rows), raw fields intact`, !!quotes && quotes.length === 1 && quotes[0].bid_size === 10 && quotes[0].ask_size === 12 && !existsSync(join(root, 'SPY', '2026-10-13', 'chain-quotes-2027-01-15.ndjson.gz')));
const stock1m = gz(join(root, 'SPY', '2026-10-13', 'stock-1m.ndjson.gz'));
check('the stock minutes of a month are split into a file a day', !!stock1m && stock1m.length === 3 && existsSync(join(root, 'SPY', '2026-10-09', 'stock-1m.ndjson.gz')));
const m = JSON.parse(readFileSync(join(root, 'SPY', 'manifest.json'), 'utf8')) as { first: Record<string, string | null>; days: Record<string, Record<string, { s: string; code?: number }>>; months: Record<string, { s: string }>; years: Record<string, { s: string }> };
check(`the manifest checkpoints a day a feed (${Object.keys(m.days['2026-10-13'] ?? {}).join(', ')}), the month and the year`, m.days['2026-10-13']?.['chain-contracts']?.s === 'ok' && m.days['2026-10-13']?.['quotes:2026-10-16']?.s === 'ok' && m.months['1m:2026-10']?.s === 'ok' && m.years['eod:2026']?.s === 'ok' && m.first.stock === '2026-10-09' && m.first.chain === '2026-09-01');
check("the NBBO day the terminal had no data for is 'empty' (472), never asked again", m.days['2026-10-12']?.['stock-quote-1m']?.s === 'empty' && m.days['2026-10-12']?.['stock-quote-1m']?.code === 472);
const log = readFileSync(join(root, 'log.ndjson'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as { kind: string; url?: string; status?: number | string; feed?: string });
check(`the empty answer is logged with its URL (${log.filter(l => l.kind === 'empty').length} empty lines)`, log.some(l => l.kind === 'empty' && String(l.url).includes('/stock/history/quote') && String(l.url).includes('20261012')));
check('each feed\'s first served date is logged', log.some(l => l.kind === 'first' && l.feed === 'chain') && log.some(l => l.kind === 'first' && l.feed === 'stock'));
check('no file is left as a .part', !findPart(root));
check(`the report after ${opts.reportAfter} sessions names bytes and minutes a session and the projection (${r1.report.split('\n').length} lines)`, /bytes a session/.test(r1.report) && /Projected total/.test(r1.report) && /free disk/.test(r1.report) && existsSync(join(root, 'report.md')));
/* the second run: nothing asked again */
const r2 = await runHistory(opts);
const n2 = dataCalls().length - n1;
check(`a second run asks no data call again (${n2} data calls; the first made ${n1}), the manifest standing`, n2 === 0 && r2.sessions.length === 2);
/* a denied feed: the rates (471) are logged with the URL when asked */
const opts2 = { ...opts, rates: 'auto' as const, stocks: [], chainRoots: [], nbbo: [], indices: [], maxSessions: 1 };
await runHistory(opts2);
const log2 = readFileSync(join(root, 'log.ndjson'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as { kind: string; url?: string; status?: number | string });
check('a denied feed (471) is logged with its URL', log2.some(l => l.kind === 'denied' && l.status === 471 && String(l.url).includes('/interest_rate/history/eod')));

function findPart(dir: string): boolean {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      if (findPart(p)) return true;
    } else if (f.endsWith('.part')) return true;
  }
  return false;
}

server.close();
rmSync(root, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
