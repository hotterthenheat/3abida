import { useCallback, useSyncExternalStore } from 'react';

/*
==================================================
  SLAYER TERMINAL - ALERTS (gex/alertStore.ts)

  Things you asked to be told about, kept per
  symbol and visible on every pane showing it.
==================================================

  WHY THIS IS A MODULE-LEVEL STORE AND NOT COMPONENT STATE.

  Terrain mounts up to four panes and two of them can be on the same symbol.
  Alerts are keyed by symbol, so with per-component state and a shared key the
  second pane's save silently overwrites the first pane's alert — and the first
  pane goes on drawing a line for something that is no longer stored. One store
  with subscribers means both panes read the same list and both repaint when
  either changes.

  Persistence is the drawings store's shape verbatim, including the
  self-healing validator: anything that is not a well-formed alert is dropped
  on read rather than thrown, so a half-written key from a previous version
  cannot take a chart down with it. An entry saved by the price-only version
  of this file (no `kind` field) is healed to `kind: 'price'` — the reader's
  standing alerts survive the upgrade.

  WHAT AN ALERT IS AND IS NOT.

  It is a mark on a pane that changes when the thing it watches happens, while
  you are watching. It is not a notification: nothing runs when the tab is
  closed, and the menu says so in as many words. A promise to tell someone
  about a price and then not telling them is worse than not offering it.

  THE KINDS (T-22). A fixed price is only one thing worth watching:
    price     — close reaches a price you typed          (crossed toward)
    level     — close crosses a NAMED level: call wall, put wall, flip, supreme.
                The level moves with the book, so the alert follows the level
                rather than freezing the price it had when armed.
    indicator — close crosses VWAP or an EMA, or RSI crosses a threshold.
                Indicator values depend on the bar size, so the alert is
                stamped with the arming pane's timeframe and only a pane on
                that timeframe evaluates it.
    gexflip   — the book's total net GEX changes sign
    newsupreme   — the largest-exposure strike moves to a different strike
    wallmove  — either wall migrates at least N strikes from where it stood
    flow      — an option print at or over a premium floor arrives (only
                prints AFTER arming count — the tape's history is not news)
    news      — a GRADED headline lands for this name (the room's wire
                drips through the day; stories already landed do not count,
                same clock rule as flow)

  SIDES AND BASELINES ARE ESTABLISHED LAZILY, ON THE FIRST EVALUATION.
  "Crossed" needs to know which side you started on, and "moved" needs to
  know where it stood — but the menu that arms an alert does not hold the
  indicator's value or the book's walls (they depend on the pane's bars and
  the tick). So a fresh alert carries side 0 / baseline 0, and the first tick
  that can read the watched thing fills it in via `evaluateAlert` returning
  an `armed` copy. Recomputing the side on LATER ticks is the bug the price
  kind always guarded against: an alert that re-arms itself behind the price
  never fires.

  THE FIRING RULES ARE PURE. `evaluateAlert(alert, ctx)` takes everything it
  reads as an argument and touches no store, so the proof script can hand it
  a staged book and a staged tape and check every rule — the chart's only job
  is building the context from data it already holds.
*/

export type LevelName = 'callWall' | 'putWall' | 'flip' | 'supreme';
export type IndicatorSource = 'vwap' | 'ema9' | 'ema21' | 'ema50' | 'rsi';

interface AlertBase {
  id: string;
  /** When it fired, in epoch ms. 0 while it is still waiting. */
  firedAt: number;
  /** When it was set (or set again), in epoch ms — the drawer's "set 21:20" (2026-09-10); absent on entries saved before it */
  setAt?: number;
}

export interface PriceAlert extends AlertBase {
  kind: 'price';
  price: number;
  /** Which way it has to be crossed — fixed when the alert is armed, from the
      side of the market the price was on at that moment. Recomputing it later
      would let an alert re-arm itself behind the price and never fire. */
  above: boolean;
}

export interface LevelAlert extends AlertBase {
  kind: 'level';
  level: LevelName;
  /** Which side of the level the close was on when first evaluated:
      1 above, -1 below, 0 not yet established (level absent, or close
      sitting exactly on it). */
  side: -1 | 0 | 1;
}

export interface IndicatorAlert extends AlertBase {
  kind: 'indicator';
  source: IndicatorSource;
  /** RSI only — the line the oscillator has to cross. 0 for the price-cross
      sources, which compare close against the indicator itself. */
  threshold: number;
  side: -1 | 0 | 1;
  /** The arming pane's timeframe — an EMA21 on 1m and on 15m are different
      lines, so only a pane on this timeframe evaluates this alert. */
  tf: string;
}

export interface GexFlipAlert extends AlertBase {
  kind: 'gexflip';
  /** Net GEX sign when first evaluated; 0 until a nonzero total is seen. */
  sign: -1 | 0 | 1;
}

