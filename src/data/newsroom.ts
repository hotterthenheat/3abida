/*
==================================================
  SLAYER TERMINAL - NEWS ROOM GEOGRAPHY (data)
  The globe's information layer. ONE generator rule:
  the wire facts come from data/news.ts (the same
  buildNewsFeed the Pulse widget reads) — this module
  only DECORATES each item with geography and the
  room's grading, so the globe, the wire rail and the
  widget can never disagree about what the news is.

  Grading is states-not-orders vocabulary:
    THREAT — the story reads negative for what it touches
    ALLY   — the story reads positive for what it touches
    WATCH  — the wire spoke, the model reads it neutral
  Thresholds ±0.12 on sentiment — the SAME cut the
  retired v1 page used for tones and lean counts
  (docs/news-page-reference.md), kept so history
  reads continuously.
==================================================
*/

import { buildNewsFeed, type NewsItem } from './news';
import { now } from '../core/clock';

export type NewsGrade = 'THREAT' | 'ALLY' | 'WATCH';

export interface GeoZone {
  lat: number;
  lng: number;
  label: string;
  /** Impact weight — feeds the heat layer, scaled by severity. */
  w: number;
}

export interface GeoNewsEvent {
  /** = NewsItem.id, so the widget's selectedId deep link addresses us too. */
  id: string;
  item: NewsItem;
  grade: NewsGrade;
  /** 1–10 internal magnitude — NEVER rendered as a number (meters/words). */
  severity: number;
  origin: GeoZone & { city: string };
  impacts: GeoZone[];
}

/* ── where companies live ─────────────────────────────────────────────────
   HQ registry for the names the sim actually surfaces; `cluster` picks the
   impact map below. Unknown tickers fall back to the listing venue. */
type Cluster =
  | 'chips' | 'tech' | 'autos' | 'ecom' | 'banks' | 'index' | 'health'
  | 'energy' | 'consumer' | 'media' | 'crypto' | 'industrial';

