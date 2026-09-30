/*
==================================================
  SLAYER TERMINAL - THE PRICE RULER (components/weigher/PriceRuler.tsx)

  Robinhood's ruler under Simulated Returns (Noah,
  2026-09-14: "it changes your simulated return by
  the literal cent movement of the ticker price"):
  a scale of the stock's price that slides under a
  fixed marker — drag it and the price under the
  marker moves by the cent; the chart above reads
  at that price. The marker's pill prints the
  price. THE MARKET'S OWN PRICE IS ONE OF THE
  DASHES, in the live lime (Noah, 2026-09-14: "the
  way robinhood does it is the current price is
  one of the small dashes — make ours neon lime");
  only once it has slid OUT OF VIEW does a capsule
  stand at the ruler's edge with a chevron pointing
  the way back — a click GLIDES the ruler home and
  the capsule goes until the market leaves the view
  again. Double-click glides home too; the arrow
  keys walk it a cent (a dime with Shift). The dealer map's
  levels — the put wall, the flip, the call wall —
  stand on the scale as silver ticks with their
  words, since a price is where they live.

  A drawn scale, with the hover read the house
  demands: the pointer's price prints under it.
==================================================
*/

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';

const W = 600;
const H = 46;
const MONO = 'ui-monospace, Menlo, monospace';
const SILVER = 'rgb(var(--silver))';
const INK = 'rgb(var(--text-primary))';
/** The live lime — the market's own dash (the neon as a surface: the same on either ground) */
/* THE RULER ON PAPER (the light sweep, 2026-09-19 — Noah's picture of the Weigher): its line and ticks were typed white and
   the marker's price a typed near-black ON the text ink, so on the light page the ruler had no line and the marker was a
   black box with nothing in it. Every ink is a token now: the line and ticks are THE INK (white on the terminal, black on
   paper), the marker's price is the page's ground, the market's dash is the live ink cut for its page. */
const LIVE = 'rgb(var(--select))';
/* the dollars' names: the dark terminal keeps the very grey it had (a light-theme fix never moves the dark theme) */
const MUTED = 'rgb(var(--ruler-word, 124 130 144))';
const WASH = 'rgb(var(--ink))';
const GROUND = 'rgb(var(--panel))';
/** Dollars across the ruler's width */
const SPAN = 5;
const PX_PER_DOLLAR = W / SPAN;
/** The glide home, on the house curve */
const GLIDE_MS = 420;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
/** The marker's pill and the way-home capsule, in the ruler's units */
const PILL_W = 48;
const CAP_W = 58;
const GAP = 4;

