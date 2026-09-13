/*
==================================================
  SLAYER TERMINAL - THE NEWS MAP (components/record/NewsMap.tsx)

  A flat world with a pin on every city the day's
  stories come from (Noah, 2026-09-09: "most
  importantly i want a 2d map that has pins on the
  news you click"), redrawn in the globe's own
  colours (Noah, 2026-09-13: "it should look like
  the Apple and Google maps globe but follow time
  zones and night and day") — blue water, green
  land, the sun's terminator shading the night
  side, a meridian per hour with the local hour on
  it, and a flat flight to the open story's city.
  Drawn by react-simple-maps on the world-atlas
  borders — no tiles, no key.

  Four layers, bottom to top (Noah, the same day:
  "build the impact heat and the reach arcs also
  do session shading and the days drip"):

    THE HEAT     the land warms where the day's
                 news LANDS, not where it was
                 written — every story's impact
                 zones, summed over the current
                 cut, on the thermal ramp's warm
                 side, faint under everything
    THE SESSIONS a silver wash over whichever
                 cash market is open at the moment
                 in view — Tokyo, London, New York
    THE REACH    the open story's arcs from its
                 pin to the zones it lands on, a
                 ring on each sized by weight, in
                 the where-you-are silver
    THE PINS     one per city: size the count,
                 ink the lean (bear negative, bull
                 positive, muted neutral), a halo
                 while something there is fresh,
                 the silver ring on the open story

  Scroll zooms, a pull pans, Fit comes home. The
  moment in view is the page's — live, or wherever
  the drip bar was pulled to.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { getResolvedTheme, useResolvedTheme, type Theme } from '../../theme/theme';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup, useMapContext } from 'react-simple-maps';
import { geoCircle, geoContains } from 'd3-geo';
import { Maximize } from 'lucide-react';
import worldUrl from 'world-atlas/countries-110m.json?url';
import type { CityPing, GeoZone, NewsGrade } from '../../data/newsroom';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const INK: Record<NewsGrade, string> = { THREAT: 'rgb(var(--bear))', ALLY: 'rgb(var(--bull))', WATCH: '#8a8f99' };
/* THE GLOBE'S OWN COLOURS (Noah, 2026-09-13: "it should not be a map that's
   black, it should look like the Apple and Google maps globe but follow time
   zones and night and day"): blue water, green-tan land, the night side
   shaded by the sun's own terminator. The heat (`heatFill`, the land's only
   other fill) is mixed over the land's colour. */
const LAND_RGB: Record<Theme, [number, number, number]> = { dark: [78, 110, 76], light: [176, 196, 150] };
const LAND_EDGE: Record<Theme, string> = { dark: '#2f4a35', light: '#7f9a72' };
const OCEAN: Record<Theme, string> = { dark: '#163a63', light: '#a9cbe9' };
const NIGHT = '#02030a';
const landRgb = () => LAND_RGB[getResolvedTheme()];
const land = () => `rgb(${landRgb().join(',')})`;
const HOME = { center: [12, 12] as [number, number], zoom: 1 };
/** Antarctica — a fifth of the drawing for nothing on the wire */
const ANTARCTICA = '010';

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
const localClock = (at: Date, tz: string): { min: number; weekday: boolean } => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' }).formatToParts(at);
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

/** A band of longitudes as a spherical polygon (the parallels densified so
    they stay parallels on the projection). d3 reads a ring on the sphere by
    the right-hand rule — the inside is on the LEFT as you walk it — so the
    ring runs west along the south edge and east along the north edge
    (measured: the other way round filled the whole world). */
const bandFeature = (west: number, east: number): GeoJSON.Feature<GeoJSON.Polygon> => {
  const south = -56;
  const north = 84;
  const ring: [number, number][] = [];
  for (let x = east; x > west; x -= 4) ring.push([x, south]);
  ring.push([west, south]);
  for (let x = west; x < east; x += 4) ring.push([x, north]);
  ring.push([east, north]);
  ring.push([east, south]);
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
};

/** The washes — drawn through the map's own projection so they bend with it */
const SessionBands = ({ sessions, zoom, labelLat = 79 }: { sessions: SessionDef[]; zoom: number; labelLat?: number }) => {
  const { path } = useMapContext();
  return (
    <g data-news-sessions={sessions.map(s => s.key).join(' ')}>
      {sessions.map(s => (
        <g key={s.key}>
          <path d={path(bandFeature(s.west, s.east)) ?? undefined} fill={SILVER} fillOpacity={0.045} stroke={SILVER} strokeOpacity={0.16} strokeWidth={0.6 / zoom} />
          <Marker coordinates={[(s.west + s.east) / 2, labelLat]}>
            <text textAnchor="middle" fontSize={8 / zoom} fontFamily="ui-monospace, Menlo, monospace" letterSpacing={1.2 / zoom} fill={SILVER} fillOpacity={0.6}>
              {`${s.label.toUpperCase()} · OPEN`}
            </text>
          </Marker>
        </g>
      ))}
    </g>
  );
};

