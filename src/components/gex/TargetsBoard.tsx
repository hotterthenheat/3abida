/*
==================================================
  SLAYER TERMINAL - TARGETS, THE AGENDA
  (components/gex/TargetsBoard.tsx)

  Box 1 of the Targets page (2026-09-08): every
  strike in the order it matters today, read top to
  bottom —

    THE HEAD      watch first · most likely reached ·
                  the weakest wall in reach · where
                  the close leans
    ONE LINE      Ranked by · Strikes · updated
    THE SENTENCE  "Watch 535 first, the put wall…"
    THE THREE     the first three by what matters,
                  side by side (Noah kept the podium)
    THE LIST      the rest, one row each, on one
                  column template

  Every figure is another page's answer for that
  strike — reached and holds (At the wall), built or
  drained (Building), closes here (Ahead) — and the
  inks are theirs: holds silver, breaks the warm side
  of the calendar's ramp, a wall's weight its cool
  side, the roles in their own. Two actions per row:
  the chart, the alert. A click makes the strike the
  terminal's focus; the row wears the where-you-are
  silver.

  THE ROW'S CARD (2026-09-09, after Noah put his
  partner's ranked page beside ours and asked what
  of it was worth taking — three facts were: the
  contracts behind the dollars, the strike against
  its neighbours, and which half of the rank carried
  it): a click on a list row keeps the strike AND
  opens a translucent card at the row — reached,
  holds, the two paths, open interest in contracts,
  built today, beside it, and one line naming the
  driver. The same capsule again, a click anywhere,
  a scroll or Esc closes it. The three cards on the
  podium already say most of this and take no card.
==================================================
*/

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, X } from 'lucide-react';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import GuideFocus, { GuideDoor } from '../ui/GuideFocus';
import JingleBell from '../ui/JingleBell';
import { TargetsGuide } from './TargetsGuide';
import { heatLaneColor } from './heatmap';
import { ALERT, CALL_WALL, FLIP, PUT_WALL, SUPREME, THERMAL_WARM } from './paletteInk';
import { AGENDA_COLUMNS, AGENDA_MIN_W, CARD_H, ROW_H } from './targetsSkeletons';
import { AGENDA_ORDERS, DRIVER_WORDS, buildWords, type Agenda, type AgendaOrder, type Target } from '../../data/agenda';
import { fmtDollars, fmtStrike, type AheadClock } from '../../data/ahead';
import { STRIKE_OPTIONS, STRIKES_TITLE, type RoomWindow } from '../../data/pinpointBook';
import { rowProps } from '../ui/rowKeys';
import HowSure from '../levels/HowSure';
import type { SureLevel, Sureness } from '../../data/levelSureness';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
/* An armed alert wore lime here until 2026-09-10; it is a watch, not a live
   thing, so it wears the alert ink now (palette ALERT) and the bell jingles */
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
export const ROLE_INK: Record<string, string> = { 'call wall': CALL_WALL, 'put wall': PUT_WALL, supreme: SUPREME, flip: FLIP };
/** Breaks and trapdoors are the calendar's warm side; a wall's weight its cool side */
const WARM = THERMAL_WARM;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const ORDER_OPTIONS: DropdownOption<AgendaOrder>[] = AGENDA_ORDERS.map(o => ({ value: o.value, label: o.label, hint: o.hint }));
/** The reach odds never print as nothing — 2% is their floor (data/wall.ts), so the floor reads as "under 2%" (PP-25) */
const REACH_FLOOR = 0.02;
const reachWords = (r: number) => (r <= REACH_FLOOR + 1e-9 ? '<2%' : pct(r));

/* ---- small parts ------------------------------------------------------------------ */

/** What a strike is: a named level, a shelf (a wall the Map does not name), a
    trapdoor (its hedging pushes the move along), or too thin to be any of them */
type Kind = 'named' | 'shelf' | 'trapdoor' | 'thin';
const kindOf = (t: Target): Kind => (t.role ? 'named' : t.isShelf ? 'shelf' : t.isWall ? 'thin' : 'trapdoor');

