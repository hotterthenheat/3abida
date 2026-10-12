/*
==================================================
  SLAYER TERMINAL - THE DOSSIER, READ FROM THE FEED
  (data/feed/dossier.ts)

  THE DOSSIER IS THE FIRST ROOM MOVED (2026-10-12).
  When rooms.ts says 'feed' for it, its pages read
  these hooks in place of the house's books, and every
  answer is mapped onto the row types the pages already
  draw (types/record.ts, data/earnings.ts), so the
  grids, the cards, the filters and the doors keep
  working. A field the page shows that no answer
  carries is NaN (a figure) or empty (a word), and the
  page draws it "—" with "not in the feed"
  (components/record/Missing.tsx) — never a figure of
  ours beside the vendor's.

    Congress   UW /api/congress/recent-trades, paged
               back by trade date
    Insiders   UW /api/insider/transactions, paged
    Earnings   UW /api/earnings/premarket|afterhours
               for each day of the fortnight, and
               /api/earnings/{ticker} for a name
    Stocks     UW stock-state for the list's prices,
               UW quote for a name's; Massive's ticker
               record for the OPEN name only (five
               calls a minute: one record a name,
               cached a day by the proxy; one bar
               series a name, half an hour)
    News       UW /api/news/headlines

  Dates are New York's calendar days as filed; a
  count of days is counted on New York's calendar.
==================================================
*/

import { nyIsoDate, nyParts } from '../../core/nyTime';
import { AMOUNT_BRACKETS, STOCK_ACT_DEADLINE_DAYS, bracketOf } from '../congress';
import { TX_CODES, flowFrom, isChosenBuy } from '../insiders';
import type { EarningsDossier, EarningsEvent, EarningsQuarter, ReportSlot } from '../earnings';
import type { Sector } from '../universe';
import type { AssetKind, Chamber, CongressTrade, InsiderFlow, InsiderRole, InsiderTrade, PlanState, ReportOwner, ReportType, TxCode } from '../../types/record';
import type { FeedResult } from './client';
import { useFeedPoll } from './poll';
import { ROOM_FEEDS, roomSource } from './rooms';
import { getFeedStatus, useFeedStatus } from './status';
import { uwCongressTrades, uwEarningsDay, uwEarningsFor, uwInsiderTrades, uwNewsHeadlines, uwQuote, uwStockState, type UwCongressTrade, type UwEarning, type UwHeadline, type UwInsiderTrade, type UwQuote, type UwStockState } from './uw';
import { massiveBars, massiveTickerDetails, type MassiveBar, type MassiveTickerDetails } from './massive';

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;

/* ---- which book the room reads ---------------------------------------------------------------------------------- */

/**
 * True when the Dossier reads the feed (rooms.ts: wired, every vendor up) — and while the shell's first probe is still
 * out, so a page waits on its skeleton rather than drawing the house's book for a moment and then the vendor's.
 */
export function useDossierFeed(): boolean {
  const s = useFeedStatus();
  if (!ROOM_FEEDS.dossier.wired) return false;
  if (ROOM_FEEDS.dossier.needs.some(p => s[p].state === 'unknown')) return true;
  return roomSource('dossier', s) === 'feed';
}

/** Ask the vendors only once the probe says they are up — a pending page waits on its skeleton and asks nothing */
const up = (): boolean => roomSource('dossier', getFeedStatus()) === 'feed';

/* ---- New York's calendar ------------------------------------------------------------------------------------- */

