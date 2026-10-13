/*
==================================================
  SLAYER TERMINAL - THE DARK POOL ON THE FEED
  (data/feed/traceDark.ts)

  Trace's Dark Pool reads Unusual Whales when the room
  is on the feed (2026-10-12):
    · THE NAME'S CROSSES: GET /api/darkpool/{ticker},
      the newest 200 each poll, kept for the session;
    · THE SHELVES: the day's off-exchange volume by
      price (GET /api/stock/{ticker}/stock-volume-price-
      levels), binned, the six heaviest by dollars —
      and the share of the day that printed off-exchange
      off the same answer, lit against off;
    · THE PRICE PATH the shelves are tested on: the
      name's minute bars; the spot, UW's quote.
    · THE LEADERS: the market's crosses of $1M and up,
      the session's, by name and by sector.
  A cross carries no aggressor: the read says where it
  printed against the spot and which way the session
  is going, never who traded it. Hedge flow needs the
  options' shelves, which this room does not read on
  the feed — no cross is read as one here.
==================================================
*/

import { useMemo } from 'react';
import { defendedCount, levelUsage, sectorOf } from '../darkpool';
import { nyClock, nyText } from '../../core/nyTime';
import type { DarkLeaderRow, DarkLeadersView, DarkPoolIntent, DarkPoolLevel, DarkPoolPrint, DarkPoolView, DarkSector, LevelRole, Posture } from '../../types/darkpool';
import type { BookContract } from '../../types/trace';
import { useFeedPoll } from './poll';
import { feedSession, idNum, type FeedSession } from './trace';
import { uwDarkpool, uwOhlc, uwOiPerStrike, uwVolumeAtPrice, type UwDarkPrint, type UwStockDay } from './uw';
import { dayChangePct } from './stockDay';
import { SECTOR_LIST } from '../darkpool';

const dateParam = (s: FeedSession) => (s.live ? undefined : s.date);
const LEVEL_COUNT = 6;
const SIZED_PERCENTILE = 0.72;

/* The read, by where the cross printed and the session's way — no draw, no hash. A cross that is not sized and printed on
   an options shelf (within 0.1% of one of the name's heaviest open-interest strikes, the vendor's count) is read as the
   house reads it there: hedge flow before direction (data/darkpool.ts classify) */
function classify(vsSpotPct: number, sized: boolean, sessionUp: boolean, onOptionShelf = false): { intent: DarkPoolIntent; conviction: number; read: string } {
  const below = vsSpotPct < -0.08;
  const above = vsSpotPct > 0.08;
  if (onOptionShelf && !sized)
    return {
      intent: 'HEDGE FLOW',
      conviction: 55,
      read: 'Printed on an options shelf — the place fits a desk hedging an options book more than a position on direction.',
    };
  if (sized && below && sessionUp)
    return {
      intent: 'ACCUMULATION',
      conviction: 75,
      read: 'Sized cross below the market in a rising session — consistent with a holder adding on weakness. The print shows where it crossed, not which side started it; later tests holding this price would back the read.',
    };
  if (sized && above && !sessionUp)
    return {
      intent: 'DISTRIBUTION',
      conviction: 75,
      read: 'Sized cross above the market in a falling session — consistent with a holder selling into strength. The print shows where it crossed, not which side started it; rallies stalling at this price would back the read.',
    };
  if (sized && below)
    return { intent: 'ACCUMULATION', conviction: 60, read: 'Sized cross below the market — leans accumulation; the next test of this price holding would back it.' };
  if (sized && above)
    return { intent: 'DISTRIBUTION', conviction: 60, read: 'Sized cross above the market — leans distribution; bounces stalling into it would back it.' };
  return { intent: 'ROTATION', conviction: 45, read: 'Routine off-exchange rotation — little to read on its own; it carries more weight if prints cluster at one shelf.' };
}

