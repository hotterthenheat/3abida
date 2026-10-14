/*
==================================================
  SLAYER TERMINAL - THE SESSION RECAP'S WATCHER
  (components/review/RecapWatcher.tsx)

  THE OWNER'S ITEM 9 (2026-10-14): "at 4:05 p.m. ET,
  generate … and a chart image via takeScreenshot({
  addTopLayer: true }) … Post it to the Journal room."

  On every page while the feed is up: at 4:05 pm New York,
  and on the first look after it for a session the
  terminal was shut through, each recorded name's recap is
  posted to the Journal (data/review/recaps.ts):
    · the server's figures (server/recap.ts — the store's
      rows, the track record's touches, the priced move's
      row, the regime path);
    · the alerts that fired in the session, off this
      machine's logs, each with its +15 and +30 minutes on
      the session's bars (data/levelAlerts.ts outcomesOf —
      the track record's rule);
    · the picture: the house's chart drawn off-screen on the
      session's minutes and the store's columns, with the
      priced move's ±σ and the regime strip, taken with
      takeScreenshot(addTopLayer) — lightweight-charts 5.2
      takes it as takeScreenshot(true, false).
  One recap at a time; a hidden tab asks nothing; the
  first look on a machine posts the newest session alone,
  never the week before it.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import StrikeChart, { DEFAULT_OVERLAYS, type ChartLayerApi, type ChartOverlays, type ChartTape } from '../gex/StrikeChart';
import { isUp, useFeedStatus } from '../../data/feed/status';
import { useNow } from '../../context/marketStore';
import { nyParts, nyWallTime } from '../../core/nyTime';
import { loadRecap, loadRecapIndex, type RecapField, type ServedRecap } from '../../data/feed/recap';
import type { RegimeReference } from '../../data/feed/trailModel';
import { readToken } from '../../theme/theme';
import { levelLog, outcomesOf } from '../../data/levelAlerts';
import { getFiredLog, firedWords } from '../gex/alertStore';
import { postRecap, postedRecaps, putPicture, recapKey, type PostedRecap, type RecapAlert } from '../../data/review/recaps';
import type { GexSnapshot } from '../../types/market';
import type { KeyLevels } from '../../types/gex';

/** The picture's size, CSS px — a session of five-minute bars, its regime strip under it */
const SHOT_W = 1280;
const SHOT_H = 720;
/** The first look on this machine: the newest session alone is posted, never the days before it */
const SINCE_KEY = 'slayer_recap_since';
/** Checked every ten minutes, and each minute from 4:05 to 4:15 pm New York */
const EVERY = 10 * 60_000;

const sinceDay = (): string | null => {
  try {
    return localStorage.getItem(SINCE_KEY);
  } catch {
    return null;
  }
};
const setSince = (day: string) => {
  try {
    localStorage.setItem(SINCE_KEY, day);
  } catch {
    /* the visit remembers */
  }
};