export interface NewSupremeAlert extends AlertBase {
  kind: 'newsupreme';
  /** The supreme strike when first evaluated; 0 until seen (no strike is 0). */
  strike: number;
}

export interface WallMoveAlert extends AlertBase {
  kind: 'wallmove';
  /** How many strike-steps of migration count as "moved". */
  strikes: number;
  /** Where each wall stood when first evaluated; 0 = that wall was unnamed
      at arming and is not watched (a wall appearing later is a different
      event than one moving). */
  callBase: number;
  putBase: number;
  /** The chain's strike spacing, frozen at arming so N strikes stays the
      distance the reader meant. 0 until established. */
  step: number;
}

export interface FlowAlert extends AlertBase {
  kind: 'flow';
  /** Premium floor in dollars. */
  floor: number;
  /** Epoch ms of arming — prints already on the tape do not count. */
  armedAt: number;
}

export interface NewsAlert extends AlertBase {
  kind: 'news';
  /** Epoch ms of arming — headlines already on the wire do not count. */
  armedAt: number;
}

/** A script's own `alertcondition(...)`, armed from the library's gear card
    (2026-09-10, Noah: "wire the script alerts into the bell"). Not judged by
    `evaluateAlert` — the shell's watcher runs the script over the name's
    bars on the timeframe it was armed on, with the placement's inputs, and
    fires it when the condition holds on a bar that closes after arming. */
export interface ScriptAlert extends AlertBase {
  kind: 'script';
  scriptId: string;
  scriptTitle: string;
  /** The condition's id and words, as the script declares them */
  conditionId: string;
  title: string;
  message: string;
  /** Where it was armed — the pane, its bars' timeframe, the placement's inputs */
  paneId: string;
  tf: string;
  inputs: Record<string, number | boolean | string>;
  /** Epoch ms of arming — the record's clock */
  armedAt: number;
  /** The bar (its time, in seconds) that was live when it was armed — earlier
      bars do not count; 0 when unknown (re-armed from the drawer). Bar
      times, never the wall clock: the two are not the same clock. */
  armedBar: number;
  /** The bar (its time, in seconds) it last fired on — never twice on one bar, even re-armed */
  lastBar: number;
}

export type Alert =
  | PriceAlert
  | LevelAlert
  | IndicatorAlert
  | GexFlipAlert
  | NewSupremeAlert
  | WallMoveAlert
  | FlowAlert
  | NewsAlert
  | ScriptAlert;

export type AlertKind = Alert['kind'];

const LEVEL_NAMES: readonly LevelName[] = ['callWall', 'putWall', 'flip', 'supreme'];
const INDICATOR_SOURCES: readonly IndicatorSource[] = ['vwap', 'ema9', 'ema21', 'ema50', 'rsi'];
const isSide = (v: unknown): v is -1 | 0 | 1 => v === -1 || v === 0 || v === 1;
const isFin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const storageKey = (ticker: string) => `slayer_price_alerts_${ticker}`;

/** Heals what it can, drops what it cannot. A pre-kinds entry (price/above
    and no `kind`) becomes a price alert rather than being thrown away. */
