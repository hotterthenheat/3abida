/*
==================================================
  SLAYER TERMINAL - THE WORKSPACE STRIP
  (pages/paper/WorkspaceBar.tsx)

  The tabs across the top of the desk, the layout
  the active one is split into, what the panes
  share, and the door that writes the whole thing
  out as JSON and reads it back.

  A tab is a CONTEXT, not a page: its own layout
  and its own charts, each pane holding its own
  instrument and interval. The plus at the end
  opens another; double-click a tab to rename it.

  The four switches say what travels between the
  panes of the active tab — the symbol, the
  interval, the crosshair, the frame. Nothing
  travels unless it is switched on, because two
  panes at two intervals on one name is the whole
  reason the split exists.
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import { Columns2, Grid2x2, LayoutPanelTop, Plus, Rows2, Save, Square, X } from 'lucide-react';
import PopoverCard from '../../components/ui/PopoverCard';
import {
  LAYOUTS,
  addTab,
  closeTab,
  exportWorkspace,
  importWorkspace,
  pickTab,
  renameTab,
  resetWorkspace,
  setLayout,
  setSync,
  useWorkspace,
  type PaneLayout,
  type Tab,
} from '../../core/paper/workspace';
import { Toggle } from './paperKit';

const LAYOUT_ICON: Record<PaneLayout, typeof Square> = { '1': Square, '2h': Columns2, '2v': Rows2, '3': LayoutPanelTop, '4': Grid2x2 };
const DOOR = 'inline-flex items-center justify-center w-6 h-6 rounded border border-transparent text-textMuted hover:text-textPrimary hover:border-borderSubtle transition-colors';

const TabChip = ({ tab, active, closable }: { tab: Tab; active: boolean; closable: boolean }) => {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);
  return (
    <span
      className={`group inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-t border-b-2 transition-colors ${
        active ? 'border-silver bg-ink/[0.05] text-textPrimary' : 'border-transparent text-textMuted hover:text-textSecondary'
      }`}
      data-ws-tab={tab.id}
      data-ws-active={active ? '1' : '0'}
    >
      {editing ? (
        <input
          ref={inputRef}
          defaultValue={tab.name}
          onBlur={e => {
            renameTab(tab.id, e.target.value);
            setEditing(false);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setEditing(false);
          }}
          aria-label="Tab name"
          className="w-[84px] h-5 px-1 rounded border border-silver/50 bg-inputBg font-mono text-[10px] text-textPrimary outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => pickTab(tab.id)}
          onDoubleClick={() => setEditing(true)}
          title={`${tab.name} — ${tab.panes.length} chart${tab.panes.length === 1 ? '' : 's'}. Double-click to rename.`}
          className="font-mono text-[10px] whitespace-nowrap max-w-[120px] truncate"
        >
          {tab.name}
        </button>
      )}
      {tab.panes.length > 1 && <span className="font-mono text-[8px] tnum text-textMuted">{tab.panes.length}</span>}
      {closable && (
        <button
          type="button"
          onClick={() => closeTab(tab.id)}
          aria-label={`Close ${tab.name}`}
          className="inline-flex items-center justify-center w-4 h-4 rounded text-textMuted opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-bear hover:bg-bear/[0.12] transition-all"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
};

/* ---- the JSON door -------------------------------------------------------------------------- */

const WorkspaceDoor = () => {
  const [text, setText] = useState('');
  const [said, setSaid] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  return (
    <PopoverCard
      title="This workspace"
      meta="JSON"
      width={340}
      testId="paper-workspace"
      onOpenChange={o => {
        if (o) {
          setText(exportWorkspace());
          setSaid(null);
          setArmed(false);
        }
      }}
      trigger={
        <button type="button" title="Save this layout, or read one back" aria-label="Workspace" className={DOOR} data-ws-door>
          <Save className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="px-3 py-2 font-mono text-[9px] text-textMuted leading-tight">
        Every tab, every pane, every interval, the switches and the lines you have drawn — the desk comes back exactly as it was left. Copy it out, or paste one in and read it.
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        spellCheck={false}
        aria-label="Workspace JSON"
        data-ws-json
        className="mx-3 mb-2 block w-[calc(100%-24px)] h-[132px] p-2 rounded border border-borderSubtle bg-inputBg font-mono text-[9px] leading-snug text-textSecondary outline-none focus:border-silver/60 resize-none"
      />
      <div className="px-3 pb-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(exportWorkspace()).then(() => setSaid('Copied')).catch(() => setSaid('The clipboard is closed'));
          }}
          className="h-6 px-2 rounded border border-borderSubtle font-mono text-[9px] uppercase tracking-widest text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors"
        >
          Copy
        </button>
        <button
          type="button"
          data-ws-read
          onClick={() => {
            try {
              importWorkspace(text);
              setSaid('Read in');
            } catch (e) {
              setSaid(e instanceof Error ? e.message : 'That is not a workspace');
            }
          }}
          className="h-6 px-2 rounded border border-borderSubtle font-mono text-[9px] uppercase tracking-widest text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors"
        >
          Read it
        </button>
        <button
          type="button"
          onClick={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            resetWorkspace();
            setText(exportWorkspace());
            setSaid('Back to one chart');
            setArmed(false);
          }}
          className={`ml-auto h-6 px-2 rounded border font-mono text-[9px] uppercase tracking-widest transition-colors ${armed ? 'border-bear text-bear bg-bear/[0.08]' : 'border-borderSubtle text-textSecondary hover:text-textPrimary'}`}
        >
          {armed ? 'Yes, reset' : 'Reset'}
        </button>
      </div>
      {said && <div className="px-3 pb-2 font-mono text-[9px] text-textSecondary">{said}</div>}
    </PopoverCard>
  );
};

