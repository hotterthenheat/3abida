/*
==================================================
  SLAYER TERMINAL - THE POSITION TOOL
  (pages/paper/PositionTool.tsx)

  The drawing every trader already knows: two boxes
  on the tape from one entry — the green one up to
  the target, the red one down to the stop (and the
  other way for a short) — with the plan's own
  arithmetic in a card at its centre.

  IT IS A PLAN, NOT AN ORDER. Nothing here reaches
  the account until "Create order" is pressed, and
  then it goes the one way everything goes: as an
  entry with its stop and its target attached
  (BracketSpec's price form), through the unified
  engine. Drag the boxes all day and the account
  does not move.

  The numbers come from brackets.ts, which is also
  what the chart's tags read — the HUD and the tag
  on the same stop can never disagree, and both go
  through the instrument's multiplier, so a plan on
  NQ says $20 a point and one on ES says $50.

  Geometry is written straight to the DOM in one
  frame loop (the tags' rule): a pan or a zoom moves
  the drawing without React hearing about it. Only
  the numbers are state.
==================================================
*/

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, Repeat2, X } from 'lucide-react';
import { fmtPrice, roundToTick, tagWord, type Instrument } from '../../core/paper/instruments';
import { readPlan } from '../../core/paper/brackets';
import type { Side } from '../../core/paper/engine';
import { BUY_HEX, SELL_HEX } from './paperKit';

/** What the tool needs from the chart it is drawn on */
export interface ChartGeo {
  /** Pane-relative y for a price, or null when the price is off the scale */
  priceToY: (price: number) => number | null;
  /** Pane-relative x for a logical bar index */
  logicalToX: (logical: number) => number | null;
  /** The price under a client y, rounded to the instrument's tick */
  priceAtClientY: (clientY: number) => number | null;
  /** The bar index under a client x */
  logicalAtClientX: (clientX: number) => number | null;
  paneW: () => number;
  paneH: () => number;
  /** Hold the frame still while something is dragged on top of it */
  hold: (held: boolean) => void;
}

export interface PositionPlan {
  side: Side;
  entry: number;
  target: number;
  stop: number;
  qty: number;
  /** The bar the drawing starts on, and the one it ends on */
  from: number;
  to: number;
}

interface Props {
  instrument: Instrument;
  plan: PositionPlan;
  /** What the host's strip reserves at the top — the card stays under it */
  topInset: number;
  geo: { current: ChartGeo | null };
  onChange: (next: PositionPlan) => void;
  onCreate: (plan: PositionPlan) => void;
  onClose: () => void;
}

const GRIP = 9;
const MIN_LABEL_H = 34;
/** The width the order tags keep their × in, at the right of the pane */
const TAG_LANE = 40;
/** Under this the zone's words would be wider than the box that holds them */
const MIN_LABEL_W = 150;

