/*
==================================================
  SLAYER TERMINAL - THE ORDER CARD'S PIECES, AND A
  FUTURE'S ORDER CARD
  (components/paper/OrderPanel.tsx)

  SINCE 2026-09-30 PAPER TRADES OPTIONS ONLY, so the
  futures card below is no longer on the Live Chart: it
  is THE BACKTEST'S (pages/review/FuturesDesk.tsx), which
  still replays futures. What the Live Chart takes from
  this file is its PIECES — the size, the two-way button,
  the price box, the brackets' head — which a strike's
  dropdown in the options chain is built from
  (components/paper/OptionsChain). The card as it was
  laid out, for the desk that still uses it:

  A future's Order card, laid out the way the prop
  firms' platforms lay theirs (Noah, 2026-09-22, with a
  picture of TopstepX: "they dont give it random buzzword
  names like 'the ticket' just simply Order"; then, of the
  ticket that filled its column around a gap: "what do you
  think we can do about all this empty space and the
  button layouts" — and, shown this card: "okay do that").
  Top to bottom:

    WHAT IT IS     the contract, and where it trades
    ORDER TYPE     Market · Limit · Stop — a limit's or a
                   stop's price in a box that steps a tick
                   either way
    THE POSITION   one line: none, or long or short so many
                   at a price, and what it is up or down
    SIZE           − [n] + and 1 · 3 · 5 · 10 · 15 — THE
                   DESK'S ONE SIZE (the chart's right-click
                   card and the position bar use the same)
    BUY · SELL     two buttons side by side, "Buy +1 @
                   Market": the house's quiet colours at rest,
                   the pointer on one fills it with its
                   direction (Noah: "buy and sell should keep
                   our colors with the hover being the
                   direction color like red or green") — one
                   press, no side to switch before it
    THE REST       Join bid · Join ask (a limit resting at
                   the bid or the ask), Close position ·
                   Reverse · Cancel orders (this contract's),
                   Flatten all · Cancel all (the account's)
    BRACKETS       always in sight — DISTANCES in points
                   from the fill, so either button carries
                   them: above a buy's fill and below a
                   sell's. With them: breakeven, trailing, a
                   second and a third target, and the size a
                   risk makes
    THE FOOT       one line: what a press sets aside and
                   costs — or, in the engine's own words, why
                   it would be refused

  The engine is asked before the press, for each button —
  the same refusals it would give after it. The brackets
  are kept for the next order, a product each
  (`slayer_paper_brackets_v1`).

  A FUTURE'S CARD ONLY (2026-09-22, the same evening: "the
  order is not a buy limit or a sell limit but rather a put
  or call"): a stock's or an index's options are ordered
  inside the chain's own dropdown
  (components/paper/OptionsChain), which borrows this
  card's pieces — the size, the two-way button, the price
  box.
==================================================
*/

import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import CompanyLogo from '../ui/CompanyLogo';
import LadderFields, { LADDER_AT_REST, bracketOf, type LadderDraft } from '../review/LadderFields';
import { dirInk, usd, usdSigned } from '../review/words';
import type { OrderKind, Side } from '../../data/review/engine';
import { onTick, type FutProduct } from '../../data/review/futuresTape';
import type { LadderBracket } from '../../data/review/ladder';

/** A future's order, as this card drafts it — the backtest's futures desk takes it from here (Paper traded futures, and
    kept this type, until 2026-09-30; its own engine lives in data/review/futuresEngine.ts) */
export interface FutDraft {
  symbol: string;
  side: Side;
  qty: number;
  kind: OrderKind;
  price?: number;
  tif?: 'day' | 'gtc';
  bracket?: LadderBracket;
  tag?: string;
}

