/*
  T11 and T12, analysis alone — nothing stored:
  T11  put-call parity on one-minute mids: per expiration and minute, C − P = DF·(F − K) fitted on the near-the-money
       strikes; F against the real underlying, DF against the T2 rate (and the rate the fit implies);
  T12  the bead field built from Theta's inputs for sessions the UW rebuild also holds — the same model, the same code
       path as the store's final rows (fieldStore rowsOf → trailModel universeOf → modelColumn), fed Theta's contracts,
       open interest and one-minute quotes (each mid inverted to a vol under the house's UW convention) — against the
       rebuild's columns: median cell gap, p90, walls equal, flip within $0.25. Two stamp mappings are tried, the
       quote stamped T read as the start of Terrain's minute T (A) and as the end of its minute T−1 (B).
  The rate: T12 prices under the house's UW convention (r 4.15%, q 0 — the clock and carry UW's own vols are solved on,
  so the two fields stand on one footing); the SOFR series T2 read is reported beside T11, never filled in (rule 5).
*/
import { join } from 'node:path';
import { nyWallTime } from '../../src/core/nyTime';
import { lastTradeOf, uwYears } from '../../src/data/feed/trailModel';
import { createFieldStore, type StoreRow } from '../../server/fieldStore';
import type { MinuteBar, PastDay } from '../../server/fieldBackfill';
import { compact, daysBetween, f, findings, fmtBytes, impliedVolOf, isoAdd, med, midOf, note, num, occOf, pct, rightOf, row, say, stampMinute, theta, weekdayOf, type Row, type ThetaAnswer } from './lib';
import { contractsOn, datesOf, expirationsOf, indexMinutes, readGz, rebuiltSessions, stockMinutes, type Contract, type Ctx } from './ctx';

const pick5 = (ds: string[]): string[] => [...new Set([0.1, 0.3, 0.5, 0.7, 0.9].map(q => ds[Math.min(ds.length - 1, Math.floor(q * (ds.length - 1)))]).filter(Boolean))];
const letters = 'abcdefghijklmnop';

/* ---- T11 ------------------------------------------------------------------------------------------------------- */
interface Fit {
  F: number;
  DF: number;
  n: number;
}
/** C − P = a + bK by least squares; DF = −b, F = a ÷ DF */
function parityFit(points: { K: number; y: number }[]): Fit | null {
  const n = points.length;
  if (n < 4) return null;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sx += p.K;
    sy += p.y;
    sxx += p.K * p.K;
    sxy += p.K * p.y;
  }
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-12) return null;
  const b = (n * sxy - sx * sy) / den;
  const a = (sy - b * sx) / n;
  const DF = -b;
  if (!(DF > 0.8 && DF < 1.05)) return null;
  return { F: a / DF, DF, n };
}
const sofrOn = (ctx: Ctx, day: string): number | null => {
  if (!ctx.sofr) return null;
  const dates = [...ctx.sofr.keys()].filter(d => d <= day).sort();
  const d = dates[dates.length - 1];
  if (!d) return null;
  const r = ctx.sofr.get(d)!;
  return r > 1 ? r / 100 : r;
};

