/*
==================================================
  SLAYER TERMINAL - THE BELL'S COUNT, ONE VOICE (components/alerts/AlertCount.tsx)

  The rail and the phone's menu counted alerts two
  ways (the audit's SH-12): a red square and "N set"
  on the desk, a silver "N alerted" on the phone, the
  bell jingling at one count on one and another on
  the other. One reading, one badge, both places:
  what alerted and was not looked at in the bear's
  small square, else how many are set.
==================================================
*/

import { useAllAlerts, useUnseenAll } from '../gex/alertStore';
import { useLevelUnseen } from '../../data/levelAlerts';

export interface AlertCounts {
  /** waiting to fire */
  set: number;
  /** fired and not yet looked at */
  unseen: number;
  /** the bell's spoken name: "Alerts, 3 new" / "Alerts, 2 set" / "Alerts" */
  label: string;
  /** THE LEVEL ALERTS' TIERS not yet looked at (the owner's item 7: "bell with Tier-1/Tier-2 counts") — Tier 1 joins
      the red square, Tier 2 stands beside it in silver */
  t1: number;
  t2: number;
}

export function useAlertCounts(): AlertCounts {
  const set = useAllAlerts().reduce((n, a) => n + a.alerts.filter(x => !x.firedAt).length, 0);
  const { t1, t2 } = useLevelUnseen();
  const unseen = useUnseenAll() + t1;
  const tiers = t1 || t2 ? ` (level alerts: ${t1} tier 1, ${t2} tier 2)` : '';
  const label = unseen > 0 || t2 > 0 ? `Alerts, ${unseen + t2} new${tiers}` : set > 0 ? `Alerts, ${set} set` : 'Alerts';
  return { set, unseen, label, t1, t2 };
}

/** The count at a row's end: the red square for what is new, else "N set" */
export const AlertBadge = ({ counts, className = '' }: { counts: AlertCounts; className?: string }) =>
  counts.unseen > 0 || counts.t2 > 0 ? (
    <span className={`inline-flex items-center gap-1 ${className}`} data-alerts-count aria-hidden>
      {counts.unseen > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-md bg-bear text-white font-mono text-[11px] font-bold leading-[18px] text-center tnum" title={counts.t1 ? `${counts.t1} tier 1` : undefined}>
          {counts.unseen > 99 ? '99+' : counts.unseen}
        </span>
      )}
      {counts.t2 > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-md border border-silver/50 text-textSecondary font-mono text-[11px] font-semibold leading-[16px] text-center tnum" title={`${counts.t2} tier 2`} data-alerts-tier2>
          {counts.t2 > 99 ? '99+' : counts.t2}
        </span>
      )}
    </span>
  ) : counts.set > 0 ? (
    <span className={`font-mono text-[11px] tnum text-textMuted ${className}`} data-alerts-count aria-hidden>
      {counts.set} set
    </span>
  ) : null;
