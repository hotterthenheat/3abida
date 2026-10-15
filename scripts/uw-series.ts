/*
  UW'S PER-MINUTE SPOT-EXPOSURE SERIES ON THIS MACHINE (the owner's B5, 2026-10-15: "Add `npm run uw:series -- --status`:
  days stored per ticker, oldest and newest day, any gaps").

    npm run uw:series -- --status          what is stored a ticker, against UW's window, and the fill's standing
    npm run uw:series -- --fill            fill every missing day here, once — only where no recorder runs (the recorder
                                           fills on its own, at start and each evening; two fills, or a fill beside a
                                           recording dev server, would share UW's three calls at once with the live
                                           pull) and outside the live hours (4:00 am to 5:00 pm New York, trading days)
      --names=SPY,QQQ                      only these names (default: every name the recorder records)
      --max=N                              stop after N calls (a trial)
      --force                              fill even beside a recorder or in the live hours (it still waits on its own
                                           429s; the live pull in the other process cannot be seen from here)

  It reads .feed-cache/field/<NAME>/<D>/series.json.gz (and the plain series.json the job first wrote) where the
  recorder keeps them, and RECORD_NAMES / SERIES_NAMES from .env. The key never leaves .env: --status makes no call to
  Unusual Whales; --fill hands the key to the proxy's own client, as the recorder does. Dates are New York's market days.
*/
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createFeedClient } from '../server/feed';
import {
  createSeriesBackfill,
  firstDayOf,
  inLiveHours,
  lockHolder,
  namesToFill,
  rangesOf,
  readState,
  seriesPathOf,
  storedOf,
  tradingDays,
  UW_WINDOW_TRADING_DAYS,
  windowNow,
} from '../server/seriesBackfill';

const root = join(process.cwd(), '.feed-cache', 'field');
const stateRoot = join(process.cwd(), '.feed-cache', 'series');
const args = process.argv.slice(2);
const flag = (k: string) => args.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);

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

/** A time on the reader's own clock, 12-hour */
const clock = (ms: number) =>
  new Date(ms)
    .toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(/\s?([AP])M$/, (_m, x: string) => ` ${x.toLowerCase()}m`);
const pad = (s: string | number, n: number) => String(s).padEnd(n);
const lpad = (s: string | number, n: number) => String(s).padStart(n);

/** Every name the recorder records (configured or on disk), and every name with a series file on disk */
function namesHere(): string[] {
  const configured = namesToFill(env, [], root);
  const onDisk: string[] = [];
  if (existsSync(root))
    for (const n of readdirSync(root)) {
      if (!/^[A-Z][A-Z0-9.]*$/.test(n)) continue;
      const dir = join(root, n);
      let any = false;
      try {
        for (const d of readdirSync(dir)) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && seriesPathOf(root, n, d)) {
          any = true;
          break;
        }
      } catch {
        continue;
      }
      if (any) onDisk.push(n);
    }
  return [...new Set([...configured, ...onDisk])];
}

