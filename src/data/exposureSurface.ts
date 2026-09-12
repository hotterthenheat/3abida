/*
==================================================
  SLAYER TERMINAL - EXPOSURE SURFACE (exposureSurface.ts)
  Strike × EXPIRY × greek — the book across the whole
  calendar (Noah, 2026-09-03, holding Skylit's
  heatmap beside the Field: dates as columns, one
  greek at a time or all three, the king node, a
  strike range — "we are going nowhere until we come
  up with something generational").

  HONEST TERM STRUCTURE. The profile's expiry lens
  scales the whole book by one factor, which cannot
  draw a range — every expiry would be the same
  ridge at a different height. The Weigher's desk
  chains can: they price real per-expiry contracts
  (gamma, delta, vega, open interest per strike and
  side) through one estimator, so gamma decays into
  the future, vega grows, and open interest sits
  where each expiry's book actually is.

  ONE BOOK, STILL. The FRONT row is the ladder's own
  numbers, exactly — the 0DTE profile every other
  surface on the page reads — and each farther
  expiry is the desk's leg at that strike, carried
  in the front leg's sign and scaled by the front
  leg's own ratio to its desk twin. The ladder and
  the range can never disagree about today, and the
  calendar behind today is the estimator's, not a
  decay table's.
==================================================
*/

import { buildExposureProfile, type StrikeWindow } from './exposure';
import { buildDeskChain, DESK_DTES } from './weigherDesk';
import { blackScholesGreeks } from '../core/greeks';
import { spotChangePct } from './gex';
import type { MarketSnapshot } from '../types/market';
import type { ExposureLevels, ExposureProfileData } from '../types/gex';

/** The five greeks every exposure surface can speak (vanna and charm joined 2026-09-09) */
export type Greek = 'gex' | 'dex' | 'vex' | 'vanna' | 'charm';
export const GREEKS: Greek[] = ['gex', 'dex', 'vex', 'vanna', 'charm'];
/** The three the calendar shows side by side under "All" */
export const CORE_GREEKS: Greek[] = ['gex', 'dex', 'vex'];

/** The unit each greek is stated in — the matrix's own headers. */
export const GREEK_UNIT: Record<Greek, string> = { gex: '1% move', dex: '1σ move', vex: '1% vol', vanna: '1 vol pt', charm: '1 day' };

export interface SurfaceExpiry {
  dte: number;
  /** "0DTE", "2d", "45d" */
  short: string;
  /** "Sep 3" */
  date: string;
  /** At-the-money implied vol for this expiry, as a fraction (0.18 = 18%) */
  iv: number;
  /** Trading sessions until it expires — 0 on the day itself */
  sessions: number;
}

export interface KingNode {
  strike: number;
  /** Index into `expiries` */
  e: number;
  value: number;
}

/** THE SUPREME — the heaviest STRIKE of the whole book, the one the chart
    wears in magenta and every other page names; here with the date that
    carries most of it. Not the heaviest cell: that is `king`, the star.
    (Noah, 2026-09-08: the chart's magenta trail and the ledger's SUPREME chip
    named two different strikes — one was a strike, the other a cell.) */
export interface SupremeNode {
  strike: number;
  /** Index into `expiries` — the date holding most of this strike's hedging */
  e: number;
  /** That date's cell, signed dollars */
  value: number;
  /** The strike's whole-book net — the number the chart and the ladder carry */
  total: number;
}

export interface ExposureSurface {
  ticker: string;
  spot: number;
  changePct: number;
  /** Ascending */
  strikes: number[];
  /** Nearest first */
  expiries: SurfaceExpiry[];
  /** [greek][expiry][strike], signed dollars — the put and call legs and their net */
  put: Record<Greek, number[][]>;
  call: Record<Greek, number[][]>;
  net: Record<Greek, number[][]>;
  /** [expiry][strike] */
  oi: number[][];
  /** Per greek, the largest |net| anywhere on the surface */
  maxAbs: Record<Greek, number>;
  /** Per greek, the heaviest single cell on the calendar — the star, never the supreme */
  king: Record<Greek, KingNode>;
  /** Per greek, the heaviest strike of the whole book — the supreme, magenta everywhere */
  supreme: Record<Greek, SupremeNode>;
  levels: ExposureLevels;
  /** The front book — the ladder's own profile */
  front: ExposureProfileData;
}

/** The ledger's calendar (Noah, 2026-09-04: "increase the amount of dates you
    can see at a time"): this week's dailies, the Fridays out to seven weeks,
    then the monthlies to a quarter — each resolved to a real session and
    deduped below, so two horizons on one Friday are one column. */
