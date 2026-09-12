# News page v1 — reference archive (retired 2026-08-29)

The wire-list News page was replaced by the **News Room globe** (`/news` →
`src/pages/newsroom/`). This document preserves everything the old page did so
the globe room can re-absorb it feature by feature. The full source lives in
git — `src/pages/News.tsx`, last present at commit `41e9019`
("The Strike Pressure Ladder…"); restore with
`git show 41e9019:src/pages/News.tsx`.

## What the page was

"The wire on the left — what the model thinks it does to price on the right."
A two-panel desk: headline feed (3/5 width) + a sticky predictive read of the
selected headline (2/5), topped by a session tape strip and a one-sentence
mood read. Everything deterministic off `src/data/news.ts` (which **still
exists and is still consumed by the Pulse desk's NewsWidget** — only the page
was retired).

## Layout, top to bottom

1. **PageHeader** — breadcrumb Terminal / News, category filter as
   `SegmentedControl` in actions: All · Earnings · Guidance · Analyst · Macro.
2. **The tape strip** (`bg-inset` bar): mood word ("Today RISK-ON" style,
   bull/bear/neutral ink) · an equalizer of ticks — one per headline, height
   normalized to the session's biggest expected move, colored by lean
   (bull / bear/85 / white-25 neutral) with title tooltip · lean counts
   ("4 bullish · 3 neutral · 2 bearish") · "Biggest" movers: top-3 by
   |expMove1dPct| as click-to-select buttons (ticker + signed % + category in
   CAT_COLOR ink) · headline count right.
3. **The read panel** — Panel toned by mood, one RichRead sentence
   (`marketMood().note`).
4. **The wire** (left, flush Panel, max-h 560 scroll): rows = time · source ·
   ticker · CatTag · signed "+X.X% exp" right; headline below. Selection =
   white inset edge `shadow-[inset_2px_0_0_0_rgba(237,237,237,0.7)]` +
   bg-white/[0.04].
5. **Predicted outcome / Deep read** (right, sticky top-4, Panel toned by
   sentiment, FilterTabs to switch):
   - **Outcome tab**: OddsBar (Down% ←→ Up% two-sided meter, bear/bull,
     520ms slide — see "motion contracts" below) · 3 Metrics (1-day exp,
     5-day exp — signed/toned; Confidence %) · "Historical analog" RichRead ·
     "Playbook" RichRead (border-t).
   - **Deep read tab**: "Positioning read" header + MECHANICAL→
     "Positioning-driven" / else "Story-driven" whisper · 4 metrics:
     **Priced in** % (warn ink ≥70), **Catalyst half-life** ("X.X sess"),
     **Event move** ("±X.X%" — what options charge), **Wire vs book**
     (CONFIRMS→"Confirms" bull / FADES→"Fades it" bear / "No lean") with
     `AlignmentBar` — a signed bar from a center hairline, filling left/right
     by `bookAlignment` · "The read" RichRead · "What kills it" RichRead
     (invalidation — border-t).

## The data model (`src/data/news.ts` — ALIVE, do not delete)

- `NewsCategory` = Earnings · Guidance · Analyst · Macro · M&A · Product ·
  Regulatory (page filtered to first four + All).
- `NewsItem` = id, time, source, ticker?, headline, category,
  sentiment (-1..1), `prediction: NewsPrediction` { probUpPct, expMove1dPct,
  expMove5dPct, confidencePct, analog, playbook }.
- `NewsDeepRead` (`buildNewsDeepRead(item)`) = pricedInPct, halfLifeSessions,
  eventVolPct, bookAlignment (-1..1), bookLabel CONFIRMS|FADES|NEUTRAL,
  driver MECHANICAL|STORY, read, invalidation. Every item has one — "the deep
  read never has to apologise for a name it can't cover."
- `buildNewsFeed()` deterministic per day; `marketMood()` = {score, label,
  note}; `tickerSentiment(ticker)`.
- `components/news/CatTag.tsx` — category dot+label, `CAT_COLOR` = the
  7-hue muted CATEGORICAL palette (2026-07-20 doctrine: zero collisions with
  semantic tokens, same idea as dark-pool sector dots). Also alive.

