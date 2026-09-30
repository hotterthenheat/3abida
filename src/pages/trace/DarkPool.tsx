/*
==================================================
  SLAYER TERMINAL - DARK POOL (Trace)
  Off-exchange crosses with the read attached
  (2026-09-13; Noah, with his partner's two
  screenshots: "make this page in our own type
  design pattern. his placements are off"). Two
  boxes in the house grammar, read top to bottom:

    THE DARK POOL     the frame's name — the head's
                      facts and champions, the cards
                      that cut the crosses (Read ·
                      Size · Where), the sentence;
                      THE SHELVES as a board at the
                      left (the Net Flow board's
                      grammar — a shelf picked cuts
                      the grid to it) and THE GRID of
                      crosses beside it, growing with
                      its rows
    WHERE THE DARK    the market's dark tape by
    MONEY WENT        sector and by name, heaviest
                      first — a name goes on the box
                      above

  The engine (data/darkpool.ts) is the one the
  tape's rail already reads; nothing here computes
  a number of its own. The dark-pool feed stays on
  the Live Tape's rail as well.
==================================================
*/

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMarketData } from '../../context/MarketDataContext';
import Simulator from '../../core/simulator';
import { buildDarkPoolLeaders, buildDarkPoolView, gradeOfConviction, gradeOfPosture, POSTURE_WORD } from '../../data/darkpool';
import GradeMeter from '../../components/ui/GradeMeter';
import { fmtUsd } from '../../data/gex';
import type { DarkLeaderRow, DarkPoolIntent, DarkPoolLevel, DarkPoolPrint, LevelRole } from '../../types/darkpool';
import type { Column } from '../../components/ui/DataTable';
import CompanyLogo from '../../components/ui/CompanyLogo';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import RichRead from '../../components/ui/RichRead';
import ScopeChip from '../../components/ui/ScopeChip';
import ColumnChooser, { useHiddenColumns } from '../../components/trace/ColumnChooser';
import { earnMarks, weightInk } from '../../components/trace/earnedInk';
import { LiveHold, useHold } from '../../components/trace/LiveHold';
import ReadDoor from '../../components/trace/ReadDoor';
import { SectorName } from '../../components/trace/SectorMark';
import TraceBox, { Champion, Fact, TraceGrid } from '../../components/trace/TraceBox';
import { DarkPoolGuide } from '../../components/trace/TraceGuide';
import { DP_SHELF_H, DP_STRIP_HEAD_H, TracePageSkeleton } from './traceSkeletons';

