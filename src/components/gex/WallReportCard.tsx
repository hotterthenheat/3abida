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

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
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

// ---- the level's session --------------------------------------------------------------

/*
  READABLE AT A GLANCE (Noah, 2026-09-13: "I think its a very cool feature but
  I can't even see anything look at it what the hell can I see?"). The old
  strip was a hairline with a tick per test — on a quiet level, nothing. Now
  every row draws THE SESSION ITSELF: the price path across the day, the
  level as a dashed rule in its own ink, and a dot on the path wherever the
  bar reached the level — green where it held, red where it broke. A reader
  sees price walk up to the level and bounce or cross, and how far it sits
  from it now. Sized in pixels, measured once per resize, so the dots are
  round and the strokes are one pixel whatever the column's width.
*/
const PATH_H = 72;

const LevelPath = ({ row, bars }: { row: Row; bars: readonly Candle[] }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const read = () => setW(el.clientWidth);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [hover, setHover] = useState<Tick | null>(null);
  const n = Math.max(1, bars.length - 1);
  const PAD_X = 6;
  const PAD_Y = 8;
  const x = (i: number) => PAD_X + (i / n) * Math.max(1, w - PAD_X * 2);
  const { lo, hi } = useMemo(() => {
    let lo = row.price;
    let hi = row.price;
    for (const b of bars) {
      if (b.low < lo) lo = b.low;
      if (b.high > hi) hi = b.high;
    }
    const span = hi - lo || row.price * 0.002 || 1;
    return { lo: lo - span * 0.06, hi: hi + span * 0.06 };
  }, [bars, row.price]);
  const y = (p: number) => PAD_Y + (1 - (p - lo) / (hi - lo || 1)) * (PATH_H - PAD_Y * 2);
  const path = useMemo(() => {
    if (w <= 0 || bars.length < 2) return '';
    return bars.map((b, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(b.close).toFixed(1)}`).join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, w, lo, hi]);
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!row.ticks.length || w <= 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const u = e.clientX - r.left;
    const near = row.ticks.reduce((b, t) => (Math.abs(x(t.i) - u) < Math.abs(x(b.i) - u) ? t : b), row.ticks[0]);
    setHover(Math.abs(x(near.i) - u) < 12 ? near : null);
  };
  const last = bars[bars.length - 1];
  const levelY = y(row.price);
  const onRight = hover ? x(hover.i) < w * 0.6 : true;
  return (
    <div ref={hostRef} className="relative w-full" style={{ height: PATH_H }} onPointerMove={onMove} onPointerLeave={() => setHover(null)} data-level-path>
      {w > 0 && (
        <svg width={w} height={PATH_H} className="block" role="img" aria-label={`${row.label} ${fmtStrike(row.price)}: ${row.tests} tests along the session, ${row.held} held, ${row.broke} broke`}>
          {/* the level, a dashed rule in its own ink */}
          <line x1={PAD_X} x2={w - PAD_X} y1={levelY} y2={levelY} stroke={row.ink} strokeOpacity={0.8} strokeWidth={1} strokeDasharray="4 3" />
          {/* the session's path */}
          {path && <path d={path} fill="none" stroke="#ededed" strokeOpacity={0.75} strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />}
          {/* every test on the path — held green, broke red */}
          {row.ticks.map(t => (
            <circle
              key={`${t.i}-${t.kind}`}
              cx={x(t.i)}
              cy={y(t.close)}
              r={hover === t ? 4.5 : t.kind === 'broke' ? 3.5 : 3}
              fill={t.kind === 'broke' ? RED : GREEN}
              stroke="#0a0a0a"
              strokeWidth={1}
              opacity={hover && hover !== t ? 0.55 : 1}
            />
          ))}
          {/* now — the newest close */}
          {last && <circle cx={x(bars.length - 1)} cy={y(last.close)} r={2.5} fill={SILVER} />}
        </svg>
      )}
      {/* the level's price on its rule */}
      <span className="absolute right-1 font-mono text-[9px] tnum leading-none px-1 rounded bg-panel" style={{ top: Math.max(0, Math.min(PATH_H - 10, levelY - 5)), color: row.ink }}>
        {fmtStrike(row.price)}
      </span>
      {hover && (
        <div
          data-strip-card
          className="absolute -top-1 z-10 pointer-events-none rounded-md border border-borderMuted bg-card/95 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.5)] px-2.5 py-1.5 whitespace-nowrap animate-soft-in"
          style={{ left: x(hover.i), transform: onRight ? 'translate(12px, -100%)' : 'translate(calc(-100% - 12px), -100%)' }}
        >
          <span className="font-mono text-[11px] font-semibold tnum text-textPrimary">{hhmm(hover.time)}</span>
          <span className={`ml-2 text-[11px] font-medium ${hover.kind === 'broke' ? 'text-bear' : 'text-bull'}`}>{hover.kind === 'broke' ? 'broke' : 'tested, held'}</span>
          <span className="ml-2 font-mono text-[10px] tnum text-textSecondary">close {hover.close.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
};

/** The record as a bar: held in green, broke in red, the counts on it */
const RecordBar = ({ held, broke }: { held: number; broke: number }) => {
  const tests = held + broke;
  if (tests === 0) return <span className="inline-flex items-center h-[14px] w-[120px] rounded-full bg-ink/[0.06] text-[9px] justify-center text-textSecondary">no tests yet</span>;
  return (
    <span className="inline-flex h-[14px] w-[120px] rounded-full overflow-hidden bg-ink/[0.06] font-mono text-[9px] font-semibold leading-[14px]" aria-hidden>
      {held > 0 && (
        <span className="text-center text-[#0a0a0a]" style={{ width: `${(held / tests) * 100}%`, background: GREEN }}>
          {held}
        </span>
      )}
      {broke > 0 && (
        <span className="text-center text-[#0a0a0a]" style={{ width: `${(broke / tests) * 100}%`, background: RED }}>
          {broke}
        </span>
      )}
    </span>
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
  const spot = snapshot.spot;
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
        <p className="mt-0.5 text-[11px] text-textSecondary">
          {rows.length} levels · {bars.length} one-minute bars{first != null && last != null ? ` from ${hhmm(first)} to ${hhmm(last)}` : ''} · a test is a bar whose range reaches the level, a break is a close beyond it after a test
        </p>
      </div>
      <ul className="flex flex-col" data-level-rows>
        {rows.map(r => {
          const isFocus = focus != null && Math.abs(focus - r.price) < 1e-9;
          const dist = spot ? ((r.price - spot) / spot) * 100 : null;
          return (
            <li key={r.key} className={`border-t border-borderSubtle/50 ${isFocus ? 'bg-silver/[0.04]' : ''}`} data-level={r.key}>
              <div className="grid grid-cols-[180px_minmax(0,1fr)_auto] items-center gap-6 px-5 py-3">
                <button onClick={() => onPick(r.price)} className="text-left min-w-0 group" title={`${r.label} ${fmtStrike(r.price)} — click to make this the strike`} data-level-pick>
                  <span className="block text-[12px] font-semibold" style={{ color: r.ink }}>
                    {r.label}
                  </span>
                  <span className={`block font-mono text-[18px] font-semibold tnum leading-tight ${isFocus ? 'text-silver' : 'text-textPrimary group-hover:text-silver'} transition-colors`}>{fmtStrike(r.price)}</span>
                  {dist != null && (
                    <span className={`block font-mono text-[10px] tnum ${dist > 0 ? 'text-bull' : dist < 0 ? 'text-bear' : 'text-textSecondary'}`}>
                      {dist > 0 ? '+' : ''}
                      {dist.toFixed(2)}% from spot
                    </span>
                  )}
                  <span className={`mt-1 inline-flex items-center h-5 px-2 rounded-full border text-[10px] font-medium ${TONE[r.grade.tone]}`} data-grade>
                    {r.grade.words}
                  </span>
                </button>
                <div className="min-w-0">
                  <LevelPath row={r} bars={bars} />
                  <div className="flex justify-between font-mono text-[9px] tnum text-textSecondary px-1 mt-0.5">
                    <span>{first != null ? hhmm(first) : ''}</span>
                    <span>the session · price path, the level dashed, every test a dot</span>
                    <span>now</span>
                  </div>
                </div>
                {/* Fixed tracks, so every row's picture ends on the same line whatever the words in the last fact */}
                <dl className="grid grid-cols-[132px_60px_60px_88px_172px] gap-x-5 items-start">
                  <div className="min-w-0">
                    <dt className="text-[10px] text-textSecondary whitespace-nowrap">Record</dt>
                    <dd className="mt-1">
                      <RecordBar held={r.held} broke={r.broke} />
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] text-textSecondary whitespace-nowrap">Held</dt>
                    <dd className={`mt-0.5 font-mono text-[14px] font-semibold tnum ${r.held > 0 ? 'text-bull' : 'text-textPrimary'}`}>{r.held}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] text-textSecondary whitespace-nowrap">Broke</dt>
                    <dd className={`mt-0.5 font-mono text-[14px] font-semibold tnum ${r.broke > 0 ? 'text-bear' : 'text-textPrimary'}`}>{r.broke}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] text-textSecondary whitespace-nowrap">Last touched</dt>
                    <dd className="mt-0.5 font-mono text-[13px] tnum text-textPrimary whitespace-nowrap">{r.last ?? 'not yet'}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] text-textSecondary whitespace-nowrap">Gamma since the open</dt>
                    <dd className="mt-0.5 font-mono text-[13px] tnum text-textPrimary whitespace-nowrap">{r.trend}</dd>
                  </div>
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
