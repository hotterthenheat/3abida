/*
==================================================
  SLAYER TERMINAL - TIERED LEVEL ALERTS (data/levelAlerts.ts)

  THE OWNER'S ITEM 7 (2026-10-14): "client-side alert
  engine on the per-minute data … Tier 1 (sound + push):
  spot crosses the flip and the 1-min bar closes beyond
  it (N confirmation bars, default 1, configurable); spot
  touches the call or put wall after that wall has
  existed >= 15 min. Tier 2 (in-app toast): wall moves
  >= 2 strikes; a new top-3 strike appears; spot touches
  +/-1 or +/-2 sigma_day. Tier 3: log only. Cooldown: per
  level, at most once per bar; re-arm only after price
  moves >= d away (default 0.5 x strike spacing). Global
  cap: <= 3 Tier-1 alerts per 15 min. Follow the level …
  Stale guard: if data age > 2 min at trigger, Tier 1
  drops to Tier 2, tagged 'stale'." Web push is held
  (the owner: "Hold this until I decide; build the
  in-app tiers first") — Tier 1 is the chime, the voice
  when it is on, and the machine's own notification
  while the tab is hidden, its tag stable per level so a
  repeat replaces the last.

  THE FLIP MOVED DOWN A TIER (the owner, 2026-10-14, on
  the replay of the ten busiest sessions — the flip was
  the loudest trigger by far, 21.9 crosses a session at
  one closed minute: "make a flip cross Tier 2 with 3
  closed-minute confirmation (default). Tier 1 = wall
  touches only"): a cross is a Tier-2 notice once three
  minutes in a row have closed beyond the flip (1 to 5,
  the reader's pick, 3 by default), and Tier 1 — the
  chime, the global cap and the stale guard — is a wall
  touch alone. THE HEAVY STRIKES MOVED DOWN TOO (the
  owner, the same day, of the replay's 371 Tier-2
  notices in ten sessions, 178 of them a new top-3
  strike: "Move 'new top-3' to Tier 3 (log only). Keep
  wall moves and flip crosses at Tier 2"): a strike
  entering the three heaviest is written to the log and
  never shown as a chip.

  PURE: the shell's watcher (components/alerts/
  LevelAlertWatcher.tsx) and the proofs step the same
  engine, a minute bar at a time; a replay steps it on
  the minutes up to its cursor into a log of its own.

  A wall is FOLLOWED by its identity (the call wall, the
  put wall), never a fixed price: its strike changes
  once a new one has held three minutes (as the field's
  wall chips count it), which re-keys the watch — a move
  of two strikes or more is a Tier-2 notice, a smaller
  one a Tier-3 line. The flip is the book's own each
  minute. A touch is the minute's range reaching the
  level within 0.02% of price (the track record's
  tolerance, server/scorecard.config.json).

  Never a call to trade: the words say what the price
  did at a level, nothing about what to do.
==================================================
*/

import { useSyncExternalStore } from 'react';

/** The levels a name's watch may follow */
export type LevelId = 'flip' | 'callWall' | 'putWall' | 'top3' | 'sigma';
export const LEVEL_IDS: readonly LevelId[] = ['flip', 'callWall', 'putWall', 'top3', 'sigma'];
export const LEVEL_NAMES: Record<LevelId, string> = { flip: 'the flip', callWall: 'the call wall', putWall: 'the put wall', top3: 'the three heaviest strikes', sigma: 'the ±1σ and ±2σ levels' };

export type LevelEventKind = 'flip-cross' | 'wall-touch' | 'wall-move' | 'wall-rekey' | 'new-top3' | 'sigma-touch';

/** One minute of the market as the engine reads it */
export interface LevelBar {
  /** The minute's start, epoch seconds */
  time: number;
  high: number;
  low: number;
  close: number;
  /** The minute is over (its close is final) — a forming minute's touches count, its close does not confirm */
  closed: boolean;
}
/** The levels at that minute — the book's (the ladder's), real nulls where it names none */
export interface LevelInputs {
  flip: number | null;
  callWall: number | null;
  putWall: number | null;
  /** The three heaviest strikes by size, heaviest first */
  top: number[];
  /** The book's strike step near the price */
  step: number;
  /** The day's budget priced at the prior close (data/feed/pricedMove.ts): the close it stands on and 1σ in dollars */
  sigma: { prevClose: number; s: number } | null;
  /** The book's net at a strike (the house's sign; NaN where the book holds none) — the walls' 10% rule reads it (the
      owner, 2026-10-14: "Keep the 10% / 3-minute rule for real size changes … Move the scorecard and alerts to this
      definition"). Absent, a new wall needs only its minutes. */
  valueAt?: (strike: number) => number;
}

