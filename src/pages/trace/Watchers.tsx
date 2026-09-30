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
import { CalendarDays } from 'lucide-react';
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
import TraceBox, { Champion, Fact, TraceGrid } from '../../components/trace/TraceBox';
import { WatchersGuide } from '../../components/trace/TraceGuide';

const num = (v: number) => v.toLocaleString('en-US');

/* THE CARDS (the walk, 2026-09-09) */
const SIDE_OPTIONS: DropdownOption<'ALL' | 'C' | 'P'>[] = [
  { value: 'ALL', label: 'Both', hint: 'Calls and puts' },
  { value: 'C', label: 'Calls', hint: 'Calls only' },
  { value: 'P', label: 'Puts', hint: 'Puts only' },
];
const WIDTHS: Record<string, number> = { time: 92, ticker: 96, contract: 150, dte: 64, clip: 118, clipprem: 92, sideCol: 64, otm: 76, earn: 84 };
const FLEXES: Record<string, number> = { reason: 3 };
const TOOLTIPS: Record<string, string> = {
  reason: "Why the contract is in front of you — the desk's watchers, or one you wrote (the hollow ring)",
  clip: 'The print that tripped the reason — its size and fill',
  clipprem: "That print's money",
  sideCol: 'At the ask, the contract being bought; on the bid, sold',
  voloi: 'Volume over open interest — above 1.5 the positions were built today',
};

/** Categorical reason dots — same idea as sector dots: a hue names the kind. */
const RULE_DOT: Record<WatcherKey, string> = {
  'big-money': '#9B8FE8',
  'into-earnings': '#E0D080',
  climbing: '#6ECFC4',
  falling: '#E89AC0',
  'fresh-size': '#7EA6F0',
  hammering: '#E8C468',
};

const RULE_META = Object.fromEntries(WATCHERS.map(r => [r.key, r])) as Record<
  WatcherKey,
  (typeof WATCHERS)[number]
>;

const Watchers = () => {
  const { marketData, activeTicker } = useMarketData();
  const [rule, setRule] = useState<string>('ALL');
  const [side, setSide] = useState<'ALL' | 'C' | 'P'>('ALL');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const myReasons = useReasons();

  const liveBook = useMemo(
    () => buildFlowBook(Simulator.universeQuotes(activeTicker)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTicker, marketData]
  );
  // The shared hold (see LiveHold): book and tick freeze together while paused.
  const hold = useHold(useMemo(() => ({ book: liveBook, tick: marketData }), [liveBook, marketData]), activeTicker);
  const { book: heldBook, tick } = hold.value;
  /* THE EXPIRY CUT (2026-09-12): the watchers run over the cut book */
  const { expiry, setExpiry, expiries, cut: cutExpiry, chosen } = useExpiryCut(heldBook, r => r.expiry);
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
            <span
              className="inline-flex items-center gap-1.5 text-[11px] text-textPrimary"
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
                <>
                  <span className="font-semibold">{meta.label}</span>
                  <span className="text-textSecondary truncate">{meta.phrase}</span>
                </>
              ) : (
                meta.phrase
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
            {num(a.clipSize)} <span className="text-[10px] text-textSecondary">@ ${a.clipFill.toFixed(2)}</span>
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
        // The tape's rule: at the ask = the contract being bought.
        render: a => (
          <span className={`text-[10px] ${a.side === 'ASK' ? 'text-bull' : 'text-bear'}`}>{a.side}</span>
        ),
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
            {a.row.otmPct >= 0 ? '+' : ''}
            {a.row.otmPct.toFixed(1)}%
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
            <Fact label="Caught today" testId="caught">
              {num(facts.total)}
              {facts.loudName && (
                <span className="text-textSecondary">
                  {' '}
                  · {facts.loudCount} {facts.loudName.toLowerCase()}
                </span>
              )}
            </Fact>
            <Fact label="From your reasons" testId="mine">
              <span className={facts.mine > 0 ? 'text-textPrimary' : 'text-textSecondary'}>{facts.mine}</span>
            </Fact>
            {champs.ask && champs.ask !== champs.all && (
              <Champion label="Top ask" ink="bull" onOpen={() => setOpenKey(champs.ask!.row.key)} testId="top-ask">
                {pill(champs.ask)}
              </Champion>
            )}
            {champs.bid && champs.bid !== champs.all && (
              <Champion label="Top bid" ink="bear" onOpen={() => setOpenKey(champs.bid!.row.key)} testId="top-bid">
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
            <FlowSearch value={query} onChange={setQuery} rows={searchRows} countNoun="contracts" />
            <DropdownSelect label="Reason" value={rule} options={reasonOptions} onChange={setRule} title="Which watcher's catches" testId="watchers-reason" />
            <DropdownSelect label="Side" value={side} options={SIDE_OPTIONS} onChange={setSide} title="Calls, puts or both" testId="watchers-side" />
            <ExpiryCalendar value={chosen ? isoDate(chosen.date) : ''} expiries={expiries} onChange={e => setExpiry(isoDate(e.date))} onClear={() => setExpiry(null)} label="Expiry" icon={CalendarDays} steppers={false} title="Only contracts on one expiry — or every expiry" testId="watchers-expiry" />
            <ReasonDoor book={book} />
            <div className="ml-auto">
              <ColumnChooser columns={chooserCols} hidden={hidden} onToggle={toggle} onAll={showAll} onNone={() => hideAll(columns.map(c => c.key))} />
            </div>
          </>
        }
        sentence={read}
      >
        <TraceGrid rows={shown} columns={columns} hidden={hidden} widths={WIDTHS} flexes={FLEXES} tooltips={TOOLTIPS} rowKey={keyOf} onRowClick={openRow} selectedKey={selectedId} autoHeight emptyText="Nothing flagged yet" emptyBody="The desk is watching — a clip that clears the bar lands here the moment it prints." testId="watchers" />
      </TraceBox>

      <BookDrill list={drillList} openKey={openKey} onOpen={setOpenKey} clipFor={clipFor} tick={tick} />
    </>
  );
};

export default Watchers;
