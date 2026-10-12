/*
==================================================
  SLAYER TERMINAL - THE WIRE ON THE FEED (data/feed/news.ts)

  THE UI IS THE OWNER'S; THE FEED FILLS IT (2026-10-12).
  With the Dossier on the feed, the News page is the
  house's page on the vendor's answers:

    · THE WIRE — UW's headlines (GET /api/news/headlines,
      the newest 100), each one the house's NewsItem: its
      name, its time, its source, the kind of story by
      the house's own words read off the headline, UW's
      sentiment (neutral on every story seen 2026-10-12),
      and the house's read (data/news.ts predict) run on
      those inputs — its weight from UW's "major" flag and
      the name's move on the day as UW attaches it. The
      map places a story by the house's rule (newsroom.ts
      geoOf). A story's text is what UW carries: the
      headline and the named names' prices — never the
      house's templated copy.
    · THE DAY AHEAD — UW's economic calendar (GET
      /api/market/economic-calendar: the event, its time,
      the previous reading, the forecast where UW has one)
      and the fortnight's reports (the Earnings board's own
      calls, data/feed/dossier.ts useFeedEarnings — no
      second call). The month's market dates (the monthly
      expiration, month end) stay the calendar's own.
==================================================
*/

import { useMemo } from 'react';
import { feedGet, rowsOf, str, ms, type FeedResult } from './client';
import { useFeedPoll } from './poll';
import { predict, type NewsCategory, type NewsItem } from '../news';
import { geoOf, type EconEvent, type GeoNewsEvent } from '../newsroom';
import { lookup } from '../universe';
import { nyClock, nyParts } from '../../core/nyTime';
import { idNum } from './trace';
import type { UwHeadline } from './uw';
import type { CalEvent } from '../monthCalendar';
import type { EarningsEvent } from '../earnings';

/* ---- the kind of story, read off the headline in the house's seven words ------------------------------------ */

const KINDS: [NewsCategory, RegExp][] = [
  ['Earnings', /\b(earnings|eps|results|quarter(ly)?|q[1-4]\b|revenue|profit|loss per share|beats?|miss(es)?)\b/i],
  ['Guidance', /\b(guidance|outlook|forecast|guides?|sees (fy|full[- ]year|q[1-4])|raises|lowers|reaffirms)\b/i],
  ['Analyst', /\b(upgrade[sd]?|downgrade[sd]?|price target|initiates?|reiterates?|overweight|underweight|outperform|underperform|neutral rating|buy rating|sell rating)\b/i],
  ['M&A', /\b(acquir(e|es|ed|ing|ition)|merger|merge|buyout|takeover|to buy|deal to|stake in|spin[- ]?off|tender offer)\b/i],
  ['Regulatory', /\b(fda|sec\b|ftc|doj|antitrust|court|judge|lawsuit|sues?|probe|investigation|regulator|approval|approves?|tariffs?|sanctions?|ban)\b/i],
  ['Macro', /\b(fed\b|fomc|cpi|inflation|payrolls?|jobless|unemployment|gdp|treasury|yields?|rate (cut|hike)|central bank|ecb|boj|pmi|retail sales)\b/i],
  ['Product', /\b(launch(es|ed)?|unveil(s|ed)?|introduc(es|ed)|releases?|rolls? out|new\b|product|partnership|contract|order)\b/i],
];

/** The house's kind for a headline — a story with no name is Macro; a named one with no kind word, the company's own news */
export function kindOf(headline: string, hasName: boolean): NewsCategory {
  for (const [k, re] of KINDS) if (re.test(headline)) return !hasName && k !== 'Macro' && k !== 'Regulatory' ? 'Macro' : k;
  return hasName ? 'Product' : 'Macro';
}

const SENTIMENT: Record<string, number> = { positive: 0.5, bullish: 0.5, negative: -0.5, bearish: -0.5 };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const sentenceCase = (s: string) => (s === s.toUpperCase() && /[A-Z]{4}/.test(s) ? s.charAt(0) + s.slice(1).toLowerCase() : s);

