/*
==================================================
  SLAYER TERMINAL - WHERE A SETUP IS FILED
  (components/compass/SetupFiling.tsx)

  The owner's board (2026-10-11, docs/compass-setups-
  2026-10-11.md): each card says which expiration
  category its contract is in, which structure it is
  ("Debit call spread 475/480"), and its tags —
  Unusual Activity, Penny Precision — each with its
  line under the pointer. The card, the table and a
  setup's own head read the same pieces.
==================================================
*/

import type { FiledSetup } from '../../data/compassStandIn';
import { EXPIRY_CAT_BY_KEY, KIND_BY_KEY, TAGS, type TagKey } from '../../types/compass';
import { expiryLabel } from '../../core/format';
import { isoDate as isoOf } from '../../core/calendar';

/** The expiry chip's words: "0DTE · Today", "0DTE · Next session · Oct 12", "Swing · Nov 20 · 40d", "Long-Dated · LEAPS · Jan 21 '28" */
export function whenWords(f: FiledSetup): string {
  const cat = EXPIRY_CAT_BY_KEY[f.exp.cat].label;
  const date = expiryLabel(isoOf(f.listing.expires));
  if (f.exp.cat === '0dte') return f.exp.next ? `${cat} · Next session · ${date}` : `${cat} · Today`;
  if (f.exp.leaps) return `${cat} · LEAPS · ${date}`;
  return `${cat} · ${date} · ${f.exp.dte}d`;
}

/** The chip's tooltip: what the category means, and the contract's last trading day when it is not the date it lists */
export function whenTitle(f: FiledSetup): string {
  const def = EXPIRY_CAT_BY_KEY[f.exp.cat];
  const parts = [f.exp.cat === '0dte' && f.exp.next ? 'Its last trading day is the next session' : `${def.label}: ${def.line}`];
  if (f.listing.am) parts.push(`AM-settled — it last trades ${expiryLabel(isoOf(f.listing.last))}, the session before its expiration date`);
  parts.push(`${f.exp.dte} ${f.exp.dte === 1 ? 'day' : 'days'} to its last trading day`);
  return parts.join(' · ');
}

/** The kind a setup is shown under when the board lists every kind */
export const kindWords = (f: FiledSetup): string => (f.kinds[0] ? KIND_BY_KEY[f.kinds[0]].label : '');

const CHIP = 'inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] leading-none whitespace-nowrap';

/** One tag, its line under the pointer and for a screen reader */
export const TagChip = ({ tag }: { tag: TagKey }) => (
  <span className={`${CHIP} border-borderMuted text-textPrimary`} title={TAGS[tag].line} data-setup-tag={tag}>
    {TAGS[tag].label}
    <span className="sr-only">: {TAGS[tag].line}</span>
  </span>
);

/** The structure, its notes (AM-settled, one night of risk) and the tags — the card's second line and the setup's head */
export const FilingChips = ({ f, structure = true }: { f: FiledSetup; structure?: boolean }) => (
  <span className="inline-flex flex-wrap items-center gap-1.5 min-w-0" data-setup-filing>
    {structure && (
      <span className={`${CHIP} border-borderSubtle text-textSecondary font-mono`} title="The structure this setup is shown as" data-setup-structure={f.structure}>
        {f.legs}
        {(f.structure === 'long-call' || f.structure === 'long-put') && <span className="text-textMuted">&nbsp;· {f.steady ? 'Steady' : 'Big Payoff'}</span>}
      </span>
    )}
    {f.listing.am && (
      <span className={`${CHIP} border-borderSubtle text-textSecondary`} title={`AM-settled: it last trades ${expiryLabel(isoOf(f.listing.last))}, the session before its expiration date`} data-setup-note="am">
        AM-settled
      </span>
    )}
    {f.exp.overnight && (
      <span className={`${CHIP} border-warn/40 text-warn`} title="One day left: a single night of risk is a big share of its life" data-setup-note="overnight">
        Overnight
        <span className="sr-only">: one day left, a single night of risk is a big share of its life</span>
      </span>
    )}
    {f.tags.map(t => (
      <TagChip key={t} tag={t} />
    ))}
  </span>
);
