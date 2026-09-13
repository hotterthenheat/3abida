/*
==================================================
  SLAYER TERMINAL - CONTRACT FLOW PANELS
  Two strips of ONE instrument — the drilldown stacks
  them on a shared clock:

    FlowPanel   — the flow of the CONTRACT itself as
                  THE LEDGER: every print is a brick,
                  stacked per bar interval — buyers
                  who paid the offer stack up, sellers
                  who hit the bid stack down, mid
                  fills straddle the zero line. Top
                  strip: its x-axis is present but
                  unlabelled, because the strip below
                  prints the clock once.
    NetPanel    — the UNDERLYING's cumulative net
                  call vs put premium with price on
                  top, and the four books that make
                  it up. Bottom strip: owns the axis.

  Both accept a printMin: the minute of the print the
  drilldown was opened from, drawn as one lime line
  through BOTH strips — the terminal pointing at the
  moment you clicked. Window controls (range, bars,
  single-leg) live in the drilldown's shared toolbar,
  not here. Every label is spelled out — the
  competition ships "NCP / NPP / RVOL" and expects
  you to already know.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import CompanyLogo from '../ui/CompanyLogo';
import { Check, ChevronDown } from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Customized,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  useXAxisScale,
  useYAxisScale,
} from 'recharts';
import Chip from '../ui/Chip';
import RichRead from '../ui/RichRead';
import { flowAxisLabel, flowClock, sessionDate, type ContractFlow, type ContractPrintPoint } from '../../data/contractflow';
import { fmtUsd } from '../../data/gex';
import { BULL, SUPREME } from '../gex/paletteInk';
import { Name } from '../ui/Name';

const ASK = BULL; // lifted the offer — the market's bull colour
const BID = '#FF3B30';
const FENCE = 'rgba(237,237,237,0.3)'; // mid fills — undecided, sits ON the zero line
const PRICE_LINE = '#ededed'; // neutral "where the market is"
const IV_LINE = '#B39DDB'; // muted violet — a different axis, a different family (left the sky lane when the supreme took it, 2026-08-29)
const AXIS = '#7d7d7d'; // matches textMuted — axis labels were the squintiest gray on the page
const GRID = 'rgba(255,255,255,0.05)';

/* Stacked strips only read as one instrument if their plot areas align to the
   pixel. Same left axis width, and the right gutter is reserved even when the
   optional right axis is off — otherwise toggling IV or price shears the two
   clocks apart. */
const Y_LEFT_W = 56;
const Y_RIGHT_W = 44;
const RIGHT_PAD = 6;

/** The moment-marker — the print the drilldown was opened from. White, not
    lime (Noah, 2026-08-18): white = "where", the same voice as the spot rule. */
const printLine = (min: number, yAxisId: string, withLabel: boolean) => (
  <ReferenceLine
    x={min}
    yAxisId={yAxisId}
    stroke={PRICE_LINE}
    strokeOpacity={0.9}
    strokeDasharray="4 3"
    label={
      withLabel
        ? { value: 'THIS PRINT', position: 'insideTopLeft', fill: PRICE_LINE, fontSize: 9, fontFamily: "'SF Pro', sans-serif", offset: 8 }
        : undefined
    }
  />
);

const axisTick = { fill: AXIS, fontSize: 9, fontFamily: "'SF Pro', sans-serif" };

const Box = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded border border-borderMuted bg-panel px-2.5 py-1.5 shadow-2xl shadow-black/60 font-mono text-[10px]">
    {children}
  </div>
);

// Moved to ui/Chip so light callers don't pull recharts; re-exported for compat.
export { default as Chip } from '../ui/Chip';

/** One figure in a panel's stat strip. */
const Stat = ({ label, value, tone = 'text-textPrimary' }: { label: string; value: string; tone?: string }) => (
  <span className="flex flex-col gap-0.5 min-w-0">
    <span className="font-mono text-[9px] uppercase tracking-wider text-textMuted truncate">{label}</span>
    <span className={`font-mono text-[12px] font-semibold tnum ${tone} truncate`}>{value}</span>
  </span>
);

/**
 * A two-sided share bar with both ends named. Same tug grammar as the earnings
 * slate and the news tape — the label says which side is which, so the colour
 * never has to be decoded.
 */
