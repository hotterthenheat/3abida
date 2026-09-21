/*
==================================================
  SLAYER TERMINAL - THE SCRIPT LIBRARY (components/scripts/ScriptLibrary.tsx)

  What can go on this pane, and what is on it: the
  terminal's own Slayer scripts, the classic
  technicals in Pine, the chart's built-in tools,
  the scripts you wrote, and your favourites — one
  search over all of them, a tick to draw one, a
  gear to set its inputs, a name to open it in the
  editor, and "Write your own". Sits where the
  Indicators control was (Noah, 2026-09-10).
==================================================
*/

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Settings2, Star } from 'lucide-react';
import * as Switch from '@radix-ui/react-switch';
import { armScript, removeAlert, useAlerts } from '../gex/alertStore';
import { builtinScripts } from '../../data/builtinScripts';
import { openEditor, recentScripts, remember } from '../../data/editorDock';
import { bumpLibrary, getPaneBars, liftFromPane, placeOnPane, updateOnPane, useLibraryVersion, usePaneScripts, type PaneScript } from '../../data/paneScripts';
import { scriptStore } from '../../data/scriptStore';
import type { ChartScript, PaneId, Script, ScriptInput, ScriptInputValue } from '../../types/scripts';
import Modal from '../ui/Modal';
import { INDICATOR_ITEMS } from '../gex/indicatorItems';
import { MAX_SUB_PANES, SUB_PANE_ORDER, type ChartIndicators } from '../gex/StrikeChart';
import { Name } from '../ui/Name';
import DataState from '../ui/DataState';

type Shelf = 'recent' | 'favourites' | 'mine' | 'slayer' | 'technicals' | 'chart';
type Kind = 'slayer' | 'pine' | 'chart';

interface Row {
  key: string;
  kind: Kind;
  title: string;
  description: string;
  pane: 'overlay' | 'own';
  group: string;
  script?: Script;
  chartKey?: keyof ChartIndicators;
  on: boolean;
  placed?: PaneScript;
  inputs: ScriptInput[];
}

const SHELVES: { key: Shelf; label: string; section: 'Personal' | 'Built in' }[] = [
  /* what you added to a chart or opened lately, newest first (Noah, 2026-09-10) */
  { key: 'recent', label: 'Recently used', section: 'Personal' },
  { key: 'favourites', label: 'Favourites', section: 'Personal' },
  { key: 'mine', label: 'My scripts', section: 'Personal' },
  { key: 'slayer', label: 'Slayer', section: 'Built in' },
  { key: 'technicals', label: 'Technicals', section: 'Built in' },
  { key: 'chart', label: 'Chart tools', section: 'Built in' },
];

const KIND_WORD: Record<Kind, string> = { slayer: 'slayer', pine: 'pine', chart: 'chart' };

/* ---- the script's own alerts ------------------------------------------------------ */

/* TELL ME WHEN, for a script (2026-09-10, Noah: "wire the script alerts into
   the bell"): every `alertcondition(...)` the script declares, as a switch —
   the Targets card's grammar. Set in place: armed here for THIS name on THIS
   pane's timeframe with the placement's inputs; judged by the shell's
   watcher on every page; rung through the bell like every other alert. */
