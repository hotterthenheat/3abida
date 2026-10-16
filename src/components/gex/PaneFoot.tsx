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
  WHEREVER A FOOT STANDS, NOT ONLY THE CHART'S OWN (the
  review of 2026-10-16: the Backtest's clock and Paper's
  position bar are a host's layer, and the pill stood
  under them): a foot with a height marks its box
  (data-pane-foot-box) and tells the pill and the chart
  under it (paneFootTopOver, onPaneFoot) — the pill
  stands over it, and the field's words keep clear of
  the pill where it stands. A foot laid across two
  charts (the Backtest's split desk) stands in their
  common box, whose top is the panes' top, as its own
  place already takes it to be: both pills read it.
  A foot with nothing in it (no position open) marks
  nothing.
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

/* THE FEET STANDING IN A BOX, each foot's top (pixels from the box's top) — the highest is the box's --pane-foot-top */
const feet = new WeakMap<HTMLElement, Map<object, number>>();
const heard = new Set<() => void>();
const sayFoot = (box: HTMLElement, who: object, top: number | null) => {
  let m = feet.get(box);
  if (top == null) {
    if (!m?.delete(who)) return;
  } else {
    if (!m) feet.set(box, (m = new Map()));
    if (m.get(who) === top) return;
    m.set(who, top);
  }
  if (m.size) {
    box.style.setProperty('--pane-foot-top', `${Math.min(...m.values())}px`);
    box.setAttribute('data-pane-foot-box', '');
  } else {
    box.style.removeProperty('--pane-foot-top');
    box.removeAttribute('data-pane-foot-box');
  }
  for (const f of heard) f();
};
/** The top of the foot standing over `el` — its own box's or an ancestor's (a foot across two charts), in pixels from
    that box's top, which is the price pane's top — or null where no foot with a height stands */
export const paneFootTopOver = (el: Element | null | undefined): number | null => {
  for (let n: Element | null = el ?? null; n; n = n.parentElement) {
    const m = feet.get(n as HTMLElement);
    if (m?.size) return Math.min(...m.values());
  }
  return null;
};
/** Told whenever a foot stands up, moves or goes, anywhere — the reader asks paneFootTopOver again */
export const onPaneFoot = (fn: () => void): (() => void) => {
  heard.add(fn);
  return () => {
    heard.delete(fn);
  };
};

const PaneFoot = ({ chart, children, gap = 8, className = 'pl-3', axisPad = true }: Props) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let raf = 0;
    let shownH = -1;
    let shownR = -1;
    let shownTop: number | null | undefined;
    /* the bar's own height, kept by an observer (never read in the frame) */
    let footH = 0;
    const box = ref.current?.parentElement ?? null;
    const who = {};
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
      /* a foot with nothing in it is no foot: the pill keeps its own place */
      const top = footH > 0 ? Math.round(h - gap - footH) : null;
      if (top !== shownTop && box) {
        shownTop = top;
        sayFoot(box, who, top);
      }
    };
    raf = requestAnimationFrame(place);
    return () => {
      cancelAnimationFrame(raf);
      sizeObs?.disconnect();
      if (box) sayFoot(box, who, null);
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
