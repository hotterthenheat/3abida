/*
==================================================
  SLAYER TERMINAL - WHAT'S BEING BUILT
  (data/building.ts)

  The fifth page of Pinpoint (2026-09-07). The Map
  says where the hedging sits. This says which of
  it arrived TODAY — strike by strike, the hedging
  added or taken off since the open, so a wall can
  be seen forming before it is the wall and
  draining before it breaks.

  THE ARITHMETIC. Every snapshot of the day carries
  open interest at each strike (calls and puts).
  The change since the first snapshot, valued at
  today's per-contract hedging (the chain's own
  units at the live spot), is the hedging that
  trading added:

      added(K) = Δcalls(K) · unitCall(K)
               + Δputs(K)  · unitPut(K)

  in the house sign (negative = call-dominant =
  dealers absorb, positive = put-dominant = they
  amplify). What was there at the open is what sits
  there now minus that. The wall's SIZE change —
  |now| − |open| — is the read: built or drained.
  Valuing both ends at today's spot keeps the price
  move out of it: a wall does not "build" because
  price walked toward it.

  THE PACE. Today's change over the minutes run
  gives dollars per minute; the same pace over the
  minutes left projects each strike to the close,
  and the walls re-picked on that projected book
  say where the levels are heading. A straight
  line, stated as one — not a forecast.

  ON REAL DATA the exchanges publish open interest
  overnight; the intraday figure is our estimate
  from the day's trades, and the guide says so.
==================================================
*/

import { sessionStarts } from './indicators';
import { pickFlip, pickWalls } from '../core/walls';
import { CLOSE_MIN, OPEN_MIN, SESSION_MIN, fmtDollars, fmtStrike, hhmm, type AheadClock } from './ahead';
import type { ExposureProfileData } from '../types/gex';
import type { Candle, GexSnapshot, MarketSnapshot } from '../types/market';

export type BuildRole = 'call wall' | 'put wall' | 'supreme' | null;
export type BuildVerdict = 'building' | 'draining' | 'steady' | 'switched' | 'new';

export interface BuildRow {
  strike: number;
  role: BuildRole;
  pin: boolean;
  /** Net hedging at the strike now — signed dollars, house sign */
  now: number;
  /** What the open's contracts are worth at today's spot — same sign */
  open: number;
  /** Dollars of call hedging added today (negative = taken off) */
  callAdded: number;
  /** Dollars of put hedging added today (negative = taken off) */
  putAdded: number;
  /** Contracts */
  dCall: number;
  dPut: number;
  /** |now| − |open| — the wall's size change, positive = built */
  sizeChange: number;
  /** The wall's size through the day, sampled, 0..1 of the row's own peak */
  shape: number[];
  /** Where most of the change landed: early · middle · late — null when nothing moved */
  when: 'early' | 'middle' | 'late' | null;
  verdict: BuildVerdict;
  /** Size change projected to the close at today's pace, dollars */
  byClose: number;
  /** The read line */
  words: string;
}

export interface Challenger {
  strike: number;
  /** Dollars still short of the wall's size */
  needs: number;
  /** "by 15:10" · null when today's pace never gets there */
  by: string | null;
  /** True when the wall itself is growing faster than its challenger */
  outrun: boolean;
}

export interface WallHeading {
  name: 'Call wall' | 'Put wall' | 'Supreme' | 'Flip';
  open: number | null;
  now: number | null;
  close: number | null;
  words: string;
  challenger: Challenger | null;
}

export interface Building {
  ticker: string;
  spot: number;
  rows: BuildRow[];
  /** The scale for the "now" capsules — largest |now| in the window */
  maxAbs: number;
  /** The scale for the change bars — largest |callAdded| or |putAdded| in the window */
  maxChange: number;
  /** Sum of every positive size change in the window */
  built: number;
  /** Sum of every negative size change (a positive number) */
  drained: number;
  fastestUp: BuildRow | null;
  fastestDown: BuildRow | null;
  /** Rows above spot, descending — the spot rule prints after this index */
  spotAfter: number;
  /** Minutes of trading behind the change */
  elapsedMin: number;
  minutesLeft: number;
  inSession: boolean;
  heading: WallHeading[];
  sentence: string;
  /** False when the snapshots carry no open interest at all */
  hasOi: boolean;
}

/** A size change smaller than this share of the biggest wall reads as steady */
const MATERIAL = 0.05;
/** Points on each row's shape */
const SHAPE_POINTS = 40;

const fmtContracts = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString('en-US')}`;
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${fmtDollars(v)}`;

