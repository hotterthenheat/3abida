/*
==================================================
  SLAYER TERMINAL - THE LADDER (pages/paper/Ladder.tsx)

  The panel a futures desk is actually traded from,
  rebuilt to the one professional DOM whose layout
  is published rather than guessed at (Quantower's
  help site is an open GitBook, so its columns,
  controls and click grammar could be read at the
  source instead of inferred from screenshots).

  WHAT THAT CHANGED, from the first pass:

    MY ORDERS LEFT THE DEPTH COLUMN. A real ladder
    keeps the book and your own resting size in
    SEPARATE columns, so you can see both at one
    price. Painting mine over the size cell meant
    you could see either, never both.

    SIZE IS COLOUR, NOT BARS. The documented way to
    weigh a cell is a gradient scaled to a max, with
    the figure still legible on top. Only a running
    total is ever drawn as a histogram.

    THE PRICE COLUMN IS A MARKER GUTTER, carrying
    the bid, the ask, the last, the day's extremes
    and VWAP. Every one of those comes off prints
    alone, so a desk with no depth feed still draws
    the whole set — which is the honest answer to
    having no book below the touch.

    THE POSITION STRIP SITS AT THE FOOT, as a dim
    label over a bright value. That is also the
    typographic fix this whole desk needed: ours
    was 163 things all whispering at 10px.

  CLICKING IS ORDERING, on the documented grammar:
  under the market a limit, over it a stop, and
  SHIFT forces the other one. A click on your own
  resting order pulls it. Every one goes through
  the same engine as the chart and the ticket.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { Rows3, Settings2 } from 'lucide-react';
import { fmtMoney, fmtPrice, tagWord, type Instrument } from '../../core/paper/instruments';
import type { Quote } from '../../core/paper/market';
import {
  cancelAll,
  cancelOrder,
  closePosition,
  isLive,
  markPosition,
  reversePosition,
  stopToBreakeven,
  submitOrder,
  usePaper,
  type Position,
} from '../../core/paper/engine';
import { MARK_WORDS, orderAt, readLadder, type LadderMark, type LadderRow } from '../../core/paper/ladder';
import { usePaperPrefs } from '../../core/paper/prefs';
import { useModes } from '../../core/paper/modes';

const GROUPS = [1, 2, 4, 10];
const ROW_H = 18;

/** "12.4k" · "1.8M" — a rung has no room for 12,431 */
const abbrev = (v: number): string => {
  if (!(v > 0)) return '';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(v));
};
/** "+570" · "−1.2k" */
const shortPnl = (v: number): string => {
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '+';
  if (a >= 10_000) return `${sign}${(a / 1000).toFixed(0)}k`;
  if (a >= 1000) return `${sign}${(a / 1000).toFixed(1)}k`;
  return `${sign}${a.toFixed(0)}`;
};

/* The markers that ride in the price gutter, each one a price this desk knows */
const MARK_INK: Record<LadderMark, string> = {
  call: 'rgb(var(--bull))',
  put: 'rgb(var(--bear))',
  flip: 'rgb(var(--silver))',
  vpoc: 'rgb(var(--warn))',
  vwap: 'rgb(var(--silver))',
  high: 'rgb(var(--text-secondary))',
  low: 'rgb(var(--text-secondary))',
};
const MARK_LETTER: Record<LadderMark, string> = { call: 'C', put: 'P', flip: 'F', vpoc: 'V', vwap: 'W', high: 'H', low: 'L' };

/* ---- the columns ---------------------------------------------------------------------------- */

