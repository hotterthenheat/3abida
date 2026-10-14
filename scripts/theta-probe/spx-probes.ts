/*
  X1–X3: the owner's items 4a and 4b, decided by the data —
  X1  Theta's SPX index minutes against the tape's SPX underlying a minute on past sessions (median and p99 gap);
  X2  whether Theta's SPX arrives in real time (run inside the cash session: lag of the snapshot and the newest 1m row
      against the wall clock, and against UW's newest SPX print);
  X3  the 10:00 am straddle off Theta's one-minute quotes beside the store's own, on past sessions (item 4b's input).
*/
import { nyWallTime } from '../../src/core/nyTime';
import { createFieldStore, type StoreRow } from '../../server/fieldStore';
import type { MinuteBar, PastDay } from '../../server/fieldBackfill';
import { join } from 'node:path';
import { compact, f, findings, hhmm, isoAdd, med, note, num, nyNow, pct, quoteOf, row, say, theta, uw, UW_TOKEN, type Row } from './lib';
import { datesOf, indexMinutes, readGz, rebuiltSessions, tapePriceFile, type Ctx } from './ctx';
import { tapePass } from './uw-probes';

/* ---- X1: Theta's SPX minutes against the tape's ------------------------------------------------------------------- */
export async function X1(ctx: Ctx): Promise<void> {
  const { dates } = await datesOf(ctx, 'index', 'SPX');
  const past = dates.filter(d => d < ctx.today).reverse();
  if (!past.length) {
    row({ id: 'X1', url: '', status: '', error: '', rows: '', bytes: '', seconds: '', first: '', last: '', conclusion: 'no SPX dates listed — not compared' });
    return;
  }
  /* sessions with the tape's SPX minutes on this machine first, then the newest, downloading at most ctx.tapeDownloads tapes */
  const withFile = past.filter(d => tapePriceFile(ctx.root, 'SPX', d) || ctx.tapeSpx[d]);
  const picked = [...withFile.slice(0, 5)];
  for (const d of past) {
    if (picked.length >= 5) break;
    if (!picked.includes(d)) picked.push(d);
  }
  const allA: number[] = [];
  const allB: number[] = [];
  const allBp: number[] = [];
  let compared = 0;
  for (const [i, day] of picked.entries()) {
    let tape: Map<number, number> | null = tapePriceFile(ctx.root, 'SPX', day) ?? ctx.tapeSpx[day] ?? null;
    if (!tape || !tape.size) {
      if (ctx.tapeDownloads <= 0 || !UW_TOKEN) {
        row({ id: `X1${'abcde'[i]}`, url: '', status: '', error: '', rows: '', bytes: '', seconds: '', first: day, last: day, conclusion: `${day}: no tape SPX minutes on this machine and no download left (THETA_PROBE_TAPES=<n> allows more)` });
        continue;
      }
      ctx.tapeDownloads--;
      say(`X1: downloading the tape of ${day} for its SPX prints (${ctx.tapeDownloads} download${ctx.tapeDownloads === 1 ? '' : 's'} left)`);
      const p = await tapePass(ctx, day);
      tape = ctx.tapeSpx[day] ?? null;
      if (!tape || !tape.size) {
        row({ id: `X1${'abcde'[i]}`, url: `full-tape/${day}`, status: p.status, error: p.error, rows: p.lines, bytes: p.bytes, seconds: p.seconds, first: day, last: day, conclusion: `${day}: the tape carried no SPX underlying prices` });
        continue;
      }
    }
    const th = await indexMinutes('SPX', day);
    const a = th.answer;
    if (a.status !== 200 || !th.prices.size) {
      row({ id: `X1${'abcde'[i]}`, url: a.url, status: a.status, error: a.error, rows: a.count, bytes: a.bytes, seconds: a.seconds, first: day, last: day, conclusion: `${day}: Theta answered no SPX minutes (${a.status})` });
      continue;
    }
    const [y, m, d] = day.split('-').map(Number);
    const gapA: number[] = [];
    const gapB: number[] = [];
    const bp: number[] = [];
    for (let minute = 9 * 60 + 30; minute < 16 * 60; minute++) {
      const ms = nyWallTime(y, m, d, Math.floor(minute / 60), minute % 60);
      const t = tape.get(ms);
      if (t == null) continue;
      const pA = th.prices.get(minute);
      const pB = th.prices.get(minute + 1);
      if (pA != null) {
        gapA.push(Math.abs(pA - t));
        bp.push((1e4 * Math.abs(pA - t)) / t);
      }
      if (pB != null) gapB.push(Math.abs(pB - t));
    }
    compared++;
    allA.push(...gapA);
    allB.push(...gapB);
    allBp.push(...bp);
    row({ id: `X1${'abcde'[i]}`, url: a.url, status: a.status, error: a.error, rows: a.count, bytes: a.bytes, seconds: a.seconds, first: day, last: day, conclusion: `${day}: ${gapA.length} minutes compared (Theta ${th.raw} price rows, forward-filled); |Theta at T − tape’s last print in [T, T+1)| median ${f(med(gapA))} pts (${f(med(bp), 1)} bp), p99 ${f(pct(gapA, 0.99))}; |Theta at T+1 − tape [T, T+1)| median ${f(med(gapB))}, p99 ${f(pct(gapB, 0.99))}` });
  }
  const verdict = compared ? `${compared} sessions, ${allA.length} minutes: median gap ${f(med(allA))} pts (${f(med(allBp), 1)} bp), p99 ${f(pct(allA, 0.99))} pts, against the tape’s minute; the next minute’s Theta price fits ${med(allB) < med(allA) ? 'BETTER' : 'worse'} (median ${f(med(allB))})` : 'no session compared';
  findings.spxThetaVsTape = verdict;
  note('X1', verdict);
}

