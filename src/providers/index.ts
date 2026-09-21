import { setProvenance, type ProvenanceKey } from '../data/provenance';
import { CAPABILITIES } from './capabilities';
import { PROVIDER_META, authHeaders, isConfigured, isProxied, restBase } from './config';
import type { Capability, ProviderId, ProviderStatus } from './types';

export * from './types';
export { CAPABILITIES } from './capabilities';
export { PROVIDER_META, DATA_PROXY, isConfigured, isProxied, restBase, wsBase } from './config';

/*
==================================================
  SLAYER TERMINAL - THE SWAP (providers/index.ts)

  The one place a live feed becomes the terminal's
  answer instead of the simulator's.
==================================================

  data/provenance.ts calls `setProvenance` "the swap's one call" and has been
  waiting for a caller since it was written. This is the caller.

  A PROVIDER GOING LIVE IS NOT A BOOLEAN. It confirms a set of CAPABILITIES,
  each feeding named provenance families, and only those families change
  what they say. A reader with a Polygon key and no Unusual Whales key
  should see the chain go measured and the dealer exposure stay simulated —
  because that is what is true — rather than one green light over a desk
  that is still half modelled.

  AND THE UPGRADE IS BOUNDED BY WHAT THE VENDOR ACTUALLY SERVES. A REST
  capability makes a family `measured`: a feed supplied it, true as of the
  fetch. Only a SOCKET makes it `live`: a stream is updating it as you
  watch. Calling a five-second poll "live" would be the exact dishonesty the
  provenance file was built to prevent, so the transport decides the word.
*/

const statuses = new Map<ProviderId, ProviderStatus>();

function seed(id: ProviderId): ProviderStatus {
  const meta = PROVIDER_META[id];
  const configured = isConfigured(id);
  return {
    id,
    label: meta.label,
    configured,
    proxied: isProxied(),
    state: configured ? 'checking' : 'unconfigured',
    note: configured
      ? 'A key is present — the connection has not been tested yet.'
      : `No key. Set ${meta.envVar}, or point VITE_DATA_PROXY at a server that holds it.`,
    checkedAt: null,
  };
}

export function providerStatus(id: ProviderId): ProviderStatus {
  let s = statuses.get(id);
  if (!s) {
    s = seed(id);
    statuses.set(id, s);
  }
  return s;
}

export const providerStatuses = (): ProviderStatus[] =>
  (Object.keys(PROVIDER_META) as ProviderId[]).map(providerStatus);

export const capabilitiesFor = (id: ProviderId): Capability[] => CAPABILITIES.filter(c => c.provider === id);

/** Every surface a provider touches, deduped — what lights up when it connects. */
export function surfacesFor(id: ProviderId): string[] {
  const out = new Set<string>();
  for (const c of capabilitiesFor(id)) for (const s of c.surfaces) out.add(s);
  return [...out].sort();
}

/** Which provenance families a provider can upgrade, and to what. */
export function feedsFor(id: ProviderId): Map<ProvenanceKey, 'live' | 'measured'> {
  const out = new Map<ProvenanceKey, 'live' | 'measured'>();
  for (const c of capabilitiesFor(id)) {
    for (const f of c.feeds) {
      // A socket beats a poll; once live, never downgraded by a REST sibling.
      if (c.transport === 'ws') out.set(f, 'live');
      else if (!out.has(f)) out.set(f, 'measured');
    }
  }
  return out;
}

/**
 * Ask a provider whether the key works, with the cheapest call each one has.
 *
 * Deliberately NOT a data fetch: this is a reachability and entitlement
 * probe, so it uses the lightest endpoint the vendor publishes and reads the
 * status code rather than the body. A 401/403 is a real answer — the key is
 * wrong or the plan does not cover it — and is reported as `refused` rather
 * than folded into a generic failure, because those need different fixes.
 */
export async function checkProvider(id: ProviderId, signal?: AbortSignal): Promise<ProviderStatus> {
  const base = providerStatus(id);
  if (!base.configured) return base;

  const path = id === 'polygon' ? '/v1/marketstatus/now' : '/api/market/sector-etfs';
  const next = (state: ProviderStatus['state'], note: string): ProviderStatus => {
    const s: ProviderStatus = { ...base, state, note, checkedAt: Date.now() };
    statuses.set(id, s);
    return s;
  };

  try {
    const res = await fetch(`${restBase(id)}${path}`, {
      headers: { Accept: 'application/json', ...authHeaders(id) },
      signal,
    });
    if (res.status === 401) return next('refused', 'The key was rejected. Check that it is current and pasted whole.');
    if (res.status === 403) return next('refused', 'The key is valid but this plan does not cover that endpoint.');
    if (res.status === 429) return next('error', 'Rate limited on the probe — the key works, the account is busy.');
    if (!res.ok) return next('error', `The provider answered ${res.status}.`);
    applyProvenance(id);
    return next('live', 'Connected. The surfaces below are reading this feed.');
  } catch (err) {
    if (signal?.aborted) return base;
    /* A browser CORS refusal and an offline network are indistinguishable
       from here — fetch rejects the same way for both — so the note names
       both rather than asserting the one that happens to be likelier. */
    return next(
      'error',
      isProxied()
        ? 'The proxy did not answer. Is it running, and is VITE_DATA_PROXY pointing at it?'
        : 'No answer. Either the network is blocked or the vendor refused the browser origin — a proxy fixes the second.'
    );
  }
}

/** Tell the provenance registry what this provider now supplies. */
export function applyProvenance(id: ProviderId): void {
  const meta = PROVIDER_META[id];
  for (const [family, kind] of feedsFor(id)) {
    setProvenance(family, {
      kind,
      note:
        kind === 'live'
          ? `Streaming from ${meta.label}`
          : `Fetched from ${meta.label} — true as of the last request`,
    });
  }
}

/** Every family any connected provider is currently supplying. */
export function liveFeeds(): Map<ProvenanceKey, 'live' | 'measured'> {
  const out = new Map<ProvenanceKey, 'live' | 'measured'>();
  for (const s of providerStatuses()) {
    if (s.state !== 'live') continue;
    for (const [f, k] of feedsFor(s.id)) {
      if (k === 'live' || !out.has(f)) out.set(f, k);
    }
  }
  return out;
}
