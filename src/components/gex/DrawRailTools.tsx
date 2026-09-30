/*
==================================================
  SLAYER TERMINAL - THE RAIL'S TOOLS
  (components/gex/DrawRailTools.tsx)

  The drawing rail's middle: ONE BUTTON A FAMILY, a
  family's list beside it, and the whole catalogue as
  a sheet (Noah, 2026-09-19, with TradingView's panels:
  "how can we add all of these into the toolbar without
  extending the toolbar super long"). The list of tools
  is drawTools.tsx; the rail's own box, its dock and
  its hide-and-show stay in StrikeChart.

    A FAMILY'S BUTTON  wears the last tool used from
      it. A click takes that tool in hand. THE ARROW
      beside it — TradingView's own (Noah, 2026-09-19:
      "the arrow should appear as such"): a chevron in
      its own narrow column right of the icon, there
      under the pointer and gone at rest, named for the
      family — opens the family's list. So does a long
      press, or a right click. (It was a 5px tick in
      the button's corner, which he did not read as an
      arrow.) On a touch screen there is no pointer to
      be under, so it shows always.
    THE LIST  flies out beside the rail: a row a tool,
      small heads between, a star at each row's end.
    THE SHEET  is every tool: a search box, a tab a
      family, a grid of named tiles. On a narrow pane
      it is a bottom sheet and IS the toolbar — the
      rail is off there (a 34px column over a 350px
      pane is a wall).
    THE STAR  at the rail's end holds the starred
      tools, whatever family they are from.

  The list and the sheet are PORTALLED into the chart's
  box: the rail scrolls when a pane is short, and a
  scrolling box clips whatever flies out of it. They
  wear `data-chart-rail` — black on any tape, like the
  rail they belong to (index.css).
==================================================
*/

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, Search, Star, X } from 'lucide-react';
import type { DrawingKind } from './drawingsPrimitive';
import { DRAW_FAMILIES, drawToolDef, familyFace, searchDrawTools, toggleDrawFavourite, useDrawToolPrefs, type DrawToolDef } from './drawTools';

type Dock = 'left' | 'top';
type OpenList = { id: string; anchor: DOMRect } | null;

const LONG_PRESS_MS = 420;

interface RailToolsProps {
  dock: Dock;
  /** Draw mode is on — only then is a tool "in hand" */
  drawing: boolean;
  drawTool: DrawingKind | 'select';
  onPick: (kind: DrawingKind) => void;
  /** The chart's box: what the list and the sheet are portalled into, and clamped inside */
  host: HTMLElement | null;
  sheetOpen: boolean;
  onSheet: (open: boolean) => void;
}

/* THE TWO COLUMNS: a 24px icon column, and a 10px arrow column beside it. Docked left, every button is the rail's whole width
   and keeps its icon in the icon column; docked top, only the buttons that HAVE an arrow pay for its column. */
const cell = (dock: Dock) => (dock === 'left' ? 'h-[26px] w-full pr-[10px]' : 'w-[24px] h-full');
const listCell = (dock: Dock) => (dock === 'left' ? 'h-[26px] w-full' : 'w-[34px] h-full');
const face = (on: boolean) => (on ? 'bg-select/15 text-select' : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.04]');
const Rule = ({ dock }: { dock: Dock }) => <div className={dock === 'left' ? 'mx-1 my-0.5 h-px bg-borderMuted' : 'my-1 mx-0.5 w-px bg-borderMuted'} aria-hidden />;