export async function T11(ctx: Ctx): Promise<void> {
  const spy = (await datesOf(ctx, 'stock', 'SPY', 'trade')).dates.filter(d => d >= '2020-01-02' && d < ctx.today);
  const cal = ctx.calendar.length ? [...ctx.calendar].reverse() : spy;
  const spxw = cal.filter(d => d >= '2017-01-03' && d < ctx.today);
  const plans = [...pick5(spy).map(day => ({ root: 'SPY', day })), ...pick5(spxw).map(day => ({ root: 'SPXW', day }))];
  if (!plans.length) {
    row({ id: 'T11', url: '', status: '', error: '', rows: '', bytes: '', seconds: '', first: '', last: '', conclusion: 'no dates to fit on (the lists were empty)' });
    return;
  }
  const allBp: number[] = [];
  const allR: number[] = [];
  const allRgap: number[] = [];
  for (const [i, plan] of plans.entries()) {
    const id = `T11${letters[i]}`;
    const t0 = Date.now();
    const exps = (await expirationsOf(ctx, plan.root)).expirations.filter(e => e >= plan.day).slice(0, 4);
    /* the underlying a minute: SPY's bar open at the minute (the first trade after the quote's stamp), SPX's index price standing then */
    let S: (minute: number) => number | null;
    if (plan.root === 'SPY') {
      const { bars } = await stockMinutes('SPY', plan.day);
      S = minute => bars.get(minute)?.open ?? bars.get(minute - 1)?.close ?? null;
    } else {
      const { prices } = await indexMinutes('SPX', plan.day);
      S = minute => prices.get(minute) ?? null;
    }
    const r = sofrOn(ctx, plan.day);
    let firstUrl = '';
    let status: number | string = '';
    let error = '';
    let rows = 0;
    let bytes = 0;
    const bp: number[] = [];
    const rFit: number[] = [];
    let fits = 0;
    let minutesFit = 0;
    for (const exp of exps) {
      /* mids a minute a strike: strike_range keeps the chain near the money; a terminal refusing it (473) is asked whole */
      const byMinute = new Map<number, Map<number, { c?: number; p?: number }>>();
      const onRow = (q: Row) => {
        if (typeof q.timestamp !== 'string') return;
        const k = num(q.strike);
        const mid = midOf(q);
        const right = rightOf(q);
        if (k == null || mid == null || !right) return;
        const m = stampMinute(q.timestamp);
        const strikes = byMinute.get(m) ?? new Map<number, { c?: number; p?: number }>();
        const cur = strikes.get(k) ?? {};
        if (right === 'C') cur.c = mid;
        else cur.p = mid;
        strikes.set(k, cur);
        byMinute.set(m, strikes);
      };
      let a: ThetaAnswer = await theta('/option/history/quote', { symbol: plan.root, expiration: compact(exp), date: compact(plan.day), interval: '1m', start_time: '09:30:00', end_time: '16:00:00', strike_range: 6 }, { keep: false, onRow, timeoutMs: 60 * 60_000 });
      if (a.status === 473) a = await theta('/option/history/quote', { symbol: plan.root, expiration: compact(exp), date: compact(plan.day), interval: '1m', start_time: '09:30:00', end_time: '16:00:00' }, { keep: false, onRow, timeoutMs: 60 * 60_000 });
      if (!firstUrl) {
        firstUrl = a.url;
        status = a.status;
        error = a.error;
      }
      rows += a.count;
      bytes += a.bytes;
      if (a.status !== 200) continue;
      const tauDays = daysBetween(plan.day, exp);
      for (const [m, strikes] of byMinute) {
        const s = S(m);
        if (s == null) continue;
        const pts = [...strikes.entries()].filter(([k, v]) => v.c != null && v.p != null && Math.abs(k - s) <= 0.015 * s).map(([k, v]) => ({ K: k, y: v.c! - v.p! }));
        const fit = parityFit(pts);
        if (!fit) continue;
        fits++;
        bp.push((1e4 * (fit.F - s)) / s);
        /* the rate the discount implies, on expirations a day or more out (a same-day expiry's DF is 1 to the cent) */
        const tau = tauDays >= 1 ? tauDays / 365 : 0;
        if (tau > 0) rFit.push(-Math.log(fit.DF) / tau);
      }
      minutesFit += byMinute.size;
    }
    const absBp = bp.map(Math.abs);
    allBp.push(...absBp);
    allR.push(...rFit);
    if (r != null) allRgap.push(...rFit.map(x => 100 * (x - r)));
    row({
      id,
      url: firstUrl,
      status,
      error,
      rows,
      bytes,
      seconds: (Date.now() - t0) / 1000,
      first: plan.day,
      last: plan.day,
      conclusion: fits ? `${plan.root} ${plan.day}: ${fits} fits over ${exps.length} expirations (${exps.join(', ')}), ${minutesFit} minutes; F − S median ${f(med(bp), 1)} bp (|F − S| median ${f(med(absBp), 1)}, p90 ${f(pct(absBp, 0.9), 1)} bp); the rate the discount implies (expiries ≥ 1 day) median ${rFit.length ? `${f(100 * med(rFit), 2)}%` : '—'}${r != null ? ` against SOFR ${f(100 * r, 2)}%` : ' (no SOFR series: T2 did not answer)'}` : `${plan.root} ${plan.day}: no fit (status ${status}${error ? `, ${error.slice(0, 80)}` : ''})`,
    });
  }
  findings.parity = allBp.length ? `${allBp.length} fits on ${plans.length} days: |F − S| median ${f(med(allBp), 1)} bp, p90 ${f(pct(allBp, 0.9), 1)} bp; implied rate median ${f(100 * med(allR), 2)}%${allRgap.length ? `, against SOFR median ${f(med(allRgap), 2)} pp` : ' (no SOFR to set it against)'}` : 'no fits';
  note('T11', findings.parity);
}