export interface LevelAlertCfg {
  /** Closed one-minute bars beyond the flip before a cross is called (3 by default — the owner, 2026-10-14) */
  confirmBars: number;
  /** Minutes a wall must have stood before a touch rings Tier 1 */
  wallAgeMin: number;
  /** Strikes a wall must move to be a Tier-2 notice */
  moveStrikes: number;
  /** A level re-arms once price has moved this share of a strike step away from it */
  rearmFrac: number;
  /** Tier-1 alerts at most in the window (a name's) */
  tier1Cap: number;
  capWindowMin: number;
  /** Inputs older than this at the trigger drop Tier 1 to Tier 2 */
  staleMs: number;
  /** Minutes a new wall strike or a new top-3 strike must hold before it counts */
  holdMin: number;
  /** A touch: within this share of price */
  touchTol: number;
  /** A new wall strike must beat the held one's |gamma| by this in every minute it counts (trailModel WALL_STICK) */
  wallBeat: number;
}
export const LEVEL_ALERT_DEFAULTS: LevelAlertCfg = { confirmBars: 3, wallAgeMin: 15, moveStrikes: 2, rearmFrac: 0.5, tier1Cap: 3, capWindowMin: 15, staleMs: 120_000, holdMin: 3, touchTol: 0.0002, wallBeat: 1.1 };

export interface LevelEvent {
  /** Unique: ticker, kind, level and the minute */
  key: string;
  /** Stable per level and name ("SPY-flip", "SPY-callwall") — a notification with it replaces the last */
  tag: string;
  ticker: string;
  tier: 1 | 2 | 3;
  level: LevelId;
  kind: LevelEventKind;
  /** The level's price when it fired */
  price: number;
  /** The price then */
  spot: number;
  /** When (epoch ms) and the minute it belongs to (epoch s) */
  at: number;
  bar: number;
  /** The inputs' age at the trigger, ms */
  age: number;
  /** Tier 1 (a wall touch) dropped to Tier 2: the inputs were older than two minutes / the window's Tier-1 cap was
      reached */
  stale: boolean;
  capped: boolean;
  /** A cross's or a touch's direction: 'up' through or into from below, 'down' from above */
  side?: 'up' | 'down';
  /** A wall's move */
  from?: number;
  to?: number;
  words: string;
  /** Filled by the host: the regime's percentile then and the level type's track-record line */
  regimePct?: number | null;
  record?: string | null;
  /** A replay's event, written to the replay log */
  replay?: boolean;
}

const fmt = (k: number) => (Math.abs(k % 1) < 1e-9 ? k.toFixed(0) : k.toFixed(2));
const tagOf = (t: string, level: LevelId, sub = '') => `${t}-${level === 'callWall' ? 'callwall' : level === 'putWall' ? 'putwall' : level}${sub}`;

interface WallTrack {
  strike: number | null;
  since: number;
  cand: number | null;
  candSince: number;
  /** Closed minutes the candidate has held, and the last one counted (a minute is observed forming and closed) */
  run: number;
  counted: number;
}
/** The Tier-1 cap's moments — one object shared by every name's engine makes the cap global */
export interface TierCap {
  at: number[];
}

/**
 * One name's engine. `observe` takes each minute as it forms and once it closes; it returns the events that minute
 * raised. State is the engine's own — a host keeps one per name and per log (live, replay).
 */
export class LevelAlertEngine {
  readonly ticker: string;
  readonly watch: Set<LevelId>;
  readonly cfg: LevelAlertCfg;
  private flipSide: 1 | -1 | 0 = 0;
  private flipRun = 0;
  private walls: Record<'callWall' | 'putWall', WallTrack> = {
    callWall: { strike: null, since: 0, cand: null, candSince: 0, run: 0, counted: -1 },
    putWall: { strike: null, since: 0, cand: null, candSince: 0, run: 0, counted: -1 },
  };
  private top: number[] | null = null;
  private topCand = new Map<number, { run: number; counted: number }>();
  /** The last minute each level fired in, and where price must get to (after that minute) before it fires again */
  private firedBar = new Map<string, number>();
  private rearm = new Map<string, { price: number; d: number; bar: number }>();
  private cap: TierCap;
  private lastClosed = -1;