/** The name's crosses, the day's volume by price and its minute bars, as the page's view. Null until the crosses are in. */
export function useFeedDarkView(on: boolean, ticker: string, spot: number | null, changePct: number | null): DarkPoolView | null {
  const s = feedSession();
  const t = ticker.toUpperCase();
  const date = dateParam(s);
  const prints = useFeedPoll(on ? `trace:dark:${t}:${s.date}` : null, () => uwDarkpool({ ticker: t, limit: 200, date }), 15_000);
  const levels = useFeedPoll(on ? `trace:vap:${t}:${s.date}` : null, () => uwVolumeAtPrice(t, date), 60_000);
  const bars = useFeedPoll(on ? `trace:bars:${t}:${s.date}` : null, () => uwOhlc(t, { size: '1m', limit: 1000, date }), 30_000);
  /* the options shelves: the name's heaviest open-interest strikes (an index's too) */
  const oi = useFeedPoll(on ? `trace:oi:${t}:${s.date}` : null, () => uwOiPerStrike(t), 10 * 60_000);
  return useMemo(() => {
    if (!on || !prints) return null;
    const rows = prints.ok ? prints.data.filter(p => !p.canceled && p.executedAt >= s.open - 4 * 3600_000) : [];
    const path = (bars?.ok ? bars.data : []).filter(b => b.at >= s.open && b.at < s.close && b.close !== null).sort((a, b) => a.at - b.at).map(b => b.close as number);
    const px = spot ?? rows[0]?.price ?? path[path.length - 1] ?? NaN;
    const sessionUp = (changePct ?? 0) >= 0;

    /* the shelves: the day's off-exchange dollars binned by price, the six heaviest */
    const vap = levels?.ok ? levels.data : [];
    let lit = 0;
    let off = 0;
    for (const v of vap) {
      lit += v.lit;
      off += v.off;
    }
    const width = Number.isFinite(px) ? Math.max(0.01, Math.round(px * 0.00025 * 100) / 100) : 0.05;
    const bins = new Map<number, { dollars: number; vol: number; pxSum: number }>();
    for (const v of vap) {
      if (v.off <= 0) continue;
      const k = Math.round(v.price / width);
      const b = bins.get(k) ?? { dollars: 0, vol: 0, pxSum: 0 };
      b.dollars += v.off * v.price;
      b.vol += v.off;
      b.pxSum += v.off * v.price;
      bins.set(k, b);
    }
    const top = Array.from(bins.values())
      .sort((a, b) => b.dollars - a.dollars)
      .slice(0, LEVEL_COUNT);
    const topSum = top.reduce((a, b) => a + b.dollars, 0) || 1;
    const onShelf = (price: number, level: number) => Math.abs(price - level) / level < 0.0015;
    const levelsOut: DarkPoolLevel[] = top
      .map(b => {
        const price = Math.round((b.pxSum / b.vol) * 100) / 100;
        const distPct = Number.isFinite(px) ? ((price - px) / px) * 100 : NaN;
        const role: LevelRole = Math.abs(distPct) < 0.12 ? 'PIVOT' : distPct < 0 ? 'SUPPORT' : 'RESISTANCE';
        const defended = Math.min(defendedCount(path, price, 0.0012), 5);
        const sharePct = (b.dollars / topSum) * 100;
        return { price, notional: b.dollars, prints: rows.filter(p => onShelf(p.price, price)).length, sharePct, role, defended, distPct, usage: levelUsage(role, price, defended, sharePct) };
      })
      .sort((a, b) => b.price - a.price);

    /* the crosses */
    const shelves = (oi?.ok ? oi.data : [])
      .map(r => ({ strike: r.strike, oi: r.callOi + r.putOi }))
      .sort((a, b) => b.oi - a.oi)
      .slice(0, 8)
      .map(r => r.strike);
    const onOptionShelf = (price: number) => shelves.some(k => k > 0 && Math.abs(price - k) / k < 0.001);
    const sizes = rows.map(p => p.size).sort((a, b) => a - b);
    const sizedLine = sizes.length ? sizes[Math.floor(sizes.length * SIZED_PERCENTILE)] : Infinity;
    /* two crosses alike to the cent and the second keep their order — the second is told apart by its count */
    const seen = new Map<string, number>();
    const out: DarkPoolPrint[] = rows.map(p => {
      const base = `${p.trackingId}-${p.executedAt}-${p.size}-${p.price}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      const vsSpotPct = Number.isFinite(px) ? ((p.price - px) / px) * 100 : NaN;
      const sized = p.size >= sizedLine;
      const atLevel = levelsOut.some(l => Math.abs(p.price - l.price) / l.price < 0.001);
      return {
        id: idNum(`${base}-${n}`),
        /* New York's clock text, as the house's prints keep it — printed through nyTextClock */
        time: nyText(p.executedAt, { seconds: true }),
        ticker: t,
        price: p.price,
        size: p.size,
        notional: p.premium || p.size * p.price,
        venue: p.marketCenter || '—',
        vsSpotPct,
        atLevel,
        sized,
        ...classify(vsSpotPct, sized, sessionUp, onOptionShelf(p.price)),
      };
    });

    let accW = 0;
    let distW = 0;
    for (const p of out) {
      if (p.intent === 'ACCUMULATION') accW += p.notional * (p.conviction / 100);
      if (p.intent === 'DISTRIBUTION') distW += p.notional * (p.conviction / 100);
    }
    const gross = accW + distW || 1;
    const netPosturePct = ((accW - distW) / gross) * 100;
    const posture: Posture = netPosturePct > 18 ? 'ACCUMULATING' : netPosturePct < -18 ? 'DISTRIBUTING' : 'BALANCED';
    const strongest = [...levelsOut].sort((a, b) => b.notional - a.notional)[0];
    const postureNote =
      posture === 'ACCUMULATING'
        ? `Sized crosses read as accumulation outweigh those read as distribution${strongest ? ` — the heaviest shelf is $${strongest.price.toFixed(2)}` : ''}.`
        : posture === 'DISTRIBUTING'
          ? `Sized crosses read as distribution outweigh those read as accumulation${strongest ? ` — the heaviest shelf is $${strongest.price.toFixed(2)}` : ''}.`
          : 'Crosses read as accumulation and as distribution roughly offset — no side committing. A break of a shelf is what would show a direction.';
    return {
      ticker: t,
      spot: px,
      dpSharePct: lit + off > 0 ? (off / (lit + off)) * 100 : NaN,
      netPosturePct,
      posture,
      postureNote,
      totalNotional: out.reduce((a, p) => a + p.notional, 0),
      levels: levelsOut,
      prints: out,
      largest: out.reduce<DarkPoolPrint | null>((a, p) => (a === null || p.notional > a.notional ? p : a), null),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, prints, levels, bars, oi, spot, changePct, t, s.date]);
}

const sectorInk = new Map(SECTOR_LIST.map(x => [x.sector, x.color]));
const OTHER = 'Funds and others';

/** The market's sized crosses by sector and name: the session's crosses of $1M and up, the heaviest first */
export function feedDarkLeaders(prints: UwDarkPrint[], book: BookContract[], days: Map<string, UwStockDay> | null = null): DarkLeadersView {
  const bookSector = new Map<string, string>();
  for (const b of book) if (b.sector && !bookSector.has(b.ticker)) bookSector.set(b.ticker, b.sector);
  const byName = new Map<string, { notional: number; size: number; prints: number; price: number; at: number; sector: string }>();
  for (const p of prints) {
    const n = byName.get(p.ticker) ?? { notional: 0, size: 0, prints: 0, price: p.price, at: 0, sector: bookSector.get(p.ticker) ?? sectorOf(p.ticker)?.sector ?? OTHER };
    n.notional += p.premium || p.size * p.price;
    n.size += p.size;
    n.prints++;
    if (p.executedAt > n.at) {
      n.at = p.executedAt;
      n.price = p.price;
    }
    byName.set(p.ticker, n);
  }
  const bySector = new Map<string, DarkSector>();
  for (const [ticker, n] of byName) {
    const sec = bySector.get(n.sector) ?? { sector: n.sector, color: sectorInk.get(n.sector) ?? 'rgb(var(--text-secondary))', notional: 0, sharePct: 0, prints: 0, rows: [] };
    /* the day's direction and the name's average day are the stock screener's (stockDay.ts): its change today, and the
       shares crossed dark against its 30-day average volume */
    const day = days?.get(ticker.toUpperCase());
    const chg = dayChangePct(day);
    const avg = day?.avg30Volume ?? null;
    const row: DarkLeaderRow = { ticker, price: n.price, dirUp: Number.isFinite(chg) ? chg >= 0 : undefined, notional: n.notional, pctAvgVol: avg && avg > 0 ? (n.size / avg) * 100 : NaN, size: n.size };
    sec.rows.push(row);
    sec.notional += n.notional;
    sec.prints += n.prints;
    bySector.set(n.sector, sec);
  }
  const sectors = Array.from(bySector.values()).sort((a, b) => b.notional - a.notional);
  const total = sectors.reduce((a, x) => a + x.notional, 0) || 1;
  for (const x of sectors) {
    x.sharePct = (x.notional / total) * 100;
    x.rows.sort((a, b) => b.notional - a.notional);
  }
  return { totalNotional: sectors.reduce((a, x) => a + x.notional, 0), totalPrints: sectors.reduce((a, x) => a + x.prints, 0), updated: nyClock(Date.now(), { seconds: true }), sectors };
}