const dayNum = (iso: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86_400_000 : NaN;
};
/** Today in New York, "2026-10-12" */
export const nyToday = (): string => nyIsoDate();
/** Calendar days from `iso` to today in New York — positive in the past, negative ahead; NaN without a date */
export const daysSince = (iso: string, today = nyToday()): number => dayNum(today) - dayNum(iso);
const isoOfNum = (n: number): string => new Date(n * 86_400_000).toISOString().slice(0, 10);
/** The calendar day `n` days from `iso` */
export const isoPlus = (iso: string, n: number): string => isoOfNum(dayNum(iso) + n);
const weekdayOf = (iso: string): number => new Date(dayNum(iso) * 86_400_000).getUTCDay();
/** Weekdays from today to `iso` (0 = today) — the sessions to a report, holidays not known to the feed */
const sessionsTo = (iso: string, today = nyToday()): number => {
  let n = 0;
  for (let d = dayNum(today); d < dayNum(iso); d++) {
    const wd = new Date((d + 1) * 86_400_000).getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
};
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** "Tue 10/13" — the calendar's own label (data/earnings.ts labelFor) */
const labelOf = (iso: string): string => `${WD[weekdayOf(iso)]} ${iso.slice(5, 7)}/${iso.slice(8, 10)}`;

/* ---- Congress ------------------------------------------------------------------------------------------------- */

const CHAMBER: Record<string, Chamber> = { house: 'House', senate: 'Senate', executive: 'Executive' };
const OWNER: Record<string, ReportOwner> = { self: 'Self', spouse: 'Spouse', joint: 'Joint', child: 'Dependent', dependent: 'Dependent', undisclosed: 'Undisclosed' };
/* the House's asset codes as the filing writes them, "[ST]" */
const ASSET: Record<string, AssetKind> = { ST: 'Stock', OP: 'Stock Option', CS: 'Corporate Bond', GS: 'Government Security', MF: 'Fund', EF: 'Fund', HN: 'Fund', CT: 'Crypto' };

const assetOf = (notes: string, ticker: string): AssetKind => {
  const code = /\[([A-Z]{2})\]/.exec(notes)?.[1];
  if (code && ASSET[code]) return ASSET[code];
  return ticker ? 'Stock' : 'Other';
};
const typeOf = (txn: string, notes: string): ReportType => {
  const t = txn.trim().toLowerCase();
  if (t === 'buy' || t === 'purchase') return 'Purchase';
  if (t.startsWith('sell') || t.startsWith('sale')) return /\(partial\)|partial/i.test(`${txn} ${notes}`) ? 'Sale (Partial)' : 'Sale (Full)';
  return 'Exchange';
};
/** The member's name as the filing's reporter carries it, the courtesy title off ("Hon. Josh Gottheimer") */
const memberName = (r: UwCongressTrade): string => r.reporter.replace(/^Hon\.?\s+/i, '').trim() || r.name;
/** The asset as filed, its first line, the codes off */
const assetWords = (notes: string): string => notes.split('\n')[0].replace(/\s*\[[A-Z]{2}\].*$/, '').trim();

export function congressRow(r: UwCongressTrade, today: string, n = 0): CongressTrade {
  const ticker = r.ticker.trim().toUpperCase();
  const filedDaysAgo = daysSince(r.filedAt, today);
  const tradedDaysAgo = daysSince(r.transactionDate, today);
  const lagDays = tradedDaysAgo - filedDaysAgo;
  const type = typeOf(r.txnType, r.notes);
  return {
    id: `${r.politicianId}|${r.transactionDate}|${r.filedAt}|${ticker || assetWords(r.notes).slice(0, 32)}|${r.amounts}|${type}|${n}`,
    member: { id: r.politicianId || r.name, name: memberName(r), chamber: CHAMBER[r.memberType.toLowerCase()] ?? 'House', party: null, state: '', committees: [] },
    ticker,
    assetDescription: assetWords(r.notes) || r.notes,
    assetKind: assetOf(r.notes, ticker),
    type,
    owner: OWNER[r.owner.toLowerCase()] ?? 'Undisclosed',
    bracket: bracketOf(r.amounts),
    lagDays: Number.isFinite(lagDays) ? lagDays : 0,
    tradedDaysAgo: Number.isFinite(tradedDaysAgo) ? tradedDaysAgo : 0,
    filedDaysAgo: Number.isFinite(filedDaysAgo) ? filedDaysAgo : 0,
    late: lagDays > STOCK_ACT_DEADLINE_DAYS,
    /* committee seats are not in the feed — the page says so */
    committeeOverlap: null,
    filedOn: r.filedAt,
    tradedOn: r.transactionDate,
  };
}

/** Rows to CongressTrades, each id once (the same filing can list one trade twice) */
export function congressRows(rows: UwCongressTrade[], today = nyToday()): CongressTrade[] {
  const seen = new Map<string, number>();
  return rows.map(r => {
    const base = `${r.politicianId}|${r.transactionDate}|${r.filedAt}|${r.ticker}|${r.amounts}|${r.txnType}|${r.notes.slice(0, 32)}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return congressRow(r, today, n);
  });
}

export interface CongressAnswer {
  trades: CongressTrade[];
  /** The earliest trade day the pages asked reached, "2026-08-26" */
  reach: string;
  /** Rows read */
  read: number;
}

/** Pages back by trade date: 200 rows a page reach about a week of trades (2026-10-12) */
const CONGRESS_PAGES: Record<number, number> = { 30: 2, 90: 4, 180: 6 };

async function loadCongress(windowDays: number): Promise<FeedResult<CongressAnswer>> {
  const today = nyToday();
  const all: UwCongressTrade[] = [];
  let date: string | undefined;
  let at = Date.now();
  const pages = CONGRESS_PAGES[windowDays] ?? 2;
  for (let p = 0; p < pages; p++) {
    const r = await uwCongressTrades({ limit: 200, date });
    if (!r.ok) {
      if (p === 0) return r;
      break;
    }
    at = r.at;
    all.push(...r.data);
    if (r.data.length < 200) break;
    const oldest = r.data.reduce((m, x) => (x.transactionDate && x.transactionDate < m ? x.transactionDate : m), '9999-12-31');
    /* the next page: the trades the day before the oldest here (a day cut in two at the page's edge loses its rest) */
    date = isoPlus(oldest, -1);
    /* far enough back that nothing older could be filed inside the window */
    if (daysSince(oldest, today) > windowDays + STOCK_ACT_DEADLINE_DAYS) break;
  }
  const trades = congressRows(all, today)
    .filter(t => t.filedDaysAgo <= windowDays)
    .sort((a, b) => a.filedDaysAgo - b.filedDaysAgo || a.tradedDaysAgo - b.tradedDaysAgo);
  const reach = all.reduce((m, x) => (x.transactionDate && x.transactionDate < m ? x.transactionDate : m), today);
  return { ok: true, data: { trades, reach, read: all.length }, at };
}

/** Congress's reports filed inside the window — asked every ten minutes (the proxy keeps filings that long) */
export const useFeedCongress = (on: boolean, windowDays: number) => useFeedPoll<CongressAnswer>(on && up() ? `dossier:congress:${windowDays}` : null, () => loadCongress(windowDays), 10 * MIN);

/** One name's reports — the latest hundred */
export const useFeedCongressFor = (on: boolean, ticker: string) =>
  useFeedPoll<CongressTrade[]>(on && ticker && up() ? `dossier:congress-for:${ticker}` : null, async () => {
    const r = await uwCongressTrades({ ticker, limit: 100 });
    return r.ok ? { ...r, data: congressRows(r.data).sort((a, b) => a.filedDaysAgo - b.filedDaysAgo) } : r;
  }, 10 * MIN);

/* ---- Insiders ------------------------------------------------------------------------------------------------- */

const roleOf = (r: UwInsiderTrade): InsiderRole => {
  const t = r.officerTitle.toLowerCase();
  if (/chief executive|\bceo\b/.test(t)) return 'CEO';
  if (/chief financial|\bcfo\b/.test(t)) return 'CFO';
  if (/chief operating|\bcoo\b/.test(t)) return 'COO';
  if (/general counsel|chief legal/.test(t)) return 'Chief Legal Officer';
  if (/\bevp\b|executive vice/.test(t)) return 'EVP';
  if (t.trim()) return r.isDirector && !r.isOfficer ? 'Director' : 'Officer';
  if (r.isDirector) return 'Director';
  if (r.isTenPercentOwner) return '10% owner';
  return 'Officer';
};
const titleOf = (r: UwInsiderTrade): string => r.officerTitle.trim() || (r.isDirector ? 'Director' : r.isTenPercentOwner ? '10% owner' : r.isOfficer ? 'Officer' : '');
const KNOWN = new Set(Object.keys(TX_CODES));

export function insiderRow(r: UwInsiderTrade, today = nyToday()): InsiderTrade {
  const form = r.form.trim();
  /* a Form 144 is a notice of a proposed sale, filed before it — not a trade (the house's key 'N') */
  const code: TxCode = form === '144' ? 'N' : KNOWN.has(r.code) ? (r.code as TxCode) : 'J';
  const shares = Math.abs(r.amount);
  const price = r.price ?? NaN;
  const value = shares * price;
  const plan: PlanState = form === '144' ? 'unknown' : r.is10b51 ? 'plan' : 'discretionary';
  const heldAfter = r.sharesOwnedAfter ?? NaN;
  const stakePct = Number.isFinite(heldAfter) && shares + heldAfter > 0 ? (shares / (shares + heldAfter)) * 100 : NaN;
  const daysAgo = daysSince(r.transactionDate, today);
  return {
    id: r.id,
    ticker: r.ticker.toUpperCase(),
    role: roleOf(r),
    person: r.owner,
    code,
    kind: code === 'N' || r.amount < 0 ? 'SELL' : 'BUY',
    shares,
    price,
    value,
    daysAgo: Number.isFinite(daysAgo) ? daysAgo : 0,
    plan,
    clusterCount: 0,
    heldAfter,
    stakePct,
    sincePct: NaN,
    title: titleOf(r),
    tradedOn: r.transactionDate,
    filedOn: r.filingDate,
    form,
  };
}

/** Rows to InsiderTrades, the clusters counted over them */
export function insiderRows(rows: UwInsiderTrade[], windowDays: number): InsiderTrade[] {
  const today = nyToday();
  const trades = rows.map(r => insiderRow(r, today));
  const byName = new Map<string, InsiderTrade[]>();
  for (const t of trades) byName.set(t.ticker, [...(byName.get(t.ticker) ?? []), t]);
  for (const [ticker, list] of byName) flowFrom(ticker, list, windowDays);
  return trades.sort((a, b) => a.daysAgo - b.daysAgo);
}

export interface InsiderAnswer {
  trades: InsiderTrade[];
  /** The earliest filing day read */
  reach: string;
  read: number;
}

/** Pages of 200: one day's filings fill about one (2026-10-12) */
const INSIDER_PAGES = 3;

async function loadInsiders(codes: string[] | undefined): Promise<FeedResult<UwInsiderTrade[]>> {
  const out: UwInsiderTrade[] = [];
  let at = Date.now();
  for (let page = 0; page < INSIDER_PAGES; page++) {
    const r = await uwInsiderTrades({ limit: 200, page, codes });
    if (!r.ok) {
      if (page === 0) return r;
      break;
    }
    at = r.at;
    out.push(...r.data);
    if (r.data.length < 200) break;
  }
  return { ok: true, data: out, at };
}

const insiderAnswer = (rows: UwInsiderTrade[]): InsiderAnswer => ({
  trades: insiderRows(rows, 90),
  reach: rows.reduce((m, x) => (x.filingDate && x.filingDate < m ? x.filingDate : m), nyToday()),
  read: rows.length,
});

/**
 * The latest filings: the open-market codes (P and S, and the Form 144 notices that ride with S) or every code.
 * Ten minutes a poll.
 */
export const useFeedInsiders = (on: boolean, market: boolean) =>
  useFeedPoll<InsiderAnswer>(on && up() ? `dossier:insiders:${market ? 'market' : 'all'}` : null, async () => {
    const r = await loadInsiders(market ? ['P', 'S'] : undefined);
    return r.ok ? { ...r, data: insiderAnswer(r.data) } : r;
  }, 10 * MIN);

/** The latest open-market purchases alone — the names someone chose to buy, heaviest first */
export const useFeedInsiderBuyers = (on: boolean) =>
  useFeedPoll<InsiderFlow[]>(on && up() ? 'dossier:insiders:buyers' : null, async () => {
    const r = await uwInsiderTrades({ limit: 200, codes: ['P'] });
    if (!r.ok) return r;
    const trades = r.data.map(x => insiderRow(x));
    const byName = new Map<string, InsiderTrade[]>();
    for (const t of trades) byName.set(t.ticker, [...(byName.get(t.ticker) ?? []), t]);
    const flows = [...byName.entries()].map(([ticker, list]) => flowFrom(ticker, list, 90)).filter(f => f.openMarketBuys > 0);
    return { ...r, data: flows.sort((a, b) => b.openMarketBuys - a.openMarketBuys) };
  }, 10 * MIN);

/** One name's filings, added up (the latest hundred) */
export const useFeedInsidersFor = (on: boolean, ticker: string) =>
  useFeedPoll<InsiderFlow>(on && ticker && up() ? `dossier:insiders-for:${ticker}` : null, async () => {
    const r = await uwInsiderTrades({ ticker, limit: 100 });
    return r.ok ? { ...r, data: flowFrom(ticker, r.data.map(x => insiderRow(x)), 90) } : r;
  }, 10 * MIN);

export { isChosenBuy };

/* ---- Earnings -------------------------------------------------------------------------------------------------- */

/* UW's sectors in the house's words where they are the same sector */
const SECTOR: Record<string, Sector> = {
  Technology: 'Technology',
  'Communication Services': 'Communication',
  'Consumer Cyclical': 'Consumer Discretionary',
  'Financial Services': 'Financials',
  Energy: 'Energy',
  Healthcare: 'Health Care',
  Industrials: 'Industrials',
  'Consumer Defensive': 'Consumer Staples',
  Utilities: 'Utilities',
  'Basic Materials': 'Materials',
};

const slotOf = (r: UwEarning): ReportSlot => (r.reportTime === 'premarket' ? 'BMO' : 'AMC');

/** A report as the calendar's row: every figure the house computes and the feed does not carry is NaN */
export function earningsEvent(r: UwEarning, place: { weekIdx: 0 | 1; weekday: number } | null, today = nyToday(), price = NaN): EarningsEvent {
  const wd = weekdayOf(r.reportDate);
  return {
    ticker: r.symbol.toUpperCase(),
    name: r.name || r.symbol,
    sector: (SECTOR[r.sector] ?? r.sector) as Sector,
    price: Number.isFinite(price) ? price : (r.preEarningsClose ?? NaN),
    daysOut: sessionsTo(r.reportDate, today),
    dateLabel: labelOf(r.reportDate),
    weekday: place?.weekday ?? (wd === 0 ? 7 : wd),
    weekIdx: place?.weekIdx ?? 1,
    /* the date's own source, as UW names it — "company" is the company's own date */
    confirmed: r.dateSource === 'company',
    slot: slotOf(r),
    impliedMovePct: r.expectedMovePct == null ? NaN : r.expectedMovePct * 100,
    histAvgMovePct: NaN,
    pastMoves: [],
    richness: NaN,
    beatRate8q: NaN,
    revisionTrend: NaN,
    ivRank: NaN,
    technicalScore: NaN,
    flowLean: NaN,
    verdict: 'SKIP',
    strategy: '',
    rationale: '',
  };
}

export interface CalendarDay {
  iso: string;
  weekIdx: 0 | 1;
  weekday: number;
}

/** The fortnight's reports: every day the board shows, before the open and after the close — one call each */
export const useFeedEarnings = (on: boolean, days: CalendarDay[]) =>
  useFeedPoll<EarningsEvent[]>(on && days.length && up() ? `dossier:earnings:${days.map(d => d.iso).join(',')}` : null, async () => {
    const today = nyToday();
    const asks = days.flatMap(d => (['premarket', 'afterhours'] as const).map(when => ({ d, when })));
    const answers = await Promise.all(asks.map(a => uwEarningsDay(a.when, { date: a.d.iso, limit: 200 })));
    const firstFail = answers.find(a => !a.ok);
    if (firstFail && !firstFail.ok && answers.every(a => !a.ok)) return firstFail;
    const out: EarningsEvent[] = [];
    const seen = new Set<string>();
    answers.forEach((a, i) => {
      if (!a.ok) return;
      for (const r of a.data) {
        const e = earningsEvent(r, { weekIdx: asks[i].d.weekIdx, weekday: asks[i].d.weekday }, today);
        const key = `${e.ticker}|${r.reportDate}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(e);
      }
    });
    return { ok: true as const, data: out, at: Date.now() };
  }, 10 * MIN);

