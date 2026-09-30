/*
==================================================
  SLAYER TERMINAL - PAPER · THE DESK'S OWN DOORS
  (components/paper/DeskDoors.tsx)

  The doors in the tape's top row, where the desk puts
  its own (DeskShell's `doors`), in the house toolbar's
  button:

    THE LADDER   a future's price ladder beside the chart,
                 opened and closed here (silver while it
                 stands) — its own X and Esc close it too

    THE LAYOUT   one chart · two across · two down ·
                 three (one tall) · four — a glyph each,
                 the one in use in silver
    THE DESK     which of the reader's desks is up, and
                 in its card: the others, a new one (this
                 one, copied), its name, and what keeps
                 the panes in step (the name · the
                 interval · the crosshair)
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, Columns2, Grid2x2, LayoutPanelLeft, Plus, Rows2, Rows3, Square, Trash2 } from 'lucide-react';
import { barDoor, type GridLayout } from '../review/DeskShell';
import { CARD } from '../ui/DropdownSelect';
import { currentDesk, deleteDesk, newDesk, renameDesk, setLayout, setSync, switchDesk, useDesks, type SavedDesk } from '../../data/paper/desks';

const LAYOUTS: { value: GridLayout; label: string; icon: typeof Square }[] = [
  { value: '1', label: 'One chart', icon: Square },
  { value: '2h', label: 'Two side by side', icon: Columns2 },
  { value: '2v', label: 'Two, one over the other', icon: Rows2 },
  { value: '3', label: 'Three — one tall at the left', icon: LayoutPanelLeft },
  { value: '4', label: 'Four', icon: Grid2x2 },
];

/** THE LADDER'S DOOR — a future's only; hidden under `lg`, where the ladder has no room beside the chart */
export const LadderDoor = ({ open, onToggle, compact }: { open: boolean; onToggle: () => void; compact: boolean }) => (
  <button type="button" onClick={onToggle} aria-pressed={open} title={open ? 'Close the ladder' : 'The ladder — a price a row beside the chart: press one to place an order there'} aria-label={open ? 'Close the ladder' : 'Open the ladder'} className={`${barDoor} max-lg:hidden ${open ? 'text-silver' : ''}`} data-paper-ladder-door={open ? 'open' : 'shut'}>
    <Rows3 className="w-3.5 h-3.5" />
    {!compact && 'Ladder'}
  </button>
);

