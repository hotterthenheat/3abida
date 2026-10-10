/*
==================================================
  SLAYER TERMINAL - WATCHERS (Trace)
  The tape watching itself (Noah, 2026-08-30 —
  expansion page 3, from the reference's flow-alert
  stream). Named "Flow Alerts" until 2026-09-11:
  under the alerts rule the bell is the READER'S
  alerts, so the desk's watchers took their own
  name (/trace/watchers; the old path redirects).

  The reader's bell stays the reader's: those are
  alerts YOU armed. These are the desk's own
  watchers over the day book, and the feed is what
  they caught — dripped through the session on the
  engine clock, newest first.

  REASON, NOT RULE (Noah, 2026-08-30): the column
  answers the reader's actual question — "why is
  this in front of me" — in a house phrase. Reason
  dots use the CATEGORICAL palette (a reason names
  a kind, never a verdict — direction ink lives in
  the Side column).

  AND THE READER'S OWN (Noah, 2026-08-30): reasons
  you write land in this same feed, on the same
  clock, quoting the same book — marked with a
  hollow ring so you always know whose watcher
  caught the row. The builder is behind "Your
  reasons"; the vocabulary is data/flowReasons.ts.
==================================================
*/

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { useMarketData } from '../../context/MarketDataContext';
import Simulator from '../../core/simulator';
import {
  buildCatches,
  buildFlowBook,
  WATCHERS,
  type WatcherKey,
  type Catch,
} from '../../data/flowBook';
import { reasonSentence, useReasons } from '../../data/flowReasons';
import { fmtUsd } from '../../data/gex';
import type { BookContract } from '../../types/trace';
import type { Column } from '../../components/ui/DataTable';
import CompanyLogo from '../../components/ui/CompanyLogo';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import WatchStar from '../../components/trace/WatchStar';
import { contractKey, watchContract } from '../../context/WatchContext';
import RichRead from '../../components/ui/RichRead';
import BookDrill from '../../components/trace/BookDrill';
import ContractCell from '../../components/trace/ContractCell';
import { earnMarks, weightInk } from '../../components/trace/earnedInk';
import { LiveHold, useHold } from '../../components/trace/LiveHold';
import ExpiryCalendar from '../../components/ui/ExpiryCalendar';
import { useExpiryCut } from '../../components/trace/bookExpiry';
import { isoDate } from '../../core/calendar';
import ColumnChooser, { useHiddenColumns } from '../../components/trace/ColumnChooser';
import ReasonDoor from '../../components/trace/ReasonDoor';
import ReadDoor from '../../components/trace/ReadDoor';
import FlowSearch, { normSymbol } from '../../components/trace/FlowSearch';
import TraceBox, { Champion, Fact, PhoneRow, TraceGrid } from '../../components/trace/TraceBox';
import { WatchersGuide } from '../../components/trace/TraceGuide';
import { SavedCutsControl, SavedCutsList, useSavedCuts } from '../../components/trace/SavedCuts';
import { isIsoDay, isQuery, oneOf, useAddressCut } from '../../components/trace/addressCut';
import { createViewStore } from '../../data/savedViews';
import { followThrough, FLAT_PCT, type Follow } from '../../data/followThrough';
import { rowProps } from '../../components/ui/rowKeys';
import { num as fmtNum, pctSigned } from '../../core/format';

const num = (v: number) => fmtNum(v);

/* THE CARDS (the walk, 2026-09-09) */
const SIDE_OPTIONS: DropdownOption<'ALL' | 'C' | 'P'>[] = [
  { value: 'ALL', label: 'Both', hint: 'Calls and puts' },
  { value: 'C', label: 'Calls', hint: 'Calls only' },
  { value: 'P', label: 'Puts', hint: 'Puts only' },
];
const WIDTHS: Record<string, number> = { time: 92, ticker: 96, contract: 150, dte: 64, reason: 236, clip: 118, clipprem: 92, sideCol: 64, otm: 76, earn: 92 };
const FLEXES: Record<string, number> = { reason: 3 };
const PIN_LEFT = ['time', 'ticker', 'contract'];
const PIN_RIGHT = ['clipprem'];
const WATCHER_CUTS = createViewStore('slayer_watchers_cuts_v1');
const TOOLTIPS: Record<string, string> = {
  reason: "Why the contract is in front of you — the desk's watchers, or one you wrote (the hollow ring)",
  clip: 'The print that tripped the reason — its size and fill',
  clipprem: "That print's money",
  sideCol: 'At the ask, the contract being bought; on the bid, sold',
  voloi: 'Volume over open interest — above 1.5 the positions were built today',
};

