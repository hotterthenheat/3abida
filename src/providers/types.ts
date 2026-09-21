import type { ProvenanceKey } from '../data/provenance';

/*
==================================================
  SLAYER TERMINAL - PROVIDERS (providers/types.ts)

  The vocabulary the integration boundary speaks.
==================================================

  THE TERMINAL RUNS ON A SIMULATOR TODAY and every number on screen says so,
  through data/provenance.ts — whose own header calls `setProvenance` "the
  swap's one call". This directory is that swap. Nothing here draws a pixel;
  it names what each provider can supply, reads whether a key for it exists,
  and when a capability is confirmed live it upgrades the provenance family
  it feeds so every chip in the app starts telling a new truth at once.

  A CAPABILITY IS THE UNIT, not an endpoint and not a provider. A provider is
  a bill; an endpoint is a URL; a capability is "this data, from this plan,
  feeding this part of the product". That is the thing worth listing, because
  it is the only one that answers the question a paying reader actually has:
  what am I getting for this.
*/

export type ProviderId = 'polygon' | 'unusualwhales';

/** How a capability is delivered. */
export type Transport = 'rest' | 'ws';

/** Which market the capability covers — a plan is bought per market. */
export type Market = 'stocks' | 'options' | 'indices' | 'fx' | 'crypto' | 'futures' | 'any';

export interface Capability {
  id: string;
  provider: ProviderId;
  /** The plan that unlocks it, in the provider's own words */
  plan: string;
  transport: Transport;
  market: Market;
  /** REST path, or the WebSocket cluster and channel */
  endpoint: string;
  /** What it returns, in one line */
  what: string;
  /** The provenance families this capability can upgrade when it is live */
  feeds: ProvenanceKey[];
  /** Where in the terminal it lands — route paths, for the settings page */
  surfaces: string[];
  /**
   * What this capability is NOT, where the provider's own spec says so.
   * Printed beside it: a reader deciding whether to rely on a number
   * deserves the caveat at the same size as the promise.
   */
  caveat?: string;
}

export type ConnectionState = 'unconfigured' | 'checking' | 'live' | 'refused' | 'error';

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  /** Whether a key is present — never the key itself */
  configured: boolean;
  /** Whether requests route through a proxy rather than the browser */
  proxied: boolean;
  state: ConnectionState;
  /** One line: what happened on the last check */
  note: string;
  checkedAt: number | null;
}
