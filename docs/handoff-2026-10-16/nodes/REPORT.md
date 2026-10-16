# Terrain's nodes: ours against Noah's revamp

Ours: github.com/hotterthenheat/3abida at 20d4204. Noah's: github.com/Nuh00/revamp at ebb37bf (Oct 15, 2026), read only.
Every number below is either **measured** (off screenshots of both apps at 1920 × 1080, dark theme) or **computed**
(from the code's own formulas, or by running our real node code on 12 sessions of real SPY 5-minute data). Each one
says which. Nothing in either repo was changed.

## 1. The answer in five lines

1. **Yes, ours are big and blocking. It's measured, not a matter of taste.** Switching the nodes on changes **9–22%**
   of our price pane on the simulator and **4–14%** on real data (real data shows less only because its field covers
   just the regular-hours part of the view). On Noah's it changes **1.6–3.2%**.
2. Our typical node is **19–62 px tall** (the largest are 34–95 px). Noah's typical node is **2–3 px** (the largest are 12–35 px).
3. We don't draw more of them. Both apps draw about five a bar (measured: ours 4–6, Noah's 5–8). The difference is the
   height rule. Ours is **85% of a strike row**, and our axis keeps rows 36–112 px tall. Noah's ignores the row and is
   capped by the bar spacing at **6–18 px**. Ours are also solid (opacity 0.8–1.0), Noah's see-through (0.16–0.66).
4. In neither app do the nodes cover the candles. Both draw them underneath. What covers our candles is our labels:
   the wall-move chips and the node pills.
5. But Noah's goes too far the other way. A typical bead is a 1.5–2 px line you can barely see against the ground.
   The fix is in between. Variant B below takes our coverage from **21.5% to 2.8–5.8%** (computed) and keeps our
   colours.

## 2. The nodes, side by side

Line numbers are in each app's `src/components/gex/gexNodesPrimitive.ts` unless another file is named.

| | Noah's revamp | Ours |
|---|---|---|
| **Shape** | A thin, see-through piece of ribbon, 1.08 × its time slot wide, so neighbours touch and a strike reads as one line through time. It is an ellipse when over 4 px tall and a flat line below that. Strong ones get a faint halo 1.9 × taller (:231, :344–369). | Meant to be a solid oval. But the height follows the strike row and the width follows the candle. So at the zoom the chart opens at, it is an **upright capsule**, about 6 px wide and 50 px tall (measured typical height 51 px) (:76, :579–586). |
| **Height rule** | 2 × (0.45 + s^1.6 × (cap − 0.45)), where cap = 0.6 × bar spacing, held between 3 and 9. That gives 0.9–6 px at the opening zoom and never more than 18 px. The strike row never enters it (:93, :208–209, :303–305). | 3 + (85% of the strike row − 3) × √(size ÷ reference). That gives up to 83 px on a 97 px row and 95 px on a 112 px row (:50–51, :76). |
| **Width rule** | 1.08 × the time slot. That is 4.0 px when bars are 3.72 px apart (:231). | The candle slot less 1 px, whenever the height is bigger, which is almost always. That is 6–7 px at the opening zoom. Bars closer than 6 px merge 2–4 at a time into one node (:79, :617–619). |
| **Opacity** | Core 0.16 → 0.66, halo 0.04 → 0.18 (:308–309). | 0.8 → 1.0, plus a 1 px darker outline from 6 px up (:55, :58, :81). |
| **How many a bar** | The 12 strongest in each column, minus any under 8% of the reference (:57–58). Measured: 5–8 visible a bar. | The 5 largest by total gamma, plus the held walls (:48, :1260–1269). Measured: 4–6 a bar. |
| **Scaled against** | The 85th percentile of every column's peak, across everything loaded, recomputed each tick. Later data rescales earlier beads (:815–830). | The session's largest node so far, with no look-ahead (src/data/feed/beadScale.ts:69–85). The largest so far is full size by definition. |
| **What sets the size** | The net gamma at the strike (\|net\|). | The total gamma (calls + puts, "gross"). The net only picks the colour. |
| **Colours** | An 8-step ramp with no paper version: puts go dark red → honey gold, calls go navy → ice (:329; heatmap.ts:473). **Gold means puts here.** | Two states: violet = puts / amplify, gold = calls / absorb, grey when less than 20% one-sided (:39–41, :111, :127). Paper reads its own tokens. **Gold means calls here.** |
| **What draws over them** | Everything. The field sits at the bottom (:530–532), and the candles, volume and price line draw over it. | The same bottom layer (:1078–1080), with a 1 px ground-coloured edge cut round every candle (:997–1048). But the chips and pills draw in the top layer (:1060–1071), over the candles. |
| **Measured: typical / largest node height** | 2–3 px / 12–35 px | 19–62 px / 34–95 px |
| **Measured: share of the plot the nodes change** | 1.6–3.2% | 9.2–21.8% (simulator), 4.0–14.1% (real data) |
| **Measured: share changed strongly** | 0.5–1.4% | 6.9–20.9% (simulator), 3.1–13.6% (real data) |
| **Measured: candle pixels covered** | 0.00–0.14% | 0.16–5.94%, all of it from labels |

