/*
==================================================
  SLAYER TERMINAL - AHEAD
  (pages/pinpoint/Ahead.tsx)

  The fourth page of Pinpoint (2026-09-06, Noah:
  "whats next… useful things, never seen before
  but needed"). The Map says where the hedging
  sits now, Targets the order to watch it in, the
  Board the same across names. Ahead says what
  happens from here to the close, read top to
  bottom in two boxes:

    THE RANGE        the range price is likely to
                     hold as one ruler — the walls,
                     the flip and the supreme as
                     posts on it, spot as the pill —
                     and under it what dealers must
                     trade in each half hour, as
                     plain bars (drawn simple,
                     2026-09-13: "both the charts
                     are truly unreadable")
    WHERE IT CLOSES  one row per strike, the bar the
                     chance the 4:00 print lands
                     there, the 50% and 80% runs
                     shaded, moving with the clock

  A COMPOSITION, like the Map: the book is the same
  buildExposureProfile the rail reads (today's
  contracts — the close today is a same-day
  question, so there is no expiry picker here; the
  simulator scaled every expiry by one number and
  the control did nothing), the clock is the real
  New York clock the shell prints, the expected
  move is the desk's own ruler, the bell share is
  the Calendar's number. data/ahead.ts holds the
  arithmetic; the corridor and the odds are one
  model — the corridor's band is the middle of the
  odds curve with the expected move's width around
  it. Nothing here forecasts price — it is what
  the strikes make likely.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import Simulator from '../../core/simulator';
import { useMarketData } from '../../context/MarketDataContext';
import { useFocus } from '../../context/FocusContext';
import ScopeChip from '../../components/ui/ScopeChip';
import { Deferred } from '../../components/ui/Skeleton';
import { AheadPageSkeleton, CloseInner, CorridorInner } from './pinpointSkeletons';
import { CloseSimple, RangeSimple } from '../../components/gex/AheadSimple';
import { buildExposureProfile } from '../../data/exposure';
import { aheadClock, buildCloseOdds, buildCorridor, buildSchedule, type VolPoints } from '../../data/ahead';
import { readSessionClock } from '../../data/moc';
import { usePositions } from '../../data/positions';
import type { MarketSnapshot } from '../../types/market';

/** The book sweeps on its own cadence — the odds must not vibrate with every tick */
const SCAN_INTERVAL_MS = 10_000;
/** Thirty strikes each side: the odds read what the close can reach from it, the corridor its walls */
const WINDOW = 30;

/* Each box can hold its own name (the Map's rule): it follows the frame
   until its chip unlinks it. Held across route changes, reset on reload. */
type BoxKey = 'corridor' | 'close';
type Scopes = Partial<Record<BoxKey, string>>;
let scopesMemory: Scopes = {};

