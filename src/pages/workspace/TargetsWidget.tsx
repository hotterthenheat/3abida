/*
==================================================
  SLAYER TERMINAL - PULSE DESK · TARGETS
  (pages/workspace/TargetsWidget.tsx)

  The agenda on the desk (2026-09-08): the same
  order the Targets page keeps — how likely price
  gets there × how much happens if it does — as a
  dense list, so a strike is #1 here for the same
  reason it is #1 on Pinpoint. One labelled control,
  the WATCH sentence, the rows; a click focuses the
  strike on THIS desk's chart. Replaces the old
  five-factor Ranked Targets widget under its key.
==================================================
*/

import { useMemo, useState } from 'react';
import Simulator from '../../core/simulator';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import { heatLaneColor } from '../../components/gex/heatmap';
import { CALL_WALL, FLIP, PUT_WALL, SUPREME, THERMAL_WARM } from '../../components/gex/paletteInk';
import { AGENDA_ORDERS, buildAgenda, type AgendaOrder, type Target } from '../../data/agenda';
import { fmtDollars, fmtStrike } from '../../data/ahead';
import { buildBuilding } from '../../data/building';
import { buildExposureProfile } from '../../data/exposure';
import { buildExposureSurface, CALENDAR_DTES } from '../../data/exposureSurface';
import { sessionBars } from '../../data/levelview';
import { useDeskClock } from './useDeskClock';
import type { WorkspaceCtx } from './registry';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const ROLE_INK: Record<string, string> = { 'call wall': CALL_WALL, 'put wall': PUT_WALL, supreme: SUPREME, flip: FLIP };
const WARM = THERMAL_WARM;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const ORDER_OPTIONS: DropdownOption<AgendaOrder>[] = AGENDA_ORDERS.map(o => ({ value: o.value, label: o.label, hint: o.hint }));
/** # · strike · reached · holds · at stake */
const COLS = '28px minmax(0,1fr) 44px 92px 108px';

const kindOf = (t: Target) => (t.role ? 'named' : t.isShelf ? 'shelf' : t.isWall ? 'thin' : 'trapdoor');