/** THE ALERTS that fired in the session, with their +15 and +30 minutes on its bars */
function alertsOf(name: string, bars: ServedRecap['bars']): RecapAlert[] {
  if (!bars.length) return [];
  const first = bars[0][0];
  const last = bars[bars.length - 1][0];
  const B = bars.map(b => ({ time: b[0], close: b[4] }));
  const out: RecapAlert[] = [];
  for (const e of levelLog('live')[name] ?? []) {
    if (e.replay || e.bar < first || e.bar > last) continue;
    out.push({
      key: e.key,
      kind: 'level',
      at: e.at,
      tier: e.tier,
      words: e.words,
      spot: e.spot,
      stale: e.stale,
      capped: e.capped,
      out: outcomesOf(e, B, [15, 30]).map(o => (o ? { h: o.horizon, close: o.close, points: o.points, held: o.held } : null)),
    });
  }
  /* the house's alerts read off the market's own figures (market 'feed') — the move since, by the same clock */
  for (const r of getFiredLog(name)) {
    if (r.market !== 'feed' || r.at < first * 1000 || r.at >= (last + 60) * 1000) continue;
    const bar = Math.floor(r.at / 60_000) * 60;
    const at = (h: number) => {
      const want = bar + h * 60;
      let b: { time: number; close: number } | null = null;
      for (const x of B) {
        if (x.time > want) break;
        if (x.time > bar) b = x;
      }
      return b && b.time >= want ? b : null;
    };
    out.push({
      key: r.key,
      kind: 'alert',
      at: r.at,
      tier: null,
      words: `${name} ${firedWords(r.alert, name)}`,
      spot: r.mark ?? null,
      out: [15, 30].map(h => {
        const b = at(h);
        return b ? { h, close: b.close, points: r.mark != null ? b.close - r.mark : NaN, held: null } : null;
      }),
    });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** The recap as the Journal keeps it: its bars and quantiles left behind */
function keptOf(x: ServedRecap): PostedRecap['recap'] {
  const { bars: _bars, quantiles: _q, ...rest } = x;
  void _bars;
  void _q;
  const extra = rest as Partial<{ checkedAt: number }>;
  delete extra.checkedAt;
  return rest;
}

interface Shot {
  recap: ServedRecap;
  field: RecapField;
}

/** THE PICTURE: the house's chart off-screen, on the session alone, taken once the field and the lines have drawn */
const RecapShot = ({ shot, onDone }: { shot: Shot; onDone: (blob: Blob | null, w: number, h: number) => void }) => {
  const api = useRef<ChartLayerApi | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const { recap: x, field: f } = shot;
  const tape = useMemo<ChartTape>(
    () => ({
      bars: x.bars.map(b => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4], volume: 0 })),
      iv: 0,
      key: `recap:${x.name}:${x.day}`,
      book: f.cols.map(([m, spot, cells]): GexSnapshot => ({ time: m / 1000, spot, rebuilt: true, levels: cells.map(([strike, value]) => ({ strike, value })) })),
      macro: [],
      earnings: null,
    }),
    [x, f]
  );
  /* THE PRICE AXIS HOLDS THE SESSION AND ITS ±1σ (the recap's own frame — "close vs ±1σ" is what it shows): the levels
     handed to the chart name no wall, so a wall twenty strikes off never widens it (the field and its chips draw the
     walls), and the layer keeps the prior close's ±1σ in view */
  const levels = useMemo<KeyLevels>(() => ({ spot: x.bars.length ? x.bars[x.bars.length - 1][4] : NaN, callWall: NaN, putWall: NaN, flip: NaN, supreme: NaN }), [x]);
  const regimeRef = useMemo<RegimeReference | null>(
    /* the recap's own quantiles as a reference the strip reads for the day: dated before every day, so it answers with them */
    () => (x.quantiles ? { name: x.name, through: '1970-01-01', sessions: x.regime.sessions ?? 0, buckets: x.quantiles, before: x.quantiles, trailing: 250 } : null),
    [x]
  );
  const pricedMove = useMemo(() => (f.move ? { prevClose: f.move.prevClose, sigma: f.move.sigma, from: f.move.from, profile: f.move.profile, rem: null, close: f.move.close } : null), [f]);
  /* the session over: the chart's clock at its close */
  const asOf = useMemo(() => {
    const [y, m, d] = x.day.split('-').map(Number);
    return nyWallTime(y, m, d, 16, 1);
  }, [x.day]);
  const overlays = useMemo<ChartOverlays>(() => ({ ...DEFAULT_OVERLAYS, trails: true, volume: true, regime: !!x.quantiles, levels: false, events: false, cone: !!f.move }), [x.quantiles, f.move]);

  useEffect(() => {
    let dead = false;
    const t0 = Date.now();
    const finish = (b: Blob | null, w: number, h: number) => {
      if (!dead) done.current(b, w, h);
      dead = true;
    };
    const wait = () => {
      if (dead) return;
      const c = api.current?.chart();
      const s = api.current?.series();
      if (!c || !s || !(s.data()?.length > 0)) {
        if (Date.now() - t0 > 20_000) finish(null, 0, 0);
        else window.setTimeout(wait, 200);
        return;
      }
      /* the prior close's ±1σ held in view; once the chart has settled its own view, the whole session with three bars'
         air each side (the first and last time labels whole), then the field and the lines given frames to draw */
      if (f.move) api.current?.room([f.move.prevClose - f.move.sigma, f.move.prevClose, f.move.prevClose + f.move.sigma]);
      window.setTimeout(() => {
        if (dead) return;
        c.timeScale().fitContent();
        const span = c.timeScale().getVisibleLogicalRange();
        if (span) c.timeScale().setVisibleLogicalRange({ from: span.from - 3, to: span.to + 3 });
        window.setTimeout(
          () =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                if (dead) return;
              try {
                /* takeScreenshot({ addTopLayer: true }) — the top layer and the primitives in it, no crosshair — laid on the
                   panel's own ground: the chart is frameless, and a picture with no ground reads wrong on any other */
                const shotCanvas = c.takeScreenshot(true, false);
                const out = document.createElement('canvas');
                out.width = shotCanvas.width;
                out.height = shotCanvas.height;
                const g = out.getContext('2d');
                if (!g) return finish(null, 0, 0);
                g.fillStyle = readToken('--panel');
                g.fillRect(0, 0, out.width, out.height);
                g.drawImage(shotCanvas, 0, 0);
                out.toBlob(b => finish(b, out.width, out.height), 'image/png');
              } catch {
                finish(null, 0, 0);
              }
            })
          ),
          450
        );
      }, 700);
    };
    wait();
    return () => {
      dead = true;
    };
  }, []);

  return createPortal(
    <div aria-hidden="true" style={{ position: 'fixed', left: -20_000, top: 0, width: SHOT_W, height: SHOT_H, pointerEvents: 'none', overflow: 'hidden' }} data-recap-shot={`${x.name}:${x.day}`}>
      <StrikeChart
        ticker={x.name}
        revision={1}
        levels={levels}
        timeframe="5m"
        height={SHOT_H}
        frameless
        overlays={overlays}
        tape={tape}
        pricedMove={pricedMove}
        regimeRef={regimeRef}
        asOf={asOf}
        nyClock
        historyShare={1}
        layer={a => {
          api.current = a;
          return null;
        }}
      />
    </div>,
    document.body
  );
};