const readAlert = (a: unknown): Alert | null => {
  if (typeof a !== 'object' || a === null) return null;
  const c = a as Record<string, unknown>;
  if (typeof c.id !== 'string' || !isFin(c.firedAt)) return null;
  const base = { id: c.id, firedAt: c.firedAt as number, ...(isFin(c.setAt) ? { setAt: c.setAt as number } : {}) };
  /* Legacy vocabulary (pre-2026-08-29): alerts saved before the supreme
     rename carry 'newking' kinds and 'king' level names — healed, not
     dropped, same contract as the pre-kinds entries below. */
  const rawKind = c.kind === 'newking' ? 'newsupreme' : c.kind;
  if (c.level === 'king') c.level = 'supreme';
  const kind = rawKind ?? (isFin(c.price) && typeof c.above === 'boolean' ? 'price' : null);
  switch (kind) {
    case 'price':
      if (!isFin(c.price) || (c.price as number) <= 0 || typeof c.above !== 'boolean') return null;
      return { ...base, kind: 'price', price: c.price as number, above: c.above };
    case 'level':
      if (!LEVEL_NAMES.includes(c.level as LevelName) || !isSide(c.side)) return null;
      return { ...base, kind: 'level', level: c.level as LevelName, side: c.side };
    case 'indicator':
      if (!INDICATOR_SOURCES.includes(c.source as IndicatorSource) || !isFin(c.threshold) || !isSide(c.side) || typeof c.tf !== 'string') return null;
      return { ...base, kind: 'indicator', source: c.source as IndicatorSource, threshold: c.threshold as number, side: c.side, tf: c.tf };
    case 'gexflip':
      if (!isSide(c.sign)) return null;
      return { ...base, kind: 'gexflip', sign: c.sign };
    case 'newsupreme':
      if (!isFin(c.strike)) return null;
      return { ...base, kind: 'newsupreme', strike: c.strike as number };
    case 'wallmove':
      if (!isFin(c.strikes) || (c.strikes as number) < 1 || !isFin(c.callBase) || !isFin(c.putBase) || !isFin(c.step)) return null;
      return { ...base, kind: 'wallmove', strikes: c.strikes as number, callBase: c.callBase as number, putBase: c.putBase as number, step: c.step as number };
    case 'flow':
      if (!isFin(c.floor) || (c.floor as number) <= 0 || !isFin(c.armedAt)) return null;
      return { ...base, kind: 'flow', floor: c.floor as number, armedAt: c.armedAt as number };
    case 'news':
      if (!isFin(c.armedAt)) return null;
      return { ...base, kind: 'news', armedAt: c.armedAt as number };
    case 'script': {
      const str = (v: unknown): v is string => typeof v === 'string';
      if (!str(c.scriptId) || !str(c.scriptTitle) || !str(c.conditionId) || !str(c.title) || !str(c.message) || !str(c.paneId) || !str(c.tf) || !isFin(c.armedAt)) return null;
      const inputs = typeof c.inputs === 'object' && c.inputs !== null ? (c.inputs as Record<string, number | boolean | string>) : {};
      return { ...base, kind: 'script', scriptId: c.scriptId, scriptTitle: c.scriptTitle, conditionId: c.conditionId, title: c.title, message: c.message, paneId: c.paneId, tf: c.tf, inputs, armedAt: c.armedAt as number, armedBar: isFin(c.armedBar) ? (c.armedBar as number) : 0, lastBar: isFin(c.lastBar) ? (c.lastBar as number) : 0 };
    }
    default:
      return null;
  }
};

const load = (ticker: string): Alert[] => {
  try {
    const raw = localStorage.getItem(storageKey(ticker));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: Alert[] = [];
    for (const item of parsed) {
      const a = readAlert(item);
      if (a) out.push(a);
    }
    return out;
  } catch {
    return [];
  }
};

const save = (ticker: string, list: Alert[]) => {
  try {
    if (list.length === 0) localStorage.removeItem(storageKey(ticker));
    else localStorage.setItem(storageKey(ticker), JSON.stringify(list));
  } catch {
    /* storage full, private, or switched off — never fatal */
  }
};

/* The cached array IS the snapshot. useSyncExternalStore compares snapshots by
   identity, so returning a fresh array each read would re-render forever. */
const cache = new Map<string, Alert[]>();
const subs = new Map<string, Set<() => void>>();

const read = (ticker: string): Alert[] => {
  let list = cache.get(ticker);
  if (!list) {
    list = load(ticker);
    cache.set(ticker, list);
  }
  return list;
};

const write = (ticker: string, next: Alert[]) => {
  cache.set(ticker, next);
  save(ticker, next);
  subs.get(ticker)?.forEach(fn => fn());
  noteName(ticker, next.length > 0);
  bumpAll();
};

let seq = 0;
const freshId = () => `${Date.now()}-${++seq}`;

/** The most a pane is worth cluttering. Past this the marks stop being
    readable and the column of them stops being a set of decisions. */
export const MAX_ALERTS = 8;

export const getAlerts = read;

/** The shared gate: cap and duplicate check. `same` says what "the same
    alert" means for the kind being armed. Returns the armed alert or null
    with nothing written. */
const arm = (ticker: string, make: () => Alert, same: (a: Alert) => boolean): Alert | null => {
  const list = read(ticker);
  if (list.length >= MAX_ALERTS) return null;
  if (list.some(same)) return null;
  const alert: Alert = { ...make(), setAt: Date.now() };
  write(ticker, [...list, alert]);
  return alert;
};

/** `spot` fixes which way the alert has to be crossed. Refused if it is not a
    real number, or a duplicate, or the pane is already carrying its most. */
export function armPrice(ticker: string, price: number, spot: number): Alert | null {
  if (!isFin(price) || price <= 0 || !isFin(spot)) return null;
  return arm(
    ticker,
    () => ({ id: freshId(), kind: 'price', price, above: price > spot, firedAt: 0 }),
    a => a.kind === 'price' && Math.abs(a.price - price) < 1e-9
  );
}

export function armLevel(ticker: string, level: LevelName): Alert | null {
  return arm(
    ticker,
    () => ({ id: freshId(), kind: 'level', level, side: 0, firedAt: 0 }),
    a => a.kind === 'level' && a.level === level
  );
}

