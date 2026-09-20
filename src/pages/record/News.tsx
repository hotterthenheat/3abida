/*
==================================================
  SLAYER TERMINAL - NEWS (pages/record/News.tsx)

  The wire, rebuilt from a blank canvas under the
  Record (Noah, 2026-09-09: "everything of benefit
  related to news, what it effects, numbers,
  interactive parts. but most importantly i want a
  2d map that has pins on the news you click").
  Two boxes, read top to bottom:

    THE WIRE    the head with four facts, one line
                of cards, then the MAP with a pin on
                every city the day's stories come
                from beside THE STORY in hand — its
                grade, its numbers, what the options
                book thinks of it, the odds, the
                playbook, what kills it, where it
                lands — then every story as a row;
                a click on a row or a pin picks the
                story. No doors out and no drip bar
                (2026-09-13): "this should be a 100%
                news page, just have the info"
    THE DAY     what is ahead on the calendar, and
                the reads the wire adds up to

  Everything speaks the two engines that were here
  before (data/news.ts, data/newsroom.ts); the room
  they used to fill is archived in
  docs/news-page-reference.md.
==================================================
*/

import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import DropdownMulti, { type MultiGroup } from '../../components/ui/DropdownMulti';
import GuideFocus, { GuideDoor } from '../../components/ui/GuideFocus';
import AnimatedNumber from '../../components/ui/AnimatedNumber';
import CompanyLogo from '../../components/ui/CompanyLogo';
import RichRead from '../../components/ui/RichRead';
import CatTag from '../../components/news/CatTag';
import NewsMap, { HeatLegend, openSessions, type HeatPoint, type Reach } from '../../components/record/NewsMap';
import { now } from '../../core/clock';
import { NewsGuide } from '../../components/record/NewsGuide';
import { useBoardNames } from '../../data/boardNames';
import { buildNewsDeepRead, marketMood, type NewsCategory } from '../../data/news';
import { lookup } from '../../data/universe';
import { buildEconCalendar, buildGeoNews, buildRoomInsights, clusterByCity, freshnessOf, severityWord, type CityPing, type GeoNewsEvent, type NewsGrade } from '../../data/newsroom';
import { NEWS_ROW_H } from './recordSkeletons';
import { Name } from '../../components/ui/Name';
import { ImpactLegend, ImpactMark, tierOf } from '../../components/record/impactMark';
import NewsFeedTabs from '../../components/record/NewsFeedTabs';
import NewsCalendar from '../../components/record/NewsCalendar';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
/** The calendar's when column: "Thu 09-10 08:30 AM" is 18 mono glyphs at 10px (~108px) */
const CAL_WHEN_W = 128;
const GRADE_INK: Record<NewsGrade, string> = { THREAT: 'text-bear', ALLY: 'text-bull', WATCH: 'text-textSecondary' };
const GRADE_BAR: Record<NewsGrade, string> = { THREAT: 'bg-bear/85', ALLY: 'bg-bull', WATCH: 'bg-ink/40' };
/** The grade in the page's words — how the story reads for the name (Noah, 2026-09-09: "positive, negative") */
const GRADE_WORD: Record<NewsGrade, string> = { THREAT: 'negative', ALLY: 'positive', WATCH: 'neutral' };

type CategoryPick = 'all' | NewsCategory;
type LeanPick = 'any' | NewsGrade;
type NamesPick = 'all' | 'board' | 'macro';
type Sort = 'newest' | 'move' | 'sure' | 'loud';

