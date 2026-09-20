/*
==================================================
  SLAYER TERMINAL - THE ORDER TICKET AND THE FACTS
  (pages/paper/OrderTicket.tsx)

  The compact ticket at the chart's right — not a
  modal, a rail: the account, the instrument, the
  size with its quick sizes, the order type, a
  price where one is needed with the touch one
  click away, the optional bracket, and two
  buttons that say what they will pay. Under it
  the instrument's facts — a future's contract,
  expiration, tick and margin; an option's greeks
  and tape; a stock's touch — every number from
  market.ts, with where it came from.

  The ticket is one more hand on the same engine:
  it builds an OrderRequest and calls submitOrder,
  exactly as the chart's card does.
==================================================
*/

import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import CardTabs from '../../components/ui/CardTabs';
import { feeFor, fmtPrice, roundToTick, shortExpiry, tagWord, unitWord, type Instrument } from '../../core/paper/instruments';
import { sessionsLeft, type Quote } from '../../core/paper/market';
import { markPosition, submitOrder, type OrderType, type Position, type Side } from '../../core/paper/engine';
import { updatePaperPrefs, usePaperPrefs } from '../../core/paper/prefs';
import { FactRow, Money, PaperPill, ProvenanceChip, RailLabel, Toggle, fmtHold, sideFill } from './paperKit';

const TYPE_TABS = [
  { value: 'market', label: 'Market' },
  { value: 'limit', label: 'Limit' },
  { value: 'stop', label: 'Stop' },
] as const;

interface OrderTicketProps {
  instrument: Instrument;
  quote: Quote | null;
  /** A price the chart handed over — a right-click's, or the cursor's */
  seedPrice?: number | null;
}

