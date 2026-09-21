/*
==================================================
  SLAYER TERMINAL - AHEAD, DRAWN SIMPLE
  (components/gex/AheadSimple.tsx)

  The Ahead page's two boxes redrawn (Noah,
  2026-09-13: "I love the idea of this page but
  both the charts are truly unreadable, please
  redesign the ui and make it so simple to read").
  The cone and the stepped silhouette are gone.
  In their place:

    THE RANGE        one horizontal ruler — the
                     floor and the lid as the ends,
                     the likely range as the bright
                     band, spot as the pill on it,
                     the walls, the flip and the
                     supreme as marked posts with
                     their names and prices, the
                     expected move as a bracket
                     under it; then WHAT DEALERS
                     MUST TRADE as plain bars, one
                     per half hour, up for buying
                     and down for selling, the
                     figure on every bar that
                     matters and the hour under it
    WHERE IT CLOSES  one row per strike, a bar as
                     long as the chance the close
                     lands there and the percent
                     beside it, the three likeliest
                     numbered, the 50% and 80% runs
                     shaded, spot as the rule

  The numbers are the same models (data/ahead.ts);
  only the drawing changed. Nothing here re-measures
  per tick.
==================================================
*/

import { useMemo, useState, type ReactNode } from 'react';
import DropdownSelect from '../ui/DropdownSelect';
import GuideFocus, { GuideDoor } from '../ui/GuideFocus';
import SpotRule from '../ui/SpotRule';
import { CloseGuide, CorridorGuide } from './AheadGuide';
import { CALL_WALL, FLIP, PUT_WALL, SUPREME } from './paletteInk';
import { VOL_OPTIONS, fmtDollars, fmtPrice, fmtStrike, hhmm, volWords, type AheadClock, type CloseOdds as CloseOddsData, type Corridor, type Schedule, type VolPoints } from '../../data/ahead';
import type { ExposureLevels } from '../../types/gex';

const GREEN = 'rgb(var(--bull))';
const RED = 'rgb(var(--bear))';
const SILVER = 'rgb(var(--silver))';
const PIN_INK = '#C7D3E8';

