import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import RGL, { type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { ArrowUpRight, Check, GripHorizontal, Maximize2, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { changeTicker, useActiveTicker, useScanSnapshot } from '../../context/MarketDataContext';
import { isLinkGroup, marketStore, setLinkGroup, useLinkGroups, useMarketBackground, type LinkGroup } from '../../context/marketStore';
import LinkGroupChip from '../../components/link/LinkGroupChip';
import { useFocus } from '../../context/FocusContext';
import Simulator from '../../core/simulator';
import { buildGexView } from '../../data/gex';
import { buildExposureProfile } from '../../data/exposure';
import { buildPulseView } from '../../data/pulse';
import { buildVannaCharm } from '../../data/vannacharm';
import { buildCompassView } from '../../data/compass';
import Chip from '../../components/ui/Chip';
import { useIsPhone } from '../../components/ui/useMediaQuery';
import LiveChartWidget from './LiveChartWidget';
import HoverReadout from '../../components/ui/HoverReadout';
import ShellHead from '../../components/layout/ShellHead';
import ProductGlyph from '../../brand/ProductGlyph';
import { undoable } from '../../components/ui/undo';
import Panel from '../../components/ui/Panel';
import { WIDGETS, widgetByKey, type WidgetDef, type WorkspaceCtx } from './registry';
import WidgetThumb from './WidgetThumb';
import LiveScopeChip from '../../components/link/LiveScopeChip';
import { Deferred } from '../../components/ui/Skeleton';
import { afterGlide, beginGlide, glideTarget, onGlide } from '../../core/glide';
import {
  firstFit,
  isPreset,
  loadDesks,
  PRESET_BLURBS,
  PRESET_NAMES,
  presetNamed,
  presetTemplate,
  saveDesks,
  type DeskStore,
  type SavedWorkspace,
  type WidgetInstance,
} from './desks';
import type { MarketSnapshot } from '../../types/market';

/* THE DESK'S WIDTH, MEASURED BEFORE THE FIRST PAINT (Noah, 2026-09-12:
   "everytime i re-enter the page and the cards start sliding into their
   designated areas the internals of the cards look delayed and laggy"). The
   library's WidthProvider rendered the first frame at an assumed 1280px, learnt
   the real width a frame later, and its 200ms transform transition carried
   every tile from the wrong layout to the right one — the charts inside
   re-laying themselves on each frame of the ride. Its `measureBeforeMount`
   is broken in 1.5.2 (the observer watches the placeholder it replaces, then
   reports 0 — the desk collapsed). So the desk measures its own host in a
   layout effect — synchronously, before paint — and the tiles are born where
   they belong; the observer keeps the width honest through the sidebar's
   glide. The transition stays for drags and resizes, where it belongs. */
/* The grid's own arithmetic for a tile's width (react-grid-layout
   calcGridItemWHPx): 12 columns, a 12px gutter, no container padding */
const GRID_COLS = 12;
const GRID_GUTTER = 12;
const tileWidth = (hostWidth: number, w: number): number => {
  const colWidth = (hostWidth - GRID_GUTTER * (GRID_COLS - 1)) / GRID_COLS;
  return Math.round(colWidth * w + Math.max(0, w - 1) * GRID_GUTTER);
};

const useHostWidth = () => {
  const [width, setWidth] = useState<number | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  /* A CALLBACK REF, not an effect: the host is rendered only once the feed is
     up, so it attaches after the page's first commit — the measure runs the
     moment it does (still in the commit, so the re-render lands before paint),
     and again for the new host a desk switch mounts. */
  const ref = useCallback((el: HTMLDivElement | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!el) return;
    let held = false;
    let settle = 0;
    const read = () => setWidth(el.getBoundingClientRect().width);
    read();
    const ro = new ResizeObserver(() => {
      if (!held) read();
    });
    ro.observe(el);
    /* THE SIDEBAR'S GLIDE (core/glide.ts; Noah, 2026-09-12: "the sidebar slide
       in and out disrupting the layout of the pulse cards"): the desk HOLDS its
       width for the 300ms — the tiles re-laid on every frame of it before,
       fifteen layouts a glide — and takes the new width ONCE when the frame
       settles: synchronously, with the tiles' own 200ms transition off for
       that one layout (data-settle, index.css), and BEFORE the charts take
       their one resize, so they measure the final tile and not the old one.
       Only the frame glide holds — a snap (a drop, a resize) never moves the
       host. main clips the overlap meanwhile (index.css [data-glide]). */
    const off = onGlide(
      () => {
        if (document.documentElement.getAttribute('data-glide') !== 'frame') return;
        held = true;
        const to = glideTarget();
        if (to) {
          /* THE FRAME SAID WHERE IT IS GOING: lay the tiles out for that width
             NOW — synchronously, in the same frame the sidebar starts — and
             the tiles transition there on the sidebar's own clock and curve
             (index.css [data-glide='frame']): the column and the cards move as
             one, and the surfaces inside size for the destination off the
             tiles' promise (data-tile-width). When the frame settles the
             width read once more is the same width — nothing happens. */
          const main = document.querySelector('main');
          const gutters = main ? main.getBoundingClientRect().width - el.getBoundingClientRect().width : 0;
          flushSync(() => setWidth(Math.max(0, Math.round(to.mainWidth - gutters))));
          afterGlide(() => {
            held = false;
            read();
          });
          return;
        }
        /* no destination given: hold, and take ONE layout when it settles */
        afterGlide(() => {
          held = false;
          el.setAttribute('data-settle', '');
          flushSync(read);
          settle = requestAnimationFrame(() => el.removeAttribute('data-settle'));
        });
      },
      () => undefined
    );
    cleanup.current = () => {
      ro.disconnect();
      off();
      cancelAnimationFrame(settle);
    };
  }, []);
  return [ref, width] as const;
};

const SCAN_INTERVAL_MS = 10_000;

/**
 * The hover peek on a desk chip (Noah, 2026-08-19: "a hover effect that
 * shows users what's inside each section"): a schematic of the arrangement
 * — every panel drawn at its grid position — and the panel names, plus the
 * preset's one-line purpose. Drawn from the saved layout itself, so it can
 * never disagree with what a click will open.
 */
const DeskPeek = ({ name, ws }: { name: string; ws: SavedWorkspace }) => {
  const titles = ws.instances.map(i => widgetByKey(i.key)?.title ?? i.key);
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] font-semibold text-textPrimary">{name}</span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-textMuted tnum">
          {ws.instances.length} panel{ws.instances.length === 1 ? '' : 's'}
        </span>
      </div>
      {PRESET_BLURBS[name] && <p className="mt-1 text-[11px] leading-snug text-textSecondary">{PRESET_BLURBS[name]}</p>}
      {/* words only — the block schematic read as noise (Noah, 2026-08-19) */}
      <ul className="mt-2 flex flex-col gap-0.5">
        {titles.map((t, i) => (
          <li key={`${t}-${i}`} className="font-mono text-[11px] text-textSecondary">
            <span className="text-textMuted">· </span>
            {t}
          </li>
        ))}
      </ul>
    </>
  );
};

