/*
==================================================
  SLAYER TERMINAL - HOW A FIGURE IS SAID (core/format.ts)

  One number-format rule for every room (2026-10-10,
  the audit's formats items — four date styles,
  hyphens for minus, two decimals here and one
  there). The rule:

  - a negative wears the true minus "−" (U+2212),
    never a hyphen
  - a change wears its sign: "+1.2%", "−$310.00";
    nothing at all is unsigned ("0.0%", "$0")
  - dollars: a price or a premium to the cent
    ("$525.20", "$0.05"); a big figure compact to
    three figures ("$1.2M", "$48.3M", "$990M",
    "$4.1B"), whole dollars under a thousand
  - percent: one decimal ("12.3%"), two under 1%
    ("0.46%") where one would round it away
  - greeks: delta 2 decimals, gamma 3, theta in
    dollars a day, vega 2; IV one decimal in %
  - a date "Oct 9", a time "14:03 ET" — New York's
    (core/nyTime.ts)

  A room that rounds on purpose (a share of the time
  "38%", a count "1,240") says so where it does;
  everything else reads off here.
==================================================
*/

import { nyClock, nyDay, nyParts, type At } from './nyTime';

/** The true minus (U+2212) */
export const MINUS = '−';

/** "+", "−" or nothing — the sign a change wears; a figure that rounds to nothing has none */
const signFor = (v: number, shown: string): string => (/[1-9]/.test(shown) ? (v > 0 ? '+' : v < 0 ? MINUS : '') : '');
/** The minus only — a level, not a change */
const minusFor = (v: number, shown: string): string => (v < 0 && /[1-9]/.test(shown) ? MINUS : '');

const grouped = (a: number, digits: number): string => a.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

// ---- plain numbers ---------------------------------------------------------------------------------------------------

/** "1,240" · "−0.54" with `digits` — a count or a level, grouped, with the true minus */
export const num = (v: number, digits = 0): string => {
  const body = grouped(Math.abs(v), digits);
  return `${minusFor(v, body)}${body}`;
};
/** "+1,240" · "−0.50" — a change */
export const numSigned = (v: number, digits = 0): string => {
  const body = grouped(Math.abs(v), digits);
  return `${signFor(v, body)}${body}`;
};
/** "1.2K" · "48.3M" · "845" — a count too big to print whole, three figures at most */
export const numCompact = (v: number): string => {
  const a = Math.abs(v);
  const body = a >= 1e9 ? three(a / 1e9, 'B') : a >= 1e6 ? three(a / 1e6, 'M') : a >= 1e3 ? three(a / 1e3, 'K') : a.toFixed(0);
  return `${minusFor(v, body)}${body}`;
};
/** One decimal under a hundred, none from there — "1.2", "48.3", "990" */
const three = (scaled: number, unit: string): string => `${scaled.toFixed(scaled < 99.95 ? 1 : 0)}${unit}`;

// ---- dollars ---------------------------------------------------------------------------------------------------------

/** "$525.20" · "$0.05" · "−$1,310.00" — a price, a premium, an account, to the cent (`digits` for whole dollars) */
export const usd = (v: number, digits = 2): string => {
  const body = `$${grouped(Math.abs(v), digits)}`;
  return `${minusFor(v, body)}${body}`;
};
/** "+$1,240.50" · "−$310.00" · "$0.00" — money made or lost */
export const usdSigned = (v: number, digits = 2): string => {
  const body = `$${grouped(Math.abs(v), digits)}`;
  return `${signFor(v, body)}${body}`;
};
/** "$1.2M" · "$48.3M" · "$990M" · "$4.1B" · "$845" · "−$2.0M" — a big figure, compact to three figures */
export const usdCompact = (v: number): string => {
  const a = Math.abs(v);
  const body = a >= 1e9 ? `$${three(a / 1e9, 'B')}` : a >= 1e6 ? `$${three(a / 1e6, 'M')}` : a >= 1e3 ? `$${three(a / 1e3, 'K')}` : `$${a.toFixed(0)}`;
  return `${minusFor(v, body)}${body}`;
};
/** "+$1.2M" · "−$310K" · "$0" — a big change */
export const usdCompactSigned = (v: number): string => {
  const body = usdCompact(Math.abs(v));
  return `${signFor(v, body)}${body}`;
};

// ---- percent ---------------------------------------------------------------------------------------------------------

/** Decimals for a percent: one, two under 1% (where one would round 0.46% to 0.5%) */
const pctDigits = (v: number): number => (Math.abs(v) < 0.995 ? 2 : 1);
/** "12.3%" · "0.46%" — `v` in percent (12.3 is 12.3%) */
export const pct = (v: number, digits = pctDigits(v)): string => {
  const body = Math.abs(v).toFixed(digits);
  return `${minusFor(v, body)}${body}%`;
};
/** "+1.2%" · "−0.46%" · "0.00%" — a change in percent */
export const pctSigned = (v: number, digits = pctDigits(v)): string => {
  const body = Math.abs(v).toFixed(digits);
  return `${signFor(v, body)}${body}%`;
};

// ---- greeks and vol --------------------------------------------------------------------------------------------------

/** "0.52" · "−0.48" */
export const fmtDelta = (v: number): string => num(v, 2);
/** "0.012" */
export const fmtGamma = (v: number): string => num(v, 3);
/** "−$4.32/day" — theta as dollars a day on one contract; `unit: false` where the column says "a day" */
export const fmtTheta = (dollarsPerDay: number, opts: { unit?: boolean } = {}): string => `${usd(dollarsPerDay)}${opts.unit === false ? '' : '/day'}`;
/** "0.18" */
export const fmtVega = (v: number): string => num(v, 2);
/** "15.4%" — implied vol from its fraction (0.154) */
export const fmtIv = (fraction: number): string => `${(fraction * 100).toFixed(1)}%`;

// ---- dates and times — New York's ------------------------------------------------------------------------------------

/** "Oct 9" (or "Fri Oct 9") */
export const dayLabel = (at?: At, opts: { weekday?: boolean } = {}): string => nyDay(at, opts);
/** "14:03 ET" */
export const timeLabel = (at?: At): string => nyClock(at, { zone: true });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Oct 9" from a calendar day "2026-10-09" (an expiry, a report) — the day as written, no zone to cross */
export const isoDayLabel = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}` : iso;
};
/** "Oct 9" from an expiry however the data spells it — "2026-10-09", "10/09/2026" (the tape's), "10/09/26" — with the
    year ("Jan 15 '27") only when it is not this one */
export const expiryLabel = (s: string, thisYear = nyParts().year): string => {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s);
  const [y, m, d] = iso ? [+iso[1], +iso[2], +iso[3]] : us ? [us[3].length === 2 ? 2000 + +us[3] : +us[3], +us[1], +us[2]] : [0, 0, 0];
  if (!m || m > 12) return s;
  return `${MONTHS[m - 1]} ${d}${y !== thisYear ? ` \u2019${String(y).slice(2)}` : ''}`;
};
