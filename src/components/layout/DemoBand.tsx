/*
==================================================
  SLAYER TERMINAL - THE DEMO BAND (components/layout/DemoBand.tsx)

  "Demo band · on every page of the demo" (Slayer Logo System, Web and App · Try before you buy):
  "● Simulated data. Nothing here is live. [Make an account]". Beside it, when the market is not open, the one plain
  line of the market's state (data/marketState.ts) — "The market is closed. It opens at 9:30 ET."

  It can be put away (the × — kept on this machine); the rail's signature still says "simulated" underneath. Not in the
  landing's window, which carries its own band, and not on a phone, where the menu's foot says it.
==================================================
*/

import { useEffect, useLayoutEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { readMarketState } from '../../data/marketState';
import { EMBEDDED } from '../../embed';

const KEY = 'slayer_demo_band_hidden';
const readHidden = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

const DemoBand = () => {
  const [hidden, setHidden] = useState(readHidden);
  const [market, setMarket] = useState(() => readMarketState());
  useEffect(() => {
    if (hidden) return;
    const id = window.setInterval(() => setMarket(readMarketState()), 30_000);
    return () => window.clearInterval(id);
  }, [hidden]);
  /* the pages sized to the screen subtract the band (index.css --demo-band): <html> says while it stands */
  const shown = !hidden && !EMBEDDED;
  useLayoutEffect(() => {
    if (!shown) return;
    document.documentElement.setAttribute('data-demo-band', '');
    return () => document.documentElement.removeAttribute('data-demo-band');
  }, [shown]);
  if (!shown) return null;
  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* private mode — hidden for this visit */
    }
  };
  return (
    <div className="hidden md:flex shrink-0 h-8 items-center gap-2.5 pl-4 lg:pl-6 2xl:pl-8 pr-2 border-b border-borderSubtle bg-ink/[0.02] text-[12px]" data-demo-band={market.kind}>
      <span className="w-1.5 h-1.5 rounded-full bg-silver shrink-0" aria-hidden />
      <span className="text-textSecondary whitespace-nowrap">Simulated data. Nothing here is live.</span>
      {market.kind !== 'open' && <span className="min-w-0 truncate text-textMuted" data-demo-band-market>· {market.line}</span>}
      <Link to="/signup" className="ml-auto shrink-0 h-6 px-3 inline-flex items-center rounded-full bg-textPrimary text-canvas text-[11.5px] font-medium hover:bg-textPrimary/90" data-demo-band-door>
        Make an account
      </Link>
      <button type="button" onClick={hide} aria-label="Hide this band" title="Hide this band" className="shrink-0 w-6 h-6 inline-flex items-center justify-center rounded-full text-textMuted hover:text-textPrimary hover:bg-ink/[0.06]">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default DemoBand;