const Ahead = () => {
  const { marketData, activeTicker, changeTicker } = useMarketData();
  const { focus, toggleFocus } = useFocus();
  const [scopes, setScopesState] = useState<Scopes>(scopesMemory);
  const setScope = (key: BoxKey, t: string | undefined) =>
    setScopesState(prev => {
      const next = { ...prev };
      if (t === undefined) delete next[key];
      else next[key] = t;
      scopesMemory = next;
      return next;
    });

  /* THE CLOCK — New York time, re-read every 15s; every band moves with it */
  const [clockRaw, setClockRaw] = useState(() => readSessionClock());
  useEffect(() => {
    const id = window.setInterval(() => setClockRaw(readSessionClock()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  const clock = useMemo(() => aheadClock(clockRaw), [clockRaw]);

  /* Scan-tier snapshot: the book sweeps every SCAN_INTERVAL_MS (a name change is immediate) */
  const [scan, setScan] = useState<MarketSnapshot | null>(null);
  const scanRef = useRef<MarketSnapshot | null>(null);
  const scanAtRef = useRef(0);
  useEffect(() => {
    if (!marketData) return;
    const now = Date.now();
    const due = !scanRef.current || now - scanAtRef.current >= SCAN_INTERVAL_MS || scanRef.current.ticker !== marketData.ticker;
    if (due) {
      scanRef.current = marketData;
      scanAtRef.current = now;
      setScan(marketData);
    }
  }, [marketData]);

  /* The own-name snapshots, one per name a box has stepped onto */
  const pinnedKey = [scopes.corridor, scopes.close].filter(Boolean).join('|');
  const ownSnaps = useMemo(() => {
    const m = new Map<string, MarketSnapshot>();
    if (!scan || !pinnedKey) return m;
    for (const t of new Set(pinnedKey.split('|'))) {
      if (t === scan.ticker) continue;
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
    if (!t || t === scan.ticker) return scan;
    return ownSnaps.get(t) ?? scan;
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

  /* THE VOL SCENARIO (2026-09-09) — vanna spoken: a drop of a point by default,
     the usual crush into the close; the card on the range box changes it */
  const [volPoints, setVolPoints] = useState<VolPoints>(-1);

  /* THE TWO ANSWERS, each off its box's own book — today's contracts */
  const corridorSnap = snapFor('corridor');
  const closeSnap = snapFor('close');
  const corridor = useMemo(() => {
    if (!corridorSnap) return null;
    const profile = buildExposureProfile(corridorSnap, '0DTE', WINDOW);
    const iv = Simulator.TICKERS[corridorSnap.ticker]?.iv ?? 0.2;
    return { profile, model: buildCorridor(corridorSnap, profile, iv, clock), schedule: buildSchedule(corridorSnap, profile, clock, volPoints) };
  }, [corridorSnap, clock, volPoints]);
  const close = useMemo(() => {
    if (!closeSnap) return null;
    const profile = buildExposureProfile(closeSnap, '0DTE', WINDOW);
    const iv = Simulator.TICKERS[closeSnap.ticker]?.iv ?? 0.2;
    const c = buildCorridor(closeSnap, profile, iv, clock);
    return { odds: buildCloseOdds(profile, closeSnap.spot, c.sigma, clock), levels: profile.levels };
  }, [closeSnap, clock]);

  /* Your strikes, for the odds rows — only when the box is on the frame's name */
  const positions = usePositions(activeTicker);
  const yours = useMemo(() => new Set(positions.map(p => p.strike)), [positions]);

  /* Both boxes stand in their own shape while the first read walks in (Noah,
     2026-09-08) — the same shapes the route's fallback and the deferred mounts use */
  if (!scan || !corridor || !close) return <AheadPageSkeleton />;

  const corridorTicker = tickerFor('corridor');
  const closeTicker = tickerFor('close');

  return (
    <>
      {/* BOX 1 — THE CORRIDOR, with what dealers must trade under it on the same minutes */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-corridor data-scope-ticker={corridorTicker}>
        <Deferred fallback={<CorridorInner />} className="animate-fade-in">
          <RangeSimple
            corridor={corridor.model}
            schedule={corridor.schedule}
            levels={corridor.profile.levels}
            ticker={corridorTicker}
            clock={clock}
            focus={focusFor(corridorTicker)}
            onPick={price => toggleFocus(price, corridorTicker)}
            scope={chipFor('corridor', corridorTicker)}
            volPoints={volPoints}
            onVolPoints={setVolPoints}
          />
        </Deferred>
      </div>

      {/* BOX 2 — WHERE IT CLOSES */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-close data-scope-ticker={closeTicker}>
        <Deferred index={1} fallback={<CloseInner />} className="animate-fade-in">
          <CloseSimple
            odds={close.odds}
            levels={close.levels}
            spot={closeSnap!.spot}
            ticker={closeTicker}
            clock={clock}
            yours={closeTicker === activeTicker ? yours : undefined}
            focus={focusFor(closeTicker)}
            onPick={price => toggleFocus(price, closeTicker)}
            scope={chipFor('close', closeTicker)}
          />
        </Deferred>
      </div>
    </>
  );
};

export default Ahead;