The views, measured one by one (bars apart and strike-row height are measured off each shot):

| View | Noah's: changed (strong) | Ours, simulator: changed (strong) | Ours, real data: changed (strong) | Typical node height: Noah's / ours sim / ours real |
|---|---|---|---|---|
| 5-minute, one pane, opening zoom | 1.6% (0.5%) | 20.5% (15.6%) | 5.8% (4.6%) | 2 / 51 / 26 px |
| 1-minute | 1.9% (0.7%) | 21.5% (20.5%) | 14.1% (13.6%) | 2 / 50 / 62 px |
| 15-minute | 1.7% (0.5%) | 17.6% (12.6%) | 4.6% (3.5%) | 2 / 53 / 26 px |
| 1-hour | 2.3% (0.7%) | 9.2% (6.9%) | 4.0% (3.1%) | 3 / 26 / 23 px |
| 5-minute, zoomed in | 3.2% (1.4%) | 21.8% (20.9%) | 13.2% (12.9%) | 3 / 49 / 59 px |
| 5-minute, four panes | 2.9% (0.9%) | 19.3% (13.4%) | 9.4% (8.3%) | 2 / 21 / 19 px |

"Changed" means a pixel whose colour moved by more than a just-visible step when the nodes were switched on. "Strong"
means a step about four times that size. Every largest height matches the code: ours is 0.85 × the row, Noah's is the
halo's cap.

**The pictures** (paths relative to `/tmp/claude-0/-home-user-3abida/3f13cba1-d81b-5e53-bbee-8bc889ed9a96/scratchpad/nodes-compare/`):

- [sheets/sheet-v1-5m.png](sheets/sheet-v1-5m.png): 5-minute, the three side by side. Noah's chart shows two or three
  faint lines. Ours, on the same simulator, shows tall gold, grey and violet picket bands through most of the area
  round the price.
- [sheets/sheet-v2-1m.png](sheets/sheet-v2-1m.png) and [sheets/sheet-v4-1h.png](sheets/sheet-v4-1h.png): 1-minute and 1-hour.
- [sheets/closeup-v1-5m.png](sheets/closeup-v1-5m.png): round the last price at twice the size, true pixels. On real
  data, the chips "CW 772 broken · 12:34 pm" and "772 · 100%" sit on the candles.
- Every raw shot, nodes on and off: [shots/](shots/), for example [shots/ours-sim-v1-5m-on.png](shots/ours-sim-v1-5m-on.png)
  and [shots/revamp-v1-5m-on.png](shots/revamp-v1-5m-on.png).
- Noah's at three times the size: [measure/revamp/one-pane-SPY-5m-crop3x.png](measure/revamp/one-pane-SPY-5m-crop3x.png).
- What counted as changed, per view: [measure/masks/](measure/masks/). Blue is a small change, red a strong one, and
  magenta a candle pixel that changed.

## 3. Why ours read as blocking, the biggest cause first

To rank the causes, I took the opening view (5-minute, bars 3.76 px apart) and changed **one thing at a time**,
then computed the result on 12 real SPY sessions (Sep 29–Oct 14) using our own node code. Today's rule computes to
**21.5%** of the plot covered. That agrees with the 20.5% measured on the shot, which checks the method. Where two
numbers are given, they are for a 97 px and a 47 px strike row, the two rows measured on our shots.

1. **The height follows the strike row (85% of it).** This is most of the problem.
   - Our fitted axis keeps at least eight strikes on screen (src/pages/terrain/Terrain.tsx:2970). On SPY's $1
     strikes that makes each row 36–112 px tall (measured), so a full node is 30–95 px.
   - It also runs backwards. The closer you zoom in on the price, the taller each row gets, so every node gets bigger.
   - Capping the height at 12 px, and changing nothing else, takes the coverage from 21.5% to **3.7%** (97 px row)
     or **7.7%** (47 px row) (computed).
   - Using 30% of the row instead of 85% gives 7.7% / 7.8% (computed).
