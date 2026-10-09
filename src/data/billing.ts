/*
==================================================
  SLAYER TERMINAL - BILLING'S SEAM (data/billing.ts)

  What the Billing page reads: the plan, its
  standing, the card behind it, the invoices. THE
  SHAPE our server will hand back from Stripe
  (the customer, the subscription, the payment
  method, the invoice list) — never card numbers:
  Stripe's hosted Checkout takes a new card and
  Stripe's Customer Portal changes it, sees the
  invoices and cancels; this page shows what
  Stripe knows and opens those two doors. Until
  the keys are in (roadmap step 5) the state is a
  sample on this machine, so the page is the
  launch page, not a placeholder (Noah,
  2026-09-12: "the preview of how things would
  look after apis are plugged in and stripe is
  purchased").
==================================================
*/

import { useSyncExternalStore } from 'react';

export type PlanKey = 'pinpoint' | 'compass' | 'lifetime';

/** The tiers as the landing prices them. Noah, 2026-09-19: Pinpoint $75 and Compass $180 (they were $125 and $275).
    Each plan's line is the Logo System's (Web and App · Pricing, 2026-09-30). */
export const PLANS: { key: PlanKey; name: string; kicker: string; price: string; period: string; monthly: number | null }[] = [
  { key: 'pinpoint', name: 'Pinpoint', kicker: 'Where dealer hedging holds and pushes price.', price: '$75', period: '/ month', monthly: 75 },
  { key: 'compass', name: 'Compass', kicker: 'Contracts that fit the levels right now.', price: '$180', period: '/ month', monthly: 180 },
  { key: 'lifetime', name: 'Lifetime', kicker: 'One payment, every desk, for good.', price: 'Custom', period: 'one payment', monthly: null },
];
export const planOf = (key: PlanKey) => PLANS.find(p => p.key === key) ?? PLANS[1];

/** Stripe's standings for a plan, less the trial's: there is no trial — an account is free and a plan is paid for (the
    owner, 2026-10-01) */
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled';

export interface Invoice {
  id: string;
  /** ISO date */
  date: string;
  plan: PlanKey;
  amount: number;
  status: 'paid' | 'open' | 'void';
}

export interface Billing {
  plan: PlanKey;
  status: SubscriptionStatus;
  /** ISO date — the next charge, or the end of a canceled term */
  renewsOn: string;
  /** what Stripe shows of the card, never the number */
  card: { brand: string; last4: string; expMonth: number; expYear: number } | null;
  invoices: Invoice[];
}

const KEY = 'slayer_billing';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthsFrom = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return iso(d);
};

/** The sample: on Compass since four months, renewing in a month, a Visa on file */
export const SAMPLE_BILLING: Billing = {
  plan: 'compass',
  status: 'active',
  renewsOn: monthsFrom(1),
  /* not 4242 — the card every payment test uses, which read as nobody's (the audit's X7.13) */
  card: { brand: 'Visa', last4: '7310', expMonth: 8, expYear: 2028 },
  invoices: [0, -1, -2, -3].map((m, i) => ({ id: `in_${1000 - i}`, date: monthsFrom(m), plan: 'compass' as const, amount: planOf('compass').monthly ?? 0, status: 'paid' as const })),
};

let billing: Billing = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return SAMPLE_BILLING;
    const b = JSON.parse(raw) as Partial<Billing>;
    return { ...SAMPLE_BILLING, ...b, invoices: SAMPLE_BILLING.invoices };
  } catch {
    return SAMPLE_BILLING;
  }
})();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

const keep = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ plan: billing.plan, status: billing.status, renewsOn: billing.renewsOn, card: billing.card }));
  } catch {
    /* storage off — the choice lives for the session */
  }
  listeners.forEach(fn => fn());
};

/** A plan switch — Stripe Checkout (up) or the Portal (down) once the keys are in; on this machine it moves at once */
export function setPlan(plan: PlanKey): void {
  billing = { ...billing, plan, status: 'active' };
  keep();
}

/** Renew at the end of the term, or let it end (Settings › Billing's "Renews" switch, the notices' Renew and Restart) */
export function setRenewing(on: boolean): void {
  billing = { ...billing, status: on ? 'active' : 'canceled' };
  keep();
}

/** The card's face — its brand, last four and expiry; the number itself is never kept */
export function setCard(card: Billing['card']): void {
  billing = { ...billing, card, status: billing.status === 'past_due' ? 'active' : billing.status };
  keep();
}

/** A card number's brand by its first digits — what the receipt and the row print */
export function cardBrand(digits: string): string {
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^6(011|5)/.test(digits)) return 'Discover';
  return 'Card';
}

/** Luhn's check — a number typed wrong by a digit is caught here */
export function luhnOk(digits: string): boolean {
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export const useBilling = (): Billing => useSyncExternalStore(subscribe, () => billing, () => SAMPLE_BILLING);

/** "Oct 12, 2026" */
export function fmtDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