const TugBar = ({
  leftLabel,
  rightLabel,
  leftPct,
  caption,
  className = '',
}: {
  leftLabel: string;
  rightLabel: string;
  leftPct: number;
  caption?: string;
  /** Width restraint — at full modal width an unconstrained bar becomes a
      1600px colour band that shouts over the chart it annotates. */
  className?: string;
}) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <div className="flex items-baseline justify-between gap-3 font-mono text-[10px] uppercase tracking-wider">
      <span className={leftPct >= 50 ? 'text-bear font-semibold' : 'text-textSecondary'}>
        {leftLabel} {Math.round(leftPct)}%
      </span>
      {caption && <span className="text-textMuted normal-case tracking-normal">{caption}</span>}
      <span className={leftPct < 50 ? 'text-bull font-semibold' : 'text-textSecondary'}>
        {rightLabel} {100 - Math.round(leftPct)}%
      </span>
    </div>
    <span className="flex h-1.5 rounded-full overflow-hidden bg-ink/[0.06]">
      <span className="h-full bg-bear/80 transition-[width] duration-500" style={{ width: `${leftPct}%` }} />
      <span className="h-full bg-bull transition-[width] duration-500" style={{ width: `${100 - leftPct}%` }} />
    </span>
  </div>
);

// ---- contract flow ----------------------------------------------------------------

export interface FlowPanelProps {
  cf: ContractFlow;
  showAvg: boolean;
  onShowAvg: (v: boolean) => void;
  showIv: boolean;
  onShowIv: (v: boolean) => void;
  dayOffset: number;
  /** Minute of the clicked print within this window — null hides the marker */
  printMin: number | null;
  syncId?: string;
}

/*
  THE LEDGER — every print in the window is a BRICK (Noah, 2026-08-18: the
  bubble scatter was "ai generated on the first go... we need simple yet
  unique"). Bricks stack per bar interval: prints that PAID THE OFFER stack up
  in green, prints that HIT THE BID stack down in red, and mid fills sit as
  one gray block straddling the zero line — undecided premium literally on the
  fence. Brick height = that print's premium, so one whale brick against a
  stack of retail dust is legible at a glance where overlapping bubbles were
  mud. The window's largest print wears magenta (the whale family) AND is
  named in words on the canvas — unlabeled ink lasted one review (Noah:
  "what is magenta?"; then: "it should be known in words as well"). Bins
  follow the toolbar's bar interval (points snap to it upstream), and the
  strip stays on the drilldown's shared clock.
*/
interface LedgerBin {
  min: number;
  /** Paid-the-offer prints, largest first (heavy bricks at the base) */
  up: ContractPrintPoint[];
  /** Hit-the-bid prints, largest first */
  down: ContractPrintPoint[];
  midPrem: number;
  upPrem: number;
  downPrem: number;
  count: number;
}

function buildLedger(points: ContractPrintPoint[]): { bins: LedgerBin[]; maxSide: number; whale: ContractPrintPoint | null } {
  const byMin = new Map<number, LedgerBin>();
  let whale: ContractPrintPoint | null = null;
  for (const p of points) {
    if (!whale || p.premium > whale.premium) whale = p;
    let b = byMin.get(p.min);
    if (!b) {
      b = { min: p.min, up: [], down: [], midPrem: 0, upPrem: 0, downPrem: 0, count: 0 };
      byMin.set(p.min, b);
    }
    b.count++;
    if (p.side === 'ASK') {
      b.up.push(p);
      b.upPrem += p.premium;
    } else if (p.side === 'BID') {
      b.down.push(p);
      b.downPrem += p.premium;
    } else {
      b.midPrem += p.premium;
    }
  }
  const bins = [...byMin.values()].sort((a, b) => a.min - b.min);
  let maxSide = 1;
  for (const b of bins) {
    b.up.sort((a, z) => z.premium - a.premium);
    b.down.sort((a, z) => z.premium - a.premium);
    maxSide = Math.max(maxSide, b.midPrem / 2 + b.upPrem, b.midPrem / 2 + b.downPrem);
  }
  return { bins, maxSide, whale };
}

const MIN_BRICK = 1.5;
const BRICK_GAP = 1;

/** Reads the chart's scales via recharts 3's public hooks (the v2 trick of
    prop-injection into Customized children is gone in v3). */