2. **They are solid.**
   - Of everything our nodes change, 69–98% is a strong change. For Noah's it is 28–44% (measured).
   - Noah's opacity on our sizes leaves the area the same but halves the ink: **20.8% → 10.3%** (computed).
3. **Size comes from total gamma, so balanced strikes are drawn big.** 22% of the nodes we draw are grey: calls and
   puts nearly cancel there, yet the node stands as tall as the total. That is 23% of all the height we draw (computed
   over all 5,710 drawn nodes). Sizing by the net instead, against the same reference, gives 12.3% / 12.8% (computed).
   That overstates the gain, because a net-based reference would be smaller and would give some of the size back.
4. **Everything drawn sits near full size.** These are the five largest at each bar, and the scale is the session's
   largest so far, so they are heavy by definition.
   - Inside the day's price range, the typical drawn node is at 0.83 of full strength, and even the weakest tenth is
     at 0.66 (computed). Across every drawn node the typical one is at 0.75.
   - So the square-root curve is a smaller cause than it looks. Making it linear alone gives 18.4%. Noah's steeper
     1.6-power curve alone gives 15.8% (both computed).
5. **The shape is upright.** The height comes from the row and the width from the candle, so each node is a tall,
   narrow capsule. A level runs sideways through time, but a row of these reads as a picket fence across the price.
   I did not measure this on its own. It is the reason they look like bars and not like levels.
6. **Our labels sit on the candles.** All of our candle cover (0.16–5.94% of candle pixels, measured) comes from the
   wall-move chips and node pills in the top layer, such as "CW 772 broken · 12:34 pm" and "772 · 100%". The 1–3 px
   ring round each candle changes 1.8–11.9% in ours, against 0.7–6.2% in Noah's (measured).

**Not a cause: how many we draw.** It is about the same in both apps (4–6 against 5–8 a bar, measured).

## 4. What Noah's costs

Noah's view is calmer, and it never hides a candle (0.00–0.14% of candle pixels). But it pays for that:

- **Weak strikes disappear.** The typical bead Noah draws (at 0.27 of its reference) is a 1.5 px line at opacity
  0.20. That is about **1.1–1.2 : 1** contrast against the ground, computed from the drawn colours. The usual minimum
  for a mark you need to see is 3 : 1. In the 5-minute sheet, Noah's chart shows two or three lines. The rest are
  drawn but you can't see them.
- **Size doesn't read at a glance.** At the opening zoom the strongest bead is 6 px tall and 4 px wide, and heights run
  from 0.9 to 6 px. Opacity rises with strength too, so a strong strike and a medium one differ mainly in how bright a
  thin line is. To compare two strikes you have to hover.
- **It looks ahead.** The reference is taken over everything loaded and recomputed every tick (revamp :815–830,
  :839–843). So a bead from 10:00 am gets brighter or fainter as later data arrives. Our rules forbid that.
- **Sizing by net hides two-sided strikes.** A strike with heavy calls and heavy puts that cancel draws as a hairline.
  Ours shows it as a big grey node. That carries real information. Whether it is worth the space is a fair question
  (see cause 3).
- **The colours fight ours.** Gold means puts in Noah's and calls in ours. There is no paper version. When Key levels
  is on, the supreme's beads turn magenta. The key-level rungs paint the walls green and red (revamp
  src/components/gex/palette.ts:21–22). Each of these breaks one of our colour rules.
- **Several beads a bar on 15-minute and 1-hour bars** (revamp :220–231). That breaks our rule that a bar's cell is its
  heaviest minute.
- **Small things that break our house rules.** The bead card prints "14:03 ET", a 24-hour New York time (revamp
  StrikeChart.tsx:5228). The chips are 9.5 px and the legend 9 px, both under our 11 px floor.
- **It has only been tried on the simulator.** Revamp has no data feed, so its look has never met a real book. On real
  books a few strikes dominate and most are weak, so even more of it would disappear.

To be fair to ours: our colours carry one meaning everywhere, a stale cell shows a soft edge, the card says where
the data came from, and the walls are picked from the book. Noah's has none of these.

## 5. My recommendation

**Change the height rule. Leave the count, the colours and the opacity as they are for now.** Don't copy Noah's
nodes as they are: they fix the blocking by making the field hard to see.

**Recommended: variant B, "thin rails".**

- **Height** = 2 px + (H_max − 2 px) × r, where r = the node's total gamma ÷ the session's largest so far (the
  reference stays the same), and **H_max = the smaller of 30% of the strike row and 12 px**.
- **Width** = the candle slot less 1 px for every node. Bars closer than 6 px still merge. Each strike's nodes then
  touch along the time axis and read as a sideways line, a level, not a fence.
