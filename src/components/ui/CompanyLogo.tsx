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
/* A NAME WITH NO LOGO IS ASKED FOR ONCE (2026-09-19). Seventeen names had a file then (85 since 2026-09-20 — `npm run
   logos:fetch`, docs/logo-sources.md); every other name's <img> asked the server,
   got nothing, and fell back to the letters — and did so again for EVERY row and EVERY mount that showed the name (a tape of
   SPY prints is hundreds of wasted requests on a phone's connection). The names that failed are remembered for the session,
   so the letters draw at once and the request is never repeated. */
const NO_LOGO = new Set<string>();

/* A MARK THAT HAS TO ANSWER TO THE GROUND (2026-09-20, found while adding Microsoft, Oracle and Coinbase). An <img> cannot
   read the page — its colour is baked into the file — and two kinds of brand cannot live with that:
     · AN INK MARK — a brand that IS black (Apple). Its file was flipped to white for the dark canvas, and on the light page
       it was a white apple on white paper: gone.
     · A DEEP MARK — a brand so dark it sinks on black (Bank of America's navy #012169: right on paper, all but invisible on
       the dark canvas — the same "near-black flips to white" rule, a brand it had missed; Boeing's blue #1D439C is the same
       story, a faint thread on black).
   So these few are drawn as a MASK — the file gives the SHAPE, the page gives the COLOUR: an ink mark is the page's own
   ink (`--text-primary`, which on the dark terminal is #ededed, the very colour the file carried — dark is unmoved to the
   digit), a deep mark is its brand colour where the ground is light and the page's ink where it is dark (`--logo-flip`,
   tokens.css). Both tokens are re-scoped by the chart's chrome, so a mark inside a dark chart on a light page is still
   right. Every other brand keeps its own colour on any ground, as an <img>. A name listed here MUST have a file: a mask
   has no onError, so a missing file would draw nothing. */
/* The lists grew with the fetched set (scripts/fetch-logos.mjs), each one LOOKED AT on both grounds at 16px: black brands
   (Nike, Palantir, Uber, UPS, Roblox, Lucid, Rivian) and the navies and deep purples that sink on black. A name
   goes here only when its file is ONE colour — a mask keeps the shape and throws the colours away (Citi's red arc, PayPal's
   two blues and Pepsi's globe stay an <img> for that reason). */
const INK_MARKS = new Set(['AAPL', 'NKE', 'PLTR', 'UBER', 'UPS', 'RBLX', 'LCID', 'RIVN']);
const DEEP_MARKS: Record<string, string> = {
  BAC: '#012169',
  BA: '#1D439C',
  ABBV: '#071D49',
  V: '#1A1F71',
  F: '#00274E',
  DAL: '#003366',
  SMCI: '#151F6D',
  FDX: '#4D148C',
  MDLZ: '#4F2170',
};

/* A FUND HAS NO COMPANY (Noah, 2026-09-20: "for spy qqq and iwm you decide what fits best"). SPY is not State Street's
   logo to a trader, QQQ is not Invesco's — nobody would know either at 16px, and the issuers' marks are long wordmarks.
   THE TICKER IS THE MARK: the three letters ARE what everyone reads. So a fund keeps its letters, but as a badge that
   was MEANT — the page's ink as a solid tile with the letters cut out of it — where a name we simply have no file for
   wears the quiet grey tile. It is the list's anchor, and it is never asked of the server. */
const FUND_MARKS = new Set(['SPY', 'QQQ', 'IWM', 'DIA', 'SPX', 'NDX', 'RUT', 'VIX']);

const CompanyLogo = ({ ticker, size = 20, className = '' }: CompanyLogoProps) => {
  const sym = ticker.toUpperCase();
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const fund = FUND_MARKS.has(sym);
  const failed = fund || failedFor === sym || NO_LOGO.has(sym);
  const deep = DEEP_MARKS[sym];
  const masked = deep !== undefined || INK_MARKS.has(sym);
  const shape = `url(/logos/${sym}.svg) center / contain no-repeat`;

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
          className={`absolute inset-0 flex items-center justify-center rounded-[5px] font-mono font-bold leading-none ${fund ? 'bg-textPrimary text-canvas' : 'border border-borderMuted bg-ink/[0.05] text-textPrimary'}`}
          data-logo-mark={fund ? 'fund' : undefined}
          style={{
            fontSize: Math.max(7, Math.round(size * (sym.length > 3 ? 0.26 : 0.34))),
            letterSpacing: '-0.02em',
          }}
        >
          {sym.slice(0, 4)}
        </span>
      ) : masked ? (
        <span
          className="block h-full w-full"
          style={{
            WebkitMask: shape,
            mask: shape,
            background: deep ? `color-mix(in srgb, rgb(var(--text-primary)) calc(var(--logo-flip, 1) * 100%), ${deep})` : 'rgb(var(--text-primary))',
          }}
          data-logo-mark={deep ? 'deep' : 'ink'}
        />
      ) : (
        <img
          src={`/logos/${sym}.svg`}
          alt=""
          draggable={false}
          onError={() => {
            NO_LOGO.add(sym);
            setFailedFor(sym);
          }}
          className="block h-full w-full"
        />
      )}
    </span>
  );
};

export default CompanyLogo;
