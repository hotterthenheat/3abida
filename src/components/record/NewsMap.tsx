/*
==================================================
  SLAYER TERMINAL - THE NEWS MAP (components/record/NewsMap.tsx)

  A flat world with a pin on every city the day's
  stories come from (Noah, 2026-09-09: "most
  importantly i want a 2d map that has pins on the
  news you click"). Drawn by react-simple-maps on
  the world-atlas borders — no tiles, no key.

  THE HOUSE GREYS STAY (2026-09-13): the partner's
  review asked for an Apple/Google-maps look with
  day and night; it was built — a navy sea, a
  grey-brown land, the night's shade following the
  sun — and Noah reverted it the same hour ("revert
  back to our prev map, i don't like this one"). The
  land is the page's grey, no water, no shade. What
  stayed from that pass is THE GLIDE: a picked story
  pans the world to its city on the house curve,
  flat, never a globe.

  Layers, bottom to top:

    THE LAND     the countries; the HEAT warms the
                 land where the day's news LANDS
                 (every story's impact zones, summed
                 over the cut, the thermal ramp's
                 warm side)
    THE SESSIONS a silver wash over whichever cash
                 market is open at the moment in
                 view — Tokyo, London, New York
    THE REACH    the open story's arcs from its pin
                 to the zones it lands on
    THE PINS     one per city: size the count, ink
                 the lean, a halo while something
                 there is fresh, the silver ring on
                 the open story

  Scroll zooms, a pull pans, Fit glides home.
==================================================
*/

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getResolvedTheme, useResolvedTheme, type Theme } from '../../theme/theme';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup, useMapContext } from 'react-simple-maps';
import { geoArea, geoCentroid, geoContains, geoMercator } from 'd3-geo';
import { Maximize } from 'lucide-react';
import worldUrl from 'world-atlas/countries-110m.json?url';
import type { CityPing, GeoZone, NewsGrade } from '../../data/newsroom';
import { FONT_SANS } from '../../theme/fonts';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const INK: Record<NewsGrade, string> = { THREAT: 'rgb(var(--bear))', ALLY: 'rgb(var(--bull))', WATCH: '#8a8f99' };
/* THE WATER IS APPLE MAPS' BLUE (Noah, 2026-09-13: "keep this exact chart
   but just apple map colors with the blue"), sampled off maps.apple.com at a
   world zoom, dark and light. THE LAND IS GREEN (Noah, the same day, with
   his partner's map: "i would like the countries to be green not gray") —
   the partner's own muted green, a dusty sage far from the direction green
   (the bull ink is vivid), a pale sage on the light terminal; Apple's slate
   stood for an hour between the two. The heat (`heatFill`, the land's only
   other fill) is mixed over whichever the page wears — a warmed country
   reads tan over the green, as it does on his map. Before this the land was
   near-black / warm grey with no water. */
const WATER: Record<Theme, string> = { dark: 'rgb(33,55,130)', light: 'rgb(141,213,245)' };
const LAND_RGB: Record<Theme, [number, number, number]> = { dark: [78, 110, 76], light: [176, 196, 150] };
/* THE BORDERS ARE LIGHT AND THE COUNTRIES ARE NAMED (Noah, 2026-09-13, his
   partner's reference: "this has the names of the countries and the borders
   are white. thats what i want"): a white hairline at a fifth on the dark
   land (a black one on the light), and every country big enough at the
   zoom in hand wears its name at its centre, small, uppercase, muted, under
   the pins — more names come out as the reader zooms in. */