- **Opacity**: 0.8 → 1.0, unchanged. This was the owner's ruling on Oct 15, because lower opacity looked muddy on
  black. B already cuts the ink about sevenfold without touching it.
- **How many**: 5 a bar plus the walls, unchanged. Count is not the problem, and the planned node test (section D)
  still decides it.
- **Colours, grey when balanced, the soft stale edge, the outline from 6 px**: unchanged.
- **Labels**: the node pills and wall-move chips should move off the candles' high–low band too, not only clear of
  each other. They are the only thing in either app that covers a candle.
- **Why linear and not square-root.** The square root was right for a round oval, because a circle's area grows with
  the square of its height, so a √ height makes area match gamma. But the candle slot caps the width, so the circle is
  gone and the √ now overstates weak nodes: a strike with a quarter of the top strike's gamma stands half as tall.
  Noah's 1.6 power understates them: a quarter stands 11% as tall. With the width fixed, a linear height makes ink
  match gamma: a quarter stands a quarter as tall.
- **This overrides a written rule.** The orbs rule in .claude/CLAUDE.md:1093–1096 ("d = 3 px + (85% of the strike row −
  3 px) × √…") has to be rewritten in the same change.

**Three variants worth shooting next**, all on the same views as the sheets above:

- **A, Noah's look in our colours.** Height = 2 × (0.45 + r^1.6 × (cap − 0.45)), with cap = 0.6 × bar spacing held
  between 3 and 9 px. Opacity 0.16 + 0.5 × r^1.6, plus a halo 1.9 × taller and 1.15 × wider at 0.04 + 0.14 × r^1.6
  when r > 0.2. Width = the slot less 1 px. Our reference and colours.
  - Pro: the calmest.
  - Con: weak strikes vanish, and the low opacity is what the owner already called muddy.
- **B, thin rails (recommended).** The parameters are above.
- **C, true orbs.** Diameter = 3 + (D_max − 3) × √r, with D_max = the smaller of (the slot less 1 px) and 50% of the
  row. Width = height, so every node is round. Opacity 0.8–1.0. This keeps the owner's oval and √ exactly as meant.
  - Con: at the opening zoom nearly every node comes out as the same 6–7 px dot, so size barely reads until you zoom in.

What each would cover, computed on the 12 real sessions with our own node choice. Each cell is the area covered,
then the opacity-weighted ink, then the typical and largest heights.

| View (bars apart, row) | Today | A | B | C |
|---|---|---|---|---|
| 5-minute opening (3.76 px, 97 px row) | 21.5%, 20.8% · 70 / 83 px | 2.6%, 0.9% · 3.8 / 6 px | **2.8%, 2.7% · 9 / 12 px** | 1.8%, 1.7% · 6.3 / 7 px |
| 5-minute opening, real-data row (3.76 px, 47 px) | 21.6%, 21.0% · 34 / 40 px | 5.5%, 1.8% · 3.8 / 6 px | **5.8%, 5.7% · 9 / 12 px** | 3.7%, 3.6% · 6.3 / 7 px |
| Four panes (3.5 px, 40 px) | 20.2%, 19.6% · 29 / 34 px | 6.1%, 2.0% · 3.8 / 6 px | **6.4%, 6.2% · 9 / 12 px** | 5.1%, 4.9% · 8 / 9 px |
| Wider bars (9.4 px, 48 px) | 19.5%, 18.9% · 34 / 41 px | 8.7%, 2.7% · 6.5 / 11 px | **5.1%, 5.0% · 9 / 12 px** | 3.7%, 3.5% · 7 / 8 px |
| Zoomed in (15.8 px, 97 px) | 21.6%, 20.9% · 69 / 83 px | 7.5%, 2.3% · 10 / 18 px | **2.8%, 2.7% · 9 / 12 px** | 3.5%, 3.4% · 13 / 15 px |

B keeps a 2–12 px range, a 6 to 1 spread. At the opening zoom the typical drawn node is 9 px and the weakest tenth
6.4 px, so the five nodes of a bar still rank by eye.

If B still feels heavy in the pictures, the next lever is opacity (0.6–0.9 instead of 0.8–1.0), not more height cuts.

There is one more option, on the ladder beside the chart: Noah caps the ladder's bar at 14 px (revamp
ProfilePanel.tsx:706) and we cap it at 22 (ours ProfilePanel.tsx:779). It is the same complaint and a one-number
change. Shoot it beside B.

No code was changed. These are formulas to shoot next.

## 6. Noah's functionality

