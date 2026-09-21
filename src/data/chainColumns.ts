/*
==================================================
  SLAYER TERMINAL - THE CHAIN'S COLUMN CATALOG
  (data/chainColumns.ts)

  Every fact a chain row can print, in the order a
  chain is read, with the family each one belongs
  to. Pure data: a column is a key, a name, a head
  and a function from a contract to text — no JSX,
  no grid, no React, so the catalog is cheap enough
  for any surface that shows a chain to import
  directly rather than re-declaring its own.

  It was re-declared, once: the paper desk's chain
  door carried its own bid/ask/mark/delta/IV/vol/OI
  list and so quietly missed the volume and open
  interest bars the Weigher's chain grew. That is
  the bug this file exists to make impossible.
==================================================
*/

import type { DeskContract } from './weigherDesk';

/* FILTERING A LADDER BY REMOVING ROWS THROWS AWAY THE LADDER. A chain's rows
   are not a list — they are a price axis, and a reader locates a strike by
   where it SITS relative to the market. Drop the out-of-the-money half and
   the survivors close ranks, the hairline lands at an edge, and the distance
   that carried the meaning is gone. So the focus DIMS: the rows stay exactly
   where they were and the ones you asked for are the ones that stay lit.
   (Fidelity's chain does it this way, and it is the right call.) */
export const NEAR_BAND = 0.05;
export type ChainFocus = 'all' | 'itm' | 'otm' | 'near';
/** Whether a contract is in the lit half. The market is the pivot; a strike
    the tape has exactly reached counts as in the money on either side. */
export const inChainFocus = (c: DeskContract, spot: number, focus: ChainFocus): boolean => {
  if (focus === 'near') return Math.abs(c.strike - spot) <= spot * NEAR_BAND;
  if (focus === 'itm') return c.right === 'C' ? spot >= c.strike : spot <= c.strike;
  if (focus === 'otm') return c.right === 'C' ? spot < c.strike : spot > c.strike;
  return true;
};

/* Compact and comfortable, the two densities a chain is actually read at:
   one to scan a whole expiry down the screen, one to sit on a handful of
   strikes. Row height and type size move together — a 24px row with 11px
   type is a squeeze, not a density. */
export type ChainDensity = 'compact' | 'comfortable';

export const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
export const fmtCount = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v));

/* ---- the chain's column catalog -------------------------------------------
   Every face of the contract the reference offers that is a FACT (Noah,
   2026-08-26, the customize-columns screenshots). The four return-on-…
   entries stayed out on purpose: a projected yield on a position is strategy
   advice wearing a stat's clothes, and we are not a broker. Order here IS
   column order; the menu speaks the reference's wording, the header speaks
   compact, and every jargon head carries its Term. */
/*
  THE SCOPE OF A BAR IS THE WHOLE POINT. A cell can carry a background bar
  showing how its number compares — but compares to WHAT decides whether the
  bar means anything. Normalised across every expiry, a weekly's volume is a
  sliver beside a LEAPS' open interest and the column reads as empty. Scoped
  to THE EXPIRY ON SCREEN, it answers the question a reader actually has:
  where is the action in this chain, today. (Fidelity draws it that way and
  it is the right call.)

  So `render` is handed the chain's own maxima rather than computing them, and
  the bar is a fraction of the column's largest visible value.
*/
export interface ChainScale {
  maxVolume: number;
  maxOi: number;
}

/** The catalog's families — the Columns card's sections, so a reader looking
    for a greek is not scanning thirty-one names in one list */
export type ChainColFamily = 'Quote' | 'Session' | 'Greeks & vol' | 'Odds' | 'Value' | 'Activity';
export const CHAIN_FAMILIES: ChainColFamily[] = ['Quote', 'Session', 'Greeks & vol', 'Odds', 'Value', 'Activity'];

export interface ChainCol {
  key: string;
  family: ChainColFamily;
  /** The menu's wording - the reference's own names */
  label: string;
  /** The column header's compact wording */
  head: string;
  term?: string;
  render: (c: DeskContract, scale: ChainScale) => { text: string; ink?: string; bold?: boolean; bar?: number };
}

const money = (v: number) => `$${v.toFixed(2)}`;
/* One decimal on every implied vol in the chain, the mark's and the quote's
   alike: a bid and an ask three tenths of a point apart print as the same
   number at zero decimals, which is the one thing these columns exist to
   show. An em dash when no vol explains the price. */
