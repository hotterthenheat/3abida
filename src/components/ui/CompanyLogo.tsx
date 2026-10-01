import { useState } from 'react';
import LOGO_DARK from '../../data/logoDark.json';

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
   logos:fetch`, docs/logo-sources.md; 148 since 2026-10-01, the owner's sheet adding every name the terminal shows by
   itself); every other name's <img> asked the server,
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

/* A FUND HAS NO COMPANY (Noah, 2026-09-20: "for spy qqq and iwm you decide what fits best") — so a fund wore its letters
   as a solid badge of the page's ink, never asked of the server. THE OWNER'S OWN MARKS SINCE 2026-10-01: the logo sheet
   they drew (Corporate_Brand_Logo_Matrix.pdf — scripts/logo-sheet/) gives SPY, QQQ, IWM, SPX, NDX and RUT their files,
   with the 57 names that wore the grey tile. The badge stays for the funds no sheet has drawn yet. */
const FUND_MARKS = new Set(['DIA', 'VIX']);

/* TWO READINGS OF ONE MARK (2026-10-01). The sheet draws every mark on a coloured square; the marks stand bare here, as
   every logo does (no box round a logo), so a mark that was white on a dark square, or is itself navy or black, has a
   second file for a dark ground — <SYM>-dark.svg, the names in data/logoDark.json (written with the files). Both are laid
   in the box and `--logo-flip` (1 on a dark ground, 0 on a light one, re-scoped by every island) shows one: the same
   switch the deep marks above run on, for marks of more than one colour. */
const DARK_READING = new Set<string>(LOGO_DARK);

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
      ) : DARK_READING.has(sym) ? (
        <>
          <img
            src={`/logos/${sym}.svg`}
            alt=""
            draggable={false}
            onError={() => {
              NO_LOGO.add(sym);
              setFailedFor(sym);
            }}
            className="absolute inset-0 block h-full w-full"
            style={{ opacity: 'calc(1 - var(--logo-flip, 1))' }}
          />
          <img src={`/logos/${sym}-dark.svg`} alt="" draggable={false} className="absolute inset-0 block h-full w-full" style={{ opacity: 'var(--logo-flip, 1)' }} data-logo-mark="dark" />
        </>
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
