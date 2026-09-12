import { useEffect, useMemo, useRef } from 'react';
import { histogram, type MonteCarloResult } from '../../core/quant';

/*
  The fan chart: sampled GBM paths in faint chrome, the percentile cone in
  brighter silver, the median in near-white — plus a terminal-price histogram
  so the whole distribution is readable at a glance, not just the average.
*/

const PATH_STROKE = 'rgba(199,211,232,0.08)';
const CONE_OUTER = 'rgba(168,196,232,0.10)';
const CONE_INNER = 'rgba(198,214,240,0.16)';
const MEDIAN = 'rgba(238,241,248,0.95)';
const SPOT_LINE = 'rgba(255,255,255,0.35)';

interface MonteCarloPanelProps {
  mc: MonteCarloResult;
  spot: number;
  height?: number;
}

const MonteCarloPanel = ({ mc, spot, height = 260 }: MonteCarloPanelProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bins = useMemo(() => histogram(mc.terminal, spot, 28), [mc, spot]);
  const maxBin = Math.max(...bins.map(b => b.count), 1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const all = [...mc.cone.p5, ...mc.cone.p95];
    const lo = Math.min(...all) * 0.998;
    const hi = Math.max(...all) * 1.002;
    const X = (d: number) => (d / mc.days) * (w - 8) + 4;
    const Y = (px: number) => h - ((px - lo) / (hi - lo)) * (h - 10) - 5;

    // cone fills
    const fillBand = (top: number[], bot: number[], fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      top.forEach((p, d) => (d === 0 ? ctx.moveTo(X(d), Y(p)) : ctx.lineTo(X(d), Y(p))));
      for (let d = bot.length - 1; d >= 0; d--) ctx.lineTo(X(d), Y(bot[d]));
      ctx.closePath();
      ctx.fill();
    };
    fillBand(mc.cone.p95, mc.cone.p5, CONE_OUTER);
    fillBand(mc.cone.p75, mc.cone.p25, CONE_INNER);

    // sampled paths
    ctx.lineWidth = 1;
    ctx.strokeStyle = PATH_STROKE;
    for (const path of mc.paths) {
      ctx.beginPath();
      path.forEach((p, d) => (d === 0 ? ctx.moveTo(X(d), Y(p)) : ctx.lineTo(X(d), Y(p))));
      ctx.stroke();
    }

    // median
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = MEDIAN;
    ctx.beginPath();
    mc.cone.p50.forEach((p, d) => (d === 0 ? ctx.moveTo(X(d), Y(p)) : ctx.lineTo(X(d), Y(p))));
    ctx.stroke();

    // spot reference
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = SPOT_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(4, Y(spot));
    ctx.lineTo(w - 4, Y(spot));
    ctx.stroke();
    ctx.setLineDash([]);
  }, [mc, spot]);

  return (
    <div className="flex flex-col gap-3">
      <canvas ref={canvasRef} className="w-full" style={{ height }} />
      {/* Terminal distribution */}
      <div>
        <div className="flex items-end gap-px h-14">
          {bins.map((b, i) => (
            <span
              key={i}
              className={`flex-1 rounded-t-[2px] ${b.aboveSpot ? 'holo-bar' : 'bg-bear/60'}`}
              style={{ height: `${(b.count / maxBin) * 100}%` }}
              title={`$${b.from.toFixed(2)}–$${b.to.toFixed(2)} · ${b.count} runs`}
            />
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-textMuted">
          <span>${mc.terminal[0].toFixed(0)}</span>
          <span>terminal price after {mc.days} sessions · {mc.runs.toLocaleString()} runs</span>
          <span>${mc.terminal[mc.terminal.length - 1].toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
};

export default MonteCarloPanel;