const quarterLabel = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  return m ? `Q${Math.ceil(+m[2] / 3)}'${m[1].slice(2)}` : iso;
};

export interface FeedEarningsName {
  /** The next report, or null when the record names none ahead */
  dossier: EarningsDossier | null;
  /** Reports on the record at all (an empty list: the name is not on it) */
  rows: number;
}

/** A name's own page: its next report, its last eight reported, the stock's price now */
export const useFeedEarningsFor = (on: boolean, ticker: string) =>
  useFeedPoll<FeedEarningsName>(on && ticker && up() ? `dossier:earnings-for:${ticker}` : null, async () => {
    const [r, st] = await Promise.all([uwEarningsFor(ticker), uwStockState(ticker)]);
    if (!r.ok) return r;
    const today = nyToday();
    const price = st.ok ? (st.data.close ?? NaN) : NaN;
    const ahead = r.data.filter(x => x.reportDate >= today && x.actualEps == null).sort((a, b) => (a.reportDate < b.reportDate ? -1 : 1))[0];
    if (!ahead) return { ok: true as const, data: { dossier: null, rows: r.data.length }, at: r.at };
    const reported = r.data.filter(x => x.actualEps != null && x.reportDate < today).sort((a, b) => (a.reportDate < b.reportDate ? 1 : -1)).slice(0, 8).reverse();
    const quarters: EarningsQuarter[] = reported.map(x => ({
      label: quarterLabel(x.endingFiscalQuarter || x.reportDate),
      epsEst: x.streetMeanEst ?? NaN,
      epsActual: x.actualEps ?? NaN,
      epsBeat: x.actualEps != null && x.streetMeanEst != null && x.actualEps > x.streetMeanEst,
      revEstB: NaN,
      revActualB: NaN,
      revBeat: false,
      movePct: x.postMove1d == null ? NaN : x.postMove1d * 100,
    }));
    const event = earningsEvent({ ...ahead, symbol: ticker.toUpperCase() }, null, today, price);
    const moves = quarters.map(q => Math.abs(q.movePct)).filter(Number.isFinite);
    const hist = moves.length ? moves.reduce((s, v) => s + v, 0) / moves.length : NaN;
    const known = quarters.filter(q => Number.isFinite(q.epsActual) && Number.isFinite(q.epsEst));
    event.histAvgMovePct = hist;
    event.richness = Number.isFinite(hist) && hist > 0 ? event.impliedMovePct / hist : NaN;
    event.beatRate8q = known.length ? (known.filter(q => q.epsBeat).length / known.length) * 100 : NaN;
    event.pastMoves = quarters.map(q => ({ label: q.label, movePct: q.movePct }));
    const dossier: EarningsDossier = { event, quarters, probInsidePct: NaN, probBeyondPct: NaN, probUpPct: NaN, ivCrushPct: NaN, premiumLostPct: NaN, activeCalls: [], activePuts: [] };
    return { ok: true as const, data: { dossier, rows: r.data.length }, at: r.at };
  }, 10 * MIN);

