/*
==================================================
  SLAYER TERMINAL - THE COLOURS SWITCH
  (components/gex/ColoursSwitch.tsx)

  The Map's Colours card — Bencho's Palette (ui/Palette.tsx)
  at the toolbar's size, switching the ladder and the
  calendar between the house ramp and the thermal one. The
  swatches are the ramp itself, sampled where the ladder
  reads it (through its window, heatmap.ts), so the strip
  IS the scale the rows wear.

  One component so every ladder that opens the Map wears
  the same switch (2026-09-22, Noah: the Pulse strike
  ladder should "match the formatting of the pinpoint map
  page which it takes you to"). It was ExposureField's own
  until then.
==================================================
*/

import Palette from '../ui/Palette';
import { heatRampColorFor, ladderRampT } from './heatmap';

export type LedgerPalette = 'house' | 'thermal';

/* The order is the switch's: house, then thermal (Noah, 2026-09-21, with Bencho's block: "i want the thermal to house
   switch to be this as well") */
export const PALETTE_ORDER = ['house', 'thermal'] as const;
export const PALETTE_WORDS: Record<LedgerPalette, { name: string; hint: string }> = {
  thermal: { name: 'Thermal', hint: 'yellow in the middle, red where hedging amplifies a move, blue where it absorbs one' },
  house: { name: 'House', hint: 'gold where hedging amplifies, ice where it absorbs' },
};
/* the swatches: the absorbing side heavy and light, the amplifying side light and heavy, through the ladder's window */
const swatches = (mode: 'ember-glacier' | 'thermal-yellow', paper: boolean): string[] =>
  ([[-1, 0.92], [-1, 0.12], [1, 0.12], [1, 0.92]] as const).map(([sign, t]) => {
    const [r, g, b] = heatRampColorFor(sign, ladderRampT(sign, t, mode, paper), mode, paper);
    return `rgb(${r},${g},${b})`;
  });
/* the sets for each page: the dark ramps, and the paper ramps the island wears on the light page */
const SETS_DARK = PALETTE_ORDER.map(p => swatches(p === 'thermal' ? 'thermal-yellow' : 'ember-glacier', false));
const SETS_PAPER = PALETTE_ORDER.map(p => swatches(p === 'thermal' ? 'thermal-yellow' : 'ember-glacier', true));

interface ColoursSwitchProps {
  palette: LedgerPalette;
  onChange: (palette: LedgerPalette) => void;
  /** The light page: the swatches show the paper ramps */
  paper: boolean;
  /** Without its printed name — for a toolbar that measured itself tight */
  bare?: boolean;
  testId?: string;
}

const ColoursSwitch = ({ palette, onChange, paper, bare = false, testId = 'ledger-colours' }: ColoursSwitchProps) => {
  const at = PALETTE_ORDER.indexOf(palette);
  const next = PALETTE_ORDER[(at + 1) % PALETTE_ORDER.length];
  return (
    <Palette
      label={bare ? undefined : 'Colours'}
      sets={paper ? SETS_PAPER : SETS_DARK}
      index={at}
      onChange={i => onChange(PALETTE_ORDER[i] ?? 'house')}
      title={`Colours: ${PALETTE_WORDS[palette].name} — ${PALETTE_WORDS[palette].hint}. Press for ${PALETTE_WORDS[next].name}`}
      edge
      /* the toolbar's cards are 28px: a 20px bar in 4px of padding, 18px swatches, a 16px key */
      swatch={18}
      barH={20}
      pad={4}
      tool={16}
      gap={4}
      seam={3}
      corner={5}
      testId={testId}
    />
  );
};

export default ColoursSwitch;
