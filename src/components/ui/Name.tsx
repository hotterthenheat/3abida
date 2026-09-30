/*
==================================================
  SLAYER TERMINAL - THE NAME
  (components/ui/Name.tsx)

  A TICKER TRAVELS WITH ITS MARK, everywhere (Noah,
  2026-09-12: "you see how on trace when we mention
  a ticker we show the photo like this I need you to
  make this a global feature because this is a
  system flaw and this is one terminal so things
  should be the same"). Three ways in:

    <Name t="SPY" />            the mark and the name, inline
    <TickerText text="…" />     a sentence, every name in it marked
    withLeadingMark(children)   a door or a champion whose words
                                open with a name — the mark first

  A word is a name only when the terminal knows it
  — the universe, the sector roster, the watchlist,
  anything the simulator has seeded — and never
  when it is jargon that happens to be caps (OI,
  IV, GEX). No guessing: a guessed mark on "ATM"
  would be a lie in a tile.
==================================================
*/

import { Children, type ReactNode } from 'react';
import Simulator from '../../core/simulator';
import { UNIVERSE } from '../../data/universe';
import { SECTOR_UNIVERSE } from '../../data/darkpool';
import CompanyLogo from './CompanyLogo';

/** Caps that are words, never names — whatever the listings say */
const JARGON = new Set([
  'GEX', 'DEX', 'VEX', 'VNA', 'CHM', 'OI', 'IV', 'RSI', 'EMA', 'SMA', 'ATR', 'VWAP', 'ETF', 'DP', 'NBR', 'TP', 'TP1', 'TP2', 'TP3', 'TP4', 'AI',
  'DTE', 'ATM', 'OTM', 'ITM', 'ATS', 'PW', 'CW', 'PIN', 'SUP', 'BUY', 'SELL', 'MID', 'ASK', 'BID', 'CALL', 'PUT', 'NET', 'AM', 'PM', 'UTC', 'EST', 'ET',
  'CSV', 'PNG', 'PDF', 'USD', 'ID', 'OK', 'NA', 'ALL', 'ANY', 'NOW', 'LIVE', 'HIT', 'REF', 'STOP', 'MAX', 'MIN', 'AVG', 'VOL', 'OPEX', 'LEAPS', 'ODTE',
  'RTH', 'ETH', 'GBM', 'VPOC', 'POC', 'EOD', 'FOMC', 'CPI', 'GDP', 'PCE', 'PPI', 'FDA', 'CEO', 'CFO', 'COO', 'IPO', 'SEC', 'EPS', 'PE', 'PEG', 'EV',
]);

let base: Set<string> | null = null;
const known = (): Set<string> => {
  if (!base) {
    base = new Set<string>();
    for (const u of UNIVERSE) base.add(u.ticker);
    for (const s of SECTOR_UNIVERSE) for (const t of s.tickers) base.add(t);
    for (const t of Simulator.WATCHLIST) base.add(t);
  }
  return base;
};

/** True when the word is a name the terminal knows — never jargon, never a guess */
export const knownTicker = (word: string): boolean => {
  const w = word.replace(/^\$/, '');
  if (!/^[A-Z][A-Z0-9]{0,4}(?:\.[A-Z])?$/.test(w) || JARGON.has(w)) return false;
  return known().has(w) || !!Simulator.TICKERS[w];
};

interface NameProps {
  t: string;
  /** The mark's edge, px */
  size?: number;
  className?: string;
  /** What to print after the mark — the name itself by default */
  children?: ReactNode;
}

/** The mark and the name, inline — sits on the line like a word */
export const Name = ({ t, size = 12, className = '', children }: NameProps) => (
  <span className={`inline-flex items-center gap-1 align-[-2px] whitespace-nowrap ${className}`} data-name={t}>
    <CompanyLogo ticker={t} size={size} />
    {children ?? t}
  </span>
);

const WORD_RE = /(\$?\b[A-Z][A-Z0-9]{0,4}(?:\.[A-Z])?\b)/;

/** A sentence with every name in it marked — the prose that names a ticker never prints it bare */
export const TickerText = ({ text, size = 12, className }: { text: string; size?: number; className?: string }) => (
  <span className={className}>
    {text.split(WORD_RE).map((part, i) =>
      part && knownTicker(part) ? (
        <Name key={i} t={part.replace(/^\$/, '')} size={size}>
          {part}
        </Name>
      ) : (
        <span key={i}>{part}</span>
      )
    )}
  </span>
);

/** A door's or a champion's words that open with a name get the mark in front */
export const withLeadingMark = (children: ReactNode, size = 12): ReactNode => {
  const arr = Children.toArray(children);
  const first = arr[0];
  if (typeof first !== 'string') return children;
  const word = first.trim().split(/\s+/)[0] ?? '';
  if (!knownTicker(word)) return children;
  return (
    <>
      <CompanyLogo ticker={word.replace(/^\$/, '')} size={size} className="mr-1" />
      {children}
    </>
  );
};

export default Name;
