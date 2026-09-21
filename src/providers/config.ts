import type { ProviderId } from './types';

/*
==================================================
  SLAYER TERMINAL - PROVIDER CONFIG
  (providers/config.ts)

  Where the keys come from, and why not from here.
==================================================

  NO KEY IS WRITTEN IN THIS REPOSITORY, and none can be. Everything below
  reads `import.meta.env`, which Vite fills at BUILD time from a .env file
  that is never committed. Nothing here has a default, so a missing key is a
  missing capability rather than a silent fallback to someone else's quota.

  AND THE HONEST WARNING, because the alternative is a reader who thinks
  they are safe: a browser-only app cannot keep a secret. Vite INLINES every
  `VITE_`-prefixed variable into the shipped bundle, so a key configured
  that way is readable by anyone who opens the network tab. That is fine for
  a key you are willing to expose and fatal for one you are not.

  So there are two modes, and the settings page names which one is running:

    DIRECT   VITE_POLYGON_KEY / VITE_UW_KEY reach the vendor from the
             browser. Fastest to set up, and the key is public. Use it
             against a key you have scoped or can rotate freely.
    PROXIED  VITE_DATA_PROXY points at a server you control, which holds the
             real keys and forwards. The browser never sees a secret. This
             is the one to ship.

  Proxied wins when both are set — a configured proxy is a stated intent,
  and reading it as anything but "route everything through here" would leak
  the thing the reader set it up to protect.
*/

const env = import.meta.env as Record<string, string | undefined>;

/** The optional server that holds the real keys. Empty means direct. */
export const DATA_PROXY = (env.VITE_DATA_PROXY ?? '').replace(/\/+$/, '');

export const PROVIDER_META: Record<ProviderId, { label: string; site: string; envVar: string; restBase: string; wsBase: string }> = {
  polygon: {
    label: 'Polygon · Massive',
    site: 'massive.com',
    envVar: 'VITE_POLYGON_KEY',
    restBase: 'https://api.massive.com',
    wsBase: 'wss://socket.massive.com',
  },
  unusualwhales: {
    label: 'Unusual Whales',
    site: 'unusualwhales.com',
    envVar: 'VITE_UW_KEY',
    restBase: 'https://api.unusualwhales.com',
    wsBase: 'wss://api.unusualwhales.com/socket',
  },
};

/** The key itself, or null. Callers pass it to a client; nothing renders it. */
export function keyFor(id: ProviderId): string | null {
  const v = env[PROVIDER_META[id].envVar];
  return v && v.trim() ? v.trim() : null;
}

/** True when a key exists OR a proxy is configured — either can serve the data. */
export function isConfigured(id: ProviderId): boolean {
  return Boolean(DATA_PROXY) || keyFor(id) !== null;
}

export const isProxied = (): boolean => Boolean(DATA_PROXY);

/** The base a request should go to: the proxy's namespace, or the vendor. */
export function restBase(id: ProviderId): string {
  return DATA_PROXY ? `${DATA_PROXY}/${id}` : PROVIDER_META[id].restBase;
}

export function wsBase(id: ProviderId): string {
  if (!DATA_PROXY) return PROVIDER_META[id].wsBase;
  const scheme = DATA_PROXY.startsWith('https') ? 'wss' : 'ws';
  return `${scheme}://${DATA_PROXY.replace(/^https?:\/\//, '')}/${id}/socket`;
}

/**
 * Auth for a REST call. Proxied returns nothing: the proxy holds the secret
 * and adding a browser-side header there would defeat the point of having one.
 */
export function authHeaders(id: ProviderId): Record<string, string> {
  if (DATA_PROXY) return {};
  const key = keyFor(id);
  if (!key) return {};
  // Both vendors accept a bearer token; Polygon also takes ?apiKey=.
  return { Authorization: `Bearer ${key}` };
}
