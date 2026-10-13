/*
==================================================
  SLAYER TERMINAL - THE SHELL'S WATCHER (components/alerts/AlertWatcher.tsx)

  HEAR IT EVERYWHERE (the alerts rule, Noah,
  2026-09-10: "how do the alerts work for the map on
  terrain, pulse and other pages"): until now an
  alert was evaluated only while something on
  screen watched its name — a mounted chart, or the
  Pinpoint shell for the subject. Arm QQQ on a
  Terrain pane, walk to the Record, and QQQ waited
  in silence. This runs in the app shell, on every
  tick, over EVERY name that holds an alert, from
  the same feeds the charts read: the name's price,
  its book (walls, flip, supreme, net exposure), its
  bars on the alert's own timeframe for the
  indicator kinds, the tape and the wire. The charts
  keep watching too; the store's firing is
  idempotent, so two readings of one crossing
  change nothing. Renders nothing.
==================================================
*/

import { useEffect, useState } from 'react';
import Simulator from '../../core/simulator';
import { marketStore, onMarketTick } from '../../context/marketStore';
import { exposureNowFor } from '../../data/gex';
import { newsPulse } from '../../data/news';
import { emaSeries, rsiSeries, vwapSeries } from '../../data/indicators';
import { aggregateCandles, tfMinutes, type Timeframe } from '../../data/timeframe';
import { builtinScripts } from '../../data/builtinScripts';
import { scriptStore } from '../../data/scriptStore';
import { compile, run as runScript, type Compiled } from '../../core/pine';
import { SCRIPT_CAPS } from '../../types/scripts';
import {
  commitArm, evaluateAlert, evaluateAll, evaluateLine, expireDue, markFired, resideAlert, scriptBarCounts, useAllAlerts,
  type Alert, type AlertContext, type AllContext, type IndicatorSource, type ScriptAlert,
} from '../gex/alertStore';
import { sentimentOf } from '../../data/tape';
import { isUp, useFeedStatus } from '../../data/feed/status';
import { feedAlertMarket, useAlertFeed, type AlertNeeds } from '../../data/feed/alertFeed';
import { setAlertMarket } from '../gex/alertMarket';
import type { Candle } from '../../types/market';

/* THE SCRIPTS' OWN CONDITIONS (2026-09-10, Noah: "wire the script alerts into
   the bell"). A script alert is judged by running the script the way its
   pane does — over the name's bars on the timeframe it was armed on, with
   the placement's inputs, the book in `slayer.*` — and reading the
   condition's flag on the last bar. The compiled script is cached by id;
   a built-in compiles at once, one of the reader's own is fetched from the
   store and judged from the next tick. A script that does not compile is
   remembered as null and left alone. */
const compiledById = new Map<string, Compiled | null>();
const fetching = new Set<string>();
const compileOf = (scriptId: string, poke: () => void): Compiled | null | undefined => {
  if (compiledById.has(scriptId)) return compiledById.get(scriptId);
  const builtin = builtinScripts().find(s => s.id === scriptId);
  if (builtin) {
    try {
      compiledById.set(scriptId, compile(builtin.source));
    } catch {
      compiledById.set(scriptId, null);
    }
    return compiledById.get(scriptId);
  }
  if (!fetching.has(scriptId)) {
    fetching.add(scriptId);
    void scriptStore.get(scriptId).then(s => {
      try {
        compiledById.set(scriptId, s ? compile(s.source) : null);
      } catch {
        compiledById.set(scriptId, null);
      }
      fetching.delete(scriptId);
      poke();
    });
  }
  return undefined;
};

/** A saved script changed under an alert — forget its compile so the next tick re-reads it */
export const forgetCompiled = (scriptId: string): void => {
  compiledById.delete(scriptId);
};

/** The last real value of a series, or null while it cannot be read */
const last = (pts: readonly (number | null)[]): number | null => {
  const p = pts[pts.length - 1];
  return typeof p === 'number' && Number.isFinite(p) ? p : null;
};

