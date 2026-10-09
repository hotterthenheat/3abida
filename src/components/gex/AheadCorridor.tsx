/*
==================================================
  SLAYER TERMINAL - THE RANGE
  (components/gex/AheadCorridor.tsx)

  Band 1 of the Ahead page: where price can go, then
  what dealers must trade.

  REDRAWN ON ONE PRICE SCALE (2026-09-13; the
  partner's sketch of a horizontal ruler — Noah: "i
  agree with him. design this but make it more sharp
  and snappy, concise and clean"). The morning's
  cone put the range on a time axis and the shape
  was the hardest thing on the page to read; a range
  is one question — how far — and a scale answers it
  at a glance:

    THE RANGE       one price scale across the box.
                    The likely range is the silver
                    band with its two edges; the
                    rarer stretch, two expected moves
                    out, is the faint track past it —
                    dashed on the flip's fast side,
                    where moves run. The walls, the
                    flip and the supreme are posts in
                    their inks, named above with
                    their price; a wall the expected
                    move can reach before the bell
                    carries the clock time it gets
                    there. Spot is the white rule
                    with the silver ring where we
                    are. The regular price ticks run
                    under the track, and one expected
                    move each side is the bracket
                    under them. The pointer reads any
                    price — its distance from spot,
                    which stretch it is in, whether
                    moves run or slow there — and
                    snaps to a post for the post's
                    own read; a click on a post makes
                    it the strike. Under a vol move
                    the walls' ghosts are dashed
                    posts.

    WHAT DEALERS    the partner's pane (Noah, the same
    MUST TRADE      evening: "his buying/selling cards
                    are more aesthetically pleasing…
                    use his design pattern"): a
                    bordered dark pane with BUYING
                    above the middle line and SELLING
                    below it, one plain rounded bar per
                    half hour from the line — up green,
                    down red — the tallest at 38% of
                    the pane, the figure at every bar's
                    end, the hour under it, DONE over
                    the half hours gone, the one under
                    way in the silver edge; the If vol
                    card on the pane's head line, the
                    vanna read as its own line under
                    the sentence; ONE fixed read line
                    under the pane speaks the half hour
                    under the pointer.

  The scale is the house's own (the name's page's
  book on a scale): thin lines, fills at 0.10–0.12,
  hairlines at 0.16, 9px mono axis text, sans names
  in the level's ink, a card beside the pointer.
  Noah's rulings of 2026-09-06 hold: no chips on the
  price axis, no filled pill for spot (the partner's
  white pill is a white rule and a plain readout
  here), no outlined type.
==================================================
*/

import { useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import DropdownSelect from '../ui/DropdownSelect';
import GuideFocus, { GuideDoor } from '../ui/GuideFocus';
import { CorridorGuide } from './AheadGuide';
import { CALL_WALL, FLIP, PUT_WALL, SUPREME } from './paletteInk';
import { useResolvedTheme } from '../../theme/theme';
import { CLOSE_MIN, VOL_OPTIONS, fmtDollars, fmtPrice, fmtStrike, hhmm, volWords, type AheadClock, type Corridor, type Schedule, type ScheduleBlock, type VolPoints } from '../../data/ahead';
import type { ExposureLevels } from '../../types/gex';
import { FONT_SANS } from '../../theme/fonts';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const GREEN = CALL_WALL;
const RED = PUT_WALL;
/* THE TWO FIGURES FOLLOW THE PAGE (the light sweep, 2026-09-19 — Noah, with the light Ahead page: "do you see the
   problem?" — two black boxes on paper). They were dark islands on either theme by his 2026-09-12 word ("the charts to by
   default always be black"); that night's sweep turned it: on paper a drawn figure is part of the page — one soft grey,
   the page's own inks — and on the dark terminal it is EXACTLY what it was. So every neutral ink has two values: the
   typed ones the dark figure always had (kept to the digit — a light-theme change never moves the dark theme), and
   tokens for paper. The level inks (walls, flip, supreme, silver) were tokens already and re-ink off the box's stamp. */
const DARK_FIG = { spot: '#ededed', wash: '#ffffff', tick: '#7c8290', faint: '#8a909c', hole: '#0e0e0f', band: 0.12 };
const PAPER_FIG = { spot: 'rgb(var(--text-primary))', wash: 'rgb(var(--ink))', tick: 'rgb(var(--text-secondary))', faint: 'rgb(var(--text-muted))', hole: 'rgb(var(--inset))', band: 0.16 };
/* the figures' voice — Helvetica's digits are tabular (theme/fonts.ts) */
const FIGS = FONT_SANS;
const SANS = FONT_SANS;
const W = 1200;
/* THE SCALE runs the box's width — no axis column; the prices sit under the track */
const SM = { l: 12, r: 12 };
const SH = 114;
/** The scale's rows, top to bottom: three rows of names, the posts, the track, the ticks and their figures, the bracket and its words */
const ROW = { names: [9, 20, 31], postTop: 36, postBot: 74, track: 55, bandTop: 49, bandH: 12, tick: 68, figure: 84, bracket: 96, words: 109 };
/** The room between two names on one row */
const NAME_GAP = 10;
/** How near a post the pointer snaps to it, in the scale's units */
const SNAP = 9;
/** THE GLIDE — every mark on the scale and every bar in the pane moves to its new place on the
    house curve (Noah, 2026-09-13: "the range during changes of walls and spots and capsules needs
    to be smooth, not a quick instant change") */
const GLIDE = { duration: 0.52, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] };
const GLIDE_CSS = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** A tick step the axis can print without crowding — eight or so labels, the
    way the chart's own scale reads */