const AlertSwitches = ({ script, chart, paneId }: { script: Script; chart: ChartScript; paneId: PaneId }) => {
  const pane = getPaneBars(paneId);
  const ticker = pane?.ticker ?? '';
  const alerts = useAlerts(ticker);
  const conditions = script.meta?.alerts ?? [];
  if (!pane || !ticker || conditions.length === 0) return null;
  const hit = (id: string) => alerts.find(a => a.kind === 'script' && a.scriptId === script.id && a.conditionId === id && a.paneId === paneId && !a.firedAt);
  const set = (c: { id: string; title: string; message: string }, on: boolean) => {
    const h = hit(c.id);
    if (!on && h) removeAlert(ticker, h.id);
    else if (on && !h) armScript(ticker, { scriptId: script.id, scriptTitle: script.title, conditionId: c.id, title: c.title, message: c.message, paneId, tf: pane.timeframe, inputs: chart.inputs, armedBar: pane.bars[pane.bars.length - 1]?.time ?? 0 }, Date.now());
  };
  return (
    <div className="col-span-3 mt-1 pt-2 border-t border-borderSubtle/60" data-script-alerts>
      <div className="pb-1 font-mono text-[8px] uppercase tracking-[0.14em] text-textMuted">
        Tell me when · <Name t={ticker} size={10} /> · {pane.timeframe}
      </div>
      {conditions.map(c => {
        const on = !!hit(c.id);
        const id = `script-alert-${script.id}-${c.id}`;
        return (
          <label key={c.id} htmlFor={id} className="flex items-center gap-3 h-7 cursor-pointer" data-script-alert={c.id}>
            <span className={`flex-1 min-w-0 truncate font-mono text-[11px] ${on ? 'font-semibold text-silver' : 'text-textPrimary'}`} title={c.message || undefined}>
              {c.title}
            </span>
            <Switch.Root
              id={id}
              checked={on}
              onCheckedChange={v => set(c, v)}
              aria-label={c.title}
              className="relative shrink-0 w-8 h-[18px] rounded-full border border-borderSubtle bg-ink/[0.06] data-[state=checked]:bg-silver data-[state=checked]:border-silver transition-colors outline-none focus-visible:ring-2 focus-visible:ring-silver/60"
            >
              <Switch.Thumb className="block w-3 h-3 rounded-full bg-textPrimary translate-x-[2px] data-[state=checked]:translate-x-[16px] data-[state=checked]:bg-panel transition-transform" />
            </Switch.Root>
          </label>
        );
      })}
    </div>
  );
};

/* ---- the inputs form ------------------------------------------------------------- */

