/*
==================================================
  SLAYER TERMINAL - BUILDING
  (pages/pinpoint/Building.tsx)

  The fifth page of Pinpoint (2026-09-07). The Map
  says where the hedging sits, Ahead what happens
  from here to the close. Building says which of
  the hedging arrived TODAY — the wall a day early
  — read top to bottom in two boxes:

    WHAT'S BEING BUILT   every strike: the hedging
                         there now, what today added
                         or took off (calls · puts),
                         the day's shape, the word
    WHAT BUILDING MEANS  the words defined, and the
                         strikes loaded today as
                         readable information rows
                         (2026-09-13)
    WHERE THE WALLS      the four levels at the open,
    ARE HEADING          now, and by the close at
                         today's pace, with the
                         strike growing fastest on
                         each side

  A COMPOSITION, like Ahead: the open interest is
  the one every snapshot carries, the units are the
  chain's own at the live spot, the levels are the
  Map's, the clock is the shell's. data/building.ts
  holds the arithmetic.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import Simulator from '../../core/simulator';
import { useMarketData } from '../../context/MarketDataContext';
import { useFocus } from '../../context/FocusContext';
import ScopeChip from '../../components/ui/ScopeChip';
import { Deferred } from '../../components/ui/Skeleton';
import BuildingLedger, { type BuildOrder, type BuildPalette } from '../../components/gex/BuildingLedger';
import WallHeading from '../../components/gex/WallHeading';
import BuildingInfo, { BuildingInfoInner } from '../../components/gex/BuildingInfo';
import { BuildingLedgerSkeleton, BuildingPageSkeleton, WallHeadingSkeleton } from '../../components/gex/buildingSkeletons';
import { buildExposureProfile, type StrikeWindow } from '../../data/exposure';
import { aheadClock } from '../../data/ahead';
import { buildBuilding } from '../../data/building';
import { readSessionClock } from '../../data/moc';
import { usePositions } from '../../data/positions';
import type { MarketSnapshot } from '../../types/market';

/** The open interest sweeps on its own cadence — a wall must not vibrate with every tick */
const SCAN_INTERVAL_MS = 10_000;

type BoxKey = 'ledger' | 'heading';
type Scopes = Partial<Record<BoxKey, string>>;
let scopesMemory: Scopes = {};
/* The ledger's choices, held across route changes, reset on reload */
let orderMemory: BuildOrder = 'strike';
let windowMemory: StrikeWindow = 15;
/* The Ledger's default palette, so the two capsule surfaces agree */
let paletteMemory: BuildPalette = 'thermal';

const hhmmss = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

