/*
==================================================
  SLAYER TERMINAL - THE LEVEL ALERTS' WATCHER
  (components/alerts/LevelAlertWatcher.tsx)

  The owner's item 7 (2026-10-14): the tiered engine
  (data/levelAlerts.ts) stepped a minute at a time for
  every name with a level watched, on whatever page is
  open. On the feed it reads what the alerts' watcher
  reads (data/feed/alertFeed.ts — the book's walls,
  flip and heaviest strikes, the minutes, the price; the
  same calls, shared), the day's ±σ off the priced move
  (/feed/field/<NAME>/move) and, for the alert's line,
  the regime's percentile (the recorder's newest shown
  row against regime.json) and the level type's track
  record (scorecard.json). Off the feed, the house's
  book and minutes.

  DELIVERY: Tier 1 chimes, is said aloud when that
  switch is on, and while the tab is hidden shows on the
  machine (Settings' switch) under a tag stable per level
  — "SPY-flip", "SPY-callwall" — so a repeat replaces the
  last instead of stacking. Tier 2 is a chip in the
  notices' column; Tier 3 the log alone. Web push waits
  on the owner.
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import Simulator from '../../core/simulator';
import { onMarketTick } from '../../context/marketStore';
import { exposureNowFor } from '../../data/gex';
import { isUp, useFeedStatus } from '../../data/feed/status';
import { feedAlertMarket, useAlertFeed, type AlertNeeds } from '../../data/feed/alertFeed';
import { feedFetch, type FeedResult } from '../../data/feed/client';
import { clock, nyIsoDate, nyMinutes } from '../../core/nyTime';
import { regimeBucketOf, regimeBucketsFor, regimePercentile, type RegimeReference } from '../../data/feed/trailModel';
import { LevelAlertEngine, noteLevelEvents, useLevelWatches, type LevelBar, type LevelEvent, type LevelInputs, type LevelId, type TierCap } from '../../data/levelAlerts';
import { chime } from '../../core/sound';
import { flashAlert } from '../../brand/markState';
import { notifyIfHidden, speak } from '../layout/shellPrefs';

/* ---- what rides on an alert: the day's ±σ, the regime's percentile, the track record's line (cached a name) ---- */
type Extras = { day: string; sigma: { prevClose: number; s: number } | null; regime: RegimeReference | null; record: Record<string, string>; net: { m: number; net: number } | null; asked: Record<string, number> };
const extras = new Map<string, Extras>();
const RECORD_KEY: Partial<Record<LevelId, string>> = { flip: 'flip', callWall: 'call wall', putWall: 'put wall', top3: 'top strike' };
async function refreshExtras(t: string, now: number): Promise<void> {
  const day = nyIsoDate(now);
  let x = extras.get(t);
  if (!x || x.day !== day) extras.set(t, (x = { day, sigma: null, regime: null, record: {}, net: null, asked: {} }));
  const due = (k: string, every: number) => {
    if (now - (x!.asked[k] ?? 0) < every) return false;
    x!.asked[k] = now;
    return true;
  };
  const get = async <T,>(url: string): Promise<T | null> => {
    const r = (await feedFetch(url)) as FeedResult<T>;
    return r.ok ? r.data : null;
  };
  if (due('move', 10 * 60_000)) {
    const m = await get<{ budget: { prevClose: number; today: { sigma: number } | null } | null }>(`/feed/field/${t}/move?day=${day}`);
    if (m?.budget?.today) x.sigma = { prevClose: m.budget.prevClose, s: m.budget.today.sigma };
  }
  if (due('regime', 60 * 60_000)) x.regime = await get<RegimeReference>(`/feed/field/${t}/regime`);
  if (due('record', 60 * 60_000)) {
    const c = await get<{ lines?: Record<string, string> }>(`/feed/field/${t}/scorecard`);
    if (c?.lines) x.record = c.lines;
  }
  if (due('net', 60_000)) {
    const r = await get<{ rows: { m: number; net: number }[] }>(`/feed/field/${t}/store?day=${day}&kind=shown&since=${x.net?.m ?? 0}`);
    const last = r?.rows?.[r.rows.length - 1];
    if (last) x.net = { m: last.m, net: last.net };
  }
}
/** The regime's percentile at the newest shown minute, or null */
function regimePctOf(t: string): number | null {
  const x = extras.get(t);
  if (!x?.regime || !x.net) return null;
  const qs = regimeBucketsFor(x.regime, x.day);
  const b = regimeBucketOf(nyMinutes(x.net.m));
  const q = qs && b != null ? qs[b] : null;
  return q ? regimePercentile(x.net.net, q) : null;
}

