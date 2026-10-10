/*
==================================================
  SLAYER TERMINAL - NET FLOW (Trace)
  Which way is each name's money leaning (Noah,
  2026-08-30; walked into the house grammar
  2026-09-09): one box — the head with the board's
  facts and its two loudest names as champions, the
  live hold and a names-only search on the cards
  line, the sentence — and the body: THE BOARD on
  the left, every name ranked most bullish to most
  bearish by net premium, and THE PANE on the
  right, the picked name through the session (its
  own candles as the spot line, net call and put
  lines, cut by money and by clock). Board and
  chart come from the same series generator, so
  they can never disagree.
==================================================
*/

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { useMarketData } from '../../context/MarketDataContext';
import Simulator from '../../core/simulator';
import { buildFlowBook, buildNetLeaders, type MoneynessKey } from '../../data/flowBook';
import { fmtUsd } from '../../data/gex';
import type { SleeveKey } from '../../types/compass';
import CompanyLogo from '../../components/ui/CompanyLogo';
import RichRead from '../../components/ui/RichRead';
import Lean from '../../components/trace/Lean';
import NetFlowPane, { paneTimes } from '../../components/trace/NetFlowPane';
import { directionInk, earnMarks } from '../../components/trace/earnedInk';
import FlowSearch from '../../components/trace/FlowSearch';
import { LiveHold, useHold } from '../../components/trace/LiveHold';
import ReadDoor from '../../components/trace/ReadDoor';
import TraceBox, { Champion, Fact } from '../../components/trace/TraceBox';
import { NetFlowGuide } from '../../components/trace/TraceGuide';
import ExpiryCalendar, { expiryWords } from '../../components/ui/ExpiryCalendar';
import { useExpiryCut } from '../../components/trace/bookExpiry';
import { isoDate } from '../../core/calendar';
import { num as fmtNum, usdCompactSigned } from '../../core/format';

const num = (v: number) => fmtNum(v);
const signed = usdCompactSigned;

/** What another page may hand this one (the 0DTE desk's door, 2026-09-03). */
interface NetFlowHandoff {
  ticker?: string | null;
  tenor?: SleeveKey | 'all';
}
const TENORS = new Set<string>(['all', 'odte', 'weekly', 'swing', 'leaps']);

