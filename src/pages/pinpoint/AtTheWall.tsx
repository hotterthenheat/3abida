/*
==================================================
  SLAYER TERMINAL - AT THE WALL
  (pages/pinpoint/AtTheWall.tsx)

  The sixth page of Pinpoint (2026-09-08). The Map
  names the walls; this says whether one holds when
  price gets there, and what happens either way —
  two boxes, read top to bottom:

    AT THE WALL    one wall: the odds it is reached,
                   the odds it holds, the six reasons
                   with their pushes, the two paths
    EVERY WALL     the same for every wall on the
                   strikes shown, nearest first

  A COMPOSITION: the walls and their hedging are the
  Map's, the day's build is Building's, the expiry
  share is the Calendar's, the tests are the report
  card's rule, the expected move is Ahead's, the
  paths are the hedge-flow ladder's and the air-
  pocket engine's. data/wall.ts holds the model.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import Simulator from '../../core/simulator';
import { useMarketData } from '../../context/MarketDataContext';
import { useFocus } from '../../context/FocusContext';
import ScopeChip from '../../components/ui/ScopeChip';
import { Deferred } from '../../components/ui/Skeleton';
import AtTheWallBand from '../../components/gex/AtTheWall';
import WallBoard from '../../components/gex/WallBoard';
import { AtTheWallInner, boardH, WallBoardInner, WallPageSkeleton } from '../../components/gex/wallSkeletons';
import { buildExposureProfile } from '../../data/exposure';
import { buildExposureSurface, CALENDAR_DTES } from '../../data/exposureSurface';
import { aheadClock } from '../../data/ahead';
import { buildBuilding } from '../../data/building';
import { buildWallBoard } from '../../data/wall';
import { sessionBars } from '../../data/levelview';
import { readSessionClock } from '../../data/moc';
import type { MarketSnapshot } from '../../types/market';

/** The odds sweep on their own cadence — a wall must not vibrate with every tick */
const SCAN_INTERVAL_MS = 10_000;
/** Thirty strikes each side: the whole book */
const WINDOW = 30;

type BoxKey = 'wall' | 'board';
type Scopes = Partial<Record<BoxKey, string>>;
let scopesMemory: Scopes = {};

const hhmmss = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

const AtTheWall = () => {
  const { marketData, activeTicker, changeTicker } = useMarketData();
  const { focus, focusOn, toggleFocus } = useFocus();
  const [scopes, setScopesState] = useState<Scopes>(scopesMemory);
  const setScope = (key: BoxKey, t: string | undefined) =>
    setScopesState(prev => {
      const next = { ...prev };
      if (t === undefined) delete next[key];
      else next[key] = t;
      scopesMemory = next;
      return next;
    });

  /* THE CLOCK — New York time, re-read every 15s; the reach odds run on it */
  const [clockRaw, setClockRaw] = useState(() => readSessionClock());
  useEffect(() => {
    const id = globalThis.setInterval(() => setClockRaw(readSessionClock()), 15_000);
    return () => globalThis.clearInterval(id);
  }, []);
  const clock = useMemo(() => aheadClock(clockRaw), [clockRaw]);

  /* Scan-tier snapshot: the odds sweep every SCAN_INTERVAL_MS (a name change is immediate) */
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

  const pinnedKey = [scopes.wall, scopes.board].filter(Boolean).join('|');
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

  /* THE BOARD per name — the wall box reads the focus, the board box lists all */
  const nonce = scan?.nonce ?? 0;
  const boardFor = (snap: MarketSnapshot | null, focusStrike: number | null) => {
    if (!snap) return null;
    const t = snap.ticker;
    const profile = buildExposureProfile(snap, '0DTE', WINDOW);
    const building = buildBuilding(snap, Simulator.getGexHistory(t), Simulator.getCandles(t), profile, clock);
    const surface = buildExposureSurface(snap, WINDOW, CALENDAR_DTES);
    const iv = Simulator.TICKERS[t]?.iv ?? 0.2;
    return buildWallBoard(snap, profile, building, surface, sessionBars(t) ?? [], clock, iv, focusStrike);
  };
  const wallSnap = snapFor('wall');
  const boardSnap = snapFor('board');
  const wallTicker = tickerFor('wall');
  const boardTicker = tickerFor('board');
  const wallFocus = focusFor(wallTicker);
  const wallBoard = useMemo(() => boardFor(wallSnap, wallFocus), [wallSnap, wallFocus, clock, nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const boardBoard = useMemo(() => {
    if (wallBoard && boardSnap && boardSnap.ticker === wallSnap?.ticker) return wallBoard;
    return boardFor(boardSnap, null);
  }, [boardSnap, wallBoard, clock, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Both boxes stand in their own shape while the first read walks in */
  if (!scan || !wallBoard || !boardBoard) return <WallPageSkeleton />;

  return (
    <>
      {/* BOX 1 — AT THE WALL */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-wall data-scope-ticker={wallTicker}>
        <Deferred fallback={<AtTheWallInner />} className="animate-fade-in">
          <AtTheWallBand board={wallBoard} ticker={wallTicker} clock={clock} onPick={strike => focusOn(strike, wallTicker)} updatedAt={scan.at} scope={chipFor('wall', wallTicker)} />
        </Deferred>
      </div>

      {/* BOX 2 — EVERY WALL: a box of its own height, the rows sharing it (Noah,
          2026-09-09) — capped at the five-wall row (Noah, 2026-09-10: "cap it
          at 64"), so fewer walls make a shorter box, not taller rows */}
      <div className="border border-borderSubtle rounded-md bg-panel flex flex-col" style={{ height: boardH(boardBoard.walls.length) }} data-wall-every data-scope-ticker={boardTicker}>
        <Deferred index={1} fallback={<WallBoardInner rows={boardBoard.walls.length || 8} />} className="h-full min-h-0 flex flex-col animate-fade-in">
          <WallBoard board={boardBoard} clock={clock} focus={focusFor(boardTicker)} onPick={strike => toggleFocus(strike, boardTicker)} scope={chipFor('board', boardTicker)} />
        </Deferred>
      </div>
    </>
  );
};

export default AtTheWall;
