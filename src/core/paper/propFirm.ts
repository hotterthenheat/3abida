/*
==================================================
  SLAYER TERMINAL - THE EVALUATION (core/paper/propFirm.ts)

  A prop firm's rules, as an INTERCEPTOR on the
  paper engine rather than a branch inside it: it
  registers a guard (what it will refuse) and an
  observer (what it watches), and it never touches
  the account by any door the reader does not have.

  THE FOUR RULES IT KEEPS:

    THE ASSET LOCK    futures only. An option or a
                      stock is refused at submit
                      with the reason said out loud.
    THE INTRADAY
    TRAILING DRAWDOWN tracks the highest equity the
                      account has ever touched —
                      unrealised included, so a
                      trade given back counts — and
                      liquidates when
                      (peak − equity) ≥ the limit.
    THE EOD TRAILING  the same, but the peak only
                      moves at the 17:00 ET bell and
                      only on the REALISED balance,
                      which is how the stricter
                      evaluations actually settle.
    THE TIME ENFORCER at 16:59 ET every position is
                      closed, because nothing may be
                      carried overnight or into a
                      weekend.

  WHEN IT LIQUIDATES it flattens through the same
  engine every hand uses, then LOCKS the desk for
  the rest of the session — the guard refuses new
  orders and says why. The lock is the account's,
  not the app's: it survives a reload.

  WHAT IT IS HONEST ABOUT: the liquidation PRICE it
  draws on the chart (liquidationPrice below) holds
  every other position still. With one position
  open — which is the case an evaluation cares
  about — it is exact; with several it is the level
  for THIS one if the others do not move, and the
  chart's label says so.
==================================================
*/

import { useSyncExternalStore } from 'react';
import { flattenAll, getPaperState, readAccount, registerGuard, registerObserver, resetAccount, type Position } from './engine';
import { easternNow, getModes, hhmmToMinutes, type PropSettings } from './modes';
import { fmtMoney, type Instrument } from './instruments';

export interface PropState {
  /** The equity the evaluation began on — every allowance is measured from here */
  startEquity: number;
  /** The highest equity the account has touched since the evaluation began */
  peakEquity: number;
  /** The equity the current session opened on */
  dayStartEquity: number;
  /** The realised balance at the last 17:00 ET roll — the EOD baseline */
  eodBaseline: number;
  /** The date key the session belongs to */
  dayKey: string;
  /** Set when a rule has been broken; the desk refuses orders until it clears */
  locked: null | { at: number; reason: string; until: number };
  /** Set once the profit target is cleared — a badge, never a block */
  passedAt: number | null;
  /** What the daemon has done, newest first */
  log: { at: number; words: string }[];
}

const KEY = 'slayer_paper_prop_v1';
const KEEP_LOG = 40;

/*
  AN EVALUATION BEGINS WHERE THE ACCOUNT STANDS, not where its settings say.

  Seeding the baselines from the "account size" field left a $2,000 trailing
  drawdown measured against a number the account had never held: a $100,000
  desk switched into a $50,000 evaluation read "$51,000 left of $1,000". The
  allowance is measured from the equity the evaluation started on — and the
  Restart button below funds a real account of the stated size, which is the
  only way the two can agree.
*/
const freshState = (equity: number): PropState => ({
  startEquity: equity,
  peakEquity: equity,
  dayStartEquity: equity,
  eodBaseline: equity,
  dayKey: todayKey(),
  locked: null,
  passedAt: null,
  log: [],
});

function todayKey(now: Date = new Date()): string {
  const e = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return e;
}

function load(): PropState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<PropState>;
      if (typeof v.peakEquity === 'number') {
        const base = freshState(v.peakEquity);
        return { ...base, ...v, startEquity: typeof v.startEquity === 'number' ? v.startEquity : v.peakEquity, log: Array.isArray(v.log) ? v.log : [] };
      }
    }
  } catch {
    /* a bad record starts the evaluation fresh */
  }
  return freshState(getModes().prop.accountSize);
}

let prop: PropState = load();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const getPropState = (): PropState => prop;
export const usePropState = (): PropState => useSyncExternalStore(subscribe, getPropState, getPropState);

function commit(next: Partial<PropState>, words?: string): void {
  prop = { ...prop, ...next };
  if (words) prop = { ...prop, log: [{ at: Date.now(), words }, ...prop.log].slice(0, KEEP_LOG) };
  try {
    localStorage.setItem(KEY, JSON.stringify(prop));
  } catch {
    /* the session keeps it */
  }
  listeners.forEach(fn => fn());
}

/**
 * Start the evaluation over: a fresh paper account of the stated size, and
 * every baseline set to it. The blotter goes with it — an evaluation with the
 * last one's trades still in it would be neither.
 */
export function resetEvaluation(): void {
  const size = getModes().prop.accountSize;
  resetAccount(size);
  prop = freshState(size);
  try {
    localStorage.setItem(KEY, JSON.stringify(prop));
  } catch {
    /* non-fatal */
  }
  listeners.forEach(fn => fn());
}