/* ---- T12 ------------------------------------------------------------------------------------------------------- */
const sameFlip = (a: number | null, b: number | null) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) <= 0.25);
/** scripts/field-agree.ts's tolerance, the rebuild's rows as the reference */
function tolerance(ref: StoreRow[], other: StoreRow[]): { cols: number; cells: number; median: number; p90: number; walls: number; flips: number } {
  const byM = new Map(other.map(r => [r.m, r]));
  const rel: number[] = [];
  let cols = 0;
  let walls = 0;
  let flips = 0;
  let cells = 0;
  for (const R of ref) {
    const O = byM.get(R.m);
    if (!O) continue;
    cols++;
    if (O.cw === R.cw && O.pw === R.pw) walls++;
    if (sameFlip(O.flip, R.flip)) flips++;
    const maxR = Math.max(...R.cells.map(c => Math.abs(c[1])), 1);
    const om = new Map(O.cells.map(c => [c[0], c[1]] as [number, number]));
    for (const [k, v] of R.cells) {
      if (Math.abs(v) < 0.02 * maxR) continue;
      const ov = om.get(k);
      if (ov == null) continue;
      cells++;
      rel.push(Math.abs(ov - v) / Math.abs(v));
    }
  }
  return { cols, cells, median: med(rel), p90: pct(rel, 0.9), walls: cols ? walls / cols : NaN, flips: cols ? flips / cols : NaN };
}
const pc = (x: number) => (Number.isFinite(x) ? `${(100 * x).toFixed(1)}%` : 'n/a');

/** Open interest by OCC symbol on a date, every expiration */
async function oiOn(root: string, day: string): Promise<{ oi: Map<string, number>; answer: ThetaAnswer }> {
  const oi = new Map<string, number>();
  const answer = await theta('/option/history/open_interest', { symbol: root, expiration: '*', date: compact(day) }, {
    keep: false,
    onRow: r => {
      const k = num(r.strike);
      const right = rightOf(r);
      const v = num(r.open_interest);
      const exp = typeof r.expiration === 'string' ? r.expiration : typeof r.expiration === 'number' ? String(r.expiration) : null;
      if (k == null || !right || v == null || !exp) return;
      oi.set(occOf(String(r.symbol ?? root), exp, right, k), v);
    },
  });
  return { oi, answer };
}
const prevSession = (ctx: Ctx, day: string): string => {
  const p = ctx.calendar.find(d => d < day);
  if (p) return p;
  let d = isoAdd(day, -1);
  while (weekdayOf(d) === 0 || weekdayOf(d) === 6) d = isoAdd(d, -1);
  return d;
};
const barMs = (day: string, minute: number): number => {
  const [y, m, d] = day.split('-').map(Number);
  return nyWallTime(y, m, d, Math.floor(minute / 60), minute % 60);
};
/** A tick kept when the vol moved a tenth of a point (fieldBackfill compressTicks's step) */
function pushTick(ticks: Record<string, number[]>, occ: string, ms: number, iv: number): void {
  const t = (ticks[occ] ??= []);
  const last = t.length ? t[t.length - 1] : NaN;
  if (Number.isFinite(last) && Math.abs(iv - last) < 0.001) return;
  t.push(ms, Math.round(iv * 1e5) / 1e5);
}