/* ── night and day ────────────────────────────────────────────────────────
   The sun's position at the moment in view: its declination from the day of
   the year, its longitude from the UTC hour (the equation of time left
   out — it moves the terminator a few minutes, not a time zone). The night
   is the hemisphere centred on the point opposite the sun, drawn through
   the map's own projection so it bends with it; a wider, fainter ring is
   the twilight. */
const subsolar = (at: Date): [number, number] => {
  const start = Date.UTC(at.getUTCFullYear(), 0, 0);
  const doy = (at.getTime() - start) / 86_400_000;
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (doy + 10));
  const utcHours = at.getUTCHours() + at.getUTCMinutes() / 60;
  const lng = -15 * (utcHours - 12);
  return [lng, decl];
};
const NightShade = ({ at }: { at: Date }) => {
  const { path } = useMapContext();
  const [slng, slat] = subsolar(at);
  const anti: [number, number] = [((slng + 180 + 540) % 360) - 180, -slat];
  const night = { type: 'Feature', properties: {}, geometry: geoCircle().center(anti).radius(90)() } as GeoJSON.Feature;
  const dusk = { type: 'Feature', properties: {}, geometry: geoCircle().center(anti).radius(96)() } as GeoJSON.Feature;
  return (
    <g data-news-night={`${anti[0].toFixed(1)},${anti[1].toFixed(1)}`} pointerEvents="none">
      <path d={path(dusk) ?? undefined} fill={NIGHT} fillOpacity={0.22} />
      <path d={path(night) ?? undefined} fill={NIGHT} fillOpacity={0.42} />
    </g>
  );
};

/* ── the time zones ───────────────────────────────────────────────────────
   A faint meridian every fifteen degrees — one hour of the sun — with the
   local hour at the moment in view written along the top every other one. */
const Meridians = ({ at, zoom }: { at: Date; zoom: number }) => {
  const { path } = useMapContext();
  const utcHours = at.getUTCHours() + at.getUTCMinutes() / 60;
  const lines: number[] = [];
  for (let lng = -180; lng <= 180; lng += 15) lines.push(lng);
  return (
    <g data-news-meridians pointerEvents="none">
      {lines.map(lng => {
        const feature = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[lng, -56], [lng, 84]] } } as GeoJSON.Feature;
        const hour = (((utcHours + lng / 15) % 24) + 24) % 24;
        return (
          <g key={lng}>
            <path d={path(feature) ?? undefined} fill="none" stroke="#ffffff" strokeOpacity={0.09} strokeWidth={0.5 / zoom} />
            {lng % 30 === 0 && lng > -180 && (
              <Marker coordinates={[lng, 82]}>
                <text textAnchor="middle" fontSize={6.5 / zoom} fontFamily="ui-monospace, Menlo, monospace" fill="#ffffff" fillOpacity={0.45}>
                  {`${String(Math.floor(hour)).padStart(2, '0')}:00`}
                </text>
              </Marker>
            )}
          </g>
        );
      })}
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
  /** The moment the map shows — live, or the drip bar's */
  at: Date;
  /** THE FIGURE MODE (the guide, 2026-09-09): still — no zoom, no pull, no
      Fit — cropped to the northern half where the news is, the pins and
      words drawn twice their size so they read at a figure's width */
  figure?: boolean;
  notes?: MapNote[];
}

