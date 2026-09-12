/*
==================================================
  SLAYER TERMINAL - COMPARE
  (pages/pinpoint/Compare.tsx)

  The seventh page of Pinpoint (2026-09-08, Noah:
  "a compare page of 2 different stocks/tickers in
  multiple ways you see fit"). Two names, three
  boxes, read top to bottom:

    HEAD TO HEAD    the same ten reads for both,
                    side by side, the middle saying
                    what they say against each other
    ONE RULER       both books at their distance
                    from their own spot — one grows
                    left, the other right
    SINCE THE OPEN  today's session, both names as
                    one line each of percent from
                    their own open, the gap beneath

  A COMPOSITION: the reads are the Board's, Ahead's
  and Targets'; the ruler is the desk's; the lines
  are the chart library's. The first name follows
  the frame (or holds its own); the second is the
  page's, opening on the index twin. Each name's
  chip sits at the head of its own column, and the
  two sides keep that order in every box.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Simulator from '../../core/simulator';
import { useMarketData } from '../../context/MarketDataContext';
import { useFocus } from '../../context/FocusContext';
import ScopeChip from '../../components/ui/ScopeChip';
import { Deferred } from '../../components/ui/Skeleton';
import GuideFocus from '../../components/ui/GuideFocus';
import HeadToHead from '../../components/gex/HeadToHead';
import CompareAxis from '../../components/gex/CompareAxis';
import { nextGreekPick, pickGreeks } from '../../components/gex/exposureView';
import CompareTapes from '../../components/gex/CompareTapes';
import ComparePair from '../../components/gex/ComparePair';
import CompareGuide from '../../components/gex/CompareGuide';
import { CompareAxisInner, ComparePageSkeleton, ComparePairInner, CompareTapesInner, HeadToHeadInner } from '../../components/gex/compareSkeletons';
import { aheadClock } from '../../data/ahead';
import { buildCompare, buildCompareSide, partnerFor, type Greek, type Reach } from '../../data/compare';
import { useDistanceUnit } from '../../data/distanceUnits';
import { readSessionClock } from '../../data/moc';
import type { MarketSnapshot } from '../../types/market';
import type { ExposureExpiry } from '../../types/gex';

/** The reads sweep on their own cadence — a comparison must not vibrate with every tick */
const SCAN_INTERVAL_MS = 10_000;
/** The two names' inks on the lines: the frame's name in the house white, the second in the first comparison ink (Terrain's set) */
const A_INK = 'rgb(var(--text-primary))';
const B_INK = '#5B9CF6';

const hhmmss = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

/* The first name follows the frame until its chip holds one; the second is
   the page's own, remembered across route changes within a session */
let aMemory: string | undefined;
let bMemory: string | null = null;

