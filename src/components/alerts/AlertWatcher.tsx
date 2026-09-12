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
import { useMarketData } from '../../context/MarketDataContext';
import { exposureNowFor } from '../../data/gex';
import { newsPulse } from '../../data/news';
import { emaSeries, rsiSeries, vwapSeries } from '../../data/indicators';
import { aggregateCandles, tfMinutes, type Timeframe } from '../../data/timeframe';
import { builtinScripts } from '../../data/builtinScripts';
import { scriptStore } from '../../data/scriptStore';
import { compile, run as runScript, type Compiled } from '../../core/pine';
import { SCRIPT_CAPS } from '../../types/scripts';
import { commitArm, evaluateAlert, markFired, scriptBarCounts, useAllAlerts, type Alert, type AlertContext, type IndicatorSource, type ScriptAlert } from '../gex/alertStore';

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
const barsFor = (ticker: string, tf: string) => {
  const mins = tfMinutes(tf as Timeframe);
  return mins < 1 ? Simulator.getSecondsBars(ticker) : aggregateCandles(Simulator.getCandles(ticker) ?? [], mins);
};

const AlertWatcher = () => {
  /* `marketData` changes on every tick — the watcher's clock */
  const { marketData, flowTape } = useMarketData();
  const names = useAllAlerts();
  /* bumped when a fetched script has compiled, so its alert is judged now, not next tick */
  const [, setPoke] = useState(0);

  useEffect(() => {
    const now = Date.now();
    const poke = () => setPoke(p => p + 1);
    for (const { ticker, alerts } of names) {
      const waiting = alerts.filter(a => !a.firedAt);
      if (waiting.length === 0) continue;
      /* A name with an alert is a name the terminal carries — registered
         if it was not, seeded in idle time; until then its price is unknown
         and the alert waits. */
      const sym = Simulator.ensureTicker(ticker);
      const cfg = Simulator.TICKERS[sym];
      if (!cfg || !Simulator.isSeeded(sym)) continue;
      const close = cfg.currentPrice;

      const needsBook = waiting.some(a => a.kind === 'level' || a.kind === 'gexflip' || a.kind === 'newsupreme' || a.kind === 'wallmove' || a.kind === 'script');
      const exp = needsBook ? exposureNowFor(sym) : null;

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
          markFired(sym, a.id, now);
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
        prints: waiting.some(a => a.kind === 'flow') ? flowTape.filter(p => p.ticker === sym).map(p => ({ at: p.at, premium: p.premium })) : [],
        news: waiting.some(a => a.kind === 'news') ? newsPulse(sym) : [],
      };

      const judge = (a: Alert, ctx: AlertContext) => {
        const verdict = evaluateAlert(a, ctx);
        if (verdict.fire) markFired(sym, a.id, now);
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
    }
  }, [names, marketData, flowTape]);

  return null;
};

export default AlertWatcher;
