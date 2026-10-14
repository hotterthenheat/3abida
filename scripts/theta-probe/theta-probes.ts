/*
  T1–T10: the Theta Terminal's entitlements, start dates, sizes and limits — each probe one row of the report (the exact
  URL, the status, the error text, rows, bytes, seconds, the first and last date found, one line of conclusion).
*/
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compact, env, f, findings, fmtBytes, hhmm, isoAdd, med, note, num, quoteOf, row, say, stampMinute, theta, thetaText, weekdayOf, type Row, type ThetaAnswer } from './lib';
import { contractsOn, datesOf, expirationsOf, nextExpiration, sayDates, stockMinutes, type Ctx } from './ctx';

const line = (a: ThetaAnswer) => ({ url: a.url, status: a.status, error: a.error, rows: a.count, bytes: a.bytes, seconds: a.seconds, first: a.first, last: a.last });
const keysOf = (a: ThetaAnswer) => (a.keys.length ? ` · keys: ${a.keys.join(', ')}` : '');

/* ---- T1: entitlement per data type ------------------------------------------------------------------------------- */
export async function T1(ctx: Ctx): Promise<void> {
  /* the terminal's startup lines, from its log on this machine when it is the one scripts/theta-terminal.mjs runs */
  const logs = [env.THETA_TERMINAL_LOG, join(process.cwd(), '.theta', 'logs', 'terminal-latest.log')].filter((p): p is string => !!p);
  let found = false;
  for (const p of logs) {
    if (!existsSync(p)) continue;
    const lines = readFileSync(p, 'utf8').split(/\r?\n/).filter(l => /Subscriptions:|Max concurrent requests|Theta Terminal:|concurrent requests|Environment:/.test(l));
    if (!lines.length) continue;
    found = true;
    for (const l of lines.slice(-6)) note('T1', `terminal log: ${l.replace(/\u001b\[[0-9;]*m/g, '')}`);
    const sub = lines.find(l => /Subscriptions:/.test(l));
    if (sub) findings.subscriptions = sub.replace(/\u001b\[[0-9;]*m/g, '').replace(/^.*Subscriptions:\s*/, '');
    break;
  }
  if (!found) note('T1', 'the terminal’s log was not found (.theta/logs/terminal-latest.log, or THETA_TERMINAL_LOG=<path>) — copy the "Subscriptions:" and "Max concurrent requests" lines from the terminal’s console into the report');

  const st = await thetaText('/terminal/mdds/status');
  row({ id: 'T1a', ...st, error: st.status === 200 ? '' : st.text, rows: '', bytes: '', first: '', last: '', conclusion: st.status === 200 && st.text === 'CONNECTED' ? 'the terminal is signed in (CONNECTED)' : `MDDS ${st.text || st.status} — not CONNECTED; every Theta probe below will fail until it is` });
  findings.mdds = `${st.status} ${st.text}`;
  if (!(st.status === 200 && st.text === 'CONNECTED')) return;

  const recent = ctx.recent ?? isoAdd(ctx.today, -1);
  const exp = (await nextExpiration(ctx, 'SPXW', recent)) ?? recent;
  const g = await theta('/option/history/greeks/second_order', { symbol: 'SPXW', expiration: compact(exp), date: compact(recent), interval: '1m' }, { keep: false, maxRows: 2000 });
  row({ id: 'T1b', ...line(g), rows: g.cut ? `${g.count}+ (cut)` : g.count, conclusion: g.status === 200 ? `Options Pro: second-order greeks answer (read cut at 2,000 rows)${keysOf(g)}` : g.status === 471 ? 'NOT entitled to second-order greeks (471)' : g.status === 472 ? `no data for SPXW ${exp} on ${recent}` : `status ${g.status}` });
  findings.optionsPro = g.status === 200 ? 'yes (second_order greeks 200)' : `no (${g.status})`;

  /* a flat-file day: the newest session within the last seven calendar days */
  const flatDay = ctx.calendar.find(d => d < ctx.today && d >= isoAdd(ctx.today, -7)) ?? isoAdd(ctx.today, -1);
  for (const [id, path, what] of [
    ['T1c', '/stock/flat_file/eod', 'Stocks Pro'],
    ['T1d', '/index/flat_file/eod', 'Indices Pro'],
  ] as const) {
    const a = await theta(path, { date: compact(flatDay) }, { keep: true, keepMax: 5, maxBytes: 65_536 });
    row({ id, ...line(a), rows: a.cut ? `${a.count}+ (cut)` : a.count, bytes: a.cut ? `${fmtBytes(a.bytes)}+ (cut)` : a.bytes, conclusion: a.status === 200 ? `${what}: the flat file answers (read cut at 64 KB)${keysOf(a)}` : a.status === 471 ? `NOT entitled to ${path} (471)` : a.status === 472 ? `no flat file for ${flatDay} (472) — flat files cover the last seven calendar days` : `status ${a.status}` });
    findings[what === 'Stocks Pro' ? 'stocksPro' : 'indicesPro'] = a.status === 200 ? `yes (${path} 200)` : `${a.status}`;
  }
}

/* ---- T2: the rate series ----------------------------------------------------------------------------------------- */
export async function T2(ctx: Ctx): Promise<void> {
  const calls: [string, Record<string, string>][] = [
    ['T2a', { symbol: 'SOFR', start_date: '20230102', end_date: '20231229' }],
    ['T2b', { symbol: 'TREASURY_M3', start_date: '20120601', end_date: '20121231' }],
  ];
  for (const [id, params] of calls) {
    const a = await theta('/interest_rate/history/eod', params, { keepMax: 5000 });
    let conclusion = a.status === 200 ? '' : a.status === 471 ? 'NOT entitled (471) — the account’s Rate subscription is FREE: EOD from 2024-01-01 by the docs' : a.status === 472 ? 'no data (472)' : `status ${a.status}`;
    if (a.status === 200 && a.rows.length) {
      const valueKey = a.keys.find(k => !['date', 'created', 'timestamp', 'symbol'].includes(k) && typeof a.rows[0][k] === 'number') ?? a.keys.find(k => num(a.rows[0][k]) != null && !/date|time|symbol/.test(k));
      const vals = valueKey ? a.rows.map(r => num(r[valueKey])).filter((v): v is number => v != null) : [];
      const distinct = new Set(vals.map(v => v.toFixed(6))).size;
      let pad = 1;
      while (pad < vals.length && vals[pad] === vals[0]) pad++;
      conclusion = `${a.count} rows, field "${valueKey ?? '?'}": ${distinct} distinct values; the first ${pad} day${pad === 1 ? '' : 's'} equal (${vals[0]?.toFixed(4) ?? '?'}) — ${pad > 5 ? 'PADDED at the start with the first real rate' : 'changes day to day'}${keysOf(a)}`;
      if (params.symbol === 'SOFR' && valueKey) {
        ctx.sofr = new Map();
        for (const r of a.rows) {
          const d = ['date', 'created', 'timestamp'].map(k => r[k]).find(v => typeof v === 'string' || typeof v === 'number');
          const v = num(r[valueKey]);
          if (d != null && v != null) ctx.sofr.set(String(d).slice(0, 10).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'), v);
        }
      }
    }
    row({ id, ...line(a), conclusion });
    findings[id === 'T2a' ? 'rateSofr' : 'rateTreasury'] = `${a.status} ${conclusion.slice(0, 160)}`;
  }
}

/* ---- T3 / T4: stock history and its dates ------------------------------------------------------------------------- */
async function stockDates(ctx: Ctx, id: string, symbol: string): Promise<string[]> {
  const t = await datesOf(ctx, 'stock', symbol, 'trade');
  row({ id: `${id}a`, ...line(t.answer), rows: t.dates.length, first: t.dates[0] ?? '', last: t.dates[t.dates.length - 1] ?? '', conclusion: t.dates.length ? `${symbol} trade dates from ${t.dates[0]} to ${t.dates[t.dates.length - 1]} (${t.dates.length} days)` : `no trade dates (${t.answer.status})` });
  const q = await datesOf(ctx, 'stock', symbol, 'quote');
  row({ id: `${id}b`, ...line(q.answer), rows: q.dates.length, first: q.dates[0] ?? '', last: q.dates[q.dates.length - 1] ?? '', conclusion: q.dates.length ? `${symbol} quote dates from ${q.dates[0]} to ${q.dates[q.dates.length - 1]}` : `no quote dates (${q.answer.status})` });
  sayDates(`${symbol} trade`, t.dates);
  findings[`${symbol}.stockFirstTrade`] = t.dates[0] ?? 'none';
  findings[`${symbol}.stockFirstQuote`] = q.dates[0] ?? 'none';
  ctx.day2013[symbol] = t.dates.find(d => d >= '2013-01-01' && d < '2014-01-01') ?? null;
  return t.dates;
}
async function minuteDay(id: string, symbol: string, day: string, venue: 'utp_cta' | 'nqb' = 'utp_cta'): Promise<Awaited<ReturnType<typeof stockMinutes>>> {
  const m = await stockMinutes(symbol, day, venue);
  const a = m.answer;
  const mins = [...m.bars.keys()].sort((x, y) => x - y);
  row({ id, ...line(a), conclusion: a.status === 200 ? `${m.bars.size} one-minute bars with prices${mins.length ? `, ${hhmm(mins[0])} to ${hhmm(mins[mins.length - 1])}` : ''} (${a.count} rows)${keysOf(a)}` : a.status === 472 ? `no bars for ${symbol} on ${day} (472)` : `status ${a.status}` });
  return m;
}
export async function T3(ctx: Ctx): Promise<void> {
  const dates = await stockDates(ctx, 'T3', 'SPY');
  /* the recent days: the newest before today, and the busiest of the last ten by EOD volume */
  const before = dates.filter(d => d < ctx.today);
  ctx.recent = before[before.length - 1] ?? null;
  if (ctx.recent) {
    const last10 = before.slice(-10);
    const e = await theta('/stock/history/eod', { symbol: 'SPY', start_date: compact(last10[0]), end_date: compact(ctx.recent) }, { keepMax: 100 });
    let best: { d: string; v: number } | null = null;
    for (const r of e.rows) {
      const d = typeof r.created === 'string' ? r.created.slice(0, 10) : typeof r.date === 'string' ? r.date.slice(0, 10) : null;
      const v = num(r.volume);
      if (d && v != null && (!best || v > best.v)) best = { d, v };
    }
    ctx.recentBusy = best?.d ?? ctx.recent;
    note('T3', `recent session ${ctx.recent}; the busiest of the last ten by Theta’s EOD volume: ${ctx.recentBusy}${best ? ` (${best.v.toLocaleString('en-US')} shares)` : ''}`);
  }
  for (const [id, d] of [
    ['T3c', '2017-01-03'],
    ['T3d', '2019-12-31'],
    ['T3e', '2020-01-02'],
  ] as const)
    await minuteDay(id, 'SPY', d);
}
export async function T4(ctx: Ctx): Promise<void> {
  await stockDates(ctx, 'T4', 'QQQ');
  await minuteDay('T4c', 'QQQ', '2012-06-01');
  const a = await minuteDay('T4d', 'QQQ', '2015-01-05', 'nqb');
  const b = await minuteDay('T4e', 'QQQ', '2015-01-05', 'utp_cta');
  if (a.bars.size && b.bars.size) {
    const common = [...a.bars.keys()].filter(m => b.bars.has(m));
    const same = common.filter(m => a.bars.get(m)!.close === b.bars.get(m)!.close).length;
    const gaps = common.map(m => Math.abs(a.bars.get(m)!.close - b.bars.get(m)!.close));
    const va = [...a.bars.values()].reduce((s, x) => s + x.volume, 0);
    const vb = [...b.bars.values()].reduce((s, x) => s + x.volume, 0);
    note('T4', `QQQ 2015-01-05 nqb vs utp_cta: ${a.bars.size} vs ${b.bars.size} bars, ${common.length} minutes in common, the close equal on ${same}; median |Δclose| ${f(med(gaps), 4)}; volume ${va.toLocaleString('en-US')} vs ${vb.toLocaleString('en-US')} (nqb ${((100 * va) / Math.max(1, vb)).toFixed(0)}% of the consolidated)`);
    findings.venue = `nqb carries ${((100 * va) / Math.max(1, vb)).toFixed(0)}% of utp_cta's volume on QQQ 2015-01-05; closes equal on ${same} of ${common.length} minutes`;
  } else findings.venue = `not compared (nqb ${a.answer.status}, utp_cta ${b.answer.status})`;
}

/* ---- T5: the index --------------------------------------------------------------------------------------------- */
export async function T5(ctx: Ctx): Promise<void> {
  const d = await datesOf(ctx, 'index', 'SPX');
  row({ id: 'T5a', ...line(d.answer), rows: d.dates.length, first: d.dates[0] ?? '', last: d.dates[d.dates.length - 1] ?? '', conclusion: d.dates.length ? `SPX dates from ${d.dates[0]} to ${d.dates[d.dates.length - 1]} (${d.dates.length} days)` : `no SPX dates (${d.answer.status})` });
  findings['SPX.indexFirst'] = d.dates[0] ?? 'none';
  for (const [id, day] of [
    ['T5b', '2016-12-30'],
    ['T5c', '2017-01-03'],
  ] as const) {
    const a = await theta('/index/history/price', { symbol: 'SPX', date: compact(day), interval: '1m' }, { keepMax: 2000 });
    const mins = a.rows.map(r => (typeof r.timestamp === 'string' ? stampMinute(r.timestamp) : -1)).filter(m => m >= 0);
    const zero = a.rows.filter(r => num(r.price) === 0).length;
    row({ id, ...line(a), conclusion: a.status === 200 ? `${a.count} price rows${mins.length ? `, ${hhmm(Math.min(...mins))} to ${hhmm(Math.max(...mins))}` : ''}${zero ? `, ${zero} at 0.0` : ''} (an unchanged price is omitted, the docs say)${keysOf(a)}` : a.status === 472 ? `no SPX prices on ${day} (472)` : `status ${a.status}` });
  }
  const o = await theta('/index/history/ohlc', { symbol: 'SPX', start_date: '20170103', end_date: '20170131', interval: '1m' }, { keep: false });
  row({ id: 'T5d', ...line(o), conclusion: o.status === 200 ? `${o.count} one-minute SPX bars for January 2017 (a month in one call)${keysOf(o)}` : `status ${o.status}${o.status === 570 ? ' — too large; ask a shorter range' : ''}` });
}

/* ---- T6: the option roots' listings ------------------------------------------------------------------------------- */
export async function T6(ctx: Ctx): Promise<void> {
  const roots = ['SPY', 'QQQ', 'SPX', 'SPXW'];
  for (const [i, root] of roots.entries()) {
    const e = await expirationsOf(ctx, root);
    const first = e.expirations[0] ?? null;
    row({ id: `T6${'abcd'[i]}1`, ...line(e.answer), rows: e.expirations.length, first: first ?? '', last: e.expirations[e.expirations.length - 1] ?? '', conclusion: first ? `${root}: ${e.expirations.length} expirations, the earliest ${first}` : `${root}: no expirations (${e.answer.status})` });
    findings[`${root}.firstExpiration`] = first ?? 'none';
    if (!first) continue;
    const q = await theta('/option/list/dates/quote', { symbol: root, expiration: compact(first) }, { keepMax: 5000 });
    const dates = [...new Set(q.rows.map(r => (typeof r.date === 'string' ? r.date.slice(0, 10) : typeof r.date === 'number' ? String(r.date) : null)).filter((d): d is string => !!d))].sort();
    row({ id: `T6${'abcd'[i]}2`, ...line(q), rows: dates.length, first: dates[0] ?? '', last: dates[dates.length - 1] ?? '', conclusion: dates.length ? `${root} ${first}: quoted from ${dates[0]} (${dates.length} dates)` : `${root} ${first}: no quote dates (${q.status})` });
    findings[`${root}.firstQuoteDate`] = dates[0] ?? `none (${q.status})`;
  }
  const c = await contractsOn(ctx, 'SPY,QQQ,SPX,SPXW,SPXQ,SPXPM', '2012-06-01');
  const per = new Map<string, number>();
  for (const x of c.contracts) per.set(x.symbol, (per.get(x.symbol) ?? 0) + 1);
  row({ id: 'T6e', ...line(c.answer), rows: c.contracts.length, conclusion: c.answer.status === 200 ? `contracts quoting 2012-06-01 by root: ${[...per.entries()].map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}` : `status ${c.answer.status}` });
  findings.contracts20120601 = [...per.entries()].map(([k, v]) => `${k} ${v}`).join(', ') || `none (${c.answer.status})`;
  const w = await contractsOn(ctx, 'SPXW', '2019-06-04');
  row({ id: 'T6f', ...line(w.answer), rows: w.contracts.length, conclusion: w.answer.status === 200 ? `SPXW contracts quoting Tuesday 2019-06-04: ${w.contracts.length} (${new Set(w.contracts.map(x => x.expiration)).size} expirations)` : `status ${w.answer.status}` });
  findings.spxwTuesday2019 = w.answer.status === 200 ? `${w.contracts.length} contracts, ${new Set(w.contracts.map(x => x.expiration)).size} expirations` : `${w.answer.status}`;
}

/* ---- T7: a chain-day of one-minute quotes (heavy) ----------------------------------------------------------------- */
interface ChainStats {
  contracts: number;
  mode: number;
  modeShare: number;
  zero: number;
  maxStrike: number;
  symbols: Map<string, number>;
  minutes: Set<number>;
}
async function chainDay(id: string, symbol: string, day: string, extra = ''): Promise<void> {
  const per = new Map<string, number>();
  const symbols = new Map<string, number>();
  const minutes = new Set<number>();
  let zero = 0;
  let maxStrike = 0;
  const a = await theta('/option/history/quote', { symbol, expiration: '*', date: compact(day), interval: '1m', start_time: '09:30:00', end_time: '16:15:00' }, {
    keep: false,
    timeoutMs: 3 * 60 * 60_000,
    onRow: (r: Row) => {
      const key = `${r.expiration}|${r.strike}|${r.right}`;
      per.set(key, (per.get(key) ?? 0) + 1);
      const { bid, ask } = quoteOf(r);
      if (bid == null || ask == null || bid === 0 || ask === 0) zero++;
      const k = num(r.strike);
      if (k != null && k > maxStrike) maxStrike = k;
      const s = String(r.symbol ?? r.root ?? '');
      symbols.set(s, (symbols.get(s) ?? 0) + 1);
      if (typeof r.timestamp === 'string') minutes.add(stampMinute(r.timestamp));
    },
  });
  if (a.status !== 200) {
    row({ id, ...line(a), conclusion: a.status === 570 ? 'LARGE_REQUEST (570): the chain-day must be split (per expiration, or max_dte)' : a.status === 472 ? `no quotes for ${symbol} on ${day} (472)` : `status ${a.status}` });
    findings[`chainDay.${id}`] = `${symbol} ${day}: ${a.status} ${a.name}`;
    return;
  }
  const counts = new Map<number, number>();
  for (const n of per.values()) counts.set(n, (counts.get(n) ?? 0) + 1);
  const [mode, modeN] = [...counts.entries()].sort((x, y) => y[1] - x[1])[0] ?? [0, 0];
  const st: ChainStats = { contracts: per.size, mode, modeShare: per.size ? modeN / per.size : 0, zero, maxStrike, symbols, minutes };
  const every = st.minutes.size >= 400 && st.modeShare >= 0.9 && Math.abs(st.mode - st.minutes.size) <= 1;
  const units = st.maxStrike > 50_000 ? '1/10 cent' : 'dollars';
  const syms = [...st.symbols.entries()].map(([k, v]) => `${k} ${v}`).join(', ');
  row({
    id,
    ...line(a),
    conclusion: `${symbol} ${day}: ${a.count.toLocaleString('en-US')} rows, ${st.contracts.toLocaleString('en-US')} contracts, ${st.minutes.size} distinct minutes; rows a contract: mode ${st.mode} on ${(100 * st.modeShare).toFixed(0)}% — ${every ? 'A ROW EVERY MINUTE' : 'rows NOT every minute (only on change, or contracts quoting part of the day)'}; zero bid/ask rows ${st.zero.toLocaleString('en-US')} (${((100 * st.zero) / Math.max(1, a.count)).toFixed(1)}%); strikes in ${units} (max ${st.maxStrike}); symbols in the answer: ${syms}${extra}`,
  });
  findings[`chainDay.${id}`] = `${symbol} ${day}: ${a.count.toLocaleString('en-US')} rows, ${fmtBytes(a.bytes)}, ${a.seconds.toFixed(0)} s, ${st.contracts} contracts, ${every ? 'a row every minute' : `mode ${st.mode} rows a contract`}, strikes in ${units}`;
  if (symbol === 'SPX') findings.spxwUnderSpx = st.symbols.has('SPXW') ? `yes — ${st.symbols.get('SPXW')} SPXW rows came under symbol=SPX` : `no — symbol=SPX answered ${syms || 'nothing'} alone`;
}
export async function T7(ctx: Ctx): Promise<void> {
  const busy = ctx.recentBusy ?? ctx.recent ?? isoAdd(ctx.today, -1);
  const d2013 = ctx.day2013.SPY ?? '2013-06-03';
  await chainDay('T7a', 'SPXW', busy);
  await chainDay('T7b', 'SPY', busy);
  await chainDay('T7c', 'SPY', d2013, ctx.day2013.SPY ? '' : ' (SPY’s list holds no 2013 date; the owner’s probe date asked anyway)');
  await chainDay('T7d', 'SPX', busy);
}

/* ---- T8: open interest -------------------------------------------------------------------------------------------- */
export async function T8(ctx: Ctx): Promise<void> {
  const recent = ctx.recent ?? isoAdd(ctx.today, -1);
  const d2013 = ctx.day2013.SPY ?? '2013-06-03';
  for (const [id, day] of [
    ['T8a', recent],
    ['T8b', d2013],
  ] as const) {
    const stamps = new Map<string, number>();
    let rows = 0;
    const a = await theta('/option/history/open_interest', { symbol: 'SPY', expiration: '*', date: compact(day) }, {
      keep: false,
      onRow: (r: Row) => {
        rows++;
        if (typeof r.timestamp === 'string') {
          const t = r.timestamp.slice(11, 16);
          stamps.set(t, (stamps.get(t) ?? 0) + 1);
        }
      },
    });
    let vs = '';
    if (a.status === 200) {
      const c = await contractsOn(ctx, 'SPY', day);
      vs = c.answer.status === 200 ? ` against ${c.contracts.length.toLocaleString('en-US')} contracts quoting that day (${((100 * rows) / Math.max(1, c.contracts.length)).toFixed(0)}%)` : '';
    }
    const top = [...stamps.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${k} ×${v}`).join(', ');
    row({ id, ...line(a), conclusion: a.status === 200 ? `${rows.toLocaleString('en-US')} open-interest rows${vs}; stamps (New York): ${top}${a.first ? ` — ${a.first.slice(0, 19)}` : ''}${keysOf(a)}` : a.status === 472 ? `no open interest for SPY on ${day} (472)` : `status ${a.status}` });
    findings[`oi.${id}`] = a.status === 200 ? `${day}: ${rows} rows${vs}, stamped ${top}` : `${day}: ${a.status}`;
  }
}

/* ---- T9: implied volatility history ------------------------------------------------------------------------------- */
export async function T9(ctx: Ctx): Promise<void> {
  const calls: [string, string, string | null][] = [
    ['T9a', 'SPY', '2019-12-31'],
    ['T9b', 'SPY', '2020-01-02'],
    ['T9c', 'SPXW', '2016-12-30'],
    ['T9d', 'SPXW', '2017-01-03'],
    ['T9e', 'QQQ', ctx.day2013.QQQ ?? '2013-06-03'],
  ];
  for (const [id, root, day] of calls) {
    if (!day) continue;
    const exp = (await nextExpiration(ctx, root, day)) ?? day;
    let under: unknown = null;
    const a = await theta('/option/history/greeks/implied_volatility', { symbol: root, expiration: compact(exp), date: compact(day), interval: '1m' }, {
      keep: false,
      maxRows: 5000,
      onRow: r => {
        if (under == null && r.underlying_price != null) under = r.underlying_price;
      },
    });
    row({ id, ...line(a), rows: a.cut ? `${a.count}+ (cut)` : a.count, conclusion: a.status === 200 ? (a.count ? `${root} ${exp} on ${day}: IV rows answer (cut at 5,000), underlying_price ${String(under)}${keysOf(a)}` : `200 but EMPTY for ${root} ${exp} on ${day}`) : a.status === 471 ? 'NOT entitled (471)' : a.status === 472 ? `no IV rows for ${root} ${exp} on ${day} (472)` : `status ${a.status}` });
    findings[`iv.${id}`] = `${root} ${day}: ${a.status}${a.count ? ` rows, underlying ${String(under)}` : ''}`;
  }
  const recent = ctx.recent ?? isoAdd(ctx.today, -1);
  const all = await theta('/option/history/greeks/implied_volatility', { symbol: 'SPY', expiration: '*', date: compact(recent), interval: '1m' }, { keep: false, maxRows: 2000 });
  row({ id: 'T9f', ...line(all), rows: all.cut ? `${all.count}+ (cut)` : all.count, conclusion: all.status === 200 ? `expiration=* answers IV for the whole chain (read cut at 2,000 rows)` : `expiration=* on IV history: ${all.status} ${all.name}` });
}

/* ---- T10: the concurrency limit, a range too long, a multi-year EOD ---------------------------------------------- */
export async function T10(ctx: Ctx): Promise<void> {
  for (const n of [8, 24, 30]) {
    const t0 = Date.now();
    const answers = await Promise.all(Array.from({ length: n }, () => theta('/stock/history/eod', { symbol: 'AAPL', start_date: '20240101', end_date: '20240131' }, { keep: false, ungated: true, timeoutMs: 120_000 })));
    const hist = new Map<string, number>();
    for (const a of answers) hist.set(String(a.status), (hist.get(String(a.status)) ?? 0) + 1);
    const s = [...hist.entries()].map(([k, v]) => `${k} ×${v}`).join(', ');
    row({ id: `T10${n === 8 ? 'a' : n === 24 ? 'b' : 'c'}`, url: answers[0].url, status: s, error: answers.find(a => a.status === 429)?.error ?? '', rows: answers.reduce((x, a) => x + a.count, 0), bytes: answers.reduce((x, a) => x + a.bytes, 0), seconds: (Date.now() - t0) / 1000, first: '', last: '', conclusion: `${n} in parallel: ${s}${hist.has('429') ? ' — 429 OS_LIMIT appears here' : ' — no 429'}` });
    findings[`burst.${n}`] = s;
    say(`T10 burst of ${n}: ${s}`);
  }
  const long = await theta('/stock/history/ohlc', { symbol: 'QQQ', start_date: '20240101', end_date: '20240315', interval: '1m' }, { keep: false, maxRows: 10 });
  row({ id: 'T10d', ...line(long), rows: long.cut ? `${long.count}+ (cut)` : long.count, conclusion: long.status === 200 ? 'a 1m range over a month ANSWERS (read cut at 10 rows)' : `a 1m range over a month: ${long.status} ${long.name}` });
  findings.overMonth = `${long.status} ${long.name}`;
  const last = ctx.recent ?? isoAdd(ctx.today, -1);
  const eod = await theta('/stock/history/eod', { symbol: 'QQQ', start_date: '20120601', end_date: compact(last) }, { keepMax: 10 });
  row({ id: 'T10e', ...line(eod), conclusion: eod.status === 200 ? `multi-year EOD in one call: ${eod.count.toLocaleString('en-US')} rows, ${eod.first.slice(0, 10)} to ${eod.last.slice(0, 10)}` : `multi-year EOD: ${eod.status} ${eod.name}` });
  findings.multiYearEod = eod.status === 200 ? `${eod.count} rows ${eod.first.slice(0, 10)}–${eod.last.slice(0, 10)}` : `${eod.status} ${eod.name}`;
  void weekdayOf;
}
