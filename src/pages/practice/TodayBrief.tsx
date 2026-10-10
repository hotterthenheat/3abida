/*
==================================================
  SLAYER TERMINAL - PRACTICE · TODAY: BEFORE THE OPEN,
  AND HOW IT WENT (pages/practice/TodayBrief.tsx)

  The ideas of 2026-10-09 (item 5: "read, plan,
  review" — only monitoring tied to a goal worked as
  self-control): a page read in two minutes, in the
  Journal (`?view=today`), for the name in the rail.

    BEFORE THE OPEN   where the name stands against its
                      flip; the day's walls and the
                      levels that matter most, in order
                      (data/agenda.ts — the Targets
                      page's own order: reached ×
                      stake); the expected move; the
                      day's events; the names the
                      reader holds with their nearest
                      wall — ending in THE PLAN, kept as
                      the day's plan note
    HOW IT WENT       the same levels against the day's
                      tape: reached or not, held or
                      broken; the day's paper trades set
                      beside the morning's plan; and one
                      question — "Did you trade your
                      plan?" — kept with the day's
                      review

  A READ, NEVER AN INSTRUCTION: every line says what
  is, what the book shows, what tends to happen there —
  never what to do. All of it New York's clock.
==================================================
*/

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Simulator from '../../core/simulator';
import { nyClock, nyDay, nySessionPhase } from '../../core/nyTime';
import { useMarketData } from '../../context/MarketDataContext';
import { card, headWord } from '../../components/review/DeskShell';
import { NoteField } from '../../components/review/JournalDay';
import { dirInk, usd, usdSigned } from '../../components/review/words';
import { buildAgenda, type Target } from '../../data/agenda';
import { aheadClock, fmtStrike } from '../../data/ahead';
import { buildBuilding } from '../../data/building';
import { buildExposureProfile } from '../../data/exposure';
import { buildExposureSurface, CALENDAR_DTES } from '../../data/exposureSurface';
import { buildLevelsFor, spotChangePct } from '../../data/gex';
import { sessionBars } from '../../data/levelview';
import { readSessionClock } from '../../data/sessionClock';
import { buildMonthCalendar, dayKeyOf, type CalEvent } from '../../data/monthCalendar';
import { isPaperIndex } from '../../data/paper/feed';
import { optBookOf } from '../../data/paper/engine';
import { usePaper } from '../../data/paper/store';
import { SAMPLE_IDS } from '../../data/paper/sample';
import { entryOf, titleOf, type DayNote, type JournalRow } from '../../data/review/journal';
import { calendarDayOf } from '../../data/review/journalFigures';
import { useJournalSource } from '../../data/review/journalSource';
import type { KeyLevels } from '../../types/gex';
import { pctSigned } from '../../core/format';

const pctOf = (v: number) => `${Math.round(v * 100)}%`;
const signedPct = (v: number) => pctSigned(v);
const awayWords = (level: number, spot: number) => {
  const d = ((level - spot) / spot) * 100;
  return `${Math.abs(d).toFixed(2)}% ${d >= 0 ? 'above' : 'below'}`;
};

/** A row of a card: its name at the left, its figures, a line */
const Line = ({ label, children, sub }: { label: string; children: React.ReactNode; sub?: React.ReactNode }) => (
  <div className="grid grid-cols-[minmax(0,148px)_minmax(0,1fr)] gap-x-4 py-2 border-t border-borderSubtle/50 first:border-t-0">
    <span className="text-[12px] text-textMuted">{label}</span>
    <span className="min-w-0 text-[12px] text-textPrimary">
      {children}
      {sub && <span className="block mt-0.5 text-[11px] text-textMuted">{sub}</span>}
    </span>
  </div>
);
const Card = ({ title, sub, children, testId }: { title: string; sub?: string; children: React.ReactNode; testId: string }) => (
  <section className={`${card} flex flex-col min-w-0`} data-today-card={testId}>
    <div className="px-5 pt-4 pb-2 flex items-baseline gap-3 flex-wrap">
      <h2 className={headWord}>{title}</h2>
      {sub && <span className="text-[11px] text-textMuted">{sub}</span>}
    </div>
    <div className="px-5 pb-4">{children}</div>
  </section>
);

/** The levels the day turns on — the walls and the flip, named, and the agenda's first three */
interface DayLevel {
  key: string;
  strike: number;
  name: string;
  t: Target | null;
}