const SILVER_FILL = 'rgb(var(--silver-fill))';
/** The sizes a press away — TopstepX's row */
const SIZES = [1, 3, 5, 10, 15];
export const labelCls = 'text-[10px] text-textMuted whitespace-nowrap';
const HOVER = { plain: 'hover:text-textPrimary hover:bg-ink/[0.05]', bull: 'hover:text-bull hover:bg-bull/[0.12]', bear: 'hover:text-bear hover:bg-bear/[0.12]' } as const;
/** The smaller buttons under the two: quiet, one line each */
export const grey =
  'h-[26px] min-w-0 px-2 rounded-md border border-borderSubtle bg-ink/[0.03] font-mono text-[10px] font-semibold uppercase tracking-wider text-textSecondary whitespace-nowrap overflow-hidden text-ellipsis enabled:hover:text-textPrimary enabled:hover:border-borderMuted enabled:hover:bg-ink/[0.06] disabled:opacity-35 disabled:cursor-not-allowed transition-colors';
const stepBtn = 'w-7 inline-flex items-center justify-center text-textSecondary enabled:hover:text-textPrimary enabled:hover:bg-ink/[0.06] disabled:opacity-35 disabled:cursor-not-allowed transition-colors';
const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

/** The house's pill switch (the tickets'): the one in hand in silver */
export const Pills = <T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; tone?: 'bull' | 'bear'; off?: boolean }[]; onChange: (v: T) => void; label: string }) => (
  <span role="group" aria-label={label} className="inline-flex h-8 rounded-md border border-borderSubtle p-[2px] gap-[2px]">
    {options.map(o => (
      <button
        key={o.value}
        type="button"
        disabled={o.off}
        aria-pressed={o.value === value}
        onClick={() => onChange(o.value)}
        className={`px-2.5 rounded-[4px] text-[11px] font-medium whitespace-nowrap transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${o.value === value ? '' : `text-textSecondary ${o.off ? '' : HOVER[o.tone ?? 'plain']}`}`}
        style={o.value === value ? { background: SILVER_FILL, color: '#0a0a0a' } : undefined}
        data-ticket-pill={o.value}
      >
        {o.label}
      </button>
    ))}
  </span>
);

