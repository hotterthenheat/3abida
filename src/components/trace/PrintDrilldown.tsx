/*
==================================================
  SLAYER TERMINAL - PRINT DRILLDOWN
  The anatomy of one options print, in a wide
  centred overlay so the tape still frames it.

  Beyond the raw fields it does the thing only we
  can: it runs the contract through the Compass
  scale, so the drilldown does not just DESCRIBE the
  print — it grades the contract and says what the
  spread and the clock will take out of it.

  Every window is steerable: the session, the range,
  the bar interval, which overlays are drawn, and
  whether spread legs count. And every label is
  spelled out.
==================================================
*/

import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Compass, Copy, Crosshair, Scale } from 'lucide-react';
import Modal from '../ui/Modal';
import CompanyLogo from '../ui/CompanyLogo';
import SignalBadge from '../ui/SignalBadge';
import RichRead from '../ui/RichRead';
import ErrorBoundary from '../ui/ErrorBoundary';
import FilterTabs from '../ui/FilterTabs';
import Chip from '../ui/Chip';
import { sentimentOf } from '../../data/tape';
import { fmtUsd } from '../../data/gex';
import {
  buildContractFlow,
  DEFAULT_FLOW_OPTIONS,
  sessionDate,
  SESSION_MIN,
  type FlowOptions,
  type FlowRange,
  type VolOiDay,
} from '../../data/contractflow';
import type { NetMetric } from './ContractFlowChart';
import DatePicker from '../ui/DatePicker';
import { weighContract } from '../../core/contractScore';
import { makeSetup, sleeveForDte } from '../../data/compass';
import Simulator from '../../core/simulator';
import VerdictBadge from '../compass/VerdictBadge';
import { useMarketData } from '../../context/MarketDataContext';
import type { FlowPrint, PrintSentiment } from '../../types/trace';
import type { MarketSnapshot } from '../../types/market';
import { toneBar, type Tone } from '../ui/tones';
import { Name } from '../ui/Name';

// recharts is heavy — it only loads when a print is actually opened
const FlowPanels = lazy(() => import('./ContractFlowChart').then(m => ({ default: m.FlowPanel })));
const NetPanels = lazy(() => import('./ContractFlowChart').then(m => ({ default: m.NetPanel })));

const SENT_TONE: Record<PrintSentiment, Tone> = { BULLISH: 'bull', BEARISH: 'bear', NEUTRAL: 'neutral' };
/* The STATE comes from makeSetup — the board's engine (2026-08-30 ruling,
   see contractScore.ts) — so this strip and Compass can never disagree.
   weighContract stays for the QUALITY facts (spread + theta friction). */

const TABLE_TABS = [
  { value: 'orders', label: 'Flow orders' },
  { value: 'history', label: 'Volume & open interest' },
] as const;
type TableTab = (typeof TABLE_TABS)[number]['value'];

/* The drilldown reads whatever the feed hands it. A field that is missing must
   render as a dash — never throw and take the page down with it. */
const num = (v: number | undefined | null): string => (Number.isFinite(v as number) ? (v as number).toLocaleString() : '—');
const fixed = (v: number | undefined | null, dp = 2): string => (Number.isFinite(v as number) ? (v as number).toFixed(dp) : '—');
const usd = (v: number | undefined | null): string => (Number.isFinite(v as number) ? fmtUsd(v as number) : '—');

/** One small labelled figure inside a hero zone. */
const Mini = ({ label, value, tone = 'text-textPrimary' }: { label: string; value: ReactNode; tone?: string }) => (
  <span className="flex flex-col gap-0.5 min-w-0">
    <span className="font-mono text-[8.5px] uppercase tracking-widest text-textMuted truncate">{label}</span>
    <span className={`font-mono text-[11.5px] font-semibold tnum ${tone} truncate`}>{value}</span>
  </span>
);

const RANGES: FlowRange[] = ['1D', '2D', '3D', '5D', '10D', '1M'];
const INTERVALS = [1, 5, 15, 30];

/* The engine answers its own question. STATES, not adjectives left to the
   reader: UNUSUAL / BUSY / ORDINARY, judged against the contract's own
   median session — a lotto name that always churns should NOT light up. */
type TapeState = 'UNUSUAL' | 'BUSY' | 'ORDINARY';
const TAPE_TONE: Record<TapeState, Tone> = { UNUSUAL: 'warn', BUSY: 'neutral', ORDINARY: 'neutral' };

function tapeVerdict(rows: VolOiDay[]): { state: TapeState; read: string; volX: number } | null {
  if (!rows || rows.length < 4) return null;
  const [today, ...past] = rows;
  const med = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)] ?? 0;
  };
  const volX = today.vol / Math.max(1, med(past.map(p => p.vol)));
  const sweptTypical = med(past.map(p => p.sweepPct));
  const sweptDelta = today.sweepPct - sweptTypical;
  const state: TapeState = volX >= 2.5 || sweptDelta >= 25 ? 'UNUSUAL' : volX >= 1.4 ? 'BUSY' : 'ORDINARY';
  const bits = `${volX.toFixed(1)}× its usual volume · swept ${today.sweepPct}% vs ${Math.round(sweptTypical)}% typical · open interest ${
    today.oiChangePct >= 0 ? '+' : ''
  }${today.oiChangePct.toFixed(1)}%`;
  const read =
    state === 'UNUSUAL'
      ? `${bits} — this is not how it normally trades.`
      : state === 'BUSY'
        ? `${bits} — busier than usual, same character.`
        : `${bits} — in line with its history.`;
  return { state, read, volX };
}

