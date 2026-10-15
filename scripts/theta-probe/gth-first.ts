/*
  THE FIRST DATE THETA SERVES SPX OVERNIGHT ROWS (the owner, 2026-10-15, "SPX OVERNIGHT FIELD": "Theta's docs say
  overnight quotes and trades exist for SPX, VIX, DJI and RUT options after January 2022, and 2015–2018, but not
  2019–2022. Log the first date Theta actually serves overnight rows.")

    npm run theta:gth                          the sampled walk, the boundaries refined to the day
    npm run theta:gth -- --from=2014-12-01     where the walk starts (2014-12-01 by default)
    npm run theta:gth -- --out=<dir>           where the report goes (docs/theta-probe/<date_time>/gth)

  RUN ON THE ALWAYS-ON MACHINE, AGAINST ITS TERMINAL (one terminal a key; this script starts none). The probe's own rules:
  127.0.0.1 alone, six calls in flight, format=ndjson, nothing between 12:00 and 1:45 am New York.

  For each sampled trading day D (the first and third Wednesday of every month): the SPX close the day before (Theta's
  index end-of-day) rounds the at-the-money strike to 5; the nearest SPXW expiry on or after D (Theta's own list) is
  asked at that strike, both rights, every five minutes, in three windows —
    · the evening before:  date = D − 1 calendar day, 20:15:00–23:59:59
    · the morning:         date = D, 00:00:00–09:25:00
    · the open (a control: the contract exists): date = D, 09:30:00–09:45:00
  and the rows' first and last stamps kept. Where the served state changes between two samples, every weekday between
  them is asked (the morning window) to find the day it changes. It also says how Theta dates the evening session — under
  the calendar evening (D − 1) or under the trading day (D) — off the newest Monday: Sunday's date and Monday's are both
  asked from 20:15.

  The report: gth-report.md and gth.json — every sample, the runs of days served, the first date of each run.
*/
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compact, env, hhmm, inThetaGap, isoAdd, isoOf, nyNow, say, theta, THETA_BASE, weekdayOf } from './lib';

interface Sample {
  day: string;
  expiry: string | null;
  strike: number | null;
  evening: { rows: number; first: string; last: string; status: string };
  morning: { rows: number; first: string; last: string; status: string };
  open: { rows: number; status: string };
  served: boolean;
}

const args = process.argv.slice(2);
const flag = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);

async function closesOf(year: number): Promise<Map<string, number>> {
  const a = await theta('/index/history/eod', { symbol: 'SPX', start_date: `${year}0101`, end_date: `${year}1231` }, { keepMax: 400 });
  const out = new Map<string, number>();
  for (const r of a.rows) {
    const d = String(r.created ?? r.date ?? r.timestamp ?? '');
    const c = Number(r.close);
    if (d && c > 0) out.set(isoOf(d.replace(/-/g, '').slice(0, 8)), c);
  }
  return out;
}

