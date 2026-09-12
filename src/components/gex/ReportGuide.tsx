/*
==================================================
  SLAYER TERMINAL - HOW TO READ THE LEVEL REPORT
  (components/gex/ReportGuide.tsx)

  The card behind "How the levels held today"'s
  door (Noah, 2026-09-06: "the traders clock and
  levels held need one too"). Two figures in the
  report's own hand — one row's anatomy with its
  session strip, and what counts as a test and a
  break — then today's levels in plain words.
==================================================
*/

const INK = 'rgb(var(--text-primary))';
const INK_2 = 'rgb(var(--text-secondary))';
const INK_3 = 'rgb(var(--text-muted))';
const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const GREEN = 'rgb(var(--bull))';
const RED = 'rgb(var(--bear))';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SANS = '-apple-system, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

const Label = ({ x, y, children, anchor = 'start', fill = INK_2, size = 9.5, mono = false, weight = 400 }: { x: number; y: number; children: string; anchor?: 'start' | 'middle' | 'end'; fill?: string; size?: number; mono?: boolean; weight?: number }) => (
  <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontFamily={mono ? MONO : SANS} fontSize={size} fontWeight={weight} fill={fill}>
    {children}
  </text>
);

/** FIGURE 1 — one row: the level, its grade, the session strip with its ticks, the facts */
const RowFigure = () => {
  const ticks = [
    { x: 138, kind: 'held' },
    { x: 176, kind: 'held' },
    { x: 214, kind: 'broke' },
    { x: 262, kind: 'held' },
  ];
  return (
    <svg viewBox="0 0 368 166" width="100%" role="img" aria-label="One row of the report: the level's name and price, its grade, the session strip with green and red ticks, and the facts" data-guide-figure="row">
      {/* The level */}
      <Label x={14} y={18} fill={GREEN} size={9} weight={600}>
        Call wall
      </Label>
      <Label x={14} y={36} fill={INK} size={14} mono weight={600}>
        525
      </Label>
      <rect x={14} y={48} width={74} height={15} rx={7.5} fill="rgba(48,209,88,0.1)" stroke="rgba(48,209,88,0.2)" />
      <Label x={51} y={55.5} anchor="middle" fill={GREEN} size={8.5} weight={500}>
        held 3 of 4
      </Label>
      {/* The session strip */}
      <line x1={110} x2={330} y1={36.5} y2={36.5} stroke="#ffffff" strokeOpacity="0.1" />
      {ticks.map(t => (
        <line key={t.x} x1={t.x} x2={t.x} y1={t.kind === 'broke' ? 24 : 28} y2={t.kind === 'broke' ? 49 : 45} stroke={t.kind === 'broke' ? RED : GREEN} strokeWidth={t.kind === 'broke' ? 2 : 1.5} strokeOpacity="0.9" />
      ))}
      <line x1={330} x2={330} y1={27} y2={46} stroke={SILVER} strokeOpacity="0.6" />
      <Label x={110} y={58} fill={INK_3} size={8} mono>
        09:30
      </Label>
      <Label x={330} y={58} anchor="end" fill={INK_3} size={8} mono>
        now
      </Label>
      {/* The facts */}
      {[
        ['Tests', '4', INK],
        ['Held', '3', GREEN],
        ['Broke', '1', RED],
        ['Last touched', '11:42', INK],
        ['Since the open', 'growing +12%', INK],
      ].map(([k, v, c], i) => (
        <g key={k}>
          <Label x={14 + i * 72} y={80} fill={INK_3} size={8}>
            {k}
          </Label>
          <Label x={14 + i * 72} y={94} fill={c} size={9.5} mono>
            {v}
          </Label>
        </g>
      ))}
      {/* Callouts */}
      <circle cx={18} cy={116} r={3.5} fill={GREEN} />
      <Label x={27} y={116}>a green tick: price reached the level in that minute and it held</Label>
      <circle cx={18} cy={131} r={3.5} fill={RED} />
      <Label x={27} y={131}>a red tick: price closed through it · the strip is the whole session, 9:30 to now</Label>
      <Label x={14} y={145} fill={INK_3}>the chip sums the row up</Label>
      <Label x={14} y={158} fill={INK_3}>the facts count the ticks and track the level's hedging since the open</Label>
    </svg>
  );
};