/* ---- X2: is Theta's SPX real-time? (inside the cash session) ------------------------------------------------------ */
export async function X2(ctx: Ctx): Promise<void> {
  const now = nyNow();
  const samples: { lagSnap: number | null; lagHist: number | null; gap: number | null; snap: number | null; print: number | null }[] = [];
  const t0 = Date.now();
  let snapUrl = '';
  let histUrl = '';
  let printUrl = '';
  let snapStatus: number | string = '';
  let histStatus: number | string = '';
  let printStatus: number | string = '';
  for (let i = 0; i < 18; i++) {
    const at = Date.now();
    const [snap, hist, print] = await Promise.all([
      theta('/index/snapshot/price', { symbol: 'SPX' }, { keepMax: 5, timeoutMs: 20_000 }),
      theta('/index/history/price', { symbol: 'SPX', date: compact(now.iso), interval: '1m', start_time: `${hhmm(Math.max(9 * 60 + 30, now.minute - 15))}:00`, end_time: '16:00:00' }, { keepMax: 100, timeoutMs: 20_000 }),
      UW_TOKEN ? uw('/api/option-trades?ticker_symbol=SPX&limit=40', { timeoutMs: 20_000 }) : Promise.resolve(null),
    ]);
    snapUrl = snap.url;
    histUrl = hist.url;
    snapStatus = snap.status;
    histStatus = hist.status;
    const s = snap.rows[0];
    const sStamp = s && typeof s.timestamp === 'string' ? s.timestamp : null;
    const sPrice = s ? num(s.price) : null;
    const lagSnap = sStamp ? (at - stampToMs(sStamp)) / 1000 : null;
    const newest = hist.rows.map(r => (typeof r.timestamp === 'string' ? r.timestamp : '')).sort().pop() ?? null;
    const lagHist = newest ? (at - stampToMs(newest)) / 1000 : null;
    let printPrice: number | null = null;
    if (print) {
      printUrl = print.url;
      printStatus = print.status;
      const data = print.json && typeof print.json === 'object' && Array.isArray((print.json as { data?: Row[] }).data) ? (print.json as { data: Row[] }).data : [];
      const priced = data.map(r => ({ p: num(r.underlying_price), t: Date.parse(String(r.executed_at ?? '')) })).filter(x => x.p != null && x.p > 0 && Number.isFinite(x.t)).sort((a, b) => b.t - a.t);
      printPrice = priced[0]?.p ?? null;
    }
    samples.push({ lagSnap, lagHist, gap: sPrice != null && printPrice != null ? sPrice - printPrice : null, snap: sPrice, print: printPrice });
    say(`X2 sample ${i + 1}/18: snapshot ${sPrice ?? '—'} (${sStamp ?? '—'}, lag ${lagSnap == null ? '—' : f(lagSnap, 1)} s), newest 1m row ${newest ?? '—'} (lag ${lagHist == null ? '—' : f(lagHist, 0)} s), UW print ${printPrice ?? '—'}`);
    if (i < 17) await new Promise(r => setTimeout(r, 10_000));
  }
  const lagS = samples.map(x => x.lagSnap).filter((v): v is number => v != null);
  const lagH = samples.map(x => x.lagHist).filter((v): v is number => v != null);
  const gaps = samples.map(x => x.gap).filter((v): v is number => v != null).map(Math.abs);
  const gapBp = samples.filter(x => x.gap != null && x.print).map(x => (1e4 * Math.abs(x.gap!)) / x.print!);
  const realtime = lagS.length >= 6 && med(lagS) <= 15 && lagH.length >= 6 && med(lagH) <= 150;
  const verdict = `${samples.length} samples over ${((Date.now() - t0) / 1000).toFixed(0)} s: snapshot lag median ${f(med(lagS), 1)} s (max ${f(Math.max(...lagS, 0), 1)}); newest 1m row lag median ${f(med(lagH), 0)} s (max ${f(Math.max(...lagH, 0), 0)}); |snapshot − UW’s newest SPX print| median ${f(med(gaps))} pts (${f(med(gapBp), 1)} bp), max ${f(Math.max(...gaps, 0))} → ${realtime ? 'REAL-TIME (the snapshot within 15 s, the 1m row within the current or previous minute)' : 'NOT real-time by this sample, or not enough answers'}`;
  row({ id: 'X2a', url: snapUrl, status: snapStatus, error: '', rows: samples.length, bytes: '', seconds: (Date.now() - t0) / 1000, first: now.iso, last: now.iso, conclusion: verdict });
  row({ id: 'X2b', url: histUrl, status: histStatus, error: '', rows: lagH.length, bytes: '', seconds: '', first: '', last: '', conclusion: `the newest one-minute SPX row: lag median ${f(med(lagH), 0)} s` });
  if (printUrl) row({ id: 'X2c', url: printUrl, status: printStatus, error: '', rows: gaps.length, bytes: '', seconds: '', first: '', last: '', conclusion: `UW’s newest SPX/SPXW print’s underlying beside Theta’s snapshot: median |gap| ${f(med(gaps))} pts` });
  findings.spxRealtime = verdict;
}
const stampToMs = (stamp: string): number => {
  const [y, m, d] = stamp.slice(0, 10).split('-').map(Number);
  const h = Number(stamp.slice(11, 13)) || 0;
  const mi = Number(stamp.slice(14, 16)) || 0;
  const s = Number(stamp.slice(17, 23)) || 0;
  return nyWallTime(y, m, d, h, mi) + Math.round(s * 1000);
};