/** The beam in miniature: the silver share is the odds it holds; a trapdoor's is warm; a thin strike's is empty */
const HoldBeam = ({ t, w = 52, h = 6 }: { t: Target; w?: number | string; h?: number }) => {
  const kind = kindOf(t);
  return (
    <span className="relative block rounded-full bg-ink/[0.06] overflow-hidden shrink-0" style={{ width: w, height: h }} aria-hidden>
      {kind === 'trapdoor' ? (
        <span className="absolute inset-0 rounded-full" style={{ background: WARM, opacity: 0.35 }} />
      ) : (
        <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700" style={{ width: `${(kind === 'thin' ? 0 : t.hold) * 100}%`, background: SILVER, opacity: 0.85, transitionTimingFunction: EASE }} />
      )}
    </span>
  );
};

const Tags = ({ t, yours }: { t: Target; yours?: string }) => (
  <>
    {kindOf(t) !== 'thin' && (
      <span className="text-[11px] whitespace-nowrap" style={{ color: t.role ? ROLE_INK[t.role] : t.isShelf ? 'rgb(var(--text-muted))' : WARM }}>
        {t.role ?? (t.isShelf ? 'shelf' : 'trapdoor')}
      </span>
    )}
    {t.pin && <span className="text-[11px] text-textMuted">pin</span>}
    {yours && (
      <span className="text-[11px] whitespace-nowrap" style={{ color: SILVER }} title={yours} data-yours>
        you
      </span>
    )}
  </>
);

/* ---- the row's card ------------------------------------------------------------- */

const CARD_W = 300;
/** Where a card was asked for: the strike, the click's x, the row's edges */
interface CardAt {
  strike: number;
  x: number;
  rowTop: number;
  rowBottom: number;
}
const fmtContracts = (n: number) => Math.round(n).toLocaleString('en-US');

const CardLine = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <dt className="text-[11px] text-textMuted leading-[17px] whitespace-nowrap">{label}</dt>
    <dd className="min-w-0 font-mono text-[11px] tnum leading-[17px] text-textPrimary" title={typeof children === 'string' ? children : undefined}>{children}</dd>
  </>
);

