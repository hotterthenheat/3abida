/*
==================================================
  SLAYER TERMINAL - THE SHELL HEAD (components/layout/ShellHead.tsx)

  The head every walked page wears (the Weigher's,
  Settings', Compass's): the product's glyph, its
  name as the page's h1, one line, and the facts at
  the right as small labelled pairs — no breadcrumb,
  no tracked caps. Pulse and the four-chart board
  wore older heads until 2026-10-09 (the audit's
  PU-2, PU-3, X4.9); they wear this one now.
==================================================
*/

import type { ReactNode } from 'react';
import ProductGlyph from '../../brand/ProductGlyph';
import type { GlyphName } from '../../brand/paths';

export interface HeadFact {
  label: string;
  value: ReactNode;
  testId?: string;
  /** kept off a phone, where the head must stay short */
  wide?: boolean;
}

const ShellHead = ({ glyph, title, line, facts = [], aside, testId }: { glyph: GlyphName; title: string; line: string; facts?: HeadFact[]; aside?: ReactNode; testId?: string }) => (
  <header className="shrink-0 flex items-start gap-x-6 gap-y-2 flex-wrap pb-3 border-b border-borderSubtle" data-shell {...(testId ? { [`data-${testId}`]: true } : {})}>
    <div className="min-w-0 flex-1">
      <div className="h-6 flex items-center gap-2.5" data-shell-page>
        <ProductGlyph name={glyph} size={18} bare className="shrink-0" />
        <h1 className="text-[15px] font-semibold leading-tight text-textPrimary">{title}</h1>
        {aside}
      </div>
      <p className="mt-0.5 text-[11px] text-textMuted">{line}</p>
    </div>
    {facts.length > 0 && (
      <dl className="flex flex-wrap gap-x-6 gap-y-2" data-shell-facts>
        {facts.map(f => (
          <div key={f.label} className={`min-w-0 ${f.wide ? 'max-sm:hidden' : ''}`} data-shell-fact={f.testId ?? f.label}>
            <dt className="text-[10px] text-textMuted whitespace-nowrap">{f.label}</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap">{f.value}</dd>
          </div>
        ))}
      </dl>
    )}
  </header>
);

export default ShellHead;