const ivPct = (v: number | null) => (v == null ? '—' : `${v.toFixed(1)}%`);
const signedPct = (v: number, dp = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(dp)}%`;

export const CHAIN_COLUMNS: ChainCol[] = [
  { key: 'mark', family: 'Quote', label: 'Mark', head: 'Mark', term: 'Mark', render: c => ({ text: money(c.mark), bold: true }) },
  /* IV SITS BESIDE THE PRICE IT CAME FROM. An implied vol is not a property
     of the contract, it is a property of a PRICE — and a chain that prints
     one IV in a column six places away from the quote makes the reader carry
     the pairing in their head. Market Chameleon runs Bid IV · Bid · Ask ·
     Ask IV for exactly that reason, so the vol you are being shown and the
     price it was read off are one glance apart, and the vol width of the
     market is the difference between two adjacent figures. */
  { key: 'bidIv', family: 'Quote', label: 'Bid IV', head: 'Bid IV', term: 'IV', render: c => ({ text: ivPct(c.bidIv) }) },
  { key: 'bid', family: 'Quote', label: 'Bid', head: 'Bid', render: c => ({ text: money(c.bid) }) },
  { key: 'ask', family: 'Quote', label: 'Ask', head: 'Ask', render: c => ({ text: money(c.ask) }) },
  { key: 'askIv', family: 'Quote', label: 'Ask IV', head: 'Ask IV', term: 'IV', render: c => ({ text: ivPct(c.askIv) }) },
  { key: 'bidSize', family: 'Quote', label: 'Bid size', head: 'Bid size', render: c => ({ text: fmtCount(c.bidSize) }) },
  { key: 'askSize', family: 'Quote', label: 'Ask size', head: 'Ask size', render: c => ({ text: fmtCount(c.askSize) }) },
  { key: 'last', family: 'Session', label: 'Last', head: 'Last', render: c => ({ text: money(c.last) }) },
  {
    key: 'netChange',
    family: 'Session',
    label: 'Net change',
    head: 'Net chg',
    render: c => ({
      text: `${c.netChange >= 0 ? '+' : '-'}$${Math.abs(c.netChange).toFixed(2)}`,
      ink: c.netChange >= 0 ? 'text-bull' : 'text-bear',
    }),
  },
  {
    key: 'changePct',
    family: 'Session',
    label: 'Change %',
    head: 'Chg %',
    render: c => ({ text: signedPct(c.netChangePct), ink: c.netChangePct >= 0 ? 'text-bull' : 'text-bear' }),
  },
  { key: 'high', family: 'Session', label: 'High', head: 'High', render: c => ({ text: money(c.high) }) },
  { key: 'low', family: 'Session', label: 'Low', head: 'Low', render: c => ({ text: money(c.low) }) },
  { key: 'prevClose', family: 'Session', label: 'Prev close', head: 'Prev close', render: c => ({ text: money(c.prevClose) }) },
  { key: 'delta', family: 'Greeks & vol', label: 'Delta', head: 'Delta', term: 'Delta', render: c => ({ text: c.delta.toFixed(2) }) },
  { key: 'gamma', family: 'Greeks & vol', label: 'Gamma', head: 'Gamma', term: 'Gamma', render: c => ({ text: c.gamma.toFixed(4) }) },
  { key: 'theta', family: 'Greeks & vol', label: 'Theta', head: 'Theta', term: 'Theta', render: c => ({ text: c.theta.toFixed(4) }) },
  { key: 'vega', family: 'Greeks & vol', label: 'Vega', head: 'Vega', term: 'Vega', render: c => ({ text: c.vega.toFixed(4) }) },
  { key: 'rho', family: 'Greeks & vol', label: 'Rho', head: 'Rho', term: 'Rho', render: c => ({ text: c.rho.toFixed(4) }) },
  { key: 'iv', family: 'Greeks & vol', label: 'IV', head: 'IV', term: 'IV', render: c => ({ text: ivPct(c.iv) }) },
  { key: 'itm', family: 'Odds', label: 'Probability ITM', head: 'ITM odds', term: 'ITM odds', render: c => ({ text: `${c.itmOdds.toFixed(0)}%` }) },
  { key: 'otm', family: 'Odds', label: 'Probability OTM', head: 'OTM odds', term: 'OTM odds', render: c => ({ text: `${(100 - c.itmOdds).toFixed(0)}%` }) },
  {
    key: 'touch',
    family: 'Odds',
    label: 'Probability of touching',
    head: 'Touch odds',
    term: 'Touch odds',
    render: c => ({ text: `${c.touchOdds.toFixed(0)}%` }),
  },
  {
    key: 'copLong',
    family: 'Odds',
    label: 'Chance of profit (long)',
    head: 'Profit odds L',
    term: 'Profit odds',
    render: c => ({ text: `${c.profitOddsLong.toFixed(0)}%` }),
  },
  {
    key: 'copShort',
    family: 'Odds',
    label: 'Chance of profit (short)',
    head: 'Profit odds S',
    term: 'Profit odds',
    render: c => ({ text: `${c.profitOddsShort.toFixed(0)}%` }),
  },
  { key: 'breakeven', family: 'Value', label: 'Breakeven', head: 'Breakeven', term: 'Breakeven', render: c => ({ text: money(c.breakeven) }) },
  { key: 'toBreakeven', family: 'Value', label: 'To breakeven', head: 'To B/E', term: 'To breakeven', render: c => ({ text: signedPct(c.toBreakevenPct) }) },
  { key: 'intrinsic', family: 'Value', label: 'Intrinsic value', head: 'Intrinsic', term: 'Intrinsic value', render: c => ({ text: money(c.intrinsic) }) },
  { key: 'extrinsic', family: 'Value', label: 'Extrinsic value', head: 'Extrinsic', term: 'Extrinsic value', render: c => ({ text: money(c.extrinsic) }) },
  {
    key: 'vol',
    family: 'Activity',
    label: 'Volume',
    head: 'Vol',
    term: 'Volume',
    render: (c, s) => ({ text: fmtCount(c.volume), bar: s.maxVolume > 0 ? c.volume / s.maxVolume : 0 }),
  },
  {
    key: 'oi',
    family: 'Activity',
    label: 'Open interest',
    head: 'OI',
    term: 'Open interest',
    render: (c, s) => ({ text: fmtCount(c.oi), bar: s.maxOi > 0 ? c.oi / s.maxOi : 0 }),
  },
];

/** The chain as it has always opened. */
export const DEFAULT_COLS = ['mark', 'delta', 'iv', 'itm', 'vol', 'oi'];
