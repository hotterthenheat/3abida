/*
==================================================
  SLAYER TERMINAL - THE READ (components/gex/BookRead.tsx)

  The book's read, beside the book (Noah, 2026-09-12,
  from his partner's "info" card: "lets the user open
  up a translucent card within the page and see the
  entire spy gex for multiple different days... i
  wanted to incorporate this into our ladder view
  with our own type design. i like the translucent
  look"). A glass card over the right of the ladder
  or the calendar, four short sections that scroll
  under a rail of their names:

    THE BOOK      the net, the verdict in a sentence,
                  the four levels
    HEAVIEST      today's heaviest strikes and what
                  each did over a window (1m … open)
    THE STRIKE    the one under the pointer, or kept:
                  its legs, its five greeks, its
                  change over every window
    TO THE CLOSE  the expected move from here, and
                  the strikes the moves land on
    RECENT        the strikes pointed at lately

  One card, whichever greek the ladder is showing —
  never five. The windows read TODAY'S contracts
  off the replay's minute grid (data/replay.ts);
  live history is a seam behind the same calls.
==================================================
*/

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PanelRightClose, PanelRightOpen, X } from 'lucide-react';
import { GREEK_LABEL } from '../../data/compare';
import { buildExposureProfile, type StrikeWindow } from '../../data/exposure';
import { GREEKS, GREEK_UNIT, type ExposureSurface, type Greek } from '../../data/exposureSurface';
import { fmtUsd, readHeatPattern } from '../../data/gex';
import { YEAR_MINUTES } from '../../data/measure';
import { readSessionClock } from '../../data/moc';
import { replayRange, snapshotAt } from '../../data/replay';
import type { ExposureProfileData } from '../../types/gex';
import type { MarketSnapshot } from '../../types/market';
import { HEAT_MODE, heatLaneColor, type HeatMode } from './heatmap';
import { CALL_WALL, FLIP, PUT_WALL, SUPREME } from './paletteInk';

const SILVER = 'rgb(var(--silver))';
const MUTED = 'rgb(var(--text-muted))';

/** The windows a strike's change is read over — today's contracts, off the minute grid */
const WINDOWS: { key: string; min: number }[] = [
  { key: '1m', min: 1 },
  { key: '5m', min: 5 },
  { key: '15m', min: 15 },
  { key: '30m', min: 30 },
  { key: '1h', min: 60 },
  { key: '4h', min: 240 },
  { key: 'open', min: Infinity },
];
const SECTIONS = [
  { id: 'book', label: 'The book' },
  { id: 'heaviest', label: 'Heaviest' },
  { id: 'strike', label: 'The strike' },
  { id: 'close', label: 'To the close' },
  { id: 'recent', label: 'Recent' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(0)}%`;

interface BookReadProps {
  surface: ExposureSurface;
  snapshot: MarketSnapshot;
  /** The greek the ladder leads with */
  greek: Greek;
  /** The ladder's ramp — the Colours card (house or thermal): every net figure here wears it, as the ladder's net column and foot do (Noah, 2026-09-12: "shouldn't the book's net be the heat or cooled colour?") */
  mode?: HeatMode;
  /** How far along the calendar the ladder reads, and whether today's column is out */
  depth: number;
  afterBell: boolean;
  rings: StrikeWindow;
  /** The strike the reader kept (a click) */
  selectedStrike?: number | null;
  /** The strike under the pointer, as the ladder or the calendar reports it — only this card listens */
  subscribePointed: (fn: (strike: number | null) => void) => () => void;
  onKeep?: (strike: number) => void;
  onClose: () => void;
}

/* THE FIGURES GLIDE (Noah, 2026-09-12: "make the change through timeframes a
   bit smoother, right now it just changes in a binary format from 1m → 5m"):
   a figure that moves tweens from where it was to where it is going on the
   house curve (rAF + easeOutCubic, the same glide the chart's levels take)
   instead of being swapped. Reduced motion jumps. */
const GLIDE_MS = 360;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const useGlide = (target: number | null): number | null => {
  const [shown, setShown] = useState<number | null>(target);
  const from = useRef<number | null>(target);
  useEffect(() => {
    const start = from.current;
    if (target == null || start == null || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = target;
      setShown(target);
      return;
    }
    if (start === target) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / GLIDE_MS);
      const v = start + (target - start) * easeOutCubic(t);
      from.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
};

/** A change over a window, in words a figure can carry: a percentage of what was there, else the dollars that appeared */
const Change = ({ now, then }: { now: number; then: number | null }) => {
  /* the figure and its kind, then the figure glides */
  const kind: 'none' | 'steady' | 'dollars' | 'pct' =
    then == null ? 'none'
    : Math.abs(then) < 1e6 ? (Math.abs(now - then) < 1e6 ? 'steady' : 'dollars')
    : 'pct';
  const target = kind === 'pct' ? ((Math.abs(now) - Math.abs(then!)) / Math.abs(then!)) * 100 : kind === 'dollars' ? now - then! : null;
  const v = useGlide(target);
  if (kind === 'none') return <span style={{ color: MUTED }}>—</span>;
  if (kind === 'steady' || v == null) return <span style={{ color: MUTED }}>steady</span>;
  const grew = v >= 0;
  const ink = grew ? CALL_WALL : PUT_WALL;
  if (kind === 'dollars') return <span style={{ color: ink }}>{grew ? '▲' : '▼'} {fmtUsd(Math.abs(v))}</span>;
  if (Math.abs(v) < 1) return <span style={{ color: MUTED }}>steady</span>;
  return (
    <span style={{ color: ink }}>
      {grew ? '▲' : '▼'} {pct(v).replace(/^[+−]/, '')}
    </span>
  );
};

const Head = ({ children }: { children: ReactNode }) => (
  <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-textMuted">{children}</div>
);

/** THE READ's door — beside the guide's on every book; lit while the card is up */
export const ReadDoor = ({ open, onClick }: { open: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    aria-pressed={open}
    title={open ? 'Close the read (Esc)' : "The book's read — the net, the levels, the heaviest strikes and what they did, the strike under the pointer, the move to the close"}
    className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border font-mono text-[10px] uppercase tracking-wider transition-colors ${
      open ? 'border-silver/50 text-silver bg-silver/[0.08]' : 'border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted'
    }`}
    data-ledger-read
  >
    {open ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
    The read
  </button>
);

