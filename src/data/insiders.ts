/*
==================================================
  SLAYER TERMINAL - INSIDERS (data/insiders.ts)

  What the people who run a company did with their
  own shares — and, far more, WHETHER THEY CHOSE
  TO. The partner's engine (2026-09-09), ported into
  the house.

  THE DISTINCTION THE PAGE EXISTS FOR. Most insider
  selling is a 10b5-1 plan: a schedule adopted
  months earlier, run automatically, the seller
  taking no view on the day it prints. "CFO sold
  $4M" without saying it was a plan is false in
  every way that matters. Chosen trades carry the
  information, and the asymmetry is sharp: there
  are many reasons to sell and essentially one
  reason to buy. So a chosen BUY is the loudest row
  on the page, and the signal is a word, not a
  score.

  THE CODE IS THE ROW. Most Form 4 rows are not
  trades: a grant (A), a conversion (M), a tax
  withholding (F) are compensation plumbing, and
  the F row even carries a per-share price — the
  valuation used for the withholding — which is
  exactly why trackers mistake it for a sale. So
  the page defaults to the open-market codes and
  keeps the rest one toggle away, never mixed in.

  THE PEOPLE ARE INVENTED: a real officer's name on
  a trade they did not make would be a fabricated
  record about a real person. A live feed puts the
  filing's reporting owner beside the role and
  every reading keeps working.
==================================================
*/

import { dayKey, h01, hash } from '../core/rng';
import { RECORD_UNIVERSE, recordPrice } from './recordUniverse';
import type { InsiderFlow, InsiderKind, InsiderRole, InsiderSignal, InsiderTrade, PlanState, TxCode, TxCodeMeta } from '../types/record';

export const TX_CODES: Record<TxCode, TxCodeMeta> = {
  P: { code: 'P', label: 'Open-market purchase', discretionary: true, openMarket: true, acquires: true, note: 'The insider bought with their own money at a price they accepted — the one row here with a single obvious motive behind it.' },
  S: { code: 'S', label: 'Open-market sale', discretionary: true, openMarket: true, acquires: false, note: 'A real sale into the market — though a sale has many motives a purchase does not: tax, diversification, a house.' },
  A: { code: 'A', label: 'Grant or award', discretionary: false, openMarket: false, acquires: true, note: 'The compensation committee acted, not the insider. No decision, no purchase, no price paid.' },
  M: { code: 'M', label: 'Option or RSU conversion', discretionary: false, openMarket: false, acquires: true, note: 'A derivative converting to shares under a plan. Mechanical — a sale the same day is usually funding the exercise, not an exit.' },
  F: { code: 'F', label: 'Shares withheld for tax', discretionary: false, openMarket: false, acquires: false, note: 'Shares withheld at vesting to cover withholding. They never reached the market; the price shown is the valuation used to compute it.' },
  G: { code: 'G', label: 'Gift', discretionary: true, openMarket: false, acquires: false, note: 'Chosen, but not a market transaction and no proceeds.' },
  D: { code: 'D', label: 'Returned to the company', discretionary: false, openMarket: false, acquires: false, note: 'Shares returned to the issuer under a plan — a buyback or a settlement, not a market sale.' },
};
export const OPEN_MARKET_CODES: TxCode[] = ['P', 'S'];
export const ALL_CODES: TxCode[] = ['P', 'S', 'A', 'M', 'F', 'G', 'D'];

/* FICTIONAL FILERS — see the header. A ROSTER PER COMPANY, built once over the
   whole universe so no invented person holds office at two companies (Noah,
   2026-09-09, on twelve names covering 110 companies: one director at eBay,
   Intel and Comcast on a single screen "looks fake"). The roster is keyed by
   the ticker alone: a CFO stays the CFO from one day to the next. */
