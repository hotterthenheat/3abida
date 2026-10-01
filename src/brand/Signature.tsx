/*
==================================================
  SLAYER TERMINAL - THE SIGNATURE (brand/Signature.tsx)

  "slayer:~ $ ● live" with a hairline under it — "used instead of the logo in headers, footers, loading, end cards"
  (Slayer Logo System). Three state words, never more:

    live      the market is open — the lime dot (on paper the word is the page's black beside it)
    delayed   the feed is behind — the warning ink
    closed    the market is shut — the muted ink

  Unless a caller names one, the word is the market's own (data/marketState.ts), read again every 30 seconds. The UI
  never says simulated, demo or fake (the owner, 2026-10-01).
==================================================
*/

import { useEffect, useState, type ReactNode } from 'react';
import { readMarketState } from '../data/marketState';

export type SignatureState = 'live' | 'delayed' | 'closed';

/** each state's dot — the rail, folded, keeps only this */
export const SIGNATURE_DOT: Record<SignatureState, string> = {
  live: 'rgb(var(--select-fill))',
  delayed: 'rgb(var(--warn))',
  closed: 'rgb(var(--text-muted))',
};
const WORD: Record<SignatureState, string> = {
  live: 'var(--live-ink)',
  delayed: 'rgb(var(--warn))',
  closed: 'rgb(var(--text-muted))',
};

/** The market's word — live while it is open, closed when it is shut */
const useMarketWord = (): SignatureState => {
  const [word, setWord] = useState<SignatureState>(() => readMarketState().word);
  useEffect(() => {
    const id = window.setInterval(() => setWord(readMarketState().word), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return word;
};

interface SignatureProps {
  /** the state word; the market's own when left out */
  state?: SignatureState;
  /** words after the state, in the muted ink ("· v2026.10") */
  detail?: ReactNode;
  /** the hairline under it — on by default, as the Logo System draws it */
  rule?: boolean;
  className?: string;
}

const Signature = ({ state, detail, rule = true, className = '' }: SignatureProps) => {
  const market = useMarketWord();
  const word = state ?? market;
  return (
    <span
      className={`inline-flex items-center gap-[0.6em] font-code whitespace-nowrap leading-none ${rule ? 'pb-[0.55em] border-b border-ink/[0.14]' : ''} ${className}`}
      data-signature={word}
    >
      <span className="text-textPrimary">slayer:~ $</span>
      <span className="inline-flex items-center gap-[0.45em]">
        <span className="w-[0.5em] h-[0.5em] rounded-full shrink-0" style={{ background: SIGNATURE_DOT[word] }} aria-hidden />
        <span style={{ color: WORD[word] }}>{word}</span>
      </span>
      {detail != null && <span className="text-textMuted">{detail}</span>}
    </span>
  );
};

export default Signature;