const CATEGORY_OPTIONS: DropdownOption<CategoryPick>[] = [
  { value: 'all', label: 'All', hint: 'Every kind of story' },
  { value: 'Earnings', label: 'Earnings', hint: 'Prints and what they said' },
  { value: 'Guidance', label: 'Guidance', hint: 'What a company said about what is coming' },
  { value: 'Analyst', label: 'Analyst', hint: 'Upgrades, downgrades, targets' },
  { value: 'Macro', label: 'Macro', hint: 'The economy and the Fed — no single name' },
  { value: 'M&A', label: 'M&A', hint: 'Deals, bids, spin-offs' },
  { value: 'Product', label: 'Product', hint: 'Launches and reviews' },
  { value: 'Regulatory', label: 'Regulatory', hint: 'Courts, agencies, probes' },
];
const LEAN_OPTIONS: DropdownOption<LeanPick>[] = [
  { value: 'any', label: 'Any lean', hint: 'Positive, negative and neutral stories' },
  { value: 'ALLY', label: 'Positive', hint: 'Stories the model reads as good for the name' },
  { value: 'THREAT', label: 'Negative', hint: 'Stories the model reads as bad for the name' },
  { value: 'WATCH', label: 'Neutral', hint: 'Stories with no clear direction yet' },
];
const NAMES_OPTIONS: DropdownOption<NamesPick>[] = [
  { value: 'all', label: 'Every name', hint: 'Every story on the wire' },
  { value: 'board', label: 'Your board', hint: 'Stories on the names on your Board' },
  { value: 'macro', label: 'Macro only', hint: 'Stories with no single name' },
];
const SORT_OPTIONS: DropdownOption<Sort>[] = [
  { value: 'newest', label: 'Newest', hint: 'The latest story first' },
  { value: 'move', label: 'Biggest move', hint: 'The largest expected one-day move first' },
  { value: 'sure', label: 'Most sure', hint: 'The highest model confidence first' },
  { value: 'loud', label: 'Loudest', hint: 'The hardest-landing story first' },
];

