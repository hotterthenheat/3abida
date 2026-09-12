/*
==================================================
  SLAYER TERMINAL - CONGRESS (data/congress.ts)

  What members of Congress reported trading under
  the STOCK Act, and how long they took to say so.
  The partner's engine (2026-09-09), ported into
  the house: the shape is the real feed's, the
  people are invented.

  THE PEOPLE ARE INVENTED ON PURPOSE. Every member
  below is fictional — invented names, invented
  districts — because a simulated feed printing
  invented trades under a real legislator's name
  would be a fabricated record about a real person.
  The surface renders the same either way; the
  SHAPE is what it is built against.

  THE SHAPE IS THE REAL ONE (measured by the partner
  against 8,350 Senate and 23,944 House records):
    · amounts are BRACKETS, never a figure — ten
      statutory rungs, and a total is a range with
      a visible low and high
    · an eleventh rung that is not a number: scanned
      filings come through unparsed, and a missing
      amount is a fact about the filing
    · the spouse cap is real — a spouse's or
      dependent's non-joint holding never reports
      above $1,000,000
    · the OWNER is on every row; hiding it is the
      commonest misrepresentation in this category
    · the deadline is 45 days after the trade, late
      is common, and the lag is a column
    · a disclosure can predate the trade on a real
      feed (a filing artefact) — never assume a
      non-negative lag
    · party, chamber and committee are a JOIN from a
      roster, and the committee overlap — a trade
      inside the member's own jurisdiction — is the
      reading this data is actually for

  When the feed lands, MEMBERS becomes a roster and
  buildCongress a fetch; every reading keeps working.
==================================================
*/

import { dayKey, h01 } from '../core/rng';
import { sectorOf } from './darkpool';
import { RECORD_UNIVERSE, recordName } from './recordUniverse';
import type { AmountBracket, AssetKind, CongressFeed, CongressTrade, Member, ReportOwner, ReportType } from '../types/record';

/** The ten statutory rungs, in the form's checkbox order A–J */
export const AMOUNT_BRACKETS: AmountBracket[] = [
  { column: 'A', low: 1_001, high: 15_000, label: '$1,001 – $15,000' },
  { column: 'B', low: 15_001, high: 50_000, label: '$15,001 – $50,000' },
  { column: 'C', low: 50_001, high: 100_000, label: '$50,001 – $100,000' },
  { column: 'D', low: 100_001, high: 250_000, label: '$100,001 – $250,000' },
  { column: 'E', low: 250_001, high: 500_000, label: '$250,001 – $500,000' },
  { column: 'F', low: 500_001, high: 1_000_000, label: '$500,001 – $1,000,000' },
  { column: 'G', low: 1_000_001, high: 5_000_000, label: '$1,000,001 – $5,000,000' },
  { column: 'H', low: 5_000_001, high: 25_000_000, label: '$5,000,001 – $25,000,000' },
  { column: 'I', low: 25_000_001, high: 50_000_000, label: '$25,000,001 – $50,000,000' },
  { column: 'J', low: 50_000_001, high: null, label: 'Over $50,000,000' },
];
/** The highest rung a spouse or dependent may report when not held jointly with the filer (5 U.S.C. 13104(d)(2)) */
export const SPOUSE_CAP_INDEX = 5;
/** The STOCK Act's outer bound: no later than 45 days after the trade */
export const STOCK_ACT_DEADLINE_DAYS = 45;

/* FICTIONAL MEMBERS — see the header. The committee seats are real committee
   NAMES, because the overlap reading only works if the reader recognises the
   jurisdiction. */
export const MEMBERS: Member[] = [
  { id: 'm01', name: 'Rep. Dana Whitlock', chamber: 'House', party: 'D', state: 'CA', district: 'CA-14', committees: ['Energy and Commerce', 'Science, Space and Technology'] },
  { id: 'm02', name: 'Rep. Marcus Reyland', chamber: 'House', party: 'R', state: 'TX', district: 'TX-08', committees: ['Armed Services', 'Appropriations'] },
  { id: 'm03', name: 'Sen. Priya Ashford', chamber: 'Senate', party: 'D', state: 'WA', committees: ['Commerce, Science and Transportation', 'Finance'] },
  { id: 'm04', name: 'Sen. Halloran Beck', chamber: 'Senate', party: 'R', state: 'FL', committees: ['Banking, Housing and Urban Affairs'] },
  { id: 'm05', name: 'Rep. Yvette Corliss', chamber: 'House', party: 'D', state: 'NY', district: 'NY-11', committees: ['Financial Services'] },
  { id: 'm06', name: 'Rep. Theo Vandermere', chamber: 'House', party: 'R', state: 'OH', district: 'OH-03', committees: ['Ways and Means', 'Energy and Commerce'] },
  { id: 'm07', name: 'Sen. Ruth Okonjo-Blaine', chamber: 'Senate', party: 'I', state: 'VT', committees: ['Health, Education, Labor and Pensions'] },
  { id: 'm08', name: 'Rep. Callum Doyle-Frost', chamber: 'House', party: 'R', state: 'PA', district: 'PA-07', committees: ['Transportation and Infrastructure'] },
  { id: 'm09', name: 'Sen. Marisol Trevino', chamber: 'Senate', party: 'D', state: 'AZ', committees: ['Armed Services', 'Intelligence'] },
  { id: 'm10', name: 'Rep. Bennett Ashgrove', chamber: 'House', party: 'D', state: 'IL', district: 'IL-05', committees: ['Agriculture'] },
  { id: 'm11', name: 'Sen. Idris Falconer', chamber: 'Senate', party: 'R', state: 'GA', committees: ['Energy and Natural Resources', 'Finance'] },
  { id: 'm12', name: 'Rep. Simone Ashby-Hale', chamber: 'House', party: 'D', state: 'MA', district: 'MA-02', committees: ['Science, Space and Technology'] },
];

