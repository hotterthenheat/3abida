import { fmtUsd } from '../../data/gex';
import type { OrderFlowData } from '../../types/gex';

interface OrderFlowPanelProps {
  data: OrderFlowData;
}

/** SVG area chart of session cumulative delta — sign decides the fill tone. */
const CumulativeDelta = ({ data }: { data: OrderFlowData }) => {
  const points = data.cumulativeDelta;
  if (points.length < 2) return null;

  const W = 100;
  const H = 40;
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    if (p.value < min) min = p.value;
    if (p.value > max) max = p.value;
  }
  const span = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / span) * H;
  const zeroY = Math.max(0, Math.min(H, y(0)));

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ');
  const area = `${line} L${W},${zeroY.toFixed(2)} L0,${zeroY.toFixed(2)} Z`;
  const negative = (points[points.length - 1]?.value ?? 0) < 0;
  const stroke = negative ? 'rgb(var(--bear))' : 'rgb(var(--bull))';
  const fill = negative ? 'rgba(255,59,48,0.10)' : 'rgba(48,209,88,0.10)';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-24">
      <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="rgba(255,255,255,0.08)" strokeWidth="0.4" />
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

/** Horizontal delta-by-price histogram — the volume-profile read. */
const DeltaByPriceBars = ({ data }: { data: OrderFlowData }) => {
  const rows = [...data.deltaByPrice].sort((a, b) => b.price - a.price);
  const max = rows.reduce((a, r) => Math.max(a, Math.abs(r.value)), 1);
  return (
    <div className="flex flex-col gap-[3px]">
      {rows.map(r => {
        const pct = Math.min(48, (Math.abs(r.value) / max) * 48);
        const neg = r.value < 0;
        const isPoc = r.price === data.poc;
        return (
          <div key={r.price} className="flex items-center gap-1.5">
            <span className={`w-12 shrink-0 text-right font-mono text-[9px] tnum ${isPoc ? 'text-textPrimary font-semibold' : 'text-textMuted'}`}>
              {r.price.toFixed(2)}
            </span>
            <div className="relative flex-1 h-[6px]">
              <span className="absolute left-1/2 top-0 bottom-0 w-px bg-borderMuted" />
              <span
                className="absolute top-[1px] h-[4px] rounded-sm"
                style={{
                  left: neg ? `calc(50% - ${pct}%)` : '50%',
                  width: `${pct}%`,
                  background: neg ? 'rgba(255,59,48,0.78)' : 'rgba(48,209,88,0.9)',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Stat = ({ label, value, tone = 'text-textPrimary' }: { label: string; value: string; tone?: string }) => (
  <span className="min-w-0">
    <span className="block font-mono text-[8px] uppercase tracking-widest text-textMuted">{label}</span>
    <span className={`block font-mono text-[10px] font-semibold tnum ${tone}`}>{value}</span>
  </span>
);

/** Session order-flow read: cumulative delta, delta by price, tape stats. */
const OrderFlowPanel = ({ data }: OrderFlowPanelProps) => (
  <div className="flex flex-col gap-3 h-full min-h-0">
    <div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-textMuted mb-1">Cumulative Delta</div>
      <CumulativeDelta data={data} />
    </div>
    <div className="flex-grow min-h-0 overflow-y-auto">
      <div className="font-mono text-[9px] uppercase tracking-widest text-textMuted mb-1.5">Delta by Price</div>
      <DeltaByPriceBars data={data} />
    </div>
    <div className="grid grid-cols-5 gap-2 pt-2 border-t border-borderSubtle">
      <Stat label="Buy Vol" value={fmtUsd(data.buyVolume)} tone="text-bull" />
      <Stat label="Sell Vol" value={fmtUsd(data.sellVolume)} tone="text-bear" />
      <Stat label="Delta" value={fmtUsd(data.netDelta)} tone={data.netDelta >= 0 ? 'text-bull' : 'text-bear'} />
      <Stat label="VWAP" value={data.vwap.toFixed(2)} />
      <Stat label="POC" value={data.poc.toFixed(2)} />
    </div>
  </div>
);

export default OrderFlowPanel;