const Fact = ({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) => (
  <div className="min-w-0" data-fact={testId}>
    <div className="text-[10px] text-textSecondary whitespace-nowrap">{label}</div>
    <div className="mt-0.5 font-mono text-[13px] tnum text-textPrimary whitespace-nowrap">{children}</div>
  </div>
);

/* ---- the range -------------------------------------------------------------------- */

interface RangeProps {
  corridor: Corridor;
  schedule: Schedule;
  levels: ExposureLevels;
  ticker: string;
  clock: AheadClock;
  focus?: number | null;
  onPick?: (price: number) => void;
  scope?: ReactNode;
  volPoints: VolPoints;
  onVolPoints: (p: VolPoints) => void;
}

interface Post {
  price: number;
  names: string[];
  ink: string;
}

export const RangeSimple = ({ corridor, schedule, levels, ticker, clock, focus, onPick, scope, volPoints, onVolPoints }: RangeProps) => {
  const [guideOpen, setGuideOpen] = useState(false);
  const { spot, sigma, sigmaDay, likely, outer, flip, fastSide } = corridor;
  const { blocks, toClose, biggest, bellShare, vol } = schedule;
  const move = clock.inSession ? sigma : sigmaDay;
  const moveWords = clock.inSession ? 'to the close' : 'in a day';

  /* THE DOMAIN — the outer band, and any level that sits within reach of it */
  const { lo, hi } = useMemo(() => {
    let lo = Math.min(outer.low, likely.low.price);
    let hi = Math.max(outer.high, likely.high.price);
    for (const k of [levels.callWall, levels.putWall, levels.flip, levels.supreme, levels.pin]) {
      if (k >= outer.low - sigmaDay && k <= outer.high + sigmaDay) {
        lo = Math.min(lo, k);
        hi = Math.max(hi, k);
      }
    }
    const pad = Math.max((hi - lo) * 0.06, 0.01);
    return { lo: lo - pad, hi: hi + pad };
  }, [outer, likely, levels, sigmaDay]);
  const x = (p: number) => `${(((p - lo) / (hi - lo || 1)) * 100).toFixed(2)}%`;

  /* THE POSTS — one per price; levels on the same strike share a post */
  const posts = useMemo(() => {
    const raw: { price: number; name: string; ink: string }[] = [
      { price: levels.callWall, name: 'Call wall', ink: CALL_WALL },
      { price: levels.putWall, name: 'Put wall', ink: PUT_WALL },
      { price: levels.flip, name: 'Flip', ink: FLIP },
      { price: levels.supreme, name: 'Supreme', ink: SUPREME },
      { price: levels.pin, name: 'Pin', ink: PIN_INK },
    ];
    const out: Post[] = [];
    for (const r of raw) {
      if (r.price <= lo || r.price >= hi) continue;
      const hit = out.find(p => Math.abs(p.price - r.price) < 1e-9);
      if (hit) hit.names.push(r.name);
      else out.push({ price: r.price, names: [r.name], ink: r.ink });
    }
    return out.sort((a, b) => a.price - b.price);
  }, [levels, lo, hi]);

  const maxFlow = Math.max(1, ...blocks.map(b => Math.abs(b.flow)));
  const buying = toClose >= 0;

  return (
    <section className="relative flex flex-col min-w-0" data-range-box>
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the range" testId="corridor-guide" viewport>
        <CorridorGuide corridor={corridor} schedule={schedule} levels={levels} clock={clock} />
      </GuideFocus>
      {/* THE HEAD */}
      <div className="px-5 pt-4 pb-2 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">The range</h3>
            {scope}
            <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the ruler, the posts and the bars mean" testId="corridor-guide" />
          </div>
          <p className="mt-0.5 text-[11px] text-textSecondary">{clock.inSession ? 'From now to the close' : 'The next session'} · where price stays, and what the clock and a vol move make dealers buy or sell</p>
        </div>
        <div className="flex flex-wrap items-start gap-x-6 gap-y-1" data-range-facts>
          <Fact label="Likely range" testId="likely">
            {fmtPrice(likely.low.price)} – {fmtPrice(likely.high.price)}
          </Fact>
          <Fact label="Top edge" testId="top">
            <span style={{ color: likely.high.why === 'the call wall' ? CALL_WALL : undefined }}>{fmtPrice(likely.high.price)}</span> <span className="text-textSecondary">· {likely.high.why}</span>
          </Fact>
          <Fact label="Floor" testId="floor">
            <span style={{ color: likely.low.why === 'the put wall' ? PUT_WALL : undefined }}>{fmtPrice(likely.low.price)}</span> <span className="text-textSecondary">· {likely.low.why}</span>
          </Fact>
          <Fact label="Expected move" testId="move">
            ±{move.toFixed(2)} <span className="text-textSecondary">· {((move / spot) * 100).toFixed(2)}% {moveWords}</span>
          </Fact>
        </div>
      </div>

      {/* THE RULER */}
      <div className="px-5 pt-2" data-range-ruler>
        <div className="relative h-[150px] mx-8" data-theme="dark">
          {/* the fast side — where dealers amplify, a faint warm wash from the flip out */}
          {flip != null && fastSide && flip > lo && flip < hi && (
            <span className="absolute top-[62px] h-[14px] rounded" style={fastSide === 'above' ? { left: x(flip), right: 0, background: 'rgba(240,78,78,0.10)' } : { left: 0, right: `calc(100% - ${x(flip)})`, background: 'rgba(240,78,78,0.10)' }} />
          )}
          {/* the whole track — the outer band, two expected moves */}
          <span className="absolute left-0 right-0 top-[64px] h-[10px] rounded-full bg-ink/[0.08]" />
          {/* the likely range — the bright band */}
          <span className="absolute top-[62px] h-[14px] rounded-full border" style={{ left: x(likely.low.price), width: `calc(${x(likely.high.price)} - ${x(likely.low.price)})`, background: 'rgba(199,211,232,0.28)', borderColor: 'rgba(199,211,232,0.6)' }} data-range-band />
          {/* the ends of the track, priced */}
          <span className="absolute left-0 top-[84px] font-mono text-[10px] tnum text-textSecondary -translate-x-1/2">{fmtPrice(lo)}</span>
          <span className="absolute right-0 top-[84px] font-mono text-[10px] tnum text-textSecondary translate-x-1/2">{fmtPrice(hi)}</span>
          {/* the posts — the walls, the flip, the supreme, the pin */}
          {posts.map((p, i) => (
            <button
              key={p.price}
              type="button"
              onClick={() => onPick?.(p.price)}
              className="absolute -translate-x-1/2 group"
              style={{ left: x(p.price), top: 0, height: 150 }}
              title={`${p.names.join(' · ')} ${fmtStrike(p.price)} — click to make it the strike`}
              data-range-post={p.price}
            >
              <span className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] font-semibold uppercase tracking-wider ${i % 2 === 0 ? 'top-[6px]' : 'top-[22px]'}`} style={{ color: p.ink }}>
                {p.names.join(' · ')}
              </span>
              <span className="absolute left-1/2 -translate-x-1/2 top-[40px] w-[2px] h-[50px] rounded" style={{ background: p.ink, opacity: focus != null && Math.abs(focus - p.price) < 1e-9 ? 1 : 0.85 }} />
              <span className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] font-semibold tnum ${i % 2 === 0 ? 'top-[96px]' : 'top-[112px]'}`} style={{ color: p.ink }}>
                {fmtStrike(p.price)}
              </span>
            </button>
          ))}
          {/* spot — the pill on the track */}
          <span className="absolute -translate-x-1/2 top-[56px] z-10 inline-flex items-center h-[26px] px-2.5 rounded-md font-mono text-[12px] font-bold tnum bg-[#ededed] text-[#0a0a0a] shadow-[0_0_0_2px_rgba(10,10,10,0.9)]" style={{ left: x(spot) }} data-range-spot>
            {fmtPrice(spot)}
          </span>
          {/* the expected move — a bracket under the track */}
          <span className="absolute top-[130px] h-[8px] border-l border-r border-b border-silver/60" style={{ left: x(spot - move), width: `calc(${x(spot + move)} - ${x(spot - move)})` }} aria-hidden />
          <span className="absolute -translate-x-1/2 top-[139px] whitespace-nowrap font-mono text-[9px] uppercase tracking-wider text-textSecondary" style={{ left: x(spot) }}>
            one expected move each side · ±{move.toFixed(2)}
          </span>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-textPrimary" data-range-sentence>
          {corridor.sentence}
        </p>
      </div>

      {/* WHAT DEALERS MUST TRADE — plain bars, one per half hour */}
      <div className="px-5 pt-4" data-range-flow>
        <div className="flex items-center gap-x-5 gap-y-1 flex-wrap font-mono text-[10px] tnum">
          <span className="uppercase tracking-widest text-textSecondary">What dealers must trade · half hour by half hour</span>
          <span className="text-textSecondary">
            over the session <span className="font-semibold" style={{ color: buying ? GREEN : RED }}>{buying ? 'buy' : 'sell'} {fmtDollars(Math.abs(toClose))}</span>
          </span>
          {biggest && (
            <span className="text-textSecondary">
              biggest <span className="text-textPrimary">{hhmm(biggest.from)}–{hhmm(biggest.to)} · {fmtDollars(Math.abs(biggest.flow))}</span>
            </span>
          )}
          {bellShare != null && (
            <span className="text-textSecondary">
              expires at 4:00 <span style={{ color: SUPREME }}>{bellShare.toFixed(0)}%</span>
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-2">
            <DropdownSelect label="If vol" value={volPoints} options={VOL_OPTIONS} onChange={onVolPoints} title="A vol move as a scenario — what vanna makes dealers do" testId="vol" align="end" />
          </span>
        </div>
        <div className="mt-2 relative h-[210px] rounded-md bg-panel border border-borderSubtle/60" data-theme="dark" data-flow-bars>
          {/* the zero line */}
          <span className="absolute left-0 right-0 top-1/2 h-px bg-ink/25" />
          <span className="absolute left-2 top-[6px] font-mono text-[9px] uppercase tracking-wider" style={{ color: GREEN }}>
            buying
          </span>
          <span className="absolute left-2 bottom-[34px] font-mono text-[9px] uppercase tracking-wider" style={{ color: RED }}>
            selling
          </span>
          <div className="absolute inset-x-12 top-3 bottom-8 flex items-stretch gap-[6px]">
            {blocks.map(b => {
              /* the tallest bar takes 38% of the pane, so its figure always has room before the hour under it */
              const h = (Math.abs(b.flow) / maxFlow) * 38;
              const up = b.flow >= 0;
              const ink = up ? GREEN : RED;
              const big = biggest != null && b.from === biggest.from;
              const show = Math.abs(b.flow) >= maxFlow * 0.12 || big;
              return (
                <div key={b.from} className="relative flex-1 min-w-0" title={`${hhmm(b.from)}–${hhmm(b.to)} · ${b.phase} · ${b.past ? 'passed' : b.flow >= 0 ? `dealers buy ${fmtDollars(b.flow)}` : `dealers sell ${fmtDollars(-b.flow)}`}`} data-flow-block={b.from} data-past={b.past || undefined} data-current={b.current || undefined}>
                  {/* the bar, from the middle line up or down */}
                  <span
                    className="absolute left-[15%] right-[15%] rounded-[3px]"
                    style={{ [up ? 'bottom' : 'top']: '50%', height: `${Math.max(b.past ? 0 : 1.5, h)}%`, background: ink, opacity: b.past ? 0.25 : big ? 1 : 0.8, outline: b.current ? `1px solid ${SILVER}` : undefined, outlineOffset: 2 }}
                  />
                  {show && !b.past && (
                    <span className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] font-semibold tnum ${up ? '' : ''}`} style={{ [up ? 'bottom' : 'top']: `calc(50% + ${h}% + 4px)`, color: ink }}>
                      {fmtDollars(Math.abs(b.flow))}
                    </span>
                  )}
                  {b.past && (
                    <span className="absolute left-1/2 -translate-x-1/2 top-[calc(50%-14px)] font-mono text-[8px] uppercase tracking-wider text-textMuted">done</span>
                  )}
                  <span className="absolute left-1/2 -translate-x-1/2 -bottom-[18px] font-mono text-[9px] tnum text-textSecondary">{hhmm(b.from)}</span>
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-textPrimary" data-flow-sentence>
          {schedule.sentence}
        </p>
        {vol && (
          <p className="mt-1 text-[12px] leading-relaxed text-textPrimary" data-vol-sentence>
            <span className="font-mono text-[10px] uppercase tracking-widest text-textSecondary mr-2">If vol {volWords(vol.points)} · vanna</span>
            <span className="font-semibold" style={{ color: vol.flow >= 0 ? GREEN : RED }}>
              {vol.flow >= 0 ? 'buy' : 'sell'} {fmtDollars(Math.abs(vol.flow))}
            </span>{' '}
            {vol.sentence.replace(/^[^.]*?(dealers must|dealers)/i, 'dealers')}
          </p>
        )}
      </div>
      <div className="h-4" />
      <span className="sr-only" data-range-ticker={ticker} />
    </section>
  );
};

/* ---- where it closes ---------------------------------------------------------------- */

interface CloseProps {
  odds: CloseOddsData;
  spot: number;
  ticker: string;
  clock: AheadClock;
  levels?: ExposureLevels;
  yours?: Set<number>;
  focus?: number | null;
  onPick?: (price: number) => void;
  scope?: ReactNode;
}

const ROLE_INK: Record<string, string> = { 'call wall': CALL_WALL, 'put wall': PUT_WALL, supreme: SUPREME, pin: PIN_INK };

export const CloseSimple = ({ odds, spot, ticker, clock, yours, focus, onPick, scope }: CloseProps) => {
  const [guideOpen, setGuideOpen] = useState(false);
  const { rows, top, gravity, half, most, reads } = odds;
  const pullWords = gravity < 0.5 ? 'light' : gravity < 0.75 ? 'building' : 'strong';
  const desc = useMemo(() => [...rows].sort((a, b) => b.strike - a.strike), [rows]);
  const maxOdds = Math.max(1, ...rows.map(r => r.odds));
  const rank = new Map(top.map((t, i) => [t.strike, i + 1]));
  const inHalf = (k: number) => half.strikes > 0 && k >= half.low && k <= half.high;
  const inMost = (k: number) => most.strikes > 0 && k >= most.low && k <= most.high;
  const lead = top[0];
  let spotDrawn = false;

  return (
    <section className="relative flex flex-col min-w-0" data-close-box>
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the odds" testId="close-guide" viewport>
        <CloseGuide odds={odds} spot={spot} clock={clock} />
      </GuideFocus>
      <div className="px-5 pt-4 pb-2 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">Where it closes</h3>
            {scope}
            <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the bars and the bands mean" testId="close-guide" />
          </div>
          <p className="mt-0.5 text-[11px] text-textSecondary">One row per strike · the bar is the chance the 4:00 print lands there · the three likeliest numbered · the 50% and 80% runs shaded</p>
        </div>
        <div className="flex flex-wrap items-start gap-x-6 gap-y-1" data-close-facts>
          <Fact label="Most likely" testId="most-likely">
            {lead ? (
              <>
                {fmtStrike(lead.strike)} <span className="text-textSecondary">· {lead.odds.toFixed(lead.odds >= 10 ? 0 : 1)}%</span>
              </>
            ) : (
              '—'
            )}
          </Fact>
          <Fact label="50% chance" testId="half">
            {half.strikes ? `${fmtStrike(half.low)} – ${fmtStrike(half.high)}` : '—'}
          </Fact>
          <Fact label="80% chance" testId="most">
            {most.strikes ? `${fmtStrike(most.low)} – ${fmtStrike(most.high)}` : '—'}
          </Fact>
          <Fact label="The strikes' pull" testId="pull">
            <span style={{ color: SILVER }}>{pullWords}</span> <span className="text-textSecondary">· {Math.round(gravity * 100)}%{clock.inSession ? ` · ${clock.label}` : ' · a full session left'}</span>
          </Fact>
        </div>
      </div>

      {/* THE ROWS */}
      <div className="px-5 pt-1 pb-2" data-close-rows>
        <div className="grid grid-cols-[96px_minmax(0,1fr)_64px] items-center gap-x-3 h-[16px] font-mono text-[9px] uppercase tracking-widest text-textSecondary">
          <span>Strike</span>
          <span>Chance the close lands here</span>
          <span className="text-right">Odds</span>
        </div>
        {desc.map(r => {
          const kept = focus != null && Math.abs(focus - r.strike) < 1e-9;
          const n = rank.get(r.strike);
          const wash = inHalf(r.strike) ? 'bg-silver/[0.08]' : inMost(r.strike) ? 'bg-silver/[0.035]' : '';
          const ink = n === 1 ? SUPREME : n ? SILVER : r.role ? ROLE_INK[r.role] : 'rgba(237,237,237,0.55)';
          const drawSpot = !spotDrawn && r.strike < spot;
          if (drawSpot) spotDrawn = true;
          return (
            <div key={r.strike}>
              {drawSpot && (
                <div className="h-[18px] flex items-center px-1">
                  <SpotRule ticker={ticker} price={spot} />
                </div>
              )}
              <button
                type="button"
                onClick={() => onPick?.(r.strike)}
                className={`w-full grid grid-cols-[96px_minmax(0,1fr)_64px] items-center gap-x-3 h-[24px] rounded px-1 text-left transition-colors hover:bg-ink/[0.05] ${wash} ${kept ? 'shadow-[inset_2px_0_0_0_rgba(199,211,232,0.8)]' : ''}`}
                data-close-row={r.strike}
                title={`${fmtStrike(r.strike)} · ${r.odds.toFixed(1)}% · the expected move alone says ${r.plain.toFixed(1)}%${r.role ? ` · ${r.role}` : ''}`}
              >
                <span className="flex items-center gap-1.5 min-w-0 font-mono text-[11px] tnum whitespace-nowrap">
                  <span className={`font-semibold ${kept ? 'text-silver' : 'text-textPrimary'}`}>{fmtStrike(r.strike)}</span>
                  {r.role && (
                    <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: ROLE_INK[r.role] }}>
                      {r.role === 'call wall' ? 'CW' : r.role === 'put wall' ? 'PW' : r.role === 'supreme' ? 'SUP' : 'PIN'}
                    </span>
                  )}
                  {yours?.has(r.strike) && <span className="text-[8px] font-bold uppercase tracking-wider text-warn">yours</span>}
                </span>
                <span className="relative h-[12px]">
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(1, (r.odds / maxOdds) * 100)}%`, background: ink, opacity: n ? 1 : 0.7 }} />
                  {/* the expected move alone — a tick */}
                  <span className="absolute top-[-2px] bottom-[-2px] w-px bg-[#ededed]/50" style={{ left: `${Math.min(100, (r.plain / maxOdds) * 100)}%` }} aria-hidden />
                  {n && (
                    <span className="absolute top-1/2 -translate-y-1/2 font-mono text-[9px] font-bold text-[#0a0a0a] px-1 rounded" style={{ left: 4, background: ink }}>
                      #{n}
                    </span>
                  )}
                </span>
                <span className={`text-right font-mono text-[12px] font-semibold tnum ${n ? 'text-textPrimary' : 'text-textPrimary/80'}`}>{r.odds.toFixed(r.odds >= 10 ? 0 : 1)}%</span>
              </button>
            </div>
          );
        })}
        <div className="mt-2 flex items-center gap-4 font-mono text-[9px] text-textSecondary" data-close-key>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-[6px] rounded-full bg-silver/[0.25]" /> the 50% run
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-[6px] rounded-full bg-silver/[0.10]" /> the 80% run
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-px h-3 bg-[#ededed]/50" /> the expected move alone
          </span>
        </div>
      </div>
      {reads ? (
        <div className="px-5 pb-4 pt-1 text-[12px] leading-relaxed text-textPrimary" data-close-reads>
          <p>{reads.likely}</p>
          <p>{reads.bands}</p>
          <p>{reads.pull}</p>
        </div>
      ) : (
        <p className="px-5 pb-4 pt-1 text-[12px] leading-relaxed text-textPrimary">{odds.sentence}</p>
      )}
    </section>
  );
};
