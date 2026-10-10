/*
==================================================
  SLAYER TERMINAL - CONDITIONS TOGETHER
  (components/alerts/AllComposer.tsx)

  An AND across up to three conditions (the ideas
  report's item 7, 2026-10-10 — "SPY above the flip
  AND net flow bullish over 15 min"), set in the
  alerts drawer. Each row is a state that holds or not
  right now; the alert fires when they all come to
  hold together (gex/alertStore.ts evaluateAll), and
  takes the lifecycle every alert has — how often,
  until when, a snooze, the log.
==================================================
*/

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import Simulator from '../../core/simulator';
import { ALL_MAX, MAX_ALERTS, armAll, condWords, type AllCond, type LevelName } from '../gex/alertStore';

type Kind = AllCond['t'];
const KIND_OPTIONS: DropdownOption<Kind>[] = [
  { value: 'level', label: 'A level', hint: 'Price against the call wall, the put wall, the flip or the supreme — the level moves with the book' },
  { value: 'price', label: 'A price', hint: 'Price against a figure you type' },
  { value: 'average', label: 'An average', hint: 'Price against VWAP or a 9, 21 or 50-bar average on a timeframe' },
  { value: 'rsi', label: 'RSI', hint: 'The 14-bar RSI against a line, on a timeframe' },
  { value: 'dealers', label: 'Dealers', hint: 'Which way the whole book’s hedging leans — absorbing moves or amplifying them' },
  { value: 'flow', label: 'Net flow', hint: 'The name’s option premium over the last minutes, bullish less bearish' },
];
const SIDE_OPTIONS: DropdownOption<'above' | 'below'>[] = [
  { value: 'above', label: 'Above' },
  { value: 'below', label: 'Below' },
];
const LEVEL_OPTIONS: DropdownOption<LevelName>[] = [
  { value: 'flip', label: 'The flip' },
  { value: 'callWall', label: 'The call wall' },
  { value: 'putWall', label: 'The put wall' },
  { value: 'supreme', label: 'The supreme' },
];
const AVERAGE_OPTIONS: DropdownOption<'vwap' | 'ema9' | 'ema21' | 'ema50'>[] = [
  { value: 'vwap', label: 'VWAP' },
  { value: 'ema9', label: '9-bar average' },
  { value: 'ema21', label: '21-bar average' },
  { value: 'ema50', label: '50-bar average' },
];
const TF_OPTIONS: DropdownOption<string>[] = ['1m', '5m', '15m', '30m', '1h'].map(v => ({ value: v, label: v }));
const DEALER_OPTIONS: DropdownOption<'absorbing' | 'amplifying'>[] = [
  { value: 'absorbing', label: 'Absorbing moves', hint: 'The book nets call-heavy' },
  { value: 'amplifying', label: 'Amplifying moves', hint: 'The book nets put-heavy' },
];
const FLOW_OPTIONS: DropdownOption<'bullish' | 'bearish'>[] = [
  { value: 'bullish', label: 'Bullish', hint: 'Calls bought and puts sold outweigh the rest' },
  { value: 'bearish', label: 'Bearish', hint: 'Puts bought and calls sold outweigh the rest' },
];
const MINS_OPTIONS: DropdownOption<number>[] = [5, 15, 30, 60].map(m => ({ value: m, label: `${m} min` }));

const round = (v: number) => Math.round(v * 100) / 100;

/** A fresh condition of a kind, at sensible figures for the name */
const freshCond = (t: Kind, spot: number): AllCond => {
  switch (t) {
    case 'price':
      return { t, op: 'above', value: round(Math.round(spot)) };
    case 'level':
      return { t, op: 'above', level: 'flip' };
    case 'average':
      return { t, op: 'above', source: 'vwap', tf: '5m' };
    case 'rsi':
      return { t, op: 'above', value: 70, tf: '5m' };
    case 'dealers':
      return { t, op: 'absorbing' };
    case 'flow':
      return { t, op: 'bullish', mins: 15 };
  }
};

