/*
==================================================
  SLAYER TERMINAL - WORKSPACE STRIKE PRESSURE LADDER
  The heatmap widget's successor (Mo, 2026-08-19).
  Each copy on the desk keeps its own expiry, strike
  range and instrument lens, so one panel can watch
  same-day gamma while the panel beside it watches
  OPEX on the same name.

  It rebuilds from ctx.snapshot rather than reading
  ctx.exposure, because ctx.exposure is the desk's
  view (0DTE, ±10) and this panel is allowed to
  disagree with it. No 1s pulse: the old heatmap
  "breathed" on a cosmetic modulation — a ladder
  moves only when the book does.
==================================================
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Minimize2 } from 'lucide-react';
import StrikePressureLadder from '../../components/gex/StrikePressureLadder';
import BookRead, { ReadDoor } from '../../components/gex/BookRead';
import { buildExposureSurface } from '../../data/exposureSurface';
import KeyLevelsWidget from './KeyLevelsWidget';
import { useFadeClose } from '../../components/ui/useFadeClose';
import { buildExposureProfile, type StrikeWindow } from '../../data/exposure';
import { readHeatPattern } from '../../data/gex';
import { netSinceOpenRatio } from '../../data/levelview';
import { twinFamilyFor, twinLabel, twinPrice, twinBasis, fmtTwin, type TwinLensKey } from '../../data/indexTwins';
/* The card's expiries, ranges and pattern strip (components/gex/ladderControls.tsx).
   The controls themselves are labelled dropdown cards — one thin line, the
   approved grammar (Noah, 2026-09-08: the desk's chip rows were outdated). */
import { ladderExpiryOptions, LADDER_RANGES as RANGES, LadderPatternStrip } from '../../components/gex/ladderControls';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import { HEAT_MODE, type HeatMode } from '../../components/gex/heatmap';
import type { ExposureExpiry } from '../../types/gex';
import type { WorkspaceCtx } from './registry';

const VIEW_OPTIONS: DropdownOption<'ladder' | 'levels'>[] = [
  { value: 'ladder', label: 'Ladder', hint: 'Every strike a row — put and call hedging as bars' },
  { value: 'levels', label: 'Levels', hint: 'The walls, the pin, the flip and the supreme at a glance' },
];
/* Spelled as dates on the market calendar (Noah, 2026-09-08: "it just says 1d 2d 3d") */
const EXPIRY_OPTIONS: DropdownOption<ExposureExpiry>[] = ladderExpiryOptions();
const RANGE_OPTIONS: DropdownOption<number>[] = RANGES.map(r => ({ value: r, label: `${r} each side`, hint: r === 30 ? 'The whole book' : `${r} strikes above spot and ${r} below` }));
/** The bars' inks — the house ramp or the thermal one, the same two the Ledger and Building offer */
type LadderPalette = 'house' | 'thermal';
const PALETTE_OPTIONS: DropdownOption<LadderPalette>[] = [
  { value: 'house', label: 'House', hint: 'Gold where hedging amplifies, ice where it absorbs' },
  { value: 'thermal', label: 'Thermal', hint: 'Yellow in the middle, red where hedging amplifies a move, blue where it absorbs one' },
];
const modeFor = (p: LadderPalette): HeatMode => (p === 'thermal' ? 'thermal-yellow' : HEAT_MODE);