const sideWords = (v: number) => (v < 0 ? 'call-heavy, dealers push back on moves here' : 'put-heavy, dealers push moves along here');

/** Today's snapshots by the bars' own session cut — the same cut every session feature uses */
export function todaySnapshots(snaps: readonly GexSnapshot[], bars: readonly Candle[]): GexSnapshot[] {
  if (!snaps.length || !bars.length) return [];
  const starts = sessionStarts(bars, 1);
  const dayStart = bars[starts[starts.length - 1]].time;
  return snaps.filter(s => s.time >= dayStart);
}

export function buildBuilding(
  snapshot: MarketSnapshot,
  snaps: readonly GexSnapshot[],
  bars: readonly Candle[],
  profile: ExposureProfileData,
  clock: AheadClock
): Building {
  const { ticker, spot } = snapshot;
  const today = todaySnapshots(snaps, bars);
  const hasOi = today.length >= 2 && today.some(s => s.levels.some(l => l.callOI !== undefined));
  const first = today[0];
  const last = today[today.length - 1];
  const elapsedMin = clock.inSession && clock.nowMin != null ? Math.max(30, clock.nowMin - OPEN_MIN) : SESSION_MIN;
  const minutesLeft = clock.minutesLeft;

  /* Per-contract hedging at today's spot — the chain's own units */
  const unit = new Map<number, { call: number; put: number; net: number }>();
  for (const n of snapshot.chain) unit.set(n.strike, { call: n.callOI ? n.callGex / n.callOI : 0, put: n.putOI ? n.putGex / n.putOI : 0, net: n.netGex });

  const openAt = new Map<number, { c: number; p: number }>();
  if (hasOi) for (const l of first.levels) openAt.set(l.strike, { c: l.callOI ?? 0, p: l.putOI ?? 0 });
  const nowAt = new Map<number, { c: number; p: number }>();
  if (hasOi) for (const l of last.levels) nowAt.set(l.strike, { c: l.callOI ?? 0, p: l.putOI ?? 0 });

  /* Sampled OI through the day, per strike, for the shapes */
  const stepN = Math.max(1, Math.floor(today.length / SHAPE_POINTS));
  const sampled = today.filter((_, i) => i % stepN === 0 || i === today.length - 1);

  const { levels } = profile;
  const maxAbsBook = Math.max(1, ...profile.strikes.map(s => Math.abs(unit.get(s.strike)?.net ?? 0)));

  const rows: BuildRow[] = [];
  let maxAbs = 1;
  let maxChange = 1;
  for (const s of profile.strikes) {
    const K = s.strike;
    const u = unit.get(K) ?? { call: 0, put: 0, net: 0 };
    const now = u.net;
    const o = openAt.get(K);
    const n = nowAt.get(K) ?? { c: 0, p: 0 };
    const isNew = hasOi && !o;
    const dCall = hasOi ? n.c - (o?.c ?? 0) : 0;
    const dPut = hasOi ? n.p - (o?.p ?? 0) : 0;
    /* Dollars in the house sign — call units are negative, so "calls added" is |dCall · unit| */
    const callAddedSigned = dCall * u.call;
    const putAddedSigned = dPut * u.put;
    const added = callAddedSigned + putAddedSigned;
    const open = now - added;
    const callAdded = dCall * Math.abs(u.call);
    const putAdded = dPut * Math.abs(u.put);
    const sizeChange = Math.abs(now) - Math.abs(open);

    /* The shape: the wall's size through the day at today's units */
    const series = sampled.map(snap => {
      const l = snap.levels.find(x => x.strike === K);
      return l ? Math.abs((l.callOI ?? 0) * u.call + (l.putOI ?? 0) * u.put) : 0;
    });
    const peak = Math.max(1, ...series);
    const shape = series.map(v => v / peak);
    let when: BuildRow['when'] = null;
    if (series.length >= 3 && Math.abs(sizeChange) > 0) {
      const third = Math.floor(series.length / 3);
      const d1 = series[third] - series[0];
      const d2 = series[2 * third] - series[third];
      const d3 = series[series.length - 1] - series[2 * third];
      const dir = Math.sign(sizeChange);
      const parts = [d1 * dir, d2 * dir, d3 * dir];
      const i = parts.indexOf(Math.max(...parts));
      when = i === 0 ? 'early' : i === 1 ? 'middle' : 'late';
    }

    const material = Math.abs(sizeChange) >= MATERIAL * maxAbsBook;
    const switched = hasOi && Math.sign(now) !== Math.sign(open) && Math.abs(now) >= MATERIAL * maxAbsBook && Math.abs(open) >= MATERIAL * maxAbsBook;
    const verdict: BuildVerdict = isNew && material ? 'new' : switched ? 'switched' : material ? (sizeChange > 0 ? 'building' : 'draining') : 'steady';
    const byClose = (sizeChange / elapsedMin) * minutesLeft;

    const role: BuildRole = K === levels.callWall ? 'call wall' : K === levels.putWall ? 'put wall' : K === levels.supreme ? 'supreme' : null;
    rows.push({ strike: K, role, pin: !!s.pin, now, open, callAdded, putAdded, dCall, dPut, sizeChange, shape, when, verdict, byClose, words: '' });
    maxAbs = Math.max(maxAbs, Math.abs(now));
    maxChange = Math.max(maxChange, Math.abs(callAdded), Math.abs(putAdded));
  }

  /* The words, once the scale is known */
  const whenWords = (w: BuildRow['when']) => (w === 'early' ? 'mostly early in the day' : w === 'middle' ? 'mostly through the middle of the day' : w === 'late' ? 'mostly late in the day' : '');
  for (const r of rows) {
    const head = `${fmtStrike(r.strike)}${r.role ? ` · ${r.role}` : ''} · ${fmtDollars(r.now)} of hedging now, ${sideWords(r.now)}`;
    if (!hasOi) {
      r.words = `${head} · no open interest on this feed yet`;
      continue;
    }
    const change = `${clock.inSession ? 'today' : 'last session'} ${signed(r.sizeChange)} (${fmtContracts(r.dCall)} calls, ${fmtContracts(r.dPut)} puts)`;
    const pace = clock.inSession && r.verdict !== 'steady' ? ` · ${signed(r.byClose)} ${r.byClose >= 0 ? 'more' : 'further'} by the close at today's pace` : '';
    const tail =
      r.verdict === 'switched'
        ? ` · it changed sides today: was ${r.open < 0 ? 'call-heavy' : 'put-heavy'}`
        : r.verdict === 'new'
          ? ' · nothing sat here at the open'
          : r.verdict === 'steady'
            ? ' · steady'
            : r.when
              ? ` · ${whenWords(r.when)}`
              : '';
    r.words = `${head} · ${change}${tail}${pace}`;
  }

  const built = rows.reduce((a, r) => a + Math.max(0, r.sizeChange), 0);
  const drained = rows.reduce((a, r) => a + Math.max(0, -r.sizeChange), 0);
  const byUp = [...rows].sort((a, b) => b.sizeChange - a.sizeChange);
  const fastestUp = byUp[0] && byUp[0].sizeChange > 0 ? byUp[0] : null;
  const fastestDown = byUp[byUp.length - 1] && byUp[byUp.length - 1].sizeChange < 0 ? byUp[byUp.length - 1] : null;
  const spotAfter = rows.findIndex(r => r.strike < spot);

  /* WHERE THE WALLS ARE HEADING — the levels re-picked on the open's book and on the projected one */
  const openPts = rows.map(r => ({ strike: r.strike, v: r.open }));
  const nowPts = rows.map(r => ({ strike: r.strike, v: r.now }));
  const closePts = rows.map(r => ({ strike: r.strike, v: r.now + ((r.now - r.open) / elapsedMin) * minutesLeft }));
  const walls = (pts: { strike: number; v: number }[]) => pickWalls(pts, spot, p => p.v);
  const supremeOf = (pts: { strike: number; v: number }[]) => pts.reduce<{ strike: number; v: number } | null>((b, p) => (!b || Math.abs(p.v) > Math.abs(b.v) ? p : b), null)?.strike ?? null;
  const wOpen = walls(openPts);
  const wNow = walls(nowPts);
  const wClose = walls(closePts);
  const horizon = clock.inSession ? 'by the close' : 'over the next session at that pace';

  const challengerFor = (side: 'call' | 'put', wall: number | null): Challenger | null => {
    if (wall == null) return null;
    const w = rows.find(r => r.strike === wall);
    if (!w) return null;
    const cands = rows.filter(r => r.strike !== wall && (side === 'call' ? r.strike > spot && r.now < 0 : r.strike < spot && r.now > 0) && r.sizeChange > 0);
    if (!cands.length) return null;
    const c = cands.sort((a, b) => b.sizeChange - a.sizeChange)[0];
    const needs = Math.abs(w.now) - Math.abs(c.now);
    if (needs <= 0) return null;
    const rate = (c.sizeChange - w.sizeChange) / elapsedMin;
    let by: string | null = null;
    if (rate > 0 && clock.inSession && clock.nowMin != null) {
      const t = needs / rate;
      if (t <= minutesLeft) by = hhmm(Math.min(CLOSE_MIN, Math.round(clock.nowMin + t)));
    }
    return { strike: c.strike, needs, by, outrun: rate <= 0 };
  };

  const levelWords = (name: string, open: number | null, now: number | null, close: number | null, ch: Challenger | null): string => {
    const moved = open != null && now != null && open !== now ? `moved from ${fmtStrike(open)} to ${fmtStrike(now)} today` : now != null ? `at ${fmtStrike(now)} since the open` : `none ${name === 'Call wall' ? 'overhead' : 'underneath'}`;
    const ahead = close == null || now == null ? '' : close === now ? ` · holds ${horizon}` : ` · ${horizon} it moves to ${fmtStrike(close)}`;
    const chal = ch ? ` · ${fmtStrike(ch.strike)} is growing fastest ${name === 'Call wall' ? 'above' : 'below'}, ${fmtDollars(ch.needs)} short${ch.by ? `, there by ${ch.by} at today's pace` : ch.outrun ? ', but the wall is growing faster' : ''}` : '';
    return `${moved}${ahead}${chal}`;
  };

  const callCh = challengerFor('call', wNow.callWall);
  const putCh = challengerFor('put', wNow.putWall);
  const supOpen = supremeOf(openPts);
  const supNow = supremeOf(nowPts);
  const supClose = supremeOf(closePts);
  const flipOpen = pickFlip(openPts, spot, p => p.v);
  const flipNow = pickFlip(nowPts, spot, p => p.v);
  const flipClose = pickFlip(closePts, spot, p => p.v);

  const heading: WallHeading[] = [
    { name: 'Call wall', open: wOpen.callWall, now: wNow.callWall, close: wClose.callWall, words: levelWords('Call wall', wOpen.callWall, wNow.callWall, wClose.callWall, callCh), challenger: callCh },
    { name: 'Put wall', open: wOpen.putWall, now: wNow.putWall, close: wClose.putWall, words: levelWords('Put wall', wOpen.putWall, wNow.putWall, wClose.putWall, putCh), challenger: putCh },
    { name: 'Supreme', open: supOpen, now: supNow, close: supClose, words: levelWords('Supreme', supOpen, supNow, supClose, null), challenger: null },
    { name: 'Flip', open: flipOpen, now: flipNow, close: flipClose, words: levelWords('Flip', flipOpen, flipNow, flipClose, null), challenger: null },
  ];

  /* THE SENTENCE */
  let sentence: string;
  if (!hasOi) sentence = 'Open interest is not on this feed yet, so nothing can be read as built or drained.';
  else {
    const parts: string[] = [];
    if (clock.inSession) {
      if (fastestUp) parts.push(`${fmtStrike(fastestUp.strike)} is being built: ${fmtDollars(fastestUp.sizeChange)} of new hedging today${fastestUp.role ? `, and it is the ${fastestUp.role}` : ''}.`);
      if (fastestDown) parts.push(`${fmtStrike(fastestDown.strike)} is draining, ${signed(fastestDown.sizeChange)}${fastestDown.role ? `, the ${fastestDown.role}` : ''}.`);
      if (!parts.length) parts.push('Nothing has been built or drained today.');
    } else {
      if (fastestUp) parts.push(`${fmtStrike(fastestUp.strike)} was built in the last session: ${fmtDollars(fastestUp.sizeChange)} of new hedging${fastestUp.role ? `, and it is the ${fastestUp.role}` : ''}.`);
      if (fastestDown) parts.push(`${fmtStrike(fastestDown.strike)} drained, ${signed(fastestDown.sizeChange)}${fastestDown.role ? `, the ${fastestDown.role}` : ''}.`);
      if (!parts.length) parts.push('Nothing was built or drained in the last session.');
    }
    const ch = callCh?.by ? `At today's pace ${fmtStrike(callCh.strike)} overtakes ${fmtStrike(wNow.callWall!)} as the call wall by ${callCh.by}.` : putCh?.by ? `At today's pace ${fmtStrike(putCh.strike)} overtakes ${fmtStrike(wNow.putWall!)} as the put wall by ${putCh.by}.` : wNow.callWall != null && wClose.callWall === wNow.callWall && wNow.putWall != null && wClose.putWall === wNow.putWall ? `Both walls hold ${horizon}.` : '';
    if (ch) parts.push(ch);
    sentence = parts.join(' ');
  }

  return { ticker, spot, rows, maxAbs, maxChange, built, drained, fastestUp, fastestDown, spotAfter, elapsedMin, minutesLeft, inSession: clock.inSession, heading, sentence, hasOi };
}
