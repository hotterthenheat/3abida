import { useState } from 'react';
import { useResolvedTheme } from '../../theme/theme';

interface CompanyLogoProps {
  ticker: string;
  /** Square edge in px */
  size?: number;
  className?: string;
}

/*
==================================================
  SLAYER TERMINAL - A NAME'S MARK (ui/CompanyLogo.tsx)

  EVERY TICKER WEARS ONE (Noah, 2026-09-13: "all the
  tickers i have with no photos can you find the
  logos for them because every single ticker has
  one"). Two faces, in this order:

    THE BRAND GLYPH   public/logos/{TICKER}.svg, the
                      company's own mark, with its
                      own colour baked into the file
    THE HOUSE MARK    for every other name: a chip
                      in a hue derived from the
                      symbol itself, carrying its
                      letters

  WHY NOT A BRAND GLYPH FOR ALL OF THEM. There is no
  offline set that carries 386 tickers. The one this
  folder was built from has had most large caps
  pulled from it (Microsoft, Amazon, Walmart and
  Salesforce are all gone from the current release),
  and a name-matched guess is worse than no glyph:
  matching by company name offered D.R. Horton the D
  programming language's logo and Charles Schwab a
  proxy debugger's. So the glyphs are the ones
  verified by hand, and everything else gets a mark
  that is honestly its own rather than a guess at
  somebody's trademark.

  THE HOUSE MARK IS NOT A PLACEHOLDER. The old
  fallback was one grey box with four characters too
  small to read, identical for every name — which is
  what "no photo" looked like. This one is a chip in
  the house's own grammar (a tinted ground, a hairline
  edge, the ink at full strength — bg/15, border/30,
  text, the same shape every status pill in the
  terminal wears) with a hue that is STABLE for a
  symbol and spread across the wheel, so two names in
  a list never look alike. The hue is identity, never
  meaning: it is muted well below the vivid bull and
  bear, the way the nav's per-desk inks are.

  ONE BOX, TWO FACES (Noah, 2026-08-30, the open-time
  hop). The glyph and the mark used to be two
  different inline boxes: an <img> has no text
  baseline, a monogram does, so when a missing glyph
  swapped to its tile the table row it sat in shifted
  by a pixel — Multi-Leg's SPY/MU/COIN rows shrinking
  46ms after mount (the 404 round trip) while AAPL
  and TSLA, whose files exist, held. A shared wrapper
  was not enough: the tile's letters still handed the
  cell a text baseline. So the letters are OUT OF
  FLOW — absolutely positioned inside the fixed box —
  and neither face has in-flow text; the box's
  baseline is its bottom edge before and after the
  swap.
==================================================
*/

/** A stable hue for a symbol — FNV-1a over its characters, around the wheel.
    Same symbol, same hue, every session and every page. */
const hueOf = (sym: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < sym.length; i++) {
    h ^= sym.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 360;
};

/* HOW MANY LETTERS THE MARK CARRIES depends on how much room it has. Two
   characters in a 12px box is four pixels of type — mush, and worse than
   nothing. Small marks carry one letter at a size you can actually read;
   from 16px up they carry two. */
const SMALL = 16;

const CompanyLogo = ({ ticker, size = 20, className = '' }: CompanyLogoProps) => {
  const sym = ticker.toUpperCase();
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const failed = failedFor === sym;
  /* The ink holds colours in JS, so it re-reads when the theme moves — the
     house's own rule for exactly this (see theme/theme.ts). */
  const theme = useResolvedTheme();

  const hue = hueOf(sym);
  const letters = (sym.replace(/[^A-Z0-9]/g, '') || '?').slice(0, size < SMALL ? 1 : 2);
  const dark = theme === 'dark';
  const ink = dark ? `hsl(${hue} 62% 74%)` : `hsl(${hue} 64% 33%)`;
  const ground = dark ? `hsl(${hue} 52% 58% / 0.17)` : `hsl(${hue} 58% 46% / 0.11)`;
  const edge = dark ? `hsl(${hue} 52% 60% / 0.42)` : `hsl(${hue} 58% 44% / 0.32)`;

  return (
    <span
      aria-hidden
      /* overflow-hidden is load-bearing: it pins an inline-block's baseline to
         its bottom edge whatever is inside, so the glyph and the mark sit
         identically in a line box — measured, this was the last pixel. */
      className={`relative inline-block align-middle shrink-0 select-none overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      data-mark={failed ? sym : undefined}
    >
      {failed ? (
        <span
          className="absolute inset-0 flex items-center justify-center rounded-[5px] border font-mono font-bold leading-none"
          style={{
            color: ink,
            background: ground,
            borderColor: edge,
            fontSize: Math.max(6, Math.round(size * (size < SMALL ? 0.58 : 0.4))),
            letterSpacing: '-0.03em',
          }}
        >
          {letters}
        </span>
      ) : (
        <img src={`/logos/${sym}.svg`} alt="" draggable={false} onError={() => setFailedFor(sym)} className="block h-full w-full" />
      )}
    </span>
  );
};

export default CompanyLogo;