/** Categorical reason dots — same idea as sector dots: a hue names the kind. The house's categorical tokens, cut deep on
    paper (the audit's X12: literal pastels, #E0D080 all but gone on white). */
const RULE_DOT: Record<WatcherKey, string> = {
  'big-money': 'rgb(var(--cat-analyst))',
  'into-earnings': 'rgb(var(--cat-earnings))',
  climbing: 'rgb(var(--cat-macro))',
  falling: 'rgb(var(--cat-ma))',
  'fresh-size': 'rgb(var(--cat-guidance))',
  hammering: 'rgb(var(--cat-regulatory))',
};

const RULE_META = Object.fromEntries(WATCHERS.map(r => [r.key, r])) as Record<
  WatcherKey,
  (typeof WATCHERS)[number]
>;

/** A flagged print the stock did not follow — a door to its card */
const MissRow = ({ f, reason, onOpen }: { f: Follow; reason: string; onOpen: () => void }) => (
  <li>
    <div
      {...rowProps(onOpen, `Open ${f.c.row.ticker} ${f.c.row.strike}${f.c.row.right}`)}
      className="flex items-center gap-x-3 gap-y-0.5 flex-wrap px-3 py-1.5 text-[11px] tnum cursor-pointer hover:bg-ink/[0.03] focus-visible:outline-offset-[-2px]"
    >
      <span className="w-11 text-textSecondary">{f.c.time}</span>
      <span className="font-semibold text-textPrimary">
        {f.c.row.ticker} {f.c.row.strike}
        {f.c.row.right}
      </span>
      <span className="text-textSecondary">
        {f.c.side === 'ASK' ? 'at the ask' : 'on the bid'} · leans {f.dir > 0 ? 'up' : 'down'}
      </span>
      <span className="text-textMuted">{reason}</span>
      <span className="ml-auto text-textSecondary">
        ${f.from.toFixed(2)} → ${f.to.toFixed(2)}{' '}
        <span className={f.way === 'flat' ? 'text-textMuted' : f.movePct >= 0 ? 'text-bull' : 'text-bear'}>
          {f.movePct >= 0 ? '+' : ''}
          {f.movePct.toFixed(2)}%
        </span>
      </span>
    </div>
  </li>
);

/** A catch on a phone (the audit's TR-7) */
const phoneRow = (a: Catch) => (
  <PhoneRow
    lead={<WatchStar k={contractKey(a.row)} make={() => watchContract(a.row, 'watchers')} />}
    title={
      <>
        <span className="font-bold">{a.row.ticker}</span>
        <span className="font-bold tnum">{a.row.strike}</span>
        <span className={a.row.right === 'C' ? 'text-bull' : 'text-bear'}>{a.row.right === 'C' ? 'call' : 'put'}</span>
        <span className="text-[11px] text-textSecondary tnum">{a.row.expiry.slice(0, 5)}</span>
      </>
    }
    aside={a.time}
    figures={[
      <span key="p" className="font-semibold text-textPrimary">{fmtUsd(a.clipPremium)}</span>,
      <span key="s">{a.side === 'ASK' ? 'ask' : 'bid'} ${a.clipFill.toFixed(2)}</span>,
      <span key="z">{num(a.clipSize)} contracts</span>,
    ]}
  />
);