const NumberField = ({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) => (
  <input
    type="number"
    inputMode="decimal"
    step="any"
    value={Number.isFinite(value) ? value : ''}
    onChange={e => onChange(Number(e.target.value))}
    aria-label={label}
    className="w-[84px] h-7 px-2 rounded-md border border-borderSubtle bg-chip font-mono text-[11px] tnum text-textPrimary outline-none focus:border-borderMuted"
  />
);

const Row = ({ c, set, spot }: { c: AllCond; set: (c: AllCond) => void; spot: number }) => (
  <div className="flex items-center gap-1.5 flex-wrap">
    <DropdownSelect<Kind> label="What" size="sm" value={c.t} options={KIND_OPTIONS} onChange={t => set(freshCond(t, spot))} title="What this condition reads" />
    {c.t === 'dealers' ? (
      <DropdownSelect label="Are" size="sm" value={c.op} options={DEALER_OPTIONS} onChange={op => set({ ...c, op })} />
    ) : c.t === 'flow' ? (
      <>
        <DropdownSelect label="Is" size="sm" value={c.op} options={FLOW_OPTIONS} onChange={op => set({ ...c, op })} />
        <DropdownSelect<number> label="Over" size="sm" value={c.mins} options={MINS_OPTIONS} onChange={mins => set({ ...c, mins })} />
      </>
    ) : (
      <>
        <DropdownSelect label={c.t === 'rsi' ? 'RSI' : 'Price'} size="sm" value={c.op} options={SIDE_OPTIONS} onChange={op => set({ ...c, op } as AllCond)} />
        {c.t === 'price' && <NumberField value={c.value} onChange={value => set({ ...c, value })} label="The price" />}
        {c.t === 'level' && <DropdownSelect label="Of" size="sm" value={c.level} options={LEVEL_OPTIONS} onChange={level => set({ ...c, level })} />}
        {c.t === 'average' && (
          <>
            <DropdownSelect label="Of" size="sm" value={c.source} options={AVERAGE_OPTIONS} onChange={source => set({ ...c, source })} />
            <DropdownSelect label="On" size="sm" value={c.tf} options={TF_OPTIONS} onChange={tf => set({ ...c, tf })} />
          </>
        )}
        {c.t === 'rsi' && (
          <>
            <NumberField value={c.value} onChange={value => set({ ...c, value })} label="The RSI line" />
            <DropdownSelect label="On" size="sm" value={c.tf} options={TF_OPTIONS} onChange={tf => set({ ...c, tf })} />
          </>
        )}
      </>
    )}
  </div>
);

const AllComposer = ({ ticker, onDone }: { ticker: string; onDone: (said: string) => void }) => {
  const spot = Simulator.TICKERS[ticker]?.currentPrice ?? 0;
  const [conds, setConds] = useState<AllCond[]>(() => [freshCond('level', spot), freshCond('flow', spot)]);
  const [note, setNote] = useState('');
  const valid = conds.every(c => (c.t !== 'price' && c.t !== 'rsi') || (Number.isFinite(c.value) && (c.t === 'rsi' || c.value > 0)));
  const set = () => {
    if (!valid) return setNote('A price or an RSI line is missing its figure');
    const armed = armAll(ticker, conds);
    if (!armed) return setNote(`Already watching that on ${ticker}, or ${ticker} has its ${MAX_ALERTS} already`);
    onDone(`Set on ${ticker}: ${conds.map(condWords).join(' and ')}`);
  };
  return (
    <div className="rounded-md border border-borderSubtle/80 bg-ink/[0.02] px-3 py-2.5 flex flex-col gap-2" data-all-composer>
      <p className="text-[11px] text-textSecondary">
        On <span className="font-mono font-semibold text-textPrimary">{ticker}</span>, when all of these hold together
      </p>
      {conds.map((c, i) => (
        <div key={i} className="flex items-start gap-1.5" data-all-cond={i}>
          <span className="shrink-0 w-7 h-7 inline-flex items-center font-mono text-[10px] text-textMuted">{i === 0 ? 'When' : 'and'}</span>
          <div className="min-w-0 flex-1">
            <Row c={c} spot={spot} set={next => setConds(cs => cs.map((x, j) => (j === i ? next : x)))} />
          </div>
          {conds.length > 2 && (
            <button type="button" onClick={() => setConds(cs => cs.filter((_, j) => j !== i))} aria-label={`Take off the condition — ${condWords(c)}`} className="hit shrink-0 mt-0.5 w-6 h-6 inline-flex items-center justify-center rounded-md text-textMuted hover:text-textPrimary hover:bg-ink/[0.05]">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2 flex-wrap">
        {conds.length < ALL_MAX && (
          <button type="button" onClick={() => setConds(cs => [...cs, freshCond('dealers', spot)])} className="hit inline-flex items-center gap-1 h-6 px-2 rounded-md border border-borderSubtle font-mono text-[10px] text-textSecondary hover:text-textPrimary hover:border-borderMuted" data-all-add>
            <Plus className="w-3 h-3" /> A condition
          </button>
        )}
        <button type="button" onClick={set} className="hit ml-auto inline-flex items-center h-7 px-3 rounded-md bg-textPrimary text-[11px] font-semibold text-[rgb(var(--panel))] hover:opacity-90" data-all-set>
          Set it
        </button>
      </div>
      <p className="font-mono text-[10px] leading-snug text-textMuted">
        It alerts when they come together, not while they stay together.{note ? ` ${note}.` : ''}
      </p>
    </div>
  );
};

export default AllComposer;