/* ---- the numbers a panel and the chart read ------------------------------------------------ */

export interface PropRead {
  /** The equity level at which the account is liquidated */
  floor: number;
  /** Dollars between the current equity and that floor */
  room: number;
  /** The whole allowance, for the meter */
  limit: number;
  /** 0..1 — how much of the allowance has been used */
  used: number;
  equity: number;
  peak: number;
  /** The day's own limit, when one is set */
  dayFloor: number | null;
  dayRoom: number | null;
  target: number | null;
  locked: PropState['locked'];
  kind: PropSettings['drawdownKind'];
}

export function readProp(): PropRead {
  const s = getModes().prop;
  const acct = readAccount();
  const base = s.drawdownKind === 'intraday' ? prop.peakEquity : prop.eodBaseline;
  const floor = base - s.drawdownLimit;
  const dayFloor = s.dailyLossLimit > 0 ? prop.dayStartEquity - s.dailyLossLimit : null;
  return {
    floor,
    room: acct.equity - floor,
    limit: s.drawdownLimit,
    used: Math.min(1, Math.max(0, (base - acct.equity) / Math.max(1, s.drawdownLimit))),
    equity: acct.equity,
    peak: base,
    dayFloor,
    dayRoom: dayFloor == null ? null : acct.equity - dayFloor,
    target: s.profitTarget > 0 ? prop.startEquity + s.profitTarget : null,
    locked: prop.locked,
    kind: s.drawdownKind,
  };
}

/**
 * THE PRICE THIS POSITION DIES AT.
 *
 * Equity today is everything else plus this lot's mark-to-market, so the
 * level where equity meets the floor is one line of algebra:
 *
 *     floor = equity − (mark − P) × qty × multiplier
 *     P     = mark − (equity − floor) / (qty × multiplier)
 *
 * Long, it sits below; short, above. Null when there is nothing to
 * liquidate, or when the room is wider than the instrument can travel.
 */
export function liquidationPrice(p: Position, mark: number): number | null {
  const modes = getModes();
  if (modes.mode !== 'prop' || p.qty === 0) return null;
  const read = readProp();
  const per = p.qty * p.instrument.multiplier;
  if (Math.abs(per) < 1e-9) return null;
  /* the tighter of the two floors is the one that actually stops you */
  const room = read.dayRoom != null ? Math.min(read.room, read.dayRoom) : read.room;
  const price = mark - room / per;
  return Number.isFinite(price) && price > 0 ? price : null;
}

/** The liquidation level for whatever is open on this instrument, or null */
export function liquidationFor(instrumentId: string): { price: number; alone: boolean } | null {
  const st = getPaperState();
  const p = st.positions.find(x => x.id === instrumentId && x.qty !== 0);
  if (!p) return null;
  const q = st.quotes[p.id];
  const price = liquidationPrice(p, q?.mark ?? p.avgPrice);
  if (price == null) return null;
  return { price, alone: st.positions.filter(x => x.qty !== 0).length === 1 };
}

/* ---- the daemon --------------------------------------------------------------------------- */

let stopGuard: (() => void) | null = null;
let stopObserver: (() => void) | null = null;
let flattenedFor = '';

const endOfSession = (): number => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};

function liquidate(reason: string): void {
  if (prop.locked) return;
  commit({ locked: { at: Date.now(), reason, until: endOfSession() } }, `LIQUIDATED — ${reason}`);
  flattenAll('engine', 'prop firm liquidation');
}

let wasProp = false;

