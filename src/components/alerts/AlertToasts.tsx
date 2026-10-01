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

  A PAPER FILL SAYS SO HERE TOO (2026-09-22, docs/paper-
  rules.md "Fill alerts"): a stop, a target, a limit, an
  expiry, the rules closing something — on a paper
  account, while the reader is anywhere — is a chip in
  this same column (never a second stack over it), in
  the house's where-you-are silver, with what it made in
  its direction's ink; a click opens the Live Chart. A
  failed evaluation wears the bear ink, a passed one the
  bull.
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { firedWords, useAllAlerts, type FiredRecord } from '../gex/alertStore';
import { usePaperToasts, type PaperToast } from '../../data/paper/store';
import { dirInk, usdSigned } from '../review/words';
import { chime } from '../../core/sound';
import { ALERT, alpha } from '../gex/paletteInk';
import { openAlertsDrawer } from '../../data/alertsDrawer';
import { flashAlert } from '../../brand/markState';

/** How long a chip stays — long enough to read on a page you were not looking at */
export const TOAST_MS = 5000;
const AT_MOST = 4;

/** A paper chip's ink: a fill is silver (where you are); an evaluation's end, its verdict's */
const paperInk = (t: PaperToast): string => (t.kind === 'failed' ? 'rgb(var(--bear))' : t.kind === 'passed' ? 'rgb(var(--bull))' : t.kind === 'day-over' || t.kind === 'flat' || t.kind === 'rule' ? 'rgb(var(--warn))' : 'rgb(var(--silver))');

/** New York's clock, to the second — when an alert fired */
const ET_CLOCK = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

const AlertToasts = () => {
  const names = useAllAlerts();
  const paper = usePaperToasts();
  const navigate = useNavigate();
  const [, wake] = useState(0);
  const now = Date.now();
  const shown: { ticker: string; r: FiredRecord }[] = names
    .flatMap(n => n.fired.map(r => ({ ticker: n.ticker, r })))
    .filter(x => now - x.r.at < TOAST_MS)
    .sort((a, b) => b.r.at - a.r.at)
    .slice(0, AT_MOST);
  /* the paper account's, in the same column — a verdict stays twice as long as a fill */
  const paperShown = paper.filter(t => now - t.at < (t.kind === 'failed' || t.kind === 'passed' ? TOAST_MS * 2 : TOAST_MS)).slice(0, AT_MOST);

  /* A NEW chip CHIMES, once (Settings › The desk, "Alerts out loud"): the
     keys already heard are kept, so a re-render never rings twice */
  const heard = useRef<Set<string>>(new Set());
  useEffect(() => {
    let fresh = false;
    for (const x of shown) {
      const k = `${x.ticker}:${x.r.key}`;
      if (!heard.current.has(k)) {
        heard.current.add(k);
        fresh = true;
      }
    }
    if (fresh) {
      chime();
      /* the mark's cursor flashes the warning ink twice (brand/markState.ts — "Alert: an alert fires") */
      flashAlert();
    }
  });

  /* wake when the oldest chip on screen is due to leave */
  useEffect(() => {
    if (shown.length === 0 && paperShown.length === 0) return;
    const soonest = Math.min(...shown.map(x => x.r.at + TOAST_MS), ...paperShown.map(t => t.at + (t.kind === 'failed' || t.kind === 'passed' ? TOAST_MS * 2 : TOAST_MS))) - Date.now();
    const id = window.setTimeout(() => wake(t => t + 1), Math.max(0, soonest) + 20);
    return () => window.clearTimeout(id);
  });

  if (shown.length === 0 && paperShown.length === 0) return null;
  return (
    <div className="fixed top-3 right-3 z-[86] flex flex-col items-end gap-1.5 pointer-events-none" aria-live="polite" aria-label="Alerted" data-alert-toasts>
      {paperShown.map(t => (
        <button
          key={t.id}
          onClick={() => navigate('/practice/paper')}
          title="Open the Live Chart"
          className="shell-toast pointer-events-auto inline-flex items-center gap-2 h-7 pl-2.5 pr-3 rounded-md border bg-canvas/85 backdrop-blur-md backdrop-saturate-150 shadow-lg shadow-black/40 font-mono text-[11px] select-none"
          style={{ borderColor: `color-mix(in srgb, ${paperInk(t)} 50%, transparent)` }}
          data-paper-toast={t.kind}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: paperInk(t) }} aria-hidden />
          {t.account && <span className="text-textSecondary">{t.account} ·</span>}
          <span className="text-textPrimary">{t.words}</span>
          {t.pnl != null && <span className={`font-semibold ${dirInk(t.pnl)}`}>{usdSigned(t.pnl)}</span>}
          <span className="text-[9px] uppercase tracking-wider text-textMuted">paper</span>
        </button>
      ))}
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
          {/* when, on the market's clock — the brand's alert line ends "at 10:42:07 ET" */}
          <span className="text-textMuted tnum">at {ET_CLOCK.format(x.r.at)} ET</span>
        </button>
      ))}
    </div>
  );
};

export default AlertToasts;
