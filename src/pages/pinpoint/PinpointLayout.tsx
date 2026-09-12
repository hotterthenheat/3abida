import { Suspense, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { PinpointPageSkeleton } from './pinpointSkeletons';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, X } from 'lucide-react';
import { useMarketData } from '../../context/MarketDataContext';
import { useFocus } from '../../context/FocusContext';
import Simulator from '../../core/simulator';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import SessionClock from '../../components/ui/SessionClock';
import ScrollHome from '../../components/layout/ScrollHome';
import Term from '../../components/ui/Term';
import { REGIME_WORDS, buildFlipGauge } from '../../data/flipGauge';
import { fmtDistance, impliedDaySigma, sessionAtr, type DistanceScales, type DistanceUnit } from '../../data/atr';
import { setDistanceUnit, useDistanceUnit } from '../../data/distanceUnits';
import { readSessionClock } from '../../data/moc';
import { FLIP, LONG_GAMMA, SHORT_GAMMA } from '../../components/gex/paletteInk';
import { GEX_SUBPAGES } from './subnav';

/*
==================================================
  SLAYER TERMINAL - PINPOINT SHELL (PinpointLayout)

  Band 1 of the roadmap (2026-09-05, the blank
  canvas): ONE HEAD of chrome, and nothing under it
  but the page. Where am I — the page's name and its
  one line — then what the market is doing, read
  the way every box on Pinpoint reads its facts:
  a label over a value.

  THE LOCK WALK (Noah, 2026-09-09: "this header has
  really been bothering me the entire time for the
  whole pinpoint page. doesnt even look like a header
  and the info in it makes me go '???'"): the row of
  loose words — "SHORT GAMMA · flip 494.50 · $1.25
  overhead · crossed 32× · 2h 19m to the close ·
  $ % ATR σ" — became the house head. The page's
  icon and name over its line on the left; on the
  right the same facts LABELLED so each says what it
  is (Dealers · amplifying moves; Flip · 494.50,
  $1.25 above spot; Flip crossed today · 32 times;
  To the close · 2h 19m), and the ruler as a labelled
  card like every other control on Pinpoint. The
  focus chip stays on the title row.

  THE CLOCK IS THE REAL ONE — New York time, the
  same clock the top bar shows — because "to the
  close" is a promise about the exchange, not about
  the simulator's replayed day.
==================================================
*/

const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const fmt = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