const PositionTool = ({ instrument, plan, topInset, geo, onChange, onCreate, onClose }: Props) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const winRef = useRef<HTMLDivElement | null>(null);
  const lossRef = useRef<HTMLDivElement | null>(null);
  const gripsRef = useRef<Map<'entry' | 'target' | 'stop', HTMLDivElement>>(new Map());
  const hudRef = useRef<HTMLDivElement | null>(null);
  const edgeRef = useRef<HTMLDivElement | null>(null);
  const planRef = useRef(plan);
  planRef.current = plan;
  const insetRef = useRef(topInset);
  insetRef.current = topInset;

  const read = readPlan(instrument, plan.entry, plan.target, plan.stop, plan.qty, plan.side);
  const long = plan.side === 'buy';

  /* ---- one frame loop for the whole drawing ---- */
  useEffect(() => {
    let raf = 0;
    let sig = '';
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const g = geo.current;
      const wrap = wrapRef.current;
      if (!g || !wrap) return;
      const p = planRef.current;
      const x1 = g.logicalToX(p.from);
      const x2 = g.logicalToX(p.to);
      const yE = g.priceToY(p.entry);
      const yT = g.priceToY(p.target);
      const yS = g.priceToY(p.stop);
      if (x1 == null || x2 == null || yE == null || yT == null || yS == null) return;
      const paneW = g.paneW();
      const next = `${Math.round(x1)}|${Math.round(x2)}|${Math.round(yE)}|${Math.round(yT)}|${Math.round(yS)}|${paneW}`;
      if (next === sig) return;
      sig = next;
      const left = Math.min(x1, x2);
      const w = Math.max(24, Math.abs(x2 - x1));
      wrap.style.transform = `translate(${Math.round(left)}px, 0)`;
      wrap.style.width = `${Math.round(w)}px`;
      const box = (el: HTMLDivElement | null, a: number, b: number) => {
        if (!el) return;
        el.style.top = `${Math.round(Math.min(a, b))}px`;
        el.style.height = `${Math.round(Math.abs(a - b))}px`;
        const label = el.querySelector<HTMLElement>('[data-zone-words]');
        if (label) label.style.display = Math.abs(a - b) < MIN_LABEL_H || w < MIN_LABEL_W ? 'none' : 'flex';
      };
      box(winRef.current, yE, yT);
      box(lossRef.current, yE, yS);
      const grip = (key: 'entry' | 'target' | 'stop', y: number) => {
        const el = gripsRef.current.get(key);
        if (el) el.style.transform = `translateY(${Math.round(y - GRIP / 2)}px)`;
      };
      grip('entry', yE);
      grip('target', yT);
      grip('stop', yS);
      if (edgeRef.current) edgeRef.current.style.top = `${Math.round(Math.min(yT, yS))}px`;
      if (edgeRef.current) edgeRef.current.style.height = `${Math.round(Math.abs(yT - yS))}px`;
      /* THE CARD STAYS ON THE SCREEN, AND OFF THE ORDER TAGS' BUTTONS. Centred
         on the drawing, then held inside the pane and clear of the lane the tags
         keep their × in — a card is not allowed to cover a cancel (the house's
         rule that no control may sit on another). It rides in its own layer
         above the tags, so what is left of it is always pressable. */
      const hud = hudRef.current;
      if (hud) {
        const hw = hud.offsetWidth || 220;
        const hh = hud.offsetHeight || 72;
        const want = left + w / 2 - hw / 2;
        const held = Math.max(6, Math.min(Math.max(6, paneW - hw - TAG_LANE), want));
        /* and under the host's own strip — chrome is a control too */
        const top = Math.max(insetRef.current + hh / 2 + 6, Math.min(g.paneH() - hh / 2 - 6, yE));
        hud.style.transform = `translate(${Math.round(held)}px, ${Math.round(top)}px) translateY(-50%)`;
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [geo]);

  /* ---- dragging the plan ---- */
  const drag = (what: 'entry' | 'target' | 'stop' | 'body' | 'edge') => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const g = geo.current;
    if (!g) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    g.hold(true);
    const start = planRef.current;
    const startPrice = g.priceAtClientY(e.clientY);
    const startLogical = g.logicalAtClientX(e.clientX);
    const t = instrument.tickSize;
    const move = (ev: PointerEvent) => {
      const p = g.priceAtClientY(ev.clientY);
      const cur = planRef.current;
      if (what === 'edge') {
        const l = g.logicalAtClientX(ev.clientX);
        if (l == null || startLogical == null) return;
        const to = Math.round(start.to + (l - startLogical));
        if (to > start.from + 1) onChange({ ...cur, to });
        return;
      }
      if (p == null) return;
      if (what === 'target') {
        /* a target below a long is not a target — it is held one tick above the entry */
        const ok = start.side === 'buy' ? p > cur.entry : p < cur.entry;
        onChange({ ...cur, target: ok ? p : roundToTick(instrument, cur.entry + (start.side === 'buy' ? t : -t)) });
        return;
      }
      if (what === 'stop') {
        const ok = start.side === 'buy' ? p < cur.entry : p > cur.entry;
        onChange({ ...cur, stop: ok ? p : roundToTick(instrument, cur.entry + (start.side === 'buy' ? -t : t)) });
        return;
      }
      /* the entry and the body carry the whole plan, so the shape is kept */
      if (startPrice == null) return;
      const d = p - startPrice;
      onChange({
        ...cur,
        entry: roundToTick(instrument, start.entry + d),
        target: roundToTick(instrument, start.target + d),
        stop: roundToTick(instrument, start.stop + d),
      });
    };
    const done = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', done);
      el.removeEventListener('pointercancel', done);
      g.hold(false);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', done);
    el.addEventListener('pointercancel', done);
  };

  const flip = () => {
    const d = plan.side === 'buy' ? 'sell' : ('buy' as Side);
    onChange({ ...plan, side: d as Side, target: plan.stop, stop: plan.target });
  };
  const setQty = (n: number) => onChange({ ...plan, qty: Math.max(1, Math.round(n)) });

  const zone = 'absolute left-0 right-0 pointer-events-auto';
  const gripCls = 'absolute left-0 right-0 pointer-events-auto cursor-ns-resize flex items-center';
  const words = 'font-mono text-[9px] uppercase tracking-widest';

  return (
    <>
    <div className="absolute inset-0 z-20 overflow-hidden pointer-events-none" data-position-tool={plan.side === 'buy' ? 'long' : 'short'}>
      <div ref={wrapRef} className="absolute top-0 bottom-0 pointer-events-none" style={{ width: 120, willChange: 'transform' }}>
        {/* the reward box */}
        <div ref={winRef} className={zone} style={{ background: `${BUY_HEX}1f`, borderTop: `1px solid ${BUY_HEX}`, cursor: 'move' }} onPointerDown={drag('body')} data-zone="reward">
          <div data-zone-words className={`${words} absolute left-1.5 top-1 items-center gap-1.5 text-bull whitespace-nowrap`} style={{ display: 'flex' }}>
            Target <span className="tnum normal-case tracking-normal text-[10px] text-textPrimary">{fmtPrice(instrument, plan.target)}</span>
            <span className="tnum normal-case tracking-normal text-[10px]">{read.reward.money}</span>
          </div>
        </div>
        {/* the risk box */}
        <div ref={lossRef} className={zone} style={{ background: `${SELL_HEX}1f`, borderBottom: `1px solid ${SELL_HEX}`, cursor: 'move' }} onPointerDown={drag('body')} data-zone="risk">
          <div data-zone-words className={`${words} absolute left-1.5 bottom-1 items-center gap-1.5 text-bear whitespace-nowrap`} style={{ display: 'flex' }}>
            Stop <span className="tnum normal-case tracking-normal text-[10px] text-textPrimary">{fmtPrice(instrument, plan.stop)}</span>
            <span className="tnum normal-case tracking-normal text-[10px]">{read.risk.money}</span>
          </div>
        </div>
        {/* the three grips */}
        {(['target', 'entry', 'stop'] as const).map(k => (
          <div
            key={k}
            ref={el => {
              if (el) gripsRef.current.set(k, el);
              else gripsRef.current.delete(k);
            }}
            data-grip={k}
            onPointerDown={drag(k)}
            className={gripCls}
            style={{ height: GRIP, top: 0, willChange: 'transform' }}
            title={k === 'entry' ? 'Drag the whole plan' : k === 'target' ? 'Drag the target' : 'Drag the stop'}
          >
            <span className="w-full" style={{ height: 1, background: k === 'entry' ? 'rgba(237,237,237,0.85)' : 'transparent' }} aria-hidden />
          </div>
        ))}
        {/* the right edge stretches the drawing across time */}
        <div ref={edgeRef} onPointerDown={drag('edge')} className="absolute right-0 w-2 pointer-events-auto cursor-ew-resize" style={{ top: 0, height: 0 }} title="Drag to stretch it across the tape" data-grip="edge" />
      </div>
    </div>
    {/* THE CARD IS ITS OWN LAYER, above the tags: a z-index on a positioned box
        makes a stacking context, so a card nested in the drawing could never
        climb over an order tag that landed on its buttons. */}
    <div className="absolute inset-0 z-40 overflow-hidden pointer-events-none" data-tool-card>
        <div
          ref={hudRef}
          className="absolute top-0 left-0 pointer-events-auto rounded-md border border-borderSubtle bg-panel/95 backdrop-blur-md shadow-lg shadow-black/50 select-none"
          style={{ willChange: 'transform' }}
          onPointerDown={e => e.stopPropagation()}
          data-tool-hud
        >
          <div className="flex items-center gap-2 h-6 px-2 border-b border-borderSubtle">
            <span className={`font-mono text-[10px] font-bold ${long ? 'text-bull' : 'text-bear'}`}>{long ? 'LONG' : 'SHORT'}</span>
            <span className="font-mono text-[10px] text-textSecondary">{tagWord(instrument)}</span>
            <span className="font-mono text-[10px] tnum text-textMuted">{fmtPrice(instrument, plan.entry)}</span>
            <span data-tool-rr={Number.isFinite(read.rr) ? read.rr.toFixed(2) : ''} className="ml-auto font-mono text-[11px] font-bold tnum text-silver" title="Reward against risk">
              {read.rrWords}
            </span>
            <button type="button" onClick={onClose} aria-label="Close the position tool" className="inline-flex items-center justify-center w-4 h-4 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.1] transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="px-2 py-1.5 flex flex-col gap-0.5">
            <Row label="Target" money={read.reward.money} ticks={read.reward.tickWords} ink="text-bull" />
            <Row label="Stop" money={read.risk.money} ticks={read.risk.tickWords} ink="text-bear" />
          </div>
          <div className="flex items-center gap-1 px-2 pb-2">
            <div className="inline-flex items-center rounded border border-borderSubtle overflow-hidden">
              <button type="button" onClick={() => setQty(plan.qty - 1)} className="w-5 h-5 font-mono text-[11px] text-textSecondary hover:text-textPrimary hover:bg-ink/[0.08]" aria-label="One fewer">
                −
              </button>
              <span className="w-6 text-center font-mono text-[10px] tnum text-textPrimary" data-tool-qty>
                {plan.qty}
              </span>
              <button type="button" onClick={() => setQty(plan.qty + 1)} className="w-5 h-5 font-mono text-[11px] text-textSecondary hover:text-textPrimary hover:bg-ink/[0.08]" aria-label="One more">
                +
              </button>
            </div>
            <button type="button" onClick={flip} title="Turn the plan the other way" className="inline-flex items-center gap-1 h-5 px-1.5 rounded border border-borderSubtle font-mono text-[9px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:bg-ink/[0.08] transition-colors">
              <Repeat2 className="w-3 h-3" /> Flip
            </button>
            <button
              type="button"
              onClick={() => onCreate(planRef.current)}
              data-tool-create
              title="Place it: an entry at this price with the stop and the target attached"
              className={`ml-auto inline-flex items-center gap-1 h-5 px-2 rounded font-mono text-[9px] font-bold uppercase tracking-wider transition-opacity hover:opacity-85 ${long ? 'bg-bull text-[#0a0a0a]' : 'bg-bear text-white'}`}
            >
              <Check className="w-3 h-3" /> Create order
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const Row = ({ label, money, ticks, ink }: { label: string; money: string; ticks: string; ink: string }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">{label}</span>
    <span className="flex items-center gap-1.5">
      <span className={`font-mono text-[10px] tnum font-semibold ${ink}`}>{money}</span>
      <span className="font-mono text-[9px] tnum text-textSecondary">{ticks}</span>
    </span>
  </div>
);

export default PositionTool;