const NewsMap = ({ pins, selectedCity, hoverCity, onPick, onHover, heat, reach, at, figure = false, notes = [] }: Props) => {
  /* The land's ink is the theme's — a flip redraws the countries */
  const theme = useResolvedTheme();
  const [view, setView] = useState(HOME);
  /* THE FLIGHT (Noah, 2026-09-13: "it goes to each place like from Cali to
     Russia, it moves in a flat manner"): when the open story changes, the map
     pans flat to its city over half a second — the centre eased from where
     it is to the pin, the zoom held (or lifted to 2 from the whole world so
     the travel can be seen). Fit brings the whole world back. */
  const flightRef = useRef(0);
  const target = useMemo(() => (selectedCity ? pins.find(p => p.city === selectedCity) ?? null : null), [pins, selectedCity]);
  useEffect(() => {
    if (figure || !target) return;
    cancelAnimationFrame(flightRef.current);
    const from = view.center;
    const zoom0 = view.zoom;
    const zoom1 = Math.max(zoom0, 2);
    const to: [number, number] = [target.lng, target.lat];
    if (Math.abs(from[0] - to[0]) < 0.5 && Math.abs(from[1] - to[1]) < 0.5 && zoom0 === zoom1) return;
    const t0 = performance.now();
    const D = 560;
    const ease = (u: number) => 1 - Math.pow(1 - u, 3);
    const step = (now: number) => {
      const u = Math.min(1, (now - t0) / D);
      const e = ease(u);
      setView({ center: [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e], zoom: zoom0 + (zoom1 - zoom0) * e });
      if (u < 1) flightRef.current = requestAnimationFrame(step);
    };
    flightRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(flightRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.city, figure]);
  const home = view.zoom === 1 && view.center[0] === HOME.center[0] && view.center[1] === HOME.center[1];
  /* The loudest pins draw last so they sit on top; the open one last of all */
  const ordered = useMemo(() => [...pins].sort((a, b) => (a.city === selectedCity ? 1 : b.city === selectedCity ? -1 : a.n - b.n)), [pins, selectedCity]);
  const z = figure ? 1 : view.zoom;
  /* the figure's pins and words, two and a half times their size — the figure is 416px wide against the page's 1186 */
  const s = figure ? 2.5 : 1;
  const sessions = useMemo(() => openSessions(at), [at]);
  /* Which country a zone sits in never changes — found once per zone, kept */
  const zoneHome = useRef(new Map<string, string | null>());
  /* The reach: zones at the origin itself draw no arc (a New York story landing on New York) */
  const arcs = useMemo(() => (reach ? reach.zones.filter(zn => Math.hypot(zn.lat - reach.lat, zn.lng - reach.lng) > 0.5) : []), [reach]);

  const layers = (
    <>
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
              return geographies
                .filter(g => g.id !== ANTARCTICA)
                .map(g => {
                  const w = byCountry.get(g.rsmKey) ?? 0;
                  const t = hottest > 0 ? w / hottest : 0;
                  const fill = w > 0 ? heatFill(t) : land();
                  return (
                    <Geography
                      key={g.rsmKey}
                      geography={g}
                      fill={fill}
                      stroke={LAND_EDGE[theme]}
                      strokeWidth={0.5 / z}
                      data-heat={w > 0 ? t.toFixed(2) : undefined}
                      style={{ default: { outline: 'none', transition: 'fill 520ms cubic-bezier(0.16, 1, 0.3, 1)' }, hover: { outline: 'none' }, pressed: { outline: 'none' } }}
                    />
                  );
                });
            }}
          </Geographies>
          {/* NIGHT AND DAY, and the hours — the globe's own clock at the moment in view */}
          <NightShade at={at} />
          {!figure && <Meridians at={at} zoom={z} />}
          <SessionBands sessions={sessions} zoom={z / s} labelLat={figure ? 60 : 79} />
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
                  <circle r={r + (3 * s) / z} fill={ink} fillOpacity={0.22} />
                  <circle r={r} fill={ink} fillOpacity={open || hot ? 1 : 0.9} stroke={open ? SILVER : hot ? '#ffffff' : 'rgba(255,255,255,0.35)'} strokeWidth={((open ? 2 : 1) * s) / z} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={(9 * s) / z} fontWeight={700} fontFamily="ui-monospace, Menlo, monospace" fill="#ffffff">
                    {p.n}
                  </text>
                  <title>{`${p.city} · ${p.n} ${p.n === 1 ? 'story' : 'stories'} · ${p.topHeadline}`}</title>
                </g>
              </Marker>
            );
          })}
          {/* THE WORDS — the guide's figures only */}
          {notes.map(n => (
            <Marker key={n.text} coordinates={[n.lng, n.lat]}>
              <text y={n.dy ?? 30} textAnchor="middle" fontSize={17} fill="#a3a3a3" fontFamily="ui-sans-serif, system-ui, sans-serif" data-news-note>
                {n.text}
              </text>
            </Marker>
          ))}
    </>
  );

  return (
    <div className="relative select-none" data-news-map={figure ? 'figure' : 'live'} data-zoom={z.toFixed(2)} data-heated={heat.length} data-reach={arcs.length}>
      <ComposableMap projection="geoEqualEarth" projectionConfig={figure ? { scale: 236, center: [8, 30] } : { scale: 175 }} width={960} height={figure ? 400 : 440} style={{ width: '100%', height: 'auto', display: 'block', background: OCEAN[theme], borderRadius: 6 }} data-ocean={theme}>
        {figure ? (
          <g>{layers}</g>
        ) : (
          <ZoomableGroup center={view.center} zoom={view.zoom} minZoom={1} maxZoom={8} onMoveEnd={({ coordinates, zoom }) => setView({ center: coordinates as [number, number], zoom })}>
            {layers}
          </ZoomableGroup>
        )}
      </ComposableMap>
      {!home && !figure && (
        <button
          type="button"
          onClick={() => setView(HOME)}
          className="absolute right-2 top-2 inline-flex items-center gap-1.5 h-6 px-2 rounded-md border border-borderSubtle bg-chip/90 hover:border-borderMuted font-mono text-[9px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors"
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