const HQ: Record<string, { lat: number; lng: number; city: string; cluster: Cluster }> = {
  NVDA: { lat: 37.35, lng: -121.95, city: 'Santa Clara', cluster: 'chips' },
  AMD: { lat: 37.35, lng: -121.95, city: 'Santa Clara', cluster: 'chips' },
  INTC: { lat: 37.39, lng: -121.96, city: 'Santa Clara', cluster: 'chips' },
  AVGO: { lat: 37.44, lng: -122.14, city: 'Palo Alto', cluster: 'chips' },
  MU: { lat: 43.61, lng: -116.2, city: 'Boise', cluster: 'chips' },
  TSM: { lat: 24.78, lng: 121.0, city: 'Hsinchu', cluster: 'chips' },
  ASML: { lat: 51.42, lng: 5.4, city: 'Veldhoven', cluster: 'chips' },
  SMCI: { lat: 37.32, lng: -121.9, city: 'San Jose', cluster: 'chips' },
  AAPL: { lat: 37.33, lng: -122.01, city: 'Cupertino', cluster: 'tech' },
  MSFT: { lat: 47.64, lng: -122.13, city: 'Redmond', cluster: 'tech' },
  GOOGL: { lat: 37.42, lng: -122.08, city: 'Mountain View', cluster: 'tech' },
  META: { lat: 37.48, lng: -122.15, city: 'Menlo Park', cluster: 'tech' },
  ORCL: { lat: 30.27, lng: -97.74, city: 'Austin', cluster: 'tech' },
  CRM: { lat: 37.79, lng: -122.4, city: 'San Francisco', cluster: 'tech' },
  PLTR: { lat: 39.74, lng: -104.99, city: 'Denver', cluster: 'tech' },
  NFLX: { lat: 37.24, lng: -121.96, city: 'Los Gatos', cluster: 'media' },
  DIS: { lat: 34.16, lng: -118.33, city: 'Burbank', cluster: 'media' },
  TSLA: { lat: 30.22, lng: -97.62, city: 'Austin', cluster: 'autos' },
  BYDDY: { lat: 22.54, lng: 114.06, city: 'Shenzhen', cluster: 'autos' },
  NIO: { lat: 31.23, lng: 121.47, city: 'Shanghai', cluster: 'autos' },
  XPEV: { lat: 23.13, lng: 113.26, city: 'Guangzhou', cluster: 'autos' },
  LI: { lat: 39.9, lng: 116.4, city: 'Beijing', cluster: 'autos' },
  AMZN: { lat: 47.62, lng: -122.34, city: 'Seattle', cluster: 'ecom' },
  BABA: { lat: 30.27, lng: 120.15, city: 'Hangzhou', cluster: 'ecom' },
  EBAY: { lat: 37.3, lng: -121.93, city: 'San Jose', cluster: 'ecom' },
  JPM: { lat: 40.76, lng: -73.98, city: 'New York', cluster: 'banks' },
  GS: { lat: 40.71, lng: -74.01, city: 'New York', cluster: 'banks' },
  MS: { lat: 40.76, lng: -73.98, city: 'New York', cluster: 'banks' },
  BAC: { lat: 35.23, lng: -80.84, city: 'Charlotte', cluster: 'banks' },
  BLK: { lat: 40.75, lng: -73.98, city: 'New York', cluster: 'banks' },
  V: { lat: 37.79, lng: -122.39, city: 'San Francisco', cluster: 'banks' },
  SCHW: { lat: 32.99, lng: -97.19, city: 'Westlake', cluster: 'banks' },
  COIN: { lat: 37.79, lng: -122.4, city: 'San Francisco', cluster: 'crypto' },
  HOOD: { lat: 37.45, lng: -122.18, city: 'Menlo Park', cluster: 'crypto' },
  SOFI: { lat: 37.79, lng: -122.4, city: 'San Francisco', cluster: 'crypto' },
  UNH: { lat: 44.89, lng: -93.44, city: 'Minnetonka', cluster: 'health' },
  LLY: { lat: 39.77, lng: -86.16, city: 'Indianapolis', cluster: 'health' },
  PFE: { lat: 40.75, lng: -73.99, city: 'New York', cluster: 'health' },
  JNJ: { lat: 40.5, lng: -74.45, city: 'New Brunswick', cluster: 'health' },
  XOM: { lat: 30.07, lng: -95.44, city: 'Spring', cluster: 'energy' },
  CVX: { lat: 37.78, lng: -121.97, city: 'San Ramon', cluster: 'energy' },
  COP: { lat: 29.76, lng: -95.37, city: 'Houston', cluster: 'energy' },
  OXY: { lat: 29.76, lng: -95.37, city: 'Houston', cluster: 'energy' },
  BA: { lat: 38.88, lng: -77.11, city: 'Arlington', cluster: 'industrial' },
  CAT: { lat: 32.86, lng: -96.94, city: 'Irving', cluster: 'industrial' },
  GE: { lat: 42.35, lng: -71.06, city: 'Boston', cluster: 'industrial' },
  HD: { lat: 33.87, lng: -84.47, city: 'Atlanta', cluster: 'consumer' },
  MCD: { lat: 41.88, lng: -87.63, city: 'Chicago', cluster: 'consumer' },
  NKE: { lat: 45.51, lng: -122.83, city: 'Beaverton', cluster: 'consumer' },
  SBUX: { lat: 47.58, lng: -122.34, city: 'Seattle', cluster: 'consumer' },
  WMT: { lat: 36.37, lng: -94.21, city: 'Bentonville', cluster: 'consumer' },
  UBER: { lat: 37.77, lng: -122.42, city: 'San Francisco', cluster: 'tech' },
  SPY: { lat: 40.71, lng: -74.01, city: 'New York', cluster: 'index' },
  QQQ: { lat: 40.71, lng: -74.01, city: 'New York', cluster: 'index' },
  IWM: { lat: 40.71, lng: -74.01, city: 'New York', cluster: 'index' },
  DIA: { lat: 40.71, lng: -74.01, city: 'New York', cluster: 'index' },
};
const LISTING_VENUE = { lat: 40.71, lng: -74.01, city: 'New York', cluster: 'index' as Cluster };

/* ── where each cluster's news lands ──────────────────────────────────────
   Zones with RELATIVE weights; severity scales them into heat. Plain-English
   labels — they surface verbatim on hover cards. */
