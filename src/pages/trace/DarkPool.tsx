/*
==================================================
  SLAYER TERMINAL - DARK POOL (Trace)

  Its own page at last (Noah, 2026-09-12: "make a
  dark pool page in trace" — the crosses left the
  tape's side rail the same day). Two boxes in the
  house grammar:

  THE NAME'S DARK POOL — every off-exchange print
  on the picked name with the read attached: not
  "a block traded" but who is most likely behind
  it (accumulation, distribution, hedge flow,
  rotation), how sure the classifier is, and the
  liquidity SHELVES the prints left — support,
  resistance, a pivot — with how many times price
  has already bounced off each. A shelf cuts the
  grid to the prints that landed on it; a row puts
  the print's whole read on the card beside the
  shelves.

  WHERE THE DARK MONEY WENT — the market-wide
  leaders: off-exchange dollars by sector and by
  name, the heaviest first. A name is a door: it
  goes on the box above.

  The engine is data/darkpool.ts, unchanged —
  deterministic per name and session day, so a real
  feed swaps in without touching this page.
==================================================
*/

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMarketData } from '../../context/MarketDataContext';
import { buildDarkPoolLeaders, buildDarkPoolView } from '../../data/darkpool';
import { fmtUsd } from '../../data/gex';
import type { DarkLeaderRow, DarkPoolIntent, DarkPoolLevel, DarkPoolPrint, DarkSector, LevelRole } from '../../types/darkpool';
import type { Column } from '../../components/ui/DataTable';
import CompanyLogo from '../../components/ui/CompanyLogo';
import RichRead from '../../components/ui/RichRead';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import ColumnChooser, { useHiddenColumns } from '../../components/trace/ColumnChooser';
import { earnMarks, weightInk } from '../../components/trace/earnedInk';
import { LiveHold, useHold } from '../../components/trace/LiveHold';
import ReadDoor from '../../components/trace/ReadDoor';
import { SectorName } from '../../components/trace/SectorMark';
import TraceBox, { Champion, Fact, TraceGrid } from '../../components/trace/TraceBox';
import { DarkPoolGuide } from '../../components/trace/TraceGuide';

const num = (v: number) => v.toLocaleString('en-US');
const signedPct = (v: number, dp = 2) => `${v >= 0 ? '+' : ''}${v.toFixed(dp)}%`;

/* ---- the cards ------------------------------------------------------------------ */

type IntentCut = 'ALL' | DarkPoolIntent;
const INTENT_OPTIONS: DropdownOption<IntentCut>[] = [
  { value: 'ALL', label: 'Every read', hint: 'Accumulation, distribution, hedge flow and rotation' },
  { value: 'ACCUMULATION', label: 'Accumulation', hint: 'Size bought on weakness — someone building' },
  { value: 'DISTRIBUTION', label: 'Distribution', hint: 'Size sold into strength — someone leaving' },
  { value: 'HEDGE FLOW', label: 'Hedge flow', hint: 'Printed on an options shelf — a desk hedging' },
  { value: 'ROTATION', label: 'Rotation', hint: 'Routine off-exchange rotation, no signal alone' },
];
type SizeKey = '0' | '25000000' | '100000000' | '250000000';
const SIZE_OPTIONS: DropdownOption<SizeKey>[] = [
  { value: '0', label: 'Any size', hint: 'Every cross' },
  { value: '25000000', label: '≥$25M', hint: 'Only crosses of twenty-five million and up' },
  { value: '100000000', label: '≥$100M', hint: 'Only crosses of a hundred million and up' },
  { value: '250000000', label: '≥$250M', hint: 'The blocks' },
];
type WhereKey = 'ANY' | 'SHELF' | 'OPEN';
const WHERE_OPTIONS: DropdownOption<WhereKey>[] = [
  { value: 'ANY', label: 'Anywhere', hint: 'On a shelf or between them' },
  { value: 'SHELF', label: 'On a shelf', hint: 'Crosses that landed on a tracked liquidity shelf' },
  { value: 'OPEN', label: 'Between shelves', hint: 'Crosses that printed away from the shelves' },
];