const StrikeLadderWidget = ({ ctx }: { ctx: WorkspaceCtx }) => {
  /* The LEVELS VIEW (Noah, 2026-08-26: Key Levels "doesnt have enough
     information to be a stand alone") — the walls, flip, pin and supreme ARE
     this ladder's executive summary, computed from the same book, so the
     card that owns the detail now owns the summary as a second view. */
  const [view, setView] = useState<'ladder' | 'levels'>('ladder');
  const [expiry, setExpiry] = useState<ExposureExpiry>('0DTE');
  const [range, setRange] = useState<StrikeWindow>(10);
  /* The instrument lens (Noah, 2026-08-18): on index families the strikes,
     the pattern read and the basis chip re-denominate — SPY · SPX · ES. */
  const [lens, setLens] = useState<TwinLensKey>('etf');
  const [palette, setPalette] = useState<LadderPalette>('house');
  const [full, setFull] = useState(false);
  /* THE READ (2026-09-12, components/gex/BookRead.tsx) — the same glass card
     the Map's book carries, over this ladder: the whole book behind the tile's
     expiry, built only while the card is up. A kept strike is the desk
     chart's focus. */
  const [readOpen, setReadOpen] = useState(false);
  const pointedRef = useRef<((strike: number | null) => void) | null>(null);
  const subscribePointed = useCallback((fn: (strike: number | null) => void) => {
    pointedRef.current = fn;
    return () => {
      if (pointedRef.current === fn) pointedRef.current = null;
    };
  }, []);
  const fam = twinFamilyFor(ctx.ticker);
  const activeLens: TwinLensKey = fam ? lens : 'etf';
  const { closing, close } = useFadeClose(() => setFull(false));

  // Same takeover contract as the chart: Esc exits (fading), page scroll
  // locks under it.
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [full, close]);

  /* THE ONE FULLSCREEN BUTTON is the tile head's (Noah, 2026-09-12: "2
     different full screen buttons... only the top one stays"): the desk hands
     this panel a one-shot token and it lifts its own fullscreen — the pickers'
     state survives, which the tile takeover (a remount) would not give. Up,
     the panel's own button is the way back beside Esc. */
  useEffect(() => {
    if (ctx.fullOpen) setFull(true);
  }, [ctx.fullOpen]);

  // Scan-tier: ctx.snapshot is the desk's 10s reference, so the ladder holds
  // still between sweeps and re-reads at once on a name change.
  const data = useMemo(() => {
    try {
      return buildExposureProfile(ctx.snapshot, expiry, range);
    } catch {
      return null;
    }
  }, [ctx.snapshot, expiry, range]);
  /* the book behind the read — the whole calendar at the tile's window, only while the card is up */
  const readSurface = useMemo(() => {
    if (!readOpen) return null;
    try {
      return buildExposureSurface(ctx.snapshot, range);
    } catch {
      return null;
    }
  }, [readOpen, ctx.snapshot, range]);

  // The engine names the book's configuration — the strip above the ladder
  // is its voice. Under a lens the levels convert FIRST, so the read prints
  // the instrument's prices.
  const pattern = useMemo(() => {
    if (!data) return null;
    const { levels } = data;
    if (!fam || activeLens === 'etf') return readHeatPattern(levels);
    const c = (v: number) => twinPrice(fam, activeLens, v, levels.spot);
    return readHeatPattern({
      spot: c(levels.spot),
      flip: c(levels.flip),
      callWall: c(levels.callWall),
      putWall: c(levels.putWall),
      supreme: c(levels.supreme),
    });
  }, [data, fam, activeLens]);

  // The ghost spine's data — net at the open vs now, per strike — on the
  // same scan clock as the ladder.
  const openRatio = useMemo(
    () => netSinceOpenRatio(ctx.ticker),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx.snapshot, ctx.ticker]
  );

  // Strike column in the lens's terms — the ladder itself stays the ETF book.
  const strikeFormat = useMemo(() => {
    if (!fam || activeLens === 'etf' || !data) return undefined;
    const spot = data.levels.spot;
    return (s: number) => fmtTwin(twinPrice(fam, activeLens, s, spot));
  }, [fam, activeLens, data]);

  const body = (
    <div className="h-full min-h-0 flex flex-col">
      {/* Controls sit in the body — the header is the drag handle. */}
      <div className="shrink-0 px-2 py-1.5 border-b border-borderSubtle/60 flex items-center gap-2 flex-wrap">
        {full && (
          <button
            onClick={close}
            className="group inline-flex items-center gap-1.5 border border-borderSubtle hover:border-borderMuted rounded-md px-2.5 py-1 font-mono text-[10px] text-textSecondary hover:text-textPrimary transition-colors"
          >
            <ArrowLeft className="w-3 h-3 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" /> Back
          </button>
        )}
        <DropdownSelect label="View" value={view} options={VIEW_OPTIONS} onChange={setView} title="What the card shows" testId="ladder-view" />
        {/* The ladder's own controls only steer the ladder — the Levels view
            carries its own instrument lens inside. */}
        {view === 'ladder' && (
          <>
            <DropdownSelect label="Expiry" value={expiry} options={EXPIRY_OPTIONS} onChange={setExpiry} title="Which contracts the ladder weighs" testId="ladder-expiry" />
            <DropdownSelect label="Strikes" value={range} options={RANGE_OPTIONS} onChange={v => setRange(v as StrikeWindow)} title="How many strikes around spot" testId="ladder-strikes" />
            <DropdownSelect label="Colours" value={palette} options={PALETTE_OPTIONS} onChange={setPalette} title="What the bars' colours mean" testId="ladder-colours" />
            {fam && (
              <>
                <DropdownSelect
                  label="Prices in"
                  value={activeLens}
                  options={(['etf', 'index', 'futures'] as TwinLensKey[]).map(k => ({ value: k, label: twinLabel(fam, k) }))}
                  onChange={setLens}
                  title="The instrument the strikes are priced in"
                  testId="ladder-instrument"
                />
                {data && (
                  <span className="font-mono text-[9px] text-textMuted tnum whitespace-nowrap">
                    {fam.futures} {fmtTwin(twinPrice(fam, 'futures', data.levels.spot, data.levels.spot))} · +
                    {fmtTwin(twinBasis(fam, data.levels.spot))} over {fam.index}
                  </span>
                )}
              </>
            )}
          </>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5">
          {view === 'ladder' && <ReadDoor open={readOpen} onClick={() => setReadOpen(v => !v)} />}
          {full && (
            <button onClick={close} title="Exit fullscreen (Esc)" className="shrink-0 p-1 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors">
              <Minimize2 className="w-3 h-3" />
            </button>
          )}
        </span>
      </div>
      {/* The pattern strip — what the ladder below actually says. The Levels
          view speaks for itself (its regime line is the same voice). */}
      {view === 'ladder' && pattern && <LadderPatternStrip pattern={pattern} />}
      <div className="relative flex-1 min-h-0">
        {view === 'levels' ? (
          <KeyLevelsWidget ctx={ctx} />
        ) : data ? (
          <StrikePressureLadder data={data} strikeFormat={strikeFormat} openRatio={openRatio} mode={modeFor(palette)} fill onPointer={strike => pointedRef.current?.(strike)} />
        ) : (
          <div className="h-full grid place-items-center font-mono text-[11px] text-textMuted">
            No exposure for {ctx.ticker}
          </div>
        )}
        {/* THE READ — glass over the right of the ladder, in GEX, the ladder's greek */}
        {readOpen && view === 'ladder' && readSurface && (
          <BookRead
            surface={readSurface}
            snapshot={ctx.snapshot}
            greek="gex"
            mode={modeFor(palette)}
            depth={expiry === '0DTE' ? 1 : 99}
            afterBell={false}
            rings={range}
            selectedStrike={ctx.focusPrice ?? null}
            subscribePointed={subscribePointed}
            onKeep={ctx.focusStrike}
            onClose={() => setReadOpen(false)}
          />
        )}
      </div>
    </div>
  );

  // Portal, not a plain fixed div: react-grid-layout positions panels with CSS
  // transforms, and a transformed ancestor becomes the containing block for
  // position:fixed — so an in-place overlay would size itself to the widget
  // instead of the viewport. Escaping to <body> is the only way out.
  return full
    ? createPortal(
        <div
          className={`fixed inset-0 z-[80] bg-canvas p-3 flex flex-col animate-soft-in transition-opacity duration-200 ease-out ${
            closing ? 'opacity-0' : ''
          }`}
        >
          <div className="flex-1 min-h-0 border border-borderSubtle bg-panel rounded-lg overflow-hidden">{body}</div>
        </div>,
        document.body
      )
    : body;
};

export default StrikeLadderWidget;
