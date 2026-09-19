/*
==================================================
  SLAYER TERMINAL - THE INSTRUMENT CAPSULE
  (pages/paper/InstrumentPicker.tsx)

  TickerQuickPick's capsule, grown for a desk that
  trades more than names: the futures with their
  live prices, the index option families (a door
  onto the chain), and the whole stock universe
  behind the same search every other picker uses.
  Portalled and placed like every menu here.
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import TickerLookup from '../../components/ui/TickerLookup';
import CompanyLogo from '../../components/ui/CompanyLogo';
import { useAnchoredMenu } from '../../components/ui/useAnchoredMenu';
import useFocusTrap from '../../components/ui/useFocusTrap';
import { FUTURES, INDEX_FAMILIES, fmtPrice, frontMonth, futureInstrument, stockInstrument, tagWord, type Instrument } from '../../core/paper/instruments';
import { quoteFor, spotOf } from '../../core/paper/market';

const MENU_W = 300;

interface InstrumentPickerProps {
  instrument: Instrument;
  onPick: (inst: Instrument) => void;
  /** An index family's chain, opened from the menu */
  onOpenChain: (family: string) => void;
}

const InstrumentPicker = ({ instrument, onPick, onOpenChain }: InstrumentPickerProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { anchorRef, placed } = useAnchoredMenu<HTMLButtonElement>(open, 'bottom', MENU_W, 'start');
  useFocusTrap(open, menuRef);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const pick = (inst: Instrument | null) => {
    setOpen(false);
    if (inst && inst.id !== instrument.id) onPick(inst);
  };

  const row = 'w-full flex items-center gap-2 px-2.5 h-7 text-left rounded transition-colors hover:bg-ink/[0.05]';
  const head = 'px-2.5 pt-2 pb-1 font-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-textMuted select-none';

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={anchorRef}
        onClick={() => setOpen(!open)}
        title="Switch instrument — futures, index options, stocks"
        data-instrument-picker
        className="inline-flex items-center justify-between gap-2 h-7 min-w-[112px] px-3 rounded-full bg-ink/[0.06] hover:bg-ink/[0.10] font-mono text-[11px] font-bold text-textPrimary transition-colors"
      >
        <span className="inline-flex items-center gap-1.5">
          <CompanyLogo ticker={instrument.underlying} size={13} />
          {tagWord(instrument)}
        </span>
        <ChevronDown className={`w-3 h-3 text-textSecondary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open &&
        placed &&
        createPortal(
          <div
            ref={menuRef}
            role="dialog"
            aria-label="Change instrument"
            style={{ position: 'fixed', ...placed.box, width: MENU_W }}
            className="z-[120] border border-borderMuted bg-panel/90 backdrop-blur-xl backdrop-saturate-150 rounded-md shadow-2xl shadow-black/60 overflow-x-hidden overflow-y-auto overscroll-contain animate-slide-in pb-1"
            data-instrument-menu
          >
            <div className={head}>Futures · front month</div>
            {FUTURES.map(f => {
              const inst = futureInstrument(f.root);
              const q = inst ? quoteFor(inst) : null;
              const fm = frontMonth(f.root);
              return (
                <button key={f.root} type="button" onClick={() => pick(inst)} className={row} data-pick-future={f.root}>
                  <span className={`font-mono text-[11px] font-semibold w-12 shrink-0 ${instrument.kind === 'future' && instrument.root === f.root ? 'text-silver' : 'text-textPrimary'}`}>{fm.code}</span>
                  <span className="text-[10px] text-textSecondary truncate">{f.name}</span>
                  <span className="ml-auto font-mono text-[10px] tnum text-textPrimary shrink-0">{q && inst ? fmtPrice(inst, q.last) : '—'}</span>
                </button>
              );
            })}
            <div className={head}>Index options · the chain</div>
            {INDEX_FAMILIES.filter(f => f.symbol !== 'SPX').map(f => {
              const spot = spotOf(f.etf);
              return (
                <button key={f.symbol} type="button" onClick={() => { setOpen(false); onOpenChain(f.symbol); }} className={row} data-pick-family={f.symbol}>
                  <span className="font-mono text-[11px] font-semibold w-12 shrink-0 text-textPrimary">{f.symbol}</span>
                  <span className="text-[10px] text-textSecondary truncate">{f.name}</span>
                  <span className="ml-auto font-mono text-[10px] tnum text-textPrimary shrink-0">{spot != null ? (spot * f.ratio).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</span>
                </button>
              );
            })}
            <div className={head}>Stocks &amp; ETFs</div>
            <TickerLookup active={instrument.kind === 'stock' ? instrument.symbol : undefined} onPick={sym => pick(stockInstrument(sym))} limit={30} />
          </div>,
          document.body
        )}
    </div>
  );
};

export default InstrumentPicker;
