/*
==================================================
  SLAYER TERMINAL - THE TRADER'S CLOCK
  (components/gex/TraderClock.tsx)

  Dealer hedging has a SCHEDULE, and no dealer
  positioning product shows it as one (the Pinpoint
  roadmap, 2026-09-05). This is today's session,
  09:30 to 16:00 New York, cut into the phases
  hedging actually lives by, with today's own
  figures written into each: which strike price
  sticks to at lunch, where charm bites into the
  close, how much of today's gamma expires at 4:00.

  REDONE 2026-09-05 in the approved grammar, on the
  Tremor Tracker's shape: the session as a strip of
  78 five-minute blocks, each block's shade the
  phase's weight, the block you are in lit in the
  live ink, the blocks still to come a shade
  quieter. The phases are named above the strip,
  the hours run under it.

  HOW IT ANSWERS THE POINTER (Noah, same day):
    hover a block     — its card opens: the minute,
                        the phase, the phase's
                        sentence for today, and one
                        meaningful ink (absorbs or
                        amplifies moves)
    click a block     — the card and the sentence
                        STAY on that block
    click a name      — the words above the strip
                        keep the whole phase, its
                        blocks ringed in silver
    click anywhere    — outside the strip, and it
                        all lets go
  The phase you are in wears the where-you-are
  silver: its name, and its blocks a touch brighter.

  THE PHASES ARE A RULE OF THUMB, stated as one.
  THE FIGURES ARE TODAY'S: the gamma pin from the
  0DTE profile, the largest-charm strike and the
  levels charm moves from the vanna/charm engine,
  the 4:00 share from the surface (the same number
  the Calendar's read line prints). Nothing here is
  a forecast of price — it is a timetable of the
  forces that act on it.

  NOW is the real clock (readSessionClock, New York
  time), the same clock the shell's "to the bell"
  reads. Outside the session the strip shows the
  whole day and says which phase the next open
  starts with.
==================================================
*/

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildExposureSurface, CALENDAR_DTES } from '../../data/exposureSurface';
import { buildExposureProfile } from '../../data/exposure';
import { buildVannaCharm } from '../../data/vannacharm';
import { readSessionClock } from '../../data/moc';
import GuideFocus, { GuideDoor } from '../ui/GuideFocus';
import ClockGuide from './ClockGuide';
import type { MarketSnapshot } from '../../types/market';
import { EMBER, GLACIER, alpha } from './paletteInk';

const LIVE = 'rgb(var(--select))';
const SUPREME = 'rgb(var(--supreme))';
const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const OPEN_MIN = 9 * 60 + 30;
const CLOSE_MIN = 16 * 60;
const SPAN = CLOSE_MIN - OPEN_MIN; // 390 trading minutes
const BLOCK_MIN = 5;
const BLOCKS = SPAN / BLOCK_MIN; // 78
const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const pct = (min: number) => ((min - OPEN_MIN) / SPAN) * 100;

interface Phase {
  key: string;
  from: number;
  to: number;
  name: string;
  /** What dominates, with today's figures in it */
  words: (f: Facts) => string;
  /** How hard hedging pushes in this phase, 0..1 — the block's shade */
  weight: number;
  /** What the hedging does to a move in this phase, where the rule of thumb is
      clear enough to say — the hover card's one meaningful ink. The morning
      depends on which side of the flip price is, so it says nothing. */
  pressure?: 'absorbs' | 'amplifies';
}

interface Facts {
  pin: number | null;
  charmStrike: number | null;
  charmMoves: string | null;
  bellShare: number | null;
  supreme: number | null;
  flip: number | null;
}

/* The schedule, in trading minutes from midnight ET. Weights are the strip's
   own emphasis — a hedging day is quiet in the middle and loud at both ends,
   and the close is the loudest hour of all. */
