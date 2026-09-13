/*
==================================================
  SLAYER TERMINAL - TRACKER (Trace)

  Everything the reader bookmarked on the Trace
  pages, and what it has done since (Noah,
  2026-09-03: "what do you think should be the
  display format of the bookmarked rows" → "build
  it"). A Compass setup is a thesis with a verdict,
  so the Compass tracker deals in cards. A Trace
  bookmark is a FACT the reader wants to follow up
  on, so this page deals in rows, and the one
  question every row answers is: what has it done
  since I marked it?

  ONE GRID, NOT THREE (Noah, same day, on the first
  cut's three stacked tables: "do you see how the
  columns arent aligned? i know they shouldnt be
  which makes it a lose lose situation"). Two
  tables with different column sets can never line
  up, and pinning widths would align three columns
  and stagger the rest. So there is one table. The
  facts every kind of mark shares — the name, the
  contract, when and where it was marked, its price
  now against then, the underlying then and now,
  volume and interest added, the lean then and now
  — are columns. The facts only one kind carries —
  a print's size, fill and side; a structure's size
  and net; a contract's last — are composed into
  ONE "Then" cell, the way the contract cell
  composes strike, side and expiry. Rows rank by
  how much they moved, whatever they are.

  A contract no longer on today's book sits with
  its THEN intact and its SINCE blank — a bookmark
  is never silently dropped. A print's contract is
  USUALLY off the book (the tape and the book draw
  strikes apart), which is why the underlying's
  move is a column every row can carry.
==================================================
*/

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { useMarketData } from '../../context/MarketDataContext';
import { contractKey, useWatch, type WatchSource, type WatchedItem } from '../../context/WatchContext';
import Simulator from '../../core/simulator';
import { buildFlowBook } from '../../data/flowBook';
import { fmtUsd } from '../../data/gex';
import type { BookContract } from '../../types/trace';
import type { Column } from '../../components/ui/DataTable';
import CompanyLogo from '../../components/ui/CompanyLogo';
import RichRead from '../../components/ui/RichRead';
import BookDrill from '../../components/trace/BookDrill';
import ContractCell from '../../components/trace/ContractCell';
import { DOOR, DOOR_GROUP_TEXT } from '../../components/trace/door';
import { directionInk, earnMarks, weightInk } from '../../components/trace/earnedInk';
import FlowSearch, { normSymbol } from '../../components/trace/FlowSearch';
import { LiveHold, useHold } from '../../components/trace/LiveHold';
import ExpiryCalendar from '../../components/ui/ExpiryCalendar';
import { useExpiryCut } from '../../components/trace/bookExpiry';
import { isoDate } from '../../core/calendar';
import ReadDoor from '../../components/trace/ReadDoor';
import WatchStar from '../../components/trace/WatchStar';
import TraceBox, { Champion, Fact, TraceGrid } from '../../components/trace/TraceBox';
import { TrackerGuide } from '../../components/trace/TraceGuide';

const num = (v: number) => v.toLocaleString('en-US');
const signedPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
const signedNum = (v: number) => `${v >= 0 ? '+' : ''}${num(v)}`;
const pct = (now: number, then: number) => (then > 0 ? ((now - then) / then) * 100 : 0);

const SOURCE_LABEL: Record<WatchSource, string> = {
  tape: 'Live Tape',
  screener: 'Screener',
  footprints: 'Footprints',
  watchers: 'Watchers',
  windows: 'Windows',
  'multi-leg': 'Multi-Leg',
  card: 'the card',
};

/** "14:22" today, "09/02 14:22" for an older mark — the house's 24-hour clock. */
function markedAt(ms: number): string {
  const d = new Date(ms);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const today = new Date();
  const sameDay = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  return sameDay ? hm : `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${hm}`;
}

/** The lean as the Lean cell would say it, in its ink — for a then → now pair. */
const leanWord = (askPct: number) => {
  const bid = 100 - askPct;
  const mid = Math.abs(askPct - 50) < 6;
  return {
    text: mid ? 'MID' : bid >= 50 ? `BID ${bid}%` : `ASK ${askPct}%`,
    ink: mid ? 'text-textSecondary' : bid >= 50 ? 'text-bear' : 'text-bull',
  };
};

const Dash = () => <span className="text-textSecondary">—</span>;

/** Fixed widths for the figure columns (the spot's then → now and its change would otherwise clip); the name, contract and mark share the rest */
const WIDTHS: Record<string, number> = { then: 170, money: 90, since: 140, spot: 200, vol: 96, oi: 96, lean: 160 };
const FLEXES: Record<string, number> = { ticker: 1, contract: 2, marked: 1.4 };