/** The read's ink: a verdict wears its direction, a hedge the warning, rotation the plain ink */
const INTENT_INK: Record<DarkPoolIntent, string> = {
  ACCUMULATION: 'text-bull',
  DISTRIBUTION: 'text-bear',
  'HEDGE FLOW': 'text-warn',
  ROTATION: 'text-textPrimary',
};
const INTENT_WORD: Record<DarkPoolIntent, string> = {
  ACCUMULATION: 'Accumulation',
  DISTRIBUTION: 'Distribution',
  'HEDGE FLOW': 'Hedge flow',
  ROTATION: 'Rotation',
};
const ROLE_INK: Record<LevelRole, { text: string; bar: string; border: string }> = {
  SUPPORT: { text: 'text-bull', bar: 'bg-bull/70', border: 'border-bull/40' },
  RESISTANCE: { text: 'text-bear', bar: 'bg-bear/70', border: 'border-bear/40' },
  PIVOT: { text: 'text-warn', bar: 'bg-warn/70', border: 'border-warn/40' },
};
const ROLE_WORD: Record<LevelRole, string> = { SUPPORT: 'Support', RESISTANCE: 'Resistance', PIVOT: 'Pivot' };
const POSTURE_INK = { ACCUMULATING: 'text-bull', DISTRIBUTING: 'text-bear', BALANCED: 'text-textPrimary' } as const;
const POSTURE_WORD = { ACCUMULATING: 'Accumulating', DISTRIBUTING: 'Distributing', BALANCED: 'Balanced' } as const;

/** A print sits on a shelf when it printed within 0.15% of it */
const onShelf = (p: DarkPoolPrint, l: DarkPoolLevel) => Math.abs(p.price - l.price) / l.price < 0.0015;

const WIDTHS: Record<string, number> = { time: 64, price: 84, vs: 80, size: 88, notional: 92, venue: 100, shelf: 84, intent: 112, conviction: 108 };
const FLEXES: Record<string, number> = { read: 1 };
const TOOLTIPS: Record<string, string> = {
  vs: 'Where the cross printed against the spot, as a percent',
  notional: 'Shares times the print price — the dollars that changed hands',
  shelf: 'Whether the cross landed on one of the session’s tracked liquidity shelves',
  intent: 'What the print is most likely doing — the read, not just the tape line',
  conviction: 'How sure the classifier is of the read',
  read: 'The read in one line — what it means for the level it printed at',
};

/** The classifier's certainty as a bar and its number — the tape's conviction cell, one-sided */
const ConvictionCell = ({ value, ink }: { value: number; ink: string }) => (
  <span className="inline-flex items-center gap-2">
    <span className="relative w-14 h-[3px] rounded-full bg-ink/[0.07]">
      <span className={`absolute inset-y-0 left-0 rounded-full ${ink === 'text-bull' ? 'bg-bull/80' : ink === 'text-bear' ? 'bg-bear/80' : ink === 'text-warn' ? 'bg-warn/80' : 'bg-ink/45'}`} style={{ width: `${value}%` }} />
    </span>
    <span className="font-mono text-[11px] tnum text-textPrimary">{value}%</span>
  </span>
);

/* ---- the leaders' cards ------------------------------------------------------------ */

interface LeaderRow extends DarkLeaderRow {
  sector: string;
  /** The sector's share of the market's dark tape */
  sectorSharePct: number;
}
const LEADER_WIDTHS: Record<string, number> = { ticker: 112, sector: 190, price: 104, notional: 112, share: 150, pctAvg: 112, size: 110 };
const LEADER_TOOLTIPS: Record<string, string> = {
  notional: 'Dark-pool dollars on the name today',
  share: "The name's share of its sector's dark dollars",
  pctAvg: "Today's dark volume against the name's average daily volume — past 100% the whole average day printed off-exchange",
  size: 'Shares printed off-exchange today',
};