const TargetsWidget = ({ ctx }: { ctx: WorkspaceCtx }) => {
  const [order, setOrder] = useState<AgendaOrder>('matters');
  const clock = useDeskClock();
  /* Scan tier: ctx.snapshot is the desk's 10s reference — the order holds still between sweeps */
  const agenda = useMemo(() => {
    const snap = ctx.snapshot;
    const t = snap.ticker;
    try {
      const profile = buildExposureProfile(snap, '0DTE', 15);
      const building = buildBuilding(snap, Simulator.getGexHistory(t), Simulator.getCandles(t), profile, clock);
      const surface = buildExposureSurface(snap, 30, CALENDAR_DTES);
      const iv = Simulator.TICKERS[t]?.iv ?? 0.2;
      return buildAgenda(snap, profile, building, surface, sessionBars(t) ?? [], clock, iv, order);
    } catch {
      return null;
    }
  }, [ctx.snapshot, clock, order]);

  if (!agenda) {
    return <div className="h-full grid place-items-center font-mono text-[11px] text-textMuted uppercase tracking-widest">No book for {ctx.ticker}</div>;
  }
  const maxStake = Math.max(1, ...agenda.targets.map(t => t.stake));
  const focus = ctx.focusPrice ?? null;

  return (
    <div className="h-full min-h-0 flex flex-col" data-targets-widget>
      {/* THE ONE LINE OF CONTROLS — the head above is the drag handle */}
      <div className="shrink-0 px-2 py-1.5 border-b border-borderSubtle/60 flex items-center gap-2 flex-wrap">
        <DropdownSelect label="Ranked by" value={order} options={ORDER_OPTIONS} onChange={setOrder} title="The order of the list" testId="desk-targets-order" />
        <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-textMuted tnum whitespace-nowrap">{agenda.targets.length} strikes · click one to see it on the chart</span>
      </div>
      {/* THE SENTENCE */}
      <div className="shrink-0 px-2.5 py-1.5 border-b border-borderSubtle/60 flex items-baseline gap-2 flex-wrap">
        <span className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: SUPREME }}>
          Watch
        </span>
        <span className="text-[11px] leading-snug text-textSecondary line-clamp-2">{agenda.sentence.replace(/^Watch /, '')}</span>
      </div>
      <div className="shrink-0 grid items-center gap-x-2 px-2.5 h-6 border-b border-borderSubtle bg-chip select-none font-mono text-[9px] uppercase tracking-widest text-textSecondary" style={{ gridTemplateColumns: COLS }}>
        <span>#</span>
        <span>Strike</span>
        <span className="text-right">{clock.inSession ? 'Reached' : 'Next'}</span>
        <span className="text-right">Holds</span>
        <span>At stake</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {agenda.targets.map(t => {
          const kind = kindOf(t);
          const kept = focus != null && Math.abs(focus - t.strike) < 1e-9;
          const pick = agenda.first[0]?.strike === t.strike;
          return (
            <button
              key={t.strike}
              onClick={() => ctx.focusStrike?.(t.strike)}
              title={`${t.words} — click to see ${fmtStrike(t.strike)} on the chart`}
              className={`w-full grid items-center gap-x-2 px-2.5 h-8 border-b border-borderSubtle/30 text-left transition-colors hover:bg-ink/[0.03] ${kept ? 'bg-silver/[0.05]' : pick ? 'bg-supreme/[0.05]' : ''}`}
              style={{ gridTemplateColumns: COLS, boxShadow: kept ? `inset 2px 0 0 0 ${SILVER}` : undefined }}
              data-desk-target={t.strike}
            >
              <span className="font-mono text-[10px] tnum" style={{ color: pick ? SUPREME : undefined }}>
                <span className={pick ? 'font-bold' : 'text-textSecondary'}>#{t.rank}</span>
              </span>
              <span className="flex items-center gap-1.5 min-w-0 whitespace-nowrap overflow-hidden">
                <span className={`font-mono text-[12px] font-bold tnum ${kept ? 'text-silver' : 'text-textPrimary'}`}>{fmtStrike(t.strike)}</span>
                {kind !== 'thin' && (
                  <span className="text-[8px] uppercase tracking-widest" style={{ color: t.role ? ROLE_INK[t.role] : t.isShelf ? 'rgb(var(--text-muted))' : WARM }}>
                    {t.role ?? (t.isShelf ? 'shelf' : 'trapdoor')}
                  </span>
                )}
                <span className="font-mono text-[9px] tnum text-textMuted">
                  {t.distancePct >= 0 ? '+' : ''}
                  {t.distancePct.toFixed(2)}%
                </span>
              </span>
              <span className="text-right font-mono text-[11px] tnum text-textPrimary">{pct(t.reach)}</span>
              <span className="flex items-center justify-end gap-1.5 font-mono text-[11px] tnum font-semibold" style={{ color: t.isShelf ? SILVER : kind === 'trapdoor' ? WARM : 'rgb(var(--text-muted))' }}>
                {t.isShelf ? pct(t.hold) : '—'}
                <span className="relative block h-[5px] w-[36px] rounded-full bg-ink/[0.06] overflow-hidden" aria-hidden>
                  {kind === 'trapdoor' ? (
                    <span className="absolute inset-0 rounded-full" style={{ background: WARM, opacity: 0.35 }} />
                  ) : (
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(t.isShelf ? t.hold : 0) * 100}%`, background: SILVER, opacity: 0.85 }} />
                  )}
                </span>
              </span>
              <span className="relative h-full flex items-center">
                <span className="absolute inset-y-[12px] left-0 right-12 rounded-full bg-ink/[0.04]" />
                <span className="absolute inset-y-[12px] left-0 rounded-full" style={{ width: `calc(${(t.stake / maxStake) * 100}% - ${(t.stake / maxStake) * 48}px)`, background: heatLaneColor(t.isWall ? -t.stake : t.stake, maxStake, 'thermal-yellow', 0.35) }} />
                <span className="absolute right-0 font-mono text-[10px] tnum text-textPrimary">{fmtDollars(t.stake)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TargetsWidget;
