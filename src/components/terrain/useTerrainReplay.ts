/*
==================================================
  SLAYER TERMINAL - TERRAIN'S REPLAY
  (components/terrain/useTerrainReplay.ts)

  The owner's item 8 (2026-10-14). A pane's replay is a
  CURSOR — one minute of the tape — and everything the
  pane draws is read at it: the chart takes a tape cut
  there (data/replayFrame.ts), the levels, the ladder and
  its ghost dots stand on the field's column there, the
  priced move is the cursor's day's, and the level alerts
  watched on the name are judged minute by minute on the
  frames and written to the replay's own log (item 7's
  "in replay, alerts evaluate only data <= cursor and
  write to a separate replay log").

  The transport: play and pause, a bar on or back (to
  the bar's end, the chart's timeframe), 1×, 5×, 20× and
  60× the market's own time, a jump to a session and a
  time, a random start (a session the replay can draw
  whole, a time in it), and hide the future (on by
  default — off, the rest of the session stands faded
  right of the cursor). The keys: Shift ↓ plays and
  pauses, Shift → steps a bar (TradingView's).

  Nothing the cursor could not have known is read: the
  track record and the calibration stand on sessions
  after it and are left off; the official close is not
  known until the session is over.
==================================================
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Candle, GexSnapshot } from '../../types/market';
import { clock, nyIsoDate, nyWallTime } from '../../core/nyTime';
import {
  GrowingCut,
  REPLAY_SPEEDS,
  countAtOrBefore,
  dailyAt,
  dayMinutes,
  frameAt,
  knowableAt,
  laggedAt,
  lastAtOrBefore,
  minuteFromText,
  msPerMinute,
  randomStart,
  readinessOf,
  stepCursor,
  tapeDays,
  type ReplayFrame,
  type ReplaySpeed,
  type SessionReadiness,
} from '../../data/replayFrame';
import { LevelAlertEngine, noteLevelEvents, useLevelWatches, type LevelInputs } from '../../data/levelAlerts';

export interface ReplayCtl {
  phase: 'pick' | 'play';
  cursor: number;
  playing: boolean;
  speed: ReplaySpeed;
  hideFuture: boolean;
}

interface Args {
  /** The desk's flag: this pane is replaying */
  on: boolean;
  ticker: string;
  /** The chart's minutes on the timeframe — the step's bar */
  minutes: number;
  /** The tape's one-minute bars, ascending (the feed's, or the house's) */
  bars: readonly Candle[] | null;
  /** The field's columns, ascending (the replay's twin on the feed — the recorder's sessions as shown) */
  cols: readonly GexSnapshot[];
  /** Day bars for 1D and 1W, ascending */
  daily?: readonly Candle[] | null;
  compareBars?: Record<string, { bars: Candle[]; daily?: Candle[] | null }>;
  /** Each session's priced move: true in, false not in (or still asked), null where the market has none (the house) */
  budgetOf: (day: string) => boolean | null;
  /** The strike step, for the level alerts' re-arm */
  step: number;
  /** The day's ±σ at the prior close, for the σ alerts — the cursor's day's */
  sigmaOf: (day: string) => { prevClose: number; s: number } | null;
}

const SAME = (a: Candle, b: Candle) => a.time === b.time && a.close === b.close && a.high === b.high && a.low === b.low;
const COL_SAME = (a: GexSnapshot, b: GexSnapshot) => a === b || (a.time === b.time && a.levels === b.levels);

