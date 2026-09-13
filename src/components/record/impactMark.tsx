/*
==================================================
  SLAYER TERMINAL - THE IMPACT MARK
  (components/record/impactMark.tsx)

  One small square before a headline or a print, in
  the rungs every trader already knows (Noah,
  2026-09-09, on Forex Factory's legend: "it allows
  the user to decipher meaning instantly"): red
  high, orange medium, grey low. Shared by the wire,
  the all-news feed and the calendar so the three
  can never disagree about a colour.
==================================================
*/

export type ImpactTier = 'high' | 'medium' | 'low';
export const IMPACT_TIERS: ImpactTier[] = ['high', 'medium', 'low'];
export const IMPACT_INK: Record<ImpactTier, string> = { high: '#D73027', medium: '#FDAE61', low: 'rgb(var(--text-muted))' };
export const IMPACT_WORD: Record<ImpactTier, string> = {
  high: 'High impact — moves the market on its own',
  medium: 'Medium impact — moves a name, a sector or a currency',
  low: 'Low impact — noted, rarely moves anything',
};
/** A story's tier, on the same cuts as its word (heavy · firm · light — newsroom.ts severityWord) */
export const tierOf = (severity: number): ImpactTier => (severity >= 7 ? 'high' : severity >= 4 ? 'medium' : 'low');

export const ImpactMark = ({ tier }: { tier: ImpactTier }) => (
  <span className="inline-block w-2 h-2 rounded-[2px] shrink-0" style={{ background: IMPACT_INK[tier] }} title={IMPACT_WORD[tier]} aria-label={IMPACT_WORD[tier]} data-impact-mark={tier} />
);

/** The legend, one thin line: ■ high ■ medium ■ low impact */
export const ImpactLegend = ({ className = '' }: { className?: string }) => (
  <span className={`inline-flex items-center gap-3 normal-case tracking-normal text-[10px] text-textSecondary ${className}`} data-impact-legend>
    {IMPACT_TIERS.map(t => (
      <span key={t} className="inline-flex items-center gap-1.5" title={IMPACT_WORD[t]}>
        <ImpactMark tier={t} />
        {t}
      </span>
    ))}
    <span className="text-textMuted">impact</span>
  </span>
);
