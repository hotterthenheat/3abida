/*
==================================================
  SLAYER TERMINAL - A WINDOW OF ITS OWN
  (pages/popout/PopOutFrame.tsx)

  The pop-out's frame (the ideas report, 2026-10-10):
  a panel or a pane alone in a window for a second
  screen — no rail, no footer, one quiet line of head
  (what it is, the room's glyph, and that it keeps in
  step), the panel filling the rest. The window joins
  the terminal's channel (components/layout/deskChannel.ts):
  the name, the link groups and the theme follow every
  other window of the terminal, both ways.
==================================================
*/

import { useEffect, type ReactNode } from 'react';
import ProductGlyph from '../../brand/ProductGlyph';
import type { GlyphName } from '../../brand/paths';
import { useDeskChannel } from '../../components/layout/deskChannel';

const PopOutFrame = ({ glyph, title, aside, children, testId }: { glyph: GlyphName; title: string; aside?: ReactNode; children: ReactNode; testId: string }) => {
  useDeskChannel();
  useEffect(() => {
    document.title = `${title} · Slayer Terminal`;
  }, [title]);
  return (
    <div className="h-screen h-dvh flex flex-col bg-canvas text-textPrimary overflow-hidden" data-popout={testId}>
      <header className="shrink-0 h-10 flex items-center gap-2.5 px-3 border-b border-borderSubtle" data-popout-head>
        <ProductGlyph name={glyph} size={16} bare className="shrink-0" />
        <h1 className="min-w-0 truncate text-[13px] font-semibold text-textPrimary">{title}</h1>
        <span className="min-w-0 truncate text-[11px] text-textMuted max-sm:hidden">its own window · the name, the link groups and the theme keep in step with the terminal</span>
        <span className="ml-auto shrink-0 flex items-center gap-1.5">{aside}</span>
      </header>
      <main id="content" className="flex-1 min-h-0 min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
};

export default PopOutFrame;
