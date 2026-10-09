/*
==================================================
  SLAYER TERMINAL - ONE STORY PER SETUP (components/compass/campaignStore.ts)

  A setup's campaign — WHEN the sweep found it, the
  bar and the premium it was found at, the targets
  and the floor frozen there — and what the tape has
  done to it since: which targets a candle crossed,
  and whether a close broke the floor.

  ONE DERIVATION, READ BY EVERY SURFACE (the audit's
  CO-1, 2026-10-09: NVDA 120P wore "TP1 HIT" on its
  card, "Targets 0 of 3 hit" in its page head and
  "TARGET 1 $1.02 · hit" on the premium view — the
  card read the engine's rolled flags, the page
  scanned the tape from the moment it OPENED, the
  premium chart printed its own). The card, the
  table, the page head, both charts and the Tracker
  all ask `statusOf` here, against the record the
  sweep wrote, so one setup tells one story.

  FOUND AT IS THE SWEEP'S MOMENT (CO-5): the board
  notes every setup it ranks; a page opened on an
  address no sweep has listed notes itself, and says
  "opened at" rather than "found at". Kept for the
  New York day in this tab (sessionStorage), so a
  reload does not move a setup's entry.
==================================================
*/

import Simulator from '../../core/simulator';
import { nyIsoDate } from '../../core/nyTime';
import type { Setup, TakeProfit } from '../../types/compass';

export interface CampaignRecord {
  id: string;
  ticker: string;
  right: 'C' | 'P';
  /** When the sweep (or the page) first saw it, epoch ms */
  foundAt: number;
  /** 'sweep' — a board sweep listed it; 'opened' — its page was opened on an address no sweep had listed */
  how: 'sweep' | 'opened';
  /** The last bar on the tape at that moment (UTC seconds) — hits count from the bars after it */
  time: number;
  /** The premium it was found at — the entry */
  mid: number;
  priceTargets: number[];
  invalidationPrice: number;
  takeProfits: TakeProfit[];
}

export interface CampaignHit {
  /** Target rung, 1-based */
  level: number;
  /** Bar time (UTC seconds) of the candle that crossed it */
  time: number;
}
export interface CampaignBreak {
  time: number;
  price: number;
  floor: number;
}
export interface CampaignStatus {
  hits: CampaignHit[];
  brk: CampaignBreak | null;
  /** The highest target hit, or null */
  hitLevel: number | null;
}

const KEY = 'slayer_compass_found_v1';
const records = new Map<string, CampaignRecord>();
let day = '';

/* Read once per New York day: yesterday's records are dropped, so a setup found again today starts again */
function hydrate(): void {
  const today = nyIsoDate();
  if (day === today) return;
  day = today;
  records.clear();
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as { day?: string; rows?: CampaignRecord[] }) : null;
    if (parsed?.day === today && Array.isArray(parsed.rows)) for (const r of parsed.rows) if (r && typeof r.id === 'string') records.set(r.id, r);
  } catch {
    /* storage off or garbled — the records start empty */
  }
}

let saveQueued = false;
function save(): void {
  if (saveQueued) return;
  saveQueued = true;
  /* one write per burst — a sweep notes a whole board at once */
  queueMicrotask(() => {
    saveQueued = false;
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ day, rows: [...records.values()].slice(-400) }));
    } catch {
      /* full or off — the records live for the page */
    }
  });
}

const lastBarTime = (ticker: string): number => {
  const bars = Simulator.peekCandles(ticker);
  return bars && bars.length ? bars[bars.length - 1].time : Math.floor(Date.now() / 1000);
};

/** The record for this setup, if a sweep or its page has noted it */
export function recordOf(id: string): CampaignRecord | null {
  hydrate();
  return records.get(id) ?? null;
}

/** Note a setup as found — once; a setup already noted keeps its first moment */
export function noteFound(setup: Setup, how: CampaignRecord['how'] = 'sweep', at = Date.now()): CampaignRecord {
  hydrate();
  const had = records.get(setup.id);
  if (had) return had;
  const rec: CampaignRecord = {
    id: setup.id,
    ticker: setup.ticker,
    right: setup.right,
    foundAt: at,
    how,
    time: lastBarTime(setup.ticker),
    mid: setup.mid,
    priceTargets: setup.priceTargets,
    invalidationPrice: setup.invalidationPrice,
    takeProfits: setup.takeProfits.map(tp => ({ ...tp, status: 'PENDING' })),
  };
  records.set(setup.id, rec);
  save();
  return rec;
}

/** A record carried in from elsewhere (the Tracker keeps the one it tracked) — taken only when none is held */
export function adoptRecord(rec: CampaignRecord): void {
  hydrate();
  if (records.has(rec.id)) return;
  records.set(rec.id, rec);
  save();
}

/** The setup as its campaign stands: the defining figures frozen at the record, the market's read live */
export function frozen(setup: Setup, rec: CampaignRecord | null): Setup {
  if (!rec) return setup;
  return { ...setup, mid: rec.mid, priceTargets: rec.priceTargets, invalidationPrice: rec.invalidationPrice, takeProfits: rec.takeProfits };
}

/* THE TAPE'S VERDICT, latched: a watermark per setup so a render reads only the bars it has not read, and nothing banks
   after the floor breaks — the campaign died first */
const scans = new Map<string, { scanned: number; hits: Map<number, number>; brk: CampaignBreak | null; out: CampaignStatus }>();
const EMPTY: CampaignStatus = { hits: [], brk: null, hitLevel: null };

export function statusOf(rec: CampaignRecord | null): CampaignStatus {
  if (!rec) return EMPTY;
  let st = scans.get(rec.id);
  if (!st || st.scanned < rec.time - 1) {
    st = { scanned: rec.time, hits: new Map(), brk: null, out: EMPTY };
    scans.set(rec.id, st);
  }
  if (st.brk) return st.out;
  const bars = Simulator.peekCandles(rec.ticker);
  if (!bars || !bars.length || bars[bars.length - 1].time <= st.scanned) return st.out;
  const call = rec.right === 'C';
  let changed = false;
  /* from the first bar after the watermark — the tape only grows at its end */
  let i = bars.length - 1;
  while (i > 0 && bars[i - 1].time > st.scanned) i--;
  for (; i < bars.length; i++) {
    const b = bars[i];
    if (b.time <= st.scanned) continue;
    /* the forming bar is read again next time: its high and low are not final */
    if (i === bars.length - 1) break;
    st.scanned = b.time;
    rec.priceTargets.forEach((target, k) => {
      if (!st!.hits.has(k + 1) && (call ? b.high >= target : b.low <= target)) {
        st!.hits.set(k + 1, b.time);
        changed = true;
      }
    });
    if (call ? b.close < rec.invalidationPrice : b.close > rec.invalidationPrice) {
      st.brk = { time: b.time, price: b.close, floor: rec.invalidationPrice };
      changed = true;
      break;
    }
  }
  if (changed) {
    const hits = [...st.hits.entries()].map(([level, time]) => ({ level, time })).sort((a, b) => a.level - b.level);
    st.out = { hits, brk: st.brk, hitLevel: hits.length ? hits[hits.length - 1].level : null };
  }
  return st.out;
}

/** The highest target hit for a setup, by the one derivation — null when nothing has, or no sweep noted it */
export const hitLevelOf = (id: string): number | null => statusOf(recordOf(id)).hitLevel;