/** FIGURE 2 — what counts: three one-minute bars against a level */
const TestFigure = () => {
  const level = 62;
  const bars = [
    { x: 70, hi: 78, lo: 112, o: 104, c: 84, words: 'no test', why: 'never reached it', tick: null },
    { x: 184, hi: 50, lo: 96, o: 90, c: 72, words: 'test · held', why: 'reached, closed below', tick: GREEN },
    { x: 298, hi: 44, lo: 92, o: 86, c: 52, words: 'test · broke', why: 'reached, closed through', tick: RED },
  ];
  return (
    <svg viewBox="0 0 368 150" width="100%" role="img" aria-label="Three one-minute bars against a level line: one never reaches it, one reaches it and holds, one closes through it" data-guide-figure="test">
      <line x1={14} x2={354} y1={level + 0.5} y2={level + 0.5} stroke={GREEN} strokeOpacity="0.8" />
      <Label x={14} y={level - 8} fill={GREEN} size={8.5} weight={600}>
        Call wall 525
      </Label>
      {bars.map(b => (
        <g key={b.x}>
          <line x1={b.x} x2={b.x} y1={b.hi} y2={b.lo} stroke={INK} strokeOpacity="0.8" />
          <rect x={b.x - 4} y={Math.min(b.o, b.c)} width={8} height={Math.abs(b.o - b.c)} fill={b.c < b.o ? INK : '#0a0a0a'} stroke={INK} strokeOpacity="0.9" />
          {b.tick && <line x1={b.x} x2={b.x} y1={116} y2={128} stroke={b.tick} strokeWidth={b.tick === RED ? 2 : 1.5} />}
          <Label x={b.x} y={106} anchor="middle" fill={b.tick ?? INK_3} size={9} weight={600}>
            {b.words}
          </Label>
          <Label x={b.x} y={137} anchor="middle" fill={INK_3} size={8.5}>
            {b.why}
          </Label>
        </g>
      ))}
      <Label x={190} y={20} anchor="middle" fill={INK_3} size={9}>
        one-minute bars · up bars hollow, down bars filled
      </Label>
    </svg>
  );
};

export interface ReportGuideRow {
  label: string;
  price: number;
  tests: number;
  held: number;
  broke: number;
  grade: string;
  trend: string;
}

interface ReportGuideProps {
  rows: ReportGuideRow[];
  bars: number;
  from: string | null;
}

const ReportGuide = ({ rows, bars, from }: ReportGuideProps) => {
  const told = [...rows].sort((a, b) => b.tests - a.tests).slice(0, 3);
  return (
    <div className="px-3 py-3 flex flex-col gap-3" data-report-guide-card>
      <div>
        <p className="text-[12px] font-semibold text-textPrimary">Each row · one of today's levels and how it did</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-textSecondary">
          Every row is one of today's levels: the call wall, the put wall, the flip, the pin, the supreme. Its price is on the left with a chip that sums up its day. The strip is the whole session from 9:30 to now. Every time price reached the level in a one-minute bar, the strip gets a tick: green if the level held, red if price closed through it. The facts count those ticks and say how much hedging the level has gained or lost since the open.
        </p>
        <div className="mt-2 rounded-md border border-borderSubtle/60 bg-panel px-2 py-2">
          <RowFigure />
        </div>
      </div>
      <div>
        <p className="text-[12px] font-semibold text-textPrimary">What counts · a test and a break</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-textSecondary">
          A test is a one-minute bar whose range reaches the level. If the bar closes back on the near side, the level held. If it closes on the far side, it broke. A bar that never reaches the level is not a test at all. Hover a tick to see the minute and the close; click a level to make it the strike the rest of the page follows.
        </p>
        <div className="mt-2 rounded-md border border-borderSubtle/60 bg-panel px-2 py-2">
          <TestFigure />
        </div>
      </div>
      {told.length > 0 && (
        <div className="border-t border-borderSubtle/60 pt-2.5">
          <p className="text-[10px] text-textMuted">Today's levels, in words</p>
          <ul className="mt-1 flex flex-col gap-1.5">
            {told.map(r => (
              <li key={r.label} className="text-[11.5px] leading-relaxed text-textSecondary">
                The {r.label.toLowerCase()} at <span className="font-mono tnum text-textPrimary">{fmtStrike(r.price)}</span>{' '}
                {r.tests === 0 ? 'has not been tested yet' : `was tested ${r.tests} time${r.tests === 1 ? '' : 's'} and ${r.grade}`}. Its hedging is {r.trend}.
              </li>
            ))}
            <li className="text-[11.5px] leading-relaxed text-textSecondary">
              The strips cover <span className="font-mono tnum text-textPrimary">{bars}</span> one-minute bars{from ? ` since ${from}` : ''}.
            </li>
          </ul>
        </div>
      )}
      <p className="text-[10px] text-textMuted">The report reads today's session only. It starts over at the open.</p>
    </div>
  );
};

export default ReportGuide;