const LedgerLayer = ({ bins, intervalMin, whale }: {
  bins: LedgerBin[];
  intervalMin: number;
  whale: ContractPrintPoint | null;
}) => {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale('prem');
  if (!xScale || !yScale || bins.length === 0) return null;
  const x = (v: number) => xScale(v) ?? 0;
  const y = (v: number) => yScale(v) ?? 0;

  const binPx = Math.abs(x(bins[0].min + intervalMin) - x(bins[0].min));
  const w = Math.max(3, Math.min(16, binPx * 0.55));

  const rects: React.ReactNode[] = [];
  for (const b of bins) {
    const cx = x(b.min);
    const left = cx - w / 2;
    const half = b.midPrem / 2;

    // Fence-sitters: one gray block straddling zero — undecided premium ON the fence.
    if (b.midPrem > 0) {
      const top = y(half);
      rects.push(
        <rect key={`m${b.min}`} x={left + w * 0.15} y={top} width={w * 0.7} height={Math.max(MIN_BRICK, y(-half) - top)} fill={FENCE} />
      );
      // A MID whale has no brick of its own (mids pool into the fence), which
      // left the LARGEST PRINT label pointing at nothing (Noah, 2026-08-19).
      // Its share of the fence wears magenta — the whale, sitting on the fence.
      if (whale && whale.side === 'MID' && whale.min === b.min) {
        const wTop = y(whale.premium / 2);
        rects.push(
          <rect
            key={`mw${b.min}`}
            x={left + w * 0.15}
            y={wTop}
            width={w * 0.7}
            height={Math.max(MIN_BRICK, y(-whale.premium / 2) - wTop)}
            fill={SUPREME}
            fillOpacity={0.95}
          />
        );
      }
    }
    // Buyers stack up from the fence…
    let cum = half;
    for (const p of b.up) {
      const yTop = y(cum + p.premium);
      const h = Math.max(MIN_BRICK, y(cum) - yTop - BRICK_GAP);
      rects.push(
        <rect key={`u${b.min}-${cum}`} x={left} y={yTop} width={w} height={h} fill={p === whale ? SUPREME : ASK} fillOpacity={p === whale ? 0.95 : 0.85} />
      );
      cum += p.premium;
    }
    // …sellers stack down from it.
    cum = -half;
    for (const p of b.down) {
      const yTop = y(cum);
      const h = Math.max(MIN_BRICK, y(cum - p.premium) - yTop - BRICK_GAP);
      rects.push(
        <rect key={`d${b.min}-${cum}`} x={left} y={yTop + BRICK_GAP} width={w} height={h} fill={p === whale ? SUPREME : BID} fillOpacity={p === whale ? 0.95 : 0.8} />
      );
      cum -= p.premium;
    }
  }

  // The whale, NAMED — unlabeled ink lasted one review. The label hangs off
  // the whale's own column: above it for a buyer, below it for a seller.
  let whaleLabel: React.ReactNode = null;
  if (whale) {
    const wb = bins.find(b => b.min === whale.min);
    if (wb) {
      const half = wb.midPrem / 2;
      const isUp = whale.side === 'ASK';
      const colEdge = isUp ? y(half + wb.upPrem) : y(-half - wb.downPrem);
      const first = x(bins[0].min);
      const last = x(bins[bins.length - 1].min);
      const tx = Math.min(Math.max(x(wb.min), first + 56), Math.max(last - 56, first + 56));
      whaleLabel = (
        <text
          x={tx}
          y={isUp ? colEdge - 5 : colEdge + 11}
          textAnchor="middle"
          fill={SUPREME}
          fontSize={9}
          fontWeight={600}
          fontFamily="'SF Pro', sans-serif"
        >
          LARGEST PRINT · {fmtUsd(whale.premium)}
        </text>
      );
    }
  }

  return (
    <g>
      {rects}
      {whaleLabel}
    </g>
  );
};

interface LedgerTipProps {
  active?: boolean;
  payload?: { payload?: { min?: number; up?: number; down?: number; mid?: number; count?: number; whaleHere?: boolean } }[];
}
const LedgerTooltip = ({ active, payload }: LedgerTipProps) => {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p || !Number.isFinite(p.min)) return null;
  return (
    <Box>
      <div className="text-textMuted">
        {flowClock(p.min as number)} ET · {p.count} print{p.count === 1 ? '' : 's'}
      </div>
      {(p.up ?? 0) > 0 && <div style={{ color: ASK }}>paid the offer {fmtUsd(p.up as number)}</div>}
      {(p.down ?? 0) > 0 && <div style={{ color: BID }}>hit the bid {fmtUsd(p.down as number)}</div>}
      {(p.mid ?? 0) > 0 && <div className="text-textMuted">on the fence {fmtUsd(p.mid as number)}</div>}
      {p.whaleHere && <div style={{ color: SUPREME }}>the window's largest print landed here</div>}
    </Box>
  );
};

