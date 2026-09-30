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
                         to the risk — Reverse and Close
    THE RIGHT-CLICK      what can be done AT A PRICE: a
                         limit or a stop there, the market,
                         a target or a stop put there on
                         what is open, half or all of it
                         closed, a reversal, what is working
                         cancelled — at the quick size
    A DRAWN LONG/SHORT   placed as an order: a future's at
                         its entry (the market, a limit, or
                         a stop that buys the break), the
                         target and the stop riding it; an
                         option's is a call or a put on the
                         name, its target and its stop set
                         ON THE NAME at the drawing's levels

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
import { onTick } from '../../data/review/futuresTape';
import type { PaperAccount, PaperMarket, PaperView, FutDraft, OptDraft } from '../../data/paper/engine';
import { isPaperFuture, paperFut, futWords, frontOn } from '../../data/paper/products';
import { amendOrder, attachFut, attachOpt, cancelOrder, closeFut, closeOpt, placeFutOrder, placeOptOrder } from '../../data/paper/store';
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

const sign = (long: boolean) => (long ? 1 : -1);

/* ================================================================== */
/*  THE POSITION'S BAR                                                  */
/* ================================================================== */

export function positionLines(h: Hands, name: string): BarLine[] {
  const { account, v, lock } = h;
  if (isPaperFuture(name)) {
    const prod = paperFut(name);
    return v.fut
      .filter(p => p.symbol === name)
      .map(p => {
        /* breaks even where the points pay for the fees both ways: what is held came in with its fees, and goes out with as many */
        const feeEach = account.sandbox ? 0 : prod.fee;
        const even = p.avg + sign(p.long) * ((p.fees + feeEach * p.qty) / (prod.pointValue * p.qty));
        const exits = account.fut.orders.filter(o => o.status === 'working' && o.exit && o.symbol === name && o.price != null);
        const tgt = exits.filter(o => o.kind === 'limit').sort((a, b) => Math.abs(a.price! - p.avg) - Math.abs(b.price! - p.avg))[0];
        const stp = exits.filter(o => o.kind === 'stop').sort((a, b) => Math.abs(a.price! - p.avg) - Math.abs(b.price! - p.avg))[0];
        const facts: BarLine['facts'] = [
          { label: 'in', value: futWords(name, p.avg) },
          { label: 'now', value: futWords(name, p.last) },
          { label: 'even', value: futWords(name, onTick(prod, even)) },
        ];
        if (tgt) facts.push({ label: 'target', value: futWords(name, tgt.price!), ink: 'text-bull' });
        if (stp) facts.push({ label: 'stop', value: futWords(name, stp.price!), ink: 'text-bear' });
        if (tgt && stp) {
          const reward = Math.abs(tgt.price! - p.avg);
          const risk = Math.abs(p.avg - stp.price!);
          if (risk > 0) facts.push({ label: 'reward to risk', value: (reward / risk).toFixed(2) });
        }
        return {
          key: p.key,
          label: `${p.long ? 'Long' : 'Short'} ${p.qty} · ${p.contract}`,
          tone: p.long ? ('bull' as const) : ('bear' as const),
          facts,
          pnl: p.pnl,
          r: p.r,
          onClose: () => closeFut(account.id, name),
          onReverse: () => placeFutOrder(account.id, { symbol: name, side: p.long ? 'sell' : 'buy', qty: p.qty * 2, kind: 'market' }),
          locked: lock ?? (account.status !== 'open' ? 'This account is closed' : null),
        };
      });
  }
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
    if (isPaperFuture(name)) {
      const prod = paperFut(name);
      const at = onTick(prod, raw);
      const last = m.fut(name);
      const atW = futWords(name, at);
      head = <MenuHead at={atW} q={q} unit={q === 1 ? 'contract' : 'contracts'} />;
      const place = (d: Omit<FutDraft, 'qty' | 'symbol'> & { qty?: number }) => () => placeFutOrder(account.id, { symbol: name, qty: q, ...d });
      const below = at < last;
      const here: ChartMenuItem[] = [
        below
          ? { label: `Buy ${q} limit at ${atW}`, hint: 'Waits under the price — it buys a dip to here', tone: 'bull', off, run: place({ side: 'buy', kind: 'limit', price: at }), testId: 'buy-limit' }
          : { label: `Buy ${q} stop at ${atW}`, hint: 'Waits over the price — it buys the break of here', tone: 'bull', off, run: place({ side: 'buy', kind: 'stop', price: at }), testId: 'buy-stop' },
        below
          ? { label: `Sell ${q} stop at ${atW}`, hint: 'Waits under the price — it sells the breakdown through here', tone: 'bear', off, run: place({ side: 'sell', kind: 'stop', price: at }), testId: 'sell-stop' }
          : { label: `Sell ${q} limit at ${atW}`, hint: 'Waits over the price — it sells a rally to here', tone: 'bear', off, run: place({ side: 'sell', kind: 'limit', price: at }), testId: 'sell-limit' },
      ];
      sections.push({ items: here });
      sections.push({ title: 'Now', items: [
        { label: `Buy ${q} at the market`, tone: 'bull', off, run: place({ side: 'buy', kind: 'market' }), testId: 'buy-market' },
        { label: `Sell ${q} at the market`, tone: 'bear', off, run: place({ side: 'sell', kind: 'market' }), testId: 'sell-market' },
      ] });
      const pos = v.fut.find(p => p.symbol === name);
      if (pos) {
        const targetSide = pos.long ? at > last : at < last;
        const items: ChartMenuItem[] = [
          targetSide
            ? { label: `Target here — ${atW}`, hint: 'Takes the position out when it trades through here', tone: 'bull', off, run: () => attachFut(account.id, name, 'target', at), testId: 'target-here' }
            : { label: `Stop here — ${atW}`, hint: 'Takes the position out if it trades here', tone: 'bear', off, run: () => attachFut(account.id, name, 'stop', at), testId: 'stop-here' },
        ];
        if (pos.qty >= 2) items.push({ label: `Close half — ${Math.floor(pos.qty / 2)}`, off, run: () => placeFutOrder(account.id, { symbol: name, side: pos.long ? 'sell' : 'buy', qty: Math.floor(pos.qty / 2), kind: 'market' }), testId: 'close-half' });
        items.push({ label: `Close all ${pos.qty}`, off, run: () => closeFut(account.id, name), testId: 'close-all' });
        items.push({ label: `Reverse — go ${pos.long ? 'short' : 'long'} ${pos.qty}`, off, run: () => placeFutOrder(account.id, { symbol: name, side: pos.long ? 'sell' : 'buy', qty: pos.qty * 2, kind: 'market' }), testId: 'reverse' });
        const stops = account.fut.orders.filter(o => o.status === 'working' && o.exit && o.kind === 'stop' && o.symbol === name);
        const even = onTick(prod, pos.avg);
        if (stops.length && (pos.long ? last > even : last < even)) items.push({ label: `Stops to where you got in — ${futWords(name, even)}`, off, run: () => stops.forEach(o => amendOrder(account.id, o.id, even)), testId: 'stops-even' });
        sections.push({ title: `The ${pos.long ? 'long' : 'short'} ${pos.qty} · ${pos.contract}`, items });
      }
      const working = account.fut.orders.filter(o => o.status === 'working' && o.symbol === name);
      if (working.length) sections.push({ items: [{ label: `Cancel ${working.length} working on ${name}`, off, run: () => working.forEach(o => cancelOrder(account.id, o.id)), testId: 'cancel-working' }] });
      return { head, sections };
    }
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
  if (isPaperFuture(name)) {
    const prod = paperFut(name);
    const last = m.fut(name);
    const entry = onTick(prod, mark.entry);
    const target = onTick(prod, mark.target);
    const stop = onTick(prod, mark.stop);
    const near = Math.abs(entry - last) <= prod.tick;
    const kind: FutDraft['kind'] = near ? 'market' : long ? (entry < last ? 'limit' : 'stop') : entry > last ? 'limit' : 'stop';
    const how = kind === 'market' ? 'at the market' : kind === 'limit' ? `limit at ${futWords(name, entry)}` : `stop at ${futWords(name, entry)} — it ${long ? 'buys the break' : 'sells the breakdown'}`;
    const risk = Math.abs(entry - stop) * prod.pointValue * qty;
    const reward = Math.abs(target - entry) * prod.pointValue * qty;
    const draft: FutDraft = { symbol: name, side: long ? 'buy' : 'sell', qty, kind, price: kind === 'market' ? undefined : entry, bracket: { targets: [{ price: target, qty }], stops: [{ price: stop, qty }] } };
    return {
      words: `${long ? 'Buy' : 'Sell'} ${qty} ${frontOn(name, account.day)} ${how} · target ${futWords(name, target)} · stop ${futWords(name, stop)}`,
      money: `Risks ${usd(risk, 0)} to make ${usd(reward, 0)}${risk > 0 ? ` · ${(reward / risk).toFixed(2)} to 1` : ''}`,
      place: n => placeFutOrder(account.id, { ...draft, qty: n, bracket: { targets: [{ price: target, qty: n }], stops: [{ price: stop, qty: n }] } }),
      refused: lock,
    };
  }
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