const Watchers = () => {
  const { marketData, activeTicker } = useMarketData();
  const myReasons = useReasons();
  /* THE CUT IS THE ADDRESS (the audit's TR-13): the reason, the side, the search and the expiry can be sent and saved */
  const addr = useAddressCut({
    reason: { def: 'ALL', valid: (v: string) => v.length > 0 && v.length < 64 },
    side: { def: 'ALL', valid: oneOf(['ALL', 'C', 'P']) },
    q: { def: '', valid: isQuery },
    exp: { def: '', valid: isIsoDay },
  });
  const rule = addr.cut.reason;
  const setRule = (v: string) => addr.set({ reason: v });
  const side = addr.cut.side as 'ALL' | 'C' | 'P';
  const setSide = (v: 'ALL' | 'C' | 'P') => addr.set({ side: v });
  const query = addr.cut.q;
  const setQuery = (v: string) => addr.set({ q: v });
  const cuts = useSavedCuts();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [missesOpen, setMissesOpen] = useState(false);

  const liveBook = useMemo(
    () => buildFlowBook(Simulator.universeQuotes(activeTicker)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTicker, marketData]
  );
  // The shared hold (see LiveHold): book and tick freeze together while paused.
  const hold = useHold(useMemo(() => ({ book: liveBook, tick: marketData }), [liveBook, marketData]), activeTicker);
  const { book: heldBook, tick } = hold.value;
  /* THE EXPIRY CUT (2026-09-12): the watchers run over the cut book */
  const { expiry, setExpiry, expiries, cut: cutExpiry, chosen } = useExpiryCut(heldBook, r => r.expiry, { value: addr.cut.exp || null, onChange: iso => addr.set({ exp: iso ?? '' }) });
  const book = useMemo(() => cutExpiry(heldBook), [heldBook, cutExpiry]);
  const keyOf = useCallback((a: { id: string }) => a.id, []);
  const openRow = useCallback((a: { row: { key: string } }) => setOpenKey(a.row.key), []);
  const catches = useMemo(() => buildCatches(book, myReasons), [book, myReasons]);

  /* One lookup for both shelves — the column, the chips and the header hint
     all resolve a reason's words through this, so a row and its filter chip
     can never describe the same reason differently. */
  const reasonOf = useMemo(() => {
    const mine = new Map(myReasons.map(r => [r.id, r]));
    return (key: string): { label: string; phrase: string; mine: boolean } | null => {
      const house = RULE_META[key as WatcherKey];
      if (house) return { label: house.label, phrase: house.reason, mine: false };
      const own = mine.get(key);
      return own ? { label: own.name, phrase: reasonSentence(own), mine: true } : null;
    };
  }, [myReasons]);

  /* Delete the reason you were filtered to and the filter would go on hiding
     everything for a reason that no longer exists — an empty table with no
     way to read why. Fall back to the whole feed. */
  useEffect(() => {
    if (rule !== 'ALL' && !reasonOf(rule)) setRule('ALL');
  }, [rule, reasonOf]);

  const rows = useMemo(() => {
    const nq = normSymbol(query);
    return catches.filter(
      a =>
        (rule === 'ALL' || a.rule === rule) &&
        (side === 'ALL' || a.row.right === side) &&
        (nq === '' || normSymbol(`${a.row.ticker}${a.row.strike}${a.row.right}`).includes(nq))
    );
  }, [catches, rule, side, query]);
  /* every row — the grid draws only what is on screen */
  const shown = rows;

  /* One row per contract for the search's tallies — a loud contract is caught
     twice, and counting it twice would double its money in the suggestions. */
  const searchRows = useMemo(() => {
    const seen = new Map<string, BookContract>();
    for (const a of catches) if (!seen.has(a.row.key)) seen.set(a.row.key, a.row);
    return [...seen.values()];
  }, [catches]);

  /* Three registers per column (Noah, 2026-08-30) - and the Print $ champion
     in magenta is this feed's own LARGEST PRINT, the tape chart's grammar. */
  const marks = useMemo(
    () => ({
      prem: earnMarks(shown, a => a.clipPremium),
      vol: earnMarks(shown, a => a.row.volume),
      oi: earnMarks(shown, a => a.row.oi),
    }),
    [shown]
  );

  // The drilldown anchors on the EXACT print the rule fired on.
  const clipMap = useMemo(() => {
    const m = new Map<string, { size: number; fill: number; side: 'ASK' | 'BID'; time: string }>();
    for (const a of shown) {
      if (!m.has(a.row.key)) m.set(a.row.key, { size: a.clipSize, fill: a.clipFill, side: a.side, time: a.time });
    }
    return m;
  }, [shown]);
  const clipFor = useMemo(() => (row: BookContract) => clipMap.get(row.key), [clipMap]);
  /* The read's "Latest:" door must open even when a filter has hidden that
     row — the drill list quietly carries it up front then. */
  const drillList = useMemo(() => {
    const base = shown.map(a => a.row);
    const latest = catches[0];
    return latest && !base.some(r => r.key === latest.row.key) ? [latest.row, ...base] : base;
  }, [shown, catches]);

  /* ReactNode, not a string: the newest contract is a DOOR — the same white
     underline the tables wear, opening the same card (Noah, 2026-08-30). */
  const read = useMemo<ReactNode>(() => {
    if (catches.length === 0) return <RichRead text="Nothing flagged yet today — the desk is watching." />;
    const byRule = new Map<string, number>();
    for (const a of catches) byRule.set(a.rule, (byRule.get(a.rule) ?? 0) + 1);
    const loud = [...byRule.entries()].sort((a, b) => b[1] - a[1])[0];
    const loudName = reasonOf(loud[0])?.label ?? 'A reason';
    const mineCount = catches.reduce((n, a) => n + (a.mine ? 1 : 0), 0);
    const latest = catches[0];
    // Yours gets its own clause when you have any — the feed is mixed, so the
    // sentence says how much of it is the desk and how much is you.
    const yours =
      mineCount === 0
        ? ''
        : mineCount === 1
          ? ' One came from a reason you wrote.'
          : ` ${mineCount} came from reasons you wrote.`;
    /* The Screener's grammar (Noah, 2026-08-30): plain count, the leading
       reason in its own words, one newest print — never "the desk has
       flagged", never a quoted label, never "at … at …". */
    const phrase = reasonOf(loud[0])?.phrase ?? loudName;
    const why = phrase.charAt(0).toLowerCase() + phrase.slice(1);
    const names = new Set(catches.map(a => a.row.ticker)).size;
    return (
      <>
        <RichRead text={`${catches.length} caught today on ${names} names — [[${loud[1]}]] because ${why}.${yours} Newest: `} />
        <ReadDoor onOpen={() => setOpenKey(latest.row.key)}>
          {latest.row.ticker} {latest.row.strike}
          {latest.row.right}
        </ReadDoor>
        <RichRead
          text={`, ${num(latest.clipSize)} on the ${latest.side === 'ASK' ? 'ask' : 'bid'} at $${latest.clipFill.toFixed(2)} (${
            latest.time
          }).`}
        />
      </>
    );
  }, [catches, reasonOf]);

  const activeRule = rule === 'ALL' ? null : reasonOf(rule);
  /* The Reason card: every reason, the desk's then yours */
  const reasonOptions = useMemo<DropdownOption<string>[]>(
    () => [
      { value: 'ALL', label: 'Every reason', hint: "The desk's watchers and yours" },
      ...WATCHERS.map(r => ({ value: r.key, label: r.label, hint: r.hint })),
      ...myReasons.map(r => ({ value: r.id, label: r.name, hint: reasonSentence(r) })),
    ],
    [myReasons]
  );

  const columns = useMemo<Column<Catch>[]>(
    () => [
      {
        key: 'time',
        header: 'Time',
        sortValue: a => a.minute,
        // The star leads the row, the tape's own placement (see WatchStar).
        render: a => (
          <span className="inline-flex items-center gap-1.5">
            <WatchStar k={contractKey(a.row)} make={() => watchContract(a.row, 'watchers')} />
            <span className="text-[11px] text-textPrimary">{a.time}</span>
          </span>
        ),
      },
      {
        key: 'ticker',
        header: 'Ticker',
        sortValue: a => a.row.ticker,
        render: a => (
          <span className="inline-flex items-center gap-1.5">
            <CompanyLogo ticker={a.row.ticker} size={15} />
            <span className="font-bold text-textPrimary">{a.row.ticker}</span>
          </span>
        ),
      },
      {
        key: 'contract',
        header: 'Contract',
        align: 'right',
        sortValue: a => a.row.strike,
        render: a => <ContractCell strike={a.row.strike} right={a.row.right} expiry={a.row.expiry} />,
      },
      {
        key: 'dte',
        header: 'DTE',
        align: 'right',
        sortValue: a => a.row.dte,
        render: a => <span className="text-textPrimary">{a.row.dte}d</span>,
      },
      {
        key: 'reason',
        header: 'Reason',
        sortValue: a => a.rule,
        /* The why, spoken — not the machinery's name for it. A house reason
           wears its categorical hue; one of yours wears a hollow ring and
           leads with the handle you gave it. Shape says whose, hue says which. */
        render: a => {
          const meta = reasonOf(a.rule);
          if (!meta) return <span className="text-textSecondary">—</span>;
          return (
            /* TWO LINES, NEVER CUT MID-WORD (the audit's TR-47: "The same cor", "One print carr") */
            <span
              className="inline-flex items-center gap-1.5 text-[11px] leading-tight text-textPrimary whitespace-normal"
              title={a.mine ? `${meta.label} — ${meta.phrase}` : meta.phrase}
            >
              {a.mine ? (
                <span className="w-1.5 h-1.5 rounded-full shrink-0 border border-textSecondary" />
              ) : (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: RULE_DOT[a.rule as WatcherKey] }}
                />
              )}
              {a.mine ? (
                <span className="line-clamp-2">
                  <span className="font-semibold">{meta.label}</span> <span className="text-textSecondary">{meta.phrase}</span>
                </span>
              ) : (
                <span className="line-clamp-2">{meta.phrase}</span>
              )}
            </span>
          );
        },
      },
      {
        key: 'clip',
        header: 'The print',
        align: 'right',
        sortValue: a => a.clipSize,
        render: a => (
          <span className="text-textPrimary">
            {num(a.clipSize)} <span className="text-[11px] text-textSecondary">@ ${a.clipFill.toFixed(2)}</span>
          </span>
        ),
      },
      {
        key: 'clipprem',
        header: 'Print $',
        align: 'right',
        sortValue: a => a.clipPremium,
        render: a => <span className={weightInk(a.clipPremium, marks.prem)}>{fmtUsd(a.clipPremium)}</span>,
      },
      {
        key: 'sideCol',
        header: 'Side',
        align: 'right',
        sortValue: a => a.side,
        // The tape's rule: at the ask = the contract being bought — the side in one ink (the audit's X12)
        render: a => <span className="text-[11px] text-textPrimary">{a.side === 'ASK' ? 'ask' : 'bid'}</span>,
      },
      {
        key: 'vol',
        header: 'Vol',
        align: 'right',
        sortValue: a => a.row.volume,
        render: a => <span className={weightInk(a.row.volume, marks.vol)}>{num(a.row.volume)}</span>,
      },
      {
        key: 'oi',
        header: 'OI',
        align: 'right',
        sortValue: a => a.row.oi,
        render: a => <span className={weightInk(a.row.oi, marks.oi)}>{num(a.row.oi)}</span>,
      },
      {
        key: 'voloi',
        header: 'Vol/OI',
        align: 'right',
        sortValue: a => a.row.volOverOI,
        render: a => (
          <span className={a.row.volOverOI >= 1.5 ? 'font-bold text-textPrimary' : 'text-textPrimary'}>
            {a.row.volOverOI.toFixed(2)}
          </span>
        ),
      },
      {
        key: 'otm',
        header: 'OTM %',
        align: 'right',
        sortValue: a => a.row.otmPct,
        render: a => (
          <span className="text-textPrimary">
            {pctSigned(a.row.otmPct, 1)}
          </span>
        ),
      },
      {
        key: 'earn',
        header: 'Earnings',
        align: 'right',
        sortValue: a => a.row.earnDays ?? 999,
        render: a =>
          a.row.earnDays == null ? (
            <span className="text-textSecondary">—</span>
          ) : (
            <span className={a.row.earnDays <= 5 ? 'text-warn' : 'text-textPrimary'}>
              {a.row.earnDays === 0 ? 'today' : `in ${a.row.earnDays}d`}
            </span>
          ),
      },
    ],
    // The Reason cell reads the shelf through reasonOf, the magnitude cells
    // read the marks — frozen deps here rot both.
    [reasonOf, marks]
  );

  /* THE TAPE'S HEAD, THIS PAGE'S RULES (Noah, 2026-08-30): the composition
     strip — facts left, champions as pills right — and the column chooser.
     The bull/bear pills only show when they are not the magenta one. */
  const champs = useMemo(() => {
    const by = (pick: (a: Catch) => boolean) =>
      shown.filter(pick).reduce<Catch | null>((a, x) => (a === null || x.clipPremium > a.clipPremium ? x : a), null);
    return { ask: by(a => a.side === 'ASK'), bid: by(a => a.side === 'BID'), all: by(() => true) };
  }, [shown]);
  const facts = useMemo(() => {
    const byRule = new Map<string, number>();
    let mine = 0;
    for (const a of catches) {
      byRule.set(a.rule, (byRule.get(a.rule) ?? 0) + 1);
      if (a.mine) mine++;
    }
    const loud = [...byRule.entries()].sort((a, b) => b[1] - a[1])[0];
    return { total: catches.length, loudName: loud ? (reasonOf(loud[0])?.label ?? '') : '', loudCount: loud ? loud[1] : 0, mine };
  }, [catches, reasonOf]);
  const pill = (a: Catch) => `${a.row.ticker} ${a.row.strike}${a.row.right} · ${fmtUsd(a.clipPremium)}`;

  /* THE RECORD THAT COUNTS THE MISSES (the ideas report, idea 4): every print flagged on this cut, misses included —
     whether the stock moved the print's way since it was flagged. "N of M", never a rate. */
  const record = useMemo(() => followThrough(rows), [rows]);
  const misses = useMemo(() => record.rows.filter(f => f.way !== 'with').sort((a, b) => b.c.minute - a.c.minute), [record]);
  const filtered = rule !== 'ALL' || side !== 'ALL' || query !== '' || expiry !== null;
  const { hidden, toggle, showAll, hideAll } = useHiddenColumns('slayer_flowalerts_cols');
  const chooserCols = useMemo(() => columns.map(c => ({ key: c.key, label: typeof c.header === 'string' ? c.header : c.key })), [columns]);
  const selectedId = openKey ? (shown.find(a => a.row.key === openKey)?.id ?? null) : null;

  return (
    <>
      <TraceBox
        title="The desk watching the tape"
        sub={activeRule ? `${activeRule.label} — ${activeRule.phrase} · newest first · a row opens the contract's card` : "Every reason a contract is flagged — the desk's and yours, newest first · a row opens the contract's card"}
        testId="watchers"
        data={{ rule, rows: rows.length, expiry: expiry ?? 'all' }}
        guide={{ title: 'How to read the watchers', door: 'What a reason, the print and the side mean', body: <WatchersGuide />, testId: 'watchers-guide', open: guideOpen, onOpen: setGuideOpen }}
        facts={
          <>
            {/* "· 50 hammering" read a reason as a noun (the audit's TR-48): the most frequent reason, named, its count after */}
            <Fact label="Caught today" testId="caught">
              {num(facts.total)}
              {facts.loudName && (
                <span className="text-textSecondary">
                  {' '}
                  · most often {facts.loudName} ({facts.loudCount})
                </span>
              )}
            </Fact>
            <Fact label="From your reasons" testId="mine">
              <span className={facts.mine > 0 ? 'text-textPrimary' : 'text-textSecondary'}>{facts.mine}</span>
            </Fact>
            {champs.ask && champs.ask !== champs.all && (
              <Champion label="Top at the ask" ink="plain" onOpen={() => setOpenKey(champs.ask!.row.key)} testId="top-ask">
                {pill(champs.ask)}
              </Champion>
            )}
            {champs.bid && champs.bid !== champs.all && (
              <Champion label="Top on the bid" ink="plain" onOpen={() => setOpenKey(champs.bid!.row.key)} testId="top-bid">
                {pill(champs.bid)}
              </Champion>
            )}
            {champs.all && (
              <Champion label="Largest print" ink="supreme" onOpen={() => setOpenKey(champs.all!.row.key)} testId="largest">
                {pill(champs.all)}
              </Champion>
            )}
          </>
        }
        controls={
          <>
            <LiveHold paused={hold.paused} onToggle={hold.toggle} heldAt={hold.heldAt} />
            <FlowSearch value={query} onChange={setQuery} rows={searchRows} countNoun="contracts" span />
            <DropdownSelect label="Reason" value={rule} options={reasonOptions} onChange={setRule} title="Which watcher's catches" testId="watchers-reason" />
            <DropdownSelect label="Side" value={side} options={SIDE_OPTIONS} onChange={setSide} title="Calls, puts or both" testId="watchers-side" />
            <ExpiryCalendar value={chosen ? isoDate(chosen.date) : ''} expiries={expiries} onChange={e => setExpiry(isoDate(e.date))} onClear={() => setExpiry(null)} label="Expiry" icon={CalendarDays} steppers={false} title="Only contracts on one expiry — or every expiry" testId="watchers-expiry" />
            <ReasonDoor book={book} />
            <SavedCutsControl store={WATCHER_CUTS} query={addr.query} onOpen={addr.open} noun="cut" testId="watchers" onSay={cuts.say} open={cuts.open} onToggleOpen={cuts.toggle} />
            <div className="ml-auto">
              <ColumnChooser columns={chooserCols} hidden={hidden} onToggle={toggle} onAll={showAll} onNone={() => hideAll(columns.map(c => c.key))} />
            </div>
          </>
        }
        sentence={
          <>
            <SavedCutsList store={WATCHER_CUTS} query="" onOpen={addr.open} noun="cut" testId="watchers" onSay={cuts.say} open={cuts.open} />
            {cuts.said && (
              <p role="status" className="mb-2 font-mono text-[11px] text-textSecondary">
                {cuts.said}
              </p>
            )}
            {read}
          </>
        }
      >
        {record.total > 0 && (
          <div className="px-5 pb-3 max-sm:px-4" data-watchers-record>
            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[12px] text-textSecondary">
              <span className="text-[11px] font-semibold text-textPrimary">{record.closed ? 'Moved its way by the close' : 'Moved its way since the flag'}</span>
              <span className="tnum" data-record-with>
                <span className="font-semibold text-textPrimary">{num(record.with)}</span> of {num(record.total)} flagged prints{filtered ? ' on this cut' : ' today'}
              </span>
              <span className="text-textMuted" aria-hidden>
                ·
              </span>
              <span className="tnum">{num(record.against)} moved against</span>
              <span className="text-textMuted" aria-hidden>
                ·
              </span>
              <span className="tnum" title={`Under ${FLAT_PCT}% either way`}>
                {num(record.flat)} barely moved
              </span>
              <button
                type="button"
                onClick={() => setMissesOpen(o => !o)}
                aria-expanded={missesOpen}
                aria-controls="watchers-misses"
                className="hit inline-flex items-center gap-1 h-6 px-2 rounded-md border border-borderSubtle text-[11px] text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors"
                data-record-misses
              >
                {missesOpen ? 'Hide' : 'List'} the {num(misses.length)} that did not <ChevronDown className={`w-3 h-3 transition-transform ${missesOpen ? 'rotate-180' : ''}`} aria-hidden />
              </button>
            </div>
            <p className="mt-0.5 text-[11px] text-textMuted">
              A call at the ask or a put on the bid leans up; a put at the ask or a call on the bid leans down. The stock from the minute the print was flagged to {record.closed ? 'the close' : 'now'} — every flagged print counted, not only the tracked ones.
            </p>
            {missesOpen && (
              <ul id="watchers-misses" className="mt-2 max-h-[260px] overflow-y-auto border border-borderSubtle rounded-md divide-y divide-borderSubtle/60" data-watchers-misses>
                {misses.map(f => (
                  <MissRow key={f.c.id} f={f} reason={reasonOf(f.c.rule)?.label ?? ''} onOpen={() => setOpenKey(f.c.row.key)} />
                ))}
              </ul>
            )}
          </div>
        )}
        <TraceGrid rows={shown} columns={columns} hidden={hidden} widths={WIDTHS} flexes={FLEXES} tooltips={TOOLTIPS}  rowKey={keyOf} onRowClick={openRow} selectedKey={selectedId} pinLeft={PIN_LEFT} pinRight={PIN_RIGHT} phoneRow={phoneRow} autoHeight noun="prints" emptyText="Nothing flagged yet" emptyBody="The desk is watching — a clip that clears the bar lands here the moment it prints." testId="watchers" />
      </TraceBox>

      <BookDrill list={drillList} openKey={openKey} onOpen={setOpenKey} clipFor={clipFor} tick={tick} />
    </>
  );
};

export default Watchers;
