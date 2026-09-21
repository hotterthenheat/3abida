import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import RGL, { type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Check, GripHorizontal, Maximize2, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { useMarketData } from '../../context/MarketDataContext';
import { useFocus } from '../../context/FocusContext';
import Simulator from '../../core/simulator';
import { buildGexView, pulseMatrix } from '../../data/gex';
import { buildExposureProfile } from '../../data/exposure';
import { buildPulseView } from '../../data/pulse';
import { buildVannaCharm } from '../../data/vannacharm';
import { buildCompassView } from '../../data/compass';
import Chip from '../../components/ui/Chip';
import { useIsPhone } from '../../components/ui/useMediaQuery';
import LiveChartWidget from './LiveChartWidget';
import HoverReadout from '../../components/ui/HoverReadout';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import { WIDGETS, widgetByKey, type WidgetDef, type WorkspaceCtx } from './registry';
import WidgetThumb from './WidgetThumb';
import ScopeChip from '../../components/ui/ScopeChip';
import { Deferred } from '../../components/ui/Skeleton';
import { afterGlide, beginGlide, glideTarget, onGlide } from '../../core/glide';
import {
  firstFit,
  isPreset,
  loadDesks,
  PRESET_BLURBS,
  PRESET_NAMES,
  presetTemplate,
  saveDesks,
  type DeskStore,
  type SavedWorkspace,
  type WidgetInstance,
} from './desks';
import type { MarketSnapshot } from '../../types/market';
import { Name } from '../../components/ui/Name';
import DataState from '../../components/ui/DataState';

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
        <span className="font-mono text-[9px] uppercase tracking-wider text-textMuted tnum">
          {ws.instances.length} panel{ws.instances.length === 1 ? '' : 's'}
        </span>
      </div>
      {PRESET_BLURBS[name] && <p className="mt-1 text-[10px] leading-snug text-textSecondary">{PRESET_BLURBS[name]}</p>}
      {/* words only — the block schematic read as noise (Noah, 2026-08-19) */}
      <ul className="mt-2 flex flex-col gap-0.5">
        {titles.map((t, i) => (
          <li key={`${t}-${i}`} className="font-mono text-[10px] text-textSecondary">
            <span className="text-textMuted">· </span>
            {t}
          </li>
        ))}
      </ul>
    </>
  );
};

/* PULSE (2026-08-17): the widget desk IS the Pulse page — Noah: "i want the
   pulse page to basically be the workspace page... i love how our current
   workspace moves so lets just make pulse that." Named desks + the link
   (Mo, 2026-08-19) layered on without touching how it moves. */
