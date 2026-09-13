/*
==================================================
  SLAYER TERMINAL - COMPARE (Trace)

  Two names side by side, on everything Trace
  knows (Noah, 2026-09-12: "a compare page that
  ties in net flow, 0dte, multi leg and everything
  else together — keep in mind our UI design
  system"). One box in the house grammar: the head
  with each name's lean and the champions between
  them, one line of cards (the hold, name A, "vs",
  name B, a swap, the expiry cut), the sentence —
  then the body in three bands:

  THE PANES — each name's session on its own
  NetFlowPane (the Net Flow page's pane in ticker
  mode), the money and clock cards shared so both
  panes always answer the same question; under
  each, the same-day money — the 0DTE desk's
  figures for that name.

  THE LEDGER — every fact the flow pages carry,
  A against B, one row per fact: net premium and
  its halves, the same-day money, the book (its
  contracts, volume, dollars, lean, sweeps, what
  was built today), the footprints (interest
  added and shed overnight), the structures
  (count, paid against collected, their dollars),
  the tape (prints, dollars, sweeps) and the
  calendar. The heavier side of each row is marked.

  THE CONTRACTS — each name's heaviest contracts
  (a row opens the card) and its structures.

  Everything reads the same cut book the other
  pages read, so a figure here is the figure there.
==================================================
*/

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeftRight, CalendarDays } from 'lucide-react';
import { useMarketData } from '../../context/MarketDataContext';
import Simulator from '../../core/simulator';
import { buildFlowBook, buildNetFlowView, buildSpreadFlow, SPREAD_KINDS, type MoneynessKey, type SpreadKind, type SpreadTrade } from '../../data/flowBook';
import { fmtUsd } from '../../data/gex';
import type { SleeveKey } from '../../types/compass';
import type { BookContract, FlowPrint } from '../../types/trace';
import CompanyLogo from '../../components/ui/CompanyLogo';
import ContractLabel from '../../components/ui/ContractLabel';
import RichRead from '../../components/ui/RichRead';
import ExpiryCalendar, { expiryWords } from '../../components/ui/ExpiryCalendar';
import BookDrill from '../../components/trace/BookDrill';
import { bookExpiryIso, useExpiryCut } from '../../components/trace/bookExpiry';
import FlowSearch from '../../components/trace/FlowSearch';
import LeanCell from '../../components/trace/LeanCell';
import { LiveHold, useHold } from '../../components/trace/LiveHold';
import NetFlowPane, { paneTimes } from '../../components/trace/NetFlowPane';
import ReadDoor from '../../components/trace/ReadDoor';
import TraceBox, { Champion, Fact } from '../../components/trace/TraceBox';
import { CompareGuide } from '../../components/trace/TraceGuide';
import { isoDate } from '../../core/calendar';

const num = (v: number) => v.toLocaleString('en-US');
const signed = (v: number) => `${v >= 0 ? '+' : ''}${fmtUsd(v)}`;
const dirInk = (v: number) => (v > 0 ? 'text-bull' : v < 0 ? 'text-bear' : 'text-textPrimary');

/** The Multi-Leg page's categorical dots — a shape is a kind, never a verdict */
const KIND_DOT: Record<SpreadKind, string> = {
  vertical: '#7EA6F0',
  condor: '#9B8FE8',
  butterfly: '#E8C468',
  straddle: '#6ECFC4',
  strangle: '#E89AC0',
  calendar: '#E0D080',
  ratio: '#93B87A',
};
const KIND_LABEL = Object.fromEntries(SPREAD_KINDS.map(k => [k.key, k.label])) as Record<SpreadKind, string>;

/* ---- one name's whole account ------------------------------------------------ */

interface Side {
  ticker: string;
  spot: number;
  rows: BookContract[];
  net: number;
  netCall: number;
  netPut: number;
  /** the same-day money */
  odteNet: number;
  odteCall: number;
  odtePut: number;
  odteVol: number;
  odteCount: number;
  count: number;
  volume: number;
  premium: number;
  callSharePct: number;
  askPct: number;
  sweepPct: number;
  iv: number;
  builtToday: number;
  oiAdded: number;
  oiShed: number;
  structures: SpreadTrade[];
  debit: number;
  credit: number;
  structurePrem: number;
  prints: FlowPrint[];
  tapePrem: number;
  tapeSweeps: number;
  earnDays: number | null;
  heaviest: BookContract[];
}

