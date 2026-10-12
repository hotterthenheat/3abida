/*
==================================================
  SLAYER TERMINAL - PINPOINT ON THE FEED
  (pages/pinpoint/feed/FeedPages.tsx)

  PINPOINT READS UNUSUAL WHALES (2026-10-12). With
  the room on the feed (rooms.ts pinpointSource),
  each page is drawn from UW's exposure by strike and
  what hangs on it, and nothing of the house's book:

    Map       the book by strike — the heatmap by
              listed date and the ladder, the
              levels with "How sure"
    Ahead     the move the options price in, by
              horizon; max pain on each listed date
    Building  what today's trading put at each
              strike (gamma from today's volume),
              open interest overnight, the book
              through the session
    At the wall  the named levels, what stands at
              each, how sure
    Targets   every strike in order of the
              hedging parked there
    Board     the names on the board, a row each
    Compare   two books side by side

  WHAT THE HOUSE'S PAGES MODEL — the odds a level is
  reached or holds, the range to the close, where it
  closes, the half-hour schedule, how the levels
  held, where they are heading — rests on the
  house's own session history, which the feed does
  not carry: each page names those in one quiet line
  ("not in the feed") and draws none of them.
==================================================
*/

import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { changeTicker, useActiveTicker } from '../../../context/MarketDataContext';
import { useFocus } from '../../../context/FocusContext';
import { numCompact, pct, pctSigned, usdCompact } from '../../../core/format';
import { SESSION_CLOSE_MIN, SESSION_OPEN_MIN } from '../../../core/nyTime';
import { CALL_WALL, FLIP, LONG_GAMMA, PUT_WALL, SHORT_GAMMA, SUPREME } from '../../../components/gex/paletteInk';
import { rowProps } from '../../../components/ui/rowKeys';
import ScopeChip from '../../../components/ui/ScopeChip';
import ReadThis from '../../../components/read/ReadThis';
import HowSure from '../../../components/levels/HowSure';
import OiChange from '../../../components/levels/OiChange';
import DealerTimeline from '../../../components/levels/DealerTimeline';
import ExposureLadder from '../../../components/gex/ExposureLadder';
import { bookReading } from '../../../data/reads';
import { inWindow } from '../../../data/pinpointBook';
import { useBoardNames } from '../../../data/boardNames';
import { bookColumn, countClose, feedSurface, sessionBefore, shortDay, useFeedDayState, useFeedMoves, useFeedTimeline, type FeedTimelinePoint } from '../../../data/feed/levels';
import type { OiChange as OiChangeData, OiChangeRow } from '../../../data/oiChange';
import type { DealerTimeline as TimelineData, TimelinePoint } from '../../../data/dealerTimeline';
import { useRoomWindow } from '../usePinpoint';
import FeedCalendar from './FeedCalendar';
import { Box, BoxHead, Dash, fmtStrike, LevelFacts, NotOnFeed, real, Stamp, useLevelsFeed, Waiting, type LevelsFeed } from './parts';

/* ---- shared ------------------------------------------------------------------------------------------------------ */

type Tag = { word: string; ink: string };
/** A strike's named role on the feed's book, the house's inks — magenta is the supreme's alone */
function tagOf(feed: LevelsFeed, strike: number): Tag | null {
  const lv = feed.profile?.levels;
  if (!lv) return null;
  if (strike === lv.supreme) return { word: 'supreme', ink: SUPREME };
  if (strike === lv.callWall) return { word: 'call wall', ink: CALL_WALL };
  if (strike === lv.putWall) return { word: 'put wall', ink: PUT_WALL };
  if (strike === lv.pin) return { word: 'most open interest', ink: 'rgb(var(--text-muted))' };
  if (feed.maxPain && strike === feed.maxPain.strike) return { word: 'max pain', ink: 'rgb(var(--text-muted))' };
  return null;
}

const lean = (net: number) => (net > 0 ? 'put-heavy' : net < 0 ? 'call-heavy' : 'flat');
const leanInk = (net: number) => (net > 0 ? SHORT_GAMMA : net < 0 ? LONG_GAMMA : undefined);