/** The recorder's own word, where one answers on this machine */
async function recorderJob(): Promise<{ job?: { running: boolean; current: string | null; todo: number; written: number; empty: number; throttled: number; backoffMs: number; why: string; startedAt: number } } | null> {
  const port = Number(env.RECORDER_PORT ?? 5190);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/feed/series`, { signal: AbortSignal.timeout(2500) });
    if (!r.ok) return null;
    return (await r.json()) as never;
  } catch {
    return null;
  }
}

/** The field recorder's lock, where a live recorder (the dev server's or the always-on one) holds it */
function recorderLock(): { pid: number } | null {
  try {
    const l = JSON.parse(readFileSync(join(root, 'recorder.lock'), 'utf8')) as { pid: number; at: number };
    if (Date.now() - l.at > 3 * 60_000) return null;
    try {
      process.kill(l.pid, 0);
    } catch (e) {
      /* EPERM: the process lives under another account — a recorder all the same */
      if ((e as { code?: string }).code !== 'EPERM') return null;
    }
    return l;
  } catch {
    return null;
  }
}

async function status(): Promise<void> {
  const now = Date.now();
  const state = readState(stateRoot);
  const window = windowNow(state, now);
  const last = firstDayOf(now);
  const sessions = tradingDays(window.floor, last).length;
  const names = (flag('names')?.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)) ?? namesHere();
  console.log("Unusual Whales' per-minute spot exposures (the series) on this machine");
  console.log(
    `Window: ${window.floor} to ${last}, ${sessions} sessions — ${
      window.source === 'uw'
        ? `Unusual Whales' own word, read ${clock(window.at)}`
        : window.source === 'carried'
          ? `Unusual Whales' word of ${clock(window.at)} (${state.window?.floor}), moved on a trading day a session since`
          : `an estimate (${UW_WINDOW_TRADING_DAYS} trading days); a fill reads UW's own word`
    }`
  );
  const rec = await recorderJob();
  const holder = lockHolder(stateRoot, now);
  if (holder && !rec?.job?.running) console.log(`Fill: running by hand here (pid ${holder.pid})`);
  if (rec?.job) {
    const j = rec.job;
    console.log(
      j.running
        ? `Fill: running on the recorder (${j.why}) — at ${j.current ?? '…'}, ${j.todo} calls to go; written ${j.written}, empty ${j.empty}${j.throttled ? `, 429s ${j.throttled}${j.backoffMs ? `, waiting ${Math.round(j.backoffMs / 1000)} s` : ''}` : ''}`
        : `Fill: the recorder answers; no fill running now${j.startedAt ? ` (the last began ${clock(j.startedAt)})` : ''}`
    );
  } else console.log(`Fill: no recorder answers on 127.0.0.1:${env.RECORDER_PORT ?? 5190} — nothing fills here until \`npm run feed:recorder\` runs (or --fill)`);
  if (state.lastRun)
    console.log(
      `Last fill: ${clock(state.lastRun.startedAt)}${state.lastRun.finishedAt ? ` to ${clock(state.lastRun.finishedAt)}` : ' (did not finish)'} (${state.lastRun.why}) — written ${state.lastRun.written}, empty ${state.lastRun.empty}, no answer ${state.lastRun.refused}, refused days ${state.lastRun.failed}${state.lastRun.stopped ? `; stopped: ${state.lastRun.stopped}` : ''}`
    );
  const stored = storedOf(names, root, window, now);
  console.log('');
  console.log(`${pad('Ticker', 8)}${lpad('Days', 6)}  ${pad('Oldest', 12)}${pad('Newest', 12)}${lpad('Missing', 9)}${lpad('Gaps', 6)}${lpad('Not asked', 11)}${lpad("Before UW's series", 20)}`);
  for (const n of names) {
    const s = stored[n];
    const refused = state.refused[n];
    console.log(`${pad(n, 8)}${lpad(s.days, 6)}  ${pad(s.oldest ?? '—', 12)}${pad(s.newest ?? '—', 12)}${lpad(s.missing.length, 9)}${lpad(s.gaps.length, 6)}${lpad(s.notAsked, 11)}${lpad(s.beforeStart, 20)}${refused ? '   not served — see below' : ''}`);
  }
  console.log('');
  console.log('Days — sessions stored with rows. Missing — sessions in the window not stored (UW\'s empty days before its series');
  console.log('began are left out). Gaps — the missing sessions between the oldest and newest stored. Not asked — never called.');
  console.log('');
  console.log('Missing, by run of sessions:');
  let any = false;
  for (const n of names) {
    const g = stored[n].missing;
    if (!g.length) continue;
    any = true;
    const r = rangesOf(g);
    const shown = r.slice(0, 12).map(x => (x.n === 1 ? x.from : `${x.from} – ${x.to} (${x.n})`));
    console.log(`  ${pad(n, 6)} ${shown.join(', ')}${r.length > 12 ? `, and ${r.length - 12} more runs` : ''}`);
  }
  if (!any) console.log('  none');
  const refused = Object.entries(state.refused);
  console.log('');
  console.log(`Tickers Unusual Whales does not serve (skipped): ${refused.length ? refused.map(([n, r]) => `${n} — ${r.status === 200 ? r.message : `${r.status}${r.code ? ` ${r.code}` : ''}: ${r.message}`} (${clock(r.at)})`).join('; ') : 'none'}`);
  /* the day that leaves the window next, where any ticker has not got it */
  const atRisk = names.filter(n => !state.refused[n] && !seriesPathOf(root, n, window.floor));
  if (atRisk.length) console.log(`Next to leave UW's window (after the next session): ${window.floor} — not yet asked for ${atRisk.join(', ')}`);
}

async function fill(): Promise<void> {
  if (!env.UW_API_TOKEN) {
    console.log('No UW_API_TOKEN in .env — nothing can be asked.');
    process.exit(1);
  }
  const force = args.includes('--force');
  const rec = await recorderJob();
  const recording = recorderLock();
  if ((rec || recording) && !force) {
    console.log(
      `${rec ? `A recorder answers on 127.0.0.1:${env.RECORDER_PORT ?? 5190}: it fills on its own (at start and each evening after the close).` : `A recorder is recording on this machine (pid ${recording?.pid}, .feed-cache/field/recorder.lock).`} Not started — a fill here would share Unusual Whales' three calls at once with its live pull. --force fills anyway.`
    );
    process.exit(2);
  }
  if (inLiveHours(Date.now()) && !force) {
    console.log("The live hours (4:00 am to 5:00 pm New York on a trading day): the fill waits for the evening. --force fills anyway.");
    process.exit(2);
  }
  const maxText = flag('max');
  const max = maxText == null ? undefined : Number(maxText);
  if (max != null && !(Number.isInteger(max) && max > 0)) {
    console.log(`--max takes a whole number of calls above 0 (got "${maxText}").`);
    process.exit(1);
  }
  const names = flag('names')?.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) ?? namesToFill(env, [], root);
  const client = createFeedClient({ keys: { uw: env.UW_API_TOKEN } });
  const stamp = () => clock(Date.now());
  const job = createSeriesBackfill(client, { log: l => console.log(`${stamp()} ${l}`), maxCalls: max, anyHour: force });
  const s = await job.run(names, 'by hand');
  if (!s.startedAt) {
    console.log(`${stamp()} not started — ${s.stopped}`);
    process.exit(2);
  }
  const refused = Object.entries(s.refusedNames).map(([n, r]) => `${n} (${r.status === 200 ? r.message : `${r.status}${r.code ? ` ${r.code}` : ''}`})`);
  console.log(`${stamp()} done: written ${s.written}, empty ${s.empty}, held ${s.skipped}, no answer ${s.refused}, refused days ${Object.keys(s.failed).length}, 429s ${s.throttled}${refused.length ? `; not served: ${refused.join(', ')}` : ''}${s.stopped ? `; stopped: ${s.stopped}` : ''}${s.todo ? `; ${s.todo} calls left` : ''}`);
}

if (args.includes('--status')) await status();
else if (args.includes('--fill')) await fill();
else {
  console.log('npm run uw:series -- --status    what is stored a ticker, the window, gaps and the fill\'s standing');
  console.log('npm run uw:series -- --fill      fill every missing day here, once (where no recorder runs)');
  process.exit(1);
}
