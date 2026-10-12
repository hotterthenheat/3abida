/*
  THE FEED PROXY, PROVED OFFLINE (2026-10-12) — runs in `npm test`. No network, no key: the bucket queues rather
  than fails, a missing key is a 503 no-key, a bad path is refused, a key never comes back in a body, and the
  middleware answers this machine alone.
*/
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Gate, TokenBucket, createFeedClient, failKind, feedMiddleware, ttlFor } from '../server/feed';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean) => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
};

/* the bucket: five at once, the sixth waits for a token (here: 5 a second, so about 200 ms) */
{
  const b = new TokenBucket(5, 1000);
  const t0 = Date.now();
  const times: number[] = [];
  await Promise.all(Array.from({ length: 7 }, () => b.take().then(() => times.push(Date.now() - t0))));
  times.sort((a, z) => a - z);
  check('the bucket lets five out at once', times[4] < 50);
  check('the sixth and seventh wait their turn, none refused', times[5] >= 150 && times[6] >= 350 && times.length === 7);
}

/* Unusual Whales' three at once: the gate lets three out and queues the rest, none refused */
{
  const g = new Gate(3);
  let peak = 0;
  let live = 0;
  const done = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      g.run(async () => {
        live++;
        peak = Math.max(peak, live);
        await new Promise(r => setTimeout(r, 30));
        live--;
        return i;
      })
    )
  );
  check('the vendor gate never has more than three out', peak === 3);
  check('every queued call is answered, in turn', done.length === 8 && g.active === 0 && g.waiting === 0);
}

/* the TTLs by what a path is */
check('a quote is kept seconds', ttlFor('uw', '/api/stock/SPY/stock-state') <= 5000);
check('a contract list is kept hours', ttlFor('massive', '/v3/reference/options/contracts') >= 3600_000);
/* Pinpoint and Terrain (2026-10-12): the book half a minute, the daily counts ten */
check('the book by strike is kept half a minute', ttlFor('uw', '/api/stock/SPY/spot-exposures/strike') === 30_000 && ttlFor('uw', '/api/stock/SPY/spot-exposures/expiry-strike') === 30_000);
check('open interest, max pain and the implied moves are kept ten minutes', ['oi-per-strike', 'max-pain', 'interpolated-iv'].every(r => ttlFor('uw', `/api/stock/SPY/${r}`) === 600_000));

/* no key: 503 no-key, and nothing leaves */
{
  const c = createFeedClient({ keys: {} });
  const a = await c.get('uw', '/api/stock/SPY/stock-state');
  check('no key answers 503 no-key', a.status === 503 && failKind(a) === 'no-key');
  const bad = await createFeedClient({ keys: { uw: 'x'.repeat(20) } }).get('uw', '/etc/passwd');
  check('a path outside the vendor API is refused', bad.status === 400);
  const up = await createFeedClient({ keys: { massive: 'k'.repeat(20) } }).get('massive', '/v2/../../x');
  check('a path climbing out is refused', up.status === 400);
}

/* the network refusing the host is told apart from a refused key: fetch fails before any status */
{
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
  }) as typeof fetch;
  const a = await createFeedClient({ keys: { uw: 'secret-token-123456' } }).get('uw', '/api/stock/SPY/stock-state');
  check('a refused connection is "network", not a bad key', a.status === 502 && failKind(a) === 'network');
  globalThis.fetch = (async () => new Response('{"error":"bad token secret-token-123456"}', { status: 401, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  const b = await createFeedClient({ keys: { uw: 'secret-token-123456' } }).get('uw', '/api/stock/SPY/stock-state');
  check('a 401 is a refused key', failKind(b) === 'key-refused');
  check('a key echoed by the vendor is scrubbed from the body', !b.body.includes('secret-token-123456'));
  let sent = '';
  globalThis.fetch = (async (u: URL) => {
    sent = String(u);
    return new Response('{"results":[]}', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  await createFeedClient({ keys: { massive: 'massive-key-987654' } }).get('massive', '/v3/reference/tickers?ticker=AAPL');
  check('Massive gets its key as apiKey, on the server', sent.includes('apiKey=massive-key-987654') && sent.startsWith('https://api.massive.com/'));
  globalThis.fetch = realFetch;
}

/* the middleware: loopback only, GET only, status without keys */
{
  const mw = feedMiddleware({ keys: {} });
  const call = (url: string, addr = '127.0.0.1', method = 'GET') =>
    new Promise<{ status: number; body: string }>(resolve => {
      const req = Object.assign(new EventEmitter(), { url, method, socket: { remoteAddress: addr } }) as unknown as IncomingMessage;
      const res = { statusCode: 0, setHeader() {}, end(body: string) { resolve({ status: res.statusCode, body }); } } as unknown as ServerResponse;
      void mw(req, res, () => resolve({ status: -1, body: '' }));
    });
  const s = await call('/feed/status');
  check('/feed/status answers 200 with no keys, saying so', s.status === 200 && JSON.parse(s.body).uw.state === 'no-key' && JSON.parse(s.body).uw.key === false);
  check('another machine is refused', (await call('/feed/status', '192.168.1.20')).status === 403);
  check('only GET', (await call('/feed/uw/api/x', '127.0.0.1', 'POST')).status === 405);
  check('a page that is not the feed passes through', (await call('/pulse')).status === -1);
  check('no key: the route answers 503 no-key', (await call('/feed/massive/v1/marketstatus/now')).status === 503);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
