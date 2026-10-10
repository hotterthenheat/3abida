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

import { useRef, type CSSProperties } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown, type LucideIcon } from 'lucide-react';
import { focusBackForKeys } from './focusBack';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */

export interface DropdownOption<T extends string | number> {
  value: T;
  label: string;
  /** One line under the label — what picking this means */
  hint?: string;
  /** A choice that IS a direction — calls or puts, bullish or bearish, building or leaving — wears it under the pointer:
      the row washes green or red and its word takes the ink (Noah, 2026-09-19, on the Weigher's Side card: "these cards
      should turn red or green on hover for directional visual understanding"). Red and green are direction and nothing
      else in this house, so only a choice that is one gets a tone; "Both" and "Every read" stay the plain wash. At rest
      the row is unchanged — silver's check still says where you are. */
  tone?: 'bull' | 'bear';
  /** A choice that is the absence of one ("Not said") — the trigger prints it in the secondary ink, so a set choice
      reads as set (the journal's tags, 2026-09-22) */
  quiet?: boolean;
}

/* whole class strings, so Tailwind sees them */
const ROW_WASH = {
  plain: 'data-[highlighted]:bg-ink/[0.06] data-[highlighted]:text-textPrimary',
  bull: 'data-[highlighted]:bg-bull/[0.12] data-[highlighted]:text-bull',
  bear: 'data-[highlighted]:bg-bear/[0.12] data-[highlighted]:text-bear',
} as const;

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
  /** The trigger's height: 28 by rest; `sm` is 24 — for a card head's 32px line, where the
      full size touched the borders (Noah, 2026-09-14) */
  size?: 'md' | 'sm';
  /** The card WITHOUT its printed name — for a line that measured itself too short for four named cards (the Weigher's
      chain head on a laptop, 2026-09-20). The name stays in the tooltip, the aria-label and the open card's heading. */
  bare?: boolean;
}

/** The card every dropdown on the terminal opens — one surface, one shadow, one radius */
export const CARD = 'z-[90] rounded-lg border border-borderSubtle bg-chip shadow-[0_16px_48px_rgba(0,0,0,0.65)] animate-soft-in';

const DropdownSelect = <T extends string | number>({ label, value, options, onChange, title, align = 'start', icon: Icon, ink, testId, size = 'md', bare = false }: DropdownSelectProps<T>) => {
  const current = options.find(o => o.value === value);
  /* OPENED BY THE KEYS, THE CARD STARTS ON THE CHOICE (2026-10-10, the audit's PR-27): Radix puts the keys on the first
     row, so ↓ Enter on "Start with" at $25,000 picked $5,000. A card opened from the keys focuses the checked row; one
     opened by the pointer focuses nothing, as before (a focused row wears the hover wash). */
  const byKeys = useRef(false);
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          data-dropdown={testId ?? label}
          aria-label={`${label}: ${current?.label ?? ''}`}
          title={bare ? label : undefined}
          onPointerDown={() => (byKeys.current = false)}
          onKeyDown={() => (byKeys.current = true)}
          /* `hit`: a finger's 44 px on a touch screen. ON A PHONE THE CHOICE WRAPS, never "0DTE · …" (the audit's CO-19): the
             trigger grows a line rather than cutting its value */
          className={`hit group inline-flex items-center gap-1.5 ${size === 'sm' ? 'h-6 px-2' : 'h-7 px-2.5'} max-sm:h-auto max-sm:py-1 ${size === 'sm' ? 'max-sm:min-h-6' : 'max-sm:min-h-7'} max-w-full rounded-md border border-borderSubtle bg-chip hover:border-borderMuted data-[state=open]:border-silver/50 transition-colors font-mono select-none text-left`}
          style={ink ? ({ '--ink': ink } as CSSProperties) : undefined}
        >
          {Icon && (
            <Icon
              className={`w-3 h-3 shrink-0 transition-colors duration-200 ${ink ? 'text-textMuted group-hover:text-[color:var(--ink)] group-data-[state=open]:text-[color:var(--ink)]' : 'text-textMuted'}`}
              aria-hidden="true"
              data-dropdown-icon
            />
          )}
          {/* the name at the house's 11 px floor, in sentence case (2026-10-10 — it was 9 px tracked capitals) */}
          {!bare && <span className="shrink-0 text-[11px] text-textMuted">{label}</span>}
          {/* min-w-0 + truncate: a long value gives before the card does — on a desk; on a phone it wraps to a second line */}
          {/* the trigger wears the choice's tone — a Yes reads green, a No red, the way its row did (2026-09-22) */}
          <span className={`min-w-0 truncate max-sm:whitespace-normal max-sm:leading-tight text-[11px] font-semibold ${current?.tone === 'bull' ? 'text-bull' : current?.tone === 'bear' ? 'text-bear' : current?.quiet ? 'text-textSecondary' : 'text-textPrimary'}`} data-tone={current?.tone ?? (current?.quiet ? 'quiet' : undefined)}>
            {current?.label ?? '—'}
          </span>
          <ChevronDown className="w-3 h-3 shrink-0 text-textMuted" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          className={`${CARD} min-w-[220px] p-1.5`}
          data-dropdown-card={testId ?? label}
          onCloseAutoFocus={focusBackForKeys}
          /* the menu's entry focus (Radix's RovingFocusGroup, passed through though DropdownMenu's types leave it out): it
             would put the keys on the first row */
          {...({
            onEntryFocus: (e: Event) => {
              if (!byKeys.current) return;
              const checked = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>('[role="menuitemradio"][data-state="checked"]');
              if (!checked) return;
              e.preventDefault();
              checked.focus({ preventScroll: true });
            },
          } as object)}
        >
          <DropdownMenu.Label className="px-2 pt-1 pb-1.5 font-mono text-[11px] text-textMuted">{title ?? label}</DropdownMenu.Label>
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
                data-tone={o.tone}
                className={`group flex items-start gap-2 rounded-md px-2 py-1.5 outline-none cursor-pointer text-textSecondary ${ROW_WASH[o.tone ?? 'plain']} data-[state=checked]:text-textPrimary transition-colors`}
              >
                <span className="mt-[2px] w-3 h-3 shrink-0 flex items-center justify-center">
                  <DropdownMenu.ItemIndicator>
                    <Check className="w-3 h-3" style={{ color: SILVER }} />
                  </DropdownMenu.ItemIndicator>
                </span>
                <span className="flex flex-col gap-[1px] min-w-0">
                  <span className="font-mono text-[11px] leading-snug group-data-[state=checked]:font-semibold">{o.label}</span>
                  {o.hint && <span className="font-mono text-[10px] leading-snug text-textMuted">{o.hint}</span>}
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