/** Tiny inline volume shape for a history row. */
const Spark = ({ values }: { values: number[] }) => {
  const max = Math.max(...values, 0.01);
  return (
    <span className="inline-flex items-end gap-[1px] h-4">
      {values.map((v, i) => (
        <span key={i} className="w-[3px] rounded-[1px] bg-ink/30" style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />
      ))}
    </span>
  );
};

/** Plain-English summary of what this print actually was. */
function printRead(p: FlowPrint, sent: PrintSentiment): string {
  const who = p.side === 'ASK' ? 'paid the offer' : p.side === 'BID' ? 'hit the bid' : 'traded at the mid';
  const size = p.premium >= 1_000_000 ? 'a whale-sized' : p.premium >= 250_000 ? 'a sizeable' : 'a modest';
  const urgency = p.sweep ? 'swept across venues — that is urgency, not patience' : 'printed as a single block';
  const oiNote =
    p.volOverOI >= 5
      ? `Volume is ${fixed(p.volOverOI, 1)}x the open interest, so this is new positioning rather than someone closing out.`
      : p.deltaOI > 0
        ? 'Open interest grew on the day, so size is being added rather than unwound.'
        : 'Open interest did not grow much, so some of this is likely closing existing risk.';
  return `${size} ${p.right === 'C' ? 'call' : 'put'} print that ${who} and ${urgency}. The tape reads ${sent.toLowerCase()} on it. ${oiNote}`;
}

interface PrintDrilldownProps {
  print: FlowPrint | null;
  snapshot: MarketSnapshot | null;
  onClose: () => void;
  isMarked: boolean;
  onToggleMark: (id: number) => void;
  onStep: (dir: -1 | 1) => void;
  hasPrev: boolean;
  hasNext: boolean;
  /** The live tape buffer — THE SEQUENCE reads the same contract's other
      prints out of it (isolated trade, or one leg of a working order?) */
  tapeRows?: FlowPrint[];
  /** Swap the drilldown to a sibling print from the sequence */
  onOpenPrint?: (p: FlowPrint) => void;
}

/** Same-contract identity on the tape: one name, one strike, one right, one expiry. */
const sameContract = (a: FlowPrint, b: FlowPrint) =>
  a.ticker === b.ticker && a.strike === b.strike && a.right === b.right && a.expiry === b.expiry;

const SEQ_SHOWN = 6;

/*
  THE SEQUENCE — the open print among its siblings from the LIVE tape buffer
  (Noah, 2026-08-19: "see whether it's an isolated trade or part of a larger
  sequence"). Deliberately reads the buffer the user was just watching, NOT
  the window history below (that is the contract's whole session; this is
  "what else crossed the tape I saw"), and deliberately unfiltered — evidence
  must not vanish because a tape filter is on. The verdict speaks first;
  rows are doors that swap the drilldown to that print.
*/
const SequenceStrip = ({
  print,
  siblings,
  onOpenPrint,
}: {
  print: FlowPrint;
  siblings: FlowPrint[];
  onOpenPrint?: (p: FlowPrint) => void;
}) => {
  const n = siblings.length;
  const read = useMemo(() => {
    if (n <= 1) return 'Isolated — the only print on this contract on the live tape.';
    const total = siblings.reduce((a, p) => a + p.premium, 0);
    const bought = siblings.filter(p => p.side === 'ASK').length;
    const sold = siblings.filter(p => p.side === 'BID').length;
    const mid = n - bought - sold;
    const oldest = siblings[n - 1].time;
    const newest = siblings[0].time;
    const parts = [
      `Part of a sequence — ${n} prints on this contract on the live tape`,
      `${fmtUsd(total)} total`,
      `${bought} paid the offer / ${sold} hit the bid${mid ? ` / ${mid} mid` : ''}`,
      `${oldest} → ${newest}`,
    ];
    return `${parts.join(' · ')}.`;
  }, [siblings, n]);

  const shown = siblings.slice(0, SEQ_SHOWN);

  return (
    <div className="border border-borderSubtle bg-inset rounded-md overflow-hidden">
      <div className="px-3 py-2 border-b border-borderSubtle/60 flex items-baseline gap-2 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-widest text-textSecondary">The sequence</span>
        <span className="font-mono text-[9px] text-textMuted">same contract on the live tape</span>
      </div>
      <p className="px-3 pt-2 text-[11px] text-textSecondary leading-snug tnum">
        <RichRead text={read} />
      </p>
      {n > 1 && (
        <div className="px-1.5 py-1.5 flex flex-col">
          {shown.map(p => {
            const self = p.id === print.id;
            const word = p.side === 'ASK' ? 'paid offer' : p.side === 'BID' ? 'hit bid' : 'mid';
            const ink = p.side === 'ASK' ? 'text-bull' : p.side === 'BID' ? 'text-bear' : 'text-textMuted';
            const row = (
              <>
                <span className="w-[86px] shrink-0 font-mono text-[10px] tnum text-textMuted">{p.time}</span>
                <span className={`w-[74px] shrink-0 font-mono text-[9px] font-semibold uppercase tracking-wider ${ink}`}>{word}</span>
                <span className="font-mono text-[10px] tnum text-textSecondary">
                  {p.size.toLocaleString()} × ${p.fill.toFixed(2)}
                </span>
                <span className="font-mono text-[10px] font-bold tnum text-textPrimary">{fmtUsd(p.premium)}</span>
                {p.sweep && <span className="font-mono text-[8px] font-semibold uppercase tracking-wider text-warn">Sweep</span>}
                {self && (
                  <span className="ml-auto font-mono text-[8px] font-semibold uppercase tracking-wider text-silver">Viewing</span>
                )}
              </>
            );
            return self || !onOpenPrint ? (
              <div
                key={p.id}
                className={`flex items-baseline gap-2.5 px-1.5 py-1 rounded ${
                  self ? 'bg-silver/[0.05] shadow-[inset_2px_0_0_0_rgba(199,211,232,0.7)]' : ''
                }`}
              >
                {row}
              </div>
            ) : (
              <button
                key={p.id}
                onClick={() => onOpenPrint(p)}
                title="Open this print"
                className="flex items-baseline gap-2.5 px-1.5 py-1 rounded text-left hover:bg-ink/[0.04] transition-colors"
              >
                {row}
              </button>
            );
          })}
          {n > SEQ_SHOWN && (
            <span className="px-1.5 py-1 font-mono text-[9px] text-textMuted tnum">…and {n - SEQ_SHOWN} more on the tape</span>
          )}
        </div>
      )}
    </div>
  );
};