/** Called on every quote tick while the mode is on */
function watch(): void {
  const modes = getModes();
  if (modes.mode !== 'prop') {
    wasProp = false;
    return;
  }
  const s = modes.prop;
  const acct = readAccount();
  const day = todayKey();

  /* THE EVALUATION BEGINS THE MOMENT THE MODE DOES. Switching into it re-bases
     every allowance on the equity standing right now, so the meter and the
     account can never be reading two different desks. */
  if (!wasProp) {
    wasProp = true;
    if (Math.abs(prop.startEquity - acct.equity) > 0.5 || prop.dayKey !== day) {
      prop = { ...freshState(acct.equity), log: prop.log };
      commit({}, `Evaluation begins at ${fmtMoney(acct.equity, false)} — ${fmtMoney(s.drawdownLimit, false)} of room`);
    }
  }

  /* a new session: the day's own baselines roll */
  if (prop.dayKey !== day) {
    commit({ dayKey: day, dayStartEquity: acct.equity, locked: null }, `New session — the day starts at ${fmtMoney(acct.equity, false)}`);
    flattenedFor = '';
  }

  /* the peak only ever rises */
  if (acct.equity > prop.peakEquity) commit({ peakEquity: acct.equity });

  const et = easternNow();
  const weekday = et.weekday !== 'Sat' && et.weekday !== 'Sun';

  /* THE EOD ROLL: at 17:00 ET the trailing baseline takes the realised balance */
  if (weekday && et.minutes >= hhmmToMinutes(s.eodAt) && prop.dayKey === day && flattenedFor !== `${day}-eod`) {
    flattenedFor = `${day}-eod`;
    commit({ eodBaseline: Math.max(prop.eodBaseline, acct.cash) }, `EOD roll — the trailing baseline is the realised ${fmtMoney(acct.cash, false)}`);
  }

  /* THE TIME ENFORCER: nothing is carried past the bell */
  if (weekday && et.minutes >= hhmmToMinutes(s.flattenAt) && et.minutes < hhmmToMinutes(s.eodAt) && flattenedFor !== `${day}-flat`) {
    const open = getPaperState().positions.filter(p => p.qty !== 0).length;
    flattenedFor = `${day}-flat`;
    if (open > 0) {
      flattenAll('engine', 'the bell — nothing is held overnight');
      commit({}, `${s.flattenAt} ET — ${open} position${open === 1 ? '' : 's'} closed, nothing is held overnight`);
    }
  }

  if (prop.locked) return;

  const read = readProp();
  if (acct.equity <= read.floor) {
    liquidate(read.kind === 'intraday' ? `the trailing drawdown — equity ${fmtMoney(acct.equity, false)} hit the floor ${fmtMoney(read.floor, false)}` : `the end-of-day drawdown — equity ${fmtMoney(acct.equity, false)} hit the floor ${fmtMoney(read.floor, false)}`);
    return;
  }
  if (read.dayFloor != null && acct.equity <= read.dayFloor) {
    liquidate(`the daily loss limit — equity ${fmtMoney(acct.equity, false)} hit ${fmtMoney(read.dayFloor, false)}`);
    return;
  }
  if (read.target != null && prop.passedAt == null && acct.equity >= read.target) {
    commit({ passedAt: Date.now() }, `Profit target cleared at ${fmtMoney(acct.equity, false)}`);
  }
}

/** Contracts open across every futures position */
const openContracts = (): number => getPaperState().positions.filter(p => p.instrument.kind === 'future').reduce((n, p) => n + Math.abs(p.qty), 0);

/**
 * Start the interceptor. Idempotent — the desk calls it on mount and the
 * returned function on unmount; the daemon only acts while the mode is on.
 */
export function startPropFirm(): () => void {
  if (stopGuard) return stopPropFirm;
  stopGuard = registerGuard('prop-firm', (req, ctx) => {
    const modes = getModes();
    if (modes.mode !== 'prop') return null;
    const s = modes.prop;
    /*
      AN EXIT IS NEVER REFUSED.

      Every rule here is about taking RISK ON, and the guard runs on every
      submit — the liquidation's own closing orders included. Refusing those
      left the lock on and the position open, which is the one state an
      evaluation must never produce: locked out of a trade you are still in.
      A reduce-only order, or any order that opens nothing, goes straight
      through whatever else is true.
    */
    if (req.reduceOnly || ctx.opens <= 0) return null;
    if (prop.locked) return `The evaluation is locked — ${prop.locked.reason}`;
    if (s.futuresOnly && req.instrument.kind !== 'future') return `This evaluation trades futures only — ${req.instrument.kind === 'option' || req.instrument.kind === 'spread' ? 'options' : 'shares'} are not routable`;
    if (s.maxContracts > 0 && ctx.opens > 0) {
      const after = openContracts() + ctx.opens;
      if (after > s.maxContracts) return `Over the contract cap — ${after} would be open against a limit of ${s.maxContracts}`;
    }
    const et = easternNow();
    if (ctx.opens > 0 && et.weekday !== 'Sat' && et.weekday !== 'Sun' && et.minutes >= hhmmToMinutes(s.flattenAt) && et.minutes < hhmmToMinutes(s.eodAt)) {
      return `Past ${s.flattenAt} ET — the desk is flattening, not opening`;
    }
    return null;
  });
  stopObserver = registerObserver(e => {
    if (e.kind === 'quotes') watch();
  });
  return stopPropFirm;
}

export function stopPropFirm(): void {
  stopGuard?.();
  stopObserver?.();
  stopGuard = null;
  stopObserver = null;
}

/**
 * Take the lock off by hand.
 *
 * The allowance is re-based on the equity standing now, and the log says so.
 * Without it the button does nothing: an account under its floor re-locks on
 * the very next quote, and the reader is left staring at a desk that will not
 * trade. This is an override, and it is written down as one.
 */
export function clearLock(): void {
  const eq = readAccount().equity;
  prop = { ...prop, locked: null, peakEquity: eq, eodBaseline: eq, dayStartEquity: eq, startEquity: eq };
  commit({}, `The lock was cleared by hand — the allowance is measured from ${fmtMoney(eq, false)} from here`);
}
