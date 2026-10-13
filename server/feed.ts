/*
==================================================
  SLAYER TERMINAL - THE FEED PROXY (server/feed.ts)

  THE KEYS STAY ON THIS MACHINE'S SERVER (2026-10-12).
  The repo is public and the browser bundle is
  anybody's to read, so no key is ever in src, in a
  VITE_ variable or in a request the browser makes.
  The dev server (and `vite preview`) answers
  /feed/uw/* and /feed/massive/* itself: it reads
  UW_API_TOKEN and MASSIVE_API_KEY from .env (or the
  process environment), adds the key on the way out,
  and hands back the vendor's answer. The old provider
  layer's "direct" mode, which sent the key from the
  browser, is not coming back.

  WHAT IT DOES ON THE WAY:
    · no key → 503 { error: 'no-key' }; the rooms keep
      their own book;
    · a cache per URL, its life set by what the path
      is (a tape for seconds, a reference list for
      hours), and one request in flight per URL;
    · Massive's free plans allow about five calls a
      minute: a token bucket holds the calls in a
      queue and lets them out as tokens come, rather
      than failing them;
    · the network refusing the host (DNS, a refused
      connection, a proxy's 403 on the tunnel) is
      502 { error: 'network' } — never confused with
      the vendor's own 401 on a bad key;
    · the key is never logged, and is scrubbed out of
      any text that goes back (an error, a body).

  The same module is the node side of
  `npm run feed:check` (scripts/feed-check.ts), so the
  check and the proxy call the vendors the same way.
  docs/data-feed.md is the owner's page for it.
==================================================
*/

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createFieldRecorder } from './fieldRecorder';
import { createFieldBackfill } from './fieldBackfill';
import { createFieldStore } from './fieldStore';
import { createScorecard } from './scorecard';

export type ProviderId = 'uw' | 'massive';

export interface FeedKeys {
  uw?: string;
  massive?: string;
}

