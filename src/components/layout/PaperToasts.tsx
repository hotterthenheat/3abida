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

export const PAPER_TOAST_MS = 4500;
const AT_MOST = 4;

const INK: Record<PaperToast['kind'], string> = { fill: 'rgb(var(--warn))', reject: 'rgb(var(--bear))', cancel: 'rgb(var(--text-muted))', info: 'rgb(var(--silver))' };

const PaperToasts = ({ muted = false }: { muted?: boolean }) => {
  const paper = usePaper();
  const [, wake] = useState(0);
  useEffect(() => {
    ensureClock();
  }, []);
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
    <div className="fixed top-[52px] right-3 z-[86] flex flex-col items-end gap-1.5 pointer-events-none" aria-live="polite" aria-label="Paper fills" data-paper-toasts>
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
