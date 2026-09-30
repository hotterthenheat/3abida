/*
==================================================
  SLAYER TERMINAL - REVIEW · THE TICKET'S LADDER
  (components/review/LadderFields.tsx)

  The part of a ticket that says how a position will
  be LEFT (Noah, 2026-09-20: "some people have multiple
  tps and stop losses in place"): one, two or three
  targets and one or two stops — the contracts shared
  out between them, the nearer level taking the odd
  one — and the two switches a stop can wear:

    breakeven   when the first target fills, the stop
                moves to what was paid
    trailing    the stop keeps a distance from the best
                price since — typed, or the distance it
                is set at

  THE COUNT AT EACH LEVEL CAN BE TYPED (Noah,
  2026-09-21: "build the three you havent built yet").
  The even share is what the fields start with, and
  what an emptied field means; a typed count stands.
  One target for two of four contracts, the rest left
  to run, is a trade — the block says, before the
  press, how many contracts are left with no stop.
  With one contract there is nothing to split.

  Both tickets use it (an option's and a future's); the
  words that differ — what a price is a price OF — are
  the ticket's. A level left empty is simply not
  placed. The rules are the two rules pages'; the
  engine refuses, in words, what the fields cannot.
==================================================
*/

import { useEffect, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Check } from 'lucide-react';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import { splitQty, type LadderBracket, type Rung } from '../../data/review/ladder';

export interface LadderDraft {
  nTargets: number;
  nStops: number;
  targets: string[];
  stops: string[];
  /** Contracts at each level, as typed — '' is the even share */
  targetQty: string[];
  stopQty: string[];
  breakeven: boolean;
  trail: boolean;
  /** The trailing distance, as typed — '' is the distance the stop is set at */
  trailBy: string;
}
export const LADDER_AT_REST: LadderDraft = { nTargets: 1, nStops: 1, targets: ['', '', ''], stops: ['', ''], targetQty: ['', '', ''], stopQty: ['', ''], breakeven: false, trail: false, trailBy: '' };

const num = (v: string | undefined) => (v == null || v.trim() === '' ? undefined : Number(v));
const shown = (n: number, qty: number) => Math.max(1, Math.min(n, Math.max(1, qty)));
/** The rungs a side asks for: each level with a price, at its typed count — or its even share */
const rungs = (n: number, prices: string[], counts: string[], qty: number): Rung[] => {
  const k = shown(n, qty);
  const share = splitQty(Math.max(1, qty), k);
  return share.map((q, i) => ({ price: num(prices[i]), qty: num(counts[i]) ?? q })).filter((r): r is Rung => r.price != null);
};

/** What the fields ask the engine for — undefined when nothing is typed. `stopFromTrail`: where a stop goes when only a
    trailing distance was typed (the ticket knows the way in's price; the block does not) */
export function bracketOf(d: LadderDraft, qty: number, stopFromTrail?: (by: number) => number): LadderBracket | undefined {
  const targets = rungs(d.nTargets, d.targets, d.targetQty, qty);
  let stops = rungs(d.nStops, d.stops, d.stopQty, qty);
  const by = d.trail ? num(d.trailBy) : undefined;
  if (!stops.length && by != null && by > 0 && stopFromTrail) stops = [{ price: stopFromTrail(by), qty: Math.max(1, qty) }];
  if (!targets.length && !stops.length) return undefined;
  return { targets: targets.length ? targets : undefined, stops: stops.length ? stops : undefined, breakeven: (d.breakeven && targets.length > 0 && stops.length > 0) || undefined, trail: (d.trail && stops.length > 0) || undefined, trailBy: d.trail && by != null ? by : undefined };
}
/** Every stop typed, with the contracts it speaks for — what a ticket works its planned risk out from */
export const stopsOf = (d: LadderDraft, qty: number): Rung[] => rungs(d.nStops, d.stops, d.stopQty, qty);

const inputCls = 'h-8 w-full px-2 rounded-md border border-borderSubtle bg-panel font-mono text-[12px] tnum text-textPrimary outline-none focus:border-silver/60 transition-colors';
const countCls = 'h-[18px] w-7 px-1 rounded border border-borderSubtle bg-panel text-center font-mono text-[10px] tnum text-textPrimary placeholder:text-textMuted outline-none focus:border-silver/60 transition-colors';
const COUNT = ['One', 'Two', 'Three'];
const SPLIT = ['all at one', 'half and half', 'a third each'];