const NetFlow = () => {
  const { marketData, activeTicker } = useMarketData();
  /* Arriving through a door: the name goes on the pane and the clock is set before the first paint */
  const handoff = (useLocation().state ?? null) as NetFlowHandoff | null;
  const [picked, setPicked] = useState<string | null>(() => (typeof handoff?.ticker === 'string' && /^[A-Z0-9.]{1,6}$/.test(handoff.ticker) ? handoff.ticker : null));
  /* THE FIELD IS NOT THE PICK (the audit's TR-37): anything typed went on the pane — "ZZZZ" drew letter logos and an
     invented price line. The field holds what is typed; the pane takes a name only when the book carries it, and keeps
     the last real one meanwhile. */
  const [query, setQuery] = useState<string>(picked ?? '');
  const [mny, setMny] = useState<MoneynessKey>('all');
  const [tenor, setTenor] = useState<SleeveKey | 'all'>(() => (typeof handoff?.tenor === 'string' && TENORS.has(handoff.tenor) ? handoff.tenor : 'all'));
  const [guideOpen, setGuideOpen] = useState(false);

  const liveBook = useMemo(
    () => buildFlowBook(Simulator.universeQuotes(activeTicker)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTicker, marketData]
  );
  // The shared hold (see LiveHold): the board's book and the pane's tick freeze together while paused
  const hold = useHold(useMemo(() => ({ book: liveBook, tick: marketData }), [liveBook, marketData]), activeTicker);
  const { book: heldBook, tick } = hold.value;
  /* THE EXPIRY CUT (2026-09-12) — the dates on the book, as a calendar; the
     board and the pane both read the cut book, so they cannot disagree */
  const { expiry, setExpiry: setExpiryRaw, expiries, cut: cutExpiry, chosen } = useExpiryCut(heldBook, r => r.expiry);
  const book = useMemo(() => cutExpiry(heldBook), [heldBook, cutExpiry]);
  const known = useMemo(() => new Set(heldBook.map(r => r.ticker)), [heldBook]);
  const onQuery = (v: string) => {
    setQuery(v);
    if (!v) setPicked(null);
    else if (known.has(v)) setPicked(v);
  };
  const unknown = query !== '' && !known.has(query) && ![...known].some(t => t.startsWith(query));
  /* Sampled at the chart tape's last bar — the pane draws to the SIM tape's now */
  const leaders = useMemo(() => buildNetLeaders(book, paneTimes('SPY').slice(-1)[0], expiry ?? 'all'), [book, expiry]);

  const sel = picked ?? leaders[0]?.ticker ?? 'SPY';
  /* AN EXPIRY KEEPS THE NAME ON THE PANE (the audit's TR-40): with no name picked the pane followed the board's leader,
     so a new expiry swapped GOOGL for COIN unasked — the name on the pane is held as the cut changes */
  const setExpiry = (iso: string | null) => {
    setPicked(p => p ?? sel);
    setExpiryRaw(iso);
  };
  const maxAbs = useMemo(() => Math.max(...leaders.map(l => Math.abs(l.net)), 1), [leaders]);
  const netMarks = useMemo(() => earnMarks(leaders, l => l.net), [leaders]);

  const facts = useMemo(() => {
    const total = leaders.reduce((a, l) => a + l.net, 0);
    const volume = leaders.reduce((a, l) => a + l.volume, 0);
    const calls = leaders.reduce((a, l) => a + l.netCall, 0);
    const puts = leaders.reduce((a, l) => a + l.netPut, 0);
    const contracts = leaders.reduce((a, l) => a + l.count, 0);
    /* the board's gross lean — every name's share of it is printed on its row */
    const gross = leaders.reduce((a, l) => a + Math.abs(l.net), 0) || 1;
    const bullish = leaders.filter(l => l.net > 0).length;
    const top = leaders[0] ?? null;
    const bottom = leaders.length ? leaders[leaders.length - 1] : null;
    const topIsChamp = !!top && !!bottom && Math.abs(top.net) >= Math.abs(bottom.net);
    const busiest = leaders.reduce<(typeof leaders)[number] | null>((a, l) => (a === null || l.volume > a.volume ? l : a), null);
    return { total, volume, calls, puts, contracts, gross, bullish, bearish: leaders.length - bullish, top, bottom, topIsChamp, busiest };
  }, [leaders]);

  /* ReactNode: both named leaders are doors — clicking puts that name on the pane */
  /* THE PARTS ADD UP (the audit's TR-38): "+$113.6M net … +$104.5M of it in calls and −$9.1M in puts" did not sum; the
     net is net calls LESS net puts, and the sentence says it that way, each figure in its meaning's ink */
  const read = useMemo<ReactNode>(() => {
    if (!facts.top || !facts.bottom) return <RichRead text="The book is still waking up." />;
    const { top, bottom, total, topIsChamp } = facts;
    const crown = (v: number, champ: boolean) => (champ ? <span className="font-semibold tnum text-supreme">{signed(v)}</span> : <Lean v={v} />);
    return (
      <>
        <RichRead text={`${chosen ? `On ${expiryWords(chosen)}, the` : 'The'} board's money leans ${total >= 0 ? 'bullish' : 'bearish'} — `} />
        <Lean v={total} /> net across {leaders.length} names: net calls <Lean v={facts.calls} /> less net puts <Lean v={facts.puts} put />.{' '}
        <ReadDoor onOpen={() => onQuery(top.ticker)} title={`Put ${top.ticker} on the pane`}>
          {top.ticker}
        </ReadDoor>
        <RichRead text=" leads bullish at " />
        {crown(top.net, topIsChamp)}; <ReadDoor onOpen={() => onQuery(bottom.ticker)} title={`Put ${bottom.ticker} on the pane`}>
          {bottom.ticker}
        </ReadDoor>
        <RichRead text=" leans hardest bearish at " />
        {crown(bottom.net, !topIsChamp)}.
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facts, leaders.length, chosen]);

  /* The search PICKS a name (it is a board, not a filter); the board scrolls the picked row into view */
  const boardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!picked) return;
    boardRef.current?.querySelector<HTMLElement>(`[data-ticker="${picked}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [picked]);

  const champ = facts.topIsChamp ? facts.top : facts.bottom;

  return (
    <TraceBox
      title="Which way the money leans"
      sub="Every name ranked most bullish to most bearish by net premium — net calls less net puts · click a name and its session goes on the pane"
      testId="net-flow"
      className="md:flex-1 md:min-h-0"
      data={{ picked: sel, names: leaders.length, expiry: expiry ?? 'all' }}
      guide={{ title: 'How to read the board', door: 'What the board, the lines and the floor mean', body: <NetFlowGuide />, testId: 'net-flow-guide', open: guideOpen, onOpen: setGuideOpen }}
      facts={
        <>
          <Fact label="Net across the board" testId="net">
            <span className={facts.total >= 0 ? 'text-bull' : 'text-bear'}>{signed(facts.total)}</span>
          </Fact>
          <Fact label="Net calls · net puts" testId="sides" title="Net call premium and net put premium across the board — the net is calls less puts">
            <Lean v={facts.calls} className="font-normal" /> <span className="text-textSecondary">·</span> <Lean v={facts.puts} put className="font-normal" />
          </Fact>
          <Fact label="Names" testId="names">
            {leaders.length} <span className="text-textSecondary">·</span> <span className="text-bull">{facts.bullish} bullish</span> <span className="text-textSecondary">·</span> <span className="text-bear">{facts.bearish} bearish</span>
          </Fact>
          <Fact label="Contracts traded" testId="volume" title="Volume across the board, and how many contracts carried it">
            {num(facts.volume)} <span className="text-textSecondary">· {num(facts.contracts)} contracts</span>
          </Fact>
          {facts.busiest && (
            <Champion label="Busiest name" ink="plain" title="Put this name on the pane" onOpen={() => onQuery(facts.busiest!.ticker)} testId="busiest">
              {facts.busiest.ticker} · {num(facts.busiest.volume)} vol
            </Champion>
          )}
          {facts.top && facts.bottom && !facts.topIsChamp && (
            <Champion label="Most bullish" ink="bull" title="Put this name on the pane" onOpen={() => onQuery(facts.top!.ticker)} testId="bullish">
              {facts.top.ticker} · {signed(facts.top.net)}
            </Champion>
          )}
          {facts.top && facts.bottom && facts.topIsChamp && (
            <Champion label="Most bearish" ink="bear" title="Put this name on the pane" onOpen={() => onQuery(facts.bottom!.ticker)} testId="bearish">
              {facts.bottom.ticker} · {signed(facts.bottom.net)}
            </Champion>
          )}
          {champ && (
            <Champion label="Largest lean" ink="supreme" title="Put this name on the pane" onOpen={() => onQuery(champ.ticker)} testId="largest">
              {champ.ticker} · {signed(champ.net)}
            </Champion>
          )}
        </>
      }
      controls={
        <>
          <LiveHold paused={hold.paused} onToggle={hold.toggle} heldAt={hold.heldAt} />
          <span className="inline-flex items-center gap-2 flex-wrap" data-span>
            <FlowSearch value={query} onChange={onQuery} rows={book} countNoun="contracts" tickersOnly />
            {unknown && (
              <span role="status" className="text-[11px] text-textSecondary" data-net-unknown>
                No contracts for {query} today — the pane keeps {sel}
              </span>
            )}
          </span>
          <ExpiryCalendar value={chosen ? isoDate(chosen.date) : ''} expiries={expiries} onChange={e => setExpiry(isoDate(e.date))} onClear={() => setExpiry(null)} label="Expiry" icon={CalendarDays} steppers={false} title="Only contracts on one expiry — or every expiry" testId="net-flow-expiry" />
        </>
      }
      sentence={read}
    >
      {/* ON A PHONE THE BOARD STANDS OVER THE PANE (2026-10-01): side by side at 390px the pane was squeezed to a 50px
          sliver beside the board — its chart and its menus cut off at the screen's edge */}
      <div className="flex max-md:flex-col md:flex-1 md:min-h-0 border-t border-borderSubtle">
        {/* THE BOARD — most bullish at the top, most bearish at the floor */}
        <div ref={boardRef} className="md:w-[290px] shrink-0 md:border-r max-md:border-b max-md:max-h-[306px] border-borderSubtle overflow-y-auto" data-net-board>
          {leaders.map((l, i) => {
            const isSel = l.ticker === sel;
            return (
              <button
                key={l.ticker}
                type="button"
                data-ticker={l.ticker}
                onClick={() => onQuery(l.ticker)}
                aria-pressed={isSel}
                className={`w-full flex flex-col gap-1 px-3 py-2 border-b border-borderSubtle/60 text-left transition-colors ${isSel ? 'bg-silver/[0.06] shadow-[inset_2px_0_0_0_rgb(var(--silver)/0.7)]' : 'hover:bg-silver/[0.04]'}`}
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-textPrimary tnum w-5">{String(i + 1).padStart(2, '0')}</span>
                  <CompanyLogo ticker={l.ticker} size={15} />
                  <span className="font-mono text-[11px] font-bold text-textPrimary">{l.ticker}</span>
                  {/* the name's share of the board's gross lean */}
                  <span className="font-mono text-[11px] tnum text-textSecondary" title="This name's share of the board's whole lean">
                    {Math.round((Math.abs(l.net) / facts.gross) * 100)}%
                  </span>
                  <span className={`ml-auto font-mono text-[11px] tnum ${directionInk(l.net, netMarks)}`}>{fmtUsd(l.net)}</span>
                </span>
                <span className="flex items-center gap-2 pl-7">
                  <span className="relative h-0.5 flex-1 rounded-full bg-ink/[0.06] overflow-hidden">
                    <span className={`absolute left-0 top-0 h-full ${l.net >= 0 ? 'bg-bull/60' : 'bg-bear/60'}`} style={{ width: `${Math.round((Math.abs(l.net) / maxAbs) * 100)}%` }} />
                  </span>
                  <span className="font-mono text-[11px] text-textPrimary tnum whitespace-nowrap" title={`Net calls, net puts, volume and the ${l.count} contracts traded on ${l.ticker} today`}>
                    C {fmtUsd(l.netCall)} · P {fmtUsd(l.netPut)} · {num(l.volume)} vol · {l.count} cons
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {/* THE PANE — the picked name's session */}
        <div className="flex-1 min-w-0 p-2 max-md:h-[460px] max-md:flex-none">
          <NetFlowPane book={book} seg="all" mny={mny} onSeg={() => {}} onMny={setMny} tick={tick} ticker={sel} tenor={tenor} onTenor={setTenor} dteMax={Infinity} />
        </div>
      </div>
    </TraceBox>
  );
};

export default NetFlow;