export function armIndicator(ticker: string, source: IndicatorSource, tf: string, threshold = 0): Alert | null {
  if (!isFin(threshold)) return null;
  return arm(
    ticker,
    () => ({ id: freshId(), kind: 'indicator', source, threshold, side: 0, tf, firedAt: 0 }),
    a => a.kind === 'indicator' && a.source === source && a.tf === tf && Math.abs(a.threshold - threshold) < 1e-9
  );
}

export function armGexFlip(ticker: string): Alert | null {
  return arm(
    ticker,
    () => ({ id: freshId(), kind: 'gexflip', sign: 0, firedAt: 0 }),
    a => a.kind === 'gexflip'
  );
}

export function armNewSupreme(ticker: string): Alert | null {
  return arm(
    ticker,
    () => ({ id: freshId(), kind: 'newsupreme', strike: 0, firedAt: 0 }),
    a => a.kind === 'newsupreme'
  );
}

export function armWallMove(ticker: string, strikes: number): Alert | null {
  if (!isFin(strikes) || strikes < 1) return null;
  return arm(
    ticker,
    () => ({ id: freshId(), kind: 'wallmove', strikes, callBase: 0, putBase: 0, step: 0, firedAt: 0 }),
    a => a.kind === 'wallmove' && a.strikes === strikes
  );
}

export function armNews(ticker: string, now: number): Alert | null {
  return arm(
    ticker,
    () => ({ id: freshId(), kind: 'news', armedAt: now, firedAt: 0 }),
    a => a.kind === 'news'
  );
}

export function armFlow(ticker: string, floor: number, now: number): Alert | null {
  if (!isFin(floor) || floor <= 0) return null;
  return arm(
    ticker,
    () => ({ id: freshId(), kind: 'flow', floor, armedAt: now, firedAt: 0 }),
    a => a.kind === 'flow' && Math.abs(a.floor - floor) < 1e-9
  );
}

/** Arm one of a script's own conditions — the same one on the same pane is refused, not doubled */
export function armScript(
  ticker: string,
  spec: Pick<ScriptAlert, 'scriptId' | 'scriptTitle' | 'conditionId' | 'title' | 'message' | 'paneId' | 'tf' | 'inputs' | 'armedBar'>,
  now: number
): Alert | null {
  return arm(
    ticker,
    () => ({ id: freshId(), kind: 'script', ...spec, armedAt: now, lastBar: 0, firedAt: 0 }),
    a => a.kind === 'script' && a.scriptId === spec.scriptId && a.conditionId === spec.conditionId && a.paneId === spec.paneId
  );
}

export function removeAlert(ticker: string, id: string): void {
  const list = read(ticker);
  const next = list.filter(a => a.id !== id);
  if (next.length !== list.length) write(ticker, next);
}

export function clearAlerts(ticker: string): void {
  if (read(ticker).length) write(ticker, []);
}

/** Idempotent: a chart calls this on every tick a crossed alert is seen, and
    only the first call changes anything. Without that guard the fired time
    would keep moving and every pane would repaint on every tick. */
export function markFired(ticker: string, id: string, at: number): void {
  const list = read(ticker);
  const hit = list.find(a => a.id === id);
  if (!hit || hit.firedAt !== 0) return;
  write(ticker, list.map(a => (a.id === id ? { ...a, firedAt: at } : a)));

  /* OURS, on top of the port (Noah, 2026-08-28: "alerts dont dissapear
     after a certain time nor does the bell show a notification icon").
     Every firing is recorded in the session log and counted as unseen for
     the bell; the fired mark stays lit on the pane for DISMISS_MS and then
     takes itself off the armed set. The timeout re-checks firedAt so a
     reader who re-arms inside the window is not silently un-armed by the
     cleanup that outlived the firing it was cleaning. */
  const prev = firedLogs.get(ticker) ?? [];
  firedLogs.set(ticker, [{ key: `${id}-${at}`, alert: { ...hit, firedAt: at }, at }, ...prev].slice(0, FIRED_LOG_CAP));
  unseenCounts.set(ticker, (unseenCounts.get(ticker) ?? 0) + 1);
  notifyTicker(ticker);
  setTimeout(() => {
    const cur = read(ticker).find(a => a.id === id);
    if (cur && cur.firedAt !== 0) removeAlert(ticker, id);
  }, DISMISS_MS);
}

/*
  ── THE FIRED LOG, THE BELL COUNT, AND THE 3-SECOND RULE (ours) ────────────

  Deliberately IN-MEMORY. This file's contract is "while this tab is open";
  a persisted log would quietly become the notification service the menu
  explicitly says this is not.
*/
export const DISMISS_MS = 3000;
const FIRED_LOG_CAP = 20;

export interface FiredRecord {
  /** Stable per firing — an alert can fire, be re-armed, and fire again. */
  key: string;
  alert: Alert;
  at: number;
}

