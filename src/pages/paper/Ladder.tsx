/*
==================================================
  SLAYER TERMINAL - THE LADDER (pages/paper/Ladder.tsx)

  The panel a futures desk is actually traded from:
  prices down the middle, your book on the sides,
  and one click to put an order at a level.

    P&L     what the open position is worth if it
            ends on that row
    BID     resting size — AT THE TOUCH ONLY. This
            desk's feed is a top of book; the nine
            rows under it are not ours to fill in,
            so they stay empty and the foot says so
    PRICE   the rung. The touch, the last and the
            position's average mark themselves here
    ASK     the same, at the touch
    LANE    the landmarks that fall on a rung — the
            session's high and low, its heaviest
            price, the dealer walls and the flip.
            A volume-at-price column would be the
            honest thing to put here and we cannot:
            see the note in core/paper/ladder.ts

  CLICKING IS ORDERING, on the ladder's own
  convention: on the buy side, under the market is
  a limit and over it a stop; on the sell side, the
  other way about. A click on your own resting
  order cancels it. Every one of those goes through
  the same engine as the chart and the ticket.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { Rows3 } from 'lucide-react';
import { fmtMoney, fmtPrice, tagWord, type Instrument } from '../../core/paper/instruments';
import type { Quote } from '../../core/paper/market';
import { cancelAll, cancelOrder, closePosition, reversePosition, submitOrder, usePaper, type Position } from '../../core/paper/engine';
import { MARK_WORDS, orderAt, readLadder, type LadderMark, type LadderRow } from '../../core/paper/ladder';
import { usePaperPrefs } from '../../core/paper/prefs';
import { useModes } from '../../core/paper/modes';

const GROUPS = [1, 2, 4, 10];
const ROW_H = 17;
/* THE RUNGS HAVE TO FIT THE RAIL. At 46/44/1fr/44/40 the volume column was
   pushed off the panel's own edge — a ladder is columns first, so they are
   measured against the width the desk gives it. */
const COLS = '46px 34px minmax(0,1fr) 34px 26px';
/** "+570" · "−1.2k" — a rung has no room for $1,392.00 */
const shortPnl = (v: number): string => {
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '+';
  if (a >= 10_000) return `${sign}${(a / 1000).toFixed(0)}k`;
  if (a >= 1000) return `${sign}${(a / 1000).toFixed(1)}k`;
  return `${sign}${a.toFixed(0)}`;
};

/* The lane at the right: the landmarks this rung carries, each in its own ink.
   V and the walls sat inline with the price and crowded it. */
const MARK_INK: Record<LadderMark, string> = {
  call: 'rgb(var(--bull))',
  put: 'rgb(var(--bear))',
  flip: 'rgb(var(--silver))',
  vpoc: 'rgb(var(--silver))',
  high: 'rgb(var(--text-secondary))',
  low: 'rgb(var(--text-secondary))',
};
const MARK_LETTER: Record<LadderMark, string> = { call: 'C', put: 'P', flip: 'F', vpoc: 'V', high: 'H', low: 'L' };

interface Props {
  instrument: Instrument;
  quote: Quote | null;
  position: Position | null;
}