const Pulse = () => {
  const { activeTicker, marketData, changeTicker } = useMarketData();
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

  const saveAs = () => {
    const name = newName.trim();
    // Preset names are reserved — they're the templates you reset TO.
    if (!name || isPreset(name)) return;
    setStore(prev => ({ active: name, desks: { ...prev.desks, [name]: { instances, layout } } }));
    setSavingAs(false);
    setNewName('');
  };

  const deleteDesk = (name: string) => {
    if (isPreset(name)) return;
    const fallback = PRESET_NAMES[0];
    setStore(prev => {
      const desks = { ...prev.desks };
      delete desks[name];
      return { active: prev.active === name ? fallback : prev.active, desks };
    });
    if (active === name) loadWorkspace(store.desks[fallback]);
  };

  /** Presets reset to their curated template; a custom desk has nothing to reset to. */
  const reset = () => {
    const tpl = presetTemplate(active);
    if (tpl) loadWorkspace(tpl);
  };

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
  });

  // ---- add menu -------------------------------------------------------------
  const [addOpen, setAddOpen] = useState(false);
  /** Which widget the add-menu is previewing — only this one gets mounted. */
  const [previewKey, setPreviewKey] = useState<string>(WIDGETS[0].key);
  const previewDef = widgetByKey(previewKey) ?? WIDGETS[0];
  const addMenuRef = useRef<HTMLDivElement | null>(null);

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
    if (inst.ticker && inst.ticker !== activeTicker) changeTicker(inst.ticker);
    page.prepare?.();
    navigate(page.path, { state: { wayBack: '/pulse' } });
  };

  const revRef = useRef(0);
  const revision = useMemo(() => ++revRef.current, [marketData]);

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

  // Scan tier — one snapshot feeds every widget
  const [scanSnapshot, setScanSnapshot] = useState<MarketSnapshot | null>(null);
  const scanRef = useRef<MarketSnapshot | null>(null);
  const lastScanTimeRef = useRef(0);
  useEffect(() => {
    if (!marketData) return;
    const now = Date.now();
    const due =
      !scanRef.current ||
      now - lastScanTimeRef.current >= SCAN_INTERVAL_MS ||
      scanRef.current.ticker !== marketData.ticker;
    if (due) {
      scanRef.current = marketData;
      lastScanTimeRef.current = now;
      setScanSnapshot(marketData);
    }
  }, [marketData]);

  // 1s heatmap pulse (same treatment as Live Terminal)
  const [pulseTick, setPulseTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPulseTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

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
      revision,
      pulseTick: 0, // stamped per render by ctxFor — the memo below must not depend on it
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
    instances.forEach(i => i.ticker && set.add(i.ticker));
    return [...set];
  }, [instances, scanSnapshot]);

  // One context per name in use, rebuilt on the scan tier. The active symbol
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
  }, [scanSnapshot, revision, usedTickers.join('|')]);

  /** The context a panel should render with, pulsed for the live heat. */
  const ctxFor = (pinned?: string): WorkspaceCtx | null => {
    const base = ctxByTicker.get(pinned ?? scanSnapshot?.ticker ?? '') ?? null;
    if (!base) return null;
    // The focus belongs to ONE name — a panel pinned elsewhere never draws it
    const focusPrice = focus && focus.ticker === base.ticker ? focus.price : null;
    return {
      ...base,
      pulseTick,
      matrix: pulseMatrix(base.gex.matrix, pulseTick),
      focusPrice,
      clearFocus: focusPrice != null ? clearFocus : undefined,
      // Evaluated on click, after focusOn below exists — the in-desk door
      focusStrike: (price: number) => focusOn(price, base.ticker),
    };
  };

  /** The desk's own context — used by the add-menu preview. */
  const pulsedCtx = ctxFor();

  /** The one chart that lifts on a focus arrival: the first live chart whose
      effective name is the focus's. */
  const focusChartId = focus
    ? (instances.find(w => w.key === 'live-chart' && (w.ticker ?? activeTicker) === focus.ticker)?.id ?? null)
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
    if (inst.ticker === undefined) changeTicker(t);
    else setWidgetTicker(inst.id, t);
  };
  const toggleLink = (inst: WidgetInstance) =>
    setWidgetTicker(inst.id, inst.ticker === undefined ? activeTicker : undefined);

  const removeWidget = (id: string) => {
    setInstances(prev => prev.filter(w => w.id !== id));
    setLayout(prev => prev.filter(l => l.i !== id));
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
    return (
      /* Full bleed, cancelling the shell's own padding so the chart reaches
         all four edges. `dvh`, not `vh`: on a phone `100vh` is the height
         with the URL bar RETRACTED, so a chart sized to it hides its own
         price axis under the browser chrome on arrival. 3.5rem is the top
         bar, the same constant Terrain uses. */
      <div className="-mx-4 -mt-5 -mb-16 flex h-[calc(100dvh-3.5rem)] flex-col">
        {pulsedCtx ? (
          <LiveChartWidget
            /* Remounts on a name change so the chart rebuilds cleanly rather
               than re-pointing a live series. */
            key={pulsedCtx.ticker}
            ctx={{ ...pulsedCtx, pickTicker: changeTicker }}
            soleChart
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-mono text-[11px] uppercase tracking-widest text-textMuted">
              Awaiting feed initialization…
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumb={['Terminal', 'Pulse']}
        title="Pulse"
        subtitle="The live market desk — add panels, drag them around, link them to one name or let them hold their own; every desk saves as you go"
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
          <span className="h-5 inline-flex items-center font-mono text-[8px] leading-none uppercase tracking-[0.2em] text-silver/70 select-none">
            Presets
          </span>
          <span className="flex items-center gap-0.5">
            {PRESET_NAMES.map(name => (
              <span key={name} className="inline-flex" {...peekHandlers(name)}>
                <Chip active={active === name} onClick={() => switchDesk(name)} title="">
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
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[10px] whitespace-nowrap transition-colors ${
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
                      className="w-4 h-4 inline-flex items-center justify-center rounded text-textMuted opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:!text-bear transition-opacity"
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
              className="w-40 bg-inset border border-borderSubtle rounded px-2 py-1 font-mono text-[11px] text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-borderMuted"
            />
            <button
              type="submit"
              disabled={!newName.trim() || isPreset(newName.trim())}
              title={isPreset(newName.trim()) ? 'Preset names are reserved' : 'Save'}
              className="p-1 rounded text-textSecondary hover:text-textPrimary transition-colors"
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
          </form>
        ) : (
          <button
            onClick={() => setSavingAs(true)}
            title="Save this arrangement as a new desk"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-borderSubtle bg-ink/[0.02] hover:bg-ink/[0.05] hover:border-borderMuted font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary transition-colors"
          >
            <Save className="w-3 h-3" /> Save as
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md holo-bg text-[#0a0a0a] hover:brightness-105 font-mono text-[11px] font-semibold uppercase tracking-wider transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add widget
          </button>
          {addOpen && (
            <div className="absolute left-0 top-full mt-1 z-30 w-[620px] border border-borderMuted bg-panel rounded-md shadow-2xl shadow-black/60 overflow-hidden animate-slide-in flex">
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
                    className={`w-full text-left px-3 py-2 border-b border-borderSubtle/40 last:border-0 transition-colors ${
                      previewKey === def.key ? 'bg-ink/[0.06]' : 'hover:bg-ink/[0.03]'
                    }`}
                  >
                    <span className="block text-[12px] font-semibold text-textPrimary">{def.title}</span>
                    <span className="block text-[10px] text-textMuted truncate">{def.sub}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 min-w-0 p-3 flex flex-col gap-2">
                <WidgetThumb def={previewDef} ctx={pulsedCtx} width={352} />
                <span className="text-[12px] font-semibold text-textPrimary">{previewDef.title}</span>
                <span className="text-[10px] text-textSecondary leading-snug">{previewDef.description}</span>
                <button
                  onClick={() => addWidget(previewDef.key)}
                  className="mt-auto w-full py-1.5 rounded holo-bg text-[#0a0a0a] hover:brightness-105 font-mono text-[10px] font-semibold uppercase tracking-wider transition-all"
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-borderSubtle bg-ink/[0.02] hover:bg-ink/[0.05] font-mono text-[11px] uppercase tracking-wider text-textSecondary hover:text-textPrimary transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Reset preset
          </button>
        )}
        <span className="ml-auto font-mono text-[10px] text-textMuted uppercase tracking-widest tnum">
          {active} · {instances.length} panels · saves as you go
        </span>
      </div>

      {/* The grid — fades out on a switch, then the next desk mounts under a
          fresh key and breathes in slowly */}
      {!pulsedCtx ? (
        <Panel className="h-64" bodyClassName="flex items-center justify-center">
          <span className="font-mono text-[11px] text-textMuted uppercase tracking-widest">
            Awaiting feed initialization…
          </span>
        </Panel>
      ) : instances.length === 0 ? (
        <Panel className="h-64" bodyClassName="flex flex-col items-center justify-center gap-2">
          <span className="font-mono text-[11px] text-textMuted uppercase tracking-widest">Empty desk</span>
          <span className="text-[11px] text-textSecondary">Use “Add widget” to build your layout</span>
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
                      <span className="text-[10px] text-textMuted truncate">{def.sub}</span>
                    </span>
                    {/* THE SCOPE CHIP (2026-09-06): follows the frame, or holds
                        its own name. stopPropagation on mousedown so using
                        the picker never starts a panel drag. */}
                    <span className="ml-auto shrink-0 flex items-center gap-1.5" onMouseDown={e => e.stopPropagation()}>
                      {/* A market-wide panel has no name to scope — offering
                          to pin the indices to NVDA is a control that does
                          nothing, which is worse than no control at all. */}
                      {!def.marketWide && (
                        <ScopeChip
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
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      )}
                      {/* Fat hit target (Noah, 2026-08-17: "very difficult to
                          click") — the padding is the button; the icon just
                          marks its center. */}
                      <button
                        onClick={() => removeWidget(inst.id)}
                        aria-label="Remove widget"
                        className="p-1.5 -my-1.5 -mr-1 rounded text-textMuted hover:text-bear hover:bg-ink/[0.06] transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </span>
                  </div>
                  <div className="flex-grow min-h-0 overflow-hidden">
                    {(() => {
                      const wctx = ctxFor(inst.ticker);
                      return wctx ? (
                        /* ONE PANEL PER FRAME (2026-09-06, the perf sweep): the
                           desk's panels mount staggered behind their skeletons,
                           so a desk of charts opens on its next frame instead
                           of building every chart inside the click. */
                        <Deferred index={idx} fallback={def.skeleton()} className="h-full animate-fade-in">
                          {def.render({
                            ...wctx,
                            pickTicker: pickFor(inst),
                            // The arrival token goes to ONE chart — the first on
                            // the focus's name — so two charts never lift at once
                            focusOpen: inst.id === focusChartId ? focus?.token : undefined,
                            focusReturn: inst.id === focusChartId ? focusReturn : undefined,
                            fullOpen: fullReq?.id === inst.id ? fullReq.token : undefined,
                          })}
                        </Deferred>
                      ) : (
                        /* UNAVAILABLE, not empty (ui/DataState): the desk has
                           no series for this name, which is not something a
                           reader can fix by waiting or by widening anything. */
                        <DataState
                          kind="unavailable"
                          className="h-full"
                          pad="sm"
                          title="No series"
                          body={<>The desk carries nothing for {inst.ticker ? <Name t={inst.ticker} size={12} /> : 'this name'} — pick another.</>}
                        />
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