const firedLogs = new Map<string, FiredRecord[]>();
const unseenCounts = new Map<string, number>();
const EMPTY_FIRED: FiredRecord[] = [];
const notifyTicker = (ticker: string) => {
  subs.get(ticker)?.forEach(fn => fn());
  bumpAll();
};

export const getFiredLog = (ticker: string): FiredRecord[] => firedLogs.get(ticker) ?? EMPTY_FIRED;
export const getUnseen = (ticker: string): number => unseenCounts.get(ticker) ?? 0;

/** The bell was looked at — its count goes back to zero. The log stays. */
export function markSeen(ticker: string): void {
  if ((unseenCounts.get(ticker) ?? 0) === 0) return;
  unseenCounts.set(ticker, 0);
  notifyTicker(ticker);
}

/** Put a fired-and-gone alert back on watch, from its log row — through the
    same cap and duplicate gates as arming it fresh. */
export function rearmFromRecord(ticker: string, key: string, spot: number, now: number): Alert | null {
  const rec = getFiredLog(ticker).find(r => r.key === key);
  if (!rec) return null;
  const list = read(ticker);
  if (list.length >= MAX_ALERTS) return null;
  const fresh: Alert = { ...resetAlert({ ...rec.alert, id: freshId() }, spot, now), setAt: now };
  if (list.some(a => sameIdentity(a, fresh))) return null;
  write(ticker, [...list, fresh]);
  return fresh;
}

export function clearFiredLog(ticker: string): void {
  if ((firedLogs.get(ticker) ?? []).length === 0) return;
  firedLogs.set(ticker, EMPTY_FIRED);
  noteName(ticker, read(ticker).length > 0);
  notifyTicker(ticker);
}

/*
  ── EVERY NAME AT ONCE (2026-09-10, the alerts rule: "see in one place") ──

  The store is one list per name, so a surface that shows every alert the
  reader has — the drawer behind the sidebar's bell — needs to know which
  names hold one. An index key remembers them across reloads; a scan of the
  store's own keys heals an index that was never written (alerts set before
  the index existed). One channel carries "something, somewhere, changed";
  the snapshot is rebuilt lazily and kept by identity for useSyncExternalStore.
*/
const NAMES_KEY = 'slayer_alert_names';
const NAME_PREFIX = 'slayer_price_alerts_';
let names: Set<string> | null = null;

function loadNames(): Set<string> {
  if (names) return names;
  const out = new Set<string>();
  let healed = false;
  try {
    const raw = localStorage.getItem(NAMES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) parsed.forEach(n => { if (typeof n === 'string') out.add(n); });
    const indexed = out.size;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(NAME_PREFIX)) out.add(k.slice(NAME_PREFIX.length));
    }
    healed = out.size !== indexed || raw === null;
  } catch {
    /* no storage — this session's names only */
  }
  names = out;
  /* an index that was missing or behind the store's own keys is written now */
  if (healed) saveNames();
  return out;
}

function saveNames(): void {
  try {
    localStorage.setItem(NAMES_KEY, JSON.stringify([...loadNames()]));
  } catch {
    /* never fatal */
  }
}

/** A name holds alerts while its list or its fired log is non-empty. */
function noteName(ticker: string, holds: boolean): void {
  const set = loadNames();
  if (holds) {
    if (!set.has(ticker)) {
      set.add(ticker);
      saveNames();
    }
  } else if (set.has(ticker) && (firedLogs.get(ticker) ?? []).length === 0) {
    set.delete(ticker);
    saveNames();
  }
}

export interface NameAlerts {
  ticker: string;
  alerts: Alert[];
  fired: FiredRecord[];
  unseen: number;
}

const allSubs = new Set<() => void>();
let allSnapshot: NameAlerts[] | null = null;

function bumpAll(): void {
  allSnapshot = null;
  allSubs.forEach(fn => fn());
}

/** Every name with an alert set or a firing logged, in name order. */
export function getAllAlerts(): NameAlerts[] {
  if (allSnapshot) return allSnapshot;
  const out: NameAlerts[] = [];
  for (const t of [...loadNames()].sort()) {
    const alerts = read(t);
    const fired = getFiredLog(t);
    if (alerts.length === 0 && fired.length === 0) continue;
    out.push({ ticker: t, alerts, fired, unseen: getUnseen(t) });
  }
  allSnapshot = out;
  return out;
}

/** Fired and not yet looked at, across every name — the bell's number. */
export function getUnseenAll(): number {
  let n = 0;
  unseenCounts.forEach(v => { n += v; });
  return n;
}

/** The drawer was opened — every name's count goes back to zero. */
export function markSeenAll(): void {
  let changed = false;
  unseenCounts.forEach((v, t) => {
    if (v === 0) return;
    unseenCounts.set(t, 0);
    subs.get(t)?.forEach(fn => fn());
    changed = true;
  });
  if (changed) bumpAll();
}