/* ---- the strip ------------------------------------------------------------------------------ */

const WorkspaceBar = ({ tab }: { tab: Tab }) => {
  const ws = useWorkspace();
  const sync = ws.sync;
  const SWITCHES: { key: keyof typeof sync; label: string; hint: string }[] = [
    { key: 'symbol', label: 'Symbol', hint: 'Change the name in one pane and every pane follows' },
    { key: 'interval', label: 'Interval', hint: 'The same for the timeframe' },
    { key: 'crosshair', label: 'Crosshair', hint: 'A moment hovered in one pane is marked in the others' },
    { key: 'timeRange', label: 'Time', hint: 'Pan or zoom one and the rest ride along' },
  ];
  return (
    <div className="flex items-end gap-2 h-7 min-w-0" data-paper-workspace>
      <div className="flex items-end gap-0.5 min-w-0 overflow-x-auto no-scrollbar" role="tablist" aria-label="Workspace tabs">
        {ws.tabs.map(t => (
          <TabChip key={t.id} tab={t} active={t.id === ws.activeTab} closable={ws.tabs.length > 1} />
        ))}
        <button type="button" onClick={() => addTab(tab.panes[0]?.instrument)} title="Another tab" aria-label="Add a tab" className={`${DOOR} mb-0.5 shrink-0`} data-ws-add>
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <span className="ml-auto flex items-center gap-1 shrink-0 pb-0.5">
        {LAYOUTS.map(l => {
          const Icon = LAYOUT_ICON[l.key];
          const on = tab.layout === l.key;
          return (
            <button
              key={l.key}
              type="button"
              onClick={() => setLayout(tab.id, l.key)}
              title={`${l.label} — ${l.hint}`}
              aria-label={l.label}
              aria-pressed={on}
              data-ws-layout={l.key}
              className={`inline-flex items-center justify-center w-6 h-6 rounded border transition-colors ${on ? 'border-silver/50 text-textPrimary bg-ink/[0.05]' : 'border-transparent text-textMuted hover:text-textSecondary hover:border-borderSubtle'}`}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          );
        })}
        <span className="w-px h-4 bg-borderSubtle mx-0.5" aria-hidden />
        <PopoverCard
          title="What the panes share"
          meta={SWITCHES.filter(s => sync[s.key]).length ? `${SWITCHES.filter(s => sync[s.key]).length} on` : 'none'}
          width={300}
          testId="paper-sync"
          trigger={
            <button type="button" title="What travels between the panes" aria-label="Sync" className={`${DOOR} ${SWITCHES.some(s => sync[s.key]) ? 'text-textPrimary' : ''}`} data-ws-sync-door>
              <span className="font-mono text-[9px] uppercase tracking-widest px-1">Sync</span>
            </button>
          }
        >
          <ul className="py-1">
            {SWITCHES.map(s => (
              <li key={s.key} className="flex items-center gap-2 px-3 h-8" data-sync-row={s.key}>
                <Toggle checked={sync[s.key]} onChange={v => setSync({ [s.key]: v })} label={s.label} />
                <span className="font-mono text-[10px] text-textPrimary">{s.label}</span>
                <span className="ml-auto font-mono text-[9px] text-textMuted text-right leading-tight max-w-[170px]">{s.hint}</span>
              </li>
            ))}
          </ul>
          <div className="px-3 py-2 border-t border-borderSubtle/70 font-mono text-[9px] text-textMuted leading-tight">
            Only inside the tab you are on. The crosshair and the frame never go through the desk's state — they ride a bus straight between the charts, so a synced pan costs nothing.
          </div>
        </PopoverCard>
        <WorkspaceDoor />
      </span>
    </div>
  );
};

export default WorkspaceBar;
