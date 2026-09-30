/*
==================================================
  SLAYER TERMINAL - A NAME'S OVERVIEW (pages/record/StockName.tsx)

  /record/stocks/<T> — the page a Stocks row opens
  (the partner's review, 2026-09-13: "stop sending
  me to the pinpoint page… tell me all about the
  stock, like the compass analysis"; then, with his
  own overview page: "i need all the information he
  has on there but formatted much better and
  sticking to our type design pattern, with smooth
  transitions and all… if certain needs need bars or
  visual representations then go for it"). In the
  setup page's grammar: the way back and a jump line
  at the top, the name seeded behind its skeleton,
  then the boxes:

    THE NAME       price, change, the market's
                   phase, the screen and the lean in
                   the board's own words, the score,
                   the four pillars as bars WITH their
                   figures, the doors
    WHY NOW        the biggest current facts, what is
                   for the name and against it, the
                   paragraph from the raw data to the
                   signal, and whether the pillars
                   agree — with the main risk
    THE TREND ·    the sessions, the averages, the
    THE MONEY      structure's four flags · the book
                   on a price scale (the walls, the
                   flip, spot, the supreme), calls
                   against puts, the dark pool's lean
    THE NEWS ·     the wire, the next report, how the
    THE NUMBERS    last reports moved it · a SAMPLE,
                   said so, with fair value on a scale
    HOW THE SCORE  what carries it and what drags it
    IS MADE        (every factor in points), the
                   weights, the trend's part session
                   by session, the moves that would
                   change it, every source — and the
                   method behind a fold
    THE TIMELINE   what happened on the sessions on
                   hand, with the trend's part then
    THE TAPE       the biggest buys and sells, the
                   busiest calls and puts — doors to
                   the Weigher
    ON THE RECORD  insiders and Congress

  States, not orders (the Compass doctrine): the page
  says what it sees — the screen and the lean — never
  buy, hold or sell.
==================================================
*/

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ChevronDown } from 'lucide-react';
import Simulator from '../../core/simulator';
import { useMarketData } from '../../context/MarketDataContext';
import { useSeeded } from '../../components/gex/useSeeded';
import GradeMeter, { GRADE_FILL, GRADE_INK } from '../../components/ui/GradeMeter';
import { gradeOfConviction, postureRead } from '../../data/darkpool';
import CompanyLogo from '../../components/ui/CompanyLogo';
import RichRead from '../../components/ui/RichRead';
import AnimatedNumber from '../../components/ui/AnimatedNumber';
import Fold from '../../components/ui/Fold';
import GuideFocus, { GuideDoor } from '../../components/ui/GuideFocus';
import SessionsChart, { type ChartMark, type ChartPoint } from '../../components/record/SessionsChart';
import type { UTCTimestamp } from 'lightweight-charts';
import { fmtClockLocal, fmtDayLocal } from '../../components/gex/chartTime';
import { When } from '../../components/record/when';
import { StockGuide } from '../../components/record/StockGuide';
import { buildStockOverview, fmtMoney, gradeOf, gradeOfComposite, GRADES, healthWord, ordinal, type Factor, type Grade, type Lean, type Pillar, type SourceStatus, type StockOverview, type TimelineKind } from '../../data/stockOverview';
import { TX_CODES, insiderFlow, isChosenBuy } from '../../data/insiders';
import { bracketLabel, buildCongress } from '../../data/congress';
import type { BookContract, FlowPrint } from '../../types/trace';
import { StockNameSkeleton } from './recordSkeletons';

const SILVER = 'rgb(var(--silver))';
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
/** Every bar on the page glides to its new width on the house curve — the scan tier re-reads the name every ten seconds */
const GLIDE = `width 520ms ${EASE}, left 520ms ${EASE}`;
/* the four public words, their inks and their meter are ui/GradeMeter.tsx — shared with the Tracker since 2026-09-19 */
const LEAN_INK: Record<Lean, string> = { bullish: 'text-bull', neutral: 'text-textPrimary', bearish: 'text-bear' };
const STATUS_WORD: Record<SourceStatus, string> = { live: 'live', sample: 'sample', thin: 'thin' };
const STATUS_INK: Record<SourceStatus, string> = { live: 'text-select', sample: 'text-warn', thin: 'text-textMuted' };
/** The same kinds as marks on the sessions chart — token inks, resolved on the island */
const KIND_MARK: Record<TimelineKind, string> = { earnings: 'rgb(var(--warn))', news: 'rgb(var(--silver))', breakout: 'rgb(var(--bull))', breakdown: 'rgb(var(--bear))', volume: 'rgb(var(--silver))', session: 'rgb(var(--text-primary))' };
/** A dark print's bar in the posture's ink: accumulation for, distribution against, the rest muted */
const INTENT_INK: Record<string, string> = { ACCUMULATION: 'rgb(var(--bull))', DISTRIBUTION: 'rgb(var(--bear))' };
/** The timeline's grade chip, in the report's three tones */
const LANE_TONE: Record<'good' | 'bad' | 'quiet', string> = {
  good: 'bg-bull/10 text-bull border-bull/20',
  bad: 'bg-bear/10 text-bear border-bear/20',
  quiet: 'bg-ink/[0.05] text-textSecondary border-borderSubtle',
};

/* ---- THE TIMELINE'S STRIP — the At the wall report's own lane (Noah, 2026-09-13, with its screenshot: "the timeline should have this
   type of design pattern… our neat clean concise look"): a hairline for the sessions on hand, a tick per mark in its ink, "now" as a
   silver tick, a card naming the session and the mark under the pointer ------------------------------------------------------ */