  constructor(ticker: string, watch: Iterable<LevelId>, cfg: Partial<LevelAlertCfg> = {}, cap: TierCap = { at: [] }) {
    this.ticker = ticker.toUpperCase();
    this.watch = new Set(watch);
    this.cfg = { ...LEVEL_ALERT_DEFAULTS, ...cfg };
    this.cap = cap;
  }

  /** One minute: its range so far and, once closed, its close. `age` is the inputs' age (ms) at `now` */
  observe(bar: LevelBar, lv: LevelInputs, now: number, age: number): LevelEvent[] {
    const out: LevelEvent[] = [];
    const tol = this.cfg.touchTol * bar.close;
    const d = this.cfg.rearmFrac * (lv.step > 0 ? lv.step : 1);
    const t = this.ticker;
    const free = (k: string) => {
      const r = this.rearm.get(k);
      /* re-armed once price, in a minute after the firing, has moved d away from where the level stood then */
      if (r && bar.time > r.bar && Math.max(Math.abs(bar.high - r.price), Math.abs(bar.low - r.price)) >= r.d) this.rearm.delete(k);
      return !this.rearm.has(k) && this.firedBar.get(k) !== bar.time;
    };
    const emit = (k: string, e: Omit<LevelEvent, 'key' | 'ticker' | 'at' | 'bar' | 'age' | 'stale' | 'capped'>) => {
      let tier = e.tier;
      let stale = false;
      let capped = false;
      if (tier === 1 && age > this.cfg.staleMs) {
        tier = 2;
        stale = true;
      }
      if (tier === 1) {
        const from = now - this.cfg.capWindowMin * 60_000;
        this.cap.at = this.cap.at.filter(x => x > from);
        if (this.cap.at.length >= this.cfg.tier1Cap) {
          tier = 2;
          capped = true;
        } else this.cap.at.push(now);
      }
      this.firedBar.set(k, bar.time);
      this.rearm.set(k, { price: e.price, d, bar: bar.time });
      out.push({ ...e, tier, stale, capped, key: `${t}-${e.kind}-${k}-${bar.time}`, ticker: t, at: now, bar: bar.time, age });
    };

    /* THE FLIP: closed minutes beyond it, against the side price stood on — a Tier-2 notice (the owner, 2026-10-14:
       "make a flip cross Tier 2 with 3 closed-minute confirmation (default)"), never the chime, the cap or the stale guard */
    if (this.watch.has('flip') && lv.flip != null && Number.isFinite(lv.flip) && bar.closed && bar.time !== this.lastClosed) {
      const side = bar.close > lv.flip ? 1 : bar.close < lv.flip ? -1 : 0;
      if (this.flipSide === 0) this.flipSide = side;
      else if (side !== 0 && side !== this.flipSide) {
        this.flipRun++;
        if (this.flipRun >= this.cfg.confirmBars) {
          const k = 'flip';
          if (free(k)) {
            const up = side > 0;
            emit(k, {
              tag: tagOf(t, 'flip'),
              tier: 2,
              level: 'flip',
              kind: 'flip-cross',
              price: lv.flip,
              spot: bar.close,
              side: up ? 'up' : 'down',
              words: `${t} crossed the flip at ${fmt(lv.flip)} ${up ? 'upward' : 'downward'} — ${this.flipRun} minute${this.flipRun === 1 ? '' : 's'} closed ${up ? 'above' : 'below'} it`,
            });
          }
          this.flipSide = side;
          this.flipRun = 0;
        }
      } else this.flipRun = 0;
    }
    if (bar.closed) this.lastClosed = bar.time;

    /* THE WALLS, followed by identity: the book's heaviest call- and put-dominant strikes (core/walls.ts, either side of
       the price — a price crossing a wall is no move); re-keyed once a new strike has been the book's pick AND beaten the
       held wall's |gamma| by `wallBeat` in `holdMin` closed minutes in a row, or the held wall is no wall any more;
       touched after standing the wall's age — the one Tier-1 alert (the owner, 2026-10-14: "Tier 1 = wall touches only") */
    for (const id of ['callWall', 'putWall'] as const) {
      const w = this.walls[id];
      const strike = lv[id];
      if (strike == null || !Number.isFinite(strike)) continue;
      const va = lv.valueAt;
      const heldV = va && w.strike != null ? va(w.strike) : NaN;
      const alive = !va || (Number.isFinite(heldV) && (id === 'callWall' ? heldV < 0 : heldV > 0));
      const beats = !va || !alive || Math.abs(va(strike)) >= this.cfg.wallBeat * Math.abs(heldV);
      if (w.strike == null) {
        w.strike = strike;
        w.since = bar.time;
      } else if (strike !== w.strike && !beats) {
        /* not heavier by the margin: the candidate's run starts over */
        w.cand = null;
        w.run = 0;
      } else if (strike !== w.strike) {
        if (strike !== w.cand) {
          w.cand = strike;
          w.candSince = bar.time;
          w.run = 0;
          w.counted = -1;
        }
        if (bar.closed && bar.time !== w.counted) {
          w.run++;
          w.counted = bar.time;
        }
        if (w.run >= this.cfg.holdMin) {
          const from = w.strike;
          w.strike = strike;
          w.since = w.candSince;
          w.cand = null;
          w.run = 0;
          if (this.watch.has(id)) {
            const big = Math.abs(strike - from) >= this.cfg.moveStrikes * (lv.step > 0 ? lv.step : 1) - 1e-9;
            const name = id === 'callWall' ? 'call wall' : 'put wall';
            out.push({
              key: `${t}-wall-${id}-${bar.time}`,
              tag: tagOf(t, id),
              ticker: t,
              tier: big ? 2 : 3,
              level: id,
              kind: big ? 'wall-move' : 'wall-rekey',
              price: strike,
              spot: bar.close,
              at: now,
              bar: bar.time,
              age,
              stale: false,
              capped: false,
              from,
              to: strike,
              words: `${t}'s ${name} moved ${fmt(from)} → ${fmt(strike)}${big ? '' : ' (under two strikes)'} — the watch follows it`,
            });
            /* the watch follows: a touch of the new wall needs it to stand its age, from when it began to hold */
            this.rearm.delete(id);
          }
        }
      } else {
        w.cand = null;
        w.run = 0;
      }
      if (!this.watch.has(id) || w.strike == null) continue;
      const touched = bar.high >= w.strike - tol && bar.low <= w.strike + tol;
      if (touched && (bar.time - w.since) / 60 >= this.cfg.wallAgeMin && free(id)) {
        const name = id === 'callWall' ? 'call wall' : 'put wall';
        const up = bar.close <= w.strike;
        emit(id, {
          tag: tagOf(t, id),
          tier: 1,
          level: id,
          kind: 'wall-touch',
          price: w.strike,
          spot: bar.close,
          side: up ? 'up' : 'down',
          words: `${t} touched the ${name} at ${fmt(w.strike)}, a wall for ${Math.round((bar.time - w.since) / 60)} minutes`,
        });
      }
    }

    /* THE THREE HEAVIEST: a strike that enters them and holds — the log alone (Tier 3; the owner, 2026-10-14: "Move
       'new top-3' to Tier 3 (log only)"); one that leaves them is let go */
    if (lv.top.length) {
      const top3 = lv.top.slice(0, 3);
      if (this.top == null) this.top = [...top3];
      else {
        this.top = this.top.filter(x => top3.includes(x));
        for (const k of [...this.topCand.keys()]) if (!top3.includes(k)) this.topCand.delete(k);
        for (const k of top3) {
          if (this.top.includes(k)) continue;
          const c = this.topCand.get(k) ?? { run: 0, counted: -1 };
          if (bar.closed && bar.time !== c.counted) {
            c.run++;
            c.counted = bar.time;
          }
          this.topCand.set(k, c);
          if (c.run < this.cfg.holdMin) continue;
          this.top.push(k);
          this.topCand.delete(k);
          const key = `top3:${fmt(k)}`;
          if (this.watch.has('top3') && free(key))
            emit(key, { tag: tagOf(t, 'top3'), tier: 3, level: 'top3', kind: 'new-top3', price: k, spot: bar.close, words: `${t}: ${fmt(k)} is among the three heaviest strikes now` });
        }
      }
    }

    /* ±1σ AND ±2σ PRICED AT THE PRIOR CLOSE */
    if (this.watch.has('sigma') && lv.sigma && lv.sigma.s > 0) {
      for (const z of [2, 1, -1, -2]) {
        const lvl = lv.sigma.prevClose + z * lv.sigma.s;
        const k = `sigma${z > 0 ? '+' : ''}${z}`;
        if (bar.high >= lvl - tol && bar.low <= lvl + tol && free(k))
          emit(k, {
            tag: tagOf(t, 'sigma', `${z > 0 ? 'up' : 'down'}${Math.abs(z)}`),
            tier: 2,
            level: 'sigma',
            kind: 'sigma-touch',
            price: lvl,
            spot: bar.close,
            side: z > 0 ? 'up' : 'down',
            words: `${t} touched ${z > 0 ? '+' : '−'}${Math.abs(z)}σ at ${lvl.toFixed(2)}, priced at the prior close`,
          });
      }
    }
    return out;
  }
}