const Ladder = ({ instrument, quote, position }: Props) => {
  const paper = usePaper();
  const prefs = usePaperPrefs();
  const modes = useModes();
  const [group, setGroup] = useState(1);
  const [rows, setRows] = useState(22);
  const [held, setHeld] = useState<number | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  /* the ladder follows the market unless the reader has taken it off centre */
  const read = useMemo(
    () => readLadder(instrument, quote, position, paper.orders, { rows, group, centre: held }),
    [instrument, quote, position, paper.orders, rows, group, held]
  );

  /* how many rows the panel has room for — a ladder that overflows is a list */
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const fit = () => {
      const n = Math.max(6, Math.min(60, Math.floor(el.clientHeight / ROW_H)));
      setRows(r => (Math.abs(r - n) > 1 ? n : r));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const qty = prefs.defaultQty;
  const mark = quote?.mark ?? 0;
  const tradable = quote != null && instrument.kind !== 'spread';

  /*
    SCROLLING THE LADDER OFF THE MARKET, which is the whole reason a ladder has
    a re-centre button. The wheel walks the rungs; the market keeps trading
    underneath, so the touch simply leaves the panel until LIVE brings it back.
    Bound by hand rather than through onWheel, because React's is passive and
    cannot stop the page scrolling with it.
  */
  const walkRef = useRef({ step: 1, mark: 0, held: null as number | null });
  walkRef.current = { step: read.step, mark, held };
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const { step, mark: m, held: h } = walkRef.current;
      if (!(step > 0) || !Number.isFinite(m) || m === 0) return;
      e.preventDefault();
      const rungs = e.deltaY > 0 ? -1 : 1;
      const from = h ?? m;
      const next = Number((Math.round(from / step) * step + rungs * step).toFixed(8));
      /* back within half a rung of the market is back ON the market */
      setHeld(Math.abs(next - m) < step / 2 ? null : next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const place = (side: 'buy' | 'sell', row: LadderRow) => {
    if (!tradable) return;
    /* a click on my own resting order takes it off, the way a ladder does */
    const mineHere = row.orders.filter(o => o.side === side);
    if (mineHere.length) {
      for (const o of mineHere) cancelOrder(o.id, 'panel', 'pulled from the ladder');
      return;
    }
    const type = orderAt(side, row.price, mark);
    submitOrder({
      instrument,
      side,
      qty,
      type,
      limitPrice: type === 'limit' ? row.price : undefined,
      stopPrice: type === 'stop' ? row.price : undefined,
      source: 'panel',
      note: 'from the ladder',
    });
  };

  const cell = 'flex items-center h-full px-1 tnum';
  const head = 'font-mono text-[8px] uppercase tracking-widest text-textMuted';

  return (
    <div className="h-full min-h-0 flex flex-col rounded-md border border-ink/[0.07] bg-panel overflow-hidden" data-paper-ladder={instrument.id}>
      {/* the head: the name, the spread, and how many ticks a rung covers */}
      <div className="shrink-0 h-8 px-2 flex items-center gap-1.5 border-b border-borderSubtle/70">
        <Rows3 className="w-3 h-3 text-textMuted shrink-0" aria-hidden />
        <span className="font-mono text-[10px] font-semibold text-textPrimary truncate">{tagWord(instrument)}</span>
        {quote && (
          <span className="font-mono text-[9px] tnum text-textMuted whitespace-nowrap" title={`The spread at the touch — ${read.spreadTicks} tick${read.spreadTicks === 1 ? '' : 's'}`}>
            {read.spreadTicks}t spread
          </span>
        )}
        <span className="ml-auto inline-flex items-center rounded border border-borderSubtle overflow-hidden" title="How many ticks each rung covers">
          {GROUPS.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              aria-pressed={group === g}
              data-ladder-group={g}
              className={`w-5 h-5 font-mono text-[9px] tnum transition-colors ${group === g ? 'bg-ink/[0.1] text-textPrimary' : 'text-textMuted hover:text-textSecondary'}`}
            >
              {g}
            </button>
          ))}
        </span>
      </div>

      {/* the columns */}
      <div className="shrink-0 grid items-center h-4 px-1 border-b border-borderSubtle/70" style={{ gridTemplateColumns: COLS }} aria-hidden>
        <span className={`${head} text-right pr-1`}>P&amp;L</span>
        <span className={`${head} text-right pr-1`}>Bid</span>
        <span className={`${head} text-center`}>Price</span>
        <span className={`${head} pl-1`}>Ask</span>
        <span className={`${head} text-center`} title="The landmarks that land on a rung">·</span>
      </div>

      {/* the rungs */}
      <div ref={bodyRef} className="flex-1 min-h-0 overflow-hidden" data-ladder-body>
        {read.rows.map((r, i) => {
          /* WHAT IS OFF THE TOP AND OFF THE BOTTOM rides the end rungs. Most of
             the day every landmark is outside five points of ladder, and a lane
             that is empty all day is the column we cut the volume one for. */
          const away = i === 0 ? read.above : i === read.rows.length - 1 ? read.below : [];
          const caret = i === 0 ? '\u2191' : '\u2193';
          const mineBuy = r.mine.buy > 0;
          const mineSell = r.mine.sell > 0;
          const buyKind = orderAt('buy', r.price, mark);
          const sellKind = orderAt('sell', r.price, mark);
          return (
            <div
              key={r.price}
              className={`grid items-stretch font-mono text-[10px] border-b border-ink/[0.04] ${r.isAvg ? 'bg-silver/[0.07]' : ''}`}
              style={{ height: ROW_H, gridTemplateColumns: COLS }}
              data-ladder-row={r.price}
              data-ladder-at={r.isBid ? 'bid' : r.isAsk ? 'ask' : r.isLast ? 'last' : undefined}
            >
              {/* what the position is worth if it ends here */}
              <span
                className="flex items-center justify-end h-full px-1 tnum text-[9px]"
                style={{ color: r.pnl == null || Math.abs(r.pnl) < 0.005 ? 'rgb(var(--text-muted))' : r.pnl > 0 ? 'rgb(var(--bull))' : 'rgb(var(--bear))', opacity: r.pnl == null ? 1 : 0.85 }}
                title={r.pnl == null ? undefined : `The open position is ${fmtMoney(r.pnl)} at ${fmtPrice(instrument, r.price)}`}
              >
                {r.pnl == null ? '' : shortPnl(r.pnl)}
              </span>

              {/* the buy side */}
              <button
                type="button"
                disabled={!tradable}
                onClick={() => place('buy', r)}
                data-ladder-buy={r.price}
                title={mineBuy ? `Cancel my ${r.mine.buy} resting here` : `${buyKind === 'limit' ? 'Buy limit' : 'Buy stop'} ${qty} at ${fmtPrice(instrument, r.price)}`}
                className={`${cell} justify-end border-r border-ink/[0.05] transition-colors disabled:cursor-default ${
                  mineBuy ? 'font-bold text-[#0a0a0a]' : r.isBid ? 'text-bull font-semibold' : 'text-textMuted hover:bg-bull/[0.14]'
                }`}
                style={mineBuy ? { background: 'rgb(var(--bull))' } : r.isBid ? { background: 'color-mix(in srgb, rgb(var(--bull)) 16%, transparent)' } : undefined}
              >
                {mineBuy ? r.mine.buy : r.bidSize != null ? r.bidSize : ''}
              </button>

              {/* the rung */}
              <span
                className={`${cell} justify-center tabular-nums ${r.isLast ? 'text-textPrimary font-bold' : 'text-textSecondary'}`}
                style={r.isLast ? { background: 'rgb(var(--ink) / 0.1)' } : undefined}
              >
                {r.isAvg && <span className="mr-1 text-[8px] font-bold text-textPrimary" title="The position's average entry">A</span>}
                {fmtPrice(instrument, r.price)}
              </span>

              {/* the sell side */}
              <button
                type="button"
                disabled={!tradable}
                onClick={() => place('sell', r)}
                data-ladder-sell={r.price}
                title={mineSell ? `Cancel my ${r.mine.sell} resting here` : `${sellKind === 'limit' ? 'Sell limit' : 'Sell stop'} ${qty} at ${fmtPrice(instrument, r.price)}`}
                className={`${cell} border-l border-ink/[0.05] transition-colors disabled:cursor-default ${
                  mineSell ? 'font-bold text-white' : r.isAsk ? 'text-bear font-semibold' : 'text-textMuted hover:bg-bear/[0.14]'
                }`}
                style={mineSell ? { background: 'rgb(var(--bear))' } : r.isAsk ? { background: 'color-mix(in srgb, rgb(var(--bear)) 16%, transparent)' } : undefined}
              >
                {mineSell ? r.mine.sell : r.askSize != null ? r.askSize : ''}
              </button>

              {/* the landmarks: the ones on this rung, or the ones past the end */}
              <span className="flex items-center justify-center gap-0.5 h-full font-mono text-[8px] font-bold" data-ladder-marks={r.marks.join(',') || undefined}>
                {r.queue && r.queue.left > 0 ? (
                  <span className="text-warn" title={`${r.queue.left} of ${r.queue.ahead} still in front of my order here`}>
                    {r.queue.left}
                  </span>
                ) : r.marks.length ? (
                  r.marks.slice(0, 2).map(m => (
                    <span key={m} style={{ color: MARK_INK[m] }} title={MARK_WORDS[m]}>
                      {MARK_LETTER[m]}
                    </span>
                  ))
                ) : (
                  away.slice(0, 2).map(a => (
                    <span
                      key={a.mark}
                      className="opacity-60"
                      style={{ color: MARK_INK[a.mark] }}
                      data-ladder-away={a.mark}
                      title={`${MARK_WORDS[a.mark]} is ${a.ticks} tick${a.ticks === 1 ? '' : 's'} ${i === 0 ? 'above' : 'below'} the ladder, at ${fmtPrice(instrument, a.price)}`}
                    >
                      {caret}
                      {MARK_LETTER[a.mark]}
                    </span>
                  ))
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* the hands at the foot, and the one thing the feed cannot tell us */}
      <div className="shrink-0 border-t border-borderSubtle/70">
        <div className="grid grid-cols-2 gap-px p-1">
          <button
            type="button"
            disabled={!tradable}
            onClick={() => submitOrder({ instrument, side: 'buy', qty, type: 'market', source: 'panel', note: 'from the ladder' })}
            data-ladder-market="buy"
            className="h-7 rounded font-mono text-[10px] font-bold uppercase tracking-wider bg-bull text-[#0a0a0a] hover:opacity-90 disabled:opacity-30 transition-opacity"
          >
            Buy {qty}
          </button>
          <button
            type="button"
            disabled={!tradable}
            onClick={() => submitOrder({ instrument, side: 'sell', qty, type: 'market', source: 'panel', note: 'from the ladder' })}
            data-ladder-market="sell"
            className="h-7 rounded font-mono text-[10px] font-bold uppercase tracking-wider bg-bear text-white hover:opacity-90 disabled:opacity-30 transition-opacity"
          >
            Sell {qty}
          </button>
        </div>
        <div className="px-1 pb-1 flex items-center gap-px">
          {[
            { k: 'flat', label: 'Flat', title: 'Close the position at the market', on: () => closePosition(instrument.id, 1, 'panel'), off: !position },
            { k: 'rev', label: 'Rev', title: 'Reverse the position', on: () => reversePosition(instrument.id, 'panel'), off: !position },
            { k: 'cxl', label: 'Cancel', title: 'Cancel every working order on this instrument', on: () => cancelAll(instrument.id, 'panel'), off: false },
            { k: 'centre', label: held == null ? 'Live' : 'Centre', title: held == null ? 'The ladder is following the market \u2014 scroll it to look away' : 'Back to the market', on: () => setHeld(null), off: held == null },
          ].map(b => (
            <button
              key={b.k}
              type="button"
              onClick={b.on}
              disabled={b.off}
              title={b.title}
              data-ladder-act={b.k}
              /* OFF THE MARKET IS A STATE, so the way back is lit while it lasts */
              className={`flex-1 h-6 rounded border font-mono text-[9px] uppercase tracking-wider disabled:opacity-30 disabled:hover:text-textSecondary disabled:hover:border-borderSubtle transition-colors ${
                b.k === 'centre' && held != null
                  ? 'border-warn/60 text-warn hover:bg-warn/[0.1]'
                  : 'border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <p className="px-2 pb-1.5 font-mono text-[8px] leading-tight text-textMuted" data-ladder-note>
          Size shows at the touch only — this desk's feed is a top of book, and the rows under it are not ours to fill in. The lane at the right marks the session's high and low, its heaviest price, and the dealer walls; a caret on the end rung means the nearest one lies past it.
          {modes.realisticFills ? ' Amber is what is still in front of your order there.' : ''}
        </p>
      </div>
    </div>
  );
};

export default Ladder;