const IMPACT: Record<Cluster, (GeoZone & { rel: number })[]> = {
  chips: [
    { lat: 25.03, lng: 121.56, label: 'Taipei · foundries', rel: 1, w: 0 },
    { lat: 37.56, lng: 126.97, label: 'Seoul · memory complex', rel: 0.7, w: 0 },
    { lat: 51.44, lng: 5.47, label: 'Eindhoven · lithography', rel: 0.5, w: 0 },
    { lat: 22.54, lng: 114.06, label: 'Shenzhen · assembly', rel: 0.55, w: 0 },
  ],
  tech: [
    { lat: 40.71, lng: -74.01, label: 'New York · index weight', rel: 1, w: 0 },
    { lat: 51.51, lng: -0.13, label: 'London · listings', rel: 0.55, w: 0 },
    { lat: 35.68, lng: 139.69, label: 'Tokyo · suppliers', rel: 0.5, w: 0 },
  ],
  autos: [
    { lat: 31.23, lng: 121.47, label: 'Shanghai · plants & demand', rel: 1, w: 0 },
    { lat: 52.4, lng: 13.07, label: 'Berlin · EU production', rel: 0.65, w: 0 },
    { lat: 42.33, lng: -83.05, label: 'Detroit · legacy autos', rel: 0.5, w: 0 },
  ],
  ecom: [
    { lat: 22.54, lng: 114.06, label: 'Shenzhen · supply chain', rel: 1, w: 0 },
    { lat: 51.92, lng: 4.48, label: 'Rotterdam · logistics', rel: 0.55, w: 0 },
    { lat: 40.71, lng: -74.01, label: 'New York · retail complex', rel: 0.6, w: 0 },
  ],
  banks: [
    { lat: 40.71, lng: -74.01, label: 'New York · money center', rel: 1, w: 0 },
    { lat: 51.51, lng: -0.13, label: 'London · rates desks', rel: 0.7, w: 0 },
    { lat: 22.28, lng: 114.16, label: 'Hong Kong · Asia books', rel: 0.5, w: 0 },
  ],
  index: [
    { lat: 40.71, lng: -74.01, label: 'New York · cash session', rel: 1, w: 0 },
    { lat: 51.51, lng: -0.13, label: 'London · Europe open', rel: 0.7, w: 0 },
    { lat: 50.11, lng: 8.68, label: 'Frankfurt · DAX complex', rel: 0.55, w: 0 },
    { lat: 35.68, lng: 139.69, label: 'Tokyo · Asia handoff', rel: 0.6, w: 0 },
  ],
  health: [
    { lat: 47.56, lng: 7.59, label: 'Basel · pharma complex', rel: 1, w: 0 },
    { lat: 53.35, lng: -6.26, label: 'Dublin · manufacturing', rel: 0.6, w: 0 },
    { lat: 40.71, lng: -74.01, label: 'New York · payer complex', rel: 0.6, w: 0 },
  ],
  energy: [
    { lat: 29.76, lng: -95.37, label: 'Houston · shale patch', rel: 1, w: 0 },
    { lat: 24.71, lng: 46.68, label: 'Riyadh · OPEC supply', rel: 0.8, w: 0 },
    { lat: 51.92, lng: 4.48, label: 'Rotterdam · crude hub', rel: 0.5, w: 0 },
  ],
  consumer: [
    { lat: 31.23, lng: 121.47, label: 'Shanghai · demand read', rel: 1, w: 0 },
    { lat: 10.82, lng: 106.63, label: 'Ho Chi Minh · manufacturing', rel: 0.55, w: 0 },
    { lat: 40.71, lng: -74.01, label: 'New York · retail complex', rel: 0.6, w: 0 },
  ],
  media: [
    { lat: 34.05, lng: -118.24, label: 'Los Angeles · content', rel: 1, w: 0 },
    { lat: 51.51, lng: -0.13, label: 'London · distribution', rel: 0.5, w: 0 },
  ],
  crypto: [
    { lat: 40.71, lng: -74.01, label: 'New York · ETF complex', rel: 1, w: 0 },
    { lat: 1.35, lng: 103.82, label: 'Singapore · offshore venues', rel: 0.7, w: 0 },
  ],
  industrial: [
    { lat: 31.23, lng: 121.47, label: 'Shanghai · orders', rel: 1, w: 0 },
    { lat: 53.55, lng: 9.99, label: 'Hamburg · exports', rel: 0.6, w: 0 },
  ],
};

/* Macro headlines carry their origin in their words — first match wins, so
   the specific places (the cartel, the Gulf, the shale patch, the foundries)
   sit above the broad ones. */
