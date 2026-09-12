/*
==================================================
  SLAYER TERMINAL - TARGETS, THE AGENDA
  (pages/pinpoint/RankedTargets.tsx)

  Rebuilt 2026-09-08 on the numbers the other pages
  now produce. The page that answers "so what do I
  watch today, in what order?" — two boxes, read top
  to bottom:

    TARGETS        every strike in the order it
                   matters: how likely price gets
                   there × how much happens if it
                   does; the first three side by
                   side, the rest as one list, two
                   actions per strike (chart · alert)
    WHERE THEY SIT the same strikes on the price
                   axis, with the expected move as
                   the ruler

  A COMPOSITION: reach and holds are At the wall's,
  built or drained is Building's, "closes here" is
  Ahead's, the roles are the Map's, the positions
  the overlay's, the alerts the chart's own store.
  data/agenda.ts holds the order, and the Pulse
  Targets panel reads the same one.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Simulator from '../../core/simulator';
import { useMarketData } from '../../context/MarketDataContext';
import { useFocus } from '../../context/FocusContext';
import ScopeChip from '../../components/ui/ScopeChip';
import { Deferred } from '../../components/ui/Skeleton';
import TargetsBoard from '../../components/gex/TargetsBoard';
import TargetsAxis from '../../components/gex/TargetsAxis';
import { TargetsAxisInner, TargetsInner, TargetsPageSkeleton } from '../../components/gex/targetsSkeletons';
import WatchMenu from '../../components/gex/WatchMenu';
import { armPrice, removeAlert, useAlerts } from '../../components/gex/alertStore';
import { buildAgenda, type AgendaOrder, type Target } from '../../data/agenda';
import { buildExposureProfile, type StrikeWindow } from '../../data/exposure';
import { buildExposureSurface, CALENDAR_DTES } from '../../data/exposureSurface';
import { aheadClock } from '../../data/ahead';
import { buildBuilding } from '../../data/building';
import { sessionBars } from '../../data/levelview';
import { readSessionClock } from '../../data/moc';
import { contractWords, usePositions } from '../../data/positions';
import type { MarketSnapshot } from '../../types/market';

/** The order sweeps on its own cadence — an agenda must not reshuffle with every tick */
const SCAN_INTERVAL_MS = 10_000;

type BoxKey = 'list' | 'axis';
type Scopes = Partial<Record<BoxKey, string>>;
let scopesMemory: Scopes = {};
let orderMemory: AgendaOrder = 'matters';
let windowMemory: StrikeWindow = 15;

const hhmmss = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