const LAND_EDGE: Record<Theme, string> = { dark: '#ffffff', light: '#000000' };
const LAND_EDGE_OPACITY: Record<Theme, number> = { dark: 0.22, light: 0.26 };
/* the names' ink: a pale grey-blue on the slate (Apple's own labels are pale), a deep grey on the off-white */
const LABEL_INK: Record<Theme, string> = { dark: '#b4bccb', light: '#5c6270' };
/** Steradians a country must cover to be named at zoom 1 (about Austria and up); the bar drops with the square of the zoom, and the names still have to FIT — see CountryNames */
const LABEL_MIN_AREA = 0.002;
/** The atlas's long names, said shorter */
const SHORT_NAME: Record<string, string> = {
  'United States of America': 'United States',
  'Dem. Rep. Congo': 'DR Congo',
  'Central African Rep.': 'C. African Rep.',
  'Bosnia and Herz.': 'Bosnia',
  'S. Sudan': 'South Sudan',
  'W. Sahara': 'W. Sahara',
  'Eq. Guinea': 'Eq. Guinea',
  'Dominican Rep.': 'Dominican Rep.',
  'Solomon Is.': 'Solomon Is.',
  'Falkland Is.': 'Falklands',
  'Fr. S. Antarctic Lands': '',
};
const landRgb = () => LAND_RGB[getResolvedTheme()];
const land = () => `rgb(${landRgb().join(',')})`;
/* THE PROJECTION IS MERCATOR (Noah, 2026-09-13: "make the world cover all 4
   corners of the page and not curved at the ends"; before it was Equal Earth,
   an oval): the one Apple and every web map draw, so the world is a rectangle
   in the frame. The scale puts the world's full width on the frame's 960, so
   at rest the frame shows every longitude and, centred on lat 22, the
   latitudes −51 to 72 — the top of Norway and Alaska's north coast just in,
   only the tip of Patagonia out. The reader pans within the world's square
   (`WORLD`, the group's translate extent) and never past it, and a glide's
   target is clamped the same way (`inWorld`) — d3's programmatic transform
   skips the extent. */
const W = 960;
const H = 440;
const SCALE = W / (2 * Math.PI);
/** The world with lon 0 · lat 0 at the origin: its square is ±W/2 both ways — Mercator clips at ±85° */
const MERCATOR = geoMercator().scale(SCALE).translate([0, 0]);
const HALF = W / 2;
const HOME = { center: [0, 22] as [number, number], zoom: 1 };
type View = { center: [number, number]; zoom: number };

/* THE FRAME TAKES ITS BOX'S SHAPE (Noah, 2026-09-19: "there is just a whole bunch of empty white space under the map"). The
   drawing was a fixed 960 × 440, as wide as its column and as tall as that made it — but the column is as tall as THE STORY
   beside it, which is 400px wide whatever the window is. So under about 1,900px the story was the taller of the two and the
   map stopped short of its own box (measured: 110px of blank at 1600, 176 at 1440, 249 at 1280, and the landing's window is
   narrower still). Now the frame is measured off the box: the world's whole width still, and as much more of its height as
   the box has — never past the world's square. 960 × 440 is the FLATTEST it goes (the box keeps that as its least height), so
   a wide window draws exactly what it drew before. */
type Frame = { w: number; h: number };
const REST: Frame = { w: W, h: H };
/* THE FRAME FOLLOWS THE BOX CONTINUOUSLY (2026-09-29, Noah: the story's fold beside it made the map "wonky and jittery"):
   it was rounded to four units to spare redraws, because every frame change re-drew the world — the drawing's own width
   and height were the frame, and the library re-projects every country when they move (seven steps over the fold, frames
   up to 42ms, and the frame flipping shape as the box passed square). The drawing is now ALWAYS the world's square, and the
   frame is only the WINDOW on it (the svg's viewBox), so a frame change costs nothing but the window: the frame can follow
   the box to the pixel, one frame a frame. */
const frameFor = (boxW: number, boxH: number): Frame => {
  if (!(boxW > 0 && boxH > 0)) return REST;
  const ar = boxW / boxH;
  if (ar >= 1) return { w: W, h: Math.min(W, Math.max(H, Math.round(W / ar))) };
  /* a box taller than it is wide: the world's whole height, and the reader pulls east and west */
  return { w: Math.max(240, Math.round(W * ar)), h: W };
};
/** The window on the world's square — the frame centred on it (the svg's viewBox) */
const windowOf = (f: Frame) => `${((W - f.w) / 2).toFixed(2)} ${((W - f.h) / 2).toFixed(2)} ${f.w} ${f.h}`;
/** THE WORLD'S EXTENT for the zoom, in the drawing's own units. The drawing is the whole square (0..W both ways) and the
    zoom's viewport is that square, so the extent is the square widened by the window's slack each way: the square can
    then slide under the window exactly as far as keeps the WINDOW inside the world, and no further. */
