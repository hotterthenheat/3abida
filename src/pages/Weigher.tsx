/*
==================================================
  SLAYER TERMINAL - WEIGHER (pages/Weigher.tsx)

  Its own door on the top bar (Noah, 2026-08-26:
  "weigher should be its own page instead of a
  subsection of compass").
==================================================

  The desk outgrew the tab it was living behind. Compass is a CHOOSER — it
  sweeps the universe and grades what it finds — and the Weigher is a
  WORKSTATION you sit down at with one name. Sharing a page meant one
  segmented control deciding which of two unrelated jobs you were doing, and
  a Compass deep link could land you in neither. Now the workflow reads
  straight down the Discover menu: Compass finds it, Weigher weighs it.

  This file is only the door: the header, and the one deep link that arrives
  carrying a name (Trace's "Weigh it"). Everything the desk does lives in
  weigher/WeigherDesk.
*/

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import WeigherDesk, { type WeighRequest } from './weigher/WeigherDesk';

const Weigher = () => {
  const location = useLocation();

  /* Trace's print drilldown jumps here with a name to weigh; the Record's
     busiest rows with a CONTRACT (name · strike · side · expiry, 2026-09-12).
     Read ONCE and consumed from history, the Compass pattern — a refresh must
     not drag the desk back to a name the user has since moved off. The way
     back (`wayBack`) is the shell's and stays in the state. */
  const [incoming, setIncoming] = useState<WeighRequest | null>(null);
  useEffect(() => {
    const state = location.state as { weigh?: WeighRequest; wayBack?: string } | null;
    if (state?.weigh?.ticker) {
      setIncoming(state.weigh);
      window.history.replaceState(state.wayBack ? { wayBack: state.wayBack } : {}, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    /* No PageHeader at all (Noah, 2026-08-30: "way too much space up top" —
       the Trace verdict again): the desk's own strip carries the identity,
       fused onto the same line as the session pill. */
    <WeigherDesk incoming={incoming} />
  );
};

export default Weigher;
