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

  THE MAP'S LADDER, IN A TILE (Noah, 2026-09-22: "change
  the strike pressure ladder on the pulse page to be
  thermal by default and to match the formatting of the
  pinpoint map page which it takes you to"): the ladder
  view IS ExposureLadder, the Map's own — the read row,
  the lane's head, the rows with their legs and figures,
  the foot — on GEX, through the tile's expiry and its
  strikes; THERMAL, with no Colours card on the tile (so
  The read keeps its place on the line — the Map it
  opens carries the switch). The expiry reads that
  one column of the book (the calendar's own), "Every
  expiry" all of them. The pattern strip went with the
  old ladder: the Map carries none, the read row says
  the strike and The read says the book.
==================================================
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Minimize2 } from 'lucide-react';
import ExposureLadder from '../../components/gex/ExposureLadder';
import { type LedgerPalette } from '../../components/gex/ColoursSwitch';
import BookRead, { ReadDoor } from '../../components/gex/BookRead';
import { buildExposureSurface, CALENDAR_DTES } from '../../data/exposureSurface';
import KeyLevelsWidget from './KeyLevelsWidget';
import { useFadeClose } from '../../components/ui/useFadeClose';
import { type StrikeWindow } from '../../data/exposure';
import { expiryFor } from '../../core/calendar';
import { twinFamilyFor, twinLabel, twinPrice, twinBasis, fmtTwin, type TwinLensKey } from '../../data/indexTwins';
/* The card's expiries, ranges and pattern strip (components/gex/ladderControls.tsx).
   The controls themselves are labelled dropdown cards — one thin line, the
   approved grammar (Noah, 2026-09-08: the desk's chip rows were outdated). */
import { ladderExpiryOptions, LADDER_RANGES as RANGES } from '../../components/gex/ladderControls';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import ExpiryCard, { type ExpiryChoice } from '../../components/ui/ExpiryCard';
import { HEAT_MODE, type HeatMode } from '../../components/gex/heatmap';
import type { ExposureExpiry } from '../../types/gex';
import type { WorkspaceCtx } from './registry';

