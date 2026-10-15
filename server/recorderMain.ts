/*
  THE FIELD'S RECORDER ON ITS OWN (2026-10-13 — the owner: "The recorder must run on an always-on machine, not in a
  container that restarts. Today only 98 minutes were recorded, and missed live minutes can't be recovered. Tell me
  where it will run and how it restarts itself." — docs/data-feed.md "The recorder's home").

  A plain Node process, no Vite: the same feed proxy and recorder as the dev server's (server/feed.ts
  feedMiddleware), with RECORD_NAMES watched from the start and never let go, on RECORDER_PORT (5190). It reads the
  keys from .env itself (never from the browser). The dev server, given FEED_RECORDER_URL=http://127.0.0.1:5190,
  answers the field's routes from here, so the terminal's tabs read one recorder and the day has no holes when the
  dev server comes and goes. It exits on an error it cannot handle, so the supervisor round it starts it again:
  scripts/recorder.cmd (a loop, registered with Task Scheduler at startup on the owner's Windows machine) or the
  systemd unit in the docs on a Linux box.

    npm run feed:recorder
*/
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { feedMiddleware } from './feed';
import { tapeReader } from './tapeBackfill';
import { createSeriesBackfill } from './seriesBackfill';

function parseEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

const env = { ...parseEnv('.env'), ...process.env } as Record<string, string | undefined>;
const names = (env.RECORD_NAMES ?? 'SPY,QQQ,IWM').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
const port = Number(env.RECORDER_PORT ?? 5190);
const lan = env.FEED_ALLOW_LAN === '1';
const stamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

/* Massive off since 2026-10-14 (the owner: "you can disable the massive ones and use this one") — Theta Data in its place */
const handle = feedMiddleware({ keys: { uw: env.UW_API_TOKEN || undefined, theta: env.THETADATA_API_KEY || undefined }, allowLan: lan, recordNames: names });
const server = createServer((req, res) => {
  /* the series job's standing, for a look from this machine: curl http://127.0.0.1:5190/feed/series */
  if (req.method === 'GET' && (req.url ?? '').split('?')[0] === '/feed/series') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ names: seriesNames, days: seriesDays, job: series.status(), stored: series.stored(seriesNames) }));
    return;
  }
  void handle(req, res, () => {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end('{"error":"no-route"}');
  });
});
server.listen(port, lan ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`${stamp()} slayer recorder on http://127.0.0.1:${port} — recording ${names.join(', ')} (UW key ${env.UW_API_TOKEN ? 'in' : 'MISSING — nothing will be recorded'})`);
});
/* THE BACKFILL JOB (the owner, 2026-10-13, item 1b): BACKFILL_FROM=2025-04-01 rebuilds every session from that date to
   the session before today for BACKFILL_NAMES (the recorded names but the indices, which have no bars on this plan),
   oldest first, behind the recorder's own reads — about 1,650 calls and a minute or two a SPY session; a restart picks
   up where it stopped (a session built is skipped). */
const from = env.BACKFILL_FROM ?? '';
if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
  const bnames = (env.BACKFILL_NAMES ?? names.join(','))
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  console.log(`${stamp()} backfill ${bnames.join(', ')} from ${from}, oldest first (a day before UW's minute vols from its tape)`);
  handle.backfill.useTape(tapeReader(handle.client, { log: l => console.log(`${stamp()} ${l}`) }));
  void handle.backfill.runRange(bnames, from).then(j => console.log(`${stamp()} backfill done: built ${j.built}, skipped ${j.skipped}, failed ${j.failed} of ${j.days}`));
  const progress = setInterval(() => {
    const j = handle.backfill.job();
    if (j.running) console.log(`${stamp()} backfill ${j.current ?? '…'}: built ${j.built}, skipped ${j.skipped}, failed ${j.failed} of ${j.days}`);
  }, 10 * 60_000);
  progress.unref();
}
/* THE PER-MINUTE SPOT-EXPOSURE SERIES, BACK THROUGH UW'S WINDOW (the owner's B5, 2026-10-14 — "Its ~730-day window
   loses a day each session"): SERIES_NAMES (SPY,QQQ,SPX) for SERIES_DAYS (730) calendar days back, newest first, one
   call at a time behind the recorder's reads, resumable (a day held is skipped — server/seriesBackfill.ts); walked
   again once a day after the close for the session just over (from 5:00 pm New York the walk starts at today's).
   A day is held only by this job's own series.json — the recorder's total.json and a rebuilt day keep a subset of the
   fields. GET /feed/series says where it stands and what is stored. SERIES_NAMES=off turns it off. */