const subscribeAll = (fn: () => void) => {
  allSubs.add(fn);
  return () => {
    allSubs.delete(fn);
  };
};

export function useAllAlerts(): NameAlerts[] {
  return useSyncExternalStore(subscribeAll, getAllAlerts, getAllAlerts);
}

export function useUnseenAll(): number {
  return useSyncExternalStore(subscribeAll, getUnseenAll, getUnseenAll);
}

/*
  ── THE PLAIN VOICE (moved here from Pinpoint's WatchMenu, 2026-09-10) ──
  `alertLabel` is the chart's terse voice for a rail row; these are the
  sentences a reader gets on Targets and in the drawer — the same words
  everywhere an alert is written out (the rule: one row, one shape).
*/
const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const LEVEL_WORDS = { callWall: 'the call wall', putWall: 'the put wall', flip: 'the gamma flip', supreme: 'the supreme' } as const;
const AVERAGE_WORDS = { vwap: 'VWAP', ema9: '9-bar average', ema21: '21-bar average', ema50: '50-bar average' } as const;
const money = (v: number) => `$${v >= 1e6 ? `${(v / 1e6).toFixed(v % 1e6 ? 1 : 0)}M` : `${Math.round(v / 1e3)}K`}`;

/** What the reader is waiting for — plain, present tense */
export function waitingWords(a: Alert): string {
  switch (a.kind) {
    case 'price':
      return `price reaches ${fmtStrike(a.price)}`;
    case 'level':
      return a.level === 'flip' ? 'price crosses the gamma flip' : `price reaches ${LEVEL_WORDS[a.level]}`;
    case 'gexflip':
      return 'dealers change sides';
    case 'newsupreme':
      return 'the supreme moves to another strike';
    case 'wallmove':
      return `a wall moves ${a.strikes} strikes or more`;
    case 'flow':
      return `an option trade of ${money(a.floor)} or more lands`;
    case 'news':
      return 'a headline lands';
    case 'indicator':
      return a.source === 'rsi' ? `RSI crosses ${a.threshold} on ${a.tf}` : `price crosses the ${AVERAGE_WORDS[a.source]} on ${a.tf}`;
    case 'script':
      return `${a.scriptTitle} · ${a.title}`;
  }
}

/** A script's message with Pine's placeholders it can fill filled */
const scriptMessage = (a: ScriptAlert, ticker: string): string =>
  (a.message || a.title).replace(/\{\{ticker\}\}/g, ticker).replace(/\{\{interval\}\}/g, a.tf);

/** The words for something that fired — plain, past tense; a script says it in its own words */
export function firedWords(a: Alert, ticker = ''): string {
  switch (a.kind) {
    case 'script':
      return `${a.scriptTitle} · ${scriptMessage(a, ticker)}`;
    case 'price':
      return `price reached ${fmtStrike(a.price)}`;
    case 'level':
      return a.level === 'flip' ? 'price crossed the gamma flip' : `price reached ${LEVEL_WORDS[a.level]}`;
    case 'gexflip':
      return 'dealers changed sides';
    case 'newsupreme':
      return 'the supreme moved to another strike';
    case 'wallmove':
      return `a wall moved ${a.strikes} strikes or more`;
    case 'flow':
      return `an option trade of ${money(a.floor)} or more landed`;
    case 'news':
      return 'a headline landed';
    case 'indicator':
      return a.source === 'rsi' ? `RSI crossed ${a.threshold}` : `price crossed the ${AVERAGE_WORDS[a.source]}`;
  }
}

/** Store the side/baseline `evaluateAlert` established. Refused for an alert
    that fired or vanished between the evaluation and this call. */
export function commitArm(ticker: string, armed: Alert): void {
  const list = read(ticker);
  const hit = list.find(a => a.id === armed.id);
  if (!hit || hit.firedAt !== 0) return;
  write(ticker, list.map(a => (a.id === armed.id ? armed : a)));
}

/** Arm it again where it is — the reader has seen it fire and wants it back.
    The price kind re-sides from the market's position now; every lazy kind
    goes back to unestablished and the next tick re-reads the world. */
/** Back to unestablished — the next tick re-reads the world. Shared by
    re-arming in place and re-arming from the fired log. */
function resetAlert(a: Alert, spot: number, now: number): Alert {
  switch (a.kind) {
    case 'price':
      return isFin(spot) ? { ...a, firedAt: 0, above: a.price > spot } : { ...a, firedAt: 0 };
    case 'level':
      return { ...a, firedAt: 0, side: 0 };
    case 'indicator':
      return { ...a, firedAt: 0, side: 0 };
    case 'gexflip':
      return { ...a, firedAt: 0, sign: 0 };
    case 'newsupreme':
      return { ...a, firedAt: 0, strike: 0 };
    case 'wallmove':
      return { ...a, firedAt: 0, callBase: 0, putBase: 0, step: 0 };
    case 'flow':
      return { ...a, firedAt: 0, armedAt: now };
    case 'news':
      return { ...a, firedAt: 0, armedAt: now };
    case 'script':
      /* the live bar is unknown here — any bar counts but the one it fired on */
      return { ...a, firedAt: 0, armedAt: now, armedBar: 0 };
  }
}