const VIEW_OPTIONS: DropdownOption<'ladder' | 'levels'>[] = [
  { value: 'ladder', label: 'Ladder', hint: 'Every strike a row — put and call hedging as bars' },
  { value: 'levels', label: 'Levels', hint: 'The walls, the pin, the flip and the supreme at a glance' },
];
/* Spelled as dates on the market calendar (Noah, 2026-09-08: "it just says 1d 2d 3d") */
const EXPIRY_OPTIONS: ExpiryChoice<ExposureExpiry>[] = ladderExpiryOptions();
const RANGE_OPTIONS: DropdownOption<number>[] = RANGES.map(r => ({ value: r, label: `${r} each side`, hint: r === 30 ? 'The whole book' : `${r} strikes above spot and ${r} below` }));
/** The bars' inks — the house ramp or the thermal one, the Map's two */
const modeFor = (p: LedgerPalette): HeatMode => (p === 'thermal' ? 'thermal-yellow' : HEAT_MODE);
/** GEX alone — the tile's one greek, a stable array */
const GEX_ONLY = ['gex'] as const;

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
  /* THERMAL, and no switch on the card (Noah, 2026-09-22: "remove the ability to change the colours so 'the read'
     doesn't get pushed off") — the Map it opens carries the switch */
  const palette: LedgerPalette = 'thermal';
  const [full, setFull] = useState(false);
  /* THE READ (2026-09-12, components/gex/BookRead.tsx) — the same glass card
     the Map's book carries, over this ladder: the whole book behind the tile's
     expiry, built only while the card is up. A kept strike is the desk
     chart's focus. */
  const [readOpen, setReadOpen] = useState(false);
  /* THE KEPT STRIKE IS THE TILE'S (Noah, 2026-09-22: "when i click a strike it jumps me out and throws me into a…
     chart with a focused strike, i don't like that" — "it should just be the regular focus in line"): a click keeps
     the strike in this ladder, the Map's own focus (the row sharp, the rest blurred, "click off to let go"), and the
     desk's chart is never told. The read keeps into the same place. */
  const [kept, setKept] = useState<number | null>(null);
  const keep = useCallback((strike: number) => setKept(k => (k != null && Math.abs(k - strike) < 1e-9 ? null : strike)), []);
  /* THE BAR KNOWS ITS ROOM (the Map's band rule): named while the row holds everything, then the cards bare, then The
     read as its icon — The read never falls to a second line (Noah, 2026-09-22) */
  const barRO = useRef<ResizeObserver | null>(null);
  const [barW, setBarW] = useState(0);
  const barRef = useCallback((el: HTMLDivElement | null) => {
    barRO.current?.disconnect();
    barRO.current = null;
    if (!el) return;
    setBarW(Math.round(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(entries => setBarW(Math.round(entries[0].contentRect.width)));
    ro.observe(el);
    barRO.current = ro;
  }, []);
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
  // still between sweeps and re-reads at once on a name change. THE BOOK is the
  // Map's — the whole calendar, every strike — and the tile's picks are views of it.
  const surface = useMemo(() => {
    try {
      return buildExposureSurface(ctx.snapshot, 30, CALENDAR_DTES);
    } catch {
      return null;
    }
  }, [ctx.snapshot]);
  /* THE TILE'S EXPIRY, as the book's column: the expiry on that day (the nearest the book holds), or every one */
  const expiries = useMemo(() => {
    if (!surface) return [];
    if (expiry === 'ALL') return surface.expiries.map((_, i) => i);
    const want = EXPIRY_OPTIONS.find(o => o.value === expiry)?.date?.getTime();
    if (want == null) return [0];
    let best = 0;
    surface.expiries.forEach((e, i) => {
      const d = Math.abs(expiryFor(e.dte).date.getTime() - want);
      if (d < Math.abs(expiryFor(surface.expiries[best].dte).date.getTime() - want)) best = i;
    });
    return [best];
  }, [surface, expiry]);

  // Strike column in the lens's terms — the ladder itself stays the ETF book.
  const strikeFormat = useMemo(() => {
    if (!fam || activeLens === 'etf' || !surface) return undefined;
    const spot = surface.spot;
    return (s: number) => fmtTwin(twinPrice(fam, activeLens, s, spot));
  }, [fam, activeLens, surface]);

  /* the bar's need, measured with a family's Prices in card (SPY): named ~700px, bare ~540, bare with The read as its
     icon ~470; a name with no lens needs less and stays named longer */
  const need = fam ? { named: 700, bare: 540 } : { named: 580, bare: 440 };
  const barMode: 'named' | 'bare' | 'tight' = barW === 0 || barW >= need.named ? 'named' : barW >= need.bare ? 'bare' : 'tight';
  const barBare = barMode !== 'named';
  const body = (
    <div className="h-full min-h-0 flex flex-col">
      {/* Controls sit in the body — the header is the drag handle. */}
      <div ref={barRef} className="shrink-0 px-2 py-1.5 border-b border-borderSubtle/60 flex items-center gap-2 flex-wrap" data-ladder-bar-mode={barMode}>
        {full && (
          <button
            onClick={close}
            className="group inline-flex items-center gap-1.5 border border-borderSubtle hover:border-borderMuted rounded-md px-2.5 py-1 font-mono text-[11px] text-textSecondary hover:text-textPrimary transition-colors"
          >
            <ArrowLeft className="w-3 h-3 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" /> Back
          </button>
        )}
        <DropdownSelect label="View" value={view} options={VIEW_OPTIONS} onChange={setView} title="What the card shows" testId="ladder-view" bare={barBare} />
        {/* The ladder's own controls only steer the ladder — the Levels view
            carries its own instrument lens inside. */}
        {view === 'ladder' && (
          <>
            <ExpiryCard label="Expiry" value={expiry} choices={EXPIRY_OPTIONS} onChange={setExpiry} title="Which contracts the ladder weighs" testId="ladder-expiry" bare={barBare} />
            <DropdownSelect label="Strikes" value={range} options={RANGE_OPTIONS} onChange={v => setRange(v as StrikeWindow)} title="How many strikes around spot" testId="ladder-strikes" bare={barBare} />
            {fam && (
              <>
                {/* the futures' level and its basis ride IN the card now — as the choices' hints — so the line keeps room for
                    The read (2026-09-22); it used to be a note after the card */}
                <DropdownSelect
                  label="Prices in"
                  value={activeLens}
                  options={(['etf', 'index', 'futures'] as TwinLensKey[]).map(k => ({
                    value: k,
                    label: twinLabel(fam, k),
                    hint: surface ? `${fmtTwin(twinPrice(fam, k, surface.spot, surface.spot))}${k === 'futures' ? ` · +${fmtTwin(twinBasis(fam, surface.spot))} over ${fam.index}` : ''}` : undefined,
                  }))}
                  onChange={setLens}
                  title="The instrument the strikes are priced in"
                  testId="ladder-instrument"
                  bare={barBare}
                />
              </>
            )}
          </>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5">
          {view === 'ladder' && <ReadDoor open={readOpen} onClick={() => setReadOpen(v => !v)} compact={barMode === 'tight'} />}
          {full && (
            <button onClick={close} title="Exit fullscreen (Esc)" className="shrink-0 p-1 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors">
              <Minimize2 className="w-3 h-3" />
            </button>
          )}
        </span>
      </div>
      <div className="relative flex-1 min-h-0">
        {view === 'levels' ? (
          <KeyLevelsWidget ctx={ctx} />
        ) : surface ? (
          <ExposureLadder
            surface={surface}
            liveSpot={ctx.liveSpot ?? ctx.snapshot.spot}
            greeks={GEX_ONLY as unknown as ('gex')[]}
            expiries={expiries}
            rings={range}
            palette={palette}
            selectedStrike={kept}
            onPointer={cell => pointedRef.current?.(cell?.strike ?? null)}
            onSelectStrike={keep}
            strikeFormat={strikeFormat}
            /* a tile shows its whole window at its default size: the rows may go to 10px (the Map keeps its 18); a tile
               made smaller scrolls, opening on spot */
            rowMin={10}
          />
        ) : (
          <div className="h-full grid place-items-center font-mono text-[11px] text-textMuted">
            No exposure for {ctx.ticker}
          </div>
        )}
        {/* THE READ — glass over the right of the ladder, in GEX, the ladder's greek */}
        {readOpen && view === 'ladder' && surface && (
          <BookRead
            surface={surface}
            snapshot={ctx.snapshot}
            greek="gex"
            mode={modeFor(palette)}
            expiries={expiries}
            afterBell={false}
            rings={range}
            selectedStrike={kept}
            subscribePointed={subscribePointed}
            onKeep={keep}
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