const FIRSTS = ['Adaeze', 'Anders', 'Beatrix', 'Callum', 'Cordelia', 'Dagny', 'Desmond', 'Eloise', 'Emeka', 'Farah', 'Fenwick', 'Giselle', 'Gustav', 'Halima', 'Hollis', 'Imani', 'Ingrid', 'Jasper', 'Josephine', 'Kenji', 'Leonora', 'Lucian', 'Maren', 'Marisela', 'Matthias', 'Nadia', 'Nils', 'Odette', 'Oluwaseun', 'Priya', 'Quentin', 'Rashid', 'Rosalind', 'Sabine', 'Soren', 'Tabitha', 'Tomasz', 'Ulrika', 'Vance', 'Vivienne', 'Wendell', 'Xiomara', 'Yusuf', 'Zelda', 'Aurelio', 'Bronwyn', 'Caspian', 'Delphine'];
const LASTS = ['Adeyemi', 'Ashcroft', 'Bergström', 'Blackwood', 'Castellanos', 'Chaudhry', 'Delacroix', 'Dunmore', 'El-Amin', 'Fairbanks', 'Fitzwilliam', 'Groves', 'Haldane', 'Holloway', 'Ibarra', 'Iwasaki', 'Jorgensen', 'Kaplan', 'Kowalczyk', 'Lindqvist', 'Marchetti', 'Mbeki', 'Nakamura', 'Nyström', 'Okoro', 'Oyelaran', 'Pryce', 'Quintero', 'Ravensworth', 'Rutherford', 'Sallinen', 'Schreiber', 'Thorvald', 'Tremblay', 'Underhill', 'Vasquez', 'Voss', 'Whitlock', 'Winterbourne', 'Xu', 'Yamamoto', 'Zielinski', 'Abernathy', 'Bellingham', 'Carmichael', 'Danforth', 'Eriksen', 'Fontaine', 'Galloway', 'Hargreaves', 'Ilunga', 'Jankowski', 'Kirchner', 'Lockhart', 'Moreau', 'Nakagawa', 'Oduya', 'Pemberton', 'Rasmussen', 'Sørensen', 'Tanaka', 'Villanueva', 'Westergaard', 'Yeboah'];
/* The offices only one person can hold are handed out by rank per company, so a
   table never shows two chief executives of the same name */
const SINGULAR_ROLES: InsiderRole[] = ['CEO', 'CFO', 'COO'];
const PLURAL_ROLES: InsiderRole[] = ['Director', 'EVP', 'Chief Legal Officer', '10% owner'];
const ROSTER = 8;
interface Officer {
  person: string;
  role: InsiderRole;
}
const roleAt = (i: number): InsiderRole => (i < SINGULAR_ROLES.length ? SINGULAR_ROLES[i] : PLURAL_ROLES[(i - SINGULAR_ROLES.length) % PLURAL_ROLES.length]);
/* ONE hash split in two. Two hashes of strings that differ only in their last
   character are correlated under FNV (the state before the last byte is
   shared), so drawing the first name from "…|f" and the last from "…|l" reached
   a fraction of the pairs and the dedupe could not escape them (measured
   2026-09-09: 559 distinct names in 880 draws, 4,872 retries). */
const draw = (ticker: string, i: number, salt: number): string => {
  const h = hash(`roster|${ticker}|${i}|${salt}`);
  return `${FIRSTS[h % FIRSTS.length]} ${LASTS[Math.floor(h / FIRSTS.length) % LASTS.length]}`;
};
let rosters: Map<string, Officer[]> | null = null;
/** Every company's roster, once — the universe walked in order, a name never reused */
function universeRosters(): Map<string, Officer[]> {
  if (rosters) return rosters;
  const used = new Set<string>();
  const map = new Map<string, Officer[]>();
  for (const u of RECORD_UNIVERSE) {
    const list: Officer[] = [];
    for (let i = 0; i < ROSTER; i++) {
      let person = draw(u.ticker, i, 0);
      for (let salt = 1; used.has(person) && salt < 12; salt++) person = draw(u.ticker, i, salt);
      used.add(person);
      list.push({ person, role: roleAt(i) });
    }
    map.set(u.ticker, list);
  }
  rosters = map;
  return map;
}
/** A company's roster — a name outside the universe gets one drawn on the spot */
export const rosterOf = (ticker: string): Officer[] => universeRosters().get(ticker) ?? Array.from({ length: ROSTER }, (_, i) => ({ person: draw(ticker, i, 0), role: roleAt(i) }));

