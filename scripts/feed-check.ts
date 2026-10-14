/*
  DO THE KEYS WORK? — `npm run feed:check` (2026-10-12)

  Reads .env at the repo root (and the process environment) the way vite.config.ts does, calls ONE cheap route per
  vendor through the proxy's own client (server/feed.ts — the same URL, the same auth, the same Massive bucket), and
  prints OK or what went wrong, with the HTTP status. It never prints a key, nor any part of one.

    Unusual Whales  GET /api/stock/SPY/stock-state
    Theta Data      GET /v3/terminal/mdds/status (the Theta Terminal on this machine — npm run theta:terminal)

  Massive is off since 2026-10-14 (the owner: "you can disable the massive ones and use this one"). Exits 1 if either is
  not OK. Behind a proxy (HTTPS_PROXY), Node's fetch needs NODE_USE_ENV_PROXY=1 (Node ≥ 22.21).
*/
import { loadEnv } from 'vite';
import { FAIL_WORDS, PROVIDERS, createFeedClient, probe, type ProviderId } from '../server/feed';

const env = loadEnv('development', process.cwd(), '');
const client = createFeedClient({ keys: { uw: env.UW_API_TOKEN || undefined, theta: env.THETADATA_API_KEY || undefined }, noCache: true });

let bad = 0;
for (const p of ['uw', 'theta'] as ProviderId[]) {
  const { name, envVar, probe: path } = PROVIDERS[p];
  const r = await probe(client, p);
  const head = `${name.padEnd(15)} ${envVar.padEnd(16)} GET ${path}`;
  if (r.state === 'ok') {
    console.log(`OK      ${head}  → ${r.status}`);
    continue;
  }
  bad++;
  const status = r.status ? ` ${r.status}` : '';
  console.log(`FAILED  ${head}  →${status || ' —'} ${FAIL_WORDS[r.state]}`);
  if (r.state === 'no-key') console.log(`        add ${envVar}=… to .env at the repo root, then run this again`);
  if (r.state === 'no-terminal') console.log('        start the Theta Terminal on this machine: npm run theta:terminal (Java 21)');
  if (r.state === 'network' && (process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY)
    console.log('        this machine goes out through HTTPS_PROXY: run with NODE_USE_ENV_PROXY=1 so Node uses it');
}
process.exit(bad ? 1 : 0);