const ago = (m: number) => (m < 1 ? 'just now' : m < 60 ? `${Math.round(m)}m ago` : `${Math.floor(m / 60)}h ${Math.round(m % 60)}m ago`);
const signed = (v: number, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`;

const Fact = ({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) => (
  <div>
    <dt className="text-[10px] text-textMuted whitespace-nowrap">{label}</dt>
    <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-news-fact={testId}>
      {children}
    </dd>
  </div>
);

/** A figure on the story card — label over value, the card's own smaller scale */
const Figure = ({ label, tone = 'text-textPrimary', children, title }: { label: string; tone?: string; children: React.ReactNode; title?: string }) => (
  <div className="min-w-0" title={title}>
    <div className="text-[9px] text-textMuted whitespace-nowrap truncate">{label}</div>
    <div className={`mt-0.5 font-mono text-[12px] font-semibold tnum whitespace-nowrap ${tone}`}>{children}</div>
  </div>
);

/** The odds, Down against Up — NOT keyed by story, so the split slides between stories (the v1 contract) */
const OddsBar = ({ probUp }: { probUp: number }) => (
  <div data-news-odds>
    <div className="flex items-center justify-between font-mono text-[10px] tnum">
      <span className={probUp < 50 ? 'text-bear font-semibold' : 'text-textSecondary'}>
        down <AnimatedNumber value={100 - probUp} format={v => `${Math.round(v)}%`} />
      </span>
      <span className="text-[9px] uppercase tracking-widest text-textMuted">odds next session</span>
      <span className={probUp >= 50 ? 'text-bull font-semibold' : 'text-textSecondary'}>
        up <AnimatedNumber value={probUp} format={v => `${Math.round(v)}%`} />
      </span>
    </div>
    <div className="mt-1.5 flex h-[6px] rounded-full overflow-hidden bg-ink/[0.06]">
      <span className="h-full bg-bear/80" style={{ width: `${100 - probUp}%`, transition: `width 520ms ${EASE}` }} />
      <span className="h-full bg-bull" style={{ width: `${probUp}%`, transition: `width 520ms ${EASE}` }} />
    </div>
  </div>
);

const News = () => {
  const location = useLocation();
  const boardNames = useBoardNames();

  /* THE WIRE TICKS — stories drip in through the session; re-read every half minute */
  const [wireRev, setWireRev] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setWireRev(r => r + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const events = useMemo(() => buildGeoNews(), [wireRev]); // eslint-disable-line react-hooks/exhaustive-deps
  const calendar = useMemo(() => buildEconCalendar(), [wireRev]); // eslint-disable-line react-hooks/exhaustive-deps
  const mood = useMemo(() => marketMood(), [wireRev]); // eslint-disable-line react-hooks/exhaustive-deps

  /* THE MOMENT IN VIEW is live — the day's drip bar left the page (Noah,
     2026-09-13: "remove this live bar, makes no sense to have it, this is a
     news page, why the hell would you rewind news") */
  const nowDate = useMemo(() => now(), [wireRev]); // eslint-disable-line react-hooks/exhaustive-deps
  const viewEvents = events;
  const at = nowDate;
  const insights = useMemo(() => buildRoomInsights(viewEvents), [viewEvents]);

  /* THE CARDS cut the wire; the map and the list read the same cut */
  const [category, setCategory] = useState<CategoryPick>('all');
  const [lean, setLean] = useState<LeanPick>('any');
  const [names, setNames] = useState<NamesPick>('all');
  const [sort, setSort] = useState<Sort>('newest');
  /* THE FILTER reads what the other three cards leave on the wire — every
     name and every city there, with its count — and keeps any number of them
     (Noah: "it should read whats on the current page … so user can select
     what to add"). A pick is `name:NVDA` or `city:Riyadh`; any pick matching
     keeps the row. */
  const [picks, setPicks] = useState<string[]>([]);
  const cut = useMemo(() => {
    const board = new Set(boardNames);
    return viewEvents.filter(e => {
      if (category !== 'all' && e.item.category !== category) return false;
      if (lean !== 'any' && e.grade !== lean) return false;
      if (names === 'board' && !(e.item.ticker && board.has(e.item.ticker))) return false;
      if (names === 'macro' && e.item.ticker) return false;
      return true;
    });
  }, [viewEvents, category, lean, names, boardNames]);
  const filterGroups = useMemo<MultiGroup[]>(() => {
    const nameCount = new Map<string, number>();
    const cityCount = new Map<string, number>();
    cut.forEach(e => {
      const n = e.item.ticker ?? 'MACRO';
      nameCount.set(n, (nameCount.get(n) ?? 0) + 1);
      cityCount.set(e.origin.city, (cityCount.get(e.origin.city) ?? 0) + 1);
    });
    /* a pick whose name has left the cut stays listed so it can be unpicked */
    picks.forEach(p => {
      const [kind, key] = p.split(':');
      if (kind === 'name' && !nameCount.has(key)) nameCount.set(key, 0);
      if (kind === 'city' && !cityCount.has(key)) cityCount.set(key, 0);
    });
    const byCountThenName = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0]);
    return [
      {
        title: 'Names on the wire',
        options: [...nameCount.entries()].sort(byCountThenName).map(([n, c]) => ({ value: `name:${n}`, label: n, hint: n === 'MACRO' ? 'Stories with no single name' : lookup(n)?.name, count: c })),
      },
      {
        title: 'Cities on the map',
        options: [...cityCount.entries()].sort(byCountThenName).map(([c, n]) => ({ value: `city:${c}`, label: c, count: n })),
      },
    ];
  }, [cut, picks]);
  const rows = useMemo(() => {
    const picked = new Set(picks);
    const kept = picked.size === 0 ? cut : cut.filter(e => picked.has(`name:${e.item.ticker ?? 'MACRO'}`) || picked.has(`city:${e.origin.city}`));
    const by: Record<Sort, (a: GeoNewsEvent, b: GeoNewsEvent) => number> = {
      newest: (a, b) => a.item.minutesAgo - b.item.minutesAgo,
      move: (a, b) => Math.abs(b.item.prediction.expMove1dPct) - Math.abs(a.item.prediction.expMove1dPct),
      sure: (a, b) => b.item.prediction.confidencePct - a.item.prediction.confidencePct,
      loud: (a, b) => b.severity - a.severity,
    };
    return [...kept].sort(by[sort]);
  }, [cut, picks, sort]);
  const pins = useMemo(() => clusterByCity(rows), [rows]);
  /* THE HEAT: where the cut's news lands, every story's zones summed by place */
  const heat = useMemo<HeatPoint[]>(() => {
    const sum = new Map<string, HeatPoint>();
    rows.forEach(e =>
      e.impacts.forEach(zn => {
        const key = `${zn.lat},${zn.lng}`;
        const had = sum.get(key);
        if (had) had.w += zn.w;
        else sum.set(key, { lat: zn.lat, lng: zn.lng, w: zn.w });
      })
    );
    return [...sum.values()];
  }, [rows]);

  /* THE STORY IN HAND — the Pulse tile's deep link opens on its story; else the first */
  const [selectedId, setSelectedId] = useState<string | null>(() => (location.state as { selectedId?: string } | null)?.selectedId ?? null);
  useEffect(() => {
    if (rows.length === 0) return;
    if (!selectedId || !rows.some(r => r.id === selectedId)) setSelectedId(rows[0].id);
  }, [rows, selectedId]);
  const selected = rows.find(r => r.id === selectedId) ?? viewEvents.find(e => e.id === selectedId) ?? null;
  const deep = useMemo(() => (selected ? buildNewsDeepRead(selected.item) : null), [selected]);
  const reach = useMemo<Reach | null>(() => (selected ? { lat: selected.origin.lat, lng: selected.origin.lng, city: selected.origin.city, zones: selected.impacts } : null), [selected]);
  const sessionsOpen = useMemo(() => openSessions(at), [at]);
  const [hoverCity, setHoverCity] = useState<CityPing | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  /* THE FACTS */
  const positive = rows.filter(r => r.grade === 'ALLY').length;
  const negative = rows.filter(r => r.grade === 'THREAT').length;
  const biggest = rows.filter(r => r.item.ticker).reduce<GeoNewsEvent | null>((m, r) => (!m || Math.abs(r.item.prediction.expMove1dPct) > Math.abs(m.item.prediction.expMove1dPct) ? r : m), null);
  const nextPrint = calendar.find(c => c.impact === 'high' && c.inMinutes >= 0) ?? calendar.find(c => c.inMinutes >= 0) ?? null;
  const moodInk = mood.label === 'LEANS BULLISH' ? 'text-bull' : mood.label === 'LEANS BEARISH' ? 'text-bear' : 'text-textPrimary';

  return (
    <>
      {/* BOX 1 — THE WIRE */}
      <div className="relative border border-borderSubtle rounded-md bg-panel" data-news data-news-wire>
        <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the wire" testId="news-guide" viewport>
          <NewsGuide />
        </GuideFocus>
        {/* THE HEAD */}
        <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="h-6 flex items-center gap-3">
              <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">The wire</h3>
              <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the pins, the grade and the numbers mean" testId="news-guide" />
            </div>
            <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">Every story on the wire today · a pin on every city a story comes from · click a pin or a row and the story opens beside the map</p>
          </div>
          <dl className="grid grid-cols-4 gap-x-6">
            <Fact label="Stories" testId="stories">
              {rows.length} <span className="text-textMuted">· {positive} positive · {negative} negative</span>
            </Fact>
            <Fact label="The wire leans" testId="mood">
              <span className={moodInk}>{mood.label === 'LEANS BULLISH' ? 'bullish' : mood.label === 'LEANS BEARISH' ? 'bearish' : 'mixed'}</span>
            </Fact>
            <Fact label="Biggest move" testId="biggest">
              {biggest ? (
                <>
                  {biggest.item.ticker ? <Name t={biggest.item.ticker} size={12} /> : 'the market'} <span className={biggest.item.prediction.expMove1dPct >= 0 ? 'text-bull' : 'text-bear'}>{signed(biggest.item.prediction.expMove1dPct)}</span>
                </>
              ) : (
                <span className="text-textMuted">—</span>
              )}
            </Fact>
            <Fact label="Next print" testId="next">
              {nextPrint ? (
                <>
                  {nextPrint.title} <span className={nextPrint.inMinutes < 90 ? 'text-warn' : 'text-textMuted'}>· in {nextPrint.inMinutes < 60 ? `${nextPrint.inMinutes}m` : `${Math.floor(nextPrint.inMinutes / 60)}h ${nextPrint.inMinutes % 60}m`}</span>
                </>
              ) : (
                <span className="text-textMuted">nothing ahead today</span>
              )}
            </Fact>
          </dl>
        </div>
        {/* THE ONE LINE OF CONTROLS */}
        <div className="px-5 pb-3 flex items-center gap-2 flex-wrap" data-news-controls>
          <DropdownSelect label="Kind" value={category} options={CATEGORY_OPTIONS} onChange={setCategory} title="What kind of story" testId="news-kind" />
          <DropdownSelect label="Lean" value={lean} options={LEAN_OPTIONS} onChange={setLean} title="Which way the story reads for the name" testId="news-lean" />
          <DropdownSelect label="Names" value={names} options={NAMES_OPTIONS} onChange={setNames} title="Whose stories" testId="news-names" />
          <DropdownSelect label="Sort" value={sort} options={SORT_OPTIONS} onChange={setSort} title="The order of the wire" testId="news-sort" />
          <HeatLegend className="ml-2" />
          <div className="ml-auto" title="The names and cities on the wire right now — tick any number; the map and the list keep only those">
            <DropdownMulti label="Filter" values={picks} groups={filterGroups} onChange={setPicks} title="Keep only these" testId="news-filter" />
          </div>
        </div>

        {/* THE MAP AND THE STORY */}
        <div className="grid border-t border-borderSubtle" style={{ gridTemplateColumns: 'minmax(0, 1fr) 400px' }} data-news-band>
          <div className="min-w-0 flex flex-col border-r border-borderSubtle">
            <div className="flex-1 min-h-0 px-2 pt-2">
              <NewsMap pins={pins} selectedCity={selected?.origin.city ?? null} hoverCity={hoverCity?.city ?? null} onPick={p => setSelectedId(p.topId)} onHover={setHoverCity} heat={heat} reach={reach} at={at} />
            </div>
            {/* ONE READ LINE under the map */}
            <div className="px-4 h-[26px] border-t border-borderSubtle flex items-center gap-3 font-mono text-[10px] text-textSecondary whitespace-nowrap overflow-hidden" data-news-map-read>
              {hoverCity ? (
                <>
                  <span className="font-bold text-textPrimary">{hoverCity.city}</span>
                  <span>
                    {hoverCity.n} {hoverCity.n === 1 ? 'story' : 'stories'}
                    {hoverCity.threats > 0 && <span className="text-bear"> · {hoverCity.threats} negative</span>}
                    {hoverCity.allies > 0 && <span className="text-bull"> · {hoverCity.allies} positive</span>}
                  </span>
                  <span className="text-textMuted truncate">· {hoverCity.topHeadline}</span>
                  <span className="ml-auto text-textMuted">click for its loudest story</span>
                </>
              ) : (
                <>
                  <span className="text-textMuted truncate">
                    {pins.length} {pins.length === 1 ? 'city' : 'cities'} · the land warms where the news lands · the arcs are where the open story reaches · scroll to zoom, pull to pan
                  </span>
                  <span className="ml-auto shrink-0" data-news-session-read>
                    {sessionsOpen.length ? (
                      <>
                        <span className="text-silver">{sessionsOpen.map(s => s.label).join(', ')}</span> <span className="text-textMuted">open</span>
                      </>
                    ) : (
                      <span className="text-textMuted">no cash session open</span>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* THE STORY IN HAND */}
          <div className="min-w-0 px-4 pt-3 pb-3 flex flex-col gap-3" data-news-story={selected?.id}>
            {selected && deep ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  {selected.item.ticker ? (
                    <Name t={selected.item.ticker} size={16} className="font-mono text-[12px] font-bold text-textPrimary" />
                  ) : (
                    <span className="font-mono text-[12px] font-bold text-textPrimary">MACRO</span>
                  )}
                  <span className={`font-mono text-[9px] font-semibold uppercase tracking-widest ${GRADE_INK[selected.grade]}`}>{GRADE_WORD[selected.grade]}</span>
                  <CatTag category={selected.item.category} size={9} />
                  <span className="ml-auto font-mono text-[9px] text-textMuted whitespace-nowrap">
                    {selected.item.source} · {ago(selected.item.minutesAgo)}
                  </span>
                </div>
                <p className="text-[13px] leading-snug text-textPrimary" data-news-headline>
                  {selected.item.headline}
                </p>
                {/* the impact, as a meter, in the grade's ink */}
                <div>
                  <div className="flex items-center justify-between text-[9px] text-textMuted">
                    <span className="inline-flex items-center gap-1.5">
                      <ImpactMark tier={tierOf(selected.severity)} />
                      <span>
                        Lands <span className="text-textSecondary">{severityWord(selected.severity)}</span> · from <span className="text-textSecondary">{selected.origin.city}</span>
                      </span>
                    </span>
                    <span>{freshnessOf(selected)}</span>
                  </div>
                  <div className="mt-1 h-[4px] rounded-full bg-ink/[0.06] overflow-hidden">
                    <span className={`block h-full rounded-full ${GRADE_BAR[selected.grade]}`} style={{ width: `${selected.severity * 10}%`, transition: `width 520ms ${EASE}` }} />
                  </div>
                </div>
                {/* THE NUMBERS — what the model expects, and what the options book thinks of it */}
                <div className="grid grid-cols-3 gap-x-3 gap-y-2.5" data-news-numbers>
                  <Figure label="1-day expected" tone={selected.item.prediction.expMove1dPct >= 0 ? 'text-bull' : 'text-bear'}>
                    <AnimatedNumber value={selected.item.prediction.expMove1dPct} format={v => signed(v)} />
                  </Figure>
                  <Figure label="5-day expected" tone={selected.item.prediction.expMove5dPct >= 0 ? 'text-bull' : 'text-bear'}>
                    <AnimatedNumber value={selected.item.prediction.expMove5dPct} format={v => signed(v)} />
                  </Figure>
                  <Figure label="Confidence">
                    <AnimatedNumber value={selected.item.prediction.confidencePct} format={v => `${Math.round(v)}%`} />
                  </Figure>
                  <Figure label="Already priced in" title="How much of the expected move the tape has discounted already" tone={deep.pricedInPct >= 70 ? 'text-warn' : 'text-textPrimary'}>
                    <AnimatedNumber value={deep.pricedInPct} format={v => `${Math.round(v)}%`} />
                  </Figure>
                  <Figure label="Keeps working" title="Sessions until the story's pull halves">
                    {deep.halfLifeSessions.toFixed(1)} <span className="text-[10px] font-normal text-textMuted">sessions</span>
                  </Figure>
                  <Figure label="The options book" title="Whether dealer positioning backs the story or leans against it" tone={deep.bookLabel === 'CONFIRMS' ? 'text-bull' : deep.bookLabel === 'FADES' ? 'text-bear' : 'text-textSecondary'}>
                    {deep.bookLabel === 'CONFIRMS' ? 'backs it' : deep.bookLabel === 'FADES' ? 'fades it' : 'neutral'}
                  </Figure>
                </div>
                <OddsBar probUp={selected.item.prediction.probUpPct} />
                {/* THE WORDS — the playbook, the analog, what kills it — keyed so they soft-fade per story */}
                <div key={selected.id} className="flex flex-col gap-2 animate-soft-in text-[11.5px] leading-relaxed text-textSecondary">
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-textMuted">Playbook</div>
                    <p className="mt-0.5">
                      <RichRead text={selected.item.prediction.playbook} />
                    </p>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-textMuted">Before, stories like this</div>
                    <p className="mt-0.5">
                      <RichRead text={selected.item.prediction.analog} />
                    </p>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-textMuted">What kills it</div>
                    <p className="mt-0.5">
                      <RichRead text={deep.invalidation} />
                    </p>
                  </div>
                </div>
                {/* WHERE IT LANDS — the story's zones, the heaviest first */}
                {selected.impacts.length > 0 && (
                  <div className="flex flex-col gap-1.5" data-news-zones>
                    <div className="text-[9px] uppercase tracking-widest text-textMuted">Where it lands · {selected.impacts.length} zones</div>
                    {[...selected.impacts]
                      .sort((a, b) => b.w - a.w)
                      .slice(0, 4)
                      .map(z => (
                        <div key={z.label} className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-textPrimary w-28 truncate">{z.label}</span>
                          <span className="flex-1 h-[4px] rounded-full bg-ink/[0.06] overflow-hidden">
                            <span className={`block h-full rounded-full ${GRADE_BAR[selected.grade]}`} style={{ width: `${Math.min(100, z.w * 10)}%` }} />
                          </span>
                          <span className="font-mono text-[9px] text-textMuted w-9 text-right">{z.w >= 7 ? 'heavy' : z.w >= 4 ? 'firm' : 'light'}</span>
                        </div>
                      ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center font-mono text-[10px] uppercase tracking-widest text-textMuted">Nothing on the wire for these cards</div>
            )}
          </div>
        </div>

        {/* THE ROWS — every story on the cut, in the chosen order */}
        <div className="border-t border-borderSubtle" data-news-rows>
          <div className="px-5 h-[22px] grid items-center gap-x-3 text-[9px] uppercase tracking-widest text-textMuted" style={{ gridTemplateColumns: '72px 104px 96px 72px minmax(0, 1fr) 76px 72px' }}>
            <span>Time</span>
            <span>Name</span>
            <span>Kind</span>
            <span>Reads</span>
            <span className="flex items-center gap-4">
              <span>Headline</span>
              <ImpactLegend />
            </span>
            <span className="text-right">1-day</span>
            <span className="text-right">Sure</span>
          </div>
          {rows.length === 0 && <div className="px-5 py-6 text-center font-mono text-[10px] uppercase tracking-widest text-textMuted">Nothing on the tape for these cards</div>}
          {rows.map(e => {
            const open = e.id === selectedId;
            const faded = freshnessOf(e) === 'faded';
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelectedId(e.id)}
                className={`group w-full text-left px-5 grid items-center gap-x-3 border-t border-borderSubtle/40 transition-colors ${open ? 'bg-silver/[0.06] shadow-[inset_2px_0_0_0_rgba(199,211,232,0.7)]' : 'hover:bg-silver/[0.05]'} ${faded && !open ? 'opacity-60' : ''}`}
                style={{ height: NEWS_ROW_H, gridTemplateColumns: '72px 104px 96px 72px minmax(0, 1fr) 76px 72px' }}
                data-news-row={e.id}
                data-open={open || undefined}
              >
                <span className="font-mono text-[10px] tnum text-textSecondary">{e.item.time}</span>
                <span className="min-w-0 inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-textPrimary">
                  {e.item.ticker ? (
                    <>
                      <CompanyLogo ticker={e.item.ticker} size={14} />
                      {e.item.ticker}
                    </>
                  ) : (
                    <span className="text-textSecondary">MACRO</span>
                  )}
                </span>
                <span className="min-w-0">
                  <CatTag category={e.item.category} size={9} />
                </span>
                <span className={`font-mono text-[9px] font-semibold uppercase tracking-widest ${GRADE_INK[e.grade]}`}>{GRADE_WORD[e.grade]}</span>
                <span className="min-w-0 flex items-center gap-2">
                  <ImpactMark tier={tierOf(e.severity)} />
                  <span className={`min-w-0 truncate text-[12px] ${open ? 'text-textPrimary' : 'text-textSecondary group-hover:text-textPrimary'} transition-colors`}>{e.item.headline}</span>
                </span>
                <span className={`text-right font-mono text-[11px] font-semibold tnum ${e.item.prediction.expMove1dPct >= 0 ? 'text-bull' : 'text-bear'}`}>{signed(e.item.prediction.expMove1dPct)}</span>
                <span className="text-right font-mono text-[10px] tnum text-textSecondary">{Math.round(e.item.prediction.confidencePct)}%</span>
              </button>
            );
          })}
        </div>
        <p className="px-5 pb-4 pt-3 border-t border-borderSubtle/40 text-[12px] leading-relaxed text-textSecondary" data-news-sentence>
          <RichRead text={mood.note} />
        </p>
      </div>

      {/* BOX 2 — ALL NEWS: every headline as a feed with tabs, and the names you follow (2026-09-13) */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-news-all>
        <div className="px-5 pt-4 pb-3">
          <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">All news</h3>
          <p className="mt-0.5 text-[11px] text-textSecondary">Every headline on the wire, newest first · a tab per kind · follow a name and ring the bell on it · a click opens the story beside the map</p>
        </div>
        <div className="border-t border-borderSubtle">
          <NewsFeedTabs events={viewEvents} calendar={calendar} selectedId={selectedId} onPick={id => setSelectedId(id)} />
        </div>
      </div>

      {/* BOX 3 — THE DAY: the month on the record, and what the wire adds up to */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-news-day>
        <div className="px-5 pt-4 pb-3">
          <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">The day</h3>
          <p className="mt-0.5 text-[11px] text-textSecondary">What is ahead on the calendar — walk the months, open a day — and the reads the wire adds up to</p>
        </div>
        <div className="border-t border-borderSubtle">
          <NewsCalendar />
        </div>
        <div className="grid grid-cols-3 border-t border-borderSubtle" data-news-reads>
          {insights.map((i, k) => (
            <div key={i.key} className={`px-5 py-3 ${k > 0 ? 'border-l border-borderSubtle/60' : ''}`} data-news-read={i.key}>
              <div className={`text-[10px] font-semibold uppercase tracking-widest ${i.ink === 'bull' ? 'text-bull' : i.ink === 'bear' ? 'text-bear' : 'text-textPrimary'}`}>{i.title}</div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-textPrimary/85">
                <RichRead text={i.read} />
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default News;
