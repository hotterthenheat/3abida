/*
==================================================
  SLAYER TERMINAL - EVERY PRODUCT, ONE LINE EACH (brand/products.ts)

  The Logo System's menu (06 · Menu and rail, 2026-09-30): "Landing and app header. Names and routes as in nav.ts.
  Community stays off the menu until it opens." The landing's Products menu and the footer read this list; the rail
  reads nav.ts, whose lines are the same words.
==================================================
*/

import { NAV_ITEMS } from '../components/layout/nav';
import type { GlyphName } from './paths';

export interface Product {
  name: string;
  glyph: GlyphName;
  line: string;
  path: string;
}

export interface ProductGroup {
  caption: string;
  products: Product[];
}

const fromNav = (path: string): Product => {
  const item = NAV_ITEMS.find(i => i.path === path);
  if (!item?.glyph) throw new Error(`brand/products: no product at ${path}`);
  return { name: item.label, glyph: item.glyph, line: item.description, path: item.path };
};

export const PRODUCT_GROUPS: ProductGroup[] = [
  {
    caption: 'Home',
    products: [fromNav('/pulse'), { name: 'Alerts', glyph: 'alerts', line: 'An alert on any level that sounds on every page', path: '/alerts' }],
  },
  { caption: 'Market', products: [fromNav('/terrain'), fromNav('/trace'), fromNav('/dossier')] },
  { caption: 'The book', products: [fromNav('/pinpoint')] },
  { caption: 'Trade', products: [fromNav('/compass'), fromNav('/weigher')] },
  {
    caption: 'Practice',
    products: [
      { name: 'Practice', glyph: 'practice', line: 'Trade with paper money, replay the past, review every trade', path: '/practice' },
      fromNav('/practice/paper'),
      fromNav('/practice/backtest'),
      fromNav('/practice/journal'),
    ],
  },
];

export const PRODUCTS: Product[] = PRODUCT_GROUPS.flatMap(g => g.products);
