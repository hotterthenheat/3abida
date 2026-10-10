/*
==================================================
  SLAYER TERMINAL - WHERE IT CLOSES
  (components/gex/CloseOdds.tsx)

  Band 2 of the Ahead page. REDRAWN AS ROWS
  (2026-09-13 evening; the partner's design — Noah:
  "his 'where it closes' card is more aesthetically
  pleasing… although it doesn't make sense why the
  supreme and the #1 wear the same color. other than
  that use his design pattern"):

    THE ROWS     one row per strike, the highest
                 first: the strike, its role beside
                 it as a small tag in the role's ink
                 (call wall · put wall · supreme ·
                 pin) and YOURS when you hold
                 contracts there; a bar as long as
                 the chance the 4:00 print lands
                 there; the odds at the right. The
                 three likeliest are numbered on
                 their bars. The 50% run is washed
                 silver and the 80% run fainter. The
                 expected move alone is a thin tick
                 on every bar. Spot is the house's
                 spot rule between the strikes. A
                 kept strike wears the silver edge.
    THE INKS     ONE FACT ONE INK — the bar's ink
                 says the RANK alone (the likeliest
                 silver, #2 and #3 silver at half,
                 the rest the quiet ink); the role
                 lives only in its tag. His supreme
                 row and his #1 row were both magenta
                 and a reader could not tell the
                 heaviest strike from the likeliest
                 close.
    THE SLICES   thinkorswim's Probability Analysis
                 kept as one read under the rows —
                 above the call wall · between the
                 walls · below the put wall · above
                 the flip, and the chance price
                 touches a wall before the close.
    THE READS    most likely · the bands · the pull ·
                 the slices, the figures lit.

  Hover a row and the read line speaks it; click
  keeps it as the shared strike.
==================================================
*/

import { Fragment, useMemo, useState, type ReactNode } from 'react';
import GuideFocus, { GuideDoor } from '../ui/GuideFocus';
import SpotRule from '../ui/SpotRule';
import { CloseGuide } from './AheadGuide';
import { CALL_WALL, PUT_WALL, SUPREME } from './paletteInk';
import { fmtStrike, type AheadClock, type CloseOdd, type CloseOdds as CloseOddsData } from '../../data/ahead';
import type { ExposureLevels } from '../../types/gex';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
/** The unranked bars' ink — the page's own ink, faint */
const QUIET = 'rgb(var(--ink))';
const PIN_INK = 'rgb(var(--text-secondary))';
const ROLE_INK: Record<string, string> = { 'call wall': CALL_WALL, 'put wall': PUT_WALL, supreme: SUPREME, pin: PIN_INK };
const COLS = 'grid-cols-[118px_minmax(0,1fr)_64px]';

/** A read with every figure lit — the strikes and the odds in the primary ink, the words around them quiet */
const lit = (text: string): ReactNode[] =>
  text.split(/(\d[\d.,]*%?)/).map((part, i) =>
    /^\d[\d.,]*%?$/.test(part) ? (
      <span key={i} className="font-mono tnum text-textPrimary">
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );

const untilWords = (clock: AheadClock) => {
  if (!clock.inSession) return 'a full session';
  const h = Math.floor(clock.minutesLeft / 60);
  const m = clock.minutesLeft % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};
/** The standard normal's cumulative — Abramowitz & Stegun 7.1.26, good to 1.5e-7 */
const Phi = (z: number): number => {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + (z < 0 ? -erf : erf));
};
const pct = (v: number) => `${v.toFixed(v >= 10 ? 0 : 1)}%`;

interface Props {
  odds: CloseOddsData;
  spot: number;
  ticker: string;
  clock: AheadClock;
  /** The day's levels — for the slices. Omitted, the rows' own roles name the walls. */
  levels?: ExposureLevels;
  /** Strikes you hold contracts on — tagged on their rows */
  yours?: Set<number>;
  focus?: number | null;
  onPick?: (price: number) => void;
  scope?: ReactNode;
  /** On a desk tile the tile head names the box — only the door and the facts stay (2026-09-08) */
  headless?: boolean;
}

