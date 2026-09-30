/*
==================================================
  SLAYER TERMINAL - PAPER · A FUTURE'S LADDER
  (components/paper/DomLadder.tsx)

  The partner's price ladder (Noah liked it: "hotkeys,
  aldder"), in the house's row grammar — the chain's
  rows, a tick a row, the price the name trades at in
  the silver that means where you are.

    BUY · PRICE · SELL   the reader's own working orders
                         sit on their side of their
                         price, their size in a chip —
                         a press on one cancels it. A
                         press on an empty cell places the
                         quick size there: under the price
                         a LIMIT (it waits for a dip), over
                         it a STOP (it buys the break) —
                         and the mirror on the sell side
    VOLUME               what traded at each price this
                         session, as a bar (the feed gives
                         a bar's volume, spread over its
                         range — a stand-in, said so)
    AT THIS PRICE        with a position open, what it would
                         be up or down if the price were
                         there — its entry marked

  THERE IS NO BOOK TO SHOW. A real ladder shows the size
  resting at every price; the simulated feed has none, so
  no column pretends to. It centres itself on the price
  unless the reader has scrolled it, and the door at its
  foot brings it back.

  WHERE IT LIVES (2026-09-22 — Noah: "show me ours on the
  live chart for futures but it should be something that
  you can exit out of with ease"): `LadderDock`, a panel
  beside a future's chart — the chart gives it the room
  while it is open and takes it back when it closes. Its X,
  Esc inside it, or the chart head's Ladder door closes it.
  A press carries the Order card's brackets (futDraftAt).
==================================================
*/

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Crosshair, X } from 'lucide-react';
import { head, headWord } from '../review/DeskShell';
import { dirInk, usdSigned } from '../review/words';
import { onTick } from '../../data/review/futuresTape';
import { paperFut, futWords } from '../../data/paper/products';
import type { Candle } from '../../types/market';

export interface LadderOrder {
  id: string;
  side: 'buy' | 'sell';
  qty: number;
  kind: 'limit' | 'stop' | 'market';
  price: number;
  exit: boolean;
}

interface Props {
  symbol: string;
  last: number;
  bars: Candle[];
  position: { long: boolean; qty: number; avg: number } | null;
  orders: LadderOrder[];
  q: number;
  locked: string | null;
  onBuyAt: (price: number) => void;
  onSellAt: (price: number) => void;
  onCancel: (orderId: string) => void;
  /** Why the last press was refused, in the engine's words — said at the foot a moment */
  notice?: string | null;
}

/** Ticks a side the ladder lists; the window shows what its height allows */
const SIDE_TICKS = 80;
const ROW_H = 20;