const Compare = () => {
  const { marketData, activeTicker, changeTicker } = useMarketData();
  const { focus, toggleFocus } = useFocus();
  const unit = useDistanceUnit();
  const [aScope, setAScopeState] = useState<string | undefined>(aMemory);
  const setAScope = (t: string | undefined) => {
    aMemory = t;
    setAScopeState(t);
  };
  const aTicker = aScope ?? activeTicker;
  const [bState, setBState] = useState<string | null>(bMemory);
  const setB = (t: string) => {
    bMemory = t;
    setBState(t);
  };
  /* Never the same name twice: a change that lands the two on one name moves the second to its partner */
  const bTicker = bState && bState !== aTicker ? bState : partnerFor(aTicker);

  /* THE CLOCK — New York time, re-read every 15s; the expected move runs on it */
  const [clockRaw, setClockRaw] = useState(() => readSessionClock());
  useEffect(() => {
    const id = globalThis.setInterval(() => setClockRaw(readSessionClock()), 15_000);
    return () => globalThis.clearInterval(id);
  }, []);
  const clock = useMemo(() => aheadClock(clockRaw), [clockRaw]);

  /* Scan-tier snapshot: the reads sweep every SCAN_INTERVAL_MS (a name change is immediate) */
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
  const nonce = scan?.nonce ?? 0;

  /* The chart folds in the newest bar on every tick — the same counter Terrain keeps */
  const revRef = useRef(0);
  const revision = useMemo(() => ++revRef.current, [marketData]);

  /* The two snapshots: the frame's own when the first name follows it, else a pure read of the simulator */
  const snapOf = (t: string): MarketSnapshot | null => {
    if (scan && scan.snap.ticker === t) return scan.snap;
    try {
      return Simulator.snapshotFor(t);
    } catch {
      return null;
    }
  };
  /* Which contracts both books weigh — the Map's Expiry card, on the ruler's
     head (Noah, 2026-09-10: "missing some top buttons") */
  const [expiry, setExpiry] = useState<ExposureExpiry>('0DTE');
  const sideA = useMemo(() => {
    const s = snapOf(aTicker);
    return s ? buildCompareSide(s, clock, expiry) : null;
  }, [aTicker, clock, nonce, expiry]); // eslint-disable-line react-hooks/exhaustive-deps
  const sideB = useMemo(() => {
    const s = snapOf(bTicker);
    return s ? buildCompareSide(s, clock, expiry) : null;
  }, [bTicker, clock, nonce, expiry]); // eslint-disable-line react-hooks/exhaustive-deps
  const cmp = useMemo(() => (sideA && sideB ? buildCompare(sideA, sideB, clock) : null), [sideA, sideB, clock]);

  const [guideOpen, setGuideOpen] = useState(false);
  /* How far the ruler runs — three expected moves on the taller drawing (2026-09-09: "cover more of the capsules") */
  const [reach, setReach] = useState<Reach>('three');
  /* The capsules' ramp — the calendar's Colours card, thermal by default (Noah,
     2026-09-10: "the house color vs thermal color button") */
  const [palette, setPalette] = useState<'thermal' | 'house'>('thermal');
  /* ONE GREEK PER PAGE, the Map's rule: the ruler, the reach sums and the Supreme
     row follow it — "All" shows the five lanes (narrow on the page, the screen in fullscreen) and leaves the
     card's Supreme row on gamma */
  /* THE GREEKS ARE A PICK (Noah, 2026-09-10: "choose the amount of greeks they
     want to compare and not handicap them to 1 or 4") — the lanes drawn are
     the greeks ticked; the reach sums and the Supreme row follow the first */
  const [greekPick, setGreekPick] = useState<string[]>(['gex']);
  const greeks = useMemo(() => pickGreeks(greekPick), [greekPick]);
  const greek: Greek = greeks[0] ?? 'gex';
  /* THE RULER FULLSCREEN (Noah, 2026-09-09): the same box moved to the whole
     viewport, the Map's way — one body, one drawing, nothing remounts. Esc
     brings it back. */
  const [rulerFull, setRulerFull] = useState(false);
  useEffect(() => {
    if (!rulerFull) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRulerFull(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [rulerFull]);
  const focusFor = (t: string) => (focus && focus.ticker === t ? focus.price : null);
  const focusA = focusFor(aTicker);
  const focusB = focusFor(bTicker);
  const onPick = (strike: number, t: string) => toggleFocus(strike, t);

  /* The two chips wear the same clothes (Noah, 2026-09-09): the first in the
     full following look with its silver link, the second its own name with no
     link at all — it cannot follow the frame, that would make it the first. */
  const chipA = (
    <ScopeChip
      ticker={aTicker}
      linked={aScope === undefined}
      full
      quote
      onToggleLink={() => setAScope(aScope === undefined ? aTicker : undefined)}
      onPick={next => (aScope === undefined ? changeTicker(next) : setAScope(next))}
    />
  );
  const chipB = <ScopeChip ticker={bTicker} quote onPick={next => setB(next)} title="The second name — pick another" />;
  const onSwap = () => {
    const a = aTicker;
    const b = bTicker;
    if (aScope === undefined) changeTicker(b);
    else setAScope(b);
    setB(a);
  };

  if (!scan || !cmp) return <ComparePageSkeleton />;

  return (
    <>
      {/* BOX 1 — HEAD TO HEAD */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-compare-h2h data-a={aTicker} data-b={bTicker}>
        <Deferred fallback={<HeadToHeadInner />} className="animate-fade-in">
          <HeadToHead cmp={cmp} unit={unit} greek={greek} chipA={chipA} chipB={chipB} onSwap={onSwap} updatedAt={scan.at} focusA={focusA} focusB={focusB} onPick={onPick} />
        </Deferred>
      </div>

      {/* BOX 2 — THE TWO BOOKS ON ONE RULER (the same box, moved to the viewport in fullscreen) */}
      <motion.div
        layout
        transition={{ layout: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}
        /* the page's own ground when full, not the box's panel grey (Noah, 2026-09-10: "ashy/gray") */
        className={rulerFull ? 'fixed inset-0 z-[80] bg-canvas flex flex-col' : 'relative border border-borderSubtle rounded-md bg-panel'}
        data-compare-ruler
        data-full={rulerFull || undefined}
      >
        <Deferred index={1} fallback={<CompareAxisInner />} className={rulerFull ? 'flex-1 min-h-0 flex flex-col' : 'animate-fade-in'}>
          <CompareAxis cmp={cmp} unit={unit} reach={reach} onReach={setReach} greeks={greeks} greekPick={greekPick} onGreekPick={v => setGreekPick(nextGreekPick(greekPick, v))} expiry={expiry} onExpiry={setExpiry} palette={palette} onPalette={setPalette} focusA={focusA} focusB={focusB} onPick={onPick} onGuide={() => setGuideOpen(v => !v)} guideOpen={guideOpen} full={rulerFull} onFull={setRulerFull} />
        </Deferred>
        <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read this page" testId="compare-guide" viewport>
          <CompareGuide cmp={cmp} />
        </GuideFocus>
      </motion.div>

      {/* BOX 3 — SINCE THE OPEN: today's two lines, the same for both, and the gap under them */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-compare-tapes>
        <Deferred index={2} fallback={<CompareTapesInner />} className="animate-fade-in">
          <CompareTapes a={aTicker} b={bTicker} aInk={A_INK} bInk={B_INK} revision={revision} />
        </Deferred>
      </div>

      {/* BOX 4 — THE PAIR: is today's gap usual, session by session */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-compare-pair-box>
        <Deferred index={3} fallback={<ComparePairInner />} className="animate-fade-in">
          <ComparePair a={aTicker} b={bTicker} aInk={A_INK} bInk={B_INK} nonce={nonce} />
        </Deferred>
      </div>
    </>
  );
};

export default Compare;
