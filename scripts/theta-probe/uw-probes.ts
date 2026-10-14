/*
  U1–U4: Unusual Whales beside Theta — the plan's limits in its headers, where its history starts, how its tape labels
  SPX, and the one mapping that matters for every later build: Theta's one-minute quote stamps against UW's intraday
  minutes against Terrain's stored minute labels.
*/
import { createInflateRaw } from 'node:zlib';
import { pipeline, Readable, Transform } from 'node:stream';
import { createInterface } from 'node:readline';
import { nyWallTime } from '../../src/core/nyTime';
import { createFieldStore } from '../../server/fieldStore';
import { csvFields, entryBody } from '../../server/tapeBackfill';
import { compact, f, findings, fmtBytes, hhmm, isoAdd, note, num, occOf, quoteOf, row, say, stampMinute, theta, uw, UW_TOKEN, weekdayOf, type Row } from './lib';
import { contractsOn, nextExpiration, stockMinutes, type Ctx } from './ctx';

const tokenOk = (id: string): boolean => {
  if (UW_TOKEN) return true;
  row({ id, url: 'https://api.unusualwhales.com/…', status: 'no-key', error: 'UW_API_TOKEN is not in .env', rows: '', bytes: '', seconds: '', first: '', last: '', conclusion: 'skipped: no Unusual Whales key on this machine' });
  return false;
};
const hdr = (h: Record<string, string>, keys: string[]) => keys.map(k => `${k}: ${h[k] ?? '—'}`).join(' · ');
/** A refusal: a numeric status of 400 or more */
const bad = (status: number | string): boolean => typeof status === 'number' && status >= 400;

/* ---- U1: the plan's limits --------------------------------------------------------------------------------------- */
export async function U1(): Promise<void> {
  if (!tokenOk('U1')) return;
  const a = await uw('/api/stock/SPY/stock-state');
  const keys = ['x-uw-token-req-limit', 'x-uw-req-per-minute-remaining', 'x-uw-minute-req-counter'];
  const others = Object.entries(a.headers).filter(([k]) => !keys.includes(k)).map(([k, v]) => `${k}: ${v}`).join(' · ');
  row({ id: 'U1', url: a.url, status: a.status, error: a.status === 200 ? '' : a.text.slice(0, 200), rows: a.json && typeof a.json === 'object' ? Object.keys(a.json as object).length : '', bytes: a.bytes, seconds: a.seconds, first: '', last: '', conclusion: `${hdr(a.headers, keys)}${others ? ` · ${others}` : ''}` });
  findings.uwLimits = hdr(a.headers, keys);
}

/* ---- U2: where UW's history starts ------------------------------------------------------------------------------- */
export async function U2(): Promise<void> {
  if (!tokenOk('U2')) return;
  const a = await uw('/api/option-trades/full-tape/2022-01-03');
  const dates = [...a.text.matchAll(/\d{4}-\d{2}-\d{2}/g)].map(m => m[0]).filter(d => d !== '2022-01-03');
  const E = dates.sort()[dates.length - 1] ?? null;
  row({ id: 'U2a', url: a.url, status: a.status, error: bad(a.status) ? a.text.slice(0, 240) : '', rows: '', bytes: a.bytes, seconds: a.seconds, first: '', last: '', conclusion: a.status === 403 ? `403 as expected${E ? `; the earliest date in the message: ${E}` : '; NO date in the message'} (${hdr(a.headers, ['x-request-id'])})` : `status ${a.status}${E ? `, dates in the body: ${dates.join(', ')}` : ''}` });
  findings.uwEarliest = E ?? `none (status ${a.status})`;
  if (!E) return;
  const chain = async (id: string, day: string, label: string) => {
    const c = await uw(`/api/stock/SPY/option-chains?date=${day}&greeks=true&limit=1`);
    const data = c.json && typeof c.json === 'object' && Array.isArray((c.json as { data?: unknown[] }).data) ? (c.json as { data: unknown[] }).data : null;
    row({ id, url: c.url, status: c.status, error: bad(c.status) ? c.text.slice(0, 200) : '', rows: data ? data.length : '', bytes: c.bytes, seconds: c.seconds, first: day, last: day, conclusion: `${label} ${day}: ${c.status}${data ? `, ${data.length} row${data.length === 1 ? '' : 's'}` : ''}${c.headers['retry-after'] ? ` · retry-after ${c.headers['retry-after']}` : ''}` });
    return { status: c.status, n: data?.length ?? 0 };
  };
  await chain('U2b', E, 'the chain dated E');
  let prev = isoAdd(E, -1);
  for (let i = 0; i < 4; i++) {
    while (weekdayOf(prev) === 0 || weekdayOf(prev) === 6) prev = isoAdd(prev, -1);
    const r = await chain(`U2c${i ? i + 1 : ''}`, prev, 'the session before E');
    if (r.status === 200 && r.n > 0) break;
    if (r.status === 403) break;
    prev = isoAdd(prev, -1);
  }
}

