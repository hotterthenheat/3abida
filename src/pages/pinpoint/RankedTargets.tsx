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

import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMarketData } from '../../context/MarketDataContext';
import { useFocus } from '../../context/FocusContext';
import { Deferred } from '../../components/ui/Skeleton';
import TargetsBoard from '../../components/gex/TargetsBoard';
import TargetsAxis from '../../components/gex/TargetsAxis';
import { TargetsAxisInner, TargetsInner, TargetsPageSkeleton } from '../../components/gex/targetsSkeletons';
import WatchMenu from '../../components/gex/WatchMenu';
import { armPrice, removeAlert, useAlerts } from '../../components/gex/alertStore';
import { type AgendaOrder, type Agenda, type Target } from '../../data/agenda';
import { agendaOf, bookOf, inWindow } from '../../data/pinpointBook';
import { contractWords, usePositions } from '../../data/positions';
import { stampOf, useBookClock, useBoxes, useFrameScan, useRoomWindow } from './usePinpoint';

type BoxKey = 'list' | 'axis';
let orderMemory: AgendaOrder = 'matters';

/** The agenda as a page draws it: the book's own order and odds, the rows inside the room's window (the first three
    and the sentence stay the book's — the day's agenda does not change with how much of it is on screen) */
const drawn = (a: Agenda, half: number): Agenda => ({ ...a, targets: inWindow(a.targets, a.spot, half) });

const RankedTargets = () => {
  const { activeTicker } = useMarketData();
  const { focusOn, toggleFocus } = useFocus();
  const navigate = useNavigate();
  const location = useLocation();
  const [order, setOrderState] = useState<AgendaOrder>(orderMemory);
  const setOrder = (o: AgendaOrder) => {
    orderMemory = o;
    setOrderState(o);
  };
  /* THE STRIKES — the room's one window: which strikes are listed, never their odds */
  const [window, setWindow] = useRoomWindow();

  /* THE CLOCK — New York time, re-read every 15s; the reach odds run on it */
  const clock = useBookClock();
  /* The room's scan: the order sweeps every ten seconds, the same snapshot every page reads */
  const scan = useFrameScan();
  const { snapFor, tickerFor, chipFor, focusFor } = useBoxes<BoxKey>('targets', scan);

  /* THE AGENDA per name — the one book every Pinpoint page reads (data/pinpointBook.ts) */
  const listSnap = snapFor('list');
  const axisSnap = snapFor('axis');
  const listTicker = tickerFor('list');
  const axisTicker = tickerFor('axis');
  const listBook = useMemo(() => (listSnap ? bookOf(listSnap, clock) : null), [listSnap, clock]);
  const listAgenda = useMemo(() => (listBook ? drawn(agendaOf(listBook, order), window) : null), [listBook, order, window]);
  const axisAgenda = useMemo(() => (axisSnap ? drawn(agendaOf(bookOf(axisSnap, clock), order), window) : null), [axisSnap, clock, order, window]);

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
  /* THE CHART IS A CHART (the audit's PP-1, 2026-10-09): "Chart" opened the Map, which has had no chart since
     2026-09-12, while the head's own Chart went to Pulse. Both go to Pulse's chart now, the strike in focus, and
     leaving the chart's fullscreen comes back here — the head chip's own way */
  const onChart = (t: Target) => {
    focusOn(t.strike, listTicker);
    navigate('/pulse', { state: { focusPrice: t.strike, ticker: listTicker, from: location.pathname } });
  };

  /* Both boxes stand in their own shape while the first read walks in */
  if (!scan || !listAgenda || !axisAgenda || !listBook) return <TargetsPageSkeleton rows={window * 2 - 2} />;

  /* The Alerts menu names the same walls the list tags — the book's (it read a window of its own and said 481 beside a list saying 480) */
  const levels = listBook.profile.levels;

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
            updatedAt={stampOf(scan.at)}
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