/** How a level fared on the day's tape: never reached; reached and held (the day closed back on the side it opened); or
    broken (it finished on the far side) */
function howItFared(level: number, bars: { open: number; high: number; low: number; close: number }[]): { word: string; ink: string } {
  if (!bars.length) return { word: 'no tape yet today', ink: 'text-textMuted' };
  const hi = Math.max(...bars.map(b => b.high));
  const lo = Math.min(...bars.map(b => b.low));
  const open = bars[0].open;
  const last = bars[bars.length - 1].close;
  if (level > hi || level < lo) {
    const gap = level > hi ? level - hi : lo - level;
    return { word: `not reached — the nearest the day came was ${gap.toFixed(2)} away`, ink: 'text-textSecondary' };
  }
  const startedBelow = open < level;
  const broke = startedBelow ? last > level : last < level;
  return broke ? { word: `reached and broken — the day stands ${startedBelow ? 'above' : 'below'} it`, ink: 'text-warn' } : { word: `reached and held — the day stands back ${startedBelow ? 'below' : 'above'} it`, ink: 'text-textPrimary' };
}

const TodayBrief = () => {
  const { marketData } = useMarketData();
  const source = useJournalSource('paper');
  const paper = usePaper();
  const ticker = marketData?.ticker ?? 'SPY';
  const day = source.today;
  const phase = nySessionPhase(Date.now());
  /* whose note the plan and the review are: the account on the Paper desk, else the first in the journal */
  const own = source.containers.filter(c => !(SAMPLE_IDS as readonly string[]).includes(c.id));
  const holder = source.current && own.some(c => c.id === source.current) ? source.current : (own[0]?.id ?? null);
  const note: DayNote = holder ? (source.notesOf(holder)[day] ?? {}) : {};

  /* ---- THE BOOK, as the Targets page reads it (the 10 s scan snapshot) ---- */
  const agenda = useMemo(() => {
    if (!marketData) return null;
    try {
      const clock = aheadClock(readSessionClock());
      const profile = buildExposureProfile(marketData, '0DTE', 15);
      const building = buildBuilding(marketData, Simulator.getGexHistory(ticker), Simulator.getCandles(ticker), profile, clock);
      const surface = buildExposureSurface(marketData, 30, CALENDAR_DTES);
      const iv = Simulator.TICKERS[ticker]?.iv ?? 0.2;
      return buildAgenda(marketData, profile, building, surface, sessionBars(ticker) ?? [], clock, iv, 'matters');
    } catch {
      return null;
    }
  }, [marketData, ticker]);
  const levels: KeyLevels = useMemo(() => buildLevelsFor(ticker), [ticker, marketData]); // eslint-disable-line react-hooks/exhaustive-deps
  const spot = levels.spot;
  const change = spotChangePct(ticker);
  const iv = Simulator.TICKERS[Simulator.ensureTicker(ticker)]?.iv ?? 0.2;
  const em = spot * iv * Math.sqrt(1 / 252);
  const bars = sessionBars(ticker) ?? [];

  const dayLevels: DayLevel[] = useMemo(() => {
    const out: DayLevel[] = [];
    const at = (k: number) => agenda?.targets.find(t => Math.abs(t.strike - k) < 1e-6) ?? null;
    const add = (key: string, strike: number, name: string) => {
      if (!Number.isFinite(strike) || out.some(x => Math.abs(x.strike - strike) < 1e-6)) return;
      out.push({ key, strike, name, t: at(strike) });
    };
    add('call', levels.callWall, 'the call wall');
    add('put', levels.putWall, 'the put wall');
    add('flip', levels.flip, 'the flip');
    for (const t of agenda?.first ?? []) add(`t${t.strike}`, t.strike, t.role ? `the ${t.role}` : t.isShelf ? 'a shelf' : t.isWall ? 'a thin strike' : 'a trapdoor');
    return out.sort((a, b) => b.strike - a.strike);
  }, [agenda, levels]);

  /* ---- THE DAY'S EVENTS: the macro calendar and the reports, New York's day ---- */
  const events: CalEvent[] = useMemo(() => {
    const [y, m] = day.split('-').map(Number);
    return buildMonthCalendar(y, m - 1)
      .events.filter(e => dayKeyOf(e.date) === day && (e.kind !== 'earnings' || e.impact !== 'low'))
      .slice(0, 8);
  }, [day]);

  /* ---- THE READER'S NAMES: what the paper accounts hold, each with its nearest wall ---- */
  const held = useMemo(() => {
    const names = new Set<string>();
    for (const a of paper.accounts) if (a.status === 'open') for (const p of optBookOf(a).positions) names.add(p.contract.ticker);
    return [...names].filter(n => !isPaperIndex(n)).slice(0, 6).map(n => {
      const l = buildLevelsFor(n);
      const call = l.callWall - l.spot;
      const put = l.spot - l.putWall;
      const near = Math.abs(call) <= Math.abs(put) ? { name: 'the call wall', at: l.callWall } : { name: 'the put wall', at: l.putWall };
      return { n, spot: l.spot, near };
    });
  }, [paper.accounts]);

  /* ---- THE DAY'S TRADES, beside the plan ---- */
  const todays: JournalRow[] = useMemo(() => source.rows.filter(r => calendarDayOf(r) === day && (!holder || r.s.id === holder)), [source.rows, day, holder]);
  const net = todays.reduce((x, r) => x + r.t.pnl, 0);
  const answered = todays.filter(r => entryOf(r).plan);
  const followed = answered.filter(r => entryOf(r).plan === 'yes').length;
  const mistakes = [...new Set(todays.flatMap(r => entryOf(r).mistakes ?? []))];

  const setNote = (patch: Partial<DayNote>) => holder && source.setDayNote(holder, day, patch);
  const holderName = source.containers.find(c => c.id === holder)?.name;

  const brief = (
    <div className="flex flex-col gap-3" data-today-brief>
      <Card title="Before the open" sub={`${nyDay(Date.now(), { weekday: true })} · ${ticker}, the name in the rail · New York ${nyClock(Date.now())}`} testId="before">
        <Line label="Where it stands" sub={`the day so far ${signedPct(change)}`}>
          <span className="font-mono tnum">{spot.toFixed(2)}</span>
          {Number.isFinite(levels.flip) && (
            <span className="text-textSecondary">
              {' '}
              · {spot >= levels.flip ? 'above' : 'below'} the flip at <span className="font-mono tnum text-textPrimary">{fmtStrike(levels.flip)}</span> by {awayWords(spot, levels.flip).split(' ')[0]} — {spot >= levels.flip ? 'where dealers’ hedging has tended to damp moves' : 'where dealers’ hedging has tended to add to moves'}
            </span>
          )}
        </Line>
        <Line label="The expected move" sub="the name’s implied vol over one session, either way">
          <span className="font-mono tnum">±{usd(em)}</span> <span className="text-textSecondary">(±{((em / spot) * 100).toFixed(2)}%) · {(spot - em).toFixed(2)} to {(spot + em).toFixed(2)}</span>
        </Line>
        <div className="py-2 border-t border-borderSubtle/50">
          <div className="text-[12px] text-textMuted">The day’s levels, high to low</div>
          <div className="mt-1.5 flex flex-col" data-today-levels>
            {dayLevels.map(l => (
              <div key={l.key} className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 py-1 text-[12px]" data-today-level={l.strike}>
                <span className="font-mono tnum text-textPrimary">{fmtStrike(l.strike)}</span>
                <span className="min-w-0 text-textSecondary">
                  {l.name} · {awayWords(l.strike, spot)}
                  {l.t && (
                    <span className="text-textMuted">
                      {' '}
                      · reached {pctOf(l.t.reach)} of the time by {agenda?.inSession ? 'the close' : 'the next close'}
                      {l.t.isShelf ? ` · holds ${pctOf(l.t.hold)} when it is` : l.t.isWall ? '' : ' · pushes a move along'}
                    </span>
                  )}
                </span>
              </div>
            ))}
            {!dayLevels.length && <span className="text-[12px] text-textMuted">No book for {ticker} yet</span>}
          </div>
        </div>
        <Line label="Today’s events">
          {events.length ? (
            <span className="flex flex-col gap-0.5">
              {events.map(e => (
                <span key={e.id}>
                  <span className="font-mono tnum text-textSecondary">{e.time}</span> {e.title}
                  {e.impliedMovePct ? <span className="text-textMuted"> · ±{e.impliedMovePct.toFixed(1)}% priced</span> : null}
                  {e.kind === 'macro' && <span className="text-textMuted"> · {e.impact} impact</span>}
                </span>
              ))}
            </span>
          ) : (
            <span className="text-textSecondary">Nothing on the calendar today</span>
          )}
        </Line>
        <Line label="What you hold">
          {held.length ? (
            <span className="flex flex-col gap-0.5">
              {held.map(h => (
                <span key={h.n}>
                  <span className="font-mono font-semibold">{h.n}</span> <span className="font-mono tnum text-textSecondary">{h.spot.toFixed(2)}</span> <span className="text-textMuted">· nearest wall: {h.near.name} at {fmtStrike(h.near.at)}, {awayWords(h.near.at, h.spot)}</span>
                </span>
              ))}
            </span>
          ) : (
            <span className="text-textSecondary">Nothing open on your paper accounts</span>
          )}
        </Line>
      </Card>
      <Card title="The plan" sub={holderName ? `kept as ${nyDay(Date.now())}’s plan on ${holderName} — the Journal’s day shows it` : undefined} testId="plan">
        {holder ? (
          <NoteField key={`${holder}|${day}|plan`} ask="What you are looking for today, and what would keep you out" hint="The levels you care about, the size, the time you stop" value={note.plan ?? ''} onKeep={v => setNote({ plan: v })} testId="today-plan" />
        ) : (
          <p className="text-[12px] text-textSecondary">
            Start a paper account on the{' '}
            <Link to="/practice/paper" className="hit text-textPrimary font-semibold hover:text-silver">
              Paper page
            </Link>{' '}
            and the plan is kept on its day.
          </p>
        )}
      </Card>
    </div>
  );

  const recap = (
    <div className="flex flex-col gap-3" data-today-recap>
      <Card title="How it went" sub={`${ticker}’s levels against the day’s tape · today’s levels as the book stands now`} testId="levels-held">
        {dayLevels.map(l => {
          const f = howItFared(l.strike, bars);
          return (
            <Line key={l.key} label={`${fmtStrike(l.strike)} · ${l.name}`}>
              <span className={f.ink}>{f.word}</span>
            </Line>
          );
        })}
      </Card>
      <Card title="Your trades against the plan" sub={holderName ? `on ${holderName}` : undefined} testId="trades-plan">
        <Line label="The morning’s plan">{note.plan?.trim() ? <span className="whitespace-pre-wrap">{note.plan}</span> : <span className="text-textMuted">No plan written for today</span>}</Line>
        <Line label="Closed today" sub={todays.length ? todays.slice(0, 6).map(r => titleOf(r)).join(' · ') : undefined}>
          {todays.length ? (
            <>
              {todays.length} {todays.length === 1 ? 'trade' : 'trades'} · <span className={dirInk(net)}>{usdSigned(net)}</span>
            </>
          ) : (
            <span className="text-textMuted">Nothing closed today</span>
          )}
        </Line>
        <Line label="As you tagged them">
          {answered.length ? (
            <>
              {followed} of {answered.length} followed the plan{mistakes.length ? <span className="text-textSecondary"> · mistakes tagged: {mistakes.join(', ')}</span> : null}
            </>
          ) : (
            <span className="text-textMuted">No trade tagged on the plan yet — a trade’s page has the question</span>
          )}
        </Line>
        {holder && (
          <div className="pt-3 border-t border-borderSubtle/50 flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Did you trade your plan?">
              <span className="text-[12px] font-medium text-textPrimary mr-1">Did you trade your plan?</span>
              {(['yes', 'partly', 'no'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={note.followed === v}
                  onClick={() => setNote({ followed: note.followed === v ? undefined : v })}
                  className={`hit h-7 px-3 rounded-full border text-[12px] transition-colors ${note.followed === v ? 'border-silver/60 bg-silver/[0.12] text-textPrimary font-semibold' : 'border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted'}`}
                  data-today-followed={v}
                >
                  {v === 'yes' ? 'Yes' : v === 'partly' ? 'Partly' : 'No'}
                </button>
              ))}
            </div>
            <NoteField key={`${holder}|${day}|review`} ask="The review, after" hint="How the day went against the plan — one thing to keep, one to drop" value={note.review ?? ''} onKeep={v => setNote({ review: v })} testId="today-review" />
          </div>
        )}
      </Card>
    </div>
  );

  /* before the bell the brief leads; once the day has run, the recap does */
  return (
    <div className="grid gap-3 xl:grid-cols-2 items-start" data-today={day} data-phase={phase}>
      {phase === 'before' ? (
        <>
          {brief}
          {recap}
        </>
      ) : (
        <>
          {recap}
          {brief}
        </>
      )}
    </div>
  );
};

export default TodayBrief;
