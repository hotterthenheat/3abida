/*
==================================================
  SLAYER TERMINAL - THE COMMAND LINE (components/layout/CommandPalette.tsx)

  ⌘K on a Mac, Ctrl K everywhere else, from any page.
  It was a launcher — pages, a name, the drawing
  tools — and became a command line on 2026-10-09
  (the ideas' first pick, Bloomberg's grammar in the
  house's words):

    NVDA flow        a name and a function: that page,
                     on that name ("SPY walls", "AAPL
                     chain", "QQQ earnings")
    NF               a page's own code, printed beside it
    SPY alert 480    an action with its figure
    theme, keys …    the Actions: a new alert, save the
                     desk, the theme, the keys sheet, the
                     session strip, the rail, the sounds
    (nothing)        what you opened last, then the pages

  It is a COMBOBOX in a dialog (the audit's SH-1 and
  X13): the field owns the keys and names the row
  under the mark (aria-activedescendant), the rows
  are a listbox, the row under the mark is always in
  view, Tab stays inside, Esc closes it, and focus
  goes back where it was — or to the page, when a
  command took the reader somewhere new.
==================================================
*/

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightLeft, Bell, BellRing, CornerDownLeft, Eye, History, Keyboard, Moon, PanelLeft, Save, Settings as SettingsIcon, SlidersHorizontal, Sun, Volume2,
  Megaphone, Rows3,
} from 'lucide-react';
import Working from '../ui/Working';
import { useMarketData } from '../../context/MarketDataContext';
import Simulator from '../../core/simulator';
import { armDrawTool, canArmDrawTool, searchDrawTools } from '../gex/drawTools';
import ProductGlyph from '../../brand/ProductGlyph';
import { useOverlay } from '../ui/layers';
import { undoable } from '../ui/undo';
import { lookup } from '../../data/universe';
import { armPrice, removeAlert } from '../gex/alertStore';
import { openAlertsDrawer } from '../../data/alertsDrawer';
import { jingle } from '../../core/sound';
import { setDeskPrefs, useDeskPrefs } from '../../data/deskPrefs';
import { setColourVision, setThemeChoice, useColourVision, useResolvedTheme } from '../../theme/theme';
import { PAGE_COMMANDS, SETTINGS_COMMANDS, pageForCode, pageForWord, pathOn, type PageCommand } from './commands';
import { openKeySheet, toggleRail } from './paletteDoor';
import { PALETTE_KEY } from './keys';
import { setShellPrefs, useShellPrefs } from './shellPrefs';

type TickerModule = typeof import('../../data/tickers');

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

type Group = 'Go' | 'Recent' | 'Pages' | 'Settings' | 'Actions' | 'Names' | 'Draw';

interface Command {
  id: string;
  group: Group;
  label: string;
  hint: string;
  /** A page's code, printed at the row's end */
  code?: string;
  icon?: ReactNode;
  /** Do it. A string back keeps the command line open with that text in the field (an action that needs a figure). */
  run: () => void | string;
  /** Where it took the reader — recents keep it; a run that navigates hands focus to the page */
  navigates?: boolean;
  /** How it is kept among the recents (absent: never) */
  recent?: Recent;
}