export const CALENDAR_DTES = [0, 1, 2, 3, 4, 7, 14, 21, 28, 35, 42, 49, 63, 77, 91] as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EPS = 1e-6;
/** The dealers' side of each leg — the simulator's own numbers (core/simulator.ts, the chain builder) */
const DEALER_CALL = -0.55;
const DEALER_PUT = -0.53;
/** The greeks whose legs come signed and ready from the desk chain, never anchored to the front */
const DIRECT: ReadonlySet<Greek> = new Set<Greek>(['vanna', 'charm']);

export function buildExposureSurface(snapshot: MarketSnapshot, half: StrikeWindow, dtes: readonly number[] = DESK_DTES): ExposureSurface {
  const front = buildExposureProfile(snapshot, '0DTE', half);
  const rows = [...front.strikes].sort((a, b) => a.strike - b.strike);
  const strikes = rows.map(r => r.strike);
  const { ticker, spot } = snapshot;
  const sigma1 = (iv: number) => (iv / 100) * Math.sqrt(1 / 252);

  /* The desk's legs per expiry, as MAGNITUDES — the sign is the front leg's. */
  type Legs = { put: number; call: number };
  const deskLegs: Record<Greek, Legs[][]> = { gex: [], dex: [], vex: [], vanna: [], charm: [] };
  const oi: number[][] = [];
  const expiries: SurfaceExpiry[] = [];
  const seen = new Set<string>();
  for (const dte of dtes) {
    const chain = buildDeskChain(ticker, dte, half);
    const key = chain.expiry.date.toISOString().slice(0, 10);
    if (seen.has(key)) continue; // two horizons on one Friday are one expiry
    seen.add(key);
    const d = chain.expiry.date;
    /* The expiry's own vol and time — what sets how far its gamma reaches
       along price (the Reach draws each expiry at that width). ATM iv is the
       nearest-to-spot row's two legs averaged, on the desk's own smile. */
    const atm = chain.rows.reduce((best, r) => (Math.abs(r.strike - spot) < Math.abs(best.strike - spot) ? r : best), chain.rows[0]);
    const iv = atm ? (atm.put.iv + atm.call.iv) / 200 : 0.2;
    expiries.push({ dte, short: dte === 0 ? '0DTE' : `${dte}d`, date: `${MONTHS[d.getMonth()]} ${d.getDate()}`, iv, sessions: chain.expiry.sessions });
    const byStrike = new Map(chain.rows.map(r => [r.strike, r]));
    const gexRow: Legs[] = [];
    const dexRow: Legs[] = [];
    const vexRow: Legs[] = [];
    const vannaRow: Legs[] = [];
    const charmRow: Legs[] = [];
    const oiRow: number[] = [];
    /* Vanna and charm per leg from the expiry's own time and vol (the desk
       chain carries neither) — SIGNED, with the dealers' direction on them,
       the way the simulator states today's. They are not anchored to the
       front leg below: today's contracts carry almost no vanna, so a ratio
       off them is noise scaled into the far dates (measured: $2 trillion of
       "forced buying" on the first cut, 2026-09-09). */
    const years = Math.max(0.5, chain.expiry.sessions) / 252;
    for (const s of strikes) {
      const r = byStrike.get(s);
      if (!r) {
        gexRow.push({ put: 0, call: 0 });
        dexRow.push({ put: 0, call: 0 });
        vexRow.push({ put: 0, call: 0 });
        vannaRow.push({ put: 0, call: 0 });
        charmRow.push({ put: 0, call: 0 });
        oiRow.push(0);
        continue;
      }
      const g = (c: typeof r.call) => c.gamma * c.oi * 100 * spot * spot * 0.01;
      const dx = (c: typeof r.call) => Math.abs(c.delta) * c.oi * 100 * spot * sigma1(c.iv);
      const v = (c: typeof r.call) => c.vega * c.oi * 100;
      const hp = blackScholesGreeks(spot, s, years, Math.max(0.01, r.put.iv / 100));
      const hc = blackScholesGreeks(spot, s, years, Math.max(0.01, r.call.iv / 100));
      gexRow.push({ put: g(r.put), call: g(r.call) });
      dexRow.push({ put: dx(r.put), call: dx(r.call) });
      vexRow.push({ put: v(r.put), call: v(r.call) });
      vannaRow.push({ put: hp.vanna * 0.01 * r.put.oi * 100 * spot * DEALER_PUT, call: hc.vanna * 0.01 * r.call.oi * 100 * spot * DEALER_CALL });
      charmRow.push({ put: (hp.charmPut * r.put.oi * 100 * spot * DEALER_PUT) / 252, call: (hc.charmCall * r.call.oi * 100 * spot * DEALER_CALL) / 252 });
      oiRow.push(r.put.oi + r.call.oi);
    }
    deskLegs.gex.push(gexRow);
    deskLegs.dex.push(dexRow);
    deskLegs.vex.push(vexRow);
    deskLegs.vanna.push(vannaRow);
    deskLegs.charm.push(charmRow);
    oi.push(oiRow);
  }

  const put: Record<Greek, number[][]> = { gex: [], dex: [], vex: [], vanna: [], charm: [] };
  const call: Record<Greek, number[][]> = { gex: [], dex: [], vex: [], vanna: [], charm: [] };
  const net: Record<Greek, number[][]> = { gex: [], dex: [], vex: [], vanna: [], charm: [] };
  const maxAbs: Record<Greek, number> = { gex: 1, dex: 1, vex: 1, vanna: 1, charm: 1 };
  const king: Record<Greek, KingNode> = {
    gex: { strike: strikes[0], e: 0, value: 0 },
    dex: { strike: strikes[0], e: 0, value: 0 },
    vex: { strike: strikes[0], e: 0, value: 0 },
    vanna: { strike: strikes[0], e: 0, value: 0 },
    charm: { strike: strikes[0], e: 0, value: 0 },
  };

  for (const greek of GREEKS) {
    /* The anchor: the front leg over its desk twin, per strike and side. A
       desk twin near zero falls back to the greek's whole-book ratio. */
    const frontLegs = rows.map(r => r[greek]);
    const desk0 = deskLegs[greek][0] ?? frontLegs.map(() => ({ put: 0, call: 0 }));
    let sumF = 0;
    let sumD = 0;
    for (let s = 0; s < strikes.length; s++) {
      sumF += Math.abs(frontLegs[s].put) + Math.abs(frontLegs[s].call);
      sumD += desk0[s].put + desk0[s].call;
    }
    const globalK = sumD > EPS ? sumF / sumD : 1;
    const anchor = (s: number, side: 'put' | 'call') => {
      const f = frontLegs[s][side];
      const d = desk0[s][side];
      const k = d > EPS ? Math.abs(f) / d : globalK;
      const sign = f === 0 ? (side === 'put' ? 1 : -1) : Math.sign(f);
      return { k, sign };
    };
    for (let e = 0; e < expiries.length; e++) {
      const p: number[] = [];
      const c: number[] = [];
      const n: number[] = [];
      for (let s = 0; s < strikes.length; s++) {
        let pv: number;
        let cv: number;
        if (DIRECT.has(greek)) {
          pv = deskLegs[greek][e][s].put;
          cv = deskLegs[greek][e][s].call;
        } else if (e === 0) {
          pv = frontLegs[s].put;
          cv = frontLegs[s].call;
        } else {
          const ap = anchor(s, 'put');
          const ac = anchor(s, 'call');
          pv = ap.sign * ap.k * deskLegs[greek][e][s].put;
          cv = ac.sign * ac.k * deskLegs[greek][e][s].call;
        }
        const nv = pv + cv;
        p.push(pv);
        c.push(cv);
        n.push(nv);
        const a = Math.abs(nv);
        if (a > maxAbs[greek]) maxAbs[greek] = a;
        if (a > Math.abs(king[greek].value)) king[greek] = { strike: strikes[s], e, value: nv };
      }
      put[greek].push(p);
      call[greek].push(c);
      net[greek].push(n);
    }
  }

  /* THE SUPREME per greek: for gamma the profile's own pick (the full chain,
     not the window — the same strike the chart crowns); for the others the
     heaviest strike of the front book. Then the date carrying most of it. */
  const supreme = {} as Record<Greek, SupremeNode>;
  for (const greek of GREEKS) {
    let strike = front.levels.supreme;
    if (greek !== 'gex') {
      let best = 0;
      for (const r of rows) {
        const a = Math.abs(r[greek].net);
        if (a > best) {
          best = a;
          strike = r.strike;
        }
      }
    }
    const si = strikes.indexOf(strike);
    let e = 0;
    let value = 0;
    if (si >= 0) {
      for (let x = 0; x < expiries.length; x++) {
        const v = net[greek][x][si] ?? 0;
        if (Math.abs(v) > Math.abs(value)) {
          value = v;
          e = x;
        }
      }
    }
    supreme[greek] = { strike, e, value, total: si >= 0 ? rows[si][greek].net : 0 };
  }

  return {
    ticker,
    spot,
    changePct: spotChangePct(ticker),
    strikes,
    expiries,
    put,
    call,
    net,
    oi,
    maxAbs,
    king,
    supreme,
    levels: front.levels,
    front,
  };
}