async function main(): Promise<void> {
  const now = nyNow();
  if (inThetaGap(now.minute)) {
    console.error(`It is ${now.text}: Theta's previous-day data is unavailable from 12:00 to 1:45 am New York. Run after 1:45 am.`);
    process.exit(2);
  }
  const from = flag('from') ?? env.THETA_GTH_FROM ?? '2014-12-01';
  const outDir = flag('out') ?? join('docs', 'theta-probe', `${now.iso}_${hhmm(now.minute).replace(':', '')}`, 'gth');
  say(`The overnight probe — ${now.text}; terminal ${THETA_BASE}; from ${from}; report → ${outDir}`);

  /* Theta's own SPXW expirations */
  const ex = await theta('/option/list/expirations', { symbol: 'SPXW' }, { keepMax: 20000 });
  const expirations = ex.rows.map(r => isoOf(String(r.expiration ?? r.date ?? '').replace(/-/g, '').slice(0, 8))).filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e)).sort();
  if (!expirations.length) {
    say(`no SPXW expirations from the terminal (${ex.status} ${ex.error}) — is it signed in?`);
    process.exit(1);
  }
  say(`SPXW expirations listed: ${expirations.length}, ${expirations[0]} to ${expirations[expirations.length - 1]}`);
  const expiryOn = (d: string) => expirations.find(e => e >= d) ?? null;

  /* the closes, a year a call */
  const closes = new Map<string, number>();
  for (let y = Number(from.slice(0, 4)); y <= Number(now.iso.slice(0, 4)); y++) for (const [d, c] of await closesOf(y)) closes.set(d, c);
  const closeBefore = (d: string): number | null => {
    for (let i = 1; i <= 7; i++) {
      const c = closes.get(isoAdd(d, -i));
      if (c) return c;
    }
    return null;
  };

  async function sample(day: string): Promise<Sample> {
    const expiry = expiryOn(day);
    const c = closeBefore(day);
    const strike = c ? Math.round(c / 5) * 5 : null;
    const base = expiry && strike ? { symbol: 'SPXW', expiration: compact(expiry), strike, right: 'both', interval: '5m' } : null;
    const blank = { rows: 0, first: '', last: '', status: 'not asked' };
    if (!base) return { day, expiry, strike, evening: blank, morning: blank, open: { rows: 0, status: 'not asked' }, served: false };
    const [ev, mo, op] = await Promise.all([
      theta('/option/history/quote', { ...base, date: compact(isoAdd(day, -1)), start_time: '20:15:00', end_time: '23:59:59' }, { keepMax: 5 }),
      theta('/option/history/quote', { ...base, date: compact(day), start_time: '00:00:00', end_time: '09:25:00' }, { keepMax: 5 }),
      theta('/option/history/quote', { ...base, date: compact(day), start_time: '09:30:00', end_time: '09:45:00' }, { keepMax: 5 }),
    ]);
    const st = (a: { status: number | string; name: string }) => `${a.status}${a.name ? ` ${a.name}` : ''}`;
    /* a quote row with a bid or an ask above nothing — a zero-zero row is a book with no one in it */
    const live = (a: { rows: Record<string, unknown>[]; count: number }) => a.count;
    const s: Sample = {
      day,
      expiry,
      strike,
      evening: { rows: live(ev), first: ev.first, last: ev.last, status: st(ev) },
      morning: { rows: live(mo), first: mo.first, last: mo.last, status: st(mo) },
      open: { rows: op.count, status: st(op) },
      served: live(ev) + live(mo) > 0,
    };
    say(`${day} (${expiry} ${strike}): evening ${s.evening.rows} [${s.evening.status}] · morning ${s.morning.rows} [${s.morning.status}] · open ${s.open.rows} [${s.open.status}]${s.served ? ` · first ${s.evening.first || s.morning.first}` : ''}`);
    return s;
  }

  /* the sampled walk: the first and third Wednesday of each month */
  const days: string[] = [];
  for (let d = from; d < now.iso; d = isoAdd(d, 1)) {
    if (weekdayOf(d) !== 3) continue;
    const dom = Number(d.slice(8, 10));
    if ((dom >= 1 && dom <= 7) || (dom >= 15 && dom <= 21)) days.push(d);
  }
  const samples: Sample[] = [];
  for (const d of days) samples.push(await sample(d));

  /* the boundaries refined to the day: every weekday between two samples that disagree, the morning window */
  const refined: Sample[] = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (a.served === b.served || !a.expiry || !b.expiry) continue;
    say(`the state changes between ${a.day} (${a.served ? 'served' : 'none'}) and ${b.day} (${b.served ? 'served' : 'none'}) — every weekday between`);
    for (let d = isoAdd(a.day, 1); d < b.day; d = isoAdd(d, 1)) if (weekdayOf(d) !== 0 && weekdayOf(d) !== 6) refined.push(await sample(d));
  }
  const all = [...samples, ...refined].filter(s => s.open.rows > 0 || s.served).sort((x, y) => x.day.localeCompare(y.day));
  const runs: { from: string; to: string }[] = [];
  for (const s of all) {
    if (!s.served) continue;
    const last = runs[runs.length - 1];
    const prevIdx = all.indexOf(s) - 1;
    if (last && prevIdx >= 0 && all[prevIdx].served) last.to = s.day;
    else runs.push({ from: s.day, to: s.day });
  }

  /* how Theta dates the evening session: the newest Monday, asked from 20:15 under Sunday's date and Monday's */
  let dating = '';
  let mon = isoAdd(now.iso, -1);
  while (weekdayOf(mon) !== 1) mon = isoAdd(mon, -1);
  const ex2 = expiryOn(mon);
  const c2 = closeBefore(mon);
  if (ex2 && c2) {
    const base = { symbol: 'SPXW', expiration: compact(ex2), strike: Math.round(c2 / 5) * 5, right: 'both', interval: '5m', start_time: '20:15:00', end_time: '23:59:59' };
    const [sun, monday] = await Promise.all([theta('/option/history/quote', { ...base, date: compact(isoAdd(mon, -1)) }, { keepMax: 5 }), theta('/option/history/quote', { ...base, date: compact(mon) }, { keepMax: 5 })]);
    dating = `Sunday ${isoAdd(mon, -1)} 20:15–23:59: ${sun.count} rows [${sun.status}] (${sun.first || '—'} to ${sun.last || '—'}); Monday ${mon} 20:15–23:59: ${monday.count} rows [${monday.status}] (${monday.first || '—'} to ${monday.last || '—'}) — the evening session is ${sun.count > 0 ? 'dated by its calendar evening (the downloader asks it so)' : monday.count > 0 ? 'NOT under the calendar evening — check the stamps above before the downloader is trusted' : 'not answered either way'}`;
    say(dating);
  }

  const first = runs.length ? runs[0].from : null;
  const lines = [
    `# SPX overnight rows on Theta — ${now.text}`,
    '',
    `Terminal ${THETA_BASE}; SPXW at the money (the close before, rounded to 5), both rights, every five minutes; ${samples.length} sampled days from ${from} and ${refined.length} more to find each change.`,
    '',
    `**The first date Theta serves overnight rows: ${first ?? 'none found'}**${runs.length > 1 ? ` — and again from ${runs.slice(1).map(r => r.from).join(', ')}` : ''}.`,
    '',
    '| run of days served | from | to |',
    '|---|---|---|',
    ...runs.map((r, i) => `| ${i + 1} | ${r.from} | ${r.to} |`),
    '',
    dating ? `**How the evening is dated**: ${dating}.` : '',
    '',
    '| day | expiry | strike | evening rows | morning rows | first stamp | open rows (control) |',
    '|---|---|---|---|---|---|---|',
    ...all.map(s => `| ${s.day} | ${s.expiry ?? '—'} | ${s.strike ?? '—'} | ${s.evening.rows} | ${s.morning.rows} | ${s.evening.first || s.morning.first || '—'} | ${s.open.rows} |`),
  ];
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'gth-report.md'), lines.join('\n') + '\n');
  writeFileSync(join(outDir, 'gth.json'), JSON.stringify({ at: now.text, first, runs, dating, samples: all }, null, 1));
  say(`the first date Theta serves SPX overnight rows: ${first ?? 'none found'} — ${join(outDir, 'gth-report.md')}`);
}

void main();