/** The house's tick-box (ChartToolbar's overlays): a bordered square that fills silver and takes a tick */
const CheckRow = ({ on, off, onChange, label, hint, testId }: { on: boolean; off: boolean; onChange: (v: boolean) => void; label: string; hint: string; testId: string }) => (
  <button type="button" role="checkbox" aria-checked={on && !off} aria-disabled={off} disabled={off} onClick={() => onChange(!on)} title={hint} className={`inline-flex items-center gap-2 h-6 text-left transition-opacity ${off ? 'opacity-35 cursor-not-allowed' : ''}`} data-ticket-switch={testId}>
    <span className={`inline-flex w-3.5 h-3.5 shrink-0 items-center justify-center rounded-[3px] border ${on && !off ? 'bg-silverFill border-silverFill' : 'border-borderMuted'}`}>{on && !off && <Check className="w-2.5 h-2.5 text-[#0a0a0a]" />}</span>
    <span className={`text-[11px] ${on && !off ? 'text-textPrimary' : 'text-textSecondary'}`}>{label}</span>
  </button>
);

interface Props {
  qty: number;
  value: LadderDraft;
  onChange: Dispatch<SetStateAction<LadderDraft>>;
  /** What an empty field suggests, and what a filled one means — the ticket's own words */
  target: { placeholder: (i: number) => string; title: string };
  stop: { placeholder: (i: number) => string; title: string; note?: string };
  /** The trailing distance's unit and a suggestion, in the ticket's own terms ("0.40" of the contract, "4.00" points) */
  trail: { placeholder: string; unit: string };
  /** What the stop moves to at breakeven: "what you paid" · "where you got in" */
  costWords: string;
  /** What stands at the head of the cards' row — an option's "Set on" */
  lead?: ReactNode;
  /** The levels are DISTANCES from the way in, in this unit ("pts") — the Live Chart's Order card, whose two buttons both
      carry them (the card works them out into prices at the press) */
  unit?: string;
  /** A heading of the caller's at the left of the counts' row — the counts then stand at the row's right, unnamed (the
      Order card's BRACKETS, one row where there were two) */
  head?: ReactNode;
}