const PrintDrilldown = ({ print, snapshot, onClose, isMarked, onToggleMark, onStep, hasPrev, hasNext, tapeRows, onOpenPrint }: PrintDrilldownProps) => {
  const navigate = useNavigate();
  const { changeTicker } = useMarketData();

  // Buffer order is newest-first; a filter keeps it, so index 0 = latest leg.
  const siblings = useMemo(
    () => (print && tapeRows ? tapeRows.filter(p => sameContract(p, print)) : []),
    [print, tapeRows]
  );

  // Window controls
  // The card opens on the house window — one source, shared with the builder's
  // own default so the tape can never open on a setting nothing else agrees to.
  const [range, setRange] = useState<FlowRange>(DEFAULT_FLOW_OPTIONS.range);
  const [intervalMin, setIntervalMin] = useState(DEFAULT_FLOW_OPTIONS.intervalMin);
  const [dayOffset, setDayOffset] = useState(0);
  const [singleLegOnly, setSingleLegOnly] = useState(false);
  const [showAvg, setShowAvg] = useState(true);
  const [showIv, setShowIv] = useState(false);
  const [showCalls, setShowCalls] = useState(true);
  const [showPuts, setShowPuts] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [metric, setMetric] = useState<NetMetric>('netPremium');
  const [tableTab, setTableTab] = useState<TableTab>('history');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const sent = print ? sentimentOf(print) : 'NEUTRAL';
  const sideLabel = print?.side === 'ASK' ? 'BOUGHT' : print?.side === 'BID' ? 'SOLD' : 'MID';
  const sideTone = print?.side === 'ASK' ? 'text-bull' : print?.side === 'BID' ? 'text-bear' : 'text-textMuted';

  const opts: FlowOptions = useMemo(
    () => ({ range, intervalMin, dayOffset, singleLegOnly }),
    [range, intervalMin, dayOffset, singleLegOnly]
  );

  // Where in the session the print landed — feeds the builder AND the marker
  const atMinute = print
    ? Math.min(389, Math.max(0, (Number(print.time.slice(0, 2)) - 9) * 60 + Number(print.time.slice(3, 5)) - 30))
    : 0;

  const cf = useMemo(() => {
    if (!print) return null;
    try {
      return buildContractFlow(
        {
          ticker: print.ticker,
          strike: print.strike,
          right: print.right,
          fill: print.fill,
          spot: print.spot,
          size: print.size,
          side: print.side,
          volume: print.volume,
          oi: print.oi,
          iv: print.iv,
          atMinute,
        },
        opts
      );
    } catch {
      return null;
    }
  }, [print, opts, atMinute]);

  // The lime moment-marker through both chart strips. Multi-session windows
  // end on the live session, so the print sits in the LAST session; browsing
  // a past session means the window no longer contains it — no marker.
  const printMin = useMemo(() => {
    if (!print || !cf || dayOffset !== 0) return null;
    return (cf.sessions - 1) * SESSION_MIN + Math.min(atMinute, SESSION_MIN);
  }, [print, cf, dayOffset, atMinute]);

  // Is this session unusual FOR THIS CONTRACT? Judged against its own history.
  const verdict = useMemo(() => (cf ? tapeVerdict(cf.history) : null), [cf]);

  const copySummary = () => {
    if (!print) return;
    const txt = `${print.ticker} ${print.strike}${print.right} ${print.expiry} (${print.dte}d) — ${sideLabel} ${usd(print.premium)} · ${num(
      print.size
    )} @ $${fixed(print.fill)}${print.sweep ? ' · sweep' : ''} · tape ${sent.toLowerCase()} · vol ${num(print.volume)} / OI ${num(
      print.oi
    )} (${fixed(print.volOverOI)}x)`;
    navigator.clipboard
      ?.writeText(txt)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  // The Compass grade for this exact contract. The scale reads the ACTIVE
  // ticker's chain, so a print on another name can't be graded until the
  // terminal is looking at it — we say so rather than grading the wrong book.
  const sameTicker = !!print && !!snapshot && print.ticker === snapshot.ticker;
  const weighed = useMemo(() => {
    if (!print || !snapshot || !sameTicker) return null;
    try {
      return weighContract(snapshot, print.right, print.strike, print.dte);
    } catch {
      return null;
    }
  }, [print, snapshot, sameTicker]);

  // The state, from the board's own engine — same gate as the quality weigh.
  const graded = useMemo(() => {
    if (!print || !sameTicker) return null;
    const cfg = Simulator.TICKERS[print.ticker];
    if (!cfg) return null;
    try {
      return makeSetup(print.ticker, cfg.currentPrice, print.strike, print.right, 'top-setups', cfg.iv, sleeveForDte(print.dte), print.dte);
    } catch {
      return null;
    }
  }, [print, sameTicker]);

  const friction = weighed ? weighed.contract.spreadPct + weighed.contract.thetaPerDayPct : 0;

  const jump = (fn: () => void) => {
    onClose();
    fn();
  };

  const linkBtn =
    'inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded border border-borderSubtle bg-ink/[0.02] font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors';

  const dateLabel = sessionDate(dayOffset).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <Modal
      open={!!print}
      onClose={onClose}
      // Near-full width: two time-series panels plus a wide table need the room,
      // and the tape still frames it on both sides.
      widthClass="max-w-[1680px]"
      ariaLabel={print ? `${print.ticker} ${print.strike}${print.right} print detail` : 'print detail'}
      // The session drives every series in the modal, so it sits dead centre
      // rather than tucked in with the window controls.
      headerCenter={
        /* The whole session box wears the holo foil — navigation hardware,
           dark ink on the bright material (Noah: "the entire box"). The label
           carries today-vs-past, so the material stays constant. */
        <div className="group relative flex items-center gap-0.5 rounded holo-bg text-[#0a0a0a] px-1 py-0.5">
            {/* ONE hover for the WHOLE box (Noah, 2026-08-23: "the entire
                button and not just the inner section") — a full-box wash on
                group hover instead of per-segment tints */}
            <span
              className="absolute inset-0 rounded bg-black/0 group-hover:bg-black/[0.12] transition-colors pointer-events-none"
              aria-hidden
            />
            <button
              onClick={() => setDayOffset(d => d + 1)}
              title="Previous session"
              className="p-0.5 rounded transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCalendarOpen(o => !o)}
              title="Pick a session"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold tnum transition-colors"
            >
              <CalendarDays className="w-3 h-3" />
              {dayOffset === 0 ? 'Today' : dateLabel}
            </button>
            <button
              onClick={() => setDayOffset(d => Math.max(0, d - 1))}
              disabled={dayOffset === 0}
              title="Next session"
              className="p-0.5 rounded transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

          {calendarOpen && (
            <DatePicker selected={sessionDate(dayOffset)} onPick={setDayOffset} onClose={() => setCalendarOpen(false)} />
          )}
        </div>
      }
      headerActions={
        <div className="flex items-center gap-0.5 shrink-0">
          {print && (
            <button
              onClick={() => onToggleMark(print.id)}
              aria-pressed={isMarked}
              title={isMarked ? 'Tracking this print' : 'Track this print'}
              className={`p-1 rounded transition-colors ${isMarked ? 'text-select' : 'text-textMuted hover:text-textPrimary hover:bg-ink/[0.05]'}`}
            >
              <Bookmark className="w-3.5 h-3.5" fill={isMarked ? 'currentColor' : 'none'} />
            </button>
          )}
          <button
            onClick={copySummary}
            title="Copy a one-line summary of this print"
            className={`p-1 rounded transition-colors ${copied ? 'text-select' : 'text-textMuted hover:text-textPrimary hover:bg-ink/[0.05]'}`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <span className="w-px h-3.5 bg-borderSubtle mx-0.5" />
          <button
            onClick={() => onStep(-1)}
            disabled={!hasPrev}
            title="Previous print (↑)"
            className="p-1 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => onStep(1)}
            disabled={!hasNext}
            title="Next print (↓)"
            className="p-1 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      }
      header={
        print && (
          <div className="flex items-center gap-3 flex-wrap">
            <CompanyLogo ticker={print.ticker} size={18} />
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[13px] font-semibold ${
                print.right === 'C' ? 'border-bull/30 bg-bull/10 text-bull' : 'border-bear/30 bg-bear/10 text-bear'
              }`}
            >
              {print.ticker} {print.strike}
              {print.right}
            </span>
            <span className="font-mono text-[10px] text-textSecondary tnum">
              {print.expiry} · {print.dte}d
            </span>
            {/* White: a leg count is a fact, not a status — the tape's own rule (2026-08-30). */}
            {print.legs > 1 && <span className="font-mono text-[10px] text-textPrimary">×{print.legs} legs</span>}
            <SignalBadge tone={SENT_TONE[sent]}>{sent}</SignalBadge>
            <span className="font-mono text-[10px] text-textSecondary tnum">{print.time}</span>
            <span className={`font-mono text-[10px] uppercase ${print.sweep ? 'text-warn font-semibold' : 'text-textMuted'}`}>
              {print.sweep ? 'Sweep' : print.strat === '—' ? 'Block' : print.strat}
            </span>
            <span className="font-mono text-[10px] text-textSecondary tnum">
              {print.ticker} ${fixed(print.spot)}
            </span>
          </div>
        )
      }
    >
      {print && (
        <>
          {/* The hero — one instrument, three named zones: what traded, what it
              means, and how the Compass grades it. Everything that used to be
              scattered (stat boxes, floating paragraph, three stat sections,
              the spread slider) folds in here. */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-borderSubtle border border-borderSubtle rounded-md overflow-hidden">
            {/* THE PRINT — the money, the aggressor, where in the spread it filled */}
            <div className="lg:col-span-4 bg-inset px-3.5 py-3 flex flex-col gap-2.5 min-w-0">
              <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">The print</span>
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <span className={`font-mono text-2xl font-bold tnum leading-none ${print.premium >= 1_000_000 ? 'text-supreme' : 'text-textPrimary'}`}>
                  {usd(print.premium)}
                </span>
                <span className={`font-mono text-sm font-bold ${sideTone}`}>{sideLabel}</span>
                {print.sweep && <span className="font-mono text-[10px] uppercase font-semibold text-warn">Sweep</span>}
              </div>
              {/* the clearest aggressor tell — where between bid and ask it printed */}
              <div className="flex items-center gap-2.5 mt-auto">
                <span className="font-mono text-[10px] tnum text-textMuted">{fixed(print.bid)}</span>
                <span className="relative flex-1 h-[4px] rounded-full bg-ink/[0.07]">
                  <span
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[9px] h-[9px] rounded-full ${
                      print.side === 'ASK' ? 'bg-bull' : print.side === 'BID' ? 'bg-bear' : 'bg-ink/60'
                    }`}
                    style={{ left: `${print.fillPos * 100}%` }}
                  />
                </span>
                <span className="font-mono text-[10px] tnum text-textMuted">{fixed(print.ask)}</span>
              </div>
              <span className="font-mono text-[10px] text-textSecondary tnum">
                <RichRead text={`filled $${fixed(print.fill)} × ${num(print.size)} · ${print.time}`} />
              </span>
            </div>

            {/* THE READ — the terminal talks first, the figures behind it after */}
            <div className="lg:col-span-5 bg-inset px-3.5 py-3 flex flex-col gap-2.5 min-w-0">
              <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">Summary</span>
              <p className="text-[12px] text-textSecondary leading-relaxed">
                <RichRead text={printRead(print, sent)} />
              </p>
              {/* 3-up, two rows — 6-up ellipsized "OPEN INTEREST" in this zone's width */}
              <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 mt-auto pt-1">
                {/* Words, not the grade — the flow score is engine-internal
                    (Noah, 2026-08-16) */}
                <Mini
                  label="Conviction"
                  value={print.flowScore > 15 ? 'BUYERS' : print.flowScore < -15 ? 'SELLERS' : 'MIXED'}
                  tone={print.flowScore > 15 ? 'text-bull' : print.flowScore < -15 ? 'text-bear' : 'text-textMuted'}
                />
                <Mini
                  label="Day ratio"
                  value={print.ratioLabel}
                  tone={print.ratioLabel === 'MID' ? 'text-textMuted' : print.ratioBidPct >= 50 ? 'text-bear' : 'text-bull'}
                />
                <Mini
                  label="OTM"
                  value={`${print.otmPct >= 0 ? '+' : ''}${fixed(print.otmPct, 1)}%`}
                  tone={print.otmPct >= 0 ? 'text-bull' : 'text-bear'}
                />
                <Mini label="Volume" value={num(print.volume)} />
                <Mini label="Open interest" value={num(print.oi)} />
                <Mini label="Vol ÷ OI" value={`${fixed(print.volOverOI)}x`} tone={print.volOverOI >= 5 ? 'text-warn' : 'text-textPrimary'} />
              </div>
            </div>

            {/* THE SCALE — our moat: the contract graded, not just described */}
            <div className="lg:col-span-3 bg-inset px-3.5 py-3 flex flex-col gap-2 min-w-0">
              <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">On the Compass scale</span>
              {graded && weighed ? (
                <>
                  {/* The verdict is the BOARD's — VerdictBadge, makeSetup —
                      and the meter runs on Confidence, the one sanctioned
                      number. Composite stays engine-internal. */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <VerdictBadge verdict={graded.verdict} dot />
                    <span className="font-mono text-[10px] text-textMuted uppercase tracking-wider">
                      {graded.sleeve === 'odte' ? 'same-day' : graded.sleeve}
                    </span>
                    <span className="ml-auto font-mono text-[10px] tnum text-textSecondary">{graded.confidence}%</span>
                  </div>
                  <span className="relative block h-[3px] rounded-full bg-ink/[0.06]">
                    <span
                      className={`absolute inset-y-0 left-0 rounded-full ${
                        toneBar[graded.verdict === 'ENTER' ? 'bull' : graded.verdict === 'EXIT' ? 'bear' : 'warn']
                      }`}
                      style={{ width: `${Math.max(4, Math.min(100, graded.confidence))}%` }}
                    />
                  </span>
                  <span className="font-mono text-[10px] tnum text-textSecondary mt-auto">
                    spread + a day of theta take{' '}
                    <span className={friction > 16 ? 'text-bear font-semibold' : friction > 8 ? 'text-warn font-semibold' : 'text-bull font-semibold'}>
                      {fixed(friction, 1)}%
                    </span>
                  </span>
                </>
              ) : (
                <button
                  onClick={() => changeTicker(print.ticker)}
                  className="font-mono text-[11px] text-textSecondary hover:text-textPrimary transition-colors text-left"
                >
                  The scale reads the live chain — switch the terminal to{' '}
                  <Name t={print.ticker} size={12} className="text-select font-semibold" /> to grade this contract.
                </button>
              )}
            </div>
          </div>

          {/* THE SEQUENCE — siblings from the live buffer, before the window
              history: "am I looking at a one-off or a series?" is the first
              question after "what is it?" */}
          {tapeRows && <SequenceStrip print={print} siblings={siblings} onOpenPrint={onOpenPrint} />}

          {/* THE TAPE — the shape that is ours, not theirs: both instruments
              stacked full-width on ONE clock, crosshairs synced, and a lime
              line through both at the exact minute of the print you clicked.
              The question this answers that two side-by-side dashboards
              can't: where does THIS print sit in the day? */}
          <ErrorBoundary label="The flow panels" resetKey={`${print.id}-${range}-${intervalMin}-${dayOffset}`}>
            <Suspense
              fallback={
                <div className="h-[520px] rounded-md border border-borderSubtle bg-inset flex items-center justify-center font-mono text-[10px] text-textMuted uppercase tracking-widest">
                  Loading flow…
                </div>
              }
            >
              {cf && (
                <div className="border border-borderSubtle bg-inset rounded-md overflow-hidden">
                  {/* One toolbar drives both strips — the window is shared */}
                  <div className="px-3 py-2 border-b border-borderSubtle/60 flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-textSecondary">The tape</span>
                    <span className="font-mono text-[9px] text-textMuted">both instruments on one clock</span>
                    <span className="ml-auto flex items-center gap-0.5">
                      {RANGES.map(r => (
                        <Chip key={r} active={r === range} onClick={() => setRange(r)} title={`Show ${r}`}>
                          {r}
                        </Chip>
                      ))}
                    </span>
                    <span className="w-px h-3.5 bg-borderSubtle" />
                    <span className="flex items-center gap-0.5">
                      {INTERVALS.map(m => (
                        <Chip key={m} active={m === intervalMin} onClick={() => setIntervalMin(m)} title={`${m}-minute bars`}>
                          {m}m
                        </Chip>
                      ))}
                    </span>
                    <span className="w-px h-3.5 bg-borderSubtle" />
                    <Chip
                      active={singleLegOnly}
                      onClick={() => setSingleLegOnly(!singleLegOnly)}
                      title="Hide prints that are one leg of a spread"
                    >
                      Single-leg only
                    </Chip>
                  </div>
                  <div className="px-3 pt-2.5 pb-1">
                    <FlowPanels
                      cf={cf}
                      showAvg={showAvg}
                      onShowAvg={setShowAvg}
                      showIv={showIv}
                      onShowIv={setShowIv}
                      dayOffset={dayOffset}
                      printMin={printMin}
                      syncId="print-tape"
                    />
                  </div>
                  <div className="mx-3 my-1.5 h-px bg-borderSubtle/60" />
                  <div className="px-3 pt-1 pb-2.5">
                    <NetPanels
                      cf={cf}
                      ticker={print.ticker}
                      metric={metric}
                      onMetric={setMetric}
                      showCalls={showCalls}
                      onShowCalls={setShowCalls}
                      showPuts={showPuts}
                      onShowPuts={setShowPuts}
                      showPrice={showPrice}
                      onShowPrice={setShowPrice}
                      dayOffset={dayOffset}
                      printMin={printMin}
                      syncId="print-tape"
                    />
                  </div>
                </div>
              )}
            </Suspense>
          </ErrorBoundary>

          {/* This session against the contract's own history — the engine
              answers the question instead of leaving 13 columns to ask it */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <FilterTabs ariaLabel="Table view" options={TABLE_TABS} value={tableTab} onChange={setTableTab} />
              {/* The note travels WITH the table (Noah, 2026-08-30: "the
                  transition needs to be smooth between them with the
                  information as well"). Keyed on the tab so it re-enters on the
                  house curve instead of being swapped out from under the
                  reader — the pill already glides, and this used to snap
                  while it did. */}
              <span key={tableTab} className="animate-soft-in min-w-0">
                {tableTab === 'orders' ? (
                  <span className="font-mono text-[9px] uppercase tracking-wider text-textMuted">
                    {cf?.orders.length ?? 0} orders in this window
                  </span>
                ) : verdict ? (
                  <span className="flex items-center gap-2 flex-wrap min-w-0">
                    <SignalBadge tone={TAPE_TONE[verdict.state]} dot={verdict.state === 'UNUSUAL'}>
                      {verdict.state}
                    </SignalBadge>
                    {/* Numbers in sentences wear the house code — RichRead, not flat gray */}
                    <span className="font-mono text-[10px] text-textSecondary tnum truncate">
                      <RichRead text={verdict.read} />
                    </span>
                  </span>
                ) : null}
              </span>
            </div>
            <ErrorBoundary label="The table" resetKey={`${print.id}-${tableTab}-${range}-${dayOffset}`}>
              {/* Both views are capped scrollers of the SAME height, so the
                  swap is a cross-fade in a slot that never moves. Animating a
                  changing height here would have been the wrong answer: it
                  costs a layout animation on every re-render, and this card
                  already has enough moving parts. */}
              <div key={tableTab} className="animate-soft-in">
                {cf && (tableTab === 'orders' ? <OrdersTable cf={cf} /> : <HistoryTable rows={cf.history} unusual={!!verdict && verdict.volX >= 2.5} />)}
              </div>
            </ErrorBoundary>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[10px] uppercase tracking-widest text-textSecondary mr-1">Open in</span>
            <button onClick={() => jump(() => { changeTicker(print.ticker); navigate('/pinpoint'); })} className={linkBtn}>
              <Crosshair className="w-3.5 h-3.5" /> Dealer map
            </button>
            <button
              onClick={() =>
                jump(() =>
                  navigate('/compass', { state: { monitor: { ticker: print.ticker, strike: print.strike, right: print.right, scanner: 'top-setups' } } })
                )
              }
              className={linkBtn}
            >
              <Compass className="w-3.5 h-3.5" /> Monitor strike
            </button>
            <button onClick={() => jump(() => navigate('/weigher', { state: { weigh: { ticker: print.ticker } } }))} className={linkBtn}>
              <Scale className="w-3.5 h-3.5" /> Weigh it
            </button>
            <button
              onClick={() => onToggleMark(print.id)}
              aria-pressed={isMarked}
              className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded border font-mono text-[10px] uppercase tracking-wider transition-colors ${
                isMarked
                  ? 'border-select/40 bg-select/[0.08] text-select'
                  : 'border-borderSubtle bg-ink/[0.02] text-textSecondary hover:text-textPrimary hover:border-borderMuted'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" fill={isMarked ? 'currentColor' : 'none'} />
              {isMarked ? 'Tracking' : 'Track print'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
};

const th = 'px-2 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-textMuted border-b border-borderSubtle';
const td = 'px-2 py-1.5 font-mono text-[10px] tnum';

/** The raw orders behind the window. */
const OrdersTable = ({ cf }: { cf: ReturnType<typeof buildContractFlow> }) => (
  <div className="border border-borderSubtle rounded-md overflow-hidden max-h-[240px] overflow-y-auto">
    <table className="w-full border-collapse">
      <thead className="sticky top-0 z-10">
        <tr className="bg-inset">
          <th className={`${th} text-left`}>Time</th>
          <th className={`${th} text-right`}>Price</th>
          <th className={`${th} text-right`}>Size</th>
          <th className={`${th} text-left`}>Who paid</th>
          <th className={`${th} text-right`}>Premium</th>
          <th className={`${th} text-right`}>Implied vol</th>
          <th className={`${th} text-left`}>Tag</th>
        </tr>
      </thead>
      <tbody>
        {cf.orders.slice(0, 60).map(o => (
          <tr key={o.id} className="border-b border-borderSubtle/30 last:border-0 hover:bg-ink/[0.02]">
            <td className={`${td} text-textSecondary`}>{o.time}</td>
            <td className={`${td} text-right text-textPrimary`}>${o.price.toFixed(2)}</td>
            <td className={`${td} text-right text-textPrimary`}>{o.size.toLocaleString()}</td>
            <td className={`${td} ${o.side === 'ASK' ? 'text-bull' : o.side === 'BID' ? 'text-bear' : 'text-textMuted'}`}>
              {o.side === 'ASK' ? 'Paid offer' : o.side === 'BID' ? 'Hit bid' : 'Mid'}
            </td>
            <td className={`${td} text-right ${o.premium >= 250_000 ? 'text-textPrimary font-semibold' : 'text-textSecondary'}`}>
              {fmtUsd(o.premium)}
            </td>
            <td className={`${td} text-right text-textSecondary`}>{o.iv.toFixed(1)}%</td>
            <td className={`${td} text-textMuted`}>
              {o.sweep && <span className="text-warn font-semibold mr-1.5">Sweep</span>}
              {o.multiLeg ? 'Spread leg' : 'Single leg'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/** Is this session actually unusual for this contract, or is this just how it
    trades? The verdict chip above answers; the latest row wears the selection
    edge so the eye lands where the claim is. */
const HistoryTable = ({ rows, unusual }: { rows: VolOiDay[]; unusual: boolean }) => {
  /* A CAPPED SCROLLER, exactly like the orders table beside it.
     This used to render 8 rows with a "show all N sessions" button — the right
     instinct (a 1M window carries ~21 sessions and a tower is unreadable) with
     the wrong mechanism: it made the two tabs different heights, so switching
     between them lurched, and it solved by paging a problem the orders table
     had already solved by scrolling. One grammar now: every session is here,
     the box is the same size either way, and the swap is a pure cross-fade. */
  const visible = rows;
  return (
  <div className="border border-borderSubtle rounded-md overflow-hidden max-h-[240px] overflow-y-auto">
    <table className="w-full border-collapse">
      <thead className="sticky top-0 z-10">
        <tr className="bg-inset">
          <th className={`${th} text-left`}>Date</th>
          <th className={`${th} text-right`}>Volume</th>
          <th className={`${th} text-right`}>Open int.</th>
          <th className={`${th} text-right`}>OI change</th>
          <th className={`${th} text-right`}>Close</th>
          <th className={`${th} text-right`}>Avg</th>
          <th className={`${th} text-left`}>Through the day</th>
          <th className={`${th} text-left`}>Bid vs ask</th>
          <th className={`${th} text-right`}>Implied vol</th>
          <th className={`${th} text-right`}>Swept</th>
          <th className={`${th} text-right`}>Multi-leg</th>
          <th className={`${th} text-right`}>Premium</th>
          <th className={`${th} text-right`}>Share</th>
        </tr>
      </thead>
      <tbody>
        {visible.map((d, i) => (
          <tr
            key={d.date}
            className={`border-b border-borderSubtle/30 last:border-0 hover:bg-ink/[0.02] ${
              /* Holographic silver, not lime (Noah, 2026-08-30): the latest
                 row is WHERE YOU ARE, and silver is that ink everywhere. */
              i === 0 ? 'shadow-[inset_2px_0_0_0_rgba(199,211,232,0.7)]' : ''
            }`}
          >
            <td className={`${td} text-textSecondary whitespace-nowrap`}>
              {d.date}
              {i === 0 && <span className="ml-1.5 text-silver">latest</span>}
            </td>
            <td className={`${td} text-right ${i === 0 && unusual ? 'text-warn font-semibold' : 'text-textPrimary'}`}>{num(d.vol)}</td>
            <td className={`${td} text-right text-textSecondary`}>{num(d.oi)}</td>
            <td className={`${td} text-right ${d.oiChangePct >= 0 ? 'text-bull' : 'text-bear'}`}>
              {d.oiChangePct >= 0 ? '+' : ''}
              {fixed(d.oiChangePct, 1)}%
            </td>
            <td className={`${td} text-right text-textSecondary`}>${fixed(d.close)}</td>
            <td className={`${td} text-right text-textSecondary`}>${fixed(d.avg)}</td>
            <td className="px-2 py-1.5">
              <Spark values={d.intraday} />
            </td>
            <td className="px-2 py-1.5">
              <span className="flex h-[3px] w-20 rounded-full overflow-hidden bg-ink/[0.06]">
                <span className="h-full bg-bear/70" style={{ width: `${d.bidPct}%` }} />
                <span className="h-full bg-bull/80" style={{ width: `${100 - d.bidPct}%` }} />
              </span>
            </td>
            <td className={`${td} text-right text-textSecondary`}>{fixed(d.iv, 1)}%</td>
            <td className={`${td} text-right ${d.sweepPct >= 50 ? 'text-warn' : 'text-textSecondary'}`}>{d.sweepPct}%</td>
            <td className={`${td} text-right text-textSecondary`}>{d.multiPct}%</td>
            <td className={`${td} text-right text-textPrimary`}>{usd(d.totalPrem)}</td>
            <td className={`${td} text-right text-textSecondary`}>{fixed(d.shareOfTotalPct, 1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  );
};

export default PrintDrilldown;
