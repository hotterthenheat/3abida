/*
==================================================
  SLAYER TERMINAL - DROPDOWN MULTI
  (components/ui/DropdownMulti.tsx)

  Any number of choices from what is on the page,
  as the same dropdown card DropdownSelect opens —
  the trigger prints what is picked, the card lists
  every choice in groups with the Terrain overlay
  menu's checkbox rows (a bordered square that fills
  and takes a tick, every row independent; Noah,
  2026-09-09: "it should read whats on the current
  page and be a dropdown so user can select what to
  add. like how we have our overlay dropdown on
  terrain"). The card stays open while ticking; a
  Clear row at the foot empties it.

  Built on Radix DropdownMenu like its sibling:
  keyboard navigation, focus return, outside-click
  and Escape come from the library.
==================================================
*/

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';
import { CARD } from './DropdownSelect';

export interface MultiOption {
  value: string;
  label: string;
  /** One line under the label — what this is */
  hint?: string;
  /** How many of the page's rows it covers, printed at the row's right */
  count?: number;
}

export interface MultiGroup {
  title: string;
  options: MultiOption[];
}

interface DropdownMultiProps {
  /** The control's name, printed small before the summary */
  label: string;
  values: string[];
  groups: MultiGroup[];
  onChange: (values: string[]) => void;
  /** A heading inside the card; defaults to the label */
  title?: string;
  /** What the trigger says when nothing is picked */
  emptyWord?: string;
  align?: 'start' | 'end';
  /** A data-* hook for probes */
  testId?: string;
}

/** The trigger's summary: nothing · one name · two names · two names +N */
const summarise = (values: string[], groups: MultiGroup[], emptyWord: string): string => {
  if (values.length === 0) return emptyWord;
  const labels = values.map(v => groups.flatMap(g => g.options).find(o => o.value === v)?.label ?? v);
  if (labels.length <= 2) return labels.join(', ');
  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
};

const DropdownMulti = ({ label, values, groups, onChange, title, emptyWord = 'Everything', align = 'end', testId }: DropdownMultiProps) => {
  const picked = new Set(values);
  const toggle = (v: string) => onChange(picked.has(v) ? values.filter(x => x !== v) : [...values, v]);
  const summary = summarise(values, groups, emptyWord);
  const shown = groups.filter(g => g.options.length > 0);
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          data-dropdown={testId ?? label}
          data-picked={values.length}
          aria-label={`${label}: ${summary}`}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-borderSubtle bg-chip hover:border-borderMuted data-[state=open]:border-silver/50 transition-colors font-mono select-none max-w-[260px]"
        >
          <span className="text-[9px] uppercase tracking-widest text-textMuted">{label}</span>
          <span className={`text-[11px] font-semibold truncate ${values.length ? 'text-textPrimary' : 'text-textSecondary'}`}>{summary}</span>
          <ChevronDown className="w-3 h-3 text-textMuted shrink-0" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={align} sideOffset={6} className={`${CARD} p-1.5`} data-dropdown-card={testId ?? label}>
          <DropdownMenu.Label className="px-2 pt-1 pb-1.5 font-mono text-[9px] uppercase tracking-widest text-textMuted">{title ?? label}</DropdownMenu.Label>
          {shown.length === 0 ? (
            <div className="px-2 py-3 font-mono text-[10px] text-textMuted">Nothing on the page to pick from</div>
          ) : (
            <div className="grid gap-x-2" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(200px, 1fr))` }}>
              {shown.map(g => (
                <div key={g.title} className="min-w-0 flex flex-col gap-0.5 max-h-[420px] overflow-y-auto" data-multi-group={g.title}>
                  <DropdownMenu.Label className="px-2 pt-1 pb-1 font-mono text-[9px] uppercase tracking-widest text-textMuted">{g.title}</DropdownMenu.Label>
                  {g.options.map(o => {
                    const on = picked.has(o.value);
                    return (
                      <DropdownMenu.CheckboxItem
                        key={o.value}
                        checked={on}
                        onCheckedChange={() => toggle(o.value)}
                        onSelect={e => e.preventDefault()}
                        className="flex items-start gap-2.5 px-2 py-1.5 rounded outline-none cursor-pointer text-left transition-colors data-[highlighted]:bg-ink/[0.04]"
                        data-multi-option={o.value}
                      >
                        {/* a tick is where-you-are, so it wears holo silver, never the neon (Noah, 2026-09-10) */}
                        <span className={`mt-px inline-flex w-3.5 h-3.5 shrink-0 items-center justify-center rounded-[3px] border ${on ? 'bg-silverFill border-silverFill' : 'border-borderMuted'}`}>
                          {on && <Check className="w-2.5 h-2.5 text-[#0a0a0a]" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className={`min-w-0 truncate font-mono text-[11px] font-semibold ${on ? 'text-textPrimary' : 'text-textSecondary'}`}>{o.label}</span>
                            {o.count != null && <span className="ml-auto font-mono text-[9px] tnum text-textMuted">{o.count}</span>}
                          </span>
                          {o.hint && <span className="block text-[10px] text-textMuted leading-snug truncate">{o.hint}</span>}
                        </span>
                      </DropdownMenu.CheckboxItem>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          {values.length > 0 && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-borderSubtle" />
              <DropdownMenu.Item
                onSelect={() => onChange([])}
                className="px-2 py-1.5 rounded outline-none cursor-pointer font-mono text-[10px] uppercase tracking-widest text-textSecondary data-[highlighted]:bg-ink/[0.04] data-[highlighted]:text-textPrimary"
                data-multi-clear
              >
                Clear · show everything
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

export default DropdownMulti;
