/*
==================================================
  SLAYER TERMINAL - REVIEW · THE JOURNAL · ONE TRADE
  (pages/review/JournalTrade.tsx)

  A closed trade's own page (Noah, 2026-09-20, on the
  first journal — a list and a pop-up with one text
  box: "a bit lacking in functionality"). A journal is
  for what the numbers cannot say, so the page is built
  round LOOKING AT THE TRADE AGAIN and SAYING SOMETHING
  ABOUT IT:

    the tape          the house chart over the days it
                      was on, the way in and the way out
                      marked, the rest of the last day
                      after it (components/review/
                      TradeTape) — and it can be drawn on
    while you held it what it was worth each minute it
                      was on, in dollars: the best, the
                      worst, what was taken of the best —
                      the one thing the report cannot say
                      (data/review/excursion)
    the trade         the facts the pop-up had
    your tags         a setup · the mistakes · whether
                      the plan was followed
    your words        three questions, not one blank box:
                      why I took it · what I saw while
                      in it · what I would do again

  A PAGE, NOT A POP-UP: ← and → walk the trades of the
  cut the journal was showing (the cut rides the
  address, so Back restores it and the walk is the
  list's own order), Esc goes back to the list. A walk
  REPLACES the address — Back leaves the trades, it
  does not retrace them.

  BOTH JOURNALS' (2026-09-22): the same page reads a
  paper trade (data/review/journalSource.ts) — its
  moments are real New York instants, its chart the one
  its account wrote down when it closed.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { SayPage } from '../../components/layout/PageMeta';
import type { UTCTimestamp } from 'lightweight-charts';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Fact } from '../../components/trace/TraceBox';
import FactRow from '../../components/ui/Fact';
import TradeShapeFigure from '../../components/review/TradeShape';
import { againstUsual, shapeOf, usualShape, SHAPE_LABEL } from '../../data/review/shape';
import ContractLabel from '../../components/ui/ContractLabel';
import { card, head, headWord } from '../../components/review/DeskShell';
import TagCards from '../../components/review/TagCards';
import TradeTape from '../../components/review/TradeTape';
import { dirInk, heldWords, pct, rWords, usd, usdSigned } from '../../components/review/words';
import { decayPerDay } from '../../data/review/engine';
import { excursionOf, type WayOut } from '../../data/review/excursion';
import { ENDED, OUT_WORD, cutFromQuery, dayMinOf, entryOf, inCut, nameOf, piecesWords, titleOf, whenWords, type JournalEntry, type JournalRow } from '../../data/review/journal';
import { useJournalSource, type JournalKind } from '../../data/review/journalSource';
import { contractWords } from '../../data/review/quotes';
import { dayWords } from '../../data/review/tape';
import { fmtClockLocal, fmtStampLocal } from '../../components/gex/chartTime';

const QUESTIONS: { key: 'why' | 'saw' | 'again'; ask: string; hint: string }[] = [
  { key: 'why', ask: 'Why I took it', hint: 'What you saw that made it a trade — the level, the tape, the plan' },
  { key: 'saw', ask: 'What I saw while in it', hint: 'What it did, what you felt, what you did about it' },
  { key: 'again', ask: 'What I would do again — and what I would not', hint: 'The one line you would want to read before the next one like it' },
];
const barDoor = 'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-borderSubtle font-mono text-[11px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted disabled:opacity-30 disabled:cursor-not-allowed transition-colors';

/** "at 11:42" on the trade's own day, "Jun 23, 11:42" on another */
const momentOf = (time: number, sameDay: boolean) => (sameDay ? `at ${fmtClockLocal(time as UTCTimestamp, 'ny')}` : fmtStampLocal(time as UTCTimestamp, 'ny'));

const wayOutWords = (row: JournalRow, w: WayOut): string => {
  const how = `${w.trailed ? ' · trailed' : ''}${w.movedToCost ? ' · moved to what was paid' : ''}`;
  if (w.of === 'name') return `when ${nameOf(row)} reached ${w.price.toFixed(2)}${how}`;
  const at = w.price.toFixed(2);
  return `${w.pnl != null ? `${at} · ${usdSigned(w.pnl, 0)}` : at}${how}`;
};
/** A ladder's rungs, nearest first: "1.20 (2 ×) · 1.60 (2 ×)" */
const rungsWords = (row: JournalRow, ws: WayOut[]): string => ws.map(w => `${w.of === 'name' ? `${nameOf(row)} ${w.price.toFixed(2)}` : w.price.toFixed(2)} (${[`${w.qty} ×`, w.trailed ? 'trailed' : '', w.movedToCost ? 'moved to what was paid' : ''].filter(Boolean).join(', ')})`).join(' · ');