// ---- one row shape for every kind of mark ----------------------------------------

interface TrackRow {
  w: WatchedItem;
  /** The contract on today's book, when the book carries it */
  live: BookContract | null;
  /** Its price now against the price marked (last, or the print's fill), % */
  chg: number | null;
  spotThen: number;
  spotNow: number | null;
  spotChg: number | null;
  volAdded: number | null;
  oiDelta: number | null;
  leanThen: number | null;
  leanNow: number | null;
  /** The sort: the price move when the book can give one, else the underlying's */
  moved: number;
}

const FlowTracker = () => {
  const navigate = useNavigate();
  const { marketData, activeTicker } = useMarketData();
  const { watched } = useWatch();
  const [query, setQuery] = useState('');
  /** The open card: a contract's key, and the print clip when opened from a print row. */
  const [open, setOpen] = useState<{ key: string; clip?: { size: number; fill: number; side: 'ASK' | 'BID'; time: string } } | null>(null);

  const liveBook = useMemo(
    () => buildFlowBook(Simulator.universeQuotes(activeTicker)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTicker, marketData]
  );
  // The shared hold (see LiveHold): the SINCE columns freeze with the tick.
  const hold = useHold(useMemo(() => ({ book: liveBook, tick: marketData }), [liveBook, marketData]), activeTicker);
  const { book, tick } = hold.value;
  const [guideOpen, setGuideOpen] = useState(false);

  /* Today's book by contract key — the "now" every row is measured against. */
  const byKey = useMemo(() => {
    const m = new Map<string, BookContract>();
    for (const r of book) m.set(contractKey(r), r);
    return m;
  }, [book]);

  const nq = normSymbol(query);
  /* THE EXPIRY CUT (2026-09-12): every mark carries its expiry — a contract's,
     a print's, a structure's near leg */
  const { expiry, setExpiry, expiries, cut: cutExpiry, chosen } = useExpiryCut(watched, w => w.expiry);

  const rows = useMemo<TrackRow[]>(
    () =>
      cutExpiry(watched)
        .filter(w => nq === '' || normSymbol(w.ticker).includes(nq))
        .map(w => {
          Simulator.ensureTicker(w.ticker);
          const spotNow = Simulator.TICKERS[w.ticker]?.currentPrice ?? null;
          const spotThen = w.at.spot;
          const spotChg = spotNow != null ? pct(spotNow, spotThen) : null;
          if (w.kind === 'structure') {
            return { w, live: null, chg: null, spotThen, spotNow, spotChg, volAdded: null, oiDelta: null, leanThen: null, leanNow: null, moved: spotChg ?? 0 };
          }
          const live = byKey.get(contractKey(w)) ?? null;
          const then = w.kind === 'contract' ? w.at.last : w.fill;
          const chg = live ? pct(live.last, then) : null;
          return {
            w,
            live,
            chg,
            spotThen,
            spotNow,
            spotChg,
            volAdded: live ? live.volume - w.at.volume : null,
            oiDelta: live ? live.oi - w.at.oi : null,
            leanThen: w.kind === 'contract' ? w.at.askPct : null,
            leanNow: live ? live.askPct : null,
            moved: chg ?? spotChg ?? 0,
          };
        })
        .sort((a, b) => Math.abs(b.moved) - Math.abs(a.moved)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [watched, byKey, nq, tick, cutExpiry]
  );

  /* Three registers per column, measured over what is on screen. */
  const marks = useMemo(
    () => ({
      chg: earnMarks(rows, r => r.chg ?? 0),
      spot: earnMarks(rows, r => r.spotChg ?? 0),
      vol: earnMarks(rows, r => r.volAdded ?? 0),
      oi: earnMarks(rows, r => r.oiDelta ?? 0),
    }),
    [rows]
  );

  /* The card: the contract's live row, with the print's own clip when the
     row was a print. Stepping walks the table's own order. */
  const drillList = useMemo(() => {
    const seen = new Set<string>();
    const out: BookContract[] = [];
    for (const r of rows) {
      if (r.live && !seen.has(r.live.key)) {
        seen.add(r.live.key);
        out.push(r.live);
      }
    }
    return out;
  }, [rows]);
  const clipFor = useCallback((row: BookContract) => (open && row.key === open.key ? open.clip : undefined), [open]);
  const openRow = useCallback((r: TrackRow) => {
    if (!r.live) return;
    const w = r.w;
    setOpen({
      key: r.live.key,
      clip: w.kind === 'print' && w.side !== 'MID' ? { size: w.size, fill: w.fill, side: w.side, time: w.time } : undefined,
    });
  }, []);
  const keyOf = useCallback((r: TrackRow) => r.w.key, []);
  /* A contract that has left the book dims; a print's contract being off
     the book is the usual case, and a structure never had one — they don't. */
  const dimGone = useCallback((r: TrackRow) => (r.w.kind === 'contract' && !r.live ? 'opacity-50' : undefined), []);

  const columns = useMemo<Column<TrackRow>[]>(
    () => [
      {
        key: 'ticker',
        header: 'Ticker',
        sortValue: r => r.w.ticker,
        render: r => (
          <span className="inline-flex items-center gap-1.5">
            <WatchStar k={r.w.key} make={() => r.w} noun={r.w.kind} />
            <CompanyLogo ticker={r.w.ticker} size={15} />
            <span className="font-bold text-textPrimary">{r.w.ticker}</span>
          </span>
        ),
      },
      {
        key: 'contract',
        header: 'Contract',
        align: 'right',
        sortValue: r => (r.w.kind === 'structure' ? 0 : r.w.strike),
        // A structure's cell in the contract cell's own shape: strikes bold,
        // the strategy as its word, the expiry muted, the same door.
        render: r =>
          r.w.kind === 'structure' ? (
            <span className={`group/door inline-flex items-baseline gap-1.5 pb-[2px] ${DOOR}`}>
              <span className={`font-mono text-xs font-bold text-textPrimary tnum ${DOOR_GROUP_TEXT}`}>{r.w.strikesLabel}</span>
              <span className="font-mono text-[11px] font-semibold text-textPrimary">{r.w.spreadKind}</span>
              <span className="font-mono text-[10px] text-textSecondary tnum">{r.w.expiry}</span>
            </span>
          ) : (
            <ContractCell strike={r.w.strike} right={r.w.right} expiry={r.w.expiry} />
          ),
      },
      {
        key: 'marked',
        header: 'Marked',
        sortValue: r => r.w.watchedAt,
        render: r => (
          <span className="text-[10px] text-textPrimary whitespace-nowrap">
            {markedAt(r.w.watchedAt)} <span className="text-textSecondary">· {SOURCE_LABEL[r.w.from]}</span>
          </span>
        ),
      },
      {
        key: 'then',
        header: 'Then',
        align: 'right',
        sortValue: r => (r.w.kind === 'contract' ? r.w.at.last : r.w.kind === 'print' ? r.w.fill : Math.abs(r.w.net)),
        // What was marked, in its own words: a contract's last, a print as
        // it printed, a structure as it traded.
        render: r => {
          const w = r.w;
          if (w.kind === 'contract')
            return (
              <span className="text-textSecondary">
                last <span className="text-textPrimary">${w.at.last.toFixed(2)}</span>
              </span>
            );
          if (w.kind === 'print')
            return (
              <span className="text-textSecondary">
                <span className="text-textPrimary">{num(w.size)}</span> @ <span className="text-textPrimary">${w.fill.toFixed(2)}</span>{' '}
                <span className={`text-[10px] ${w.side === 'ASK' ? 'text-bull' : w.side === 'BID' ? 'text-bear' : 'text-textSecondary'}`}>
                  {w.side === 'ASK' ? 'BUY' : w.side === 'BID' ? 'SELL' : 'MID'}
                  {w.sweep ? ' · SWEEP' : ''}
                </span>
              </span>
            );
          return (
            <span className="text-textSecondary">
              <span className="text-textPrimary">{num(w.size)}×</span> @ <span className="text-textPrimary">${Math.abs(w.net).toFixed(2)}</span>{' '}
              <span className="text-[10px]">{w.net >= 0 ? 'debit' : 'credit'}</span>
            </span>
          );
        },
      },
      {
        key: 'money',
        header: 'Then $',
        align: 'right',
        sortValue: r => (r.w.kind === 'contract' ? r.w.at.premium : r.w.premium),
        // The dollars behind the mark: the print's premium, the structure's,
        // a contract's day when it was marked.
        render: r => <span className="text-textPrimary">{fmtUsd(r.w.kind === 'contract' ? r.w.at.premium : r.w.premium)}</span>,
      },
      {
        key: 'since',
        header: 'Now · since',
        align: 'right',
        sortValue: r => r.chg ?? -Infinity,
        render: r =>
          r.live ? (
            <span className="text-textPrimary">
              ${r.live.last.toFixed(2)} <span className={`text-[10px] ${directionInk(r.chg ?? 0, marks.chg)}`}>{signedPct(r.chg ?? 0)}</span>
            </span>
          ) : r.w.kind === 'structure' ? (
            <Dash />
          ) : (
            <span
              className="text-[10px] text-textSecondary"
              title={
                r.w.kind === 'contract'
                  ? 'This contract is not on today’s book — it expired, or the day rolled'
                  : 'The book does not carry this contract today — the underlying’s move is beside it'
              }
            >
              {r.w.kind === 'contract' ? 'off today’s book' : 'not on the book'}
            </span>
          ),
      },
      {
        key: 'spot',
        header: 'Spot then → now',
        align: 'right',
        sortValue: r => r.spotChg ?? -Infinity,
        render: r =>
          r.spotNow == null ? (
            <span className="text-textPrimary">${r.spotThen.toFixed(2)}</span>
          ) : (
            <span className="text-textPrimary">
              ${r.spotThen.toFixed(2)} <span className="text-textSecondary">→</span> <span className="text-textPrimary">${r.spotNow.toFixed(2)}</span>{' '}
              <span className={`text-[10px] ${directionInk(r.spotChg ?? 0, marks.spot)}`}>{signedPct(r.spotChg ?? 0)}</span>
            </span>
          ),
      },
      {
        key: 'vol',
        header: 'Vol added',
        align: 'right',
        sortValue: r => r.volAdded ?? -Infinity,
        render: r => (r.volAdded == null ? <Dash /> : <span className={weightInk(r.volAdded, marks.vol)}>{signedNum(r.volAdded)}</span>),
      },
      {
        key: 'oi',
        header: 'OI since',
        align: 'right',
        sortValue: r => r.oiDelta ?? -Infinity,
        render: r => (r.oiDelta == null ? <Dash /> : <span className={directionInk(r.oiDelta, marks.oi)}>{signedNum(r.oiDelta)}</span>),
      },
      {
        key: 'lean',
        header: 'Lean then → now',
        align: 'right',
        sortValue: r => r.leanNow ?? -1,
        render: r => {
          if (r.leanNow == null && r.leanThen == null) return <Dash />;
          const then = r.leanThen != null ? leanWord(r.leanThen) : null;
          const now = r.leanNow != null ? leanWord(r.leanNow) : null;
          return (
            <span className="font-mono text-[9px] font-semibold uppercase tracking-wide tnum whitespace-nowrap">
              {then ? <span className={then.ink}>{then.text}</span> : <span className="text-textSecondary">—</span>}
              <span className="text-textSecondary"> → </span>
              {now ? <span className={now.ink}>{now.text}</span> : <span className="text-textSecondary">—</span>}
            </span>
          );
        },
      },
    ],
    [marks]
  );

  // ---- the head ------------------------------------------------------------------

  const total = watched.length;
  const counts = useMemo(
    () => ({
      contracts: watched.filter(w => w.kind === 'contract').length,
      prints: watched.filter(w => w.kind === 'print').length,
      structures: watched.filter(w => w.kind === 'structure').length,
    }),
    [watched]
  );
  /* The champions: the mark that moved most since (a real move, not +0.0%),
     the one building the most interest, the one unwinding the most. */
  const champs = useMemo(() => {
    const label = (r: TrackRow) => (r.w.kind === 'structure' ? `${r.w.ticker} ${r.w.strikesLabel}` : `${r.w.ticker} ${r.w.strike}${r.w.right}`);
    const priced = rows.filter(r => r.chg != null);
    const moved = priced.reduce<TrackRow | null>((a, r) => (Math.abs(r.chg!) >= 0.05 && (a === null || Math.abs(r.chg!) > Math.abs(a.chg!)) ? r : a), null);
    const building = priced.reduce<TrackRow | null>((a, r) => ((r.oiDelta ?? 0) > 0 && (a === null || r.oiDelta! > a.oiDelta!) ? r : a), null);
    const unwinding = priced.reduce<TrackRow | null>((a, r) => ((r.oiDelta ?? 0) < 0 && (a === null || r.oiDelta! < a.oiDelta!) ? r : a), null);
    return { moved, building, unwinding, label };
  }, [rows]);

  const read = useMemo<ReactNode>(() => {
    if (total === 0) return <RichRead text="Nothing under watch yet." />;
    const parts = [
      counts.contracts ? `${counts.contracts} contract${counts.contracts === 1 ? '' : 's'}` : '',
      counts.prints ? `${counts.prints} print${counts.prints === 1 ? '' : 's'}` : '',
      counts.structures ? `${counts.structures} structure${counts.structures === 1 ? '' : 's'}` : '',
    ].filter(Boolean);
    const what = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
    const gone = rows.filter(r => r.w.kind === 'contract' && !r.live).length;
    const m = champs.moved;
    return (
      <>
        <RichRead text={`${what} under watch${gone ? `, ${gone} no longer on today’s book` : ''}. `} />
        {m ? (
          <>
            <RichRead text="Moved most since its mark: " />
            <ReadDoor onOpen={() => openRow(m)}>{champs.label(m)}</ReadDoor>
            <RichRead text={`, [[${signedPct(m.chg!)}]] on the ${m.w.kind === 'print' ? 'fill' : 'last'}.`} />
          </>
        ) : (
          <RichRead text="Nothing has moved since its mark yet." />
        )}
      </>
    );
  }, [total, counts, rows, champs, openRow]);

  const searchRows = useMemo(
    () =>
      watched.map(w => ({
        ticker: w.ticker,
        strike: w.kind === 'structure' ? 0 : w.strike,
        right: w.kind === 'structure' ? ('C' as const) : w.right,
        premium: w.kind === 'contract' ? w.at.premium : w.premium,
      })),
    [watched]
  );

  const selectedKey = open ? (rows.find(r => r.live?.key === open.key && (open.clip ? r.w.kind === 'print' : r.w.kind === 'contract'))?.w.key ?? null) : null;

  return (
    <>
      <TraceBox
        title="Under watch"
        sub="Everything you marked on Trace — and what it has done since · a row opens its card"
        testId="tracker"
        data={{ watched: total, rows: rows.length, expiry: expiry ?? 'all' }}
        guide={{ title: 'How to read the watch', door: 'What a mark and the since columns mean', body: <TrackerGuide />, testId: 'tracker-guide', open: guideOpen, onOpen: setGuideOpen }}
        facts={
          <>
            <Fact label="Under watch" testId="watched">
              {nq ? `${rows.length} of ${total}` : total}
            </Fact>
            <Fact label="Contracts · prints · structures" testId="kinds">
              {counts.contracts} <span className="text-textSecondary">·</span> {counts.prints} <span className="text-textSecondary">·</span> {counts.structures}
            </Fact>
            {champs.building && champs.building !== champs.moved && (
              <Champion label="Building" ink="bull" onOpen={() => openRow(champs.building!)} testId="building">
                {champs.label(champs.building)} · {signedNum(champs.building.oiDelta!)} OI
              </Champion>
            )}
            {champs.unwinding && champs.unwinding !== champs.moved && (
              <Champion label="Unwinding" ink="bear" onOpen={() => openRow(champs.unwinding!)} testId="unwinding">
                {champs.label(champs.unwinding)} · {signedNum(champs.unwinding.oiDelta!)} OI
              </Champion>
            )}
            {champs.moved && (
              <Champion label="Moved most" ink="supreme" onOpen={() => openRow(champs.moved!)} testId="moved">
                {champs.label(champs.moved)} · {signedPct(champs.moved.chg!)}
              </Champion>
            )}
          </>
        }
        controls={
          <>
            <LiveHold paused={hold.paused} onToggle={hold.toggle} heldAt={hold.heldAt} />
            <FlowSearch value={query} onChange={setQuery} rows={searchRows} countNoun="marks" tickersOnly />
            <ExpiryCalendar value={chosen ? isoDate(chosen.date) : ''} expiries={expiries} onChange={e => setExpiry(isoDate(e.date))} onClear={() => setExpiry(null)} label="Expiry" icon={CalendarDays} steppers={false} title="Only marks on one expiry — or every expiry" testId="tracker-expiry" />
          </>
        }
        sentence={read}
      >
        {total === 0 ? (
          /* The empty state is a sentence with doors, not a grid */
          <div className="border-t border-borderSubtle px-5 pt-5 pb-6 text-[12px] text-textSecondary leading-relaxed" data-tracker-empty>
            Nothing is under watch. The mark at the left of any row on the <ReadDoor onOpen={() => navigate('/trace/live-tape')}>Live Tape</ReadDoor>, the <ReadDoor onOpen={() => navigate('/trace/screener')}>Screener</ReadDoor> or any other Trace page keeps it here, with what it has done since.
          </div>
        ) : (
          <TraceGrid rows={rows} columns={columns} widths={WIDTHS} flexes={FLEXES} rowKey={keyOf} onRowClick={openRow} selectedKey={selectedKey} rowClass={dimGone} autoHeight emptyText="Nothing under watch on that name" testId="tracker" />
        )}
      </TraceBox>

      <BookDrill list={drillList} openKey={open?.key ?? null} onOpen={k => setOpen(k ? { key: k } : null)} clipFor={clipFor} tick={tick} />
    </>
  );
};

export default FlowTracker;
