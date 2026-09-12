import React from 'react';

/**
 * Lowercase Greek survives `text-transform: uppercase`.
 *
 * CSS uppercasing does not skip Greek: θ becomes Θ, which in a monospace face
 * is indistinguishable from a zero — so "θ / day" painted as "0 / DAY" and a
 * trader could read it as zero theta. σ became Σ and γ became Γ the same way.
 * (Δ is unharmed; it is already uppercase.)
 *
 * Rather than patch each call site, labels run through this, so any label
 * written later is protected too. Only lowercase Greek is wrapped, so the
 * surrounding Latin still uppercases normally.
 */
const GREEK = /[α-ω]/;
const GREEK_RUN = /([α-ω]+)/;

export function preserveGreek(node: React.ReactNode): React.ReactNode {
  if (typeof node !== 'string' || !GREEK.test(node)) return node;
  return node
    .split(GREEK_RUN)
    .map((part, i) =>
      GREEK.test(part) ? (
        <span key={i} className="normal-case">
          {part}
        </span>
      ) : (
        part
      )
    );
}