const worldIn = (f: Frame): [[number, number], [number, number]] => [
  [(f.w - W) / 2, (f.h - W) / 2],
  [W + (W - f.w) / 2, W + (W - f.h) / 2],
];
/** The same view with its frame kept inside the world — a target past the edge lands on the edge */
const inWorld = (v: View, f: Frame): View => {
  const p = MERCATOR(v.center);
  if (!p || !MERCATOR.invert) return v;
  const hw = f.w / 2 / v.zoom;
  const hh = f.h / 2 / v.zoom;
  const x = Math.min(Math.max(p[0], -HALF + hw), HALF - hw);
  const y = Math.min(Math.max(p[1], -HALF + hh), HALF - hh);
  if (x === p[0] && y === p[1]) return v;
  const c = MERCATOR.invert([x, y]);
  return c ? { center: [c[0], c[1]], zoom: v.zoom } : v;
};
/** Where the frame's top edge sits at rest, in the world's units */
const restTop = (f: Frame): number => {
  const y0 = MERCATOR(HOME.center)?.[1] ?? 0;
  const extra = f.h - H;
  /* THE EXTRA HEIGHT GOES NORTH: Antarctica is not drawn, so south of Cape Horn is open water, while the north still has
     Greenland and the Arctic coasts to show. The south takes a little (Cape Horn comes in), the north the rest, to the world's edge. */
  const south = Math.min(Math.max(0, extra) * 0.25, 30);
  return Math.min(Math.max(y0 - H / 2 - (Math.max(0, extra) - south), -HALF), HALF - f.h);
};
/** The whole world at rest, for this frame. The resting frame's is HOME itself. */
const homeFor = (f: Frame): View => {
  if (f.w === W && f.h === H) return HOME;
  const c = MERCATOR.invert?.([0, restTop(f) + f.h / 2]);
  return c ? { center: [0, c[1]], zoom: 1 } : HOME;
};
const sameView = (a: View, b: View) => a.zoom === b.zoom && a.center[0] === b.center[0] && a.center[1] === b.center[1];
/** Antarctica — a fifth of the drawing for nothing on the wire */
const ANTARCTICA = '010';
/** The glide to a picked city: this long, on the house curve; a pan lands at least this close */
const GLIDE_MS = 650;
const GLIDE_ZOOM = 1.8;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** One zone's summed weight over the cut — the heat under a country */
export interface HeatPoint {
  lat: number;
  lng: number;
  w: number;
}
/** The open story's origin and where it lands */
export interface Reach {
  lat: number;
  lng: number;
  city: string;
  zones: GeoZone[];
}
/** A place to glide to — a new `key` starts a glide */
export interface FlyTo {
  lng: number;
  lat: number;
  key: string;
}

/* ── the sessions ─────────────────────────────────────────────────────────
   Cash hours in each market's own clock (so DST is the market's problem,
   not ours), and the longitudes its wash covers. */
export interface SessionDef {
  key: string;
  label: string;
  tz: string;
  /** minutes into the local day */
  open: number;
  close: number;
  west: number;
  east: number;
}
export const SESSIONS: SessionDef[] = [
  { key: 'tokyo', label: 'Tokyo', tz: 'Asia/Tokyo', open: 9 * 60, close: 15 * 60, west: 95, east: 150 },
  { key: 'london', label: 'London', tz: 'Europe/London', open: 8 * 60, close: 16 * 60 + 30, west: -12, east: 32 },
  { key: 'newyork', label: 'New York', tz: 'America/New_York', open: 9 * 60 + 30, close: 16 * 60, west: -128, east: -64 },
];
/* one formatter per market, kept — `nextOpen` reads the clock a thousand times over a weekend */
const clockFmt = new Map<string, Intl.DateTimeFormat>();
const fmtFor = (tz: string): Intl.DateTimeFormat => {
  let f = clockFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' });
    clockFmt.set(tz, f);
  }
  return f;
};
const localClock = (at: Date, tz: string): { min: number; weekday: boolean } => {
  const parts = fmtFor(tz).formatToParts(at);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  const h = Number(get('hour')) % 24;
  const m = Number(get('minute'));
  const wd = get('weekday');
  return { min: h * 60 + m, weekday: wd !== 'Sat' && wd !== 'Sun' };
};
/** Which cash sessions are open at a moment */
export const openSessions = (at: Date): SessionDef[] =>
  SESSIONS.filter(s => {
    const { min, weekday } = localClock(at, s.tz);
    return weekday && min >= s.open && min < s.close;
  });
/** The next cash session to open after `at` and the moment it does — walked in five-minute steps over the next four days (a weekend and a day); null only if no market opens in that time */
export const nextOpen = (at: Date): { session: SessionDef; at: Date } | null => {
  const t = new Date(at);
  t.setSeconds(0, 0);
  t.setMinutes(Math.floor(t.getMinutes() / 5) * 5);
  for (let i = 0; i < (4 * 24 * 60) / 5; i++) {
    t.setMinutes(t.getMinutes() + 5);
    for (const s of SESSIONS) {
      const { min, weekday } = localClock(t, s.tz);
      if (weekday && min >= s.open && min < s.open + 5) return { session: s, at: new Date(t) };
    }
  }
  return null;
};