/* ---- THE OUTCOME, the track record's (item 2) — every alert row joins its +15 and +30 minutes ---------------------- */

export interface LevelOutcome {
  /** Minutes after the alert */
  horizon: number;
  close: number;
  /** Points from the level, signed toward the side price came from (a touch) or crossed to (a cross) */
  points: number;
  /** A touch: the close on the side price came from (the track record's bounce); a cross: the close still beyond; a
      wall's move or a new heavy strike: null — it is not a level price came to, so its outcome is the move since */
  held: boolean | null;
}
/** The outcomes at +15 and +30 minutes off one-minute bars (epoch-second times), null for a horizon not reached yet */
export function outcomesOf(e: LevelEvent, bars: readonly { time: number; close: number }[], horizons: readonly number[] = [15, 30]): (LevelOutcome | null)[] {
  return horizons.map(h => {
    const want = e.bar + h * 60;
    let b: { time: number; close: number } | null = null;
    for (const x of bars) {
      if (x.time > want) break;
      if (x.time > e.bar) b = x;
    }
    if (!b || b.time < want) return null;
    if (e.kind === 'wall-move' || e.kind === 'wall-rekey' || e.kind === 'new-top3') return { horizon: h, close: b.close, points: b.close - e.spot, held: null };
    const dir = e.side === 'down' ? -1 : 1;
    /* a cross is held while price stays beyond on its side; a touch (from below, 'up') bounces when it closes back under */
    const cross = e.kind === 'flip-cross';
    const signed = (b.close - e.price) * dir;
    return { horizon: h, close: b.close, points: cross ? signed : -signed, held: cross ? signed > 0 : signed < 0 };
  });
}

