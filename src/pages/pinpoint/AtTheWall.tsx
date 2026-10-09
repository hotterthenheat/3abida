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

import { useMemo } from 'react';
import { useFocus } from '../../context/FocusContext';
import { Deferred } from '../../components/ui/Skeleton';
import AtTheWallBand from '../../components/gex/AtTheWall';
import WallBoard from '../../components/gex/WallBoard';
import { AtTheWallInner, WallBoardInner, WallPageSkeleton } from '../../components/gex/wallSkeletons';
import { bookOf, wallBoardOf } from '../../data/pinpointBook';
import { stampOf, useBookClock, useBoxes, useFrameScan } from './usePinpoint';

type BoxKey = 'wall' | 'board';

const AtTheWall = () => {
  const { focusOn, toggleFocus } = useFocus();
  /* THE CLOCK — New York time, re-read every 15s; the reach odds run on it */
  const clock = useBookClock();
  /* The room's scan: the odds sweep every ten seconds, the same snapshot every page reads */
  const scan = useFrameScan();
  const { snapFor, tickerFor, chipFor, focusFor } = useBoxes<BoxKey>('wall', scan);

  /* THE BOARD per name, off the one book (data/pinpointBook.ts) — the wall box reads the focus, the board box lists all */
  const wallSnap = snapFor('wall');
  const boardSnap = snapFor('board');
  const wallTicker = tickerFor('wall');
  const boardTicker = tickerFor('board');
  const wallFocus = focusFor(wallTicker);
  const wallBoard = useMemo(() => (wallSnap ? wallBoardOf(bookOf(wallSnap, clock), wallFocus) : null), [wallSnap, wallFocus, clock]);
  const boardBoard = useMemo(() => (boardSnap ? wallBoardOf(bookOf(boardSnap, clock), null) : null), [boardSnap, clock]);
  const book = useMemo(() => (wallSnap ? bookOf(wallSnap, clock) : null), [wallSnap, clock]);

  /* Both boxes stand in their own shape while the first read walks in */
  if (!scan || !wallBoard || !boardBoard) return <WallPageSkeleton />;

  return (
    <>
      {/* BOX 1 — AT THE WALL */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-wall data-scope-ticker={wallTicker}>
        <Deferred fallback={<AtTheWallInner />} className="animate-fade-in">
          <AtTheWallBand board={wallBoard} ticker={wallTicker} clock={clock} onPick={strike => focusOn(strike, wallTicker)} updatedAt={stampOf(scan.at)} scope={chipFor('wall', wallTicker)} />
        </Deferred>
      </div>

      {/* BOX 2 — EVERY WALL: as tall as its rows, every row one fixed height (Noah,
          2026-09-13: the box "keeps increasing and decreasing in size… the bars
          should not be getting bigger") */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-wall-every data-scope-ticker={boardTicker}>
        <Deferred index={1} fallback={<WallBoardInner rows={boardBoard.walls.length || 6} />} className="animate-fade-in">
          <WallBoard board={boardBoard} clock={clock} focus={focusFor(boardTicker)} onPick={strike => toggleFocus(strike, boardTicker)} scope={chipFor('board', boardTicker)} />
        </Deferred>
      </div>
    </>
  );
};

export default AtTheWall;