const niceStep = (range: number): number => {
  const steps = [0.1, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100];
  const want = range / 9;
  return steps.find(s => s >= want) ?? steps[steps.length - 1];
};
const verbOf = (flow: number) => (flow >= 0 ? 'buy' : 'sell');
const blockWords = (b: ScheduleBlock) =>
  b.past
    ? `${hhmm(b.from)} to ${hhmm(b.to)} has passed.`
    : `${hhmm(b.from)} to ${hhmm(b.to)}, ${b.phase} — dealers ${verbOf(b.flow)} about ${fmtDollars(b.flow)} of stock to stay hedged · ${b.flow >= 0 ? 'a tailwind' : 'a headwind'} for that half hour`;

interface Props {
  corridor: Corridor;
  schedule: Schedule;
  levels: ExposureLevels;
  ticker: string;
  clock: AheadClock;
  /** The shared strike, when it belongs to this name */
  focus?: number | null;
  onPick?: (price: number) => void;
  scope?: ReactNode;
  /** On a desk tile the tile head names the box — only the door and the facts stay (2026-09-08) */
  headless?: boolean;
  /** THE VOL SCENARIO — vanna spoken (2026-09-09): the card on the one line of controls */
  volPoints: VolPoints;
  onVolPoints: (p: VolPoints) => void;
}

const SHIFT_INK: Record<string, string> = { 'call-wall': CALL_WALL, 'put-wall': PUT_WALL, flip: FLIP, supreme: SUPREME };
const SHIFT_NAME: Record<string, string> = { 'call-wall': 'call wall', 'put-wall': 'put wall', flip: 'flip', supreme: 'supreme' };

/** A post on the scale: a level, spot, or a level's ghost under the vol move */
interface Post {
  key: string;
  name: string;
  price: number;
  ink: string;
  /** The clock time the expected move reaches it before the bell, when it does */
  reach: number | null;
  words: string;
  /** A ghost: the price the level stands at now */
  ghostOf?: number;
}