function account(ticker: string, rows: BookContract[], trades: SpreadTrade[], tape: FlowPrint[], nowSec: number): Side {
  const own = rows.filter(r => r.ticker === ticker);
  const day = buildNetFlowView(own, 'all', 'all', [nowSec], Infinity, ticker);
  const odte = buildNetFlowView(own, 'all', 'all', [nowSec], 1, ticker);
  const volume = own.reduce((a, r) => a + r.volume, 0) || 0;
  const premium = own.reduce((a, r) => a + r.premium, 0);
  const callPrem = own.reduce((a, r) => a + (r.right === 'C' ? r.premium : 0), 0);
  const w = (pick: (r: BookContract) => number) => (volume > 0 ? own.reduce((a, r) => a + pick(r) * r.volume, 0) / volume : 0);
  const structures = trades.filter(t => t.ticker === ticker);
  const prints = tape.filter(p => p.ticker === ticker);
  const earn = own.map(r => r.earnDays).filter((d): d is number => d != null);
  return {
    ticker,
    spot: own[0]?.spot ?? Simulator.TICKERS[ticker]?.currentPrice ?? 0,
    rows: own,
    net: day.ncp - day.npp,
    netCall: day.ncp,
    netPut: day.npp,
    odteNet: odte.ncp - odte.npp,
    odteCall: odte.ncp,
    odtePut: odte.npp,
    /* the same-day contracts' own volume and count, straight off the rows */
    odteVol: own.filter(r => r.dte <= 1).reduce((a, r) => a + r.volume, 0),
    odteCount: own.filter(r => r.dte <= 1).length,
    count: own.length,
    volume,
    premium,
    callSharePct: premium > 0 ? Math.round((callPrem / premium) * 100) : 0,
    askPct: Math.round(w(r => r.askPct)),
    sweepPct: Math.round(w(r => r.sweepPct)),
    iv: w(r => r.iv),
    builtToday: own.filter(r => r.volOverOI >= 1.5).length,
    oiAdded: own.reduce((a, r) => a + Math.max(0, r.deltaOI), 0),
    oiShed: own.reduce((a, r) => a + Math.max(0, -r.deltaOI), 0),
    structures,
    debit: structures.filter(t => t.net >= 0).length,
    credit: structures.filter(t => t.net < 0).length,
    structurePrem: structures.reduce((a, t) => a + t.premium, 0),
    prints,
    tapePrem: prints.reduce((a, p) => a + p.premium, 0),
    tapeSweeps: prints.filter(p => p.sweep).length,
    earnDays: earn.length ? Math.min(...earn) : null,
    heaviest: [...own].sort((a, b) => b.premium - a.premium).slice(0, 6),
  };
}

/* ---- the ledger ------------------------------------------------------------------- */

interface Row {
  label: string;
  hint: string;
  a: ReactNode;
  b: ReactNode;
  /** who carries the row: the larger side, or the more bullish for a lean */
  edge: 'a' | 'b' | null;
}

const larger = (a: number, b: number): 'a' | 'b' | null => (a === b ? null : a > b ? 'a' : 'b');

