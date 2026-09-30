/*
==================================================
  SLAYER TERMINAL - REVIEW · THE CHAIN BESIDE THE CHART
  (components/review/ChainCard.tsx)

  The options desk's chain, lifted out of it (2026-09-22)
  so the live paper desk trades from the same card: the
  backtest hands it the chain AS IT STOOD at the clock's
  minute, the paper desk the chain AS IT STANDS. Every
  ruling on it stands (pages/review/Desk.tsx's head note):

    THE CHAIN IS A WINDOW  its head and its column names
                           stay, its rows scroll inside;
                           it opens with the money in its
                           middle, and a strike that is
                           opened is brought into view
                           WITH its drop-down — by the
                           window's own scroll, never the
                           page's ("when i use the dropdown
                           the ticket is gone")
    EACH STRIKE HAS ITS    Stats and The Greeks, the
    OWN DROP-DOWN          Weigher's (ContractDrill)
    WHOSE CHAIN            with two names on the desk the
                           head says, in the silver the
                           chart on the desk wears
    HELD · SOLD            a strike held says so; the
                           strike sold against it in a
                           spread says that
==================================================
*/

import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { ChevronRight } from 'lucide-react';
import CompanyLogo from '../ui/CompanyLogo';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import ContractDrill from './ContractDrill';
import { card, head, headWord } from './DeskShell';
import { contractKey, longLeg, strikeWords, type ContractDay, type ContractId, type Quote, type Right } from '../../data/review/quotes';

export const SIDES: DropdownOption<Right>[] = [
  { value: 'C', label: 'Calls', hint: 'The right to buy — they gain when the name rises', tone: 'bull' },
  { value: 'P', label: 'Puts', hint: 'The right to sell — they gain when the name falls', tone: 'bear' },
];
/* the chain is never shorter than CHAIN_MIN_PX, however tall the ticket, and never taller than every strike it holds
   (CHAIN_MAX_PX: two heads and twenty-five rows) */
export const CHAIN_MAX_PX = 714;
export const CHAIN_MIN_PX = 328;

export interface ChainCardRow {
  strike: number;
  call: Quote;
  put: Quote;
}

interface Props {
  ticker: string;
  /** Its long name — the head's tooltip */
  title: string;
  spot: number;
  /** Two names on the desk: the head says whose chain it is */
  showName: boolean;
  /** "as it stood · 10:31" · "live" */
  stamp: string;
  right: Right;
  onRight: (r: Right) => void;
  expiry: string | null;
  expiryOptions: DropdownOption<string>[];
  onExpiry: (e: string) => void;
  /** What the expiry card's title says */
  expiryTitle: string;
  rows: ChainCardRow[];
  picked: ContractId | null;
  drillOpen: boolean;
  onPick: (c: ContractId) => void;
  /** The picked strike's day so far, for its drop-down */
  drill: ContractDay | null;
  /** A strike held (the contract, or a spread's bought leg) — and one sold against it */
  held: (strike: number) => boolean;
  sold: (strike: number) => boolean;
  full: boolean;
  /** When this changes the window opens on the money again (a new expiry, side, day, session) */
  centreKey: string;
}

