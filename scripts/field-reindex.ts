/*
==================================================
  SLAYER TERMINAL - WHAT AN OLDER MODEL WROTE (scripts/field-reindex.ts — `npm run field:reindex [-- --rebuild] [NAMES]`)

  2026-10-15 — the owner: "SPXW was being dropped. Check whether anything stored used that filter: store columns,
  backfill, tiles, residual vs UW, scorecard, alerts. Rebuild whatever did, and tell me what changed."

  The field's model .6 (data/feed/trailModel.ts TRAIL_MODEL) reads an index's weekly root as the index's (SPXW under
  SPX — the root filter had kept SPX's AM monthlies alone) and ends an AM-settled contract at its settlement; the Theta
  rebuild .2 keys every contract under its own root. Work an older version wrote is WRONG under .6 for an index, and for
  any name on a day a Saturday-dated expiry could stand in (trailModel staleBeforeIndexRoots); every other name's work
  stands as it did. What is wrong is listed here, by name and day:

    final rows       the store's final.jsonl — read by the scorecard, the scale's bins, the recap and the proof engine;
                     those readers rebuild a session whose rows do not stand from its kept inputs (past.json.gz) on
                     their own since .6, and --rebuild rewrites the file too, the old one kept beside it as
                     final.<model>.jsonl.gz
    shown rows       the store's shown.jsonl — what Terrain drew at the minute: a record, never rewritten; listed
    Theta days       theta-final.jsonl — `npm run theta:rebuild -- <NAME>` builds them again (its version changed)
    tiles            tiles/tiles.json — the recorder's sweep (start and 4:30 pm) tiles them again on its own
    recaps           recap.json — built again the next time the Journal or the 4:05 pm job asks
    name-wide        scale.json (rebuilt on the next page read), scorecard.json's hold-out (evaluated again by the next
                     `npm run field:scorecard`, said as a second look), regime.json (the scorecard's nightly run)

  Reads .feed-cache/field (FIELD_ROOT). Asks no vendor: a session whose bars are not on this machine is listed as not
  rebuildable here.
==================================================
*/
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createFeedClient } from '../server/feed';
import { createFieldBackfill, type PastDay } from '../server/fieldBackfill';
import { createFieldStore, type StoreRow } from '../server/fieldStore';
import { thetaStaleBeforeIndexRoots, THETA_REBUILD } from '../server/thetaRebuild';
import { MODEL_BEFORE_INDEX_ROOTS, modelStands, staleBeforeIndexRoots, TRAIL_MODEL } from '../src/data/feed/trailModel';
import { nyMinuteOf } from '../src/data/feed/trackRecord';

const args = process.argv.slice(2);
const rebuild = args.includes('--rebuild');
const only = args.filter(a => /^[A-Z][A-Z0-9.]{0,9}$/.test(a));
const root = process.env.FIELD_ROOT ?? join('.feed-cache', 'field');
if (!existsSync(root)) {
  console.log(`no field store at ${root} — nothing was written by any model on this machine`);
  process.exit(0);
}

const env: Record<string, string> = {};
if (existsSync('.env'))
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
/* the client is only for the backfill's local readers here — no call is made for a session whose bars are kept */
const client = createFeedClient({ keys: { uw: process.env.UW_API_TOKEN || env.UW_API_TOKEN, massive: undefined } as never });
const backfill = createFieldBackfill(client, { root });
const store = createFieldStore({ root });

const readJson = <T>(file: string): T | null => {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
};
const modelsOf = (rows: readonly StoreRow[]) => [...new Set(rows.map(r => r.model ?? '—'))].sort();
const ISO = /^\d{4}-\d{2}-\d{2}$/;

interface Line {
  name: string;
  day: string;
  what: string;
  stamp: string;
  action: string;
}
const lines: Line[] = [];
let rewritten = 0;
let notRebuildable = 0;

const names = readdirSync(root)
  .filter(n => /^[A-Z][A-Z0-9.]{0,9}$/.test(n))
  .filter(n => !only.length || only.includes(n))
  .sort();
