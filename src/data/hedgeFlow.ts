/*
==================================================
  SLAYER TERMINAL - THE HEDGE FLOW FORECAST
  (data/hedgeFlow.ts)

  "A push to 462 forces about $180M of dealer
  selling." — the Pinpoint roadmap's flow ladder
  beside the price ladder (2026-09-05). HOW HARD,
  PER PATH: for every strike the map shows, the
  dollars of stock dealers must trade to stay
  hedged if price walks from here to there.

  THE ARITHMETIC (P-18): net gamma at a strike is
  dollars of dealer hedging per 1% move,
  so the flow a path forces is the gamma crossed
  along it times the size of the move —

      flow(K) = Σ netGex(k) · (K − S) / S · 100
                k between S and K, both ends in

  — signed so POSITIVE means dealers must BUY. The
  house convention carries the meaning: net gamma
  above zero amplifies (dealers chase the move,
  buying a rally and selling a drop), below zero
  absorbs (they sell the rally, buy the drop). A row
  whose forced flow points the SAME way as the move
  speeds it up; one that points against it slows it.

  Built on the LENS THE RAIL DRAWS — the expiry
  profile's strikes, not the raw chain — so the flow
  beside a bar is the flow of that bar's book.

  THE ASSUMPTION IS LOAD-BEARING: continuous delta
  hedging at the modelled sign, over the book as it
  stands now. Real dealers hedge in steps and on
  their own schedule.
==================================================
*/

import type { ExposureProfileData } from '../types/gex';

export interface FlowRung {
  strike: number;
  /** Signed dollars: positive = dealers must buy, negative = sell */
  flow: number;
  /** The move from spot to the strike, percent, signed */
  movePct: number;
  /** True when the forced flow points the way the move does — it speeds the move up */
  amplifies: boolean;
  /** "up to 485: about $210M of dealer selling — slows the move" */
  words: string;
}

export interface FlowLadder {
  spot: number;
  rungs: FlowRung[];
  /** The largest |flow| on the ladder — the bar scale */
  maxAbs: number;
}

const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

/** "$1.4B" · "$180M" · "$40K" — the flow's own rounding, coarser than fmtUsd's */
export function fmtFlow(mag: number): string {
  const a = Math.abs(mag);
  if (a >= 1e9) return `$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(a / 1e6).toFixed(0)}M`;
  if (a >= 1e3) return `$${(a / 1e3).toFixed(0)}K`;
  return `$${a.toFixed(0)}`;
}

export function buildHedgeFlowLadder(profile: ExposureProfileData): FlowLadder {
  return buildFlowFromRows(
    profile.strikes.map(s => ({ strike: s.strike, value: s.gex.net })),
    profile.levels.spot
  );
}

/** The same arithmetic off bare rows — net gamma per strike — for a host that
    holds the chain rather than an expiry profile (the Terrain panes' panel
    reads the simulator's book straight). One sum, two callers. */
export function buildFlowFromRows(rows: readonly { strike: number; value: number }[], spot: number): FlowLadder {
  const rungs: FlowRung[] = [];
  let maxAbs = 0;
  for (const s of rows) {
    const K = s.strike;
    if (Math.abs(K - spot) < 1e-9) continue;
    const lo = Math.min(spot, K);
    const hi = Math.max(spot, K);
    let crossed = 0;
    for (const t of rows) if (t.strike >= lo && t.strike <= hi) crossed += t.value;
    const movePct = ((K - spot) / spot) * 100;
    const flow = crossed * movePct;
    const up = K > spot;
    const amplifies = flow !== 0 && (flow > 0) === up;
    const side = flow >= 0 ? 'buying' : 'selling';
    const words = flow === 0 ? `${up ? 'up' : 'down'} to ${fmtStrike(K)}: no forced flow` : `${up ? 'up' : 'down'} to ${fmtStrike(K)}: about ${fmtFlow(flow)} of dealer ${side} — ${amplifies ? 'speeds the move up' : 'slows the move'}`;
    rungs.push({ strike: K, flow, movePct, amplifies, words });
    maxAbs = Math.max(maxAbs, Math.abs(flow));
  }
  rungs.sort((a, b) => b.strike - a.strike);
  return { spot, rungs, maxAbs };
}

