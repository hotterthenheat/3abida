/*
==================================================
  SLAYER TERMINAL - PAPER · WHAT THE DESK'S HANDS DO ON A CHART
  (pages/paper/deskHands.tsx)

  Round two's three ways of trading off the chart itself
  (the partner's, which Noah liked), said once here for
  every pane of the desk:

    THE POSITION'S BAR   a line a position of the pane's
                         name: in at, now, where it breaks
                         even with the fees both ways, the
                         ways out riding it and the reward
                         to the risk — and Close
    THE RIGHT-CLICK      what can be done AT A PRICE OF THE
                         NAME: a target or a stop put there
                         on a contract held, all of it
                         closed, a call or a put bought at
                         the money, what is working
                         cancelled — at the quick size
    A DRAWN LONG/SHORT   placed as an order: a call for a
                         long and a put for a short, the
                         strike nearest the entry, its
                         target and its stop set ON THE
                         NAME at the drawing's levels

  OPTIONS ONLY since 2026-09-30 — the futures' half of
  each of the three (a reversal, a limit or a stop at a
  price, a drawn short sold) went with them.

  Every one goes through the store's hands (data/paper/
  store.ts), so the engine says no in its own words.
==================================================
*/

import type { ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { TradeMark } from '../../components/gex/StrikeChart';
import type { ChartMenu, ChartMenuItem, ChartMenuSection } from '../../components/review/PositionLayer';
import type { BarLine } from '../../components/paper/PositionBar';
import { usd } from '../../components/review/words';
import { MULT, nameGoesUp } from '../../data/review/engine';
import { contractWords, type ContractId, type Quote } from '../../data/review/quotes';
import type { PaperAccount, PaperMarket, PaperView, OptDraft } from '../../data/paper/engine';
import { attachOpt, cancelOrder, closeOpt, placeOptOrder } from '../../data/paper/store';
import { setQuick } from '../../data/paper/desks';

export interface Hands {
  account: PaperAccount;
  m: PaperMarket;
  v: PaperView;
  /** The quick size */
  q: number;
  /** Why nothing can be done by hand (another tab holds the accounts) */
  lock: string | null;
  /** The contract the ticket holds — what an option pane's menu buys */
  picked: ContractId | null;
  /** The contract an option's "at the money" means on this name: the expiry to use */
  expiryOf: (name: string) => string | null;
  /** A strike on the name's listed grid, nearest a price */
  strikeNear: (name: string, price: number) => number;
  /** Where a name trades now */
  spotOf: (name: string) => number;
}


/* ================================================================== */
/*  THE POSITION'S BAR                                                  */
/* ================================================================== */

export function positionLines(h: Hands, name: string): BarLine[] {
  const { account, v, lock } = h;
  return v.opt
    .filter(p => p.contract.ticker === name)
    .map(p => {
      /* an option breaks even AT EXPIRY: the strike, plus (a call) or less (a put) what it cost a share, fees in */
      const c = p.contract;
      const costEach = (p.avg * MULT * p.qty + p.fees + (account.sandbox ? 0 : account.fee * p.qty)) / (MULT * p.qty);
      const even = c.right === 'C' ? c.strike + costEach : c.strike - costEach;
      const sells = account.opt.orders.filter(o => o.status === 'working' && o.side === 'sell' && o.price != null && o.contract.ticker === name && o.contract.strike === c.strike && o.contract.expiry === c.expiry && o.contract.right === c.right);
      const way = (kind: 'limit' | 'stop') => {
        const o = sells.find(x => x.kind === kind);
        if (!o) return null;
        return o.on === 'name' ? `${name} ${o.price!.toFixed(2)}` : o.price!.toFixed(2);
      };
      const facts: BarLine['facts'] = [
        { label: 'paid', value: p.avg.toFixed(2) },
        { label: 'bid', value: p.quote.bid.toFixed(2) },
        { label: 'even at expiry', value: `${name} ${even.toFixed(2)}` },
      ];
      const t = way('limit');
      const s = way('stop');
      if (t) facts.push({ label: 'target', value: t, ink: 'text-bull' });
      if (s) facts.push({ label: 'stop', value: s, ink: 'text-bear' });
      return {
        key: p.key,
        label: `${p.qty} × ${contractWords(c).replace(`${name} `, '')}`,
        tone: c.right === 'C' ? ('bull' as const) : ('bear' as const),
        facts,
        pnl: p.pnl,
        r: p.r,
        onClose: () => closeOpt(account.id, c, p.qty),
        locked: lock ?? (p.quote.dead ? 'No bid to sell into right now' : account.status !== 'open' ? 'This account is closed' : null),
      };
    });
}

/* ================================================================== */
/*  THE RIGHT-CLICK                                                     */
/* ================================================================== */

/** The card's head: the price it is at, and the quick size with its − and + */
const MenuHead = ({ at, q, unit }: { at: string; q: number; unit: string }) => (
  <div className="flex items-center gap-2">
    <span className="font-mono text-[12px] tnum font-semibold text-textPrimary" data-chart-menu-at>
      At {at}
    </span>
    <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] tnum text-textSecondary" data-chart-menu-size={q}>
      <button type="button" onClick={() => setQuick(q - 1)} disabled={q <= 1} aria-label="One fewer" className="inline-flex items-center justify-center w-5 h-5 rounded border border-borderSubtle hover:text-textPrimary hover:border-borderMuted disabled:opacity-30 transition-colors">
        <Minus className="w-2.5 h-2.5" />
      </button>
      <span className="min-w-[46px] text-center">
        {q} {unit}
      </span>
      <button type="button" onClick={() => setQuick(q + 1)} aria-label="One more" className="inline-flex items-center justify-center w-5 h-5 rounded border border-borderSubtle hover:text-textPrimary hover:border-borderMuted transition-colors">
        <Plus className="w-2.5 h-2.5" />
      </button>
    </span>
  </div>
);

