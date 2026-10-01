/*
==================================================
  SLAYER TERMINAL - A CARD WITH THE TILE'S CORNERS (brand/BracketCard.tsx)

  The mark's corner brackets, drawn at a card's corners — the Logo System's system pages (404, 500, maintenance, the
  error boundary), the link preview, the end card. The brackets are the tile's own ink (--bracket).
==================================================
*/

import type { ReactNode } from 'react';

const Corner = ({ at }: { at: 'tl' | 'tr' | 'bl' | 'br' }) => {
  const pos = { tl: 'top-3 left-3 border-t border-l', tr: 'top-3 right-3 border-t border-r', bl: 'bottom-3 left-3 border-b border-l', br: 'bottom-3 right-3 border-b border-r' }[at];
  return <span className={`pointer-events-none absolute w-5 h-5 ${pos}`} style={{ borderColor: 'rgb(var(--bracket))' }} aria-hidden />;
};

const BracketCard = ({ children, className = '', label }: { children: ReactNode; className?: string; label?: string }) => (
  <div className={`relative rounded-2xl border border-borderSubtle bg-panel ${className}`} data-bracket-card={label}>
    <Corner at="tl" />
    <Corner at="tr" />
    <Corner at="bl" />
    <Corner at="br" />
    {children}
  </div>
);

export default BracketCard;