const CloseOdds = ({ odds, spot, ticker, clock, levels, yours, focus, onPick, scope, headless = false }: Props) => {
  const [guideOpen, setGuideOpen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const { rows, top, gravity, half, most, sigma } = odds;
  const pullWords = gravity < 0.5 ? 'light' : gravity < 0.75 ? 'building' : 'strong';
  const desc = useMemo(() => [...rows].sort((a, b) => b.strike - a.strike), [rows]);
  const maxOdds = Math.max(1, ...rows.map(r => r.odds));
  const rank = new Map(top.map((t, i) => [t.strike, i + 1]));
  const lead = top[0] as CloseOdd | undefined;
  const inHalf = (k: number) => half.strikes > 0 && k >= half.low && k <= half.high;
  const inMost = (k: number) => most.strikes > 0 && k >= most.low && k <= most.high;
  const hoverRow = hover != null ? rows.find(r => Math.abs(r.strike - hover) < 1e-9) ?? null : null;
  const keptRow = focus != null ? rows.find(r => Math.abs(r.strike - focus) < 1e-9) ?? null : null;

  /* THE SLICES — the levels' sides summed off the rows; the touch on the plain expected move (the reflection rule) */
  const callWall = levels?.callWall ?? rows.find(r => r.role === 'call wall')?.strike ?? null;
  const putWall = levels?.putWall ?? rows.find(r => r.role === 'put wall')?.strike ?? null;
  const flip = levels?.flip ?? null;
  const sumWhere = (pred: (r: CloseOdd) => boolean) => rows.filter(pred).reduce((a, r) => a + r.odds, 0);
  const touch = (level: number): number => Math.min(100, 200 * (1 - Phi(Math.abs(level - spot) / Math.max(sigma, 1e-6))));
  const slices = (() => {
    const parts: string[] = [];
    if (callWall != null) parts.push(`above the call wall ${fmtStrike(callWall)} ${pct(sumWhere(r => r.strike > callWall))}`);
    if (callWall != null && putWall != null) parts.push(`between the walls ${pct(sumWhere(r => r.strike >= putWall && r.strike <= callWall))}`);
    if (putWall != null) parts.push(`below the put wall ${fmtStrike(putWall)} ${pct(sumWhere(r => r.strike < putWall))}`);
    if (flip != null) parts.push(`above the flip ${fmtStrike(flip)} ${pct(sumWhere(r => r.strike > flip))}`);
    const touches: string[] = [];
    if (callWall != null && callWall > spot) touches.push(`the call wall ${pct(touch(callWall))}`);
    if (putWall != null && putWall < spot) touches.push(`the put wall ${pct(touch(putWall))}`);
    if (keptRow && Math.abs(keptRow.strike - spot) > 1e-9 && ![callWall, putWall].some(k => k != null && Math.abs(k - keptRow.strike) < 1e-9)) touches.push(`${fmtStrike(keptRow.strike)} ${pct(touch(keptRow.strike))}`);
    if (touches.length) parts.push(`price touches ${touches.join(', ')} before the close`);
    return parts.join(' · ');
  })();

  const readRow = hoverRow ?? keptRow ?? lead ?? null;
  const readLine = readRow
    ? `${fmtStrike(readRow.strike)} · a ${pct(readRow.odds)} chance the close lands here · the expected move alone says ${pct(readRow.plain)} · the strikes ${readRow.pull > 1.02 ? 'pull the close toward it' : readRow.pull < 0.98 ? 'push the close off it' : 'leave it alone'}${readRow.role ? ` · ${readRow.role}` : ''}${yours?.has(readRow.strike) ? ' · you own contracts here' : ''}${hoverRow ? (focus === readRow.strike ? ' · kept, click to let go' : ' · click to keep') : keptRow ? ' · kept' : ' · the most likely'}`
    : 'no strikes near enough to spot to say';
  let spotDrawn = false;

  return (
    <section className="relative flex flex-col min-w-0" data-close-band>
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the odds" testId="close-guide" viewport>
        <CloseGuide odds={odds} spot={spot} clock={clock} />
      </GuideFocus>
      <div className={`${headless ? 'px-4 pt-3 pb-1' : 'px-5 pt-4 pb-2'} flex items-start gap-6 flex-wrap`}>
        {headless ? (
          <div className="shrink-0 h-[35px] flex items-center">
            <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the rows, the runs and the slices mean" testId="close-guide" />
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-[15px] font-semibold leading-tight text-textPrimary">Where it closes</h2>
              {scope}
              <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the rows, the runs and the slices mean" testId="close-guide" />
            </div>
            <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">One row per strike · the bar is the chance the 4:00 print lands there · the three likeliest numbered · the 50% and 80% runs shaded</p>
          </div>
        )}
        <dl className={`grid grid-cols-4 gap-x-6 ${headless ? 'ml-auto' : ''}`}>
          <div>
            <dt className="text-[11px] text-textMuted">Most likely</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum whitespace-nowrap" style={{ color: SILVER }} data-close-top>
              {lead ? `${fmtStrike(lead.strike)} · ${pct(lead.odds)}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-textMuted">50% chance</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-close-half>
              {half.strikes ? `${fmtStrike(half.low)} – ${fmtStrike(half.high)}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-textMuted">80% chance</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-close-most>
              {most.strikes ? `${fmtStrike(most.low)} – ${fmtStrike(most.high)}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-textMuted">The strikes' pull</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-close-pull>
              {pullWords} <span className="text-textMuted">· {Math.round(gravity * 100)}% · {untilWords(clock)} left</span>
            </dd>
          </div>
        </dl>
      </div>

      {/* THE ROWS */}
      <div className={`${headless ? 'px-4' : 'px-5'} pt-1 pb-2`} onPointerLeave={() => setHover(null)} data-close-rows={rows.length}>
        <div className={`grid ${COLS} items-center gap-x-3 h-[16px] font-mono text-[11px] text-textSecondary`}>
          <span>Strike</span>
          <span>Chance the close lands here</span>
          <span className="text-right">Odds</span>
        </div>
        {desc.map(r => {
          const kept = keptRow != null && Math.abs(keptRow.strike - r.strike) < 1e-9;
          const n = rank.get(r.strike);
          const wash = inHalf(r.strike) ? 'bg-silver/[0.08]' : inMost(r.strike) ? 'bg-silver/[0.035]' : '';
          /* the bar's ink is the rank's alone */
          const barInk = n ? SILVER : QUIET;
          const barAlpha = n === 1 ? 1 : n ? 0.5 : 0.22;
          const drawSpot = !spotDrawn && r.strike < spot;
          if (drawSpot) spotDrawn = true;
          return (
            <Fragment key={r.strike}>
              {drawSpot && (
                <div className="h-[18px] flex items-center px-1" data-close-spot>
                  <SpotRule ticker={ticker} price={spot} />
                </div>
              )}
              <button
                type="button"
                onClick={() => onPick?.(r.strike)}
                onPointerEnter={() => setHover(r.strike)}
                className={`w-full grid ${COLS} items-center gap-x-3 h-[24px] rounded px-1 text-left transition-colors hover:bg-ink/[0.05] ${wash}`}
                style={kept ? { boxShadow: `inset 2px 0 0 0 ${SILVER}` } : undefined}
                title={`${fmtStrike(r.strike)} · ${pct(r.odds)} · the expected move alone says ${pct(r.plain)}${r.role ? ` · ${r.role}` : ''}`}
                /* one name, said in words (PP-29: "4831.2%", "479#215%") */
                aria-label={`${fmtStrike(r.strike)}${r.role ? `, the ${r.role}` : ''}${n ? `, number ${n}` : ''} — ${pct(r.odds)} chance the close lands here`}
                aria-pressed={kept}
                data-close-row={r.strike}
                data-close-rank={n}
                data-close-kept={kept || undefined}
                data-close-run={inHalf(r.strike) ? 'half' : inMost(r.strike) ? 'most' : undefined}
              >
                <span className="flex items-center gap-1.5 min-w-0 font-mono text-[11px] tnum whitespace-nowrap">
                  <span className={`font-semibold ${kept ? 'text-silver' : 'text-textPrimary'}`}>{fmtStrike(r.strike)}</span>
                  {r.role && (
                    <span className="text-[11px] font-bold" style={{ color: ROLE_INK[r.role] }} data-close-role={r.role}>
                      {r.role}
                    </span>
                  )}
                  {yours?.has(r.strike) && (
                    <span className="text-[11px] font-bold text-warn" data-yours>
                      yours
                    </span>
                  )}
                </span>
                <span className="relative h-[12px]">
                  {/* the bar and its tick glide to their new lengths on a tick (Noah, 2026-09-13: "smooth, not a quick instant change") */}
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(1, (r.odds / maxOdds) * 100)}%`, background: barInk, opacity: barAlpha, transition: 'width 520ms cubic-bezier(0.16, 1, 0.3, 1), background-color 520ms cubic-bezier(0.16, 1, 0.3, 1), opacity 520ms cubic-bezier(0.16, 1, 0.3, 1)' }} data-close-bar={r.strike} />
                  {/* the expected move alone — a tick */}
                  <span className="absolute top-[-2px] bottom-[-2px] w-px bg-textPrimary/50" style={{ left: `${Math.min(100, (r.plain / maxOdds) * 100)}%`, transition: 'left 520ms cubic-bezier(0.16, 1, 0.3, 1)' }} aria-hidden />
                  {/* THE RANK IS THE BAR'S OWN HEAD (Noah, 2026-09-19, of #2 and #3: "can you see it?"): flush with the bar's end, the bar's
                      height, the bar's round end. It was a square-cornered box 4px in and half a pixel taller than the bar — hidden on #1,
                      whose bar is the same silver, but on the half-strength bars of #2 and #3 the bar's end showed beside it and the box
                      stood proud of it (measured: left 4, top −0.5, 13px on a 12px bar). */}
                  {n && (
                    <span className="absolute inset-y-0 left-0 pl-[7px] pr-1.5 inline-flex items-center rounded-full font-mono text-[11px] font-bold leading-none text-panel" style={{ background: SILVER }} data-close-rank-tag={n}>
                      #{n}
                    </span>
                  )}
                </span>
                <span className={`text-right font-mono text-[12px] font-semibold tnum ${n ? 'text-textPrimary' : 'text-textPrimary/80'}`}>{pct(r.odds)}</span>
              </button>
            </Fragment>
          );
        })}
        <div className="mt-2 flex items-center gap-4 font-mono text-[11px] text-textSecondary" data-close-key>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-[6px] rounded-full bg-silver/[0.25]" /> the 50% run
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-[6px] rounded-full bg-silver/[0.10]" /> the 80% run
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-px h-3 bg-textPrimary/50" /> the expected move alone
          </span>
        </div>
      </div>
      {/* ONE FIXED READ LINE */}
      <div className={`${headless ? 'px-4' : 'px-5'} h-[18px] font-mono text-[11px] text-textSecondary truncate`} data-close-read>
        {readLine}
      </div>
      {/* THE READS — one line each, the figures lit */}
      {odds.reads ? (
        <dl className={`${headless ? 'px-4' : 'px-5'} pb-4 pt-2 grid gap-x-4 gap-y-1.5 text-[12px] leading-[17px] text-textSecondary`} style={{ gridTemplateColumns: '84px minmax(0, 1fr)' }} data-close-reads>
          {(
            [
              ['Most likely', odds.reads.likely, 'likely'],
              ['The bands', odds.reads.bands, 'bands'],
              ['The pull', odds.reads.pull, 'pull'],
              ...(slices ? ([['The slices', slices, 'slices']] as const) : []),
            ] as const
          ).map(([label, words, key]) => (
            <Fragment key={key}>
              <dt className="text-[11px] text-textMuted leading-[17px] whitespace-nowrap">{label}</dt>
              <dd className="min-w-0" data-close-read-line={key}>
                {lit(words)}
              </dd>
            </Fragment>
          ))}
        </dl>
      ) : (
        <p className={`${headless ? 'px-4' : 'px-5'} pb-4 pt-2 text-[12px] leading-relaxed text-textSecondary`}>{odds.sentence}</p>
      )}
    </section>
  );
};

export default CloseOdds;