## Motion contracts worth keeping (hard-won)

- **The odds bar must stay mounted across headline switches** — keyed
  subtrees are per-TAB, never per-headline, so the split *slides* between
  stories (width transition 520ms house ease) and AnimatedNumbers roll
  instead of snapping. Tab switches DO remount (cross-fade via
  animate-soft-in).
- Sentence blocks (analog/playbook/read/invalidation) keyed by selection id
  → soft-in per switch.
- Sentiment tone bands: >0.12 bull, <-0.12 bear, else neutral (same
  thresholds for tape ticks, panel tones, lean counts).

## Standing integrations the globe room must honor

- **Pulse NewsWidget** (`src/pages/workspace/NewsWidget.tsx`) navigates
  `navigate('/news', { state: { selectedId: n.id } })` — the old page opened
  with that headline pre-selected. The globe room should eventually restore
  this contract (fly to the story's origin + open its card).
- Nav: News is Analyze code 08, Newspaper icon.

---

# News Room v2/v3 — reference archive (retired 2026-09-09)

The room replaced the wire-list on 2026-08-29 and was torn down on
2026-09-09 for a blank canvas under the Record section (Noah: "we prev had
the idea of having a full 3d world map but i think thats a bit much for news…
delete everything on the news page and start from a blank canvas"). The
full source lives in git — `src/pages/newsroom/NewsRoom.tsx` and
`src/pages/newsroom/StreetMap.tsx`, last present at commit `a631ccb`;
restore with `git show a631ccb:src/pages/newsroom/NewsRoom.tsx`.

## What the room was

Round 3 of the room's shape: the globe was to be "the literal entire page"
with two circled ZONES on its flanks acting as paged fields. The 3D globe
itself (three.js / react-globe.gl, 4.3 MB of textures under public/globe) was
deleted on 2026-08-30 ("we dont need that right now its just taking up
space"), so the room shipped as a dark stage with the two glass zones and an
empty field between them ("20 stories on the wire" printed in the middle), a
Situation-mode tour button, and three camera-preset chips (Americas · Europe
· Asia) that no longer moved anything. A MapLibre street map (`StreetMap.tsx`
— MapLibre GL + PMTiles + protomaps-themes-base, a dark basemap) survived from
the "dive through the globe's floor" idea but nothing opened it.

## The two zones (a `Zone` = header chips that switch pages in one field; a drill replaces the field until Back)

**Left field** (`lg:absolute lg:left-4 lg:top-16 lg:bottom-12 lg:w-[350px]`):
- **Headlines** — the wire: every `GeoNewsEvent` newest first; row = time ·
  `TickerChip` (logo + symbol, click → the name's dossier) · grade word
  (THREAT bear / ALLY bull / WATCH secondary) · signed 1-day expected move
  right; headline under. Selected = white inset edge + wash; faded stories
  (`freshnessOf` = 'faded') at 55% opacity. Empty: "Nothing on the tape yet —
  stories land through the day".
- **Movers** — top 6 by |expMove1dPct|: TickerChip · CatTag · signed % · a
  bar normalised to the biggest.
- **Origins** — cities aggregated (`hotspots`): city · N stories · "X
  pressing" (bear) / "Y lifting" (bull) / "no lean"; click → the CITY DRILL
  (that place's whole tape, same row grammar, each story selectable).
- **Calendar** — `buildEconCalendar()`: "N high impact ahead"; rows = title ·
  day/time · region (USD/EUR/JPY/GBP/AUD/CNY) · Fcst / Prev · "in 12m"
  (warn) or "printed"; high-impact rows wear a warn left edge.

**Right field** (mirror, `lg:right-4`, `lg:w-[350px]`; the tour button sat
at `lg:right-[374px]`):
- **Summary** (`readBody`, keyed per story → soft-in): TickerChip or MACRO ·
  grade · CatTag · source; the headline (13px); "Impact · light/firm/heavy"
  (`severityWord`) + "from {city}" over a meter (`severity × 10%`) in the
  grade's ink; three `Stat` tiles — 1-day exp, 5-day exp (bull/bear toned,
  `AnimatedNumber`), Confidence %; the analog sentence (RichRead); DOORS for
  a name: "Weigh it" (→ /weigher with `{ weigh: { ticker } }`), "Compass
  setups" (→ /compass with `{ tickerFilter }`), "Earnings page" (Earnings
  category only → /record/earnings/:ticker). Doors warm
  `Simulator.ensureTicker` on hover.
- **Odds** — `OddsBar` (Down% ←→ Up% two-sided meter, NOT keyed by story so
  the split slides, 520ms house ease, AnimatedNumbers) · Playbook (RichRead)
  · Historical analog (RichRead).
- **Zones** — "Where {ticker} lands · N zones": the story's `impacts`
  (label · heavy ≥7 / firm ≥4 / light · a meter in the grade's ink) + the
  note "Zones come from the story's supply-and-listing map".
- **Insights** — `buildRoomInsights(events)`: titled reads in bull/bear/
  neutral ink (RichRead).
- **The name's dossier** (drill, from any TickerChip): logo + symbol + N
  stories; "X pressing / Y lifting · out of {city}"; its three doors; its
  stories; "Where {ticker} lands" = the max zone weight per label across its
  stories.

**Under the fields**: a legend "THREAT presses · ALLY lifts · WATCH no lean ·
ripple = landing · arcs = where it reaches · heat = how hard it lands" (the
globe's vocabulary, orphaned), the three camera chips, "N headlines today".

**Behaviour**: the wire re-reads `buildGeoNews()` every 30s (`wireRev`); the
Pulse NewsWidget deep-links `{ selectedId }` and the room opened with that
story selected; the tour advanced the selection every 8s; a drill pick
"flew" the camera (`setRegion`) — a no-op once the globe went.

## The engine (`src/data/newsroom.ts` — ALIVE, keep; decorates `data/news.ts`'s feed)

- `GeoNewsEvent` = { id, item: NewsItem, grade: THREAT|ALLY|WATCH, severity
  (0–10), origin: { lat, lng, label, w, city }, impacts: GeoZone[] }.
- `buildGeoNews()` deterministic per day (the drip lands stories through the
  session); `severityWord`; `freshnessOf` (fresh / developing / faded) +
  `FRESHNESS_FACTOR`; `clusterByCity(events)` → `CityPing[]` { city, lat, lng,
  n, threats, allies, grade, topId, topHeadline, maxSeverity, freshest } —
  THE PIN MODEL for a 2D map, already written; `buildEconCalendar()` →
  `EconEvent[]`; `buildRoomInsights(events)` → `RoomInsight[]`.
- `docs/newsroom-grading-spec.md` — how THREAT/ALLY/WATCH and severity are
  graded.

## Libraries (settled 2026-09-09 with the 2D map)

- `maplibre-gl`, `pmtiles`, `protomaps-themes-base` — the street map's.
  UNINSTALLED the day the wire was rebuilt on react-simple-maps.
- `world-atlas`, `topojson-client` — the globe's borders, now the wire's
  map (`components/record/NewsMap.tsx` reads `countries-110m.json`).
- `react-simple-maps` — the wire's flat world: `ComposableMap` +
  `Geographies` + `ZoomableGroup` + a `Marker` per city.

## What replaced the room (2026-09-09)

`pages/record/News.tsx` — two boxes under the Record head: **The wire**
(facts · one line of cards · the map with a pin on every city beside the
open story's card · every story as a row · the mood sentence) and **The
day** (the calendar beside the reads). The engines above are the same;
`clusterByCity` is the pin model. Not documented here — read the page.

## Never built (from Noah's 2026-07-19 brief — still wanted someday)

- Literal company icons per headline (real brand SVGs — see thesvg.org
  memory), clickable → drill-in.
- "Best lotto position most probable" per story (engine-ranked cheap
  short-dated OTM contract).
- Page must survive backtesting scrutiny — "flawless / informational / not
  over the top."