/* ---- X3: the 10:00 am straddle off Theta's quotes, beside the store's --------------------------------------------- */
export async function X3(ctx: Ctx): Promise<void> {
  const store = createFieldStore();
  /* the sessions with a 10:00 row to set the quotes beside: the store's final or shown rows, else the rebuilt session's
     (the calibration's own loader reads the same two, server/scorecard.ts loadSession) */
  const days = [...new Set([...store.days('SPY'), ...rebuiltSessions(ctx.root, 'SPY')])].filter(d => d < ctx.today).sort().reverse().slice(0, 5);
  if (!days.length) {
    row({ id: 'X3', url: '', status: '', error: '', rows: '', bytes: '', seconds: '', first: '', last: '', conclusion: 'no SPY store rows nor rebuilt sessions on this machine — nothing to set the quotes beside' });
    return;
  }
  const gaps: number[] = [];
  for (const [i, day] of days.entries()) {
    const [y, m, d] = day.split('-').map(Number);
    const m1000 = nyWallTime(y, m, d, 10, 0);
    const fin = store.readRows('SPY', day, 'final').find(r => r.m === m1000) ?? null;
    const shown = store.readRows('SPY', day, 'shown').find(r => r.m === m1000) ?? null;
    let rebuilt: StoreRow | null = null;
    if (!fin && !shown && rebuiltSessions(ctx.root, 'SPY').includes(day)) {
      try {
        const past = readGz<PastDay>(join(ctx.root, 'SPY', day, 'past.json.gz'));
        const bars = readGz<MinuteBar[]>(join(ctx.root, 'SPY', day, 'bars.json.gz')).filter(b => b.session === 'r');
        rebuilt = store.rowsOf(past, bars).find(r => r.m === m1000) ?? null;
      } catch {
        rebuilt = null;
      }
    }
    const ref = fin ?? shown ?? rebuilt;
    if (!ref) {
      row({ id: `X3${'abcde'[i]}`, url: '', status: '', error: '', rows: '', bytes: '', seconds: '', first: day, last: day, conclusion: `${day}: no row at 10:00 (store or rebuild)` });
      continue;
    }
    const K = Math.round(ref.spot);
    const exp = ref.str0?.expiry ?? day;
    const q = await theta('/option/history/quote', { symbol: 'SPY', expiration: compact(exp), strike: K, right: 'both', date: compact(day), interval: '1m', start_time: '09:58:00', end_time: '10:02:00' }, { keepMax: 200 });
    const by = new Map<string, { c?: number; p?: number }>();
    for (const r of q.rows) {
      if (typeof r.timestamp !== 'string') continue;
      const mid = midOf(r);
      if (mid == null) continue;
      const t = r.timestamp.slice(11, 16);
      const cur = by.get(t) ?? {};
      if (String(r.right).toUpperCase().startsWith('C')) cur.c = mid;
      else cur.p = mid;
      by.set(t, cur);
    }
    const strad = (t: string) => {
      const x = by.get(t);
      return x && x.c != null && x.p != null ? x.c + x.p : null;
    };
    const s959 = strad('09:59');
    const s1000 = strad('10:00');
    const s1001 = strad('10:01');
    const storeVal = ref.str0?.value ?? null;
    const gap = s1000 != null && storeVal != null ? (100 * (s1000 - storeVal)) / storeVal : null;
    if (gap != null) gaps.push(Math.abs(gap));
    row({ id: `X3${'abcde'[i]}`, url: q.url, status: q.status, error: q.error, rows: q.count, bytes: q.bytes, seconds: q.seconds, first: day, last: day, conclusion: q.status === 200 ? `${day} SPY ${K} straddle on ${exp}: Theta mids at 09:59 ${f(s959 ?? NaN)}, 10:00 ${f(s1000 ?? NaN)}, 10:01 ${f(s1001 ?? NaN)}; the store’s 10:00 row (${fin ? 'final, the model' : shown ? 'shown, the NBBO at a read' : 'the rebuild, the model'}) ${storeVal != null ? `${f(storeVal)} (${ref.str0?.src}, strike ${ref.str0?.strike})` : 'none'}${gap != null ? `; Theta 10:00 − store ${gap >= 0 ? '+' : ''}${f(gap, 1)}%` : ''}` : `status ${q.status}` });
  }
  findings.straddle1000 = gaps.length ? `${gaps.length} sessions: |Theta’s 10:00 straddle − the store’s| median ${f(med(gaps), 1)}%, max ${f(Math.max(...gaps), 1)}%` : 'not compared';
  note('X3', findings.straddle1000);
  void isoAdd;
  void quoteOf;
}
const midOf = (r: Row): number | null => {
  const { bid, ask } = quoteOf(r);
  return bid != null && ask != null && bid > 0 && ask > 0 && ask >= bid ? (bid + ask) / 2 : null;
};
