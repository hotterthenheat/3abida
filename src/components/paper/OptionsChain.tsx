/*
==================================================
  SLAYER TERMINAL - PAPER · A NAME'S OPTIONS, ORDERED
  FROM THE CHAIN (components/paper/OptionsChain.tsx)

  On the Live Chart a stock's or an index's options are
  traded FROM THE CHAIN (Noah, 2026-09-22: "obviously the
  order is not a buy limit or a sell limit but rather a
  put or call and you would need the actual options chain
  to see the vol, decay etc like we have for the dropdown
  of the weigher options chain" — shown the plan: "build it
  with the wider column"):

    CALLS | PUTS   the switch that IS the direction, at the
                   chain's head — filled green or red, the
                   way Buy and Sell are on an order card —
                   with the expiry and the Columns card
                   beside it
    THE CHAIN      the Weigher's own grid (components/
                   weigher/ChainGrid): its columns, the
                   market's line between two strikes, the
                   weigh-up (Stats · The Greeks) unfolding
                   under a picked strike — on the Live
                   Chart's quotes (feed.ts liveDeskChain), so
                   the price in the chain is the price a
                   press gets
    THE ORDER      INSIDE that dropdown, under the stats and
                   the greeks: the desk's one size, Buy at the
                   ask or a limit (the middle, unless another
                   price is typed), a spread sold against it,
                   and a folded "+ Target / Stop". A strike
                   the reader HOLDS says so on its row, and
                   its dropdown turns to the position — what
                   it is up or down, what it loses a day —
                   with Sell to close at the bid or a limit,
                   and Buy more.

  Its pieces are components/paper/OrderPieces: the
  size, the two-way button, the price box.
==================================================
*/

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import DropdownMulti from '../ui/DropdownMulti';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import { ChainCard, CHAIN_COLUMNS, COLUMN_GROUPS } from '../weigher/ChainGrid';
import { card, head, headWord } from '../review/DeskShell';
import LadderFields, { LADDER_AT_REST, bracketOf, type LadderDraft } from '../review/LadderFields';
import { dirInk, usd, usdSigned } from '../review/words';
import { Act, BracketsHead, Pills, PriceBox, SizeRow, labelCls, whyWords } from './OrderPieces';
import { MULT, type OrderKind } from '../../data/review/engine';
import { contractWords, legsOf, longLeg, spreadWidth, strikeWords, type ContractId, type Quote, type Right } from '../../data/review/quotes';
import type { OptDraft } from '../../data/paper/engine';
import type { DeskChain, DeskContract } from '../../data/weigherDesk';

const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
const COLS_KEY = 'slayer_paper_chain_cols';
/** What the chain opens with: the quote, the delta, the vol, the decay in dollars a day, the interest */
const PAPER_COLS = ['bid', 'ask', 'delta', 'iv', 'decay', 'oi'];
const readCols = (): string[] => {
  try {
    const kept = JSON.parse(localStorage.getItem(COLS_KEY) ?? 'null') as string[] | null;
    return Array.isArray(kept) ? CHAIN_COLUMNS.map(c => c.key).filter(k => kept.includes(k)) : PAPER_COLS;
  } catch {
    return PAPER_COLS;
  }
};

/** CALLS | PUTS — the direction, filled in its colour (index.css `.fill-*`: solid on dark, soft on the light page); the
    side not taken fills under the pointer (tints, on the light page — index.css) */
