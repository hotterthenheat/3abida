/*
  RP&L · UP&L — the chart's two figures (Noah, 2026-09-22, with a picture of a futures platform's chart: "there shouyld be a
  rp&l and a up&l"). RP&L is what the name has BANKED today — its trades closed today, and what an open one has taken off in
  pieces, fees in (the engines' `bankedOf`); UP&L is what is OPEN on it, up or down, now. Solid badges in the chips' grammar
  (PositionLayer): green up, red down, the dark words on them — and quiet, in the tape's own ground, at nothing. The
  block is index.css's `.fill-bull` / `.fill-bear`: solid on a dark ground, soft on a light one (2026-09-26).
  They sit at the chart's top left, after its name ("ES · 1m"), and are stamped `data-chart-chrome`: the scripts' legend
  goes under them. IN THE FULL SCREEN they ride the top strip instead, between the intervals and the indicators (Noah,
  2026-09-22) — DeskShell puts them there, without the lift off a chart they no longer float over.
*/

import { usdSigned } from './words';

const tone = (v: number) => (v >= 0.005 ? 'fill-bull' : v <= -0.005 ? 'fill-bear' : 'bg-panel text-textSecondary border border-borderMuted');
const badge = 'h-6 inline-flex items-center px-2 rounded-[3px] font-mono text-[11px] font-semibold tnum whitespace-nowrap shadow-[0_3px_10px_rgba(0,0,0,0.35)]';

interface Props {
  name: string;
  realized: number;
  unrealized: number;
  /** Which day RP&L is of, in words ("today", "Mar 14") */
  dayWord: string;
}

const PnlBadges = ({ name, realized, unrealized, dayWord }: Props) => (
  <span className="inline-flex items-center gap-1 pointer-events-auto cursor-default" data-pnl-badges={name}>
    <span className={`${badge} ${tone(realized)}`} title={`Realized — what ${name} has banked ${dayWord}: the trades closed, and what an open one has taken off in pieces, fees in`} data-pnl-realized>
      RP&amp;L: {usdSigned(realized)}
    </span>
    <span className={`${badge} ${tone(unrealized)}`} title={`Unrealized — what is open on ${name}, up or down, right now, fees in`} data-pnl-open>
      UP&amp;L: {usdSigned(unrealized)}
    </span>
  </span>
);

export default PnlBadges;
