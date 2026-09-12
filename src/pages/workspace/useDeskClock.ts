/*
==================================================
  SLAYER TERMINAL - THE DESK'S CLOCK
  (pages/workspace/useDeskClock.ts)

  The Pinpoint pages read New York time every 15s
  and hand the surfaces an AheadClock (minutes left,
  in session). The desk's panels that carry those
  surfaces need the same clock, on the same cadence.
==================================================
*/

import { useEffect, useMemo, useState } from 'react';
import { aheadClock, type AheadClock } from '../../data/ahead';
import { readSessionClock } from '../../data/moc';

export function useDeskClock(): AheadClock {
  const [raw, setRaw] = useState(() => readSessionClock());
  useEffect(() => {
    const id = globalThis.setInterval(() => setRaw(readSessionClock()), 15_000);
    return () => globalThis.clearInterval(id);
  }, []);
  return useMemo(() => aheadClock(raw), [raw]);
}

export const hhmmss = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
