/*
==================================================
  SLAYER TERMINAL - THE PAPER DESK, HEARD EVERYWHERE
  (components/layout/PaperToasts.tsx)

  The alerts' rule applied to paper fills: a
  working order fills while the reader is on any
  page, and the fill shows where they are — one
  chip at the window's top right, under the alert
  chips' own spot, for a few seconds. Mounting this
  also keeps the paper engine's clock running, so
  a stop left on the chart is watched on every page.

  Lazy behind the shell (AppShell): the engine and
  the market state travel only when the desk has
  something live, or the reader opens it.
==================================================
*/

import { useEffect, useState } from 'react';
import { dismissToasts, ensureClock, usePaper, type PaperToast } from '../../core/paper/engine';
import { useModes } from '../../core/paper/modes';
import { startPropFirm } from '../../core/paper/propFirm';
import { startTilt } from '../../core/paper/tilt';
import { applyFriction } from '../../core/paper/friction';

export const PAPER_TOAST_MS = 4500;
const AT_MOST = 4;

const INK: Record<PaperToast['kind'], string> = { fill: 'rgb(var(--warn))', reject: 'rgb(var(--bear))', cancel: 'rgb(var(--text-muted))', info: 'rgb(var(--silver))' };

const PaperToasts = ({ muted = false }: { muted?: boolean }) => {
  const paper = usePaper();
  const modes = useModes();
  const [, wake] = useState(0);
  /*
    THE MODES RIDE WITH THE CLOCK, NOT WITH THE PAGE.

    An evaluation that only enforced itself while the reader had the desk open
    would not be an evaluation: a stop left working fills on any page, and the
    trailing drawdown, the 16:59 flatten and the tilt watch have to see it.
    They are installed here, beside the clock, through the engine's own seams —
    a guard that may refuse, an observer that may watch, a fill model that may
    only narrow how a fill is priced. Nothing here can move an account.
  */
  useEffect(() => {
    ensureClock();
    const stopProp = startPropFirm();
    const stopTilt = startTilt();
    return () => {
      stopProp();
      stopTilt();
    };
  }, []);
  /* the friction is one fill model, rebuilt whenever the switches change */
  useEffect(() => {
    applyFriction();
  }, [modes]);
  const now = Date.now();
  /* ON THE DESK ITSELF THE CHIP WOULD BE A SECOND VOICE (the alerts' rule, in
     reverse): the position bar, the blotter and the log all say what filled,
     and the chip landed over the account's own figures at the top right. The
     clock still runs — this only keeps the desk from talking over itself. */
  const shown = muted ? [] : paper.toasts.filter(t => now - t.at < PAPER_TOAST_MS).slice(-AT_MOST);
  useEffect(() => {
    if (shown.length === 0) return;
    const soonest = Math.min(...shown.map(t => t.at + PAPER_TOAST_MS)) - Date.now();
    const id = window.setTimeout(() => {
      dismissToasts(Date.now() - PAPER_TOAST_MS);
      wake(n => n + 1);
    }, Math.max(0, soonest) + 20);
    return () => window.clearTimeout(id);
  });
  if (shown.length === 0) return null;
  return (
    /* A REJECTION IS NOT A FILL, and a screen reader waiting for a pause is
       the wrong behaviour for "that order did not go". The region is polite
       while the desk is only reporting, and assertive the moment one of the
       chips is a refusal — one region either way, because a role="alert"
       nested inside a polite region gets announced twice. */
    <div
      className="fixed top-[52px] right-3 z-[86] flex flex-col items-end gap-1.5 pointer-events-none"
      role="status"
      aria-live={shown.some(t => t.kind === 'reject') ? 'assertive' : 'polite'}
      aria-label="Paper fills"
      data-paper-toasts
    >
      {shown.map(t => (
        <div key={t.id} className="shell-toast inline-flex items-center gap-2 h-7 pl-2.5 pr-3 rounded-md border bg-canvas/85 backdrop-blur-md backdrop-saturate-150 shadow-lg shadow-black/40 font-mono text-[11px] select-none" style={{ color: INK[t.kind], borderColor: `color-mix(in srgb, ${INK[t.kind]} 50%, transparent)` }} data-paper-toast={t.kind}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: INK[t.kind] }} aria-hidden />
          <span className="font-bold">{t.symbol}</span>
          <span className="text-textPrimary">{t.words}</span>
          <span className="text-[9px] uppercase tracking-wider text-textMuted">paper</span>
        </div>
      ))}
    </div>
  );
};

export default PaperToasts;