const DomLadder = ({ symbol, last, bars, position, orders, q, locked, onBuyAt, onSellAt, onCancel, notice = null }: Props) => {
  const p = paperFut(symbol);
  const lastT = onTick(p, last);
  /* the rows: a tick each, highest first, round the price — re-laddered only when the price has run most of the way off */
  const [mid, setMid] = useState(lastT);
  useEffect(() => {
    if (Math.abs(lastT - mid) > p.tick * SIDE_TICKS * 0.7) setMid(lastT);
  }, [lastT, mid, p.tick]);
  const rows = useMemo(() => Array.from({ length: SIDE_TICKS * 2 + 1 }, (_, i) => onTick(p, mid + (SIDE_TICKS - i) * p.tick)), [mid, p]);
  /* the session's volume at each price: each bar's volume spread evenly over the ticks of its range */
  const vol = useMemo(() => {
    const m = new Map<number, number>();
    for (const b of bars.slice(-390)) {
      const lo = onTick(p, b.low);
      const hi = onTick(p, b.high);
      const n = Math.max(1, Math.round((hi - lo) / p.tick) + 1);
      for (let k = 0; k < n; k++) {
        const px = onTick(p, lo + k * p.tick);
        m.set(px, (m.get(px) ?? 0) + b.volume / n);
      }
    }
    return m;
  }, [bars, p]);
  const maxVol = Math.max(1, ...rows.map(r => vol.get(r) ?? 0));
  const byPrice = useMemo(() => {
    const m = new Map<number, LadderOrder[]>();
    for (const o of orders) {
      const k = onTick(p, o.price);
      m.set(k, [...(m.get(k) ?? []), o]);
    }
    return m;
  }, [orders, p]);

  /* THE WINDOW FOLLOWS THE PRICE — until the reader scrolls it; the door brings it back */
  const box = useRef<HTMLDivElement | null>(null);
  const [follow, setFollow] = useState(true);
  const programmatic = useRef(false);
  useEffect(() => {
    const el = box.current;
    if (!el || !follow) return;
    const i = rows.findIndex(r => r <= lastT);
    const to = Math.max(0, i * ROW_H - el.clientHeight / 2 + ROW_H / 2);
    if (Math.abs(el.scrollTop - to) > ROW_H / 2) {
      programmatic.current = true;
      el.scrollTop = to;
    }
  }, [lastT, rows, follow]);
  const onScroll = () => {
    if (programmatic.current) {
      programmatic.current = false;
      return;
    }
    setFollow(false);
  };
  const pnlAt = (px: number) => (position ? (px - position.avg) * (position.long ? 1 : -1) * p.pointValue * position.qty : null);
  const cell = 'h-full inline-flex items-center justify-center font-mono text-[10px] tnum';
  /* A SIDE'S CELL is a press of its own — a div that answers as a button (the keyboard too), since the reader's orders on it
     are buttons and a button cannot hold a button */
  const pressable = (onPress: () => void) => ({
    role: 'button' as const,
    tabIndex: locked ? -1 : 0,
    'aria-disabled': locked ? true : undefined,
    onClick: () => !locked && onPress(),
    onKeyDown: (e: { key: string; preventDefault: () => void }) => {
      if (locked || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      onPress();
    },
  });
  /* the P&L column stands only while a position is open — the volume takes its room otherwise */
  const cols = position ? 'grid-cols-[56px_84px_56px_minmax(0,1fr)_64px]' : 'grid-cols-[56px_84px_56px_minmax(0,1fr)]';

  return (
    <div className="flex flex-col min-h-0 flex-1" data-paper-dom={symbol}>
      <div className={`grid ${cols} px-3 h-7 items-center border-b border-borderSubtle/70 font-mono text-[9px] font-semibold uppercase tracking-widest text-[rgb(var(--grid-head))]`}>
        <span className="text-center text-bull">Buy</span>
        <span className="text-center">Price</span>
        <span className="text-center text-bear">Sell</span>
        <span className="pl-2" title="What traded at each price this session — the feed's bar volume, spread over each bar's range">
          Volume
        </span>
        {position && (
          <span className="text-right" title="What the position would be up or down with the price at that row">
            P&amp;L
          </span>
        )}
      </div>
      <div ref={box} onScroll={onScroll} className="relative flex-1 min-h-[240px] overflow-y-auto overscroll-contain" data-paper-dom-window>
        {rows.map(px => {
          const here = px === lastT;
          const above = px > lastT;
          const mine = byPrice.get(px) ?? [];
          const buys = mine.filter(o => o.side === 'buy');
          const sells = mine.filter(o => o.side === 'sell');
          const v = vol.get(px) ?? 0;
          const pnl = pnlAt(px);
          const entry = position && onTick(p, position.avg) === px;
          const chip = (list: LadderOrder[], side: 'buy' | 'sell') =>
            list.map(o => (
              <button
                key={o.id}
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onCancel(o.id);
                }}
                disabled={!!locked}
                title={`${o.side === 'buy' ? 'Buy' : 'Sell'} ${o.qty} ${o.kind} at ${futWords(symbol, o.price)}${o.exit ? ' — a way out' : ''}. Press to cancel it`}
                className={`h-[15px] min-w-[26px] px-1 rounded text-[9px] font-bold leading-none ${side === 'buy' ? 'bg-bull/[0.18] text-bull hover:bg-bull/30' : 'bg-bear/[0.18] text-bear hover:bg-bear/30'} ${o.kind === 'stop' ? 'ring-1 ring-inset ring-current' : ''} transition-colors`}
                data-paper-dom-order={o.id}
              >
                {o.qty}
                {o.kind === 'stop' ? ' s' : ''}
              </button>
            ));
          return (
            <div key={px} className={`grid ${cols} px-3 items-center border-b border-borderSubtle/30 ${here ? 'bg-silver/[0.12]' : ''}`} style={{ height: ROW_H }} data-paper-dom-row={px}>
              <div
                {...pressable(() => onBuyAt(px))}
                title={locked ?? (here ? `Buy ${q} at the market` : above ? `Buy ${q} stop at ${futWords(symbol, px)} — it buys the break` : `Buy ${q} limit at ${futWords(symbol, px)}`)}
                className={`${cell} gap-0.5 rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-silver ${locked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-bull/[0.10]'}`}
                data-paper-dom-buy={px}
              >
                {chip(buys, 'buy')}
              </div>
              <span className={`${cell} font-semibold ${here ? 'text-silver' : above ? 'text-textSecondary' : 'text-textSecondary'} ${entry ? 'underline decoration-dotted underline-offset-2' : ''}`} title={entry ? 'Where you got in' : undefined}>
                {futWords(symbol, px)}
              </span>
              <div
                {...pressable(() => onSellAt(px))}
                title={locked ?? (here ? `Sell ${q} at the market` : above ? `Sell ${q} limit at ${futWords(symbol, px)}` : `Sell ${q} stop at ${futWords(symbol, px)} — it sells the breakdown`)}
                className={`${cell} gap-0.5 rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-silver ${locked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-bear/[0.10]'}`}
                data-paper-dom-sell={px}
              >
                {chip(sells, 'sell')}
              </div>
              <span className="h-full pl-2 flex items-center" aria-hidden="true">
                <span className="h-[8px] rounded-sm bg-ink/[0.14]" style={{ width: `${(v / maxVol) * 100}%` }} />
              </span>
              {position && <span className={`${cell} justify-end ${pnl == null ? '' : dirInk(pnl)}`}>{pnl == null ? '' : usdSigned(pnl, 0)}</span>}
            </div>
          );
        })}
      </div>
      <div className="min-h-8 px-3 py-1.5 flex items-center gap-2 border-t border-borderSubtle/70 font-mono text-[10px] leading-snug text-textMuted">
        {notice ? (
          <span className="text-warn" data-paper-dom-notice>
            {notice}
          </span>
        ) : (
          <span>
            A press places <span className="text-textPrimary">{q}</span> — a limit under the price, a stop over it. A press on your order cancels it.
          </span>
        )}
        {!follow && (
          <button type="button" onClick={() => setFollow(true)} className="ml-auto shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-md border border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors" data-paper-dom-centre>
            <Crosshair className="w-3 h-3" /> Back to the price
          </button>
        )}
      </div>
    </div>
  );
};

/** THE LADDER BESIDE A FUTURE'S CHART: its head says whose it is and carries the X; Esc anywhere in it closes it too —
    kept to the ladder, so a drawing, a menu or the full screen keep their own Esc */
export const LadderDock = ({ contract, onClose, children }: { contract: string; onClose: () => void; children: ReactNode }) => (
  <div
    className="hidden lg:flex w-[340px] shrink-0 flex-col min-h-0 border-l border-borderSubtle bg-panel animate-soft-in"
    onKeyDown={e => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }}
    data-paper-ladder={contract}
  >
    <div className={head}>
      <span className={headWord}>Ladder</span>
      <span className="font-mono text-[11px] font-bold text-textPrimary">{contract}</span>
      <button type="button" onClick={onClose} title="Close the ladder (Esc)" aria-label="Close the ladder" className="ml-auto -mr-1.5 inline-flex items-center justify-center w-7 h-7 rounded-md text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors" data-paper-ladder-close>
        <X className="w-4 h-4" />
      </button>
    </div>
    {children}
  </div>
);

export default DomLadder;
