/*
==================================================
  SLAYER TERMINAL - PULSE DESK · DARK POOL
  (pages/workspace/DarkPoolWidget.tsx)

  The Dark Pool page's shelves, as a panel (the
  catalog audit, 2026-09-12): the posture behind
  the name's off-exchange prints, the share of the
  session that printed dark, the largest cross, and
  the liquidity shelves the dollars left — support,
  resistance, a pivot — with how many times price
  has bounced off each. The same engine the page
  runs (data/darkpool.ts), off the desk's snapshot.
==================================================
*/

import { useMemo } from 'react';
import { buildDarkPoolView } from '../../data/darkpool';
import { fmtUsd } from '../../data/gex';
import CompanyLogo from '../../components/ui/CompanyLogo';
import type { LevelRole } from '../../types/darkpool';
import type { WorkspaceCtx } from './registry';

const num = (v: number) => v.toLocaleString('en-US');
const signedPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
const ROLE: Record<LevelRole, { word: string; text: string; bar: string }> = {
  SUPPORT: { word: 'Support', text: 'text-bull', bar: 'bg-bull/70' },
  RESISTANCE: { word: 'Resistance', text: 'text-bear', bar: 'bg-bear/70' },
  PIVOT: { word: 'Pivot', text: 'text-warn', bar: 'bg-warn/70' },
};
const POSTURE = { ACCUMULATING: { word: 'Accumulating', ink: 'text-bull' }, DISTRIBUTING: { word: 'Distributing', ink: 'text-bear' }, BALANCED: { word: 'Balanced', ink: 'text-textPrimary' } } as const;

const DarkPoolWidget = ({ ctx }: { ctx: WorkspaceCtx }) => {
  const view = useMemo(() => buildDarkPoolView(ctx.snapshot), [ctx.snapshot]);
  const levels = useMemo(() => [...view.levels].sort((a, b) => b.price - a.price), [view]);
  const posture = POSTURE[view.posture];
  return (
    <div className="h-full min-h-0 flex flex-col" data-widget-dark-pool={ctx.ticker}>
      {/* THE HEAD — the name, its posture, the dark share, the largest cross */}
      <div className="shrink-0 flex items-center gap-x-4 gap-y-1 flex-wrap px-3 py-2 border-b border-borderSubtle/60 font-mono text-[10px] tnum">
        <span className="inline-flex items-center gap-1.5">
          <CompanyLogo ticker={view.ticker} size={14} />
          <span className="text-[11px] font-bold text-textPrimary">{view.ticker}</span>
          <span className="text-textPrimary">${view.spot.toFixed(2)}</span>
        </span>
        <span>
          <span className="uppercase tracking-wider text-textSecondary">Posture</span> <span className={`font-semibold ${posture.ink}`}>{posture.word}</span> <span className="text-textSecondary">{view.netPosturePct >= 0 ? '+' : ''}{view.netPosturePct.toFixed(0)}%</span>
        </span>
        <span>
          <span className="uppercase tracking-wider text-textSecondary">Dark</span> <span className="text-textPrimary">{view.dpSharePct.toFixed(0)}% of volume</span> <span className="text-textSecondary">· {fmtUsd(view.totalNotional)}</span>
        </span>
        {view.largest && (
          <span className="ml-auto">
            <span className="uppercase tracking-wider text-supreme">Largest</span> <span className="text-textPrimary">{num(view.largest.size)} @ ${view.largest.price.toFixed(2)}</span> <span className="text-supreme font-semibold">{fmtUsd(view.largest.notional)}</span>
          </span>
        )}
      </div>
      {/* THE SHELVES — highest first */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {levels.map(l => {
          const role = ROLE[l.role];
          return (
            <div key={l.price} className="px-3 py-1.5 border-b border-borderSubtle/40" title={l.usage} data-widget-shelf={l.price}>
              <div className="flex items-center gap-2 font-mono tnum">
                <span className={`text-[9px] font-semibold uppercase tracking-wider w-[70px] ${role.text}`}>{role.word}</span>
                <span className="text-[12px] font-bold text-textPrimary">${l.price.toFixed(2)}</span>
                <span className={`text-[10px] ${l.distPct >= 0 ? 'text-bull' : 'text-bear'}`}>{signedPct(l.distPct)}</span>
                <span className="ml-auto text-[11px] text-textPrimary">{fmtUsd(l.notional)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="relative flex-1 h-[4px] rounded-full bg-ink/[0.06]">
                  <span className={`absolute inset-y-0 left-0 rounded-full ${role.bar}`} style={{ width: `${Math.max(3, Math.round(l.sharePct))}%` }} />
                </span>
                <span className="font-mono text-[10px] tnum text-textPrimary whitespace-nowrap">
                  {l.sharePct.toFixed(0)}% · {l.prints} prints · {l.defended > 0 ? `defended ${l.defended}×` : 'untested'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="shrink-0 px-3 py-1.5 border-t border-borderSubtle/60 text-[10px] leading-snug text-textPrimary" data-widget-posture-note>
        {view.postureNote}
      </p>
    </div>
  );
};

export default DarkPoolWidget;
