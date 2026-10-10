/*
==================================================
  SLAYER TERMINAL - THE LINK CHIP
  (components/link/LinkGroupChip.tsx)

  LINK GROUPS ACROSS THE SHELL (2026-10-10, the
  ideas report's item 10). A panel or a pane can join
  one of four groups, A to D, or none: a panel in a
  group reads the group's name and a name picked on it
  moves the whole group — a Terrain pane, a Pulse
  panel, the Weigher's chain, wherever they stand.
  None is what every surface did before: a Pulse panel
  follows the terminal or holds its own, a Terrain
  pane stands alone. Letters, never colours (the
  tokens' rule: no new hues for a group).

  Quiet: a small chip with the letter, the link mark
  when there is none; a short menu of the five
  choices, each saying what the group reads now.
==================================================
*/

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, Group } from 'lucide-react';
import { CARD } from '../ui/DropdownSelect';
import { focusBackForKeys } from '../ui/focusBack';
import { LINK_GROUPS, useLinkGroups, type LinkGroup } from '../../context/marketStore';

const SILVER = 'rgb(var(--silver))';

interface LinkGroupChipProps {
  /** The group this surface is in — null for none */
  group: LinkGroup | null;
  onChange: (group: LinkGroup | null) => void;
  /** What "none" means on this surface, in a few words */
  noneHint: string;
  /** The surface's name for the menu's head and the label ("this panel", "this pane") */
  what?: string;
  testId?: string;
  /** `sm`: the 20px chip of a chart pane's crowded head (Terrain's measured row) */
  size?: 'sm' | 'md';
}

const LinkGroupChip = ({ group, onChange, noneHint, what = 'this panel', testId, size = 'md' }: LinkGroupChipProps) => {
  const groups = useLinkGroups();
  const label = group
    ? `Link group ${group}${groups[group] ? ` — reads ${groups[group]}` : ''}; a name picked here moves every panel in ${group}`
    : `Link ${what} to a group — panels sharing a letter read and set one name`;
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={`hit shrink-0 inline-flex items-center justify-center border font-mono leading-none transition-colors select-none data-[state=open]:border-silver/50 ${
            size === 'sm' ? 'w-5 h-5 rounded-[3px] text-[11px] font-bold' : 'h-6 min-w-6 px-1 rounded-md text-[11px] font-semibold'
          } ${
            group ? 'border-borderMuted bg-ink/[0.10] text-textPrimary' : 'border-transparent text-textMuted hover:text-textPrimary hover:bg-ink/[0.06]'
          }`}
          data-link-group={group ?? 'none'}
          data-link-chip={testId}
        >
          {group ?? <Group className="w-3 h-3" aria-hidden="true" />}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className={`${CARD} min-w-[220px] p-1.5`} data-link-menu onCloseAutoFocus={focusBackForKeys}>
          <DropdownMenu.Label className="px-2 pt-1 pb-1.5 font-mono text-[11px] uppercase tracking-widest text-textMuted">Link group</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={group ?? ''} onValueChange={v => onChange(v === '' ? null : (v as LinkGroup))}>
            {(['', ...LINK_GROUPS] as const).map(g => (
              <DropdownMenu.RadioItem
                key={g || 'none'}
                value={g}
                className="group flex items-start gap-2 rounded-md px-2 py-1.5 outline-none cursor-pointer text-textSecondary data-[highlighted]:bg-ink/[0.06] data-[highlighted]:text-textPrimary data-[state=checked]:text-textPrimary transition-colors"
              >
                <span className="mt-[2px] w-3 h-3 shrink-0 flex items-center justify-center">
                  <DropdownMenu.ItemIndicator>
                    <Check className="w-3 h-3" style={{ color: SILVER }} />
                  </DropdownMenu.ItemIndicator>
                </span>
                <span className="flex flex-col gap-[1px] min-w-0">
                  <span className="font-mono text-[11px] leading-snug group-data-[state=checked]:font-semibold">{g ? `Group ${g}` : 'None'}</span>
                  <span className="font-mono text-[11px] leading-snug text-textMuted">
                    {g ? (groups[g] ? `Reads ${groups[g]}` : `No name yet — ${what} gives it its own`) : noneHint}
                  </span>
                </span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

export default LinkGroupChip;