export function chartMenu(h: Hands, name: string): (price: number) => ChartMenu | null {
  return (raw: number) => {
    const { account, m, v, q, lock } = h;
    const off = lock ?? (account.status !== 'open' ? 'This account is closed' : null);
    const sections: ChartMenuSection[] = [];
    let head: ReactNode;
    /* AN OPTION PANE: the chart is the NAME's, so a price here is a level of the name */
    const at = Math.round(raw * 100) / 100;
    const spot = h.spotOf(name);
    const atW = `${name} ${at.toFixed(2)}`;
    head = <MenuHead at={atW} q={q} unit={q === 1 ? 'contract' : 'contracts'} />;
    const held = v.opt.filter(p => p.contract.ticker === name);
    for (const p of held.slice(0, 2)) {
      const c = p.contract;
      const tIs = (kind: 'limit' | 'stop') => (nameGoesUp(kind, c.right) ? at > spot : at < spot);
      const items: ChartMenuItem[] = [];
      if (tIs('limit')) items.push({ label: `Target when ${name} reaches ${at.toFixed(2)}`, hint: 'Sells at the bid when the name gets there — the level holds, the dollars drift with decay', tone: 'bull', off, run: () => attachOpt(account.id, c, 'target', at, 'name'), testId: 'opt-target' });
      if (tIs('stop')) items.push({ label: `Stop if ${name} ${nameGoesUp('stop', c.right) ? 'rises' : 'falls'} to ${at.toFixed(2)}`, hint: 'Sells at the bid when the name gets there', tone: 'bear', off, run: () => attachOpt(account.id, c, 'stop', at, 'name'), testId: 'opt-stop' });
      items.push({ label: `Close all ${p.qty}`, off: off ?? (p.quote.dead ? 'No bid to sell into right now' : null), run: () => closeOpt(account.id, c, p.qty), testId: 'opt-close' });
      sections.push({ title: `${p.qty} × ${contractWords(c)}`, items });
    }
    const exp = h.expiryOf(name);
    if (exp) {
      const k = h.strikeNear(name, spot);
      const buy = (right: 'C' | 'P'): ChartMenuItem => {
        const c: ContractId = { ticker: name, strike: k, right, expiry: exp };
        const qt: Quote = m.optQuote(c);
        return { label: `Buy ${q} ${contractWords(c).replace(`${name} `, '')} at the ask`, hint: `${qt.ask.toFixed(2)} a share · ${usd(qt.ask * MULT * q)} — at the money, ${exp}`, tone: right === 'C' ? 'bull' : 'bear', off: off ?? (qt.dead ? 'No market in that contract right now' : null), run: () => placeOptOrder(account.id, { contract: c, side: 'buy', qty: q, kind: 'market' } as OptDraft), testId: right === 'C' ? 'buy-call' : 'buy-put' };
      };
      sections.push({ title: 'Now', items: [buy('C'), buy('P')] });
    }
    if (h.picked && h.picked.ticker === name) {
      const c = h.picked;
      const qt = m.optQuote(c);
      sections.push({ items: [{ label: `Buy ${q} ${contractWords(c).replace(`${name} `, '')} at the ask`, hint: `The order’s contract · ${qt.ask.toFixed(2)} a share`, tone: c.right === 'C' ? 'bull' : 'bear', off: off ?? (qt.dead ? 'No market in that contract right now' : null), run: () => placeOptOrder(account.id, { contract: c, side: 'buy', qty: q, kind: 'market' }), testId: 'buy-picked' }] });
    }
    const working = account.opt.orders.filter(o => o.status === 'working' && o.contract.ticker === name);
    if (working.length) sections.push({ items: [{ label: `Cancel ${working.length} working on ${name}`, off, run: () => working.forEach(o => cancelOrder(account.id, o.id)), testId: 'cancel-working' }] });
    return { head, sections };
  };
}