function ledger(A: Side, B: Side): { group: string; rows: Row[] }[] {
  const money = (v: number) => <span className={dirInk(v)}>{signed(v)}</span>;
  const plain = (v: ReactNode) => <span className="text-textPrimary">{v}</span>;
  return [
    {
      group: 'Net flow',
      rows: [
        { label: 'Net premium', hint: 'Calls bought and puts sold against the reverse, day to now', a: money(A.net), b: money(B.net), edge: larger(A.net, B.net) },
        { label: 'Net calls', hint: 'Net call premium, day to now', a: money(A.netCall), b: money(B.netCall), edge: larger(A.netCall, B.netCall) },
        { label: 'Net puts', hint: 'Net put premium, day to now', a: money(A.netPut), b: money(B.netPut), edge: larger(A.netPut, B.netPut) },
      ],
    },
    {
      group: 'Same-day money',
      rows: [
        { label: '0DTE net', hint: 'The same-day contracts’ net premium', a: money(A.odteNet), b: money(B.odteNet), edge: larger(A.odteNet, B.odteNet) },
        {
          label: '0DTE calls · puts',
          hint: 'Net call and net put premium on the same-day contracts',
          a: (
            <>
              <span className="text-bull">{signed(A.odteCall)}</span> <span className="text-textSecondary">·</span> <span className="text-bear">{signed(A.odtePut)}</span>
            </>
          ),
          b: (
            <>
              <span className="text-bull">{signed(B.odteCall)}</span> <span className="text-textSecondary">·</span> <span className="text-bear">{signed(B.odtePut)}</span>
            </>
          ),
          edge: null,
        },
        { label: '0DTE volume', hint: 'Contracts traded on the same-day expiry', a: plain(`${num(A.odteVol)} · ${A.odteCount} cons`), b: plain(`${num(B.odteVol)} · ${B.odteCount} cons`), edge: larger(A.odteVol, B.odteVol) },
      ],
    },
    {
      group: 'The book',
      rows: [
        { label: 'Contracts traded', hint: 'Contracts on the book today', a: plain(num(A.count)), b: plain(num(B.count)), edge: larger(A.count, B.count) },
        { label: 'Volume', hint: 'Contracts traded, day to now', a: plain(num(A.volume)), b: plain(num(B.volume)), edge: larger(A.volume, B.volume) },
        { label: 'Premium', hint: 'Dollars traded, day to now', a: plain(fmtUsd(A.premium)), b: plain(fmtUsd(B.premium)), edge: larger(A.premium, B.premium) },
        {
          label: 'Calls · puts',
          hint: 'The premium’s split between calls and puts',
          a: (
            <>
              <span className="text-bull">{A.callSharePct}%</span> <span className="text-textSecondary">·</span> <span className="text-bear">{100 - A.callSharePct}%</span>
            </>
          ),
          b: (
            <>
              <span className="text-bull">{B.callSharePct}%</span> <span className="text-textSecondary">·</span> <span className="text-bear">{100 - B.callSharePct}%</span>
            </>
          ),
          edge: null,
        },
        { label: 'Lean', hint: 'Whether the volume paid the ask or hit the bid, volume-weighted', a: <LeanCell askPct={A.askPct} />, b: <LeanCell askPct={B.askPct} />, edge: larger(A.askPct, B.askPct) },
        { label: 'Swept', hint: 'The share of the volume that swept across exchanges', a: plain(`${A.sweepPct}%`), b: plain(`${B.sweepPct}%`), edge: larger(A.sweepPct, B.sweepPct) },
        { label: 'Implied vol', hint: 'Volume-weighted implied volatility across the book', a: plain(`${A.iv.toFixed(0)}%`), b: plain(`${B.iv.toFixed(0)}%`), edge: larger(A.iv, B.iv) },
        { label: 'Built today', hint: 'Contracts trading past their open interest — positions built today', a: plain(num(A.builtToday)), b: plain(num(B.builtToday)), edge: larger(A.builtToday, B.builtToday) },
      ],
    },
    {
      group: 'Footprints',
      rows: [
        { label: 'Interest added', hint: 'Open interest built overnight', a: <span className="text-bull">+{num(A.oiAdded)}</span>, b: <span className="text-bull">+{num(B.oiAdded)}</span>, edge: larger(A.oiAdded, B.oiAdded) },
        { label: 'Interest shed', hint: 'Open interest unwound overnight', a: <span className="text-bear">−{num(A.oiShed)}</span>, b: <span className="text-bear">−{num(B.oiShed)}</span>, edge: larger(A.oiShed, B.oiShed) },
      ],
    },
    {
      group: 'Structures',
      rows: [
        { label: 'Structures', hint: 'Multi-leg structures on the tape today', a: plain(num(A.structures.length)), b: plain(num(B.structures.length)), edge: larger(A.structures.length, B.structures.length) },
        { label: 'Paid · collected', hint: 'Debit structures against credit structures', a: plain(`${A.debit} · ${A.credit}`), b: plain(`${B.debit} · ${B.credit}`), edge: null },
        { label: 'Structure dollars', hint: 'Premium across the structures', a: plain(fmtUsd(A.structurePrem)), b: plain(fmtUsd(B.structurePrem)), edge: larger(A.structurePrem, B.structurePrem) },
      ],
    },
    {
      group: 'The tape',
      rows: [
        { label: 'Prints', hint: 'Rich prints on the live tape', a: plain(num(A.prints.length)), b: plain(num(B.prints.length)), edge: larger(A.prints.length, B.prints.length) },
        { label: 'Tape dollars', hint: 'Premium across those prints', a: plain(fmtUsd(A.tapePrem)), b: plain(fmtUsd(B.tapePrem)), edge: larger(A.tapePrem, B.tapePrem) },
        { label: 'Sweeps', hint: 'Prints that swept across exchanges', a: plain(num(A.tapeSweeps)), b: plain(num(B.tapeSweeps)), edge: larger(A.tapeSweeps, B.tapeSweeps) },
      ],
    },
    {
      group: 'The calendar',
      rows: [
        {
          label: 'Earnings',
          hint: 'The name’s next report, when it sits inside the book’s runway',
          a: A.earnDays == null ? <span className="text-textSecondary">not reporting</span> : <span className={A.earnDays <= 5 ? 'text-warn' : 'text-textPrimary'}>{A.earnDays === 0 ? 'today' : `in ${A.earnDays}d`}</span>,
          b: B.earnDays == null ? <span className="text-textSecondary">not reporting</span> : <span className={B.earnDays <= 5 ? 'text-warn' : 'text-textPrimary'}>{B.earnDays === 0 ? 'today' : `in ${B.earnDays}d`}</span>,
          edge: null,
        },
      ],
    },
  ];
}

