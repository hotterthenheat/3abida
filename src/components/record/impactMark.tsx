/*
==================================================
  SLAYER TERMINAL - THE IMPACT MARK
  (components/record/impactMark.tsx)

  The small square that says how hard a story or
  a print lands — high, medium, low — and its
  legend (Noah, 2026-09-09, on Forex Factory's
  legend beside its headlines: "it allows the user
  to decipher meaning instantly"): one small square
  before every headline and every print, in the
  rungs every trader already knows — red high,
  orange medium (Noah: "medium is orange and high
  is red"), and grey for low ("low should stay
  gray"). The red and the orange are the warm side
  of the house thermal ramp (heatmap.ts
  thermal-yellow at 0.8 / 0.4), so the red is the
  ramp's deeper red, not the direction red that
  says "negative"; the grey is the muted ink.
  Lived in the wire's page; lifted out on
  2026-09-13 so the All news box and the month
  calendar draw the same square.
==================================================
*/

export type ImpactTier = 'high' | 'medium' | 'low';
export const IMPACT_TIERS: ImpactTier[] = ['high', 'medium', 'low'];
/* the warm side of the house thermal ramp for high and medium, the muted ink for low — never the direction red. Tokens
   since 2026-09-30 (tokens.css --impact-*): the dark set is the ramp's #D73027 / #FDAE61, the light set is cut for paper */
export const IMPACT_INK: Record<ImpactTier, string> = { high: 'rgb(var(--impact-high))', medium: 'rgb(var(--impact-medium))', low: 'rgb(var(--text-muted))' };
export const IMPACT_WORD: Record<ImpactTier, string> = {
  high: 'High impact — moves the market on its own',
  medium: 'Medium impact — moves a name, a sector or a currency',
  low: 'Low impact — noted, rarely moves anything',
};
/** A story's tier, on the same cuts as its word (heavy · firm · light — newsroom.ts severityWord):
    on a typical wire the earnings prints land high, CPI / a deal / a probe medium, analyst notes and launches low */
export const tierOf = (severity: number): ImpactTier => (severity >= 7 ? 'high' : severity >= 4 ? 'medium' : 'low');

export const ImpactMark = ({ tier }: { tier: ImpactTier }) => (
  <span className="inline-block w-2 h-2 rounded-[2px] shrink-0" style={{ background: IMPACT_INK[tier] }} title={IMPACT_WORD[tier]} aria-label={IMPACT_WORD[tier]} data-impact-mark={tier} />
);

/** The legend, one thin line: ■ high ■ medium ■ low impact */
export const ImpactLegend = ({ className = '' }: { className?: string }) => (
  <span className={`inline-flex items-center gap-3 normal-case tracking-normal text-[11px] text-textSecondary ${className}`} data-impact-legend>
    {IMPACT_TIERS.map(t => (
      <span key={t} className="inline-flex items-center gap-1.5" title={IMPACT_WORD[t]}>
        <ImpactMark tier={t} />
        {t}
      </span>
    ))}
    <span className="text-textMuted">impact</span>
  </span>
);
