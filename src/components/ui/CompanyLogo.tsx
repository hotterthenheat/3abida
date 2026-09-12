import { useState } from 'react';

interface CompanyLogoProps {
  ticker: string;
  /** Square edge in px */
  size?: number;
  className?: string;
}

/*
  Company mark for any ticker. Tries the real brand glyph first
  (public/logos/{TICKER}.svg — simple-icons set with each brand's OFFICIAL
  color baked into the file; near-black brands flip to white so nothing
  vanishes on the dark canvas), and falls back to a house-styled monogram
  tile for names we don't carry art for. Expanding coverage = dropping
  another SVG in the folder; no code changes.

  ONE BOX, TWO FACES (Noah, 2026-08-30, the open-time hop). The glyph and
  the monogram used to be two different inline boxes: an <img> has no text
  baseline, the monogram does, so when a missing glyph swapped to its tile
  the table row it sat in shifted by a pixel — Multi-Leg's SPY/MU/COIN rows
  shrinking 46ms after mount (the 404 round trip) while AAPL and TSLA, whose
  files exist, held. A shared wrapper was not enough: the tile's letters
  still handed the cell a text baseline. So the letters are OUT OF FLOW —
  absolutely positioned inside the fixed box — and neither face has in-flow
  text; the box's baseline is its bottom edge before and after the swap.
*/
const CompanyLogo = ({ ticker, size = 20, className = '' }: CompanyLogoProps) => {
  const sym = ticker.toUpperCase();
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const failed = failedFor === sym;

  return (
    <span
      aria-hidden
      /* overflow-hidden is load-bearing: it pins an inline-block's baseline to
         its bottom edge whatever is inside, so the glyph and the tile sit
         identically in a line box — measured, this was the last pixel. */
      className={`relative inline-block align-middle shrink-0 select-none overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      {failed ? (
        <span
          className="absolute inset-0 flex items-center justify-center rounded-[5px] border border-borderMuted bg-ink/[0.05] font-mono font-bold text-textPrimary leading-none"
          style={{
            fontSize: Math.max(7, Math.round(size * (sym.length > 3 ? 0.26 : 0.34))),
            letterSpacing: '-0.02em',
          }}
        >
          {sym.slice(0, 4)}
        </span>
      ) : (
        <img
          src={`/logos/${sym}.svg`}
          alt=""
          draggable={false}
          onError={() => setFailedFor(sym)}
          className="block h-full w-full"
        />
      )}
    </span>
  );
};

export default CompanyLogo;
