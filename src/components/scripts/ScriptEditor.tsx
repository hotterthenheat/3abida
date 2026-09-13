/*
==================================================
  SLAYER TERMINAL - THE SCRIPT EDITOR (components/scripts/ScriptEditor.tsx)

  Where a script is written — the panel the dock
  holds (EditorDock.tsx), under the page column so
  the chart stays live above the code. The house's
  mark, then the script's NAME AS A MENU: Save,
  Make a copy, Rename, Version history, Create new,
  the scripts recently opened, Open from the library
  (TradingView's menu, in the house's words — Noah,
  2026-09-10). The text in a CodeMirror editor
  dressed in the house's inks, and under it one
  line that says what the script does right now —
  "Runs · drew 5 plots, 1 fill over 309 bars in 14
  ms", or "Line 12 · the plain reason" with the
  line lit. Every keystroke is read again; nothing
  runs until it reads clean.

  Ctrl+S saves. Ctrl+Enter adds to the chart. A
  closed dock keeps the draft.
==================================================
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { basicSetup } from 'codemirror';
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, keymap, type DecorationSet } from '@codemirror/view';
import { ChevronDown, Copy, FilePlus2, FolderOpen, History, Pencil, Play, RotateCcw, Save, X } from 'lucide-react';
import { compile, explain, run, type Compiled } from '../../core/pine';
import { NEW_SCRIPT_SOURCE } from '../../data/builtinScripts';
import { clearDraft, getDraft, openEditor, recentScripts, remember, setDraft, type RecentScript } from '../../data/editorDock';
import { forgetCompiled } from '../alerts/AlertWatcher';
import { bumpLibrary, getPaneBars, liftFromPane, placeOnPane, refreshEveryPane, usePaneScripts } from '../../data/paneScripts';
import { scriptStore } from '../../data/scriptStore';
import type { PaneId, Script, ScriptVersion } from '../../types/scripts';
import { CARD } from '../ui/DropdownSelect';
import { pineHighlight, pineLanguage, pineTheme } from './pineLanguage';
import { Name } from '../ui/Name';

/* ---- the error line ---------------------------------------------------------------- */

const setErrorLine = StateEffect.define<number | null>();
const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    let next = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setErrorLine)) {
        if (e.value === null || e.value < 1 || e.value > tr.state.doc.lines) next = Decoration.none;
        else {
          const line = tr.state.doc.line(e.value);
          next = Decoration.set([Decoration.line({ class: 'cm-pine-error' }).range(line.from)]);
        }
      }
    }
    return next;
  },
  provide: f => EditorView.decorations.from(f),
});

/* ---- the status --------------------------------------------------------------------- */

interface Status {
  ok: boolean;
  line: number;
  words: string;
  inputs: number;
  alerts: number;
  pane: 'overlay' | 'own' | null;
}

const readStatus = (source: string, paneId?: PaneId): Status => {
  let compiled: Compiled;
  try {
    compiled = compile(source);
  } catch (e) {
    const { line, message } = explain(e);
    return { ok: false, line, words: message, inputs: 0, alerts: 0, pane: null };
  }
  const m = compiled.meta;
  const pane = m.pane;
  const bars = paneId ? getPaneBars(paneId) : undefined;
  if (!bars || bars.bars.length === 0) {
    return { ok: true, line: 0, words: `Reads clean · ${m.plots.length} plot${m.plots.length === 1 ? '' : 's'}${m.fills ? `, ${m.fills} fill${m.fills === 1 ? '' : 's'}` : ''} — open it from a chart to run it over bars`, inputs: m.inputs.length, alerts: m.alerts.length, pane };
  }
  try {
    const r = run(compiled, bars.bars, { budgetMs: 600, ticker: bars.ticker, timeframe: bars.timeframe });
    const drew = [`${r.plots.length} plot${r.plots.length === 1 ? '' : 's'}`];
    if (r.fills.length) drew.push(`${r.fills.length} fill${r.fills.length === 1 ? '' : 's'}`);
    if (r.shapes.length) drew.push(`${r.shapes.length} shape${r.shapes.length === 1 ? '' : 's'}`);
    if (r.hlines.length) drew.push(`${r.hlines.length} line${r.hlines.length === 1 ? '' : 's'}`);
    return { ok: true, line: 0, words: `Runs · drew ${drew.join(', ')} over ${r.stats.bars} bars in ${r.stats.ms.toFixed(0)} ms`, inputs: m.inputs.length, alerts: m.alerts.length, pane };
  } catch (e) {
    const { line, message } = explain(e);
    return { ok: false, line, words: message, inputs: m.inputs.length, alerts: m.alerts.length, pane };
  }
};

