/*
==================================================
  SLAYER TERMINAL - THE SCRIPTS' LEGEND (components/gex/ScriptLegend.tsx)

  The scripts on a pane, named at the chart's top
  left the way TradingView lists its indicators
  (Noah, 2026-09-10: "the indicators added appear on
  the top left corner … with a blind/show or remove
  ability. i want that as well"): the name, its
  inputs' values in muted ink, and on hover an eye
  to hide or show it and an × to take it off. A
  hidden script stays listed, dimmed, its eye shut,
  so the reader knows it is there. A script that
  does not read says so instead of drawing nothing.

  WHERE IT SITS. Every host floats its own chrome
  over the chart's top — Pulse's strip and readout,
  the Weigher's strip, Terrain's strip and compares
  — and each is a different height that wraps at
  its own width. The chart cannot know those, so
  the hosts mark that chrome `data-chart-chrome`
  and the legend measures: it sits four pixels
  under the lowest marked block that overlaps this
  chart's upper third, and re-measures whenever
  the chart's box changes size.
==================================================
*/

import { useLayoutEffect, useRef, useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { liftFromPane, updateOnPane, type PaneScript } from '../../data/paneScripts';

/** The legend's words for an own-pane script past the cap of own panes (StrikeChart's script effect hands it) */
export const SCRIPT_CAP_NOTE = 'Two own panes are the cap: turn one off and this one takes its place';

const summary = (ps: PaneScript): string =>
  (ps.script.meta?.inputs ?? [])
    .map(i => ps.chart.inputs[i.id] ?? i.default)
    .filter(v => typeof v === 'number' || (typeof v === 'string' && !v.startsWith('#')))
    .slice(0, 6)
    .join(' ');

/** Pixels from the chart box's top to just under the host's floating chrome,
    and the chrome blocks that decided it (so they can be watched) */
const clearance = (root: HTMLElement): { top: number; chrome: HTMLElement[] } => {
  const box = root.parentElement?.getBoundingClientRect();
  if (!box || box.height === 0) return { top: 8, chrome: [] };
  let low = 0;
  const chrome: HTMLElement[] = [];
  document.querySelectorAll<HTMLElement>('[data-chart-chrome]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const overlaps = r.right > box.left && r.left < box.right && r.bottom > box.top && r.top < box.top + box.height / 3;
    if (!overlaps) return;
    low = Math.max(low, r.bottom - box.top);
    chrome.push(el);
  });
  return { top: Math.max(8, Math.round(low) + 4), chrome };
};

/** `faults`: the scripts whose last run on this pane failed, and why (StrikeChart); `left`: past the drawing rail where it
    is docked left and open, as the legend and the readout stand (the round-3 audit, D: it sat at 12 px under the rail) */
const ScriptLegend = ({ paneId, scripts, faults, left = 12 }: { paneId: string; scripts: PaneScript[]; faults?: ReadonlyMap<string, string>; left?: number }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [top, setTop] = useState(8);
  /* Measured after every render (the chrome can appear later — a compare
     added), whenever the chart's box resizes (the strip wraps), and whenever
     a chrome block itself changes size (a readout that fills in a beat after
     full screen opens). */
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const { top: next, chrome } = clearance(root);
      setTop(t => (next === t ? t : next));
      return chrome;
    };
    const chrome = measure();
    const box = root.parentElement;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(box);
    chrome.forEach(el => ro.observe(el));
    return () => ro.disconnect();
  });
  return (
    <div ref={rootRef} style={{ top, left }} className="absolute z-10 flex flex-col items-start gap-[3px] pointer-events-none select-none" aria-label="Scripts on this pane" data-script-legend>
      {scripts.map(ps => {
        const on = ps.chart.visible;
        const fault = faults?.get(ps.chart.id) ?? null;
        const broken = ps.script.status !== 'ok' || !!fault;
        return (
          <div
            key={ps.chart.id}
            className="group pointer-events-auto inline-flex items-center gap-1.5 h-[20px] pl-1.5 pr-1 rounded bg-canvas/75 backdrop-blur-[2px] font-mono text-[11px] leading-none"
            data-legend-row={ps.script.id}
            data-hidden={!on || undefined}
          >
            <span className={`whitespace-nowrap ${on && !broken ? 'text-textPrimary' : 'text-textMuted'}`}>{ps.script.title}</span>
            {summary(ps) && <span className="text-textMuted whitespace-nowrap tnum">{summary(ps)}</span>}
            {/* a state, in the warn ink (red and green are the direction pair alone), sentence case; the reason in its title */}
            {broken && (
              <span className="text-warn text-[11px]" title={fault ?? ps.script.error?.message ?? undefined} data-legend-fault>
                {fault === SCRIPT_CAP_NOTE ? 'no pane free' : fault ? 'does not run' : 'does not read'}
              </span>
            )}
            {/* the eye and the × come up under the pointer AND under the keys or a touch (focus-within), never hidden from them */}
            <span className={`inline-flex items-center gap-0.5 ${on ? 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100' : ''} transition-opacity`}>
              <button
                onClick={() => void updateOnPane(paneId, { ...ps.chart, visible: !on })}
                aria-pressed={!on}
                title={on ? 'Hide it — it stays on the pane' : 'Show it'}
                className="hit p-0.5 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.08] transition-colors"
                data-legend-eye
              >
                {on ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
              <button onClick={() => void liftFromPane(paneId, ps.chart.id)} title="Take it off this pane" aria-label="Take it off this pane" className="hit p-0.5 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.08] transition-colors" data-legend-remove>
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default ScriptLegend;