export const OrderTicket = ({ instrument, quote, seedPrice }: OrderTicketProps) => {
  const prefs = usePaperPrefs();
  const [qty, setQty] = useState(prefs.defaultQty);
  const [type, setType] = useState<OrderType>('market');
  const [priceText, setPriceText] = useState('');
  const [bracket, setBracket] = useState(prefs.bracket.on);
  const [stopTicks, setStopTicks] = useState(prefs.bracket.stopTicks);
  const [targetTicks, setTargetTicks] = useState(prefs.bracket.targetTicks);
  const [confirm, setConfirm] = useState<Side | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  /* A new instrument, a fresh ticket — the size persists, the price does not */
  useEffect(() => {
    setPriceText('');
    setConfirm(null);
  }, [instrument.id]);
  useEffect(() => {
    if (seedPrice != null) setPriceText(String(roundToTick(instrument, seedPrice)));
  }, [seedPrice, instrument]);
  useEffect(() => {
    if (!said) return;
    const id = window.setTimeout(() => setSaid(null), 2400);
    return () => window.clearTimeout(id);
  }, [said]);

  /** the same dollars-and-cents the contract card speaks */
  const money = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const priceNum = Number(priceText);
  const priceOk = type === 'market' || (Number.isFinite(priceNum) && (priceNum > 0 || instrument.kind === 'spread'));
  const setDefaultQty = (n: number) => {
    setQty(n);
    updatePaperPrefs({ defaultQty: n });
  };

  const send = (side: Side) => {
    if (!priceOk) return;
    if (prefs.confirmOrders && confirm !== side) {
      setConfirm(side);
      return;
    }
    setConfirm(null);
    const o = submitOrder({
      instrument,
      side,
      qty,
      type,
      limitPrice: type === 'limit' ? priceNum : undefined,
      stopPrice: type === 'stop' ? priceNum : undefined,
      bracket: bracket ? { stopTicks, targetTicks } : undefined,
      source: 'ticket',
    });
    setSaid(o.status === 'rejected' ? `Rejected — ${o.rejectReason}` : o.status === 'filled' ? `Filled ${o.filledQty} @ ${o.avgFill}` : o.status === 'partial' ? `${o.filledQty} of ${o.qty} filled, the rest is working` : 'Working');
  };

  const btn = 'inline-flex items-center justify-center w-6 h-6 rounded border border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors';
  const touch = (side: Side) => (quote ? (side === 'buy' ? quote.ask : quote.bid) : null);
  const est = quote ? Math.abs(type === 'market' ? quote.mark : priceNum || quote.mark) : 0;
  const notional = instrument.kind === 'future' ? instrument.initialMargin * qty : est * instrument.multiplier * qty;
  /** The long words for the head's subject — in the tooltip, where they cost nothing */
  const subject =
    instrument.kind === 'future'
      ? `${instrument.name} · ${instrument.expiryLabel}`
      : instrument.kind === 'stock'
        ? `${instrument.symbol} shares`
        : `${shortExpiry(instrument.expiry)} · ${Math.max(0, sessionsLeft(instrument.expiry))} sessions left`;

  return (
    <div className="flex flex-col" data-order-ticket>
      {/*
        WHAT IT WILL TRADE BELONGS IN THE HEAD, not in fact rows. The symbol, the
        contract and its expiry were three rows here, the contract card under
        this ticket says all three again, and the strip over the chart says the
        first — one rail, the same name four times. A ticket must name its
        subject, so it keeps it as the card's own caption, and the rows go.
        What is left to trade with went the same way: the account panel over
        this ticket carries it. The ticket says what THIS order is and costs.
      */}
      <div className="flex items-center gap-2 px-3 h-8 border-b border-ink/[0.05]">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-textPrimary">Order ticket</span>
        <span className="font-mono text-[10px] font-semibold text-textSecondary truncate" data-ticket-subject title={subject}>
          {tagWord(instrument)}
        </span>
        <PaperPill className="ml-auto" />
      </div>
      <div className="px-3 pt-2.5 pb-3 flex flex-col gap-2.5">
        <div>
          <RailLabel>Position size</RailLabel>
          <div className="mt-1 flex items-center gap-1.5">
            <button type="button" onClick={() => setDefaultQty(Math.max(1, qty - 1))} className={btn} aria-label="One fewer">
              <Minus className="w-3 h-3" />
            </button>
            <input
              value={qty}
              onChange={e => setDefaultQty(Math.max(1, Math.round(Number(e.target.value) || 1)))}
              inputMode="numeric"
              aria-label="Size"
              data-ticket-qty
              className="w-12 h-7 text-center rounded border border-borderSubtle bg-inputBg font-mono text-[13px] font-bold tnum text-textPrimary outline-none focus:border-silver/60"
            />
            <button type="button" onClick={() => setDefaultQty(qty + 1)} className={btn} aria-label="One more">
              <Plus className="w-3 h-3" />
            </button>
            <span className="ml-auto inline-flex items-center gap-1">
              {prefs.quickQtys.map(n => (
                <button key={n} type="button" onClick={() => setDefaultQty(n)} className={`h-6 min-w-[26px] px-1 rounded border font-mono text-[10px] tnum transition-colors ${qty === n ? 'border-silver/60 text-textPrimary bg-ink/[0.06]' : 'border-borderSubtle text-textMuted hover:text-textPrimary hover:border-borderMuted'}`}>
                  {n}
                </button>
              ))}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <RailLabel>Order type</RailLabel>
          <CardTabs ariaLabel="Order type" options={TYPE_TABS} value={type} onChange={v => setType(v)} />
        </div>

        {type !== 'market' && (
          <div className="flex items-center gap-2">
            <RailLabel>{type === 'limit' ? 'Limit' : 'Stop'}</RailLabel>
            <input
              value={priceText}
              onChange={e => setPriceText(e.target.value)}
              onBlur={() => {
                const v = Number(priceText);
                if (Number.isFinite(v) && v !== 0) setPriceText(String(roundToTick(instrument, v)));
              }}
              placeholder={quote ? fmtPrice(instrument, quote.last) : '—'}
              inputMode="decimal"
              aria-label="Price"
              data-ticket-price
              className="ml-auto w-[104px] h-7 text-right px-2 rounded border border-borderSubtle bg-inputBg font-mono text-[12px] font-bold tnum text-textPrimary placeholder:text-textMuted placeholder:font-normal outline-none focus:border-silver/60"
            />
            <span className="inline-flex items-center gap-0.5">
              {(['bid', 'mid', 'ask'] as const).map(k => (
                <button
                  key={k}
                  type="button"
                  disabled={!quote}
                  onClick={() => quote && setPriceText(String(roundToTick(instrument, k === 'bid' ? quote.bid : k === 'ask' ? quote.ask : quote.mark)))}
                  className="h-6 px-1.5 rounded font-mono text-[9px] uppercase tracking-wider text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] disabled:opacity-40 transition-colors"
                >
                  {k}
                </button>
              ))}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Toggle checked={bracket} onChange={v => { setBracket(v); updatePaperPrefs({ bracket: { on: v } as never }); }} label="Bracket — attach a stop and a target" />
          <span className="font-mono text-[10px] text-textPrimary">Bracket</span>
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-textMuted" title="A stop and a target attached to the entry, in ticks from the fill">
            stop
            <input value={stopTicks} onChange={e => { const v = Math.max(1, Math.round(Number(e.target.value) || 1)); setStopTicks(v); updatePaperPrefs({ bracket: { stopTicks: v } as never }); }} inputMode="numeric" aria-label="Stop, in ticks" className="w-9 h-6 text-center rounded border border-borderSubtle bg-inputBg font-mono text-[10px] tnum text-textPrimary outline-none focus:border-silver/60" />
            tgt
            <input value={targetTicks} onChange={e => { const v = Math.max(1, Math.round(Number(e.target.value) || 1)); setTargetTicks(v); updatePaperPrefs({ bracket: { targetTicks: v } as never }); }} inputMode="numeric" aria-label="Target, in ticks" className="w-9 h-6 text-center rounded border border-borderSubtle bg-inputBg font-mono text-[10px] tnum text-textPrimary outline-none focus:border-silver/60" />
          </span>
        </div>
        {/*
          WHAT THOSE TICKS COST, because nobody thinks in ticks.

          The bracket was set in ticks alone: "stop 40" on NQ is two hundred
          dollars a contract and the ticket never said so. A tick is worth the
          tick size times the multiplier times the size, and those three live
          on the instrument, so the ticket can simply say it.

          ON AN OPTION THIS IS THE PREMIUM, not the underlying. A forty tick
          stop on a $6.00 call is forty CENTS of premium; it is not a move in
          the stock, and the two are not interchangeable. The desk trades the
          option's own tape here, so the bracket rides the premium, and the
          line says which it is rather than leaving it to be assumed.
        */}
        {bracket && (
          <div className="flex items-baseline gap-1.5 font-mono text-[10px] tnum" data-bracket-cost>
            <span className="text-textMuted">Risk</span>
            <span className="font-semibold text-bear">{money(stopTicks * instrument.tickSize * instrument.multiplier * qty)}</span>
            <span className="text-textMuted">to make</span>
            <span className="font-semibold text-bull">{money(targetTicks * instrument.tickSize * instrument.multiplier * qty)}</span>
            <span className="ml-auto text-textMuted">R:R</span>
            <span className="font-semibold" style={{ color: targetTicks / stopTicks >= 2 ? 'rgb(var(--bull))' : targetTicks / stopTicks >= 1 ? 'rgb(var(--text-primary))' : 'rgb(var(--bear))' }}>
              {(targetTicks / stopTicks).toFixed(2)}
            </span>
          </div>
        )}
        {bracket && instrument.kind === 'option' && (
          <p className="font-mono text-[9px] leading-snug text-textMuted" data-bracket-basis="premium">
            On the PREMIUM, not the underlying — {stopTicks} ticks is {money(stopTicks * instrument.tickSize)} off the contract's own price.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          {(['buy', 'sell'] as const).map(side => (
            <button
              key={side}
              type="button"
              disabled={!quote || !priceOk}
              onClick={() => send(side)}
              data-ticket-send={side}
              className={`h-12 rounded-md font-mono transition-opacity hover:opacity-90 disabled:opacity-40 flex flex-col items-center justify-center leading-tight ${
                confirm === side ? 'ring-2 ring-offset-1 ring-offset-panel ring-textPrimary' : ''
              } ${sideFill(side)}`}
            >
              {/* THE PRICE IS THE POINT OF THE BUTTON. The word above it is
                  already said by the colour and the position; the number is
                  what you are about to pay, and it was the smaller of the two. */}
              <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">{confirm === side ? 'Send it' : side === 'buy' ? 'Buy' : 'Sell'}</span>
              <span className="text-[15px] font-semibold tnum leading-none">{touch(side) != null ? fmtPrice(instrument, touch(side)!) : '—'}</span>
            </button>
          ))}
        </div>
        {confirm && (
          <button type="button" onClick={() => setConfirm(null)} className="-mt-1 font-mono text-[9px] uppercase tracking-widest text-textMuted hover:text-textPrimary text-center">
            not yet — back
          </button>
        )}
        <div className="flex items-center justify-between font-mono text-[9px] tnum text-textMuted">
          <span title={instrument.kind === 'future' ? 'Initial margin held for the contracts' : 'What the order would cost or hold'}>
            {instrument.kind === 'future' ? 'margin' : 'cost'} <span className="text-textSecondary">${notional.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          </span>
          <span>
            fee <span className="text-textSecondary">${feeFor(instrument, qty).toFixed(2)}</span>/side
          </span>
        </div>
        {said && <div className="font-mono text-[10px] text-textSecondary animate-fade-in" data-ticket-said>{said}</div>}
      </div>
    </div>
  );
};

/* ---- the instrument's facts ---------------------------------------------------------------- */

export const InstrumentFacts = ({ instrument, quote, position }: { instrument: Instrument; quote: Quote | null; position: Position | null }) => {
  const m = position ? markPosition(position, quote ?? undefined) : null;
  const money = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div className="flex flex-col" data-instrument-facts>
      <div className="flex items-center gap-2 px-3 h-8 border-b border-t border-ink/[0.05]">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-textPrimary">{instrument.kind === 'future' ? 'The contract' : instrument.kind === 'stock' ? 'The name' : 'The option'}</span>
        {quote && <ProvenanceChip quote={quote} className="ml-auto" />}
      </div>
      <div className="px-3 py-2 flex flex-col">
        {instrument.kind === 'future' && (
          <>
            <FactRow label="Contract">{instrument.symbol} · {instrument.name}</FactRow>
            <FactRow label="Expiration">{instrument.expiryLabel}</FactRow>
            <FactRow label="Tick size">{instrument.tickSize}</FactRow>
            <FactRow label="Tick value">{money(instrument.tickSize * instrument.multiplier)}</FactRow>
            <FactRow label="Point value">{money(instrument.multiplier)}</FactRow>
            <FactRow label="Margin · initial" title="Reference initial margin per contract — an exchange-style figure">{money(instrument.initialMargin)}</FactRow>
          </>
        )}
        {instrument.kind === 'option' && (
          <>
            <FactRow label="Contract">{instrument.symbol}</FactRow>
            <FactRow label="Expiration">{instrument.expiry} · {Math.max(0, sessionsLeft(instrument.expiry))}s</FactRow>
            <FactRow label="Strike">{instrument.strike} {instrument.right === 'C' ? 'call' : 'put'}</FactRow>
          </>
        )}
        {instrument.kind === 'spread' && (
          <>
            <FactRow label="Strategy">{instrument.strategy}</FactRow>
            <FactRow label="Expiration">{instrument.expiry}</FactRow>
            {instrument.legs.map(l => (
              <FactRow key={l.option.id} label={l.ratio > 0 ? `Buy ${Math.abs(l.ratio)}` : `Sell ${Math.abs(l.ratio)}`}>
                {l.option.strike}{l.option.right}
              </FactRow>
            ))}
          </>
        )}
        {quote && (
          <>
            <FactRow label="Bid × size">
              {fmtPrice(instrument, quote.bid)} <span className="text-textMuted">× {quote.bidSize}</span>
            </FactRow>
            <FactRow label="Ask × size">
              {fmtPrice(instrument, quote.ask)} <span className="text-textMuted">× {quote.askSize}</span>
            </FactRow>
            <FactRow label="Last">{fmtPrice(instrument, quote.last)}</FactRow>
            {quote.greeks && (
              <>
                <FactRow label="IV">{quote.greeks.iv.toFixed(1)}%</FactRow>
                <FactRow label="Delta">{quote.greeks.delta.toFixed(3)}</FactRow>
                <FactRow label="Gamma">{quote.greeks.gamma.toFixed(4)}</FactRow>
                <FactRow label="Theta / day">{quote.greeks.theta.toFixed(3)}</FactRow>
                <FactRow label="Vega">{quote.greeks.vega.toFixed(3)}</FactRow>
              </>
            )}
            {quote.volume != null && <FactRow label="Volume">{quote.volume.toLocaleString('en-US')}</FactRow>}
            {quote.oi != null && <FactRow label="Open interest">{quote.oi.toLocaleString('en-US')}</FactRow>}
          </>
        )}
        {position && m && (
          <>
            <div className="mt-1.5 pt-1.5 border-t border-ink/[0.05]" />
            <FactRow label="Position">
              <span className={position.qty > 0 ? 'text-bull' : 'text-bear'}>{position.qty > 0 ? 'Long' : 'Short'} {Math.abs(position.qty)}</span> <span className="text-textMuted">{unitWord(instrument, Math.abs(position.qty))}</span>
            </FactRow>
            <FactRow label="Position value">{money(Math.abs(m.marketValue))}</FactRow>
            <FactRow label="Unrealized"><Money v={m.unrealized} /></FactRow>
            <FactRow label="Realized"><Money v={position.realized} /></FactRow>
            <FactRow label="Held">{fmtHold(Date.now() - position.openedAt)}</FactRow>
          </>
        )}
      </div>
    </div>
  );
};

export default OrderTicket;