/** One of the rail's buttons that opens a list: the face takes the tool, the corner tick opens the rest */
const ListButton = ({ dock, on, title, listTitle, icon, onFace, onList, open, testId }: { dock: Dock; on: boolean; title: string; listTitle: string; icon: ReactNode; onFace: (anchor: DOMRect | null) => void; onList: (anchor: DOMRect) => void; open: boolean; testId: string }) => {
  const wrap = useRef<HTMLDivElement | null>(null);
  const held = useRef<number | null>(null);
  const swallow = useRef(false);
  const openList = () => {
    const r = wrap.current?.getBoundingClientRect();
    if (r) onList(r);
  };
  const clearHold = () => {
    if (held.current !== null) window.clearTimeout(held.current);
    held.current = null;
  };
  useEffect(() => clearHold, []);
  return (
    <div ref={wrap} className={`group/fam relative shrink-0 flex items-stretch ${listCell(dock)}`} data-draw-family={testId}>
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-pressed={on}
        onPointerDown={() => {
          swallow.current = false;
          clearHold();
          held.current = window.setTimeout(() => {
            swallow.current = true;
            openList();
          }, LONG_PRESS_MS);
        }}
        onPointerUp={clearHold}
        onPointerLeave={clearHold}
        onContextMenu={e => {
          e.preventDefault();
          clearHold();
          openList();
        }}
        onClick={() => {
          /* the long press already answered this gesture */
          if (swallow.current) return;
          onFace(wrap.current?.getBoundingClientRect() ?? null);
        }}
        className={`w-[24px] shrink-0 inline-flex items-center justify-center rounded transition-colors text-[14px] ${face(on || open)}`}
      >
        {icon}
      </button>
      <button
        type="button"
        title={listTitle}
        aria-label={listTitle}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={openList}
        className={`w-[10px] shrink-0 inline-flex items-center justify-center rounded-r text-textSecondary hover:text-textPrimary hover:bg-ink/[0.1] transition-opacity focus-visible:opacity-100 group-hover/fam:opacity-100 [@media(hover:none)]:opacity-100 ${open ? 'opacity-100 text-textPrimary bg-ink/[0.1]' : 'opacity-0'}`}
        data-draw-family-more
      >
        {dock === 'left' ? <ChevronRight className="w-2.5 h-2.5 -mx-px" strokeWidth={2.6} /> : <ChevronDown className="w-2.5 h-2.5 -mx-px" strokeWidth={2.6} />}
      </button>
    </div>
  );
};

/** The star a tool is kept with */
const StarToggle = ({ kind, on, className = '' }: { kind: DrawingKind; on: boolean; className?: string }) => (
  <span
    role="button"
    tabIndex={0}
    aria-pressed={on}
    aria-label={on ? 'Take out of your favourites' : 'Keep in your favourites'}
    title={on ? 'Take out of your favourites' : 'Keep in your favourites'}
    onClick={e => {
      e.stopPropagation();
      toggleDrawFavourite(kind);
    }}
    onKeyDown={e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      e.stopPropagation();
      toggleDrawFavourite(kind);
    }}
    className={`inline-flex items-center justify-center rounded transition-colors ${on ? 'text-silver' : 'text-textMuted/60 hover:text-textPrimary'} ${className}`}
    data-draw-star={kind}
  >
    <Star className="w-3 h-3" fill={on ? 'currentColor' : 'none'} />
  </span>
);

/** A family's list, beside the rail */
const ToolList = ({ title, tools, anchor, dock, host, drawTool, favs, onPick, onClose, empty }: { title: string; tools: DrawToolDef[]; anchor: DOMRect; dock: Dock; host: HTMLElement; drawTool: DrawingKind | 'select'; favs: DrawingKind[]; onPick: (k: DrawingKind) => void; onClose: () => void; empty?: string }) => {
  const box = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; maxH: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const h = host.getBoundingClientRect();
    const maxH = Math.max(120, h.height - 12);
    const bw = el.offsetWidth;
    const bh = Math.min(el.scrollHeight, maxH);
    const left = dock === 'left' ? anchor.right - h.left + 8 : anchor.left - h.left - 8;
    const top = dock === 'left' ? anchor.top - h.top - 8 : anchor.bottom - h.top + 8;
    setPos({ left: Math.max(6, Math.min(left, h.width - bw - 6)), top: Math.max(6, Math.min(top, h.height - bh - 6)), maxH });
  }, [anchor, dock, host, tools.length]);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && box.current?.contains(t)) return;
      if (t instanceof Element && t.closest('[data-draw-family]')) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key, true);
    };
  }, [onClose]);
  let lastSub: string | null = null;
  return createPortal(
    <div
      ref={box}
      role="menu"
      aria-label={title}
      data-chart-rail
      data-draw-list
      className="absolute z-50 w-[232px] overflow-y-auto rounded-md border border-borderMuted bg-panel/95 backdrop-blur-md p-1 shadow-2xl shadow-black/60 select-none"
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, maxHeight: pos?.maxH, visibility: pos ? 'visible' : 'hidden' }}
    >
      <div className="px-2 pt-1.5 pb-1 font-mono text-[9px] uppercase tracking-widest text-textMuted">{title}</div>
      {tools.length === 0 && empty && <div className="px-2 py-3 text-[11px] leading-snug text-textSecondary">{empty}</div>}
      {tools.map(t => {
        const head = t.sub !== lastSub && tools.some(o => o.sub !== tools[0].sub);
        lastSub = t.sub;
        const on = drawTool === t.tool;
        return (
          <div key={t.tool}>
            {head && <div className="px-2 pt-2 pb-0.5 text-[10px] text-textMuted">{t.sub}</div>}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onPick(t.tool);
                onClose();
              }}
              className={`w-full flex items-center gap-2.5 h-7 pl-2 pr-1 rounded text-left text-[12px] transition-colors ${on ? 'bg-select/15 text-select' : 'text-textPrimary hover:bg-ink/[0.06]'}`}
              data-draw-tool={t.tool}
            >
              <span className={`text-[15px] inline-flex ${on ? '' : 'text-textSecondary'}`}>{t.icon}</span>
              <span className="min-w-0 flex-1 truncate">{t.label}</span>
              <StarToggle kind={t.tool} on={favs.includes(t.tool)} className="w-6 h-6" />
            </button>
          </div>
        );
      })}
    </div>,
    host
  );
};