/** "2h 14m" from seconds — the close is a promise in minutes, not seconds */
const untilBell = (secondsToClose: number) => {
  const h = Math.floor(secondsToClose / 3600);
  const m = Math.floor((secondsToClose % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};

/** Which way dealers are hedging, in words — the same pair the Map's sentence uses */
const DEALER_WORDS = { SHORT: 'amplifying moves', LONG: 'absorbing moves' } as const;

/** The desk's ruler: the unit every distance on Pinpoint is read in */
const RULER_OPTIONS: DropdownOption<DistanceUnit>[] = [
  { value: '$', label: '$', hint: 'Dollars from spot' },
  { value: '%', label: '%', hint: 'Percent of spot' },
  { value: 'ATR', label: 'ATR', hint: 'Average true ranges — the same distance on SPY and on NVDA' },
  { value: 'σ', label: 'σ', hint: 'Expected one-day moves — how many the options price in' },
];

const Fact = ({ label, children, title, testId }: { label: string; children: React.ReactNode; title?: string; testId?: string }) => (
  <div className="min-w-0" data-shell-fact={testId}>
    <dt className="text-[10px] text-textMuted whitespace-nowrap">{label}</dt>
    <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" title={title}>
      {children}
    </dd>
  </div>
);

const PinpointLayout = () => {
  const { activeTicker, marketData, flowTape } = useMarketData();
  const { focus, clearFocus } = useFocus();
  /* Alerts are watched by the app shell on every page now (components/alerts/AlertWatcher.tsx, 2026-09-10) */
  const location = useLocation();
  const navigate = useNavigate();
  const outlet = useOutlet();

  /* THE SHARED STRIKE, worn by the shell: one chip every tab shares — the
     strike, its distance from spot, the door to the chart, and the one place
     to let it go. It belongs to the name the desk is on. */
  const focused = focus && focus.ticker === activeTicker ? focus.price : null;
  const spot = marketData?.spot;
  const dist = focused != null && spot ? ((focused - spot) / spot) * 100 : null;

  /* WHICH SIDE OF THE FLIP the market is on and how far the flip is, in the
     desk's own ruler. Rebuilt per tick: it is a proximity read and the build
     is under a millisecond. */
  const gauge = useMemo(() => (marketData ? buildFlipGauge(marketData) : null), [marketData]);
  const unit = useDistanceUnit();
  const scales = useMemo<DistanceScales>(() => {
    if (!marketData) return { atr: null, sigma: null };
    return {
      atr: sessionAtr(Simulator.getCandles(marketData.ticker) ?? []),
      sigma: impliedDaySigma(marketData.spot, Simulator.TICKERS[marketData.ticker]?.iv ?? 0),
    };
  }, [marketData]);
  const words = gauge?.regime ? REGIME_WORDS[gauge.regime] : null;
  const flipDist = gauge && gauge.distAbs !== null ? Math.abs(gauge.distAbs) : null;
  const flipLead =
    gauge && flipDist !== null ? (unit === '%' ? `${Math.abs(gauge.distPct!).toFixed(2)}%` : fmtDistance(flipDist, gauge.spot, unit, scales).replace(/^[+−]/, '')) : '';
  /* Which page this is — its name, its icon and one line, from the registry the sidebar reads */
  const page = GEX_SUBPAGES.find(p => location.pathname.startsWith(p.path)) ?? GEX_SUBPAGES[0];
  const PageIcon = page.icon;

  /* THE CLOCK TO THE CLOSE — New York time, re-read every 15s */
  const [clock, setClock] = useState(() => readSessionClock());
  useEffect(() => {
    const id = window.setInterval(() => setClock(readSessionClock()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  const open = clock.phase === 'OPEN' || clock.phase === 'AUCTION';

  return (
    <>
      {/* THE HEAD. The page on the left, the facts and the ruler on the right;
          `flex-wrap` so a narrow window stacks the two instead of pushing the
          ruler off the edge — at desk width it is one band. */}
      {/* THE FRAME OWNS THE SUBJECT AND THE PAGES (direction B, 2026-09-05): the
          sidebar carries the ticker and the Map · Ahead · … choice, so this head
          no longer repeats them. It names the page and reads the market. */}
      <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" data-shell>
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-2.5" data-shell-page>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-borderSubtle text-textSecondary shrink-0" aria-hidden="true">
              <PageIcon className="w-3.5 h-3.5" />
            </span>
            <h1 className="text-[15px] font-semibold leading-tight text-textPrimary">{page.label}</h1>
            {focused != null && (
              <span data-focus-chip className="inline-flex items-center gap-2 rounded-md border border-silver/40 bg-silver/[0.06] pl-2.5 pr-1 py-0.5 font-mono">
                <span className="text-[9px] font-bold uppercase tracking-widest text-silver">Focus</span>
                <span className="text-[12px] font-semibold tnum text-textPrimary">{fmtStrike(focused)}</span>
                {dist != null && (
                  <span className={`text-[9px] tnum ${dist > 0 ? 'text-bull' : dist < 0 ? 'text-bear' : 'text-textMuted'}`}>
                    {dist > 0 ? '+' : ''}
                    {dist.toFixed(2)}%
                  </span>
                )}
                <button
                  /* `from`: leaving the chart's fullscreen brings the reader back here (Noah, 2026-09-09) */
                  onClick={() => navigate('/pulse', { state: { focusPrice: focused, ticker: activeTicker, from: location.pathname } })}
                  title="See this strike on the chart"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06] transition-colors"
                >
                  Chart <ArrowUpRight className="w-3 h-3" />
                </button>
                <button onClick={clearFocus} aria-label="Let go of the strike" className="p-0.5 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">{page.subtitle}</p>
        </div>

        <div className="flex items-center gap-6 flex-wrap">
          {/* THE FACTS, each named: which way dealers hedge, the flip and how far, how often it was crossed, the clock */}
          {gauge && (
            <dl className="grid grid-flow-col auto-cols-max gap-x-6" data-shell-facts>
              {words && gauge.regime ? (
                <>
                  <Fact label="Dealers" title={words.blurb} testId="dealers">
                    <span style={{ color: gauge.regime === 'SHORT' ? SHORT_GAMMA : LONG_GAMMA }}>{DEALER_WORDS[gauge.regime]}</span>
                  </Fact>
                  <Fact label="Flip" testId="flip">
                    <Term k="Gamma flip">
                      <span className="font-semibold" style={{ color: FLIP }}>
                        {fmt(gauge.flip!)}
                      </span>
                    </Term>
                    {flipLead && (
                      <span className="text-textSecondary">
                        {' '}
                        · <span className={gauge.distAbs! > 0 ? 'text-bull' : 'text-bear'}>{flipLead}</span> {gauge.distAbs! > 0 ? 'above' : 'below'} spot
                      </span>
                    )}
                  </Fact>
                  {gauge.crossings !== null && (
                    <Fact label="Flip crossed today" testId="crossed">
                      {gauge.crossings === 0 ? <span className="text-textSecondary">not yet</span> : `${gauge.crossings} ${gauge.crossings === 1 ? 'time' : 'times'}`}
                    </Fact>
                  )}
                </>
              ) : (
                <Fact label="Flip" testId="flip">
                  <span className="text-textSecondary">none — dealers lean one way at every strike</span>
                </Fact>
              )}
              <Fact label={open ? 'To the close' : 'Market'} title={clock.label} testId="close">
                {/* The house clock icon, running: New York on its hands (Noah, 2026-09-09: "some spice… a moving icon clock") */}
                <span className="inline-flex items-center gap-1.5">
                  <SessionClock className="text-textMuted" />
                  <span>{open ? untilBell(clock.secondsToClose) : clock.label.toLowerCase()}</span>
                </span>
              </Fact>
            </dl>
          )}
          <DropdownSelect label="Ruler" value={unit} options={RULER_OPTIONS} onChange={setDistanceUnit} title="The unit every distance on Pinpoint is read in" testId="ruler" align="end" />
        </div>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          /* THE DESK OWNS ITS FIRST SCREEN: top bar 56 + the shell's padding
             and its head ≈ 164. Short pages stretch to a full first screen;
             the footer starts below the fold. */
          className="flex flex-col gap-4 flex-grow min-h-[calc(100vh-174px)]"
        >
          {/* A subpage opens at its head, not where the last one's scroll was (2026-09-11) */}
          <ScrollHome />
          {/* A page's code travels on its first visit; it stands in as ITS OWN
              shape under a shell head that stays put (pinpointSkeletons.tsx) */}
          <Suspense fallback={<PinpointPageSkeleton pathname={location.pathname} />}>{outlet}</Suspense>
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default PinpointLayout;