/** A name's next report alone (its own page's "next report" line) */
export const nextReportOf = (rows: UwEarning[], today = nyToday()): UwEarning | null =>
  rows.filter(x => x.reportDate >= today && x.actualEps == null).sort((a, b) => (a.reportDate < b.reportDate ? -1 : 1))[0] ?? null;

/* ---- Stocks ---------------------------------------------------------------------------------------------------- */

export interface FeedPrice {
  price: number;
  changePct: number;
}
const priceOf = (s: UwStockState): FeedPrice => {
  const price = s.close ?? NaN;
  const prev = s.prevClose ?? NaN;
  return { price, changePct: Number.isFinite(price) && Number.isFinite(prev) && prev > 0 ? ((price - prev) / prev) * 100 : NaN };
};

/** The list's prices: one stock-state a name, every minute */
export const useFeedPrices = (on: boolean, tickers: string[]) =>
  useFeedPoll<Record<string, FeedPrice>>(on && tickers.length && up() ? `dossier:prices:${tickers.join(',')}` : null, async () => {
    const answers = await Promise.all(tickers.map(t => uwStockState(t)));
    if (answers.every(a => !a.ok)) return answers[0] as FeedResult<never>;
    const out: Record<string, FeedPrice> = {};
    answers.forEach((a, i) => {
      if (a.ok) out[tickers[i]] = priceOf(a.data);
    });
    return { ok: true as const, data: out, at: Date.now() };
  }, MIN);