export const FlowPanel = ({ cf, showAvg, onShowAvg, showIv, onShowIv, dayOffset, printMin, syncId }: FlowPanelProps) => {
  const { bins, maxSide, whale } = useMemo(() => buildLedger(cf.points), [cf]);
  // Points snap to the toolbar's bar interval upstream — recover it from the
  // tightest gap so brick width follows the interval control.
  const intervalMin = useMemo(() => {
    let g = Infinity;
    for (let i = 1; i < bins.length; i++) g = Math.min(g, bins[i].min - bins[i - 1].min);
    return Number.isFinite(g) ? g : 5;
  }, [bins]);
  // Invisible bar rows — they exist so the axis tooltip has per-bin payloads.
  const binRows = useMemo(
    () =>
      bins.map(b => ({
        min: b.min,
        up: b.upPrem,
        down: b.downPrem,
        mid: b.midPrem,
        count: b.count,
        whaleHere: whale ? b.min === whale.min : false,
        hover: b.midPrem / 2 + b.upPrem,
      })),
    [bins, whale]
  );
  const premDomain = useMemo(() => [-maxSide * 1.08, maxSide * 1.08], [maxSide]);
  const ticks = useMemo(() => {
    const n = 5;
    return Array.from({ length: n }, (_, i) => Math.round((cf.windowMin * i) / (n - 1)));
  }, [cf.windowMin]);

  const s = cf.stats;

  return (
    <div className="flex flex-col gap-2 min-w-0 rounded-md bg-panel px-2 py-1.5" data-theme="dark">
      {/* Strip header: what it is, the window's own figures, the overlays */}
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-widest text-textSecondary">The contract's prints</span>
        <span className="font-mono text-[10px] text-textMuted tnum">
          <RichRead text={`avg $${s.avgPrice.toFixed(2)} · ${fmtUsd(s.premium)} in window · ${s.multiPct}% multi-leg`} />
        </span>
        <span className="ml-auto flex items-center gap-0.5">
          <Chip active={showAvg} onClick={() => onShowAvg(!showAvg)} title="Average price paid">
            Avg paid
          </Chip>
          <Chip active={showIv} onClick={() => onShowIv(!showIv)} title="Implied volatility">
            Implied vol
          </Chip>
        </span>
      </div>

      {/* Who was paying — capped width so it annotates rather than dominates */}
      <TugBar
        className="max-w-[460px]"
        leftLabel="Hit the bid"
        rightLabel="Paid the offer"
        leftPct={100 - s.askSharePct}
        caption={`${s.bidCount.toLocaleString()} / ${s.midCount.toLocaleString()} mid / ${s.askCount.toLocaleString()}`}
      />

      <div className="h-[200px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={binRows}
            syncId={syncId}
            syncMethod="value"
            margin={{ top: 6, right: showAvg ? RIGHT_PAD : RIGHT_PAD + Y_RIGHT_W, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke={GRID} vertical={false} />
            {/* The clock prints ONCE, on the strip below — this axis only holds the domain */}
            <XAxis
              type="number"
              dataKey="min"
              domain={[0, cf.windowMin]}
              ticks={ticks}
              tick={false}
              height={4}
              stroke={AXIS}
              tickLine={false}
              axisLine={false}
            />
            {/* The ledger's scale: premium, both directions from the fence */}
            <YAxis
              yAxisId="prem"
              type="number"
              tick={axisTick}
              stroke={AXIS}
              tickLine={false}
              width={Y_LEFT_W}
              domain={premDomain}
              tickFormatter={(v: number) => fmtUsd(Math.abs(v))}
            />
            {showAvg && (
              <YAxis
                yAxisId="px"
                orientation="right"
                tick={axisTick}
                stroke={AXIS}
                tickLine={false}
                width={Y_RIGHT_W}
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              />
            )}
            {/* IV keeps its own scale but prints no axis — the tooltip and the
                blue ink carry it; a third printed scale would be noise */}
            {showIv && <YAxis yAxisId="iv" hide domain={['auto', 'auto']} />}
            <Tooltip content={<LedgerTooltip />} isAnimationActive={false} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <ReferenceLine yAxisId="prem" y={0} stroke="rgba(255,255,255,0.18)" />
            {/* Invisible — exists so the axis tooltip carries per-bin payloads */}
            <Bar yAxisId="prem" dataKey="hover" barSize={8} fillOpacity={0} isAnimationActive={false} />
            <Customized component={<LedgerLayer bins={bins} intervalMin={intervalMin} whale={whale} />} />
            {/* activeDot OFF on both lines: the tooltip indexes the BIN rows,
                and these lines carry their own data arrays — recharts matched
                by index, so the hover dot teleported to the wrong minute
                (Noah, 2026-08-18). */}
            {showAvg && (
              <Line
                yAxisId="px"
                data={cf.avg}
                type="monotone"
                dataKey="price"
                stroke={PRICE_LINE}
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            )}
            {showIv && (
              <Line
                yAxisId="iv"
                data={cf.avg}
                type="monotone"
                dataKey="iv"
                stroke={IV_LINE}
                strokeWidth={1}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            )}
            {printMin !== null && printLine(printMin, 'prem', true)}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-textSecondary">
          <span className="w-2 h-2" style={{ background: ASK }} /> Paid the offer · stacks up
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-textSecondary">
          <span className="w-2 h-2" style={{ background: BID }} /> Hit the bid · stacks down
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-textSecondary">
          <span className="w-2 h-2" style={{ background: FENCE }} /> Mid · on the fence
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-textSecondary">
          <span className="w-2 h-2" style={{ background: SUPREME }} /> Largest print
        </span>
        {printMin !== null && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-textSecondary">
            <span className="w-3 h-[2px]" style={{ background: PRICE_LINE }} /> This print
          </span>
        )}
      </div>
    </div>
  );
};

// ---- net premium -------------------------------------------------------------------

interface NetTipProps {
  active?: boolean;
  payload?: { payload?: { min?: number; netCall?: number; netPut?: number; price?: number } }[];
}
const NetTooltip = ({ active, payload }: NetTipProps) => {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <Box>
      <div className="text-textMuted">
        {Number.isFinite(p.min) ? `${flowClock(p.min as number)} ET` : ''}
        {Number.isFinite(p.price) ? ` · $${(p.price as number).toFixed(2)}` : ''}
      </div>
      {Number.isFinite(p.netCall) && <div style={{ color: ASK }}>net calls {fmtUsd(p.netCall as number)}</div>}
      {Number.isFinite(p.netPut) && <div style={{ color: BID }}>net puts {fmtUsd(Math.abs(p.netPut as number))}</div>}
    </Box>
  );
};