const LadderFields = ({ qty, value, onChange, target, stop, trail, costWords, lead, unit, head }: Props) => {
  const n = Math.max(1, qty || 1);
  const nT = shown(value.nTargets, n);
  const nS = shown(value.nStops, n);
  const tq = splitQty(n, nT);
  const sq = splitQty(n, nS);
  /* the even share is what the count fields start with — again whenever the contracts or the levels change */
  useEffect(() => {
    onChange(prev => ({ ...prev, targetQty: tq.map(String).concat(['', '', '']).slice(0, 3), stopQty: sq.map(String).concat(['', '']).slice(0, 2) }));
  }, [n, nT, nS]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = (max: number): DropdownOption<number>[] => COUNT.slice(0, Math.min(max, n)).map((w, i) => ({ value: i + 1, label: w, hint: i === 0 ? 'Every contract at one level' : `${splitQty(n, i + 1).join(' · ')} contracts — ${SPLIT[i]}${n % (i + 1) ? ', the nearer level takes the odd one' : ''}` }));
  const set = (patch: Partial<LadderDraft>) => onChange(prev => ({ ...prev, ...patch }));
  const type = (side: 'targets' | 'stops' | 'targetQty' | 'stopQty', i: number, v: string) => onChange(prev => ({ ...prev, [side]: prev[side].map((x, j) => (j === i ? v.replace(side.endsWith('Qty') ? /[^0-9]/g : /[^0-9.]/g, '') : x)) }));
  const anyTarget = value.targets.slice(0, nT).some(v => v.trim() !== '');
  const anyStop = value.stops.slice(0, nS).some(v => v.trim() !== '');
  /* what the typed counts leave: contracts with no stop are unprotected, contracts with no target run */
  const covered = (side: Rung[]) => side.reduce((a, r) => a + r.qty, 0);
  const noStop = anyStop ? Math.max(0, n - covered(rungs(nS, value.stops, value.stopQty, n))) : 0;
  const noTarget = anyTarget ? Math.max(0, n - covered(rungs(nT, value.targets, value.targetQty, n))) : 0;
  const countField = (side: 'targetQty' | 'stopQty', i: number, share: number, testId: string) => (
    <input className={countCls} inputMode="numeric" value={value[side][i] ?? ''} placeholder={String(share)} onChange={e => type(side, i, e.target.value)} title="Contracts at this level — empty is the even share" aria-label="Contracts at this level" data-ticket-count={testId} />
  );
  return (
    <div className="flex flex-col gap-2.5" data-ticket-ladder={`${nT}/${nS}`}>
      {/* HOW MANY LEVELS, first — then a field a level, sharing one row (five at the most: three targets, two stops) */}
      <div className={`flex gap-x-3 gap-y-2 flex-wrap ${head ? 'items-center' : 'items-end'}`}>
        {head}
        {lead}
        <div className={head ? 'ml-auto' : 'flex flex-col gap-1'}>
          {!head && <span className="text-[10px] text-textMuted whitespace-nowrap">Leave it in</span>}
          <span className={`inline-flex items-center gap-1.5 ${head ? '' : 'h-8'}`}>
            <DropdownSelect label="Targets" value={nT} options={counts(3)} onChange={v => set({ nTargets: v })} title={n < 2 ? 'One contract: there is nothing to split' : 'Leave in pieces — how many targets, and how the contracts are shared'} testId="ticket-targets" size="sm" />
            <DropdownSelect label="Stops" value={nS} options={counts(2)} onChange={v => set({ nStops: v })} title={n < 2 ? 'One contract: there is nothing to split' : 'How many stops, and how the contracts are shared'} testId="ticket-stops" size="sm" align="end" />
          </span>
        </div>
      </div>
      <div className="flex items-end gap-2">
        {Array.from({ length: nT }, (_, i) => (
          <label key={`t${i}`} className="flex flex-col gap-1 min-w-0 flex-1 max-w-[132px]">
            <span className="inline-flex items-center gap-1 text-[10px] text-textMuted whitespace-nowrap">
              {nT === 1 ? (n === 1 && nS === 1 && !unit ? 'Target (optional)' : 'Target') : `Target ${i + 1}`}
              {unit && <span className="text-textMuted/80">· {unit}</span>}
              {n > 1 && (
                <>
                  · {countField('targetQty', i, tq[i], `target-${i + 1}`)} ×
                </>
              )}
            </span>
            <input className={inputCls} inputMode="decimal" title={target.title} placeholder={target.placeholder(i)} value={value.targets[i] ?? ''} onChange={e => type('targets', i, e.target.value)} data-ticket-field={i === 0 ? 'target' : `target-${i + 1}`} />
          </label>
        ))}
        {Array.from({ length: nS }, (_, i) => (
          <label key={`s${i}`} className="flex flex-col gap-1 min-w-0 flex-1 max-w-[132px]">
            <span className="inline-flex items-center gap-1 text-[10px] text-textMuted whitespace-nowrap" title={stop.note ? `The stop is ${stop.note}` : undefined}>
              {nS === 1 ? (n === 1 && nT === 1 && !unit ? 'Stop (optional)' : 'Stop') : `Stop ${i + 1}`}
              {unit && <span className="text-textMuted/80">· {unit}</span>}
              {n > 1 && (
                <>
                  · {countField('stopQty', i, sq[i], `stop-${i + 1}`)} ×
                </>
              )}
            </span>
            <input className={inputCls} inputMode="decimal" title={stop.title} placeholder={stop.placeholder(i)} value={value.stops[i] ?? ''} onChange={e => type('stops', i, e.target.value)} data-ticket-field={i === 0 ? 'stop' : `stop-${i + 1}`} />
          </label>
        ))}
      </div>
      {(noStop > 0 || noTarget > 0) && (
        <p className="text-[10px] leading-snug text-textMuted" data-ticket-uncovered>
          {noStop > 0 && <span className="text-warn">{noStop} of {n} {noStop === 1 ? 'contract has' : 'contracts have'} no stop</span>}
          {noStop > 0 && noTarget > 0 && ' · '}
          {noTarget > 0 && `${noTarget} of ${n} ${noTarget === 1 ? 'contract has' : 'contracts have'} no target — ${noTarget === 1 ? 'it runs' : 'they run'}`}
        </p>
      )}
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
        <CheckRow on={value.breakeven} off={!anyTarget || !anyStop} onChange={v => set({ breakeven: v })} label="Breakeven after the first target" hint={`When the first target fills, the stop moves to ${costWords} — once, and never further away`} testId="breakeven" />
        <CheckRow on={value.trail} off={false} onChange={v => set({ trail: v })} label="Trail the stop" hint="The stop keeps a distance from the best price since — it follows, and never moves back" testId="trail" />
        {value.trail && (
          <label className="inline-flex items-center gap-1.5 text-[10px] text-textMuted whitespace-nowrap" title={anyStop ? `The distance it keeps — empty: the distance the stop is set at${trail.unit ? `, in ${trail.unit}` : ''}` : `The distance it keeps — with no stop typed, the stop starts that far from the way in${trail.unit ? `, in ${trail.unit}` : ''}`}>
            by
            <input className={`${inputCls} h-6 w-[76px] text-[11px]`} inputMode="decimal" value={value.trailBy} placeholder={anyStop ? 'its distance' : trail.placeholder} onChange={e => set({ trailBy: e.target.value.replace(/[^0-9.]/g, '') })} data-ticket-field="trail-by" />
            {trail.unit}
          </label>
        )}
      </div>
    </div>
  );
};

export default LadderFields;