/* ---- THE TILE READS THE TICK, NOT THE DESK (2026-10-10, the speed store) ------------------------------------------

   The desk used to render on every tick and on a one-second heat timer, and every render built every panel's context
   again — so every panel on the desk rendered two and a half times a second, whatever it showed, and the contexts'
   spread read the lazy views (the pulse view, the vanna read, the whole Compass board) that were meant to be built
   only for a panel that asks. Now the desk renders on the 10 s scan and on what a person does; each tile reads the
   tick itself, and only if its panel ever reads the tick's two live fields (`revision`, `liveSpot`) — a panel of the
   scan alone (the targets, the walls, the news) renders on the scan alone. */

/** A copy of a context that keeps its lazy views lazy — a spread would build them all */
const extendCtx = (base: WorkspaceCtx, extra: Partial<WorkspaceCtx>): WorkspaceCtx => {
  const out = Object.defineProperties({}, Object.getOwnPropertyDescriptors(base)) as WorkspaceCtx;
  for (const [k, v] of Object.entries(extra)) Object.defineProperty(out, k, { value: v, enumerable: true, configurable: true, writable: true });
  return out;
};

/** The live fields, read off the published tick — the getter marks the tile as one that reads them */
const withLive = (ctx: WorkspaceCtx, mark: () => void): WorkspaceCtx => {
  const s = marketStore.get();
  Object.defineProperty(ctx, 'revision', {
    get: () => (mark(), s.seq),
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(ctx, 'liveSpot', {
    get: () => (mark(), s.quotes[ctx.ticker]?.spot ?? (s.snapshot?.ticker === ctx.ticker ? s.snapshot.spot : ctx.snapshot.spot)),
    enumerable: true,
    configurable: true,
  });
  return ctx;
};

interface TileBodyProps {
  base: WorkspaceCtx;
  render: (ctx: WorkspaceCtx) => ReactNode;
  extra: Partial<WorkspaceCtx>;
}

/** One panel's body: its context built once per scan, per tick only when the panel reads the tick */
const TileBody = memo(({ base, render, extra }: TileBodyProps) => {
  const live = useRef(false);
  const seq = useMarketBackground(s => (live.current ? s.seq : 0));
  /* the functions are called through to the latest render's — the context is rebuilt only when a value moves */
  const latest = useRef(extra);
  latest.current = extra;
  const extraKey = Object.values(extra).map(v => (typeof v === 'function' ? 'fn' : String(v))).join('|');
  const ctx = useMemo(
    () => {
      const through = Object.fromEntries(
        Object.entries(extra).map(([k, v]) => [k, typeof v === 'function' ? (...a: unknown[]) => (latest.current[k as keyof WorkspaceCtx] as (...a: unknown[]) => unknown)?.(...a) : v])
      ) as Partial<WorkspaceCtx>;
      return withLive(extendCtx(base, through), () => {
        live.current = true;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, seq, extraKey]
  );
  return <>{useMemo(() => render(ctx), [render, ctx])}</>;
});

/** The phone's one chart */
const phoneChart = (ctx: WorkspaceCtx) => <LiveChartWidget ctx={ctx} soleChart />;

/** The product's glyph at the phone head's size */
const ProductGlyphSmall = () => <ProductGlyph name="pulse" size={16} bare className="shrink-0" />;

/* PULSE (2026-08-17): the widget desk IS the Pulse page — Noah: "i want the
   pulse page to basically be the workspace page... i love how our current
   workspace moves so lets just make pulse that." Named desks + the link
   (Mo, 2026-08-19) layered on without touching how it moves. */
const Pulse = () => {
  const activeTicker = useActiveTicker();
  /* THE LINK GROUPS (the ideas report's item 10): a panel follows the terminal, holds its own name, or joins a group
     A–D — and reads that group's name wherever its other members stand (Terrain's panes, the Weigher's chain) */
  const groups = useLinkGroups();
  const groupOf = (inst: WidgetInstance): LinkGroup | null => (isLinkGroup(inst.group) ? inst.group : null);
  /** The name a panel reads */
  const nameOf = (inst: WidgetInstance): string => {
    const g = groupOf(inst);
    return g ? (groups[g] ?? activeTicker) : (inst.ticker ?? activeTicker);
  };
  const isPhone = useIsPhone();
  const location = useLocation();
  const navigate = useNavigate();

  /* A strike sent here to be SEEN (Ranked Targets, Exposure Profile — Mo,
     2026-08-19: "clicking a strike should take me directly to that strike on
     the chart"). Held until cleared by hand or until the desk changes name;
     the live chart draws it as the FOCUS line. Before this the route state
     arrived and nothing read it — the click was a dead link. */
  /* THE SHARED STRIKE (2026-09-05): the focus lives in FocusContext now — a
     strike picked on Pinpoint is already the focus when this desk opens, and
     one picked here lights every Pinpoint tab. Same shape, same token. */
  const { focus, focusOn: focusShared, clearFocus } = useFocus();

  // ---- desks: named layouts, every one autosaving its own working state ----
  const [store, setStore] = useState<DeskStore>(loadDesks);
  const active = store.active;
  const [instances, setInstances] = useState<WidgetInstance[]>(() => store.desks[store.active].instances);
  const [layout, setLayout] = useState<Layout[]>(() => store.desks[store.active].layout);
  const [savingAs, setSavingAs] = useState(false);
  const [newName, setNewName] = useState('');
  const saveInputRef = useRef<HTMLInputElement | null>(null);

  // Working state flows into the active desk's slot…
  useEffect(() => {
    setStore(prev => ({ ...prev, desks: { ...prev.desks, [prev.active]: { instances, layout } } }));
  }, [instances, layout]);
  // …and the whole store persists on every change.
  useEffect(() => {
    saveDesks(store);
  }, [store]);

  const loadWorkspace = (ws: SavedWorkspace) => {
    setInstances(ws.instances);
    setLayout(ws.layout);
  };

  /* Two-phase switch (Noah, 2026-08-19: "right now its a rapid change"): the
     current desk fades OUT on an opacity transition, then the next one mounts
     under a fresh key and breathes in on the slow soft-in. Timer-driven, never
     animation-completion — the takeover rule. */
  const [switching, setSwitching] = useState(false);
  /* the desk's host, measured the moment it attaches — a desk switch remounts it */
  const [deskRef, deskWidth] = useHostWidth();
  const switchTimer = useRef(0);
  const switchDesk = (name: string) => {
    if (name === active || switching) return;
    const ws = store.desks[name];
    if (!ws) return;
    setSwitching(true);
    window.clearTimeout(switchTimer.current);
    switchTimer.current = window.setTimeout(() => {
      setStore(prev => ({ ...prev, active: name }));
      loadWorkspace(ws);
      setSwitching(false);
    }, 220);
  };
  useEffect(() => () => window.clearTimeout(switchTimer.current), []);

  /* PRESET NAMES ARE RESERVED IN ANY CASE, AND A NAME YOU ALREADY USE IS REPLACED WITH A WAY BACK (the audit's PU-4: "flow"
     saved beside the preset Flow, and saving under one of your own names overwrote it in silence) */
  const nameTaken = (raw: string): string | null => {
    const n = raw.trim().toLowerCase();
    return Object.keys(store.desks).find(k => !isPreset(k) && k.toLowerCase() === n) ?? null;
  };
  const saveAs = () => {
    const name = newName.trim();
    if (!name || presetNamed(name)) return;
    const same = nameTaken(name);
    const before = same ? store.desks[same] : null;
    const key = same ?? name;
    setStore(prev => ({ active: key, desks: { ...prev.desks, [key]: { instances, layout } } }));
    setSavingAs(false);
    setNewName('');
    if (before && same) {
      undoable({ label: `Replaced the ${same} desk`, undo: () => setStore(prev => ({ ...prev, desks: { ...prev.desks, [same]: before } })) });
    }
  };

  /* DELETE, REMOVE AND RESET ACT AT ONCE, WITH UNDO (the audit's X5.7) */
  const deleteDesk = (name: string) => {
    if (isPreset(name)) return;
    const gone = store.desks[name];
    const wasActive = active === name;
    const fallback = PRESET_NAMES[0];
    setStore(prev => {
      const desks = { ...prev.desks };
      delete desks[name];
      return { active: prev.active === name ? fallback : prev.active, desks };
    });
    if (wasActive) loadWorkspace(store.desks[fallback]);
    undoable({
      label: `Deleted the ${name} desk`,
      undo: () => {
        setStore(prev => ({ active: wasActive ? name : prev.active, desks: { ...prev.desks, [name]: gone } }));
        if (wasActive) loadWorkspace(gone);
      },
    });
  };

  /** Presets reset to their curated template; a custom desk has nothing to reset to. */
  const reset = () => {
    const tpl = presetTemplate(active);
    if (!tpl) return;
    const before = { instances, layout };
    const name = active;
    loadWorkspace(tpl);
    undoable({
      label: `Reset ${name} to its preset`,
      undo: () => {
        if (store.active === name || active === name) loadWorkspace(before);
      },
    });
  };

  /* THE COMMAND LINE'S "Save this desk as…" lands here with the name field open */
  useEffect(() => {
    if ((location.state as { saveDesk?: boolean } | null)?.saveDesk) {
      setSavingAs(true);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  useEffect(() => {
    if (savingAs) requestAnimationFrame(() => saveInputRef.current?.focus());
  }, [savingAs]);

  const customNames = useMemo(() => Object.keys(store.desks).filter(n => !isPreset(n)), [store.desks]);

  // The hover peek — which chip, and where the pointer is
  const [peek, setPeek] = useState<{ name: string; x: number; y: number } | null>(null);
  const peekHandlers = (name: string) => ({
    onMouseEnter: (e: React.MouseEvent) => setPeek({ name, x: e.clientX, y: e.clientY }),
    onMouseMove: (e: React.MouseEvent) => setPeek({ name, x: e.clientX, y: e.clientY }),
    onMouseLeave: () => setPeek(null),
    /* …and on focus (the audit's X6.5): the keys see what a desk holds before opening it */
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setPeek({ name, x: r.left + 8, y: r.bottom + 4 });
    },
    onBlur: () => setPeek(null),
  });

  // ---- add menu -------------------------------------------------------------
  const [addOpen, setAddOpen] = useState(false);
  /** Which widget the add-menu is previewing — only this one gets mounted. */
  const [previewKey, setPreviewKey] = useState<string>(WIDGETS[0].key);
  const previewDef = widgetByKey(previewKey) ?? WIDGETS[0];
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  /* THE MENU TAKES THE KEYS (the audit's PU-18): the first row is focused as it opens, ↑/↓ walk the rows */
  useEffect(() => {
    if (!addOpen) return;
    requestAnimationFrame(() => addMenuRef.current?.querySelector<HTMLElement>('[data-add-row]')?.focus());
  }, [addOpen]);
  const addMenuKeys = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const rows = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-add-row]'));
    const i = rows.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : e.key === 'ArrowDown' ? Math.min(rows.length - 1, i + 1) : Math.max(0, i - 1);
    e.preventDefault();
    rows[next]?.focus();
  };

  // Clicking anywhere else, or Escape, closes the add menu — re-clicking the
  // button should not be the only way out.
  useEffect(() => {
    if (!addOpen) return;
    const onDown = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setAddOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAddOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [addOpen]);
  const counterRef = useRef(1);

  /* THE TILE HEAD'S ONE BUTTON (Noah, 2026-09-12, twice in a morning: "2
     different full screen buttons that dont even work the same... only the top
     one stays", then "its not the full screen that takes the user to the
     actual page its designed to be at but rather it tries to cope by making
     its own section and thats wrong. it should take user to the actual page
     with a button allowing them to go back to the pulse page from there").
     So: a panel that is a copy of a page OPENS THAT PAGE (registry `page`),
     on the tile's own name, carrying the way back (components/layout/WayBack
     reads `state.wayBack` and shows "Back to Pulse"); the one panel that has a
     fullscreen of its own (the live chart: the quartet, the editor dock, total
     fullscreen, Esc's ladder) gets a one-shot token — the same road the focus
     arrival takes — and lifts it. The 2026-09-08 tile takeover, a section of
     its own that coped, is gone. */
  const [fullReq, setFullReq] = useState<{ id: string; token: number } | null>(null);
  const openPage = (page: NonNullable<WidgetDef['page']>, inst: WidgetInstance) => {
    if (nameOf(inst) !== activeTicker) changeTicker(nameOf(inst));
    page.prepare?.();
    navigate(page.path, { state: { wayBack: '/pulse' } });
  };

  /* Self-heal GHOSTS (Noah, 2026-08-17: "there is nothing there yet im still
     moving it and i see its 4 corners"): an instance whose widget key has
     left the registry — a launch trim landing over a live session — would
     render as an invisible, draggable, resizable box. loadDesks sanitizes at
     mount; this prunes them mid-flight too. */
  useEffect(() => {
    if (!instances.some(w => !widgetByKey(w.key))) return;
    const alive = instances.filter(w => widgetByKey(w.key));
    setInstances(alive);
    setLayout(prev => prev.filter(l => alive.some(w => w.id === l.i)));
  }, [instances]);

  // Scan tier — one snapshot feeds every widget (a name switch refreshes at once)
  const scanSnapshot = useScanSnapshot(SCAN_INTERVAL_MS);

  /** Build the whole widget context for one name. */
  const buildCtxFor = (snapshot: MarketSnapshot): WorkspaceCtx => {
    const gex = buildGexView(snapshot, 'GEX', 10);
    /* THE VIEWS A DESK DOES NOT SHOW ARE NEVER BUILT (2026-09-06, the perf
       sweep): every scan used to build the pulse view, the vanna/charm read
       and the whole Compass board for a desk of three charts that read none
       of them. They are getters now — built the first time a panel asks,
       remembered for the rest of the scan. */
    const lazy = <T,>(build: () => T) => {
      let v: T | undefined;
      let built = false;
      return () => {
        if (!built) {
          v = build();
          built = true;
        }
        return v as T;
      };
    };
    const pulse = lazy(() => buildPulseView(snapshot));
    const vanna = lazy(() => buildVannaCharm(snapshot, 'CHARM', -1));
    const setups = lazy(() => buildCompassView(snapshot, 'top-setups', Simulator.universeQuotes(snapshot.ticker)));
    const ctx = {
      ticker: snapshot.ticker,
      snapshot,
      revision: 0, // the tile's own read of the tick (TileBody)
      /* the 1 s heat the matrix once pulsed with — no panel reads it now; kept on the context, unpulsed */
      pulseTick: 0,
      gex,
      matrix: gex.matrix,
      exposure: buildExposureProfile(snapshot, '0DTE', 10),
    } as WorkspaceCtx;
    Object.defineProperty(ctx, 'pulse', { get: pulse, enumerable: true, configurable: true });
    Object.defineProperty(ctx, 'vanna', { get: vanna, enumerable: true, configurable: true });
    Object.defineProperty(ctx, 'setups', { get: setups, enumerable: true, configurable: true });
    return ctx;
  };

  // Every name any panel is unlinked to. Linked panels use the desk's ticker,
  // so an untouched desk still builds exactly one context.
  const usedTickers = useMemo(() => {
    const set = new Set<string>();
    if (scanSnapshot) set.add(scanSnapshot.ticker);
    instances.forEach(i => set.add(nameOf(i)));
    return [...set];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instances, scanSnapshot, groups, activeTicker]);

  // One context per name in use, rebuilt on the scan tier (only — it was rebuilt on every tick). The active symbol
  // reuses the live snapshot (it carries the tape); unlinked names read their
  // own state straight from the simulator without advancing it.
  const ctxByTicker = useMemo<Map<string, WorkspaceCtx>>(() => {
    const map = new Map<string, WorkspaceCtx>();
    if (!scanSnapshot) return map;
    for (const t of usedTickers) {
      try {
        map.set(t, buildCtxFor(t === scanSnapshot.ticker ? scanSnapshot : Simulator.snapshotFor(t)));
      } catch {
        /* a name the sim can't build is simply skipped — the panel says so */
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanSnapshot, usedTickers.join('|')]);

  /** The scan's context for a name, and what a panel adds to it: the shared strike and the door to focus one. ONE PRICE
      ON ONE SCREEN (the audit's X1.5): the book is rebuilt on the 10 s scan, but the price every panel prints is the
      live tick the rail and the chart print — `liveSpot`, read by the tile off the published tick (TileBody). */
  const baseFor = (pinned?: string): WorkspaceCtx | null => ctxByTicker.get(pinned ?? scanSnapshot?.ticker ?? '') ?? null;
  const extraFor = (base: WorkspaceCtx): Partial<WorkspaceCtx> => {
    // The focus belongs to ONE name — a panel pinned elsewhere never draws it
    const focusPrice = focus && focus.ticker === base.ticker ? focus.price : null;
    return {
      focusPrice,
      clearFocus: focusPrice != null ? clearFocus : undefined,
      // Evaluated on click, after focusOn below exists — the in-desk door
      focusStrike: (price: number) => focusOn(price, base.ticker),
    };
  };
  const ctxFor = (pinned?: string): WorkspaceCtx | null => {
    const base = baseFor(pinned);
    return base ? withLive(extendCtx(base, extraFor(base)), () => undefined) : null;
  };

  /** The desk's own context — used by the add-menu preview. */
  const pulsedCtx = ctxFor();

  /** The one chart that lifts on a focus arrival: the first live chart whose
      effective name is the focus's. */
  const focusChartId = focus
    ? (instances.find(w => w.key === 'live-chart' && nameOf(w) === focus.ticker)?.id ?? null)
    : null;

  const addWidget = (key: string) => {
    const def = widgetByKey(key);
    if (!def) return;
    const id = `${key}-${++counterRef.current}-${instances.length}`;
    setInstances(prev => [...prev, { id, key }]);
    // First hole from the top that takes it, shrinking toward the minimum when
    // the hole is narrower — not the bottom of the page (Noah, 2026-08-19).
    setLayout(prev => [...prev, { i: id, ...firstFit(prev, def), minW: def.minW, minH: def.minH, maxH: def.maxH }]);
    setAddOpen(false);
  };

  /* Focus a strike on this desk: the desk repoints to its name if it has
     drifted, and makes sure there is a chart to draw it on — the first desk
     that carries one, else a chart added to this one. The deep link from
     other pages and the in-desk widgets (Ranked Targets) both come through
     here. */
  const focusOn = (price: number, ticker: string) => {
    if (ticker !== activeTicker) changeTicker(ticker);
    focusShared(price, ticker);
    if (!instances.some(w => w.key === 'live-chart')) {
      const deskWithChart = Object.entries(store.desks).find(([, ws]) => ws.instances.some(w => w.key === 'live-chart'))?.[0];
      if (deskWithChart) switchDesk(deskWithChart);
      else addWidget('live-chart');
    }
  };

  /* THE WAY BACK (Noah, 2026-09-09: "whenever i exit from the full screen it just
     drops me off into pulse but remember i came from another page to begin
     with"): a deep link that says where it came from is remembered here, and
     the chart that lifted on it calls `focusReturn` as it leaves fullscreen —
     the reader lands back on that page. Once: the ref is cleared on the way. */
  const returnToRef = useRef<string | null>(null);
  const focusReturn = useCallback(() => {
    const to = returnToRef.current;
    if (!to) return;
    returnToRef.current = null;
    navigate(to);
  }, [navigate]);

  // Deep link in: a strike to focus. Consumed so a refresh doesn't re-enter.
  useEffect(() => {
    const state = location.state as { focusPrice?: number; ticker?: string; from?: string } | null;
    if (state?.focusPrice == null) return;
    returnToRef.current = state.from && state.from !== '/pulse' ? state.from : null;
    focusOn(state.focusPrice, state.ticker ?? activeTicker);
    window.history.replaceState({}, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (Leaving the focus's name retires it — FocusContext carries that rule now.)

  const setWidgetTicker = (id: string, ticker: string | undefined) =>
    setInstances(prev => prev.map(w => (w.id === id ? { ...w, ticker } : w)));

  /* THE LINK (Mo, 2026-08-19). A linked panel (ticker undefined) that picks a
     name BROADCASTS it — the terminal moves, so every linked panel follows.
     An unlinked panel keeps its pick to itself. Unlinking pins the panel to
     whatever it shows right now, so nothing jumps at the moment of unlinking. */
  const pickFor = (inst: WidgetInstance) => (t: string) => {
    const g = groupOf(inst);
    if (g) setLinkGroup(g, t);
    else if (inst.ticker === undefined) changeTicker(t);
    else setWidgetTicker(inst.id, t);
  };
  const toggleLink = (inst: WidgetInstance) =>
    setWidgetTicker(inst.id, inst.ticker === undefined ? activeTicker : undefined);
  /* Joining a group: a group with a name is read at once; one with none takes this panel's. Leaving one: the panel holds
     the name it showed (it follows the terminal again when that is the terminal's) — nothing jumps either way. */
  const setGroup = (inst: WidgetInstance, g: LinkGroup | null) => {
    const shown = nameOf(inst);
    if (g && !groups[g]) setLinkGroup(g, shown);
    setInstances(prev =>
      prev.map(w => (w.id === inst.id ? { ...w, group: g ?? undefined, ticker: g ? undefined : shown === activeTicker ? undefined : shown } : w))
    );
  };

  const removeWidget = (id: string) => {
    const inst = instances.find(w => w.id === id);
    const cell = layout.find(l => l.i === id);
    const at = instances.findIndex(w => w.id === id);
    setInstances(prev => prev.filter(w => w.id !== id));
    setLayout(prev => prev.filter(l => l.i !== id));
    if (!inst) return;
    const title = widgetByKey(inst.key)?.title ?? 'the panel';
    undoable({
      label: `Removed ${title}`,
      undo: () => {
        setInstances(prev => (prev.some(w => w.id === id) ? prev : [...prev.slice(0, at), inst, ...prev.slice(at)]));
        if (cell) setLayout(prev => (prev.some(l => l.i === id) ? prev : [...prev, cell]));
      },
    });
  };

  /*
    THE PHONE GETS ONE CHART, not a stacked desk (ported 2026-08-27).

    Branched in JS, not hidden with CSS, and that is the whole reason
    `useIsPhone` exists: a `md:hidden` grid still MOUNTS — ten live panels
    building canvases and subscribing to the tick behind a screen nobody can
    see, on the device least able to carry them.

    The desk state above is untouched. It still loads, still saves, still
    autosaves — a reader who opens the terminal on a laptop finds their
    arrangement exactly as they left it, having been on a phone in between.
  */
  if (isPhone) {
    const phoneBase = baseFor();
    return (
      /* Full bleed, cancelling the shell's own padding so the chart reaches
         all four edges. `dvh`, not `vh`: on a phone `100vh` is the height
         with the URL bar RETRACTED, so a chart sized to it hides its own
         price axis under the browser chrome on arrival. 3.5rem is the top
         bar, the same constant Terrain uses. */
      <div className="-mx-4 -mt-5 -mb-16 flex h-[calc(100dvh-3rem)] flex-col">
        {/* A LINE OF HEAD (the audit's PU-7): what this is, which desk, and that the desks open on a wider screen */}
        <div className="shrink-0 flex items-center gap-2 px-4 h-11 border-b border-borderSubtle" data-pulse-phone-head>
          <ProductGlyphSmall />
          <h1 className="text-[13px] font-semibold text-textPrimary">Pulse</h1>
          <span className="min-w-0 truncate text-[11px] text-textMuted">the live chart · your desks open on a wider screen</span>
        </div>
        {phoneBase ? (
          <TileBody
            /* Remounts on a name change so the chart rebuilds cleanly rather
               than re-pointing a live series. */
            key={phoneBase.ticker}
            base={phoneBase}
            render={phoneChart}
            extra={{ ...extraFor(phoneBase), pickTicker: changeTicker }}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-[12px] text-textMuted">Loading the desk…</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* THE SHELL HEAD (the audit's PU-2): the glyph, the name, one line, the facts */}
      <ShellHead
        glyph="pulse"
        title="Pulse"
        line="The live market desk — add panels, drag them around, link them to one name or let them hold their own; every desk saves as you go"
        facts={[
          { label: 'Desk', value: active, testId: 'desk' },
          { label: 'Panels', value: instances.length, testId: 'panels' },
          { label: 'Name', value: activeTicker, testId: 'name', wide: true },
        ]}
        testId="pulse-shell"
      />

      {/* Desk rail — two named groups so the house's desks and yours never
          read as one undifferentiated row (Noah, 2026-08-19: "these buttons
          all look the same"). Presets are bare chips under PRESETS; your
          saved desks wear an outline under YOURS; Save as is an action and
          dresses like one. */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Group labels: a different register from the chips they name —
            flat holo silver (the fact-slot label ink), smaller, letterspaced,
            and locked to the chips' line so they sit dead center. */}
        <span className="flex items-center gap-1.5">
          <span className="h-7 inline-flex items-center text-[11px] leading-none text-textMuted select-none">Presets</span>
          <span className="flex items-center gap-0.5">
            {PRESET_NAMES.map(name => (
              <span key={name} className="inline-flex" {...peekHandlers(name)}>
                <Chip active={active === name} onClick={() => switchDesk(name)}>
                  {/* Every desk wears a dot; the one you're ON is neon —
                      the selection voice saying "you are here". */}
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-1 h-1 rounded-full shrink-0 ${active === name ? 'bg-select' : 'bg-silver/50'}`} aria-hidden="true" />
                    {name}
                  </span>
                </Chip>
              </span>
            ))}
          </span>
        </span>
        {customNames.length > 0 && (
          <>
            <span className="w-px h-3.5 bg-borderSubtle" aria-hidden="true" />
            <span className="flex items-center gap-1.5">
              {/* No "Yours" heading — a desk carrying the user's own name
                  says that already, and the divider plus the hover-delete
                  are the honest tell (Noah, 2026-08-19). Same geometry as a
                  preset chip — one element, even padding — and a delete slot
                  of fixed width that reveals on hover. */}
              <span className="flex items-center gap-0.5">
                {customNames.map(name => (
                  <span key={name} className="group inline-flex items-center" {...peekHandlers(name)}>
                    <button
                      onClick={() => switchDesk(name)}
                      aria-pressed={active === name}
                      className={`inline-flex items-center gap-1.5 h-7 px-2 rounded font-mono text-[11px] whitespace-nowrap transition-colors ${
                        active === name
                          ? 'bg-ink/[0.09] text-textPrimary font-semibold'
                          : 'text-textMuted hover:text-textPrimary hover:bg-ink/[0.04]'
                      }`}
                    >
                      <span className={`w-1 h-1 rounded-full shrink-0 ${active === name ? 'bg-select' : 'bg-silver/50'}`} aria-hidden="true" />
                      {name}
                    </button>
                    <button
                      onClick={() => deleteDesk(name)}
                      aria-label={`Delete the ${name} desk`}
                      title="Delete this desk"
                      className="hit w-5 h-5 inline-flex items-center justify-center rounded text-textMuted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 hover:!text-bear transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </span>
            </span>
          </>
        )}
        <span className="w-px h-3.5 bg-borderSubtle" aria-hidden="true" />
        {savingAs ? (
          <form
            onSubmit={e => {
              e.preventDefault();
              saveAs();
            }}
            className="inline-flex items-center gap-1"
          >
            <input
              ref={saveInputRef}
              value={newName}
              onChange={e => setNewName(e.target.value.slice(0, 24))}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setSavingAs(false);
                  setNewName('');
                }
              }}
              placeholder="Name this desk…"
              aria-label="Name this desk"
              aria-describedby={presetNamed(newName) || nameTaken(newName) ? 'save-as-note' : undefined}
              className="w-40 bg-inset border border-borderSubtle rounded px-2 py-1 font-mono text-[11px] text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-borderMuted"
            />
            <button
              type="submit"
              disabled={!newName.trim() || !!presetNamed(newName)}
              title={presetNamed(newName) ? `${presetNamed(newName)} is a preset — pick another name` : nameTaken(newName) ? `Replaces your ${nameTaken(newName)} desk (Undo after)` : 'Save'}
              className="p-1 rounded text-textSecondary hover:text-textPrimary disabled:opacity-30 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setSavingAs(false);
                setNewName('');
              }}
              className="p-1 rounded text-textMuted hover:text-textPrimary transition-colors"
              aria-label="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            {(presetNamed(newName) || nameTaken(newName)) && (
              <span id="save-as-note" role="status" className="text-[11px] text-textMuted">
                {presetNamed(newName) ? `${presetNamed(newName)} is a preset — pick another name` : `Replaces your ${nameTaken(newName)} desk`}
              </span>
            )}
          </form>
        ) : (
          <button
            onClick={() => setSavingAs(true)}
            title="Save this arrangement as a new desk"
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-borderSubtle bg-ink/[0.02] hover:bg-ink/[0.05] hover:border-borderMuted text-[11px] text-textSecondary hover:text-textPrimary transition-colors"
          >
            <Save className="w-3 h-3" /> Save as…
          </button>
        )}
      </div>

      {peek && store.desks[peek.name] && (
        <HoverReadout x={peek.x} y={peek.y}>
          <DeskPeek name={peek.name} ws={store.desks[peek.name]} />
        </HoverReadout>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative" ref={addMenuRef}>
          {/* CTA wears the foil (lime retreating — Noah, 2026-08-17; filled
              holo is the sanctioned CTA material). */}
          <button
            onClick={() => setAddOpen(o => !o)}
            aria-expanded={addOpen}
            aria-haspopup="true"
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md holo-bg text-[#0a0a0a] hover:brightness-105 text-[11px] font-semibold transition-all"
            data-pulse-add
          >
            <Plus className="w-3.5 h-3.5" /> Add a panel
          </button>
          {addOpen && (
            <div className="absolute left-0 top-full mt-1 z-30 w-[620px] border border-borderMuted bg-panel rounded-md shadow-2xl shadow-black/60 overflow-hidden animate-slide-in flex" onKeyDown={addMenuKeys}>
              {/* Names on the left, the actual panel on the right. Only the
                  highlighted one is mounted — ten live panels took two seconds
                  to open, one is instant. */}
              <div className="w-[228px] shrink-0 max-h-[380px] overflow-y-auto border-r border-borderSubtle">
                {WIDGETS.map(def => (
                  <button
                    key={def.key}
                    onClick={() => addWidget(def.key)}
                    onMouseEnter={() => setPreviewKey(def.key)}
                    onFocus={() => setPreviewKey(def.key)}
                    data-add-row
                    className={`w-full text-left px-3 py-2 border-b border-borderSubtle/40 last:border-0 transition-colors ${
                      previewKey === def.key ? 'bg-ink/[0.06]' : 'hover:bg-ink/[0.03]'
                    }`}
                  >
                    <span className="block text-[12px] font-semibold text-textPrimary">{def.title}</span>
                    <span className="block text-[11px] text-textMuted truncate">{def.sub}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 min-w-0 p-3 flex flex-col gap-2">
                <WidgetThumb def={previewDef} ctx={pulsedCtx} width={352} />
                <span className="text-[12px] font-semibold text-textPrimary">{previewDef.title}</span>
                <span className="text-[11px] text-textSecondary leading-snug">{previewDef.description}</span>
                <button
                  onClick={() => addWidget(previewDef.key)}
                  className="mt-auto w-full py-1.5 rounded holo-bg text-[#0a0a0a] hover:brightness-105 font-mono text-[11px] font-semibold uppercase tracking-wider transition-all"
                >
                  Add {previewDef.title}
                </button>
              </div>
            </div>
          )}
        </div>
        {isPreset(active) && (
          <button
            onClick={reset}
            title={`Restore the ${active} preset`}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md border border-borderSubtle bg-ink/[0.02] hover:bg-ink/[0.05] text-[11px] text-textSecondary hover:text-textPrimary transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Reset to the preset
          </button>
        )}
        <span className="ml-auto text-[11px] text-textMuted tnum" data-pulse-status>
          {active} · {instances.length} panel{instances.length === 1 ? '' : 's'} · saves as you go
        </span>
      </div>

      {/* The grid — fades out on a switch, then the next desk mounts under a
          fresh key and breathes in slowly */}
      {!pulsedCtx ? (
        <Panel className="h-64" bodyClassName="flex items-center justify-center">
          <span className="text-[12px] text-textMuted">Loading the desk…</span>
        </Panel>
      ) : instances.length === 0 ? (
        /* THE EMPTY DESK SAYS WHAT TO DO AND HOLDS THE DOORS (the audit's PU-12) */
        <Panel className="h-64" bodyClassName="flex flex-col items-center justify-center gap-3" data-pulse-empty>
          <span className="text-[13px] text-textPrimary">This desk has no panels.</span>
          <span className="text-[11px] text-textSecondary">Add one, or put a preset's panels back.</span>
          <span className="flex items-center gap-2">
            <button type="button" onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md border border-borderMuted text-[11px] text-textPrimary hover:bg-ink/[0.05]">
              <Plus className="w-3.5 h-3.5" /> Add a panel
            </button>
            <button type="button" onClick={() => loadWorkspace(presetTemplate(isPreset(active) ? active : PRESET_NAMES[0])!)} className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md border border-borderSubtle text-[11px] text-textSecondary hover:text-textPrimary hover:bg-ink/[0.05]">
              <RotateCcw className="w-3 h-3" /> {isPreset(active) ? `Restore ${active}` : `Use ${PRESET_NAMES[0]}'s panels`}
            </button>
          </span>
        </Panel>
      ) : (
        <div
          key={active}
          ref={deskRef}
          className={`animate-soft-in-slow transition-opacity duration-200 ease-out ${switching ? 'opacity-0' : 'opacity-100'}`}
        >
          {deskWidth != null && (
          <RGL
            layout={layout}
            /* the host's own measure — see useHostWidth */
            width={deskWidth}
            cols={12}
            rowHeight={88}
            margin={[12, 12]}
            containerPadding={[0, 0]}
            /* Vertical compaction restored (Noah, 2026-08-17: the null-compaction
               trial "messed it up" — reverted same day). */
            compactType="vertical"
            draggableHandle=".widget-drag"
            /* Every corner resizes (Noah, 2026-08-17) — the library defaults to
               bottom-right only. */
            resizeHandles={['se', 'sw', 'ne', 'nw']}
            /* THE SNAP (2026-09-06, the perf sweep): on release the library
               glides the item to its grid size over 200ms, and the chart
               inside re-laid itself out on every frame of that — the "drop"
               was a 66ms task. The chart holds through the snap and takes
               the final size once (core/glide.ts). */
            onDragStop={() => beginGlide(260, 'snap')}
            onResizeStop={() => beginGlide(260, 'snap')}
            onLayoutChange={(next: Layout[]) => setLayout(next)}
          >
            {instances.map((inst, idx) => {
              const def = widgetByKey(inst.key);
              if (!def) return <div key={inst.id} />;
              return (
                <div
                  key={inst.id}
                  className="border border-borderSubtle bg-panel rounded-md overflow-hidden flex flex-col"
                  /* THE TILE'S PROMISE (core/glide.ts): its laid-out width — the
                     library's own arithmetic — which during the sidebar's glide is
                     where it is going, so the chart inside sizes for it at once */
                  data-tile-width={tileWidth(deskWidth, layout.find(l => l.i === inst.id)?.w ?? def.w)}
                >
                  {/* THE TILE HEAD in the house grammar (Noah, 2026-09-08: the
                      cards' "header formatting" was outdated): the grip, a
                      sentence-case title with its one-line sub, the scope chip,
                      the close — the same head every Pinpoint box wears, sized
                      for a tile. The head is the drag handle. */}
                  <div className="widget-drag cursor-grab active:cursor-grabbing flex items-center gap-2.5 pl-3 pr-2.5 h-[42px] border-b border-borderSubtle shrink-0 select-none" data-tile-head>
                    <GripHorizontal className="w-3.5 h-3.5 text-textMuted shrink-0" />
                    <span className="min-w-0 flex-1 flex flex-col justify-center leading-tight">
                      <span className="text-[12px] font-semibold text-textPrimary truncate">{def.title}</span>
                      <span className="text-[11px] text-textMuted truncate">{def.sub}</span>
                    </span>
                    {/* THE SCOPE CHIP (2026-09-06): follows the frame, or holds
                        its own name. stopPropagation on mousedown so using
                        the picker never starts a panel drag. */}
                    <span className="ml-auto shrink-0 flex items-center gap-1.5" onMouseDown={e => e.stopPropagation()}>
                      <LinkGroupChip
                        group={groupOf(inst)}
                        onChange={g => setGroup(inst, g)}
                        noneHint="Follows the terminal, or holds its own name"
                        testId={inst.id}
                      />
                      {groupOf(inst) ? (
                        <LiveScopeChip
                          ticker={nameOf(inst)}
                          onPick={pickFor(inst)}
                          quote
                          title={`Group ${groupOf(inst)} · a name picked here moves every panel in the group`}
                        />
                      ) : (
                        <LiveScopeChip
                          ticker={inst.ticker ?? activeTicker}
                          linked={inst.ticker === undefined}
                          onPick={pickFor(inst)}
                          onToggleLink={() => toggleLink(inst)}
                          quote
                        />
                      )}
                      {(def.ownFull || def.page) && (
                        <button
                          onClick={() => (def.ownFull ? setFullReq({ id: inst.id, token: Date.now() }) : openPage(def.page!, inst))}
                          aria-label={def.page ? `Open ${def.page.label}` : 'Fullscreen'}
                          title={def.page ? `Open ${def.page.label} — the whole page, with a way back here` : 'Fullscreen'}
                          className="p-1.5 -my-1.5 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors"
                          data-tile-full={def.page ? 'page' : 'own'}
                        >
                          {/* leaving for a page and growing in place are two icons (the audit's PU-6) */}
                          {def.page ? <ArrowUpRight className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                      )}
                      {/* Fat hit target (Noah, 2026-08-17: "very difficult to
                          click") — the padding is the button; the icon just
                          marks its center. */}
                      <button
                        onClick={() => removeWidget(inst.id)}
                        aria-label={`Remove ${def.title}`}
                        title="Remove — Undo stays up for a few seconds"
                        className="p-1.5 -my-1.5 -mr-1 rounded text-textMuted hover:text-bear hover:bg-ink/[0.06] transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </span>
                  </div>
                  <div className="flex-grow min-h-0 overflow-hidden">
                    {(() => {
                      const base = baseFor(nameOf(inst));
                      return base ? (
                        /* ONE PANEL PER FRAME (2026-09-06, the perf sweep): the
                           desk's panels mount staggered behind their skeletons,
                           so a desk of charts opens on its next frame instead
                           of building every chart inside the click. */
                        <Deferred index={idx} fallback={def.skeleton()} className="h-full animate-fade-in">
                          <TileBody
                            base={base}
                            render={def.render}
                            extra={{
                              ...extraFor(base),
                              pickTicker: pickFor(inst),
                              // The arrival token goes to ONE chart — the first on
                              // the focus's name — so two charts never lift at once
                              focusOpen: inst.id === focusChartId ? focus?.token : undefined,
                              focusReturn: inst.id === focusChartId ? focusReturn : undefined,
                              fullOpen: fullReq?.id === inst.id ? fullReq.token : undefined,
                            }}
                          />
                        </Deferred>
                      ) : (
                        <span className="flex h-full items-center justify-center text-[11px] text-textMuted">Nothing to show for {nameOf(inst)} yet</span>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </RGL>
          )}
        </div>
      )}

    </>
  );
};

export default Pulse;