const BookRead = ({ surface, snapshot, greek, mode = HEAT_MODE, depth, afterBell, rings, selectedStrike, subscribePointed, onKeep, onClose }: BookReadProps) => {
  const [win, setWin] = useState('15m');
  const [pointed, setPointed] = useState<number | null>(null);
  const [recent, setRecent] = useState<number[]>([]);
  const [current, setCurrent] = useState<SectionId>('book');
  const bodyRef = useRef<HTMLDivElement | null>(null);

  /* the pointer, fed by the host — this card alone re-renders on a move */
  useEffect(() => subscribePointed(setPointed), [subscribePointed]);
  /* Esc closes the card before anything under it (the field's own fullscreen listens after) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [onClose]);

  /* THE EXPIRIES SHOWN — the ladder's own rule (today's column out after the bell) */
  const shownIdx = useMemo(() => {
    const all = surface.expiries.map((_, i) => i);
    const todayIdx = surface.expiries.findIndex(e => e.dte === 0);
    const live = afterBell && todayIdx >= 0 ? all.filter(i => i !== todayIdx) : all;
    return live.slice(0, Math.max(1, depth));
  }, [surface, afterBell, depth]);
  const at = (g: Greek, s: number, side: 'put' | 'call' | 'net') => shownIdx.reduce((a, e) => a + (surface[side][g][e]?.[s] ?? 0), 0);
  const idxOf = (strike: number) => surface.strikes.indexOf(strike);

  /* THE BOOK */
  const net = surface.strikes.reduce((a, _, s) => a + at(greek, s, 'net'), 0);
  /* THE NET'S INK IS THE RAMP — the ladder's own: a figure against the heaviest
     net among the strikes for its greek (the rows' scale), a total against
     itself (the foot's) */
  const scale = useMemo(() => {
    const m = {} as Record<Greek, number>;
    for (const g of GREEKS) m[g] = Math.max(1, ...surface.strikes.map((_, s) => Math.abs(at(g, s, 'net'))));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, shownIdx]);
  const rampInk = (g: Greek, v: number, max = scale[g]) => heatLaneColor(v, max, mode, 0.35);
  const { levels } = surface;
  const verdict = readHeatPattern(levels);
  const pinStrike = surface.front.strikes.find(r => r.pin)?.strike;
  const roleOf = (strike: number): { word: string; ink: string } | null =>
    strike === levels.supreme ? { word: 'supreme', ink: SUPREME }
    : strike === levels.callWall ? { word: 'call wall', ink: CALL_WALL }
    : strike === levels.putWall ? { word: 'put wall', ink: PUT_WALL }
    : strike === levels.flip ? { word: 'flip', ink: FLIP }
    : strike === pinStrike ? { word: 'pin', ink: MUTED }
    : null;
  const levelRows = [
    { word: 'put wall', strike: levels.putWall, ink: PUT_WALL },
    { word: 'call wall', strike: levels.callWall, ink: CALL_WALL },
    { word: 'flip', strike: levels.flip, ink: FLIP },
    { word: 'supreme', strike: levels.supreme, ink: SUPREME },
  ];

  /* TODAY'S CONTRACTS OVER EACH WINDOW — the minute grid, seven books back */
  const history = useMemo<(ExposureProfileData | null)[] | null>(() => {
    const range = replayRange(snapshot.ticker);
    if (!range) return null;
    return WINDOWS.map(w => {
      const back = w.min === Infinity ? range.length : w.min * 60;
      if (back > range.length && w.min !== Infinity) return null; // the window reaches before the open
      return buildExposureProfile(snapshotAt(snapshot, range, Math.max(0, range.length - back)), '0DTE', rings);
    });
  }, [snapshot, rings]);
  const winIdx = Math.max(0, WINDOWS.findIndex(w => w.key === win));
  const thenAt = (i: number, strike: number): number | null => {
    const p = history?.[i];
    if (!p) return null;
    return p.strikes.find(r => r.strike === strike)?.[greek].net ?? null;
  };

  /* HEAVIEST TODAY — today's book, ranked by the greek, with its change over the window */
  const heaviest = useMemo(
    () =>
      [...surface.front.strikes]
        .sort((a, b) => Math.abs(b[greek].net) - Math.abs(a[greek].net))
        .slice(0, 6),
    [surface, greek]
  );

  /* THE STRIKE — under the pointer, else kept, else the supreme */
  const strike = pointed ?? selectedStrike ?? levels.supreme;
  const sIdx = idxOf(strike);
  const legs = sIdx >= 0 ? { put: at(greek, sIdx, 'put'), call: at(greek, sIdx, 'call'), net: at(greek, sIdx, 'net') } : null;
  const front = surface.front.strikes.find(r => r.strike === strike);
  useEffect(() => {
    if (selectedStrike == null) return;
    setRecent(r => [selectedStrike, ...r.filter(s => s !== selectedStrike)].slice(0, 8));
  }, [selectedStrike]);
  useEffect(() => {
    if (pointed == null) return;
    /* a strike lingered under the pointer is one you looked at — a sweep across rows is not */
    const id = window.setTimeout(() => setRecent(r => [pointed, ...r.filter(s => s !== pointed)].slice(0, 8)), 600);
    return () => window.clearTimeout(id);
  }, [pointed]);

  /* TO THE CLOSE — the expected move from here, on the front expiry's vol */
  const clock = readSessionClock();
  const minLeft = clock.secondsToClose / 60;
  const shut = minLeft <= 0;
  const horizon = shut ? 390 : minLeft;
  const iv = surface.expiries[0]?.iv ?? 0.2;
  const w1 = surface.spot * iv * Math.sqrt(horizon / YEAR_MINUTES);
  const nearest = (price: number) => surface.strikes.reduce((b, s) => (Math.abs(s - price) < Math.abs(b - price) ? s : b), surface.strikes[0]);

  const go = (id: SectionId) => {
    setCurrent(id);
    bodyRef.current?.querySelector<HTMLElement>(`[data-read-section="${id}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  const onScroll = () => {
    const body = bodyRef.current;
    if (!body) return;
    const top = body.getBoundingClientRect().top + 8;
    let best: SectionId = 'book';
    for (const s of SECTIONS) {
      const el = body.querySelector<HTMLElement>(`[data-read-section="${s.id}"]`);
      if (el && el.getBoundingClientRect().top <= top + 24) best = s.id;
    }
    if (best !== current) setCurrent(best);
  };

  const unit = GREEK_UNIT[greek];
  const label = GREEK_LABEL[greek];

  return (
    <aside
      className="absolute inset-y-0 right-0 z-20 w-[400px] max-w-[62%] flex flex-col border-l border-borderMuted bg-card/85 backdrop-blur-md backdrop-saturate-150 shadow-[-16px_0_48px_rgba(0,0,0,0.45)] animate-soft-in"
      aria-label="The read"
      data-book-read
    >
      {/* THE HEAD — whose read, in which greek, over which window */}
      <div className="shrink-0 flex items-center gap-2 px-3.5 h-10 border-b border-borderSubtle/70">
        <span className="font-mono text-[11px] font-bold text-textPrimary">{surface.ticker}</span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">{label} · {shownIdx.length === 1 ? surface.expiries[shownIdx[0]]?.date : `${shownIdx.length} expiries`}</span>
        <span className="ml-auto inline-flex items-center gap-0.5" role="group" aria-label="Window" data-read-window>
          {WINDOWS.map(w => {
            const on = w.key === win;
            const dead = history ? history[WINDOWS.indexOf(w)] == null : true;
            return (
              <button
                key={w.key}
                onClick={() => setWin(w.key)}
                aria-pressed={on}
                disabled={dead}
                title={dead ? 'Before the open' : `What today's contracts did over the last ${w.key === 'open' ? 'session' : w.key}`}
                className={`px-1.5 h-6 rounded font-mono text-[9px] tnum transition-colors ${on ? 'bg-ink/[0.1] text-textPrimary' : dead ? 'text-textMuted/40 cursor-default' : 'text-textMuted hover:text-textPrimary hover:bg-ink/[0.05]'}`}
              >
                {w.key}
              </button>
            );
          })}
        </span>
        <button onClick={onClose} aria-label="Close the read" title="Close (Esc)" className="p-1 -mr-1 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* THE RAIL — the sections' names, the one in view lit */}
      <div className="shrink-0 flex items-center gap-1 px-2.5 h-8 border-b border-borderSubtle/50" data-read-rail>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => go(s.id)}
            aria-current={current === s.id || undefined}
            className={`px-2 h-6 rounded font-mono text-[9px] uppercase tracking-widest transition-colors ${current === s.id ? 'text-silver bg-silver/[0.08]' : 'text-textMuted hover:text-textPrimary'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div ref={bodyRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto px-3.5 py-3 flex flex-col gap-5 font-mono tnum">
        {/* THE BOOK */}
        <section data-read-section="book" className="flex flex-col gap-2">
          <Head>The book · {label} · per {unit}</Head>
          <div className="flex items-baseline gap-2">
            {/* the net in the ladder's own ramp — the total against itself, the foot's rule */}
            <span className="text-[17px] font-semibold" style={{ color: rampInk(greek, net, Math.max(1, Math.abs(net))) }}>{fmtUsd(net)}</span>
            <span className="text-[10px] text-textMuted">net {label}</span>
          </div>
          <p className="font-sans text-[11px] leading-relaxed text-textSecondary">{verdict.read}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            {levelRows.map(l => {
              const i = idxOf(l.strike);
              return (
                <button key={l.word} onClick={() => onKeep?.(l.strike)} className="flex items-baseline gap-1.5 text-left hover:opacity-80 transition-opacity" title={`Keep ${fmtStrike(l.strike)}`}>
                  <span className="text-[9px] uppercase tracking-wider" style={{ color: l.ink }}>{l.word}</span>
                  <span className="text-textPrimary font-semibold">{fmtStrike(l.strike)}</span>
                  <span style={{ color: i >= 0 ? rampInk(greek, at(greek, i, 'net')) : MUTED }}>{i >= 0 ? fmtUsd(at(greek, i, 'net')) : '—'}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* HEAVIEST TODAY */}
        <section data-read-section="heaviest" className="flex flex-col gap-2">
          <Head>Heaviest today · {label} · over {win === 'open' ? 'the session' : win}</Head>
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 gap-y-1 text-[11px] items-baseline">
            {heaviest.map((r, i) => {
              const role = roleOf(r.strike);
              const now = r[greek].net;
              return (
                <button key={r.strike} onClick={() => onKeep?.(r.strike)} className="contents text-left" title={`Keep ${fmtStrike(r.strike)}`}>
                  <span className="text-textPrimary font-semibold"><span className="text-textMuted font-normal mr-1.5">{i + 1}</span>{fmtStrike(r.strike)}</span>
                  <span className="text-[9px] uppercase tracking-wider truncate" style={{ color: role?.ink ?? MUTED }}>{role?.word ?? ''}</span>
                  <span style={{ color: rampInk(greek, now, surface.front.maxAbs[greek]) }}>{fmtUsd(now)}</span>
                  <span className="text-right"><Change now={now} then={thenAt(winIdx, r.strike)} /></span>
                </button>
              );
            })}
          </div>
          {!history && <p className="text-[10px] text-textMuted">No minute grid yet — the changes arrive once the session has two bars.</p>}
        </section>

        {/* THE STRIKE */}
        <section data-read-section="strike" className="flex flex-col gap-2">
          <Head>
            The strike · {fmtStrike(strike)}
            <span className="ml-1.5 normal-case tracking-normal">{pointed != null ? '· under the pointer' : selectedStrike != null ? '· kept' : '· the supreme'}</span>
          </Head>
          {legs ? (
            <div className="flex items-baseline gap-3 text-[11px]">
              <span className="text-[9px] uppercase tracking-wider text-textMuted">{label}</span>
              <span style={{ color: PUT_WALL }}>puts {fmtUsd(legs.put)}</span>
              <span style={{ color: CALL_WALL }}>calls {fmtUsd(legs.call)}</span>
              <span className="font-semibold" style={{ color: rampInk(greek, legs.net) }}>net {fmtUsd(legs.net)}</span>
            </div>
          ) : (
            <p className="text-[10px] text-textMuted">Off the ladder's window.</p>
          )}
          {sIdx >= 0 && (
            <div className="grid grid-cols-5 gap-x-2 text-[10px]">
              {GREEKS.map(g => (
                <span key={g} className="flex flex-col">
                  <span className="text-[8px] uppercase tracking-wider text-textMuted">{GREEK_LABEL[g]}</span>
                  <span className={g === greek ? 'font-semibold' : ''} style={{ color: rampInk(g, at(g, sIdx, 'net')) }}>{fmtUsd(at(g, sIdx, 'net'))}</span>
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Head>Today's contracts · {label} · over each window</Head>
            <div className="grid grid-cols-7 gap-x-1 text-[10px]">
              {WINDOWS.map((w, i) => (
                <span key={w.key} className="flex flex-col">
                  <span className="text-[8px] text-textMuted">{w.key}</span>
                  <span>{front ? <Change now={front[greek].net} then={thenAt(i, strike)} /> : <span style={{ color: MUTED }}>—</span>}</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* TO THE CLOSE */}
        <section data-read-section="close" className="flex flex-col gap-2">
          <Head>{shut ? 'The next session' : 'To the close'} · expected move</Head>
          <div className="flex items-baseline gap-2">
            <span className="text-[17px] font-semibold text-textPrimary">±{w1.toFixed(2)}</span>
            <span className="text-[10px] text-textMuted">
              one expected move · {shut ? 'a full session' : `${Math.round(minLeft)} min left`} · vol {(iv * 100).toFixed(1)}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            {[
              { word: 'one move up', price: surface.spot + w1, ink: CALL_WALL },
              { word: 'one move down', price: surface.spot - w1, ink: PUT_WALL },
              { word: 'two moves up', price: surface.spot + 2 * w1, ink: CALL_WALL },
              { word: 'two moves down', price: surface.spot - 2 * w1, ink: PUT_WALL },
            ].map(m => {
              const s = nearest(m.price);
              const role = roleOf(s);
              return (
                <button key={m.word} onClick={() => onKeep?.(s)} className="flex items-baseline gap-1.5 text-left hover:opacity-80 transition-opacity" title={`Keep ${fmtStrike(s)}`}>
                  <span className="text-[9px] uppercase tracking-wider text-textMuted">{m.word}</span>
                  <span style={{ color: m.ink }}>{m.price.toFixed(2)}</span>
                  <span className="text-textMuted">
                    · {fmtStrike(s)}
                    {role ? <span className="ml-1" style={{ color: role.ink }}>{role.word}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* RECENT */}
        <section data-read-section="recent" className="flex flex-col gap-2">
          <Head>Recently pointed at</Head>
          {recent.length === 0 ? (
            <p className="text-[10px] text-textMuted">Point at a row and it lands here.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {recent.map(s => {
                const role = roleOf(s);
                return (
                  <button
                    key={s}
                    onClick={() => onKeep?.(s)}
                    className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-md border text-[10px] transition-colors ${s === selectedStrike ? 'border-silver/50 text-silver' : 'border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted'}`}
                    title={`Keep ${fmtStrike(s)}`}
                  >
                    {fmtStrike(s)}
                    {role && <span className="text-[8px] uppercase tracking-wider" style={{ color: role.ink }}>{role.word}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* THE FOOT */}
      <div className="shrink-0 flex items-center gap-3 px-3.5 h-7 border-t border-borderSubtle/60 font-mono text-[8px] uppercase tracking-widest text-textMuted">
        <span>{surface.strikes.length} strikes · {shownIdx.length} {shownIdx.length === 1 ? 'expiry' : 'expiries'}</span>
        <span className="ml-auto inline-flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${clock.phase === 'OPEN' || clock.phase === 'AUCTION' ? 'bg-select' : 'bg-textMuted'}`} aria-hidden />
          {clock.phase === 'OPEN' || clock.phase === 'AUCTION' ? 'live' : clock.label} · <span className="normal-case tracking-normal tnum" style={{ color: SILVER }}>{clock.etTime}</span>
        </span>
      </div>
    </aside>
  );
};

export default BookRead;