/* ---- U3: one full-tape day — the SPX labels, the SPX minutes for X1 ----------------------------------------------- */
export interface TapePass {
  day: string;
  status: number | string;
  location: boolean;
  lines: number;
  bytes: number;
  seconds: number;
  labels: Map<string, { rows: number; nullPrice: number; sample: string }>;
  columns: string[];
  error: string;
}
/** The tape of a day, streamed (never on disk): rows by SPX-like label, and SPX's underlying a minute into ctx.tapeSpx */
export async function tapePass(ctx: Ctx, day: string): Promise<TapePass> {
  const out: TapePass = { day, status: 0, location: false, lines: 0, bytes: 0, seconds: 0, labels: new Map(), columns: [], error: '' };
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(`https://api.unusualwhales.com/api/option-trades/full-tape/${day}`, { headers: { Authorization: `Bearer ${UW_TOKEN}` }, redirect: 'manual', signal: AbortSignal.timeout(60_000) });
  } catch (e) {
    out.status = 'network';
    out.error = e instanceof Error ? e.message : String(e);
    return out;
  }
  out.status = res.status;
  const loc = res.headers.get('location');
  await res.body?.cancel().catch(() => undefined);
  if (!(res.status >= 300 && res.status < 400 && loc)) {
    out.error = `no archive link (status ${res.status})`;
    return out;
  }
  out.location = true;
  let zip: Response;
  try {
    zip = await fetch(loc, { signal: AbortSignal.timeout(60 * 60_000) });
  } catch (e) {
    out.error = `the archive could not be fetched: ${e instanceof Error ? e.message : String(e)}`;
    return out;
  }
  if (!zip.ok || !zip.body) {
    out.error = `the archive answered ${zip.status}`;
    return out;
  }
  const counting = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      out.bytes += chunk.length;
      cb(null, chunk);
    },
  });
  const inflated = createInflateRaw();
  let streamError: Error | null = null;
  pipeline(Readable.fromWeb(zip.body as unknown as import('node:stream/web').ReadableStream), counting, entryBody(), inflated, err => {
    if (err) streamError = err instanceof Error ? err : new Error(String(err));
  });
  const spx = (ctx.tapeSpx[day] ??= new Map<number, number>());
  const lines = createInterface({ input: inflated, crlfDelay: Infinity });
  let ix: Record<string, number> | null = null;
  try {
    for await (const line of lines) {
      if (!ix) {
        out.columns = line.split(',');
        ix = Object.fromEntries(out.columns.map((c, i) => [c, i]));
        continue;
      }
      out.lines++;
      const c1 = line.indexOf(',');
      const c2 = line.indexOf(',', c1 + 1);
      if (c1 < 0 || c2 < 0) continue;
      const name = line.slice(c1 + 1, c2);
      if (!name.startsWith('SPX')) continue;
      const fields = csvFields(line);
      const up = fields[ix.underlying_price] ?? '';
      const lab = out.labels.get(name) ?? { rows: 0, nullPrice: 0, sample: '' };
      lab.rows++;
      if (up === '' || up === 'null' || up === 'NULL' || up === '\\N') lab.nullPrice++;
      if (!lab.sample) lab.sample = `${fields[ix.option_chain_id] ?? '?'} executed_at ${fields[ix.executed_at] ?? '?'} underlying_price ${up || '(empty)'}`;
      out.labels.set(name, lab);
      /* SPX's underlying a minute, the last print's — for X1 */
      const price = Number(up);
      const ex = fields[ix.executed_at] ?? '';
      const m = Date.parse(`${ex.slice(0, 10)}T${ex.slice(11, 16)}:00Z`);
      if (Number.isFinite(price) && price > 0 && Number.isFinite(m) && fields[ix.canceled] !== 't') spx.set(m, price);
    }
  } catch (e) {
    out.error = `the stream ended early: ${e instanceof Error ? e.message : String(e)}`;
  }
  if (streamError) out.error ||= `the stream ended early: ${(streamError as Error).message}`;
  out.seconds = (Date.now() - t0) / 1000;
  return out;
}
export async function U3(ctx: Ctx): Promise<void> {
  if (!tokenOk('U3')) return;
  /* the newest session whose tape is published (a day's tape comes after its close) */
  let day = ctx.recent ?? isoAdd(ctx.today, -1);
  let pass = await tapePass(ctx, day);
  if (!pass.location && ctx.calendar.length > 1) {
    day = ctx.calendar.find(d => d < day) ?? day;
    pass = await tapePass(ctx, day);
  }
  const labels = [...pass.labels.entries()].map(([k, v]) => `${k}: ${v.rows.toLocaleString('en-US')} rows, underlying_price null on ${v.nullPrice} (${((100 * v.nullPrice) / Math.max(1, v.rows)).toFixed(1)}%)`).join('; ');
  const sample = [...pass.labels.values()].map(v => v.sample).slice(0, 2).join(' | ');
  row({ id: 'U3a', url: `https://api.unusualwhales.com/api/option-trades/full-tape/${day} → the signed archive`, status: pass.status, error: pass.error, rows: pass.lines, bytes: pass.bytes, seconds: pass.seconds, first: day, last: day, conclusion: pass.location ? `${pass.lines.toLocaleString('en-US')} prints; SPX-labelled: ${labels || 'none'}${sample ? ` · e.g. ${sample}` : ''}; the tape’s SPX underlying kept for X1 (${ctx.tapeSpx[day]?.size ?? 0} minutes)` : `no tape for ${day}: ${pass.error}` });
  findings.tapeSpxLabels = labels || `none (${pass.error || pass.status})`;
  const c = await uw('/api/stock/SPX/option-contracts?limit=5');
  const data = c.json && typeof c.json === 'object' && Array.isArray((c.json as { data?: Row[] }).data) ? (c.json as { data: Row[] }).data : [];
  const prefixes = [...new Set(data.map(r => String(r.option_symbol ?? '').replace(/\d.*$/, '')))];
  row({ id: 'U3b', url: c.url, status: c.status, error: bad(c.status) ? c.text.slice(0, 200) : '', rows: data.length, bytes: c.bytes, seconds: c.seconds, first: '', last: '', conclusion: data.length ? `option_symbol prefixes on SPX: ${prefixes.join(', ')} (e.g. ${data.map(r => r.option_symbol).slice(0, 3).join(', ')})` : `no contracts (${c.status})` });
  findings.spxOptionSymbolPrefixes = prefixes.join(', ') || `none (${c.status})`;
}