/** The name's bars on a timeframe — what a chart on that timeframe would draw */
const houseBarsFor = (ticker: string, tf: string) => {
  const mins = tfMinutes(tf as Timeframe);
  return mins < 1 ? Simulator.getSecondsBars(ticker) : aggregateCandles(Simulator.getCandles(ticker) ?? [], mins);
};
/** The feed's one-minute bars on a timeframe — no seconds on this plan, so a seconds alert reads none and waits */
const feedBarsOn = (bars: Candle[], tf: string): Candle[] => {
  const mins = tfMinutes(tf as Timeframe);
  return mins < 1 ? [] : aggregateCandles(bars, mins);
};

/* What each kind reads off the market — which parts of the feed a name's alerts ask for */
const READS_BOOK = new Set<Alert['kind']>(['level', 'gexflip', 'newsupreme', 'wallmove', 'script', 'all']);
const READS_BARS = new Set<Alert['kind']>(['indicator', 'script', 'line', 'all']);

const AlertWatcher = () => {
  /* THE WATCHER'S CLOCK IS THE TICK ITSELF (context/marketStore.ts onMarketTick) — heard as it lands, a hidden tab
     included: the page's readers are told once a frame, and a hidden tab has no frames, but an alert still rings */
  const [tick, setTick] = useState(0);
  useEffect(() => onMarketTick(() => setTick(t => t + 1)), []);
  const names = useAllAlerts();
  /* bumped when a fetched script has compiled, so its alert is judged now, not next tick */
  const [poked, setPoke] = useState(0);

  /* ALERTS WATCH THE REAL PRICE (2026-10-12): while UW answers, every alert is judged on the market's own figures
     (data/feed/alertFeed.ts) and never on the house's simulator; with UW down, on the house's as before */
  const feedOn = isUp(useFeedStatus(), 'uw');
  useEffect(() => setAlertMarket(feedOn ? 'feed' : 'house'), [feedOn]);
  const needs: AlertNeeds[] = [];
  if (feedOn)
    for (const { ticker, alerts } of names) {
      const live = alerts.filter(a => !a.firedAt || a.reside || (a.quietUntil ?? 0) > 0);
      if (live.length === 0) continue;
      needs.push({
        ticker,
        book: live.some(a => READS_BOOK.has(a.kind)),
        bars: live.some(a => READS_BARS.has(a.kind)),
        prints: live.some(a => a.kind === 'flow' || (a.kind === 'all' && a.conds.some(c => c.t === 'flow'))),
        news: live.some(a => a.kind === 'news'),
      });
    }
  const fed = useAlertFeed(feedOn, needs);

  useEffect(() => {
    const now = Date.now();
    const poke = () => setPoke(p => p + 1);
    const flowTape = marketStore.latest().tape;
    for (const { ticker, alerts } of names) {
      /* THE LIFECYCLE (2026-10-09): an alert whose end has come goes; one whose rest is over goes back on watch from
         where the market stands now (a snooze, a repeat's quiet) — and is judged from the next tick, not this one */
      if (alerts.some(a => a.expiresAt && a.expiresAt <= now && !a.firedAt) && expireDue(ticker, now) > 0) continue;
      const resting = alerts.filter(a => !a.firedAt && (a.reside || (a.quietUntil ?? 0) > now));
      const waiting = alerts.filter(a => !a.firedAt && !resting.includes(a));
      if (waiting.length === 0 && resting.length === 0) continue;
      /* THE MARKET IT IS JUDGED ON: the feed's while UW answers — its price, book, bars, prints and wire (a name whose
         price has not come yet waits; nothing of the house's stands in) — else the house's. A name with an alert is a
         name the terminal carries — registered if it was not, seeded in idle time; until then its price is unknown and
         the alert waits. */
      let sym: string;
      let close: number;
      let exp: { callWall: number | null; putWall: number | null; flip: number | null; supreme: number | null; netGex: number; step: number } | null = null;
      let barsFor: (s: string, tf: string) => Candle[];
      let feedPrints: { at: number; premium: number; lean: 1 | -1 | 0 }[] | null = null;
      let feedNews: { atMs: number; graded: boolean }[] | null = null;
      if (feedOn) {
        const m = feedAlertMarket(ticker, now);
        if (!m || m.price === null) continue;
        sym = ticker;
        close = m.price;
        const b = m.book;
        const real = (v: number) => (Number.isFinite(v) ? v : null);
        exp = b ? { callWall: real(b.levels.callWall), putWall: real(b.levels.putWall), flip: real(b.levels.flip), supreme: real(b.levels.supreme), netGex: b.netGex, step: b.step } : null;
        barsFor = (_s, tf) => feedBarsOn(m.bars, tf);
        feedPrints = m.prints;
        feedNews = m.news;
      } else {
        sym = Simulator.ensureTicker(ticker);
        const cfg = Simulator.TICKERS[sym];
        if (!cfg || !Simulator.isSeeded(sym)) continue;
        close = cfg.currentPrice;
        const needsBook = waiting.some(a => READS_BOOK.has(a.kind));
        exp = needsBook ? exposureNowFor(sym) : null;
        barsFor = houseBarsFor;
      }
      for (const a of resting) if ((a.quietUntil ?? 0) <= now) resideAlert(sym, a.id, close, now);
      if (waiting.length === 0) continue;

      /* THE SCRIPTS: one run per script · timeframe · inputs, every condition
         armed on it read off that run's last bar */
      const scripts = waiting.filter((a): a is ScriptAlert => a.kind === 'script');
      const runs = new Map<string, ScriptAlert[]>();
      for (const a of scripts) {
        const key = `${a.scriptId}|${a.tf}|${JSON.stringify(a.inputs)}`;
        (runs.get(key) ?? runs.set(key, []).get(key)!).push(a);
      }
      for (const group of runs.values()) {
        const head = group[0];
        const compiled = compileOf(head.scriptId, poke);
        if (!compiled) continue;
        const bars = barsFor(sym, head.tf);
        if (bars.length === 0) continue;
        let result;
        try {
          result = runScript(compiled, bars, {
            inputs: head.inputs,
            ticker: sym,
            timeframe: head.tf,
            budgetMs: SCRIPT_CAPS.budgetMs,
            slayer: exp ? { callWall: exp.callWall ?? undefined, putWall: exp.putWall ?? undefined, flip: exp.flip ?? undefined, supreme: exp.supreme ?? undefined } : undefined,
          });
        } catch {
          continue;
        }
        const i = bars.length - 1;
        for (const a of group) {
          const out = result.alerts.find(x => x.id === a.conditionId);
          if (!out || out.fired[i] !== 1 || !scriptBarCounts(a, bars[i].time)) continue;
          /* the bar it fired on is remembered before the firing, so a re-arm
             on the same bar does not ring twice */
          commitArm(sym, { ...a, lastBar: bars[i].time });
          markFired(sym, a.id, now, undefined, close);
        }
      }
      const base: Omit<AlertContext, 'tf' | 'values'> = {
        close,
        levels: {
          callWall: exp?.callWall ?? null,
          putWall: exp?.putWall ?? null,
          flip: exp?.flip ?? null,
          supreme: exp?.supreme ?? null,
        },
        netGex: exp ? exp.netGex : null,
        step: exp?.step ?? 0,
        prints: waiting.some(a => a.kind === 'flow') ? feedPrints ?? flowTape.filter(p => p.ticker === sym).map(p => ({ at: p.at, premium: p.premium })) : [],
        news: waiting.some(a => a.kind === 'news') ? feedNews ?? newsPulse(sym) : [],
      };

      /* the figure it fired at — the level, the line it crossed — so the log and the spoken line can name it */
      const valueOf = (a: Alert, ctx: AlertContext): number | undefined =>
        a.kind === 'level' ? (ctx.levels[a.level] ?? undefined)
        : a.kind === 'newsupreme' ? (ctx.levels.supreme ?? undefined)
        : a.kind === 'indicator' ? (a.source === 'rsi' ? undefined : (ctx.values[a.source] ?? undefined))
        : undefined;
      const judge = (a: Alert, ctx: AlertContext) => {
        const verdict = evaluateAlert(a, ctx);
        if (verdict.fire) markFired(sym, a.id, now, valueOf(a, ctx), close);
        else if (verdict.armed) commitArm(sym, verdict.armed);
      };

      /* Everything but the indicator and script kinds reads one context */
      const plain: AlertContext = { ...base, tf: '', values: {} };
      for (const a of waiting) if (a.kind !== 'indicator' && a.kind !== 'script') judge(a, plain);

      /* The indicator kinds read the bars of THEIR timeframe — one context
         per timeframe armed, each value computed once */
      const byTf = new Map<string, Alert[]>();
      for (const a of waiting) if (a.kind === 'indicator') (byTf.get(a.tf) ?? byTf.set(a.tf, []).get(a.tf)!).push(a);
      for (const [tf, group] of byTf) {
        const bars = barsFor(sym, tf);
        const mins = tfMinutes(tf as Timeframe);
        const values: Partial<Record<IndicatorSource, number | null>> = {};
        for (const a of group) {
          if (a.kind !== 'indicator' || a.source in values) continue;
          values[a.source] =
            a.source === 'vwap' ? last(vwapSeries(bars, mins))
            : a.source === 'rsi' ? last(rsiSeries(bars, 14))
            : last(emaSeries(bars, a.source === 'ema9' ? 9 : a.source === 'ema21' ? 21 : 50));
        }
        const ctx: AlertContext = { ...base, tf, values };
        for (const a of group) judge(a, ctx);
      }

      /* A DRAWN LINE (2026-10-10) reads the bars of the pane it was drawn on — touch on the live price, a break or a bounce
         on the bar that closed; the bar it fired on is remembered first, so it never rings twice on one bar */
      for (const a of waiting) {
        if (a.kind !== 'line') continue;
        const bars = barsFor(sym, a.tf);
        const v = evaluateLine(a, bars, close, now);
        if (v.fire) {
          if (v.bar != null) commitArm(sym, { ...a, lastBar: v.bar });
          /* a level line names its price in its words; a trend line's firing says where price was */
          markFired(sym, a.id, now, a.shape === 'sloped' ? close : undefined, close);
        } else if (v.armed) commitArm(sym, v.armed);
      }

      /* CONDITIONS TOGETHER (2026-10-10): every average and RSI asked, on its own timeframe, and the name's net flow over
         each window asked — bullish premium less bearish, off the tape */
      const ands = waiting.filter(a => a.kind === 'all');
      if (ands.length) {
        const values: AllContext['values'] = {};
        const flowNet: AllContext['flowNet'] = {};
        for (const a of ands) {
          if (a.kind !== 'all') continue;
          for (const c of a.conds) {
            if (c.t === 'average' || c.t === 'rsi') {
              const src: IndicatorSource = c.t === 'rsi' ? 'rsi' : c.source;
              const row = (values[c.tf] ??= {});
              if (src in row) continue;
              const bars = barsFor(sym, c.tf);
              row[src] =
                src === 'vwap' ? last(vwapSeries(bars, tfMinutes(c.tf as Timeframe)))
                : src === 'rsi' ? last(rsiSeries(bars, 14))
                : last(emaSeries(bars, src === 'ema9' ? 9 : src === 'ema21' ? 21 : 50));
            } else if (c.t === 'flow' && !(c.mins in flowNet)) {
              const since = now - c.mins * 60_000;
              let net = 0;
              /* on the feed, the name's own prints, each leaning as the house reads a side */
              if (feedPrints) {
                for (const p of feedPrints) if (p.at >= since) net += p.lean * p.premium;
                flowNet[c.mins] = net;
                continue;
              }
              for (const p of flowTape) {
                if (p.ticker !== sym || p.at < since) continue;
                const s = sentimentOf(p);
                net += s === 'BULLISH' ? p.premium : s === 'BEARISH' ? -p.premium : 0;
              }
              flowNet[c.mins] = net;
            }
          }
        }
        const allCtx: AllContext = { close, levels: base.levels, netGex: base.netGex, values, flowNet };
        for (const a of ands) {
          if (a.kind !== 'all') continue;
          const v = evaluateAll(a, allCtx, now);
          if (v.fire) markFired(sym, a.id, now, undefined, close);
          else if (v.armed) commitArm(sym, v.armed);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names, tick, poked, fed, feedOn]);

  return null;
};

export default AlertWatcher;
