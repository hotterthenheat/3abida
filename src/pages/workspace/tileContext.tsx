/*
==================================================
  SLAYER TERMINAL - A PANEL'S CONTEXT (pages/workspace/tileContext.tsx)

  What a Pulse panel reads, built for one name, and the
  body that hands it to the panel — moved out of Pulse.tsx
  on 2026-10-10 so a panel can stand in a window of its
  own (pages/popout/PopOut.tsx) on exactly the context the
  desk gives it.
==================================================
*/

import { memo, useMemo, useRef, type ReactNode } from 'react';
import { marketStore, useMarketBackground } from '../../context/marketStore';
import Simulator from '../../core/simulator';
import { buildGexView } from '../../data/gex';
import { buildExposureProfile } from '../../data/exposure';
import { buildPulseView } from '../../data/pulse';
import { buildVannaCharm } from '../../data/vannacharm';
import { buildCompassView } from '../../data/compass';
import type { WorkspaceCtx } from './registry';
import type { MarketSnapshot } from '../../types/market';

/* ---- THE TILE READS THE TICK, NOT THE DESK (2026-10-10, the speed store) ------------------------------------------

   The desk used to render on every tick and on a one-second heat timer, and every render built every panel's context
   again — so every panel on the desk rendered two and a half times a second, whatever it showed, and the contexts'
   spread read the lazy views (the pulse view, the vanna read, the whole Compass board) that were meant to be built
   only for a panel that asks. Now the desk renders on the 10 s scan and on what a person does; each tile reads the
   tick itself, and only if its panel ever reads the tick's two live fields (`revision`, `liveSpot`) — a panel of the
   scan alone (the targets, the walls, the news) renders on the scan alone. */

/** A copy of a context that keeps its lazy views lazy — a spread would build them all */
export const extendCtx = (base: WorkspaceCtx, extra: Partial<WorkspaceCtx>): WorkspaceCtx => {
  const out = Object.defineProperties({}, Object.getOwnPropertyDescriptors(base)) as WorkspaceCtx;
  for (const [k, v] of Object.entries(extra)) Object.defineProperty(out, k, { value: v, enumerable: true, configurable: true, writable: true });
  return out;
};

/** The live fields, read off the published tick — the getter marks the tile as one that reads them */
export const withLive = (ctx: WorkspaceCtx, mark: () => void): WorkspaceCtx => {
  const s = marketStore.get();
  Object.defineProperty(ctx, 'revision', {
    get: () => (mark(), s.seq),
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(ctx, 'liveSpot', {
    get: () => (mark(), s.quotes[ctx.ticker]?.spot ?? (s.snapshot?.ticker === ctx.ticker ? s.snapshot.spot : ctx.snapshot.spot)),
    enumerable: true,
    configurable: true,
  });
  return ctx;
};

interface TileBodyProps {
  base: WorkspaceCtx;
  render: (ctx: WorkspaceCtx) => ReactNode;
  extra: Partial<WorkspaceCtx>;
}

/** One panel's body: its context built once per scan, per tick only when the panel reads the tick */
export const TileBody = memo(({ base, render, extra }: TileBodyProps) => {
  const live = useRef(false);
  const seq = useMarketBackground(s => (live.current ? s.seq : 0));
  /* the functions are called through to the latest render's — the context is rebuilt only when a value moves */
  const latest = useRef(extra);
  latest.current = extra;
  const extraKey = Object.values(extra).map(v => (typeof v === 'function' ? 'fn' : String(v))).join('|');
  const ctx = useMemo(
    () => {
      const through = Object.fromEntries(
        Object.entries(extra).map(([k, v]) => [k, typeof v === 'function' ? (...a: unknown[]) => (latest.current[k as keyof WorkspaceCtx] as (...a: unknown[]) => unknown)?.(...a) : v])
      ) as Partial<WorkspaceCtx>;
      return withLive(extendCtx(base, through), () => {
        live.current = true;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, seq, extraKey]
  );
  return <>{useMemo(() => render(ctx), [render, ctx])}</>;
});

/** Build the whole widget context for one name. */
export const buildCtxFor = (snapshot: MarketSnapshot): WorkspaceCtx => {
  const gex = buildGexView(snapshot, 'GEX', 10);
  /* THE VIEWS A DESK DOES NOT SHOW ARE NEVER BUILT (2026-09-06, the perf
     sweep): every scan used to build the pulse view, the vanna/charm read
     and the whole Compass board for a desk of three charts that read none
     of them. They are getters now — built the first time a panel asks,
     remembered for the rest of the scan. */
  const lazy = <T,>(build: () => T) => {
    let v: T | undefined;
    let built = false;
    return () => {
      if (!built) {
        v = build();
        built = true;
      }
      return v as T;
    };
  };
  const pulse = lazy(() => buildPulseView(snapshot));
  const vanna = lazy(() => buildVannaCharm(snapshot, 'CHARM', -1));
  const setups = lazy(() => buildCompassView(snapshot, 'top-setups', Simulator.universeQuotes(snapshot.ticker)));
  const ctx = {
    ticker: snapshot.ticker,
    snapshot,
    revision: 0, // the tile's own read of the tick (TileBody)
    /* the 1 s heat the matrix once pulsed with — no panel reads it now; kept on the context, unpulsed */
    pulseTick: 0,
    gex,
    matrix: gex.matrix,
    exposure: buildExposureProfile(snapshot, '0DTE', 10),
  } as WorkspaceCtx;
  Object.defineProperty(ctx, 'pulse', { get: pulse, enumerable: true, configurable: true });
  Object.defineProperty(ctx, 'vanna', { get: vanna, enumerable: true, configurable: true });
  Object.defineProperty(ctx, 'setups', { get: setups, enumerable: true, configurable: true });
  return ctx;
};
