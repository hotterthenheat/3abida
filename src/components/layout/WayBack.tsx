/*
==================================================
  SLAYER TERMINAL - THE WAY BACK (components/layout/WayBack.tsx)

  A page opened FROM somewhere else carries a way
  back to it (Noah, 2026-09-12, on the Pulse desk:
  "it should take user to the actual page with a
  button allowing them to go back to the pulse page
  from there"). The opener navigates with
  `state: { wayBack: '/pulse' }`; this pill reads
  it on whatever page it landed on and takes the
  reader back on a click. It rides the route's
  state, so a step deeper into the section (no
  state) drops it and the browser's Back brings it
  with the page. Mounted once, in the shell.
==================================================
*/

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

/** How the origin is named on the pill */
const NAMES: Record<string, string> = {
  '/pulse': 'Pulse',
};
/* A name's page on the Record is named by the name (the busiest rows' way
   back, 2026-09-12); any other origin is plainly "back" */
const nameFor = (to: string): string => {
  if (NAMES[to]) return NAMES[to];
  /* a name's page under the Dossier — the earnings page or the stock overview (2026-09-13; the Record became the Dossier
     and its pills read "Back to back" until 2026-10-09, the audit's SH-3) */
  const m = to.match(/^\/(?:record|dossier)\/(?:earnings|stocks)\/([^/?#]+)/);
  if (m) return decodeURIComponent(m[1]).toUpperCase();
  return 'back';
};

export type WayBackState = { wayBack?: string };

/* The pill floats at the TOP CENTRE of the content column — the one strip every
   shell head leaves empty (the name at its left, the facts at its right); the
   corners are not (the Map's foot, the door home). The column starts after the
   sidebar, whose width glides, so the centre is measured off <main>. */
const useMainCentre = () => {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('main');
    if (!main) return;
    const read = () => {
      const r = main.getBoundingClientRect();
      setLeft(r.left + r.width / 2);
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(main);
    window.addEventListener('resize', read);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', read);
    };
  }, []);
  return left;
};

/* CLEAR OF THE HEAD'S FACTS (the audit's SH-4): on a wide head (the Map's) the facts reach the top centre, and the pill
   sat on them — then it stands at the foot of the screen instead, still centred on the column */
const useClearOfFacts = (left: number | null, path: string): boolean => {
  const [low, setLow] = useState(false);
  useEffect(() => {
    if (left == null) return;
    const check = () => {
      const facts = document.querySelector<HTMLElement>('main [data-shell-facts]');
      if (!facts) return setLow(false);
      const r = facts.getBoundingClientRect();
      /* the pill: about 150px wide, 12–44px from the top */
      setLow(r.top < 48 && r.bottom > 8 && r.left < left + 90 && r.right > left - 90);
    };
    const id = window.setTimeout(check, 120);
    window.addEventListener('resize', check);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('resize', check);
    };
  }, [left, path]);
  return low;
};

const WayBack = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const to = (location.state as WayBackState | null)?.wayBack;
  const left = useMainCentre();
  const low = useClearOfFacts(to ? left : null, location.pathname);
  if (!to || left == null) return null;
  const name = nameFor(to);
  return (
    <button
      onClick={() => navigate(to)}
      title={`Back to ${name}`}
      data-way-back={to}
      data-way-back-low={low || undefined}
      style={{ left }}
      className={`group fixed ${low ? 'bottom-4' : 'top-[60px] md:top-3'} -translate-x-1/2 z-[70] inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full border border-borderMuted bg-panel/90 backdrop-blur-sm font-mono text-[11px] font-semibold text-textSecondary hover:text-textPrimary hover:bg-panelHover shadow-lg shadow-black/40 transition-colors animate-soft-in`}
    >
      <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" />
      Back to {name}
    </button>
  );
};

export default WayBack;
