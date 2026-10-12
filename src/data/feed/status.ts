/*
==================================================
  SLAYER TERMINAL - WHERE THE FEED STANDS (data/feed/status.ts)

  One small store: is each vendor reachable through the
  proxy, and if not, why. Set by one cheap probe when the
  terminal opens (AppShell), again when the tab comes back
  after five minutes, and from Settings › Data sources.
  The proxy's /feed/status runs the probe server-side —
  one call per vendor, kept a minute — and answers 200
  with or without keys, so a terminal with no .env asks
  nothing of any vendor and logs nothing.

  The answer never carries a key, only whether one is set.
==================================================
*/

import { useSyncExternalStore } from 'react';
import type { FeedProvider } from './client';

/** Where a vendor stands */
export type ProviderState =
  | 'unknown' // not asked yet
  | 'ok' // the probe came back 200
  | 'no-key' // no key in .env
  | 'network' // the network refused the host
  | 'timeout'
  | 'key-refused' // 401
  | 'plan' // 403
  | 'rate' // 429
  | 'upstream' // another error from the vendor
  | 'absent'; // no proxy here (the terminal served without its dev server)

export interface ProviderStatus {
  state: ProviderState;
  /** Whether the proxy holds a key for it — a yes or no, never the key */
  key: boolean;
  /** The probe's HTTP status (0 when it never reached the vendor) */
  status: number;
  /** When the probe ran, epoch ms (0 before) */
  at: number;
}

export type FeedStatus = Record<FeedProvider, ProviderStatus>;

const blank = (): ProviderStatus => ({ state: 'unknown', key: false, status: 0, at: 0 });
let state: FeedStatus = { uw: blank(), massive: blank() };
const fns = new Set<() => void>();
const publish = (next: FeedStatus) => {
  state = next;
  for (const f of Array.from(fns)) f();
};
const subscribe = (fn: () => void) => {
  fns.add(fn);
  return () => fns.delete(fn);
};
const read = () => state;

/** Where every vendor stands now */
export const getFeedStatus = (): FeedStatus => state;
/** Is a vendor reachable */
export const isUp = (s: FeedStatus, p: FeedProvider): boolean => s[p].state === 'ok';

const STATES = new Set<ProviderState>(['ok', 'no-key', 'network', 'timeout', 'key-refused', 'plan', 'rate', 'upstream']);
const readOne = (v: unknown): ProviderStatus => {
  const o = (v ?? {}) as { state?: unknown; key?: unknown; status?: unknown; at?: unknown };
  const st = typeof o.state === 'string' && STATES.has(o.state as ProviderState) ? (o.state as ProviderState) : 'upstream';
  return { state: st, key: o.key === true, status: typeof o.status === 'number' ? o.status : 0, at: typeof o.at === 'number' ? o.at : Date.now() };
};

let probing: Promise<FeedStatus> | null = null;

/** Ask the proxy where each vendor stands; one probe at a time */
export function probeFeeds(): Promise<FeedStatus> {
  if (probing) return probing;
  probing = (async () => {
    let next: FeedStatus;
    try {
      const res = await fetch('/feed/status', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) throw new Error('absent');
      const body = (await res.json()) as Record<string, unknown>;
      next = { uw: readOne(body.uw), massive: readOne(body.massive) };
    } catch {
      const now = Date.now();
      next = { uw: { ...blank(), state: 'absent', at: now }, massive: { ...blank(), state: 'absent', at: now } };
    }
    publish(next);
    return next;
  })().finally(() => {
    probing = null;
  });
  return probing;
}

const STALE_MS = 5 * 60 * 1000;
let started = false;

/** Probe once now, and again when a tab hidden five minutes comes back. Returns the stop. */
export function startFeedProbe(): () => void {
  if (started) return () => {};
  started = true;
  void probeFeeds();
  const onShow = () => {
    if (document.visibilityState !== 'visible') return;
    const last = Math.max(state.uw.at, state.massive.at);
    if (Date.now() - last > STALE_MS) void probeFeeds();
  };
  document.addEventListener('visibilitychange', onShow);
  return () => {
    started = false;
    document.removeEventListener('visibilitychange', onShow);
  };
}

/** Where every vendor stands, rendering when it changes */
export const useFeedStatus = (): FeedStatus => useSyncExternalStore(subscribe, read, read);
