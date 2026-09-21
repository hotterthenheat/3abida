/*
==================================================
  SLAYER TERMINAL - THE TRADE MENU AND THE CARD
  (pages/paper/TradeMenu.tsx)

  The chart's right-click: a card at the cursor
  with the market's own sections — TRADE at this
  price, the POSITION if there is one, the ORDERS,
  the OPTIONS door, the CHART's own tools. The
  sections change with the instrument and the
  position (a stock offers its calls, a future
  the index options over it; no position, no
  position section). ResetViewControl's card
  grammar, grown to sections.

  THE CARD (click-to-trade): picking a trade from
  the menu opens one small card where the cursor
  was — the side, the size, the price it inherited
  from the click, one button. Never a modal.
==================================================
*/

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus } from 'lucide-react';
import { fmtPrice, roundToTick, tagWord, type Instrument } from '../../core/paper/instruments';
import type { OrderType, Side } from '../../core/paper/engine';
import type { Quote } from '../../core/paper/market';
import { usePaperPrefs } from '../../core/paper/prefs';
import { PaperPill, sideFill, sideInk } from './paperKit';

export interface MenuItem {
  key: string;
  label: ReactNode;
  hint?: string;
  disabled?: boolean;
  danger?: boolean;
  /** A small right-aligned word — a price, a key */
  meta?: string;
  onPick: () => void;
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}

const MENU_W = 248;

/** A fixed box clamped into the window, opening down-right of the point where it can */
function clampBox(x: number, y: number, w: number, h: number): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = x + w + 8 > vw ? Math.max(8, x - w) : x;
  const top = y + h + 8 > vh ? Math.max(8, vh - h - 8) : y;
  return { left, top };
}