const MACRO_ORIGINS: { re: RegExp; lat: number; lng: number; city: string }[] = [
  { re: /opec/i, lat: 48.21, lng: 16.37, city: 'Vienna' },
  { re: /hormuz|saudi|riyadh|aramco|brent|gulf/i, lat: 24.71, lng: 46.68, city: 'Riyadh' },
  { re: /\beia\b|cushing|permian|wti|shale/i, lat: 29.76, lng: -95.37, city: 'Houston' },
  { re: /taiwan|taipei|foundr|\bsox\b/i, lat: 25.03, lng: 121.56, city: 'Taipei' },
  { re: /export control|commerce dept|chip curb/i, lat: 38.89, lng: -77.04, city: 'Washington' },
  { re: /fed|fomc|rate|cpi|inflation|payroll|jobs|jobless|claims|ism\b|treasury|yield/i, lat: 38.89, lng: -77.04, city: 'Washington' },
  { re: /boj|japan|yen/i, lat: 35.68, lng: 139.69, city: 'Tokyo' },
  { re: /ecb|euro(?!phori)|lagarde/i, lat: 50.11, lng: 8.68, city: 'Frankfurt' },
  { re: /china|beijing|tariff/i, lat: 39.9, lng: 116.4, city: 'Beijing' },
  { re: /opec|crude|oil/i, lat: 48.21, lng: 16.37, city: 'Vienna' },
  { re: /uk|boe|gilt/i, lat: 51.51, lng: -0.13, city: 'London' },
];

const gradeOf = (s: number): NewsGrade => (s > 0.12 ? 'ALLY' : s < -0.12 ? 'THREAT' : 'WATCH');

/** Internal 1–10 from the wire's own numbers — deterministic, never shown raw. */
const severityOf = (n: NewsItem): number =>
  Math.max(1, Math.min(10, Math.round(Math.abs(n.prediction.expMove1dPct) * 1.6 + n.magnitude * 5)));

export function buildGeoNews(): GeoNewsEvent[] {
  return buildNewsFeed().map(item => {
    const hq = item.ticker ? HQ[item.ticker] ?? LISTING_VENUE : null;
    const macro = !hq ? MACRO_ORIGINS.find(m => m.re.test(item.headline)) : null;
    const o = hq ?? macro ?? LISTING_VENUE;
    const cluster: Cluster = hq ? hq.cluster : 'index';
    const severity = severityOf(item);
    return {
      id: item.id,
      item,
      grade: gradeOf(item.sentiment),
      severity,
      origin: {
        lat: o.lat,
        lng: o.lng,
        city: o.city,
        label: item.ticker ? `${o.city} · ${item.ticker} origin` : `${o.city} · macro origin`,
        w: severity,
      },
      impacts: IMPACT[cluster].map(z => ({ lat: z.lat, lng: z.lng, label: z.label, w: Math.max(1, Math.round(z.rel * severity)) })),
    };
  });
}

/** Words for the internal severity — meters and words, never the number.
    The cuts are the News page's three impact tiers (its square before a
    headline): 7+ heavy, 4–6 firm, under 4 light. */
export const severityWord = (severity: number): string =>
  severity >= 7 ? 'heavy' : severity >= 4 ? 'firm' : 'light';

/* ── the event lifecycle ──────────────────────────────────────────────────
   News ages: a story LANDS (ripples), DEVELOPS (full heat), then FADES
   (dim ping, cooled heat). Cut on the wire's own minutesAgo so every
   surface — planet, zones, widget — agrees on what is still alive. */
export type Freshness = 'fresh' | 'developing' | 'faded';
export const freshnessOf = (e: GeoNewsEvent): Freshness =>
  e.item.minutesAgo <= 45 ? 'fresh' : e.item.minutesAgo <= 180 ? 'developing' : 'faded';
/** How much of its weight an aging story keeps — scales heat and pings. */
export const FRESHNESS_FACTOR: Record<Freshness, number> = { fresh: 1, developing: 0.72, faded: 0.45 };

/* ── one ping per CITY, not per story ─────────────────────────────────────
   Five NYC stories must read as ONE louder ping with a count, not dot soup.
   Dominant grade by count (severity breaks ties via the top event). */
export interface CityPing {
  city: string;
  lat: number;
  lng: number;
  n: number;
  threats: number;
  allies: number;
  grade: NewsGrade;
  /** The city's loudest LIVING story — what a click selects. */
  topId: string;
  topHeadline: string;
  maxSeverity: number;
  freshest: Freshness;
}