const ago = (t: number): string => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};

/* ---- the panel ------------------------------------------------------------------------ */

interface ScriptEditorPanelProps {
  /** The script to open; null opens the template as a new script of yours */
  script: Script | null;
  /** The pane the editor was opened from — Add to chart lands there, and the status runs over its bars */
  paneId?: PaneId;
  onClose: () => void;
  /** The dock's way to the library: "Open from the library…" */
  onOpenLibrary: () => void;
}

const MENU_ITEM = 'flex items-center gap-2.5 w-full px-2 py-1.5 rounded text-left text-[12px] text-textPrimary outline-none data-[highlighted]:bg-ink/[0.05] data-[disabled]:opacity-40 cursor-default';
const MENU_KEY = 'ml-auto font-mono text-[9px] text-textMuted';

const ScriptEditorPanel = ({ script, paneId, onClose, onOpenLibrary }: ScriptEditorPanelProps) => {
  const draft = getDraft(script);
  const [current, setCurrent] = useState<Script | null>(script);
  const [title, setTitle] = useState(draft?.title ?? script?.title ?? 'My script');
  const [source, setSource] = useState(draft?.source ?? script?.source ?? NEW_SCRIPT_SOURCE);
  const [dirty, setDirty] = useState(!!draft && (draft.source !== (script?.source ?? NEW_SCRIPT_SOURCE) || draft.title !== (script?.title ?? 'My script')));
  const [status, setStatus] = useState<Status>(() => readStatus(draft?.source ?? script?.source ?? NEW_SCRIPT_SOURCE, paneId));
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [versions, setVersions] = useState<ScriptVersion[] | null>(null);
  const [recent, setRecent] = useState<RecentScript[]>(() => recentScripts());
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const timer = useRef<number>(0);
  const readOnly = !!current?.readOnly;
  const placed = usePaneScripts(paneId);
  const onPane = useMemo(() => (current ? (placed.find(p => p.script.id === current.id) ?? null) : null), [placed, current]);

  /* the draft follows every keystroke, so a closed dock loses nothing */
  useEffect(() => {
    setDraft(current ?? script, { title, source });
  }, [current, script, title, source]);

  /* the editor itself */
  useEffect(() => {
    if (!hostRef.current) return;
    const extensions: Extension[] = [
      keymap.of([
        {
          key: 'Mod-s',
          run: () => {
            saveRef.current?.();
            return true;
          },
        },
        {
          key: 'Mod-Enter',
          run: () => {
            addRef.current?.();
            return true;
          },
        },
      ]),
      basicSetup,
      pineLanguage,
      pineHighlight,
      pineTheme,
      errorLineField,
      EditorView.lineWrapping,
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
      EditorView.updateListener.of(u => {
        if (u.docChanged) {
          const text = u.state.doc.toString();
          setSource(text);
          setDirty(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => {
            const s = readStatus(text, paneId);
            setStatus(s);
            viewRef.current?.dispatch({ effects: setErrorLine.of(s.ok ? null : s.line) });
          }, 160);
        }
        if (u.selectionSet || u.docChanged) {
          const head = u.state.selection.main.head;
          const line = u.state.doc.lineAt(head);
          setCursor({ line: line.number, col: head - line.from + 1 });
        }
      }),
    ];
    const view = new EditorView({ state: EditorState.create({ doc: source, extensions }), parent: hostRef.current });
    viewRef.current = view;
    view.dispatch({ effects: setErrorLine.of(status.ok ? null : status.line) });
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, current?.id]);

  const jumpToLine = useCallback(() => {
    const v = viewRef.current;
    if (!v || !status.line) return;
    const line = v.state.doc.line(Math.min(status.line, v.state.doc.lines));
    v.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
    v.focus();
  }, [status.line]);

  const save = useCallback(async (): Promise<Script | null> => {
    if (readOnly) {
      setNote('A built-in cannot be edited in place — Make a copy first');
      return current;
    }
    setBusy('Saving');
    try {
      const saved = await scriptStore.save({ id: current?.id, title, source, description: current?.description, tags: current?.tags });
      setCurrent(saved);
      setDirty(false);
      clearDraft(current ?? script);
      setNote(`Saved · version ${saved.version}`);
      remember(saved);
      /* an alert armed on this script must judge the new text, not the cached compile */
      forgetCompiled(saved.id);
      setRecent(recentScripts());
      bumpLibrary();
      await refreshEveryPane();
      if (versions) setVersions(await scriptStore.versions(saved.id));
      return saved;
    } catch (e) {
      setNote(explain(e).message);
      return null;
    } finally {
      setBusy(null);
    }
  }, [current, script, title, source, readOnly, versions]);

  const copy = useCallback(async () => {
    setBusy('Copying');
    try {
      const saved = current && source === current.source ? await scriptStore.fork(current.id, `${title} (copy)`) : await scriptStore.save({ title: `${title} (copy)`, source, description: current?.description, tags: current?.tags });
      clearDraft(current ?? script);
      setCurrent(saved);
      setTitle(saved.title);
      setDirty(false);
      setNote('Now yours to edit');
      setVersions(null);
      remember(saved);
      setRecent(recentScripts());
      bumpLibrary();
    } catch (e) {
      setNote(explain(e).message);
    } finally {
      setBusy(null);
    }
  }, [current, script, title, source]);

  const addToChart = useCallback(async () => {
    if (!paneId) {
      setNote('Open the editor from a chart to add to it');
      return;
    }
    setBusy('Adding');
    try {
      let target = current;
      if (!target || dirty) target = (await save()) ?? target;
      if (!target) return;
      if (target.status === 'error') {
        setNote('Fix the line first — a script that does not read cannot draw');
        return;
      }
      if (placed.some(p => p.script.id === target!.id)) {
        setNote('Already on the chart');
        return;
      }
      await placeOnPane(paneId, target.id);
      setNote('On the chart');
    } finally {
      setBusy(null);
    }
  }, [paneId, current, dirty, save, placed]);

  const removeFromChart = useCallback(async () => {
    if (!paneId || !onPane) return;
    setBusy('Removing');
    try {
      await liftFromPane(paneId, onPane.chart.id);
      setNote('Off the chart');
    } finally {
      setBusy(null);
    }
  }, [paneId, onPane]);

  /* the keymap reaches the latest handlers through refs */
  const saveRef = useRef<() => void>(() => {});
  const addRef = useRef<() => void>(() => {});
  saveRef.current = () => void save();
  addRef.current = () => void addToChart();

  const showVersions = useCallback(async () => {
    if (!current || current.readOnly) {
      setNote(current?.readOnly ? 'A built-in has one version — Make a copy to keep your own' : 'Save it first — versions start with the first save');
      return;
    }
    setVersions(await scriptStore.versions(current.id));
  }, [current]);

  const restore = useCallback(
    async (v: number) => {
      if (!current) return;
      setBusy('Restoring');
      try {
        const restored = await scriptStore.restore(current.id, v);
        setCurrent(restored);
        setSource(restored.source);
        setDirty(false);
        clearDraft(current);
        const view = viewRef.current;
        if (view) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: restored.source } });
        setNote(`Version ${v} restored as version ${restored.version}`);
        setVersions(await scriptStore.versions(restored.id));
        bumpLibrary();
        await refreshEveryPane();
      } finally {
        setBusy(null);
      }
    },
    [current]
  );

  const openOther = useCallback(
    async (id: string) => {
      const s = await scriptStore.get(id);
      if (!s) {
        setNote('That script is gone');
        setRecent(recentScripts().filter(r => r.id !== id));
        return;
      }
      openEditor(s, paneId);
    },
    [paneId]
  );

  const bars = paneId ? getPaneBars(paneId) : undefined;
  const paneWord = status.pane === 'overlay' ? 'on the tape' : status.pane === 'own' ? 'own pane' : '';

  return (
    <div className="flex flex-col h-full min-h-0" data-script-panel>
      {/* THE HEAD — the mark, the name as a menu, what the script is, the doors */}
      <div className="flex items-center gap-3 h-11 px-3 border-b border-borderSubtle shrink-0">
        <span className="holo-bg w-6 h-6 rounded-[6px] shrink-0 flex items-center justify-center font-mono text-[10px] font-bold text-[#0a0a0a]" aria-hidden>
          &gt;_
        </span>
        {renaming ? (
          <input
            ref={titleRef}
            value={title}
            autoFocus
            onChange={e => {
              setTitle(e.target.value);
              setDirty(true);
            }}
            onBlur={() => setRenaming(false)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'Escape') setRenaming(false);
            }}
            spellCheck={false}
            aria-label="Script name"
            className="min-w-0 w-[280px] h-7 px-2 rounded-md border border-borderMuted bg-chip font-mono text-[13px] font-bold text-textPrimary outline-none"
            data-script-title
          />
        ) : (
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger asChild>
              <button className="inline-flex items-center gap-1.5 h-7 px-2 -ml-2 rounded-md font-mono text-[13px] font-bold text-textPrimary hover:bg-ink/[0.04] transition-colors max-w-[360px]" title="The script's menu" data-script-menu>
                <span className="truncate">{title}</span>
                <ChevronDown className="w-3 h-3 text-textMuted shrink-0" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="start" sideOffset={6} className={`${CARD} min-w-[280px] p-1.5`} data-script-menu-card>
                <DropdownMenu.Item className={MENU_ITEM} disabled={readOnly || !dirty} onSelect={() => void save()} data-menu="save">
                  <Save className="w-3.5 h-3.5 text-textMuted" /> Save
                  <span className={MENU_KEY}>Ctrl S</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item className={MENU_ITEM} onSelect={() => void copy()} data-menu="copy">
                  <Copy className="w-3.5 h-3.5 text-textMuted" /> Make a copy
                </DropdownMenu.Item>
                <DropdownMenu.Item className={MENU_ITEM} disabled={readOnly} onSelect={() => setRenaming(true)} data-menu="rename">
                  <Pencil className="w-3.5 h-3.5 text-textMuted" /> Rename
                </DropdownMenu.Item>
                <DropdownMenu.Item className={MENU_ITEM} onSelect={() => void showVersions()} data-menu="versions">
                  <History className="w-3.5 h-3.5 text-textMuted" /> Version history
                  {current && !current.readOnly && <span className={MENU_KEY}>v{current.version}</span>}
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1.5 h-px bg-borderSubtle" />
                <DropdownMenu.Item className={MENU_ITEM} onSelect={() => openEditor(null, paneId)} data-menu="new">
                  <FilePlus2 className="w-3.5 h-3.5 text-textMuted" /> Create new
                  <span className={MENU_KEY}>indicator</span>
                </DropdownMenu.Item>
                {recent.length > 0 && (
                  <>
                    <DropdownMenu.Separator className="my-1.5 h-px bg-borderSubtle" />
                    <DropdownMenu.Label className="px-2 pt-1 pb-1 font-mono text-[8px] uppercase tracking-widest text-textMuted">Recently used</DropdownMenu.Label>
                    {recent.map(r => (
                      <DropdownMenu.Item key={r.id} className={MENU_ITEM} disabled={r.id === current?.id} onSelect={() => void openOther(r.id)} data-menu-recent={r.id}>
                        <span className="truncate">{r.title}</span>
                      </DropdownMenu.Item>
                    ))}
                  </>
                )}
                <DropdownMenu.Separator className="my-1.5 h-px bg-borderSubtle" />
                <DropdownMenu.Item className={MENU_ITEM} onSelect={onOpenLibrary} data-menu="library">
                  <FolderOpen className="w-3.5 h-3.5 text-textMuted" /> Open from the library
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
        {readOnly && <span className="font-mono text-[8px] uppercase tracking-widest text-textMuted border border-borderSubtle rounded px-1.5 py-0.5 whitespace-nowrap">built-in · read-only</span>}
        {!readOnly && current && (
          <span className="font-mono text-[9px] text-textMuted whitespace-nowrap">
            v{current.version}
            {dirty ? ' · unsaved' : ''}
          </span>
        )}
        {!readOnly && !current && <span className="font-mono text-[9px] text-textMuted whitespace-nowrap">new · unsaved</span>}
        <span className="ml-auto flex items-center gap-2">
          {paneId &&
            (onPane ? (
              <button onClick={removeFromChart} disabled={!!busy} title="Take it off this pane" className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-silver/50 bg-silver/[0.08] font-mono text-[10px] uppercase tracking-wider text-silver transition-colors disabled:opacity-50" data-script-remove>
                On the chart · remove
              </button>
            ) : (
              <button onClick={addToChart} disabled={!!busy || !status.ok} title={status.ok ? 'Draw it on this pane — Ctrl Enter' : 'Fix the line first'} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-selectFill font-mono text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a] transition-opacity disabled:opacity-40" data-script-add>
                <Play className="w-3 h-3" />
                Add to chart
              </button>
            ))}
          <button onClick={onClose} aria-label="Close the editor" title="Close — the draft is kept" className="p-1 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors" data-script-close>
            <X className="w-4 h-4" />
          </button>
        </span>
      </div>

      {/* THE TEXT, and the versions beside it when asked for */}
      <div className="flex-1 min-h-0 flex">
        {/* the text is a dark island on either theme — the house CodeMirror theme is cut for it */}
        <div ref={hostRef} data-theme="dark" className="flex-1 min-w-0 min-h-0 bg-panel" data-script-editor />
        {versions && (
          <aside className="w-[260px] shrink-0 border-l border-borderSubtle flex flex-col" data-script-versions>
            <div className="flex items-center h-8 px-3 border-b border-borderSubtle">
              <span className="font-mono text-[8px] uppercase tracking-widest text-textMuted">Version history</span>
              <button onClick={() => setVersions(null)} aria-label="Close the versions" className="ml-auto p-1 rounded text-textMuted hover:text-textPrimary">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {versions.length === 0 && <div className="px-3 py-4 font-mono text-[10px] uppercase tracking-widest text-textMuted">No versions kept yet</div>}
              {versions.map(v => (
                <div key={v.version} className="flex items-center gap-2 px-3 h-9 border-b border-borderSubtle/40" data-script-version={v.version}>
                  <span className={`font-mono text-[11px] tnum ${v.version === current?.version ? 'text-textPrimary font-bold' : 'text-textSecondary'}`}>v{v.version}</span>
                  <span className="font-mono text-[9px] text-textMuted truncate">{v.message ?? ago(v.createdAt)}</span>
                  {v.version !== current?.version && (
                    <button onClick={() => void restore(v.version)} title={`Bring version ${v.version} back as a new version`} className="ml-auto inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-textMuted hover:text-textPrimary" data-script-restore={v.version}>
                      <RotateCcw className="w-3 h-3" /> Restore
                    </button>
                  )}
                  {v.version === current?.version && <span className="ml-auto font-mono text-[8px] uppercase tracking-widest text-textMuted">current</span>}
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* THE STATUS — what the script does right now */}
      <div className="flex items-center gap-4 px-3 h-[34px] border-t border-borderSubtle font-mono text-[10px] tnum shrink-0" data-script-status data-ok={status.ok || undefined}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${status.ok ? 'bg-bull' : 'bg-bear'}`} aria-hidden />
        {status.ok ? (
          <span className="text-bull truncate">{status.words}</span>
        ) : (
          <button onClick={jumpToLine} className="text-bear truncate text-left hover:underline underline-offset-2" title="Go to the line">
            {status.line ? `Line ${status.line} · ` : ''}
            {status.words}
          </button>
        )}
        <span className="text-textMuted whitespace-nowrap">
          inputs <span className="text-textSecondary">{status.inputs}</span> · alerts <span className="text-textSecondary">{status.alerts}</span>
          {paneWord ? ` · ${paneWord}` : ''}
        </span>
        {note && <span className="text-textSecondary truncate">· {note}</span>}
        {busy && <span className="text-textMuted">· {busy}…</span>}
        <span className="ml-auto text-textMuted whitespace-nowrap">
          {bars ? (
            <>
              <Name t={bars.ticker} size={10} /> · {bars.timeframe} ·{' '}
            </>
          ) : (
            ''
          )}
          Pine v6 · Line {cursor.line}, Col {cursor.col}
        </span>
      </div>
    </div>
  );
};

export default ScriptEditorPanel;