/** The card: under the row when it fits, above it when it does not, kept on screen */
const RowCard = ({ t, at, inSession, onClose }: { t: Target; at: CardAt; inSession: boolean; onClose: () => void }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth || CARD_W;
    const h = el.offsetHeight || 220;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, at.x - w / 2));
    const below = at.rowBottom + 6;
    const top = below + h <= window.innerHeight - 8 ? below : Math.max(8, at.rowTop - h - 6);
    setPos({ left, top });
  }, [at]);
  const kind = kindOf(t);
  const dir = t.distancePct >= 0 ? 'above' : 'below';
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`${fmtStrike(t.strike)} — the strike's card`}
      className="fixed z-[120] rounded-md border border-borderSubtle px-3 py-2.5 select-text"
      style={{ width: CARD_W, left: pos?.left ?? 0, top: pos?.top ?? 0, background: 'rgba(8,8,10,0.88)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', opacity: pos ? 1 : 0, transition: 'opacity 160ms ease-out' }}
      onPointerDown={e => e.stopPropagation()}
      /* a typed dark glass, portalled onto the page: its words are the dark set on either theme (on the light page they were
         the page's black on the dark card — the light sweep, 2026-09-19) */
      data-theme="dark"
      data-chart-glass
      data-target-card-node={t.strike}
    >
      {/* THE HEAD: the strike, what it is, where it is */}
      <div className="flex items-center gap-2 h-5">
        <span className="font-mono text-[12px] font-bold tnum text-textPrimary">{fmtStrike(t.strike)}</span>
        <Tags t={t} />
        <span className={`ml-auto font-mono text-[11px] tnum ${t.distancePct >= 0 ? 'text-bull' : 'text-bear'}`}>
          {t.distancePct >= 0 ? '+' : ''}
          {t.distancePct.toFixed(2)}%
        </span>
        <span className="text-[11px] text-textMuted">{dir} spot</span>
        <button type="button" onClick={onClose} aria-label="Close the card" className="hit inline-flex items-center justify-center w-5 h-5 -mr-1 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors" title="Close (Esc)" data-card-close>
          <X className="w-3 h-3" />
        </button>
      </div>
      <dl className="mt-1.5 grid gap-x-3" style={{ gridTemplateColumns: '84px minmax(0, 1fr)' }}>
        <CardLine label={inSession ? 'Reached' : 'Reached next'}>
          {reachWords(t.reach)}
          {t.closes > 0 && (
            <span className="text-textMuted">
              {' '}
              · closes here <span className="text-textPrimary">{t.closes.toFixed(0)}%</span>
            </span>
          )}
        </CardLine>
        <CardLine label="Holds">
          {kind === 'trapdoor' ? <span style={{ color: WARM }}>pushes the move along</span> : kind === 'thin' ? <span className="text-textMuted">too thin to be a wall</span> : <span style={{ color: SILVER }}>{pct(t.hold)} when reached</span>}
        </CardLine>
        <CardLine label="If it breaks">
          {t.breakTo == null ? (
            <span className="text-textMuted">no shelf behind it</span>
          ) : (
            <>
              runs to {fmtStrike(t.breakTo)}
              {t.breakFlow !== 0 && (
                <span style={{ color: WARM }}>
                  {' '}
                  · {fmtDollars(Math.abs(t.breakFlow))} {t.breakFlow > 0 ? 'buying' : 'selling'}
                </span>
              )}
              {t.pocket && <span className="text-textMuted"> · empty</span>}
            </>
          )}
        </CardLine>
        <CardLine label="If it holds">{t.holdTo != null ? `back to ${fmtStrike(t.holdTo)}` : '—'}</CardLine>
        <CardLine label="Open interest">
          {fmtContracts(t.oi.calls)} <span className="text-textMuted">calls</span> · {fmtContracts(t.oi.puts)} <span className="text-textMuted">puts</span>
        </CardLine>
        <CardLine label={inSession ? 'Built today' : 'Built last'}>
          <span className={t.verdict === 'steady' ? 'text-textMuted' : ''}>{buildWords(t, inSession)}</span>
        </CardLine>
        {t.beside && <CardLine label="Beside it">{t.beside}</CardLine>}
      </dl>
      <div className="mt-2 pt-1.5 border-t border-ink/[0.06] text-[11px] leading-[15px] text-textMuted" data-card-driver>
        <span className="font-mono tnum text-textPrimary">#{t.rank}</span> {DRIVER_WORDS[t.driver]} · <span className="font-mono tnum text-textPrimary">{reachWords(t.reach)}</span> reached ×{' '}
        <span className="font-mono tnum text-textPrimary">{fmtDollars(t.stake)}</span> at stake
        {/* "why it ranks here" lived in a column that pushed the row's Alert off the box at 1440 (PP-13) — it is the card's now */}
        <div className="mt-0.5 text-textSecondary">{t.why}</div>
      </div>
    </div>,
    document.body
  );
};

const Actions = ({ t, armed, onChart, onAlert }: { t: Target; armed: boolean; onChart: (t: Target) => void; onAlert: (t: Target) => void }) => (
  <span className="flex items-center justify-end gap-1" onClick={ev => ev.stopPropagation()} onKeyDown={ev => ev.stopPropagation()}>
    {/* THE CHART IS PULSE'S (PP-1): the strike in focus on the terminal's chart, and back here from its fullscreen */}
    <button
      onClick={() => onChart(t)}
      title={`See ${fmtStrike(t.strike)} on the chart`}
      aria-label={`See ${fmtStrike(t.strike)} on the chart`}
      className="hit inline-flex items-center gap-1 h-6 px-2 rounded font-mono text-[11px] font-semibold text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06] transition-colors"
      data-row-chart
    >
      Chart <ArrowUpRight className="w-3 h-3" />
    </button>
    {/* THE BELL JINGLES and turns orange when set (Noah, 2026-09-10) — the
        alert ink, not lime: an armed alert is a watch, not a live thing */}
    <button
      onClick={() => onAlert(t)}
      aria-pressed={armed}
      aria-label={armed ? `Alert set at ${fmtStrike(t.strike)} — remove it` : `Alert me when price crosses ${fmtStrike(t.strike)}`}
      title={armed ? 'Alert set at this strike — click to remove it' : 'Alert me when price crosses this strike'}
      className="hit inline-flex items-center gap-1 h-6 px-2 rounded font-mono text-[11px] font-semibold whitespace-nowrap hover:bg-ink/[0.06]"
      style={{ color: armed ? ALERT : undefined, transition: `color 0.25s ease ${armed ? '0.45s' : '0s'}, background-color 0.15s` }}
      data-row-alert={armed ? 'armed' : 'quiet'}
    >
      <JingleBell count={armed ? 1 : 0} className={`w-3 h-3 ${armed ? '' : 'text-textSecondary'}`} />
      {/* one line, always — "ALERT / SET" stacked in a narrow card (Noah's screenshot, 2026-09-10) */}
      <span className={`whitespace-nowrap ${armed ? '' : 'text-textSecondary'}`}>{armed ? 'Alert set' : 'Alert'}</span>
    </button>
  </span>
);

