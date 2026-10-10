/*
==================================================
  SLAYER TERMINAL - COPY TODAY'S LEVELS
  (components/levels/CopyLevels.tsx)

  The ideas report's "copy today's levels" (2026-10-10):
  a small menu in Pinpoint's head on the Map and on
  Targets — the day's walls, flip, supreme, gamma pin
  and max pain as a Pine v5 script, a price list or
  CSV (data/levelExport.ts). Copying changes nothing
  here, so there is nothing to undo: the door says
  "Copied" for a moment, and a reader that listens
  hears it.
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ClipboardCopy } from 'lucide-react';
import { CARD } from '../ui/DropdownSelect';
import { focusBackForKeys } from '../ui/focusBack';
import { LEVEL_FORMATS, copyText, namedLevels, type DayLevels, type LevelFormat } from '../../data/levelExport';

const COPIED_MS = 2400;

const CopyLevels = ({ levels, bare = false, testId = 'copy-levels' }: { levels: () => DayLevels | null; bare?: boolean; testId?: string }) => {
  const [said, setSaid] = useState<{ ok: boolean; words: string } | null>(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async (f: LevelFormat) => {
    const l = levels();
    const fmt = LEVEL_FORMATS.find(x => x.value === f)!;
    if (!l || namedLevels(l).length === 0) {
      setSaid({ ok: false, words: 'No levels on the book yet' });
    } else {
      const ok = await copyText(fmt.make(l));
      const n = namedLevels(l).length;
      setSaid(ok ? { ok, words: `Copied ${l.ticker}'s ${n} levels as ${fmt.as}` } : { ok, words: 'The browser would not copy' });
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSaid(null), COPIED_MS);
  };

  return (
    <span className="relative inline-flex items-center" data-copy-levels={testId}>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            title="Copy today's walls, flip, supreme, pin and max pain — for TradingView, a note or a sheet"
            aria-label="Copy today's levels"
            className={`hit shrink-0 inline-flex items-center gap-1.5 h-7 rounded-md text-[11px] transition-colors data-[state=open]:text-textPrimary ${
              bare ? 'px-1.5 text-textSecondary hover:text-textPrimary hover:bg-ink/[0.05]' : 'px-2.5 border border-borderSubtle bg-chip text-textSecondary hover:text-textPrimary hover:border-borderMuted'
            }`}
            data-copy-levels-door
          >
            {said?.ok ? <Check className="w-3.5 h-3.5" style={{ color: 'rgb(var(--silver))' }} aria-hidden /> : <ClipboardCopy className="w-3.5 h-3.5" aria-hidden />}
            <span className={bare ? 'max-sm:sr-only' : ''}>{said?.ok ? 'Copied' : 'Copy levels'}</span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className={`${CARD} min-w-[260px] p-1.5`} data-copy-levels-menu onCloseAutoFocus={focusBackForKeys}>
            <DropdownMenu.Label className="px-2 pt-1 pb-1.5 text-[11px] text-textMuted">Copy today’s levels as</DropdownMenu.Label>
            {LEVEL_FORMATS.map(f => (
              <DropdownMenu.Item
                key={f.value}
                onSelect={() => void copy(f.value)}
                className="flex flex-col gap-[1px] rounded-md px-2 py-1.5 outline-none cursor-pointer text-textSecondary data-[highlighted]:bg-ink/[0.06] data-[highlighted]:text-textPrimary transition-colors"
                data-copy-format={f.value}
              >
                <span className="text-[12px] leading-snug">{f.label}</span>
                <span className="text-[11px] leading-snug text-textMuted">{f.hint}</span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <span role="status" aria-live="polite" className="sr-only" data-copy-levels-said>
        {said?.words ?? ''}
      </span>
      {said && !said.ok && (
        <span className="absolute right-0 top-full mt-1 z-10 whitespace-nowrap rounded-md border border-borderSubtle bg-chip px-2 py-1 text-[11px] text-textSecondary shadow-lg" aria-hidden>
          {said.words}
        </span>
      )}
    </span>
  );
};

export default CopyLevels;