I compared the code feature by feature, then checked each claim against the code a second time. **One claim was
refuted and dropped:** a "price readout in the header" as a revamp-only feature. Ours has the same readout at the
plot's top-left (src/components/terrain/CrosshairReadout.tsx). The corrections the check found are applied below.

### What Noah's has that ours lacks: Terrain

| Feature | What you see | Call | Why |
|---|---|---|---|
| Nodes with a height cap and a steep curve | Thin ribbons, at most 18 px tall (6 px at the opening zoom), plus a faint halo (revamp :208–209, :231) | **Port the cap**, not the curve | It is the whole of section 5. Use the linear curve (B), not the 1.6 power. |
| See-through nodes with a halo | Candles and grid show through the field (revamp :308–309) | Consider | The owner set 0.8 against muddy colours. Try it only after B, in pictures. |
| Hover lights one bead | Only the bead under the pointer brightens, the rest dim to 60%. A click shows the whole strike (revamp :413–451) | Consider | Ours lights the strike's whole chain on hover (ours :766–800). With thin rails, the chain may actually help you follow a strike, so judge it after B. |
| Card that follows the pointer, in rows | A small two-column card beside the pointer (revamp StrikeChart.tsx:5194–5248) | **Port the layout** | Every figure Noah's card shows is already on ours. Ours reads as 14–17 lines of monospace when pinned. Use our CardRow and PointerFollowCard (ours src/components/ui/PointerCard.tsx:56, :104) and keep our 12-hour times. |
| Key-level rungs at the plot's right edge | Short green, red, silver and magenta rules that grow under the pointer. Off by default and hidden in replay (revamp keyLevelsPrimitive.ts:81–85; StrikeChart.tsx:458) | Skip | Green and red walls break the colour rule. The card's "tends to" lines have no record behind them. Our axis chips do this job. The 180 ms grow could be lifted on its own. |
| Right-edge chips "510 · 13%" | The heaviest strikes' share of the book (revamp :453–540) | Skip | 9.5 px text. Our three pills do the same job at 11 px. |
| "Heaviest" row in the header on hover | The three heaviest strikes with dollars (revamp Terrain.tsx:1796–1815) | Skip | Ours shows the three heaviest as pills on the plot. Noah's uses hard-coded colours and 9 px text. |
| A "your strike" swatch and "pushes / holds" words in the legend | One legend line (revamp StrikeChart.tsx:5293–5312) | Consider | Ours already has a plain-words legend with swatches (ours beadLegend.ts:39–42). Only these two pieces are missing. A silver swatch would not match our pinned chain, which keeps its own gold or violet. |
| Ladder bar capped at 14 px | Thinner ladder bars (revamp ProfilePanel.tsx:706) | Consider | The same complaint, on the ladder. See section 5. |
| Several beads a bar on wide timeframes | Three beads per 15-minute bar (revamp :220–231) | Skip | Breaks "a bar's cell is its heaviest minute" and our per-timeframe tiles. |
| 12 strikes a column, 8% floor, by default | More strikes, the weak ones as hairlines (revamp :57–58) | Consider, after B | Ours can already do this: "Every strike" plus the Floor picker. Only the default differs. Twelve only works if they are thin. |
| New York time on the axis (a desk setting) | 24-hour New York times (revamp chartTime.ts:55–60) | Skip | Breaks the owner's 12-hour, reader's-clock rule. |

### What Noah's has that ours lacks: the rest of the app

**Pulse**