const breakWords = (t: Target): ReactNode =>
  t.breakTo == null ? (
    <span className="text-textMuted">no shelf behind it</span>
  ) : (
    <>
      <span className="text-textSecondary">
        {t.isShelf ? 'runs to' : 'through to'} <span className="text-textPrimary">{fmtStrike(t.breakTo)}</span>
        {t.pocket ? ' · empty' : ''}
      </span>
      {t.breakFlow !== 0 && (
        <span style={{ color: WARM }}>
          {' '}
          · {fmtDollars(t.breakFlow)} {t.breakFlow > 0 ? 'buying' : 'selling'}
        </span>
      )}
    </>
  );

/* ---- the three ---------------------------------------------------------------- */

interface CardProps {
  t: Target;
  n: number;
  pick: boolean;
  kept: boolean;
  yours?: string;
  armed: boolean;
  inSession: boolean;
  marketPer1Pct: number;
  onPick: (strike: number) => void;
  onChart: (t: Target) => void;
  onAlert: (t: Target) => void;
  sure?: Sureness | null;
}

/** One thin bar and its figure — the card's two odds each get their own (PP-26: one bar between "Reached 45%" and
    "Holds 72%" was filled to 72% and read as either) */
const OddsBar = ({ label, value, words, ink }: { label: string; value: number | null; words: ReactNode; ink: string }) => (
  <div className="flex items-center gap-2 h-[16px]">
    <span className="w-[84px] shrink-0 text-[11px] text-textMuted whitespace-nowrap">{label}</span>
    <span className="relative flex-1 h-[5px] rounded-full bg-ink/[0.06] overflow-hidden" aria-hidden>
      {value != null && <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: ink, opacity: 0.85, transitionTimingFunction: EASE }} />}
    </span>
    <span className="w-[86px] shrink-0 text-right font-mono text-[11px] tnum whitespace-nowrap">{words}</span>
  </div>
);

