/*
==================================================
  SLAYER TERMINAL - THE LANDING'S GLYPHS
  (pages/landing/Glyph.tsx)

  A product's glyph, its one coloured part in the
  page's own ink (2026-10-06 — the owner's
  directive: "The page is black, white and silver,
  but the room icons are pink, green, orange and
  purple … pass ink to every ProductGlyph … The app
  keeps its coloured icons"). On the landing, colour
  comes only from the market's data and the silver;
  every product glyph here is this one.
==================================================
*/

import type { ComponentProps } from 'react';
import ProductGlyph from '../../brand/ProductGlyph';

const Glyph = (props: Omit<ComponentProps<typeof ProductGlyph>, 'ink'>) => <ProductGlyph {...props} ink="rgb(var(--text-primary))" />;

export default Glyph;