interface SheetProps {
  host: HTMLElement;
  dock: Dock;
  drawTool: DrawingKind | 'select';
  onPick: (kind: DrawingKind) => void;
  onClose: () => void;
}

/** Every tool: search, a tab a family, a grid of named tiles. A bottom sheet where the pane is narrow. */
export const DrawSheet = ({ host, dock, drawTool, onPick, onClose }: SheetProps) => {
  const prefs = useDrawToolPrefs();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<string>(prefs.favs.length ? 'favs' : DRAW_FAMILIES[0].id);
  const box = useRef<HTMLDivElement | null>(null);
  const [narrow, setNarrow] = useState(() => host.clientWidth < 560);
  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => setNarrow(host.clientWidth < 560));
    ro.observe(host);
    return () => ro.disconnect();
  }, [host]);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && box.current?.contains(t)) return;
      if (t instanceof Element && t.closest('[data-draw-sheet-door]')) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key, true);
    };
  }, [onClose]);

  const searching = query.trim().length > 0;
  const shown = useMemo<DrawToolDef[]>(() => {
    if (searching) return searchDrawTools(query);
    if (tab === 'favs') return prefs.favs.map(k => drawToolDef(k)).filter((t): t is DrawToolDef => !!t);
    return DRAW_FAMILIES.find(f => f.id === tab)?.tools ?? [];
  }, [searching, query, tab, prefs.favs]);
  const tabs = [{ id: 'favs', name: 'Favourites', full: 'Your favourites' }, ...DRAW_FAMILIES.map(f => ({ id: f.id as string, name: f.short, full: f.name }))];

  return createPortal(
    <div
      ref={box}
      role="dialog"
      aria-label="Drawings"
      data-chart-rail
      data-draw-sheet={narrow ? 'bottom' : 'side'}
      className={`absolute z-50 flex flex-col border border-borderMuted bg-panel/95 backdrop-blur-md shadow-2xl shadow-black/60 select-none ${
        narrow ? 'inset-x-0 bottom-0 max-h-[86%] rounded-t-xl border-b-0 animate-fade-in' : `w-[392px] max-h-[calc(100%-16px)] rounded-lg animate-fade-in ${dock === 'left' ? 'left-[56px] top-2' : 'left-1/2 -translate-x-1/2 top-[46px]'}`
      }`}
    >
      <div className="shrink-0 flex items-center gap-2 px-3 pt-2.5 pb-2">
        <span className="text-[13px] font-semibold text-textPrimary">Drawings</span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">{searching ? `${shown.length} found` : `${DRAW_FAMILIES.reduce((n, f) => n + f.tools.length, 0)} tools`}</span>
        <button type="button" onClick={onClose} title="Close" aria-label="Close" className="ml-auto inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06]">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <label className="shrink-0 mx-3 flex items-center gap-2 h-8 px-2.5 rounded-md border border-borderSubtle bg-chip focus-within:border-silver/50">
        <Search className="w-3.5 h-3.5 text-textMuted shrink-0" />
        <input
          autoFocus={!narrow}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            /* the desk's own keys must not fire while a name is typed */
            e.stopPropagation();
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && shown[0]) {
              onPick(shown[0].tool);
              onClose();
            }
          }}
          placeholder="Trendline, fib, long position"
          aria-label="Search the drawing tools"
          className="min-w-0 flex-1 bg-transparent text-[12px] text-textPrimary placeholder:text-textMuted outline-none"
          data-draw-search
        />
      </label>
      {!searching && (
        <div className="shrink-0 flex items-center gap-1 px-3 pt-2 overflow-x-auto [scrollbar-width:none]" role="tablist">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              title={t.full}
              onClick={() => setTab(t.id)}
              className={`shrink-0 h-6 px-2.5 rounded-full text-[11px] whitespace-nowrap transition-colors ${tab === t.id ? 'bg-ink/[0.1] text-textPrimary font-semibold' : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.05]'}`}
              data-draw-tab={t.id}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {shown.length === 0 ? (
          <div className="py-8 text-center text-[11px] leading-snug text-textSecondary">{searching ? 'No tool by that name.' : 'Star a tool and it is kept here, and on the rail.'}</div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {shown.map(t => {
              const on = drawTool === t.tool;
              return (
                <button
                  key={t.tool}
                  type="button"
                  onClick={() => {
                    onPick(t.tool);
                    onClose();
                  }}
                  className={`relative flex flex-col items-center justify-center gap-1.5 h-[64px] px-1 rounded-md border transition-colors ${on ? 'border-select/50 bg-select/10 text-select' : 'border-transparent bg-ink/[0.04] text-textPrimary hover:bg-ink/[0.08]'}`}
                  data-draw-tile={t.tool}
                >
                  <span className={`text-[18px] inline-flex ${on ? '' : 'text-textSecondary'}`}>{t.icon}</span>
                  <span className="text-[10.5px] leading-[1.15] text-center line-clamp-2">{t.label}</span>
                  <StarToggle kind={t.tool} on={prefs.favs.includes(t.tool)} className="absolute right-0.5 top-0.5 w-5 h-5" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>,
    host
  );
};

/** The rail's middle: a button a family, the search, the star */
const DrawRailTools = ({ dock, drawing, drawTool, onPick, host, sheetOpen, onSheet }: RailToolsProps) => {
  const prefs = useDrawToolPrefs();
  const [list, setList] = useState<OpenList>(null);
  const close = useRef(() => setList(null)).current;
  /* a tool taken, or the sheet opened, puts the list away */
  useEffect(() => {
    if (sheetOpen) setList(null);
  }, [sheetOpen]);
  const favTools = prefs.favs.map(k => drawToolDef(k)).filter((t): t is DrawToolDef => !!t);
  const openFamily = DRAW_FAMILIES.find(f => f.id === list?.id);

  return (
    <>
      <Rule dock={dock} />
      {DRAW_FAMILIES.map(f => {
        const worn = familyFace(f, prefs);
        const inHand = drawing && f.tools.some(t => t.tool === drawTool);
        /* a tool from this family in hand: the button wears THAT one, not the remembered one */
        const shownTool = inHand ? f.tools.find(t => t.tool === drawTool) ?? worn : worn;
        return (
          <ListButton
            key={f.id}
            testId={f.id}
            dock={dock}
            on={inHand}
            open={list?.id === f.id}
            title={shownTool.label}
            listTitle={f.name}
            icon={shownTool.icon}
            onFace={() => {
              setList(null);
              onPick(shownTool.tool);
            }}
            onList={anchor => setList(cur => (cur?.id === f.id ? null : { id: f.id, anchor }))}
          />
        );
      })}
      <Rule dock={dock} />
      <button
        type="button"
        onClick={() => onSheet(!sheetOpen)}
        title="Every drawing tool"
        aria-label="Every drawing tool"
        aria-expanded={sheetOpen}
        className={`shrink-0 inline-flex items-center justify-center rounded transition-colors ${cell(dock)} ${face(sheetOpen)}`}
        data-draw-sheet-door
      >
        <Search className="w-3.5 h-3.5" />
      </button>
      <ListButton
        testId="favs"
        dock={dock}
        on={false}
        open={list?.id === 'favs'}
        title="Your favourites"
        listTitle="Your favourites"
        icon={<Star className="w-3.5 h-3.5" fill={favTools.length ? 'currentColor' : 'none'} />}
        onFace={anchor => {
          if (anchor) setList(cur => (cur?.id === 'favs' ? null : { id: 'favs', anchor }));
        }}
        onList={anchor => setList(cur => (cur?.id === 'favs' ? null : { id: 'favs', anchor }))}
      />
      {list && host && (openFamily || list.id === 'favs') && (
        <ToolList
          title={openFamily ? openFamily.name : 'Your favourites'}
          tools={openFamily ? openFamily.tools : favTools}
          empty="Star a tool in any list and it is kept here."
          anchor={list.anchor}
          dock={dock}
          host={host}
          drawTool={drawing ? drawTool : 'select'}
          favs={prefs.favs}
          onPick={onPick}
          onClose={close}
        />
      )}
    </>
  );
};

export default DrawRailTools;
