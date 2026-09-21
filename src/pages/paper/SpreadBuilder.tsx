/*
==================================================
  SLAYER TERMINAL - THE SPREAD BUILDER
  (pages/paper/SpreadBuilder.tsx)

  A strategy over legs, built in one card: the
  shape (a vertical, a straddle, a strangle, an
  iron condor, or your own legs), the expiry, the
  strikes stepped on the family's own grid, the
  size, and whether you buy or sell the whole
  thing. Every leg is priced by market.ts as the
  chain prices it; the net, the width, the greeks
  and the defined risk are read off those legs.
  One order for the whole strategy; one position
  with the legs underneath.
==================================================
*/

import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import ExpiryCalendar from '../../components/ui/ExpiryCalendar';
import FilterTabs from '../../components/ui/FilterTabs';
import { isoDate } from '../../core/calendar';
import { listExpiriesFor, listingPatternFor, nearestListedExpiry } from '../../data/optionChain';
import { fmtPrice, indexFamily, optionInstrument, spreadInstrument, type Instrument, type OptionInstrument, type SpreadLeg } from '../../core/paper/instruments';
import { nearestStrike, quoteFor, spotOf, strikeStepFor } from '../../core/paper/market';
import { submitOrder } from '../../core/paper/engine';
import { usePaperPrefs } from '../../core/paper/prefs';
import type { OptionRight } from '../../types/compass';
import { PaperPill, ProvenanceChip, sideFill } from './paperKit';
import PayoffChart from '../../components/ui/PayoffChart';
import { payoffProfile } from '../../core/paper/payoff';

type Shape = 'call-vertical' | 'put-vertical' | 'straddle' | 'strangle' | 'iron-condor' | 'call-butterfly' | 'put-butterfly' | 'custom';

const SHAPES: DropdownOption<Shape>[] = [
  { value: 'call-vertical', label: 'Call vertical', hint: 'Buy one call, sell a higher one — a defined-risk bet up' },
  { value: 'put-vertical', label: 'Put vertical', hint: 'Buy one put, sell a lower one — a defined-risk bet down' },
  { value: 'straddle', label: 'Straddle', hint: 'A call and a put on the same strike — a bet on the move' },
  { value: 'strangle', label: 'Strangle', hint: 'A call above and a put below — the move, cheaper' },
  { value: 'iron-condor', label: 'Iron condor', hint: 'A put spread below and a call spread above — the range' },
  { value: 'call-butterfly', label: 'Call butterfly', hint: 'One in, two at the body, one out — a bet it pins' },
  { value: 'put-butterfly', label: 'Put butterfly', hint: 'The same pin, built from puts' },
  { value: 'custom', label: 'Custom legs', hint: 'Your own legs, any ratio' },
];

const SHAPE_WORD: Record<Shape, string> = { 'call-vertical': 'call spread', 'put-vertical': 'put spread', straddle: 'straddle', strangle: 'strangle', 'iron-condor': 'iron condor', 'call-butterfly': 'call butterfly', 'put-butterfly': 'put butterfly', custom: 'multi-leg' };

interface LegDraft {
  strike: number;
  right: OptionRight;
  ratio: number;
}

function legsFor(shape: Shape, atm: number, step: number): LegDraft[] {
  const w = step * 2;
  switch (shape) {
    case 'call-vertical':
      return [
        { strike: atm, right: 'C', ratio: 1 },
        { strike: atm + w, right: 'C', ratio: -1 },
      ];
    case 'put-vertical':
      return [
        { strike: atm, right: 'P', ratio: 1 },
        { strike: atm - w, right: 'P', ratio: -1 },
      ];
    case 'straddle':
      return [
        { strike: atm, right: 'C', ratio: 1 },
        { strike: atm, right: 'P', ratio: 1 },
      ];
    case 'strangle':
      return [
        { strike: atm + w, right: 'C', ratio: 1 },
        { strike: atm - w, right: 'P', ratio: 1 },
      ];
    case 'iron-condor':
      return [
        { strike: atm - 2 * w, right: 'P', ratio: 1 },
        { strike: atm - w, right: 'P', ratio: -1 },
        { strike: atm + w, right: 'C', ratio: -1 },
        { strike: atm + 2 * w, right: 'C', ratio: 1 },
      ];
    case 'call-butterfly':
      return [
        { strike: atm - w, right: 'C', ratio: 1 },
        { strike: atm, right: 'C', ratio: -2 },
        { strike: atm + w, right: 'C', ratio: 1 },
      ];
    case 'put-butterfly':
      return [
        { strike: atm + w, right: 'P', ratio: 1 },
        { strike: atm, right: 'P', ratio: -2 },
        { strike: atm - w, right: 'P', ratio: 1 },
      ];
    default:
      return [{ strike: atm, right: 'C', ratio: 1 }];
  }
}