/** What to post next: the newest session first whose recap is new or changed since it was posted */
async function nextRecap(): Promise<{ recap: ServedRecap; had: PostedRecap | undefined } | null> {
  const idx = await loadRecapIndex(7);
  if (!idx.ok || !idx.data.length) return null;
  let since = sinceDay();
  if (!since) {
    since = idx.data[0].day;
    setSince(since);
  }
  const posted = postedRecaps();
  for (const row of idx.data) {
    if (row.day < since) continue;
    const had = posted[recapKey(row.name, row.day)];
    if (had && row.version && had.version === row.version && (had.picture || !had.chartKey)) continue;
    const r = await loadRecap(row.name, row.day);
    if (!r.ok) continue;
    if (had && had.version === r.data.version && had.picture) continue;
    return { recap: r.data, had };
  }
  return null;
}

const RecapWatcher = () => {
  const feedOn = isUp(useFeedStatus(), 'uw');
  const now = useNow(60_000);
  const [shot, setShot] = useState<Shot | null>(null);
  const busy = useRef(false);
  const lastAsk = useRef(0);
  /* a picture that would not draw is tried three times a version, then the figures stand alone */
  const tries = useRef(new Map<string, number>());

  useEffect(() => {
    if (!feedOn || busy.current || shot) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const t = Date.now();
    const p = nyParts(t);
    const m = p.hour * 60 + p.minute;
    const closeWindow = m >= 16 * 60 + 5 && m <= 16 * 60 + 15;
    if (t - lastAsk.current < (closeWindow ? 60_000 : EVERY)) return;
    lastAsk.current = t;
    busy.current = true;
    void (async () => {
      try {
        const next = await nextRecap();
        if (!next) return;
        const { recap, had } = next;
        const key = recapKey(recap.name, recap.day);
        const base = { key, name: recap.name, day: recap.day, version: recap.version, recap: keptOf(recap), alerts: alertsOf(recap.name, recap.bars) };
        /* the picture stands while what it draws has not changed */
        if (had?.picture && had.chartKey === recap.chartKey) {
          postRecap({ ...base, chartKey: had.chartKey, picture: had.picture });
          return;
        }
        const n = (tries.current.get(`${key}:${recap.version}`) ?? 0) + 1;
        tries.current.set(`${key}:${recap.version}`, n);
        if (n > 3) {
          postRecap({ ...base, chartKey: null, picture: null });
          return;
        }
        const withField = await loadRecap(recap.name, recap.day, true);
        if (!withField.ok) return;
        setShot({ recap: withField.data, field: withField.data.field });
      } finally {
        busy.current = false;
      }
    })();
  }, [feedOn, now, shot]);

  if (!shot) return null;
  return (
    <RecapShot
      key={`${shot.recap.name}:${shot.recap.day}:${shot.recap.version}`}
      shot={shot}
      onDone={(blob, w, h) => {
        const x = shot.recap;
        const key = recapKey(x.name, x.day);
        const post = (picture: PostedRecap['picture']) =>
          postRecap({ key, name: x.name, day: x.day, version: x.version, chartKey: picture ? x.chartKey : null, recap: keptOf(x), alerts: alertsOf(x.name, x.bars), picture });
        if (blob) void putPicture(key, blob).then(() => post({ w, h }));
        else post(null);
        setShot(null);
        /* the next one, at once */
        lastAsk.current = 0;
      }}
    />
  );
};

export default RecapWatcher;