for (const name of names) {
  const dir = join(root, name);
  /* name-wide */
  const scale = readJson<{ model?: string }>(join(dir, 'scale.json'));
  if (scale && !modelStands(scale.model, name)) lines.push({ name, day: '—', what: 'scale.json', stamp: scale.model ?? '—', action: 'rebuilt on the next page read' });
  const card = readJson<{ holdout?: { model?: string; from: string } | null }>(join(dir, 'scorecard.json'));
  if (card?.holdout && staleBeforeIndexRoots(card.holdout.model ?? MODEL_BEFORE_INDEX_ROOTS, name, card.holdout.from))
    lines.push({ name, day: '—', what: 'scorecard.json hold-out', stamp: card.holdout.model ?? MODEL_BEFORE_INDEX_ROOTS, action: 'evaluated again by the next `npm run field:scorecard`, said as a second look' });
  for (const day of readdirSync(dir).filter(d => ISO.test(d)).sort()) {
    const ddir = join(dir, day);
    /* final rows */
    const final = store.readRows(name, day, 'final');
    if (final.length && final.some(r => staleBeforeIndexRoots(r.model, name, day))) {
      const stamp = modelsOf(final).join(', ');
      const pastFile = join(ddir, 'past.json.gz');
      if (!existsSync(pastFile)) {
        notRebuildable++;
        lines.push({ name, day, what: `final rows (${final.length})`, stamp, action: 'not rebuildable here: the session was recorded, not rebuilt (no past.json.gz) — its readers skip these rows' });
      } else if (!rebuild) {
        lines.push({ name, day, what: `final rows (${final.length})`, stamp, action: '--rebuild rewrites them from past.json.gz' });
      } else {
        const bars = await backfill.minutes(name, day);
        if (!bars?.length) {
          notRebuildable++;
          lines.push({ name, day, what: `final rows (${final.length})`, stamp, action: 'not rebuilt: the session\'s minute bars are not on this machine' });
        } else {
          const past = JSON.parse(gunzipSync(readFileSync(pastFile)).toString('utf8')) as PastDay;
          /* the final rows are the regular session's (fieldStore final()) — the rebuild's other sessions are the Theta rebuild's */
          const rows = store.rowsOf(past, bars).filter(r => (r.session ?? 'r') === 'r' && nyMinuteOf(r.m) >= 9 * 60 + 30);
          const plain = join(ddir, 'final.jsonl');
          const gz = `${plain}.gz`;
          const keep = join(ddir, `final.${stamp.replace(/[^a-z0-9.-]+/gi, '_')}.jsonl.gz`);
          const was = existsSync(plain) ? plain : gz;
          const text = existsSync(plain) ? readFileSync(plain) : gunzipSync(readFileSync(gz));
          writeFileSync(keep, gzipSync(text));
          const body = rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');
          if (was === gz) {
            writeFileSync(`${gz}.part`, gzipSync(body));
            renameSync(`${gz}.part`, gz);
          } else {
            writeFileSync(`${plain}.part`, body);
            renameSync(`${plain}.part`, plain);
          }
          rewritten++;
          lines.push({ name, day, what: `final rows (${final.length} → ${rows.length})`, stamp, action: `rewritten under ${TRAIL_MODEL.version}; the old kept as ${keep.split(/[\\/]/).pop()}` });
        }
      }
    }
    /* shown rows: a record of what was drawn */
    const shown = store.readRows(name, day, 'shown');
    if (shown.length && shown.some(r => staleBeforeIndexRoots(r.model, name, day)))
      lines.push({ name, day, what: `shown rows (${shown.length})`, stamp: modelsOf(shown).join(', '), action: 'kept: what Terrain drew at the minute, never rewritten' });
    /* the Theta rebuild's day */
    const built = readJson<{ version?: string }>(join(ddir, 'theta-build.json'));
    if (existsSync(join(ddir, 'theta-final.jsonl')) && thetaStaleBeforeIndexRoots(built?.version ?? null, name, day))
      lines.push({ name, day, what: 'Theta day', stamp: built?.version ?? '—', action: `\`npm run theta:rebuild -- ${name}\` builds it again under ${THETA_REBUILD.version}` });
    /* tiles */
    const tiles = readJson<{ model?: string }>(join(ddir, 'tiles', 'tiles.json'));
    if (tiles && !modelStands(tiles.model, name, day)) lines.push({ name, day, what: 'tiles', stamp: tiles.model ?? '—', action: "the recorder's sweep tiles the day again" });
    /* the recap */
    const recap = readJson<{ model?: string }>(join(ddir, 'recap.json'));
    if (recap && staleBeforeIndexRoots(recap.model ?? MODEL_BEFORE_INDEX_ROOTS, name, day)) lines.push({ name, day, what: 'recap', stamp: recap.model ?? MODEL_BEFORE_INDEX_ROOTS, action: 'built again when next asked' });
  }
}

console.log(`field store ${root} · model now ${TRAIL_MODEL.version} · Theta rebuild now ${THETA_REBUILD.version}${only.length ? ` · names ${only.join(', ')}` : ''}`);
if (!lines.length) {
  console.log('Everything stored stands under the current model: nothing an older model wrote differs from what this one would write.');
  process.exit(0);
}
const w = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
console.log(`${w('name', 6)} ${w('day', 10)} ${w('what', 26)} ${w('written under', 40)} action`);
for (const l of lines) console.log(`${w(l.name, 6)} ${w(l.day, 10)} ${w(l.what, 26)} ${w(l.stamp, 40)} ${l.action}`);
console.log(`${lines.length} items${rebuild ? `; ${rewritten} final-row files rewritten` : ''}${notRebuildable ? `; ${notRebuildable} not rebuildable here` : ''}${!rebuild && lines.some(l => l.action.startsWith('--rebuild')) ? ' — run again with --rebuild to rewrite the final rows' : ''}`);
