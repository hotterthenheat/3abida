/*
==================================================
  SLAYER TERMINAL - THE TERRAIN PANEL
  (components/gex/TerrainPanel.tsx)

  The strike panel beside a Terrain chart, redrawn
  (Noah, 2026-09-12: "the side strike panel should
  be deleted because the current design should
  look more a bit like this" — two photos). Two
  faces on one panel, a tab apart:

  THE LADDER — the Strike Pressure Ladder, the
  desk's own: every strike a row, put and call
  hedging as bars from a centre line with the
  figures riding their ends, net, open interest,
  volume and the part the strike plays; the spine
  contour over the bars, its ghost at the open;
  the spot and the flip as pills centred on their
  rules; one hover card. It folds as the pane
  narrows — four charts up, the net, OI and volume
  go and the bars stay ("depending if someone has
  4 charts or 1 you can remove the net old volume
  and xyz") — and it never shrinks into slivers.

  THE NET STRIP — the second photo, drawn by
  components/gex/NetStrip.tsx (shared with the
  Pinpoint board since 2026-09-13): one figure per
  strike, the chosen greek's net, the tiny dashed
  put/call bar, the tags, the rules, the hover card
  with its sparkline over the CHART'S OWN TIMEFRAME
  ("make sure it syncs with whatever time frame the
  person has their chart on"). GEX, DEX, VEX, vanna
  and charm interchange on one card.

  IT NEVER BECOMES BLOBS. The strip counts the rows
  its height can hold at a readable pitch and shows
  THAT many, the nearest to spot, with the rest
  counted at the edges — a small panel shows fewer
  strikes, not smaller ones. The width is clamped
  between a floor the columns can live at and a
  share of the pane, on a grip at the left edge.

  Nothing here re-measures per tick: the profile is
  rebuilt on the desk's revision, the rows are
  keyed by strike, and a timeframe change swaps the
  series without touching the layout — no jitter.
==================================================
*/

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { X } from 'lucide-react';
import Simulator from '../../core/simulator';
import { buildExposureProfile, type StrikeWindow } from '../../data/exposure';
import { netSinceOpenRatio } from '../../data/levelview';
import type { Timeframe } from '../../data/timeframe';
import { GREEK_OPTIONS } from '../../data/compare';
import StrikePressureLadder from './StrikePressureLadder';
import NetStrip, { type PanelGreek } from './NetStrip';
import { ladderExpiryOptions, LADDER_RANGES } from './ladderControls';
import CardTabs from '../ui/CardTabs';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import type { ExposureExpiry } from '../../types/gex';
import { Name } from '../ui/Name';

export type PanelMode = 'ladder' | 'strip';
export type { PanelGreek };

/** The narrowest the panel is drawn — the strip's two columns, the ladder's strike and bars */
export const PANEL_MIN_W = 240;
/** A fresh pane's panel — the ladder with its figures, the strip with room for its bars */
export const PANEL_DEFAULT_W = 400;
/** The widest — a share of the pane, so the panel can never swallow its own chart */
export const PANEL_MAX_SHARE = 0.6;
/** THE DEFAULT FOLLOWS THE DESK (Noah, 2026-09-12: "depending if someone has
    4 charts or 1"): one chart carries the whole ladder, two carry the bars
    with their figures, three or four carry the strike and the bars — the
    chart keeps most of its pane whatever the count. */
export const panelDefaultW = (paneCount: number): number => (paneCount <= 1 ? PANEL_DEFAULT_W : paneCount === 2 ? 340 : 280);

const MODE_OPTIONS = [
  { value: 'ladder', label: 'Ladder' },
  { value: 'strip', label: 'Net' },
] as const;
const GREEK_DROP: DropdownOption<PanelGreek>[] = GREEK_OPTIONS.map(g => ({ value: g.value, label: g.label, hint: g.hint }));
const RANGE_OPTIONS: DropdownOption<StrikeWindow>[] = LADDER_RANGES.map(r => ({ value: r, label: `${r} each side`, hint: r === 30 ? 'The whole book' : `${r} strikes above spot and ${r} below` }));

/* ---- the panel ---------------------------------------------------------------------- */

interface TerrainPanelProps {
  ticker: string;
  /** The desk's scan clock — the profile and the series rebuild on it */
  revision: number;
  /** The chart's timeframe beside this panel — the strip's window */
  timeframe: Timeframe;
  mode: PanelMode;
  onMode: (m: PanelMode) => void;
  greek: PanelGreek;
  onGreek: (g: PanelGreek) => void;
  expiry: ExposureExpiry;
  onExpiry: (e: ExposureExpiry) => void;
  range: StrikeWindow;
  onRange: (r: StrikeWindow) => void;
  /** Drawn at this width, with a grip on the left edge reporting the new width on release; 0 = a share of the pane */
  width: number;
  onWidth: (px: number) => void;
  onClose: () => void;
  closeHint?: string;
  focusPrice?: number | null;
  onSelect?: (price: number) => void;
  className?: string;
}