const LevelAlertWatcher = () => {
  const watches = useLevelWatches();
  const [tick, setTick] = useState(0);
  useEffect(() => onMarketTick(() => setTick(t => t + 1)), []);
  const feedOn = isUp(useFeedStatus(), 'uw');
  const names = Object.keys(watches);
  const needs: AlertNeeds[] = feedOn ? names.map(ticker => ({ ticker, book: true, bars: true, prints: false, news: false })) : [];
  const fed = useAlertFeed(feedOn, needs);

  /* one engine a name, rebuilt when its watch changes; one cap for every name (the owner: a global cap) */
  const engines = useRef(new Map<string, { sig: string; e: LevelAlertEngine; fedClosed: number; forming: { time: number; high: number; low: number } | null }>());
  const cap = useRef<TierCap>({ at: [] });

  useEffect(() => {
    const now = Date.now();
    for (const t of names) {
      const w = watches[t];
      const sig = `${w.ids.join(',')}|${w.confirmBars}|${feedOn ? 'feed' : 'house'}`;
      let slot = engines.current.get(t);
      if (!slot || slot.sig !== sig) {
        slot = { sig, e: new LevelAlertEngine(t, w.ids, { confirmBars: w.confirmBars }, cap.current), fedClosed: 0, forming: null };
        engines.current.set(t, slot);
      }
      let price: number;
      let priceAt: number;
      let levels: LevelInputs;
      let closed: LevelBar[];
      let bookAt = now;
      if (feedOn) {
        void refreshExtras(t, now);
        const m = feedAlertMarket(t, now);
        if (!m || m.price === null || !m.book) continue;
        price = m.price;
        priceAt = m.at;
        const b = m.book;
        bookAt = b.at;
        const real = (v: number) => (Number.isFinite(v) ? v : null);
        levels = {
          flip: real(b.levels.flip),
          callWall: real(b.levels.callWall),
          putWall: real(b.levels.putWall),
          top: [...b.rows].sort((a, z) => Math.abs(z.gex.net) - Math.abs(a.gex.net)).slice(0, 3).map(r => r.strike),
          step: b.step,
          sigma: extras.get(t)?.sigma ?? null,
          valueAt: (() => {
            const m = new Map(b.rows.map(r => [r.strike, r.gex.net] as [number, number]));
            return (k: number) => m.get(k) ?? NaN;
          })(),
        };
        closed = m.bars.filter(x => x.time + 60 <= now / 1000).map(x => ({ time: x.time, high: x.high, low: x.low, close: x.close, closed: true }));
      } else {
        const sym = Simulator.ensureTicker(t);
        const cfg = Simulator.TICKERS[sym];
        if (!cfg || !Simulator.isSeeded(sym)) continue;
        price = cfg.currentPrice;
        priceAt = now;
        const ex = exposureNowFor(sym);
        if (!ex) continue;
        const snaps = Simulator.getGexHistory(sym);
        const latest = snaps?.[snaps.length - 1];
        levels = {
          flip: ex.flip,
          callWall: ex.callWall,
          putWall: ex.putWall,
          top: latest ? [...latest.levels].sort((a, z) => Math.abs(z.value) - Math.abs(a.value)).slice(0, 3).map(l => l.strike) : [],
          step: ex.step,
          sigma: null,
          valueAt: (() => {
            const m = new Map((latest?.levels ?? []).map(l => [l.strike, l.value] as [number, number]));
            return (k: number) => m.get(k) ?? NaN;
          })(),
        };
        closed = (Simulator.getCandles(sym) ?? []).filter(x => x.time + 60 <= now / 1000).slice(-30).map(x => ({ time: x.time, high: x.high, low: x.low, close: x.close, closed: true }));
      }
      /* the inputs' age: the price's and the book's, the older */
      const age = Math.max(0, now - priceAt, now - bookAt);
      const events: LevelEvent[] = [];
      /* the minutes closed since the last fed, then the one forming (its range from the ticks seen) */
      for (const b of closed) {
        if (b.time <= slot.fedClosed) continue;
        if (slot.fedClosed === 0 && b.time < now / 1000 - 5 * 60) continue;
        events.push(...slot.e.observe(b, levels, now, age));
        slot.fedClosed = b.time;
      }
      const minute = Math.floor(now / 60_000) * 60;
      const f = slot.forming && slot.forming.time === minute ? slot.forming : (slot.forming = { time: minute, high: price, low: price });
      f.high = Math.max(f.high, price);
      f.low = Math.min(f.low, price);
      events.push(...slot.e.observe({ time: minute, high: f.high, low: f.low, close: price, closed: false }, levels, now, age));
      if (!events.length) continue;
      const pct = regimePctOf(t);
      const record = extras.get(t)?.record ?? {};
      const enriched = events.map(e => ({ ...e, regimePct: pct, record: (RECORD_KEY[e.level] && record[RECORD_KEY[e.level]!]) || null }));
      noteLevelEvents(enriched);
      const loud = enriched.filter(e => e.tier === 1);
      if (loud.length) {
        chime();
        flashAlert();
        const e = loud[0];
        speak(e.words);
        notifyIfHidden(e.words, `at ${clock(e.at, { seconds: true, zone: true })} · Slayer Terminal`, e.tag);
      }
    }
    for (const t of [...engines.current.keys()]) if (!watches[t]) engines.current.delete(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, fed, watches, feedOn]);
  return null;
};

export default LevelAlertWatcher;