type ColKey = 'pnl' | 'mine' | 'depth' | 'vol';
const COL_WORDS: Record<ColKey, { label: string; blurb: string }> = {
  pnl: { label: 'P&L per rung', blurb: 'What the open position is worth if it ends on that price' },
  mine: { label: 'My working size', blurb: 'Your own resting orders, in their own columns beside the book' },
  depth: { label: 'Book size', blurb: 'Resting size from the feed. This desk has a top of book, so only the touch carries a figure' },
  vol: { label: 'Volume at price', blurb: "Today's volume at each rung, weighed against the heaviest rung on screen" },
};

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
  const [cols, setCols] = useState<Record<ColKey, boolean>>({ pnl: true, mine: true, depth: true, vol: true });
  const [colsOpen, setColsOpen] = useState(false);
  /* the foot's P&L reads in money or in ticks — right-click flips it, as a DOM does */
  const [pnlTicks, setPnlTicks] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const read = useMemo(
    () => readLadder(instrument, quote, position, paper.orders, { rows, group, centre: held }),
    [instrument, quote, position, paper.orders, rows, group, held]
  );

  /* the grid, built from whichever columns are on. A STYLE and not a class:
     Tailwind only sees class names written out in the source. */
  const gridCols = [
    cols.pnl ? '40px' : null,
    cols.mine ? '24px' : null,
    cols.depth ? '28px' : null,
    'minmax(0,1fr)',
    cols.depth ? '28px' : null,
    cols.mine ? '24px' : null,
    cols.vol ? '42px' : null,
  ]
    .filter(Boolean)
    .join(' ');

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
  const posRead = position && position.qty !== 0 ? markPosition(position, quote ?? undefined) : null;
  const working = paper.orders.filter(o => isLive(o) && o.instrumentId === instrument.id);

  /*
    THE WHEEL WALKS THE RUNGS and CTRL+wheel regroups them, which is the
    documented pair. Bound by hand rather than through onWheel, because
    React's is passive and cannot stop the page scrolling with it.
  */
  const walkRef = useRef({ step: 1, mark: 0, held: null as number | null, group: 1 });
  walkRef.current = { step: read.step, mark, held, group };
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const { step, mark: m, held: h, group: g } = walkRef.current;
      if (!(step > 0) || !Number.isFinite(m) || m === 0) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const i = GROUPS.indexOf(g);
        const next = GROUPS[Math.min(GROUPS.length - 1, Math.max(0, i + (e.deltaY > 0 ? -1 : 1)))];
        setGroup(next);
        return;
      }
      const rungs = e.deltaY > 0 ? -1 : 1;
      const from = h ?? m;
      const next = Number((Math.round(from / step) * step + rungs * step).toFixed(8));
      /* back within half a rung of the market is back ON the market */
      setHeld(Math.abs(next - m) < step / 2 ? null : next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /*
    A CLICK IS AN ORDER, on the ladder's own convention: under the market a
    limit and over it a stop, per side. SHIFT forces the other one, which is
    how a DOM lets you put a buy stop over the market without a ticket.
  */
  const place = (side: 'buy' | 'sell', row: LadderRow, flip: boolean) => {
    if (!tradable) return;
    const mineHere = row.orders.filter(o => o.side === side);
    if (mineHere.length) {
      for (const o of mineHere) cancelOrder(o.id, 'panel', 'pulled from the ladder');
      return;
    }
    const natural = orderAt(side, row.price, mark);
    const type = flip ? (natural === 'limit' ? 'stop' : 'limit') : natural;
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
    <div className="h-full min-h-0 flex flex-col rounded-md border border-borderSubtle bg-panel overflow-hidden" data-paper-ladder={instrument.id}>
      {/* the head: the name, the spread, the grouping, the columns */}
      <div className="shrink-0 h-8 px-2 flex items-center gap-1.5 border-b border-borderSubtle/70">
        <Rows3 className="w-3 h-3 text-textMuted shrink-0" aria-hidden />
        <span className="font-mono text-[11px] font-semibold text-textPrimary truncate">{tagWord(instrument)}</span>
        {quote && (
          <span className="font-mono text-[9px] tnum text-textMuted whitespace-nowrap" title={`The spread at the touch — ${read.spreadTicks} tick${read.spreadTicks === 1 ? '' : 's'}`}>
            {read.spreadTicks}t
          </span>
        )}
        <span className="ml-auto inline-flex items-center rounded border border-borderSubtle overflow-hidden" title="Ticks a rung covers — CTRL and the wheel does this too">
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
        <span className="relative">
          <button
            type="button"
            onClick={() => setColsOpen(v => !v)}
            aria-expanded={colsOpen}
            aria-label="Which columns the ladder shows"
            data-ladder-cols
            className={`inline-flex items-center justify-center w-5 h-5 rounded transition-colors ${colsOpen ? 'bg-ink/[0.12] text-textPrimary' : 'text-textMuted hover:text-textPrimary'}`}
          >
            <Settings2 className="w-3 h-3" />
          </button>
          {colsOpen && (
            <>
              <span className="fixed inset-0 z-20" onClick={() => setColsOpen(false)} aria-hidden />
              <span className="absolute right-0 top-6 z-30 w-52 flex flex-col p-1 rounded-md border border-borderSubtle bg-panel shadow-lg shadow-black/40">
                {(Object.keys(COL_WORDS) as ColKey[]).map(k => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setCols(c => ({ ...c, [k]: !c[k] }))}
                    title={COL_WORDS[k].blurb}
                    data-ladder-col={k}
                    aria-pressed={cols[k]}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-ink/[0.07] transition-colors"
                  >
                    <span className={`w-3 h-3 rounded-[2px] border shrink-0 ${cols[k] ? 'bg-silver border-silver' : 'border-borderMuted'}`} aria-hidden />
                    <span className="font-mono text-[10px] text-textPrimary">{COL_WORDS[k].label}</span>
                  </button>
                ))}
              </span>
            </>
          )}
        </span>
      </div>

      {/* the column heads */}
      <div className="shrink-0 grid items-center h-4 px-1 border-b border-borderSubtle/70" style={{ gridTemplateColumns: gridCols }} aria-hidden>
        {cols.pnl && <span className={`${head} text-right pr-1`}>P&amp;L</span>}
        {cols.mine && <span className={`${head} text-center`}>B</span>}
        {cols.depth && <span className={`${head} text-right pr-1`}>Bid</span>}
        <span className={`${head} text-center`}>Price</span>
        {cols.depth && <span className={`${head} pl-1`}>Ask</span>}
        {cols.mine && <span className={`${head} text-center`}>S</span>}
        {cols.vol && <span className={`${head} text-right pr-1`}>Vol</span>}
      </div>

      {/* the rungs */}
      <div ref={bodyRef} className="flex-1 min-h-0 overflow-hidden" data-ladder-body>
        {read.rows.map((r, i) => {
          const away = i === 0 ? read.above : i === read.rows.length - 1 ? read.below : [];
          const caret = i === 0 ? '↑' : '↓';
          const buyKind = orderAt('buy', r.price, mark);
          const sellKind = orderAt('sell', r.price, mark);
          return (
            <div
              key={r.price}
              className={`grid items-stretch font-mono text-[10px] border-b border-borderSubtle/50 ${r.isAvg ? 'bg-silver/[0.07]' : ''}`}
              style={{ height: ROW_H, gridTemplateColumns: gridCols }}
              data-ladder-row={r.price}
              data-ladder-at={r.isBid ? 'bid' : r.isAsk ? 'ask' : r.isLast ? 'last' : undefined}
            >
              {/* what the position is worth if it ends here */}
              {cols.pnl && (
                <span
                  className="flex items-center justify-end h-full px-1 tnum text-[9px]"
                  style={{ color: r.pnl == null || Math.abs(r.pnl) < 0.005 ? 'rgb(var(--text-muted))' : r.pnl > 0 ? 'rgb(var(--bull))' : 'rgb(var(--bear))', opacity: r.pnl == null ? 1 : 0.85 }}
                  title={r.pnl == null ? undefined : `The open position is ${fmtMoney(r.pnl)} at ${fmtPrice(instrument, r.price)}`}
                >
                  {r.pnl == null ? '' : shortPnl(r.pnl)}
                </span>
              )}

              {/* MY working buys — their own column, beside the book and not over it */}
              {cols.mine && (
                <button
                  type="button"
                  disabled={!tradable}
                  onClick={e => place('buy', r, e.shiftKey)}
                  data-ladder-buy={r.price}
                  title={
                    r.mine.buy > 0
                      ? `Cancel my ${r.mine.buy} resting here`
                      : `${buyKind === 'limit' ? 'Buy limit' : 'Buy stop'} ${qty} at ${fmtPrice(instrument, r.price)} · shift for a ${buyKind === 'limit' ? 'stop' : 'limit'}`
                  }
                  className={`${cell} justify-center transition-colors disabled:cursor-default ${
                    r.mine.buy > 0 ? 'font-bold text-[#0a0a0a]' : 'text-textMuted hover:bg-bull/[0.18]'
                  }`}
                  style={r.mine.buy > 0 ? { background: 'rgb(var(--bull))' } : undefined}
                >
                  {r.mine.buy > 0 ? r.mine.buy : ''}
                </button>
              )}

              {/* the book, bid side */}
              {cols.depth && (
                <span
                  className={`${cell} justify-end text-[9px] ${r.isBid ? 'text-bull font-semibold' : 'text-textMuted'}`}
                  style={r.isBid ? { background: 'color-mix(in srgb, rgb(var(--bull)) 15%, transparent)' } : undefined}
                >
                  {r.bidSize != null ? r.bidSize : ''}
                </span>
              )}

              {/* THE PRICE GUTTER: the rung, and every marker that lands on it */}
              <span
                className={`${cell} justify-between gap-1 ${r.isLast ? 'font-bold' : ''}`}
                style={
                  r.isLast
                    ? /* the last traded rung, in the colour every ladder gives it */
                      { background: 'rgb(var(--warn) / 0.22)', color: 'rgb(var(--text-primary))' }
                    : { color: 'rgb(var(--text-secondary))' }
                }
              >
                <span className="tabular-nums">{fmtPrice(instrument, r.price)}</span>
                <span className="inline-flex items-center gap-0.5 text-[8px] font-bold" data-ladder-marks={r.marks.join(',') || undefined}>
                  {r.isAvg && <span className="text-textPrimary" title="The position's average entry">◆</span>}
                  {r.marks.length
                    ? r.marks.slice(0, 3).map(m => (
                        <span key={m} style={{ color: MARK_INK[m] }} title={MARK_WORDS[m]}>
                          {MARK_LETTER[m]}
                        </span>
                      ))
                    : away.slice(0, 2).map(a => (
                        <span
                          key={a.mark}
                          className="opacity-55"
                          style={{ color: MARK_INK[a.mark] }}
                          data-ladder-away={a.mark}
                          title={`${MARK_WORDS[a.mark]} is ${a.ticks} tick${a.ticks === 1 ? '' : 's'} ${i === 0 ? 'above' : 'below'} the ladder, at ${fmtPrice(instrument, a.price)}`}
                        >
                          {caret}
                          {MARK_LETTER[a.mark]}
                        </span>
                      ))}
                </span>
              </span>

              {/* the book, ask side */}
              {cols.depth && (
                <span
                  className={`${cell} text-[9px] ${r.isAsk ? 'text-bear font-semibold' : 'text-textMuted'}`}
                  style={r.isAsk ? { background: 'color-mix(in srgb, rgb(var(--bear)) 15%, transparent)' } : undefined}
                >
                  {r.askSize != null ? r.askSize : ''}
                </span>
              )}

              {/* MY working sells */}
              {cols.mine && (
                <button
                  type="button"
                  disabled={!tradable}
                  onClick={e => place('sell', r, e.shiftKey)}
                  data-ladder-sell={r.price}
                  title={
                    r.mine.sell > 0
                      ? `Cancel my ${r.mine.sell} resting here`
                      : `${sellKind === 'limit' ? 'Sell limit' : 'Sell stop'} ${qty} at ${fmtPrice(instrument, r.price)} · shift for a ${sellKind === 'limit' ? 'stop' : 'limit'}`
                  }
                  className={`${cell} justify-center transition-colors disabled:cursor-default ${
                    r.mine.sell > 0 ? 'font-bold text-white' : 'text-textMuted hover:bg-bear/[0.18]'
                  }`}
                  style={r.mine.sell > 0 ? { background: 'rgb(var(--bear))' } : undefined}
                >
                  {r.mine.sell > 0 ? r.mine.sell : ''}
                </button>
              )}

              {/* VOLUME AT PRICE, weighed as colour and not as a bar — the figure
                  has to stay legible, and a run of equal cells reads as one band */}
              {cols.vol && (
                <span
                  className="flex items-center justify-end h-full px-1 tnum text-[9px] text-textSecondary"
                  style={{ background: r.volumeShare > 0 ? `rgb(var(--silver) / ${(r.volumeShare * 0.34).toFixed(3)})` : undefined }}
                  title={r.volume == null ? undefined : `${Math.round(r.volume).toLocaleString('en-US')} traded at ${fmtPrice(instrument, r.price)} today`}
                >
                  {r.queue && r.queue.left > 0 ? (
                    <span className="text-warn" title={`This desk's own model of ${r.queue.ahead} in front of you here — emulated, not a reading`}>
                      q{r.queue.left}
                    </span>
                  ) : (
                    abbrev(r.volume ?? 0)
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ---- THE POSITION STRIP, at the foot, label over value ---- */}
      <div className="shrink-0 border-t border-borderSubtle/70">
        <div className="grid grid-cols-3 gap-px px-2 py-1.5" data-ladder-position>
          <Field label="Position">
            <span style={{ color: posRead ? (position!.qty > 0 ? 'rgb(var(--bull))' : 'rgb(var(--bear))') : undefined }}>
              {position && position.qty !== 0 ? `${position.qty > 0 ? '+' : ''}${position.qty}` : '—'}
            </span>
          </Field>
          <Field label="Average">{position && position.qty !== 0 ? fmtPrice(instrument, position.avgPrice) : '—'}</Field>
          <Field
            label={pnlTicks ? 'Open · ticks' : 'Open P&L'}
            onContextMenu={e => {
              e.preventDefault();
              setPnlTicks(v => !v);
            }}
            title="Right-click to read it in ticks instead"
          >
            <span style={{ color: !posRead || Math.abs(posRead.unrealized) < 0.005 ? undefined : posRead.unrealized > 0 ? 'rgb(var(--bull))' : 'rgb(var(--bear))' }} data-ladder-pnl>
              {!posRead
                ? '—'
                : pnlTicks
                  ? `${posRead.unrealized >= 0 ? '+' : '−'}${Math.abs(Math.round((quote!.mark - position!.avgPrice) / instrument.tickSize))}`
                  : fmtMoney(posRead.unrealized)}
            </span>
          </Field>
        </div>

        {/* ---- the hands, the vocabulary a ladder's own sidebar carries ---- */}
        <div className="grid grid-cols-2 gap-px px-1">
          <button
            type="button"
            disabled={!tradable}
            onClick={() => submitOrder({ instrument, side: 'buy', qty, type: 'market', source: 'panel', note: 'from the ladder' })}
            data-ladder-market="buy"
            className="h-7 rounded font-mono text-[11px] font-bold uppercase tracking-wider bg-bullSolid text-[#0a0a0a] hover:opacity-90 disabled:opacity-30 transition-opacity"
          >
            Buy {qty}
          </button>
          <button
            type="button"
            disabled={!tradable}
            onClick={() => submitOrder({ instrument, side: 'sell', qty, type: 'market', source: 'panel', note: 'from the ladder' })}
            data-ladder-market="sell"
            className="h-7 rounded font-mono text-[11px] font-bold uppercase tracking-wider bg-bearSolid text-white hover:opacity-90 disabled:opacity-30 transition-opacity"
          >
            Sell {qty}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-px p-1">
          {[
            { k: 'flat', label: 'Flatten', title: 'Close the position and cancel every working order on this instrument', on: () => { closePosition(instrument.id, 1, 'panel'); cancelAll(instrument.id, 'panel'); }, off: !position && working.length === 0 },
            { k: 'rev', label: 'Reverse', title: 'Close and open the other way', on: () => reversePosition(instrument.id, 'panel'), off: !position },
            { k: 'be', label: 'Break even', title: "Move the stop to the position's own average, fees included", on: () => stopToBreakeven(instrument.id, 'panel'), off: !position },
            { k: 'cxl', label: 'Cancel all', title: 'Cancel every working order on this instrument', on: () => cancelAll(instrument.id, 'panel'), off: working.length === 0 },
            { k: 'cxlb', label: 'Cancel buys', title: 'Cancel the working buys only', on: () => working.filter(o => o.side === 'buy').forEach(o => cancelOrder(o.id, 'panel', 'buys canceled from the ladder')), off: !working.some(o => o.side === 'buy') },
            { k: 'cxls', label: 'Cancel sells', title: 'Cancel the working sells only', on: () => working.filter(o => o.side === 'sell').forEach(o => cancelOrder(o.id, 'panel', 'sells canceled from the ladder')), off: !working.some(o => o.side === 'sell') },
          ].map(b => (
            <button
              key={b.k}
              type="button"
              onClick={b.on}
              disabled={b.off}
              title={b.title}
              data-ladder-act={b.k}
              className="h-6 rounded border border-borderSubtle font-mono text-[9px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted disabled:opacity-30 disabled:hover:text-textSecondary disabled:hover:border-borderSubtle transition-colors"
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* off the market, and the way back */}
        <div className="px-1 pb-1">
          <button
            type="button"
            onClick={() => setHeld(null)}
            disabled={held == null}
            data-ladder-act="centre"
            title={held == null ? 'The ladder is following the market — scroll it to look away, CTRL and scroll to regroup' : 'Back to the market'}
            className={`w-full h-5 rounded border font-mono text-[9px] uppercase tracking-wider transition-colors disabled:opacity-30 ${
              held == null ? 'border-borderSubtle text-textMuted' : 'border-warn/60 text-warn hover:bg-warn/[0.1]'
            }`}
          >
            {held == null ? 'Following the market' : 'Back to the market'}
          </button>
        </div>

        <p className="px-2 pb-1.5 font-mono text-[8px] leading-tight text-textMuted" data-ladder-note>
          Book size shows at the touch only — this desk's feed is a top of book, and the rows under it are not ours to fill in. Volume at price is real and weighed against the heaviest rung on screen.
          {modes.realisticFills ? " The amber q is this desk's own model of the line in front of you — emulated, not a reading." : ''}
        </p>
      </div>
    </div>
  );
};

/**
 * A DIM LABEL OVER A BRIGHT VALUE — the pattern a professional ladder's foot
 * uses, and the one this desk was missing everywhere: ours was a hundred and
 * sixty things all whispering at the same size.
 */
const Field = ({
  label,
  children,
  title,
  onContextMenu,
}: {
  label: string;
  children: React.ReactNode;
  title?: string;
  onContextMenu?: (e: React.MouseEvent) => void;
}) => (
  <div className="flex flex-col gap-0.5 min-w-0" title={title} onContextMenu={onContextMenu} data-ladder-field={label}>
    <span className="font-mono text-[8px] uppercase tracking-widest text-textMuted whitespace-nowrap truncate">{label}</span>
    <span className="font-mono text-[13px] font-semibold tnum text-textPrimary whitespace-nowrap truncate leading-none">{children}</span>
  </div>
);

export default Ladder;