interface LaneTick {
  /** Which session on hand, the strip's x */
  i: number;
  ink: string;
  when: string;
  text: string;
  score: number | null;
  /** A full-height tick: a break, a big session */
  tall: boolean;
}
const SW = 600;
const SH = 28;
const MarkStrip = ({ ticks, n, label }: { ticks: LaneTick[]; n: number; label: string }) => {
  const ref = useRef<SVGSVGElement>(null);
  const [hot, setHot] = useState<LaneTick | null>(null);
  const span = Math.max(1, n - 1);
  const x = (i: number) => 8 + (i / span) * (SW - 16);
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = ref.current;
    if (!svg || !ticks.length) return;
    const r = svg.getBoundingClientRect();
    const u = ((e.clientX - r.left) / r.width) * SW;
    const near = ticks.reduce((b, t) => (Math.abs(x(t.i) - u) < Math.abs(x(b.i) - u) ? t : b), ticks[0]);
    setHot(Math.abs(x(near.i) - u) < 14 ? near : null);
  };
  const stacked = hot ? ticks.filter(t => t.i === hot.i) : [];
  const cardLeft = hot ? (x(hot.i) / SW) * 100 : 0;
  const onRight = hot ? x(hot.i) < SW * 0.6 : true;
  return (
    <div className="relative" onPointerLeave={() => setHot(null)}>
      <svg ref={ref} viewBox={`0 0 ${SW} ${SH}`} width="100%" height={SH} preserveAspectRatio="none" data-lane-strip onPointerMove={onMove} style={{ display: 'block', cursor: ticks.length ? 'crosshair' : 'default' }} role="img" aria-label={`${label}: ${ticks.length} on the sessions on hand`}>
        <line x1={8} x2={SW - 8} y1={SH / 2} y2={SH / 2} stroke="#ffffff" strokeOpacity={0.1} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {ticks.map((t, k) => (
          <line key={`${t.i}-${k}`} x1={x(t.i)} x2={x(t.i)} y1={t.tall ? 4 : 8} y2={t.tall ? SH - 4 : SH - 8} stroke={t.ink} strokeOpacity={hot && hot.i !== t.i ? 0.45 : 0.9} strokeWidth={t.tall ? 2 : 1.5} vectorEffect="non-scaling-stroke" />
        ))}
        <line x1={SW - 8} x2={SW - 8} y1={6} y2={SH - 6} stroke={SILVER} strokeOpacity={0.6} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      </svg>
      {hot && (
        <div data-strip-card className="absolute -top-1 z-10 pointer-events-none rounded-md border border-borderMuted bg-card/95 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.5)] px-2.5 py-1.5 whitespace-nowrap animate-soft-in" style={{ left: `${cardLeft}%`, transform: onRight ? 'translate(12px, -100%)' : 'translate(calc(-100% - 12px), -100%)' }}>
          {stacked.slice(0, 3).map((t, k) => (
            <div key={k} className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-semibold tnum text-textPrimary">{t.when}</span>
              <span className="text-[11px] font-medium" style={{ color: t.ink }}>
                {t.text}
              </span>
              {t.score != null && <span className="font-mono text-[10px] text-textMuted">the trend read {gradeOf(t.score)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
const KIND_WORD: Record<TimelineKind, string> = { earnings: 'report', news: 'the wire', breakout: 'breakout', breakdown: 'breakdown', volume: 'volume', session: 'session' };
const JUMPS: [string, string][] = [
  ['name', 'The name'],
  ['why', 'Why now'],
  ['trend', 'Trend'],
  ['money', 'Money'],
  ['news', 'News'],
  ['numbers', 'Numbers'],
  ['score', 'Behind the read'],
  ['timeline', 'Timeline'],
  ['buys', 'The tape'],
  ['insiders', 'Insiders'],
  ['congress', 'Congress'],
];
const pct = (v: number, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`;
/** A chart point's seconds, said as the reader's day or minute */
const dayOf = (t: number) => fmtDayLocal(t as UTCTimestamp);
const clockOf = (t: number) => fmtClockLocal(t as UTCTimestamp);
const ago = (m: number) => (m < 1 ? 'just now' : m < 60 ? `${Math.round(m)}m ago` : `${Math.floor(m / 60)}h ${Math.round(m % 60)}m ago`);
const count = (v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : `${Math.round(v)}`);
/** "09/18/2026" → "2026-09-18", the Weigher's date key */
const isoOf = (mmddyyyy: string) => {
  const [m, d, y] = mmddyyyy.split('/');
  return y && m && d ? `${y}-${m}-${d}` : mmddyyyy;
};

/* ---- the pieces ---------------------------------------------------------------- */

const Box = ({ title, sub, aside, testId, children }: { title: string; sub?: ReactNode; aside?: ReactNode; testId: string; children: ReactNode }) => (
  <div id={`stock-${testId}`} className="border border-borderSubtle rounded-md bg-panel flex flex-col scroll-mt-4" data-stock-box={testId}>
    <div className="px-5 pt-4 pb-3 flex items-start gap-4">
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">{title}</h3>
        {sub && <p className="mt-0.5 text-[11px] text-textMuted truncate">{sub}</p>}
      </div>
      {aside}
    </div>
    {children}
  </div>
);
const Fact = ({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) => (
  <div className="min-w-0">
    <dt className="text-[10px] text-textMuted whitespace-nowrap">{label}</dt>
    <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap truncate" data-stock-fact={testId}>
      {children}
    </dd>
  </div>
);
const Door = ({ onClick, onWarm, children }: { onClick: () => void; onWarm?: () => void; children: ReactNode }) => (
  <button type="button" onClick={onClick} onMouseEnter={onWarm} className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-borderSubtle bg-chip hover:border-borderMuted font-mono text-[9px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors">
    <ArrowUpRight className="w-3 h-3" />
    {children}
  </button>
);
const StatusTag = ({ status }: { status: SourceStatus }) => (
  <span className={`font-mono text-[8px] uppercase tracking-widest ${STATUS_INK[status]}`} data-stock-status={status}>
    {STATUS_WORD[status]}
  </span>
);
/** A pillar as its word and the meter — its figure stays inside the engine */
const PillarBar = ({ p, big = false }: { p: Pillar; big?: boolean }) => {
  const grade = gradeOf(p.score);
  return (
    <div className="min-w-0" data-stock-pillar={p.key} data-grade={grade}>
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] text-textMuted whitespace-nowrap">{p.name}</span>
        {p.status !== 'live' && <StatusTag status={p.status} />}
        <span className={`ml-auto font-mono ${big ? 'text-[13px]' : 'text-[12px]'} font-semibold ${GRADE_INK[grade]}`}>{grade}</span>
      </div>
      <div className="mt-1">
        <GradeMeter grade={grade} />
      </div>
    </div>
  );
};
/** A signed bar from the middle: right in green for the name, left in red against it — `v` in −1…+1 */
const SignedBar = ({ v, thick = false }: { v: number; thick?: boolean }) => {
  const a = Math.min(1, Math.abs(v));
  return (
    <span className={`relative block ${thick ? 'h-[6px]' : 'h-[4px]'} rounded-full bg-ink/[0.06] overflow-hidden`}>
      <span className="absolute inset-y-0 left-1/2 w-px bg-ink/25" />
      <span className={`absolute inset-y-0 rounded-full ${v >= 0 ? 'bg-bull' : 'bg-bear/70'}`} style={{ transition: GLIDE, ...(v >= 0 ? { left: '50%', width: `${a * 50}%` } : { left: `${50 - a * 50}%`, width: `${a * 50}%` }) }} />
    </span>
  );
};
const FactorRow = ({ f }: { f: Factor }) => (
  <div className="px-5 py-2 grid items-center gap-x-4 border-t border-borderSubtle/40" style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr) 96px' }} data-stock-factor={f.key} data-lean={f.lean.toFixed(2)}>
    <span className="min-w-0">
      <span className="block text-[11px] text-textPrimary truncate">{f.label}</span>
      <span className="block text-[9px] text-textMuted truncate">{f.note}</span>
    </span>
    <span className="font-mono text-[11px] tnum text-textPrimary truncate">{f.value}</span>
    <SignedBar v={f.lean} />
  </div>
);
const Money = ({ v, signed = true }: { v: number; signed?: boolean }) => <span className={signed ? (v >= 0 ? 'text-bull' : 'text-bear') : ''}>{fmtMoney(v)}</span>;

/** A two-sided share bar: the left side's share of the whole, the rest to the right */
const ShareBar = ({ left, leftInk = 'bg-bull', rightInk = 'bg-bear/80' }: { left: number; leftInk?: string; rightInk?: string }) => (
  <div className="flex h-[6px] rounded-full overflow-hidden bg-ink/[0.06]">
    <span className={`h-full ${leftInk}`} style={{ width: `${left}%`, transition: GLIDE }} />
    <span className={`h-full ${rightInk}`} style={{ width: `${100 - left}%`, transition: GLIDE }} />
  </div>
);

/** A scale's hover read — a small card over the point under the pointer (a drawn scale is never a still picture) */
const ScaleCard = ({ at, children }: { at: number; children: ReactNode }) => (
  <div className="absolute -top-1 z-10 pointer-events-none -translate-x-1/2 -translate-y-full rounded-md border border-borderSubtle px-2 py-1.5 whitespace-nowrap text-[10px] text-textSecondary" style={{ left: `${Math.max(12, Math.min(88, at))}%`, background: 'rgba(8,8,10,0.9)', backdropFilter: 'blur(3px)' }} data-scale-card>
    {children}
  </div>
);

/** THE BOOK ON A PRICE SCALE — the put wall, the flip, spot, the call wall and the supreme on one line, each named in its ink.
    A label that would sit on its neighbour's takes the upper row; the ticks stay where the prices are. Hover a mark for its read. */
const LEVEL_WORDS: Record<string, string> = {
  put: 'dealer hedging bids there — support',
  flip: 'above it dealers absorb moves, below it they amplify them',
  spot: 'the last price',
  call: 'dealer hedging supplies stock there — resistance',
  supreme: 'the heaviest strike on the book',
};
const LevelsScale = ({ spot, putWall, flip, callWall, supreme }: { spot: number; putWall: number; flip: number; callWall: number; supreme: number }) => {
  const [hot, setHot] = useState<string | null>(null);
  const marks = [
    { key: 'put', price: putWall, word: 'put wall', ink: 'rgb(var(--bear))' },
    { key: 'flip', price: flip, word: 'flip', ink: SILVER },
    { key: 'spot', price: spot, word: 'spot', ink: 'rgb(var(--text-primary))' },
    { key: 'call', price: callWall, word: 'call wall', ink: 'rgb(var(--bull))' },
    { key: 'supreme', price: supreme, word: 'supreme', ink: 'rgb(var(--supreme))' },
  ].sort((a, b) => a.price - b.price);
  const lo = marks[0].price;
  const hi = marks[marks.length - 1].price;
  const pad = Math.max((hi - lo) * 0.12, spot * 0.004);
  const x = (p: number) => ((p - (lo - pad)) / (hi - lo + 2 * pad)) * 100;
  /* two rows of words: a mark within a tenth of the scale of the one before it goes to the other row */
  const rows: number[] = [];
  marks.forEach((m, i) => {
    const prev = marks[i - 1];
    rows.push(prev && x(m.price) - x(prev.price) < 11 ? (rows[i - 1] === 0 ? 1 : 0) : 0);
  });
  const hotMark = marks.find(m => m.key === hot) ?? null;
  return (
    <div className="relative">
      {hotMark && (
        <ScaleCard at={x(hotMark.price)}>
          <span className="font-mono font-bold tnum" style={{ color: hotMark.ink }}>
            {hotMark.word} {hotMark.key === 'spot' ? hotMark.price.toFixed(2) : hotMark.price}
          </span>
          {hotMark.key !== 'spot' && (
            <span className="font-mono tnum text-textPrimary">
              {' '}
              · {pct(((hotMark.price - spot) / spot) * 100)} from spot
            </span>
          )}
          <span className="block text-textMuted">{LEVEL_WORDS[hotMark.key]}</span>
        </ScaleCard>
      )}
      <svg width="100%" height={54} className="block overflow-visible" role="img" aria-label={`The book on a price scale: put wall ${putWall}, flip ${flip}, spot ${spot.toFixed(2)}, call wall ${callWall}, supreme ${supreme}`} data-stock-scale={hot ?? 'rest'}>
        <line x1="0%" x2="100%" y1={27} y2={27} stroke="rgb(var(--ink))" strokeOpacity={0.14} />
        {/* the likely range between the walls, faint */}
        <rect x={`${x(putWall)}%`} y={24} width={`${Math.max(0, x(callWall) - x(putWall))}%`} height={6} fill={SILVER} fillOpacity={0.1} />
        {marks.map((m, i) => {
          const up = rows[i] === 1;
          const isSpot = m.key === 'spot';
          const on = hot === m.key;
          return (
            <g key={m.key} data-scale-mark={m.key} onMouseEnter={() => setHot(m.key)} onMouseLeave={() => setHot(h => (h === m.key ? null : h))} style={{ cursor: 'default' }}>
              {/* a wide silent hit area, so the mark is easy to hover */}
              <rect x={`calc(${x(m.price)}% - 12px)`} y={0} width={24} height={54} fill="transparent" />
              <line x1={`${x(m.price)}%`} x2={`${x(m.price)}%`} y1={isSpot ? 18 : 22} y2={isSpot ? 36 : 32} stroke={m.ink} strokeWidth={isSpot || on ? 2 : 1.25} strokeDasharray={m.key === 'flip' ? '2 2' : undefined} />
              <text x={`${x(m.price)}%`} y={up ? 12 : 46} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, Menlo, monospace" fill={m.ink} fontWeight={isSpot || on ? 700 : 500}>
                {isSpot ? m.price.toFixed(2) : m.price}
              </text>
              <text x={`${x(m.price)}%`} y={up ? 4 : 54} textAnchor="middle" fontSize={7.5} fontFamily="ui-monospace, Menlo, monospace" letterSpacing={0.6} fill={m.ink} fillOpacity={on ? 1 : 0.75}>
                {m.word.toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/** FAIR VALUE ON A SCALE — a window of ±20% around the fair value: the cheap fifth in green, the rich fifth in red, the price as a plain tick.
    The pointer reads the price at any point of the scale and its distance from fair. */
const FairValueScale = ({ price, fair, vsPct }: { price: number; fair: number; vsPct: number }) => {
  const [at, setAt] = useState<number | null>(null);
  const x = (p: number) => Math.max(0, Math.min(100, ((p / fair - 0.8) / 0.4) * 100));
  const px = x(price);
  const priceAt = (frac: number) => fair * (0.8 + 0.4 * frac);
  return (
    <div
      className="relative"
      onMouseMove={e => {
        const r = e.currentTarget.getBoundingClientRect();
        setAt(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
      }}
      onMouseLeave={() => setAt(null)}
    >
      {at != null && (
        <ScaleCard at={at * 100}>
          <span className="font-mono font-bold tnum text-textPrimary">{priceAt(at).toFixed(2)}</span>
          <span className="font-mono tnum"> · {pct((priceAt(at) / fair - 1) * 100)} from fair</span>
          <span className="block text-textMuted">{priceAt(at) / fair <= 0.92 ? 'cheap against its own worth' : priceAt(at) / fair >= 1.08 ? 'rich against its own worth' : 'about fairly priced'}</span>
        </ScaleCard>
      )}
      <svg width="100%" height={46} className="block overflow-visible" role="img" aria-label={`Fair value ${fair.toFixed(2)}, the price ${price.toFixed(2)} sits ${pct(vsPct)} from it`} data-stock-fair={vsPct.toFixed(1)}>
        <line x1="0%" x2="100%" y1={22} y2={22} stroke="rgb(var(--ink))" strokeOpacity={0.14} />
        <rect x="0%" y={19} width={`${x(fair * 0.92)}%`} height={6} fill="rgb(var(--bull))" fillOpacity={0.14} />
        <rect x={`${x(fair * 1.08)}%`} y={19} width={`${100 - x(fair * 1.08)}%`} height={6} fill="rgb(var(--bear))" fillOpacity={0.14} />
        <line x1="50%" x2="50%" y1={16} y2={28} stroke={SILVER} strokeWidth={1.25} strokeDasharray="2 2" />
        <text x="50%" y={40} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, Menlo, monospace" fill={SILVER}>
          fair {fair.toFixed(2)}
        </text>
        {at != null && <line x1={`${at * 100}%`} x2={`${at * 100}%`} y1={14} y2={30} stroke="rgb(var(--ink))" strokeOpacity={0.35} strokeWidth={1} />}
        <line x1={`${px}%`} x2={`${px}%`} y1={13} y2={31} stroke="rgb(var(--text-primary))" strokeWidth={2} style={{ transition: `x1 520ms ${EASE}, x2 520ms ${EASE}` }} />
        <text x={`${px}%`} y={9} textAnchor="middle" fontSize={9} fontWeight={700} fontFamily="ui-monospace, Menlo, monospace" fill="rgb(var(--text-primary))">
          {price.toFixed(2)} · {pct(vsPct)}
        </text>
        <text x="0%" y={40} textAnchor="start" fontSize={7.5} letterSpacing={0.6} fontFamily="ui-monospace, Menlo, monospace" fill="rgb(var(--bull))" fillOpacity={0.8}>
          CHEAP · −20%
        </text>
        <text x="100%" y={40} textAnchor="end" fontSize={7.5} letterSpacing={0.6} fontFamily="ui-monospace, Menlo, monospace" fill="rgb(var(--bear))" fillOpacity={0.8}>
          RICH · +20%
        </text>
      </svg>
    </div>
  );
};

/** The structure's four flags: the last five sessions' swings against the five before */
const Flags = ({ flags }: { flags: NonNullable<StockOverview['trend']['flags']> }) => {
  const items: [string, string, boolean, boolean][] = [
    ['HH', 'higher highs', flags.hh, true],
    ['HL', 'higher lows', flags.hl, true],
    ['LH', 'lower highs', flags.lh, false],
    ['LL', 'lower lows', flags.ll, false],
  ];
  return (
    <span className="inline-flex items-center gap-1.5" data-stock-flags={items.filter(i => i[2]).map(i => i[0]).join(' ')}>
      {items.map(([code, word, on, good]) => (
        <span key={code} title={word} className={`inline-flex items-center h-5 px-1.5 rounded border font-mono text-[9px] font-bold tracking-wider transition-colors ${on ? (good ? 'border-bull/40 text-bull bg-bull/10' : 'border-bear/40 text-bear bg-bear/10') : 'border-borderSubtle text-textMuted/60'}`} data-flag={code} data-on={on || undefined}>
          {code}
        </span>
      ))}
    </span>
  );
};

/** A busiest contract — a door to the Weigher with the contract picked */
const ContractRow = ({ c, maxVol, onOpen, onWarm }: { c: BookContract; maxVol: number; onOpen: () => void; onWarm?: () => void }) => (
  <button type="button" onClick={onOpen} onMouseEnter={onWarm} onFocus={onWarm} title="Weigh this contract" className="group/door w-full text-left px-3 sm:px-5 py-2 border-t border-borderSubtle/40 grid grid-cols-[92px_64px_minmax(0,1fr)_12px] sm:grid-cols-[112px_96px_minmax(0,1fr)_72px_24px] items-center gap-x-2 sm:gap-x-3 hover:bg-ink/[0.03] focus-visible:bg-ink/[0.03] outline-none transition-colors" data-stock-contract={c.key} data-contract-strike={c.strike} data-contract-right={c.right}>
    <span className="font-mono text-[11px] font-bold text-textPrimary group-hover/door:text-silver transition-colors">
      {c.strike}
      {c.right} <span className="text-[9px] font-normal text-textMuted">· {c.expiry.slice(0, 5)}</span>
    </span>
    <span className="font-mono text-[10px] tnum text-textSecondary">{fmtMoney(c.premium)}</span>
    <span className="flex items-center gap-2 min-w-0">
      <span className="relative w-full max-w-[120px] min-w-[20px] h-[4px] rounded-full bg-ink/[0.06] sm:shrink-0">
        <span className={`absolute inset-y-0 left-0 rounded-full ${c.right === 'C' ? 'bg-bull/80' : 'bg-bear/70'}`} style={{ width: `${Math.max(6, (c.volume / maxVol) * 100)}%`, transition: GLIDE }} />
      </span>
      <span className="font-mono text-[10px] tnum text-textPrimary">{c.volume.toLocaleString()}</span>
    </span>
    {/* a phone keeps the contract, its money and its volume; how it was bought is the first thing a 360px row gives up (the
        phone sweep, 2026-09-19: the row's fixed columns alone were 392px — it pushed the page sideways) */}
    <span className="max-sm:hidden font-mono text-[9px] tnum text-textMuted text-right">{c.sweepPct >= 20 ? 'swept' : `${c.askPct.toFixed(0)}% ask`}</span>
    <ArrowUpRight className="w-3 h-3 text-textMuted group-hover/door:text-silver transition-colors justify-self-end" />
  </button>
);
/** One of the tape's biggest prints on the name — a door to the Weigher with the contract picked */
const PrintRow = ({ p, maxPrem, onOpen, onWarm }: { p: FlowPrint; maxPrem: number; onOpen: () => void; onWarm?: () => void }) => (
  <button type="button" onClick={onOpen} onMouseEnter={onWarm} onFocus={onWarm} title="Weigh this contract" className="group/door w-full text-left px-3 sm:px-5 h-[34px] border-t border-borderSubtle/40 grid grid-cols-[88px_minmax(0,1fr)_64px_12px] sm:grid-cols-[44px_112px_minmax(0,1fr)_72px_48px_24px] items-center gap-x-2 sm:gap-x-3 hover:bg-ink/[0.03] focus-visible:bg-ink/[0.03] outline-none transition-colors" data-stock-print={p.id} data-print-side={p.side}>
    {/* on a phone the row is the contract, its size and its money — the time and the sweep mark come back at 640px (its
        fixed columns alone were 400px) */}
    <span className="max-sm:hidden font-mono text-[10px] tnum text-textMuted">{p.time}</span>
    <span className="font-mono text-[11px] font-bold text-textPrimary group-hover/door:text-silver transition-colors">
      {p.strike}
      {p.right} <span className="text-[9px] font-normal text-textMuted">· {p.dte}d</span>
    </span>
    <span className="flex items-center gap-2 min-w-0">
      <span className="max-sm:hidden relative w-full max-w-[110px] h-[4px] rounded-full bg-ink/[0.06] shrink-0">
        <span className={`absolute inset-y-0 left-0 rounded-full ${p.side === 'ASK' ? 'bg-bull/80' : 'bg-bear/70'}`} style={{ width: `${Math.max(6, (p.premium / maxPrem) * 100)}%`, transition: GLIDE }} />
      </span>
      <span className="font-mono text-[10px] tnum text-textSecondary whitespace-nowrap">
        {p.size.toLocaleString()} @ {p.fill.toFixed(2)}
      </span>
    </span>
    <span className="font-mono text-[11px] tnum font-semibold text-textPrimary text-right">{fmtMoney(p.premium)}</span>
    <span className={`max-sm:hidden font-mono text-[8px] uppercase tracking-widest text-right ${p.sweep ? 'text-silver' : 'text-textMuted'}`}>{p.sweep ? 'sweep' : p.legs > 1 ? `×${p.legs}` : ''}</span>
    <ArrowUpRight className="w-3 h-3 text-textMuted group-hover/door:text-silver transition-colors justify-self-end" />
  </button>
);

/* ---- the page ------------------------------------------------------------------- */

const StockName = () => {
  const { ticker = '' } = useParams();
  const T = ticker.toUpperCase();
  const navigate = useNavigate();
  const location = useLocation();
  const { changeTicker, flowTape } = useMarketData();
  const seeded = useSeeded(T);
  /* the flow, the dark pool and the wire move on the scan tier; the sessions and the sample are tick-stable */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick(t => t + 1), 10_000);
    return () => window.clearInterval(id);
  }, []);
  const view = useMemo(() => (seeded ? buildStockOverview(T, flowTape) : null), [T, seeded, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const insiders = useMemo(() => insiderFlow(T, 90), [T]);
  const marketInsiders = useMemo(() => insiders.trades.filter(t => TX_CODES[t.code].openMarket).slice(0, 5), [insiders]);
  const congress = useMemo(() => buildCongress(180).trades.filter(t => t.ticker === T).sort((a, b) => a.filedDaysAgo - b.filedDaysAgo).slice(0, 5), [T]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  /* THE KEPT PRINT on today's tape — a click on a bar keeps it; another name lets it go */
  const [printFocus, setPrintFocus] = useState<number | null>(null);
  useEffect(() => setPrintFocus(null), [T]);

  const jump = (id: string) => document.getElementById(`stock-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const back = (
    <div className="flex items-center gap-4 flex-wrap" data-name-back>
      <Link to="/dossier/stocks" className="group inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors">
        <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" /> The board
      </Link>
      {view && (
        <nav className="ml-auto flex items-center gap-1 flex-wrap font-mono text-[9px] uppercase tracking-widest" aria-label="Sections of the page" data-stock-jumps>
          {JUMPS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => jump(id)} className="inline-flex items-center h-6 px-2 rounded-md text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors" data-stock-jump={id}>
              {label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
  if (!view) {
    return (
      <>
        {back}
        <StockNameSkeleton />
      </>
    );
  }

  const openOnMap = () => {
    changeTicker(T);
    navigate('/pinpoint/map');
  };
  const weigh = (c?: { strike: number; right: 'C' | 'P'; expiry: string }) => navigate('/weigher', { state: { weigh: c ? { ticker: T, strike: c.strike, right: c.right, expiry: isoOf(c.expiry) } : { ticker: T }, wayBack: location.pathname } });
  const warm = () => Simulator.ensureTicker(T);
  const byKey = Object.fromEntries(view.pillars.map(p => [p.key, p])) as Record<Pillar['key'], Pillar>;
  const { money, trend, news, numbers, agreement } = view;
  /* the read's word — the only form the engine's figure takes on this page */
  const grade = gradeOfComposite(view.composite);
  const maxVol = Math.max(1, ...money.busiest.calls.map(c => c.volume), ...money.busiest.puts.map(c => c.volume));
  const maxPrem = Math.max(1, ...view.prints.buys.map(p => p.premium), ...view.prints.sells.map(p => p.premium));
  const prem = money.callPremium + money.putPremium;
  const callShare = prem > 0 ? (100 * money.callPremium) / prem : 50;
  const oi = money.callOI + money.putOI;
  const callOIShare = oi > 0 ? (100 * money.callOI) / oi : 50;
  const up = view.changePct >= 0;
  const live = view.sources.filter(s => s.status === 'live').length;
  const maxPts = Math.max(0.1, ...view.contributions.map(c => Math.abs(c.points)));
  const maxDelta = Math.max(1, ...view.moves.map(m => Math.abs(m.delta)));
  const forIt = view.contributions.filter(c => c.points > 0).length;
  const againstIt = view.contributions.filter(c => c.points < 0).length;
  const trajectory = numbers.epsGrowthPct > 12 ? 'accelerating' : numbers.epsGrowthPct > 3 ? 'steady' : 'slowing';
  const insiderTotal = insiders.bought + insiders.sold;
  /* THE SESSIONS ON THE CHART: the closes on their dates, the marks that matter on them */
  const sessionPoints: ChartPoint[] = trend.times.map((t, i) => ({ time: t, value: trend.closes[i] })).slice(-30);
  /* THE MARKS SIT ON THE LINE, small, in their kind's ink, and say nothing on the plot (Noah, 2026-09-29, with the box in
     front of him: "i hate this chart" — three white circles each captioned "session" stacked over the line, arrows with
     words under it, a whole line painted red). The card under the pointer and the timeline strip below carry the words. */
  const sessionMarks: ChartMark[] = view.timeline.filter(t => t.time != null).map(t => ({ time: t.time!, color: KIND_MARK[t.kind], on: true, size: 0.34, shape: 'circle' as const, text: `${KIND_WORD[t.kind]} · ${t.text}` }));
  /* the levels named INSIDE the plot at their left end — the axis keeps the figures alone (four named tags collided there) */
  const sessionLines = [
    ...(trend.ema20 != null ? [{ price: trend.ema20, color: SILVER, title: '20-day', style: 'dashed' as const, name: 'plot' as const }] : []),
    { price: money.levels.putWall, color: 'rgb(var(--bear))', title: 'support', style: 'dashed' as const, name: 'plot' as const },
    { price: money.levels.callWall, color: 'rgb(var(--bull))', title: 'resistance', style: 'dashed' as const, name: 'plot' as const },
  ];
  /* the scale holds the line and any level near it (within a quarter of the line's own span past either end), with a
     little air — a wall far from the line is left off the scale rather than flattening thirty sessions into a thread */
  const sessionRange = ((): readonly [number, number] | undefined => {
    if (sessionPoints.length < 2) return undefined;
    const vs = sessionPoints.map(p => p.value);
    let lo = Math.min(...vs);
    let hi = Math.max(...vs);
    const pad = Math.max((hi - lo) * 0.25, 1e-6);
    for (const l of sessionLines) if (l.price >= lo - pad && l.price <= hi + pad) (lo = Math.min(lo, l.price)), (hi = Math.max(hi, l.price));
    const air = Math.max((hi - lo) * 0.06, 1e-4);
    return [lo - air, hi + air];
  })();
  /* THE DARK PRINTS ON TODAY'S TAPE: the session minute by minute as the line, the off-exchange prints summed per minute as bars under
     it at their true minute (a print's clock matched to the bar of that minute), the biggest of each minute kept for the card */
  const todayPoints: ChartPoint[] = money.today.map(c => ({ time: c.time, value: c.close }));
  const minuteOf = new Map(money.today.map(c => [clockOf(c.time), c.time]));
  const darkMinutes = (() => {
    const byMin = new Map<string, { time: number; value: number; n: number; biggest: (typeof money.dark.prints)[number] }>();
    for (const p of money.dark.prints) {
      let time = minuteOf.get(p.time);
      if (time == null) {
        const [h, m] = p.time.split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
        const d = new Date();
        d.setHours(h, m, 0, 0);
        time = Math.floor(d.getTime() / 1000);
      }
      const had = byMin.get(p.time);
      if (had) {
        had.value += p.size;
        had.n += 1;
        if (p.size > had.biggest.size) had.biggest = p;
      } else byMin.set(p.time, { time, value: p.size, n: 1, biggest: p });
    }
    return [...byMin.values()].sort((a, b) => a.time - b.time);
  })();
  const darkPoints: ChartPoint[] = darkMinutes.map(m => ({ time: m.time, value: m.value, color: INTENT_INK[m.biggest.intent] ?? 'rgb(var(--text-muted))' }));
  const keptPrint = printFocus != null ? darkMinutes.find(m => m.time === printFocus) ?? null : null;
  const largestPrints = [...darkMinutes].sort((a, b) => b.biggest.size - a.biggest.size).slice(0, 5);

  /* THE TIMELINE'S LANES — a row per kind of mark on the sessions on hand, in the report's grammar */
  const tickInk = (kind: TimelineKind, text: string) => (kind === 'session' ? (text.includes('+') ? 'rgb(var(--bull))' : 'rgb(var(--bear))') : KIND_MARK[kind]);
  const laneOf = (key: string, label: string, ink: string, kinds: TimelineKind[]) => {
    const entries = view.timeline.filter(t => kinds.includes(t.kind));
    const ticks: LaneTick[] = entries
      .map(t => ({ i: t.time != null ? trend.times.indexOf(t.time) : t.kind === 'news' ? trend.times.length - 1 : -1, ink: tickInk(t.kind, t.text), when: t.when, text: `${KIND_WORD[t.kind]} · ${t.text}`, score: t.score, tall: t.kind === 'breakout' || t.kind === 'breakdown' || t.kind === 'session' }))
      .filter(t => t.i >= 0);
    const ups = entries.filter(t => t.kind === 'breakout' || (t.kind === 'session' && t.text.includes('+'))).length;
    const downs = entries.filter(t => t.kind === 'breakdown' || (t.kind === 'session' && !t.text.includes('+'))).length;
    const n = entries.length;
    let grade: { words: string; tone: 'good' | 'bad' | 'quiet' };
    if (key === 'earnings') grade = n === 0 ? { words: 'no report on hand', tone: 'quiet' } : entries[0].text.startsWith('beat') ? { words: 'beat', tone: 'good' } : { words: 'missed', tone: 'bad' };
    else if (key === 'news') grade = n === 0 ? { words: 'nothing today', tone: 'quiet' } : { words: `${n} today`, tone: 'quiet' };
    else if (key === 'volume') grade = n === 0 ? { words: 'none on hand', tone: 'quiet' } : { words: `${n} ${n === 1 ? 'session' : 'sessions'}`, tone: 'quiet' };
    else grade = n === 0 ? { words: 'none on hand', tone: 'quiet' } : { words: `${ups} up · ${downs} down`, tone: ups > downs ? 'good' : downs > ups ? 'bad' : 'quiet' };
    const last = entries[0] ?? null;
    return {
      key,
      label,
      ink,
      ticks,
      figure: key === 'earnings' ? last?.when ?? '—' : String(n),
      grade,
      facts: [
        { k: 'Marks', v: String(n) },
        { k: 'Last', v: last?.when ?? '—' },
        { k: 'Trend then', v: last?.score != null ? gradeOf(last.score) : '—', cls: last?.score != null ? GRADE_INK[gradeOf(last.score)] : undefined },
        { k: 'The last', v: last?.text ?? '—', cls: last ? 'text-textSecondary' : undefined },
      ],
    };
  };
  const lanes = [
    laneOf('breaks', 'Breaks', KIND_MARK.breakout, ['breakout', 'breakdown']),
    laneOf('volume', 'Heavy volume', KIND_MARK.volume, ['volume']),
    laneOf('session', 'Big sessions', 'rgb(var(--text-primary))', ['session']),
    laneOf('news', 'The wire', KIND_MARK.news, ['news']),
    laneOf('earnings', 'The last report', KIND_MARK.earnings, ['earnings']),
  ];

  return (
    <>
      {back}
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read a name" testId="stock-guide" viewport>
        <StockGuide view={view} />
      </GuideFocus>

      {/* THE NAME */}
      <div id="stock-name" className="border border-borderSubtle rounded-md bg-panel scroll-mt-4" data-stock-name={T} data-stock-screen={view.screen} data-stock-lean={view.lean} data-stock-grade={grade}>
        <div className="px-5 pt-4 pb-4 flex items-start gap-6 flex-wrap">
          <div className="min-w-0 flex-1 flex items-center gap-3">
            <CompanyLogo ticker={T} size={34} />
            <div className="min-w-0">
              <div className="h-6 flex items-center gap-2.5">
                <h3 className="text-[15px] font-semibold leading-tight text-textPrimary truncate">{view.name}</h3>
                <span className="font-mono text-[11px] font-bold text-textSecondary">{T}</span>
                <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the read, the pillars and the factors mean" testId="stock-guide" />
              </div>
              <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">
                <span className="font-mono text-[12px] tnum text-textPrimary">
                  $<AnimatedNumber value={view.price} format={v => v.toFixed(2)} />
                </span>{' '}
                <span className={`font-mono tnum ${up ? 'text-bull' : 'text-bear'}`}>{pct(view.changePct, 2)}</span> · {view.marketWord}
                {view.sector ? ` · ${view.sector}` : ''}
              </p>
            </div>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-2">
            {/* THE READ, in one of three words — the figure behind it is the engine's (Noah, 2026-09-19) */}
            <Fact label="Reads" testId="screen">
              <span className={`text-[14px] font-bold ${GRADE_INK[grade]}`}>{grade}</span>
            </Fact>
            <Fact label="Leans" testId="lean">
              <span className={`font-semibold ${LEAN_INK[view.lean]}`}>{view.lean}</span>
            </Fact>
          </dl>
        </div>
        {/* THE FOUR PILLARS, with their figures */}
        {/* Two by two on a phone (the phone pass, 2026-09-13): four across ran the pillars' words into each other at 390 */}
        <div className="px-5 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3" data-stock-pillars>
          {view.pillars.map(p => (
            <PillarBar key={p.key} p={p} big />
          ))}
        </div>
        <div className="px-5 pb-4 flex items-center gap-2 flex-wrap" data-stock-doors>
          <Door onWarm={warm} onClick={openOnMap}>
            The Map
          </Door>
          <Door onWarm={warm} onClick={() => weigh()}>
            Weigh it
          </Door>
          <Door onWarm={warm} onClick={() => navigate('/compass', { state: { tickerFilter: T } })}>
            Compass
          </Door>
          {news.nextEarnings && <Door onClick={() => navigate(`/dossier/earnings/${T}`)}>Earnings</Door>}
          <Door onClick={() => navigate('/dossier/news', { state: { name: T } })}>The wire</Door>
          <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-textMuted" data-stock-completeness={view.completeness}>
            {live} of {view.sources.length} sources live
          </span>
        </div>
      </div>

      {/* WHY NOW — the facts, the thesis, the paragraph, the agreement */}
      <Box title="Why now" sub="The biggest facts on the name right now, what is for it and against it, and whether the four pillars agree" testId="why">
        <div className="px-5 pb-3 flex flex-col gap-2">
          <p className="text-[12px] leading-relaxed text-textPrimary/90" data-stock-why>
            <RichRead text={view.whyNow} />
          </p>
          <p className="text-[12px] leading-relaxed text-textSecondary" data-stock-thesis>
            <RichRead text={view.thesis} />
          </p>
          <p className="text-[12px] leading-relaxed text-textSecondary" data-stock-explanation>
            <RichRead text={view.explanation} />
          </p>
        </div>
        <div className="px-5 py-3 border-t border-borderSubtle/40 flex items-center gap-2 flex-wrap" data-stock-agreement={agreement.aligned}>
          <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted mr-1">
            {agreement.aligned} of 4 agree · the read leans <span className={LEAN_INK[agreement.lean]}>{agreement.lean}</span>
          </span>
          {agreement.pillars.map(p => (
            <span key={p.key} className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-md border font-mono text-[10px] tnum transition-colors ${p.agrees ? 'border-borderMuted text-textPrimary bg-ink/[0.04]' : 'border-borderSubtle text-textMuted'}`} data-stock-agree={p.key} data-agrees={p.agrees || undefined}>
              <span className={`w-1.5 h-1.5 rounded-full ${GRADE_FILL[gradeOf(p.score)]}`} />
              {p.name.replace('The ', '')} <span className={GRADE_INK[gradeOf(p.score)]}>{gradeOf(p.score)}</span>
              <span className={`text-[8px] uppercase tracking-widest ${p.agrees ? 'text-textSecondary' : 'text-warn'}`}>{p.agrees ? 'agrees' : 'argues'}</span>
            </span>
          ))}
          <span className="basis-full text-[11px] text-textSecondary" data-stock-risk>
            {agreement.risk}
          </span>
        </div>
      </Box>

      {/* THE TREND · THE MONEY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <Box title="The trend" sub={`From the name's own sessions · ${trend.sessions} on hand`} aside={<PillarBarSmall p={byKey.trend} />} testId="trend">
          <div className="px-5 pb-3">
            <dl className="grid grid-cols-3 gap-x-4 gap-y-2">
              <Fact label="20-day average" testId="ema20">
                {trend.ema20 != null ? (
                  <>
                    {trend.ema20.toFixed(2)} <span className={`${view.price >= trend.ema20 ? 'text-bull' : 'text-bear'}`}>{pct(((view.price - trend.ema20) / trend.ema20) * 100)}</span>
                  </>
                ) : (
                  <span className="text-textMuted">—</span>
                )}
              </Fact>
              <Fact label="50-day · 200-day" testId="smas">
                {trend.sma50 != null ? trend.sma50.toFixed(2) : <span className="text-textMuted">needs 50</span>} <span className="text-textMuted">·</span> {trend.sma200 != null ? trend.sma200.toFixed(2) : <span className="text-textMuted">needs 200</span>}
              </Fact>
              <Fact label="Above its averages" testId="above">
                {trend.above.count} <span className="text-textMuted">of {trend.above.of} on hand</span>
              </Fact>
              <Fact label="RSI · ADX" testId="rsi">
                {trend.rsi14 != null ? trend.rsi14.toFixed(0) : '—'} <span className="text-textMuted">·</span> {trend.adx14 != null ? trend.adx14.toFixed(0) : '—'}
              </Fact>
              <Fact label="Today's range" testId="atr">
                {trend.atrPercentile != null ? (
                  <>
                    {trend.rangeToday != null ? trend.rangeToday.toFixed(2) : ''} <span className="text-textMuted">· {ordinal(trend.atrPercentile)} pct</span>
                  </>
                ) : (
                  '—'
                )}
              </Fact>
              <Fact label="5 · 20 sessions" testId="changes">
                {trend.change5Pct != null ? <span className={trend.change5Pct >= 0 ? 'text-bull' : 'text-bear'}>{pct(trend.change5Pct)}</span> : '—'} <span className="text-textMuted">·</span>{' '}
                {trend.change20Pct != null ? <span className={trend.change20Pct >= 0 ? 'text-bull' : 'text-bear'}>{pct(trend.change20Pct)}</span> : '—'}
              </Fact>
            </dl>
          </div>
          {/* THE SESSIONS ON HAND, on the chart library: the closes as ONE LINE in the page's ink (a whole line in red or green
              said one thing about thirty sessions), the 20-day and the walls as price lines named inside the plot, the
              timeline's marks on the line, a card under the pointer. The chart FILLS the box's spare room — the box stands
              as tall as The money beside it, and the room used to be a void between the structure line and the factors. */}
          {sessionPoints.length > 2 && (
            <div className="px-5 pb-3 flex-1 min-h-[220px] flex flex-col" data-stock-sessions>
              <SessionsChart
                testId="sessions"
                kind="line"
                fill
                ink="rgb(var(--text-primary))"
                points={sessionPoints}
                range={sessionRange}
                lines={sessionLines}
                marks={sessionMarks}
                clock="day"
                scale="price"
                cardH={96}
                card={({ point: p, prev, marks }) =>
                  p && (
                    <>
                      <span className="font-mono text-[11px] font-bold tnum text-textPrimary">{dayOf(p.time)}</span>
                      <span className="font-mono tnum">
                        closed <span className="text-textPrimary">{p.value.toFixed(2)}</span>
                        {prev && (
                          <span className={p.value >= prev.value ? 'text-bull' : 'text-bear'}>
                            {' '}
                            {pct(((p.value - prev.value) / prev.value) * 100)}
                          </span>
                        )}
                        {trend.ema20 != null && <span className="text-textMuted"> · {pct(((p.value - trend.ema20) / trend.ema20) * 100)} from the 20-day</span>}
                      </span>
                      {marks.map(m => (
                        <span key={m.text} className="text-[10px] leading-snug" style={{ color: m.color }}>
                          {m.text}
                        </span>
                      ))}
                    </>
                  )
                }
              />
            </div>
          )}
          {/* the structure and its four flags; the walls are named on the chart now, not repeated here */}
          <div className="px-5 pb-3 flex items-center gap-3 text-[11px] text-textSecondary">
            <span className="truncate">
              The structure: <span className="text-textPrimary">{trend.structure}</span>
            </span>
            {trend.flags && <Flags flags={trend.flags} />}
          </div>
          <div>
            {byKey.trend.factors.map(f => (
              <FactorRow key={f.key} f={f} />
            ))}
          </div>
        </Box>
        <Box title="The money" sub="The book, the flow book and the dark pool, live" aside={<PillarBarSmall p={byKey.money} />} testId="money">
          <dl className="px-5 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
            <Fact label="Net GEX" testId="gex">
              <Money v={money.netGex} /> <span className="text-textMuted">· {money.regime}</span>
            </Fact>
            <Fact label="Net DEX · VEX" testId="dex">
              <Money v={money.netDex} /> <span className="text-textMuted">·</span> <Money v={money.netVex} />
            </Fact>
            <Fact label="Vanna · charm" testId="vanna">
              <Money v={money.netVanna} /> <span className="text-textMuted">·</span> <Money v={money.netCharm} />
            </Fact>
            <Fact label="Open interest" testId="oi">
              {count(oi)} <span className={callOIShare >= 50 ? 'text-bull' : 'text-bear'}>{callOIShare >= 50 ? `${callOIShare.toFixed(0)}% calls` : `${(100 - callOIShare).toFixed(0)}% puts`}</span>
            </Fact>
            <Fact label="Volume · usual" testId="volume">
              {money.volumeToday != null ? count(money.volumeToday) : '—'} <span className="text-textMuted">· {money.volumeAvg != null ? count(money.volumeAvg) : '—'}</span>
              {money.rvol != null && <span className={money.rvol >= 1.3 ? 'text-silver' : 'text-textMuted'}> · {money.rvol.toFixed(2)}×</span>}
            </Fact>
            <Fact label="Closed in its range" testId="close">
              {money.closeInRange != null ? (
                <>
                  {Math.round(money.closeInRange * 100)}% <span className="text-textMuted">up from the low</span>
                </>
              ) : (
                '—'
              )}
            </Fact>
            <Fact label="Unusual · blocks" testId="unusual">
              {money.unusual} <span className="text-textMuted">at 2× OI ·</span> {money.darkBlocks} <span className="text-textMuted">of 50K+</span>
            </Fact>
            <Fact label="Dark share" testId="darkshare">
              {money.dark.dpSharePct.toFixed(0)}% <span className="text-textMuted">· {fmtMoney(money.dark.totalNotional)}</span>
            </Fact>
          </dl>
          {/* THE BOOK ON A PRICE SCALE */}
          <div className="px-5 pb-1">
            <LevelsScale spot={view.price} putWall={money.levels.putWall} flip={money.levels.flip} callWall={money.levels.callWall} supreme={money.levels.supreme} />
          </div>
          {/* calls against puts, by premium */}
          <div className="px-5 pb-2" data-stock-flow>
            <div className="flex items-center justify-between font-mono text-[10px] tnum">
              <span className={callShare >= 50 ? 'text-bull font-semibold' : 'text-textSecondary'}>calls {fmtMoney(money.callPremium)}</span>
              <span className="text-[9px] uppercase tracking-widest text-textMuted">premium today · {money.askSharePct.toFixed(0)}% on the ask · {money.sweepSharePct.toFixed(0)}% swept</span>
              <span className={callShare < 50 ? 'text-bear font-semibold' : 'text-textSecondary'}>puts {fmtMoney(money.putPremium)}</span>
            </div>
            <div className="mt-1.5">
              <ShareBar left={callShare} />
            </div>
          </div>
          {/* the dark pool's lean, from the middle */}
          <div className="px-5 pb-3" data-stock-dark={money.dark.posture}>
            <div className="flex items-center justify-between font-mono text-[10px] tnum">
              <span className={money.dark.netPosturePct < 0 ? 'text-bear font-semibold' : 'text-textSecondary'}>selling</span>
              <span className="text-[9px] uppercase tracking-widest text-textMuted">
                dark pool · {postureRead(money.dark)} · {money.dark.prints.length} prints{money.dark.largest ? ` · the largest ${fmtMoney(money.dark.largest.notional)} at ${money.dark.largest.price.toFixed(2)}` : ''}
              </span>
              <span className={money.dark.netPosturePct > 0 ? 'text-bull font-semibold' : 'text-textSecondary'}>buying</span>
            </div>
            <div className="mt-1.5">
              <SignedBar v={money.dark.netPosturePct / 100} thick />
            </div>
          </div>
          {/* THE DARK PRINTS ON TODAY'S TAPE, on the chart library: the session's minutes as a muted line, the off-exchange prints as bars
              under it at their true minute in the intent's ink, a card under the pointer — the trace's own grammar for a tape */}
          {(todayPoints.length > 1 || darkPoints.length > 1) && (
            <div className="px-5 pb-3" data-stock-dark-prints={darkPoints.length}>
              <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-textMuted">
                <span>today's tape · the off-exchange prints under it, shares by minute</span>
                <span>{money.dark.prints.length} prints</span>
              </div>
              <SessionsChart
                testId="dark-prints"
                kind="line"
                height={132}
                ink="rgb(var(--text-secondary))"
                points={todayPoints}
                bars={darkPoints}
                clock="clock"
                scale="price"
                cardH={84}
                focus={printFocus}
                onFocus={setPrintFocus}
                card={({ time, point, bar, kept }) => {
                  const m = bar ? darkMinutes.find(d => d.time === time) : null;
                  return (
                    <>
                      <span className="font-mono text-[11px] font-bold tnum text-textPrimary">
                        {clockOf(time)}
                        {point && <span className="text-textMuted font-normal"> · {point.value.toFixed(2)}</span>}
                        {m && <span className="text-textMuted font-normal"> · {m.n === 1 ? 'one print' : `${m.n} prints`}</span>}
                        {kept && <span className="text-silver font-normal text-[9px] uppercase tracking-widest"> · kept</span>}
                      </span>
                      {m ? (
                        <>
                          <span className="font-mono tnum">
                            <span className="text-textPrimary">{count(m.value)}</span> shares · the largest {count(m.biggest.size)} @ {m.biggest.price.toFixed(2)} · {fmtMoney(m.biggest.notional)}
                          </span>
                          <span className="text-[10px] leading-snug" style={{ color: INTENT_INK[m.biggest.intent] ?? 'rgb(var(--text-secondary))' }}>
                            {m.biggest.intent.toLowerCase()} · {m.biggest.venue}
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] text-textMuted">no off-exchange print this minute</span>
                      )}
                    </>
                  );
                }}
              />
              {/* THE KEPT PRINT, or the largest to keep — a click on a bar keeps it too */}
              <div className="mt-1.5 min-h-[26px] flex items-center gap-2 flex-wrap font-mono text-[10px] tnum" data-stock-print-focus={printFocus ?? 'none'}>
                {keptPrint ? (
                  <>
                    <span className="text-[9px] uppercase tracking-widest text-silver">kept</span>
                    <span className="font-semibold text-textPrimary">{clockOf(keptPrint.time)}</span>
                    <span className="text-textSecondary">
                      {count(keptPrint.biggest.size)} @ {keptPrint.biggest.price.toFixed(2)} · {fmtMoney(keptPrint.biggest.notional)} · {keptPrint.biggest.venue}
                    </span>
                    <span style={{ color: INTENT_INK[keptPrint.biggest.intent] ?? 'rgb(var(--text-secondary))' }}>
                      {keptPrint.biggest.intent.toLowerCase()} · a {gradeOfConviction(keptPrint.biggest.conviction)} read
                    </span>
                    <span className="text-textMuted">
                      {pct(keptPrint.biggest.vsSpotPct)} from spot{keptPrint.biggest.atLevel ? ' · on a shelf' : ''}
                    </span>
                    <button type="button" onClick={() => setPrintFocus(null)} className="ml-auto inline-flex items-center h-5 px-1.5 rounded border border-borderSubtle text-[9px] uppercase tracking-widest text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors" data-stock-print-release>
                      let go
                    </button>
                    <span className="basis-full text-[10.5px] font-sans text-textSecondary truncate" data-stock-print-read>
                      {keptPrint.biggest.read}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[9px] uppercase tracking-widest text-textMuted" title="Click one, or a bar on the tape, to keep it">
                      the largest ·
                    </span>
                    {largestPrints.map(m => (
                      <button key={m.time} type="button" onClick={() => setPrintFocus(m.time)} className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md border border-borderSubtle bg-chip hover:border-borderMuted transition-colors" title={`${clockOf(m.time)} · ${count(m.biggest.size)} @ ${m.biggest.price.toFixed(2)} · ${m.biggest.venue}`} data-stock-print-chip={m.time}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: INTENT_INK[m.biggest.intent] ?? 'rgb(var(--text-muted))' }} />
                        <span className="text-textPrimary">{clockOf(m.time)}</span>
                        <span className="text-textSecondary">{count(m.biggest.size)}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
          <div className="mt-auto">
            {byKey.money.factors.map(f => (
              <FactorRow key={f.key} f={f} />
            ))}
          </div>
        </Box>
      </div>

      {/* THE NEWS · THE NUMBERS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <Box title="The news" sub={`The wire on ${T} · ${news.stories.length} ${news.stories.length === 1 ? 'story' : 'stories'} today${news.reports.length ? ` · the last ${news.reports.length} reports` : ''}`} aside={<PillarBarSmall p={byKey.news} />} testId="news">
          {news.stories.length === 0 ? (
            <div className="px-5 pb-4 pt-1 font-mono text-[10px] uppercase tracking-widest text-textMuted">Nothing on the wire today</div>
          ) : (
            <div>
              {news.stories.map(s => (
                <button key={s.id} type="button" onClick={() => navigate('/dossier/news', { state: { selectedId: s.id, name: T } })} className="group w-full text-left px-5 h-[34px] grid items-center gap-x-3 border-t border-borderSubtle/40 hover:bg-ink/[0.03] transition-colors" style={{ gridTemplateColumns: '64px minmax(0, 1fr) 64px 56px' }} data-stock-story={s.id}>
                  <span className="font-mono text-[10px] tnum text-textMuted">{ago(s.item.minutesAgo)}</span>
                  <span className="min-w-0 truncate text-[11.5px] text-textSecondary group-hover:text-textPrimary transition-colors">{s.item.headline}</span>
                  <span className={`font-mono text-[9px] font-semibold uppercase tracking-widest ${s.grade === 'ALLY' ? 'text-bull' : s.grade === 'THREAT' ? 'text-bear' : 'text-textSecondary'}`}>{s.grade === 'ALLY' ? 'positive' : s.grade === 'THREAT' ? 'negative' : 'neutral'}</span>
                  <span className={`text-right font-mono text-[11px] font-semibold tnum ${s.item.prediction.expMove1dPct >= 0 ? 'text-bull' : 'text-bear'}`}>{pct(s.item.prediction.expMove1dPct)}</span>
                </button>
              ))}
            </div>
          )}
          {/* THE LAST REPORTS — what it earned against the estimate, and how the stock took it */}
          {news.reports.length > 0 && (
            <div className="border-t border-borderSubtle/40" data-stock-reports={news.reports.length}>
              <div className="px-5 h-[22px] grid items-center gap-x-3 text-[9px] uppercase tracking-widest text-textMuted" style={{ gridTemplateColumns: '64px 96px minmax(0, 1fr) 72px' }}>
                <span>Report</span>
                <span>EPS</span>
                <span>Against the estimate</span>
                <span className="text-right">The session after</span>
              </div>
              {news.reports.map(r => (
                <div key={r.label} className="px-5 h-[26px] grid items-center gap-x-3 border-t border-borderSubtle/40" style={{ gridTemplateColumns: '64px 96px minmax(0, 1fr) 72px' }} data-stock-report={r.label}>
                  <span className="font-mono text-[10px] tnum text-textSecondary">{r.label}</span>
                  <span className="font-mono text-[11px] tnum text-textPrimary">{r.epsActual.toFixed(2)}</span>
                  <span className={`font-mono text-[10px] tnum ${r.beat ? 'text-bull' : 'text-bear'}`}>
                    {r.beat ? 'beat' : 'missed'} <span className="text-textMuted">{r.epsEst.toFixed(2)} by</span> {Math.abs(((r.epsActual - r.epsEst) / Math.abs(r.epsEst || 1)) * 100).toFixed(1)}%
                  </span>
                  <span className={`text-right font-mono text-[11px] tnum font-semibold ${r.movePct >= 0 ? 'text-bull' : 'text-bear'}`}>{pct(r.movePct)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-auto">
            {byKey.news.factors.map(f => (
              <FactorRow key={f.key} f={f} />
            ))}
            <div className="px-5 py-2.5 border-t border-borderSubtle/40 flex items-center gap-4 font-mono text-[10px] tnum" data-stock-next-earnings>
              {news.nextEarnings ? (
                <span className="text-textSecondary truncate">
                  reports <span className="text-textPrimary">{news.nextEarnings.label}</span> · {news.nextEarnings.daysOut === 0 ? 'today' : `in ${news.nextEarnings.daysOut}d`} · the options price <span className="text-textPrimary">±{news.nextEarnings.impliedMovePct.toFixed(1)}%</span>
                  {!news.nextEarnings.confirmed && <span className="text-warn"> · date estimated</span>}
                  {news.reaction && (
                    <span className="text-textMuted">
                      {' '}
                      · the last {news.reaction.reports} moved it ±{news.reaction.pct.toFixed(1)}% on average
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-textMuted truncate">
                  no report on the next two weeks' calendar{news.reaction ? ` · the last ${news.reaction.reports} moved it ±${news.reaction.pct.toFixed(1)}% on average` : ''}
                </span>
              )}
              <Link to="/dossier/news" state={{ name: T }} className="ml-auto inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors whitespace-nowrap">
                <ArrowUpRight className="w-3 h-3" /> the wire
              </Link>
            </div>
          </div>
        </Box>
        <Box
          title="The numbers"
          sub="The last report, growth, margins and what it is worth"
          aside={
            <div className="flex items-center gap-3">
              <span className="font-mono text-[8px] uppercase tracking-widest text-warn" data-stock-sample>
                sample until the feed lands
              </span>
              <PillarBarSmall p={byKey.numbers} />
            </div>
          }
          testId="numbers"
        >
          <dl className="px-5 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
            <Fact label="EPS · last print" testId="eps">
              ${numbers.epsActual.toFixed(2)} <span className={numbers.epsSurprisePct >= 0 ? 'text-bull' : 'text-bear'}>{pct(numbers.epsSurprisePct)}</span>
            </Fact>
            <Fact label="Revenue · last print" testId="rev">
              ${numbers.revenueActualB.toFixed(1)}B <span className={numbers.revenueSurprisePct >= 0 ? 'text-bull' : 'text-bear'}>{pct(numbers.revenueSurprisePct)}</span>
            </Fact>
            <Fact label="Growth · rev · EPS" testId="growth">
              <span className={numbers.revenueGrowthPct >= 0 ? 'text-bull' : 'text-bear'}>{pct(numbers.revenueGrowthPct)}</span> <span className="text-textMuted">·</span> <span className={numbers.epsGrowthPct >= 0 ? 'text-bull' : 'text-bear'}>{pct(numbers.epsGrowthPct)}</span>
            </Fact>
            <Fact label="Guidance · trajectory" testId="guidance">
              <span className={numbers.guidance === 'raised' ? 'text-bull' : numbers.guidance === 'cut' ? 'text-bear' : ''}>{numbers.guidance}</span> <span className="text-textMuted">·</span>{' '}
              <span className={trajectory === 'accelerating' ? 'text-bull' : trajectory === 'slowing' ? 'text-bear' : ''}>{trajectory}</span>
            </Fact>
            <Fact label="Margins · op · FCF" testId="margins">
              {numbers.operatingMarginPct.toFixed(1)}% <span className="text-textMuted">·</span> {numbers.freeCashFlowMarginPct.toFixed(1)}%
            </Fact>
            <Fact label="P/E · sector median" testId="pe">
              {numbers.pe.toFixed(1)} <span className="text-textMuted">· {numbers.sectorMedianPe} · {ordinal(numbers.sectorPercentile)}</span>
            </Fact>
            <Fact label="EV/Sales · PEG" testId="ev">
              {numbers.evToSales.toFixed(1)} <span className="text-textMuted">·</span> {numbers.peg.toFixed(2)}
            </Fact>
            <Fact label="Beats · health" testId="health">
              {numbers.beats} <span className="text-textMuted">of 8 ·</span> {healthWord(numbers.healthScore)}
            </Fact>
          </dl>
          {/* FAIR VALUE ON A SCALE */}
          <div className="px-5 pb-2">
            <FairValueScale price={view.price} fair={numbers.fairValue} vsPct={numbers.vsFairValuePct} />
          </div>
          <div className="mt-auto">
            {byKey.numbers.factors.map(f => (
              <FactorRow key={f.key} f={f} />
            ))}
          </div>
        </Box>
      </div>

      {/* BEHIND THE READ — the old "How the score is made", in words (Noah, 2026-09-19: no score, point, weight or cut of
          ours reaches the screen; they sort the rows and pick the word, and stay inside the engine) */}
      <Box title="Behind the read" sub="What is for the name and what is against it, factor by factor · how each pillar reads · the read session by session · what would change it · where every figure comes from" testId="score">
        {/* The three columns under each other below lg (the phone pass, 2026-09-13): three tables in 356px were three unreadable ones */}
        <div className="grid border-t border-borderSubtle/60 grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]">
          {/* WHAT IS FOR IT, WHAT IS AGAINST IT — every factor, the heaviest first; the bar is a length, never a figure */}
          <div className="border-r border-borderSubtle/60 min-w-0 max-lg:border-r-0 max-lg:border-b">
            <div className="px-5 h-[22px] grid items-center gap-x-3 text-[9px] uppercase tracking-widest text-textMuted" style={{ gridTemplateColumns: 'minmax(0, 1fr) 88px 56px' }}>
              <span>Factor</span>
              <span className="text-center">Against · for</span>
              <span className="text-right">Says</span>
            </div>
            {view.contributions.map(c => {
              const side = c.points > 0 ? 'for' : c.points < 0 ? 'against' : 'even';
              return (
                <div key={c.key} className="px-5 h-[26px] grid items-center gap-x-3 border-t border-borderSubtle/40" style={{ gridTemplateColumns: 'minmax(0, 1fr) 88px 56px' }} data-stock-contribution={c.key} data-side={side}>
                  <span className="min-w-0 flex items-baseline gap-1.5 truncate">
                    <span className="text-[11px] text-textPrimary truncate">{c.label}</span>
                    <span className="font-mono text-[8px] uppercase tracking-widest text-textMuted shrink-0">{c.pillar}</span>
                  </span>
                  <SignedBar v={c.points / maxPts} />
                  <span className={`text-right font-mono text-[9px] font-semibold uppercase tracking-widest ${side === 'for' ? 'text-bull' : side === 'against' ? 'text-bear' : 'text-textMuted'}`}>{side}</span>
                </div>
              );
            })}
            <div className="px-5 h-[34px] border-t border-borderSubtle/60 flex items-center gap-3 font-mono text-[10px]" data-stock-for={forIt} data-stock-against={againstIt}>
              <span className="text-textSecondary">
                <span className="text-bull font-semibold">{forIt}</span> for it · <span className="text-bear font-semibold">{againstIt}</span> against
              </span>
              <span className="ml-auto text-textSecondary">
                the read <span className={`font-bold ${GRADE_INK[grade]}`}>{grade}</span>
              </span>
            </div>
          </div>
          {/* THE PILLARS, THE SESSIONS, THE MOVES */}
          <div className="border-r border-borderSubtle/60 min-w-0 max-lg:border-r-0 max-lg:border-b">
            <div className="px-5 h-[22px] grid items-center gap-x-3 text-[9px] uppercase tracking-widest text-textMuted" style={{ gridTemplateColumns: 'minmax(0, 1fr) 72px 64px' }}>
              <span>Pillar</span>
              <span />
              <span className="text-right">Reads</span>
            </div>
            {view.pillars.map(p => {
              const g = gradeOf(p.score);
              return (
                <div key={p.key} className="px-5 h-[26px] grid items-center gap-x-3 border-t border-borderSubtle/40" style={{ gridTemplateColumns: 'minmax(0, 1fr) 72px 64px' }} data-stock-weight={p.key} data-grade={g}>
                  <span className="text-[11px] text-textPrimary flex items-center gap-2 truncate">
                    {p.name}
                    {p.status !== 'live' && <StatusTag status={p.status} />}
                  </span>
                  <GradeMeter grade={g} />
                  <span className={`text-right font-mono text-[11px] font-semibold ${GRADE_INK[g]}`}>{g}</span>
                </div>
              );
            })}
            <div className="px-5 h-[26px] grid items-center gap-x-3 border-t border-borderSubtle/60" style={{ gridTemplateColumns: 'minmax(0, 1fr) 72px 64px' }}>
              <span className="text-[11px] font-semibold text-textPrimary">The read</span>
              <GradeMeter grade={grade} />
              <span className={`text-right font-mono text-[12px] font-bold ${GRADE_INK[grade]}`}>{grade}</span>
            </div>
            {/* the read, session by session — a pip per session in its word's ink and at its word's height; four steps, never a line */}
            <div className="px-5 py-2.5 border-t border-borderSubtle/40 flex flex-col gap-1.5" data-stock-series={view.series.length}>
              {view.series.length > 2 ? (
                <>
                  <div className="flex items-end gap-[2px] h-[20px]" role="img" aria-label={`The read over the last ${view.series.length} sessions`}>
                    {view.series.map(q => {
                      const g = gradeOfComposite(q.composite);
                      return <span key={q.time} title={`${dayOf(q.time)} · ${g}`} className={`flex-1 min-w-0 rounded-[1px] ${GRADE_FILL[g]} ${q.back === 0 ? '' : 'opacity-70'}`} style={{ height: `${(GRADES.indexOf(g) + 1) * 25}%` }} data-series-grade={g} />;
                    })}
                  </div>
                  <span className="text-[10.5px] leading-snug text-textSecondary">
                    The read over the last {view.series.length} sessions, the trend moving and the rest held at today's:{' '}
                    {(() => {
                      const word = (back: number) => {
                        const q = view.series.find(x => x.back === back);
                        return q ? gradeOfComposite(q.composite) : null;
                      };
                      const say = (g: Grade, when: string) => (
                        <>
                          <span className={`font-mono ${GRADE_INK[g]}`}>{g}</span> {when}
                        </>
                      );
                      const w20 = word(20);
                      const w5 = word(5);
                      return (
                        <>
                          {w20 ? <>{say(w20, 'twenty back')}, </> : w5 ? null : <>{say(gradeOfComposite(view.series[0].composite), 'at the start')}, </>}
                          {w5 && <>{say(w5, 'five back')}, </>}
                          {say(grade, 'now')}
                        </>
                      );
                    })()}
                    .
                  </span>
                </>
              ) : (
                <span className="text-[10.5px] text-textMuted">Too few sessions on hand for a history.</span>
              )}
            </div>
            {/* what would change it */}
            <div className="px-5 h-[22px] flex items-center border-t border-borderSubtle/40 text-[9px] uppercase tracking-widest text-textMuted">What would change it · a factor turned the other way</div>
            {view.moves.length === 0 && <div className="px-5 h-[26px] flex items-center border-t border-borderSubtle/40 text-[10.5px] text-textMuted">No factor leans far enough to change it.</div>}
            {view.moves.map(m => {
              const then = gradeOfComposite(m.to);
              const same = then === grade;
              return (
                <div key={m.key} className="px-5 h-[26px] grid items-center gap-x-3 border-t border-borderSubtle/40" style={{ gridTemplateColumns: 'minmax(0, 1fr) 64px 84px' }} data-stock-move={m.key} data-to-grade={then}>
                  <span className="text-[11px] text-textPrimary truncate">{m.label}</span>
                  <SignedBar v={m.delta / maxDelta} />
                  <span className={`text-right font-mono text-[10px] whitespace-nowrap ${same ? 'text-textMuted' : GRADE_INK[then]}`}>{same ? `stays ${then}` : `→ ${then}`}</span>
                </div>
              );
            })}
          </div>
          {/* THE SOURCES */}
          <div className="min-w-0">
            <div className="px-5 h-[22px] grid items-center gap-x-3 text-[9px] uppercase tracking-widest text-textMuted" style={{ gridTemplateColumns: 'minmax(0, 1fr) 48px minmax(0, 1.5fr)' }}>
              <span>Source</span>
              <span>Status</span>
              <span>As of</span>
            </div>
            {view.sources.map(s => (
              <div key={s.key} className="px-5 h-[26px] grid items-center gap-x-3 border-t border-borderSubtle/40" style={{ gridTemplateColumns: 'minmax(0, 1fr) 48px minmax(0, 1.5fr)' }} data-stock-source={s.key} data-status={s.status}>
                <span className="text-[11px] text-textPrimary truncate">{s.label}</span>
                <StatusTag status={s.status} />
                <span className="font-mono text-[10px] text-textSecondary truncate">{s.stamp}</span>
              </div>
            ))}
            <div className="px-5 py-3 border-t border-borderSubtle/40 text-[10.5px] leading-snug text-textSecondary">
              <span className="text-textPrimary">{view.completeness}%</span> of the page is live. The board's own four sleeves are stand-ins until it reads this engine for every name; a row and its page can disagree until then.
            </div>
          </div>
        </div>
        {/* THE METHOD, behind a fold */}
        <div className="border-t border-borderSubtle/60">
          <button type="button" onClick={() => setMethodOpen(v => !v)} aria-expanded={methodOpen} className="w-full px-5 h-[34px] flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors" data-stock-method-door={methodOpen ? 'open' : 'shut'}>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${methodOpen ? 'rotate-180' : ''}`} />
            How it is put together · what was observed, what was derived from it, what was inferred
          </button>
          <Fold open={methodOpen} axis="y" testId="data-stock-method">
            <div className="px-5 pb-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {(
                [
                  ['Observed · the raw data', view.method.observed],
                  ['Derived · the calculations', view.method.derived],
                  ['Inferred · the reads', view.method.inferred],
                ] as [string, string[]][]
              ).map(([title, items]) => (
                <div key={title} className="min-w-0">
                  <div className="text-[9px] uppercase tracking-widest text-textMuted">{title}</div>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {items.map(t => (
                      <li key={t} className="text-[11px] leading-snug text-textPrimary/85 pl-3 relative before:absolute before:left-0 before:top-[7px] before:w-1 before:h-1 before:rounded-full before:bg-ink/40">
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Fold>
        </div>
      </Box>

      {/* THE TIMELINE — the At the wall report's rows: a row per kind of mark, its count and grade at the left, a strip of the sessions
          on hand with a tick per mark, the facts at the right (the same marks sit on the trend's chart above) */}
      <Box title="The timeline" sub={`What happened on the ${trend.sessions} sessions on hand · a break is a close beyond the prior ten sessions' highs or lows, heavy volume 1.6× the session before, a big session 2.5% either way`} testId="timeline">
        <ul className="flex flex-col" data-stock-lanes>
          {lanes.map(r => (
            <li key={r.key} className="border-t border-borderSubtle/50" data-stock-timeline={r.key} data-lane-ticks={r.ticks.length} data-kind={r.key}>
              {/* One column on a phone (the phone pass, 2026-09-13): the name, the strip, the facts under each other */}
              <div className="grid grid-cols-[200px_minmax(0,1fr)_auto] items-center gap-6 px-5 py-3 max-lg:grid-cols-1 max-lg:gap-3">
                <div className="min-w-0">
                  <span className="block text-[11px] font-semibold" style={{ color: r.ink }}>
                    {r.label}
                  </span>
                  <span className="block font-mono text-[15px] font-semibold tnum leading-tight text-textPrimary">{r.figure}</span>
                  <span className={`mt-1 inline-flex items-center h-5 px-2 rounded-full border text-[10px] font-medium ${LANE_TONE[r.grade.tone]}`} data-grade>
                    {r.grade.words}
                  </span>
                </div>
                <div className="min-w-0">
                  <MarkStrip ticks={r.ticks} n={trend.times.length} label={r.label} />
                  <div className="flex justify-between font-mono text-[9px] tnum text-textMuted px-1 -mt-0.5">
                    <span>{trend.times.length ? dayOf(trend.times[0]) : ''}</span>
                    <span>now</span>
                  </div>
                </div>
                {/* Fixed tracks, so every row's strip ends on the same line whatever the words in the last fact */}
                <dl className="grid grid-cols-[52px_72px_64px_236px] gap-x-5 max-lg:flex max-lg:flex-wrap max-lg:gap-y-1.5">
                  {r.facts.map(f => (
                    <div key={f.k} className="min-w-0">
                      <dt className="text-[10px] text-textMuted whitespace-nowrap">{f.k}</dt>
                      <dd className={`mt-0.5 font-mono text-[12px] tnum whitespace-nowrap truncate ${f.cls ?? 'text-textPrimary'}`}>{f.v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </li>
          ))}
        </ul>
      </Box>

      {/* THE TAPE — the biggest buys and sells, then the busiest calls and puts; each pair shares one bottom edge */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <Box title="Biggest buys" sub="The tape's richest prints on the name today, paid on the ask · click one to weigh it" testId="buys">
          <div className="pb-2 mt-auto">
            {view.prints.buys.length === 0 && <div className="px-5 pb-3 pt-1 font-mono text-[10px] uppercase tracking-widest text-textMuted">No rich prints paid up on {T} yet today</div>}
            {view.prints.buys.map(p => (
              <PrintRow key={p.id} p={p} maxPrem={maxPrem} onWarm={warm} onOpen={() => weigh(p)} />
            ))}
          </div>
        </Box>
        <Box title="Biggest sells" sub="The tape's richest prints on the name today, hit on the bid · click one to weigh it" testId="sells">
          <div className="pb-2 mt-auto">
            {view.prints.sells.length === 0 && <div className="px-5 pb-3 pt-1 font-mono text-[10px] uppercase tracking-widest text-textMuted">No rich prints hit the bid on {T} yet today</div>}
            {view.prints.sells.map(p => (
              <PrintRow key={p.id} p={p} maxPrem={maxPrem} onWarm={warm} onOpen={() => weigh(p)} />
            ))}
          </div>
        </Box>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <Box title="Busiest calls" sub="The three busiest by volume today · click one to weigh it" testId="calls">
          <div className="pb-2 mt-auto">
            {money.busiest.calls.length === 0 && <div className="px-5 pb-3 pt-1 font-mono text-[10px] uppercase tracking-widest text-textMuted">No call volume on the book today</div>}
            {money.busiest.calls.map(c => (
              <ContractRow key={c.key} c={c} maxVol={maxVol} onWarm={warm} onOpen={() => weigh(c)} />
            ))}
          </div>
        </Box>
        <Box title="Busiest puts" sub="The three busiest by volume today · click one to weigh it" testId="puts">
          <div className="pb-2 mt-auto">
            {money.busiest.puts.length === 0 && <div className="px-5 pb-3 pt-1 font-mono text-[10px] uppercase tracking-widest text-textMuted">No put volume on the book today</div>}
            {money.busiest.puts.map(c => (
              <ContractRow key={c.key} c={c} maxVol={maxVol} onWarm={warm} onOpen={() => weigh(c)} />
            ))}
          </div>
        </Box>
      </div>

      {/* ON THE RECORD */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch" data-name-record>
        <Box title="What its insiders did" sub={`Open-market trades in the last 90 days · ${insiders.trades.length ? insiders.signal : 'nothing filed'}`} testId="insiders">
          {marketInsiders.length === 0 ? (
            <div className="px-5 pb-5 pt-1 font-mono text-[10px] uppercase tracking-widest text-textMuted">Nothing on the record in 90 days</div>
          ) : (
            <>
              {/* On a phone: when, who, the trade and its value — the shares and the plan go (the phone pass, 2026-09-13) */}
              <div className="px-5 h-[22px] grid items-center gap-x-3 text-[9px] uppercase tracking-widest text-textMuted grid-cols-[96px_minmax(0,1fr)_64px_80px_80px_72px] max-lg:grid-cols-[96px_minmax(0,1fr)_64px_80px]">
                <span>When</span>
                <span>Who · holds after</span>
                <span>Trade</span>
                <span className="text-right max-lg:hidden">Shares</span>
                <span className="text-right">Value</span>
                <span className="text-right max-lg:hidden">Chose to?</span>
              </div>
              {marketInsiders.map(t => (
                <div key={t.id} className="px-5 h-[38px] grid items-center gap-x-3 border-t border-borderSubtle/40 grid-cols-[96px_minmax(0,1fr)_64px_80px_80px_72px] max-lg:grid-cols-[96px_minmax(0,1fr)_64px_80px]" data-name-insider={t.id}>
                  <When days={t.daysAgo} size={10} />
                  <span className="min-w-0 flex flex-col leading-tight">
                    <span className="text-[11px] font-semibold text-textPrimary truncate">{t.person}</span>
                    <span className="text-[9px] text-textMuted truncate">
                      {t.role} · holds {count(t.heldAfter)} after
                    </span>
                  </span>
                  <span className={`font-mono text-[10px] ${t.kind === 'BUY' ? 'text-bull' : 'text-bear'}`}>{t.kind === 'BUY' ? 'Bought' : 'Sold'}</span>
                  <span className="text-right font-mono text-[10px] tnum text-textPrimary max-lg:hidden">{Math.round(t.shares).toLocaleString('en-US')}</span>
                  <span className="text-right font-mono text-[10px] tnum font-semibold text-textPrimary">{fmtMoney(t.value)}</span>
                  <span className={`text-right font-mono text-[8px] uppercase tracking-widest max-lg:hidden ${t.plan === 'discretionary' ? (isChosenBuy(t) ? 'text-textPrimary font-bold' : 'text-textSecondary') : 'text-textMuted'}`}>
                    {t.plan === 'discretionary' ? 'chosen' : t.plan === 'plan' ? 'planned' : 'unstated'}
                  </span>
                </div>
              ))}
            </>
          )}
          <div className="mt-auto px-5 py-2.5 border-t border-borderSubtle/40 flex flex-col gap-1.5 font-mono text-[10px] tnum" data-name-foot="insiders">
            <div className="flex items-center gap-4">
              <span className="text-textSecondary">
                bought <span className={insiders.bought > 0 ? 'text-bull' : 'text-textMuted'}>{insiders.bought > 0 ? fmtMoney(insiders.bought) : 'nothing'}</span> · sold{' '}
                <span className={insiders.sold > 0 ? 'text-bear' : 'text-textMuted'}>{insiders.sold > 0 ? fmtMoney(insiders.sold) : 'nothing'}</span>
                {insiders.buyerCluster > 1 && <span className="text-silver"> · {insiders.buyerCluster} buyers inside a month</span>}
              </span>
              <Link to="/dossier/insiders" className="ml-auto inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors">
                <ArrowUpRight className="w-3 h-3" /> every insider
              </Link>
            </div>
            {insiderTotal > 0 && <ShareBar left={(100 * insiders.bought) / insiderTotal} />}
          </div>
        </Box>
        <Box title="What Congress reported" sub="STOCK Act reports naming this stock in the last 180 days · board seats need the feed" testId="congress">
          {congress.length === 0 ? (
            <div className="px-5 pb-5 pt-1 font-mono text-[10px] uppercase tracking-widest text-textMuted">Nothing on the record in 180 days</div>
          ) : (
            <>
              {/* On a phone: filed, member, type — the amount and the lag go (the phone pass, 2026-09-13) */}
              <div className="px-5 h-[22px] grid items-center gap-x-3 text-[9px] uppercase tracking-widest text-textMuted grid-cols-[96px_minmax(0,1fr)_88px_132px_64px] max-lg:grid-cols-[96px_minmax(0,1fr)_88px]">
                <span>Filed</span>
                <span>Member</span>
                <span>Type</span>
                <span className="max-lg:hidden">Amount disclosed</span>
                <span className="text-right max-lg:hidden">Lag</span>
              </div>
              {congress.map(t => (
                <div key={t.id} className="px-5 h-[38px] grid items-center gap-x-3 border-t border-borderSubtle/40 grid-cols-[96px_minmax(0,1fr)_88px_132px_64px] max-lg:grid-cols-[96px_minmax(0,1fr)_88px]" data-name-congress={t.id}>
                  <When days={t.filedDaysAgo} size={10} />
                  <span className="min-w-0 flex flex-col leading-tight">
                    <span className="text-[11px] font-semibold text-textPrimary truncate">{t.member.name}</span>
                    <span className="text-[9px] text-textMuted truncate">
                      {t.member.party}-{t.member.state} · {t.committeeOverlap ? <span className="text-warn">{t.committeeOverlap} · own committee</span> : t.member.chamber}
                    </span>
                  </span>
                  <span className={`font-mono text-[10px] ${t.type === 'Purchase' ? 'text-bull' : t.type === 'Exchange' ? 'text-textMuted' : 'text-bear'}`}>{t.type === 'Purchase' ? 'Purchase' : t.type === 'Exchange' ? 'Exchange' : t.type === 'Sale (Partial)' ? 'Sale · partial' : 'Sale'}</span>
                  <span className="font-mono text-[10px] tnum text-textPrimary truncate max-lg:hidden">{bracketLabel(t.bracket)}</span>
                  <span className={`text-right font-mono text-[10px] tnum max-lg:hidden ${t.late ? 'text-bear' : 'text-textSecondary'}`}>
                    {t.lagDays}d{t.late ? ' late' : ''}
                  </span>
                </div>
              ))}
            </>
          )}
          <div className="mt-auto px-5 py-2.5 border-t border-borderSubtle/40 flex items-center gap-4 font-mono text-[10px] tnum" data-name-foot="congress">
            {congress.length > 0 && (
              <span className="text-textSecondary">
                {congress.filter(t => t.type === 'Purchase').length} purchases · {congress.filter(t => t.type !== 'Purchase' && t.type !== 'Exchange').length} sales
                {congress.some(t => t.committeeOverlap) && <span className="text-warn"> · {congress.filter(t => t.committeeOverlap).length} from a member whose committee oversees the sector</span>}
              </span>
            )}
            <Link to="/dossier/congress" className="ml-auto inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors">
              <ArrowUpRight className="w-3 h-3" /> every report
            </Link>
          </div>
        </Box>
      </div>
    </>
  );
};

/** The pillar's bar as a box's aside — the same bar, a shorter track */
const PillarBarSmall = ({ p }: { p: Pillar }) => (
  <div className="w-[150px] shrink-0">
    <PillarBar p={p} />
  </div>
);

export default StockName;