/** What "the same alert" means per kind — the duplicate gate's one voice. */
function sameIdentity(a: Alert, b: Alert): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'price':
      return b.kind === 'price' && Math.abs(a.price - b.price) < 1e-9;
    case 'level':
      return b.kind === 'level' && a.level === b.level;
    case 'indicator':
      return b.kind === 'indicator' && a.source === b.source && a.tf === b.tf && Math.abs(a.threshold - b.threshold) < 1e-9;
    case 'gexflip':
    case 'newsupreme':
      return true;
    case 'wallmove':
      return b.kind === 'wallmove' && a.strikes === b.strikes;
    case 'flow':
      return b.kind === 'flow' && Math.abs(a.floor - b.floor) < 1e-9;
    case 'news':
      return true;
    case 'script':
      return b.kind === 'script' && a.scriptId === b.scriptId && a.conditionId === b.conditionId && a.paneId === b.paneId;
  }
}

export function rearmAlert(ticker: string, id: string, spot: number, now: number): void {
  const list = read(ticker);
  const hit = list.find(a => a.id === id);
  if (!hit) return;
  const next = list.map(a => (a.id === id ? { ...resetAlert(a, spot, now), setAt: now } : a));
  if (next.some((a, i) => a !== list[i])) write(ticker, next);
}

/*
  ── FIRING ────────────────────────────────────────────────────────────────
*/

/** Everything a tick knows that an alert might watch. Nulls mean "cannot be
    read right now" — an alert waits on null, it never guesses. */
export interface AlertContext {
  close: number;
  /** The evaluating pane's timeframe — gates indicator alerts. */
  tf: string;
  /** Named levels with REAL nulls (core/walls.ts rules), not spot fallbacks:
      "no call wall qualifies" must read as absent here, or a level alert
      would chase the fallback around the tape. */
  levels: { callWall: number | null; putWall: number | null; flip: number | null; supreme: number | null };
  /** Signed total of the book's net GEX; null when the book is unreadable. */
  netGex: number | null;
  /** The chain's strike spacing; 0 when unknown. */
  step: number;
  /** Latest value per indicator the evaluating pane computed; absent or null
      when not computable (too few bars). */
  values: Partial<Record<IndicatorSource, number | null>>;
  /** The flow tape, epoch-ms stamped, already narrowed to this symbol. */
  prints: readonly { at: number; premium: number }[];
  /** The name's headlines, release-stamped and pre-graded — narrowed to
      this symbol by the builder (data/news.ts newsPulse). */
  news: readonly { atMs: number; graded: boolean }[];
}

export interface AlertVerdict {
  fire: boolean;
  /** The same alert with its lazy side/baseline filled in — returned only
      when something was established this evaluation. The caller stores it
      via `commitArm`. */
  armed?: Alert;
}

const NONE: AlertVerdict = { fire: false };

/** One crossing rule for everything that crosses: armed on side `side` of
    `ref`, fires when `x` lands on or past the other side of it. */
const crossed = (side: -1 | 1, x: number, ref: number): boolean =>
  side === 1 ? x <= ref : x >= ref;

const sideOf = (x: number, ref: number): -1 | 0 | 1 => (x > ref ? 1 : x < ref ? -1 : 0);

