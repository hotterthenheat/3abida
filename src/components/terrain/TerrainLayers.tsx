/*
==================================================
  SLAYER TERMINAL - A TERRAIN PANE'S OWN LAYERS
  (components/terrain/TerrainLayers.tsx)

  What a Terrain pane draws on its chart beyond the
  chart's own overlays, handed in through StrikeChart's
  `layer` (the chart in hand, nothing over the plot):

    WALLS THROUGH THE DAY   wallsHeatPrimitive — the
                            strike × time heat behind
                            the candles, in the pane's
                            lens (GEX · Charm · DEX)
    THE SESSION'S PHASES    sessionPhasesPrimitive —
                            quiet bands for the open,
                            lunch and power hour (and
                            the extended hours when a
                            tape carries them)

  Both are pane primitives attached once to the chart's
  first pane — a style swap replaces the price series,
  never the pane — and both read the series afresh each
  paint. Inks are tokens, read off the pane's own box.
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import type { ChartLayerApi } from '../gex/StrikeChart';
import { resolveInk } from '../gex/paletteInk';
import { WallsHeatPrimitive, type WallsLens } from './wallsHeatPrimitive';
import { SessionPhasesPrimitive, type PhaseInks } from './sessionPhasesPrimitive';

interface Props {
  api: ChartLayerApi;
  ticker: string;
  walls: boolean;
  lens: WallsLens;
  phases: boolean;
  /** The tape's own ground — the paper ramp and the paper washes on a light one */
  ground: 'light' | 'dark';
}

const TerrainLayers = ({ api, ticker, walls, lens, phases, ground }: Props) => {
  const wallsRef = useRef<WallsHeatPrimitive | null>(null);
  const phasesRef = useRef<SessionPhasesPrimitive | null>(null);
  const apiRef = useRef(api);
  apiRef.current = api;
  /* a render once attached, so the settings below land on the new primitives */
  const [, setTick] = useState(0);

  /* attach once the chart exists — a child's effect runs before the chart's own mount, so wait a frame or two */
  useEffect(() => {
    let raf = 0;
    let attachedTo: ReturnType<ChartLayerApi['chart']> = null;
    const w = new WallsHeatPrimitive();
    const p = new SessionPhasesPrimitive();
    w.getSeries = () => apiRef.current.series();
    p.getSeries = () => apiRef.current.series();
    w.onPaint = ms => {
      const host = apiRef.current.host();
      if (host) host.dataset.wallsPaintMs = ms.toFixed(1);
    };
    const tryAttach = () => {
      const chart = apiRef.current.chart();
      if (!chart) {
        raf = requestAnimationFrame(tryAttach);
        return;
      }
      const pane = chart.panes()[0];
      pane.attachPrimitive(p);
      pane.attachPrimitive(w);
      attachedTo = chart;
      wallsRef.current = w;
      phasesRef.current = p;
      setTick(n => n + 1);
    };
    tryAttach();
    return () => {
      cancelAnimationFrame(raf);
      if (attachedTo) {
        try {
          const pane = attachedTo.panes()[0];
          pane.detachPrimitive(w);
          pane.detachPrimitive(p);
        } catch {
          /* the chart went first */
        }
      }
      wallsRef.current = null;
      phasesRef.current = null;
    };
  }, []);
  useEffect(() => {
    wallsRef.current?.set({ ticker, lens, enabled: walls, paper: ground === 'light' });
  });
  useEffect(() => {
    const host = apiRef.current.host();
    const ink = (css: string) => resolveInk(css, host);
    const light = ground === 'light';
    const inks: PhaseInks = {
      band: {
        pre: ink(`rgb(var(--moon) / ${light ? 0.07 : 0.05})`),
        open: ink(`rgb(var(--ink) / ${light ? 0.05 : 0.045})`),
        lunch: ink(`rgb(var(--ink) / ${light ? 0.035 : 0.03})`),
        power: ink(`rgb(var(--ink) / ${light ? 0.05 : 0.045})`),
        after: ink(`rgb(var(--moon) / ${light ? 0.07 : 0.05})`),
      },
      word: ink('rgb(var(--text-muted) / 0.85)'),
    };
    phasesRef.current?.set({ enabled: phases, inks });
  });
  return null;
};

export default TerrainLayers;
