import type { ReactNode } from 'react';
import { knownTicker, Name } from './Name';

/*
  RichRead — renders a generated narrative sentence with its meaningful
  tokens lit by the house color code, so the terminal's prose pops the same
  way its panels do. Color = information, never decoration:
    signed %      → bull green-lime / bear red (direction)
    $ amounts, %, ×-counts, tickers → bold white (facts)
    accumulation/support family     → bull   (side)
    distribution/supply family      → bear   (side)
  Data modules keep emitting plain strings — this is presentation only.

  SIGNED DOLLARS AND THE LEAN WORDS joined the grammar on 2026-08-30 (Noah,
  on the 0DTE read: "numbers and important facts should be highlighted in
  whatever color you think is required and the rest be normal") — a signed
  dollar figure is a DIRECTION exactly like a signed percent, and
  bullish/bearish are the side family in their plainest clothes. A bare
  unsigned $ stays a fact in bold white; the sign is what buys the ink.
*/

// All-caps words that are jargon, not tickers — never emphasized as symbols
const JARGON = new Set([
  'GEX', 'VEX', 'DEX', 'DP', 'RSI', 'EMA', 'VWAP', 'OI', 'IV', 'ATS', 'ETF',
  'DTE', 'ATM', 'OTM', 'ITM', 'NBR', 'TP', 'TP1', 'TP2', 'TP3', 'TP4', 'AI',
]);

// NB the multiplier branch: \b works after ascii "x" but never after "×"
// (non-word char), so the two spellings need different right edges.
const TOKEN_RE =
  /([Cc]alls \d+(?:\.\d+)?%|[Pp]uts \d+(?:\.\d+)?%|[+]\$\d[\d,]*(?:\.\d+)?[BMK]?|[−-]\$\d[\d,]*(?:\.\d+)?[BMK]?|[+]\d+(?:\.\d+)?%|[−-]\d+(?:\.\d+)?%|\d+(?:\.\d+)?%|\$\d[\d,]*(?:\.\d+)?[BMK]?|\d+(?:\.\d+)?(?:×|x\b)|\d+ (?:lifting|pressing|positive|negative)\b|(?:[Bb]ullish|[Bb]earish|(?:at|on) the ask|(?:at|on) the bid|[Ll]ifting|[Pp]ressing|[Pp]ositive|[Nn]egative|[Aa]ccumulat(?:ion|ing|ive)|[Aa]bsorbed|[Tt]ailwind|[Bb]uy side|[Dd]istribut(?:ion|ing|ive)|[Ss]ell side|[Hh]eadline risk|[Ss]upport|[Rr]esistance|[Ss]upply)\b|\b[A-Z]{2,5}\b)/;

function classFor(token: string): string | null {
  /* A side SHARE reads as one lit token — "calls 57%" is the tape's lean,
     the same fact the pane headers paint green/red (Noah, 2026-08-30: "do you
     not think these reads are too bland"). Bare counts stay plain: 455
     contracts is arithmetic, not a side. */
  if (/^calls \d/i.test(token)) return 'text-bull font-semibold tnum';
  if (/^puts \d/i.test(token)) return 'text-bear font-semibold tnum';
  if (/^(at|on) the ask$/i.test(token)) return 'text-bull font-medium';
  if (/^(at|on) the bid$/i.test(token)) return 'text-bear font-medium';
  if (/^[+]\$\d/.test(token)) return 'text-bull font-semibold tnum';
  if (/^[−-]\$\d/.test(token)) return 'text-bear font-semibold tnum';
  if (/^bullish$/i.test(token)) return 'text-bull font-medium';
  if (/^bearish$/i.test(token)) return 'text-bear font-medium';
  if (/^[+]\d/.test(token) && token.endsWith('%')) return 'text-bull font-semibold tnum';
  if (/^[−-]\d/.test(token) && token.endsWith('%')) return 'text-bear font-semibold tnum';
  if (/^\d/.test(token) && token.endsWith('%')) return 'font-semibold tnum text-textPrimary';
  if (token.startsWith('$')) return 'font-semibold tnum text-textPrimary';
  if (/^\d+(?:\.\d+)?[×x]$/.test(token)) return 'font-semibold tnum text-textPrimary';
  /* The wire's grade words — positive / negative since 2026-09-09, the older
     lifting / pressing still lit — counts ride along ("11 positive") so the
     figure and its lean read as one lit token. */
  if (/^(\d+ )?(lifting|positive)$/i.test(token)) return 'text-bull font-medium tnum';
  if (/^(\d+ )?(pressing|negative)$/i.test(token)) return 'text-bear font-medium tnum';
  if (/^(accumulat|absorbed|tailwind|buy side|support)/i.test(token)) return 'text-bull font-medium';
  if (/^(distribut|sell side|headline risk|resistance|supply)/i.test(token)) return 'text-bear font-medium';
  if (/^[A-Z]{2,5}$/.test(token)) return JARGON.has(token) ? null : 'font-semibold text-textPrimary';
  return null;
}

/* THE NAME'S MARK (Noah, 2026-09-12: a ticker travels with its logo everywhere,
   prose included) — a caps token the terminal knows as a name renders with
   its mark in front; jargon in caps never does. */
const isName = (token: string): boolean => /^[A-Z]{1,5}$/.test(token) && !JARGON.has(token) && knownTicker(token);

/* CHAMPION MARKUP (Noah, 2026-08-30: the tables crown their single largest in
   magenta, but the sentences saying "The largest:" printed it flat white).
   A generator wraps its champion fact in [[...]] and the whole span renders in
   the supreme register — the one grammar, prose included. Everything outside
   the brackets tokenizes exactly as before. */
const SUPREME_RE = /\[\[(.+?)\]\]/;

const tokenize = (text: string, keyBase: string): ReactNode[] =>
  text.split(TOKEN_RE).map((part, i) => {
    if (part === undefined || part === '') return null;
    const cls = classFor(part);
    if (isName(part))
      return (
        <Name key={`${keyBase}-${i}`} t={part} size={12} className="font-semibold text-textPrimary">
          {part}
        </Name>
      );
    return cls ? (
      <span key={`${keyBase}-${i}`} className={cls}>
        {part}
      </span>
    ) : (
      <span key={`${keyBase}-${i}`}>{part}</span>
    );
  });

const RichRead = ({ text, className }: { text: string; className?: string }) => {
  const chunks = text.split(SUPREME_RE);
  const nodes: ReactNode[] = chunks.map((chunk, i) =>
    i % 2 === 1 ? (
      <span key={`sup-${i}`} className="text-supreme font-bold tnum">
        {chunk}
      </span>
    ) : (
      tokenize(chunk, String(i))
    )
  );
  return <span className={className}>{nodes}</span>;
};

export default RichRead;
