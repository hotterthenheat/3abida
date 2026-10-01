/*
==================================================
  SLAYER TERMINAL - THE WORDMARK (brand/Wordmark.tsx)

  ">slayer_terminal" — "The only monospace. Everything else is Helvetica." (Slayer Logo System, 03 · Wordmark.) The
  ">" and "terminal" in the muted ink, "slayer_" in the text's; the solid forms (print, mail) are one colour and end on
  the cursor. With the prompt, "slayer:~ $" sits on the line above.

  The letters are outlines (brand/wordmarkPaths.ts), not a font: nothing is downloaded and every machine draws the same
  wordmark. `typing` types it in at 28 ms a character and lands the cursor — the boot and the logo intro; reduced
  motion shows the last frame.
==================================================
*/

import type { CSSProperties } from 'react';
import { WORDMARK } from './wordmarkPaths';

interface WordmarkProps {
  /** the letters' box height, px (ascender to descender) */
  height: number;
  /** "slayer:~ $" on the line above */
  prompt?: boolean;
  /** end on the cursor */
  cursor?: boolean;
  /** one colour, for print and mail */
  solid?: 'black' | 'white';
  /** type in at 28 ms a character */
  typing?: boolean;
  className?: string;
  style?: CSSProperties;
  /** the accessible name — "Slayer Terminal" when left out; an empty string makes it decorative */
  label?: string;
}

const Wordmark = ({ height, prompt = false, cursor = false, solid, typing = false, className = '', style, label }: WordmarkProps) => {
  const scale = height / WORDMARK.height;
  const muted = solid ? (solid === 'black' ? '#000' : '#fff') : 'rgb(var(--chevron))';
  const lit = solid ? muted : 'rgb(var(--wordmark))';
  const name = label ?? 'Slayer Terminal';
  return (
    <span
      className={`inline-flex flex-col items-start leading-none ${className}`}
      style={style}
      role={name ? 'img' : undefined}
      aria-label={name || undefined}
      aria-hidden={name ? undefined : true}
    >
      {prompt && (
        <span className="font-code mb-[0.4em] whitespace-nowrap" style={{ fontSize: Math.max(9, height * 0.36), color: muted }} aria-hidden>
          slayer:~ $
        </span>
      )}
      <span className="relative inline-block" style={{ width: (cursor ? WORDMARK.width : WORDMARK.textWidth) * scale, height }}>
        <svg
          width={WORDMARK.textWidth * scale}
          height={height}
          viewBox={`0 0 ${WORDMARK.textWidth} ${WORDMARK.height}`}
          className={typing ? 'wordmark-typing block' : 'block'}
          aria-hidden
          focusable="false"
          data-wordmark
        >
          <path d={WORDMARK.chevron} fill={muted} />
          <path d={WORDMARK.slayer} fill={lit} />
          <path d={WORDMARK.terminal} fill={muted} />
        </svg>
        {/* the cursor is a box beside the letters, not a part of their SVG: its blink is an opacity the compositor runs */}
        {cursor && (
          <span
            className="wordmark-cursor"
            style={{ left: WORDMARK.cursorX * scale, width: WORDMARK.cursorW * scale, background: lit, ...(solid ? { animation: 'none', opacity: 1 } : null) }}
            aria-hidden
          />
        )}
      </span>
    </span>
  );
};

export default Wordmark;