/* ── the names ────────────────────────────────────────────────────────────
   A country's size and the centre of its main body never change — read once
   per geography, kept for the page's life. */
type NamedGeo = { rsmKey: string; properties?: { name?: string } } & GeoJSON.Feature;
const labelCache = new Map<string, { name: string; area: number; at: [number, number] }>();
const labelOf = (g: NamedGeo) => {
  let l = labelCache.get(g.rsmKey);
  if (!l) {
    const raw = g.properties?.name ?? '';
    const name = raw in SHORT_NAME ? SHORT_NAME[raw] : raw;
    const area = geoArea(g);
    /* the centre of the biggest polygon — a country's islands and territories would pull the centroid off its body */
    let at = geoCentroid(g);
    if (g.geometry.type === 'MultiPolygon') {
      let best = -1;
      for (const coords of g.geometry.coordinates) {
        const part: GeoJSON.Feature<GeoJSON.Polygon> = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: coords } };
        const a = geoArea(part);
        if (a > best) {
          best = a;
          at = geoCentroid(part);
        }
      }
    }
    l = { name, area, at };
    labelCache.set(g.rsmKey, l);
  }
  return l;
};
/** THE NAMES THAT FIT: the biggest countries first, each name placed at its
    centre only where no name already placed would run into it (the boxes in
    the drawing's own units, so zooming in shrinks them and lets the smaller
    countries' names out — the reference's feel: every big name always, the
    small ones where there is room) */
const CountryNames = ({ shown, z, s, theme, minArea }: { shown: NamedGeo[]; z: number; s: number; theme: Theme; minArea: number }) => {
  const { projection } = useMapContext();
  const fs = (6.5 * s) / z;
  const gap = (0.9 * s) / z;
  const pad = 2.5 / z;
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const names: { key: string; name: string; at: [number, number] }[] = [];
  const cands = shown.map(g => ({ key: g.rsmKey, l: labelOf(g) })).filter(c => c.l.name && c.l.area >= minArea).sort((a, b) => b.l.area - a.l.area);
  for (const { key, l } of cands) {
    const p = projection(l.at);
    if (!p) continue;
    const w = l.name.length * fs * 0.64 + (l.name.length - 1) * gap;
    const box = { x: p[0] - w / 2 - pad, y: p[1] - fs / 2 - pad, w: w + 2 * pad, h: fs + 2 * pad };
    if (placed.some(b => b.x < box.x + box.w && b.x + b.w > box.x && b.y < box.y + box.h && b.y + b.h > box.y)) continue;
    placed.push(box);
    names.push({ key, name: l.name, at: l.at });
  }
  return (
    <g data-news-countries={names.length} style={{ pointerEvents: 'none' }}>
      {names.map(n => (
        <Marker key={`name-${n.key}`} coordinates={n.at}>
          <text textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight={600} letterSpacing={gap} fontFamily={FONT_SANS} fill={LABEL_INK[theme]} fillOpacity={0.85} data-news-country={n.name}>
            {n.name.toUpperCase()}
          </text>
        </Marker>
      ))}
    </g>
  );
};

/** A band of longitudes as a spherical polygon (the parallels densified so
    they stay parallels on the projection). d3 reads a ring on the sphere by
    the right-hand rule — the inside is on the LEFT as you walk it — so the
    ring runs west along the south edge and east along the north edge
    (measured: the other way round filled the whole world). */
const bandFeature = (west: number, east: number): GeoJSON.Feature<GeoJSON.Polygon> => {
  /* the whole height of the world's square — Mercator clips at ±85 */
  const south = -84;
  const north = 84;
  const ring: [number, number][] = [];
  for (let x = east; x > west; x -= 4) ring.push([x, south]);
  ring.push([west, south]);
  for (let x = west; x < east; x += 4) ring.push([x, north]);
  ring.push([east, north]);
  ring.push([east, south]);
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
};

/** THE WATER — Apple's blue under everything: the sphere drawn through the map's projection, so it pans and zooms with the land */
const Water = ({ theme }: { theme: Theme }) => {
  const { path } = useMapContext();
  return <path d={path({ type: 'Sphere' }) ?? undefined} fill={WATER[theme]} data-news-water={theme} />;
};