export function evaluateAlert(a: Alert, ctx: AlertContext): AlertVerdict {
  if (a.firedAt !== 0) return NONE;
  switch (a.kind) {
    case 'price':
      return { fire: a.above ? ctx.close >= a.price : ctx.close <= a.price };

    case 'level': {
      const ref = ctx.levels[a.level];
      if (ref === null) return NONE;
      if (a.side === 0) {
        const side = sideOf(ctx.close, ref);
        return side === 0 ? NONE : { fire: false, armed: { ...a, side } };
      }
      return { fire: crossed(a.side, ctx.close, ref) };
    }

    case 'indicator': {
      if (a.tf !== ctx.tf) return NONE;
      const v = ctx.values[a.source];
      if (v === null || v === undefined) return NONE;
      /* RSI watches the oscillator against the reader's line; the price
         sources watch the close against the indicator itself. */
      const x = a.source === 'rsi' ? v : ctx.close;
      const ref = a.source === 'rsi' ? a.threshold : v;
      if (a.side === 0) {
        const side = sideOf(x, ref);
        return side === 0 ? NONE : { fire: false, armed: { ...a, side } };
      }
      return { fire: crossed(a.side, x, ref) };
    }

    case 'gexflip': {
      const g = ctx.netGex;
      if (g === null || g === 0) return NONE;
      const sign: -1 | 1 = g > 0 ? 1 : -1;
      if (a.sign === 0) return { fire: false, armed: { ...a, sign } };
      return { fire: sign === -a.sign };
    }

    case 'newsupreme': {
      const k = ctx.levels.supreme;
      if (k === null) return NONE;
      if (a.strike === 0) return { fire: false, armed: { ...a, strike: k } };
      return { fire: Math.abs(k - a.strike) > 1e-9 };
    }

    case 'wallmove': {
      if (a.callBase === 0 && a.putBase === 0) {
        const callBase = ctx.levels.callWall ?? 0;
        const putBase = ctx.levels.putWall ?? 0;
        /* Nothing to stand on: no wall qualifies, or the chain's spacing is
           unknown — keep waiting rather than watching nothing. */
        if ((callBase === 0 && putBase === 0) || ctx.step <= 0) return NONE;
        return { fire: false, armed: { ...a, callBase, putBase, step: ctx.step } };
      }
      const need = a.strikes * a.step - 1e-9;
      if (a.step <= 0) return NONE;
      const moved = (base: number, cur: number | null) =>
        base !== 0 && cur !== null && Math.abs(cur - base) >= need;
      return { fire: moved(a.callBase, ctx.levels.callWall) || moved(a.putBase, ctx.levels.putWall) };
    }

    case 'flow':
      return { fire: ctx.prints.some(p => p.at > a.armedAt && p.premium >= a.floor) };

    /* Same clock rule as flow: only headlines that LAND after arming count —
       and only graded ones (a WATCH story is the wire clearing its throat). */
    case 'news':
      return { fire: ctx.news.some(n => n.atMs > a.armedAt && n.graded) };

    /* A script's condition is the script's to judge — the shell's watcher
       runs it (components/alerts/AlertWatcher.tsx) and calls markFired */
    case 'script':
      return NONE;
  }
}

/** Whether a script alert may fire on a bar: the bar that was live at arming
    or any later one, and never the bar it already fired on. Bar times only —
    the wall clock is a different clock. */
export function scriptBarCounts(a: ScriptAlert, barTime: number): boolean {
  return barTime !== a.lastBar && barTime >= a.armedBar;
}

/** The words a rail row or a menu row prints for an alert — one place, so
    the pane and the menu never describe the same alert differently. */
export function alertLabel(a: Alert): string {
  switch (a.kind) {
    case 'price':
      return `${a.price.toFixed(2)} ${a.above ? 'above' : 'below'}`;
    case 'level':
      return `${{ callWall: 'call wall', putWall: 'put wall', flip: 'flip', supreme: 'supreme' }[a.level]} cross`;
    case 'indicator':
      return a.source === 'rsi'
        ? `RSI ${a.threshold} · ${a.tf}`
        : `${{ vwap: 'VWAP', ema9: 'EMA 9', ema21: 'EMA 21', ema50: 'EMA 50' }[a.source]} cross · ${a.tf}`;
    case 'gexflip':
      return 'net GEX flips sign';
    case 'newsupreme':
      return 'new supreme';
    case 'wallmove':
      return `wall moves ${a.strikes}+ strikes`;
    case 'flow':
      return `print ≥ $${a.floor >= 1_000_000 ? `${(a.floor / 1_000_000).toFixed(a.floor % 1_000_000 ? 1 : 0)}M` : `${Math.round(a.floor / 1_000)}K`}`;
    case 'news':
      return 'graded news lands';
    case 'script':
      return a.title;
  }
}

/** Shared subscribe — the log and the count ride the ticker's channel. */
function useTickerChannel(ticker: string): (fn: () => void) => () => void {
  return useCallback(
    (fn: () => void) => {
      let set = subs.get(ticker);
      if (!set) {
        set = new Set();
        subs.set(ticker, set);
      }
      set.add(fn);
      return () => {
        set?.delete(fn);
      };
    },
    [ticker]
  );
}

export function useFiredLog(ticker: string): FiredRecord[] {
  const subscribe = useTickerChannel(ticker);
  const snapshot = useCallback(() => getFiredLog(ticker), [ticker]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function useUnseen(ticker: string): number {
  const subscribe = useTickerChannel(ticker);
  const snapshot = useCallback(() => getUnseen(ticker), [ticker]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function useAlerts(ticker: string): Alert[] {
  const subscribe = useCallback(
    (fn: () => void) => {
      let set = subs.get(ticker);
      if (!set) {
        set = new Set();
        subs.set(ticker, set);
      }
      set.add(fn);
      return () => {
        set?.delete(fn);
      };
    },
    [ticker]
  );
  const snapshot = useCallback(() => read(ticker), [ticker]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