export async function T12(ctx: Ctx): Promise<void> {
  const store = createFieldStore();
  const picks: { name: string; day: string }[] = [];
  for (const name of ['SPY', 'QQQ']) for (const day of rebuiltSessions(ctx.root, name).filter(d => d < ctx.today).reverse()) if (picks.length < 5) picks.push({ name, day });
  if (!picks.length) {
    row({ id: 'T12', url: '', status: '', error: '', rows: '', bytes: '', seconds: '', first: '', last: '', conclusion: 'no rebuilt session on this machine (.feed-cache/field/<NAME>/<day>/past.json.gz with bars.json.gz) — run the backfill first' });
    findings.t12 = 'not run: no UW rebuild on this machine';
    return;
  }
  const overall: { a: number[]; b: number[]; wa: number[]; wb: number[]; fa: number[]; fb: number[] } = { a: [], b: [], wa: [], wb: [], fa: [], fb: [] };
  for (const [i, { name, day }] of picks.entries()) {
    const id = `T12${letters[i]}`;
    const t0 = Date.now();
    let calls = 0;
    let bytes = 0;
    let rows = 0;
    let firstUrl = '';
    let status: number | string = '';
    let error = '';
    try {
      const past = readGz<PastDay>(join(ctx.root, name, day, 'past.json.gz'));
      const bars = readGz<MinuteBar[]>(join(ctx.root, name, day, 'bars.json.gz')).filter(b => b.session === 'r' && Number.isFinite(b.close)).sort((a, b) => a.time - b.time);
      if (!bars.length) throw new Error('no regular bars');
      const open = bars[0].open ?? bars[0].close;
      const prev = prevSession(ctx, day);
      const roots = name === 'SPX' ? ['SPX', 'SPXW'] : [name];
      /* the contracts: within 60 days and 15% of the open, with open interest dated the session (the rebuild's own cut) */
      const contracts: Contract[] = [];
      const oiD = new Map<string, number>();
      const oiP = new Map<string, number>();
      for (const root of roots) {
        const c = await contractsOn(ctx, root, day);
        calls++;
        bytes += c.answer.bytes;
        rows += c.answer.count;
        if (c.answer.status !== 200) throw new Error(`contracts ${root} ${day}: ${c.answer.status} ${c.answer.error}`);
        contracts.push(...c.contracts.filter(x => x.expiration >= day && daysBetween(day, x.expiration) <= 60 && Math.abs(x.strike - open) <= 0.15 * open));
        const d = await oiOn(root, day);
        const p = await oiOn(root, prev);
        calls += 2;
        bytes += d.answer.bytes + p.answer.bytes;
        rows += d.answer.count + p.answer.count;
        if (d.answer.status !== 200) throw new Error(`open interest ${root} ${day}: ${d.answer.status} ${d.answer.error}`);
        for (const [k, v] of d.oi) oiD.set(k, v);
        for (const [k, v] of p.oi) oiP.set(k, v);
      }
      const kept = contracts.filter(c => (oiD.get(occOf(c.symbol, c.expiration, c.right, c.strike)) ?? 0) > 0);
      const expiries = [...new Set(kept.map(c => `${c.symbol}|${c.expiration}`))].sort();
      const inUniverse = new Set(kept.map(c => occOf(c.symbol, c.expiration, c.right, c.strike)));
      say(`${id} ${name} ${day}: ${contracts.length} contracts within 60 days and 15%, ${kept.length} with open interest, ${expiries.length} root-expirations; the session before ${prev}`);
      /* the seed: the session before's last quotes at 16:00, each mid a vol under the UW convention at that close */
      const [py, pm, pd] = prev.split('-').map(Number);
      const closeMs = nyWallTime(py, pm, pd, 16, 0);
      const seedRows: [string, number | null, number | null, number][] = [];
      const lastQuote = new Map<string, Row>();
      for (const re of expiries) {
        const [root, exp] = re.split('|');
        const a = await theta('/option/history/quote', { symbol: root, expiration: compact(exp), date: compact(prev), interval: '1m', start_time: '15:59:00', end_time: '16:00:00' }, {
          keep: false,
          onRow: q => {
            const k = num(q.strike);
            const right = rightOf(q);
            if (k == null || !right || typeof q.timestamp !== 'string') return;
            const occ = occOf(root, exp, right, k);
            if (!inUniverse.has(occ)) return;
            const had = lastQuote.get(occ);
            if (!had || String(had.timestamp) < q.timestamp) lastQuote.set(occ, q);
          },
        });
        calls++;
        bytes += a.bytes;
        rows += a.count;
      }
      const prevClose = bars.length ? null : null;
      void prevClose;
      /* the underlying at the session before's close: Theta's last regular minute */
      const prevBars = await stockMinutes(name, prev);
      calls++;
      bytes += prevBars.answer.bytes;
      const prevSpot = prevBars.bars.get(15 * 60 + 59)?.close ?? [...prevBars.bars.values()].pop()?.close ?? null;
      for (const [occ, q] of lastQuote) {
        const mid = midOf(q);
        const c = kept.find(x => occOf(x.symbol, x.expiration, x.right, x.strike) === occ);
        if (mid == null || !c || prevSpot == null) continue;
        const tau = uwYears(closeMs, lastTradeOf(c.expiration), c.expiration, prev);
        const iv = impliedVolOf(mid, prevSpot, c.strike, tau, c.right);
        seedRows.push([occ, Number.isFinite(iv) ? iv : null, closeMs, oiP.get(occ) ?? 0]);
      }
      /* the day's quotes a minute, each mid a vol: mapping A (the stamp is the start of Terrain's minute) and B (its end) */
      const barAt = new Map(bars.map(b => [b.time * 1000, b]));
      const ticksA: Record<string, number[]> = {};
      const ticksB: Record<string, number[]> = {};
      let mids = 0;
      let solved = 0;
      for (const re of expiries) {
        const [root, exp] = re.split('|');
        const a = await theta('/option/history/quote', { symbol: root, expiration: compact(exp), date: compact(day), interval: '1m', start_time: '09:30:00', end_time: '16:00:00' }, {
          keep: false,
          timeoutMs: 2 * 60 * 60_000,
          onRow: q => {
            if (typeof q.timestamp !== 'string') return;
            const k = num(q.strike);
            const right = rightOf(q);
            const mid = midOf(q);
            if (k == null || !right || mid == null) return;
            const occ = occOf(root, exp, right, k);
            if (!inUniverse.has(occ)) return;
            mids++;
            const m = stampMinute(q.timestamp);
            /* A: the bar starting at the stamp, the underlying its open */
            const msA = barMs(day, m);
            const bA = barAt.get(msA);
            if (bA && m < 16 * 60) {
              const clock = msA + 30_000;
              const iv = impliedVolOf(mid, bA.open ?? bA.close, k, uwYears(clock, lastTradeOf(exp), exp, day), right);
              if (Number.isFinite(iv)) {
                solved++;
                pushTick(ticksA, occ, msA, iv);
              }
            }
            /* B: the bar ending at the stamp, the underlying its close */
            const msB = barMs(day, m - 1);
            const bB = barAt.get(msB);
            if (bB && m - 1 >= 9 * 60 + 30) {
              const clock = msB + 30_000;
              const iv = impliedVolOf(mid, bB.close, k, uwYears(clock, lastTradeOf(exp), exp, day), right);
              if (Number.isFinite(iv)) pushTick(ticksB, occ, msB, iv);
            }
          },
        });
        calls++;
        bytes += a.bytes;
        rows += a.count;
        if (!firstUrl) {
          firstUrl = a.url;
          status = a.status;
          error = a.error;
        }
        if (a.status !== 200) throw new Error(`quotes ${root} ${exp} ${day}: ${a.status} ${a.error}`);
      }
      const thetaDay = (ticks: Record<string, number[]>): PastDay => ({
        format: 2,
        name,
        day,
        builtAt: Date.now(),
        oi: kept.map(c => [occOf(c.symbol, c.expiration, c.right, c.strike), oiD.get(occOf(c.symbol, c.expiration, c.right, c.strike)) ?? 0] as [string, number]),
        seed: { date: prev, receivedAt: closeMs, rows: seedRows },
        ticks,
        total: null,
        calls,
        asked: Object.keys(ticks).length,
        refused: 0,
        vols: 'minute',
      });
      const rowsU = store.rowsOf(past, bars);
      const rowsA = store.rowsOf(thetaDay(ticksA), bars);
      const rowsB = store.rowsOf(thetaDay(ticksB), bars);
      const tA = tolerance(rowsU, rowsA);
      const tB = tolerance(rowsU, rowsB);
      overall.a.push(tA.median);
      overall.b.push(tB.median);
      overall.wa.push(tA.walls);
      overall.wb.push(tB.walls);
      overall.fa.push(tA.flips);
      overall.fb.push(tB.flips);
      row({
        id,
        url: firstUrl,
        status,
        error,
        rows,
        bytes,
        seconds: (Date.now() - t0) / 1000,
        first: day,
        last: day,
        conclusion: `${name} ${day}: ${kept.length} contracts, ${mids.toLocaleString('en-US')} mids, ${solved.toLocaleString('en-US')} vols solved, ${calls} calls, ${fmtBytes(bytes)}; against the UW rebuild's ${rowsU.length} columns — A (stamp = the minute's start): ${tA.cols} columns, ${tA.cells} cells, |Theta − UW| ÷ |UW| median ${pc(tA.median)}, p90 ${pc(tA.p90)}, walls equal ${pc(tA.walls)}, flip within $0.25 ${pc(tA.flips)}; B (stamp = the minute's end): median ${pc(tB.median)}, p90 ${pc(tB.p90)}, walls ${pc(tB.walls)}, flip ${pc(tB.flips)}`,
      });
    } catch (e) {
      row({ id, url: firstUrl, status: status || 'error', error: e instanceof Error ? e.message : String(e), rows, bytes, seconds: (Date.now() - t0) / 1000, first: day, last: day, conclusion: `${name} ${day}: not built — ${e instanceof Error ? e.message : String(e)}` });
    }
  }
  findings.t12 = overall.a.length ? `${overall.a.length} sessions: cell gap median ${pc(med(overall.a))} (A) / ${pc(med(overall.b))} (B); walls equal ${pc(med(overall.wa))} / ${pc(med(overall.wb))}; flip within $0.25 ${pc(med(overall.fa))} / ${pc(med(overall.fb))}` : 'no session built';
  note('T12', findings.t12);
}