const Card = ({ t, n, pick, kept, yours, armed, inSession, marketPer1Pct, onPick, onChart, onAlert, sure }: CardProps) => {
  const material = t.verdict !== 'steady';
  const kind = kindOf(t);
  return (
    <div
      /* #1 WEARS SILVER, never the supreme's magenta (PP-23): magenta means the heaviest strike of the book and nothing else */
      className={`relative rounded-md border p-3 flex flex-col cursor-pointer transition-colors focus-visible:outline-offset-[-2px] ${kept ? 'border-silver/60 bg-silver/[0.04]' : pick ? 'border-silver/40 bg-panel hover:border-silver/60' : 'border-borderSubtle bg-panel hover:border-borderMuted'}`}
      style={{ minHeight: CARD_H }}
      data-target-card={t.strike}
      {...rowProps(() => onPick(t.strike), `#${n} ${fmtStrike(t.strike)}${t.role ? `, the ${t.role}` : ''}: reached ${reachWords(t.reach)}${t.isShelf ? `, holds ${pct(t.hold)}` : ''}`)}
      aria-pressed={kept}
    >
      <div className="flex items-center gap-2 h-[22px] min-w-0">
        <span className={`shrink-0 inline-flex items-center h-5 px-2 rounded-full font-mono text-[11px] font-semibold ${pick ? 'text-silver bg-silver/10 border border-silver/30' : 'text-textSecondary bg-ink/[0.04] border border-borderSubtle'}`}>
          {pick ? '#1 · watch first' : `#${n}`}
        </span>
        <span className={`font-mono text-[16px] leading-none font-bold tnum ${kept ? 'text-silver' : 'text-textPrimary'}`}>{fmtStrike(t.strike)}</span>
        <Tags t={t} yours={yours} />
        <span className="ml-auto font-mono text-[11px] tnum text-textSecondary whitespace-nowrap">
          {t.distancePct >= 0 ? '+' : ''}
          {t.distancePct.toFixed(2)}%
        </span>
      </div>
      <div className="mt-2 flex flex-col gap-1">
        <OddsBar label={inSession ? 'Reached' : 'Reached next'} value={t.reach} words={<span className="text-textPrimary">{reachWords(t.reach)}</span>} ink="rgb(var(--text-secondary))" />
        <OddsBar
          label="Holds"
          value={kind === 'named' || kind === 'shelf' ? t.hold : null}
          words={kind === 'named' || kind === 'shelf' ? <span style={{ color: SILVER }}>{pct(t.hold)}</span> : kind === 'trapdoor' ? <span style={{ color: WARM }}>pushes along</span> : <span className="text-textMuted">too thin</span>}
          ink={SILVER}
        />
      </div>
      <p className="mt-2 font-mono text-[11px] leading-[15px] tnum line-clamp-2">
        <span className="text-textMuted">if it {t.isShelf ? 'breaks' : 'goes'} · </span>
        {breakWords(t)}
      </p>
      <p className="mt-1 font-mono text-[11px] leading-[15px] tnum flex items-center gap-x-3 flex-wrap">
        <span className={material ? 'text-textPrimary' : 'text-textMuted'}>{buildWords(t, inSession)}</span>
        {t.closes > 0 && <span className="text-textSecondary">closes here {t.closes.toFixed(0)}%</span>}
        <span className="text-textSecondary">
          {fmtDollars(t.stake)} at stake · {(t.stake / Math.max(1, marketPer1Pct)).toFixed(1)}×
        </span>
      </p>
      <div className="mt-auto pt-1 flex items-center justify-end gap-1 h-[26px] -mr-1">
        {sure && <span className="mr-auto -ml-1" onClick={e => e.stopPropagation()}><HowSure sure={sure} /></span>}
        <Actions t={t} armed={armed} onChart={onChart} onAlert={onAlert} />
      </div>
    </div>
  );
};

/* ---- the box ------------------------------------------------------------------------ */

interface Props {
  agenda: Agenda;
  ticker: string;
  clock: AheadClock;
  order: AgendaOrder;
  onOrder: (o: AgendaOrder) => void;
  /** The room's strike window — which strikes are listed */
  window: RoomWindow;
  onWindow: (w: RoomWindow) => void;
  updatedAt: string;
  yours?: ReadonlyMap<number, string>;
  armedAt: (strike: number) => boolean;
  onChart: (t: Target) => void;
  onAlert: (t: Target) => void;
  focus: number | null;
  onPick: (strike: number) => void;
  scope?: ReactNode;
  watch?: ReactNode;
  /** What the named levels stand on (data/levelSureness.ts) — "How sure" on a card that is one */
  sure?: Record<SureLevel, Sureness> | null;
}