/** One UW headline as the house's wire item, its read the house's model on the vendor's inputs */
export function wireItem(h: UwHeadline, nowMs = Date.now()): NewsItem {
  const ticker = h.tickers[0]?.toUpperCase() ?? null;
  const category = kindOf(h.headline, !!ticker);
  const sentiment = SENTIMENT[h.sentiment.toLowerCase()] ?? 0;
  const px = ticker ? h.prices[ticker] ?? h.prices[h.tickers[0]] : undefined;
  const movePct = px && px.close !== null && px.prevClose ? ((px.close - px.prevClose) / px.prevClose) * 100 : NaN;
  /* how market-moving: UW's major flag and the name's move on the day */
  const magnitude = clamp(0.3 + (h.isMajor ? 0.25 : 0) + (Number.isFinite(movePct) ? Math.abs(movePct) / 8 : 0), 0.1, 1);
  const id = `uw-${idNum(`${h.createdAt}-${h.headline}`)}`;
  const named = h.tickers
    .map(t => {
      const p = h.prices[t];
      if (!p || p.close === null) return null;
      const chg = p.prevClose ? ((p.close - p.prevClose) / p.prevClose) * 100 : NaN;
      return `${t} ${p.close.toFixed(2)}${Number.isFinite(chg) ? `, ${chg >= 0 ? '+' : '−'}${Math.abs(chg).toFixed(2)}% on the session before's close` : ''}`;
    })
    .filter(Boolean);
  const body = [sentenceCase(h.headline), named.length ? `On the wire with it: ${named.join(' · ')}.` : `${h.source}, ${nyClock(h.createdAt)} New York.`];
  return {
    id,
    time: nyClock(h.createdAt),
    minutesAgo: Math.max(0, Math.round((nowMs - h.createdAt) / 60_000)),
    atMs: h.createdAt,
    source: h.source || 'The wire',
    ticker,
    headline: sentenceCase(h.headline),
    body,
    category,
    sentiment,
    magnitude,
    prediction: predict(category, sentiment, magnitude, (ticker && lookup(ticker)?.beta) || 1, id),
  };
}

/** The wire as the map's stories, newest first */
export function wireEvents(rows: UwHeadline[], nowMs = Date.now()): GeoNewsEvent[] {
  const seen = new Set<string>();
  const out: GeoNewsEvent[] = [];
  for (const h of rows) {
    const it = wireItem(h, nowMs);
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(geoOf(it));
  }
  return out.sort((a, b) => a.item.minutesAgo - b.item.minutesAgo);
}

/* ---- the economic calendar --------------------------------------------------------------------------------- */

export interface UwEconEvent {
  /** "report", "fed-speaker", "fomc" … */
  type: string;
  event: string;
  at: number;
  prev: string | null;
  forecast: string | null;
  period: string | null;
}

/** The economic calendar, the weeks around today. GET /api/market/economic-calendar — seen live 2026-10-12 (type, time,
    event, prev, forecast, reported_period) */
export const uwEconomicCalendar = (): Promise<FeedResult<UwEconEvent[]>> =>
  feedGet('uw', '/api/market/economic-calendar', undefined, body =>
    rowsOf(body).map(r => ({
      type: str(r.type),
      event: str(r.event),
      at: ms(r.time),
      prev: r.prev == null ? null : str(r.prev),
      forecast: r.forecast == null ? null : str(r.forecast),
      period: r.reported_period == null ? null : str(r.reported_period),
    }))
  );

