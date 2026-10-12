/*
==================================================
  SLAYER TERMINAL - THE FEED CLIENT (data/feed/client.ts)

  THE BROWSER ASKS THE PROXY, NEVER THE VENDOR
  (2026-10-12). Every call goes to /feed/<provider>/…
  on the terminal's own server (server/feed.ts, mounted
  by vite.config.ts), which adds the key there. Nothing
  here reads, holds or sends a key — there is none in
  the bundle to read.

  A call never throws: it comes back { ok: true, data }
  or { ok: false, reason }, and a room that gets the
  second keeps its own book. One call in flight per URL.
==================================================
*/

export type FeedProvider = 'uw' | 'massive';

/** Why a call came back empty-handed — the proxy's own words, then the vendor's status */
export type FeedFail =
  | 'no-key' // the key is not in .env
  | 'network' // the network refused the host
  | 'timeout'
  | 'key-refused' // 401: the vendor refused the key
  | 'plan' // 403: the plan does not reach this
  | 'rate' // 429
  | 'upstream' // any other error from the vendor
  | 'absent' // no proxy answered (a static host, a build served elsewhere)
  | 'shape'; // the answer was not what the adapter reads

export type FeedResult<T> = { ok: true; data: T; at: number } | { ok: false; reason: FeedFail; status: number };

export type Params = Record<string, string | number | boolean | null | undefined>;

/** The proxy's address for a vendor path */
export function feedUrl(provider: FeedProvider, path: string, params?: Params): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const qs = q.toString();
  return `/feed/${provider}${path}${qs ? `?${qs}` : ''}`;
}

/**
 * Massive's paging: `next_url` is an absolute https://api.massive.com/… address (seen live, 2026-10-12) carrying a
 * cursor and no key. The browser follows it through the proxy instead, any key-shaped parameter dropped.
 */
export function viaProxy(nextUrl: string): string | null {
  try {
    const u = new URL(nextUrl);
    if (u.hostname !== 'api.massive.com') return null;
    u.searchParams.delete('apiKey');
    return `/feed/massive${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

const statusFail = (status: number, error: unknown): FeedFail => {
  if (error === 'no-key' || error === 'network' || error === 'timeout') return error;
  if (status === 401) return 'key-refused';
  if (status === 403) return 'plan';
  if (status === 429) return 'rate';
  if (status === 404 && error === undefined) return 'absent';
  return 'upstream';
};

const flying = new Map<string, Promise<FeedResult<unknown>>>();

/** GET a proxy URL and parse it — one in flight per URL */
export function feedFetch(url: string): Promise<FeedResult<unknown>> {
  const already = flying.get(url);
  if (already) return already;
  const run = (async (): Promise<FeedResult<unknown>> => {
    let res: Response;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
    } catch {
      return { ok: false, reason: 'absent', status: 0 };
    }
    /* a host with no proxy hands back its page for any address — that is not an answer */
    if (!(res.headers.get('content-type') ?? '').includes('json')) return { ok: false, reason: 'absent', status: res.status };
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { ok: false, reason: 'shape', status: res.status };
    }
    if (!res.ok) return { ok: false, reason: statusFail(res.status, (body as { error?: unknown } | null)?.error), status: res.status };
    return { ok: true, data: body, at: Date.now() };
  })();
  flying.set(url, run);
  void run.finally(() => flying.delete(url));
  return run;
}

/** GET a vendor path through the proxy and hand the body to an adapter; an adapter that throws is a 'shape' miss */
export async function feedGet<T>(provider: FeedProvider, path: string, params: Params | undefined, adapt: (body: unknown) => T): Promise<FeedResult<T>> {
  const r = await feedFetch(feedUrl(provider, path, params));
  if (!r.ok) return r;
  try {
    return { ok: true, data: adapt(r.data), at: r.at };
  } catch {
    return { ok: false, reason: 'shape', status: 200 };
  }
}

/* ---- reading the vendors' fields ----------------------------------------------------------------------------- */

/** A number from a field — Unusual Whales sends most figures as numeric strings ("777.9405"), seen live 2026-10-12 */
export function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
/** A number, 0 when the field is missing or null */
export const num0 = (v: unknown): number => num(v) ?? 0;
export const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
export const bool = (v: unknown): boolean => v === true;
/** An ISO time (or epoch ms) as epoch ms; NaN when it is not one */
export const ms = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' ? Date.parse(v) : NaN);

/** The rows of a body: a bare array (UW's flow-recent), or under `data` (the rest of UW), or under `results` (Massive) */
export function rowsOf(body: unknown, key: 'data' | 'results' = 'data'): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  const inner = (body as Record<string, unknown> | null)?.[key];
  if (Array.isArray(inner)) return inner as Record<string, unknown>[];
  throw new Error('no rows');
}
/** The object under a key (UW `data`, Massive `results`) */
export function objOf(body: unknown, key: 'data' | 'results' = 'data'): Record<string, unknown> {
  const inner = (body as Record<string, unknown> | null)?.[key];
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) return inner as Record<string, unknown>;
  throw new Error('no object');
}