/** The two vendors: where they live and how a key is put on a request */
export const PROVIDERS: Record<ProviderId, { name: string; base: string; envVar: string; probe: string; pathOk: RegExp }> = {
  /* base and auth: uw-mcp docs/endpoints.json ("base_url", "auth": Bearer token via Authorization header) */
  uw: { name: 'Unusual Whales', base: 'https://api.unusualwhales.com', envVar: 'UW_API_TOKEN', probe: '/api/stock/SPY/stock-state', pathOk: /^\/api\// },
  /* base and auth: Massive's OpenAPI (client-js src/openapi.json): servers[0] https://api.massive.com, securitySchemes
     apiKey "in: query, name: apiKey" */
  massive: { name: 'Massive', base: 'https://api.massive.com', envVar: 'MASSIVE_API_KEY', probe: '/v1/marketstatus/now', pathOk: /^\/(v\d|vX)\// },
};

/* ---- how long an answer is kept, by what it is ----------------------------------------------------------------- */

const S = 1000;
const MIN = 60 * S;
const HOUR = 60 * MIN;
const TTL: Record<ProviderId, [RegExp, number][]> = {
  uw: [
    [/\/stock-state$|\/quote$/, 2 * S],
    /* a contract's past sessions change once a day (Trace's print card, 2026-10-12) */
    [/\/option-contract\/[^/]+\/historic$/, 10 * MIN],
    [/flow-alerts|option-trades|\/option-contract\//, 5 * S],
    [/\/darkpool\//, 10 * S],
    [/net-prem-ticks|market-tide|net-flow|top-net-impact/, 15 * S],
    /* the day per contract and a name's bars: Trace polls them every half minute or slower */
    [/\/screener\/option-contracts|\/ohlc\//, 20 * S],
    [/stock-volume-price-levels/, 60 * S],
    [/spot-exposures|greek-exposure|gex-levels/, 30 * S],
    /* a name's chain contract by contract: its open interest is counted once a day, its vols move slowly (Terrain's field) */
    [/^\/api\/stock\/[^/]+\/option-contracts$/, 10 * MIN],
    /* open interest is counted once a day; max pain and the implied moves move slowly (Pinpoint and Terrain, 2026-10-12) */
    [/oi-per-strike|max-pain|interpolated-iv/, 10 * MIN],
    [/flow-per-strike/, 30 * S],
    [/\/congress\/|\/insider\/|\/earnings\//, 10 * MIN],
    /* a name's listed expiries change once a session (Compass's calendar, 2026-10-12) */
    [/\/expiry-breakdown$/, 30 * MIN],
  ],
  massive: [
    [/^\/v1\/marketstatus\//, MIN],
    [/^\/v3\/snapshot\//, 5 * MIN],
    [/^\/v2\/aggs\//, 30 * MIN],
    [/^\/v3\/reference\/options\/contracts/, 6 * HOUR],
    [/^\/v3\/reference\/tickers/, 24 * HOUR],
  ],
};
const TTL_DEFAULT: Record<ProviderId, number> = { uw: 15 * S, massive: 5 * MIN };
export const ttlFor = (p: ProviderId, path: string): number => TTL[p].find(([re]) => re.test(path))?.[1] ?? TTL_DEFAULT[p];

/* ---- the answer ------------------------------------------------------------------------------------------------ */

export interface FeedAnswer {
  status: number;
  contentType: string;
  body: string;
  /** Where the answer came from: the vendor, the cache, or the proxy itself (no key, the network) */
  from: 'upstream' | 'cache' | 'proxy';
}

/** What a failure was, in the owner's words — the check prints it, the Settings page shows its kind */
export type FailKind = 'no-key' | 'network' | 'timeout' | 'key-refused' | 'plan' | 'rate' | 'upstream';
export function failKind(a: FeedAnswer): FailKind | null {
  if (a.status >= 200 && a.status < 300) return null;
  if (a.from === 'proxy') {
    try {
      const e = (JSON.parse(a.body) as { error?: string }).error;
      if (e === 'no-key' || e === 'network' || e === 'timeout') return e;
    } catch {
      /* not ours */
    }
  }
  if (a.status === 401) return 'key-refused';
  if (a.status === 403) return 'plan';
  if (a.status === 429) return 'rate';
  return 'upstream';
}
export const FAIL_WORDS: Record<FailKind, string> = {
  'no-key': 'no key set',
  network: 'the network refused the host',
  timeout: 'the host did not answer in time',
  'key-refused': 'the key was refused',
  plan: "the plan does not reach this (or the key is not allowed here)",
  rate: 'too many calls — the vendor asked to wait',
  upstream: 'the vendor answered with an error',
};

const json = (status: number, body: unknown): FeedAnswer => ({ status, contentType: 'application/json', body: JSON.stringify(body), from: 'proxy' });

/** Every place a key could show, scrubbed */
function scrub(text: string, keys: FeedKeys): string {
  let out = text;
  for (const k of [keys.uw, keys.massive]) if (k && k.length >= 4) out = out.split(k).join('[key]');
  return out.replace(/([?&]apiKey=)[^&\s"']+/gi, '$1[key]').replace(/(Bearer\s+)[A-Za-z0-9._-]{8,}/g, '$1[key]');
}

/* ---- Massive's limit: a token bucket that queues ---------------------------------------------------------------- */

export class TokenBucket {
  private tokens: number;
  private last = Date.now();
  private queue: (() => void)[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(
    private readonly capacity: number,
    private readonly perMs: number
  ) {
    this.tokens = capacity;
  }
  private refill() {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) * this.capacity) / this.perMs);
    this.last = now;
  }
  /** Resolves when a call may go out — at once while tokens remain, in turn after that */
  take(): Promise<void> {
    return new Promise(resolve => {
      this.queue.push(resolve);
      this.pump();
    });
  }
  /** The vendor said 429: spend what is left, so the queue waits for a full token */
  drain() {
    this.refill();
    this.tokens = 0;
  }
  get waiting(): number {
    return this.queue.length;
  }
  private pump() {
    this.refill();
    while (this.queue.length && this.tokens >= 1) {
      this.tokens -= 1;
      this.queue.shift()!();
    }
    if (this.queue.length && !this.timer) {
      const wait = Math.ceil(((1 - this.tokens) * this.perMs) / this.capacity);
      this.timer = setTimeout(() => {
        this.timer = null;
        this.pump();
      }, Math.max(50, wait));
    }
  }
}

/* ---- Unusual Whales' limit: three calls at once ----------------------------------------------------------------- */

/* THE BASIC PLAN ANSWERS THREE AT A TIME (seen 2026-10-12, a burst of eight: the fourth came back 429 "You have exceeded
   3 concurrent requests, the maximum allowed for your current plan"; the per-minute header read 1,000,000). A Trace page
   opens with a handful of calls at once, so the proxy lets three out and queues the rest — a queued call waits for one
   in flight to come back, it is never refused. */
export class Gate {
  private inFlight = 0;
  private queue: (() => void)[] = [];
  constructor(private readonly max: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.inFlight >= this.max) await new Promise<void>(resolve => this.queue.push(resolve));
    this.inFlight++;
    try {
      return await fn();
    } finally {
      this.inFlight--;
      this.queue.shift()?.();
    }
  }
  get active(): number {
    return this.inFlight;
  }
  get waiting(): number {
    return this.queue.length;
  }
}

/* ---- the client the proxy and the check share ------------------------------------------------------------------ */

export interface FeedClientOptions {
  keys: FeedKeys;
  /** Massive's calls a minute (the free plans: 5) */
  massivePerMinute?: number;
  timeoutMs?: number;
  /** Bypass the cache (the check wants the vendor's answer now) */
  noCache?: boolean;
  /** Unusual Whales' calls at once (the Basic plan: 3) */
  uwConcurrent?: number;
}

export function createFeedClient(opts: FeedClientOptions) {
  const keys = opts.keys;
  const timeoutMs = opts.timeoutMs ?? 20 * S;
  const bucket = new TokenBucket(opts.massivePerMinute ?? 5, MIN);
  const uwGate = new Gate(opts.uwConcurrent ?? 3);
  const cache = new Map<string, { until: number; answer: FeedAnswer }>();
  const inFlight = new Map<string, Promise<FeedAnswer>>();
  const CACHE_MAX = 400;

  const keep = (url: string, answer: FeedAnswer, ttl: number) => {
    if (cache.size >= CACHE_MAX) {
      const now = Date.now();
      for (const [k, v] of cache) if (v.until <= now) cache.delete(k);
      while (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    }
    cache.set(url, { until: Date.now() + ttl, answer });
  };

  async function upstream(p: ProviderId, pathAndQuery: string): Promise<FeedAnswer> {
    const key = keys[p];
    if (!key) return json(503, { error: 'no-key' });
    const url = new URL(PROVIDERS[p].base + pathAndQuery);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (p === 'uw') headers.Authorization = `Bearer ${key}`;
    else url.searchParams.set('apiKey', key);
    if (p === 'massive') await bucket.take();
    let res: Response;
    try {
      const go = () => fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
      res = p === 'uw' ? await uwGate.run(go) : await go();
      /* a 429 for calls at once (another tab, the check) is asked once more, after a breath, through the gate */
      if (p === 'uw' && res.status === 429) {
        await new Promise(r => setTimeout(r, 400));
        res = await uwGate.run(go);
      }
    } catch (e) {
      const err = e as { name?: string; cause?: { code?: string; message?: string }; message?: string };
      if (err.name === 'TimeoutError' || err.name === 'AbortError') return json(504, { error: 'timeout' });
      /* a refused tunnel, DNS, a reset: the network said no before the vendor could */
      const detail = scrub(String(err.cause?.code ?? err.cause?.message ?? err.message ?? 'fetch failed'), keys);
      return json(502, { error: 'network', detail });
    }
    if (res.status === 429 && p === 'massive') bucket.drain();
    const body = scrub(await res.text(), keys);
    return { status: res.status, contentType: res.headers.get('content-type') ?? 'application/json', body, from: 'upstream' };
  }

  /** GET a vendor path (with its query) — cached, one in flight per URL, Massive's calls in turn */
  async function get(p: ProviderId, pathAndQuery: string): Promise<FeedAnswer> {
    const path = pathAndQuery.split('?')[0];
    if (!PROVIDERS[p].pathOk.test(path) || path.includes('..')) return json(400, { error: 'bad-path' });
    if (!keys[p]) return json(503, { error: 'no-key' });
    const id = `${p}:${pathAndQuery}`;
    if (!opts.noCache) {
      const hit = cache.get(id);
      if (hit && hit.until > Date.now()) return { ...hit.answer, from: 'cache' };
    }
    const flying = inFlight.get(id);
    if (flying) return flying;
    const run = upstream(p, pathAndQuery).then(a => {
      if (a.status === 200 && !opts.noCache) keep(id, a, ttlFor(p, path));
      return a;
    });
    inFlight.set(id, run);
    try {
      return await run;
    } finally {
      inFlight.delete(id);
    }
  }

  /** GET a vendor path and answer where it redirects to — the tape archive's signed link (server/tapeBackfill.ts) —
      or null; never cached, never followed here, the key never in the answer */
  async function redirectOf(p: ProviderId, pathAndQuery: string): Promise<{ status: number; location: string | null }> {
    const path = pathAndQuery.split('?')[0];
    const key = keys[p];
    if (!PROVIDERS[p].pathOk.test(path) || path.includes('..') || !key) return { status: key ? 400 : 503, location: null };
    const url = new URL(PROVIDERS[p].base + pathAndQuery);
    const headers: Record<string, string> = {};
    if (p === 'uw') headers.Authorization = `Bearer ${key}`;
    else url.searchParams.set('apiKey', key);
    try {
      const go = () => fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
      const res = p === 'uw' ? await uwGate.run(go) : await go();
      const loc = res.headers.get('location');
      /* the body is not read: a 302's is a line of HTML, a 200's could be the archive itself */
      await res.body?.cancel().catch(() => undefined);
      return { status: res.status, location: res.status >= 300 && res.status < 400 && loc ? loc : null };
    } catch {
      return { status: 502, location: null };
    }
  }

  return { get, redirectOf, bucket, uwGate, hasKey: (p: ProviderId) => !!keys[p] };
}
export type FeedClient = ReturnType<typeof createFeedClient>;

/* ---- the probe: one cheap call per vendor ----------------------------------------------------------------------- */

export type ProbeState = 'ok' | FailKind;
export interface ProbeResult {
  state: ProbeState;
  /** The HTTP status the call came back with (0 when it never left) */
  status: number;
  at: number;
}

export async function probe(client: FeedClient, p: ProviderId): Promise<ProbeResult> {
  if (!client.hasKey(p)) return { state: 'no-key', status: 0, at: Date.now() };
  const a = await client.get(p, PROVIDERS[p].probe);
  return { state: failKind(a) ?? 'ok', status: a.from === 'proxy' ? 0 : a.status, at: Date.now() };
}

/* ---- the middleware Vite mounts --------------------------------------------------------------------------------- */

/** A request from this machine — the proxy holds the keys, so it never answers another one unless told to */
const isLoopback = (addr: string | undefined) => !!addr && (addr === '::1' || addr.startsWith('127.') || addr === '::ffff:127.0.0.1' || addr.startsWith('::ffff:127.'));

/** What the client may not pass on: a key of its own */
const STRIP = new Set(['apikey', 'apiKey', 'token', 'api_key']);

export function feedMiddleware(opts: FeedClientOptions & { allowLan?: boolean; recordNames?: string[]; fieldUpstream?: string }) {
  const client = createFeedClient(opts);
  /* THE FIELD'S RECORDER (server/fieldRecorder.ts): the names the terminal asked the field for — and `recordNames`,
     recorded whatever the tabs (the standalone recorder) — their book read once a minute through this client while
     the session is open, whether or not a tab is. With `fieldUpstream` (FEED_RECORDER_URL) the field's routes are
     answered by the always-on recorder there instead, so a dev server that comes and goes never records a day with
     holes beside it (the owner, 2026-10-13: "The recorder must run on an always-on machine"). */
  const upstream = opts.fieldUpstream?.replace(/\/+$/, '') || null;
  /* THE FIELD'S PAST SESSIONS (server/fieldBackfill.ts): a session before today rebuilt from UW's dated history, once */
  const backfill = createFieldBackfill(client);
  /* THE POINT-IN-TIME STORE (server/fieldStore.ts): two rows a minute, written by the recorder */
  const store = createFieldStore();
  const recorder = createFieldRecorder(client, { always: opts.recordNames, backfill, store });
  /* THE SCORECARD (server/scorecard.ts): the track record over the store's final rows, run after the close */
  const scorecard = createScorecard(backfill, store);
  let probed: { at: number; result: Promise<Record<ProviderId, ProbeResult>> } | null = null;
  const PROBE_TTL = MIN;

  const status = () => {
    if (!probed || Date.now() - probed.at > PROBE_TTL) {
      const result = Promise.all([probe(client, 'uw'), probe(client, 'massive')]).then(([uw, massive]) => ({ uw, massive }));
      probed = { at: Date.now(), result };
    }
    return probed.result;
  };

  const send = (res: ServerResponse, a: FeedAnswer) => {
    res.statusCode = a.status;
    res.setHeader('Content-Type', a.contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Feed-From', a.from);
    res.end(a.body);
  };

  /* ONE FEED MIDDLEWARE A PROCESS: a dev server's restart builds a new one in the same process (Vite re-reads its
     config when a server file changes), so the one before stops — its recorder's timer would otherwise keep writing
     the same minutes beside the new one's (2026-10-13: 29 minutes written twice) */
  const g = globalThis as { __slayerFeed?: { close: () => void } };
  g.__slayerFeed?.close();
  const close = () => {
    recorder.stop();
    if (g.__slayerFeed?.close === close) g.__slayerFeed = undefined;
  };
  g.__slayerFeed = { close };

  const handler = async (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
    const raw = req.url ?? '';
    if (!raw.startsWith('/feed/')) return next();
    if (!opts.allowLan && !isLoopback(req.socket.remoteAddress)) return send(res, json(403, { error: 'loopback-only' }));
    if (req.method !== 'GET') return send(res, json(405, { error: 'get-only' }));
    try {
      const url = new URL(raw, 'http://localhost');
      if (url.pathname === '/feed/status') {
        const s = await status();
        return send(res, json(200, { uw: { key: client.hasKey('uw'), ...s.uw }, massive: { key: client.hasKey('massive'), ...s.massive } }));
      }
      if (upstream && url.pathname.startsWith('/feed/field/')) {
        try {
          const r = await fetch(upstream + raw, { signal: AbortSignal.timeout(20_000) });
          return send(res, { status: r.status, contentType: r.headers.get('content-type') ?? 'application/json', body: await r.text(), from: 'proxy' });
        } catch {
          return send(res, json(502, { error: 'network', where: 'recorder' }));
        }
      }
      const sr = /^\/feed\/field\/([A-Za-z0-9.]{1,10})\/store$/.exec(url.pathname);
      if (sr) {
        const r = store.serve(sr[1], url.searchParams.get('day') ?? '', url.searchParams.get('kind') ?? 'final', Number(url.searchParams.get('since')) || 0);
        return send(res, { status: r.status, contentType: 'application/json', body: r.body, from: 'proxy' });
      }
      const rg = /^\/feed\/field\/([A-Za-z0-9.]{1,10})\/regime$/.exec(url.pathname);
      if (rg) {
        const r = scorecard.serveRegime(rg[1]);
        return send(res, { status: r.status, contentType: 'application/json', body: r.body, from: 'proxy' });
      }
      const sc = /^\/feed\/field\/([A-Za-z0-9.]{1,10})\/scorecard$/.exec(url.pathname);
      if (sc) {
        const r = scorecard.serve(sc[1]);
        return send(res, { status: r.status, contentType: 'application/json', body: r.body, from: 'proxy' });
      }
      const cv = /^\/feed\/field\/([A-Za-z0-9.]{1,10})\/coverage$/.exec(url.pathname);
      if (cv) {
        const r = backfill.coverage(cv[1]);
        const body = r.status === 200 ? JSON.stringify({ ...(JSON.parse(r.body) as Record<string, unknown>), store: store.days(cv[1]) }) : r.body;
        return send(res, { status: r.status, contentType: 'application/json', body, from: 'proxy' });
      }
      const past = /^\/feed\/field\/([A-Za-z0-9.]{1,10})\/past$/.exec(url.pathname);
      if (past) {
        const r = backfill.ask(past[1], url.searchParams.get('days') ?? '');
        return send(res, { status: r.status, contentType: 'application/json', body: r.body, from: 'proxy' });
      }
      const pd = /^\/feed\/field\/([A-Za-z0-9.]{1,10})\/day\/(\d{4}-\d{2}-\d{2})$/.exec(url.pathname);
      if (pd) {
        const r = backfill.day(pd[1], pd[2]);
        return send(res, { status: r.status, contentType: 'application/json', body: r.body, from: 'proxy' });
      }
      const f = /^\/feed\/field\/([A-Za-z0-9.]{1,10})$/.exec(url.pathname);
      if (f) {
        const r = recorder.serve(f[1], Number(url.searchParams.get('since')) || 0);
        return send(res, { status: r.status, contentType: 'application/json', body: r.body, from: 'proxy' });
      }
      const m = /^\/feed\/(uw|massive)(\/.*)$/.exec(url.pathname);
      if (!m) return send(res, json(404, { error: 'no-route' }));
      const p = m[1] as ProviderId;
      for (const k of Array.from(url.searchParams.keys())) if (STRIP.has(k)) url.searchParams.delete(k);
      const q = url.searchParams.toString();
      return send(res, await client.get(p, m[2] + (q ? `?${q}` : '')));
    } catch {
      return send(res, json(500, { error: 'proxy' }));
    }
  };
  /* the standalone recorder (server/recorderMain.ts) reaches the job and the store through the handler */
  return Object.assign(handler, { backfill, recorder, store, client, scorecard, close });
}