/** The washes — drawn through the map's own projection so they bend with it.
    The silver shade over the open market's longitudes (Noah, 2026-09-13:
    "the shaded region of the current open market like we had before") — a
    fifth over the blue water and the slate, its edges and its name plainer
    than the first cut's, which sat at a twentieth on black and vanished. */
const SessionBands = ({ sessions, zoom, labelLat = 79 }: { sessions: SessionDef[]; zoom: number; labelLat?: number }) => {
  const { path } = useMapContext();
  return (
    <g data-news-sessions={sessions.map(s => s.key).join(' ')}>
      {sessions.map(s => (
        <g key={s.key}>
          <path d={path(bandFeature(s.west, s.east)) ?? undefined} fill={SILVER} fillOpacity={0.16} stroke={SILVER} strokeOpacity={0.45} strokeWidth={0.7 / zoom} data-news-session={s.key} />
          <Marker coordinates={[(s.west + s.east) / 2, labelLat]}>
            <text textAnchor="middle" fontSize={8 / zoom} fontFamily={FONT_SANS} letterSpacing={1.2 / zoom} fill={SILVER} fillOpacity={0.85}>
              {`${s.label.toUpperCase()} · OPEN`}
            </text>
          </Marker>
        </g>
      ))}
    </g>
  );
};

/* THE HEAT'S INK: the warm side of the house thermal ramp (heatmap.ts
   thermal-yellow), pale yellow to orange-red — stopped short of the ramp's
   crimson so a hot country never reads as the direction red (measured: the
   full ramp made the United States a red alert on an ordinary day). */
const WARM_STOPS: [number, [number, number, number]][] = [
  [0, [255, 255, 191]],
  [0.2, [254, 224, 144]],
  [0.4, [253, 174, 97]],
  [0.6, [244, 109, 67]],
];
const warmAt = (t: number): [number, number, number] => {
  const x = Math.max(0, Math.min(0.6, t));
  let i = 0;
  while (i < WARM_STOPS.length - 2 && x > WARM_STOPS[i + 1][0]) i++;
  const [t0, c0] = WARM_STOPS[i];
  const [t1, c1] = WARM_STOPS[i + 1];
  const f = (x - t0) / (t1 - t0);
  return [0, 1, 2].map(k => Math.round(c0[k] + (c1[k] - c0[k]) * f)) as [number, number, number];
};
/** The land warmed: the ramp's colour at `t`, mixed over the land by `a` */
export const heatFill = (t: number): string => {
  const [r, g, b] = warmAt(0.15 + 0.45 * Math.sqrt(t));
  const a = 0.14 + 0.3 * Math.sqrt(t);
  const lerp = (x: number, y: number) => Math.round(x + (y - x) * a);
  const base = landRgb();
  return `rgb(${lerp(base[0], r)},${lerp(base[1], g)},${lerp(base[2], b)})`;
};

/** THE HEAT'S LEGEND, one thin line for the controls row (Noah, 2026-09-09:
    "just like for the headline descriptions there should be one for the
    hotter a continent is getting") — three squares in the land's own inks
    at a cool, a warm and the hottest country, so the eye matches them to
    the map. */
const HEAT_RUNGS: [string, number][] = [
  ['cool', 0.1],
  ['warm', 0.5],
  ['hot', 1],
];
export const HeatLegend = ({ className = '' }: { className?: string }) => (
  <span
    className={`inline-flex items-center gap-3 font-mono text-[10px] text-textSecondary whitespace-nowrap ${className}`}
    title="The land warms where the day's news lands — every story's zones, summed over what the cards leave. Not where it was written."
    data-heat-legend
  >
    {HEAT_RUNGS.map(([word, t]) => (
      <span key={word} className="inline-flex items-center gap-1.5">
        <span className="inline-block w-2 h-2 rounded-[2px] border border-ink/10" style={{ background: heatFill(t) }} data-heat-swatch={word} />
        {word}
      </span>
    ))}
    <span className="text-textMuted">where the news lands</span>
  </span>
);

/** THE REACH: the open story's arcs, drawn on the projection as lifted
    curves rather than great circles — a great circle from Santa Clara to
    Taipei runs over the Arctic and off the map's edge (measured), which
    says nothing a trader needs. A ring on each zone, sized by its weight. */
