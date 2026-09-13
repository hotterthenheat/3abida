/*
==================================================
  SLAYER TERMINAL - THE CHART ON THE GATE
  (components/layout/BootChart.tsx)

  The launch screen's chart (Noah, 2026-09-13: "let
  it be like our chart and stuff but like locked
  with no real data").

  LOCKED, LITERALLY. It is a flat SVG — no chart
  library, no canvas, no ticker, no state. It cannot
  be panned, zoomed, scrubbed, hovered or clicked,
  because there is nothing here that listens: the
  whole thing is `pointer-events: none` and carries
  no handlers at all. It never redraws either — the
  bars are generated ONCE at module load from a
  fixed seed, so every boot draws the same picture
  and drawing it costs nothing on a screen whose
  whole job is to get out of the way quickly.

  NO REAL DATA. Deliberately not the simulator's:
  the simulator is busy building the real book
  behind this screen, and reading a half-walked
  history would draw a chart that is wrong and then
  changes. These bars come from a seeded PRNG that
  belongs to nothing. There are no prices on it and
  no axis, so nothing here can be misread as a
  quote.

  IT IS STILL OUR CHART. The grammar is the desk's:
  candles in the direction inks, a call wall and a
  put wall as dashed rules over tinted bands, the
  gamma flip between them, and the net-GEX strip
  along the foot — the same four things Terrain and
  the Map draw, in the same colours, so the gate
  looks like the terminal rather than like a splash
  screen bolted to the front of one.
==================================================
*/

/** The house tokens, as SVG paint. Both themes, no JS. */
const INK = {
  bull: 'rgb(var(--bull))',
  bear: 'rgb(var(--bear))',
  select: 'rgb(var(--select))',
  line: 'rgb(var(--border-subtle))',
  muted: 'rgb(var(--text-muted))',
};

const W = 440;
const H = 150;
const FOOT = 26; // the net-GEX strip along the bottom
const BARS = 58;

interface Bar {
  x: number;
  open: number;
  high: number;
  low: number;
  close: number;
  up: boolean;
  net: number;
}

/*
  ONE DETERMINISTIC WALK, TAKEN ONCE. A fixed seed rather than Math.random so
  the gate is the same picture every time — a splash that reshuffles on every
  refresh reads as noise, and this is the first thing anyone sees.
*/
const walk = (): { bars: Bar[]; callWall: number; putWall: number; flip: number } => {
  let s = 0x9e3779b9;
  const rnd = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
  const top = 14;
  const floor = H - FOOT - 12;
  const span = floor - top;
  const callWall = top + span * 0.16;
  const putWall = top + span * 0.84;
  const flip = top + span * 0.52;
  const gap = (W - 16) / BARS;
  const bars: Bar[] = [];
  let price = flip + span * 0.12;
  for (let i = 0; i < BARS; i++) {
    /* the walls push back, the way the sim's own gexAwareStep does — it is
       what makes a chart of this desk look like a chart of this desk */
    const pull = (flip - price) * 0.035;
    const push = price < callWall + 14 ? 3.2 : price > putWall - 14 ? -3.2 : 0;
    const move = (rnd() - 0.5) * 11 + pull + push;
    const open = price;
    const close = Math.max(top + 4, Math.min(floor - 4, price + move));
    const wick = 1.5 + rnd() * 5;
    bars.push({
      x: 8 + i * gap,
      open,
      close,
      high: Math.min(open, close) - wick,
      low: Math.max(open, close) + wick,
      up: close < open, // SVG y grows downward: a lower y is a higher price
      net: (rnd() - 0.42) * 2,
    });
    price = close;
  }
  return { bars, callWall, putWall, flip };
};

const { bars, callWall, putWall, flip } = walk();
const body = Math.max(2.5, (W - 16) / BARS - 2.2);

const BootChart = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox={`0 0 ${W} ${H}`}
    width="100%"
    role="presentation"
    aria-hidden="true"
    focusable="false"
    /* LOCKED: nothing on this element listens, and nothing under it can be
       reached either — the cursor passes straight through to the gate. */
    className={`pointer-events-none select-none block ${className}`}
  >
    {/* the two walls, as bands with a dashed rule on the edge that matters */}
    <rect x="0" y="0" width={W} height={callWall} fill={INK.bull} opacity="0.05" />
    <rect x="0" y={putWall} width={W} height={H - FOOT - putWall} fill={INK.bear} opacity="0.05" />
    <line x1="0" y1={callWall} x2={W} y2={callWall} stroke={INK.bull} strokeWidth="1" strokeDasharray="5 4" opacity="0.55" />
    <line x1="0" y1={putWall} x2={W} y2={putWall} stroke={INK.bear} strokeWidth="1" strokeDasharray="5 4" opacity="0.55" />
    <line x1="0" y1={flip} x2={W} y2={flip} stroke={INK.select} strokeWidth="1" strokeDasharray="2 5" opacity="0.5" />

    <text x={W - 8} y={callWall - 5} textAnchor="end" fill={INK.bull} fontSize="7.5" letterSpacing="1.6" fontFamily="ui-monospace, monospace" opacity="0.85">
      CALL WALL
    </text>
    <text x={W - 8} y={putWall + 12} textAnchor="end" fill={INK.bear} fontSize="7.5" letterSpacing="1.6" fontFamily="ui-monospace, monospace" opacity="0.85">
      PUT WALL
    </text>
    <text x="8" y={flip - 5} fill={INK.select} fontSize="7.5" letterSpacing="1.6" fontFamily="ui-monospace, monospace" opacity="0.8">
      FLIP
    </text>

    {bars.map((b, i) => {
      const ink = b.up ? INK.bull : INK.bear;
      return (
        <g key={i}>
          <line x1={b.x + body / 2} y1={b.high} x2={b.x + body / 2} y2={b.low} stroke={ink} strokeWidth="1" opacity="0.75" />
          <rect x={b.x} y={Math.min(b.open, b.close)} width={body} height={Math.max(1.2, Math.abs(b.close - b.open))} fill={ink} opacity="0.9" />
        </g>
      );
    })}

    {/* the net-GEX strip along the foot, the way the Terrain panel carries it.
        The label sits ABOVE the divider and at the LEFT: inside the strip it was
        printed straight through the bars, and at the right it ran into PUT WALL. */}
    <text x="8" y={H - FOOT - 5} fill={INK.muted} fontSize="7" letterSpacing="1.6" fontFamily="ui-monospace, monospace">
      NET GEX
    </text>
    <line x1="0" y1={H - FOOT} x2={W} y2={H - FOOT} stroke={INK.line} strokeWidth="1" />
    {bars.map((b, i) => {
      const h = Math.min(FOOT / 2 - 2, Math.abs(b.net) * 9);
      const mid = H - FOOT / 2;
      return <rect key={i} x={b.x} y={b.net >= 0 ? mid - h : mid} width={body} height={Math.max(0.8, h)} fill={b.net >= 0 ? INK.bull : INK.bear} opacity="0.55" />;
    })}
  </svg>
);

export default BootChart;
