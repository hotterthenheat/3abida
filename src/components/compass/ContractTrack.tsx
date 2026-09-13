/*
==================================================
  SLAYER TERMINAL - CONTRACT TRACK (ContractTrack.tsx)
  The setup page's PREMIUM chart: where this contract's
  premium has been (repriced on real bars), what standing
  still costs (theta forward, spot held), what it's worth
  parked at the stop, and every level on the chart in
  premium. Math in trackModel.ts; this file only draws.

  THE HOUSE CHART, round 4 (both Noah, 2026-08-29): the
  tape runs edge to edge and ONE transparent strip rides
  it. Round 5 (the Compass walk, 2026-09-11 — Noah: "i
  dont like the premium chart look and notice how the
  stock → premium button layout changes from being on
  the left side to the right side. it messes the user
  up"): the SAME strip as the stock view, slot for slot —
  the capsule, the Stock/Premium door second, the
  timeframes (the toolbar's own strip), the live mark
  and its change, the expand door at the far right — in
  the same house box, the caller's. The old panel frame,
  its level table (the card beside carries the targets)
  and its footnote are gone; the note rides the whisper.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import SpotPrice from '../gex/SpotPrice';
import { TimeframeStrip } from '../gex/ChartToolbar';
import type { Setup } from '../../types/compass';
import Simulator from '../../core/simulator';
import { tfMinutes, type Timeframe } from '../../data/timeframe';
import { buildSetupTrack, barsToSpan, type TrackLevel } from './trackModel';
import ContractPremiumPane, { type PremiumLevel, type PremiumProjection, type PremiumProjectionApi } from '../gex/ContractPremiumPane';
import ContractPick, { type ConPickRow } from './ContractPick';
import PremiumLevelRail from './PremiumLevelRail';
import { BULL } from '../gex/paletteInk';
import { Name } from '../ui/Name';

const MUTED_INK = 'rgb(var(--text-muted))'; // matches textMuted (the lifted AA value)
const WARN_INK = 'rgb(var(--warn))';
const REF_INK = 'rgb(var(--text-primary))';

/* Targets are ONE family — the stock chart's green (hits bright, the rest
   dimmed), never neon (Noah, 2026-08-29: "tps should not be neon. even on
   the premium chart"). The status distinction rides the label words. */
const LEVEL_INK: Record<TrackLevel['status'], string> = {
  HIT: BULL,
  'IN PROGRESS': BULL,
  PENDING: 'rgba(48,209,88,0.55)',
  STOP: WARN_INK,
  REF: REF_INK,
};

interface ContractTrackProps {
  setup: Setup;
  /** Tick pulse — recomputes the series so the NOW pin follows the live mid. */
  revision: number;
  /** Setup retired (floor broken): the past stays, the future doesn't —
      no theta-forward, no stop curve, no "time left" for a dead case. */
  retired?: boolean;
  /** The Stock/Premium door — mounted in the strip's SECOND slot, where the
      stock view keeps it, so the way back never moves. */
  actions?: React.ReactNode;
  /** Fullscreen takeover — state owned by the setup page (it shares the
      stock view's chartFull, so Esc and the scroll lock come for free). */
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /** Every con this name has on the board (all tenors, sleeve-tagged) —
      with the loader, the capsule becomes a dropdown that steps between
      them, carrying each pick's sleeve through the door. */
  loadPickRows?: () => ConPickRow[];
  onOpenContract?: (
    strike: number,
    right: import('../../types/compass').OptionRight,
    sleeve?: import('../../types/compass').SleeveKey,
    dte?: number
  ) => void;
  /** This view is the one on screen — an untouched frame re-centres on its return */
  active?: boolean;
}

