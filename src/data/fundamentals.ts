/*
==================================================
  SLAYER TERMINAL - FUNDAMENTALS, A SAMPLE (data/fundamentals.ts)

  THE SEAM for a name's numbers (the stock overview
  page, 2026-09-13). The simulator has no earnings
  statements, so until the launch's provider lands
  every figure here is a SAMPLE — deterministic per
  name, plausible for its sector, and marked so on
  the page. The shape is the contract the feed
  fills: replace `sampleFundamentals` with the
  provider's read and nothing above it changes.
==================================================
*/

import { dayKey, hGauss, hRange } from '../core/rng';
import { buildEarningsDossier } from './earnings';

export type Valuation = 'undervalued' | 'fairly valued' | 'overvalued';

export interface Fundamentals {
  /** SAMPLE until the feed lands — the page says so */
  sample: boolean;
  /** Last reported quarter: the estimate and the print, EPS in dollars, revenue in $B */
  epsEstimate: number;
  epsActual: number;
  epsSurprisePct: number;
  revenueEstimateB: number;
  revenueActualB: number;
  revenueSurprisePct: number;
  /** Beats of the estimate in the last eight quarters */
  beats: number;
  /** Year on year */
  revenueGrowthPct: number;
  epsGrowthPct: number;
  operatingMarginPct: number;
  freeCashFlowMarginPct: number;
  pe: number;
  sectorMedianPe: number;
  evToSales: number;
  peg: number;
  /** Where the P/E sits among the sector, 0–100 */
  sectorPercentile: number;
  fairValue: number;
  vsFairValuePct: number;
  valuation: Valuation;
  /** 0–100 */
  healthScore: number;
  /** Guidance's last change: raised · held · cut */
  guidance: 'raised' | 'held' | 'cut';
}

const SECTOR_PE: Record<string, number> = {
  Technology: 28,
  Communication: 22,
  'Consumer Discretionary': 24,
  'Consumer Staples': 19,
  Financials: 13,
  'Health Care': 20,
  Industrials: 19,
  Energy: 11,
  Materials: 15,
  Utilities: 17,
  'Real Estate': 30,
};
const SECTOR_MARGIN: Record<string, number> = {
  Technology: 26,
  Communication: 22,
  'Consumer Discretionary': 12,
  'Consumer Staples': 14,
  Financials: 30,
  'Health Care': 18,
  Industrials: 13,
  Energy: 16,
  Materials: 14,
  Utilities: 18,
  'Real Estate': 35,
};

/** A name's numbers, invented on its own hash — the same every time the page opens on a day */
export function sampleFundamentals(ticker: string, price: number, sector: string | null): Fundamentals {
  const day = dayKey();
  const s = (tag: string) => `${ticker}-${day}-fund-${tag}`;
  const sectorPe = SECTOR_PE[sector ?? ''] ?? 20;
  const sectorMargin = SECTOR_MARGIN[sector ?? ''] ?? 16;
  /* the earnings page's last quarters, where the calendar has the name — the two pages must agree */
  const dossier = buildEarningsDossier(ticker);
  const q = dossier?.quarters[dossier.quarters.length - 1];
  const beats = dossier ? dossier.quarters.filter(x => x.epsBeat).length : Math.round(hRange(s('beats'), 2, 8));
  const epsEstimate = q ? q.epsEst : Number(hRange(s('eps'), 0.4, 6).toFixed(2));
  const epsActual = q ? q.epsActual : Number((epsEstimate * (1 + hGauss(s('sur')) * 0.06)).toFixed(2));
  const revenueEstimateB = q ? q.revEstB : Number(hRange(s('rev'), 2, 60).toFixed(1));
  const revenueActualB = q ? q.revActualB : Number((revenueEstimateB * (1 + hGauss(s('rsur')) * 0.03)).toFixed(1));
  const revenueGrowthPct = Number((hGauss(s('g')) * 9 + 8).toFixed(1));
  const epsGrowthPct = Number((revenueGrowthPct * 1.4 + hGauss(s('eg')) * 8).toFixed(1));
  const operatingMarginPct = Number(Math.max(1, sectorMargin + hGauss(s('m')) * 6).toFixed(1));
  const freeCashFlowMarginPct = Number(Math.max(0, operatingMarginPct * 0.7 + hGauss(s('f')) * 3).toFixed(1));
  const pe = Number(Math.max(6, sectorPe * (1 + hGauss(s('pe')) * 0.35)).toFixed(1));
  const evToSales = Number(Math.max(0.5, (pe / 8) * (1 + hGauss(s('ev')) * 0.2)).toFixed(1));
  const peg = Number(Math.max(0.3, pe / Math.max(3, epsGrowthPct)).toFixed(2));
  const sectorPercentile = Math.round(Math.max(2, Math.min(98, 50 + ((pe - sectorPe) / sectorPe) * 120)));
  const vsFairValuePct = Number((hGauss(s('fv')) * 14).toFixed(1));
  const fairValue = Number((price / (1 + vsFairValuePct / 100)).toFixed(2));
  const valuation: Valuation = vsFairValuePct <= -8 ? 'undervalued' : vsFairValuePct >= 8 ? 'overvalued' : 'fairly valued';
  const healthScore = Math.round(Math.max(15, Math.min(96, 62 + operatingMarginPct * 0.6 + hGauss(s('h')) * 12)));
  const gr = hGauss(s('guid'));
  return {
    sample: true,
    epsEstimate,
    epsActual,
    epsSurprisePct: Number((((epsActual - epsEstimate) / Math.max(0.01, Math.abs(epsEstimate))) * 100).toFixed(1)),
    revenueEstimateB,
    revenueActualB,
    revenueSurprisePct: Number((((revenueActualB - revenueEstimateB) / Math.max(0.01, revenueEstimateB)) * 100).toFixed(1)),
    beats,
    revenueGrowthPct,
    epsGrowthPct,
    operatingMarginPct,
    freeCashFlowMarginPct,
    pe,
    sectorMedianPe: sectorPe,
    evToSales,
    peg,
    sectorPercentile,
    fairValue,
    vsFairValuePct,
    valuation,
    healthScore,
    guidance: gr > 0.6 ? 'raised' : gr < -0.6 ? 'cut' : 'held',
  };
}