/* ---- THE WATCH AND THE LOG, kept on this machine ------------------------------------------------------------------- */

export interface LevelWatch {
  ids: LevelId[];
  /** Closed minutes beyond the flip before its cross is a notice: the reader's pick, else the default (3 since
      2026-10-14 — a watch set under the old default of 1 that never picked follows the new one) */
  confirmBars: number;
  /** True once the reader picked the confirmation minutes themselves */
  chosen?: boolean;
}
const WATCH_KEY = 'slayer_level_watch';
const LOG_KEY = 'slayer_level_alert_log';
const REPLAY_LOG_KEY = 'slayer_level_alert_replay_log';
const LOG_CAP = 100;
const LOG_TOTAL = 400;
const subs = new Set<() => void>();
let watchCache: Record<string, LevelWatch> | null = null;
const logCache: Record<'live' | 'replay', Record<string, LevelEvent[]> | null> = { live: null, replay: null };
let version = 0;
const ring = () => {
  version++;
  subs.forEach(f => f());
};
export const subscribeLevelAlerts = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
export const levelAlertsVersion = () => version;

const readJson = <T>(key: string): T | null => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const writeJson = (key: string, v: unknown) => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage full or blocked — the session keeps it */
  }
};

export function levelWatches(): Record<string, LevelWatch> {
  if (!watchCache) {
    const raw = readJson<Record<string, LevelWatch>>(WATCH_KEY) ?? {};
    watchCache = {};
    for (const [t, w] of Object.entries(raw)) {
      const ids = Array.isArray(w?.ids) ? w.ids.filter((x): x is LevelId => (LEVEL_IDS as readonly string[]).includes(x)) : [];
      const picked = w.chosen === true && Number.isInteger(w.confirmBars) && w.confirmBars >= 1 && w.confirmBars <= 5;
      if (ids.length) watchCache[t.toUpperCase()] = { ids, confirmBars: picked ? w.confirmBars : LEVEL_ALERT_DEFAULTS.confirmBars, ...(picked ? { chosen: true } : {}) };
    }
  }
  return watchCache;
}
export function setLevelWatch(ticker: string, id: LevelId, on: boolean): void {
  const t = ticker.toUpperCase();
  const all = { ...levelWatches() };
  const cur = all[t] ?? { ids: [], confirmBars: LEVEL_ALERT_DEFAULTS.confirmBars };
  const ids = on ? [...new Set([...cur.ids, id])] : cur.ids.filter(x => x !== id);
  if (ids.length) all[t] = { ...cur, ids };
  else delete all[t];
  watchCache = all;
  writeJson(WATCH_KEY, all);
  ring();
}
/** Put a name's watch back exactly as it was (the drawer's undo — its confirmation and `chosen` kept), or take it off */
export function putLevelWatch(ticker: string, entry: LevelWatch | undefined): void {
  const t = ticker.toUpperCase();
  const all = { ...levelWatches() };
  if (entry && entry.ids.length) all[t] = entry;
  else delete all[t];
  watchCache = all;
  writeJson(WATCH_KEY, all);
  ring();
}
export function setConfirmBars(ticker: string, n: number): void {
  const t = ticker.toUpperCase();
  const all = { ...levelWatches() };
  if (!all[t]) return;
  all[t] = { ...all[t], confirmBars: Math.max(1, Math.min(5, Math.round(n))), chosen: true };
  watchCache = all;
  writeJson(WATCH_KEY, all);
  ring();
}
export function levelLog(which: 'live' | 'replay' = 'live'): Record<string, LevelEvent[]> {
  if (!logCache[which]) logCache[which] = readJson<Record<string, LevelEvent[]>>(which === 'live' ? LOG_KEY : REPLAY_LOG_KEY) ?? {};
  return logCache[which]!;
}
/** Writes a minute's events to a log — the live one, or a replay's, never both */
export function noteLevelEvents(events: readonly LevelEvent[], which: 'live' | 'replay' = 'live'): void {
  if (!events.length) return;
  const log = { ...levelLog(which) };
  for (const e of events) {
    const list = log[e.ticker] ?? [];
    if (list.some(x => x.key === e.key)) continue;
    log[e.ticker] = [{ ...e, ...(which === 'replay' ? { replay: true } : {}) }, ...list].slice(0, LOG_CAP);
  }
  /* the whole log stays under its cap: the oldest of the fullest names go first */
  let total = Object.values(log).reduce((s, l) => s + l.length, 0);
  while (total > LOG_TOTAL) {
    const [t] = Object.entries(log).sort((a, b) => b[1].length - a[1].length)[0];
    log[t] = log[t].slice(0, -1);
    total--;
  }
  logCache[which] = log;
  writeJson(which === 'live' ? LOG_KEY : REPLAY_LOG_KEY, log);
  ring();
}
export function clearLevelLog(which: 'live' | 'replay' = 'live'): void {
  logCache[which] = {};
  writeJson(which === 'live' ? LOG_KEY : REPLAY_LOG_KEY, {});
  ring();
}

