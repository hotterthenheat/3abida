/*
==================================================
  SLAYER TERMINAL - THE FOOT OF THE PRICE PANE
  (components/gex/PaneFoot.tsx)

  Where a chart's floating bar lives (the replay bar,
  the backtest's clock): along the foot of the PRICE
  pane — not the foot of the chart. They were the same
  place until an indicator took a pane of its own
  (RSI, ADX, a script "in its own pane"): the bar was
  hung off the time axis, so it lay across the new
  pane and hid the very line the reader had just asked
  for (Noah, 2026-09-20, with a picture of the folded
  bar over an indicator's pane).

  The library tells nobody when a pane is added, taken
  away or dragged taller, so the pane's height is read
  each frame and the DOM is written only when it has
  changed. Until the first frame (a hidden tab gets
  none) the bar rests above the time axis, as it used
  to. A double-click on the bar stays on the bar: the
  chart's box resets its view on one, and two quick
  steps of a replay are not a reset.

  Its top edge is said to the box it stands in as
  --pane-foot-top (pixels from the box's top), so the
  chart's Reset pill stands above the bar, never under
  it (approval 3, 2026-10-15: in a replay the strip
  covered the pill — one of the four ways home gone).
==================================================
*/

import { useEffect, useRef, type ReactNode } from 'react';
import type { IChartApi } from 'lightweight-charts';

interface Props {
  /** The chart, asked for every frame — never kept */
  chart: () => IChartApi | null;
  children: ReactNode;
  /** The gap between the bar and the pane's floor, in pixels */
  gap?: number;
  /** The wrapper's left inset (a host with a drawing rail down its left edge clears it) */
  className?: string;
  /** Keep clear of the price axis at the right (on by default). Off for a bar laid across TWO charts: it is centred on
      their seam, and the host gives it the same inset both sides. */
  axisPad?: boolean;
}

const PaneFoot = ({ chart, children, gap = 8, className = 'pl-3', axisPad = true }: Props) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let raf = 0;
    let shownH = -1;
    let shownR = -1;
    let shownTop = NaN;
    /* the bar's own height, kept by an observer (never read in the frame) */
    let footH = 0;
    const box = ref.current?.parentElement ?? null;
    const sizeObs =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(entries => {
            const e = entries[0];
            footH = e?.borderBoxSize?.[0]?.blockSize ?? (e?.target as HTMLElement | undefined)?.offsetHeight ?? 0;
          });
    if (ref.current) sizeObs?.observe(ref.current);
    const place = () => {
      raf = requestAnimationFrame(place);
      const c = chart();
      const el = ref.current;
      if (!c || !el) return;
      let h = 0;
      let r = 0;
      try {
        h = c.paneSize(0).height;
        r = c.priceScale('right').width();
      } catch {
        return; // the chart is on its way out
      }
      if (!(h > 0)) return;
      if (h !== shownH) {
        shownH = h;
        el.style.bottom = 'auto';
        el.style.top = `${h - gap}px`;
        el.style.transform = 'translateY(-100%)';
      }
      if (axisPad && r !== shownR) {
        shownR = r;
        el.style.paddingRight = `${r + 12}px`;
      }
      const top = Math.round(h - gap - footH);
      if (footH > 0 && top !== shownTop && box) {
        shownTop = top;
        box.style.setProperty('--pane-foot-top', `${top}px`);
      }
    };
    raf = requestAnimationFrame(place);
    return () => {
      cancelAnimationFrame(raf);
      sizeObs?.disconnect();
      box?.style.removeProperty('--pane-foot-top');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gap, axisPad]);
  return (
    <div ref={ref} className={`absolute inset-x-0 z-30 pointer-events-none ${className}`} style={{ bottom: 34, paddingRight: axisPad ? 68 : undefined }} onDoubleClick={e => e.stopPropagation()} data-pane-foot>
      {children}
    </div>
  );
};

export default PaneFoot;