export const TradeMenu = ({ at, sections, onClose, head }: { at: { x: number; y: number }; sections: MenuSection[]; onClose: () => void; head?: ReactNode }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  /* Placed on the first frame from a guess at its height, then corrected once measured — never a hidden frame */
  const [box, setBox] = useState<{ left: number; top: number }>(() => clampBox(at.x, at.y, MENU_W, Math.min(window.innerHeight * 0.8, 40 + sections.reduce((n, s) => n + 22 + s.items.length * 26, 0))));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    setBox(clampBox(at.x, at.y, MENU_W, h));
  }, [at.x, at.y, sections.length]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key, true);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      data-trade-menu
      className="fixed z-[200] border border-borderSubtle bg-panel/95 backdrop-blur-xl backdrop-saturate-150 rounded-md shadow-2xl shadow-black/60 p-1 animate-slide-in overflow-y-auto overscroll-contain"
      style={{ left: box.left, top: box.top, width: MENU_W, maxHeight: Math.round(window.innerHeight * 0.8) }}
      onContextMenu={e => e.preventDefault()}
    >
      {head && <div className="px-2.5 pt-1.5 pb-1 border-b border-borderSubtle/70 mb-1">{head}</div>}
      {sections.map((s, i) => (
        <div key={s.title} className={i > 0 ? 'mt-1 pt-1 border-t border-borderSubtle/60' : ''} data-menu-section={s.title}>
          <div className="px-2.5 pt-1 pb-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-textMuted select-none">{s.title}</div>
          {s.items.map(it => (
            <button
              key={it.key}
              role="menuitem"
              disabled={it.disabled}
              title={it.hint}
              data-menu-item={it.key}
              onClick={() => {
                if (it.disabled) return;
                it.onPick();
                onClose();
              }}
              className={`w-full flex items-center gap-2 px-2.5 h-[26px] rounded font-mono text-[11px] text-left transition-colors ${
                it.danger ? 'text-bear hover:bg-bear/[0.08]' : 'text-textPrimary hover:bg-ink/[0.06]'
              }`}
            >
              <span className="min-w-0 truncate">{it.label}</span>
              {it.meta && <span className="ml-auto pl-3 font-mono text-[9px] tnum text-textMuted shrink-0">{it.meta}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>,
    document.body
  );
};

/* ---- the click-to-trade card ----------------------------------------------------------------- */

export interface TradeDraft {
  instrument: Instrument;
  side: Side;
  type: OrderType;
  qty: number;
  /** The clicked price for a limit or a stop */
  price?: number;
}

const CARD_W = 232;

export const TradeCard = ({ at, draft, quote, onPlace, onClose }: { at: { x: number; y: number }; draft: TradeDraft; quote: Quote | null; onPlace: (d: TradeDraft) => void; onClose: () => void }) => {
  const prefs = usePaperPrefs();
  const ref = useRef<HTMLDivElement | null>(null);
  const [qty, setQty] = useState(draft.qty);
  const [price, setPrice] = useState(draft.price ?? 0);
  const [priceText, setPriceText] = useState(draft.price != null ? String(draft.price) : '');
  const [box, setBox] = useState<{ left: number; top: number }>(() => clampBox(at.x, at.y, CARD_W, 170));
  const inst = draft.instrument;
  const marketPrice = quote ? (draft.side === 'buy' ? quote.ask : quote.bid) : null;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setBox(clampBox(at.x, at.y, CARD_W, el.getBoundingClientRect().height));
  }, [at.x, at.y]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key, true);
    };
  }, [onClose]);

  const place = () => {
    const p = draft.type === 'market' ? undefined : roundToTick(inst, Number(priceText) || price);
    if (draft.type !== 'market' && !(p! > 0) && inst.kind !== 'spread') return;
    onPlace({ ...draft, qty: Math.max(1, Math.round(qty)), price: p });
    onClose();
  };

  const words = `${draft.side === 'buy' ? 'BUY' : 'SELL'} ${draft.type === 'market' ? '' : draft.type.toUpperCase() + ' '}`.trim();
  const btn = 'inline-flex items-center justify-center w-6 h-6 rounded border border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors';

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`${words} ${tagWord(inst)}`}
      data-trade-card
      className="fixed z-[200] border border-borderMuted bg-panel/95 backdrop-blur-xl backdrop-saturate-150 rounded-md shadow-2xl shadow-black/60 p-2.5 animate-slide-in select-none"
      style={{ left: box.left, top: box.top, width: CARD_W }}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Enter') place();
      }}
      onContextMenu={e => e.preventDefault()}
    >
      <div className="flex items-center gap-2">
        <span className={`font-mono text-[12px] font-bold ${sideInk(draft.side)}`}>{words}</span>
        <span className="inline-flex items-center gap-0.5">
          <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))} className={btn} aria-label="One fewer">
            <Minus className="w-3 h-3" />
          </button>
          <input
            value={qty}
            onChange={e => setQty(Math.max(1, Math.round(Number(e.target.value) || 1)))}
            inputMode="numeric"
            aria-label="Size"
            className="w-9 h-6 text-center rounded border border-borderSubtle bg-inputBg font-mono text-[12px] font-bold tnum text-textPrimary outline-none focus:border-silver/60"
          />
          <button type="button" onClick={() => setQty(q => q + 1)} className={btn} aria-label="One more">
            <Plus className="w-3 h-3" />
          </button>
        </span>
        <PaperPill className="ml-auto" />
      </div>
      <div className="mt-1 flex items-center gap-1">
        {prefs.quickQtys.map(n => (
          <button key={n} type="button" onClick={() => setQty(n)} className={`h-5 min-w-[26px] px-1 rounded font-mono text-[10px] tnum transition-colors ${qty === n ? 'bg-ink/[0.1] text-textPrimary' : 'text-textMuted hover:text-textPrimary hover:bg-ink/[0.05]'}`}>
            {n}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">{draft.type === 'market' ? 'At the market' : draft.type === 'limit' ? 'Limit' : 'Stop'}</span>
        {draft.type === 'market' ? (
          <span className="ml-auto font-mono text-[13px] font-bold tnum text-textPrimary">{marketPrice != null ? fmtPrice(inst, marketPrice) : '—'}</span>
        ) : (
          <input
            autoFocus
            value={priceText}
            onChange={e => {
              setPriceText(e.target.value);
              const v = Number(e.target.value);
              if (Number.isFinite(v)) setPrice(v);
            }}
            onBlur={() => {
              const v = Number(priceText);
              if (Number.isFinite(v) && v > 0) setPriceText(String(roundToTick(inst, v)));
            }}
            inputMode="decimal"
            aria-label="Price"
            className="ml-auto w-[112px] h-7 text-right px-2 rounded border border-borderSubtle bg-inputBg font-mono text-[13px] font-bold tnum text-textPrimary outline-none focus:border-silver/60"
          />
        )}
      </div>
      {quote && (
        <div className="mt-1 flex items-center justify-between font-mono text-[9px] tnum text-textMuted">
          <span>bid {fmtPrice(inst, quote.bid)} × {quote.bidSize}</span>
          <span>{quote.askSize} × ask {fmtPrice(inst, quote.ask)}</span>
        </div>
      )}
      <button type="button" onClick={place} data-place-order className={`mt-2.5 w-full h-8 rounded-md font-mono text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-90 ${sideFill(draft.side)}`}>
        Place paper order
      </button>
    </div>,
    document.body
  );
};

/* ---- the modify card: a working order's price and size, in place --------------------------- */

export const OrderEditCard = ({
  at,
  inst,
  side,
  words,
  qty: qty0,
  price: price0,
  priceLabel,
  onSave,
  onClose,
}: {
  at: { x: number; y: number };
  inst: Instrument;
  side: Side;
  /** "SELL STP 3" */
  words: string;
  qty: number;
  price: number;
  priceLabel: 'Limit' | 'Stop';
  onSave: (next: { qty: number; price: number }) => void;
  onClose: () => void;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [qty, setQty] = useState(qty0);
  const [priceText, setPriceText] = useState(String(price0));
  const [box, setBox] = useState<{ left: number; top: number }>(() => clampBox(at.x, at.y, CARD_W, 140));
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setBox(clampBox(at.x, at.y, CARD_W, el.getBoundingClientRect().height));
  }, [at.x, at.y]);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key, true);
    };
  }, [onClose]);
  const save = () => {
    const p = Number(priceText);
    if (!Number.isFinite(p)) return;
    onSave({ qty: Math.max(1, Math.round(qty)), price: roundToTick(inst, p) });
    onClose();
  };
  const btn = 'inline-flex items-center justify-center w-6 h-6 rounded border border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors';
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`Modify ${words}`}
      data-order-edit
      className="fixed z-[200] border border-borderMuted bg-panel/95 backdrop-blur-xl backdrop-saturate-150 rounded-md shadow-2xl shadow-black/60 p-2.5 animate-slide-in select-none"
      style={{ left: box.left, top: box.top, width: CARD_W }}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Enter') save();
      }}
      onContextMenu={e => e.preventDefault()}
    >
      <div className="flex items-center gap-2">
        <span className={`font-mono text-[11px] font-bold ${sideInk(side)}`}>{words}</span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">modify</span>
        <PaperPill className="ml-auto" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted w-10">Size</span>
        <span className="inline-flex items-center gap-0.5">
          <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))} className={btn} aria-label="One fewer">
            <Minus className="w-3 h-3" />
          </button>
          <input value={qty} onChange={e => setQty(Math.max(1, Math.round(Number(e.target.value) || 1)))} inputMode="numeric" aria-label="Size" className="w-9 h-6 text-center rounded border border-borderSubtle bg-inputBg font-mono text-[12px] font-bold tnum text-textPrimary outline-none focus:border-silver/60" />
          <button type="button" onClick={() => setQty(q => q + 1)} className={btn} aria-label="One more">
            <Plus className="w-3 h-3" />
          </button>
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted w-10">{priceLabel}</span>
        <input autoFocus value={priceText} onChange={e => setPriceText(e.target.value)} inputMode="decimal" aria-label="Price" className="ml-auto w-[112px] h-7 text-right px-2 rounded border border-borderSubtle bg-inputBg font-mono text-[13px] font-bold tnum text-textPrimary outline-none focus:border-silver/60" />
      </div>
      <button type="button" onClick={save} data-save-order className="mt-2.5 w-full h-8 rounded-md font-mono text-[11px] font-bold uppercase tracking-wider bg-textPrimary text-[#0a0a0a] transition-opacity hover:opacity-90">
        Update paper order
      </button>
    </div>,
    document.body
  );
};