| Feature | What you see | Call | Why |
|---|---|---|---|
| Tile settings saved with each copy, in the tile's head | Each tile's own menus (e.g. Ranked by) sit in its one-line head, are kept per copy, and fold behind a sliders button when narrow (revamp tile.ts:77, :88, :157; desks.ts:55; TileFrame.tsx:86–103) | **Port** | Ours has per-panel menus too, but they live in memory: lost on reload or desk switch, and in a row under the head. |
| Lock the desk | One button and nothing drags or resizes (revamp Pulse.tsx:168, :480–487, :534–535) | **Port** | Small, and no rule against it. |
| Duplicate a tile, and "its own size again" | A copy with its settings, name and size (revamp TileFrame.tsx:216, :219; Pulse.tsx:337–343) | **Port** | Ours can only add a fresh copy at default settings (ours Pulse.tsx:461–470). |
| Widget picker with search, groups and drag-in | "Find a widget", three groups with counts, drag onto the grid (revamp Picker.tsx:122–143; Pulse.tsx:539–541) | **Port** | Keep our live preview. |
| Key levels as its own tile | Walls, flip, supreme, priced in SPY / SPX / ES (revamp tiles/book.tsx:160–197) | Consider | Ours has the same content behind the ladder tile's View menu (ours StrikeLadderWidget.tsx:190), retired as a tile on purpose (KeyLevelsWidget.tsx:14–17). |
| Head-to-head tile | This name against another (revamp tiles/book.tsx:362–371) | Consider | Fits the rules. Ours has it as a Pinpoint page. |
| Stocks, Insiders & Congress tiles | The Dossier's boards on Pulse (revamp tiles/market.tsx:170, :236) | Consider | Pulse is not on the feed, so these would differ from the Dossier's own pages. |
| Positions & watchlist tile | Held and watched contracts, with or against the hedging (revamp tiles/trade.tsx:180–262) | Consider | The same rows exist on our Weigher (WeigherDesk.tsx:1207, :1472). |
| Session clock tile | Phases and the time to the close (revamp tiles/you.tsx:289–347) | Skip | Ours shows all of it in the shell's strip and the Map's Trader's Clock. Noah's prints 24-hour times. |
| Five preset desks, including "The close" and "My book" | Desk tabs (revamp desks.ts:89–96) | Consider | Taste. "My book" needs the positions tile. |

**Pinpoint**

| Feature | What you see | Call | Why |
|---|---|---|---|
| One to four names side by side, each on its own expiry, in Targets and Building | A Names button, panes side by side, an expiry card per pane (revamp RankedTargets.tsx:17–38, :313; Building.tsx:230) | **Port** | The biggest functional gain. On the feed each expiry has its own open interest, so the same engine fills each pane. Ours steps one box at a time to another name. |
| Profile view: dealer gamma across price | A line per expiry and the total, with the zero crossing and the walls (revamp ExposureProfileView.tsx; data/exposureCurve.ts) | **Port** | Computed from the book. Use our colours and the 11 px floor. Ours has no across-price view anywhere. |
| The whole book as a CSV | Every greek × expiry × strike, put / call / net / open interest (revamp data/exportBook.ts:26) | **Port** | We export the levels (CopyLevels), not the book. |
| Targets and Building as one page with two faces | A Targets / Building switch (revamp Agenda.tsx) | Consider | A navigation choice. |
| A Day box on the Map | The tape with the levels over net gamma through the day (revamp MapDesk.tsx:619–631) | Consider | The owner took the chart off the Map on Sep 12 (ours MapDesk.tsx:6–16). Building's DealerTimeline and Terrain cover it. |
| Legs pick on the matrix | Put·Call·Net, Net, Calls, Puts (revamp ExposureField.tsx:81–93) | Consider | Ours already shows every leg. Missing: a leg alone, and Net alone. |
| Each column's own facts | Price, flip distance, the dealers' word, how the flip held (revamp ColumnFacts.tsx) | Consider | Ours' columns already carry price, change, supreme and read. Only flip distance, the dealers' word and "flip held" are missing. |
| Levels from today's contracts or every date | One Levels card for the room (revamp data/levelsScope.ts) | Consider | Matters on the feed, where expiries differ. |
| Fold each Map box, jump links on a phone | (revamp FoldDoor.tsx; MapDesk.tsx:533–552) | Consider | Needs 44 px touch areas. |
| Where-the-book-comes-from card | Source, freshness, formulas, other products' names (revamp BookProvenance.tsx:97–144) | Skip | Printing formulas breaks "Recipe stays private". Ours spreads the same facts across How sure, Settings › Data sources and the Glossary. |

**The Weigher, Trace, the Dossier**

| Feature | What you see | Call | Why |
|---|---|---|---|
| The case for a strike | Reasons for and against, levels in the way, the same strike down the calendar, "if not this one, which" (revamp StrikeCase.tsx; data/strikeCase.ts) | Consider, in part | Keep the reasons, the levels and the calendar row. Drop "if not this one" (a pick) and lines like "sell into rallies" and "buy the dips" (strikeCase.ts:214, :231), which our word check flags. Ours already reads a held contract against the walls. |
| Pause on the Live Tape | Freeze the book and tick together (revamp LiveTape.tsx:32–34) | Consider | The owner removed it on purpose (ours LiveTape.tsx:25–27). If it returns, it should print the reader's 12-hour clock, not "ET". |
| A "working" mark while an interval switches | (revamp Windows.tsx:502–512) | Skip | An invented wait. |
| A next-report card on the Earnings board | Type a ticker, get its next report (revamp Earnings.tsx:319–321) | Consider | Ours already answers this on each name's earnings page and through the command line ("QQQ earnings"). Noah's makes up a date beyond two weeks (data/earnings.ts:613–640). Don't copy that. |
| Earnings board of known names, the full list below | (revamp Earnings.tsx:34–47) | Consider | Helps on days with hundreds of reports. |
| News wire scrolls inside its box | (revamp News.tsx:827–831) | Consider | It goes against our grids-grow rule, so it is an exception the owner would have to agree to. |
| "N of M sources live" | (revamp StockName.tsx:671–673, :1026) | Skip | Ours lists each source. Noah's line says "sample until the feed lands", which uses banned words. |