export interface FeedName {
  /** Massive's record — null when Massive has none (404: no such name) */
  details: MassiveTickerDetails | null;
  /** Massive refused or failed for another reason */
  detailsFailed: boolean;
}

/** The open name's company record — Massive, once a name (the proxy keeps it a day) */
export const useFeedNameRecord = (on: boolean, ticker: string) =>
  useFeedPoll<FeedName>(on && ticker && up() ? `dossier:record:${ticker}` : null, async () => {
    /* UW first, the cheap call: a ticker it has no state for answers { data: null } (seen live 2026-10-12) — not a name,
       and Massive is not asked (its 404 would spend one of its five calls a minute) */
    const st = await uwStockState(ticker);
    if (!st.ok && st.reason === 'shape' && st.status === 200) return { ok: true as const, data: { details: null, detailsFailed: false }, at: Date.now() };
    const r = await massiveTickerDetails(ticker);
    if (r.ok) return { ...r, data: { details: r.data, detailsFailed: false } };
    if (r.status === 404) return { ok: true as const, data: { details: null, detailsFailed: false }, at: Date.now() };
    return r;
  }, 6 * HOUR);

export interface FeedQuote {
  quote: UwQuote | null;
  state: UwStockState | null;
}

/** The open name's price: the quote and the day's state, every fifteen seconds */
export const useFeedQuote = (on: boolean, ticker: string) =>
  useFeedPoll<FeedQuote>(on && ticker && up() ? `dossier:quote:${ticker}` : null, async () => {
    const [q, s] = await Promise.all([uwQuote(ticker), uwStockState(ticker)]);
    if (!q.ok && !s.ok) return s;
    return { ok: true as const, data: { quote: q.ok ? q.data : null, state: s.ok ? s.data : null }, at: Date.now() };
  }, 15 * SEC);

/** The open name's daily bars over the last sixty calendar days (Massive: the session before is the latest) */
export const useFeedBars = (on: boolean, ticker: string) =>
  useFeedPoll<MassiveBar[]>(on && ticker && up() ? `dossier:bars:${ticker}` : null, () => {
    const today = nyToday();
    return massiveBars(ticker, 1, 'day', isoPlus(today, -60), today, { limit: 120 });
  }, 30 * MIN);

/** The open name's whole report list (its next report, for the name's own page) */
export const useFeedReports = (on: boolean, ticker: string) => useFeedPoll<UwEarning[]>(on && ticker && up() ? `dossier:reports:${ticker}` : null, () => uwEarningsFor(ticker), 10 * MIN);

/* ---- News ------------------------------------------------------------------------------------------------------ */

/** The wire, newest first — every minute */
export const useFeedNews = (on: boolean) => useFeedPoll<UwHeadline[]>(on && up() ? 'dossier:news' : null, () => uwNewsHeadlines({ limit: 100 }), MIN);

/** The hour of the New York day a headline came at, "14:03" */
export const headlineClock = (at: number): string => {
  const p = nyParts(at);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
};

export { AMOUNT_BRACKETS };