const PHASES: Phase[] = [
  {
    key: 'open',
    from: OPEN_MIN,
    to: 10 * 60,
    name: 'The open',
    weight: 0.75,
    pressure: 'amplifies',
    words: f => `the day's walls get set — ${f.supreme != null ? `the heaviest strike (the supreme) is ${fmtStrike(f.supreme)}` : 'the heaviest strike is being decided'}; today's option premium burns fastest here`,
  },
  {
    key: 'morning',
    from: 10 * 60,
    to: 11 * 60 + 30,
    name: 'The morning',
    weight: 0.5,
    words: f => `the trend hour — ${f.flip != null ? `above ${fmtStrike(f.flip)} dips get bought, below it moves get chased` : 'the flip decides which way hedging leans'}`,
  },
  {
    key: 'lunch',
    from: 11 * 60 + 30,
    to: 14 * 60,
    name: 'Lunch',
    weight: 0.3,
    pressure: 'absorbs',
    words: f => `volatility goes quiet and price sticks — ${f.pin != null ? `${fmtStrike(f.pin)} is the strike it sticks to (the gamma pin)` : 'the gamma pin holds price'}`,
  },
  {
    key: 'charm',
    from: 14 * 60,
    to: 15 * 60 + 30,
    name: 'Charm window',
    weight: 0.7,
    pressure: 'amplifies',
    words: f => `dealers unwind hedges as today's options lose their delta (charm) — ${f.charmStrike != null ? `strongest at ${fmtStrike(f.charmStrike)}` : 'this is the force now'}${f.charmMoves ? ` · ${f.charmMoves}` : ''}`,
  },
  {
    key: 'turn',
    from: 15 * 60 + 30,
    to: 15 * 60 + 50,
    name: 'The turn',
    weight: 0.9,
    pressure: 'absorbs',
    words: f => `today's gamma peaks, then starts to fade — ${f.pin != null ? `the pull of ${fmtStrike(f.pin)} doubles` : 'the gamma pin pulls hardest'}`,
  },
  {
    key: 'auction',
    from: 15 * 60 + 50,
    to: CLOSE_MIN,
    name: 'The close',
    weight: 1,
    pressure: 'amplifies',
    words: f => `the closing auction — ${f.bellShare != null ? `${f.bellShare}% of today's gamma expires at 4:00` : 'today’s gamma expires at 4:00'}`,
  },
];

const phaseAt = (min: number) => PHASES.find(p => min >= p.from && min < p.to) ?? PHASES[PHASES.length - 1];
const PRESSURE_WORDS = { absorbs: 'absorbs moves', amplifies: 'amplifies moves' } as const;

/** What the reader has kept: one block, or one whole phase */
type Pin = { kind: 'block'; i: number } | { kind: 'phase'; key: string } | null;

/** `scope`: the host's chip saying which name these figures belong to.
    `at`: minutes from midnight ET to stand the clock at instead of now — the
    Map's replay (2026-09-08) walks the strip to the minute it is rewound to. */