**Paper, accounts, landing**

| Feature | Call | Why |
|---|---|---|
| Futures paper trading (order card, price ladder) and the futures backtest (revamp OrderPanel.tsx; FuturesDesk.tsx) | Skip | Options only, by the Sep 30 rule. |
| Real accounts: email, Google, Apple, reset, delete (revamp data/account.ts) | Consider later | Only once we have a backend. Never copy keys. |
| Desk follows the account between machines (revamp data/sync.ts) | Consider later | Needs a backend. |
| Plan gates, the plan wall, "Seeing as", the Stripe checkout, the People admin room, Plausible visit counts | Skip | One user, no backend, different plans (Noah's: $80 / $120 / $180; ours: $75 / $180). |
| A page per product, the "Everything in it" list, the Start page | Consider | The shapes are fine. The words include "pretend money" (banned), and the landing has a length budget. |
| Ticker tape across the landing | Skip | Says "Preview prices are simulated" and loops forever. |
| Drafted Terms and Privacy (511 and 313 lines) | Consider as a draft for counsel only | It says "graded" and "pretend money" and names Noah's plans. |

### What ours has that Noah's lacks (short)

- **Terrain**
  - A real data feed (Unusual Whales, Theta), past sessions from tiles, and SPX overnight. Revamp is simulator only.
  - The one-row header with data age, timeframe tabs with trends, expiry windows and date jumps.
  - The decision strip.
  - Axis chips with σ and broken/reclaimed walls.
  - The regime strip, the walls-through-the-day heat and the session-phase bands.
  - How sure (agreement with Unusual Whales, the track record, the charm drift).
  - The stale edge and provenance on nodes.
  - The sourced states (building, stale with Retry, no data, gap causes, Back to live) and the day panel.
  - The bead-scale basis and floor.
  - The ladder peek on a phone.
  - The keys T, W and L.
- **Partly matched in Noah's**
  - Priced move: Noah's has a ±1σ / ±2σ envelope from the open and a cone. Only ours has the prior-close budget, the
    live remaining move, the 50/68/95% washes and the calibration.
  - Level alerts: Noah's alerts on walls, flip, supreme, indicators and gamma flips, once each. Only ours has tiers,
    cooldowns, ±σ and top-3 triggers, outcomes and the right-click entry.
  - Replay: Noah's cuts the candles and the bead field at the cursor. Only ours moves the levels and the ladder there
    too and never reads past it.
  - Link groups: Noah's has A/B between Terrain's panes. Ours has A–D across the whole shell.
- **The rest of the app**
  - The command line's grammar, the "?" key sheet, and j/k and g+letter everywhere. Noah's lists its keys in Settings
    and has j on the Map's grids.
  - Pop-outs kept in step.
  - Read this. Noah's has one-line reads on Pulse tiles only.
  - The Glossary.
  - The session strip.
  - Alerts that repeat, expire, snooze, sit on a line or combine.
  - Esc layers everywhere. Noah's has the focus trap on four overlays and undo in three places.
  - Pinpoint's Ahead and At the wall pages, and overnight open-interest change.
  - Compass filed by option type, with structures named.
  - The Weigher's Vol view.
  - The backtest on real days.
  - The Journal's Today and Week views and recaps.
  - Paper keeps open positions through a reload. Noah's flattens them.
  - Status, Invite and Maintenance pages, and the Data sources, Sounds and Email settings.
  - Landing v5.

### Done differently: which is better

| What | Better | Why |
|---|---|---|
| Node size | Noah's direction, not Noah's numbers | See sections 3–5. Our typical node is 8–31 × taller (measured). Noah's is too faint to read. |
| Node opacity | Noah's, with care | Noah's is better for seeing the candles. The owner raised ours to 0.8 against mud. Decide in pictures after B. |
| Node colour | Ours | One meaning everywhere, checked under colour-blind simulation. Gold means the opposite side in the two apps, so no colour can be ported. |
| What sets size (net or total) | Even | Ours says more (a two-sided strike shows). Noah's draws fewer big nodes. |
| Size reference | Ours, slightly | No look-ahead. But the session's first big node is full size from 9:30 am, so the open looks loud. |
| Hover | Even | Noah's is calmer. Ours shows the chain, which may help once the rails are thin. |
| Bead card | Noah's layout, ours' content | |
| Key levels on the chart | Ours | Off the plot, and it follows the colour and walls rules. |
| Walls and flip | Ours | Noah's picks walls by which side of the price they are on, so a price crossing moves the wall, which the owner ruled against on Oct 15. Its flip is a midpoint, not the true crossing (revamp Terrain.tsx:235–284). |
| Heaviest strikes on the plot | Ours | 11 px against 9.5. Both keep clear of other boxes. |
| Ladder bar | Noah's | 14 px cap against 22. |
| Replay | Ours | Ours replays everything as it was known. |
| Timeframe trends | Ours | Ours are on the clickable tabs at 11 px. Noah's are arrows at 9 px. |
| Building a Pulse desk | Noah's | Saved per-copy settings, lock, duplicate, search and drag. Keep our linking and pop-outs on top. |
| Pinpoint's pages | Even | Noah's: 4 pages, multi-name. Ours: 7 pages, with Ahead and At the wall in full. |
| The Map | Even | Noah's has more on one page. But its Day box undoes a removal the owner made, and ours has the clock, the report, Copy levels and Read this. |
| Weigher returns | Ours | Noah's face is called "Simulated returns", a banned word. |
| Compass board | Ours | Files by option type and names each structure. |
| Session time | Ours | Always on screen, on the reader's 12-hour clock. |
| Earnings | Even | Ours reads real data. Noah's copes better with crowded days. |
| Paper and Journal | Ours | Options only by rule, more review tools. |
| Sign-in | Noah's | It works. Ours waits for a backend, by design. |
| Landing | Ours | Follows v5. Noah's says "simulated" and "preview". |
| Text rules | Ours | Run with our own word check, Noah's code has 129 banned-word hits beyond our allow-list, plus 1,205 type sizes under 11 px. Ours has 0 and 0. Ours' ladder still draws 9 px words (ours ProfilePanel.tsx:931 and 10 more lines), a gap of our own. |

## 7. Caveats

- **The data differs.**
  - Noah's runs a new random walk on every load, with SPY near 490.
  - Ours on the simulator has SPY near 493 and a different field model.
  - Ours on real data is Unusual Whales on Oct 15. Its field covers only regular hours, so only 154–330 of about 440
    sampled columns had any nodes. That is why our real-data coverage reads lower. Where the field draws, it computes
    to about 21%.
- **One machine, one setup.** 1920 × 1080, pixel ratio 1, dark theme only. The light theme, a phone and a 4K screen
  were not measured. Hover, pin and speed were not measured either.
- **"Changed" is what you can see, not everything drawn.** Pixels that moved less than a just-visible step don't
  count, so Noah's numbers are a floor of what it draws.
- **Heights were sampled.** I measured vertical runs every 3 px, which cut through the ovals, so typical heights read
  below the full diameter. The 7–28% of runs that touched a candle were set aside. In three of our views the largest
  height includes a flip dash touching a node.
- **The variant numbers are computed, not shot.** They use our real node choice on 12 SPY sessions (Sep 29–Oct 14) of
  5-minute tiles, and the day's price range with the 8-strike floor. Area is an ellipse, with no anti-aliasing, and
  A's halo is approximated. The "wider bars" row is 5-minute data drawn 9.4 px apart, not a true 1-hour view. The
  size-by-net test used the total-gamma reference, so it overstates that gain.
- **Line numbers may shift.** StrikeChart.tsx and Terrain.tsx have uncommitted edits from another workflow, so their
  line numbers may move. Our node renderer (gexNodesPrimitive.ts) did not change during the work, and it is identical
  at the commit the shots came from (8367930) and at the current one (20d4204).
- **Noah's history wasn't read.** Revamp is a single-commit clone at ebb37bf. Its history was read only from its code
  comments.
- **Features were compared from code.** I took no screenshots of them, and every claim was checked a second time.
- **REPORT.md was not written.** The harness refused report files from this step, so this text is the report.
- **Files**, all under `/tmp/claude-0/-home-user-3abida/3f13cba1-d81b-5e53-bbee-8bc889ed9a96/scratchpad/nodes-compare/`:
  - Tools: tools/variants.ts, tools/ablate.ts, tools/grey-share.ts, tools/measure.mjs.
  - Outputs: tools/variants.out.json, tools/ablate.out.json, measure/results.json.
  - Notes: notes/.