/* ---- THE HOOKS AND THE COUNTS -------------------------------------------------------------------------------------- */


/** Every name's watch, live */
export function useLevelWatches(): Record<string, LevelWatch> {
  useSyncExternalStore(subscribeLevelAlerts, levelAlertsVersion);
  return levelWatches();
}
/** A name's events (or every name's), newest first */
export function useLevelLog(ticker?: string, which: 'live' | 'replay' = 'live'): LevelEvent[] {
  useSyncExternalStore(subscribeLevelAlerts, levelAlertsVersion);
  const log = levelLog(which);
  if (ticker) return log[ticker.toUpperCase()] ?? EMPTY;
  return Object.values(log)
    .flat()
    .sort((a, b) => b.at - a.at);
}
const EMPTY: LevelEvent[] = [];

/* THE BELL'S TIERS: the Tier-1 and Tier-2 alerts not yet looked at (the drawer marks them seen as it opens) */
const SEEN_KEY = 'slayer_level_alert_seen';
let seenAt: number | null = null;
const seen = (): number => {
  if (seenAt == null) seenAt = readJson<number>(SEEN_KEY) ?? 0;
  return seenAt;
};
export function markLevelAlertsSeen(now = Date.now()): void {
  seenAt = now;
  writeJson(SEEN_KEY, now);
  ring();
}
export function levelUnseen(): { t1: number; t2: number } {
  const from = seen();
  let t1 = 0;
  let t2 = 0;
  for (const list of Object.values(levelLog('live')))
    for (const e of list) {
      if (e.at <= from) continue;
      if (e.tier === 1) t1++;
      else if (e.tier === 2) t2++;
    }
  return { t1, t2 };
}
export function useLevelUnseen(): { t1: number; t2: number } {
  useSyncExternalStore(subscribeLevelAlerts, levelAlertsVersion);
  return levelUnseen();
}