const ChainCard = ({ ticker, title, spot, showName, stamp, right, onRight, expiry, expiryOptions, onExpiry, expiryTitle, rows, picked, drillOpen, onPick, drill, held, sold, full, centreKey }: Props) => {
  const rowsRef = useRef<HTMLDivElement | null>(null);
  const pickedKey = picked ? contractKey(picked) : '';
  /* it opens with the money in its middle */
  useLayoutEffect(() => {
    const box = rowsRef.current;
    const money = box?.querySelector<HTMLElement>('[data-chain-money]');
    if (box && money) box.scrollTop = money.offsetTop - box.clientHeight / 2;
  }, [centreKey, full]);
  /* …and a strike that is opened is brought into view WITH its drop-down */
  useLayoutEffect(() => {
    const box = rowsRef.current;
    const row = picked ? box?.querySelector<HTMLElement>(`[data-chain-row="${picked.strike}"]`)?.parentElement : null;
    if (!box || !row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    let to = box.scrollTop;
    if (bottom > to + box.clientHeight) to = Math.min(top, bottom - box.clientHeight);
    if (top < to) to = top;
    if (Math.abs(to - box.scrollTop) > 1) box.scrollTo({ top: to, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [pickedKey, drillOpen, full]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`${card} flex flex-col min-w-0 ${full ? 'flex-1 min-h-0' : 'lg:flex-1 lg:min-h-0 lg:max-h-[var(--chain-max)]'}`} style={full ? undefined : ({ '--chain-max': `${CHAIN_MAX_PX + (drillOpen && picked ? 320 : 0)}px` } as CSSProperties)} data-review-chain={expiry ?? ''}>
      <div className={`${head} flex-wrap h-auto min-h-9 py-1.5`}>
        <span className={headWord}>The chain</span>
        {/* WHOSE CHAIN: the name on the desk, in the same silver the chart on the desk wears */}
        {showName && (
          <span className="inline-flex items-center gap-1.5 h-5 pl-1 pr-1.5 rounded border border-silver/70 bg-silver/[0.12] font-mono text-[10px] tnum" title={`${title}'s chain — touch the other chart, or its name at the head of the tape, for the other`} data-review-chain-name={ticker}>
            <CompanyLogo ticker={ticker} size={12} />
            <span className="font-bold text-silver">{ticker}</span>
            <span className="text-textPrimary">{spot.toFixed(2)}</span>
          </span>
        )}
        <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">{stamp}</span>
        <span className="ml-auto flex items-center gap-2">
          <DropdownSelect label="Side" value={right} options={SIDES} onChange={onRight} title="Calls or puts" testId="review-side" size="sm" />
          {expiry && <DropdownSelect label="Expiry" value={expiry} options={expiryOptions} onChange={onExpiry} title={expiryTitle} align="end" testId="review-expiry" size="sm" />}
        </span>
      </div>
      <div className="grid grid-cols-[1.25fr_1fr_1fr_1fr_1fr_1fr] px-4 h-7 items-center border-b border-borderSubtle/70 font-mono text-[9px] font-semibold uppercase tracking-widest text-[rgb(var(--grid-head))]">
        <span className="pl-4">Strike</span>
        <span className="text-right">Bid</span>
        <span className="text-right">Ask</span>
        <span className="text-right">Delta</span>
        <span className="text-right">Decay/day</span>
        <span className="text-right" title="Implied volatility — what the price says about how far the name may move">
          IV
        </span>
      </div>
      {/* on the page the card is exactly as tall as the tape beside it (--tape-h, measured off the tape) and the window
          takes what its heads leave; in the takeover, what the ticket leaves; stacked on a phone, a fixed window */}
      <div ref={rowsRef} className="relative flex-1 min-h-0 max-lg:h-[402px] max-lg:flex-none overflow-y-auto overscroll-contain" role="listbox" aria-label="The chain" data-chain-window>
        {rows.map((r, i) => {
          const q = right === 'C' ? r.call : r.put;
          const c: ContractId = { ticker, strike: r.strike, right, expiry: expiry! };
          const on = picked != null && contractKey(longLeg(picked)) === contractKey(c);
          const mine = held(r.strike);
          const soldHere = sold(r.strike);
          const line = i > 0 && rows[i - 1].strike > spot && r.strike <= spot;
          return (
            <div key={r.strike}>
              {line && (
                <div className="flex items-center gap-2 px-4 h-5" aria-hidden="true" data-chain-money>
                  <span className="flex-1 h-px bg-borderMuted" />
                  <span className="font-mono text-[9px] tnum text-textSecondary">{spot.toFixed(2)}</span>
                  <span className="flex-1 h-px bg-borderMuted" />
                </div>
              )}
              <button
                type="button"
                role="option"
                aria-selected={on}
                aria-expanded={on && drillOpen}
                onClick={() => onPick(c)}
                className={`w-full grid grid-cols-[1.25fr_1fr_1fr_1fr_1fr_1fr] px-4 h-[26px] items-center font-mono text-[11px] tnum text-left transition-colors ${on ? 'bg-silver/[0.10]' : right === 'C' ? 'hover:bg-bull/[0.08]' : 'hover:bg-bear/[0.08]'}`}
                data-chain-row={r.strike}
              >
                <span className={`inline-flex items-center gap-1 font-semibold ${on ? 'text-silver' : 'text-textPrimary'}`}>
                  <ChevronRight className={`w-3 h-3 shrink-0 text-textMuted transition-transform duration-200 ${on && drillOpen ? 'rotate-90' : ''}`} aria-hidden="true" />
                  {strikeWords(r.strike)}
                  {mine && <span className="ml-1 text-[8px] font-bold uppercase tracking-wider text-silver">held</span>}
                  {soldHere && <span className="ml-1 text-[8px] font-bold uppercase tracking-wider text-textSecondary" title="The strike sold against the one bought — the other leg of a spread">sold</span>}
                </span>
                <span className="text-right text-textPrimary">{q.bid.toFixed(2)}</span>
                <span className="text-right text-textPrimary">{q.ask.toFixed(2)}</span>
                <span className="text-right text-textSecondary">{q.delta.toFixed(2)}</span>
                <span className="text-right text-textSecondary">{q.theta.toFixed(2)}</span>
                <span className="text-right text-textSecondary">{Math.round(q.iv * 100)}%</span>
              </button>
              {on && drillOpen && drill && <ContractDrill contract={c} quote={q} day={drill} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChainCard;