/* WHICH COMMITTEE OVERSEES WHICH SECTOR, in the terminal's own sector names
   (data/darkpool.ts). Deliberately conservative — a committee is listed only
   where the jurisdiction is uncontroversial, because a false overlap is an
   accusation. */
const COMMITTEE_SECTORS: Record<string, string[]> = {
  'Energy and Commerce': ['Energy', 'Healthcare', 'Utilities', 'Communication Services'],
  'Science, Space and Technology': ['Technology'],
  'Armed Services': ['Industrials'],
  'Financial Services': ['Financial Services', 'Real Estate'],
  'Banking, Housing and Urban Affairs': ['Financial Services', 'Real Estate'],
  'Commerce, Science and Transportation': ['Technology', 'Communication Services', 'Industrials'],
  'Energy and Natural Resources': ['Energy', 'Basic Materials', 'Utilities'],
  'Health, Education, Labor and Pensions': ['Healthcare'],
  'Ways and Means': ['Financial Services', 'Healthcare'],
  'Transportation and Infrastructure': ['Industrials'],
  Agriculture: ['Consumer Defensive', 'Basic Materials'],
  Finance: ['Financial Services'],
  Appropriations: [],
  Intelligence: ['Technology'],
};

const OWNERS: ReportOwner[] = ['Self', 'Spouse', 'Joint', 'Dependent'];

/** Which committee of this member's, if any, oversees this name's sector */
export function overlapFor(member: Member, ticker: string): string | null {
  const sector = sectorOf(ticker)?.sector;
  if (!sector) return null;
  for (const c of member.committees) if ((COMMITTEE_SECTORS[c] ?? []).includes(sector)) return c;
  return null;
}

/** A bracket's label, with the unparsed case named rather than blanked */
export const bracketLabel = (i: number | null): string => (i === null ? 'not disclosed' : AMOUNT_BRACKETS[i].label);

export const EMPTY_CONGRESS: CongressFeed = { trades: [], totalLow: 0, totalHigh: 0, unknownAmounts: 0, purchases: 0, sales: 0, lateFilings: 0, overlaps: 0, medianLag: 0, windowDays: 0 };

