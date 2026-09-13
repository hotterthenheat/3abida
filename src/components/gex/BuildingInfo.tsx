/*
==================================================
  SLAYER TERMINAL - WHAT BUILDING MEANS
  (components/gex/BuildingInfo.tsx)

  The information box on the Building page (Noah,
  2026-09-13: "you have to tell me what building
  means, it cuts off without me being able to see
  what the definition is"; the photo he sent of an
  information UI: "the information is easy and
  readable and you can tell what's going on").

  Two parts, in that photo's grammar:

    THE DEFINITION   what building, draining,
                     steady, changed sides and new
                     mean — each as the badge the
                     page uses, with one plain line
    LOADED STRIKES   the strikes that moved most
                     today, one readable row each:
                     the badge with its score and
                     word, the price, which side is
                     heavy, the distance from spot,
                     the level it is, the hedging
                     there now as a chip; a line of
                     figures under it; a bar split
                     into what was added on each
                     side and what was taken off,
                     with the key at the foot.

  The rows are the ledger's own (data/building.ts);
  nothing here is a second model.
==================================================
*/

import { useMemo, type ReactNode } from 'react';
import { Skeleton } from '../ui/Skeleton';
import { Block, Line } from '../ui/skeletonKit';
import { CALL_WALL, PUT_WALL, SUPREME, THERMAL_COOL, THERMAL_WARM } from './paletteInk';
import { fmtDollars, fmtStrike, type AheadClock } from '../../data/ahead';
import type { BuildRow, BuildVerdict, Building } from '../../data/building';
import { Name } from '../ui/Name';

const COOL = THERMAL_COOL;
const WARM = THERMAL_WARM;
const OFF = 'rgba(237,237,237,0.28)';
const SILVER = 'rgb(var(--silver))';
const ROLE_INK: Record<string, string> = { 'call wall': CALL_WALL, 'put wall': PUT_WALL, supreme: SUPREME };

const signed = (v: number) => `${v >= 0 ? '+' : '−'}${fmtDollars(Math.abs(v))}`;
const contracts = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString('en-US')}`;

/** The badge each verdict wears — the same word the ledger prints, in its ink */
const VERDICT: Record<BuildVerdict, { word: string; cls: string; line: string }> = {
  building: { word: 'Building', cls: 'bg-bull/10 text-bull border-bull/25', line: 'Hedging is being ADDED at the strike today — new contracts opened there, priced at today’s spot. It is becoming a wall before the map calls it one.' },
  draining: { word: 'Draining', cls: 'bg-bear/10 text-bear border-bear/25', line: 'Hedging is being TAKEN OFF at the strike today — contracts closed or rolled away. A wall that is draining breaks more easily than its size says.' },
  steady: { word: 'Steady', cls: 'bg-ink/[0.05] text-textSecondary border-borderSubtle', line: 'The change today is under 5% of the biggest wall shown — nothing worth a word. The strike is what it was at the open.' },
  switched: { word: 'Changed sides', cls: 'bg-warn/10 text-warn border-warn/25', line: 'The heavier leg flipped today — a call-heavy strike became put-heavy or the reverse — so what the hedging DOES there changed, not just its size.' },
  new: { word: 'New today', cls: 'bg-supreme/10 text-supreme border-supreme/25', line: 'There was nothing at the strike at the open. Everything there arrived today.' },
};

const Badge = ({ verdict, score }: { verdict: BuildVerdict; score?: number }) => {
  const v = VERDICT[verdict];
  return (
    <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-md border font-mono text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${v.cls}`} data-build-badge={verdict}>
      {score != null && <span className="text-[12px] tnum">{score}</span>}
      {v.word}
    </span>
  );
};

const Chip = ({ children, ink }: { children: ReactNode; ink: string }) => (
  <span className="inline-flex items-center h-5 px-1.5 rounded border font-mono text-[10px] font-semibold tnum whitespace-nowrap" style={{ color: ink, borderColor: `${ink}55`, background: `${ink}14` }}>
    {children}
  </span>
);

interface Props {
  data: Building;
  ticker: string;
  clock: AheadClock;
  focus: number | null;
  onPick: (strike: number) => void;
  scope?: ReactNode;
}

