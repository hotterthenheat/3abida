/*
  THE SCORECARD BY HAND (server/scorecard.ts; the owner's item 2): npm run field:scorecard -- SPY
  Reads the store's final rows and the rebuilt sessions on this machine, writes .feed-cache/field/SPY/scorecard.json
  and prints the lines How sure shows. The UW key is read from .env the way the recorder reads it (the bars a session
  lacks are asked once), never printed.
*/
import { existsSync, readFileSync } from 'node:fs';
import { createFeedClient } from '../server/feed';
import { createFieldBackfill } from '../server/fieldBackfill';
import { createFieldStore } from '../server/fieldStore';
import { createScorecard } from '../server/scorecard';
import { createPricedMove } from '../server/pricedMove';

const names = (process.argv[2] ?? 'SPY').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
const env: Record<string, string> = {};
if (existsSync('.env'))
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
const client = createFeedClient({ keys: { uw: process.env.UW_API_TOKEN || env.UW_API_TOKEN || undefined, massive: undefined } as never });
const backfill = createFieldBackfill(client);
const store = createFieldStore();
const move = createPricedMove(client, backfill, { log: l => console.log(l) });
const job = createScorecard(backfill, store, { log: l => console.log(l), move });
(async () => {
  for (const n of names) {
    const t0 = Date.now();
    const card = await job.run(n);
    if (!card) {
      console.log(`${n}: nothing to score`);
      continue;
    }
    console.log(`${n}: ${card.main.sessions} sessions ${card.main.firstDay} to ${card.main.lastDay} (${card.main.months} month${card.main.months === 1 ? '' : 's'}), ${card.main.touches} touches, ${card.main.variantsTried} variants, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    for (const line of Object.values(card.lines)) console.log(`  ${line}`);
    console.log(`  ${card.holdoutNote}`);
    for (const r of card.main.regime.ranges) console.log(`  range over ${r.horizon} min by regime tercile: ${r.terciles.map(t => `${t.tercile}: ${t.range != null ? (t.range * 100).toFixed(3) + '%' : '—'} (n ${t.n}${t.overImplied != null ? `, ${t.overImplied.toFixed(2)}× implied` : ''})`).join(' · ')}`);
    for (const l of card.main.regime.lastHalfHour) console.log(`  last half hour, ${l.source}, ${l.sign} regime: n ${l.n}, slope ${l.slope != null ? l.slope.toFixed(3) : '—'}, t ${l.t != null ? l.t.toFixed(2) : '—'}`);
  }
})().catch(e => {
  console.error('FAILED', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