/** The disclosure feed for a window of days — deterministic per session day */
export function buildCongress(windowDays = 90, day = dayKey(), count = Math.round(windowDays * 0.5)): CongressFeed {
  if (!(windowDays > 0) || count <= 0) return { ...EMPTY_CONGRESS, windowDays };
  const trades: CongressTrade[] = [];
  for (let i = 0; i < count; i++) {
    const s = `${day}|cong|${i}`;
    const member = MEMBERS[Math.floor(h01(`${s}|m`) * MEMBERS.length)];
    const u = RECORD_UNIVERSE[Math.floor(h01(`${s}|t`) * RECORD_UNIVERSE.length)];
    const owner = OWNERS[Math.floor(h01(`${s}|o`) * OWNERS.length)];
    /* Purchases are the minority of disclosed volume, as on the real feed */
    const tr = h01(`${s}|ty`);
    const type: ReportType = tr < 0.46 ? 'Purchase' : tr < 0.72 ? 'Sale (Full)' : tr < 0.97 ? 'Sale (Partial)' : 'Exchange';
    /* The amount ladder with the real feed's shape: the small rungs carry most rows, the top ones are rare, and the open-ended top rung is reachable */
    const ar = h01(`${s}|a`);
    let bracket: number | null;
    if (ar < 0.055) bracket = null;
    else if (ar < 0.62) bracket = 0;
    else if (ar < 0.79) bracket = 1;
    else if (ar < 0.865) bracket = 2;
    else if (ar < 0.915) bracket = 3;
    else if (ar < 0.947) bracket = 4;
    else if (ar < 0.972) bracket = 5;
    else if (ar < 0.988) bracket = 6;
    else if (ar < 0.994) bracket = 7;
    else if (ar < 0.998) bracket = 8;
    else bracket = 9;
    /* The spouse cap pulls the rung down rather than dropping the row — what the statute does */
    if (bracket !== null && (owner === 'Spouse' || owner === 'Dependent') && bracket > SPOUSE_CAP_INDEX) bracket = SPOUSE_CAP_INDEX;
    /* Lag: a median near nine days, a long tail past the 45-day bound, a thin slice of negative lags */
    const lr = h01(`${s}|l`);
    let lagDays: number;
    if (lr < 0.02) lagDays = -Math.floor(h01(`${s}|ln`) * 20) - 1;
    else if (lr < 0.72) lagDays = Math.floor(h01(`${s}|l1`) * 18) + 1;
    else if (lr < 0.94) lagDays = Math.floor(h01(`${s}|l2`) * 27) + 18;
    else lagDays = Math.floor(h01(`${s}|l3`) * 300) + 46;
    /* The FILING is the event this feed carries: it is drawn first, and the
       trade sits behind it by the lag; a negative lag is pushed back far
       enough that both dates are in the past */
    const floor = lagDays < 0 ? -lagDays : 0;
    const filedDaysAgo = floor + Math.floor(h01(`${s}|d`) * Math.max(1, windowDays - floor));
    const tradedDaysAgo = filedDaysAgo + lagDays;
    /* With an equity universe the only honest kinds are the equity ones */
    const assetKind: AssetKind = h01(`${s}|k`) < 0.93 ? 'Stock' : 'Stock Option';
    trades.push({
      id: s,
      member,
      ticker: u.ticker,
      assetDescription: `${recordName(u.ticker)} (${u.ticker})`,
      assetKind,
      type,
      owner,
      bracket,
      lagDays,
      tradedDaysAgo,
      filedDaysAgo,
      late: lagDays > STOCK_ACT_DEADLINE_DAYS,
      committeeOverlap: overlapFor(member, u.ticker),
    });
  }
  /* Newest filing first, the way a filings feed reads */
  trades.sort((a, b) => a.filedDaysAgo - b.filedDaysAgo);
  return summariseCongress(trades, windowDays);
}

/** The feed's figures over any set of reports — the page re-sums whatever its cards leave */
export function summariseCongress(trades: CongressTrade[], windowDays: number): CongressFeed {
  let totalLow = 0;
  let totalHigh: number | null = 0;
  let unknownAmounts = 0;
  let purchases = 0;
  let sales = 0;
  let lateFilings = 0;
  let overlaps = 0;
  for (const t of trades) {
    if (t.bracket === null) unknownAmounts += 1;
    else {
      const b = AMOUNT_BRACKETS[t.bracket];
      totalLow += b.low;
      /* An open-ended top rung makes the ceiling unknowable — null, not a guess */
      if (totalHigh !== null) totalHigh = b.high === null ? null : totalHigh + b.high;
    }
    if (t.type === 'Purchase') purchases += 1;
    else if (t.type !== 'Exchange') sales += 1;
    if (t.late) lateFilings += 1;
    if (t.committeeOverlap) overlaps += 1;
  }
  const lags = trades.map(t => t.lagDays).sort((a, b) => a - b);
  const medianLag = lags.length === 0 ? 0 : lags[Math.floor(lags.length / 2)];
  return { trades, totalLow, totalHigh, unknownAmounts, purchases, sales, lateFilings, overlaps, medianLag, windowDays };
}

const fmtMoney = (v: number) => `$${v.toLocaleString('en-US')}`;

/** The feed's sentence — the brackets summed, the overlap named, the late ones counted */
export function congressSentence(f: CongressFeed): string {
  if (f.trades.length === 0) return `No reports filed in the last ${f.windowDays} days.`;
  const range = f.totalHigh === null ? `at least ${fmtMoney(f.totalLow)}` : `between ${fmtMoney(f.totalLow)} and ${fmtMoney(f.totalHigh)}`;
  const parts = [`${f.trades.length} reports covering ${range} — the brackets summed, not a point estimate.`];
  if (f.overlaps > 0) parts.push(`${f.overlaps} sit inside the member's own committee jurisdiction, which is the reading this data is for.`);
  if (f.lateFilings > 0) parts.push(`${f.lateFilings} missed the 45-day deadline.`);
  if (f.unknownAmounts > 0) parts.push(`${f.unknownAmounts} carried no amount the filing could be read for.`);
  return parts.join(' ');
}