const SideSwitch = ({ right, onRight }: { right: Right; onRight: (r: Right) => void }) => (
  <span role="group" aria-label="Calls or puts" className="inline-flex h-7 rounded-md border border-borderSubtle p-[2px] gap-[2px]" data-paper-chain-side={right}>
    {(['C', 'P'] as const).map(r => {
      const on = right === r;
      const fill = r === 'C' ? 'fill-bull' : 'fill-bear';
      return (
        <button
          key={r}
          type="button"
          aria-pressed={on}
          onClick={() => onRight(r)}
          title={r === 'C' ? 'Calls — they gain when the name rises' : 'Puts — they gain when the name falls'}
          className={`px-3 rounded-[4px] font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${on ? fill : `text-textSecondary hover:text-[#0a0a0a] ${r === 'C' ? 'hover:bg-bull' : 'hover:bg-bear'}`}`}
          data-paper-chain-side-pick={r}
        >
          {r === 'C' ? 'Calls' : 'Puts'}
        </button>
      );
    })}
  </span>
);

interface ChainProps {
  ticker: string;
  chain: DeskChain | null;
  right: Right;
  onRight: (r: Right) => void;
  expiry: string | null;
  expiryOptions: DropdownOption<string>[];
  onExpiry: (e: string) => void;
  /** The strike whose dropdown is open */
  sel: number | null;
  /** A press on a strike: `clicks` is 2 on a double press, which only ever opens */
  onSelect: (strike: number, clicks?: number) => void;
  /** Strikes held on this side and expiry */
  held: ReadonlySet<number>;
  full: boolean;
  /** The order, under a strike's weigh-up */
  order: (c: DeskContract) => ReactNode;
}

const OptionsChain = ({ ticker, chain, right, onRight, expiry, expiryOptions, onExpiry, sel, onSelect, held, full, order }: ChainProps) => {
  const [cols, setColsRaw] = useState<string[]>(readCols);
  const setCols = (next: string[]) => {
    const ordered = CHAIN_COLUMNS.map(c => c.key).filter(k => next.includes(k));
    setColsRaw(ordered);
    try {
      localStorage.setItem(COLS_KEY, JSON.stringify(ordered));
    } catch {
      /* a private window: the columns last as long as the page */
    }
  };
  const shown = useMemo(() => CHAIN_COLUMNS.filter(c => cols.includes(c.key)), [cols]);
  return (
    <div className={`${card} flex flex-col min-w-0 ${full ? 'flex-1 min-h-0' : 'lg:flex-1 lg:min-h-0'}`} data-paper-chain={ticker}>
      <div className={`${head} h-auto min-h-10 py-1.5 flex-wrap gap-y-1.5`}>
        <span className={headWord}>Chain</span>
        <SideSwitch right={right} onRight={onRight} />
        {expiry && <DropdownSelect label="Expiry" bare value={expiry} options={expiryOptions} onChange={onExpiry} title="The expiry — those listed today; today’s leaves the list at 16:00" testId="paper-chain-expiry" />}
        <DropdownMulti label="Columns" values={cols} groups={COLUMN_GROUPS} onChange={setCols} emptyWord="Strike only" title="Which facts the chain shows" testId="paper-chain-columns" align="end" />
        {chain && (
          <span className="ml-auto font-mono text-[10px] tnum text-textMuted" title="The move the chain is charging for by this expiry, either way">
            ±{chain.expectedMovePct.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="relative flex-1 min-h-0 max-lg:h-[560px]" data-paper-chain-grid>
        {chain ? (
          <ChainCard chain={chain} right={right} sel={sel} onSelect={onSelect} cols={shown} centerKey={`${ticker}|${expiry}|${right}`} inlineDrill drillExtra={order} held={held} />
        ) : (
          <div className="h-full min-h-[200px] flex items-center justify-center font-mono text-[10px] uppercase tracking-widest text-textMuted">No expiry is listed right now</div>
        )}
      </div>
    </div>
  );
};

/* ================================================================== */
/*  THE ORDER, INSIDE A STRIKE'S DROPDOWN                               */
/* ================================================================== */

/** A position held at a strike of the chain's side and expiry — a single contract, or a spread bought on it */
export interface HeldHere {
  contract: ContractId;
  qty: number;
  avg: number;
  pnl: number;
  /** What it loses a day, in dollars, all else equal */
  decayDay: number;
}
/** What the order in a dropdown asks of the desk */
export interface ChainOrderDesk {
  /** Why the engine would refuse a draft — the lock (another tab, a closed account) folded in */
  refuse: (d: OptDraft) => string | null;
  locked: string | null;
  quoteWith: (c: ContractId, spot: number) => Quote;
  spotForBid: (c: ContractId, bid: number) => number | null;
  fee: number;
  free: number;
  equity: number;
  version: string;
  /** The desk's one size */
  q: number;
  onQ: (n: number) => void;
  heldAt: (strike: number) => HeldHere | null;
  /** The chain's strikes — what a spread can sell against the one in hand */
  strikes: number[];
  onPlace: (d: OptDraft) => void;
  onClose: (c: ContractId, qty: number) => void;
  /** The strike sold against the one in hand changed (0: a single again) — a host that marks the sold leg in its chain */
  onShort?: (k: number) => void;
}

/** The order in full view inside the chain's own scroll, never the page's: as little as it takes, its top kept in sight,
    its foot clear of the "back to the market" pill that floats at the grid's foot once the market's line is scrolled away */
const intoView = (el: HTMLElement | null) => {
  const vp = el?.closest<HTMLElement>('.ag-grid-viewport, .ag-body-viewport');
  if (!el || !vp) return;
  const r = el.getBoundingClientRect();
  const v = vp.getBoundingClientRect();
  const by = Math.min(r.bottom + 46 - v.bottom, r.top - 10 - v.top);
  if (by > 0) vp.scrollTo({ top: vp.scrollTop + by, behavior: 'smooth' });
};

const quiet = 'h-6 px-2 rounded-md border border-borderSubtle font-mono text-[10px] text-textSecondary hover:text-textPrimary hover:border-borderMuted disabled:opacity-35 disabled:cursor-not-allowed transition-colors';

/** THE ORDER — inside a strike's dropdown on the live paper desk, and the backtest's Order card (2026-09-26, Noah: "make the
    contract orders look the same on the backtesting section"): one composition, two desks */
export const ChainOrder = ({ c, ticker, expiry, spot, desk, word = true }: { c: Pick<DeskContract, 'strike' | 'right'>; ticker: string; expiry: string; spot: number; desk: ChainOrderDesk; /** The small "Order" word at its head — off inside a card that already says it */ word?: boolean }) => {
  const base: ContractId = { ticker, strike: c.strike, right: c.right, expiry };
  const pos = desk.heldAt(c.strike);
  /** A strike sold against it — a spread bought for a debit (nothing held yet) */
  const [short, setShort] = useState(0);
  const contract: ContractId = pos ? pos.contract : short ? { ...base, short } : base;
  const quote = desk.quoteWith(contract, spot);
  const mid = Math.round(((quote.bid + quote.ask) / 2) * 100) / 100;
  /** A limit's price, as typed — empty is the middle */
  const [limit, setLimit] = useState('');
  const limitPx = Math.max(0.01, num(limit) ?? mid);
  const [bracketsOpen, setBracketsOpen] = useState(false);
  const [ladder, setLadder] = useState<LadderDraft>(LADDER_AT_REST);
  const [basis, setBasis] = useState<'contract' | 'name'>('contract');
  const n = desk.q;
  const sellN = pos ? Math.max(1, Math.min(n, pos.qty)) : n;
  /* A STRIKE OPENED: its order brought into view once the grid has sized the dropdown to it — and again when the target
     and the stop unfold */
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => intoView(rootRef.current), 140);
    return () => window.clearTimeout(t);
  }, [bracketsOpen]);

  const buyDraft = (kind: OrderKind): OptDraft => {
    const on = basis === 'name' ? ('name' as const) : undefined;
    const inAt = kind === 'limit' ? limitPx : quote.ask;
    /* a trailing distance typed with no stop: the stop starts that far under the way in — or, on the name, on its bad side */
    const stopFromTrail = (by: number) => +(on === 'name' ? (contract.right === 'C' ? quote.spot - by : quote.spot + by) : Math.max(0.01, inAt - by)).toFixed(2);
    const rides = bracketsOpen ? bracketOf(ladder, n, stopFromTrail) : undefined;
    return { contract, side: 'buy', qty: n, kind, price: kind === 'limit' ? limitPx : undefined, bracket: rides ? { ...rides, on } : undefined };
  };
  const sellDraft = (kind: OrderKind): OptDraft => ({ contract, side: 'sell', qty: sellN, kind, price: kind === 'limit' ? limitPx : undefined });
  const why = useMemo(
    () => ({
      buy: desk.locked ?? desk.refuse(buyDraft('market')),
      buyLimit: desk.locked ?? desk.refuse(buyDraft('limit')),
      sell: pos ? (desk.locked ?? desk.refuse(sellDraft('market'))) : 'Nothing held here',
      sellLimit: pos ? (desk.locked ?? desk.refuse(sellDraft('limit'))) : 'Nothing held here',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [desk.version, desk.locked, n, limit, short, ladder, basis, bracketsOpen, !!pos]
  );

  /* THE STRIKES THAT CAN BE SOLD AGAINST IT, while nothing is held: further out, the nearest eight */
  const spreadOptions: DropdownOption<number>[] = pos
    ? []
    : [
        { value: 0, label: 'No', hint: 'A single contract' },
        ...desk.strikes
          .filter(k => (c.right === 'C' ? k > c.strike : k < c.strike))
          .sort((a, z) => (c.right === 'C' ? a - z : z - a))
          .slice(0, 8)
          .map(k => {
            const pair = { ...longLeg(base), short: k };
            const pq = desk.quoteWith(pair, spot);
            return { value: k, label: `Sell the ${strikeWords(k)}${c.right}`, hint: pq.dead ? 'No market in the pair right now' : `Costs ${pq.ask.toFixed(2)} · can make ${usd((spreadWidth(pair) - pq.ask) * MULT)} a spread` };
          }),
      ];
  const fees = desk.fee * (pos ? sellN : n) * legsOf(contract);
  const width = spreadWidth(contract);
  const levelFor = (bid: number) => desk.spotForBid(contract, +bid.toFixed(2))?.toFixed(2) ?? '';
  const fallsOrRises = contract.right === 'C' ? 'falls to' : 'rises to';
  const priceBox = <PriceBox value={limit} onChange={setLimit} step={dir => setLimit(Math.max(0.01, limitPx + dir * 0.01).toFixed(2))} label="Limit price" placeholder={mid.toFixed(2)} />;

  if (pos) {
    const proceeds = quote.bid * MULT * sellN;
    const whyLine = desk.locked ?? whyWords(null, why.sell);
    return (
      <div ref={rootRef} className="pt-2.5 border-t border-ink/[0.08] flex flex-col gap-2.5" data-chain-order="held">
        <div className="flex items-center gap-2 flex-wrap font-mono text-[11px] tnum">
          <span className="text-[9px] font-bold uppercase tracking-widest text-textSecondary">Your position</span>
          <span className="font-semibold text-bull">Long {pos.qty}</span>
          <span className="text-textPrimary">{contractWords(pos.contract)}</span>
          <span className="text-textMuted">@ {pos.avg.toFixed(2)}</span>
          <span className={`font-semibold ${dirInk(pos.pnl)}`}>{usdSigned(pos.pnl)}</span>
          <span className="ml-auto text-bear" title="What it loses a day, all else equal">
            −{usd(pos.decayDay)} a day
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SizeRow q={n} onQ={desk.onQ} />
          <button type="button" onClick={() => desk.onQ(pos.qty)} className={quiet} data-chain-order-all>
            All {pos.qty}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Act side="sell" count={sellN} at={`Bid ${quote.bid.toFixed(2)}`} why={why.sell} onPress={() => desk.onPlace(sellDraft('market'))} />
          <Act side="sell" count={sellN} at={`${limitPx.toFixed(2)} Lmt`} why={why.sellLimit} onPress={() => desk.onPlace(sellDraft('limit'))} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={labelCls}>Limit</span>
          {priceBox}
          <button type="button" onClick={() => setLimit('')} className={quiet} title="The middle of the bid and the ask">
            Mid {mid.toFixed(2)}
          </button>
          <button type="button" onClick={() => desk.onPlace(buyDraft('market'))} disabled={!!why.buy} title={why.buy ?? `Add ${n} at the ask`} className={`${quiet} ml-auto enabled:hover:text-bull enabled:hover:border-bull/50`} data-chain-order-more>
            Buy {n} more @ {quote.ask.toFixed(2)}
          </button>
        </div>
        <div className="font-mono text-[11px] tnum leading-relaxed" data-order-status>
          <div className="text-textSecondary">
            {sellN} × {usd(quote.bid)} × 100 = <span className="text-textPrimary font-semibold">{usd(proceeds)}</span> <span className="text-textMuted">· fee {usd(fees)}</span>
          </div>
          {whyLine ? <div className="text-warn">{whyLine}</div> : <div className="text-textMuted">Sells {sellN === pos.qty ? 'all of it' : `${sellN} of ${pos.qty}`} — what is working on it gives way where it has to</div>}
        </div>
      </div>
    );
  }

  const px = quote.ask;
  const cost = px * MULT * n;
  const whyLine = desk.locked ?? whyWords(why.buy, null);
  return (
    <div ref={rootRef} className="pt-2.5 border-t border-ink/[0.08] flex flex-col gap-2.5" data-chain-order="buy">
      <div className="flex items-center gap-2 flex-wrap">
        {word && <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-textSecondary">Order</span>}
        <span className="font-mono text-[11px] font-semibold text-textPrimary">{contractWords(contract)}</span>
        {spreadOptions.length > 1 && <DropdownSelect label="Spread" value={short} options={spreadOptions} onChange={k => { setShort(k); desk.onShort?.(k); }} title="Sell a strike further out against it — a vertical spread, bought for a debit: cheaper, and capped at the distance between the two" testId="chain-order-spread" size="sm" />}
        <span className="ml-auto font-mono text-[10px] tnum text-textMuted">
          bid <span className="text-textPrimary">{quote.bid.toFixed(2)}</span> · mid <span className="text-textPrimary">{mid.toFixed(2)}</span> · ask <span className="text-textPrimary">{quote.ask.toFixed(2)}</span>
        </span>
      </div>
      <SizeRow q={n} onQ={desk.onQ} />
      <div className="grid grid-cols-2 gap-2">
        <Act side="buy" count={n} at={`Ask ${quote.ask.toFixed(2)}`} why={why.buy} onPress={() => desk.onPlace(buyDraft('market'))} />
        <Act side="buy" count={n} at={`${limitPx.toFixed(2)} Lmt`} why={why.buyLimit} onPress={() => desk.onPlace(buyDraft('limit'))} />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={labelCls}>Limit</span>
        {priceBox}
        <button type="button" onClick={() => setLimit('')} className={quiet} title="The middle of the bid and the ask">
          Mid {mid.toFixed(2)}
        </button>
        <button type="button" onClick={() => setBracketsOpen(o => !o)} aria-expanded={bracketsOpen} className={`${quiet} ml-auto ${bracketsOpen ? 'text-textPrimary border-silver/50' : ''}`} data-chain-order-brackets={bracketsOpen ? 'open' : 'folded'}>
          {bracketsOpen ? '− Target / Stop' : '+ Target / Stop'}
        </button>
      </div>
      {bracketsOpen && (
        <LadderFields
          head={<BracketsHead words={basis === 'name' ? `on ${ticker}’s price: the line holds, the dollars drift` : 'on the contract’s price: the dollars hold, the line drifts'} />}
          lead={<Pills label="What the target and the stop wait on" value={basis} onChange={b => { if (b !== basis) { setBasis(b); setLadder(l => ({ ...l, targets: ['', '', ''], stops: ['', ''] })); } }} options={[{ value: 'contract', label: 'Contract' }, { value: 'name', label: ticker }]} />}
          qty={n}
          value={ladder}
          onChange={setLadder}
          costWords="what you paid"
          target={{ title: basis === 'name' ? `Sells at the bid when ${ticker} reaches this` : 'Sells when the contract’s bid reaches this', placeholder: i => (basis === 'name' ? levelFor(quote.ask * (1.3 + i * 0.3)) : (quote.ask * (1.3 + i * 0.3)).toFixed(2)) }}
          stop={{ title: basis === 'name' ? `Sells at the bid if ${ticker} ${fallsOrRises} this` : 'Sells if the contract’s bid falls to this', placeholder: i => (basis === 'name' ? levelFor(quote.ask * (0.8 - i * 0.2)) : (quote.ask * (0.8 - i * 0.2)).toFixed(2)) }}
          trail={{ placeholder: basis === 'name' ? (quote.spot * 0.004).toFixed(2) : (quote.ask * 0.2).toFixed(2), unit: basis === 'name' ? `of ${ticker}` : 'a share' }}
        />
      )}
      <div className="font-mono text-[11px] tnum leading-relaxed" data-order-status>
        <div className="text-textSecondary">
          {n} × {usd(px)} × 100 = <span className="text-textPrimary font-semibold">{usd(cost)}</span> <span className="text-textMuted">· fee {usd(fees)}</span>
        </div>
        {whyLine ? (
          <div className="text-warn">{whyLine}</div>
        ) : (
          <div className="text-textMuted">
            Free after {usd(desk.free - cost - fees)} · {width > 0 ? `can lose what it costs, can make ${usd(Math.max(0, width - px) * MULT * n)}` : 'the most a buy can lose is what it costs'}
          </div>
        )}
      </div>
    </div>
  );
};

export default OptionsChain;
