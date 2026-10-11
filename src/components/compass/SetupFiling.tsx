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

  A CARD SPEAKS ITS STRUCTURE (2026-10-11, the owner's
  review: a spread wore "SPY 475C", its premium and its
  breaks-below line): the chip names the structure on
  its name in its lean's ink, and the figures are the
  structure's own — a debit spread's debit, max loss and
  max gain, a credit spread's credit and max loss, a
  cash-secured put's credit and cash set aside, a long
  straddle's or strangle's cost — with its breakeven(s)
  in place of the single leg's session line and its
  retire line. Plain arithmetic of the legs, each leg
  priced by the engine (data/compassStandIn.ts).
==================================================
*/

import type { FiledSetup } from '../../data/compassStandIn';
import { EXPIRY_CAT_BY_KEY, KIND_BY_KEY, TAGS, type Setup, type TagKey } from '../../types/compass';
import { expiryLabel, usd, usdCompact } from '../../core/format';
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

// ---- the structure's own words and figures --------------------------------------------------------------------------

/** A single leg — a long call or a long put — keeps the contract's own chip, premium, session line and retire line */
export const isSingleLeg = (f?: FiledSetup | null): boolean => !f || f.structure === 'long-call' || f.structure === 'long-put';

/** The card's name for a setup: the structure on its name, or the contract */
export const structureName = (s: Setup, f?: FiledSetup | null): string => f?.name ?? s.contract;

/** The chip's ink: the structure's lean, or the contract's side */
export const structureTone = (s: Setup, f?: FiledSetup | null): 'bull' | 'bear' | 'neutral' => f?.bias ?? (s.right === 'C' ? 'bull' : 'bear');

/** Which way the setup leans, said in words — the setup's head ("a call, bullish") */
export function leanWords(s: Setup, f?: FiledSetup | null): string {
  if (isSingleLeg(f)) return s.right === 'C' ? 'a call, bullish' : 'a put, bearish';
  const f2 = f as FiledSetup;
  const what = f2.legs.replace(/ [\d./]+$/, '').toLowerCase();
  return `a ${what}, ${f2.bias === 'bull' ? 'bullish' : f2.bias === 'bear' ? 'bearish' : 'for a move either way'}`;
}

export interface StructureStat {
  key: string;
  label: string;
  value: string;
  title: string;
}

const PER_SHARE = 'per share, as a premium is quoted (a contract is 100 shares)';

/** The structure's figures in the order the card prints them; null for a single leg or legs without premium */
export function structureStats(f: FiledSetup): StructureStat[] | null {
  const g = f.figures;
  if (!g) return null;
  switch (g.kind) {
    case 'debit-spread':
      return [
        { key: 'debit', label: 'Net debit', value: usd(g.debit), title: `The bought leg's premium less the sold leg's, ${PER_SHARE}` },
        { key: 'max-loss', label: 'Max loss', value: usd(g.maxLoss), title: `The debit paid, ${PER_SHARE}` },
        { key: 'max-gain', label: 'Max gain', value: usd(g.maxGain), title: `The width between the strikes (${usd(g.width)}) less the debit, ${PER_SHARE}` },
      ];
    case 'credit-spread':
      return [
        { key: 'credit', label: 'Credit', value: usd(g.credit), title: `The sold leg's premium less the bought leg's, ${PER_SHARE}` },
        { key: 'max-loss', label: 'Max loss', value: usd(g.maxLoss), title: `The width between the strikes (${usd(g.width)}) less the credit, ${PER_SHARE}` },
      ];
    case 'cash-secured':
      return [
        { key: 'credit', label: 'Credit', value: usd(g.credit), title: `The sold put's premium, ${PER_SHARE}` },
        { key: 'cash', label: 'Cash set aside', value: usdCompact(g.cash), title: `The strike × 100, per contract: ${usd(g.cash, 0)}` },
      ];
    case 'long-vol':
      return [{ key: 'cost', label: 'Total cost', value: usd(g.cost), title: `The call's premium and the put's together, ${PER_SHARE}` }];
  }
}

/** "Breakeven $476.20" or "Breakevens $468.10 and $481.90" — what the structure's figures stand on at expiry */
export function breakevenWords(f: FiledSetup): { label: string; value: string; title: string } | null {
  const g = f.figures;
  if (!g) return null;
  const two = g.breakevens.length === 2;
  const title =
    g.kind === 'long-vol'
      ? 'At expiry, the stock prices past which the legs are worth more than their cost — the put strike less the cost, the call strike plus it'
      : g.kind === 'debit-spread'
        ? 'At expiry, the stock price where the bought leg is worth the debit paid'
        : 'At expiry, the stock price where the sold put costs back the credit taken — its strike less the credit';
  return { label: two ? 'Breakevens' : 'Breakeven', value: g.breakevens.map(b => usd(b)).join(' and '), title };
}

/** The table's premium cell: a single leg's mid, or what the legs net and which way the money goes */
export function netWords(s: Setup, f?: FiledSetup | null): string {
  const g = f?.figures;
  if (isSingleLeg(f) || !g) return isSingleLeg(f) ? usd(s.mid) : '—';
  if (g.kind === 'debit-spread') return `${usd(g.debit)} debit`;
  if (g.kind === 'long-vol') return `${usd(g.cost)} cost`;
  return `${usd(g.credit)} credit`;
}

/** The legs said plainly, with no figure — for a structure whose legs carry no premium in the data */
export const legsPlain = (f: FiledSetup): string => f.legList.map(l => `${l.side === 'buy' ? 'Buy' : 'Sell'} ${l.strike % 1 === 0 ? l.strike.toFixed(0) : l.strike.toFixed(2)} ${l.right === 'C' ? 'call' : 'put'}`).join(' · ');