/** The page's waiting state, or null once the book is in */
const notYet = (feed: LevelsFeed): ReactNode => (!feed.book || !feed.profile ? <Waiting ticker={feed.ticker} failed={feed.failed} /> : null);

/* ---- a list of strikes ------------------------------------------------------------------------------------------- */

interface StrikeRow {
  strike: number;
  net: number;
  put: number;
  call: number;
  oi: number;
  volume: number;
}

const COLS = 'minmax(150px,1.2fr) 92px 96px 84px 96px 110px 110px';

const StrikeList = ({ feed, rows, focus, onPick, figure = 'Net GEX', testId }: { feed: LevelsFeed; rows: StrikeRow[]; focus: number | null; onPick: (s: number) => void; figure?: string; testId: string }) => {
  const spot = feed.book?.spot ?? 0;
  const total = rows.reduce((s, r) => s + Math.abs(r.net), 0);
  return (
    <div className="px-5 pb-4 overflow-x-auto" data-feed-list={testId}>
      <div className="grid min-w-[780px] items-center gap-x-3" style={{ gridTemplateColumns: COLS }}>
        <div className="text-[11px] text-textMuted py-1">Strike</div>
        <div className="text-[11px] text-textMuted py-1">Lean</div>
        <div className="text-[11px] text-textMuted py-1 text-right">{figure}</div>
        <div className="text-[11px] text-textMuted py-1 text-right" title="Its share of the hedging on the strikes listed">
          Share
        </div>
        <div className="text-[11px] text-textMuted py-1 text-right">From spot</div>
        <div className="text-[11px] text-textMuted py-1 text-right">Open interest</div>
        <div className="text-[11px] text-textMuted py-1 text-right">Traded today</div>
        {rows.map(r => {
          const tag = tagOf(feed, r.strike);
          const kept = focus != null && Math.abs(focus - r.strike) < 1e-9;
          return (
            <div
              key={r.strike}
              className={`grid grid-cols-subgrid col-span-7 items-center min-h-[26px] rounded cursor-pointer hover:bg-ink/[0.04] ${kept ? 'bg-silver/[0.06]' : ''}`}
              data-feed-row={r.strike}
              aria-pressed={kept}
              {...rowProps(() => onPick(r.strike), `${fmtStrike(r.strike)}${tag ? `, ${tag.word}` : ''}: ${usdCompact(r.net)}, ${lean(r.net)}`)}
            >
              <div className={`flex items-center gap-2 px-2 font-mono text-[12px] tnum ${kept ? 'text-silver font-bold' : 'text-textPrimary'}`}>
                {fmtStrike(r.strike)}
                {tag && (
                  <span className="text-[11px] whitespace-nowrap" style={{ color: tag.ink }}>
                    {tag.word}
                  </span>
                )}
              </div>
              <div className="text-[11px]" style={{ color: leanInk(r.net) }}>
                {lean(r.net)}
              </div>
              <div className="font-mono text-[12px] tnum text-right text-textPrimary">{usdCompact(r.net)}</div>
              <div className="font-mono text-[11px] tnum text-right text-textSecondary">{total > 0 ? pct((Math.abs(r.net) / total) * 100) : <Dash />}</div>
              <div className="font-mono text-[11px] tnum text-right text-textSecondary">{spot > 0 ? pctSigned(((r.strike - spot) / spot) * 100) : <Dash />}</div>
              <div className="font-mono text-[11px] tnum text-right text-textSecondary">{real(r.oi) ? numCompact(r.oi) : <Dash />}</div>
              <div className="font-mono text-[11px] tnum text-right text-textSecondary">{real(r.volume) ? numCompact(r.volume) : <Dash />}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** The profile's rows, ascending, as list rows */
const listRows = (feed: LevelsFeed): StrikeRow[] =>
  (feed.profile?.strikes ?? []).map(s => ({ strike: s.strike, net: s.gex.net, put: s.gex.put, call: s.gex.call, oi: s.oi, volume: s.volume })).sort((a, b) => a.strike - b.strike);

/* ---- MAP ---------------------------------------------------------------------------------------------------------- */

export const FeedMap = () => {
  const ticker = useActiveTicker();
  const { focus, toggleFocus } = useFocus();
  const [half, setHalf] = useRoomWindow();
  const feed = useLevelsFeed(ticker);
  const day = useFeedDayState(true, ticker);
  const wait = notYet(feed);
  if (wait) return <>{wait}</>;
  const book = feed.book!;
  const kept = focus && focus.ticker === feed.ticker ? focus.price : null;
  return (
    <>
      <Box testId="levels">
        <BoxHead title={`${feed.ticker}'s levels`} sub="The walls, the flip and the supreme, read on Unusual Whales' exposure by strike — every listed date together" right={<Stamp book={book} failed={feed.failed} />} />
        <div className="px-5 pb-4">
          <LevelFacts feed={feed} />
        </div>
      </Box>
      <div className="border border-borderSubtle rounded-md overflow-hidden h-[min(870px,calc(100svh-120px))] min-h-[520px] flex flex-col" data-calendar data-feed-map>
        <FeedCalendar
          feed={feed}
          changePct={day?.changePct ?? NaN}
          half={half}
          onHalf={setHalf}
          focus={kept}
          onPick={s => toggleFocus(s, feed.ticker)}
          after={
            <ReadThis
              compact
              what={`${feed.ticker}'s book`}
              testId="map"
              read={() => {
                const lv = feed.profile!.levels;
                return bookReading({ ticker: feed.ticker, spot: book.spot, callWall: real(lv.callWall) ? lv.callWall : null, putWall: real(lv.putWall) ? lv.putWall : null, flip: real(lv.flip) ? lv.flip : null, supreme: real(lv.supreme) ? lv.supreme : null, netGex: book.netGex });
              }}
            />
          }
        />
      </div>
      <NotOnFeed what="Today's hedging schedule, how the levels held today and the replay" testId="map" />
    </>
  );
};

/* ---- AHEAD -------------------------------------------------------------------------------------------------------- */

export const FeedAhead = () => {
  const ticker = useActiveTicker();
  const feed = useLevelsFeed(ticker, { volume: false });
  const moves = useFeedMoves(true, ticker);
  const wait = notYet(feed);
  if (wait) return <>{wait}</>;
  const book = feed.book!;
  const lv = feed.profile!.levels;
  const spot = book.spot;
  const today = new Date().toISOString().slice(0, 10);
  const dates = (feed.maxPainRows ?? []).filter(r => r.expiry >= today).slice(0, 12);
  const inside = (lo: number, hi: number, v: number) => real(v) && v >= lo && v <= hi;
  return (
    <>
      <Box testId="moves">
        <BoxHead
          title="The move priced in"
          sub="What the options price in for each horizon — Unusual Whales' implied volatility, interpolated to fixed days — and whether the walls stand inside that range"
          right={<Stamp book={book} failed={feed.failed} />}
        />
        {!moves ? (
          <p className="px-5 pb-5 text-[12px] text-textMuted">Asking Unusual Whales for the implied moves…</p>
        ) : (
          <div className="px-5 pb-4 overflow-x-auto">
            <div className="grid min-w-[720px] items-center gap-x-4 gap-y-1" style={{ gridTemplateColumns: '90px 90px 90px 160px 1fr 110px' }} data-feed-moves>
              <div className="text-[11px] text-textMuted">Horizon</div>
              <div className="text-[11px] text-textMuted text-right">Implied vol</div>
              <div className="text-[11px] text-textMuted text-right">Move</div>
              <div className="text-[11px] text-textMuted text-right">Range</div>
              <div className="text-[11px] text-textMuted">Walls inside it</div>
              <div className="text-[11px] text-textMuted text-right" title="Where that volatility stands against its own year">
                Against its year
              </div>
              {moves
                .filter(m => m.days <= 60)
                .map(m => {
                  const move = real(m.movePct) ? m.movePct * spot : NaN;
                  const lo = spot - move;
                  const hi = spot + move;
                  const walls = [
                    inside(lo, hi, lv.putWall) ? `put wall ${fmtStrike(lv.putWall)}` : null,
                    inside(lo, hi, lv.flip) ? `flip ${fmtStrike(lv.flip)}` : null,
                    inside(lo, hi, lv.callWall) ? `call wall ${fmtStrike(lv.callWall)}` : null,
                  ].filter(Boolean);
                  return (
                    <div key={m.days} className="contents" data-feed-move={m.days}>
                      <div className="font-mono text-[12px] tnum text-textPrimary">{m.days === 1 ? '1 day' : `${m.days} days`}</div>
                      <div className="font-mono text-[12px] tnum text-right text-textSecondary">{real(m.volatility) ? pct(m.volatility * 100) : <Dash />}</div>
                      <div className="font-mono text-[12px] tnum text-right text-textPrimary">{real(m.movePct) ? `±${pct(m.movePct * 100)}` : <Dash />}</div>
                      <div className="font-mono text-[12px] tnum text-right text-textSecondary">{real(move) ? `${lo.toFixed(2)} – ${hi.toFixed(2)}` : <Dash />}</div>
                      <div className="text-[11px] text-textSecondary truncate">{walls.length ? walls.join(' · ') : 'none of them'}</div>
                      <div className="font-mono text-[11px] tnum text-right text-textSecondary">{real(m.percentile) ? pct(m.percentile * 100) : <Dash />}</div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </Box>
      <Box testId="max-pain">
        <BoxHead title="Max pain by date" sub="Where each listed date's open interest pays least at expiry — a plain marked price, never a pull" />
        <div className="px-5 pb-4 overflow-x-auto">
          <div className="grid min-w-[420px] items-center gap-x-4 gap-y-1" style={{ gridTemplateColumns: '120px 100px 110px 1fr' }} data-feed-max-pain>
            <div className="text-[11px] text-textMuted">Date</div>
            <div className="text-[11px] text-textMuted text-right">Max pain</div>
            <div className="text-[11px] text-textMuted text-right">From spot</div>
            <div />
            {dates.map(r => (
              <div key={r.expiry} className="contents">
                <div className="font-mono text-[12px] tnum text-textPrimary">{shortDay(r.expiry)}</div>
                <div className="font-mono text-[12px] tnum text-right text-textPrimary">{real(r.strike) ? fmtStrike(r.strike) : <Dash />}</div>
                <div className="font-mono text-[11px] tnum text-right text-textSecondary">{real(r.strike) ? pctSigned(((r.strike - spot) / spot) * 100) : <Dash />}</div>
                <div />
              </div>
            ))}
          </div>
        </div>
      </Box>
      <NotOnFeed what="The range likely to hold to the close, the odds for the close strike by strike and what dealers must trade each half hour" testId="ahead" />
    </>
  );
};

/* ---- BUILDING ----------------------------------------------------------------------------------------------------- */

/** Open interest overnight off UW's two counts, on the book's strikes */
function oiChangeOf(feed: LevelsFeed): OiChangeData | null {
  const { book, oi, oiBefore } = feed;
  if (!book || !oi || !oiBefore) return null;
  const rows: OiChangeRow[] = [];
  let maxAbs = 1;
  let addedCalls = 0;
  let addedPuts = 0;
  let most: OiChangeData['most'] = null;
  for (const r of book.rows) {
    const a = oi.byStrike.get(r.strike);
    const b = oiBefore.byStrike.get(r.strike);
    if (!a || !b) continue;
    const dCalls = a.call - b.call;
    const dPuts = a.put - b.put;
    rows.push({ strike: r.strike, calls: a.call, puts: a.put, dCalls, dPuts });
    maxAbs = Math.max(maxAbs, Math.abs(dCalls), Math.abs(dPuts));
    addedCalls += dCalls;
    addedPuts += dPuts;
    if (dCalls > 0 && (!most || dCalls > most.contracts)) most = { strike: r.strike, side: 'calls', contracts: dCalls };
    if (dPuts > 0 && (!most || dPuts > most.contracts)) most = { strike: r.strike, side: 'puts', contracts: dPuts };
  }
  if (!rows.length) return null;
  const last = countClose(oi);
  const before = shortDay(sessionBefore(sessionBefore(oi.date)));
  const k = (n: number) => `${n < 0 ? '−' : '+'}${numCompact(Math.abs(n))}`;
  const sentence = `Between ${before}'s close and ${last}'s, ${k(addedCalls)} call contracts and ${k(addedPuts)} put contracts changed across these strikes${
    most ? `; the most went into the ${fmtStrike(most.strike)} ${most.side}, ${k(most.contracts)}` : ''
  }. Open interest is counted once a day, after the close; a count leaves out the contracts that expired since the one before, so a strike can drop on expiry alone.`;
  return { ticker: book.ticker, spot: book.spot, last, before, rows, maxAbs, addedCalls, addedPuts, most, sentence };
}

/** The feed's book through the day as the house's timeline — the flip each minute is not in the answer */
function timelineOf(ticker: string, pts: FeedTimelinePoint[] | null): TimelineData | null {
  if (!pts || pts.length < 2) return null;
  /* the cash session when the answer reaches into it; the minutes before the open otherwise */
  const cash = pts.filter(p => p.minute >= SESSION_OPEN_MIN && p.minute <= SESSION_CLOSE_MIN);
  const use = cash.length >= 2 ? cash : pts;
  const points: TimelinePoint[] = use.map(p => ({ minute: p.minute, spot: p.spot, netGex: p.netGex, flip: null, flipPct: null }));
  return {
    ticker,
    day: shortDay(new Date(use[use.length - 1].at).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })),
    points,
    first: points[0],
    last: points[points.length - 1],
    putHeavyMin: points.filter(p => p.netGex > 0).length,
    aboveFlipMin: 0,
    flipMin: 0,
    crossings: 0,
  };
}

export const FeedBuilding = () => {
  const ticker = useActiveTicker();
  const { focus, toggleFocus } = useFocus();
  const [half] = useRoomWindow();
  const feed = useLevelsFeed(ticker, { prev: true });
  const pts = useFeedTimeline(true, ticker);
  const timeline = useMemo(() => timelineOf(ticker.toUpperCase(), pts), [ticker, pts]);
  const oiChange = useMemo(() => oiChangeOf(feed), [feed.book, feed.oi, feed.oiBefore]); // eslint-disable-line react-hooks/exhaustive-deps
  const wait = notYet(feed);
  if (wait) return <>{wait}</>;
  const book = feed.book!;
  const kept = focus && focus.ticker === feed.ticker ? focus.price : null;
  const pick = (s: number) => toggleFocus(s, feed.ticker);
  /* what today's trading put at each strike: gamma from today's volume */
  const built: StrikeRow[] = inWindow(
    book.rows.map(r => {
      const o = feed.oi?.byStrike.get(r.strike);
      const v = feed.volume?.get(r.strike);
      return { strike: r.strike, net: r.gexVol.net, put: r.gexVol.put, call: r.gexVol.call, oi: o ? o.call + o.put : NaN, volume: v ? v.call + v.put : NaN };
    }),
    book.spot,
    half
  ).sort((a, b) => b.strike - a.strike);
  return (
    <>
      <Box testId="built">
        <BoxHead title="What today's trading built" sub="Gamma per 1% move from today's volume at each strike, Unusual Whales' figure beside today's contracts traded — where the day's positions sit, before the next count of open interest" right={<Stamp book={book} failed={feed.failed} />} />
        <StrikeList feed={feed} rows={built} focus={kept} onPick={pick} figure="Today's GEX" testId="built" />
      </Box>
      <div className="border border-borderSubtle rounded-md bg-panel" data-oi-box>
        <OiChange data={oiChange} ticker={feed.ticker} window={half} focus={kept} onPick={pick} />
      </div>
      <div className="border border-borderSubtle rounded-md bg-panel" data-timeline-box>
        <DealerTimeline data={timeline} ticker={feed.ticker} feed />
      </div>
      <NotOnFeed what="What today added to each strike's hedging since the open, and where the levels are heading at today's pace" testId="building" />
    </>
  );
};

/* ---- AT THE WALL -------------------------------------------------------------------------------------------------- */

export const FeedAtTheWall = () => {
  const ticker = useActiveTicker();
  const { focusOn } = useFocus();
  const feed = useLevelsFeed(ticker);
  const wait = notYet(feed);
  if (wait) return <>{wait}</>;
  const book = feed.book!;
  const lv = feed.profile!.levels;
  const byStrike = new Map(feed.profile!.strikes.map(s => [s.strike, s]));
  const named: { key: string; word: string; ink: string; strike: number; sure?: keyof NonNullable<LevelsFeed['sure']> }[] = [
    { key: 'call-wall', word: 'Call wall', ink: CALL_WALL, strike: lv.callWall, sure: 'call wall' },
    { key: 'put-wall', word: 'Put wall', ink: PUT_WALL, strike: lv.putWall, sure: 'put wall' },
    { key: 'flip', word: 'Flip', ink: FLIP, strike: lv.flip, sure: 'flip' },
    { key: 'supreme', word: 'Supreme', ink: SUPREME, strike: lv.supreme, sure: 'supreme' },
    { key: 'pin', word: 'Most open interest', ink: 'rgb(var(--text-secondary))', strike: lv.pin },
    { key: 'max-pain', word: 'Max pain', ink: 'rgb(var(--text-secondary))', strike: feed.maxPain?.strike ?? NaN },
  ];
  return (
    <>
      <Box testId="walls">
        <BoxHead title="At the walls" sub="Each named level of the book: what stands at the strike, how far it is, and what it rests on" right={<Stamp book={book} failed={feed.failed} />} />
        <div className="px-5 pb-4 overflow-x-auto">
          <div className="grid min-w-[860px] items-center gap-x-4 gap-y-1" style={{ gridTemplateColumns: '150px 80px 90px 110px 110px 110px 100px 100px 1fr' }} data-feed-walls>
            {['Level', 'Strike', 'From spot', 'Net GEX', 'Puts', 'Calls', 'Open interest', 'Traded today', ''].map((h, i) => (
              <div key={i} className={`text-[11px] text-textMuted ${i > 0 && i < 8 ? 'text-right' : ''}`}>
                {h}
              </div>
            ))}
            {named.map(n => {
              const s = real(n.strike) ? byStrike.get(n.strike) : undefined;
              const sure = n.sure && feed.sure ? feed.sure[n.sure] : null;
              return (
                <div key={n.key} className="grid grid-cols-subgrid col-span-9 items-center min-h-[28px] rounded hover:bg-ink/[0.04] cursor-pointer" data-feed-wall={n.key} {...rowProps(() => real(n.strike) && focusOn(n.strike, feed.ticker), `${n.word} ${real(n.strike) ? fmtStrike(n.strike) : 'none'}`)}>
                  <div className="px-2 text-[12px] font-semibold" style={{ color: n.ink }}>
                    {n.word}
                  </div>
                  <div className="font-mono text-[12px] tnum text-right text-textPrimary">{real(n.strike) ? fmtStrike(n.strike) : <Dash />}</div>
                  <div className="font-mono text-[11px] tnum text-right text-textSecondary">{real(n.strike) ? pctSigned(((n.strike - book.spot) / book.spot) * 100) : <Dash />}</div>
                  <div className="font-mono text-[12px] tnum text-right" style={{ color: s ? leanInk(s.gex.net) : undefined }}>
                    {s ? usdCompact(s.gex.net) : <Dash />}
                  </div>
                  <div className="font-mono text-[11px] tnum text-right text-textSecondary">{s ? usdCompact(s.gex.put) : <Dash />}</div>
                  <div className="font-mono text-[11px] tnum text-right text-textSecondary">{s ? usdCompact(s.gex.call) : <Dash />}</div>
                  <div className="font-mono text-[11px] tnum text-right text-textSecondary">{s && real(s.oi) ? numCompact(s.oi) : <Dash />}</div>
                  <div className="font-mono text-[11px] tnum text-right text-textSecondary">{s && real(s.volume) ? numCompact(s.volume) : <Dash />}</div>
                  <div className="flex justify-end">{sure && <HowSure sure={sure} align="end" />}</div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-textMuted">The flip is the sign change nearest spot, between two strikes; its row reads no single strike.</p>
        </div>
      </Box>
      <NotOnFeed what="The odds a wall is reached and holds, its reasons and the paths either way" testId="wall" />
    </>
  );
};

/* ---- TARGETS ------------------------------------------------------------------------------------------------------ */

export const FeedTargets = () => {
  const ticker = useActiveTicker();
  const { focus, toggleFocus } = useFocus();
  const [half, setHalf] = useRoomWindow();
  const feed = useLevelsFeed(ticker);
  const wait = notYet(feed);
  if (wait) return <>{wait}</>;
  const book = feed.book!;
  const kept = focus && focus.ticker === feed.ticker ? focus.price : null;
  const rows = inWindow(listRows(feed), book.spot, half).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  return (
    <>
      <Box testId="targets">
        <BoxHead
          title="Every strike, by the hedging parked there"
          sub={`${rows.length} strikes, ${half} each side of spot, heaviest first — the order of the book's own size, Unusual Whales' gamma per 1% move`}
          right={<Stamp book={book} failed={feed.failed} />}
          lead={
            <span className="inline-flex items-center gap-1">
              {[15, 20, 25, 30].map(w => (
                <button key={w} type="button" onClick={() => setHalf(w as 15 | 20 | 25 | 30)} aria-pressed={half === w} className={`hit h-6 px-2 rounded text-[11px] font-mono tnum ${half === w ? 'bg-ink/[0.08] text-textPrimary' : 'text-textMuted hover:text-textPrimary'}`} title={`${w} strikes each side of spot`}>
                  ±{w}
                </button>
              ))}
            </span>
          }
        />
        <StrikeList feed={feed} rows={rows} focus={kept} onPick={s => toggleFocus(s, feed.ticker)} testId="targets" />
      </Box>
      <NotOnFeed what="The order by how likely price gets there and what happens if it does, and the alerts and chart doors on each strike" testId="targets" />
    </>
  );
};

/* ---- BOARD -------------------------------------------------------------------------------------------------------- */

const BOARD_COLS = '120px 100px 150px 150px 130px 130px 110px 110px';

const BoardRow = ({ name, onOpen }: { name: string; onOpen: (t: string) => void }) => {
  const feed = useLevelsFeed(name, { lite: true });
  const book = feed.book;
  const lv = book?.levels;
  const lvl = (v: number | undefined, ink: string) =>
    book && real(v) ? (
      <>
        <span style={{ color: ink }}>{fmtStrike(v)}</span>
        <span className="text-textMuted"> · {pctSigned(((v - book.spot) / book.spot) * 100)}</span>
      </>
    ) : (
      <Dash />
    );
  return (
    <div className="grid grid-cols-subgrid col-span-8 items-center min-h-[30px] rounded hover:bg-ink/[0.04] cursor-pointer" data-feed-board-row={name} {...rowProps(() => onOpen(name), `${name} — open it on the Map`)}>
      <div className="px-2 text-[12px] font-bold text-textPrimary">{name}</div>
      <div className="font-mono text-[12px] tnum text-right text-textPrimary">{book ? book.spot.toFixed(2) : feed.failed && feed.failed !== 'rate' ? <Dash /> : <span className="text-textMuted">…</span>}</div>
      <div className="text-[11px]" style={{ color: book && lv && real(lv.flip) ? (book.spot >= lv.flip ? LONG_GAMMA : SHORT_GAMMA) : undefined }}>
        {book && lv ? (real(lv.flip) ? (book.spot >= lv.flip ? 'absorbing moves' : 'amplifying moves') : 'no flip on the book') : ''}
      </div>
      <div className="font-mono text-[12px] tnum text-right">{lvl(lv?.flip, FLIP)}</div>
      <div className="font-mono text-[12px] tnum text-right">{lvl(lv?.callWall, CALL_WALL)}</div>
      <div className="font-mono text-[12px] tnum text-right">{lvl(lv?.putWall, PUT_WALL)}</div>
      <div className="font-mono text-[12px] tnum text-right">{book && lv && real(lv.supreme) ? <span style={{ color: SUPREME }}>{fmtStrike(lv.supreme)}</span> : <Dash />}</div>
      <div className="font-mono text-[12px] tnum text-right" style={{ color: book ? leanInk(book.netGex) : undefined }}>
        {book ? usdCompact(book.netGex) : <Dash />}
      </div>
    </div>
  );
};

export const FeedBoard = () => {
  const names = useBoardNames();
  const navigate = useNavigate();
  const open = (t: string) => {
    changeTicker(t);
    navigate('/pinpoint/map');
  };
  return (
    <>
      <Box testId="board">
        <BoxHead title="The names on your board" sub={`${names.length} names · each one's book from Unusual Whales, asked every half minute — a press opens the name on the Map`} />
        <div className="px-5 pb-4 overflow-x-auto">
          <div className="grid min-w-[1060px] items-center gap-x-4 gap-y-0.5" style={{ gridTemplateColumns: BOARD_COLS }} data-feed-board>
            {['Name', 'Price', 'Dealers', 'Flip', 'Call wall', 'Put wall', 'Supreme', 'Net GEX'].map((h, i) => (
              <div key={h} className={`text-[11px] text-textMuted py-1 ${i === 1 || i > 2 ? 'text-right' : ''} ${i === 0 ? 'px-2' : ''}`}>
                {h}
              </div>
            ))}
            {names.map(n => (
              <BoardRow key={n} name={n} onOpen={open} />
            ))}
          </div>
        </div>
      </Box>
      <NotOnFeed what="The day's change and its line, the first strike to watch, the flip's crossings today and what expires today" testId="board" />
    </>
  );
};

/* ---- COMPARE ------------------------------------------------------------------------------------------------------ */

let secondMemory: string | null = null;

const CompareSide = ({ feed, chip, focus, onPick }: { feed: LevelsFeed; chip: ReactNode; focus: number | null; onPick: (s: number) => void }) => {
  const surface = useMemo(() => (feed.book && feed.profile ? feedSurface(feed.book, feed.profile, [bookColumn(feed.book, feed.oi)], NaN) : null), [feed.book, feed.profile, feed.oi]);
  return (
    <Box testId={`compare-${feed.ticker}`} className="flex-1 min-w-[320px]">
      <BoxHead title={feed.ticker} lead={chip} right={feed.book ? <Stamp book={feed.book} failed={feed.failed} /> : undefined} />
      {!feed.book || !surface ? (
        <p className="px-5 pb-5 text-[12px] text-textMuted">Asking Unusual Whales for {feed.ticker}'s book…</p>
      ) : (
        <>
          <div className="px-5 pb-3">
            <LevelFacts feed={feed} />
          </div>
          <div className="h-[560px] border-t border-borderSubtle">
            <ExposureLadder surface={surface} liveSpot={surface.spot} greeks={['gex']} expiries={[0]} rings={15} palette="thermal" selectedStrike={focus} onSelectStrike={onPick} />
          </div>
        </>
      )}
    </Box>
  );
};

export const FeedCompare = () => {
  const a = useActiveTicker();
  const names = useBoardNames();
  const { focus, toggleFocus } = useFocus();
  const [b, setB] = useState<string>(() => secondMemory ?? names.find(n => n !== a) ?? 'QQQ');
  const second = b === a ? names.find(n => n !== a) ?? 'QQQ' : b;
  const pickB = (t: string) => setB((secondMemory = t));
  const fa = useLevelsFeed(a, { volume: false });
  const fb = useLevelsFeed(second, { volume: false });
  const focusFor = (t: string) => (focus && focus.ticker === t ? focus.price : null);
  return (
    <>
      <div className="flex gap-4 flex-wrap" data-feed-compare data-a={a} data-b={second}>
        <CompareSide feed={fa} chip={<ScopeChip ticker={a} onPick={t => (t === second ? pickB(a) : changeTicker(t))} title="The first name — the terminal's" />} focus={focusFor(fa.ticker)} onPick={s => toggleFocus(s, fa.ticker)} />
        <CompareSide feed={fb} chip={<ScopeChip ticker={second} onPick={t => (t === a ? pickB(a) : pickB(t))} title={`The second name — pick another`} />} focus={focusFor(fb.ticker)} onPick={s => toggleFocus(s, fb.ticker)} />
      </div>
      <NotOnFeed what="The ten reads head to head, the two books on one ruler, the two tapes since the open and whether today's gap between them is usual" testId="compare" />
    </>
  );
};

