/*
==================================================
  SLAYER TERMINAL - THE SIGNATURE (brand/Signature.tsx)

  "slayer:~ $ ● simulated" with a hairline under it — "used instead of the logo in headers, footers, loading, end
  cards" (Slayer Logo System). Four state words, never more:

    live       the feed is live — the lime dot (on paper the word is the page's black beside it)
    delayed    the feed is behind — the warning ink
    closed     the market is shut — the muted ink
    simulated  the data is the simulator's — the silver ink (#C7D3E8, #3A4F7A on paper)

  "Public material says simulated until the data contract is signed": everything in this build says simulated.
==================================================
*/

import type { ReactNode } from 'react';

export type SignatureState = 'live' | 'delayed' | 'closed' | 'simulated';

const DOT: Record<SignatureState, string> = {
  live: 'rgb(var(--select-fill))',
  delayed: 'rgb(var(--warn))',
  closed: 'rgb(var(--text-muted))',
  simulated: 'rgb(var(--silver))',
};
const WORD: Record<SignatureState, string> = {
  live: 'var(--live-ink)',
  delayed: 'rgb(var(--warn))',
  closed: 'rgb(var(--text-muted))',
  simulated: 'rgb(var(--silver))',
};

interface SignatureProps {
  state?: SignatureState;
  /** words after the state, in the muted ink ("· demo feed · v2026.09") */
  detail?: ReactNode;
  /** the hairline under it — on by default, as the Logo System draws it */
  rule?: boolean;
  className?: string;
}

const Signature = ({ state = 'simulated', detail, rule = true, className = '' }: SignatureProps) => (
  <span
    className={`inline-flex items-center gap-[0.6em] font-code whitespace-nowrap leading-none ${rule ? 'pb-[0.55em] border-b border-ink/[0.14]' : ''} ${className}`}
    data-signature={state}
  >
    <span className="text-textPrimary">slayer:~ $</span>
    <span className="inline-flex items-center gap-[0.45em]">
      <span className="w-[0.5em] h-[0.5em] rounded-full shrink-0" style={{ background: DOT[state] }} aria-hidden />
      <span style={{ color: WORD[state] }}>{state}</span>
    </span>
    {detail != null && <span className="text-textMuted">{detail}</span>}
  </span>
);

export default Signature;