const seriesNames = (env.SERIES_NAMES ?? 'SPY,QQQ,SPX')
  .split(',')
  .map(s => s.trim().toUpperCase())
  .filter(n => n && n !== 'OFF');
const seriesDays = Math.max(1, Number(env.SERIES_DAYS ?? 730) || 730);
const series = createSeriesBackfill(handle.client, { log: l => console.log(`${stamp()} ${l}`) });
let seriesDay = '';
const walkSeries = (why: string) => {
  if (!seriesNames.length || !env.UW_API_TOKEN || series.status().running) return;
  console.log(`${stamp()} series ${seriesNames.join(', ')}: ${seriesDays} days back, newest first (${why})`);
  void series.run(seriesNames, seriesDays).then(s => console.log(`${stamp()} series done: written ${s.written}, empty ${s.empty}, skipped ${s.skipped}, refused ${s.refused}, failed ${Object.keys(s.failed).length}`));
};
setTimeout(() => walkSeries('at start'), 30_000).unref();
/* THE SCORECARD, NIGHTLY (the owner's item 2: "runs after 4:00 p.m. ET"): once a day after 4:05 pm New York, every
   recorded name but the indices; and once at start where a name has none yet */
const nyMinuteNow = () => {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: 'numeric', minute: 'numeric', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()))
    if (x.type !== 'literal') p[x.type] = x.value;
  return { day: `${p.year}-${p.month}-${p.day}`, minute: (Number(p.hour) % 24) * 60 + Number(p.minute) };
};
let scoredDay = '';
const score = async (why: string) => {
  for (const n of names) {
    try {
      const c = await handle.scorecard.run(n);
      console.log(`${stamp()} scorecard ${n} (${why}): ${c ? `${c.main.sessions} sessions, ${c.main.touches} touches; ${c.holdoutNote}` : 'nothing to score yet'}`);
    } catch (e) {
      console.error(`${stamp()} scorecard ${n} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
};
for (const n of names) if (!handle.scorecard.read(n)) void score('first run').then(() => undefined);
/* THE SESSION RECAP (the owner's item 9: "at 4:05 p.m. ET, generate … Post it to the Journal room"): every recorded name's,
   at 4:05 pm ahead of the scorecard (which can take a while over two years of sessions), and once more at 5:05 pm — the
   official close is kept from 4:30 pm (server/pricedMove.ts); a recap whose figures did not change keeps its version, so
   the Journal's entry moves only when one did. A weekend has no session. */
let recapDay = '';
let recheckDay = '';
const recaps = async (day: string, why: string) => {
  for (const n of names) {
    try {
      const r = await handle.recap.build(n, day, true);
      console.log(`${stamp()} recap ${n} ${day} (${why}): ${'recap' in r ? `${r.recap.source ?? 'no rows'}, version ${r.recap.version}` : r.why}`);
    } catch (e) {
      console.error(`${stamp()} recap ${n} ${day} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
};
const weekend = (day: string) => [0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay());
const nightly = setInterval(() => {
  const { day, minute } = nyMinuteNow();
  if (minute >= 16 * 60 + 5 && scoredDay !== day) {
    scoredDay = day;
    recapDay = day;
    void (weekend(day) ? Promise.resolve() : recaps(day, 'at 4:05 pm')).then(() => score('after the close'));
  }
  if (minute >= 17 * 60 + 5 && recheckDay !== day && recapDay === day) {
    recheckDay = day;
    if (!weekend(day)) void recaps(day, 'at 5:05 pm, the official close kept');
  }
  /* the session just over joins the series (UW's rows for a date stand once it has closed) */
  if (minute >= 17 * 60 + 15 && seriesDay !== day) {
    seriesDay = day;
    if (!weekend(day)) walkSeries('after the close');
  }
}, 60_000);
nightly.unref();
server.on('error', e => {
  console.error(`${stamp()} recorder cannot listen on ${port}: ${String(e)}`);
  process.exit(1);
});
/* an error nobody caught ends the process; the loop round it starts it again — append-only files lose nothing */
process.on('uncaughtException', e => {
  console.error(`${stamp()} recorder error: ${String(e && (e as Error).stack ? (e as Error).stack : e)}`);
  handle.close();
  process.exit(1);
});
for (const sig of ['SIGINT', 'SIGTERM'] as const)
  process.on(sig, () => {
    handle.close();
    process.exit(0);
  });
process.on('unhandledRejection', e => {
  console.error(`${stamp()} recorder rejection: ${String(e)}`);
});