interface Props {
  value: number;
  onChange: (v: number) => void;
  /** The market's price — the capsule, and where the glide returns */
  spot: number;
  /** The dealer map's levels on the scale */
  marks?: { price: number; label: string }[];
  testId?: string;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

const PriceRuler = ({ value, onChange, spot, marks = [], testId }: Props) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; start: number } | null>(null);
  const glide = useRef<number | null>(null);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const lo = value - SPAN / 2;
  const hi = value + SPAN / 2;
  const x = (price: number) => ((price - lo) / SPAN) * W;
  const clamp = (v: number) => round2(Math.min(spot * 1.5, Math.max(spot * 0.5, v)));

  /* THE GLIDE HOME — one frame loop, cancelled by a new drag or an unmount */
  const stopGlide = () => {
    if (glide.current != null) cancelAnimationFrame(glide.current);
    glide.current = null;
  };
  const glideHome = () => {
    stopGlide();
    const from = value;
    const to = clamp(spot);
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / GLIDE_MS);
      onChange(t >= 1 ? to : round2(from + (to - from) * easeOut(t)));
      if (t < 1) glide.current = requestAnimationFrame(step);
      else glide.current = null;
    };
    glide.current = requestAnimationFrame(step);
  };
  useEffect(() => stopGlide, []);

  const priceAt = (clientX: number): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    return round2(lo + ((clientX - r.left) / r.width) * SPAN);
  };
  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    stopGlide();
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, start: value };
  };
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current) {
      const svg = svgRef.current;
      if (!svg) return;
      const scale = W / svg.getBoundingClientRect().width;
      /* the ruler slides under the marker: dragging right brings lower prices under it */
      onChange(clamp(drag.current.start - ((e.clientX - drag.current.x) * scale) / PX_PER_DOLLAR));
      return;
    }
    setHoverPrice(priceAt(e.clientX));
  };
  const onUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    drag.current = null;
    (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(clamp(value + step));
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(clamp(value - step));
    else if (e.key === 'Home') glideHome();
    else return;
    e.preventDefault();
  };

  /* ticks: a hair every dime, a longer one every half, the whole dollars named */
  const ticks: { price: number; kind: 'dime' | 'half' | 'dollar' }[] = [];
  for (let p = Math.ceil(lo * 10) / 10; p <= hi + 1e-9; p = round2(p + 0.1)) {
    const cents = Math.round(p * 100) % 100;
    ticks.push({ price: p, kind: cents === 0 ? 'dollar' : cents === 50 ? 'half' : 'dime' });
  }
  const shown = marks.filter(m => m.price > lo + 0.05 && m.price < hi - 0.05);

  /* THE MARKET: a lime dash while it is in view; once it has slid out, the capsule at that edge */
  const spotX = x(spot);
  const spotIn = spotX >= 0 && spotX <= W;
  const chevron: 'left' | 'right' = spotX < 0 ? 'left' : 'right';
  const capX = chevron === 'left' ? CAP_W / 2 + GAP : W - CAP_W / 2 - GAP;
  const capTextX = chevron === 'left' ? capX + 5 : capX - 5;

  return (
    <div className="relative select-none" data-price-ruler={value.toFixed(2)} data-testid={testId}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="slider"
        tabIndex={0}
        aria-label="The stock's price the returns are simulated at — drag, or use the arrow keys, a cent at a time"
        aria-valuemin={round2(spot * 0.5)}
        aria-valuemax={round2(spot * 1.5)}
        aria-valuenow={value}
        aria-valuetext={`$${value.toFixed(2)}`}
        style={{ display: 'block', cursor: drag.current ? 'grabbing' : 'ew-resize', touchAction: 'none', outline: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => setHoverPrice(null)}
        onDoubleClick={glideHome}
        onKeyDown={onKey}
      >
        {/* the baseline */}
        <line x1={0} x2={W} y1={32} y2={32} stroke={WASH} strokeOpacity={0.16} />
        {/* the ticks and the dollars' names */}
        {ticks.map(t => (
          <g key={t.price} fontFamily={MONO}>
            <line x1={x(t.price)} x2={x(t.price)} y1={32} y2={t.kind === 'dollar' ? 20 : t.kind === 'half' ? 24 : 27.5} stroke={WASH} strokeOpacity={t.kind === 'dollar' ? 0.45 : t.kind === 'half' ? 0.3 : 0.18} strokeWidth={1} />
            {t.kind === 'dollar' && Math.abs(x(t.price) - W / 2) > 28 && (
              <text x={x(t.price)} y={43} textAnchor="middle" fontSize={8.5} fill={MUTED}>
                {Math.round(t.price)}
              </text>
            )}
          </g>
        ))}
        {/* the dealer map's levels — silver ticks with their words, stepping aside for the two pills */}
        {shown.map(m => (
          <g key={m.label} fontFamily={MONO} data-ruler-mark={m.label}>
            <line x1={x(m.price)} x2={x(m.price)} y1={16} y2={32} stroke={SILVER} strokeOpacity={0.9} strokeWidth={1} />
            {Math.abs(x(m.price) - W / 2) > 56 && (spotIn || Math.abs(x(m.price) - capX) > 52) && (
              <text x={x(m.price)} y={12} textAnchor="middle" fontSize={7} fill={SILVER} letterSpacing={0.4}>
                {m.label}
              </text>
            )}
          </g>
        ))}
        {/* the market's price — one of the dashes, in the live lime */}
        {spotIn && <line x1={spotX} x2={spotX} y1={16} y2={32} stroke={LIVE} strokeWidth={1.75} strokeLinecap="round" data-ruler-now />}
        {/* the marker: a hairline down the middle and the pill with the price under it */}
        <line x1={W / 2} x2={W / 2} y1={12} y2={38} stroke={INK} strokeWidth={1.25} />
        <rect x={W / 2 - PILL_W / 2} y={0} width={PILL_W} height={13} rx={3} fill={INK} />
        <text x={W / 2} y={9.5} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={GROUND} fontFamily={MONO} data-ruler-value>
          {value.toFixed(2)}
        </text>
        {/* THE WAY HOME — the capsule at the edge, only while the market is out of view; a click glides the ruler home and it goes */}
        {!spotIn && (
          <g
            role="button"
            /* not focusable: a click focused the group and the house ring drew a BOX round the
               pill (Noah, 2026-09-14); the ruler itself holds focus, and Home is the same way
               home from the keyboard */
            aria-label={`Back to the market's price, ${spot.toFixed(2)}`}
            style={{ cursor: 'pointer', outline: 'none' }}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation();
              glideHome();
            }}
            data-ruler-back={chevron}
          >
            <rect x={capX - CAP_W / 2} y={0} width={CAP_W} height={13} rx={6.5} fill="rgb(var(--panel))" stroke={INK} strokeOpacity={0.55} strokeWidth={1} />
            {chevron === 'left' ? (
              <path d={`M${capX - CAP_W / 2 + 9},4 l-3,2.5 l3,2.5`} fill="none" stroke={INK} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d={`M${capX + CAP_W / 2 - 9},4 l3,2.5 l-3,2.5`} fill="none" stroke={INK} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
            )}
            <text x={capTextX} y={9.5} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={INK} fontFamily={MONO}>
              {spot.toFixed(2)}
            </text>
          </g>
        )}
        {/* the pointer's own price, while it hovers off the marker */}
        {hoverPrice != null && !drag.current && Math.abs(x(hoverPrice) - W / 2) > 30 && (
          <text x={x(hoverPrice)} y={43} textAnchor="middle" fontSize={8.5} fontWeight={600} fill={INK} fontFamily={MONO} style={{ paintOrder: 'stroke', stroke: 'rgb(var(--ruler-halo, 14 14 15))', strokeWidth: 4 }} data-ruler-hover>
            {hoverPrice.toFixed(2)}
          </text>
        )}
      </svg>
    </div>
  );
};

export default PriceRuler;
