/*
==================================================
  SLAYER TERMINAL - HOW THE LEVELS HELD TODAY
  (components/gex/WallReportCard.tsx)

  Levels earn trust in front of the reader (the
  Pinpoint roadmap, 2026-09-05). Every named level
  of today's map — the call wall, the flip, the put
  wall, the gamma pin, the supreme — with its record
  for the session: how many times price tested it,
  how many of those it held, how many it broke, when
  it was last touched, and whether the gamma behind
  it has grown or shrunk since the open.

  REDONE 2026-09-05 in the approved grammar (the
  positions cards): a row per level, hairlines and
  air instead of a table, labels over values, and
  the record drawn as a STRIP OF THE SESSION — one
  tick per test along the day, green where the
  level held, red where it broke — with a hover
  card that names the minute and the close. The
  strip is the picture the seven numbers used to
  stand in for.

  THE RECORD COMES OFF THE SAME BARS the chart
  draws, with the same rule the focus chip and the
  wall conviction use: a bar's range reaching the
  level is a test; a close beyond it after a test
  is a break. Nothing is graded by opinion.

  A ROW IS A STRIKE. Click one and it is the
  terminal's strike, on the rail above and the chip
  in the shell.
==================================================
*/

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { buildExposureProfile } from '../../data/exposure';
import { buildLevelRead, sessionBars } from '../../data/levelview';
import { CALL_WALL, FLIP, PUT_WALL, SUPREME } from './paletteInk';
import GuideFocus, { GuideDoor } from '../ui/GuideFocus';
import ReportGuide from './ReportGuide';
import type { Candle, MarketSnapshot } from '../../types/market';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const GREEN = 'rgb(var(--bull))';
const RED = 'rgb(var(--bear))';
const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const hhmm = (unix: number) => new Date(unix * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

interface Tick {
  /** Index into the session's bars — the strip's x */
  i: number;
  time: number;
  close: number;
  kind: 'held' | 'broke';
}

/** Every test of a level along the session, bar by bar — the same rule as
    touchesAndBreaks (data/wallConviction.ts), kept here as events rather than
    counts so the strip can draw each one. */
function levelTicks(bars: readonly Candle[], strike: number, side: 'call' | 'put'): Tick[] {
  const out: Tick[] = [];
  let touches = 0;
  let broken = false;
  bars.forEach((b, i) => {
    const touched = b.low <= strike && b.high >= strike;
    const beyond = side === 'call' ? b.close > strike : b.close < strike;
    if (touched) touches++;
    if (beyond && !broken) {
      if (touches > 0) out.push({ i, time: b.time, close: b.close, kind: 'broke' });
      broken = true;
      return;
    }
    if (!beyond) broken = false;
    if (touched) out.push({ i, time: b.time, close: b.close, kind: 'held' });
  });
  return out;
}

interface Row {
  key: string;
  label: string;
  ink: string;
  price: number;
  side: 'call' | 'put';
  ticks: Tick[];
  tests: number;
  held: number;
  broke: number;
  last: string | null;
  trend: string;
  grade: { words: string; tone: 'good' | 'bad' | 'quiet' };
}

const TONE: Record<Row['grade']['tone'], string> = {
  good: 'bg-bull/10 text-bull border-bull/20',
  bad: 'bg-bear/10 text-bear border-bear/20',
  quiet: 'bg-ink/[0.05] text-textSecondary border-borderSubtle',
};

// ---- the strip ----------------------------------------------------------------

const SW = 600;
const SH = 28;

const SessionStrip = ({ row, bars }: { row: Row; bars: readonly Candle[] }) => {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<Tick | null>(null);
  const n = Math.max(1, bars.length - 1);
  const x = (i: number) => 8 + (i / n) * (SW - 16);
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = ref.current;
    if (!svg || !row.ticks.length) return;
    const r = svg.getBoundingClientRect();
    const u = ((e.clientX - r.left) / r.width) * SW;
    const near = row.ticks.reduce((b, t) => (Math.abs(x(t.i) - u) < Math.abs(x(b.i) - u) ? t : b), row.ticks[0]);
    setHover(Math.abs(x(near.i) - u) < 14 ? near : null);
  };
  const cardLeft = hover ? (x(hover.i) / SW) * 100 : 0;
  const onRight = hover ? x(hover.i) < SW * 0.6 : true;
  return (
    <div className="relative" onPointerLeave={() => setHover(null)}>
      <svg ref={ref} viewBox={`0 0 ${SW} ${SH}`} width="100%" height={SH} preserveAspectRatio="none" data-session-strip onPointerMove={onMove} style={{ display: 'block', cursor: row.ticks.length ? 'crosshair' : 'default' }} role="img" aria-label={`${row.label}: ${row.tests} tests along the session`}>
        {/* the session, as a hairline from the first bar to the newest */}
        <line x1={8} x2={SW - 8} y1={SH / 2} y2={SH / 2} stroke="#ffffff" strokeOpacity={0.1} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {/* one tick per test */}
        {row.ticks.map(t => (
          <line
            key={`${t.i}-${t.kind}`}
            x1={x(t.i)}
            x2={x(t.i)}
            y1={t.kind === 'broke' ? 4 : 8}
            y2={t.kind === 'broke' ? SH - 4 : SH - 8}
            stroke={t.kind === 'broke' ? RED : GREEN}
            strokeOpacity={hover && hover !== t ? 0.45 : 0.9}
            strokeWidth={t.kind === 'broke' ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {/* now — the newest bar */}
        <line x1={SW - 8} x2={SW - 8} y1={6} y2={SH - 6} stroke={SILVER} strokeOpacity={0.6} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      </svg>
      {hover && (
        <div
          data-strip-card
          className="absolute -top-1 z-10 pointer-events-none rounded-md border border-borderMuted bg-card/95 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.5)] px-2.5 py-1.5 whitespace-nowrap animate-soft-in"
          style={{ left: `${cardLeft}%`, transform: onRight ? 'translate(12px, -100%)' : 'translate(calc(-100% - 12px), -100%)' }}
        >
          <span className="font-mono text-[11px] font-semibold tnum text-textPrimary">{hhmm(hover.time)}</span>
          <span className={`ml-2 text-[11px] font-medium ${hover.kind === 'broke' ? 'text-bear' : 'text-bull'}`}>{hover.kind === 'broke' ? 'broke' : 'tested, held'}</span>
          <span className="ml-2 font-mono text-[10px] tnum text-textMuted">close {hover.close.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
};

// ---- the section ----------------------------------------------------------------

/** `scope`: the host's chip saying which name's levels these are */
const WallReportCard = ({ snapshot, focus, onPick, scope, bars: barsProp }: { snapshot: MarketSnapshot; focus: number | null; onPick: (price: number) => void; scope?: ReactNode; /** The day so far, handed in — the Map's replay reads the bars up to its position (2026-09-08) */ bars?: readonly Candle[] }) => {
  const bars = useMemo(() => barsProp ?? sessionBars(snapshot.ticker) ?? [], [snapshot, barsProp]);
  const rows = useMemo<Row[]>(() => {
    let levels: { callWall: number; putWall: number; flip: number; pin: number; supreme: number; spot: number } | null = null;
    try {
      levels = buildExposureProfile(snapshot, '0DTE', 20).levels;
    } catch {
      return [];
    }
    if (!levels) return [];
    const mk = (key: string, label: string, ink: string, price: number, side: 'call' | 'put'): Row => {
      const ticks = levelTicks(bars, price, side);
      const broke = ticks.filter(t => t.kind === 'broke').length;
      const tests = ticks.length;
      const held = tests - broke;
      const read = buildLevelRead(snapshot.ticker, price);
      const pct = read?.changePct ?? null;
      const size = pct == null ? '' : Math.abs(pct) >= 300 ? ` · ${(1 + pct / 100).toFixed(0)}× the open` : ` ${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`;
      const trend = !read || read.trend === 'FLAT' ? 'flat since the open' : read.trend === 'NEW' ? 'new since the open' : `${read.trend === 'BUILDING' ? 'growing' : 'shrinking'}${size}`;
      const grade: Row['grade'] =
        tests === 0 ? { words: 'untested', tone: 'quiet' } : broke === 0 ? { words: `held every test`, tone: 'good' } : held === 0 ? { words: 'broke every test', tone: 'bad' } : { words: `broke ${broke} of ${tests}`, tone: broke * 2 >= tests ? 'bad' : 'quiet' };
      return { key, label, ink, price, side, ticks, tests, held, broke, last: read?.lastTouch ?? null, trend, grade };
    };
    const spot = levels.spot;
    const out: Row[] = [
      mk('call', 'Call wall', CALL_WALL, levels.callWall, 'call'),
      mk('flip', 'Gamma flip', FLIP, levels.flip, levels.flip >= spot ? 'call' : 'put'),
      mk('put', 'Put wall', PUT_WALL, levels.putWall, 'put'),
      mk('pin', 'Gamma pin', '#EDEDED', levels.pin, levels.pin >= spot ? 'call' : 'put'),
      mk('supreme', 'Supreme', SUPREME, levels.supreme, levels.supreme >= spot ? 'call' : 'put'),
    ];
    // Highest price first — the section reads like the ladder above it
    return out.sort((a, b) => b.price - a.price || a.key.localeCompare(b.key));
  }, [snapshot, bars]);

  const first = bars[0]?.time;
  const last = bars[bars.length - 1]?.time;
  /* The guide as a focus over the whole box (the house pattern, 2026-09-06) */
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <section className="relative flex flex-col min-w-0" data-report-card>
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the report" testId="report-guide" viewport>
        <ReportGuide rows={rows.map(r => ({ label: r.label, price: r.price, tests: r.tests, held: r.held, broke: r.broke, grade: r.grade.words, trend: r.trend }))} bars={bars.length} from={first != null ? hhmm(first) : null} />
      </GuideFocus>
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">How the levels held today</h3>
          {scope}
          <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the rows, the strips and the ticks mean" testId="report-guide" />
        </div>
        <p className="mt-0.5 text-[11px] text-textMuted">
          {rows.length} levels · {bars.length} one-minute bars{first != null && last != null ? ` from ${hhmm(first)} to ${hhmm(last)}` : ''} · a test is a bar whose range reaches the level, a break is a close beyond it after a test
        </p>
      </div>
      <ul className="flex flex-col" data-level-rows>
        {rows.map(r => {
          const isFocus = focus != null && Math.abs(focus - r.price) < 1e-9;
          const facts: { k: string; v: string; cls?: string }[] = [
            { k: 'Tests', v: String(r.tests) },
            { k: 'Held', v: String(r.held), cls: r.held > 0 ? 'text-bull' : undefined },
            { k: 'Broke', v: String(r.broke), cls: r.broke > 0 ? 'text-bear' : undefined },
            { k: 'Last touched', v: r.last ?? '—' },
            { k: 'Gamma since the open', v: r.trend },
          ];
          return (
            <li key={r.key} className={`border-t border-borderSubtle/50 ${isFocus ? 'bg-silver/[0.04]' : ''}`} data-level={r.key}>
              <div className="grid grid-cols-[200px_minmax(0,1fr)_auto] items-center gap-6 px-5 py-3">
                <button onClick={() => onPick(r.price)} className="text-left min-w-0 group" title={`${r.label} ${fmtStrike(r.price)} — click to make this the strike`} data-level-pick>
                  <span className="block text-[11px] font-semibold" style={{ color: r.ink }}>
                    {r.label}
                  </span>
                  <span className={`block font-mono text-[15px] font-semibold tnum leading-tight ${isFocus ? 'text-silver' : 'text-textPrimary group-hover:text-silver'} transition-colors`}>{fmtStrike(r.price)}</span>
                  <span className={`mt-1 inline-flex items-center h-5 px-2 rounded-full border text-[10px] font-medium ${TONE[r.grade.tone]}`} data-grade>
                    {r.grade.words}
                  </span>
                </button>
                <div className="min-w-0">
                  <SessionStrip row={r} bars={bars} />
                  <div className="flex justify-between font-mono text-[9px] tnum text-textMuted px-1 -mt-0.5">
                    <span>{first != null ? hhmm(first) : ''}</span>
                    <span>now</span>
                  </div>
                </div>
                {/* Fixed tracks, so every row's strip ends on the same line whatever the words in the last fact */}
                <dl className="grid grid-cols-[52px_52px_52px_88px_172px] gap-x-5">
                  {facts.map(f => (
                    <div key={f.k} className="min-w-0">
                      <dt className="text-[10px] text-textMuted whitespace-nowrap">{f.k}</dt>
                      <dd className={`mt-0.5 font-mono text-[12px] tnum whitespace-nowrap ${f.cls ?? 'text-textPrimary'}`}>{f.v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default WallReportCard;