/* ---- the page --------------------------------------------------------------------- */

const Compare = () => {
  const { marketData, activeTicker, flowTape } = useMarketData();
  const [mny, setMny] = useState<MoneynessKey>('all');
  const [tenor, setTenor] = useState<SleeveKey | 'all'>('all');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const liveBook = useMemo(
    () => buildFlowBook(Simulator.universeQuotes(activeTicker)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTicker, marketData]
  );
  const liveTrades = useMemo(
    () => buildSpreadFlow(Simulator.universeQuotes(activeTicker)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTicker, marketData]
  );
  /* ONE hold for the whole page: the book, the structures, the tape and the tick freeze together */
  const hold = useHold(useMemo(() => ({ book: liveBook, trades: liveTrades, tape: flowTape as FlowPrint[], tick: marketData }), [liveBook, liveTrades, flowTape, marketData]), activeTicker);
  const { book, trades, tape, tick } = hold.value;

  /* THE NAMES — only names the book carries can be compared; the searches
     offer exactly those. A typed fragment holds the last real name. */
  const names = useMemo(() => new Set(book.map(r => r.ticker)), [book]);
  const [aQuery, setAQuery] = useState<string>(() => (names.has(activeTicker) ? activeTicker : 'SPY'));
  const [bQuery, setBQuery] = useState<string>(() => (activeTicker === 'QQQ' ? 'SPY' : 'QQQ'));
  const lastA = useRef(aQuery);
  const lastB = useRef(bQuery);
  const A = names.has(aQuery) ? aQuery : lastA.current;
  const B = names.has(bQuery) ? bQuery : lastB.current;
  lastA.current = A;
  lastB.current = B;
  const swap = () => {
    setAQuery(B);
    setBQuery(A);
  };

  /* THE EXPIRY CUT — the dates either name's book carries */
  const pairRows = useMemo(() => book.filter(r => r.ticker === A || r.ticker === B), [book, A, B]);
  const { expiry, setExpiry, expiries, cut: cutExpiry, chosen } = useExpiryCut(pairRows, r => r.expiry);
  const cutRows = useMemo(() => cutExpiry(pairRows), [pairRows, cutExpiry]);
  const cutTrades = useMemo(() => (expiry ? trades.filter(t => bookExpiryIso(t.expiry) === expiry) : trades), [trades, expiry]);
  const cutTape = useMemo(() => (expiry ? tape.filter(p => bookExpiryIso(p.expiry) === expiry) : tape), [tape, expiry]);

  /* The pane's clock — sampled where the pane samples, so the ledger and the lines agree */
  const nowSec = useMemo(() => paneTimes(A).slice(-1)[0], [A]);
  const sideA = useMemo(() => account(A, cutRows, cutTrades, cutTape, nowSec), [A, cutRows, cutTrades, cutTape, nowSec]);
  const sideB = useMemo(() => account(B, cutRows, cutTrades, cutTape, nowSec), [B, cutRows, cutTrades, cutTape, nowSec]);
  const bands = useMemo(() => ledger(sideA, sideB), [sideA, sideB]);

  const heavier = sideA.premium >= sideB.premium ? sideA : sideB;
  const busier = sideA.prints.length >= sideB.prints.length ? sideA : sideB;
  const moreBullish = sideA.net >= sideB.net ? sideA : sideB;

  useEffect(() => setOpenKey(null), [A, B]);

  const read = useMemo<ReactNode>(() => {
    const lean = (s: Side) => `${s.net >= 0 ? 'bullish' : 'bearish'} at ${signed(s.net)}`;
    return (
      <>
        <RichRead text={`${chosen ? `On ${expiryWords(chosen)}, ` : ''}${A} leans ${lean(sideA)} while ${B} leans ${lean(sideB)}. `} />
        <RichRead text={`${heavier.ticker} carries the heavier book — [[${fmtUsd(heavier.premium)}]] across ${heavier.count} contracts on ${num(heavier.volume)} volume — and ${busier.ticker} the busier tape, ${busier.prints.length} prints for ${fmtUsd(busier.tapePrem)}. `} />
        <RichRead text={`Same-day money: ${A} ${signed(sideA.odteNet)}, ${B} ${signed(sideB.odteNet)}.`} />
      </>
    );
  }, [A, B, sideA, sideB, heavier, busier, chosen]);

  const drillList = useMemo(() => [...sideA.heaviest, ...sideB.heaviest], [sideA.heaviest, sideB.heaviest]);
  const openRow = useCallback((r: BookContract) => setOpenKey(r.key), []);

  const head = (s: Side, which: 'A' | 'B') => (
    <div className="flex items-center gap-2 px-3 h-9 border-b border-borderSubtle" data-compare-head={which}>
      <span className="font-mono text-[9px] uppercase tracking-widest text-textSecondary">{which}</span>
      <CompanyLogo ticker={s.ticker} size={16} />
      <span className="font-mono text-[12px] font-bold text-textPrimary">{s.ticker}</span>
      <span className="font-mono text-[11px] tnum text-textPrimary">${s.spot.toFixed(2)}</span>
      <span className={`ml-auto font-mono text-[11px] tnum font-semibold ${dirInk(s.net)}`}>{signed(s.net)} net</span>
    </div>
  );

  const contracts = (s: Side) => (
    <div className="flex flex-col" data-compare-contracts={s.ticker}>
      {s.heaviest.length === 0 && <span className="px-3 py-4 font-mono text-[10px] uppercase tracking-widest text-textSecondary">Nothing on the book for {s.ticker} on this cut</span>}
      {s.heaviest.map(r => (
        <button key={r.key} type="button" onClick={() => openRow(r)} className={`flex items-center gap-2 px-3 h-9 border-b border-borderSubtle/60 text-left transition-colors ${openKey === r.key ? 'bg-silver/[0.06]' : 'hover:bg-silver/[0.04]'}`} title="Open the contract's card">
          <ContractLabel contract={`${r.ticker} ${r.strike}${r.right}`} right={r.right} logo={r.ticker} size="sm" />
          <span className="font-mono text-[10px] tnum text-textPrimary">{r.expiry} · {r.dte}d</span>
          <span className="ml-auto font-mono text-[11px] tnum text-textPrimary">{fmtUsd(r.premium)}</span>
          <span className="font-mono text-[10px] tnum text-textPrimary w-16 text-right">{num(r.volume)} vol</span>
          <LeanCell askPct={r.askPct} />
        </button>
      ))}
    </div>
  );

  const structures = (s: Side) => (
    <div className="flex flex-col" data-compare-structures={s.ticker}>
      {s.structures.length === 0 && <span className="px-3 py-4 font-mono text-[10px] uppercase tracking-widest text-textSecondary">No structures on {s.ticker} on this cut</span>}
      {[...s.structures]
        .sort((a, b) => b.premium - a.premium)
        .slice(0, 5)
        .map(t => (
          <div key={t.id} className="flex items-center gap-2 px-3 h-9 border-b border-borderSubtle/60">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: KIND_DOT[t.kind] }} />
            <span className="font-mono text-[11px] font-semibold text-textPrimary w-20">{KIND_LABEL[t.kind]}</span>
            <span className="font-mono text-[11px] font-bold tnum text-textPrimary">{t.strikesLabel}</span>
            <span className="font-mono text-[10px] tnum text-textPrimary">{t.expiry} · {t.dte}d</span>
            <span className="ml-auto font-mono text-[11px] tnum text-textPrimary">
              ${Math.abs(t.net).toFixed(2)} <span className="text-[10px] text-textSecondary">{t.net >= 0 ? 'debit' : 'credit'}</span>
            </span>
            <span className="font-mono text-[11px] tnum text-textPrimary w-16 text-right">{fmtUsd(t.premium)}</span>
          </div>
        ))}
    </div>
  );

  return (
    <>
      <TraceBox
        title="Two names, side by side"
        sub="Net flow, the same-day money, the structures, the book and the tape — A against B, on the same cut every other Trace page reads · pick either name, swap them, cut them to one expiry"
        testId="compare"
        data={{ a: A, b: B, expiry: expiry ?? 'all' }}
        guide={{ title: 'How to read the comparison', door: 'What the panes, the ledger and the marks mean', body: <CompareGuide />, testId: 'compare-guide', open: guideOpen, onOpen: setGuideOpen }}
        facts={
          <>
            <Fact label={`${A} net`} testId="a-net">
              <span className={dirInk(sideA.net)}>{signed(sideA.net)}</span>
            </Fact>
            <Fact label={`${B} net`} testId="b-net">
              <span className={dirInk(sideB.net)}>{signed(sideB.net)}</span>
            </Fact>
            <Fact label="Same-day" testId="odte" title="The same-day contracts' net premium, A · B">
              <span className={dirInk(sideA.odteNet)}>{signed(sideA.odteNet)}</span> <span className="text-textSecondary">·</span> <span className={dirInk(sideB.odteNet)}>{signed(sideB.odteNet)}</span>
            </Fact>
            <Champion label="Leans bullish" ink="bull" onOpen={() => (moreBullish.ticker === A ? setBQuery(A) : setAQuery(B))} testId="bullish">
              {moreBullish.ticker} · {signed(moreBullish.net)}
            </Champion>
            <Champion label="Heavier book" ink="supreme" onOpen={() => openRow(heavier.heaviest[0])} testId="heavier">
              {heavier.ticker} · {fmtUsd(heavier.premium)}
            </Champion>
            <Champion label="Busier tape" ink="warn" onOpen={() => openRow(busier.heaviest[0] ?? heavier.heaviest[0])} testId="busier">
              {busier.ticker} · {busier.prints.length} prints
            </Champion>
          </>
        }
        controls={
          <>
            <LiveHold paused={hold.paused} onToggle={hold.toggle} heldAt={hold.heldAt} />
            <span className="inline-flex items-center gap-1.5" data-compare-pick="a">
              <span className="font-mono text-[9px] uppercase tracking-widest text-textSecondary">A</span>
              <FlowSearch value={aQuery} onChange={v => setAQuery(v)} rows={book} countNoun="contracts" tickersOnly />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-textSecondary">vs</span>
            <span className="inline-flex items-center gap-1.5" data-compare-pick="b">
              <span className="font-mono text-[9px] uppercase tracking-widest text-textSecondary">B</span>
              <FlowSearch value={bQuery} onChange={v => setBQuery(v)} rows={book} countNoun="contracts" tickersOnly />
            </span>
            <button type="button" onClick={swap} title="Swap the two names" aria-label="Swap the two names" className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-borderSubtle bg-chip text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors" data-compare-swap>
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
            <ExpiryCalendar value={chosen ? isoDate(chosen.date) : ''} expiries={expiries} onChange={e => setExpiry(isoDate(e.date))} onClear={() => setExpiry(null)} label="Expiry" icon={CalendarDays} steppers={false} title="Only contracts on one expiry — or every expiry" testId="compare-expiry" />
          </>
        }
        sentence={read}
      >
        {/* THE PANES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 border-t border-borderSubtle" data-compare-panes>
          {[sideA, sideB].map((s, i) => (
            <div key={s.ticker + i} className={`flex flex-col ${i === 0 ? 'lg:border-r border-borderSubtle' : ''}`}>
              {head(s, i === 0 ? 'A' : 'B')}
              <div className="h-[340px] p-2">
                <NetFlowPane book={cutRows} seg="all" mny={mny} onSeg={() => {}} onMny={setMny} tick={tick} ticker={s.ticker} tenor={tenor} onTenor={setTenor} dteMax={Infinity} />
              </div>
              {/* the same-day money under the pane — the 0DTE desk's figures for the name */}
              <div className="flex items-center gap-4 px-3 h-8 border-t border-b border-borderSubtle font-mono text-[10px] tnum" data-compare-odte={s.ticker}>
                <span className="uppercase tracking-widest text-textSecondary">Same-day</span>
                <span className={dirInk(s.odteNet)}>{signed(s.odteNet)} net</span>
                <span className="text-bull">{signed(s.odteCall)} calls</span>
                <span className="text-bear">{signed(s.odtePut)} puts</span>
                <span className="ml-auto text-textPrimary">
                  {num(s.odteVol)} vol · {s.odteCount} cons
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* THE LEDGER */}
        <div data-compare-ledger>
          <div className="grid grid-cols-[1fr_180px_180px] lg:grid-cols-[1fr_240px_240px] items-center px-5 h-8 border-b border-borderSubtle font-mono text-[9px] uppercase tracking-widest text-textSecondary">
            <span>Fact</span>
            <span className="inline-flex items-center gap-1.5 justify-end">
              <CompanyLogo ticker={A} size={12} /> {A}
            </span>
            <span className="inline-flex items-center gap-1.5 justify-end">
              <CompanyLogo ticker={B} size={12} /> {B}
            </span>
          </div>
          {bands.map(band => (
            <div key={band.group}>
              <div className="px-5 pt-2.5 pb-1 text-[10px] font-semibold text-textPrimary">{band.group}</div>
              {band.rows.map(r => (
                <div key={r.label} className="grid grid-cols-[1fr_180px_180px] lg:grid-cols-[1fr_240px_240px] items-center px-5 h-8 border-t border-borderSubtle/50 font-mono text-[11px] tnum" title={r.hint} data-compare-row={r.label}>
                  <span className="text-textPrimary">{r.label}</span>
                  <span className={`flex items-center justify-end gap-1.5 ${r.edge === 'a' ? 'font-bold' : ''}`}>
                    {r.edge === 'a' && <span className="text-supreme" aria-label="carries the row">◆</span>}
                    {r.a}
                  </span>
                  <span className={`flex items-center justify-end gap-1.5 ${r.edge === 'b' ? 'font-bold' : ''}`}>
                    {r.edge === 'b' && <span className="text-supreme" aria-label="carries the row">◆</span>}
                    {r.b}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* THE CONTRACTS AND THE STRUCTURES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 border-t border-borderSubtle mt-2" data-compare-contracts-band>
          {[sideA, sideB].map((s, i) => (
            <div key={s.ticker + i} className={`${i === 0 ? 'lg:border-r border-borderSubtle' : ''}`}>
              <div className="px-3 pt-3 pb-1.5 flex items-center gap-2">
                <CompanyLogo ticker={s.ticker} size={14} />
                <h3 className="text-[11px] font-semibold text-textPrimary">{s.ticker}'s heaviest contracts</h3>
                <span className="text-[10px] text-textSecondary">· by dollars · a row opens the card</span>
              </div>
              {contracts(s)}
              <div className="px-3 pt-3 pb-1.5 flex items-center gap-2">
                <CompanyLogo ticker={s.ticker} size={14} />
                <h3 className="text-[11px] font-semibold text-textPrimary">{s.ticker}'s structures</h3>
                <span className="text-[10px] text-textSecondary">· the tape reconstructed · heaviest first</span>
              </div>
              {structures(s)}
            </div>
          ))}
        </div>
        <div className="px-5 py-2 text-[10px] text-textSecondary border-t border-borderSubtle">
          Only names on today's book can be compared — the searches offer exactly those. <ReadDoor onOpen={() => setAQuery(activeTicker)} title="Put the terminal's name on A">Put {activeTicker} on A</ReadDoor>.
        </div>
      </TraceBox>

      <BookDrill list={drillList} openKey={openKey} onOpen={setOpenKey} tick={tick} />
    </>
  );
};

export default Compare;