const ReachArcs = ({ reach, zones, zoom }: { reach: Reach; zones: GeoZone[]; zoom: number }) => {
  const { projection } = useMapContext();
  const from = projection([reach.lng, reach.lat]);
  if (!from) return null;
  return (
    <g data-news-reach-arcs>
      {zones.map(zn => {
        const to = projection([zn.lng, zn.lat]);
        if (!to) return null;
        const dx = to[0] - from[0];
        const dy = to[1] - from[1];
        const len = Math.hypot(dx, dy) || 1;
        /* the control point: the midpoint lifted to the side, always upward on the page */
        const lift = Math.min(90, len * 0.22);
        const nx = -dy / len;
        const ny = dx / len;
        const up = ny < 0 ? 1 : -1;
        const cx = (from[0] + to[0]) / 2 + nx * lift * up;
        const cy = (from[1] + to[1]) / 2 + ny * lift * up;
        return <path key={zn.label} d={`M ${from[0]} ${from[1]} Q ${cx} ${cy} ${to[0]} ${to[1]}`} fill="none" stroke={SILVER} strokeOpacity={0.5} strokeWidth={1 / zoom} strokeLinecap="round" data-news-arc={zn.label} />;
      })}
      {zones.map(zn => (
        <Marker key={`ring-${zn.label}`} coordinates={[zn.lng, zn.lat]}>
          <g data-news-zone={zn.label}>
            <circle r={(2.5 + 0.7 * zn.w) / zoom} fill={SILVER} fillOpacity={0.12} stroke={SILVER} strokeOpacity={0.85} strokeWidth={1 / zoom} />
            <title>{`${zn.label} · lands ${zn.w >= 7 ? 'heavy' : zn.w >= 4 ? 'firm' : 'light'} here`}</title>
          </g>
        </Marker>
      ))}
    </g>
  );
};

/** A word placed on the map — the guide's figures only */
export interface MapNote {
  lat: number;
  lng: number;
  text: string;
  /** Offset below (positive) or above the point, in the drawing's units */
  dy?: number;
  /** Across, and which end of the words sits there — a note near the frame's edge reads inward (2026-09-30: two ran off it) */
  dx?: number;
  anchor?: 'start' | 'middle' | 'end';
}

interface Props {
  pins: CityPing[];
  selectedCity: string | null;
  hoverCity: string | null;
  onPick: (pin: CityPing) => void;
  onHover: (pin: CityPing | null) => void;
  /** Where the cut's news lands, summed by zone */
  heat: HeatPoint[];
  /** The open story's origin and zones, or nothing open */
  reach: Reach | null;
  /** The moment the map shows — now, re-read with the wire */
  at: Date;
  /** THE GLIDE: a picked story's city — a new key pans the world there, flat, on the house curve */
  flyTo?: FlyTo | null;
  /** THE FIGURE MODE (the guide, 2026-09-09): still — no zoom, no pull, no
      Fit — cropped to the northern half where the news is, the pins and
      words drawn twice their size so they read at a figure's width */
  figure?: boolean;
  notes?: MapNote[];
  /** The live map's box — `flex-1 min-h-0` in a column lets it fill a host taller than the map's own shape */
  className?: string;
}