const HIGH = /\b(cpi|consumer price|nonfarm|payroll|unemployment rate|fomc|interest rate decision|fed funds|gdp|pce|retail sales)\b/i;
const MEDIUM = /\b(ppi|producer price|ism|pmi|jobless|claims|housing|home sales|building permits|consumer (sentiment|confidence)|durable|jolts|industrial production|capacity|import prices|export prices|trade balance|inventories|beige book)\b/i;
/** The calendar's three tiers by what the release is (every economic calendar's own): a Fed speaker is noted */
export const econImpact = (e: UwEconEvent): EconEvent['impact'] => (HIGH.test(e.event) || e.type === 'fomc' ? 'high' : MEDIUM.test(e.event) ? 'medium' : 'low');

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const two = (n: number) => String(n).padStart(2, '0');

/** UW's calendar as the page's day ahead — New York's day and clock; a release earlier today keeps its place */
export function econEvents(rows: UwEconEvent[], nowMs = Date.now()): EconEvent[] {
  return rows
    .filter(e => e.event && Number.isFinite(e.at) && e.at > 0)
    .map((e, i) => {
      const p = nyParts(e.at);
      const wd = new Date(p.year, p.month - 1, p.day).getDay();
      return {
        id: `econ-uw-${i}-${e.at}`,
        title: e.event,
        region: 'USD' as const,
        impact: econImpact(e),
        dayLabel: `${DAY[wd]} ${two(p.month)}-${two(p.day)}`,
        timeLabel: nyClock(e.at),
        inMinutes: Math.round((e.at - nowMs) / 60_000),
        forecast: e.forecast ?? undefined,
        previous: e.prev ?? undefined,
      };
    })
    .filter(e => e.inMinutes > -600)
    .sort((a, b) => a.inMinutes - b.inMinutes);
}

/** UW's calendar as the month's macro dates */
export function econCalEvents(rows: UwEconEvent[]): CalEvent[] {
  return rows
    .filter(e => e.event && Number.isFinite(e.at) && e.at > 0)
    .map((e, i) => {
      const p = nyParts(e.at);
      return {
        id: `macro-uw-${i}-${e.at}`,
        kind: 'macro' as const,
        date: new Date(p.year, p.month - 1, p.day, p.hour, p.minute),
        time: `${two(p.hour)}:${two(p.minute)}`,
        title: e.event,
        impact: econImpact(e),
        region: 'USD',
        forecast: e.forecast ?? undefined,
        previous: e.prev ?? undefined,
      };
    });
}

/** The reports the Earnings board asked for, as the month's earnings dates — `days` the board's own (weekIdx|weekday → date) */
export function earningsCalEvents(rows: EarningsEvent[], days: { iso: string; weekIdx: 0 | 1; weekday: number }[]): CalEvent[] {
  const isoOf = new Map(days.map(d => [`${d.weekIdx}|${d.weekday}`, d.iso]));
  return rows.flatMap(e => {
    const iso = isoOf.get(`${e.weekIdx}|${e.weekday}`);
    if (!iso) return [];
    const [y, m, d] = iso.split('-').map(Number);
    return [
      {
        id: `er-uw-${e.ticker}-${iso}`,
        kind: 'earnings' as const,
        date: new Date(y, m - 1, d, e.slot === 'BMO' ? 8 : 16, 0),
        time: e.slot,
        title: `${e.ticker} reports`,
        impact: 'medium' as const,
        ticker: e.ticker,
        slot: e.slot,
        confirmed: e.confirmed,
        impliedMovePct: Number.isFinite(e.impliedMovePct) ? e.impliedMovePct : undefined,
      },
    ];
  });
}

/** The economic calendar, every ten minutes */
export function useFeedEcon(on: boolean): UwEconEvent[] | null {
  const r = useFeedPoll(on ? 'dossier:econ' : null, uwEconomicCalendar, 10 * 60_000);
  return r ? (r.ok ? r.data : []) : null;
}

/** The wire's events for the page, re-read as the minutes pass */
export function useWireEvents(rows: UwHeadline[] | null, minute: number): GeoNewsEvent[] | null {
  return useMemo(() => (rows ? wireEvents(rows) : null), [rows, minute]); // eslint-disable-line react-hooks/exhaustive-deps
}
