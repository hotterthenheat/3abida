/*
==================================================
  SLAYER TERMINAL - COMMAND COCKPIT MODEL (command.ts)
  Dealer pressure matrix, key-levels rail, order-flow
  delta and auto market notes, derived from the
  simulator. Placeholder data contract — swaps for the
  real feed later.
==================================================
*/

import type { MarketSnapshot } from '../types/market';
import type {
  PulseView,
  DealerBias,
  DeltaByPrice,
  DeltaPoint,
  KeyLevelRow,
  KeyLevels,
  OrderFlowData,
  PressureRow,
} from '../types/gex';

// ---- deterministic RNG ------------------------------------------------------
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function h01(seed: string): number {
  return (hash(seed) % 1000) / 1000;
}

// ---- dealer pressure matrix -------------------------------------------------
function buildPressure(snapshot: MarketSnapshot, levels: KeyLevels, half: number): { rows: PressureRow[]; maxAbs: number } {
  const { ticker, spot, chain } = snapshot;
  const desc = [...chain].sort((a, b) => b.strike - a.strike);
  const spotIdx = Math.max(0, desc.findIndex(n => n.strike <= spot));
  const start = Math.max(0, spotIdx - half);
  const window = desc.slice(start, start + half * 2 + 1);

  // Pin = max total OI in the window
  let pinStrike = window[0]?.strike ?? spot;
  let pinOI = 0;
  for (const n of window) {
    if (n.callOI + n.putOI > pinOI) {
      pinOI = n.callOI + n.putOI;
      pinStrike = n.strike;
    }
  }
  // Flip row = strike nearest the flip level
  let flipStrike = window[0]?.strike ?? spot;
  let flipDist = Infinity;
  for (const n of window) {
    const d = Math.abs(n.strike - levels.flip);
    if (d < flipDist) {
      flipDist = d;
      flipStrike = n.strike;
    }
  }

  let maxAbs = 1;
  const rows: PressureRow[] = window.map(n => {
    const jc = h01(`${ticker}-${n.strike}-cp`);
    const jp = h01(`${ticker}-${n.strike}-pp`);
    const call = {
      pressure: n.callGex * (0.7 + jc * 0.6),
      deltaOI: Math.round((jc - 0.45) * n.callOI * 0.3),
      volume: Math.round(n.callOI * (0.25 + jc * 0.55)),
    };
    const put = {
      pressure: n.putGex * (0.7 + jp * 0.6),
      deltaOI: Math.round((jp - 0.45) * n.putOI * 0.3),
      volume: Math.round(n.putOI * (0.25 + jp * 0.55)),
    };
    const net = call.pressure + put.pressure;
    maxAbs = Math.max(maxAbs, Math.abs(call.pressure), Math.abs(put.pressure), Math.abs(net));
    return { strike: n.strike, pin: n.strike === pinStrike, flip: n.strike === flipStrike, call, put, net };
  });

  return { rows, maxAbs };
}

// ---- key-levels rail ----------------------------------------------------------
function pressureAt(snapshot: MarketSnapshot, price: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (const n of snapshot.chain) {
    const d = Math.abs(n.strike - price);
    if (d < bestDist) {
      bestDist = d;
      best = Math.abs(n.netGex);
    }
  }
  return best;
}

/** The structural ladder's rows — exported so the Pinpoint ladder card can
    mount the same Levels view off its own book (2026-09-05). */
export function buildKeyLevels(snapshot: MarketSnapshot, levels: KeyLevels, pin: number): KeyLevelRow[] {
  const { spot } = snapshot;
  const dist = (price: number) => ((price - spot) / spot) * 100;
  const rows: KeyLevelRow[] = [
    { kind: 'call-wall', label: 'Call Wall', price: levels.callWall, distPct: dist(levels.callWall), pressure: pressureAt(snapshot, levels.callWall) },
    { kind: 'spot', label: 'Spot', price: spot, distPct: 0, pressure: 0 },
    { kind: 'put-wall', label: 'Put Wall', price: levels.putWall, distPct: dist(levels.putWall), pressure: pressureAt(snapshot, levels.putWall) },
    { kind: 'pin', label: 'Pin Level', price: pin, distPct: dist(pin), pressure: pressureAt(snapshot, pin) },
    { kind: 'flip', label: 'Flip Level', price: levels.flip, distPct: dist(levels.flip), pressure: pressureAt(snapshot, levels.flip) },
    { kind: 'supreme', label: 'Supreme Node', price: levels.supreme, distPct: dist(levels.supreme), pressure: pressureAt(snapshot, levels.supreme) },
  ];
  // Price-descending like a ladder, spot embedded naturally
  return rows.sort((a, b) => b.price - a.price);
}

