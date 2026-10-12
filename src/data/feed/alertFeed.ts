/*
==================================================
  SLAYER TERMINAL - THE ALERTS' MARKET ON THE FEED
  (data/feed/alertFeed.ts)

  ALERTS WATCH THE REAL PRICE (2026-10-12). While UW
  answers, the shell's watcher (components/alerts/
  AlertWatcher.tsx) reads every name that holds an
  alert here, never off the house's simulator:

    · the PRICE — UW's day state (price.ts loadState,
      the rail's own loader), every 10 s; a cash index
      (SPX, NDX …, no day state on Basic) the price its
      book was figured at;
    · the BOOK — walls, flip, supreme, net GEX and the
      strike step (levels.ts feedBookOnce), every 30 s,
      for a name whose alerts read levels;
    · the BARS — UW's one-minute bars of the session,
      every minute, for an average, an RSI, a script or
      a drawn line (none for an index on this plan: such
      an alert waits);
    · the PRINTS — the name's recent option prints
      (flow-recent), every 15 s, for a flow alert;
    · the WIRE — the name's headlines, every minute,
      for a news alert (a headline UW marks major is the
      graded one; its sentiment reads neutral).

  ONE CALL AT A TIME: UW Basic answers three at once and
  the rooms' pages share the key, so the round walks the
  names in turn. A HIDDEN TAB KEEPS ASKING (prices and
  what the armed kinds need, nothing else): an alert
  rings with the tab hidden, so its market is read
  there too — the browser slows the timer, and a failed
  answer keeps the last good one (a price five minutes).
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import type { Candle } from '../../types/market';
import { noteRealPrice, REAL_PRICE_STALE_MS } from '../../components/gex/alertMarket';
import { feedBookOnce, isCashIndex, type FeedBook } from './levels';
import { isUnpriced, loadState } from './price';
import { uwFlowRecent, uwNewsHeadlines, uwOhlc } from './uw';

/** What one name's alerts read: which parts of the market to ask for */
export interface AlertNeeds {
  ticker: string;
  book: boolean;
  bars: boolean;
  prints: boolean;
  news: boolean;
}

export interface FeedAlertMarket {
  price: number | null;
  /** When the price was read */
  at: number;
  book: FeedBook | null;
  /** One-minute bars, oldest first — the session and the ones before it UW keeps */
  bars: Candle[];
  /** The name's option prints, newest first — `lean` +1 bullish (a call at the ask, a put on the bid), −1 bearish, 0 mid */
  prints: { at: number; premium: number; lean: 1 | -1 | 0 }[];
  news: { atMs: number; graded: boolean }[];
}

const PRICE_MS = 10_000;
const BOOK_MS = 30_000;
const BARS_MS = 60_000;
const PRINTS_MS = 15_000;
const NEWS_MS = 60_000;

const markets = new Map<string, FeedAlertMarket>();
const lastAsked = new Map<string, number>();
const due = (key: string, every: number, now: number) => now - (lastAsked.get(key) ?? 0) >= every;

const blank = (): FeedAlertMarket => ({ price: null, at: 0, book: null, bars: [], prints: [], news: [] });
const slot = (t: string): FeedAlertMarket => {
  let m = markets.get(t);
  if (!m) {
    m = blank();
    markets.set(t, m);
  }
  return m;
};

/** What the watcher reads for a name — null until its price has come, or when it went stale */
export function feedAlertMarket(ticker: string, now = Date.now()): FeedAlertMarket | null {
  const m = markets.get(ticker.toUpperCase());
  if (!m || m.price === null || now - m.at > REAL_PRICE_STALE_MS) return null;
  return m;
}