const TargetsBoard = ({ agenda, ticker, clock, order, onOrder, window, onWindow, updatedAt, yours, armedAt, onChart, onAlert, focus, onPick, scope, watch, sure }: Props) => {
  const [guideOpen, setGuideOpen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  /* THE CARD: one open at a time; a click anywhere, a scroll or Esc closes it.
     The document hears the click first (capture), so the row's own handler
     runs after and can open the next one — or leave the same one closed. */
  const [card, setCard] = useState<CardAt | null>(null);
  const cardRef = useRef<CardAt | null>(null);
  cardRef.current = card;
  useEffect(() => {
    if (!card) return;
    const onClick = (e: MouseEvent) => {
      /* A click on a row is the row's to judge (toggle or move) — React flushes
         a close from here before the row's own handler runs, so closing here
         too made the same row read "no card" and reopen itself */
      if ((e.target as Element | null)?.closest?.('[data-target-card-node],[data-target-row]')) return;
      setCard(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setCard(null);
    };
    const onScroll = () => setCard(null);
    /* globalThis, not window — `window` is this component's strike-window prop */
    document.addEventListener('click', onClick, true);
    globalThis.addEventListener('keydown', onKey, true);
    globalThis.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      globalThis.removeEventListener('keydown', onKey, true);
      globalThis.removeEventListener('scroll', onScroll, true);
    };
  }, [card]);
  /* A ROW OPENS BY THE KEYS TOO (X6): Enter or Space keeps the strike and opens its card at the row's middle */
  const openRow = (t: Target, el: Element, x?: number) => {
    /* Which card was open, read before the pick — the focus store flushes a render inside it */
    const was = cardRef.current;
    onPick(t.strike);
    if (was && Math.abs(was.strike - t.strike) < 1e-9) {
      setCard(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setCard({ strike: t.strike, x: x ?? r.left + Math.min(r.width / 2, 240), rowTop: r.top, rowBottom: r.bottom });
  };
  const onRowClick = (t: Target) => (e: ReactMouseEvent<HTMLDivElement>) => openRow(t, e.currentTarget, e.detail > 0 ? e.clientX : undefined);
  /* THE FAINT TAIL FOLDS (PP-25): strikes the day reaches less than 2% of the time and that hold nothing — "2% reached ·
     no shelf behind it · steady", row after row — stand as one line until it is opened */
  const [tailOpen, setTailOpen] = useState(false);
  const cardTarget = card ? (agenda.targets.find(t => Math.abs(t.strike - card.strike) < 1e-9) ?? null) : null;
  const three = agenda.first;
  const threeSet = useMemo(() => new Set(three.map(t => t.strike)), [three]);
  const rest = useMemo(() => agenda.targets.filter(t => !threeSet.has(t.strike)), [agenda.targets, threeSet]);
  const faint = (t: Target) => t.reach <= REACH_FLOOR + 1e-9 && t.verdict === 'steady' && !t.role && !(focus != null && Math.abs(focus - t.strike) < 1e-9);
  const tail = rest.filter(faint);
  const listed = tailOpen || tail.length < 2 ? rest : rest.filter(t => !faint(t));
  const maxStake = Math.max(1, ...agenda.targets.map(t => t.stake));
  const lead = three[0];
  const reachedWord = clock.inSession ? 'reached by the close' : 'reached next session';

  return (
    <section className="relative flex flex-col min-w-0" data-targets-board>
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the agenda" testId="targets-guide" viewport>
        <TargetsGuide agenda={agenda} clock={clock} />
      </GuideFocus>

      {/* THE HEAD */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-[15px] font-semibold leading-tight text-textPrimary">Targets</h2>
            {scope}
            <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the order, the cards and the rows mean" testId="targets-guide" />
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted">Every strike in the order it matters today — how likely price gets there × how much happens if it does</p>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          <div>
            <dt className="text-[11px] text-textMuted">Watch first</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum whitespace-nowrap" style={{ color: lead?.role ? ROLE_INK[lead.role] : 'rgb(var(--text-primary))' }} data-watch-first>
              {lead ? fmtStrike(lead.strike) : '—'} {lead?.role && <span className="text-[11px]">{lead.role}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-textMuted">Most likely reached</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap">{agenda.mostReached ? `${fmtStrike(agenda.mostReached.strike)} · ${reachWords(agenda.mostReached.reach)}` : '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-textMuted" title="In reach: reached more than 15% of the time by the close">Weakest wall in reach</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum whitespace-nowrap" style={{ color: SILVER }}>
              {agenda.weakestWall ? `${fmtStrike(agenda.weakestWall.strike)} · holds ${pct(agenda.weakestWall.hold)}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-textMuted">The close leans to</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap">{agenda.closesNear ? `${fmtStrike(agenda.closesNear.strike)} · ${agenda.closesNear.odds.toFixed(0)}%` : '—'}</dd>
          </div>
        </dl>
      </div>

      {/* THE ONE LINE OF CONTROLS */}
      <div className="px-5 pb-2 flex items-center gap-2 flex-wrap" data-targets-controls>
        <DropdownSelect label="Ranked by" value={order} options={ORDER_OPTIONS} onChange={onOrder} title="The order of the list" testId="targets-order" />
        <DropdownSelect label="Strikes" value={window} options={STRIKE_OPTIONS} onChange={onWindow} title={STRIKES_TITLE} testId="targets-strikes" />
        <span className="ml-auto font-mono text-[11px] text-textMuted whitespace-nowrap" data-targets-updated>
          {ticker} · {agenda.targets.length} strikes · updated {updatedAt} · every 10s
        </span>
        {watch}
      </div>

      {/* THE SENTENCE */}
      <div className="mx-5 px-3 py-2 border-y border-borderSubtle/60 min-h-[34px] flex items-center gap-2 flex-wrap" data-targets-sentence>
        <span className="font-mono text-[11px] font-semibold" style={{ color: SILVER }}>
          Watch
        </span>
        <span className="text-[12px] leading-snug text-textSecondary">{agenda.sentence.replace(/^Watch /, '')}</span>
      </div>

      {/* THE THREE */}
      {/* The three cards under each other on a phone (the phone pass, 2026-09-13) */}
      <div className="px-5 pt-3 pb-3 grid grid-cols-1 sm:grid-cols-3 gap-3" data-targets-three>
        {three.map((t, i) => (
          <Card
            key={t.strike}
            t={t}
            n={i + 1}
            pick={i === 0}
            kept={focus != null && Math.abs(focus - t.strike) < 1e-9}
            yours={yours?.get(t.strike)}
            armed={armedAt(t.strike)}
            inSession={clock.inSession}
            marketPer1Pct={agenda.marketPer1Pct}
            onPick={onPick}
            onChart={onChart}
            onAlert={onAlert}
            sure={t.role && sure ? sure[t.role] : null}
          />
        ))}
      </div>

      {/* THE LIST */}
      <div className="px-5 pb-2 overflow-x-auto" data-targets-rows onPointerLeave={() => setHover(null)}>
        <div className="grid items-center gap-x-3 gap-y-0" style={{ gridTemplateColumns: AGENDA_COLUMNS, minWidth: AGENDA_MIN_W }}>
          <div className="h-[18px] text-[11px] text-textMuted">#</div>
          <div className="h-[18px] text-[11px] text-textMuted">Strike</div>
          <div className="h-[18px] text-[11px] text-textMuted text-right">From spot</div>
          <div className="h-[18px] text-[11px] text-textMuted text-right whitespace-nowrap">{clock.inSession ? 'Reached' : 'Reached next'}</div>
          <div className="h-[18px] text-[11px] text-textMuted text-right">Holds</div>
          <div className="h-[18px] text-[11px] text-textMuted">If it breaks</div>
          <div className="h-[18px] text-[11px] text-textMuted whitespace-nowrap">{clock.inSession ? 'Built today' : 'Built last session'}</div>
          <div className="h-[18px] text-[11px] text-textMuted">At stake</div>
          <div className="h-[18px] text-[11px] text-textMuted text-right">Actions</div>
          {listed.map(t => {
            const kept = focus != null && Math.abs(focus - t.strike) < 1e-9;
            const wash = kept || hover === t.strike ? 'bg-silver/[0.05]' : '';
            const material = t.verdict !== 'steady';
            const row = rowProps(() => undefined, `#${t.rank} ${fmtStrike(t.strike)}${t.role ? `, the ${t.role}` : ''}: reached ${reachWords(t.reach)}${t.isShelf ? `, holds ${pct(t.hold)}` : ''} — open its card`);
            return (
              <div
                key={t.strike}
                className={`grid grid-cols-subgrid col-span-9 items-center border-t border-borderSubtle/40 rounded cursor-pointer focus-visible:outline-offset-[-2px] ${wash}`}
                style={{ height: ROW_H }}
                data-target-row={t.strike}
                onPointerEnter={() => setHover(t.strike)}
                role={row.role}
                tabIndex={row.tabIndex}
                aria-label={row['aria-label']}
                aria-pressed={kept}
                onClick={onRowClick(t)}
                onKeyDown={e => {
                  if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
                  e.preventDefault();
                  openRow(t, e.currentTarget);
                }}
                title={t.why}
              >
                <div className="font-mono text-[11px] tnum text-textSecondary">#{t.rank}</div>
                <div className={`flex items-center gap-1.5 px-2 font-mono text-[12px] tnum whitespace-nowrap overflow-hidden ${kept ? 'text-silver font-bold shadow-[inset_2px_0_0_0_rgb(var(--silver)/0.7)] h-full' : 'text-textPrimary'}`}>
                  {fmtStrike(t.strike)}
                  <Tags t={t} yours={yours?.get(t.strike)} />
                </div>
                <div className="text-right font-mono text-[11px] tnum text-textPrimary">
                  {t.distancePct >= 0 ? '+' : ''}
                  {t.distancePct.toFixed(2)}%
                </div>
                <div className="text-right font-mono text-[11px] tnum text-textPrimary">{reachWords(t.reach)}</div>
                <div className="flex items-center justify-end gap-2 font-mono text-[11px] tnum font-semibold" style={{ color: t.isShelf ? SILVER : kindOf(t) === 'trapdoor' ? WARM : 'rgb(var(--text-muted))' }}>
                  {t.isShelf ? pct(t.hold) : '—'}
                  <HoldBeam t={t} />
                </div>
                <div className="font-mono text-[11px] tnum truncate">{breakWords(t)}</div>
                <div className={`font-mono text-[11px] tnum truncate ${material ? 'text-textPrimary' : 'text-textMuted'}`}>{buildWords(t, clock.inSession)}</div>
                <div className="relative h-full flex items-center">
                  <span className="absolute inset-y-[13px] left-0 right-14 rounded-full bg-ink/[0.04]" />
                  <span
                    className="absolute inset-y-[13px] left-0 rounded-full transition-[width] duration-700"
                    style={{ width: `calc(${(t.stake / maxStake) * 100}% - ${(t.stake / maxStake) * 56}px)`, background: t.isWall ? heatLaneColor(-t.stake, maxStake, 'thermal-yellow', 0.35) : heatLaneColor(t.stake, maxStake, 'thermal-yellow', 0.35), transitionTimingFunction: EASE }}
                  />
                  <span className="absolute right-0 font-mono text-[11px] tnum text-textPrimary">{fmtDollars(t.stake)}</span>
                </div>
                <Actions t={t} armed={armedAt(t.strike)} onChart={onChart} onAlert={onAlert} />
              </div>
            );
          })}
          {tail.length >= 2 && (
            <button
              type="button"
              onClick={() => setTailOpen(v => !v)}
              aria-expanded={tailOpen}
              className="col-span-9 flex items-center gap-3 px-2 h-[30px] border-t border-borderSubtle/40 rounded text-left font-mono text-[11px] text-textMuted hover:text-textSecondary"
              data-targets-tail={tail.length}
            >
              <span className="whitespace-nowrap">
                {tail.length} strikes reached under 2% of the time, holding nothing · {fmtStrike(Math.max(...tail.map(t => t.strike)))} – {fmtStrike(Math.min(...tail.map(t => t.strike)))}
              </span>
              <span className="flex-1 h-px bg-ink/[0.07]" />
              <span className="text-textSecondary">{tailOpen ? 'fold' : 'show'}</span>
            </button>
          )}
        </div>
      </div>
      {card && cardTarget && <RowCard t={cardTarget} at={card} inSession={clock.inSession} onClose={() => setCard(null)} />}
      <p className="px-5 pb-4 pt-2 text-[12px] leading-relaxed text-textSecondary" data-targets-foot>
        {lead ? `${fmtStrike(lead.strike)} is ${reachedWord} ${pct(lead.reach)} of the time. ` : ''}
        {agenda.weakestWall ? `The weakest wall in reach is ${fmtStrike(agenda.weakestWall.strike)}, holding ${pct(agenda.weakestWall.hold)} of the time. ` : ''}
        {agenda.closesNear ? `The close leans to ${fmtStrike(agenda.closesNear.strike)} at ${agenda.closesNear.odds.toFixed(0)}%.` : ''}
      </p>
    </section>
  );
};

export default TargetsBoard;