// ---- order flow ---------------------------------------------------------------
function buildOrderFlow(snapshot: MarketSnapshot): OrderFlowData {
  const { ticker, spot, priceHistory } = snapshot;

  // Cumulative delta follows intraday price impulses with deterministic noise
  const cumulativeDelta: DeltaPoint[] = [];
  let cum = 0;
  for (let i = 1; i < priceHistory.length; i++) {
    const move = priceHistory[i] - priceHistory[i - 1];
    const noise = (h01(`${ticker}-cd-${i}`) - 0.5) * 0.4;
    cum += (move / spot) * 8e9 + noise * 2e7;
    cumulativeDelta.push({ minute: i, value: cum });
  }

  // Delta by price — bucketed around the session range
  const lo = Math.min(...priceHistory);
  const hi = Math.max(...priceHistory);
  const BUCKETS = 12;
  const width = (hi - lo) / BUCKETS || 1;
  const deltaByPrice: DeltaByPrice[] = [];
  let poc = spot;
  let pocVol = 0;
  for (let b = 0; b < BUCKETS; b++) {
    const price = lo + width * (b + 0.5);
    let value = 0;
    let vol = 0;
    for (let i = 1; i < priceHistory.length; i++) {
      if (priceHistory[i] >= lo + width * b && priceHistory[i] < lo + width * (b + 1)) {
        value += (priceHistory[i] - priceHistory[i - 1]) * 4e7;
        vol += 1;
      }
    }
    if (vol > pocVol) {
      pocVol = vol;
      poc = price;
    }
    deltaByPrice.push({ price: Number(price.toFixed(2)), value });
  }

  const netDelta = cumulativeDelta[cumulativeDelta.length - 1]?.value ?? 0;
  const gross = Math.abs(netDelta) + 6e8 + h01(`${ticker}-gross`) * 4e8;
  const buyVolume = (gross + netDelta) / 2;
  const sellVolume = (gross - netDelta) / 2;
  const vwap = priceHistory.reduce((a, p) => a + p, 0) / (priceHistory.length || 1);

  return {
    cumulativeDelta,
    deltaByPrice,
    buyVolume,
    sellVolume,
    netDelta,
    vwap: Number(vwap.toFixed(2)),
    poc: Number(poc.toFixed(2)),
  };
}

// ---- auto market notes ----------------------------------------------------------
/** One generated observation per scan, or null when nothing is notable. */
export function makeAutoNote(snapshot: MarketSnapshot, levels: KeyLevels, bias: DealerBias): string | null {
  const { spot } = snapshot;
  const pct = (a: number, b: number) => Math.abs((a - b) / b) * 100;
  const fmt = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

  if (pct(spot, levels.callWall) < 0.15)
    return `Spot testing ${fmt(levels.callWall)} call wall; dealer supply concentrated overhead.`;
  if (pct(spot, levels.putWall) < 0.15)
    return `Spot pressing ${fmt(levels.putWall)} put wall; dealer support being tested.`;
  if (pct(spot, levels.flip) < 0.12)
    return `Price is at the ${fmt(levels.flip)} gamma flip — dealer hedging switches direction here.`;
  if (spot < levels.flip)
    return `Trading below the ${fmt(levels.flip)} flip; dealers short gamma — expect amplified moves.`;
  if (bias === 'BULLISH')
    return `Supportive positioning above ${fmt(levels.flip)}; dips into ${fmt(levels.putWall)} likely absorbed.`;
  return null;
}

// ---- top-level assembly ----------------------------------------------------------
export function buildPulseView(snapshot: MarketSnapshot): PulseView {
  const { chain, spot, plan } = snapshot;

  // Supreme = max |netGex| strike (same rule as the chart levels)
  let supreme = spot;
  let supremeAbs = 0;
  for (const n of chain) {
    if (Math.abs(n.netGex) > supremeAbs) {
      supremeAbs = Math.abs(n.netGex);
      supreme = n.strike;
    }
  }
  const levels: KeyLevels = {
    spot,
    callWall: plan.resistanceWall,
    putWall: plan.supportWall,
    flip: plan.flipZone,
    supreme,
  };

  const { rows, maxAbs } = buildPressure(snapshot, levels, 10);
  const pin = rows.find(r => r.pin)?.strike ?? spot;

  const netGex = chain.reduce((a, n) => a + n.netGex, 0);
  // Sim side-coding: calls NEGATIVE / puts POSITIVE, so a positive aggregate
  // is a put-dominant, short-gamma (amplifying) book — same convention as
  // exposure.ts buildExposureProfile (unified 2026-08-18).
  const threshold = supremeAbs * 0.8;
  let bias: DealerBias = 'NEUTRAL';
  let biasNote = 'Balanced positioning';
  if (netGex > threshold) {
    bias = 'BEARISH';
    biasNote = 'Net short gamma';
  } else if (netGex < -threshold) {
    bias = 'BULLISH';
    biasNote = 'Net long gamma';
  }

  return {
    pressure: rows,
    pressureMaxAbs: maxAbs,
    keyLevels: buildKeyLevels(snapshot, levels, pin),
    orderFlow: buildOrderFlow(snapshot),
    bias,
    biasNote,
  };
}