const Building = () => {
  const { marketData, activeTicker, changeTicker } = useMarketData();
  const { focus, toggleFocus, clearFocus } = useFocus();
  const [scopes, setScopesState] = useState<Scopes>(scopesMemory);
  const setScope = (key: BoxKey, t: string | undefined) =>
    setScopesState(prev => {
      const next = { ...prev };
      if (t === undefined) delete next[key];
      else next[key] = t;
      scopesMemory = next;
      return next;
    });
  const [order, setOrderState] = useState<BuildOrder>(orderMemory);
  const [window, setWindowState] = useState<StrikeWindow>(windowMemory);
  const setOrder = (o: BuildOrder) => {
    orderMemory = o;
    setOrderState(o);
  };
  const setWindow = (w: StrikeWindow) => {
    windowMemory = w;
    setWindowState(w);
  };
  const [palette, setPaletteState] = useState<BuildPalette>(paletteMemory);
  const setPalette = (p: BuildPalette) => {
    paletteMemory = p;
    setPaletteState(p);
  };

  /* THE CLOCK — New York time, re-read every 15s; the pace runs on it */
  const [clockRaw, setClockRaw] = useState(() => readSessionClock());
  useEffect(() => {
    const id = globalThis.setInterval(() => setClockRaw(readSessionClock()), 15_000);
    return () => globalThis.clearInterval(id);
  }, []);
  const clock = useMemo(() => aheadClock(clockRaw), [clockRaw]);

  /* Scan-tier snapshot: the open interest sweeps every SCAN_INTERVAL_MS (a name change is immediate) */
  const [scan, setScan] = useState<{ snap: MarketSnapshot; at: string; nonce: number } | null>(null);
  const scanRef = useRef<MarketSnapshot | null>(null);
  const scanAtRef = useRef(0);
  useEffect(() => {
    if (!marketData) return;
    const now = Date.now();
    const due = !scanRef.current || now - scanAtRef.current >= SCAN_INTERVAL_MS || scanRef.current.ticker !== marketData.ticker;
    if (due) {
      scanRef.current = marketData;
      scanAtRef.current = now;
      setScan({ snap: marketData, at: hhmmss(new Date(now)), nonce: now });
    }
  }, [marketData]);

  /* The own-name snapshots, one per name a box has stepped onto */
  const pinnedKey = [scopes.ledger, scopes.heading].filter(Boolean).join('|');
  const ownSnaps = useMemo(() => {
    const m = new Map<string, MarketSnapshot>();
    if (!scan || !pinnedKey) return m;
    for (const t of new Set(pinnedKey.split('|'))) {
      if (t === scan.snap.ticker) continue;
      try {
        m.set(t, Simulator.snapshotFor(t));
      } catch {
        /* a name the sim can't build — the box stays on the frame's */
      }
    }
    return m;
  }, [scan, pinnedKey]);
  const snapFor = (key: BoxKey): MarketSnapshot | null => {
    if (!scan) return null;
    const t = scopes[key];
    if (!t || t === scan.snap.ticker) return scan.snap;
    return ownSnaps.get(t) ?? scan.snap;
  };
  const tickerFor = (key: BoxKey) => scopes[key] ?? activeTicker;
  const focusFor = (t: string) => (focus && focus.ticker === t ? focus.price : null);
  const chipFor = (key: BoxKey, t: string) => (
    <ScopeChip
      ticker={t}
      linked={scopes[key] === undefined}
      quote
      onToggleLink={() => setScope(key, scopes[key] === undefined ? t : undefined)}
      onPick={next => (scopes[key] === undefined ? changeTicker(next) : setScope(key, next))}
    />
  );

  /* THE TWO ANSWERS, each off its box's own name — the whole day's snapshots against the live chain */
  const ledgerSnap = snapFor('ledger');
  const headingSnap = snapFor('heading');
  const nonce = scan?.nonce ?? 0;
  const ledger = useMemo(() => {
    if (!ledgerSnap) return null;
    const t = ledgerSnap.ticker;
    const profile = buildExposureProfile(ledgerSnap, '0DTE', window);
    return buildBuilding(ledgerSnap, Simulator.getGexHistory(t), Simulator.getCandles(t), profile, clock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledgerSnap, window, clock, nonce]);
  const heading = useMemo(() => {
    if (!headingSnap) return null;
    if (ledger && headingSnap.ticker === ledger.ticker && window === 30) return ledger;
    const t = headingSnap.ticker;
    const profile = buildExposureProfile(headingSnap, '0DTE', 30);
    return buildBuilding(headingSnap, Simulator.getGexHistory(t), Simulator.getCandles(t), profile, clock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headingSnap, ledger, window, clock, nonce]);

  /* Your strikes, for the rows — only when the box is on the frame's name */
  const positions = usePositions(activeTicker);
  const yours = useMemo(() => new Set(positions.map(p => p.strike)), [positions]);

  /* Both boxes stand in their own shape while the first read walks in (Noah,
     2026-09-08: a stock skeleton "doesn't take the shape of its container") —
     the same two skeletons the deferred mounts and the route's fallback use,
     so the page never shows a layout it will not keep. */
  const rows = window * 2 + 1;
  if (!scan || !ledger || !heading) return <BuildingPageSkeleton rows={rows} />;

  const ledgerTicker = tickerFor('ledger');
  const headingTicker = tickerFor('heading');

  return (
    <>
      {/* BOX 1 — WHAT'S BEING BUILT */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-build data-scope-ticker={ledgerTicker}>
        <Deferred fallback={<BuildingLedgerSkeleton rows={rows} />} className="animate-fade-in">
          <BuildingLedger
            data={ledger}
            ticker={ledgerTicker}
            clock={clock}
            order={order}
            onOrder={setOrder}
            window={window}
            onWindow={setWindow}
            palette={palette}
            onPalette={setPalette}
            updatedAt={scan.at}
            yours={ledgerTicker === activeTicker ? yours : undefined}
            focus={focusFor(ledgerTicker)}
            onPick={price => toggleFocus(price, ledgerTicker)}
            onClear={clearFocus}
            scope={chipFor('ledger', ledgerTicker)}
          />
        </Deferred>
      </div>

      {/* BOX 2 — WHAT BUILDING MEANS, and the strikes loaded today, as information (2026-09-13) */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-build-info data-scope-ticker={ledgerTicker}>
        <Deferred index={1} fallback={<BuildingInfoInner />} className="animate-fade-in">
          <BuildingInfo data={ledger} ticker={ledgerTicker} clock={clock} focus={focusFor(ledgerTicker)} onPick={price => toggleFocus(price, ledgerTicker)} />
        </Deferred>
      </div>

      {/* BOX 3 — WHERE THE WALLS ARE HEADING */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-heading data-scope-ticker={headingTicker}>
        <Deferred index={2} fallback={<WallHeadingSkeleton />} className="animate-fade-in">
          <WallHeading data={heading} clock={clock} scope={chipFor('heading', headingTicker)} />
        </Deferred>
      </div>
    </>
  );
};

export default Building;