const BuildingInfo = ({ data, ticker, clock, focus, onPick, scope }: Props) => {
  const { rows, spot, maxChange } = data;
  /* THE LOADED STRIKES — the ones that moved most today, biggest change first;
     a quiet day fills in with the heaviest steady strikes so the box is never empty */
  const loaded = useMemo(() => {
    const moved = rows.filter(r => r.verdict !== 'steady').sort((a, b) => Math.abs(b.sizeChange) - Math.abs(a.sizeChange)).slice(0, 8);
    if (moved.length >= 4) return moved;
    const seen = new Set(moved.map(r => r.strike));
    const heavy = rows.filter(r => !seen.has(r.strike)).sort((a, b) => Math.abs(b.now) - Math.abs(a.now));
    return [...moved, ...heavy.slice(0, 6 - moved.length)];
  }, [rows]);
  const totalNow = useMemo(() => rows.reduce((a, r) => a + Math.abs(r.now), 0) || 1, [rows]);
  const maxMoved = useMemo(() => Math.max(1, ...loaded.map(r => Math.abs(r.callAdded) + Math.abs(r.putAdded))), [loaded]);
  const scoreOf = (r: BuildRow) => Math.min(99, Math.round((Math.abs(r.sizeChange) / Math.max(1, maxChange)) * 100));
  const bps = (r: BuildRow) => Math.round(((r.strike - spot) / spot) * 10_000);

  return (
    <section className="flex flex-col min-w-0" data-building-info>
      {/* THE DEFINITION */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">What building means</h3>
          {scope}
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-textPrimary max-w-[900px]">
          Building is the hedging that arrived at a strike <span className="font-semibold">today</span>: the open interest added since the open, priced at today's spot, so the figure is dollars of dealer hedging, not contracts. A strike that is building is turning into a wall a day before the map names it one; a strike that is draining is losing the hedging that made it a wall. The ledger above says it strike by strike; the words are these:
        </p>
        <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-x-5 gap-y-2" data-build-definitions>
          {(Object.keys(VERDICT) as BuildVerdict[]).map(v => (
            <li key={v} className="flex flex-col gap-1.5 min-w-0">
              <Badge verdict={v} />
              <span className="text-[11px] leading-snug text-textPrimary">{VERDICT[v].line}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* LOADED STRIKES */}
      <div className="border-t border-borderSubtle">
        <div className="px-5 pt-3 pb-2 flex items-center gap-3 flex-wrap">
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-textPrimary">Loaded strikes</span>
          <span className="text-[11px] text-textSecondary">the strikes that moved most {clock.inSession ? 'today' : 'last session'} · biggest change first</span>
          <span className="ml-auto font-mono text-[10px] tnum text-textSecondary">
            spot <span className="text-textPrimary">${spot.toFixed(2)}</span> · built <span className="text-bull">{signed(data.built)}</span> · drained <span className="text-bear">{signed(-data.drained)}</span>
          </span>
        </div>
        <ul data-loaded-strikes>
          {loaded.map(r => {
            const callOn = Math.max(0, r.callAdded);
            const putOn = Math.max(0, r.putAdded);
            const off = Math.max(0, -r.callAdded) + Math.max(0, -r.putAdded);
            const total = callOn + putOn + off || 1;
            const len = (total / maxMoved) * 100;
            const kept = focus != null && Math.abs(focus - r.strike) < 1e-9;
            const d = bps(r);
            const side = r.now < 0 ? 'calls' : 'puts';
            return (
              <li key={r.strike} className={`border-t border-borderSubtle/50 ${kept ? 'bg-silver/[0.04]' : ''}`} data-loaded-strike={r.strike}>
                <button type="button" onClick={() => onPick(r.strike)} className="w-full text-left px-5 py-3 hover:bg-ink/[0.03] transition-colors" title={`${fmtStrike(r.strike)} — click to make it the strike`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge verdict={r.verdict} score={scoreOf(r)} />
                    <span className={`font-mono text-[18px] font-semibold tnum leading-none ${kept ? 'text-silver' : 'text-textPrimary'}`}>${fmtStrike(r.strike)}</span>
                    <Chip ink={side === 'calls' ? COOL : WARM}>{side.toUpperCase()}</Chip>
                    <span className={`font-mono text-[12px] tnum ${d > 0 ? 'text-bull' : d < 0 ? 'text-bear' : 'text-textSecondary'}`}>
                      {d > 0 ? '+' : ''}
                      {d} bps
                    </span>
                    {r.role && (
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: ROLE_INK[r.role] }}>
                        {r.role}
                      </span>
                    )}
                    {r.pin && !r.role && <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-textSecondary">pin</span>}
                    <span className="ml-auto">
                      <Chip ink={r.now < 0 ? COOL : WARM}>GEX {fmtDollars(Math.abs(r.now))}</Chip>
                    </span>
                  </div>
                  <div className="mt-1.5 font-mono text-[11px] tnum text-textPrimary flex items-center gap-x-4 flex-wrap">
                    <span>{((Math.abs(r.now) / totalNow) * 100).toFixed(0)}% of the window's hedging</span>
                    <span>
                      {r.sizeChange >= 0 ? 'built' : 'drained'} <span className={r.sizeChange >= 0 ? 'text-bull' : 'text-bear'}>{signed(r.sizeChange)}</span> {clock.inSession ? 'today' : 'last session'}
                    </span>
                    <span>
                      calls <span style={{ color: COOL }}>{signed(r.callAdded)}</span> · {contracts(r.dCall)}
                    </span>
                    <span>
                      puts <span style={{ color: WARM }}>{signed(r.putAdded)}</span> · {contracts(r.dPut)}
                    </span>
                    {r.when && <span className="text-textSecondary">mostly {r.when} in the day</span>}
                    {r.byClose !== 0 && clock.inSession && (
                      <span className="text-textSecondary">
                        by the close at this pace <span className="text-textPrimary">{signed(r.byClose)}</span>
                      </span>
                    )}
                  </div>
                  <div className="mt-2 h-[8px] rounded-full bg-ink/[0.06] overflow-hidden">
                    <div className="h-full flex" style={{ width: `${Math.max(2, len)}%` }}>
                      {callOn > 0 && <span style={{ width: `${(callOn / total) * 100}%`, background: COOL }} />}
                      {putOn > 0 && <span style={{ width: `${(putOn / total) * 100}%`, background: WARM }} />}
                      {off > 0 && <span style={{ width: `${(off / total) * 100}%`, background: OFF }} />}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="px-5 py-2.5 border-t border-borderSubtle flex items-center gap-5 font-mono text-[10px] text-textSecondary flex-wrap" data-loaded-key>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: COOL }} /> calls added
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: WARM }} /> puts added
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: OFF }} /> taken off
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: SILVER }} /> the bar's length is the size of the day's change
          </span>
          <span className="ml-auto italic">click a row → it is the strike on <Name t={ticker} size={11} /> everywhere</span>
        </div>
      </div>
    </section>
  );
};

/** The box's own shape while it walks in */
export const BuildingInfoInner = () => (
  <div className="flex flex-col" aria-hidden data-skeleton="building-info">
    <div className="px-5 pt-4 pb-3">
      <Line w={160} h={15} />
      <Line w="80%" className="mt-2" />
      <Line w="60%" className="mt-1.5" />
      <div className="mt-3 grid grid-cols-5 gap-x-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i}>
            <Block w={96} h={24} className="rounded-md" />
            <Line w="90%" className="mt-2" />
            <Line w="70%" className="mt-1" />
          </div>
        ))}
      </div>
    </div>
    <div className="border-t border-borderSubtle">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="px-5 py-3 border-t border-borderSubtle/50 first:border-t-0">
          <div className="flex items-center gap-3">
            <Block w={110} h={24} className="rounded-md" />
            <Line w={60} h={16} />
            <Block w={52} h={20} className="rounded" />
            <Line w={48} />
            <Block w={90} h={20} className="ml-auto rounded" />
          </div>
          <Line w="55%" className="mt-2" />
          <Skeleton className="mt-2 h-[8px] rounded-full" style={{ width: `${30 + ((i * 23) % 60)}%` }} />
        </div>
      ))}
    </div>
  </div>
);

export default BuildingInfo;