/** THE PRICE a limit or a stop waits at, stepping a tick either way */
export const PriceBox = ({ value, onChange, step, label, placeholder }: { value: string; onChange: (v: string) => void; step: (dir: 1 | -1) => void; label: string; placeholder: string }) => (
  <span className="inline-flex items-stretch h-8 rounded-md border border-borderSubtle overflow-hidden" data-order-price>
    <button type="button" onClick={() => step(-1)} aria-label="A tick lower" className={stepBtn}>
      <Minus className="w-3 h-3" />
    </button>
    <input value={value} onChange={e => onChange(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" aria-label={label} placeholder={placeholder} className="w-[96px] border-x border-borderSubtle bg-panel px-2 text-center font-mono text-[12px] tnum text-textPrimary outline-none focus:bg-ink/[0.04]" data-ticket-field="price" />
    <button type="button" onClick={() => step(1)} aria-label="A tick higher" className={stepBtn}>
      <Plus className="w-3 h-3" />
    </button>
  </span>
);

/** THE SIZE — the desk's one size: − [n] + and the sizes a press away */
export const SizeRow = ({ q, onQ }: { q: number; onQ: (n: number) => void }) => {
  const [draft, setDraft] = useState(String(q));
  useEffect(() => setDraft(String(q)), [q]);
  const set = (n: number) => onQ(Math.max(1, Math.min(999, Math.round(n) || 1)));
  return (
    <div className="flex items-center gap-2 flex-wrap" data-order-size={q}>
      <span className="inline-flex items-stretch h-7 rounded-md border border-borderSubtle overflow-hidden">
        <button type="button" onClick={() => set(q - 1)} disabled={q <= 1} aria-label="One contract fewer" className={stepBtn}>
          <Minus className="w-3 h-3" />
        </button>
        <input
          value={draft}
          onChange={e => {
            const v = e.target.value.replace(/[^0-9]/g, '');
            setDraft(v);
            if (Number(v) >= 1) set(Number(v));
          }}
          onBlur={() => setDraft(String(q))}
          inputMode="numeric"
          aria-label="Contracts"
          title="Contracts a press — the chart's right-click card uses the same"
          className="w-11 border-x border-borderSubtle bg-panel text-center font-mono text-[12px] font-semibold tnum text-textPrimary outline-none focus:bg-ink/[0.04]"
          data-ticket-field="qty"
        />
        <button type="button" onClick={() => set(q + 1)} disabled={q >= 999} aria-label="One contract more" className={stepBtn}>
          <Plus className="w-3 h-3" />
        </button>
      </span>
      <span className="inline-flex items-center gap-1">
        {SIZES.map(n => (
          <button
            key={n}
            type="button"
            onClick={() => set(n)}
            aria-pressed={n === q}
            className={`h-7 min-w-[30px] px-2 rounded-full font-mono text-[11px] font-semibold tnum transition-colors ${n === q ? '' : 'border border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted'}`}
            style={n === q ? { background: SILVER_FILL, color: '#0a0a0a' } : undefined}
            data-order-size-pick={n}
          >
            {n}
          </button>
        ))}
      </span>
    </div>
  );
};

/** A BUY OR A SELL, one press: the house's quiet colours at rest, the direction's fill under the pointer */
export const Act = ({ side, count, at, why, onPress }: { side: Side; count: number; at: string; why: string | null; onPress: () => void }) => (
  <button
    type="button"
    onClick={onPress}
    disabled={!!why}
    title={why ?? undefined}
    className={`group h-10 min-w-0 px-2 rounded-md border border-borderMuted bg-ink/[0.04] font-mono text-[11px] font-semibold uppercase tracking-wider text-textPrimary whitespace-nowrap overflow-hidden text-ellipsis transition-colors disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:text-[#0a0a0a] ${side === 'buy' ? 'enabled:hover:bg-bull enabled:hover:border-bull' : 'enabled:hover:bg-bear enabled:hover:border-bear'}`}
    data-order-act={side}
  >
    {side === 'buy' ? 'Buy' : 'Sell'}{' '}
    <span className={`${side === 'buy' ? 'text-bull' : 'text-bear'} group-hover:text-current`}>
      {side === 'buy' ? '+' : '−'}
      {count}
    </span>{' '}
    @ {at}
  </button>
);

/** Where the position stands, in one line */
const PositionLine = ({ pos, price }: { pos: { long: boolean; qty: number; avg: number; pnl: number } | null; price: (v: number) => string }) => (
  <div className="flex items-center gap-2 h-5 font-mono text-[11px] tnum" data-order-position={pos ? (pos.long ? 'long' : 'short') : 'none'}>
    {pos ? (
      <>
        <span className={`font-semibold ${pos.long ? 'text-bull' : 'text-bear'}`}>
          {pos.long ? 'Long' : 'Short'} {pos.qty}
        </span>
        <span className="text-textMuted">@</span>
        <span className="text-textPrimary">{price(pos.avg)}</span>
        <span className={`ml-auto font-semibold ${dirInk(pos.pnl)}`}>{usdSigned(pos.pnl)}</span>
      </>
    ) : (
      <span className="text-textMuted">No open position</span>
    )}
  </div>
);

/** The engine's words for the two buttons, once where they agree */
export const whyWords = (buy: string | null, sell: string | null): string | null => (buy && sell ? (buy === sell ? buy : `Buy — ${buy} · Sell — ${sell}`) : buy ? `Buy — ${buy}` : sell ? `Sell — ${sell}` : null);

/** What the account-wide buttons ask of the desk */
interface Common {
  /** Why nothing can be pressed (another tab holds the accounts, the account is closed) */
  locked: string | null;
  /** Anything open or working anywhere on the account; anything working */
  anyOpen: boolean;
  anyWorking: boolean;
  /** Working orders on this contract */
  working: number;
  equity: number;
  /** Changes whenever the account or the market does: the refusals are asked again */
  version: string;
}
interface Hands {
  q: number;
  onQ: (n: number) => void;
  onCancelOrders: () => void;
  onFlattenAll: () => void;
  onCancelAll: () => void;
}
/** Join bid · Join ask / Close position · Reverse · Cancel orders / Flatten all · Cancel all */
const TheRest = ({ join, close, reverse, common, hands }: { join: { bid: string; ask: string; whyBid: string | null; whyAsk: string | null; onBid: () => void; onAsk: () => void }; close: { why: string | null; on: () => void }; reverse?: { why: string | null; on: () => void }; common: Common; hands: Hands }) => (
  <div className="flex flex-col gap-1.5" data-order-rest>
    <div className="grid grid-cols-2 gap-1.5">
      <button type="button" onClick={join.onBid} disabled={!!join.whyBid} title={join.whyBid ?? 'A buy limit resting at the bid'} className={grey} data-order-join="bid">
        Join bid {join.bid}
      </button>
      <button type="button" onClick={join.onAsk} disabled={!!join.whyAsk} title={join.whyAsk ?? 'A sell limit resting at the ask'} className={grey} data-order-join="ask">
        Join ask {join.ask}
      </button>
    </div>
    <div className={`grid gap-1.5 ${reverse ? 'grid-cols-3' : 'grid-cols-2'}`}>
      <button type="button" onClick={close.on} disabled={!!close.why} title={close.why ?? 'Flat, now — at the market; what is working on it goes first'} className={`${grey} enabled:hover:text-bear enabled:hover:border-bear/50`} data-order-close>
        Close position
      </button>
      {reverse && (
        <button type="button" onClick={reverse.on} disabled={!!reverse.why} title={reverse.why ?? 'Close it and open the same size the other way, at the market'} className={grey} data-order-reverse>
          Reverse
        </button>
      )}
      <button type="button" onClick={hands.onCancelOrders} disabled={!!common.locked || common.working === 0} title={common.locked ?? (common.working ? `Cancel the ${common.working} working here` : 'Nothing working here')} className={grey} data-order-cancel>
        Cancel orders
      </button>
    </div>
    <div className="grid grid-cols-2 gap-1.5">
      <button type="button" onClick={hands.onFlattenAll} disabled={!!common.locked || !common.anyOpen} title={common.locked ?? 'Everything open closed at the market, everything working cancelled — the whole account'} className={`${grey} enabled:hover:text-bear enabled:hover:border-bear/50`} data-order-flatten-all>
        Flatten all
      </button>
      <button type="button" onClick={hands.onCancelAll} disabled={!!common.locked || !common.anyWorking} title={common.locked ?? 'Every working order cancelled — the whole account'} className={grey} data-order-cancel-all>
        Cancel all
      </button>
    </div>
  </div>
);

/** THE BRACKETS' HEADING — handed to LadderFields, which puts it on its counts' row */
export const BracketsHead = ({ words, says }: { words: string; says?: string }) => (
  <span className="inline-flex items-baseline gap-2 min-w-0 grow basis-[120px] overflow-hidden" title={says ?? words}>
    <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-textPrimary">Brackets</span>
    <span className="text-[10px] text-textMuted truncate">{words}</span>
  </span>
);
const Brackets = ({ children }: { children: React.ReactNode }) => (
  <div className="pt-2.5 border-t border-borderSubtle/70 flex flex-col gap-2.5" data-order-brackets>
    {children}
  </div>
);

export const RiskSize = ({ shares, riskEach, onPick, words }: { shares: number[]; riskEach: number | null; onPick: (share: number) => void; words: string }) => (
  <div className="flex items-center gap-1.5 flex-wrap">
    <span className={labelCls}>{riskEach ? words : 'Size to risk — type a stop first'}</span>
    {shares.map(r => (
      <button key={r} type="button" disabled={!riskEach} onClick={() => onPick(r)} className="h-6 px-2 rounded-md border border-borderSubtle font-mono text-[10px] text-textSecondary hover:text-textPrimary hover:border-borderMuted disabled:opacity-30 disabled:cursor-not-allowed transition-colors" data-ticket-risk={r}>
        {+(r * 100).toFixed(1)}%
      </button>
    ))}
  </div>
);

/* ================================================================== */
/*  A FUTURE                                                           */
/* ================================================================== */

/** What a future's Order card asks of the desk — the live paper desk's, or the backtest's (2026-09-26, Noah: "make the
    contract orders look the same on the backtesting section for both options and futures" — ONE card, two desks; what
    differs is where the prices and the refusals come from) */
export interface FutOrderDesk extends Common {
  product: FutProduct;
  /** The month it is ("ESZ6") and where it trades */
  contract: string;
  last: number;
  /** Dollars a contract, each way */
  fee: number;
  /** The day margin a contract sets aside — null in an evaluation, which counts contracts instead */
  margin: number | null;
  capWords?: string;
  position: { long: boolean; qty: number; avg: number; pnl: number } | null;
  refuse: (d: FutDraft) => string | null;
  /** What a market order gives up — a tick against you, none in the sandbox: the brackets are measured from the FILL */
  slip: number;
}

const BRACKETS_KEY = 'slayer_paper_brackets_v1';
/** A future's brackets as the Order card keeps them — distances in points, a product each (the ladder reads them too);
    the backtest keeps its own under its own key */
export const readBrackets = (symbol: string, key = BRACKETS_KEY): LadderDraft => {
  try {
    const all = JSON.parse(localStorage.getItem(key) ?? 'null') as Record<string, Partial<LadderDraft>> | null;
    return { ...LADDER_AT_REST, ...(all?.[symbol] ?? {}) };
  } catch {
    return LADDER_AT_REST;
  }
};
const writeBrackets = (symbol: string, d: LadderDraft, key = BRACKETS_KEY) => {
  try {
    const all = JSON.parse(localStorage.getItem(key) ?? 'null') ?? {};
    localStorage.setItem(key, JSON.stringify({ ...all, [symbol]: d }));
  } catch {
    /* a private window: the brackets last as long as the page */
  }
};

/** A FUTURE'S ORDER AT A PRESS, ITS BRACKETS PRICED: the distances (points) turned into prices off where it will FILL — a
    market or a stop a tick against the press (`slip`, none in the sandbox), a limit at its price. The Order card's buttons
    and the ladder's rows both come through here, so a press anywhere carries the same brackets. */
export const futDraftAt = (a: { symbol: string; prod: FutProduct; last: number; slip: number; pos: { long: boolean; qty: number } | null; brackets: LadderDraft; side: Side; kind: OrderKind; price?: number; qty: number }): FutDraft => {
  const lastT = onTick(a.prod, a.last);
  const p = a.kind === 'market' ? undefined : a.price;
  const dir = a.side === 'buy' ? 1 : -1;
  const ref = p == null ? lastT + dir * a.slip : a.kind === 'stop' ? p + dir * a.slip : p;
  const exit = !!a.pos && a.pos.long !== (a.side === 'buy');
  const qtyIn = exit ? Math.max(0, a.qty - a.pos!.qty) : a.qty;
  const at = (v: string, sign: 1 | -1) => (num(v) != null && num(v)! > 0 ? onTick(a.prod, ref + sign * dir * num(v)!).toFixed(a.prod.decimals) : '');
  const priced: LadderDraft = { ...a.brackets, targets: a.brackets.targets.map(v => at(v, 1)), stops: a.brackets.stops.map(v => at(v, -1)) };
  const bracket = !exit || qtyIn > 0 ? bracketOf(priced, qtyIn, by => onTick(a.prod, a.side === 'buy' ? ref - by : ref + by)) : undefined;
  return { symbol: a.symbol, side: a.side, qty: a.qty, kind: a.kind, price: p, bracket };
};

export const FutOrderPanel = ({ desk, symbol, q, onQ, onPlace, onClose, onCancelOrders, onFlattenAll, onCancelAll, bracketsKey = BRACKETS_KEY }: { desk: FutOrderDesk; symbol: string; onPlace: (d: FutDraft) => void; onClose: () => void; /** Where the brackets are kept between orders — the backtest's own */ bracketsKey?: string } & Hands) => {
  const prod = desk.product;
  const pos = desk.position;
  const last = desk.last;
  const [kind, setKindRaw] = useState<OrderKind>('market');
  const [price, setPrice] = useState('');
  /** The brackets, as distances in points — kept for the next order, a product each */
  const [ladder, setLadderRaw] = useState<LadderDraft>(() => readBrackets(symbol, bracketsKey));
  useEffect(() => {
    setLadderRaw(readBrackets(symbol, bracketsKey));
    setKindRaw('market');
    setPrice('');
  }, [symbol, bracketsKey]);
  const setLadder: typeof setLadderRaw = next =>
    setLadderRaw(prev => {
      const d = typeof next === 'function' ? next(prev) : next;
      writeBrackets(symbol, d, bracketsKey);
      return d;
    });
  const f = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: prod.decimals, maximumFractionDigits: prod.decimals });
  const lastT = onTick(prod, last);
  /* a limit or a stop starts at the price, and steps a tick at a time */
  const setKind = (k: OrderKind) => {
    setKindRaw(k);
    if (k !== 'market' && !num(price)) setPrice(lastT.toFixed(prod.decimals));
  };
  const stepPrice = (dir: 1 | -1) => setPrice(onTick(prod, (num(price) ?? lastT) + dir * prod.tick).toFixed(prod.decimals));
  /* the market leans a tick against a press (none in the sandbox): a buy takes a tick over, a sell a tick under — the bid
     and the ask */
  const bid = onTick(prod, lastT - desk.slip);
  const ask = onTick(prod, lastT + desk.slip);

  /* THE BRACKETS AT THE PRESS: the distances turned into prices on the side the press takes (futDraftAt) */
  const draftFor = (side: Side, k: OrderKind = kind, px?: number, qty = q): FutDraft =>
    futDraftAt({ symbol, prod, last, slip: desk.slip, pos, brackets: ladder, side, kind: k, price: k === 'market' ? undefined : (px ?? num(price)), qty });
  const refuse = (d: FutDraft) => desk.locked ?? desk.refuse(d);
  const why = useMemo(
    () => ({
      buy: refuse(draftFor('buy')),
      sell: refuse(draftFor('sell')),
      bid: refuse(draftFor('buy', 'limit', bid)),
      ask: refuse(draftFor('sell', 'limit', ask)),
      reverse: pos ? refuse(draftFor(pos.long ? 'sell' : 'buy', 'market', undefined, pos.qty * 2)) : 'Nothing open to reverse',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [desk.version, desk.locked, q, kind, price, ladder, symbol, !!pos]
  );
  const press = (side: Side) => onPlace(draftFor(side));

  /* WHAT THE BRACKETS RISK AND COULD MAKE at this size: the distances, worked in dollars (either side the same) */
  const b = bracketOf(ladder, q);
  const covered = (b?.stops ?? []).reduce((x, r) => x + r.qty, 0);
  const atRisk = b?.stops?.length && covered >= q ? b.stops.reduce((x, r) => x + r.price * prod.pointValue * r.qty, 0) : null;
  const toMake = b?.targets?.length ? b.targets.reduce((x, r) => x + r.price * prod.pointValue * r.qty, 0) : null;
  const riskEach = atRisk != null ? atRisk / q : null;
  const stepPts = Math.max(8, Math.round((lastT * 0.0015) / prod.tick)) * prod.tick;
  const pts = (v: number) => v.toFixed(prod.decimals);
  const at = kind === 'market' ? 'Market' : `${num(price) != null ? f(num(price)!) : '…'} ${kind === 'limit' ? 'Lmt' : 'Stp'}`;
  const whyLine = desk.locked ?? whyWords(why.buy, why.sell);

  return (
    <div className="px-4 py-3 flex flex-col gap-2.5 flex-1" data-review-ticket={symbol}>
      {/* the contract, where it stands with you, and where it trades — one row */}
      <div className="flex items-center gap-2 min-w-0" title={`$${prod.pointValue.toLocaleString('en-US')} a point · a tick is ${usd(prod.tick * prod.pointValue)}`}>
        <CompanyLogo ticker={symbol} size={16} />
        <span className="font-mono text-[12px] font-bold text-textPrimary">{desk.contract}</span>
        <span className="min-w-0 flex-1">
          <PositionLine pos={pos} price={f} />
        </span>
        <span className="font-mono text-[11px] tnum whitespace-nowrap">
          <span className="text-textMuted">last</span> <span className="text-textPrimary">{f(lastT)}</span>
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap" data-order-type={kind}>
        <Pills label="Order type" value={kind} onChange={setKind} options={[{ value: 'market', label: 'Market' }, { value: 'limit', label: 'Limit' }, { value: 'stop', label: 'Stop' }]} />
        {kind !== 'market' && <PriceBox value={price} onChange={setPrice} step={stepPrice} label={kind === 'limit' ? 'Limit price' : 'Stop price'} placeholder={f(lastT)} />}
      </div>
      <SizeRow q={q} onQ={onQ} />
      <div className="grid grid-cols-2 gap-2">
        <Act side="buy" count={q} at={at} why={why.buy} onPress={() => press('buy')} />
        <Act side="sell" count={q} at={at} why={why.sell} onPress={() => press('sell')} />
      </div>
      <TheRest
        join={{ bid: f(bid), ask: f(ask), whyBid: why.bid, whyAsk: why.ask, onBid: () => onPlace(draftFor('buy', 'limit', bid)), onAsk: () => onPlace(draftFor('sell', 'limit', ask)) }}
        close={{ why: desk.locked ?? (pos ? null : 'Nothing open'), on: onClose }}
        reverse={{ why: why.reverse, on: () => pos && onPlace(draftFor(pos.long ? 'sell' : 'buy', 'market', undefined, pos.qty * 2)) }}
        common={desk}
        hands={{ q, onQ, onCancelOrders, onFlattenAll, onCancelAll }}
      />
      <Brackets>
        <LadderFields
          head={<BracketsHead words="points from the fill" says="Points from the fill — above a buy's, below a sell's; either button takes them" />}
          qty={q}
          value={ladder}
          onChange={setLadder}
          unit="pts"
          costWords="where you got in"
          target={{ title: 'How far past the fill the target waits — above a buy, below a sell', placeholder: i => pts(stepPts * (2 + i)) }}
          stop={{ title: 'How far against the fill the stop waits — a tick worse when it goes', note: 'your planned risk', placeholder: i => pts(stepPts * (1 + i * 0.5)) }}
          trail={{ placeholder: pts(stepPts), unit: 'pts' }}
        />
        <RiskSize shares={[0.005, 0.01, 0.02]} riskEach={riskEach} onPick={share => riskEach && onQ(Math.max(1, Math.floor((desk.equity * share) / riskEach)))} words="Size to a share of the account at risk" />
      </Brackets>
      <div className="mt-auto pt-2.5 border-t border-borderSubtle/70 font-mono text-[11px] tnum leading-relaxed" data-order-status>
        <div className="text-textSecondary">
          {desk.margin == null ? <span className="text-textPrimary font-semibold">{desk.capWords ?? 'no margin held'}</span> : (
            <>
              margin <span className="text-textPrimary font-semibold">{usd(desk.margin * q, 0)}</span>
            </>
          )}
          <span className="text-textMuted"> · fee {usd(desk.fee * q)}</span>
          {atRisk != null && (
            <>
              {' '}
              <span className="text-textMuted">· at risk</span> <span className="text-textPrimary font-semibold">{usd(atRisk, 0)}</span>
            </>
          )}
          {toMake != null && (
            <>
              {' '}
              <span className="text-textMuted">· could make</span> <span className="text-bull font-semibold">{usd(toMake, 0)}</span>
            </>
          )}
        </div>
        {whyLine ? (
          <div className="text-warn" data-ticket-why="no">
            {whyLine}
          </div>
        ) : (
          <div className="text-textMuted" data-ticket-why="ok">
            {atRisk == null ? 'No stop in the brackets: a trade will have no R' : 'Every press carries the brackets'}
          </div>
        )}
      </div>
    </div>
  );
};
