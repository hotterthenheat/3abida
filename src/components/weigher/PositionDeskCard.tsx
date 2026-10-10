/*
==================================================
  SLAYER TERMINAL - THE POSITION CARD ON THE DESK
  (components/weigher/PositionDeskCard.tsx)

  The Weigher's bottom-right card (2026-09-14): the
  row picked in the list — a contract you WATCH
  (marked when added) or a position you OWN or
  SOLD (what you paid) — as Robinhood's Simulated
  Returns, in the Positions panel's clothes:

    THE FIGURES   the return at the chosen price
                  now, the estimated contract price,
                  "Now · 4 DTE"
    BY DATE       the return over the sessions to
                  the expiry at that price — the
                  line sinks as time runs out; a
                  dashed max-loss floor; the library
                  chart with its crosshair and card
    THE RULER     the stock's price under a marker,
                  dragged by the cent — the dealer
                  map's walls and flip on it
    BY PRICE      the payoff sketch — the other cut
                  of the same surface, the kept
                  price on it
    THE FACTS     what it has done since it was
                  added, then the map's five
    THE SENTENCE  where it sits, what the hedging
                  does to it

  One pricer for every figure: the chain's own
  estimator (data/positionCurve valueOn). A settled
  row shows the Robinhood notice as one quiet line.
==================================================
*/

import { useEffect, useMemo, useState } from 'react';
import { Eye, Minus, Pencil, Plus, Trash2, X } from 'lucide-react';
import CardTabs from '../ui/CardTabs';
import { When } from '../record/when';
import SessionsChart from '../record/SessionsChart';
import PositionForm from '../gex/PositionForm';
import { PayoffSketch } from '../gex/PayoffSketch';
import PriceRuler from './PriceRuler';
import { buildPositionCurve, fmtPnl, valueOn } from '../../data/positionCurve';
import { readPosition, subjectWords, type Position, type Verdict } from '../../data/positions';
import { setWatchedSize, yearsToExpiry } from '../../data/watchlist';
import { contractIvFor } from '../../data/weigherDesk';
import { fmtUsd } from '../../data/gex';
import { isoDate, nextSession, today } from '../../core/calendar';
import type { DeskContract } from '../../data/weigherDesk';
import type { ExposureProfileData } from '../../types/gex';
import { daysSince, dirInk, fmtStrike, monthDay, rSigned, usdSigned, type ListRow } from './PositionsList';

const DOOR_CLS =
  'hit inline-flex items-center gap-1 px-2 py-1 rounded-md border border-borderSubtle bg-ink/[0.03] hover:bg-ink/[0.06] font-mono text-[11px] uppercase tracking-wider text-textSecondary hover:text-textPrimary transition-colors';
const VERDICT_WORD: Record<Verdict, string> = { with: 'Hedging with you', against: 'Hedging against you', mixed: 'Hedging both ways' };
const VERDICT_CLS: Record<Verdict, string> = { with: 'bg-bull/10 text-bull border-bull/20', against: 'bg-bear/10 text-bear border-bear/20', mixed: 'bg-ink/[0.05] text-textSecondary border-borderSubtle' };
const VIEWS = [
  { value: 'date', label: 'By date' },
  { value: 'price', label: 'By price' },
] as const;
type View = (typeof VIEWS)[number]['value'];

/** One of the five facts under the sketch — the Position card's own grammar */
const Fact5 = ({ k, v, tone }: { k: string; v: React.ReactNode; tone?: string }) => (
  <div className="min-w-0">
    <dt className="text-[11px] text-textMuted truncate">{k}</dt>
    <dd className={`mt-0.5 font-mono text-[12px] tnum leading-snug ${tone ?? 'text-textPrimary'}`}>{v}</dd>
  </div>
);

/** The session `n` trading days from today */
function sessionAhead(n: number): Date {
  let d = today();
  for (let i = 0; i < n; i++) {
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    d = nextSession(next);
  }
  return d;
}