const AheadCorridor = ({ corridor, schedule, levels, ticker, clock, focus, onPick, scope, headless = false, volPoints, onVolPoints }: Props) => {
  const paper = useResolvedTheme() === 'light';
  const FIG = paper ? PAPER_FIG : DARK_FIG;
  const scaleRef = useRef<SVGSVGElement>(null);
  /** The pointer on the scale, in the scale's units */
  const [at, setAt] = useState<number | null>(null);
  /** The half hour under the pointer on the pane, by its start */
  const [hoverFrom, setHoverFrom] = useState<number | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const { spot, sigma, sigmaDay, likely, outer, cone, flip, fastSide } = corridor;
  const { blocks, toClose, biggest, bellShare, vol } = schedule;
  /* Where the walls and the flip go under the vol move — the ghosts on the scale */
  const ghosts = (vol?.shifts ?? []).filter(s => s.kind !== 'supreme');
  const shut = !clock.inSession;

  /* THE DOMAIN: the rarer stretch with air around it, and any level within reach */
  const { lo, hi } = useMemo(() => {
    let lo = outer.low;
    let hi = outer.high;
    const reach = sigmaDay * 2.6;
    for (const k of [levels.callWall, levels.putWall, levels.flip, levels.supreme, ...ghosts.map(g => g.projected)]) {
      if (Math.abs(k - spot) <= reach) {
        lo = Math.min(lo, k);
        hi = Math.max(hi, k);
      }
    }
    const pad = Math.max((hi - lo) * 0.07, 0.01);
    return { lo: lo - pad, hi: hi + pad };
  }, [outer, levels, spot, sigmaDay, ghosts]);
  const iw = W - SM.l - SM.r;
  const x = (p: number) => SM.l + ((p - lo) / (hi - lo || 1)) * iw;
  const priceAt = (u: number) => lo + ((u - SM.l) / iw) * (hi - lo);

  const highWall = likely.high.why === 'the call wall';
  const lowWall = likely.low.why === 'the put wall';
  /* WHEN THE EXPECTED MOVE REACHES A WALL — the first five minutes at which
     the band's edge IS the wall; nothing when it never gets there, nothing for
     a touch at the bell alone */
  const reaches = (wall: number, key: 'hi1' | 'lo1') => {
    const hit = cone.find((c, i) => i > 0 && Math.abs(c[key] - wall) < 1e-6);
    return hit && hit.min < CLOSE_MIN ? hit.min : null;
  };
  const upAt = highWall ? reaches(levels.callWall, 'hi1') : null;
  const downAt = lowWall ? reaches(levels.putWall, 'lo1') : null;

  /* THE POSTS — the two walls and the flip; the supreme only when it is another strike */
  const posts: Post[] = (() => {
    const out: Post[] = [
      { key: 'call-wall', name: 'call wall', price: levels.callWall, ink: CALL_WALL, reach: upAt, words: highWall ? 'the lid of the likely range — dealer hedging supplies stock there' : 'dealer hedging supplies stock there — resistance' },
      { key: 'put-wall', name: 'put wall', price: levels.putWall, ink: PUT_WALL, reach: downAt, words: lowWall ? 'the floor of the likely range — dealer hedging bids there' : 'dealer hedging bids there — support' },
      { key: 'flip', name: 'flip', price: levels.flip, ink: FLIP, reach: null, words: fastSide === 'below' ? 'below it moves run, above it they slow' : fastSide === 'above' ? 'above it moves run, below it they slow' : 'above it dealers absorb moves, below it they amplify them' },
    ];
    if (![levels.callWall, levels.putWall].some(k => Math.abs(k - levels.supreme) < 1e-9)) out.push({ key: 'supreme', name: 'supreme', price: levels.supreme, ink: SUPREME, reach: null, words: 'the heaviest strike on the book' });
    return out.filter(p => p.price > lo && p.price < hi);
  })();
  const ghostPosts: Post[] = ghosts
    .filter(g => g.projected > lo && g.projected < hi)
    .map(g => ({ key: `ghost-${g.kind}`, name: SHIFT_NAME[g.kind] ?? g.label.toLowerCase(), price: g.projected, ink: SHIFT_INK[g.kind] ?? SILVER, reach: null, words: '', ghostOf: g.current }));
  const spotPost: Post = { key: 'spot', name: 'spot', price: spot, ink: FIG.spot, reach: null, words: 'where we are' };

  /* THE NAMES ABOVE THE POSTS — each over its post, on the first of three rows
     with room for it; when the posts crowd (walls a strike apart round spot)
     a name takes the row that frees soonest and slides right of the crowd —
     its ink still says which post is its own. Every name stays inside the
     scale. */
  const names = (() => {
    const items = [
      ...posts.map(p => ({ key: p.key, price: p.price, ink: p.ink, text: `${p.name} ${fmtStrike(p.price)}`, extra: p.reach != null ? `in reach ${hhmm(p.reach)}` : '', spot: false })),
      { key: 'spot', price: spot, ink: FIG.spot, text: fmtPrice(spot), extra: '', spot: true },
    ]
      .map(i => ({ ...i, x: x(i.price), w: i.spot ? i.text.length * 6.4 : i.text.length * 5.1 + (i.extra ? (i.extra.length + 3) * 5.4 : 0) }))
      .sort((a, b) => a.x - b.x);
    const ends = ROW.names.map(() => -Infinity);
    return items.map(i => {
      const minCx = SM.l + i.w / 2;
      const maxCx = W - SM.r - i.w / 2;
      let cx = Math.max(minCx, Math.min(maxCx, i.x));
      let row = ends.findIndex(e => cx - i.w / 2 >= e + NAME_GAP);
      if (row < 0) {
        row = ends.indexOf(Math.min(...ends));
        cx = Math.min(maxCx, ends[row] + NAME_GAP + i.w / 2);
      }
      ends[row] = cx + i.w / 2;
      return { ...i, cx, row };
    });
  })();

  /* THE TRACK — the rarer stretch, two expected moves each side; dashed on the flip's fast side */
  const track: { a: number; b: number; fast: boolean }[] = (() => {
    if (flip == null || !fastSide) return [{ a: outer.low, b: outer.high, fast: false }];
    const f = Math.max(outer.low, Math.min(outer.high, flip));
    return fastSide === 'below'
      ? [
          { a: outer.low, b: f, fast: true },
          { a: f, b: outer.high, fast: false },
        ]
      : [
          { a: outer.low, b: f, fast: false },
          { a: f, b: outer.high, fast: true },
        ];
  })();

  /* THE AXIS — regular price ticks under the track; a tick gives way to the pointer's readout */
  const step = niceStep(hi - lo);
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(Number(v.toFixed(4)));

  /* THE POINTER — a price, or the post it is on */
  const unitsAt = (clientX: number): number | null => {
    const svg = scaleRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const u = ((clientX - r.left) / r.width) * W;
    if (u < 0 || u > W) return null;
    /* THE POINTER STOPS WHERE THE TRACK STOPS (Noah, 2026-09-20: "the drag is going even further than the plotted dashes").
       The scale is a little wider than what is drawn on it — 7% of air each side, so the end caps and the names over them
       have room — and the pointer used to read prices out there: 488.01, a rule standing on nothing, its figure cut by
       the box's edge. The track IS the range this figure is about (two expected moves each side), so the rule travels
       from cap to cap and rests on the cap when the pointer goes past it. One exception: a wall or a ghost that stands
       out past the track (in reach, but beyond two moves) still answers when it is pointed at. */
    const a = x(outer.low);
    const b = x(outer.high);
    if (u >= a && u <= b) return u;
    return snapAt(u) ? u : Math.max(a, Math.min(b, u));
  };
  const snapAt = (u: number): Post | null => {
    let best: Post | null = null;
    let d = SNAP;
    for (const p of [...posts, ...ghostPosts, spotPost]) {
      const dd = Math.abs(x(p.price) - u);
      if (dd < d) {
        d = dd;
        best = p;
      }
    }
    return best;
  };
  const onScaleMove = (e: ReactPointerEvent<SVGSVGElement>) => setAt(unitsAt(e.clientX));
  const onScaleClick = (e: ReactMouseEvent<SVGSVGElement>) => {
    const u = unitsAt(e.clientX);
    const s = u != null ? snapAt(u) : null;
    if (s && s.key !== 'spot' && s.ghostOf == null) onPick?.(s.price);
  };
  const snapped = at != null ? snapAt(at) : null;
  const pickable = snapped != null && snapped.key !== 'spot' && snapped.ghostOf == null;
  const readout = at != null && !snapped ? priceAt(at) : null;
  const tickShown = (v: number) => at == null || snapped != null || Math.abs(x(v) - at) > 26;
  const movePct = ((sigma / spot) * 100).toFixed(2);
  const moveWords = clock.inSession ? 'to the close' : 'in a day';
  /* the words for a price on the scale */
  const fromSpot = (p: number) => {
    const d = p - spot;
    const sign = d >= 0 ? '+' : '−';
    return { ink: d >= 0 ? GREEN : RED, text: `${sign}${fmtPrice(Math.abs(d))} · ${sign}${((Math.abs(d) / spot) * 100).toFixed(2)}%` };
  };
  const stretchWords = (p: number) => {
    /* a hair of tolerance: the rule resting ON a cap reads the cap's own price back through the scale, a rounding under it */
    if (p > likely.high.price) return `${highWall ? 'past the call wall, above the lid' : 'above the likely range'} · ${p <= outer.high + 1e-6 ? 'the rarer stretch' : 'beyond two expected moves'}`;
    if (p < likely.low.price) return `${lowWall ? 'past the put wall, under the floor' : 'under the likely range'} · ${p >= outer.low - 1e-6 ? 'the rarer stretch' : 'beyond two expected moves'}`;
    return 'inside the likely range';
  };
  const paceWords = (p: number) => (flip == null || !fastSide ? null : (p > flip) === (fastSide === 'above') ? 'moves run here — dealers amplify' : 'moves slow here — dealers absorb');

  /* THE PANE — the partner's plain bars: the tallest half hour takes 38% of
     the pane, so its figure always has room before the hour under it */
  const maxFlow = Math.max(1, ...blocks.map(b => Math.abs(b.flow)));
  const hoveredBlock = hoverFrom != null ? blocks.find(b => b.from === hoverFrom) ?? null : null;
  const readLine = hoveredBlock ? blockWords(hoveredBlock) : clock.inSession ? 'hover a half hour · forced buying or selling, whatever the news' : 'hover a half hour · drawn for the next session';
  const ink = toClose >= 0 ? GREEN : RED;
  /* the vol sentence minus its opening — the caps label and the figure before it say it */
  const volTail = vol ? vol.sentence.replace(/^If vol [^,]*,\s*dealers must (?:buy|sell) about \$[\d.]+[KMB]?\s*/i, '') : '';

  return (
    <section className="relative flex flex-col min-w-0" data-corridor-band>
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the range" testId="corridor-guide" viewport>
        <CorridorGuide corridor={corridor} schedule={schedule} levels={levels} clock={clock} />
      </GuideFocus>
      <div className={`${headless ? 'px-4 pt-3 pb-1' : 'px-5 pt-4 pb-2'} flex items-start gap-6 flex-wrap`}>
        {headless ? (
          <div className="shrink-0 h-[35px] flex items-center">
            <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the scale, the posts and the half hours mean" testId="corridor-guide" />
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-[15px] font-semibold leading-tight text-textPrimary">The range</h2>
              {scope}
              <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the scale, the posts and the half hours mean" testId="corridor-guide" />
            </div>
            <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">{clock.inSession ? 'From now to the close' : 'The next session'} · where price stays, and what the clock and a vol move make dealers buy or sell</p>
          </div>
        )}
        <dl className={`flex flex-wrap gap-x-6 gap-y-2 ${headless ? 'ml-auto' : ''}`}>
          <div>
            <dt className="text-[11px] text-textMuted">Likely range</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-corridor-range>
              {fmtPrice(likely.low.price)} – {fmtPrice(likely.high.price)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-textMuted">Top edge</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum whitespace-nowrap" style={{ color: highWall ? CALL_WALL : 'rgb(var(--text-primary))' }}>
              {fmtPrice(likely.high.price)} <span className="text-textMuted">· {likely.high.why}</span>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-textMuted">Floor</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum whitespace-nowrap" style={{ color: lowWall ? PUT_WALL : 'rgb(var(--text-primary))' }}>
              {fmtPrice(likely.low.price)} <span className="text-textMuted">· {likely.low.why}</span>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-textMuted">Expected move</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-corridor-sigma>
              ±{fmtPrice(sigma)} <span className="text-textMuted">· {movePct}% {moveWords}</span>
            </dd>
          </div>
        </dl>
      </div>

      {/* THE SCALE: a dark island on the dark terminal (Noah, 2026-09-12); on paper it is part of the page — the soft inset
          grey between two hairlines, the page's inks (2026-09-19, see DARK_FIG / PAPER_FIG) */}
      <div data-theme={paper ? 'light' : 'dark'} className={`relative ${paper ? 'bg-inset border-y border-borderSubtle' : 'bg-panel'}`} onPointerLeave={() => setAt(null)} data-corridor-island>
        {/* THE RANGE ON ONE PRICE SCALE */}
        <div className="relative px-3">
          <svg
            ref={scaleRef}
            viewBox={`0 0 ${W} ${SH}`}
            width="100%"
            role="img"
            aria-label={`The range on a price scale: the likely range ${fmtPrice(likely.low.price)} to ${fmtPrice(likely.high.price)} as the band, the walls, the flip and the supreme as posts, spot ${fmtPrice(spot)} as the rule, one expected move each side as the bracket`}
            onPointerMove={onScaleMove}
            onClick={onScaleClick}
            style={{ cursor: pickable ? 'pointer' : 'default' }}
            data-corridor-svg
            data-corridor-shut={shut || undefined}
            data-corridor-at={snapped ? snapped.key : readout != null ? 'price' : 'rest'}
          >
            {/* EVERY MARK GLIDES TO ITS PLACE (Noah, 2026-09-13: "the range during changes of walls and
                spots and capsules needs to be smooth, not a quick instant change") — the motion elements
                tween their positions on the house curve; keys never carry a price, so a moved mark is
                the same element moving */}
            {/* THE TRACK — the rarer stretch, two expected moves each side; dashed on the flip's fast side, where moves run */}
            {track.map(t => (
              <motion.line key={t.fast ? 'fast' : 'slow'} initial={false} animate={{ x1: x(t.a), x2: x(t.b) }} transition={GLIDE} y1={ROW.track} y2={ROW.track} stroke={FIG.wash} strokeOpacity={0.22} strokeWidth={1} strokeDasharray={t.fast ? '3 3' : undefined} data-corridor-track={t.fast ? 'fast' : 'slow'} />
            ))}
            {(
              [
                ['lo', outer.low],
                ['hi', outer.high],
              ] as const
            ).map(([k, p]) => (
              <motion.line key={k} initial={false} animate={{ x1: x(p), x2: x(p) }} transition={GLIDE} y1={ROW.track - 4} y2={ROW.track + 4} stroke={FIG.wash} strokeOpacity={0.3} strokeWidth={1} />
            ))}
            {/* THE LIKELY RANGE — the silver band with its two edges */}
            <motion.rect initial={false} animate={{ attrX: x(likely.low.price), width: Math.max(0, x(likely.high.price) - x(likely.low.price)) }} transition={GLIDE} y={ROW.bandTop} height={ROW.bandH} fill={SILVER} fillOpacity={FIG.band} data-corridor-likely />
            <motion.line initial={false} animate={{ x1: x(likely.low.price), x2: x(likely.low.price) }} transition={GLIDE} y1={ROW.bandTop - 2} y2={ROW.bandTop + ROW.bandH + 2} stroke={SILVER} strokeOpacity={0.7} strokeWidth={1.25} data-corridor-edge="low" />
            <motion.line initial={false} animate={{ x1: x(likely.high.price), x2: x(likely.high.price) }} transition={GLIDE} y1={ROW.bandTop - 2} y2={ROW.bandTop + ROW.bandH + 2} stroke={SILVER} strokeOpacity={0.7} strokeWidth={1.25} data-corridor-edge="high" />
            {/* THE AXIS — regular ticks under the track, priced; one gives way to the pointer's readout */}
            {ticks.map(v => (
              <g key={v}>
                <motion.line initial={false} animate={{ x1: x(v), x2: x(v) }} transition={GLIDE} y1={ROW.tick} y2={ROW.tick + 4} stroke={FIG.wash} strokeOpacity={0.25} />
                {tickShown(v) && (
                  <motion.text initial={false} animate={{ attrX: x(v) }} transition={GLIDE} y={ROW.figure} textAnchor="middle" fontSize={9} fill={FIG.tick} fontFamily={FIGS} data-axis-tick>
                    {fmtStrike(v)}
                  </motion.text>
                )}
              </g>
            ))}
            {/* THE POSTS — the walls, the flip, the supreme, each in its ink; the flip dotted; the kept strike and the one under the pointer lit */}
            {posts.map(p => {
              const on = snapped?.key === p.key || (focus != null && Math.abs(focus - p.price) < 1e-9);
              return (
                <g key={p.key} data-level={p.name} data-post={p.key} data-post-on={on || undefined}>
                  <motion.line initial={false} animate={{ x1: x(p.price), x2: x(p.price) }} transition={GLIDE} y1={ROW.postTop} y2={ROW.postBot} stroke={p.ink} strokeOpacity={on ? 1 : 0.8} strokeWidth={on ? 2 : 1.25} strokeDasharray={p.key === 'flip' ? '2 2' : undefined} />
                </g>
              );
            })}
            {/* THE GHOSTS — where a level goes under the vol move, dashed in its ink; named in the pointer's card */}
            {ghostPosts.map(g => (
              <motion.line key={g.key} initial={false} animate={{ x1: x(g.price), x2: x(g.price) }} transition={GLIDE} y1={ROW.postTop} y2={ROW.postBot} stroke={g.ink} strokeOpacity={snapped?.key === g.key ? 0.8 : 0.4} strokeWidth={1} strokeDasharray="1.5 4" data-ghost={g.key.slice(6)} />
            ))}
            {/* SPOT — the white rule and the silver ring where we are; no pill (Noah, 2026-09-06) */}
            <motion.line initial={false} animate={{ x1: x(spot), x2: x(spot) }} transition={GLIDE} y1={ROW.postTop} y2={ROW.postBot} stroke={FIG.spot} strokeOpacity={0.9} strokeWidth={1.5} data-corridor-spot-rule />
            <motion.circle initial={false} animate={{ cx: x(spot) }} transition={GLIDE} cy={ROW.track} r={3} fill={FIG.hole} stroke={SILVER} strokeWidth={1.5} data-corridor-origin />
            {/* THE NAMES — sans in the level's ink with the price; a wall in reach carries its clock time in grey; spot's price bold and white */}
            {names.map(n => (
              <motion.text key={n.key} initial={false} animate={{ attrX: n.cx, attrY: ROW.names[n.row] }} transition={GLIDE} textAnchor="middle" fontSize={n.spot ? 10 : 9.5} fontWeight={n.spot ? 700 : 500} fill={n.ink} fillOpacity={0.92} fontFamily={n.spot ? FIGS : SANS} data-level-label={n.key}>
                {n.text}
                {n.extra && (
                  <tspan fill={FIG.faint} fontWeight={400} fontSize={9} fontFamily={FIGS}>
                    {' '}
                    · {n.extra}
                  </tspan>
                )}
              </motion.text>
            ))}
            {/* THE BRACKET — one expected move each side of spot, under the ticks */}
            <motion.path initial={false} animate={{ d: `M${x(spot - sigma).toFixed(1)},${ROW.bracket - 5} V${ROW.bracket} H${x(spot + sigma).toFixed(1)} V${ROW.bracket - 5}` }} transition={GLIDE} fill="none" stroke={SILVER} strokeOpacity={0.6} strokeWidth={1} data-corridor-bracket />
            <motion.text initial={false} animate={{ attrX: x(spot) }} transition={GLIDE} y={ROW.words} textAnchor="middle" fontSize={8} fill={FIG.faint} fontFamily={FIGS} letterSpacing={1.2} data-corridor-bracket-words>
              ONE EXPECTED MOVE EACH SIDE · ±{fmtPrice(sigma)}
            </motion.text>
            {/* THE POINTER — a hairline at its price, the price on the axis in silver */}
            {at != null && readout != null && (
              <g data-corridor-cursor>
                <line x1={at} x2={at} y1={ROW.postTop} y2={ROW.postBot} stroke={SILVER} strokeOpacity={0.45} strokeWidth={1} />
                <text x={at} y={ROW.figure} textAnchor="middle" fontSize={9.5} fontWeight={600} fill={SILVER} fontFamily={FIGS} data-traced-price>
                  {fmtPrice(readout)}
                </text>
              </g>
            )}
          </svg>
          {at != null && (
            <div
              className="absolute top-1 w-[224px] rounded-lg border border-borderMuted bg-card/95 px-3 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.55)] animate-soft-in pointer-events-none"
              /* 26px off the rule, not 14: the rule's own figure on the axis is ~44px wide and centred on it — at 14 the card
                 stood on the figure's second half ("442." and no more) */
              /* anchored ON the rule: the drawing sits inside this box's 12px gutters (px-3), so a plain percentage of the box
                 was up to 10px off the rule at either end — toward it, on the side the card opens */
              style={{ left: `calc(12px + (100% - 24px) * ${(at / W).toFixed(5)})`, transform: at < W * 0.62 ? 'translateX(26px)' : 'translateX(calc(-100% - 26px))' }}
              data-corridor-card={snapped ? snapped.key : 'price'}
            >
              {snapped && snapped.ghostOf != null ? (
                <>
                  <div className="font-mono text-[11px] font-semibold tnum" style={{ color: snapped.ink }}>
                    {snapped.name} → {fmtStrike(snapped.price)}
                  </div>
                  <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                    <span className="text-textMuted">If vol</span>
                    <span className="text-textPrimary">{volWords(vol?.points ?? 0)}</span>
                    <span className="text-textMuted">From</span>
                    <span className="font-mono text-[11px] tnum text-textPrimary">{fmtStrike(snapped.ghostOf)}</span>
                    <span className="text-textMuted">From spot</span>
                    <span className="font-mono text-[11px] tnum" style={{ color: fromSpot(snapped.price).ink }}>
                      {fromSpot(snapped.price).text}
                    </span>
                  </div>
                </>
              ) : snapped && snapped.key === 'spot' ? (
                <>
                  <div className="font-mono text-[11px] font-semibold tnum text-textPrimary">spot {fmtPrice(spot)}</div>
                  <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                    <span className="text-textMuted">Likely</span>
                    <span className="font-mono text-[11px] tnum text-textPrimary">
                      {fmtPrice(likely.low.price)} – {fmtPrice(likely.high.price)}
                    </span>
                    <span className="text-textMuted">Rarer</span>
                    <span className="font-mono text-[11px] tnum text-textSecondary">
                      {fmtPrice(outer.low)} – {fmtPrice(outer.high)}
                    </span>
                    <span className="text-textMuted">Move</span>
                    <span className="font-mono text-[11px] tnum text-textPrimary">
                      ±{fmtPrice(sigma)} <span className="text-textMuted">· {movePct}% {moveWords}</span>
                    </span>
                  </div>
                </>
              ) : snapped ? (
                <>
                  <div className="font-mono text-[11px] font-semibold tnum" style={{ color: snapped.ink }}>
                    {snapped.name} {fmtStrike(snapped.price)}
                  </div>
                  <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                    <span className="text-textMuted">From spot</span>
                    <span className="font-mono text-[11px] tnum" style={{ color: fromSpot(snapped.price).ink }}>
                      {fromSpot(snapped.price).text}
                    </span>
                    <span className="text-textMuted">Read</span>
                    <span className="text-textPrimary leading-snug">{snapped.words}</span>
                    {snapped.reach != null && (
                      <>
                        <span className="text-textMuted">In reach</span>
                        <span className="text-textPrimary leading-snug">
                          <span className="font-mono text-[11px] tnum" style={{ color: snapped.ink }}>
                            {hhmm(snapped.reach)}
                          </span>{' '}
                          · the expected move gets there
                        </span>
                      </>
                    )}
                  </div>
                </>
              ) : (
                readout != null && (
                  <>
                    <div className="font-mono text-[11px] font-semibold tnum" style={{ color: SILVER }}>
                      {fmtPrice(readout)}
                    </div>
                    <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                      <span className="text-textMuted">From spot</span>
                      <span className="font-mono text-[11px] tnum" style={{ color: fromSpot(readout).ink }}>
                        {fromSpot(readout).text}
                      </span>
                      <span className="text-textMuted">Where</span>
                      <span className="text-textPrimary leading-snug">{stretchWords(readout)}</span>
                      {paceWords(readout) && (
                        <>
                          <span className="text-textMuted">Pace</span>
                          <span className="text-textPrimary leading-snug">{paceWords(readout)}</span>
                        </>
                      )}
                    </div>
                  </>
                )
              )}
            </div>
          )}
        </div>

      </div>

      {/* the range's sentence sits under its scale */}
      <p className={`${headless ? 'px-4' : 'px-5'} pt-2 text-[12px] leading-relaxed text-textSecondary`} data-corridor-sentence>
        {corridor.sentence}
      </p>

      {/* WHAT DEALERS MUST TRADE — the pane's head line: the name (the clock is CHARM, said as such —
          2026-09-09), the three facts, the If vol card at the right */}
      <div className={`${headless ? 'px-4' : 'px-5'} pt-4 flex items-center gap-x-5 gap-y-1 flex-wrap font-mono text-[11px] tnum`} data-flow-head>
        <span className=" text-textSecondary whitespace-nowrap max-sm:whitespace-normal">
          What dealers must trade · half hour by half hour <span className="text-textMuted">· charm</span>
        </span>
        <span className="text-textSecondary whitespace-nowrap">
          {clock.inSession ? 'into the close' : 'over the session'}{' '}
          <span className="font-semibold" style={{ color: ink }} data-flow-total>
            {verbOf(toClose)} {fmtDollars(toClose)}
          </span>
        </span>
        {biggest && (
          <span className="text-textSecondary whitespace-nowrap">
            biggest{' '}
            <span className="text-textPrimary" data-flow-biggest>
              {hhmm(biggest.from)}–{hhmm(biggest.to)} · {fmtDollars(biggest.flow)}
            </span>
          </span>
        )}
        {bellShare != null && (
          <span className="text-textSecondary whitespace-nowrap">
            expires at 4:00{' '}
            <span style={{ color: SUPREME }} data-flow-bell>
              {bellShare}%
            </span>
          </span>
        )}
        <span className="ml-auto inline-flex items-center">
          <DropdownSelect label="If vol" value={volPoints} options={VOL_OPTIONS} onChange={onVolPoints} title="A vol move as a scenario — what it makes dealers trade, and where the walls go on the scale" testId="if-vol" align="end" />
        </span>
      </div>

      {/* THE PANE — buying above the middle line, selling below it, one plain bar per half hour. A bordered dark island on the
          dark terminal; on paper the same soft grey as the scale above, the page's inks (2026-09-19) */}
      <div className={headless ? 'px-4' : 'px-5'}>
        <div className={`mt-2 relative h-[210px] rounded-md border border-borderSubtle/60 ${paper ? 'bg-inset' : 'bg-panel'}`} data-theme={paper ? 'light' : 'dark'} onPointerLeave={() => setHoverFrom(null)} data-flow-pane>
          <span className="absolute left-0 right-0 top-1/2 h-px bg-ink/25" />
          <span className="absolute left-2 top-[6px] font-mono text-[11px]" style={{ color: GREEN }}>
            buying
          </span>
          <span className="absolute left-2 bottom-[34px] font-mono text-[11px]" style={{ color: RED }}>
            selling
          </span>
          <div className="absolute inset-x-12 top-3 bottom-8 flex items-stretch gap-[6px]">
            {blocks.map(b => {
              const h = (Math.abs(b.flow) / maxFlow) * 38;
              const up = b.flow >= 0;
              const barInk = up ? GREEN : RED;
              const big = biggest != null && b.from === biggest.from;
              const on = hoverFrom === b.from;
              const show = !b.past && (Math.abs(b.flow) >= maxFlow * 0.12 || big);
              const side = up ? { bottom: '50%' } : { top: '50%' };
              const figureSide = up ? { bottom: `calc(50% + ${h}% + 4px)` } : { top: `calc(50% + ${h}% + 4px)` };
              return (
                <div key={b.from} className="relative flex-1 min-w-0" onPointerEnter={() => setHoverFrom(b.from)} data-flow-block={b.from} data-past={b.past || undefined} data-current={b.current || undefined} data-biggest={big || undefined}>
                  {/* the bar, from the middle line up or down */}
                  <span
                    className="absolute left-[15%] right-[15%] rounded-[3px]"
                    style={{ ...side, height: `${Math.max(b.past ? 0 : 1.5, h)}%`, background: barInk, opacity: b.past ? 0.25 : big || on ? 1 : 0.8, outline: b.current ? `1px solid ${SILVER}` : undefined, outlineOffset: 2, transition: `opacity 160ms ease-out, height 520ms ${GLIDE_CSS}, background-color 520ms ${GLIDE_CSS}` }}
                    data-flow-bar={b.from}
                    data-flow-sign={up ? 'buy' : 'sell'}
                  />
                  {show && (
                    <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] font-semibold tnum max-sm:hidden" style={{ ...figureSide, color: barInk, transition: `bottom 520ms ${GLIDE_CSS}, top 520ms ${GLIDE_CSS}` }} data-flow-figure={big ? 'biggest' : 'matters'}>
                      {fmtDollars(b.flow)}
                    </span>
                  )}
                  {b.past && <span className="absolute left-1/2 -translate-x-1/2 top-[calc(50%-14px)] font-mono text-[11px] text-textMuted">done</span>}
                  <span className="absolute left-1/2 -translate-x-1/2 -bottom-[18px] font-mono text-[11px] tnum text-textSecondary">{hhmm(b.from)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* ONE FIXED READ LINE, never a card over the pane */}
      <div className={`${headless ? 'px-4' : 'px-5'} h-[18px] font-mono text-[11px] text-textSecondary truncate`} data-flow-read>
        {readLine}
      </div>

      <div className={`${headless ? 'px-4' : 'px-5'} pb-4 pt-2`}>
        <p className="text-[12px] leading-relaxed text-textSecondary" data-flow-sentence>
          {schedule.sentence}
        </p>
        {/* THE VOL MOVE IS VANNA, said as such — its own line, the figure in its direction's ink */}
        <p className="mt-1 text-[12px] leading-relaxed text-textSecondary" data-vol-sentence>
          <span className="font-mono text-[11px] text-textMuted mr-2">If vol {volWords(vol?.points ?? 0)} · vanna</span>
          {vol ? (
            <>
              <span className="font-mono text-[11px] tnum font-semibold" style={{ color: vol.flow >= 0 ? GREEN : RED }} data-flow-vol>
                {verbOf(vol.flow)} {fmtDollars(vol.flow)}
              </span>{' '}
              {volTail}
            </>
          ) : (
            <span className="text-textMuted" data-flow-vol>
              no vol move in hand · the clock alone
            </span>
          )}
        </p>
      </div>
      <span className="sr-only" data-corridor-ticker={ticker} />
    </section>
  );
};

export default AheadCorridor;
