/*
==================================================
  SLAYER TERMINAL - DROPDOWN SELECT
  (components/ui/DropdownSelect.tsx)

  One choice from a short list, as a DROPDOWN CARD
  instead of a row of chips (Noah, 2026-09-05: "i
  feel so clustered and claustrophobic, too many
  choices on lines. we need more dropdown selection
  cards that are nicely put together"). The trigger
  is a small labelled control that prints the
  current choice; the card lists every choice with
  a check on the current one and, where it helps,
  one line saying what the choice means.

  Built on Radix DropdownMenu (the prebuilt-
  libraries rule): keyboard navigation, focus
  return, outside-click and Escape, typeahead,
  portal and collision-aware placement all come
  from the library; the house grammar is ours.
==================================================
*/

import type { CSSProperties } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown, type LucideIcon } from 'lucide-react';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */

export interface DropdownOption<T extends string | number> {
  value: T;
  label: string;
  /** One line under the label — what picking this means */
  hint?: string;
}

interface DropdownSelectProps<T extends string | number> {
  /** The control's name, printed small before the current choice */
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (v: T) => void;
  /** A heading inside the card; defaults to the label */
  title?: string;
  align?: 'start' | 'end';
  /** A glyph before the label, in the muted ink — gives a card its own face
      on a line of four (Noah, 2026-09-11: the cards "show no importance or
      uniqueness than the rest making them look overlooked") */
  icon?: LucideIcon;
  /** The glyph's own colour on hover and while open — the sidebar's rule, each
      desk's icon wears its ink (Noah, 2026-09-11: "on hover the icon … turn a
      colour like we have on our sidebar") */
  ink?: string;
  /** A data-* hook for probes */
  testId?: string;
}

/** The card every dropdown on the terminal opens — one surface, one shadow, one radius */
export const CARD = 'z-[90] rounded-lg border border-borderSubtle bg-chip shadow-[0_16px_48px_rgba(0,0,0,0.65)] animate-soft-in';

const DropdownSelect = <T extends string | number>({ label, value, options, onChange, title, align = 'start', icon: Icon, ink, testId }: DropdownSelectProps<T>) => {
  const current = options.find(o => o.value === value);
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          data-dropdown={testId ?? label}
          aria-label={`${label}: ${current?.label ?? ''}`}
          className="group inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-borderSubtle bg-chip hover:border-borderMuted data-[state=open]:border-silver/50 transition-colors font-mono select-none"
          style={ink ? ({ '--ink': ink } as CSSProperties) : undefined}
        >
          {Icon && (
            <Icon
              className={`w-3 h-3 shrink-0 transition-colors duration-200 ${ink ? 'text-textMuted group-hover:text-[color:var(--ink)] group-data-[state=open]:text-[color:var(--ink)]' : 'text-textMuted'}`}
              aria-hidden="true"
              data-dropdown-icon
            />
          )}
          <span className="text-[9px] uppercase tracking-widest text-textMuted">{label}</span>
          <span className="text-[11px] font-semibold text-textPrimary">{current?.label ?? '—'}</span>
          <ChevronDown className="w-3 h-3 text-textMuted" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={align} sideOffset={6} className={`${CARD} min-w-[220px] p-1.5`} data-dropdown-card={testId ?? label}>
          <DropdownMenu.Label className="px-2 pt-1 pb-1.5 font-mono text-[9px] uppercase tracking-widest text-textMuted">{title ?? label}</DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={String(value)}
            onValueChange={v => {
              const hit = options.find(o => String(o.value) === v);
              if (hit) onChange(hit.value);
            }}
          >
            {options.map(o => (
              <DropdownMenu.RadioItem
                key={String(o.value)}
                value={String(o.value)}
                className="group flex items-start gap-2 rounded-md px-2 py-1.5 outline-none cursor-pointer text-textSecondary data-[highlighted]:bg-ink/[0.06] data-[highlighted]:text-textPrimary data-[state=checked]:text-textPrimary transition-colors"
              >
                <span className="mt-[2px] w-3 h-3 shrink-0 flex items-center justify-center">
                  <DropdownMenu.ItemIndicator>
                    <Check className="w-3 h-3" style={{ color: SILVER }} />
                  </DropdownMenu.ItemIndicator>
                </span>
                <span className="flex flex-col gap-[1px] min-w-0">
                  <span className="font-mono text-[11px] leading-snug group-data-[state=checked]:font-semibold">{o.label}</span>
                  {o.hint && <span className="font-mono text-[9px] leading-snug text-textMuted">{o.hint}</span>}
                </span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

export default DropdownSelect;