/* ---- U4: the clock mapping --------------------------------------------------------------------------------------- */
export async function U4(ctx: Ctx): Promise<void> {
  if (!tokenOk('U4')) return;
  const day = ctx.recent ?? isoAdd(ctx.today, -1);
  const [y, mo, d] = day.split('-').map(Number);
  const { bars } = await stockMinutes('SPY', day);
  const open = bars.get(9 * 60 + 30)?.open ?? null;
  const { contracts } = await contractsOn(ctx, 'SPY', day);
  const exp = (await nextExpiration(ctx, 'SPY', day)) ?? contracts.map(c => c.expiration).filter(e => e >= day).sort()[0];
  if (!open || !exp) {
    row({ id: 'U4', url: '', status: '', error: '', rows: '', bytes: '', seconds: '', first: day, last: '', conclusion: `not run: ${!open ? `no SPY bars for ${day}` : 'no SPY expiration found'}` });
    return;
  }
  const strikes = [...new Set(contracts.filter(c => c.expiration === exp).map(c => c.strike))].sort((a, b) => Math.abs(a - open) - Math.abs(b - open));
  const atm = strikes[0];
  const up = strikes.find(k => k > atm) ?? atm;
  const picks: { strike: number; right: 'C' | 'P' }[] = [
    { strike: atm, right: 'C' },
    { strike: atm, right: 'P' },
    { strike: up, right: 'C' },
  ];
  note('U4', `day ${day}, SPY open ${open}, expiration ${exp}, contracts ${picks.map(p => `${p.strike}${p.right}`).join(', ')}`);
  const store = createFieldStore();
  const shown = store.readRows('SPY', day, 'shown');
  const nyOf = (ms: number) => {
    const dt = new Date(ms).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return dt;
  };
  if (shown.length) {
    const first = shown.slice(0, 3).map(r => `m ${nyOf(r.m)} written ${nyOf(r.at)} (+${Math.round((r.at - r.m) / 1000)} s)`).join('; ');
    note('U4', `Terrain’s stored minute labels (shown rows, ${shown.length}): m is the minute’s START in New York — ${first}`);
    findings.terrainLabel = `m = the minute’s start (${shown.length} shown rows on ${day}; e.g. ${first.split(';')[0]})`;
  } else {
    note('U4', `no shown rows for SPY ${day} in .feed-cache/field — Terrain’s label is the minute’s start by its code (fieldStore StoreRow.m)`);
    findings.terrainLabel = 'm = the minute’s start (fieldStore StoreRow.m; no shown rows for the day on this machine)';
  }
  const verdicts: string[] = [];
  for (const [i, p] of picks.entries()) {
    const occ = occOf('SPY', exp, p.right, p.strike);
    const right = p.right === 'C' ? 'call' : 'put';
    /* a. the one-minute quote rows */
    const q = await theta('/option/history/quote', { symbol: 'SPY', expiration: compact(exp), strike: p.strike, right, date: compact(day), interval: '1m', start_time: '09:30:00', end_time: '16:00:00' }, { keepMax: 1000 });
    const stamps = q.rows.map(r => (typeof r.timestamp === 'string' ? r.timestamp.slice(11, 23) : '?'));
    const at1000 = q.rows.find(r => typeof r.timestamp === 'string' && r.timestamp.slice(11, 19) === '10:00:00');
    row({ id: `U4${'abc'[i]}1`, url: q.url, status: q.status, error: q.error, rows: q.count, bytes: q.bytes, seconds: q.seconds, first: stamps[0] ?? '', last: stamps[stamps.length - 1] ?? '', conclusion: q.status === 200 ? `${occ}: ${q.count} one-minute rows, stamps ${stamps.slice(0, 3).join(', ')} … ${stamps[stamps.length - 1] ?? ''}; the 10:00:00 row bid/ask ${at1000 ? `${quoteOf(at1000).bid}/${quoteOf(at1000).ask}` : 'absent'}` : `status ${q.status}` });
    /* b. the ticks round 10:00, to see which quote the 10:00:00 row carries */
    const t = await theta('/option/history/quote', { symbol: 'SPY', expiration: compact(exp), strike: p.strike, right, date: compact(day), interval: 'tick', start_time: '09:59:30', end_time: '10:01:00' }, { keepMax: 20_000 });
    let verdict = `ticks: ${t.status}`;
    if (t.status === 200 && at1000) {
      const ticks = t.rows.filter(r => typeof r.timestamp === 'string').map(r => ({ s: r.timestamp as string, ...quoteOf(r) })).sort((a, b) => a.s.localeCompare(b.s));
      const same = (a: { bid: number | null; ask: number | null }, b: { bid: number | null; ask: number | null }) => a.bid === b.bid && a.ask === b.ask;
      const q1000 = quoteOf(at1000);
      const lastBefore = [...ticks].reverse().find(x => x.s.slice(11, 23) <= '10:00:00.000');
      const firstAfter = ticks.find(x => x.s.slice(11, 23) > '10:00:00.000');
      const lastInMinute = [...ticks].reverse().find(x => x.s.slice(11, 23) < '10:01:00.000' && x.s.slice(11, 23) >= '10:00:00.000');
      const which = lastBefore && same(lastBefore, q1000) ? 'THE LAST TICK AT OR BEFORE 10:00:00.000 (the NBBO as of the stamp)' : firstAfter && same(firstAfter, q1000) ? 'the FIRST tick after 10:00:00.000' : lastInMinute && same(lastInMinute, q1000) ? 'the LAST tick inside [10:00:00, 10:01:00) (the interval’s last quote, labelled by its start)' : 'none of: the last tick before, the first after, the last inside the minute';
      verdict = `${ticks.length} ticks 09:59:30–10:01:00; the 1m row stamped 10:00:00 (${q1000.bid}/${q1000.ask}) equals ${which}${lastBefore ? ` · last ≤10:00:00 at ${lastBefore.s.slice(11, 23)} ${lastBefore.bid}/${lastBefore.ask}` : ''}${firstAfter ? ` · first >10:00:00 at ${firstAfter.s.slice(11, 23)} ${firstAfter.bid}/${firstAfter.ask}` : ''}`;
      verdicts.push(which);
    }
    row({ id: `U4${'abc'[i]}2`, url: t.url, status: t.status, error: t.error, rows: t.count, bytes: t.bytes, seconds: t.seconds, first: t.first.slice(11, 23), last: t.last.slice(11, 23), conclusion: verdict });
    /* c. UW's intraday minutes for the same contract */
    const u = await uw(`/api/option-contract/${encodeURIComponent(occ)}/intraday?date=${day}`);
    const data = u.json && typeof u.json === 'object' && Array.isArray((u.json as { data?: Row[] }).data) ? (u.json as { data: Row[] }).data : [];
    const starts = data.map(r => String(r.start_time ?? '')).sort();
    const rth = data.filter(r => r.trading_hours === undefined || r.trading_hours === 'rth').length;
    row({ id: `U4${'abc'[i]}3`, url: u.url, status: u.status, error: bad(u.status) ? u.text.slice(0, 200) : '', rows: data.length, bytes: u.bytes, seconds: u.seconds, first: starts[0] ?? '', last: starts[starts.length - 1] ?? '', conclusion: data.length ? `UW intraday: ${data.length} minutes (${rth} rth), start_time ${starts.slice(0, 2).join(', ')} … ${starts[starts.length - 1]} (UTC; the bar covers [start_time, +1 min) — its iv_low/iv_high are the minute’s prints)${u.headers['x-uw-req-per-minute-remaining'] ? ` · remaining ${u.headers['x-uw-req-per-minute-remaining']}` : ''}` : `UW intraday: ${u.status} ${u.text.slice(0, 120)}` });
  }
  /* d. the OHLC bar's stamp against its trades */
  const occ = occOf('SPY', exp, 'C', atm);
  const o = await theta('/option/history/ohlc', { symbol: 'SPY', expiration: compact(exp), strike: atm, right: 'call', date: compact(day), interval: '1m', start_time: '09:30:00', end_time: '09:33:00' }, { keepMax: 10 });
  const tr = await theta('/option/history/trade', { symbol: 'SPY', expiration: compact(exp), strike: atm, right: 'call', date: compact(day), start_time: '09:30:00', end_time: '09:33:00' }, { keepMax: 50_000 });
  let barWord = '';
  if (o.status === 200 && tr.status === 200) {
    const bar930 = o.rows.find(r => typeof r.timestamp === 'string' && r.timestamp.slice(11, 16) === '09:30');
    const sizeIn = (from: string, to: string) => tr.rows.filter(r => typeof r.timestamp === 'string' && r.timestamp.slice(11, 23) >= from && r.timestamp.slice(11, 23) < to).reduce((s, r) => s + (num(r.size) ?? 0), 0);
    const v930 = num(bar930?.volume);
    const in930 = sizeIn('09:30:00.000', '09:31:00.000');
    const in929 = sizeIn('09:29:00.000', '09:30:00.000');
    barWord = `${occ}: the 09:30 bar’s volume ${v930 ?? '—'}; trades stamped [09:30:00, 09:31:00) sum ${in930}, [09:29, 09:30) ${in929} → ${v930 != null && v930 === in930 ? 'A BAR’S STAMP IS ITS OPENING MINUTE (bar ≤ trade < bar + 1m)' : 'the bar does not equal the minute after its stamp — see the counts'}`;
    findings.ohlcStamp = v930 != null && v930 === in930 ? 'the bar stamped T holds the trades of [T, T+1m)' : `unclear: 09:30 bar volume ${v930}, trades in [09:30, 09:31) ${in930}`;
  } else barWord = `ohlc ${o.status}, trades ${tr.status}`;
  row({ id: 'U4d', url: o.url, status: `${o.status} / ${tr.status}`, error: o.error || tr.error, rows: `${o.count} bars / ${tr.count} trades`, bytes: o.bytes + tr.bytes, seconds: o.seconds + tr.seconds, first: '', last: '', conclusion: barWord });
  /* the mapping, said once */
  const quoteWord = verdicts.length ? (verdicts.every(v => v === verdicts[0]) ? verdicts[0] : `MIXED: ${verdicts.join(' | ')}`) : 'not established (no ticks)';
  findings.quoteStamp = quoteWord;
  const minuteStart = nyWallTime(y, mo, d, 10, 0);
  note('U4', `MAPPING for Terrain’s minute m (start ${hhmm(600)} New York = ${new Date(minuteStart).toISOString()} UTC): UW’s intraday row start_time = m (UTC) covers [m, m+1); Terrain’s stored row m = the minute’s start, knowable at m+1; Theta’s 1m quote row stamped T is ${quoteWord} — so the quote knowable at the END of Terrain’s minute m is Theta’s row stamped m+1 if the stamp is "as of", or the row stamped m if the stamp labels the interval’s last quote. Theta’s stamps are New York wall time with no offset.`);
  void f;
  void fmtBytes;
  void say;
}