const ContractTrack = ({ setup, revision, retired = false, actions, fullscreen = false, onToggleFullscreen, loadPickRows, onOpenContract, active = true }: ContractTrackProps) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  /* Where the pane puts a premium — the rail beside it reads this in its own frame loop */
  const projectionRef = useRef<PremiumProjectionApi | null>(null);

  /* The chrome's real height, handed to the pane as reserved headroom —
     the strip WRAPS at narrow widths and a target near the top of scale was
     running its label into the timeframe row (Noah, 2026-08-29). Measured,
     not guessed, so the plot starts below the chrome at every size. */
  const tapeRef = useRef<HTMLDivElement | null>(null);
  const chromeRef = useRef<HTMLDivElement | null>(null);
  const [topMargin, setTopMargin] = useState(0.2);
  useEffect(() => {
    const measure = () => {
      const tape = tapeRef.current?.clientHeight ?? 0;
      const chrome = chromeRef.current?.clientHeight ?? 0;
      if (tape > 0 && chrome > 0) setTopMargin(Math.min(0.4, Math.max(0.1, (chrome + 16) / tape)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (tapeRef.current) ro.observe(tapeRef.current);
    if (chromeRef.current) ro.observe(chromeRef.current);
    return () => ro.disconnect();
  }, []);

  const { track, projections } = useMemo(() => {
    void revision;
    const bars = Simulator.getCandles(setup.ticker) ?? [];
    const built = buildSetupTrack(setup, bars);
    /* The modeled futures, restated on the clock: trackModel speaks in
       1-minute bar offsets from NOW; the engine wants timestamps. Thinned to
       the shown timeframe so the projected region keeps the tape's own bar
       spacing — minute points between 5m candles would stretch it 5×. */
    const lastT = bars.length ? bars[bars.length - 1].time : 0;
    const step = Math.max(1, Math.round(tfMinutes(timeframe)));
    const toPts = (pts: { bar: number; premium: number }[]) => {
      const lastBar = pts.length ? pts[pts.length - 1].bar : 0;
      return pts
        .filter(q => q.bar >= 0 && (q.bar % step === 0 || q.bar === lastBar))
        .map(q => ({ time: lastT + q.bar * 60, value: q.premium }));
    };
    const projs: PremiumProjection[] = [];
    if (!retired && lastT) {
      const fwd = toPts(built.forward);
      if (fwd.length >= 2) projs.push({ key: 'forward', color: MUTED_INK, points: fwd });
      if (built.stopCurve) {
        const st = toPts(built.stopCurve);
        if (st.length >= 2) projs.push({ key: 'stop', color: WARN_INK, points: st });
      }
    }
    return { track: built, projections: projs };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup.id, setup.mid, revision, retired, timeframe]);

  const up = track.sessionChangePct >= 0;
  const undocked = track.levels.filter(l => !l.docked);
  const docked = track.levels.filter(l => l.docked);
  const changeAbs = Math.abs((setup.mid * track.sessionChangePct) / 100);

  /* Every rule the model prices, labeled ON the tape — the docked ones stay
     off the plot (their premiums are beyond the shown scale) and keep their
     whisper note. Reference is dotted: it is where you got in, not a target.
     The ink IS the status, and the word rides the label so two greens read
     as states, not a rendering bug (Noah, 2026-08-29). */
  const paneLevels: PremiumLevel[] = undocked.map(l => ({
    price: l.premium,
    label: `${l.label.replace(/^TP(\d)/, 'TARGET $1')} $${l.premium.toFixed(2)}${l.status === 'HIT' ? ' · hit' : l.status === 'IN PROGRESS' ? ' · in progress' : ''}`,
    color: LEVEL_INK[l.status],
    style: l.status === 'REF' ? 'dotted' : 'dashed',
  }));

  return (
    /* The tape region — edge to edge inside the caller's box, chrome floating
       over it — and THE RAIL beside it (2026-09-12): every level as a capsule
       on the premium axis, the Terrain panel's grammar, so TP1–4, the floor
       and the entry read down the side instead of only as rules on the plot. */
    <div className="relative flex-1 min-h-0 flex" data-premium-track>
      <div ref={tapeRef} className="relative flex-1 min-w-0 min-h-0 overflow-hidden">
      <ContractPremiumPane
        ticker={setup.ticker}
        strike={setup.strike}
        right={setup.right}
        tYears={Math.max(setup.sessionsLeft, 0.5) / 252}
        iv={setup.greeks.iv / 100}
        timeframe={timeframe}
        revision={revision}
        levels={paneLevels}
        projections={projections}
        topMargin={topMargin}
        projectionRef={projectionRef}
        visible={active}
      />

      {/* ONE strip + its whisper — the stock view's slots: the capsule, the
          Stock/Premium door, the timeframes, then the live mark; the expand
          door at the far right. pr-14/pr-16 keep the right edge off the
          price axis. Transparent — each control carries its own pill. */}
      <div ref={chromeRef} className="absolute top-0 inset-x-0 z-20" data-chart-chrome>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-2 pr-14 py-1 select-none">
          {loadPickRows && onOpenContract ? (
            <ContractPick label={`${setup.contract} · ${setup.expiry}`} current={{ strike: setup.strike, right: setup.right, sleeve: setup.sleeve }} loadRows={loadPickRows} onPick={onOpenContract} />
          ) : (
            <span className="inline-flex items-center h-7 px-3 rounded-full bg-ink/[0.06] font-mono text-[11px] font-bold text-textPrimary shrink-0">
              {setup.contract} · {setup.expiry}
            </span>
          )}
          {actions}
          <TimeframeStrip value={timeframe} onChange={setTimeframe} />
          <span className="inline-flex items-center gap-2 pl-1">
            <SpotPrice value={setup.mid} />
            <span className={`font-mono text-[11px] font-semibold tnum ${up ? 'text-bull' : 'text-bear'}`}>
              {up ? '▲' : '▼'} ${changeAbs.toFixed(2)} ({up ? '+' : '−'}
              {Math.abs(track.sessionChangePct).toFixed(1)}%)
            </span>
          </span>
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen chart'}
              className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[10px] uppercase tracking-wider text-textMuted hover:text-textPrimary hover:bg-ink/[0.03] transition-colors"
              data-premium-full
            >
              {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* The whispers — the clock left, the off-scale rules and the modeled note right */}
        <div className="pl-3 pr-16 flex items-baseline justify-between gap-3 pointer-events-none">
          <span className="font-mono text-[10px] text-textMuted">
            the contract's premium over {barsToSpan(track.pastMinutes)} · reference ${track.ref.toFixed(2)} · {retired ? 'setup retired' : `${barsToSpan(track.forwardMinutes)} left`} · modeled from <Name t={setup.ticker} size={10} />
            's bars, not a traded tape
          </span>
          {docked.length > 0 && (
            <span className="font-mono text-[10px] text-textMuted tnum text-right">
              Off scale ↑ {docked.map(l => `${l.label.replace(/^TP(\d)/, 'Target $1')} $${l.premium.toFixed(2)}`).join(' · ')}
            </span>
          )}
        </div>
      </div>
      </div>
      {/* The rail — hidden where the card is too narrow to share (below md) */}
      <PremiumLevelRail levels={track.levels} projection={projectionRef} retired={retired} className="hidden md:block" />
    </div>
  );
};

export default ContractTrack;