const InputsForm = ({ inputs, chart, paneId, script }: { inputs: ScriptInput[]; chart: ChartScript; paneId: PaneId; script: Script }) => {
  const set = (id: string, v: ScriptInputValue) => void updateOnPane(paneId, { ...chart, inputs: { ...chart.inputs, [id]: v } });
  const reset = () => void updateOnPane(paneId, { ...chart, inputs: {} });
  const val = (i: ScriptInput): ScriptInputValue => chart.inputs[i.id] ?? i.default;
  const SOURCES = ['open', 'high', 'low', 'close', 'hl2', 'hlc3', 'ohlc4'];
  const field = 'h-7 px-2 rounded-md border border-borderSubtle bg-chip font-mono text-[11px] text-textPrimary outline-none focus:border-borderMuted';
  return (
    <div className="mx-2 mb-2 px-3 py-2.5 rounded-md border border-borderSubtle/60 bg-chip grid grid-cols-3 gap-x-4 gap-y-2" data-script-inputs>
      {inputs.map(i => (
        <label key={i.id} className="flex items-center gap-2 min-w-0" title={i.tooltip}>
          <span className="w-[120px] shrink-0 truncate text-[10px] text-textSecondary">{i.title}</span>
          {i.kind === 'bool' ? (
            <input type="checkbox" checked={!!val(i)} onChange={e => set(i.id, e.target.checked)} className="accent-[#D2FF00]" />
          ) : i.kind === 'color' ? (
            <input type="color" value={String(val(i)).slice(0, 7)} onChange={e => set(i.id, e.target.value)} className="h-7 w-10 bg-transparent border border-borderSubtle rounded-md" />
          ) : i.kind === 'source' ? (
            <select value={String(val(i))} onChange={e => set(i.id, e.target.value)} className={field}>
              {SOURCES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : i.options ? (
            <select value={String(val(i))} onChange={e => set(i.id, e.target.value)} className={field}>
              {i.options.map(o => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : i.kind === 'int' || i.kind === 'float' ? (
            <input type="number" value={Number(val(i))} min={i.min} max={i.max} step={i.step ?? (i.kind === 'int' ? 1 : 0.1)} onChange={e => set(i.id, i.kind === 'int' ? Math.round(Number(e.target.value)) : Number(e.target.value))} className={`${field} w-20`} />
          ) : (
            <input type="text" value={String(val(i))} onChange={e => set(i.id, e.target.value)} className={`${field} w-32`} />
          )}
        </label>
      ))}
      {inputs.length > 0 && (
        <div className="col-span-3 flex justify-end">
          <button onClick={reset} className="font-mono text-[9px] uppercase tracking-wider text-textMuted hover:text-textPrimary transition-colors">
            Back to the script's defaults
          </button>
        </div>
      )}
      <AlertSwitches script={script} chart={chart} paneId={paneId} />
    </div>
  );
};

/* ---- the library ------------------------------------------------------------------- */

interface ScriptLibraryProps {
  open: boolean;
  onClose: () => void;
  paneId?: PaneId;
  indicators?: ChartIndicators;
  onIndicators?: (next: ChartIndicators) => void;
  /** The editor sits beside a FULL-SCREEN chart only (Noah, 2026-09-10) — off, the doors to it stay shut and say why */
  fullscreen?: boolean;
}

const EDITOR_SHUT = 'Open the chart full screen first — the editor sits beside it';

const ScriptLibrary = ({ open, onClose, paneId, indicators, onIndicators, fullscreen = false }: ScriptLibraryProps) => {
  const [shelf, setShelf] = useState<Shelf>('slayer');
  const [query, setQuery] = useState('');
  const [mine, setMine] = useState<Script[]>([]);
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [highlight, setHighlight] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  /* bumped when something is remembered, so the Recently used shelf re-reads */
  const [recentTick, setRecentTick] = useState(0);
  const version = useLibraryVersion();
  const placed = usePaneScripts(paneId);
  /* THE EDITOR IS THE DOCK'S (2026-09-10): opening a script closes this chooser so the chart shows under the code */
  const edit = useCallback(
    (script: Script | null) => {
      if (!fullscreen) return;
      if (script) remember(script);
      openEditor(script, paneId);
      onClose();
    },
    [paneId, onClose, fullscreen]
  );

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void (async () => {
      const [m, f] = await Promise.all([scriptStore.list('mine'), scriptStore.favourites()]);
      if (!alive) return;
      setMine(m);
      setFavourites(new Set(f.map(x => x.scriptId)));
    })();
    return () => {
      alive = false;
    };
  }, [open, version]);

  const subsOn = useMemo(() => SUB_PANE_ORDER.filter(k => indicators?.[k]).length + placed.filter(p => p.chart.visible && p.script.meta?.pane === 'own').length, [indicators, placed]);

  const rowFor = useCallback(
    (s: Script): Row => {
      const p = placed.find(x => x.script.id === s.id);
      return { key: s.id, kind: s.tags[0] === 'Slayer' ? 'slayer' : 'pine', title: s.title, description: s.description, pane: s.meta?.pane ?? 'overlay', group: s.tags[0] ?? 'My scripts', script: s, on: !!p, placed: p, inputs: s.meta?.inputs ?? [] };
    },
    [placed]
  );

  const allRows = useMemo<Record<Shelf, Row[]>>(() => {
    const builtins = builtinScripts();
    const slayer = builtins.filter(s => s.tags[0] === 'Slayer').map(rowFor);
    const technicals = builtins.filter(s => s.tags[0] !== 'Slayer').map(rowFor);
    const chart: Row[] = INDICATOR_ITEMS.map(i => ({ key: `chart:${i.key}`, kind: 'chart', title: i.label, description: i.hint, pane: i.sub ? 'own' : 'overlay', group: 'Chart built-ins', chartKey: i.key, on: !!indicators?.[i.key], inputs: [] }));
    const myRows = mine.map(rowFor).map(r => ({ ...r, group: 'My scripts' }));
    const everything = [...slayer, ...technicals, ...chart, ...myRows];
    const favs = everything.filter(r => favourites.has(r.key)).map(r => ({ ...r, group: 'Favourites' }));
    /* newest first, from the same list the editor's menu keeps; a script no longer in the library is skipped */
    const recent = recentScripts()
      .map(r => everything.find(x => x.key === r.id))
      .filter((r): r is Row => !!r)
      .map(r => ({ ...r, group: 'Recently used' }));
    return { recent, favourites: favs, mine: myRows, slayer, technicals, chart };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, favourites, indicators, rowFor, recentTick]);

  const q = query.trim().toLowerCase();
  const rows = useMemo<Row[]>(() => {
    if (!q) return allRows[shelf];
    const seen = new Set<string>();
    const out: Row[] = [];
    for (const s of ['slayer', 'technicals', 'chart', 'mine'] as Shelf[]) {
      for (const r of allRows[s]) {
        if (seen.has(r.key)) continue;
        if (`${r.title} ${r.description} ${r.group}`.toLowerCase().includes(q)) {
          seen.add(r.key);
          out.push({ ...r, group: SHELVES.find(x => x.key === s)!.label });
        }
      }
    }
    return out;
  }, [q, shelf, allRows]);

  useEffect(() => setHighlight(0), [shelf, q]);

  const capped = (r: Row) => r.pane === 'own' && !r.on && subsOn >= MAX_SUB_PANES;

  const toggle = useCallback(
    async (r: Row) => {
      if (capped(r)) return;
      /* turning something ON is a use — it goes to the top of Recently used */
      const used = () => {
        remember({ id: r.key, title: r.title });
        setRecentTick(t => t + 1);
      };
      if (r.kind === 'chart') {
        if (indicators && onIndicators && r.chartKey) {
          onIndicators({ ...indicators, [r.chartKey]: !r.on });
          if (!r.on) used();
        }
        return;
      }
      if (!paneId || !r.script) return;
      if (r.placed) await liftFromPane(paneId, r.placed.chart.id);
      else {
        if (r.script.status !== 'ok') {
          edit(r.script);
          return;
        }
        await placeOnPane(paneId, r.script.id);
        used();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paneId, indicators, onIndicators, subsOn, edit]
  );

  const star = async (r: Row) => {
    await scriptStore.toggleFavourite(r.key);
    bumpLibrary();
  };

  /* ↑↓ move · ↵ toggle — while the library is the front window */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') && (t as HTMLInputElement).type !== 'checkbox' && !(t as HTMLElement).hasAttribute('data-library-search');
      if (typing) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight(h => Math.min(rows.length - 1, h + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight(h => Math.max(0, h - 1));
      } else if (e.key === 'Enter' && rows[highlight]) {
        e.preventDefault();
        void toggle(rows[highlight]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, rows, highlight, toggle]);

  const shipped = allRows.slayer.length + allRows.technicals.length + allRows.chart.length;
  const onThisPane = placed.filter(p => p.chart.visible).length + (indicators ? INDICATOR_ITEMS.filter(i => indicators[i.key]).length : 0);
  const counts: Record<Shelf, number> = { recent: allRows.recent.length, favourites: allRows.favourites.length, mine: allRows.mine.length, slayer: allRows.slayer.length, technicals: allRows.technicals.length, chart: allRows.chart.length };

  /* the rows, grouped by their heading in order of first appearance */
  const groups = useMemo(() => {
    const order: string[] = [];
    const by = new Map<string, Row[]>();
    for (const r of rows) {
      if (!by.has(r.group)) {
        by.set(r.group, []);
        order.push(r.group);
      }
      by.get(r.group)!.push(r);
    }
    return order.map(g => ({ title: g, rows: by.get(g)! }));
  }, [rows]);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        ariaLabel="Indicators and scripts"
        widthClass="max-w-[1080px]"
        header={
          <div className="flex items-center gap-3 min-w-0">
            <span className="holo-bg w-6 h-6 rounded-[6px] shrink-0 flex items-center justify-center font-mono text-[10px] font-bold text-[#0a0a0a]" aria-hidden>
              &gt;_
            </span>
            <span className="text-[15px] font-semibold leading-tight text-textPrimary">Indicators and scripts</span>
            <span className="font-mono text-[10px] text-textMuted whitespace-nowrap" data-library-count>
              {onThisPane} on this pane
            </span>
          </div>
        }
        headerActions={
          <button
            onClick={() => edit(null)}
            disabled={!fullscreen}
            title={fullscreen ? 'A new script on the template, in the editor beside the chart' : EDITOR_SHUT}
            className="inline-flex items-center h-7 px-2.5 rounded-md border border-silver/40 bg-silver/[0.06] font-mono text-[10px] uppercase tracking-wider text-textPrimary hover:bg-silver/[0.1] transition-colors disabled:hover:bg-silver/[0.06]"
            data-library-write
          >
            Write your own
          </button>
        }
      >
        {/* THE SEARCH — one field over every shelf */}
        <label className="flex items-center gap-2 h-9 px-3 rounded-md border border-borderSubtle bg-chip focus-within:border-borderMuted">
          <Search className="w-3.5 h-3.5 text-textMuted shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search every shelf — a name, a word, a group"
            spellCheck={false}
            data-library-search
            className="flex-1 min-w-0 bg-transparent font-mono text-[12px] text-textPrimary placeholder:text-textMuted outline-none"
          />
        </label>

        {/* ONE SIZE ON EVERY SHELF (Noah, 2026-09-10: "when i click different subpages
            the size changes creating an unpleasant look"): the shelves and the rows
            share a fixed height and the rows scroll inside it, so five Slayer
            scripts and eighteen technicals open the same card. */}
        <div className="grid grid-cols-[176px_minmax(0,1fr)] gap-4 h-[56vh]" data-library>
          {/* THE SHELVES */}
          <nav className="flex flex-col gap-1 pr-4 border-r border-borderSubtle overflow-y-auto" aria-label="Shelves">
            {(['Personal', 'Built in'] as const).map(section => (
              <div key={section} className="mb-2">
                <div className="px-2 pb-1 font-mono text-[8px] uppercase tracking-widest text-textMuted">{section}</div>
                {SHELVES.filter(s => s.section === section && (s.key !== 'chart' || !!onIndicators)).map(s => {
                  const on = shelf === s.key && !q;
                  return (
                    <button
                      key={s.key}
                      onClick={() => {
                        setShelf(s.key);
                        setQuery('');
                      }}
                      aria-pressed={on}
                      data-library-shelf={s.key}
                      className={`w-full flex items-center justify-between h-8 px-2 rounded-md text-[12px] transition-colors ${on ? 'bg-silver/[0.08] text-textPrimary shadow-[inset_2px_0_0_0_rgba(199,211,232,0.7)]' : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.03]'}`}
                    >
                      <span className={on ? 'font-semibold' : ''}>{s.label}</span>
                      <span className="font-mono text-[10px] tnum text-textMuted">{counts[s.key]}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* THE ROWS — the head pinned, the list scrolling under it; a new shelf or a
              new search fades its rows up softly (the house soft-in, keyed) instead of
              swapping them in a frame */}
          <div className="min-w-0 h-full flex flex-col" role="table" aria-label="Scripts">
            <div className="grid grid-cols-[60px_minmax(0,1fr)_96px_28px_28px_40px] items-center h-7 px-2 font-mono text-[8px] uppercase tracking-widest text-textMuted border-b border-borderSubtle shrink-0" role="row">
              <span>Kind</span>
              <span>Name</span>
              <span>Shelf</span>
              <span />
              <span />
              <span className="text-right">On</span>
            </div>
            <div key={`${q ? 'search' : shelf}|${q}`} className="flex-1 min-h-0 overflow-y-auto animate-soft-in" data-library-rows>
            {rows.length === 0 && (
              <DataState
                kind="empty"
                className="h-[200px]"
                pad="sm"
                title={q ? 'No match' : 'Nothing on this shelf'}
                body={
                  q
                    ? `Nothing on any shelf matches “${q}”.`
                    : shelf === 'mine'
                      ? 'Write your own, or copy a built-in to start from.'
                      : shelf === 'favourites'
                        ? 'The star on any row keeps it here.'
                        : shelf === 'recent'
                          ? 'What you add to a chart or open lands here, newest first.'
                          : 'Pick another shelf.'
                }
              />
            )}
            {groups.map(g => (
              <div key={g.title}>
                <div className="px-2 pt-3 pb-1 font-mono text-[8px] uppercase tracking-widest text-textMuted">{g.title}</div>
                {g.rows.map(r => {
                  const idx = rows.indexOf(r);
                  const hi = idx === highlight;
                  const held = capped(r);
                  const fav = favourites.has(r.key);
                  return (
                    <div key={r.key}>
                      <div
                        role="row"
                        onMouseEnter={() => setHighlight(idx)}
                        className={`grid grid-cols-[60px_minmax(0,1fr)_96px_28px_28px_40px] items-center h-[38px] px-2 rounded-md transition-colors ${hi ? 'bg-silver/[0.06]' : ''} ${r.on ? 'shadow-[inset_2px_0_0_0_rgba(199,211,232,0.7)]' : ''}`}
                        data-library-row={r.key}
                        data-on={r.on || undefined}
                      >
                        <span className={`inline-flex w-fit items-center font-mono text-[8px] uppercase tracking-widest border rounded px-1.5 py-0.5 ${r.kind === 'slayer' ? 'text-silver/90 border-silver/30' : 'text-textMuted border-borderSubtle'}`}>{KIND_WORD[r.kind]}</span>
                        <span className="min-w-0 flex items-baseline gap-2">
                          {r.script && fullscreen ? (
                            <button onClick={() => edit(r.script!)} className="font-semibold text-[12px] text-textPrimary hover:underline underline-offset-2 whitespace-nowrap" title="Open in the editor">
                              {r.title}
                            </button>
                          ) : r.script ? (
                            <span className="font-semibold text-[12px] text-textPrimary whitespace-nowrap" title={EDITOR_SHUT}>
                              {r.title}
                            </span>
                          ) : (
                            <span className="font-semibold text-[12px] text-textPrimary whitespace-nowrap">{r.title}</span>
                          )}
                          <span className="text-[10px] text-textMuted truncate">{r.description}</span>
                          {r.script?.status === 'error' && <span className="font-mono text-[8px] uppercase tracking-widest text-bear">does not read</span>}
                        </span>
                        <span className="font-mono text-[10px] text-textMuted whitespace-nowrap" title={r.pane === 'own' ? 'Takes its own pane under the tape — two at most' : 'Draws on the tape itself'}>
                          {r.pane === 'own' ? 'own pane' : 'on the tape'}
                        </span>
                        <span>
                          {r.on && r.placed && (r.inputs.length > 0 || (r.script?.meta?.alerts.length ?? 0) > 0) && paneId && (
                            <button onClick={() => setExpanded(x => (x === r.key ? null : r.key))} aria-pressed={expanded === r.key} title={r.inputs.length > 0 ? 'Its inputs and alerts' : 'Its alerts'} className={`p-1 rounded transition-colors ${expanded === r.key ? 'text-textPrimary bg-ink/[0.06]' : 'text-textMuted hover:text-textPrimary'}`} data-library-gear>
                              <Settings2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </span>
                        <button onClick={() => void star(r)} aria-pressed={fav} title={fav ? 'Take it off your favourites' : 'Keep it in your favourites'} className={`p-1 rounded transition-colors ${fav ? 'text-silver' : 'text-textMuted hover:text-textPrimary'}`} data-library-star>
                          <Star className="w-3.5 h-3.5" fill={fav ? 'currentColor' : 'none'} />
                        </button>
                        <span className="flex justify-end">
                          <button
                            role="checkbox"
                            aria-checked={r.on}
                            disabled={held}
                            onClick={() => void toggle(r)}
                            title={held ? 'Two own panes are the cap — turn one off first, or the tape shrinks past its floor' : r.on ? 'Take it off this pane' : 'Draw it on this pane'}
                            className={`inline-flex w-[14px] h-[14px] items-center justify-center rounded-[3px] border transition-colors ${r.on ? 'bg-silverFill border-silverFill' : 'border-borderMuted hover:border-textSecondary'} ${held ? 'opacity-40 cursor-default' : ''}`}
                            data-library-toggle
                          >
                            {r.on && (
                              <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" aria-hidden>
                                <path d="M2 5.2 4.2 7.4 8 3" fill="none" stroke="#0a0a0a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                        </span>
                      </div>
                      {expanded === r.key && r.placed && r.script && paneId && <InputsForm inputs={r.inputs} chart={r.placed.chart} paneId={paneId} script={r.script} />}
                    </div>
                  );
                })}
              </div>
            ))}
            </div>
          </div>
        </div>

        {/* THE FOOT */}
        <div className="flex items-center gap-3 pt-3 border-t border-borderSubtle font-mono text-[10px] text-textMuted" data-library-foot>
          <span>
            <span className="text-textSecondary">{shipped}</span> shipped · <span className="text-textSecondary">{allRows.mine.length}</span> of your own
          </span>
          <span className="text-textMuted/70">· Slayer and Pine rows draw on this pane with their own inputs · Chart rows are the tape's built-ins{fullscreen ? '' : ' · the editor opens beside a full-screen chart'}</span>
          <span className="ml-auto whitespace-nowrap">↑↓ move · ↵ toggle · esc close</span>
        </div>
      </Modal>
    </>
  );
};

export default ScriptLibrary;
