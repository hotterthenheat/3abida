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
    WHERE THE WALLS      the four levels at the open,
    ARE HEADING          now, and by the close at
                         today's pace, with the
                         strike growing fastest on
                         each side
    DEALERS THROUGH      the book's net GEX and price's
    THE SESSION          distance from the flip, minute
                         by minute (2026-10-10)

  A COMPOSITION, like Ahead: the open interest is
  the one every snapshot carries, the units are the
  chain's own at the live spot, the levels are the
  Map's, the clock is the shell's. data/building.ts
  holds the arithmetic.
==================================================
*/

import { useMemo, useState } from 'react';
import Simulator from '../../core/simulator';
import { useActiveTicker } from '../../context/MarketDataContext';
import { useFocus } from '../../context/FocusContext';
import { Deferred } from '../../components/ui/Skeleton';
import BuildingLedger, { type BuildOrder, type BuildShow } from '../../components/gex/BuildingLedger';
import WallHeading from '../../components/gex/WallHeading';
import OiChange from '../../components/levels/OiChange';
import DealerTimeline from '../../components/levels/DealerTimeline';
import { dealerTimeline } from '../../data/dealerTimeline';
import { BuildingLedgerSkeleton, BuildingPageSkeleton, WallHeadingSkeleton } from '../../components/gex/buildingSkeletons';
import { fmtDistance, impliedDaySigma, sessionAtr } from '../../data/atr';
import { useDistanceUnit } from '../../data/distanceUnits';
import { usePositions } from '../../data/positions';
import { bookOf } from '../../data/pinpointBook';
import { oiChangeByStrike } from '../../data/oiChange';
import { stampOf, useBookClock, useBoxes, useFrameScan, useRoomWindow } from './usePinpoint';

type BoxKey = 'ledger' | 'heading' | 'oi' | 'timeline';
/* The ledger's choices, held across route changes, reset on reload */
let orderMemory: BuildOrder = 'strike';
/* The movers alone by default — the steady strikes fold away (2026-09-13) */
let showMemory: BuildShow = 'moved';

const Building = () => {
  const activeTicker = useActiveTicker();
  const { toggleFocus, clearFocus } = useFocus();
  const [order, setOrderState] = useState<BuildOrder>(orderMemory);
  /* THE STRIKES — the room's one window (usePinpoint.tsx): which rows are drawn, never what they say */
  const [window, setWindow] = useRoomWindow();
  const setOrder = (o: BuildOrder) => {
    orderMemory = o;
    setOrderState(o);
  };
  const [show, setShowState] = useState<BuildShow>(showMemory);
  const setShow = (s: BuildShow) => {
    showMemory = s;
    setShowState(s);
  };
  /* THE DISTANCE FROM SPOT under every strike, in the shell's own ruler */
  const unit = useDistanceUnit();

  /* THE CLOCK — New York time, re-read every 15s; the pace runs on it */
  const clock = useBookClock();
  /* The room's scan: the open interest sweeps every ten seconds, the same snapshot every page reads */
  const scan = useFrameScan();
  const { snapFor, tickerFor, chipFor, focusFor } = useBoxes<BoxKey>('building', scan);

  /* THE ANSWERS, each off its box's own name — the one book every page reads (data/pinpointBook.ts): the whole
     chain, so the walls' heading and the rows are the same day's arithmetic whatever the window */
  const ledgerSnap = snapFor('ledger');
  const headingSnap = snapFor('heading');
  const oiSnap = snapFor('oi');
  const ledger = useMemo(() => (ledgerSnap ? bookOf(ledgerSnap, clock).building : null), [ledgerSnap, clock]);
  const heading = useMemo(() => (headingSnap ? bookOf(headingSnap, clock).building : null), [headingSnap, clock]);
  const oi = useMemo(() => (oiSnap ? oiChangeByStrike(oiSnap.ticker, oiSnap.spot) : null), [oiSnap]);
  /* the session's book minute by minute — re-read on the room's scan, so the line grows every ten seconds */
  const timelineSnap = snapFor('timeline');
  const timeline = useMemo(() => (timelineSnap ? dealerTimeline(timelineSnap.ticker) : null), [timelineSnap]);

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
  const oiTicker = tickerFor('oi');
  const timelineTicker = tickerFor('timeline');
  const scales = { atr: sessionAtr(Simulator.getCandles(ledger.ticker) ?? []), sigma: impliedDaySigma(ledger.spot, Simulator.TICKERS[ledger.ticker]?.iv ?? 0) };
  const distanceOf = (strike: number) => fmtDistance(strike - ledger.spot, ledger.spot, unit, scales);

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
            show={show}
            onShow={setShow}
            distanceOf={distanceOf}
            updatedAt={stampOf(scan.at)}
            yours={ledgerTicker === activeTicker ? yours : undefined}
            focus={focusFor(ledgerTicker)}
            onPick={price => toggleFocus(price, ledgerTicker)}
            onClear={clearFocus}
            scope={chipFor('ledger', ledgerTicker)}
          />
        </Deferred>
      </div>

      {/* BOX 2 — WHERE THE WALLS ARE HEADING */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-heading data-scope-ticker={headingTicker}>
        <Deferred index={1} fallback={<WallHeadingSkeleton />} className="animate-fade-in">
          <WallHeading data={heading} clock={clock} scope={chipFor('heading', headingTicker)} />
        </Deferred>
      </div>

      {/* BOX 3 — OPEN INTEREST BY STRIKE, the last close against the close before (the ideas' 6, 2026-10-09) */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-oi-change data-scope-ticker={oiTicker}>
        <Deferred index={2} fallback={<div className="h-[320px]" aria-busy="true" />} className="animate-fade-in">
          <OiChange data={oi} ticker={oiTicker} window={window} focus={focusFor(oiTicker)} onPick={price => toggleFocus(price, oiTicker)} scope={chipFor('oi', oiTicker)} />
        </Deferred>
      </div>

      {/* BOX 4 — DEALERS THROUGH THE SESSION, net GEX and the flip's distance minute by minute (the ideas' 2, 2026-10-10) */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-timeline data-scope-ticker={timelineTicker}>
        <Deferred index={3} fallback={<div className="h-[260px]" aria-busy="true" />} className="animate-fade-in">
          <DealerTimeline data={timeline} ticker={timelineTicker} scope={chipFor('timeline', timelineTicker)} />
        </Deferred>
      </div>
    </>
  );
};

export default Building;