/** An OPEN-MARKET buy someone chose — a purchase inside a plan is not one */
export const isChosenBuy = (t: { code: TxCode; plan: PlanState }): boolean => {
  const m = TX_CODES[t.code];
  return m.openMarket && m.acquires && m.discretionary && t.plan !== 'plan';
};

const EMPTY: InsiderFlow = { ticker: '', trades: [], bought: 0, sold: 0, net: 0, plannedValue: 0, compValue: 0, buyerCluster: 0, openMarketBuys: 0, signal: 'quiet', windowDays: 0 };

/** One name's insider filings over a window — deterministic per session day */
export function insiderFlow(ticker: string, windowDays = 90, day = dayKey()): InsiderFlow {
  const sym = ticker.toUpperCase();
  const seed = `${sym}|${day}|ins`;
  /* Most names have a handful of filings in a quarter and some have none — an empty window is itself a fact */
  const count = Math.floor(h01(`${seed}|n`) * 7);
  const px = recordPrice(sym);
  const trades: InsiderTrade[] = [];
  let bought = 0;
  let sold = 0;
  let plannedValue = 0;
  let openMarketBuys = 0;
  let compValue = 0;
  const roster = rosterOf(sym);
  for (let i = 0; i < count; i++) {
    const s = `${seed}|${i}`;
    const { person, role } = roster[Math.floor(h01(`${s}|pn`) * roster.length)];
    /* The code is drawn first and everything follows from it; the mix is the real one's — mostly compensation plumbing */
    const cr = h01(`${s}|c`);
    const code: TxCode = cr < 0.2 ? 'M' : cr < 0.37 ? 'F' : cr < 0.51 ? 'A' : cr < 0.79 ? 'S' : cr < 0.9 ? 'P' : cr < 0.96 ? 'D' : 'G';
    const meta = TX_CODES[code];
    const kind: InsiderKind = meta.acquires ? 'BUY' : 'SELL';
    /* Three states; a plan is overwhelmingly a selling instrument */
    const pr = h01(`${s}|p`);
    const planRate = meta.acquires ? 0.1 : 0.6;
    const plan: PlanState = !meta.openMarket ? 'discretionary' : pr < planRate ? 'plan' : pr < planRate + 0.28 ? 'discretionary' : 'unknown';
    const daysAgo = Math.floor(h01(`${s}|d`) * windowDays) + 1;
    const shares = Math.round((500 + h01(`${s}|sh`) ** 2 * 120_000) / 100) * 100;
    const sincePct = Number(((h01(`${s}|m`) * 2 - 1) * 14).toFixed(1));
    const price = Number((px / (1 + sincePct / 100)).toFixed(2));
    const value = Math.round(shares * price);
    const heldAfter = Math.round(shares * (2 + h01(`${s}|h`) * 40));
    trades.push({ id: s, ticker: sym, role, person, code, kind, shares, price, value, daysAgo, plan, clusterCount: 0, heldAfter, stakePct: Number(((shares / (shares + heldAfter)) * 100).toFixed(1)), sincePct });
    /* Bought and sold are MARKET activity only; the plumbing is counted apart */
    if (meta.openMarket) {
      if (kind === 'BUY') {
        bought += value;
        if (isChosenBuy({ code, plan })) openMarketBuys += value;
      } else sold += value;
      if (plan === 'plan' && kind === 'SELL') plannedValue += value;
    } else compValue += value;
  }
  /* Clusters: distinct filers acting the same way inside 30 days */
  const recentBuyers = new Set(trades.filter(t => t.code === 'P' && t.daysAgo <= 30).map(t => t.person));
  const recentSellers = new Set(trades.filter(t => t.code === 'S' && t.daysAgo <= 30).map(t => t.person));
  for (const t of trades) {
    if (t.daysAgo > 30) continue;
    if (t.code === 'P') t.clusterCount = recentBuyers.size;
    else if (t.code === 'S') t.clusterCount = recentSellers.size;
  }
  trades.sort((a, b) => a.daysAgo - b.daysAgo);
  const net = bought - sold;
  /* The verdict, in the order that is the argument: a chosen buy first and against the smallest bar */
  const discretionarySold = sold - plannedValue;
  let signal: InsiderSignal = 'quiet';
  if (trades.length === 0) signal = 'quiet';
  else if (openMarketBuys > 0 && openMarketBuys >= discretionarySold) signal = 'accumulating';
  else if (discretionarySold > 0 && discretionarySold >= sold * 0.4) signal = 'distributing';
  else if (sold > 0) signal = 'scheduled selling';
  return { ticker: sym, trades, bought, sold, net, plannedValue, compValue, buyerCluster: recentBuyers.size, openMarketBuys, signal, windowDays };
}