export function useTerrainReplay(a: Args) {
  const { on, ticker, minutes, bars, cols, daily, compareBars, budgetOf, step, sigmaOf } = a;
  const [ctl, setCtl] = useState<ReplayCtl | null>(null);
  /* the desk's flag on: the pick, paused at 20×; off: gone */
  useEffect(() => {
    setCtl(on ? { phase: 'pick', cursor: 0, playing: false, speed: 20, hideFuture: true } : null);
  }, [on]);
  /* a new name ends it — the desk's own rule (a replay was recorded in another world) */
  useEffect(() => setCtl(c => (c ? { phase: 'pick', cursor: 0, playing: false, speed: c.speed, hideFuture: c.hideFuture } : c)), [ticker]);

  const src = bars ?? null;
  const playing = !!ctl && ctl.phase === 'play';
  const cursor = playing ? ctl!.cursor : 0;

  /* ---- the cut, grown in place as the cursor moves on ---- */
  const barCut = useRef(new GrowingCut<Candle>(b => b.time, SAME));
  const colCut = useRef(new GrowingCut<GexSnapshot>(c => c.time, COL_SAME));
  const cmpCuts = useRef(new Map<string, GrowingCut<Candle>>());
  const cut = useMemo(() => {
    if (!playing || !src) return null;
    const b = barCut.current.cut(src, cursor);
    const c = colCut.current.cut(cols, cursor);
    const d = daily ? dailyAt(daily, b, cursor) : undefined;
    let cmp: Record<string, { bars: Candle[]; daily?: Candle[] | null }> | undefined;
    if (compareBars) {
      cmp = {};
      for (const [t, v] of Object.entries(compareBars)) {
        let g = cmpCuts.current.get(t);
        if (!g) cmpCuts.current.set(t, (g = new GrowingCut<Candle>(x => x.time, SAME)));
        const cb = g.cut(v.bars, cursor);
        cmp[t] = { bars: cb, daily: v.daily ? dailyAt(v.daily, cb, cursor) : v.daily };
      }
    }
    return { bars: b, cols: c, daily: d, compareBars: cmp, version: `${barCut.current.version}|${colCut.current.version}|${cursor}` };
  }, [playing, src, cols, daily, compareBars, cursor]);

  /* ---- the frame at the cursor, and the ghost dots ---- */
  const frame: ReplayFrame | null = useMemo(() => (cut ? frameAt(cut.bars, cut.cols, cursor) : null), [cut, cursor]);
  const lagged = useMemo(() => (cut ? laggedAt(cut.cols, cursor) : null), [cut, cursor]);

  /* ---- the future, when it is not hidden: the rest of the cursor's session ---- */
  const day = playing ? nyIsoDate(cursor * 1000) : '';
  const minutesOfDay = useMemo(() => (src && day ? dayMinutes(src, day) : []), [src, day]);
  const future = useMemo(() => {
    if (!playing || !src || ctl!.hideFuture || !minutesOfDay.length) return null;
    const from = countAtOrBefore(src, cursor, b => b.time);
    const to = countAtOrBefore(src, minutesOfDay[minutesOfDay.length - 1], b => b.time);
    return src.slice(from, to);
  }, [playing, src, cursor, ctl, minutesOfDay]);

  /* ---- the sessions: the tape's days, and which a random start may land on ---- */
  const days = useMemo(() => (src ? tapeDays(src) : []), [src]);
  const now = Date.now();
  const nowHour = Math.floor(now / 3_600_000);
  /* the days the field holds a column on (read once an hour of columns — New York's date turns on the hour at most) */
  const colDays = useMemo(() => {
    const out = new Set<string>();
    let hour = NaN;
    for (const c of cols) {
      const h = Math.floor(c.time / 3600);
      if (h === hour) continue;
      hour = h;
      out.add(nyIsoDate(c.time * 1000));
    }
    return out;
  }, [cols]);
  const readiness: SessionReadiness[] = useMemo(
    () =>
      on && src
        ? days
            .filter(d => colDays.has(d))
            .map(d => {
              const b = budgetOf(d);
              /* a market with no priced move is the house's, whose sessions keep their own hours: the span its minutes cover */
              const mins = b === null ? dayMinutes(src, d) : null;
              return readinessOf(d, src, cols, b, Date.now(), mins && mins.length ? { first: mins[0], last: mins[mins.length - 1] } : undefined);
            })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [on, src, cols, colDays, days, budgetOf, nowHour]
  );

  /* ---- moving the cursor ---- */
  const setCursor = useCallback((t: number, keepPlaying = false) => setCtl(c => (c ? { ...c, phase: 'play', cursor: t, playing: keepPlaying && c.playing } : c)), []);
  const atMinute = useCallback(
    (t: number): number | null => {
      if (!src?.length) return null;
      const i = lastAtOrBefore(src, t, b => b.time);
      return i >= 0 ? src[i].time : src[0].time;
    },
    [src]
  );
  const pick = useCallback(
    (barTime: number) => {
      /* a bar picked on the chart: its last minute on the tape, the bar whole */
      const m = atMinute(barTime + Math.max(1, minutes) * 60 - 60);
      if (m != null) setCursor(m);
    },
    [atMinute, minutes, setCursor]
  );
  const stepBy = useCallback(
    (dir: 1 | -1) => {
      if (!src?.length) return;
      setCtl(c => (c && c.phase === 'play' ? { ...c, playing: false, cursor: stepCursor(src, c.cursor, minutes, dir) } : c));
    },
    [src, minutes]
  );
  const seekTo = useCallback(
    (t: number) => {
      const m = atMinute(t);
      if (m != null) setCtl(c => (c ? { ...c, phase: 'play', cursor: m } : c));
    },
    [atMinute]
  );
  const togglePlay = useCallback(() => setCtl(c => (c && c.phase === 'play' ? { ...c, playing: !c.playing } : c)), []);
  const setPlaying = useCallback((p: boolean) => setCtl(c => (c && c.phase === 'play' ? { ...c, playing: p } : c)), []);
  const setSpeed = useCallback((v: ReplaySpeed) => setCtl(c => (c ? { ...c, speed: v } : c)), []);
  const setHideFuture = useCallback((v: boolean) => setCtl(c => (c ? { ...c, hideFuture: v } : c)), []);
  /** Jump to a session and a time typed on the reader's clock; the words of what went wrong, or null */
  const jump = useCallback(
    (to: string, text: string): string | null => {
      if (!src?.length) return 'No bars on this chart yet';
      const mins = dayMinutes(src, to);
      if (!mins.length) return 'No bars on that day';
      if (!text.trim()) {
        setCursor(mins[0]);
        return null;
      }
      const t = minuteFromText(text, mins, ms => clock(ms));
      if (t == null) return `No minute at "${text.trim()}" on that day — the tape runs ${clock(mins[0] * 1000)} to ${clock(mins[mins.length - 1] * 1000)}`;
      setCursor(t);
      return null;
    },
    [src, setCursor]
  );
  /** A random start: a session the replay can draw whole, a time in it — the words of why not, or null */
  const random = useCallback((): string | null => {
    const s = randomStart(readiness, Math.random);
    if (!s) {
      const why = readiness.length ? readiness.map(r => r.why).find(Boolean) : null;
      return why ? `No session can be drawn whole yet (${why})` : 'No session can be drawn whole yet';
    }
    const m = atMinute(s.cursor);
    if (m == null) return 'No bars on this chart yet';
    setCursor(m);
    return null;
  }, [readiness, atMinute, setCursor]);

  /* ---- the playback clock: a minute of tape every 60 ÷ speed seconds, to the session's last minute ---- */
  useEffect(() => {
    if (!ctl || ctl.phase !== 'play' || !ctl.playing || !src?.length) return;
    const id = window.setInterval(() => {
      setCtl(c => {
        if (!c || !c.playing) return c;
        const i = lastAtOrBefore(src, c.cursor, b => b.time);
        const next = src[i + 1];
        /* the session's end: the next minute is another day's */
        if (!next || nyIsoDate(next.time * 1000) !== nyIsoDate(c.cursor * 1000)) return { ...c, playing: false };
        return { ...c, cursor: next.time };
      });
    }, msPerMinute(ctl.speed));
    return () => window.clearInterval(id);
  }, [ctl?.phase, ctl?.playing, ctl?.speed, src]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- THE LEVEL ALERTS IN REPLAY (item 7's clause): the name's watched levels judged on each minute the cursor moves on
     by one, on the frame's levels and the cursor's knowable instant, into the replay's own log; any other move starts the
     engine again (a jump is a new run, never a stretch it slept through) ---- */
  const watches = useLevelWatches();
  const engine = useRef<{ sig: string; e: LevelAlertEngine; last: number } | null>(null);
  useEffect(() => {
    if (!playing || !frame?.bar) return;
    const w = watches[ticker.toUpperCase()];
    if (!w || !w.ids.length) {
      engine.current = null;
      return;
    }
    const sig = `${ticker}|${w.ids.join(',')}|${w.confirmBars}`;
    const had = engine.current && engine.current.sig === sig ? engine.current : null;
    /* each minute is judged once — a frame drawn again on the same minute (a poll's new list) is not a second minute */
    if (had && had.last === cursor) return;
    const prev = src ? lastAtOrBefore(src, cursor - 1, b => b.time) : -1;
    const consecutive = !!had && prev >= 0 && src![prev].time === had.last;
    const g = consecutive ? had! : (engine.current = { sig, e: new LevelAlertEngine(ticker.toUpperCase(), w.ids, { confirmBars: w.confirmBars }, { at: [] }), last: -1 });
    const fin = (v: number | null) => (v != null && Number.isFinite(v) ? v : null);
    const lv: LevelInputs = { flip: fin(frame.flip), callWall: fin(frame.cw), putWall: fin(frame.pw), top: frame.top.slice(0, 3).map(x => x[0]), step: step || 1, sigma: sigmaOf(frame.day) };
    const b = frame.bar;
    const events = g.e.observe({ time: b.time, high: b.high, low: b.low, close: b.close, closed: true }, lv, knowableAt(cursor), 0);
    if (events.length) noteLevelEvents(events, 'replay');
    g.last = cursor;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, cursor, frame]);

  /** The tape's minutes hold this day's open (9:30 am New York) — a replay of the day can start there */
  const holdsOpen = useCallback(
    (d: string): boolean => {
      if (!src?.length) return false;
      const mins = dayMinutes(src, d);
      const [y, m, dd] = d.split('-').map(Number);
      return mins.length > 0 && mins[0] <= Math.floor(nyWallTime(y, m, dd, 9, 30) / 1000);
    },
    [src]
  );

  return {
    ctl,
    active: playing,
    holdsOpen,
    cursor,
    asOf: playing ? knowableAt(cursor) : null,
    day,
    cut,
    frame,
    lagged,
    future,
    days,
    readiness,
    minutesOfDay,
    speeds: REPLAY_SPEEDS,
    pick,
    stepBy,
    seekTo,
    togglePlay,
    setPlaying,
    setSpeed,
    setHideFuture,
    jump,
    random,
  };
}
export type TerrainReplay = ReturnType<typeof useTerrainReplay>;