const RankedTargets = () => {
  const { marketData, activeTicker, changeTicker } = useMarketData();
  const { focus, focusOn, toggleFocus } = useFocus();
  const navigate = useNavigate();
  const [scopes, setScopesState] = useState<Scopes>(scopesMemory);
  const setScope = (key: BoxKey, t: string | undefined) =>
    setScopesState(prev => {
      const next = { ...prev };
      if (t === undefined) delete next[key];
      else next[key] = t;
      scopesMemory = next;
      return next;
    });
  const [order, setOrderState] = useState<AgendaOrder>(orderMemory);
  const setOrder = (o: AgendaOrder) => {
    orderMemory = o;
    setOrderState(o);
  };
  const [window, setWindowState] = useState<StrikeWindow>(windowMemory);
  const setWindow = (w: StrikeWindow) => {
    windowMemory = w;
    setWindowState(w);
  };

  /* THE CLOCK — New York time, re-read every 15s; the reach odds run on it */
  const [clockRaw, setClockRaw] = useState(() => readSessionClock());
  useEffect(() => {
    const id = globalThis.setInterval(() => setClockRaw(readSessionClock()), 15_000);
    return () => globalThis.clearInterval(id);
  }, []);
  const clock = useMemo(() => aheadClock(clockRaw), [clockRaw]);

  /* Scan-tier snapshot: the order sweeps every SCAN_INTERVAL_MS (a name change is immediate) */
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

  const pinnedKey = [scopes.list, scopes.axis].filter(Boolean).join('|');
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

  /* THE AGENDA per name — the same composition At the wall makes, every strike through it */
  const nonce = scan?.nonce ?? 0;
  const agendaFor = (snap: MarketSnapshot | null) => {
    if (!snap) return null;
    const t = snap.ticker;
    const profile = buildExposureProfile(snap, '0DTE', window);
    const building = buildBuilding(snap, Simulator.getGexHistory(t), Simulator.getCandles(t), profile, clock);
    const surface = buildExposureSurface(snap, 30, CALENDAR_DTES);
    const iv = Simulator.TICKERS[t]?.iv ?? 0.2;
    return buildAgenda(snap, profile, building, surface, sessionBars(t) ?? [], clock, iv, order);
  };
  const listSnap = snapFor('list');
  const axisSnap = snapFor('axis');
  const listTicker = tickerFor('list');
  const axisTicker = tickerFor('axis');
  const listAgenda = useMemo(() => agendaFor(listSnap), [listSnap, window, order, clock, nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const axisAgenda = useMemo(() => {
    if (listAgenda && axisSnap && axisSnap.ticker === listSnap?.ticker) return listAgenda;
    return agendaFor(axisSnap);
  }, [axisSnap, listAgenda, window, order, clock, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Your strikes and your alerts on the frame's name */
  const positions = usePositions(activeTicker);
  const yours = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of positions) {
      const w = `${p.side === 'long' ? 'you own' : 'you sold'} ${contractWords(p)}`;
      m.set(p.strike, m.has(p.strike) ? `${m.get(p.strike)} · ${w}` : w);
    }
    return m;
  }, [positions]);
  const alerts = useAlerts(listTicker);
  const armedAt = (strike: number) => alerts.some(a => a.kind === 'price' && Math.abs(a.price - strike) < 1e-9);
  const onAlert = (t: Target) => {
    const armed = alerts.find(a => a.kind === 'price' && Math.abs(a.price - t.strike) < 1e-9);
    if (armed) removeAlert(listTicker, armed.id);
    else if (listAgenda) armPrice(listTicker, t.strike, listAgenda.spot);
  };
  /* THE CHART is the Map's — the strike arrives there already in focus */
  const onChart = (t: Target) => {
    focusOn(t.strike, listTicker);
    navigate('/pinpoint/map');
  };

  /* Both boxes stand in their own shape while the first read walks in */
  if (!scan || !listAgenda || !axisAgenda) return <TargetsPageSkeleton rows={window * 2 - 2} />;

  const levels = buildExposureProfile(listSnap ?? scan.snap, '0DTE', 20).levels;

  return (
    <>
      {/* BOX 1 — TARGETS */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-targets data-scope-ticker={listTicker}>
        <Deferred fallback={<TargetsInner rows={Math.max(0, listAgenda.targets.length - 3)} />} className="animate-fade-in">
          <TargetsBoard
            agenda={listAgenda}
            ticker={listTicker}
            clock={clock}
            order={order}
            onOrder={setOrder}
            window={window}
            onWindow={setWindow}
            updatedAt={scan.at}
            yours={listTicker === activeTicker ? yours : undefined}
            armedAt={armedAt}
            onChart={onChart}
            onAlert={onAlert}
            focus={focusFor(listTicker)}
            onPick={strike => toggleFocus(strike, listTicker)}
            scope={chipFor('list', listTicker)}
            watch={<WatchMenu ticker={listTicker} spot={listAgenda.spot} levels={levels} />}
          />
        </Deferred>
      </div>

      {/* BOX 2 — WHERE THEY SIT */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-targets-axis data-scope-ticker={axisTicker}>
        <Deferred index={1} fallback={<TargetsAxisInner />} className="animate-fade-in">
          <TargetsAxis agenda={axisAgenda} clock={clock} focus={focusFor(axisTicker)} onPick={strike => toggleFocus(strike, axisTicker)} scope={chipFor('axis', axisTicker)} />
        </Deferred>
      </div>
    </>
  );
};

export default RankedTargets;
