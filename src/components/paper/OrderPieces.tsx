/*
==================================================
  SLAYER TERMINAL - THE ORDER'S PIECES
  (components/paper/OrderPieces.tsx)

  What a strike's dropdown in the options chain is
  built from (components/paper/OptionsChain): the pill
  switch, the price box that steps a tick, the desk's
  one size, the one-press Buy or Sell, the engine's
  words for why a press would be refused, and the
  brackets' heading. They were the pieces of the
  futures Order card (laid out after TopstepX's,
  2026-09-22), which went with the futures on
  2026-09-30.
==================================================
*/

import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { Side } from '../../data/review/engine';

const SILVER_FILL = 'rgb(var(--silver-fill))';
/** The sizes a press away — TopstepX's row */
const SIZES = [1, 3, 5, 10, 15];
export const labelCls = 'text-[10px] text-textMuted whitespace-nowrap';
const HOVER = { plain: 'hover:text-textPrimary hover:bg-ink/[0.05]', bull: 'hover:text-bull hover:bg-bull/[0.12]', bear: 'hover:text-bear hover:bg-bear/[0.12]' } as const;
const stepBtn = 'w-7 inline-flex items-center justify-center text-textSecondary enabled:hover:text-textPrimary enabled:hover:bg-ink/[0.06] disabled:opacity-35 disabled:cursor-not-allowed transition-colors';

/** The house's pill switch (the tickets'): the one in hand in silver */
export const Pills = <T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; tone?: 'bull' | 'bear'; off?: boolean }[]; onChange: (v: T) => void; label: string }) => (
  <span role="group" aria-label={label} className="inline-flex h-8 rounded-md border border-borderSubtle p-[2px] gap-[2px]">
    {options.map(o => (
      <button
        key={o.value}
        type="button"
        disabled={o.off}
        aria-pressed={o.value === value}
        onClick={() => onChange(o.value)}
        className={`px-2.5 rounded-[4px] text-[11px] font-medium whitespace-nowrap transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${o.value === value ? '' : `text-textSecondary ${o.off ? '' : HOVER[o.tone ?? 'plain']}`}`}
        style={o.value === value ? { background: SILVER_FILL, color: '#0a0a0a' } : undefined}
        data-ticket-pill={o.value}
      >
        {o.label}
      </button>
    ))}
  </span>
);

/** THE PRICE a limit or a stop waits at, stepping a tick either way */
export const PriceBox = ({ value, onChange, step, label, placeholder }: { value: string; onChange: (v: string) => void; step: (dir: 1 | -1) => void; label: string; placeholder: string }) => (
  <span className="inline-flex items-stretch h-8 rounded-md border border-borderSubtle overflow-hidden" data-order-price>
    <button type="button" onClick={() => step(-1)} aria-label="A tick lower" className={stepBtn}>
      <Minus className="w-3 h-3" />
    </button>
    <input value={value} onChange={e => onChange(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" aria-label={label} placeholder={placeholder} className="w-[96px] border-x border-borderSubtle bg-panel px-2 text-center font-mono text-[12px] tnum text-textPrimary outline-none focus:bg-ink/[0.04]" data-ticket-field="price" />
    <button type="button" onClick={() => step(1)} aria-label="A tick higher" className={stepBtn}>
      <Plus className="w-3 h-3" />
    </button>
  </span>
);

/** THE SIZE — the desk's one size: − [n] + and the sizes a press away */
export const SizeRow = ({ q, onQ }: { q: number; onQ: (n: number) => void }) => {
  const [draft, setDraft] = useState(String(q));
  useEffect(() => setDraft(String(q)), [q]);
  const set = (n: number) => onQ(Math.max(1, Math.min(999, Math.round(n) || 1)));
  return (
    <div className="flex items-center gap-2 flex-wrap" data-order-size={q}>
      <span className="inline-flex items-stretch h-7 rounded-md border border-borderSubtle overflow-hidden">
        <button type="button" onClick={() => set(q - 1)} disabled={q <= 1} aria-label="One contract fewer" className={stepBtn}>
          <Minus className="w-3 h-3" />
        </button>
        <input
          value={draft}
          onChange={e => {
            const v = e.target.value.replace(/[^0-9]/g, '');
            setDraft(v);
            if (Number(v) >= 1) set(Number(v));
          }}
          onBlur={() => setDraft(String(q))}
          inputMode="numeric"
          aria-label="Contracts"
          title="Contracts a press — the chart's right-click card uses the same"
          className="w-11 border-x border-borderSubtle bg-panel text-center font-mono text-[12px] font-semibold tnum text-textPrimary outline-none focus:bg-ink/[0.04]"
          data-ticket-field="qty"
        />
        <button type="button" onClick={() => set(q + 1)} disabled={q >= 999} aria-label="One contract more" className={stepBtn}>
          <Plus className="w-3 h-3" />
        </button>
      </span>
      <span className="inline-flex items-center gap-1">
        {SIZES.map(n => (
          <button
            key={n}
            type="button"
            onClick={() => set(n)}
            aria-pressed={n === q}
            className={`h-7 min-w-[30px] px-2 rounded-full font-mono text-[11px] font-semibold tnum transition-colors ${n === q ? '' : 'border border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted'}`}
            style={n === q ? { background: SILVER_FILL, color: '#0a0a0a' } : undefined}
            data-order-size-pick={n}
          >
            {n}
          </button>
        ))}
      </span>
    </div>
  );
};

/** A BUY OR A SELL, one press: the house's quiet colours at rest, the direction's fill under the pointer */
export const Act = ({ side, count, at, why, onPress }: { side: Side; count: number; at: string; why: string | null; onPress: () => void }) => (
  <button
    type="button"
    onClick={onPress}
    disabled={!!why}
    title={why ?? undefined}
    className={`group h-10 min-w-0 px-2 rounded-md border border-borderMuted bg-ink/[0.04] font-mono text-[11px] font-semibold uppercase tracking-wider text-textPrimary whitespace-nowrap overflow-hidden text-ellipsis transition-colors disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:text-[#0a0a0a] ${side === 'buy' ? 'enabled:hover:bg-bull enabled:hover:border-bull' : 'enabled:hover:bg-bear enabled:hover:border-bear'}`}
    data-order-act={side}
  >
    {side === 'buy' ? 'Buy' : 'Sell'}{' '}
    <span className={`${side === 'buy' ? 'text-bull' : 'text-bear'} group-hover:text-current`}>
      {side === 'buy' ? '+' : '−'}
      {count}
    </span>{' '}
    @ {at}
  </button>
);

/** The engine's words for the two buttons, once where they agree */
export const whyWords = (buy: string | null, sell: string | null): string | null => (buy && sell ? (buy === sell ? buy : `Buy — ${buy} · Sell — ${sell}`) : buy ? `Buy — ${buy}` : sell ? `Sell — ${sell}` : null);

/** THE BRACKETS' HEADING — handed to LadderFields, which puts it on its counts' row */
export const BracketsHead = ({ words, says }: { words: string; says?: string }) => (
  <span className="inline-flex items-baseline gap-2 min-w-0 grow basis-[120px] overflow-hidden" title={says ?? words}>
    <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-textPrimary">Brackets</span>
    <span className="text-[10px] text-textMuted truncate">{words}</span>
  </span>
);
