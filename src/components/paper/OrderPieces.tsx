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
/** The dark word on the silver surface — the same on either ground */
const ON_SILVER = 'rgb(var(--night))';
/** The sizes a press away — TopstepX's row */
const SIZES = [1, 3, 5, 10, 15];
export const labelCls = 'text-[10px] text-textMuted whitespace-nowrap';
const HOVER = { plain: 'hover:text-textPrimary hover:bg-ink/[0.05]', bull: 'hover:text-bull hover:bg-bull/[0.12]', bear: 'hover:text-bear hover:bg-bear/[0.12]' } as const;
const stepBtn = 'hit w-7 inline-flex items-center justify-center text-textSecondary enabled:hover:text-textPrimary enabled:hover:bg-ink/[0.06] disabled:opacity-35 disabled:cursor-not-allowed transition-colors';

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
        className={`hit px-2.5 rounded-[4px] text-[11px] font-medium whitespace-nowrap transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${o.value === value ? '' : `text-textSecondary ${o.off ? '' : HOVER[o.tone ?? 'plain']}`}`}
        style={o.value === value ? { background: SILVER_FILL, color: ON_SILVER } : undefined}
        data-ticket-pill={o.value}
      >
        {o.label}
      </button>
    ))}
  </span>
);

/** A PRICE AS TYPED, kept to what a price can be (the audit's PR-4: "1.2.3" read "BUY +1 @ NAN LMT"): digits, ONE point,
    two places after it */
export const cleanPrice = (v: string): string => {
  const digits = v.replace(/[^0-9.]/g, '');
  const at = digits.indexOf('.');
  if (at < 0) return digits.slice(0, 7);
  return `${digits.slice(0, at).slice(0, 7)}.${digits.slice(at + 1).replace(/\./g, '').slice(0, 2)}`;
};
/** What a typed price says: a price, nothing typed (the default stands), or why it is not one */
export const readPrice = (v: string): { px: number | null; why: string | null } => {
  if (v.trim() === '') return { px: null, why: null };
  const n = Number(v);
  if (!Number.isFinite(n) || v === '.') return { px: null, why: 'Enter a price' };
  if (n < 0.01) return { px: null, why: 'The lowest price is 0.01' };
  return { px: Math.round(n * 100) / 100, why: null };
};

/** THE PRICE a limit or a stop waits at, stepping a tick either way. Leaving the box puts a price under the lowest at the
    lowest (0.01), and says so in the ticket's status line (`onSnap`). */
export const PriceBox = ({ value, onChange, step, label, placeholder, onSnap }: { value: string; onChange: (v: string) => void; step: (dir: 1 | -1) => void; label: string; placeholder: string; onSnap?: (words: string) => void }) => (
  <span className="inline-flex items-stretch h-8 rounded-md border border-borderSubtle overflow-hidden" data-order-price>
    <button type="button" onClick={() => step(-1)} aria-label="A tick lower" className={stepBtn}>
      <Minus className="w-3 h-3" />
    </button>
    <input
      value={value}
      onChange={e => onChange(cleanPrice(e.target.value))}
      onBlur={() => {
        if (value.trim() === '') return;
        const n = Number(value);
        if (!Number.isFinite(n) || value === '.') return;
        if (n < 0.01) {
          onChange('0.01');
          onSnap?.('The lowest price is 0.01 — the limit was set there');
        } else if (value.endsWith('.')) onChange(value.slice(0, -1));
      }}
      inputMode="decimal"
      aria-label={label} placeholder={placeholder} className="w-[96px] border-x border-borderSubtle bg-panel px-2 text-center font-mono text-[12px] tnum text-textPrimary outline-none focus:bg-ink/[0.04]" data-ticket-field="price" />
    <button type="button" onClick={() => step(1)} aria-label="A tick higher" className={stepBtn}>
      <Plus className="w-3 h-3" />
    </button>
  </span>
);

/** THE SIZE — the desk's one size: − [n] + and the sizes a press away */
export const SizeRow = ({ q, onQ }: { q: number; onQ: (n: number) => void }) => {
  const [draft, setDraft] = useState(String(q));
  /* WHAT THE BOX TOOK, said where it differs from what was typed (the audit's PR-8: "0" stood while the size stayed 1, and
     "5000" became 500 with no word) */
  const [note, setNote] = useState<string | null>(null);
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
            const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
            const n = Number(v);
            if (v !== '' && n > 999) {
              setDraft('999');
              set(999);
              setNote('999 contracts at most — the size is 999');
              return;
            }
            setDraft(v);
            if (n >= 1) {
              set(n);
              setNote(null);
            } else setNote(v === '' ? null : `At least 1 contract — the size stays ${q}`);
          }}
          onBlur={() => {
            setDraft(String(q));
            setNote(null);
          }}
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
            className={`hit h-7 min-w-[30px] px-2 rounded-full font-mono text-[11px] font-semibold tnum transition-colors ${n === q ? '' : 'border border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted'}`}
            style={n === q ? { background: SILVER_FILL, color: ON_SILVER } : undefined}
            data-order-size-pick={n}
          >
            {n}
          </button>
        ))}
      </span>
      {note && (
        <span role="status" className="basis-full text-[11px] text-warn" data-order-size-note>
          {note}
        </span>
      )}
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
    className={`group h-10 min-w-0 px-2 rounded-md border border-borderMuted bg-ink/[0.04] font-mono text-[11px] font-semibold uppercase tracking-wider text-textPrimary whitespace-nowrap overflow-hidden text-ellipsis transition-colors disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:text-[rgb(var(--night))] ${side === 'buy' ? 'enabled:hover:bg-bull enabled:hover:border-bull' : 'enabled:hover:bg-bear enabled:hover:border-bear'}`}
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