/** One round: every name's price when due, and the parts its alerts read when due — one call at a time */
async function round(needs: AlertNeeds[]): Promise<boolean> {
  let moved = false;
  for (const n of needs) {
    const t = n.ticker.toUpperCase();
    const m = slot(t);
    const now = Date.now();
    const index = isCashIndex(t) || isUnpriced(t);
    /* the book: an index's price, and the levels a name's alerts read */
    if ((n.book || index) && due(`book:${t}`, BOOK_MS, now)) {
      lastAsked.set(`book:${t}`, now);
      const b = await feedBookOnce(t);
      if (b) {
        m.book = b;
        moved = true;
        if (index) {
          m.price = b.spot;
          m.at = Date.now();
          noteRealPrice(t, b.spot);
        }
      }
    }
    if (!index && due(`price:${t}`, PRICE_MS, now)) {
      lastAsked.set(`price:${t}`, now);
      const r = await loadState(t);
      if (r.ok && r.data.close !== null) {
        m.price = r.data.close;
        m.at = Date.now();
        moved = true;
      }
    }
    if (n.bars && !index && due(`bars:${t}`, BARS_MS, now)) {
      lastAsked.set(`bars:${t}`, now);
      const r = await uwOhlc(t, { size: '1m', limit: 1000 });
      if (r.ok) {
        const out: Candle[] = [];
        for (const b of [...r.data].sort((a, z) => a.at - z.at)) {
          if (b.open === null || b.high === null || b.low === null || b.close === null) continue;
          const time = Math.floor(b.at / 60_000) * 60;
          if (out.length && out[out.length - 1].time >= time) continue;
          out.push({ time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume });
        }
        m.bars = out;
        moved = true;
      }
    }
    if (n.prints && !index && due(`prints:${t}`, PRINTS_MS, now)) {
      lastAsked.set(`prints:${t}`, now);
      const r = await uwFlowRecent(t);
      if (r.ok) {
        const seen = new Map<string, FeedAlertMarket['prints'][number]>();
        for (const p of m.prints) seen.set(`${p.at}-${p.premium}`, p);
        for (const p of r.data) {
          if (p.canceled) continue;
          /* the side as the vendor tags it — the house's sentimentOf on the print's own side */
          const side = p.tags.includes('ask_side') ? 1 : p.tags.includes('bid_side') ? -1 : 0;
          const lean = (side === 0 ? 0 : p.type === 'call' ? side : -side) as 1 | -1 | 0;
          seen.set(`${p.executedAt}-${p.premium}`, { at: p.executedAt, premium: p.premium, lean });
        }
        m.prints = [...seen.values()].sort((a, z) => z.at - a.at).slice(0, 500);
        moved = true;
      }
    }
    if (n.news && due(`news:${t}`, NEWS_MS, now)) {
      lastAsked.set(`news:${t}`, now);
      const r = await uwNewsHeadlines({ ticker: t, limit: 30 });
      if (r.ok) {
        m.news = r.data.filter(h => h.tickers.includes(t)).map(h => ({ atMs: h.createdAt, graded: h.isMajor || (h.sentiment !== '' && h.sentiment !== 'neutral') }));
        moved = true;
      }
    }
  }
  return moved;
}

/**
 * The alerts' market on the feed: while `on`, every name in `needs` is read in turn (a round every few seconds, each
 * part on its own clock). Returns a count that moves when an answer lands, for the watcher to judge again.
 */
export function useAlertFeed(on: boolean, needs: AlertNeeds[]): number {
  const [version, setVersion] = useState(0);
  const needsRef = useRef(needs);
  needsRef.current = needs;
  const sig = on ? needs.map(n => `${n.ticker}:${+n.book}${+n.bars}${+n.prints}${+n.news}`).join(',') : '';
  useEffect(() => {
    if (!sig) return;
    let alive = true;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const go = async () => {
      if (!alive || busy) return;
      busy = true;
      try {
        if (await round(needsRef.current)) setVersion(v => v + 1);
      } catch {
        /* a round that failed waits for the next */
      }
      busy = false;
      if (alive) timer = setTimeout(go, 2_000);
    };
    void go();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [sig]);
  return version;
}