/* Four ways to read the same window. Named in full — the competition ships this
   as "NCP / NPP / RVOL" and expects you to already know. */
export type NetMetric = 'underlyingVol' | 'underlyingUsd' | 'netPremium' | 'strikes';

export const NET_METRICS: { value: NetMetric; label: string; hint: string }[] = [
  { value: 'underlyingVol', label: 'Contracts traded', hint: 'calls vs puts, by count' },
  { value: 'underlyingUsd', label: 'Premium traded', hint: 'calls vs puts, in dollars' },
  { value: 'netPremium', label: 'Net premium', hint: 'cumulative buying minus selling' },
  { value: 'strikes', label: 'Where on the chain', hint: 'activity by strike' },
];

/** Small anchored dropdown — the house pattern from the chart toolbar. */
const MetricPicker = ({ value, onChange }: { value: NetMetric; onChange: (v: NetMetric) => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);
  const active = NET_METRICS.find(m => m.value === value)!;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border font-mono text-[10px] uppercase tracking-wider transition-colors ${
          open ? 'border-borderMuted bg-ink/[0.05] text-textPrimary' : 'border-borderSubtle bg-ink/[0.02] text-textSecondary hover:text-textPrimary'
        }`}
      >
        {active.label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-40 min-w-[220px] border border-borderMuted bg-panel rounded-md shadow-2xl shadow-black/60 overflow-hidden animate-slide-in">
          {NET_METRICS.map(m => (
            <button
              key={m.value}
              onClick={() => {
                onChange(m.value);
                setOpen(false);
              }}
              className="w-full flex items-start gap-2 px-2.5 py-2 text-left hover:bg-ink/[0.04] transition-colors"
            >
              <span className="w-3.5 pt-0.5 shrink-0">
                {m.value === value && <Check className="w-3 h-3 text-select" />}
              </span>
              <span className="flex flex-col min-w-0">
                <span className={`font-mono text-[11px] ${m.value === value ? 'text-textPrimary font-semibold' : 'text-textSecondary'}`}>
                  {m.label}
                </span>
                <span className="font-mono text-[9px] text-textMuted">{m.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface BarTipProps {
  active?: boolean;
  isUsd: boolean;
  payload?: { payload?: { min?: number; callVol?: number; putVol?: number; callPrem?: number; putPrem?: number; price?: number } }[];
}
const BarTooltip = ({ active, payload, isUsd }: BarTipProps) => {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  const call = isUsd ? p.callPrem : p.callVol;
  const put = isUsd ? p.putPrem : p.putVol;
  const fmt = (v: number) => (isUsd ? fmtUsd(Math.abs(v)) : `${Math.abs(v).toLocaleString()} contracts`);
  return (
    <Box>
      <div className="text-textMuted">
        {Number.isFinite(p.min) ? `${flowClock(p.min as number)} ET` : ''}
        {Number.isFinite(p.price) ? ` · $${(p.price as number).toFixed(2)}` : ''}
      </div>
      {Number.isFinite(call) && <div style={{ color: ASK }}>calls {fmt(call as number)}</div>}
      {Number.isFinite(put) && <div style={{ color: BID }}>puts {fmt(put as number)}</div>}
    </Box>
  );
};

interface StrikeTipProps {
  active?: boolean;
  payload?: { payload?: { strike?: number; callVol?: number; putVol?: number; isFocus?: boolean } }[];
}
const StrikeTooltip = ({ active, payload }: StrikeTipProps) => {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <Box>
      <div className="text-textPrimary">
        {Number.isFinite(p.strike) ? `${p.strike} strike` : ''}
        {p.isFocus && <span className="text-select"> · this contract</span>}
      </div>
      {Number.isFinite(p.callVol) && <div style={{ color: ASK }}>calls {(p.callVol as number).toLocaleString()}</div>}
      {Number.isFinite(p.putVol) && <div style={{ color: BID }}>puts {Math.abs(p.putVol as number).toLocaleString()}</div>}
    </Box>
  );
};

export interface NetPanelProps {
  cf: ContractFlow;
  ticker: string;
  metric: NetMetric;
  onMetric: (m: NetMetric) => void;
  showCalls: boolean;
  onShowCalls: (v: boolean) => void;
  showPuts: boolean;
  onShowPuts: (v: boolean) => void;
  showPrice: boolean;
  onShowPrice: (v: boolean) => void;
  dayOffset: number;
  /** Minute of the clicked print within this window — null hides the marker */
  printMin: number | null;
  syncId?: string;
}

export const NetPanel = ({
  cf,
  ticker,
  metric,
  onMetric,
  showCalls,
  onShowCalls,
  showPuts,
  onShowPuts,
  showPrice,
  onShowPrice,
  dayOffset,
  printMin,
  syncId,
}: NetPanelProps) => {
  const n = cf.net;
  const u = cf.underlying;
  const endDate = sessionDate(dayOffset);
  const ticks = useMemo(() => {
    const c = 5;
    return Array.from({ length: c }, (_, i) => Math.round((cf.windowMin * i) / (c - 1)));
  }, [cf.windowMin]);
  const xFmt = (v: number) => flowAxisLabel(v, cf.sessions, endDate);
  const isUsd = metric === 'underlyingUsd';
  const isVolOrUsd = metric === 'underlyingVol' || isUsd;

  return (
    <div className="flex flex-col gap-2 min-w-0 rounded-md bg-panel px-2 py-1.5" data-theme="dark">
      {/* Strip header mirrors the prints strip: title, picker, the window's
          own figures inline — a full stat grid at 1600px was mostly gap */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* "Tide" was the competition's word (Noah, 2026-08-30) — this panel
            reads the ticker's premium, so it says so. */}
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-textSecondary">
          <CompanyLogo ticker={ticker} size={12} />
          {ticker} net premium
        </span>
        <MetricPicker value={metric} onChange={onMetric} />
        {isVolOrUsd ? (
          <span className="font-mono text-[10px] text-textMuted tnum">
            {(u.callVol + u.putVol).toLocaleString()} contracts · {fmtUsd(u.callPrem + u.putPrem)} traded · calls minus puts{' '}
            <span className={(isUsd ? u.callPrem - u.putPrem : u.callVol - u.putVol) >= 0 ? 'text-bull font-semibold' : 'text-bear font-semibold'}>
              {isUsd ? fmtUsd(u.callPrem - u.putPrem) : (u.callVol - u.putVol).toLocaleString()}
            </span>
          </span>
        ) : metric === 'netPremium' ? (
          <span className="font-mono text-[10px] text-textMuted tnum">
            net <span className={n.netPrem >= 0 ? 'text-bull font-semibold' : 'text-bear font-semibold'}>{fmtUsd(n.netPrem)}</span> · calls{' '}
            <span className={n.netCallPrem >= 0 ? 'text-bull font-semibold' : 'text-bear font-semibold'}>{fmtUsd(n.netCallPrem)}</span> · puts{' '}
            <span className={n.netPutPrem >= 0 ? 'text-bear font-semibold' : 'text-bull font-semibold'}>{fmtUsd(n.netPutPrem)}</span>
          </span>
        ) : (
          <span className="font-mono text-[10px] text-textMuted tnum">
            {cf.strikes.length} strikes · busiest{' '}
            {String(cf.strikes.reduce((a, b) => (b.callVol - b.putVol > a.callVol - a.putVol ? b : a), cf.strikes[0])?.strike ?? '—')} · this contract{' '}
            <span className="text-select font-semibold">{String(cf.strikes.find(s2 => s2.isFocus)?.strike ?? '—')}</span>
          </span>
        )}
      </div>

      {/* The lean, capped like the prints strip's bar */}
      {isVolOrUsd ? (
        <TugBar
          className="max-w-[460px]"
          leftLabel="Puts"
          rightLabel="Calls"
          leftPct={isUsd ? u.putPremSharePct : u.putSharePct}
          caption={isUsd ? fmtUsd(u.putPrem) + ' vs ' + fmtUsd(u.callPrem) : `${u.putVol.toLocaleString()} vs ${u.callVol.toLocaleString()}`}
        />
      ) : metric === 'netPremium' ? (
        <TugBar
          className="max-w-[460px]"
          leftLabel="Puts lead"
          rightLabel="Calls lead"
          leftPct={100 - n.bullishPct}
          caption="where the premium is going"
        />
      ) : null}

      <div className="h-[210px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          {metric === 'strikes' ? (
            // Strike axis, not the clock — no sync, and the lime line marks the
            // CONTRACT's strike instead of the print's minute.
            <ComposedChart data={cf.strikes} margin={{ top: 6, right: RIGHT_PAD + Y_RIGHT_W, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="strike" tick={axisTick} stroke={AXIS} tickLine={false} />
              <YAxis tick={axisTick} stroke={AXIS} tickLine={false} width={Y_LEFT_W} tickFormatter={(v: number) => Math.abs(v).toLocaleString()} />
              <Tooltip content={<StrikeTooltip />} isAnimationActive={false} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
              <Bar dataKey="callVol" stackId="k" fill={ASK} fillOpacity={0.75} isAnimationActive={false} />
              <Bar dataKey="putVol" stackId="k" fill={BID} fillOpacity={0.7} isAnimationActive={false} />
              {cf.strikes.some(sk => sk.isFocus) && (
                <ReferenceLine
                  x={cf.strikes.find(sk => sk.isFocus)!.strike}
                  stroke={PRICE_LINE}
                  strokeOpacity={0.9}
                  strokeDasharray="4 3"
                  label={{ value: 'THIS CONTRACT', position: 'insideTopLeft', fill: PRICE_LINE, fontSize: 9, fontFamily: "'SF Pro', sans-serif", offset: 8 }}
                />
              )}
            </ComposedChart>
          ) : isVolOrUsd ? (
            <ComposedChart
              data={u.bars}
              syncId={syncId}
              syncMethod="value"
              margin={{ top: 6, right: showPrice ? RIGHT_PAD : RIGHT_PAD + Y_RIGHT_W, bottom: 0, left: 0 }}
            >
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="min" type="number" domain={[0, cf.windowMin]} ticks={ticks} tickFormatter={xFmt} tick={axisTick} stroke={AXIS} tickLine={false} />
              <YAxis
                yAxisId="v"
                tick={axisTick}
                stroke={AXIS}
                tickLine={false}
                width={Y_LEFT_W}
                tickFormatter={(v: number) => (isUsd ? fmtUsd(Math.abs(v)) : Math.abs(v) >= 1000 ? `${Math.round(Math.abs(v) / 1000)}k` : String(Math.abs(v)))}
              />
              {showPrice && <YAxis yAxisId="px" orientation="right" tick={axisTick} stroke={AXIS} tickLine={false} width={Y_RIGHT_W} domain={['auto', 'auto']} />}
              <Tooltip content={<BarTooltip isUsd={isUsd} />} isAnimationActive={false} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <ReferenceLine yAxisId="v" y={0} stroke="rgba(255,255,255,0.2)" />
              {showCalls && <Bar yAxisId="v" dataKey={isUsd ? 'callPrem' : 'callVol'} stackId="u" fill={ASK} fillOpacity={0.75} isAnimationActive={false} />}
              {showPuts && <Bar yAxisId="v" dataKey={isUsd ? 'putPrem' : 'putVol'} stackId="u" fill={BID} fillOpacity={0.7} isAnimationActive={false} />}
              {showPrice && <Line yAxisId="px" type="monotone" dataKey="price" stroke={PRICE_LINE} strokeWidth={1.25} dot={false} isAnimationActive={false} />}
              {printMin !== null && printLine(printMin, 'v', false)}
            </ComposedChart>
          ) : (
            <ComposedChart
              data={n.series}
              syncId={syncId}
              syncMethod="value"
              margin={{ top: 6, right: showPrice ? RIGHT_PAD : RIGHT_PAD + Y_RIGHT_W, bottom: 0, left: 0 }}
            >
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="min" type="number" domain={[0, cf.windowMin]} ticks={ticks} tickFormatter={xFmt} tick={axisTick} stroke={AXIS} tickLine={false} />
              <YAxis
                yAxisId="prem"
                tick={axisTick}
                stroke={AXIS}
                tickLine={false}
                width={Y_LEFT_W}
                domain={[-n.premAbs, n.premAbs]}
                tickFormatter={(v: number) => fmtUsd(v)}
              />
              {showPrice && <YAxis yAxisId="px" orientation="right" tick={axisTick} stroke={AXIS} tickLine={false} width={Y_RIGHT_W} domain={['auto', 'auto']} />}
              <Tooltip content={<NetTooltip />} isAnimationActive={false} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
              {showCalls && (
                <Area yAxisId="prem" type="monotone" dataKey="netCall" stroke={ASK} strokeWidth={1} fill={ASK} fillOpacity={0.14} isAnimationActive={false} />
              )}
              {showPuts && (
                <Area yAxisId="prem" type="monotone" dataKey="netPut" stroke={BID} strokeWidth={1} fill={BID} fillOpacity={0.14} isAnimationActive={false} />
              )}
              {showPrice && <Line yAxisId="px" type="monotone" dataKey="price" stroke={PRICE_LINE} strokeWidth={1.25} dot={false} isAnimationActive={false} />}
              {printMin !== null && printLine(printMin, 'prem', false)}
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* The four books that make up the net — only meaningful on the net view */}
      {metric === 'netPremium' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5">
          <Stat label="Calls bought" value={fmtUsd(n.callBought)} tone="text-bull" />
          <Stat label="Calls sold" value={fmtUsd(n.callSold)} tone="text-bear" />
          <Stat label="Puts bought" value={fmtUsd(n.putBought)} tone="text-bear" />
          <Stat label="Puts sold" value={fmtUsd(n.putSold)} tone="text-bull" />
        </div>
      )}

      {metric !== 'strikes' && (
        <div className="flex items-center gap-0.5 flex-wrap">
          <Chip active={showCalls} onClick={() => onShowCalls(!showCalls)}>
            {metric === 'netPremium' ? 'Net calls' : 'Calls'}
          </Chip>
          <Chip active={showPuts} onClick={() => onShowPuts(!showPuts)}>
            {metric === 'netPremium' ? 'Net puts' : 'Puts'}
          </Chip>
          <Chip active={showPrice} onClick={() => onShowPrice(!showPrice)}>
            <Name t={ticker} size={11} /> price
          </Chip>
        </div>
      )}
    </div>
  );
};