const DarkPool = () => {
  const { marketData, activeTicker, changeTicker } = useMarketData();
  const [intent, setIntent] = useState<IntentCut>('ALL');
  const [sizeKey, setSizeKey] = useState<SizeKey>('0');
  const [where, setWhere] = useState<WhereKey>('ANY');
  const [shelfSel, setShelfSel] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [sectorCut, setSectorCut] = useState<string>('ALL');

  /* THE NAME'S VIEW — rebuilt on the tick (the shelves' defence count reads the
     session's own price path); the shared hold freezes it with the tick. */
  const liveView = useMemo(() => (marketData ? buildDarkPoolView(marketData) : null), [marketData]);
  const hold = useHold(useMemo(() => ({ view: liveView, tick: marketData }), [liveView, marketData]), activeTicker);
  const { view } = hold.value;

  /* A new name: the shelf and the open print belong to the old one */
  useEffect(() => {
    setShelfSel(null);
    setOpenId(null);
  }, [activeTicker]);

  const levels = useMemo(() => (view ? [...view.levels].sort((a, b) => b.price - a.price) : []), [view]);
  const shelf = shelfSel != null ? levels.find(l => l.price === shelfSel) ?? null : null;

  const rows = useMemo(() => {
    if (!view) return [];
    const min = Number(sizeKey);
    return view.prints.filter(
      p =>
        (intent === 'ALL' || p.intent === intent) &&
        p.notional >= min &&
        (where === 'ANY' || (where === 'SHELF' ? p.atLevel : !p.atLevel)) &&
        (!shelf || onShelf(p, shelf))
    );
  }, [view, intent, sizeKey, where, shelf]);
  const marks = useMemo(() => ({ notional: earnMarks(rows, p => p.notional), size: earnMarks(rows, p => p.size) }), [rows]);
  const open = openId != null ? view?.prints.find(p => p.id === openId) ?? null : null;

  const facts = useMemo(() => {
    let acc = 0;
    let dist = 0;
    for (const p of rows) {
      if (p.intent === 'ACCUMULATION') acc += p.notional;
      if (p.intent === 'DISTRIBUTION') dist += p.notional;
    }
    const strongest = levels.reduce<DarkPoolLevel | null>((a, l) => (a === null || l.notional > a.notional ? l : a), null);
    const support = levels.filter(l => l.role === 'SUPPORT').length;
    const resistance = levels.filter(l => l.role === 'RESISTANCE').length;
    return { acc, dist, strongest, support, resistance, dollars: rows.reduce((a, p) => a + p.notional, 0) };
  }, [rows, levels]);

  const keyOf = useCallback((p: DarkPoolPrint) => String(p.id), []);
  const openRow = useCallback((p: DarkPoolPrint) => setOpenId(id => (id === p.id ? null : p.id)), []);

  /* THE SENTENCE — the engine's posture note, with the largest cross as a door */
  const read = useMemo<ReactNode>(() => {
    if (!view) return <RichRead text="The dark pool is still waking up." />;
    const L = view.largest;
    return (
      <>
        <RichRead text={`${view.postureNote} `} />
        {L && (
          <>
            <RichRead text="Largest cross " />
            <ReadDoor onOpen={() => setOpenId(L.id)} title="Put the print on the card">
              {num(L.size)} at ${L.price.toFixed(2)}
            </ReadDoor>
            <RichRead text={` for [[${fmtUsd(L.notional)}]] on ${L.venue} — ${INTENT_WORD[L.intent].toLowerCase()} at ${L.conviction}% conviction.`} />
          </>
        )}
      </>
    );
  }, [view]);

  const columns = useMemo<Column<DarkPoolPrint>[]>(
    () => [
      { key: 'time', header: 'Time', sortValue: p => p.time, render: p => <span className="text-[11px] text-textPrimary tnum">{p.time}</span> },
      { key: 'price', header: 'Price', align: 'right', sortValue: p => p.price, render: p => <span className="text-textPrimary font-semibold">${p.price.toFixed(2)}</span> },
      {
        key: 'vs',
        header: 'vs spot',
        align: 'right',
        sortValue: p => p.vsSpotPct,
        render: p => <span className={Math.abs(p.vsSpotPct) < 0.05 ? 'text-textPrimary' : p.vsSpotPct > 0 ? 'text-bull' : 'text-bear'}>{signedPct(p.vsSpotPct)}</span>,
      },
      { key: 'size', header: 'Shares', align: 'right', sortValue: p => p.size, render: p => <span className={weightInk(p.size, marks.size)}>{num(p.size)}</span> },
      { key: 'notional', header: 'Dollars', align: 'right', sortValue: p => p.notional, render: p => <span className={weightInk(p.notional, marks.notional)}>{fmtUsd(p.notional)}</span> },
      { key: 'venue', header: 'Venue', sortValue: p => p.venue, render: p => <span className="text-textPrimary">{p.venue}</span> },
      {
        key: 'shelf',
        header: 'Shelf',
        sortValue: p => (p.atLevel ? 1 : 0),
        render: p => (p.atLevel ? <span className="text-[10px] font-semibold text-select">On a shelf</span> : <span className="text-[10px] text-textSecondary">Between</span>),
      },
      { key: 'intent', header: 'Read', sortValue: p => p.intent, render: p => <span className={`text-[10px] font-semibold uppercase tracking-wider ${INTENT_INK[p.intent]}`}>{INTENT_WORD[p.intent]}</span> },
      { key: 'conviction', header: 'Conviction', sortValue: p => p.conviction, render: p => <ConvictionCell value={p.conviction} ink={INTENT_INK[p.intent]} /> },
      { key: 'read', header: 'What it says', render: p => <span className="text-[11px] text-textPrimary block truncate" title={p.read}>{p.read}</span> },
    ],
    [marks]
  );
  const { hidden, toggle, showAll, hideAll } = useHiddenColumns('slayer_darkpool_cols');
  const chooserCols = useMemo(() => columns.map(c => ({ key: c.key, label: typeof c.header === 'string' ? c.header : c.key })), [columns]);

  /* ---- THE LEADERS — the market's dark tape by sector and name --------------------- */
  const leaders = useMemo(
    () => buildDarkPoolLeaders(),
    // prices on the sim-tracked names move with the tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [marketData]
  );
  const sectorOptions = useMemo<DropdownOption<string>[]>(
    () => [{ value: 'ALL', label: 'Every sector', hint: 'The whole dark tape' }, ...leaders.sectors.map(s => ({ value: s.sector, label: s.sector, hint: `${s.sharePct.toFixed(0)}% of the dark tape · ${fmtUsd(s.notional)}` }))],
    [leaders]
  );
  const leaderRows = useMemo<LeaderRow[]>(() => {
    const out: LeaderRow[] = [];
    for (const s of leaders.sectors) {
      if (sectorCut !== 'ALL' && s.sector !== sectorCut) continue;
      for (const r of s.rows) out.push({ ...r, sector: s.sector, sectorSharePct: s.sharePct });
    }
    return out.sort((a, b) => b.notional - a.notional);
  }, [leaders, sectorCut]);
  const leaderMarks = useMemo(() => ({ notional: earnMarks(leaderRows, r => r.notional), pctAvg: earnMarks(leaderRows, r => r.pctAvgVol), size: earnMarks(leaderRows, r => r.size) }), [leaderRows]);
  const sectorMax = useMemo(() => new Map(leaders.sectors.map(s => [s.sector, s.rows[0]?.notional ?? 1])), [leaders]);
  const heaviest: DarkSector | null = leaders.sectors[0] ?? null;
  const loudest = leaderRows[0] ?? null;
  const hottest = useMemo(() => leaderRows.reduce<LeaderRow | null>((a, r) => (a === null || r.pctAvgVol > a.pctAvgVol ? r : a), null), [leaderRows]);
  const leadersRead = useMemo<ReactNode>(() => {
    if (!heaviest) return <RichRead text="The dark tape is still filling." />;
    const names = heaviest.rows.slice(0, 3).map(r => r.ticker);
    return (
      <>
        <RichRead text={`${heaviest.sector} carries [[${heaviest.sharePct.toFixed(0)}%]] of the dark tape at ${fmtUsd(heaviest.notional)} — `} />
        {names.map((t, i) => (
          <span key={t}>
            <ReadDoor onOpen={() => pickName(t)} title={`Put ${t} on the page`}>
              {t}
            </ReadDoor>
            {i < names.length - 1 ? <RichRead text={i === names.length - 2 ? ' and ' : ', '} /> : null}
          </span>
        ))}
        <RichRead text={` lead it. ${fmtUsd(leaders.totalNotional)} printed off-exchange across ${num(leaders.totalPrints)} crosses today.`} />
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heaviest, leaders]);

  const topRef = useRef<HTMLDivElement | null>(null);
  const pickName = (t: string) => {
    changeTicker(t);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const leaderKey = useCallback((r: LeaderRow) => r.ticker, []);
  const openLeader = useCallback((r: LeaderRow) => pickName(r.ticker), []); // eslint-disable-line react-hooks/exhaustive-deps

  const leaderColumns = useMemo<Column<LeaderRow>[]>(
    () => [
      {
        key: 'ticker',
        header: 'Ticker',
        sortValue: r => r.ticker,
        render: r => (
          <span className="inline-flex items-center gap-1.5">
            <CompanyLogo ticker={r.ticker} size={15} />
            <span className={`font-bold ${r.ticker === activeTicker ? 'text-select' : 'text-textPrimary'}`}>{r.ticker}</span>
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
          <span className="text-textPrimary">
            ${r.price.toFixed(2)} <span className={`text-[10px] ${r.dirUp ? 'text-bull' : 'text-bear'}`}>{r.dirUp ? '▲' : '▼'}</span>
          </span>
        ),
      },
      { key: 'notional', header: 'Dark $', align: 'right', sortValue: r => r.notional, render: r => <span className={weightInk(r.notional, leaderMarks.notional)}>{fmtUsd(r.notional)}</span> },
      {
        key: 'share',
        header: 'Of its sector',
        sortValue: r => r.notional / (sectorMax.get(r.sector) ?? 1),
        render: r => {
          const w = Math.round((r.notional / (sectorMax.get(r.sector) ?? 1)) * 100);
          return (
            <span className="inline-flex items-center gap-2 w-full">
              <span className="relative flex-1 h-[4px] rounded-full bg-ink/[0.06]">
                <span className="absolute inset-y-0 left-0 rounded-full bg-ink/45" style={{ width: `${w}%` }} />
              </span>
              <span className="font-mono text-[10px] tnum text-textPrimary w-9 text-right">{w}%</span>
            </span>
          );
        },
      },
      {
        key: 'pctAvg',
        header: '% avg vol',
        align: 'right',
        sortValue: r => r.pctAvgVol,
        render: r => <span className={r.pctAvgVol >= 100 ? 'font-bold text-warn' : weightInk(r.pctAvgVol, leaderMarks.pctAvg)}>{r.pctAvgVol.toFixed(0)}%</span>,
      },
      { key: 'size', header: 'Shares', align: 'right', sortValue: r => r.size, render: r => <span className={weightInk(r.size, leaderMarks.size)}>{num(r.size)}</span> },
    ],
    [leaderMarks, sectorMax, activeTicker]
  );

  const ticker = view?.ticker ?? activeTicker;

  return (
    <>
      <div ref={topRef} />
      <TraceBox
        title="The dark pool"
        sub={`${ticker}'s off-exchange crosses with the read attached — who is most likely behind each print, and the liquidity shelves they left · a shelf cuts the grid to it, a row puts the print on the card`}
        testId="dark-pool"
        data={{ ticker, prints: rows.length, intent, shelf: shelf ? shelf.price : 'all' }}
        guide={{ title: 'How to read the dark pool', door: 'What a cross, a shelf and the read mean', body: <DarkPoolGuide />, testId: 'dark-pool-guide', open: guideOpen, onOpen: setGuideOpen }}
        facts={
          <>
            <Fact label="Name" testId="name">
              <span className="inline-flex items-center gap-1.5">
                <CompanyLogo ticker={ticker} size={15} />
                <span className="font-bold">{ticker}</span>
                {view && <span className="text-textPrimary">${view.spot.toFixed(2)}</span>}
              </span>
            </Fact>
            <Fact label="Off-exchange" testId="share" title="Share of the session's volume that printed off-exchange">
              {view ? `${view.dpSharePct.toFixed(0)}%` : '—'} <span className="text-textSecondary">of volume</span>
            </Fact>
            <Fact label="Posture" testId="posture" title="Net accumulation against distribution across the sized prints">
              {view ? (
                <>
                  <span className={POSTURE_INK[view.posture]}>{POSTURE_WORD[view.posture]}</span> <span className="text-textSecondary">{signedPct(view.netPosturePct, 0)}</span>
                </>
              ) : (
                '—'
              )}
            </Fact>
            <Fact label="On this cut" testId="cut">
              {fmtUsd(facts.dollars)} <span className="text-textSecondary">· {rows.length} crosses</span>
            </Fact>
            <Fact label="Building · leaving" testId="lean" title="Dollars read as accumulation against dollars read as distribution">
              <span className="text-bull">{fmtUsd(facts.acc)}</span> <span className="text-textSecondary">·</span> <span className="text-bear">{fmtUsd(facts.dist)}</span>
            </Fact>
            {facts.strongest && (
              <Champion label="Strongest shelf" ink={facts.strongest.role === 'SUPPORT' ? 'bull' : facts.strongest.role === 'RESISTANCE' ? 'bear' : 'warn'} onOpen={() => setShelfSel(s => (s === facts.strongest!.price ? null : facts.strongest!.price))} testId="shelf">
                ${facts.strongest.price.toFixed(2)} · {fmtUsd(facts.strongest.notional)}
              </Champion>
            )}
            {view?.largest && (
              <Champion label="Largest cross" ink="supreme" onOpen={() => setOpenId(view.largest!.id)} testId="largest">
                {num(view.largest.size)} @ ${view.largest.price.toFixed(2)} · {fmtUsd(view.largest.notional)}
              </Champion>
            )}
          </>
        }
        controls={
          <>
            <LiveHold paused={hold.paused} onToggle={hold.toggle} heldAt={hold.heldAt} />
            <DropdownSelect label="Read" value={intent} options={INTENT_OPTIONS} onChange={setIntent} title="Which reads to show" testId="dark-pool-read" />
            <DropdownSelect label="Size" value={sizeKey} options={SIZE_OPTIONS} onChange={setSizeKey} title="The smallest cross shown" testId="dark-pool-size" />
            <DropdownSelect label="Where" value={where} options={WHERE_OPTIONS} onChange={setWhere} title="On a shelf, between them, or anywhere" testId="dark-pool-where" />
            {shelf && (
              <button
                type="button"
                onClick={() => setShelfSel(null)}
                title="Every shelf again"
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border font-mono text-[10px] uppercase tracking-wider ${ROLE_INK[shelf.role].border} ${ROLE_INK[shelf.role].text} bg-ink/[0.03] hover:bg-ink/[0.06] transition-colors`}
                data-dark-pool-shelf-chip
              >
                {ROLE_WORD[shelf.role]} ${shelf.price.toFixed(2)} <span aria-hidden>×</span>
              </button>
            )}
            <div className="ml-auto">
              <ColumnChooser columns={chooserCols} hidden={hidden} onToggle={toggle} onAll={showAll} onNone={() => hideAll(columns.map(c => c.key))} />
            </div>
          </>
        }
        sentence={read}
      >
        <div className="flex border-t border-borderSubtle" data-dark-pool-body>
          {/* THE SHELVES — the session's liquidity shelves, highest first, and the open print's card under them */}
          <aside className="w-[320px] shrink-0 border-r border-borderSubtle flex flex-col" data-dark-pool-shelves>
            <div className="px-4 pt-3 pb-2">
              <h3 className="text-[11px] font-semibold text-textPrimary leading-tight">The shelves</h3>
              <p className="text-[10px] text-textSecondary">Where the dark dollars rested · {facts.support} support · {facts.resistance} resistance</p>
            </div>
            <div className="flex flex-col">
              {levels.map(l => {
                const ink = ROLE_INK[l.role];
                const on = shelf?.price === l.price;
                return (
                  <button
                    key={l.price}
                    type="button"
                    onClick={() => setShelfSel(s => (s === l.price ? null : l.price))}
                    aria-pressed={on}
                    title={l.usage}
                    className={`w-full text-left px-4 py-2 border-t border-borderSubtle/60 transition-colors ${on ? 'bg-silver/[0.06] shadow-[inset_2px_0_0_0_rgba(199,211,232,0.7)]' : 'hover:bg-silver/[0.04]'}`}
                    data-dark-pool-shelf={l.price}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`font-mono text-[9px] font-semibold uppercase tracking-wider w-[74px] ${ink.text}`}>{ROLE_WORD[l.role]}</span>
                      <span className="font-mono text-[12px] font-bold tnum text-textPrimary">${l.price.toFixed(2)}</span>
                      <span className={`font-mono text-[10px] tnum ${l.distPct >= 0 ? 'text-bull' : 'text-bear'}`}>{signedPct(l.distPct)}</span>
                      <span className="ml-auto font-mono text-[11px] tnum text-textPrimary">{fmtUsd(l.notional)}</span>
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <span className="relative flex-1 h-[4px] rounded-full bg-ink/[0.06]">
                        <span className={`absolute inset-y-0 left-0 rounded-full ${ink.bar}`} style={{ width: `${Math.max(3, Math.round(l.sharePct))}%` }} />
                      </span>
                      <span className="font-mono text-[10px] tnum text-textPrimary whitespace-nowrap">
                        {l.sharePct.toFixed(0)}% · {l.prints} prints · {l.defended > 0 ? <span className="text-textPrimary font-semibold">defended {l.defended}×</span> : 'untested'}
                      </span>
                    </span>
                  </button>
                );
              })}
              {levels.length === 0 && <span className="block font-mono text-[10px] text-textSecondary uppercase tracking-widest py-6 text-center">Awaiting prints…</span>}
            </div>
            {shelf && (
              <p className="px-4 py-3 border-t border-borderSubtle text-[11px] leading-relaxed text-textPrimary" data-dark-pool-usage>
                {shelf.usage}
              </p>
            )}
            {/* THE CARD — the open print's whole read */}
            <div className="mt-auto border-t border-borderSubtle px-4 py-3" data-dark-pool-card={open ? open.id : 'none'}>
              {open ? (
                <>
                  <div className="flex items-center gap-2">
                    <CompanyLogo ticker={ticker} size={15} />
                    <span className="font-mono text-[12px] font-bold text-textPrimary">{ticker}</span>
                    <span className="font-mono text-[11px] tnum text-textPrimary">
                      {num(open.size)} @ ${open.price.toFixed(2)}
                    </span>
                    <span className="ml-auto font-mono text-[10px] tnum text-textPrimary">{open.time}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${INTENT_INK[open.intent]}`}>{INTENT_WORD[open.intent]}</span>
                    <ConvictionCell value={open.conviction} ink={INTENT_INK[open.intent]} />
                    <span className="font-mono text-[10px] text-textPrimary">{open.venue}</span>
                    <span className="font-mono text-[10px] tnum text-textPrimary">{fmtUsd(open.notional)}</span>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-textPrimary">{open.read}</p>
                  <p className="mt-1 text-[10px] text-textSecondary">
                    Printed {signedPct(open.vsSpotPct)} from the spot{open.atLevel ? ' · on a tracked shelf' : ' · between the shelves'}
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-textSecondary">A row puts the print's whole read here.</p>
              )}
            </div>
          </aside>
          {/* THE GRID */}
          <div className="flex-1 min-w-0">
            <TraceGrid rows={rows} columns={columns} hidden={hidden} widths={WIDTHS} flexes={FLEXES} tooltips={TOOLTIPS} rowKey={keyOf} onRowClick={openRow} selectedKey={openId != null ? String(openId) : null} autoHeight initialSort={{ key: 'time', dir: 'desc' }} emptyText={view ? 'No crosses on this cut' : 'Awaiting prints…'} testId="dark-pool" />
          </div>
        </div>
      </TraceBox>

      <TraceBox
        title="Where the dark money went"
        sub="Off-exchange dollars across the market, by sector and by name, the heaviest first · a name goes on the box above"
        testId="dark-pool-leaders"
        data={{ sector: sectorCut, names: leaderRows.length }}
        facts={
          <>
            <Fact label="Dark tape" testId="total">
              {fmtUsd(leaders.totalNotional)} <span className="text-textSecondary">· {num(leaders.totalPrints)} crosses</span>
            </Fact>
            <Fact label="Sectors" testId="sectors">
              {leaders.sectors.length} <span className="text-textSecondary">· {heaviest ? `${heaviest.sector} ${heaviest.sharePct.toFixed(0)}%` : '—'}</span>
            </Fact>
            {hottest && hottest !== loudest && (
              <Champion label="Most unusual" ink="warn" onOpen={() => pickName(hottest.ticker)} testId="unusual">
                {hottest.ticker} · {hottest.pctAvgVol.toFixed(0)}% of avg vol
              </Champion>
            )}
            {loudest && (
              <Champion label="Heaviest name" ink="supreme" onOpen={() => pickName(loudest.ticker)} testId="heaviest">
                {loudest.ticker} · {fmtUsd(loudest.notional)}
              </Champion>
            )}
          </>
        }
        controls={
          <>
            <DropdownSelect label="Sector" value={sectorCut} options={sectorOptions} onChange={setSectorCut} title="One sector, or the whole tape" testId="dark-pool-sector" />
            <span className="text-[10px] text-textSecondary">Updated {leaders.updated}</span>
          </>
        }
        sentence={leadersRead}
      >
        <TraceGrid rows={leaderRows} columns={leaderColumns} widths={LEADER_WIDTHS} tooltips={LEADER_TOOLTIPS} rowKey={leaderKey} onRowClick={openLeader} selectedKey={activeTicker} autoHeight emptyText="Nothing printed dark on this cut" testId="dark-pool-leaders" />
      </TraceBox>
    </>
  );
};

export default DarkPool;