const NewsMap = ({ pins, selectedCity, hoverCity, onPick, onHover, heat, reach, at, flyTo = null, figure = false, notes = [], className = '' }: Props) => {
  /* The land's ink is the theme's — a flip redraws the countries */
  const theme = useResolvedTheme();
  const [view, setView] = useState<View>(HOME);
  const viewRef = useRef<View>(HOME);
  viewRef.current = view;
  /* THE FRAME, measured off the box (see frameFor). A reader at rest stays at rest in the new frame; one who has pulled the
     map keeps their place, kept inside the world. The guide's figure is still: it keeps its own fixed drawing. */
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [frame, setFrame] = useState<Frame>(REST);
  const frameRef = useRef<Frame>(REST);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || figure) return;
    const read = () => {
      const next = frameFor(el.clientWidth, el.clientHeight);
      const prev = frameRef.current;
      if (next.w === prev.w && next.h === prev.h) return;
      const v = viewRef.current;
      frameRef.current = next;
      setFrame(next);
      setView(sameView(v, homeFor(prev)) ? homeFor(next) : inWorld(v, next));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [figure]);
  const homeView = useMemo(() => homeFor(frame), [frame]);
  const home = sameView(view, homeView);
  /* THE GLIDE — the view tweened from where it stands to the target over
     GLIDE_MS on the house curve, a frame at a time; a pull by hand cancels it */
  const glide = useRef(0);
  const glideTo = (wanted: View) => {
    cancelAnimationFrame(glide.current);
    const from = viewRef.current;
    const target = inWorld(wanted, frameRef.current);
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / GLIDE_MS);
      const e = easeOut(t);
      /* every frame kept inside the world too — the zoom on the way is lower than the target's, so its frame is wider */
      setView(inWorld({ center: [from.center[0] + (target.center[0] - from.center[0]) * e, from.center[1] + (target.center[1] - from.center[1]) * e], zoom: from.zoom + (target.zoom - from.zoom) * e }, frameRef.current));
      if (t < 1) glide.current = requestAnimationFrame(step);
      else setView(target);
    };
    glide.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(glide.current), []);
  useEffect(() => {
    if (!flyTo || figure) return;
    glideTo({ center: [flyTo.lng, flyTo.lat], zoom: Math.max(viewRef.current.zoom, GLIDE_ZOOM) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo?.key, figure]);
  /* The loudest pins draw last so they sit on top; the open one last of all */
  const ordered = useMemo(() => [...pins].sort((a, b) => (a.city === selectedCity ? 1 : b.city === selectedCity ? -1 : a.n - b.n)), [pins, selectedCity]);
  const z = figure ? 1 : view.zoom;
  /* the figure's pins and words, two and a half times their size — the figure is 416px wide against the page's 1186 */
  const s = figure ? 2.5 : 1;
  const sessions = useMemo(() => openSessions(at), [at]);
  /* Which country a zone sits in never changes — found once per zone, kept */
  const zoneHome = useRef(new Map<string, string | null>());
  /* the figure names only the biggest — its width is a third of the page's */
  const labelBar = (LABEL_MIN_AREA * (figure ? 4 : 1)) / (z * z);
  /* The reach: zones at the origin itself draw no arc (a New York story landing on New York) */
  const arcs = useMemo(() => (reach ? reach.zones.filter(zn => Math.hypot(zn.lat - reach.lat, zn.lng - reach.lng) > 0.5) : []), [reach]);

  const layers = (
    <>
          <Water theme={theme} />
          <Geographies geography={worldUrl}>
            {({ geographies }: { geographies: Array<{ rsmKey: string; id: string } & GeoJSON.Feature> }) => {
              /* THE HEAT: every zone's weight lands on the country under it */
              const byCountry = new Map<string, number>();
              for (const h of heat) {
                const key = `${h.lat},${h.lng}`;
                let where = zoneHome.current.get(key);
                if (where === undefined) {
                  where = geographies.find(g => geoContains(g, [h.lng, h.lat]))?.rsmKey ?? null;
                  zoneHome.current.set(key, where);
                }
                if (where) byCountry.set(where, (byCountry.get(where) ?? 0) + h.w);
              }
              const hottest = Math.max(0, ...byCountry.values());
              const shown = geographies.filter(g => g.id !== ANTARCTICA);
              return (
                <>
                  {shown.map(g => {
                    const w = byCountry.get(g.rsmKey) ?? 0;
                    const t = hottest > 0 ? w / hottest : 0;
                    const fill = w > 0 ? heatFill(t) : land();
                    return (
                      <Geography
                        key={g.rsmKey}
                        geography={g}
                        fill={fill}
                        stroke={LAND_EDGE[theme]}
                        strokeOpacity={LAND_EDGE_OPACITY[theme]}
                        strokeWidth={0.5 / z}
                        data-heat={w > 0 ? t.toFixed(2) : undefined}
                        style={{ default: { outline: 'none', transition: 'fill 520ms cubic-bezier(0.16, 1, 0.3, 1)' }, hover: { outline: 'none' }, pressed: { outline: 'none' } }}
                      />
                    );
                  })}
                  {/* THE NAMES — the countries big enough at this zoom whose names have room, under the pins */}
                  <CountryNames shown={shown as NamedGeo[]} z={z} s={s} theme={theme} minArea={labelBar} />
                </>
              );
            }}
          </Geographies>
          {/* the wash's name near the frame's top at rest, over the Arctic coasts — lat 68 in the resting frame, further north in a taller one */}
          <SessionBands sessions={sessions} zoom={z / s} labelLat={figure ? 60 : Math.min(80, MERCATOR.invert?.([0, restTop(frame) + 30])?.[1] ?? 68)} />
          {/* THE REACH */}
          {reach && arcs.length > 0 && <ReachArcs reach={reach} zones={arcs} zoom={z / s} />}
          {/* THE PINS */}
          {ordered.map(p => {
            const open = p.city === selectedCity;
            const hot = p.city === hoverCity;
            const r = ((5 + 2.2 * Math.sqrt(p.n)) * s) / z;
            const ink = INK[p.grade];
            return (
              <Marker key={p.city} coordinates={[p.lng, p.lat]} onClick={() => onPick(p)} onMouseEnter={() => onHover(p)} onMouseLeave={() => onHover(null)} style={{ default: { cursor: figure ? 'default' : 'pointer' }, hover: { cursor: figure ? 'default' : 'pointer' }, pressed: { cursor: figure ? 'default' : 'pointer' } }}>
                <g data-news-pin={p.city} data-grade={p.grade} data-open={open || undefined}>
                  {p.freshest === 'fresh' && <circle r={r + (5 * s) / z} fill={ink} fillOpacity={0.14} />}
                  <circle r={r} fill={ink} fillOpacity={open || hot ? 0.95 : 0.78} stroke={open ? SILVER : hot ? 'rgb(var(--text-primary))' : 'rgb(var(--night))'} strokeWidth={((open ? 2 : 1) * s) / z} />
                  {p.n > 1 && (
                    <text textAnchor="middle" dominantBaseline="central" fontSize={(9 * s) / z} fontWeight={700} fontFamily={FONT_SANS} fill="rgb(var(--night))">
                      {p.n}
                    </text>
                  )}
                  <title>{`${p.city} · ${p.n} ${p.n === 1 ? 'story' : 'stories'} · ${p.topHeadline}`}</title>
                </g>
              </Marker>
            );
          })}
          {/* THE WORDS — the guide's figures only */}
          {notes.map(n => (
            <Marker key={n.text} coordinates={[n.lng, n.lat]}>
              <text x={n.dx ?? 0} y={n.dy ?? 30} textAnchor={n.anchor ?? 'middle'} fontSize={17} fill="#a3a3a3" fontFamily={FONT_SANS} data-news-note>
                {n.text}
              </text>
            </Marker>
          ))}
    </>
  );

  return (
    <div ref={rootRef} className={`relative select-none ${className}`} data-news-map={figure ? 'figure' : 'live'} data-zoom={z.toFixed(2)} data-heated={heat.length} data-reach={arcs.length} data-frame={`${frame.w}x${frame.h}`}>
      {/* THE LEAST HEIGHT: the resting frame's own shape. The host may stretch the box past it (`className`), and the drawing fills whatever it becomes. */}
      {!figure && <div aria-hidden style={{ aspectRatio: `${W} / ${H}` }} />}
      {/* the figure: the north from the United States to Japan, lat −15 to 71, a third of the page's width */}
      {/* THE LIVE DRAWING IS THE WORLD'S SQUARE, always W × W — so the projection and every country's path stand still —
          and the frame is the WINDOW on it: the svg's viewBox, centred on the square, which the zoom's centre is the
          centre of. Changing the window costs one attribute, so it follows the box's every frame (frameFor's note). */}
      <ComposableMap
        projection="geoMercator"
        projectionConfig={figure ? { scale: 196, center: [10, 40] } : { scale: SCALE }}
        width={W}
        height={figure ? 400 : W}
        {...(figure ? {} : { viewBox: windowOf(frame) })}
        preserveAspectRatio={figure ? undefined : 'xMidYMid slice'}
        style={figure ? { width: '100%', height: 'auto', display: 'block' } : { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      >
        {figure ? (
          <g>{layers}</g>
        ) : (
          <ZoomableGroup
            center={view.center}
            zoom={view.zoom}
            minZoom={1}
            maxZoom={8}
            translateExtent={worldIn(frame)}
            onMoveStart={() => cancelAnimationFrame(glide.current)}
            onMoveEnd={({ coordinates, zoom }) => setView({ center: coordinates as [number, number], zoom })}
          >
            {layers}
          </ZoomableGroup>
        )}
      </ComposableMap>
      {!home && !figure && (
        <button
          type="button"
          onClick={() => glideTo(homeView)}
          className="absolute right-2 top-2 inline-flex items-center gap-1.5 h-6 px-2 rounded-md border border-borderSubtle bg-chip/90 hover:border-borderMuted font-mono text-[10px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors"
          title="Back to the whole world"
          data-news-map-fit
        >
          <Maximize className="w-3 h-3" /> Fit
        </button>
      )}
    </div>
  );
};

export default NewsMap;