const TerrainPanel = ({ ticker, revision, timeframe, mode, onMode, greek, onGreek, expiry, onExpiry, range, onRange, width, onWidth, onClose, closeHint = 'Hide this panel', focusPrice, onSelect, className = '' }: TerrainPanelProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sym = useMemo(() => Simulator.ensureTicker(ticker), [ticker]);
  const snapshot = useMemo(() => Simulator.snapshotFor(ticker), [ticker, revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const profile = useMemo(() => {
    try {
      return buildExposureProfile(snapshot, expiry, range);
    } catch {
      return null;
    }
  }, [snapshot, expiry, range]);
  const openRatio = useMemo(() => netSinceOpenRatio(ticker), [ticker, revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const expiryOptions = useMemo(() => ladderExpiryOptions(), []);

  /* THE GRIP — the ProfilePanel's: local while held, committed on release,
     the ceiling re-applied on every render so a panel widened in the
     fullscreen pane cannot swallow its chart when the pane collapses */
  const [dragW, setDragW] = useState<number | null>(null);
  const [hostW, setHostW] = useState(0);
  useEffect(() => {
    const host = rootRef.current?.parentElement;
    if (!host) return;
    setHostW(host.getBoundingClientRect().width);
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setHostW(e.contentRect.width);
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);
  const maxW = hostW > 0 ? Math.max(PANEL_MIN_W, Math.round(hostW * PANEL_MAX_SHARE)) : Number.POSITIVE_INFINITY;
  /* No width set (a fresh pane): a share of the pane's REAL width, floored
     at the columns' minimum and capped at the whole ladder — three charts on
     a laptop get the narrow rail, one chart on a wide screen the full one */
  const autoW = hostW > 0 ? Math.round(Math.max(PANEL_MIN_W, Math.min(PANEL_DEFAULT_W, hostW * 0.38))) : width > 0 ? width : PANEL_MIN_W;
  const shownW = Math.max(PANEL_MIN_W, Math.min(dragW ?? (width > 0 ? width : autoW), maxW));
  const onGripDown = (e: ReactPointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const root = rootRef.current;
    if (!root) return;
    const startX = e.clientX;
    const startW = root.getBoundingClientRect().width;
    const host = root.parentElement?.getBoundingClientRect().width ?? startW * 3;
    const max = Math.max(PANEL_MIN_W, Math.round(host * PANEL_MAX_SHARE));
    let last = startW;
    const move = (ev: PointerEvent) => {
      last = Math.round(Math.min(max, Math.max(PANEL_MIN_W, startW + (startX - ev.clientX))));
      setDragW(last);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      setDragW(null);
      onWidth(last);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };

  const roomy = shownW >= 440;
  const mid = shownW >= 340;

  return (
    <div
      ref={rootRef}
      className={`relative shrink-0 flex flex-col border-l border-borderSubtle bg-panel/40 select-none ${className}`}
      style={{ width: shownW }}
      data-terrain-panel={mode}
      data-panel-greek={greek}
      aria-label={`${ticker} strikes`}
    >
      <span
        onPointerDown={onGripDown}
        onDoubleClick={() => onWidth(PANEL_DEFAULT_W)}
        role="separator"
        aria-orientation="vertical"
        aria-label="Drag to resize the panel — double-click to reset"
        title="Drag to resize · double-click to reset"
        className="absolute left-0 inset-y-0 -ml-1 w-2 z-30 cursor-col-resize hover:bg-ink/[0.10] transition-colors"
        data-panel-grip
      />
      {/* THE HEAD — the two faces, the strip's greek, the ladder's expiry and window, the way out */}
      <div className="shrink-0 flex items-center gap-2 px-2 min-h-9 py-1 border-b border-borderSubtle flex-wrap" data-panel-head>
        <CardTabs options={MODE_OPTIONS} value={mode} onChange={onMode} ariaLabel="Panel face" />
        {mode === 'strip' && <DropdownSelect label="Greek" value={greek} options={GREEK_DROP} onChange={onGreek} title="What the strip measures" testId="panel-greek" />}
        {mid && <DropdownSelect label="Expiry" value={expiry} options={expiryOptions} onChange={onExpiry} title="Which contracts the panel weighs" testId="panel-expiry" />}
        {roomy && <DropdownSelect label="Strikes" value={range} options={RANGE_OPTIONS} onChange={onRange} title="How many strikes around spot" testId="panel-strikes" />}
        <button
          type="button"
          onClick={onClose}
          title={closeHint}
          aria-label={closeHint}
          className="ml-auto inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors"
          data-panel-close
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {profile ? (
        mode === 'ladder' ? (
          <div className="flex-1 min-h-0 flex flex-col" data-panel-ladder>
            <StrikePressureLadder data={profile} openRatio={openRatio} fill onPointer={() => undefined} />
          </div>
        ) : (
          <NetStrip sym={sym} profile={profile} greek={greek} timeframe={timeframe} revision={revision} width={shownW} focusPrice={focusPrice} onSelect={onSelect} />
        )
      ) : (
        <div className="flex-1 grid place-items-center font-mono text-[11px] text-textSecondary"><span>No exposure for <Name t={ticker} size={12} /></span></div>
      )}
    </div>
  );
};

export default TerrainPanel;