/* ================================================================== */
/*  A DRAWN LONG OR SHORT, AS AN ORDER                                  */
/* ================================================================== */

export interface MarkPlan {
  /** What it will do, in a sentence */
  words: string;
  /** What it risks and could make, at this size */
  money: string | null;
  place: (qty: number) => void;
  /** It cannot be: why */
  refused: string | null;
}

export function planOfMark(h: Hands, name: string, mark: TradeMark, qty: number): MarkPlan {
  const { account, m, lock } = h;
  const long = mark.kind === 'long';
  /* an option: a call for a long, a put for a short — the strike nearest the entry, its ways out ON THE NAME */
  const exp = h.expiryOf(name);
  if (!exp) return { words: `No expiry is listed for ${name} now`, money: null, place: () => undefined, refused: 'Nothing listed' };
  const right = long ? 'C' : 'P';
  const c: ContractId = { ticker: name, strike: h.strikeNear(name, mark.entry), right, expiry: exp };
  const qt = m.optQuote(c);
  const spot = qt.spot;
  const near = Math.abs(mark.entry - spot) / spot < 0.001;
  /* away from the money: a limit at what the contract would ask with the name at the entry */
  const limit = near ? null : Math.max(0.01, Math.round(m.optQuoteAt(c, mark.entry).ask * 100) / 100);
  const bracket = { on: 'name' as const, targets: [{ price: Math.round(mark.target * 100) / 100, qty }], stops: [{ price: Math.round(mark.stop * 100) / 100, qty }] };
  const words = `Buy ${qty} ${contractWords(c)} ${limit == null ? `at the ask — about ${qt.ask.toFixed(2)}` : `limit ${limit.toFixed(2)} — what it would ask with ${name} at ${mark.entry.toFixed(2)}`} · target when ${name} reaches ${mark.target.toFixed(2)} · stop if ${name} ${long ? 'falls' : 'rises'} to ${mark.stop.toFixed(2)}`;
  return {
    words,
    money: `Costs about ${usd((limit ?? qt.ask) * MULT * qty)} — the most it can lose`,
    place: n => placeOptOrder(account.id, { contract: c, side: 'buy', qty: n, kind: limit == null ? 'market' : 'limit', price: limit ?? undefined, bracket: { ...bracket, targets: [{ price: bracket.targets[0].price, qty: n }], stops: [{ price: bracket.stops[0].price, qty: n }] } }),
    refused: lock ?? (qt.dead && limit == null ? 'No market in that contract right now' : null),
  };
}