export const LayoutDoors = ({ compact }: { compact: boolean }) => {
  const desk = currentDesk(useDesks());
  return (
    <span role="group" aria-label="How many charts" className="inline-flex items-center" data-paper-layouts={desk.layout}>
      {LAYOUTS.filter(l => !compact || l.value !== '2v').map(l => {
        const on = l.value === desk.layout;
        return (
          <button key={l.value} type="button" onClick={() => setLayout(l.value)} aria-pressed={on} title={l.label} aria-label={l.label} className={`${barDoor} px-1.5 ${on ? 'text-silver' : ''}`} data-paper-layout={l.value}>
            <l.icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </span>
  );
};

/** The house's tick-box (LadderFields' CheckRow): a bordered square that fills silver and takes a tick */
const Tick = ({ on, onChange, label, hint, testId }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string; testId: string }) => (
  <button type="button" role="checkbox" aria-checked={on} onClick={() => onChange(!on)} title={hint} className="flex items-start gap-2 w-full text-left px-2 py-1.5 rounded-md hover:bg-ink/[0.05] transition-colors" data-paper-sync={testId}>
    <span className={`mt-0.5 inline-flex w-3.5 h-3.5 shrink-0 items-center justify-center rounded-[3px] border ${on ? 'bg-silverFill border-silverFill' : 'border-borderMuted'}`}>{on && <Check className="w-2.5 h-2.5 text-[#0a0a0a]" />}</span>
    <span className="min-w-0">
      <span className={`block text-[11px] ${on ? 'text-textPrimary' : 'text-textSecondary'}`}>{label}</span>
      <span className="block text-[10px] leading-snug text-textMuted">{hint}</span>
    </span>
  </button>
);

export const DeskMenu = ({ compact }: { compact: boolean }) => {
  const s = useDesks();
  const desk = currentDesk(s);
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState<SavedDesk | null>(null);
  const [draft, setDraft] = useState('');
  const field = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (naming) {
      setDraft(naming.name);
      requestAnimationFrame(() => field.current?.select());
    }
  }, [naming]);
  return (
    <Popover.Root
      open={open}
      onOpenChange={o => {
        setOpen(o);
        if (!o) setNaming(null);
      }}
    >
      <Popover.Trigger asChild>
        <button type="button" className={barDoor} title="Your desks — each its own layout of charts" data-paper-desk-menu={desk.name}>
          {!compact && <span className="text-textMuted">Desk</span>}
          <span className="normal-case tracking-normal font-semibold text-textPrimary max-w-[120px] truncate">{desk.name}</span>
          <ChevronDown className="w-3 h-3" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} collisionPadding={12} className={`${CARD} w-[280px] p-1.5 z-[95]`} data-paper-desk-card>
          <div className="px-2 pt-1 pb-1.5 font-mono text-[9px] uppercase tracking-widest text-textMuted">Your desks</div>
          {s.desks.map(d => (
            <div key={d.id} className="group flex items-center gap-1">
              {naming?.id === d.id ? (
                <form
                  className="flex-1 flex items-center gap-1 px-1"
                  onSubmit={e => {
                    e.preventDefault();
                    renameDesk(d.id, draft);
                    setNaming(null);
                  }}
                >
                  <input ref={field} value={draft} onChange={e => setDraft(e.target.value.slice(0, 32))} aria-label="The desk's name" className="flex-1 h-7 px-2 rounded-md border border-silver/50 bg-panel text-[12px] text-textPrimary outline-none" data-paper-desk-name-field />
                  <button type="submit" className="h-7 px-2 rounded-md text-[10px] font-mono uppercase tracking-wider text-silver hover:bg-silver/[0.08]">
                    Keep
                  </button>
                </form>
              ) : (
                <>
                  <button type="button" onClick={() => switchDesk(d.id)} onDoubleClick={() => setNaming(d)} title="Put this desk up — double-click to rename it" className={`flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${d.id === desk.id ? 'text-textPrimary bg-ink/[0.05]' : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.04]'}`} data-paper-desk={d.id}>
                    <span className={`w-3.5 shrink-0 ${d.id === desk.id ? 'text-silver' : 'text-transparent'}`}>
                      <Check className="w-3.5 h-3.5" />
                    </span>
                    <span className="min-w-0 truncate text-[12px]">{d.name}</span>
                    <span className="ml-auto font-mono text-[9px] text-textMuted whitespace-nowrap">
                      {d.panes.length} · {[...new Set(d.panes.map(p => p.name))].join(', ')}
                    </span>
                  </button>
                  {s.desks.length > 1 && (
                    <button type="button" onClick={() => deleteDesk(d.id)} title="Delete this desk" aria-label={`Delete ${d.name}`} className="opacity-0 group-hover:opacity-100 inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-bear hover:bg-ink/[0.06] transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
          <div className="flex items-center gap-1 px-1 pt-1">
            <button type="button" onClick={() => newDesk()} className="flex-1 inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] text-textSecondary hover:text-textPrimary hover:bg-ink/[0.04] transition-colors" data-paper-desk-new>
              <Plus className="w-3 h-3" /> A new desk — this one, copied
            </button>
            <button type="button" onClick={() => setNaming(desk)} className="px-2 py-1.5 rounded-md text-[11px] text-textSecondary hover:text-textPrimary hover:bg-ink/[0.04] transition-colors" data-paper-desk-rename>
              Rename
            </button>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-borderSubtle">
            <div className="px-2 pb-1 font-mono text-[9px] uppercase tracking-widest text-textMuted">Keep the charts in step</div>
            <Tick on={desk.sync.name} onChange={v => setSync('name', v)} label="The name" hint="Every chart shows the name the chart on the desk shows — one name at several intervals" testId="name" />
            <Tick on={desk.sync.timeframe} onChange={v => setSync('timeframe', v)} label="The interval" hint="Every chart at the interval of the chart on the desk — several names side by side" testId="timeframe" />
            <Tick on={desk.sync.crosshair} onChange={v => setSync('crosshair', v)} label="The crosshair" hint="A moment you point at on one chart is marked on the others" testId="crosshair" />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