/** Every filing across the universe, newest first — the page's feed */
export function insiderFeed(windowDays = 90, codes: TxCode[] = OPEN_MARKET_CODES, day = dayKey()): InsiderTrade[] {
  const keep = new Set(codes);
  return RECORD_UNIVERSE.flatMap(u => insiderFlow(u.ticker, windowDays, day).trades)
    .filter(t => keep.has(t.code))
    .sort((a, b) => a.daysAgo - b.daysAgo);
}

/** Names with chosen insider buying, heaviest first */
export function insiderBuyers(windowDays = 90, day = dayKey()): InsiderFlow[] {
  return RECORD_UNIVERSE.map(u => insiderFlow(u.ticker, windowDays, day))
    .filter(f => f.openMarketBuys > 0)
    .sort((a, b) => b.openMarketBuys - a.openMarketBuys);
}

const fmtM = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v.toFixed(0)}`);

/** What the window adds up to across the feed shown */
export function insidersSentence(rows: InsiderTrade[], windowDays: number): string {
  if (rows.length === 0) return `No insider filed a trade in the last ${windowDays} days.`;
  const market = rows.filter(t => TX_CODES[t.code].openMarket);
  const chosenBuys = market.filter(t => isChosenBuy(t));
  const sales = market.filter(t => t.kind === 'SELL');
  const planned = sales.filter(t => t.plan === 'plan');
  const buyValue = chosenBuys.reduce((s, t) => s + t.value, 0);
  const saleValue = sales.reduce((s, t) => s + t.value, 0);
  const names = [...new Set(chosenBuys.map(t => t.ticker))].slice(0, 4);
  const parts: string[] = [];
  if (chosenBuys.length) parts.push(`${chosenBuys.length} ${chosenBuys.length === 1 ? 'purchase' : 'purchases'} someone chose to make, ${fmtM(buyValue)} in ${names.join(', ')}${chosenBuys.length > names.length ? ' and more' : ''} — the rows on this page with one obvious motive.`);
  else parts.push('No insider chose to buy in this window.');
  if (sales.length) {
    const pct = Math.round((planned.length / sales.length) * 100);
    parts.push(`${sales.length} ${sales.length === 1 ? 'sale' : 'sales'} for ${fmtM(saleValue)}, ${pct}% of them on a 10b5-1 plan adopted months earlier — those carry no view on the day.`);
  }
  const plumbing = rows.length - market.length;
  if (plumbing) parts.push(`${plumbing} grants, conversions and withholdings shown — not trades.`);
  return parts.join(' ');
}