interface SpreadBuilderProps {
  open: boolean;
  onClose: () => void;
  family: string;
  /** Legs handed in from the chain's "+ leg" */
  seedLegs?: OptionInstrument[];
  onChart: (inst: Instrument) => void;
}

const SpreadBuilder = ({ open, onClose, family, seedLegs, onChart }: SpreadBuilderProps) => {
  const prefs = usePaperPrefs();
  const fam = indexFamily(family);
  const underlying = fam ? fam.etf : family.toUpperCase();
  const ratio = fam ? fam.ratio : 1;
  const step = strikeStepFor(family);
  const spot = spotOf(underlying);
  const atm = spot != null ? nearestStrike(family, spot * ratio) : null;
  const [shape, setShape] = useState<Shape>('call-vertical');
  const [dte, setDte] = useState(() => nearestListedExpiry(underlying, 7).dte);
  const [legs, setLegs] = useState<LegDraft[]>([]);
  const [qty, setQty] = useState(1);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [tick, setTick] = useState(0);
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (seedLegs && seedLegs.length) {
      setShape('custom');
      setLegs(seedLegs.map(l => ({ strike: l.strike, right: l.right, ratio: 1 })));
      const [y, m, d] = seedLegs[0].expiry.split('-').map(Number);
      const e = listExpiriesFor(underlying).find(x => isoDate(x.date) === isoDate(new Date(y, m - 1, d)));
      if (e) setDte(e.dte);
    } else if (atm != null) setLegs(legsFor('call-vertical', atm, step));
    setSaid(null);
    const id = window.setInterval(() => setTick(t => t + 1), 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, family]);

  const pickShape = (s: Shape) => {
    setShape(s);
    if (atm != null) setLegs(legsFor(s, atm, step));
  };

  const expiries = useMemo(() => listExpiriesFor(underlying), [underlying, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const expiry = useMemo(() => nearestListedExpiry(underlying, dte), [underlying, dte]);
  const expiryIso = isoDate(expiry.date);

  const built = useMemo(() => {
    if (legs.length === 0) return null;
    const specs: SpreadLeg[] = legs.map(l => ({ option: optionInstrument(family, l.strike, l.right, expiryIso), ratio: l.ratio }));
    const words = shape === 'custom' ? undefined : `${family} ${[...new Set(legs.map(l => l.strike))].sort((a, b) => a - b).join('/')} ${SHAPE_WORD[shape].toUpperCase()} ${expiryIso.slice(5, 7)}/${expiryIso.slice(8, 10)}`;
    const inst = spreadInstrument(SHAPE_WORD[shape], specs, words);
    const q = quoteFor(inst);
    return { inst, q };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legs, family, expiryIso, shape, tick]);

  const strikes = legs.map(l => l.strike);
  const width = strikes.length ? Math.max(...strikes) - Math.min(...strikes) : 0;
  const q = built?.q ?? null;
  const net = q ? (side === 'buy' ? q.ask : q.bid) : null;
  /* MAX RISK AND MAX REWARD USED TO BE READ OFF THE STRATEGY'S NAME — right
     for the five shapes the switch knew, silently wrong the moment a reader
     dragged a leg, and blank for a butterfly. core/paper/payoff.ts evaluates
     the LEGS instead, so breakevens, the worst case and the best all fall out
     of one curve and stay correct for a shape nobody has named. */
  const optSpot = spot == null ? null : spot * (fam ? fam.ratio : 1);
  /* The axis is the option's OWN underlying — an index, not the ETF the feed
     quotes — so it is formatted on that scale, not with the leg's tick. */
  const fmtUnderlying = (v: number): string =>
    v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v.toFixed(v >= 100 ? 1 : 2);
  const profile = useMemo(() => {
    if (net == null || optSpot == null || legs.length === 0) return null;
    return payoffProfile(legs.map(l => ({ strike: l.strike, right: l.right, ratio: l.ratio })), net, side, qty, 100, optSpot);
  }, [legs, net, side, qty, optSpot]);
  const maxRisk = profile?.maxLoss ?? null;
  const maxReward = profile?.maxProfit ?? null;

  const place = () => {
    if (!built) return;
    const o = submitOrder({ instrument: built.inst, side, qty, type: 'market', source: 'ticket' });
    setSaid(o.status === 'rejected' ? `Rejected — ${o.rejectReason}` : `${side === 'buy' ? 'Bought' : 'Sold'} ${o.filledQty} × ${built.inst.symbol} @ ${o.avgFill}`);
    if (o.status !== 'rejected') {
      onChart(built.inst);
      window.setTimeout(onClose, 900);
    }
  };

  const btn = 'inline-flex items-center justify-center w-6 h-6 rounded border border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors';
  const setLeg = (i: number, patch: Partial<LegDraft>) => setLegs(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel="Build a spread"
      widthClass="max-w-[760px]"
      header={
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[15px] font-semibold leading-tight text-textPrimary">Spread on {family}</span>
          <span className="text-[11px] text-textMuted truncate">one order, one position, the legs underneath</span>
          <PaperPill />
        </div>
      }
      headerActions={
        <span className="inline-flex items-center gap-1.5">
          <DropdownSelect label="Shape" value={shape} options={SHAPES} onChange={pickShape} title="The strategy" testId="paper-spread-shape" />
          <ExpiryCalendar value={expiryIso} expiries={expiries} onChange={e => setDte(e.dte)} pattern={listingPatternFor(underlying)} title="The legs' expiry" testId="paper-spread-expiry" />
        </span>
      }
    >
      <div className="rounded-md border border-borderSubtle overflow-hidden" data-spread-legs>
        <div className="grid grid-cols-[64px_1fr_72px_1fr_1fr_1fr_1fr_28px] items-center gap-2 px-3 h-8 bg-chip border-b border-borderSubtle font-mono text-[9px] uppercase tracking-widest text-textSecondary">
          <span>Leg</span>
          <span>Strike</span>
          <span>Right</span>
          <span className="text-right">Bid</span>
          <span className="text-right">Ask</span>
          <span className="text-right">Mark</span>
          <span className="text-right">Delta</span>
          <span />
        </div>
        {legs.map((l, i) => {
          const lq = q?.legs?.[i] ?? null;
          const signed = (side === 'buy' ? 1 : -1) * l.ratio;
          return (
            <div key={i} className="grid grid-cols-[64px_1fr_72px_1fr_1fr_1fr_1fr_28px] items-center gap-2 px-3 h-10 border-b border-borderSubtle/60 font-mono text-[11px] tnum" data-spread-leg={i}>
              <button type="button" onClick={() => setLeg(i, { ratio: -l.ratio })} title="Flip this leg" className={`font-bold text-left ${signed > 0 ? 'text-bull' : 'text-bear'}`}>
                {signed > 0 ? 'BUY' : 'SELL'} {Math.abs(l.ratio)}
              </button>
              <span className="inline-flex items-center gap-1">
                <button type="button" onClick={() => setLeg(i, { strike: Number((l.strike - step).toFixed(2)) })} className={btn} aria-label="One strike down">
                  <Minus className="w-3 h-3" />
                </button>
                <input value={l.strike} onChange={e => setLeg(i, { strike: Number(e.target.value) || l.strike })} inputMode="decimal" aria-label="Strike" className="w-[76px] h-6 text-center rounded border border-borderSubtle bg-inputBg font-mono text-[11px] font-semibold tnum text-textPrimary outline-none focus:border-silver/60" />
                <button type="button" onClick={() => setLeg(i, { strike: Number((l.strike + step).toFixed(2)) })} className={btn} aria-label="One strike up">
                  <Plus className="w-3 h-3" />
                </button>
              </span>
              <button type="button" onClick={() => setLeg(i, { right: l.right === 'C' ? 'P' : 'C' })} className="h-6 px-2 rounded border border-borderSubtle text-textPrimary hover:border-borderMuted transition-colors text-left">
                {l.right === 'C' ? 'Call' : 'Put'}
              </button>
              <span className="text-right text-textPrimary">{lq ? fmtPrice(built!.inst.legs[i].option, lq.bid) : '—'}</span>
              <span className="text-right text-textPrimary">{lq ? fmtPrice(built!.inst.legs[i].option, lq.ask) : '—'}</span>
              <span className="text-right text-textPrimary font-semibold">{lq ? fmtPrice(built!.inst.legs[i].option, lq.mark) : '—'}</span>
              <span className="text-right text-textSecondary">{lq?.greeks ? lq.greeks.delta.toFixed(2) : '—'}</span>
              <button type="button" onClick={() => setLegs(ls => ls.filter((_, j) => j !== i))} disabled={legs.length <= 1} aria-label="Remove this leg" className="inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-textPrimary disabled:opacity-30">
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
        <div className="px-3 py-1.5 flex items-center gap-2">
          <button type="button" onClick={() => atm != null && setLegs(ls => [...ls, { strike: atm, right: 'C', ratio: 1 }])} className="inline-flex items-center gap-1 h-6 px-2 rounded font-mono text-[10px] text-textSecondary hover:text-textPrimary hover:bg-ink/[0.05] transition-colors">
            <Plus className="w-3 h-3" /> Add a leg
          </button>
          {q && <ProvenanceChip quote={q} className="ml-auto" />}
        </div>
      </div>

      {/* THE CURVE, above the numbers it explains. A max-loss figure tells you
          how bad it gets; the curve tells you WHERE, which is the thing a
          reader is choosing strikes against. */}
      {profile && optSpot != null && (
        <div className="border border-borderSubtle rounded-md bg-inset px-2.5 pt-2 pb-1.5" data-spread-payoff>
          <div className="flex items-baseline justify-between px-0.5 pb-1">
            <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">At expiry</span>
            <span className="font-mono text-[9px] text-textMuted">
              {profile.maxLoss == null
                ? 'loss is unlimited'
                : profile.worstAt != null
                  ? `worst at ${fmtUnderlying(profile.worstAt)}`
                  : ''}
            </span>
          </div>
          <PayoffChart profile={profile} spot={optSpot} strikes={strikes} height={130} fmt={fmtUnderlying} />
        </div>
      )}

      <div className="flex items-center gap-4 flex-wrap" data-spread-foot>
        <FilterTabs ariaLabel="Buy or sell the strategy" options={[{ value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }]} value={side} onChange={setSide} />
        <span className="inline-flex items-center gap-1">
          <button type="button" onClick={() => setQty(n => Math.max(1, n - 1))} className={btn} aria-label="One fewer">
            <Minus className="w-3 h-3" />
          </button>
          <input value={qty} onChange={e => setQty(Math.max(1, Math.round(Number(e.target.value) || 1)))} inputMode="numeric" aria-label="Size" className="w-10 h-6 text-center rounded border border-borderSubtle bg-inputBg font-mono text-[12px] font-bold tnum text-textPrimary outline-none focus:border-silver/60" />
          <button type="button" onClick={() => setQty(n => n + 1)} className={btn} aria-label="One more">
            <Plus className="w-3 h-3" />
          </button>
        </span>
        <dl className="grid grid-flow-col auto-cols-max gap-x-5 font-mono tnum">
          <div>
            <dt className="text-[9px] uppercase tracking-widest text-textMuted">{net != null && net < 0 ? 'Net credit' : 'Net debit'}</dt>
            <dd className={`text-[12px] font-semibold ${net != null && net < 0 ? 'text-bull' : 'text-textPrimary'}`}>{net != null ? `$${Math.abs(net).toFixed(2)}` : '—'}</dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-widest text-textMuted">Mark</dt>
            <dd className="text-[12px] text-textPrimary">{q ? `$${q.mark.toFixed(2)}` : '—'}</dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-widest text-textMuted">Max risk</dt>
            <dd className="text-[12px] text-bear">{net == null ? '—' : maxRisk != null ? `$${maxRisk.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : 'unlimited'}</dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-widest text-textMuted">Max reward</dt>
            <dd className="text-[12px] text-bull">{net == null ? '—' : maxReward != null ? `$${maxReward.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : 'unlimited'}</dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-widest text-textMuted">Δ · Θ · V</dt>
            <dd className="text-[12px] text-textSecondary">{q?.greeks ? `${((side === 'buy' ? 1 : -1) * q.greeks.delta).toFixed(2)} · ${((side === 'buy' ? 1 : -1) * q.greeks.theta).toFixed(2)} · ${((side === 'buy' ? 1 : -1) * q.greeks.vega).toFixed(2)}` : '—'}</dd>
          </div>
        </dl>
        <span className="ml-auto inline-flex items-center gap-1.5">
          <button type="button" onClick={() => built && (onChart(built.inst), onClose())} disabled={!built} className="h-8 px-3.5 rounded-md border border-borderMuted font-mono text-[11px] font-semibold uppercase tracking-wider text-textPrimary hover:bg-ink/[0.05] disabled:opacity-40 transition-colors">
            Chart the spread
          </button>
          <button type="button" onClick={place} disabled={!built || !q} data-spread-place className={`h-8 px-4 rounded-md font-mono text-[11px] font-bold uppercase tracking-wider disabled:opacity-40 ${sideFill(side)}`}>
            Place paper order
          </button>
        </span>
        {said && <span className="w-full font-mono text-[10px] text-textSecondary animate-fade-in">{said}</span>}
      </div>
      {prefs.defaultQty > 1 && <span className="sr-only">size {prefs.defaultQty}</span>}
    </Modal>
  );
};

export default SpreadBuilder;
