/*
==================================================
  SLAYER TERMINAL - SECTOR MARK (trace)

  A sector told by SHAPE, not hue (Noah, 2026-09-03:
  "the little color coded circles next to the sector
  name. i feel like every financial website has the
  exact same setup and colors for them. find another
  way to showcase the differences"). One monochrome
  glyph per sector, from the icon set the Trace tabs
  already wear, in the quiet ink — a sector is a
  category, and under the colour law a category has
  no claim on colour: hue stays for direction,
  status and the champion. The name always rides
  beside the glyph; the glyph lets the eye sort a
  column before the word is read.
==================================================
*/

import {
  Building2,
  Cpu,
  Factory,
  FlaskConical,
  Fuel,
  HeartPulse,
  Landmark,
  RadioTower,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/** The eleven sectors the terminal files (data/darkpool SECTOR_UNIVERSE). */
const GLYPH: Record<string, LucideIcon> = {
  'Financial Services': Landmark,
  Technology: Cpu,
  Healthcare: HeartPulse,
  'Consumer Cyclical': ShoppingBag,
  Industrials: Factory,
  'Communication Services': RadioTower,
  'Consumer Defensive': ShoppingCart,
  Utilities: Zap,
  'Real Estate': Building2,
  Energy: Fuel,
  'Basic Materials': FlaskConical,
  /* The equity universe's own names for the same sectors (data/universe.ts — the Stocks page, 2026-09-10) */
  Financials: Landmark,
  'Health Care': HeartPulse,
  'Consumer Discretionary': ShoppingBag,
  Communication: RadioTower,
  'Consumer Staples': ShoppingCart,
  Materials: FlaskConical,
};

export const sectorGlyph = (sector: string): LucideIcon => GLYPH[sector] ?? Tag;

/** The glyph alone — for a menu row or a tight cell. */
export const SectorMark = ({ sector, className = '' }: { sector: string; className?: string }) => {
  const Icon = sectorGlyph(sector);
  return <Icon aria-hidden className={`w-3 h-3 shrink-0 text-textMuted ${className}`} />;
};

/** Glyph + name, the table cell — "—" when a name is not filed. */
export const SectorName = ({ sector }: { sector: string | null }) =>
  sector ? (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-textSecondary">
      <SectorMark sector={sector} />
      {sector}
    </span>
  ) : (
    <span className="text-textMuted">—</span>
  );

export default SectorMark;