/* ---- the recents: what was opened last, kept on this machine ------------------------------------------------ */
interface Recent {
  label: string;
  hint: string;
  path?: string;
  ticker?: string;
  action?: string;
  glyph?: PageCommand['glyph'];
  code?: string;
}
const RECENT_KEY = 'slayer_palette_recent';
const RECENT_MAX = 6;
const readRecents = (): Recent[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? (raw.filter(r => r && typeof r === 'object' && typeof (r as Recent).label === 'string') as Recent[]).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
};
const keepRecent = (r: Recent) => {
  try {
    const next = [r, ...readRecents().filter(x => x.label !== r.label)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode — no recents this visit */
  }
};

const ICON = 'w-3.5 h-3.5';
const glyphIcon = (g: PageCommand['glyph'], fallback?: ReactNode) => (g ? <ProductGlyph name={g} size={15} bare /> : fallback ?? <SettingsIcon className={ICON} />);
const norm = (s: string) => s.trim().toLowerCase();
const matches = (q: string, ...fields: (string | undefined)[]) => fields.some(f => f && f.toLowerCase().includes(q));

const CommandPalette = ({ open, onClose }: CommandPaletteProps) => {
  const navigate = useNavigate();
  const { changeTicker, activeTicker, marketData } = useMarketData();
  const theme = useResolvedTheme();
  const cvd = useColourVision();
  const desk = useDeskPrefs();
  const shell = useShellPrefs();
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [tickMod, setTickMod] = useState<TickerModule | null>(null);
  const [recents, setRecents] = useState<Recent[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  /* where focus goes as it closes: back to where it was (Esc), or to the page a command opened */
  const backRef = useRef<HTMLElement | null>(null);

  useOverlay({ open, ref: boxRef, onClose, initialFocus: inputRef, returnTo: backRef });

  // The full ticker universe (S&P 500 + NASDAQ listings) — lazy, its chunk is ~300KB (Noah, 2026-08-18: four names was
  // the whole reachable market).
  useEffect(() => {
    if (open && !tickMod) import('../../data/tickers').then(setTickMod);
  }, [open, tickMod]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHighlight(0);
    setRecents(readRecents());
    /* Esc hands focus back to where it was; a command that navigates sets the page instead */
    backRef.current = null;
  }, [open]);
  useEffect(() => setHighlight(0), [query]);

  /** A name the terminal knows: one it carries, one in the universe, or one in the listings once they are here */
  const knownName = (word: string): string | null => {
    const sym = word.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9.^-]{0,5}$/.test(sym)) return null;
    if (Simulator.TICKERS[sym] || lookup(sym)) return sym;
    if (tickMod && tickMod.searchTickers(sym, 1)[0]?.symbol === sym) return sym;
    return null;
  };

  /** Open a page, on a name when one is given — the name becomes the terminal's subject first */
  const goPage = (p: { path: string; pathFor?: (t: string) => string }, ticker?: string) => {
    if (ticker && ticker !== activeTicker) changeTicker(ticker);
    navigate(ticker && p.pathFor ? p.pathFor(ticker) : p.path);
  };

  const pageCmd = (p: PageCommand, group: Group = 'Pages'): Command => ({
    id: p.id,
    group,
    label: p.label,
    hint: p.hint,
    code: p.code,
    icon: glyphIcon(p.glyph),
    navigates: true,
    recent: { label: p.label, hint: p.hint, path: p.path, glyph: p.glyph, code: p.code },
    run: () => goPage(p),
  });

  const settingsCmds = useMemo<Command[]>(
    () =>
      SETTINGS_COMMANDS.map(s => ({
        id: s.id,
        group: 'Settings' as const,
        label: s.label,
        hint: s.hint,
        code: s.code,
        icon: <SettingsIcon className={ICON} />,
        navigates: true,
        recent: { label: s.label, hint: s.hint, path: s.path, code: s.code },
        run: () => navigate(s.path),
      })),
    [navigate]
  );

  /* THE ACTIONS (the audit's SH-5: no theme switch, no "open alerts", no Settings sections) */
  const actions = useMemo<Command[]>(() => {
    const a = (id: string, label: string, hint: string, icon: ReactNode, run: () => void | string, extra: Partial<Command> = {}): Command => ({ id: `act:${id}`, group: 'Actions', label, hint, icon, run, recent: { label, hint, action: `act:${id}` }, ...extra });
    return [
      a('alert', `New price alert on ${activeTicker}`, 'Type the level after it — "alert 480"', <BellRing className={ICON} />, () => `${activeTicker} alert `, { recent: undefined }),
      a('alerts', 'Open the alerts', 'Every alert set, and the log of what alerted', <Bell className={ICON} />, () => openAlertsDrawer()),
      a('save-desk', 'Save this desk as…', 'Pulse keeps the arrangement under a name of yours', <Save className={ICON} />, () => navigate('/pulse', { state: { saveDesk: true } }), { navigates: true }),
      a('theme', theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme', 'Ink on paper, or the terminal on black — kept for the whole site', theme === 'dark' ? <Sun className={ICON} /> : <Moon className={ICON} />, () => setThemeChoice(theme === 'dark' ? 'light' : 'dark')),
      a('keys', 'Show the keys for this page', 'The same list Settings › Keyboard keeps — or press ?', <Keyboard className={ICON} />, () => openKeySheet()),
      a('strip', shell.sessionStrip ? 'Hide the session strip' : 'Show the session strip', "Where New York's day stands, under the rail's clock", <Rows3 className={ICON} />, () => setShellPrefs({ sessionStrip: !shell.sessionStrip })),
      a('rail', 'Fold the rail, or open it', 'The sidebar to its icons, and back', <PanelLeft className={ICON} />, () => toggleRail()),
      a('chime', desk.alertsSound ? 'Mute the alert sound' : 'Sound alerts again', 'The two rising tones when an alert fires', <Volume2 className={ICON} />, () => setDeskPrefs({ alertsSound: !desk.alertsSound })),
      a('speak', shell.speak ? 'Stop saying alerts aloud' : 'Say alerts aloud', 'The browser’s own voice reads each alert as it fires', <Megaphone className={ICON} />, () => setShellPrefs({ speak: !shell.speak })),
      a('cvd', cvd === 'blue-orange' ? 'Direction in green and red' : 'Direction in blue and orange', 'For colour-blind eyes: blue up, orange down, with ▲ and ▼', <Eye className={ICON} />, () => setColourVision(cvd === 'blue-orange' ? 'standard' : 'blue-orange')),
      a('export', 'Export what is kept here', 'Settings › Data — a file of the board, the marks, the alerts, the desks', <SlidersHorizontal className={ICON} />, () => navigate('/settings/data'), { navigates: true }),
    ];
  }, [activeTicker, theme, shell.sessionStrip, shell.speak, desk.alertsSound, cvd, navigate]);

  /* THE NAMES — with a query, the search over every listing; resting, the names the terminal runs */
  const nameCmds = useMemo<Command[]>(() => {
    const q = query.trim();
    const make = (sym: string, name: string): Command => ({
      id: `name:${sym}`,
      group: 'Names',
      label: sym,
      hint: sym === activeTicker ? 'the subject now' : name === sym ? 'make it the subject' : name,
      icon: <ArrowRightLeft className={ICON} />,
      recent: { label: sym, hint: name === sym ? 'make it the subject' : name, ticker: sym },
      run: () => changeTicker(sym),
    });
    if (q && tickMod) return q.includes(' ') ? [] : tickMod.searchTickers(q, 8).map(t => make(t.symbol, t.name));
    if (q) return [];
    return Object.keys(Simulator.TICKERS).map(tk => make(tk, lookup(tk)?.name ?? tickMod?.tickerName(tk) ?? tk));
  }, [query, tickMod, changeTicker, activeTicker]);

  /* THE DRAWING TOOLS, BY NAME (2026-09-19): "fib ext", Enter, and the tool is in hand on the chart the pointer was last
     over — only with a query, and only on a page that has a chart to draw on */
  const drawCmds = useMemo<Command[]>(() => {
    const q = query.trim();
    if (!open || !q || !canArmDrawTool()) return [];
    return searchDrawTools(q)
      .slice(0, 6)
      .map(t => ({ id: `draw:${t.tool}`, group: 'Draw' as const, label: `Draw → ${t.label}`, hint: 'take the tool in hand', icon: <span className="text-[14px] inline-flex">{t.icon}</span>, run: () => {
        armDrawTool(t.tool);
      } }));
  }, [query, open]);

  /* THE COMMAND ITSELF — a name and a function, a code, or an alert with its level */
  const goCmds = useMemo<Command[]>(() => {
    const q = query.trim();
    if (!q) return [];
    const words = q.split(/\s+/);
    const out: Command[] = [];
    /* "SPY alert 480", "alert 480": a price alert at that level, on that name or the subject */
    const alertM = /^(?:([A-Za-z][A-Za-z0-9.^-]{0,5})\s+)?alert\s+(\d+(?:\.\d+)?)$/i.exec(q);
    if (alertM) {
      const sym = alertM[1] ? knownName(alertM[1]) : activeTicker;
      const level = Number(alertM[2]);
      if (sym && level > 0) {
        out.push({
          id: `go:alert:${sym}:${level}`,
          group: 'Go',
          label: `Alert when ${sym} reaches ${level}`,
          hint: 'Set now — the bell and the alerts keep it',
          icon: <BellRing className={ICON} />,
          run: () => {
            const spot = Simulator.TICKERS[sym]?.currentPrice ?? (sym === activeTicker ? marketData?.spot : undefined);
            if (spot == null) return;
            const set = armPrice(sym, level, spot);
            if (!set) return;
            jingle();
            undoable({ label: `Alert set · ${sym} reaches ${level}`, undo: () => removeAlert(sym, set.id) });
          },
        });
      }
      return out;
    }
    /* a name and a function, either way round: "NVDA flow", "flow NVDA", "SPY dark pool" */
    if (words.length >= 2) {
      const tries: [string, string][] = [
        [words[0], words.slice(1).join(' ')],
        [words[words.length - 1], words.slice(0, -1).join(' ')],
      ];
      for (const [nameWord, fnWord] of tries) {
        const sym = knownName(nameWord);
        const page = sym ? pageForWord(fnWord) : null;
        if (sym && page) {
          out.push({
            id: `go:${sym}:${page.path}`,
            group: 'Go',
            label: `${page.label} on ${sym}`,
            hint: `${sym} · ${page.hint}`,
            code: page.code,
            icon: glyphIcon(page.glyph),
            navigates: true,
            recent: { label: `${page.label} on ${sym}`, hint: page.hint, path: pathOn(page, sym), ticker: sym, glyph: page.glyph, code: page.code },
            run: () => goPage(page, sym),
          });
          break;
        }
      }
    }
    /* a code or a function word alone: that page, on the subject */
    if (words.length === 1 || out.length === 0) {
      const code = pageForCode(q);
      if (code && !out.some(c => c.id.endsWith(code.path))) {
        const isSettings = code.path.startsWith('/settings/');
        out.push({ ...(isSettings ? settingsCmds.find(s => s.id === (code as { id: string }).id)! : pageCmd(code as PageCommand)), group: 'Go' });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tickMod, activeTicker, settingsCmds]);

  const recentCmds = useMemo<Command[]>(
    () =>
      recents.map((r, i) => ({
        id: `recent:${i}:${r.label}`,
        group: 'Recent' as const,
        label: r.label,
        hint: r.hint,
        code: r.code,
        icon: r.action ? <History className={ICON} /> : r.glyph ? glyphIcon(r.glyph) : r.ticker && !r.path ? <ArrowRightLeft className={ICON} /> : <History className={ICON} />,
        navigates: !!r.path,
        recent: r,
        run: () => {
          if (r.action) return actions.find(a => a.id === r.action)?.run();
          if (r.ticker && r.ticker !== activeTicker) changeTicker(r.ticker);
          if (r.path) navigate(r.path);
        },
      })),
    [recents, actions, activeTicker, changeTicker, navigate]
  );

  const pages = useMemo(() => PAGE_COMMANDS.map(p => pageCmd(p)), // eslint-disable-next-line react-hooks/exhaustive-deps
  [activeTicker]);

  const filtered = useMemo<Command[]>(() => {
    const q = norm(query);
    if (!q) return [...recentCmds, ...pages, ...actions, ...nameCmds];
    const hit = (c: Command) => matches(q, c.label, c.hint, c.code) || (c.id.startsWith('page:') && PAGE_COMMANDS.find(p => p.id === c.id)?.words.some(w => w.includes(q)));
    const settingsHit = (c: Command) => matches(q, c.label, c.hint, c.code) || SETTINGS_COMMANDS.find(s => s.id === c.id)?.words.some(w => w.includes(q));
    const go = goCmds;
    const seen = new Set(go.map(c => c.id));
    return [...go, ...pages.filter(c => hit(c) && !seen.has(c.id)), ...settingsCmds.filter(c => settingsHit(c) && !seen.has(c.id)), ...actions.filter(c => matches(q, c.label, c.hint)), ...drawCmds, ...nameCmds];
  }, [query, recentCmds, pages, actions, nameCmds, goCmds, settingsCmds, drawCmds]);

  /* THE ROW UNDER THE MARK STAYS IN VIEW (the audit's SH-1: after 25 presses it was 920px below the window) */
  useEffect(() => {
    if (!open) return;
    const el = document.getElementById(`palette-opt-${highlight}`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open, filtered.length]);

  if (!open) return null;

  const runCommand = (c: Command | undefined) => {
    if (!c) return;
    const keep = c.run();
    if (typeof keep === 'string') {
      setQuery(keep);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    if (c.recent) keepRecent(c.recent);
    /* a command that went somewhere hands the keys to that page, never to the page's body */
    if (c.navigates) backRef.current = document.getElementById('content');
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const n = filtered.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => (n ? (h + 1) % n : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => (n ? (h - 1 + n) % n : 0));
    } else if (e.key === 'Home' && e.ctrlKey) {
      e.preventDefault();
      setHighlight(0);
    } else if (e.key === 'End' && e.ctrlKey) {
      e.preventDefault();
      setHighlight(Math.max(0, n - 1));
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      setHighlight(h => Math.min(n - 1, h + 8));
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      setHighlight(h => Math.max(0, h - 8));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runCommand(filtered[highlight]);
    }
  };

  const GROUP_WORD: Record<Group, string> = { Go: 'Go', Recent: 'Recent', Pages: 'Pages', Settings: 'Settings', Actions: 'Actions', Names: 'Names', Draw: 'Draw' };
  let lastGroup: Group | null = null;
  const active = filtered[highlight];

  return (
    <div className="fixed inset-0 z-[89] flex items-start justify-center pt-[14vh] max-md:pt-14 px-4" data-palette>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command line"
        tabIndex={-1}
        className="relative w-full max-w-xl border border-borderMuted bg-panel rounded-lg shadow-2xl shadow-black overflow-hidden animate-slide-in outline-none"
      >
        <div className="relative">
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-autocomplete="list"
            aria-activedescendant={active ? `palette-opt-${highlight}` : undefined}
            aria-label="A name, a page, or a name and a page"
            placeholder='A name, a page, or both — "NVDA flow", "SPY walls", "NF"'
            spellCheck={false}
            autoComplete="off"
            className="w-full bg-transparent pl-4 pr-10 py-3 text-sm text-textPrimary placeholder:text-textMuted focus:outline-none border-b border-borderSubtle"
            data-palette-input
          />
          {/* the names arrive as their own chunk on the first open; typed before they land, the search says it is on its way (ui/Working.tsx) */}
          <Working active={!tickMod && query.trim().length > 0} className="absolute right-3.5 top-1/2 -translate-y-1/2" />
        </div>
        <div ref={listRef} id="palette-list" role="listbox" aria-label="Results" className="max-h-[min(22rem,55vh)] overflow-y-auto py-1.5 scroll-py-1.5">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-[12px] text-textMuted" role="presentation">
              Nothing by that name. Try a name and a page — "AAPL chain" — or a page's code.
            </div>
          )}
          {filtered.map((c, i) => {
            const showGroup = c.group !== lastGroup;
            lastGroup = c.group;
            const on = i === highlight;
            return (
              <div key={`${c.id}:${i}`} role="presentation">
                {showGroup && (
                  <div className="px-4 pt-2 pb-1 text-[10px] text-textMuted select-none" role="presentation">
                    {GROUP_WORD[c.group]}
                  </div>
                )}
                <div
                  id={`palette-opt-${i}`}
                  role="option"
                  aria-selected={on}
                  onClick={() => runCommand(c)}
                  onMouseMove={() => !on && setHighlight(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left cursor-pointer transition-colors ${on ? 'bg-ink/[0.06]' : ''}`}
                  data-palette-row={c.id}
                >
                  <span className={`shrink-0 inline-flex ${on ? 'text-select' : 'text-textMuted'}`} aria-hidden>
                    {c.icon}
                  </span>
                  <span className="min-w-0 flex-1 flex items-baseline gap-2">
                    <span className="shrink-0 text-[13px] text-textPrimary">{c.label}</span>
                    <span className="min-w-0 truncate text-[11px] text-textMuted">{c.hint}</span>
                  </span>
                  {c.code && <kbd className="shrink-0 inline-flex items-center h-5 px-1.5 rounded border border-borderSubtle bg-chip font-mono text-[10px] text-textSecondary">{c.code}</kbd>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 px-4 py-2 border-t border-borderSubtle text-[11px] text-textMuted select-none">
          <span>↑↓ walk</span>
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3" /> open
          </span>
          <span className="max-sm:hidden">a name, then a page — "NVDA flow"</span>
          <span className="ml-auto">esc closes · {PALETTE_KEY}</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