/** A closed trade's page, in one journal — the backtest's or the paper accounts' */
export const JournalTradePage = ({ kind }: { kind: JournalKind }) => {
  const { sessionId, tradeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const source = useJournalSource(kind);
  const all = source.rows;
  const cut = useMemo(() => cutFromQuery(location.search), [location.search]);
  const row = all.find(r => r.s.id === sessionId && r.t.id === tradeId) ?? null;
  /* the walk: the cut the journal was showing — or every trade, if this one is no longer in it (a tag just changed) */
  const walk = useMemo(() => {
    const inIt = all.filter(r => inCut(r, cut));
    return row && inIt.some(r => r.key === row.key) ? inIt : all;
  }, [all, cut, row]);
  const index = row ? walk.findIndex(r => r.key === row.key) : -1;
  const newer = index > 0 ? walk[index - 1] : null;
  const older = index >= 0 && index < walk.length - 1 ? walk[index + 1] : null;
  const back = `${source.base}${location.search}`;
  const pathOf = (r: JournalRow) => `${source.base}/${r.s.id}/${r.t.id}${location.search}`;

  const hands = useRef({ newer, older, back, base: source.base });
  hands.current = { newer, older, back, base: source.base };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.querySelector('[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]')) return;
      const h = hands.current;
      const to = e.key === 'ArrowLeft' ? h.newer : e.key === 'ArrowRight' ? h.older : null;
      if (to) {
        e.preventDefault();
        navigate(`${h.base}/${to.s.id}/${to.t.id}${window.location.search}`, { replace: true });
      } else if (e.key === 'Escape') {
        e.preventDefault();
        navigate(h.back);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const ex = useMemo(() => (row ? excursionOf(row) : null), [row?.key, row?.t.pnl]); // eslint-disable-line react-hooks/exhaustive-deps
  /* THE READER'S USUAL SHAPE — the six reads averaged over the whole journal of this book, the ghost behind the trade's
     own; walked once per journal (the excursions are cached by trade) */
  const usual = useMemo(() => usualShape(all), [all]);

  if (!row || !ex) {
    return (
      <div className={`${card} px-6 py-14 text-center`} data-journal-trade="missing">
        <SayPage words="Trade not found" />
        <p className="text-[13px] text-textPrimary">That trade is not in this browser’s journal.</p>
        <p className="mt-1 text-[11px] text-textMuted">{kind === 'paper' ? 'A trade lives with its paper account on this machine.' : 'A trade lives with its session — if the session was deleted, its trades went with it.'}</p>
        <Link to={source.base} className="hit mt-4 inline-flex items-center gap-1.5 h-7 px-3 rounded-md border border-borderSubtle font-mono text-[11px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors">
          The journal <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  const entry = entryOf(row);
  const save = (patch: Partial<JournalEntry>) => source.setEntry(row.s.id, row.t.id, patch);
  /* THE WORDS ARE KEPT AS THEY ARE TYPED (Noah, 2026-09-22: "there is no place for me to know whether or not my
     words got saved into my journaling"): a beat after the last keystroke, and the moment the field is left. Each
     field says so beside its question — "Keeping…" while the beat runs, then "Kept" with a check in silver, the
     house's word for a thing held (the rail card's foot). Reload the page and the mark stands, read off the entry.
     A field with words in it wears a silver hairline, so the eye finds the answered ones. A pending beat is
     flushed — to the trade it was typed on — when the page walks to another trade or goes away. */
  type Ask = 'why' | 'saw' | 'again';
  const [keptState, setKeptState] = useState<Partial<Record<Ask, 'keeping' | 'kept'>>>({});
  const pending = useRef<Partial<Record<Ask, { timer: number; flush: () => void }>>>({});
  const keepNow = (key: Ask, v: string) => {
    const p = pending.current[key];
    if (p) window.clearTimeout(p.timer);
    delete pending.current[key];
    const next = v.trim();
    if (next !== (entry[key] ?? '')) save({ [key]: next, keptAt: Date.now() });
    setKeptState(k => ({ ...k, [key]: 'kept' }));
  };
  const keepSoon = (key: Ask, v: string) => {
    const p = pending.current[key];
    if (p) window.clearTimeout(p.timer);
    const flush = () => keepNow(key, v);
    pending.current[key] = { timer: window.setTimeout(flush, 700), flush };
    setKeptState(k => (k[key] === 'keeping' ? k : { ...k, [key]: 'keeping' }));
  };
  const flushAll = () => {
    for (const p of Object.values(pending.current)) {
      if (!p) continue;
      window.clearTimeout(p.timer);
      p.flush();
    }
    pending.current = {};
  };
  const flushRef = useRef(flushAll);
  flushRef.current = flushAll;
  useEffect(() => {
    /* another trade: what was pending goes to the trade it was typed on, and the marks start over */
    return () => {
      flushRef.current();
    };
  }, [row.key]);
  useEffect(() => setKeptState({}), [row.key]);
  const answered = QUESTIONS.filter(q => (entry[q.key] ?? '').trim()).length;
  const oneDay = row.t.opened.day === row.t.closed.day;

  /* what happened, in a sentence */
  const story =
    ex.best.pnl <= 0
      ? `It was never up. The most it was down was ${usd(Math.abs(ex.worst.pnl), 0)}, ${momentOf(ex.worst.time, oneDay)}.`
      : row.t.pnl > 0
        ? `Up ${usd(ex.best.pnl, 0)} at its best, ${momentOf(ex.best.time, oneDay)}. You took ${usd(row.t.pnl, 0)} — ${pct(ex.kept ?? 0)} of it.`
        : `Up ${usd(ex.best.pnl, 0)} at its best, ${momentOf(ex.best.time, oneDay)} — and it ended ${usdSigned(row.t.pnl, 0)}. None of the best was kept.`;
  /* THE SHAPE OF IT (Noah, 2026-09-29): six reads of the trade — it re-shapes as the words on the right are written */
  const shape = shapeOf(row, ex, entry);
  const vs = againstUsual(shape, usual);
  const names = (ks: (typeof vs)['above']) => ks.map(k => SHAPE_LABEL[k].toLowerCase()).join(', ');
  const versus = !usual ? 'Nothing to hold it against yet — the usual shape takes two trades or more.' : vs.above.length || vs.below.length ? `Against your usual: ${vs.above.length ? `fuller on ${names(vs.above)}` : ''}${vs.above.length && vs.below.length ? ', ' : ''}${vs.below.length ? `thinner on ${names(vs.below)}` : ''}.` : 'Against your usual: much the same shape.';
  const shapeInk = Math.abs(row.t.pnl) < 0.005 ? 'flat' : row.t.pnl > 0 ? 'bull' : 'bear';

  return (
    <div className="flex flex-col gap-3 animate-soft-in" key={row.key} data-journal-trade={row.key}>
      {/* THE HEAD: the way back, what it was, what it made — and the walk */}
      <div className={`${card} px-5 py-3.5 flex items-center gap-x-6 gap-y-2 flex-wrap`}>
        <Link to={back} className={barDoor} title="Back to the journal (Esc)" data-journal-back>
          <ArrowLeft className="w-3 h-3" /> The journal
        </Link>
        <div className="min-w-0 flex items-center gap-3 flex-wrap">
          <ContractLabel contract={contractWords(row.t.contract)} right={row.t.contract.right} logo={row.t.contract.ticker} />
          <span className={`font-mono text-[22px] font-semibold tnum ${dirInk(row.t.pnl)}`} data-journal-result>
            {usdSigned(row.t.pnl)} <span className="text-[11px] font-normal opacity-80">{row.t.r != null ? rWords(row.t.r) : 'no stop · no R'}</span>
          </span>
          <span className="text-[11px] text-textMuted whitespace-nowrap">
            {ENDED[row.t.how]}
            {row.t.how === 'scaled' ? ` — ${piecesWords(row)}` : ''} · {whenWords(row, row.t.closed)}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={() => newer && navigate(pathOf(newer), { replace: true })} disabled={!newer} title="The trade closed after this one (←)" className={barDoor} data-journal-newer>
            <ChevronLeft className="w-3 h-3" /> Newer
          </button>
          <span className="px-1 font-mono text-[11px] tnum text-textMuted whitespace-nowrap" data-journal-walk>
            {index + 1} of {walk.length}
          </span>
          <button type="button" onClick={() => older && navigate(pathOf(older), { replace: true })} disabled={!older} title="The trade closed before this one (→)" className={barDoor} data-journal-older>
            Older <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* the tab carries the trade's name, never the address's ids (layout/PageMeta) */}
      <SayPage words={titleOf(row)} />
      {/* THE TWO COLUMNS END LEVEL (Noah, 2026-09-26: "look at the random spacing in the bottom right corner"): the row
          stretches both, and each column's last card takes the room — the held chart grows on the left, the three answer
          boxes share it on the right — so neither ends above the other */}
      <div className="grid gap-3 items-stretch lg:grid-cols-[minmax(0,1fr)_440px]">
        {/* LOOKING AT IT AGAIN */}
        <div className="min-w-0 flex flex-col gap-3">
          <div className={`${card} min-w-0`}>
            <TradeTape row={row} excursion={ex} />
          </div>
          {/* THE SHAPE OF IT (Noah, 2026-09-29, with a six-axis radar beside this card: "a cooler hexogram" in place of
              "While you held it") — six reads of the trade as one figure, the reader's usual shape behind it; the six
              figures as dot-leader rows beside it, the story and the comparison under */}
          <div className={`${card} min-w-0 flex-1 flex flex-col`} data-journal-shape data-shape-area={shape.area.toFixed(2)}>
            <div className={`${head} flex-wrap h-auto min-h-9 py-1.5`}>
              <span className={headWord}>The shape of it</span>
              <span className="font-mono text-[11px] uppercase tracking-widest text-textMuted">six reads of the trade · {row.paper ? 'as the ticks had it' : 'at the bid you could have sold into'}{usual ? ' · your usual behind it' : ''}</span>
            </div>
            <div className="px-5 pt-3 pb-5 flex-1 flex flex-col justify-center gap-4">
              <div className="grid gap-x-8 gap-y-4 items-center md:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
                <TradeShapeFigure shape={shape} usual={usual} ink={shapeInk} rowKey={row.key} />
                <dl className="flex flex-col gap-2.5 min-w-0" data-shape-facts>
                  {shape.axes.map(a => (
                    <div key={a.key} className="min-w-0" data-shape-fact={a.key}>
                      <FactRow label={SHAPE_LABEL[a.key]} value={a.figure} valueCls={a.key === 'result' ? dirInk(row.t.pnl) : 'text-textPrimary'} />
                      <span className="block mt-0.5 text-[11px] leading-snug text-textMuted truncate" title={a.words}>
                        {a.words}
                      </span>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[12px] leading-relaxed text-textSecondary" data-shape-story>
                  {story} {versus}
                </p>
                {/* the ways out that rode it, named — the plan axis counts them, this line says which */}
                {(ex.targets.length > 0 || ex.stops.length > 0) && (
                  <p className="text-[11px] leading-relaxed text-textMuted" data-shape-rode>
                    {ex.target ? `The target that rode it: ${wayOutWords(row, ex.target)}` : ex.targets.length > 0 ? `The targets that rode it: ${rungsWords(row, ex.targets)}` : ''}
                    {(ex.target || ex.targets.length > 0) && (ex.stop || ex.stops.length > 0) ? ' · ' : ''}
                    {ex.stop ? `The stop that rode it: ${wayOutWords(row, ex.stop)}` : ex.stops.length > 0 ? `The stops that rode it: ${rungsWords(row, ex.stops)}` : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SAYING SOMETHING ABOUT IT */}
        <div className="min-w-0 flex flex-col gap-3">
          <div className={`${card} min-w-0`} data-journal-facts>
            <div className={head}>
              <span className={headWord}>The trade</span>
              <Link to={source.containerPath(row.s.id)} className="hit ml-auto font-mono text-[11px] text-textMuted hover:text-silver transition-colors truncate" title={`Open its ${source.containerWord}`}>
                {row.s.name}
              </Link>
            </div>
            <dl className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-3">
              <Fact label="In">{whenWords(row, row.t.opened)} · {row.t.avgIn.toFixed(2)}</Fact>
              {/* the figures that carry a direction wear it (2026-09-22: "all i see is black and white"): the way out in
                  the trade's own ink, the name's move in its own, the decay in the warn ink — it is a cost paid */}
              <Fact label="Out">{whenWords(row, row.t.closed)} · <span className={dirInk(row.t.pnl)}>{row.t.avgOut.toFixed(2)}</span></Fact>
              <Fact label="Size · what it cost">{row.t.qty} · {usd(row.t.cost)}</Fact>
              <Fact label="Expiry · days left at entry">{dayWords(row.t.contract.expiry)} · {row.t.dteIn}d</Fact>
              <Fact label="Delta · vol at entry">{row.t.deltaIn.toFixed(2)} · {Math.round(row.t.ivIn * 100)}%</Fact>
              <Fact label="The name, in → out">{row.t.spotIn.toFixed(2)} → <span className={dirInk(row.t.spotOut - row.t.spotIn)}>{row.t.spotOut.toFixed(2)}</span></Fact>
              {/* WHERE IT STOOD when it was opened — the name against its flip and walls (a paper fill's stamp) */}
              {row.paper && row.t.lvIn && (
                <Fact label="Where it stood at entry">
                  {row.t.spotIn >= row.t.lvIn.flip ? 'above' : 'below'} the flip {row.t.lvIn.flip.toFixed(2)} <span className="text-textMuted">· walls {row.t.lvIn.putWall.toFixed(2)} / {row.t.lvIn.callWall.toFixed(2)}</span>
                </Fact>
              )}
              <Fact label="Held">{heldWords(row.t.heldMin, dayMinOf(row))}</Fact>
              <Fact label="Decay it paid a day"><span className="text-warn">{usd(decayPerDay(row.t))}</span></Fact>
            </dl>
          </div>

          {/* IT LEFT IN PIECES (the ladder): every fill of the trade, in order — the ways in, and each piece going out */}
          {row.t.legs.length > 2 && (
            <div className={`${card} min-w-0`} data-journal-pieces>
              <div className={head}>
                <span className={headWord}>The pieces</span>
                <span className="ml-auto font-mono text-[11px] uppercase tracking-widest text-textMuted">every fill, in order</span>
              </div>
              <div className="px-4 py-1.5 flex flex-col">
                {row.t.legs.map((l, i) => {
                  const going = l.side === 'sell';
                  return (
                    <div key={i} className="flex items-baseline gap-3 h-8 border-b border-borderSubtle/60 last:border-0 font-mono text-[11px] tnum">
                      <span className="w-[112px] shrink-0 text-textMuted">{whenWords(row, l.at)}</span>
                      <span className="text-textPrimary">
                        {going ? 'Out' : 'In'} {l.qty} × <span className="text-textSecondary">{l.price.toFixed(2)}</span>
                      </span>
                      {l.out && <span className={`ml-auto ${l.out === 'target' ? 'text-bull' : l.out === 'stop' ? 'text-bear' : 'text-textSecondary'}`}>{OUT_WORD[l.out]}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={`${card} min-w-0`} data-journal-tag-card>
            <div className={head}>
              <span className={headWord}>Your tags</span>
              <span className="ml-auto font-mono text-[11px] uppercase tracking-widest text-textMuted">what the journal can count</span>
            </div>
            <div className="px-4 py-3">
              <TagCards entry={entry} onChange={save} />
            </div>
          </div>

          <div className={`${card} min-w-0 flex-1 flex flex-col`} data-journal-words>
            <div className={head}>
              <span className={headWord}>Your words</span>
              {/* the head counts what is kept — the card's own state, never a promise */}
              <span className={`ml-auto font-mono text-[11px] uppercase tracking-widest ${answered ? 'text-silver' : 'text-textMuted'}`} data-journal-answered={answered}>
                {answered === 0 ? 'nothing kept yet' : `${answered} of ${QUESTIONS.length} kept`} · on this machine
              </span>
            </div>
            <div className="px-4 py-3 flex-1 flex flex-col gap-3">
              {QUESTIONS.map(q => {
                const has = !!(entry[q.key] ?? '').trim();
                const state = keptState[q.key];
                const mark: 'keeping' | 'kept' | 'empty' = state === 'keeping' ? 'keeping' : state === 'kept' || has ? 'kept' : 'empty';
                return (
                  <label key={q.key} className="flex-1 min-h-0 flex flex-col gap-1.5">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-[12px] font-medium text-textPrimary">{q.ask}</span>
                      <span className={`inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest transition-colors ${mark === 'kept' ? 'text-silver' : 'text-textMuted'}`} data-journal-kept={mark} aria-live="polite">
                        {mark === 'keeping' && 'Keeping…'}
                        {mark === 'kept' && (
                          <>
                            <Check className="w-3 h-3" /> Kept
                          </>
                        )}
                      </span>
                    </span>
                    <textarea
                      key={`${row.key}:${q.key}`}
                      className={`flex-1 min-h-[72px] px-3 py-2 rounded-md border bg-chip text-[12px] leading-relaxed text-textPrimary placeholder:text-textMuted outline-none focus:border-silver/60 transition-colors resize-y ${has ? 'border-silver/35' : 'border-borderSubtle'}`}
                      defaultValue={entry[q.key] ?? ''}
                      onChange={e => keepSoon(q.key, e.target.value)}
                      onBlur={e => keepNow(q.key, e.target.value)}
                      placeholder={q.hint}
                      data-journal-answer={q.key}
                      data-journal-has={has || undefined}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <p className="px-1 font-mono text-[11px] text-textMuted">{source.foot}</p>
    </div>
  );
};