/* ── the economic calendar ────────────────────────────────────────────────
   What's SCHEDULED to move markets — the wire's counterpart (news happened;
   these are appointments). Deterministic per day off the engine clock, so
   replay shows the calendar as it stood. Times are the terminal's local
   frame, like every other clock on the desk. */
export interface EconEvent {
  id: string;
  title: string;
  region: 'USD' | 'EUR' | 'JPY' | 'GBP' | 'AUD' | 'CNY';
  /** The calendar's three tiers, the ones every economic calendar uses: high moves the market on its own, medium a sector or a currency, low is noted */
  impact: 'high' | 'medium' | 'low';
  dayLabel: string;
  timeLabel: string;
  /** Minutes from now — negative means it already printed today. */
  inMinutes: number;
  forecast?: string;
  previous?: string;
}

const ECON_CATALOG: {
  title: string;
  region: EconEvent['region'];
  impact: EconEvent['impact'];
  dayOffset: number;
  hour: number;
  minute: number;
  unit?: string;
  base?: number;
}[] = [
  { title: 'Initial jobless claims', region: 'USD', impact: 'medium', dayOffset: 0, hour: 8, minute: 30, unit: 'K', base: 232 },
  { title: 'Treasury 10-yr auction', region: 'USD', impact: 'low', dayOffset: 0, hour: 13, minute: 0 },
  { title: 'Consumer credit', region: 'USD', impact: 'low', dayOffset: 0, hour: 15, minute: 0 },
  { title: 'Fed speakers (3)', region: 'USD', impact: 'high', dayOffset: 1, hour: 10, minute: 0 },
  { title: 'CPI y/y', region: 'USD', impact: 'high', dayOffset: 1, hour: 8, minute: 30, unit: '%', base: 2.5 },
  { title: 'BOJ Core CPI y/y', region: 'JPY', impact: 'high', dayOffset: 1, hour: 19, minute: 30, unit: '%', base: 1.4 },
  { title: 'German ifo Business Climate', region: 'EUR', impact: 'medium', dayOffset: 2, hour: 4, minute: 0, unit: '', base: 87.1 },
  { title: 'FOMC meeting minutes', region: 'USD', impact: 'high', dayOffset: 2, hour: 14, minute: 0 },
  { title: 'UK GDP q/q', region: 'GBP', impact: 'medium', dayOffset: 3, hour: 2, minute: 0, unit: '%', base: 0.3 },
  { title: 'ECB minutes', region: 'EUR', impact: 'medium', dayOffset: 3, hour: 7, minute: 30 },
  { title: 'RBA meeting minutes', region: 'AUD', impact: 'low', dayOffset: 3, hour: 21, minute: 30 },
  { title: 'Nonfarm payrolls', region: 'USD', impact: 'high', dayOffset: 4, hour: 8, minute: 30, unit: 'K', base: 178 },
  { title: 'China Caixin PMI', region: 'CNY', impact: 'high', dayOffset: 4, hour: 21, minute: 45, unit: '', base: 50.4 },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function buildEconCalendar(): EconEvent[] {
  const t0 = now();
  const daySeed = t0.getFullYear() * 372 + (t0.getMonth() + 1) * 31 + t0.getDate();
  return ECON_CATALOG.map((c, i) => {
    const dt = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + c.dayOffset, c.hour, c.minute);
    const h = Math.abs(Math.sin(daySeed * 7 + i * 13.7)) % 1;
    const fmt = (v: number) => (c.unit === 'K' ? `${Math.round(v)}K` : c.unit === '%' ? `${v.toFixed(1)}%` : v.toFixed(1));
    const prev = c.base != null ? c.base : undefined;
    const fcst = c.base != null ? c.base * (1 + (h - 0.5) * 0.06) : undefined;
    return {
      id: `econ-${i}`,
      title: c.title,
      region: c.region,
      impact: c.impact,
      dayLabel: `${DAY_NAMES[dt.getDay()]} ${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
      timeLabel: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      inMinutes: Math.round((dt.getTime() - t0.getTime()) / 60_000),
      forecast: fcst != null ? fmt(fcst) : undefined,
      previous: prev != null ? fmt(prev) : undefined,
    };
  })
    .filter(e => e.inMinutes > -600)
    .sort((a, b) => a.inMinutes - b.inMinutes);
}

/* ── synthesized insights ─────────────────────────────────────────────────
   The room reading its own wire — a few composed sentences over the whole
   board, numbers left inline for RichRead to ink. Derived, never invented:
   every figure comes from the same events the planet is drawing. */
export interface RoomInsight {
  key: string;
  title: string;
  read: string;
  /** The header's ink — the insight's own lean, never decoration. */
  ink: 'bull' | 'bear' | 'neutral';
}

export function buildRoomInsights(events: GeoNewsEvent[]): RoomInsight[] {
  const out: RoomInsight[] = [];
  const positive = events.filter(e => e.grade === 'ALLY').length;
  const negative = events.filter(e => e.grade === 'THREAT').length;
  const lean = positive > negative ? 'positive' : negative > positive ? 'negative' : 'split';
  const top = [...events].sort((a, b) => b.severity - a.severity)[0];
  if (top) {
    out.push({
      key: 'lean',
      title: "Today's lean",
      ink: lean === 'positive' ? 'bull' : lean === 'negative' ? 'bear' : 'neutral',
      read: `${positive} positive against ${negative} negative across ${events.length} headlines — the wire is ${
        lean === 'split' ? 'split down the middle' : `net ${lean}`
      }. The heaviest print is ${top.item.ticker ?? 'index-level'} out of ${top.origin.city}.`,
    });
  }
  const cats = new Map<string, number>();
  for (const e of events) cats.set(e.item.category, (cats.get(e.item.category) ?? 0) + 1);
  const [topCat, topCatN] = [...cats.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['—', 0];
  out.push({
    key: 'beat',
    title: 'Biggest story type',
    ink: 'neutral',
    read: `${topCat} carries ${topCatN} of ${events.length} stories today — when one beat crowds the tape, moves cluster around its names and the rest of the board trades quiet.`,
  });
  const macro = events.filter(e => !e.item.ticker);
  const macroLift = macro.filter(e => e.grade === 'ALLY').length;
  const macroPress = macro.filter(e => e.grade === 'THREAT').length;
  out.push({
    key: 'macro',
    title: 'Macro backdrop',
    ink: macroLift > macroPress ? 'bull' : macroPress > macroLift ? 'bear' : 'neutral',
    read: `${macro.length} index-level prints against ${events.length - macro.length} single names. The macro tape leans ${
      macroLift > macroPress ? 'supportive' : macroPress > macroLift ? 'heavy' : 'neutral'
    } — single-name stories trade with that wind ${macroLift > macroPress ? 'behind' : macroPress > macroLift ? 'against' : 'beside'} them.`,
  });
  const fresh = events.filter(e => freshnessOf(e) === 'fresh');
  if (fresh.length > 0) {
    out.push({
      key: 'fresh',
      title: 'Just landed',
      ink: 'neutral',
      read: `${fresh.length} ${fresh.length === 1 ? 'story is' : 'stories are'} under an hour old and still rippling — ${fresh
        .slice(0, 3)
        .map(e => e.item.ticker ?? 'macro')
        .join(', ')} ${fresh.length === 1 ? 'is' : 'are'} the freshest ink on the board.`,
    });
  }
  return out;
}

export function clusterByCity(events: GeoNewsEvent[]): CityPing[] {
  const by = new Map<string, GeoNewsEvent[]>();
  for (const e of events) {
    const list = by.get(e.origin.city) ?? [];
    list.push(e);
    by.set(e.origin.city, list);
  }
  return [...by.entries()].map(([city, list]) => {
    const threats = list.filter(e => e.grade === 'THREAT').length;
    const allies = list.filter(e => e.grade === 'ALLY').length;
    const top = [...list].sort((a, b) => b.severity - a.severity)[0];
    const order: Freshness[] = ['fresh', 'developing', 'faded'];
    const freshest = order.find(f => list.some(e => freshnessOf(e) === f)) ?? 'faded';
    return {
      city,
      lat: top.origin.lat,
      lng: top.origin.lng,
      n: list.length,
      threats,
      allies,
      grade: threats > allies ? 'THREAT' : allies > threats ? 'ALLY' : top.grade,
      topId: top.id,
      topHeadline: top.item.headline,
      maxSeverity: top.severity,
      freshest,
    };
  });
}