/** The sketch's price window: the day's map (thirty strikes each side), widened to hold the strike */
function sketchWindow(profile: ExposureProfileData, strike: number): { lo: number; hi: number } {
  const ks = profile.strikes.map(s => s.strike);
  const step = ks.length > 1 ? Math.abs(ks[0] - ks[1]) : 1;
  return { lo: Math.min(Math.min(...ks), strike - 2 * step), hi: Math.max(Math.max(...ks), strike + 2 * step) };
}

interface Props {
  /** The chain's picked contract — the empty states speak of it */
  picked: DeskContract | null;
  /** The row the card draws */
  row: ListRow | null;
  /** The day's dealer map for the name — the ruler's marks, the read's ground */
  profile: ExposureProfileData | null;
  contractKey: string;
  /** Watch the picked contract (not watched yet) */
  onWatch?: () => void;
  /** A watched row's doors */
  onClose?: () => void;
  onRemove?: () => void;
  /** An owned row's door — Change is the form itself */
  onRemovePosition?: () => void;
}

const PositionDeskCard = ({ picked, row, profile, contractKey, onWatch, onClose, onRemove, onRemovePosition }: Props) => {
  /* the chosen price (null = the market's) and the view — both reset with the row */
  const [price, setPrice] = useState<number | null>(null);
  const [view, setView] = useState<View>('date');
  useEffect(() => {
    setPrice(null);
    setView('date');
  }, [row?.id]);

  /* THE POSITION the card prices: a watched contract is a long position marked when it was added */
  const pos: Position | null = useMemo(() => {
    if (!row) return null;
    if (row.kind === 'own') return row.p;
    const w = row.w;
    return { id: w.id, ticker: w.ticker, strike: w.strike, right: w.right, side: 'long', contracts: w.size, expiry: w.expiry, entry: w.addedMark, source: 'you', addedAt: w.addedAt };
  }, [row]);
  const spot = profile?.levels.spot ?? null;
  const at = price ?? spot ?? 0;
  const read = pos && profile ? readPosition(pos, profile) : null;
  const win = pos && profile ? sketchWindow(profile, pos.strike) : null;
  const curve = pos && spot != null && win ? buildPositionCurve(pos, spot, win.lo, win.hi, 0) : null;
  const open = row ? (row.kind === 'watch' ? row.w.status === 'open' : (read?.sessions ?? 0) >= 0) : false;
  const sessions = curve?.sessions ?? 0;
  const sign = pos ? (pos.side === 'long' ? 1 : -1) * 100 * pos.contracts : 0;
  const ref = curve?.ref ?? 0;

  /* BY DATE: the return at the chosen price from now to the bell, SAMPLED THROUGH THE TRADING
     HOURS (a hundred or so points — one per session drew a straight line between two days;
     Noah, 2026-09-14: "on robinhood this random line is a curve"): each sample is a fraction
     of a session, placed at that hour of that day on the clock */
  const series = useMemo(() => {
    if (!pos || !curve) return [];
    const out: { time: number; value: number; worth: number; when: string }[] = [];
    const steps = sessions <= 0 ? 1 : Math.min(160, Math.max(48, sessions * 16));
    const dates: Date[] = [];
    for (let d = 0; d <= sessions; d++) dates.push(sessionAhead(d));
    let last = 0;
    for (let i = 0; i <= steps; i++) {
      const ahead = sessions <= 0 ? i : (sessions * i) / steps;
      const d = Math.min(sessions, Math.floor(ahead));
      const f = sessions <= 0 ? i : ahead - d;
      const date = dates[d];
      /* the session runs 9:30 to 16:00 — the fraction walks the day's hours */
      const stamp = new Date(`${isoDate(date)}T09:30:00`).getTime() + Math.min(1, f) * 6.5 * 3600 * 1000;
      let time = Math.floor(stamp / 1000);
      if (time <= last) time = last + 60;
      last = time;
      const worth = valueOn(pos, at, ahead, true);
      const clock = new Date(stamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      out.push({ time, value: (worth - ref) * sign, worth, when: `${monthDay(isoDate(date))} · ${f >= 1 || (sessions <= 0 && i > 0) ? 'the bell' : clock}` });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, at, sessions, ref, sign, spot]);
  const worthBy = useMemo(() => new Map(series.map(s => [s.time, s])), [series]);
  const points = useMemo(() => series.map(s => ({ time: s.time, value: s.value })), [series]);
  const retNow = series[0]?.value ?? 0;
  const estNow = series[0]?.worth ?? 0;
  /* the most a bought contract can lose — the floor the line sinks to */
  const maxLoss = pos && pos.side === 'long' ? -ref * 100 * pos.contracts : null;
  const floorLines = useMemo(() => (maxLoss != null ? [{ price: maxLoss, color: 'rgb(var(--bear))', title: 'max loss', style: 'dashed' as const }] : []), [maxLoss]);
  const marks = useMemo(() => (profile ? [{ price: profile.levels.putWall, label: 'put wall' }, { price: profile.levels.flip, label: 'flip' }, { price: profile.levels.callWall, label: 'call wall' }] : []), [profile]);

  /* ---- the empty states -------------------------------------------------------------- */
  /* the empty states stand at the column's floor (438 less the 32px head and the card's two
     border lines): the card is as tall as its content now (it folds, 2026-09-14), and an empty
     card must still share the list cards' bottom edge */
  if (!picked && !row) {
    return (
      /* CENTRED, READABLE (the audit's WE-10: a 9 px line at the foot of an empty 400 px panel) */
      <div className="h-full min-h-[404px] flex flex-col items-center justify-center gap-2 px-6 text-center select-none animate-soft-in">
        <span className="text-[13px] font-semibold text-textSecondary">Nothing picked yet</span>
        <span className="max-w-[340px] text-[12px] leading-relaxed text-textMuted">Press + on a strike in the chain to watch it, add a position, or press a row of a list — its projected returns land here.</span>
      </div>
    );
  }
  if (!row || !pos || !curve || !read || !profile || spot == null) {
    return (
      <div className="h-full flex flex-col animate-soft-in">
        {/* 363 + the 41px foot = the same 404 */}
        <div key={contractKey} className="flex-1 min-h-[363px] flex flex-col items-center justify-center gap-1.5 px-6 text-center select-none animate-soft-in" data-contract-unwatched>
          <span className="text-[13px] font-semibold text-textSecondary">Not on your list</span>
          <span className="max-w-[340px] text-[12px] leading-relaxed text-textMuted">Watch it marks the contract at this tick's price — its projected returns land here.</span>
        </div>
        <div className="shrink-0 px-3.5 py-2 border-t border-borderSubtle/60 flex items-center gap-2 flex-wrap" data-contract-foot>
          <span className="font-mono text-[11px] text-textMuted">Not on your list — Watch it marks it at this tick's price</span>
          <span className="ml-auto flex items-center gap-1.5">
            {onWatch && (
              <button onClick={onWatch} className={DOOR_CLS} title="Watch it — marked at this tick's price, tracked as if bought" data-watch-door="watch">
                <Eye className="w-3 h-3" />
                Watch it
              </button>
            )}
          </span>
        </div>
      </div>
    );
  }

  /* ---- the card ---------------------------------------------------------------------- */
  const w = row.kind === 'watch' ? row.w : null;
  const per = 100 * pos.contracts;
  const title = `${pos.contracts} × ${pos.ticker} ${fmtStrike(pos.strike)} ${pos.right === 'C' ? 'call' : 'put'}${pos.contracts === 1 ? '' : 's'}`;
  const line =
    row.kind === 'watch'
      ? `You watch it · marked ${row.w.addedMark.toFixed(2)} each when added · ${row.w.status === 'open' ? 'priced by the model' : row.w.status === 'closed' ? 'closed by hand' : 'settled at the bell'}`
      : `${pos.side === 'long' ? 'You own it' : 'You sold it'} · ${
          curve.refKind === 'entry' ? `paid ${curve.ref.toFixed(2)} each` : curve.refKind === 'added' ? `marked ${curve.ref.toFixed(2)} each when you added it` : `worth ${curve.valueNow.toFixed(2)} each today, no cost given`
        } · ${pos.source === 'tracker' ? 'from the Tracker' : 'added by you'}`;

  return (
    <div className="h-full flex flex-col animate-soft-in">
      <div key={`pc-${row.id}`} className="flex-1 min-h-0 flex flex-col gap-3 px-4 pt-3 pb-3 animate-soft-in-slow" data-watch-position={row.kind === 'watch' ? row.w.status : pos.side}>
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-[14px] font-semibold leading-tight text-textPrimary truncate">{title}</h4>
            <p className="mt-0.5 text-[11px] text-textMuted truncate">{line}</p>
          </div>
          <span className={`shrink-0 inline-flex items-center h-6 px-2.5 rounded-full border text-[11px] font-medium ${VERDICT_CLS[read.verdict]}`} data-verdict={read.verdict}>
            {VERDICT_WORD[read.verdict]}
          </span>
        </header>

        {open ? (
          <>
            {/* THE FIGURES — Robinhood's head: the return at the chosen price now, the estimated
                contract price, and the clock */}
            <div className="flex items-end gap-4 flex-wrap" data-sim-figures>
              <div className="min-w-0">
                <span className="block font-mono text-[11px] uppercase tracking-wider text-textMuted">Projected return</span>
                <span className={`block font-mono text-[26px] font-bold tnum leading-none mt-1 ${dirInk(retNow)}`} data-sim-return>
                  {fmtPnl(retNow)}
                </span>
              </div>
              <div className="min-w-0 pb-0.5">
                <span className="block font-mono text-[12px] tnum text-textPrimary">
                  <span className="font-semibold" data-sim-est>
                    ${estNow.toFixed(2)}
                  </span>{' '}
                  <span className="text-textMuted">estimated contract price</span>
                </span>
                <span className="block mt-0.5 font-mono text-[11px] text-textSecondary" data-sim-clock>
                  Now · {sessions} DTE{Math.abs(at - spot) > 0.005 ? ` · at ${at.toFixed(2)}, ${((at / spot - 1) * 100).toFixed(2)}% from now` : ' · at the market'}
                </span>
              </div>
              <div className="ml-auto self-start">
                <CardTabs options={VIEWS} value={view} onChange={setView} ariaLabel="Projected returns by date or by price" />
              </div>
            </div>

            {view === 'date' ? (
              sessions > 0 ? (
                /* BY DATE — the return over the sessions to the bell at the chosen price, on the
                   library chart; the dashed floor is the most a bought contract can lose */
                <div data-sim-by-date data-sim-points={points.length}>
                  <SessionsChart
                    points={points}
                    kind="baseline"
                    ink="rgb(var(--bull))"
                    inkBelow="rgb(var(--bear))"
                    baseline={0}
                    lines={floorLines}
                    height={300}
                    clock="span"
                    spanEndWord="exp"
                    scale="pnl"
                    cardW={216}
                    cardH={66}
                    testId="returns-by-date"
                    card={h => {
                      const s = h.point ? worthBy.get(h.point.time) : null;
                      return (
                        <>
                          <span className="font-mono text-[11px] font-semibold text-textPrimary tnum">{s ? s.when : '—'}</span>
                          {s && (
                            <span className={`font-mono text-[11px] tnum ${dirInk(s.value)}`}>
                              {fmtPnl(s.value)} · worth ${s.worth.toFixed(2)} at {at.toFixed(2)}
                            </span>
                          )}
                        </>
                      );
                    }}
                  />
                </div>
              ) : (
                <div className="min-h-[96px] flex items-center justify-center rounded-md border border-borderSubtle/60 bg-ink/[0.02]" data-sim-today>
                  <span className="font-mono text-[11px] text-textMuted">
                    Expires today — at the bell, at {at.toFixed(2)}, this reads <span className={dirInk(series[series.length - 1]?.value ?? 0)}>{fmtPnl(series[series.length - 1]?.value ?? 0)}</span>
                  </span>
                </div>
              )
            ) : (
              /* BY PRICE — the payoff sketch, the kept price on it; no level words (the ruler names them) */
              <div data-sim-by-price>
                <PayoffSketch
                  curve={curve}
                  spot={spot}
                  levels={profile.levels}
                  strike={pos.strike}
                  wantsUp={(pos.right === 'C') === (pos.side === 'long')}
                  labels={false}
                  levelMarks={false}
                  pinned={at}
                  onPin={p => setPrice(p ?? spot)}
                  softLabel="today"
                  /* the chance of finishing above or below a price, from the contract's own vol and clock */
                  dist={{ iv: contractIvFor(pos.ticker, pos.strike, pos.right), years: yearsToExpiry(pos.expiry) }}
                />
              </div>
            )}

            {/* THE RULER — the stock's price, dragged by the cent; the map's levels stand on it */}
            <PriceRuler value={at} onChange={setPrice} spot={spot} marks={marks} testId="returns-ruler" />
          </>
        ) : (
          /* Robinhood's "only available for active positions", as one quiet line */
          <div className="min-h-[96px] flex items-center justify-center rounded-md border border-borderSubtle/60 bg-ink/[0.02]" data-sim-settled>
            <span className="font-mono text-[11px] text-textMuted">
              {w ? (w.status === 'closed' ? 'Closed by hand' : 'Settled at the bell') : `Expired ${monthDay(pos.expiry)} — settled`} — projected returns are for open positions
            </span>
          </div>
        )}

        {/* WHAT IT HAS DONE — since the moment it was added (watched), or against what you paid (owned) */}
        <dl className="grid grid-cols-5 gap-x-4 gap-y-1 border-t border-borderSubtle/50 pt-3" data-position-facts="watch">
          {row.kind === 'watch' ? (
            <>
              {/* one unit each, said (the audit's WE-8: "$470.00" per contract beside "$4.77" per share) */}
              <Fact5 k="Market value" v={`$${(row.r.mark * per).toFixed(2)} · ${row.r.mark.toFixed(2)} × ${per}`} />
              <Fact5 k="Cost a share" v={`$${row.w.addedMark.toFixed(2)} · 1R`} />
              <Fact5 k="Today's return" v={open ? `${usdSigned(row.r.todayDollars)} · ${rSigned(row.r.todayR)}` : '—'} tone={open ? dirInk(row.r.todayDollars) : 'text-textMuted'} />
              <Fact5 k="Total return" v={`${usdSigned(row.r.totalDollars)} · ${rSigned(row.r.totalR)}`} tone={dirInk(row.r.totalDollars)} />
              <div className="min-w-0">
                <dt className="text-[11px] text-textMuted truncate">Contracts</dt>
                <dd className="mt-0.5 inline-flex items-center gap-1 font-mono text-[12px] tnum leading-snug text-textPrimary">
                  <button type="button" onClick={() => setWatchedSize(row.w.id, row.w.size - 1)} disabled={row.w.size <= 1 || !open} className="hit inline-flex items-center justify-center w-5 h-5 rounded border border-borderSubtle text-textMuted hover:text-textPrimary disabled:opacity-30 transition-colors" aria-label="One contract fewer" data-watch-size="less">
                    <Minus className="w-2.5 h-2.5" />
                  </button>
                  <span data-watch-size-value>{row.w.size}</span>
                  <button type="button" onClick={() => setWatchedSize(row.w.id, row.w.size + 1)} disabled={!open} className="hit inline-flex items-center justify-center w-5 h-5 rounded border border-borderSubtle text-textMuted hover:text-textPrimary disabled:opacity-30 transition-colors" aria-label="One contract more" data-watch-size="more">
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                  <span className="ml-1 text-[11px] text-textMuted">
                    · added <When days={daysSince(row.w.addedAt)} size={10} />
                  </span>
                </dd>
              </div>
            </>
          ) : (
            <>
              <Fact5 k="Market value" v={`$${(row.value * per).toFixed(2)} · ${row.value.toFixed(2)} × ${per}`} />
              {/* the cost the return reads from: typed, else the mark when it was added (2026-09-16) */}
              <Fact5 k={curve.refKind === 'added' ? 'Marked when added' : pos.side === 'long' ? 'What you paid' : 'What you collected'} v={curve.refKind !== 'now' ? `$${curve.ref.toFixed(2)} · 1R` : 'no cost given'} tone={curve.refKind !== 'now' ? undefined : 'text-textMuted'} />
              <Fact5 k="Total return" v={row.total != null && row.totalR != null ? `${usdSigned(row.total)} · ${rSigned(row.totalR)}` : '—'} tone={row.total != null ? dirInk(row.total) : 'text-textMuted'} />
              <Fact5 k="Contracts" v={`${pos.contracts} · ${pos.side === 'long' ? 'you own' : 'you sold'}`} />
              <Fact5 k="Added" v={<When days={daysSince(pos.addedAt)} size={11} />} />
            </>
          )}
        </dl>

        {/* THE MAP'S READ — the Positions panel's five facts, against today's book */}
        <dl className="grid grid-cols-5 gap-x-4 gap-y-1 border-t border-borderSubtle/50 pt-3" data-position-facts="map">
          <Fact5 k="Where it sits" v={read.sits} />
          <Fact5 k="Breakeven at expiry" v={fmtStrike(Math.round(curve.breakeven * 100) / 100)} />
          <Fact5 k={curve.refKind === 'now' ? 'If it expired here, vs today' : 'If it expired here'} v={fmtPnl(curve.atSpot)} tone={curve.atSpot > 0 ? 'text-bull' : curve.atSpot < 0 ? 'text-bear' : undefined} />
          <Fact5 k="Dealer gamma at your strike" v={read.gammaHere === 0 ? 'outside the window' : `${fmtUsd(read.gammaHere)}${read.through ? ` · ${read.through === 'slows it' ? 'slows a move' : 'speeds a move up'}` : ''}`} />
          <Fact5 k="Expires" v={`${monthDay(pos.expiry)} · ${read.expires}`} />
        </dl>

        <p className="text-[12px] leading-relaxed text-textSecondary" data-position-sentence>
          {subjectWords(pos)} sit{pos.contracts === 1 ? 's' : ''} {read.sits}. {read.hedging[0].toUpperCase()}
          {read.hedging.slice(1)}.
        </p>
      </div>

      {/* THE FOOT, pinned: where the contract stands with the reader, then the doors */}
      <div key={`ft-${row.id}`} className="shrink-0 px-3.5 py-2 border-t border-borderSubtle/60 flex items-center gap-2 flex-wrap animate-soft-in" data-contract-foot>
        <span className="font-mono text-[11px] text-textPrimary">
          {row.kind === 'watch' ? 'On your watchlist' : pos.side === 'long' ? 'A position you own' : 'A position you sold'}{' '}
          <span className="text-textMuted">
            · since {monthDay(isoDate(new Date(pos.addedAt)))}
            {row.kind === 'watch' && !open ? (row.w.status === 'closed' ? ' · closed' : ' · settled at the bell') : row.kind === 'own' && !open ? ` · expired ${monthDay(pos.expiry)}` : ''}
          </span>
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {row.kind === 'watch' ? (
            <>
              <span className={`${DOOR_CLS} text-textPrimary border-borderMuted`} title="On your watchlist" data-watch-door="watching">
                <Eye className="w-3 h-3" />
                Watching
              </span>
              {open && onClose && (
                <button onClick={onClose} className={DOOR_CLS} title="Close it at the mark now — the return locks" data-watch-close>
                  <X className="w-3 h-3" />
                  Close
                </button>
              )}
              {!open && onRemove && (
                <button onClick={onRemove} className={`${DOOR_CLS} text-bear/80 hover:text-bear`} title="Take it off the record" data-watch-remove>
                  <Trash2 className="w-3 h-3" />
                  Remove
                </button>
              )}
            </>
          ) : (
            <>
              <PositionForm
                ticker={pos.ticker}
                position={pos}
                defaultStrike={pos.strike}
                align="end"
                trigger={
                  <button className={DOOR_CLS} title="Change this position" data-position-change>
                    <Pencil className="w-3 h-3" />
                    Change
                  </button>
                }
              />
              {onRemovePosition && (
                <button onClick={onRemovePosition} className={`${DOOR_CLS} text-bear/80 hover:text-bear`} title="Remove this position" data-position-remove>
                  <Trash2 className="w-3 h-3" />
                  Remove
                </button>
              )}
            </>
          )}
        </span>
      </div>
    </div>
  );
};

export default PositionDeskCard;