const TraderClock = ({ snapshot, scope, at }: { snapshot: MarketSnapshot; scope?: ReactNode; at?: number | null }) => {
  const clock = readSessionClock();
  const [hover, setHover] = useState<number | null>(null);
  const [pin, setPin] = useState<Pin>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  /* The guide as a focus over the whole box (the house pattern, 2026-09-06) */
  const [guideOpen, setGuideOpen] = useState(false);

  /* A click on a block keeps that block; a click on a phase's name up top keeps
     the whole phase (Noah: "no double click, only clicking the words up top
     showcases the segment"). Clicking the same thing again lets it go. */
  const onBlockClick = (i: number) => setPin(p => (p?.kind === 'block' && p.i === i ? null : { kind: 'block', i }));
  const onNameClick = (key: string) => setPin(p => (p?.kind === 'phase' && p.key === key ? null : { kind: 'phase', key }));

  /* A click anywhere outside the strip and its names lets go */
  useEffect(() => {
    if (!pin) return;
    const onDown = (e: PointerEvent) => {
      const root = stripRef.current;
      if (root && !root.contains(e.target as Node)) setPin(null);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [pin]);

  /* Today's figures, off the same engines the rest of the page reads */
  const facts = useMemo<Facts>(() => {
    let pinStrike: number | null = null;
    let supreme: number | null = null;
    let flip: number | null = null;
    let charmStrike: number | null = null;
    let charmMoves: string | null = null;
    let bellShare: number | null = null;
    try {
      const p = buildExposureProfile(snapshot, '0DTE', 20);
      pinStrike = p.levels.pin;
      supreme = p.levels.supreme;
      flip = p.levels.flip;
    } catch {
      /* no chain yet */
    }
    try {
      const vc = buildVannaCharm(snapshot, 'CHARM', -1);
      charmStrike = vc.read.charm.price;
      const moved = vc.shifts.filter(s => Math.abs(s.projected - s.current) > 1e-9);
      /* The engine's labels carry its own word "node"; the reader gets the level's name alone */
      charmMoves = moved.length ? `into the close it moves ${moved.map(s => `${s.label.toLowerCase().replace(/\s*node\b/, '')} ${fmtStrike(s.current)} → ${fmtStrike(s.projected)}`).join(', ')}` : 'the levels hold into the close';
    } catch {
      /* no chain yet */
    }
    try {
      const surface = buildExposureSurface(snapshot, 20, CALENDAR_DTES);
      const today = surface.expiries.findIndex(e => e.dte === 0);
      if (today >= 0) {
        let dies = 0;
        let total = 0;
        for (let e = 0; e < surface.expiries.length; e++)
          for (let s = 0; s < surface.strikes.length; s++) {
            const v = Math.abs(surface.net.gex[e][s] ?? 0);
            total += v;
            if (e === today) dies += v;
          }
        bellShare = total > 0 ? Math.round((100 * dies) / total) : null;
      }
    } catch {
      /* no surface yet */
    }
    return { pin: pinStrike, supreme, flip, charmStrike, charmMoves, bellShare };
  }, [snapshot]);

  /* Where NOW sits — New York minutes; outside the session there is no lit block */
  const [h, m] = clock.etTime.split(':').map(Number);
  const nowMin = at != null ? Math.max(OPEN_MIN, Math.min(CLOSE_MIN - 1, at)) : h * 60 + m;
  const inSession = at != null ? true : clock.phase === 'OPEN' || clock.phase === 'AUCTION';
  const nowBlock = inSession ? Math.min(BLOCKS - 1, Math.floor((nowMin - OPEN_MIN) / BLOCK_MIN)) : null;
  const current = inSession ? phaseAt(nowMin) : null;
  const next = inSession ? PHASES.find(p => p.from > nowMin) ?? null : null;

  /* What is kept, and what the card shows: the hovered block first, else the
     kept block; a kept phase rings its blocks and owns the sentence */
  const keptBlock = pin?.kind === 'block' ? pin.i : null;
  const keptPhase = pin?.kind === 'phase' ? PHASES.find(p => p.key === pin.key) ?? null : null;
  const shownBlock = hover ?? keptBlock;
  const shownMin = shownBlock != null ? OPEN_MIN + shownBlock * BLOCK_MIN : null;
  const shownPhase = shownMin != null ? phaseAt(shownMin) : null;
  const cardPct = shownBlock != null ? ((shownBlock + 0.5) / BLOCKS) * 100 : 0;
  const cardOnRight = shownBlock != null ? shownBlock < BLOCKS * 0.6 : true;

  const line = keptBlock != null
    ? `${hhmm(OPEN_MIN + keptBlock * BLOCK_MIN)}, ${phaseAt(OPEN_MIN + keptBlock * BLOCK_MIN).name.toLowerCase()} — ${phaseAt(OPEN_MIN + keptBlock * BLOCK_MIN).words(facts)}.`
    : keptPhase
      ? `${keptPhase.name}, ${hhmm(keptPhase.from)} to ${hhmm(keptPhase.to)} — ${keptPhase.words(facts)}.`
      : current
        ? `${current.name} — ${current.words(facts)}${next ? `. ${next.name} in ${next.from - nowMin} minutes.` : '.'}`
        : `${clock.label} — when it opens: ${PHASES[0].words(facts)}.`;

  const lookingAt = keptBlock != null ? `${hhmm(OPEN_MIN + keptBlock * BLOCK_MIN)} · ${phaseAt(OPEN_MIN + keptBlock * BLOCK_MIN).name}` : keptPhase ? `${keptPhase.name} · ${hhmm(keptPhase.from)}–${hhmm(keptPhase.to)}` : null;

  return (
    <section className="relative flex flex-col min-w-0" data-trader-clock>
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the clock" testId="clock-guide" viewport>
        <ClockGuide nowBlock={nowBlock} line={line} bellShare={facts.bellShare} pin={facts.pin} supreme={facts.supreme} charmStrike={facts.charmStrike} />
      </GuideFocus>
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">The trader's clock</h3>
            {scope}
            <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the strip and the phases mean" testId="clock-guide" />
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted">New York · 09:30 to 16:00 · the phases are a rule of thumb, the figures are today's numbers</p>
        </div>
        <dl className="grid grid-cols-3 gap-x-6">
          {lookingAt ? (
            <div className="col-span-2">
              <dt className="text-[10px] text-textMuted">Looking at</dt>
              <dd className="mt-0.5 flex items-baseline gap-3 whitespace-nowrap" data-clock-looking>
                <span className="font-mono text-[12px] tnum" style={{ color: SILVER }}>
                  {lookingAt}
                </span>
                <button onClick={() => setPin(null)} className="text-[11px] font-medium text-textMuted hover:text-textPrimary transition-colors" data-back-to-now>
                  Back to now
                </button>
              </dd>
            </div>
          ) : (
            <>
              <div>
                <dt className="text-[10px] text-textMuted">Now</dt>
                <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-clock-now>
                  {inSession && current ? `${hhmm(nowMin)} · ${current.name.toLowerCase()}` : clock.label}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] text-textMuted">Next</dt>
                <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap">{next ? `${next.name.toLowerCase()} in ${next.from - nowMin}m` : inSession ? 'the close' : `${PHASES[0].name.toLowerCase()} at 09:30`}</dd>
              </div>
            </>
          )}
          <div>
            <dt className="text-[10px] text-textMuted">Expires at 4:00</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum whitespace-nowrap" style={{ color: SUPREME }} data-clock-bell>
              {facts.bellShare != null ? `${facts.bellShare}% of today's gamma` : '—'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="px-5 pb-4" ref={stripRef}>
        {/* THE PHASES — named above the strip on ONE row. Each name sits at its
            phase's start, except the last two: the turn is twenty minutes wide
            and the close ten, so the turn's name ends at 15:50 and the close's
            starts there — the same line, no overlap. */}
        <div className="relative h-5" data-clock-phases>
          {PHASES.map(p => {
            const active = current?.key === p.key;
            const kept = keptPhase?.key === p.key || (keptBlock != null && phaseAt(OPEN_MIN + keptBlock * BLOCK_MIN).key === p.key);
            const turn = p.key === 'turn';
            const last = p.key === 'auction';
            /* With something kept, its name stays sharp and the others go soft with their blocks */
            const nameCls = kept ? 'text-textPrimary' : pin ? 'text-textMuted/50 hover:text-textPrimary' : active ? '' : 'text-textMuted hover:text-textPrimary';
            return (
              <button
                key={p.key}
                data-phase-name={p.key}
                aria-pressed={keptPhase?.key === p.key}
                onClick={() => onNameClick(p.key)}
                className={`absolute top-0 text-[11px] font-medium whitespace-nowrap transition-colors ${nameCls}`}
                style={{
                  left: `${pct(turn ? p.to : p.from)}%`,
                  transform: turn ? 'translateX(calc(-100% - 6px))' : last ? 'translateX(2px)' : undefined,
                  ...(active ? { color: SILVER } : {}),
                }}
                title={`${hhmm(p.from)}–${hhmm(p.to)} — click to keep this phase`}
              >
                {p.name}
              </button>
            );
          })}
        </div>

        {/* THE STRIP — 78 five-minute blocks; shade = the phase's weight, lime = now */}
        <div className="relative" onPointerLeave={() => setHover(null)}>
          <div className="flex gap-[2px] h-[22px]" data-clock-strip role="img" aria-label="Today's session as five-minute blocks, shaded by how hard hedging pushes">
            {Array.from({ length: BLOCKS }, (_, i) => {
              const min = OPEN_MIN + i * BLOCK_MIN;
              const p = phaseAt(min);
              const isNow = nowBlock === i;
              const future = nowBlock != null && i > nowBlock;
              const inCurrent = current?.key === p.key;
              const hovered = hover === i;
              /* WHAT IS KEPT IS IN FOCUS, THE REST GOES SOFT (Noah: "a focus on
                 that portion and a blur on the rest", not rings): a kept phase
                 keeps its blocks crisp and lifted while every other block dims
                 and blurs; a kept block does the same for itself alone. A block
                 under the pointer is always in focus. */
              const inFocus = hovered || (keptPhase ? p.key === keptPhase.key : keptBlock != null ? i === keptBlock : true);
              const soft = !!pin && !inFocus;
              /* The phase you are in sits a touch brighter than its weight alone;
                 the block under the pointer, or a kept one, brighter still */
              const alpha = Math.min(0.8, 0.1 + p.weight * 0.3 + (inCurrent ? 0.08 : 0) + (hovered ? 0.3 : 0) + (!hovered && pin && inFocus ? 0.15 : 0));
              const boundary = i > 0 && phaseAt(min - BLOCK_MIN).key !== p.key;
              const dim = hover != null && !hovered;
              return (
                <button
                  key={i}
                  type="button"
                  data-block={i}
                  data-phase={p.key}
                  data-focus={pin ? (inFocus ? 'in' : 'soft') : undefined}
                  aria-label={`${hhmm(min)} · ${p.name}`}
                  aria-pressed={keptBlock === i}
                  onPointerEnter={() => setHover(i)}
                  onClick={() => onBlockClick(i)}
                  className={`flex-1 min-w-0 rounded-[2px] transition-[opacity,background-color,filter] duration-200 ${boundary ? 'ml-[3px]' : ''}`}
                  style={{
                    /* the ink's wash — light on the dark terminal, near-black on paper (the white washes were "so bright") */
                    background: isNow ? LIVE : `rgb(var(--text-primary) / ${alpha})`,
                    opacity: soft ? 0.3 : dim ? 0.55 : future ? 0.6 : 1,
                    filter: soft ? 'blur(1.2px)' : undefined,
                    boxShadow: isNow ? `0 0 0 1px ${LIVE}` : undefined,
                  }}
                />
              );
            })}
          </div>
          {/* the hours under the strip */}
          <div className="relative h-4 mt-1">
            {[OPEN_MIN, 10 * 60, 11 * 60, 12 * 60, 13 * 60, 14 * 60, 15 * 60, CLOSE_MIN].map(t => (
              <span
                key={t}
                className="absolute top-0 font-mono text-[9px] tnum text-textMuted"
                style={{ left: `${pct(t)}%`, transform: t === CLOSE_MIN ? 'translateX(-100%)' : t === OPEN_MIN ? undefined : 'translateX(-50%)' }}
              >
                {hhmm(t)}
              </span>
            ))}
          </div>
          {/* THE CARD — the hovered block's, else the kept block's: the minute, its
              phase, the phase's sentence for today, and one meaningful ink */}
          {shownBlock != null && shownMin != null && shownPhase && (
            <div
              data-clock-card
              data-kept={keptBlock === shownBlock ? 'true' : 'false'}
              className="absolute z-10 pointer-events-none rounded-lg border border-borderMuted bg-card/95 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.5)] px-3 py-2 w-[300px] animate-soft-in"
              style={{ left: `${cardPct}%`, bottom: 'calc(100% + 6px)', transform: cardOnRight ? 'translateX(12px)' : 'translateX(calc(-100% - 12px))' }}
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[12px] font-semibold tnum" style={{ color: keptBlock === shownBlock ? SILVER : undefined }}>
                  {hhmm(shownMin)}
                </span>
                <span className="text-[11px] font-medium text-textPrimary">{shownPhase.name}</span>
                <span className="ml-auto font-mono text-[10px] tnum text-textMuted">
                  {hhmm(shownPhase.from)}–{hhmm(shownPhase.to)}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-textSecondary">{shownPhase.words(facts)}.</p>
              {shownPhase.pressure && (
                <span
                  className="mt-1.5 inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium"
                  data-pressure={shownPhase.pressure}
                  style={{ color: shownPhase.pressure === 'absorbs' ? GLACIER : EMBER, background: alpha(shownPhase.pressure === 'absorbs' ? GLACIER : EMBER, 0.1) }}
                >
                  {PRESSURE_WORDS[shownPhase.pressure]}
                </span>
              )}
              <span className="block mt-1 text-[10px] text-textMuted">{keptBlock === shownBlock ? 'kept · click anywhere else to let go' : 'click to keep · the phase names above keep a whole phase'}</span>
            </div>
          )}
        </div>

        {/* THE SENTENCE for what you are looking at, else the phase you are in */}
        <p className="mt-2 text-[12px] leading-relaxed text-textSecondary" data-clock-line>
          {line}
        </p>
      </div>
    </section>
  );
};

export default TraderClock;