const num = (v: number) => v.toLocaleString('en-US');
const signedPct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}%`;
const dirInk = (v: number) => (v > 0 ? 'text-bull' : v < 0 ? 'text-bear' : 'text-textMuted');

/* THE CARDS — the cuts as labelled cards (the walk, 2026-09-09 — never chip rows) */
type ReadCut = 'all' | DarkPoolIntent;
const READ_OPTIONS: DropdownOption<ReadCut>[] = [
  { value: 'all', label: 'Every read', hint: 'Every cross, whatever it is doing' },
  { value: 'ACCUMULATION', label: 'Accumulation', hint: 'Size bought on weakness — someone building', tone: 'bull' },
  { value: 'DISTRIBUTION', label: 'Distribution', hint: 'Size sold into strength — someone leaving', tone: 'bear' },
  { value: 'HEDGE FLOW', label: 'Hedge flow', hint: 'Printed on an options shelf — a desk hedging, not a bet' },
  { value: 'ROTATION', label: 'Rotation', hint: 'Routine off-exchange turnover — no signal by itself' },
];
type SizeCut = 'any' | 'sized';
const SIZE_OPTIONS: DropdownOption<SizeCut>[] = [
  { value: 'any', label: 'Any size', hint: 'Every cross' },
  { value: 'sized', label: 'Sized', hint: 'The top quarter by shares — the prints the reads are built on' },
];
/** Anywhere, on any shelf, between shelves, or at ONE shelf ("at:492.27") */
type WhereCut = 'anywhere' | 'shelf' | 'between' | `at:${string}`;
const WHERE_FIXED: DropdownOption<WhereCut>[] = [
  { value: 'anywhere', label: 'Anywhere', hint: 'Every cross, wherever it printed' },
  { value: 'shelf', label: 'On a shelf', hint: 'Crosses that landed on one of the session’s shelves' },
  { value: 'between', label: 'Between shelves', hint: 'Crosses that printed away from every shelf' },
];
const atShelf = (price: number): WhereCut => `at:${price.toFixed(2)}`;
const onShelf = (p: DarkPoolPrint, price: number) => Math.abs(p.price - price) / price < 0.001;

const ROLE_INK: Record<LevelRole, string> = { SUPPORT: 'text-bull', RESISTANCE: 'text-bear', PIVOT: 'text-textMuted' };
const ROLE_BAR: Record<LevelRole, string> = { SUPPORT: 'bg-bull/70', RESISTANCE: 'bg-bear/70', PIVOT: 'bg-ink/25' };
const ROLE_WORD: Record<LevelRole, string> = { SUPPORT: 'support', RESISTANCE: 'resistance', PIVOT: 'pivot' };
const INTENT_INK: Record<DarkPoolIntent, string> = { ACCUMULATION: 'text-bull', DISTRIBUTION: 'text-bear', 'HEDGE FLOW': 'text-warn', ROTATION: 'text-textMuted' };
const INTENT_BAR: Record<DarkPoolIntent, string> = { ACCUMULATION: 'bg-bull/80', DISTRIBUTION: 'bg-bear/80', 'HEDGE FLOW': 'bg-warn/80', ROTATION: 'bg-ink/25' };
const INTENT_WORD: Record<DarkPoolIntent, string> = { ACCUMULATION: 'accumulation', DISTRIBUTION: 'distribution', 'HEDGE FLOW': 'hedge flow', ROTATION: 'rotation' };

/** The read as a tag — the word in its ink, the house's uppercase mono */
const IntentTag = ({ intent }: { intent: DarkPoolIntent }) => <span className={`font-mono text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${INTENT_INK[intent]}`}>{intent}</span>;

/** How sure the read is — one of the four words over the four-step meter, both in the read's ink (the lean cell's shape).
    It was "71%" over a bar as long as the figure; no figure of ours is public (data/darkpool.ts gradeOfConviction). */
const ConvictionCell = ({ value, intent }: { value: number; intent: DarkPoolIntent }) => {
  const grade = gradeOfConviction(value);
  return (
    <span className="inline-flex flex-col items-end gap-[3px] w-16" data-conviction={grade}>
      <span className={`font-mono text-[9px] font-semibold leading-[14px] ${INTENT_INK[intent]}`}>{grade}</span>
      <GradeMeter grade={grade} fill={INTENT_BAR[intent]} thin className="w-16" />
    </span>
  );
};

const WIDTHS: Record<string, number> = { time: 64, price: 88, vs: 84, shares: 96, dollars: 96, venue: 108, shelf: 96, read: 128, conviction: 104 };
const TOOLTIPS: Record<string, string> = {
  vs: 'Where the cross printed against the market now',
  shelf: 'Whether the cross landed on one of the session’s shelves',
  read: 'What the cross is most likely doing',
  conviction: 'How sure the read is',
  says: 'The read in a sentence',
};
/* The sector and the share flex — the table fills its box (Noah, 2026-09-13: his sat half-width beside empty space) */
const LEADER_WIDTHS: Record<string, number> = { ticker: 140, price: 120, dark: 120, avg: 120, shares: 140 };
const LEADER_TOOLTIPS: Record<string, string> = {
  dark: 'Off-exchange dollars printed in the name today',
  share: 'Against the heaviest name in its sector',
  avg: 'Today’s dark volume against the name’s usual day — over 100% is unusual',
  shares: 'Shares printed off-exchange',
};

type LeaderRow = DarkLeaderRow & { sector: string; sectorMax: number };

/* THE BOX'S NAME IS THE SCOPE CHIP'S (Noah, 2026-09-13: "other sections of the website
   have the icon next to the ticker search — that should be the case for the entire
   Trace subpages"): the house's one control for WHICH NAME a surface reads, on the
   box's line — it FOLLOWS the frame until unlinked, then holds its own name (a leaders'
   row unlinks it onto that name); the shell's own picker stays hidden on every Trace
   page. Remembered across route changes within a session. */
let scopeMemory: string | null = null;

const DarkPool = () => {
  const { marketData, activeTicker, changeTicker } = useMarketData();
  const [scope, setScopeState] = useState<string | null>(scopeMemory);
  const setScope = (t: string | null) => {
    scopeMemory = t;
    setScopeState(t);
  };
  /* Follows the frame until the chip holds its own name */
  const name = scope ?? activeTicker;
  const [read, setRead] = useState<ReadCut>('all');
  const [size, setSize] = useState<SizeCut>('any');
  const [where, setWhere] = useState<WhereCut>('anywhere');
  const [selected, setSelected] = useState<string | null>(null);
  const [sector, setSector] = useState<string>('all');
  const [guideOpen, setGuideOpen] = useState(false);

  /* The picked name's snapshot: the frame's own when it is the frame's name, else a pure read of the simulator */
  const liveView = useMemo(() => {
    if (!marketData) return null;
    try {
      return buildDarkPoolView(marketData.ticker === name ? marketData : Simulator.snapshotFor(name));
    } catch {
      return null;
    }
  }, [marketData, name]);
  /* The shared hold (see LiveHold): the shelves, the crosses and the facts freeze together */
  const hold = useHold(useMemo(() => ({ view: liveView, tick: marketData }), [liveView, marketData]), name);
  const { view, tick } = hold.value;
  /* The market's dark tape — the structure is the day's, the prices live */
  const leaders = useMemo(() => buildDarkPoolLeaders(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  /* A shelf picked on one name means nothing on the next */
  useEffect(() => {
    setWhere('anywhere');
    setSelected(null);
  }, [name]);

  const levels = view?.levels ?? [];
  const pickedShelf = where.startsWith('at:') ? Number(where.slice(3)) : null;
  const whereOptions = useMemo<DropdownOption<WhereCut>[]>(
    () => [...WHERE_FIXED, ...levels.map(l => ({ value: atShelf(l.price), label: `$${l.price.toFixed(2)}`, hint: `${ROLE_WORD[l.role]} · ${fmtUsd(l.notional)} rested here` }))],
    [levels]
  );

  /* THE CUT — the three cards, on the crosses */
  const cut = useMemo(() => {
    if (!view) return [];
    return view.prints.filter(
      p =>
        (read === 'all' || p.intent === read) &&
        (size === 'any' || p.sized) &&
        (where === 'anywhere' || (where === 'shelf' ? p.atLevel : where === 'between' ? !p.atLevel : pickedShelf != null && onShelf(p, pickedShelf)))
    );
  }, [view, read, size, where, pickedShelf]);

  const keyOf = useCallback((p: DarkPoolPrint) => `${p.ticker}-${p.id}`, []);
  const marks = useMemo(() => ({ size: earnMarks(cut, p => p.size), notional: earnMarks(cut, p => p.notional) }), [cut]);

  const facts = useMemo(() => {
    const building = cut.reduce((a, p) => a + (p.intent === 'ACCUMULATION' ? p.notional : 0), 0);
    const leaving = cut.reduce((a, p) => a + (p.intent === 'DISTRIBUTION' ? p.notional : 0), 0);
    const dollars = cut.reduce((a, p) => a + p.notional, 0);
    const strongest = levels.reduce<DarkPoolLevel | null>((a, l) => (a === null || l.notional > a.notional ? l : a), null);
    const largest = cut.reduce<DarkPoolPrint | null>((a, p) => (a === null || p.notional > a.notional ? p : a), null);
    const support = levels.filter(l => l.role === 'SUPPORT').length;
    const resistance = levels.filter(l => l.role === 'RESISTANCE').length;
    return { building, leaving, dollars, strongest, largest, support, resistance, pivots: levels.length - support - resistance };
  }, [cut, levels]);
  const shelfMax = useMemo(() => Math.max(1, ...levels.map(l => l.notional)), [levels]);

  /* ---- the crosses' columns ---------------------------------------------------- */
  const columns = useMemo<Column<DarkPoolPrint>[]>(
    () => [
      { key: 'time', header: 'Time', sortValue: p => p.time, render: p => <span className="text-textSecondary">{p.time}</span> },
      { key: 'price', header: 'Price', align: 'right', sortValue: p => p.price, render: p => <span className="font-bold text-textPrimary">${p.price.toFixed(2)}</span> },
      { key: 'vs', header: 'vs spot', align: 'right', sortValue: p => p.vsSpotPct, render: p => <span className={dirInk(p.vsSpotPct)}>{signedPct(p.vsSpotPct)}</span> },
      { key: 'shares', header: 'Shares', align: 'right', sortValue: p => p.size, render: p => <span className={weightInk(p.size, marks.size)}>{num(p.size)}</span> },
      { key: 'dollars', header: 'Dollars', align: 'right', sortValue: p => p.notional, render: p => <span className={weightInk(p.notional, marks.notional)}>{fmtUsd(p.notional)}</span> },
      { key: 'venue', header: 'Venue', sortValue: p => p.venue, render: p => <span className="text-textSecondary">{p.venue}</span> },
      {
        key: 'shelf',
        header: 'Shelf',
        sortValue: p => (p.atLevel ? 1 : 0),
        render: p => (p.atLevel ? <span className="font-semibold text-textPrimary">On a shelf</span> : <span className="text-textMuted">Between</span>),
      },
      { key: 'read', header: 'Read', sortValue: p => p.intent, render: p => <IntentTag intent={p.intent} /> },
      { key: 'conviction', header: 'Conviction', align: 'right', sortValue: p => p.conviction, render: p => <ConvictionCell value={p.conviction} intent={p.intent} /> },
      {
        key: 'says',
        header: 'What it says',
        render: p => (
          <span className="block text-[11px] text-textSecondary truncate" title={p.read}>
            {p.read}
          </span>
        ),
      },
    ],
    [marks]
  );
  const { hidden, toggle, showAll, hideAll } = useHiddenColumns('slayer_darkpool_cols');
  const chooserCols = useMemo(() => columns.map(c => ({ key: c.key, label: typeof c.header === 'string' ? c.header : c.key })), [columns]);

  /* ---- the market's leaders -------------------------------------------------------- */
  const leaderRows = useMemo<LeaderRow[]>(() => {
    const out: LeaderRow[] = [];
    for (const s of leaders.sectors) {
      if (sector !== 'all' && s.sector !== sector) continue;
      const max = Math.max(1, ...s.rows.map(r => r.notional));
      for (const r of s.rows) out.push({ ...r, sector: s.sector, sectorMax: max });
    }
    return out.sort((x, y) => y.notional - x.notional);
  }, [leaders, sector]);
  const leaderMarks = useMemo(() => ({ dark: earnMarks(leaderRows, r => r.notional), shares: earnMarks(leaderRows, r => r.size) }), [leaderRows]);
  const unusual = useMemo(() => leaderRows.reduce<LeaderRow | null>((a, r) => (a === null || r.pctAvgVol > a.pctAvgVol ? r : a), null), [leaderRows]);
  const heaviest = leaderRows[0] ?? null;
  const topSector = leaders.sectors[0];
  const shownSector = sector === 'all' ? topSector : leaders.sectors.find(s => s.sector === sector) ?? topSector;
  const sectorOptions = useMemo<DropdownOption<string>[]>(
    () => [{ value: 'all', label: 'Every sector', hint: 'The whole dark tape, heaviest names first' }, ...leaders.sectors.map(s => ({ value: s.sector, label: s.sector, hint: `${fmtUsd(s.notional)} · ${s.sharePct.toFixed(0)}% of the dark tape` }))],
    [leaders]
  );
  const leaderKey = useCallback((r: LeaderRow) => r.ticker, []);
  /* A name goes on the box above — the chip steps off the frame onto it */
  const putAbove = useCallback((t: string) => {
    setScope(t);
    document.querySelector('[data-trace-box="dark-pool"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  const leaderColumns = useMemo<Column<LeaderRow>[]>(
    () => [
      {
        key: 'ticker',
        header: 'Ticker',
        sortValue: r => r.ticker,
        render: r => (
          <span className="inline-flex items-center gap-1.5">
            <CompanyLogo ticker={r.ticker} size={15} />
            <span className="font-bold text-textPrimary">{r.ticker}</span>
          </span>
        ),
      },
      { key: 'sector', header: 'Sector', sortValue: r => r.sector, render: r => <SectorName sector={r.sector} /> },
      {
        key: 'price',
        header: 'Price',
        align: 'right',
        sortValue: r => r.price,
        render: r => (
          <span className="text-textPrimary whitespace-nowrap">
            ${r.price.toFixed(2)} <span className={r.dirUp ? 'text-bull' : 'text-bear'}>{r.dirUp ? '▲' : '▼'}</span>
          </span>
        ),
      },
      { key: 'dark', header: 'Dark $', align: 'right', sortValue: r => r.notional, render: r => <span className={weightInk(r.notional, leaderMarks.dark)}>{fmtUsd(r.notional)}</span> },
      {
        key: 'share',
        header: 'Of its sector',
        align: 'right',
        sortValue: r => r.notional / r.sectorMax,
        render: r => {
          const pct = Math.round((r.notional / r.sectorMax) * 100);
          return (
            <span className="flex items-center gap-2 w-full max-w-[280px] ml-auto">
              <span className="flex flex-1 h-[3px] rounded-full overflow-hidden bg-ink/[0.06]">
                <span className="h-full rounded-full bg-silver/70" style={{ width: `${pct}%` }} />
              </span>
              <span className="font-mono text-[10px] tnum text-textSecondary w-9 text-right shrink-0">{pct}%</span>
            </span>
          );
        },
      },
      {
        key: 'avg',
        header: '% avg vol',
        align: 'right',
        sortValue: r => r.pctAvgVol,
        /* Over the name's usual day is UNUSUAL — the warn ink, the one thing on the row that is a signal */
        render: r => <span className={r.pctAvgVol >= 100 ? 'font-bold text-warn' : r.pctAvgVol >= 20 ? 'font-bold text-textPrimary' : 'text-textSecondary'}>{r.pctAvgVol >= 100 ? r.pctAvgVol.toFixed(0) : r.pctAvgVol.toFixed(1)}%</span>,
      },
      { key: 'shares', header: 'Shares', align: 'right', sortValue: r => r.size, render: r => <span className={weightInk(r.size, leaderMarks.shares)}>{num(r.size)}</span> },
    ],
    [leaderMarks]
  );
  const leaderChooser = useHiddenColumns('slayer_darkpool_leader_cols');
  const leaderChooserCols = useMemo(() => leaderColumns.map(c => ({ key: c.key, label: typeof c.header === 'string' ? c.header : c.key })), [leaderColumns]);

  if (!view) return <TracePageSkeleton pathname="/trace/dark-pool" />;

  /* ---- the sentences ------------------------------------------------------------ */
  const largest = facts.largest;
  const sentence: ReactNode = (
    <>
      <RichRead text={`${view.postureNote} `} />
      {largest ? (
        <>
          <RichRead text="Largest cross " />
          <ReadDoor onOpen={() => setSelected(keyOf(largest))} title="Mark the cross in the grid">
            {num(largest.size)} at ${largest.price.toFixed(2)}
          </ReadDoor>
          <RichRead text={` for ${fmtUsd(largest.notional)} on ${largest.venue} — ${INTENT_WORD[largest.intent]}, a ${gradeOfConviction(largest.conviction)} read.`} />
        </>
      ) : (
        <RichRead text="No cross on this cut." />
      )}
    </>
  );
  const lead = shownSector.rows.slice(0, 3);
  const leadersSentence: ReactNode = (
    <>
      <RichRead text={sector === 'all' ? `${shownSector.sector} carries ${shownSector.sharePct.toFixed(0)}% of the dark tape at ${fmtUsd(shownSector.notional)} — ` : `${shownSector.sector} printed ${fmtUsd(shownSector.notional)} off-exchange across ${num(shownSector.prints)} crosses, ${shownSector.sharePct.toFixed(0)}% of the dark tape — `} />
      {lead.map((r, i) => (
        <span key={r.ticker}>
          <ReadDoor onOpen={() => putAbove(r.ticker)} title={`Put ${r.ticker} on the box above`}>
            {r.ticker}
          </ReadDoor>
          {i < lead.length - 2 ? ', ' : i === lead.length - 2 ? ' and ' : ''}
        </span>
      ))}
      <RichRead text={` lead it. ${fmtUsd(leaders.totalNotional)} printed off-exchange across ${num(leaders.totalPrints)} crosses today.`} />
    </>
  );

  const shelfWords = `${facts.support} support · ${facts.resistance} resistance · ${facts.pivots} pivot${facts.pivots === 1 ? '' : 's'}`;

  return (
    <>
      {/* BOX 1 — THE DARK POOL: the frame's name */}
      <TraceBox
        title="The dark pool"
        sub={`${view.ticker}'s off-exchange crosses with the read attached — who is most likely behind each print, and the liquidity shelves they left · a shelf cuts the grid to it`}
        testId="dark-pool"
        data={{ ticker: view.ticker, read, size, where, crosses: cut.length }}
        guide={{ title: 'How to read the dark pool', door: 'What the shelves, the reads and the conviction mean', body: <DarkPoolGuide />, testId: 'dark-pool-guide', open: guideOpen, onOpen: setGuideOpen }}
        facts={
          <>
            <Fact label="Off-exchange" testId="share">
              {view.dpSharePct.toFixed(0)}% <span className="text-textMuted">of volume</span>
            </Fact>
            <Fact label="Posture" testId="posture">
              {/* which side leads, then how far it leans in the four words — never the figure (data/darkpool.ts gradeOfPosture).
                  Balanced stands alone: a poor lean is no lean. The steps wear the side's ink. */}
              <span
                className={`inline-flex items-center gap-2 ${view.posture === 'ACCUMULATING' ? 'text-bull' : view.posture === 'DISTRIBUTING' ? 'text-bear' : 'text-textSecondary'}`}
                data-posture-read={gradeOfPosture(view.netPosturePct)}
              >
                {POSTURE_WORD[view.posture]}
                <GradeMeter grade={gradeOfPosture(view.netPosturePct)} fill={view.posture === 'ACCUMULATING' ? 'bg-bull' : view.posture === 'DISTRIBUTING' ? 'bg-bear/80' : 'bg-ink/30'} className="w-12" />
                {view.posture !== 'BALANCED' && <span>{gradeOfPosture(view.netPosturePct)}</span>}
              </span>
            </Fact>
            <Fact label="On this cut" testId="cut">
              {fmtUsd(facts.dollars)} <span className="text-textMuted">· {cut.length} crosses</span>
            </Fact>
            <Fact label="Building · leaving" testId="sides">
              <span className="text-bull">{fmtUsd(facts.building)}</span> <span className="text-textMuted">·</span> <span className="text-bear">{fmtUsd(facts.leaving)}</span>
            </Fact>
            {facts.strongest && (
              <Champion label="Strongest shelf" ink={facts.strongest.role === 'SUPPORT' ? 'bull' : facts.strongest.role === 'RESISTANCE' ? 'bear' : 'warn'} onOpen={() => setWhere(atShelf(facts.strongest!.price))} testId="strongest">
                ${facts.strongest.price.toFixed(2)} · {fmtUsd(facts.strongest.notional)}
              </Champion>
            )}
            {largest && (
              <Champion label="Largest cross" ink="supreme" onOpen={() => setSelected(keyOf(largest))} testId="largest">
                {num(largest.size)} @ ${largest.price.toFixed(2)} · {fmtUsd(largest.notional)}
              </Champion>
            )}
          </>
        }
        controls={
          <>
            <LiveHold paused={hold.paused} onToggle={hold.toggle} heldAt={hold.heldAt} />
            {/* The name as the house's chip: follows the frame, or holds its own */}
            <ScopeChip ticker={name} linked={scope === null} quote onToggleLink={() => setScope(scope === null ? name : null)} onPick={next => (scope === null ? changeTicker(next) : setScope(next))} />
            <DropdownSelect label="Read" value={read} options={READ_OPTIONS} onChange={setRead} title="What the cross is doing" testId="dark-pool-read" />
            <DropdownSelect label="Size" value={size} options={SIZE_OPTIONS} onChange={setSize} title="Every cross, or the sized ones" testId="dark-pool-size" />
            <DropdownSelect label="Where" value={where} options={whereOptions} onChange={setWhere} title="Where the cross printed" testId="dark-pool-where" />
            <div className="ml-auto">
              <ColumnChooser columns={chooserCols} hidden={hidden} onToggle={toggle} onAll={showAll} onNone={() => hideAll(columns.map(c => c.key))} />
            </div>
          </>
        }
        sentence={sentence}
      >
        {/* THE SHELVES — one strip of six cells across the box, lowest price at the left the
            way a price axis reads, so nothing stands beside the grid empty (Noah, 2026-09-13:
            "completely empty sections that take up large spaces of the page"); a cell picked
            cuts the grid to its shelf */}
        <div className="border-t border-borderSubtle" data-dark-pool-shelves>
          <div className="px-5 flex items-center gap-2 border-b border-borderSubtle/60 font-mono text-[9px] uppercase tracking-widest" style={{ height: DP_STRIP_HEAD_H }}>
            <span className="text-textPrimary">The shelves</span>
            <span className="text-textMuted normal-case tracking-normal font-sans text-[10px]">· where the dark dollars rested · {shelfWords} · lowest at the left</span>
          </div>
          {/* Two across on a phone, three rows (the phone pass, 2026-09-13): six cells in 350px ran their figures into each other, and three still did */}
          <div className="grid grid-cols-2 sm:grid-cols-6 divide-x divide-borderSubtle/60 max-sm:divide-y">
            {[...levels]
              .sort((x, y) => x.price - y.price)
              .map(l => {
                const picked = pickedShelf != null && Math.abs(pickedShelf - l.price) < 0.005;
                return (
                  <button
                    key={l.price}
                    type="button"
                    onClick={() => setWhere(picked ? 'anywhere' : atShelf(l.price))}
                    title={l.usage}
                    className={`min-w-0 flex flex-col justify-center gap-1 px-4 text-left transition-colors ${picked ? 'bg-silver/[0.06] shadow-[inset_0_2px_0_0_rgba(199,211,232,0.7)]' : 'hover:bg-silver/[0.04]'}`}
                    style={{ height: DP_SHELF_H }}
                    data-dark-pool-shelf={l.price}
                    data-role={l.role}
                    data-picked={picked || undefined}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`font-mono text-[9px] font-semibold uppercase tracking-wider ${ROLE_INK[l.role]}`}>{l.role}</span>
                      <span className={`ml-auto font-mono text-[11px] tnum ${l.notional >= shelfMax ? 'font-bold text-textPrimary' : 'text-textSecondary'}`}>{fmtUsd(l.notional)}</span>
                    </span>
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-[13px] font-bold tnum text-textPrimary">${l.price.toFixed(2)}</span>
                      <span className={`font-mono text-[10px] tnum ${dirInk(l.distPct)}`}>{signedPct(l.distPct)}</span>
                      <span className="ml-auto font-mono text-[9px] text-textMuted tnum whitespace-nowrap">{l.prints} prints · defended {l.defended}×</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="relative h-0.5 flex-1 rounded-full bg-ink/[0.06] overflow-hidden">
                        <span className={`absolute left-0 top-0 h-full ${ROLE_BAR[l.role]}`} style={{ width: `${Math.round((l.notional / shelfMax) * 100)}%` }} />
                      </span>
                      <span className="font-mono text-[9px] text-textMuted tnum w-7 text-right">{l.sharePct.toFixed(0)}%</span>
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
        {/* THE CROSSES — the grid grows with its rows, the page scrolls */}
        <TraceGrid rows={cut} columns={columns} hidden={hidden} widths={WIDTHS} flexes={{ says: 2 }} tooltips={TOOLTIPS} rowKey={keyOf} onRowClick={p => setSelected(k => (k === keyOf(p) ? null : keyOf(p)))} selectedKey={selected} initialSort={{ key: 'time', dir: 'desc' }} autoHeight emptyText="No crosses on this cut" testId="dark-pool" />
      </TraceBox>

      {/* BOX 2 — WHERE THE DARK MONEY WENT: the market's dark tape by sector and by name */}
      <TraceBox
        title="Where the dark money went"
        sub="Off-exchange dollars across the market, by sector and by name, the heaviest first · a name goes on the box above"
        testId="dark-leaders"
        data={{ sector, names: leaderRows.length }}
        facts={
          <>
            <Fact label="Dark tape" testId="tape">
              {fmtUsd(leaders.totalNotional)} <span className="text-textMuted">· {num(leaders.totalPrints)} crosses</span>
            </Fact>
            <Fact label="Sectors" testId="sectors">
              {leaders.sectors.length} <span className="text-textMuted">· {topSector.sector} {topSector.sharePct.toFixed(0)}%</span>
            </Fact>
            {unusual && (
              <Champion label="Most unusual" ink="warn" onOpen={() => putAbove(unusual.ticker)} testId="unusual">
                {unusual.ticker} · {unusual.pctAvgVol.toFixed(0)}% of avg vol
              </Champion>
            )}
            {heaviest && (
              <Champion label="Heaviest name" ink="supreme" onOpen={() => putAbove(heaviest.ticker)} testId="heaviest">
                {heaviest.ticker} · {fmtUsd(heaviest.notional)}
              </Champion>
            )}
          </>
        }
        controls={
          <>
            <DropdownSelect label="Sector" value={sector} options={sectorOptions} onChange={setSector} title="One sector, or the whole tape" testId="dark-leaders-sector" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted whitespace-nowrap" data-dark-leaders-updated>
              updated {leaders.updated}
            </span>
            <div className="ml-auto">
              <ColumnChooser columns={leaderChooserCols} hidden={leaderChooser.hidden} onToggle={leaderChooser.toggle} onAll={leaderChooser.showAll} onNone={() => leaderChooser.hideAll(leaderColumns.map(c => c.key))} />
            </div>
          </>
        }
        sentence={leadersSentence}
      >
        <TraceGrid rows={leaderRows} columns={leaderColumns} hidden={leaderChooser.hidden} widths={LEADER_WIDTHS} tooltips={LEADER_TOOLTIPS} rowKey={leaderKey} onRowClick={r => putAbove(r.ticker)} selectedKey={name} initialSort={{ key: 'dark', dir: 'desc' }} autoHeight emptyText="Nothing printed dark in this sector today" testId="dark-leaders" />
      </TraceBox>
    </>
  );
};

export default DarkPool;
