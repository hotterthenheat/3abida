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

    THE CORRIDOR     the range price is likely to
                     hold, bent by the walls, and
                     under it on the same minutes
                     what dealers must trade in
                     each half hour left
    WHERE IT CLOSES  the odds for the 4:00 print as
                     one silhouette on the range's
                     own price axis, the bands it
                     most often lands inside, moving
                     with the clock (redrawn
                     2026-09-09)

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

import { useMemo, useState } from 'react';
import { useActiveTicker } from '../../context/MarketDataContext';
import { useFocus } from '../../context/FocusContext';
import { Deferred } from '../../components/ui/Skeleton';
import { AheadPageSkeleton, CloseInner, CorridorInner } from './pinpointSkeletons';
import AheadCorridor from '../../components/gex/AheadCorridor';
import CloseOdds from '../../components/gex/CloseOdds';
import { type VolPoints } from '../../data/ahead';
import { bookOf, closeOddsOf, corridorOf, scheduleOf } from '../../data/pinpointBook';
import { usePositions } from '../../data/positions';
import { useBookClock, useBoxes, useFrameScan } from './usePinpoint';

type BoxKey = 'corridor' | 'close';

const Ahead = () => {
  const activeTicker = useActiveTicker();
  const { toggleFocus } = useFocus();
  /* THE CLOCK — New York time, re-read every 15s; every band moves with it */
  const clock = useBookClock();
  /* The room's scan (data/pinpointBook.ts): the book sweeps every ten seconds, the same snapshot every page reads */
  const scan = useFrameScan();
  /* Each box can hold its own name (the Map's rule): it follows the frame until its chip unlinks it */
  const { snapFor, tickerFor, chipFor, focusFor } = useBoxes<BoxKey>('ahead', scan);

  /* THE VOL SCENARIO (2026-09-09) — vanna spoken: a drop of a point by default,
     the usual crush into the close; the card on the range box changes it */
  const [volPoints, setVolPoints] = useState<VolPoints>(-1);

  /* THE TWO ANSWERS, each off its box's own name — the one book every page reads (data/pinpointBook.ts) */
  const corridorSnap = snapFor('corridor');
  const closeSnap = snapFor('close');
  const corridor = useMemo(() => {
    if (!corridorSnap) return null;
    const book = bookOf(corridorSnap, clock);
    return { profile: book.profile, model: corridorOf(book), schedule: scheduleOf(book, volPoints) };
  }, [corridorSnap, clock, volPoints]);
  const close = useMemo(() => {
    if (!closeSnap) return null;
    const book = bookOf(closeSnap, clock);
    return { odds: closeOddsOf(book), levels: book.profile.levels };
  }, [closeSnap, clock]);

  /* Your strikes, for the odds rows — only when the box is on the frame's name */
  const positions = usePositions(activeTicker);
  const yours = useMemo(() => new Set(positions.map(p => p.strike)), [positions]);

  /* Both boxes stand in their own shape while the first read walks in (Noah,
     2026-09-08) — the same shapes the route's fallback and the deferred mounts use */
  if (!scan || !corridor || !close) return <AheadPageSkeleton />;

  const corridorTicker = tickerFor('corridor');
  const closeTicker = tickerFor('close');
  const pick = (t: string) => (price: number) => toggleFocus(price, t);

  return (
    <>
      {/* BOX 1 — THE CORRIDOR, with what dealers must trade under it on the same minutes */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-corridor data-scope-ticker={corridorTicker}>
        <Deferred fallback={<CorridorInner />} className="animate-fade-in">
          <AheadCorridor
            corridor={corridor.model}
            schedule={corridor.schedule}
            levels={corridor.profile.levels}
            ticker={corridorTicker}
            clock={clock}
            focus={focusFor(corridorTicker)}
            onPick={pick(corridorTicker)}
            scope={chipFor('corridor', corridorTicker)}
            volPoints={volPoints}
            onVolPoints={setVolPoints}
          />
        </Deferred>
      </div>

      {/* BOX 2 — WHERE IT CLOSES */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-close data-scope-ticker={closeTicker}>
        <Deferred index={1} fallback={<CloseInner />} className="animate-fade-in">
          <CloseOdds
            odds={close.odds}
            levels={close.levels}
            spot={closeSnap!.spot}
            ticker={closeTicker}
            clock={clock}
            yours={closeTicker === activeTicker ? yours : undefined}
            focus={focusFor(closeTicker)}
            onPick={pick(closeTicker)}
            scope={chipFor('close', closeTicker)}
          />
        </Deferred>
      </div>
    </>
  );
};

export default Ahead;
