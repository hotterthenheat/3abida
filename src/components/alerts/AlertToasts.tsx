/*
==================================================
  SLAYER TERMINAL - THE TOAST ANYWHERE (components/alerts/AlertToasts.tsx)

  HEAR IT EVERYWHERE (the alerts rule, 2026-09-10):
  a firing shows where the reader IS — any page —
  as one orange chip at the window's top right, in
  the drawer's own words (the name, what alerted),
  for five seconds; a click opens the drawer. The
  chart panes used to carry their own chip and the
  reader saw a firing twice when a chart of the name
  was up; this one chip is the only one now. The
  price line on the pane still turns solid — that
  is the in-place mark, not a second voice.
==================================================
*/

import { useEffect, useState } from 'react';
import { firedWords, useAllAlerts, type FiredRecord } from '../gex/alertStore';
import { ALERT, alpha } from '../gex/paletteInk';
import { openAlertsDrawer } from '../../data/alertsDrawer';

/** How long a chip stays — long enough to read on a page you were not looking at */
export const TOAST_MS = 5000;
const AT_MOST = 4;

const AlertToasts = () => {
  const names = useAllAlerts();
  const [, wake] = useState(0);
  const now = Date.now();
  const shown: { ticker: string; r: FiredRecord }[] = names
    .flatMap(n => n.fired.map(r => ({ ticker: n.ticker, r })))
    .filter(x => now - x.r.at < TOAST_MS)
    .sort((a, b) => b.r.at - a.r.at)
    .slice(0, AT_MOST);

  /* wake when the oldest chip on screen is due to leave */
  useEffect(() => {
    if (shown.length === 0) return;
    const soonest = Math.min(...shown.map(x => x.r.at + TOAST_MS)) - Date.now();
    const id = window.setTimeout(() => wake(t => t + 1), Math.max(0, soonest) + 20);
    return () => window.clearTimeout(id);
  });

  if (shown.length === 0) return null;
  return (
    <div className="fixed top-3 right-3 z-[86] flex flex-col items-end gap-1.5 pointer-events-none" aria-live="polite" aria-label="Alerted" data-alert-toasts>
      {shown.map(x => (
        <button
          key={`${x.ticker}:${x.r.key}`}
          onClick={openAlertsDrawer}
          title="Open the alerts"
          className="shell-toast pointer-events-auto inline-flex items-center gap-2 h-7 pl-2.5 pr-3 rounded-md border bg-canvas/85 backdrop-blur-md backdrop-saturate-150 shadow-lg shadow-black/40 font-mono text-[11px] select-none"
          style={{ color: ALERT, borderColor: alpha(ALERT, 0.5) }}
          data-alert-toast={x.r.key}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: ALERT }} aria-hidden />
          <span className="font-bold">{x.ticker}</span>
          <span className="text-textPrimary">{firedWords(x.r.alert, x.ticker)}</span>
          <span className="text-[9px] uppercase tracking-wider text-textMuted">alerted</span>
        </button>
      ))}
    </div>
  );
};

export default AlertToasts;
