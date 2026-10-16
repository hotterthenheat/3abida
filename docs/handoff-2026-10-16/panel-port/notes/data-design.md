# The strike panel on Terrain's real field: the data design

Written 2026-10-16. Read only: the owner's tree at /home/user/3abida (src, server, docs and the recorded days under
.feed-cache, nothing written there) and Noah's at /home/user/revamp (1ebc5bb). Every measurement below was run by the
scripts in /tmp/claude-0/-home-user-3abida/3f13cba1-d81b-5e53-bbee-8bc889ed9a96/scratchpad/panel-port/tools/
(check-units.ts, time-greeks.ts, profile-check.ts), each on one recorded minute. Every figure names its sample. Times
are New York's unless said.

## 0 · In short

- **One pure pass gives every tab its figures.** The field's own loop (trailModel `modelColumn`,
  src/data/feed/trailModel.ts:571-644) already prices every contract with `blackScholesGreeks`, and that call returns
  every greek at once (src/core/greeks.ts:66-108). The field keeps only gamma (net and gross) and the net delta.
  A sibling function on the same `Universe` and bar, with the same `obsAt`, `oiAt`, clock, carry, window and sign, can
  keep each leg of gamma, delta, vanna, charm and vega, by strike and by (strike, expiry). The Ladder, the Net matrix and
  the Calendar all read this one pass. The Profile reprices the same contracts at a grid of prices.
  Measured on SPY, 2026-10-15 at 2:00 pm: **2.8–5.5 ms a minute** for the full set and the calendar, and
  **38–62 ms a minute** for an 81-point profile.
- **Compute** gamma, delta, vanna, charm and vega. **Leave out** theta, rho and every higher greek. Theta is not in
  core/greeks.ts. Rho is there but is not one of Noah's columns, and neither has a Unusual Whales figure. Approval 1 can
  be met in full for **gamma alone today**: the recorder keeps Unusual Whales' 60-day book for gamma only
  (server/fieldRecorder.ts:509-519). Delta, vanna and charm need the recorder to keep the other fields of the same
  answer. That costs no extra calls, only disk. Vega has no Unusual Whales figure in any book.
- **The minute being viewed** is a single 1-minute column, never a folded bar's cell. On 5m and up, a cell's strikes
  stand at different peak minutes, and its delta is a peak of its own (src/data/timeframe.ts:194-212).
    - Live: the newest column of `useFeedTrailField`.
    - Replay: `rp.frame` at the cursor.
    - History: a 1-minute column of the viewed session. The universe for that session is built from its kept inputs,
      through the `/day/<D>` route that already exists, about 200–345 KB gzipped a session.
- **Four things the owner should know** before the build (§7):
    1. UW's charm, as uw.ts divides it, is not "a day's". Measured, it is 365/100 = 3.65× a dollar delta per day.
    2. The profile's zero is not the flip. On the samples they stood 0.3–8.3 points apart.
    3. Whether the matrix may carry charm, given item 10's "never more space than one number" for the drift.
    4. What "history" means for the minute viewed.

## 1 · The greeks, one by one

**The common footing.** Each greek uses:

- the field's universe (`universeOf`, trailModel.ts:340-431);
- each contract's vol knowable at the minute's end (`obsAt`, :458-466);
- the open interest received by then (`oiAt`, :469-479);
- UW's clock and carry (`uwYears`, `UW_VOL_CONVENTION` r 4.15% q 0, :64-72; `rateOf`, :433);
- the bar's close as the price (:572-575);
- 30 strikes each side of it (`TRAIL_HALF`, :49);
- the expiry partitions (`partOf`, :320-322);
- a contract past its end holds nothing (:601).

The field's units are "open interest × greek × price²" (`TRAIL_MODEL.units`, :103). That is right for gamma, and it is
UW's convention for delta (below). For the other greeks the panel needs a stated unit of its own, chosen below.

**THE HOUSE'S SIGN, per greek.** This is read off the simulator's book (src/core/simulator.ts:849-875) and the feed's
mapping (src/data/feed/levels.ts:228-238).

| Greek | Calls | Puts | Dealers assumed |
|---|---|---|---|
| Gamma | − | + | short calls, long puts: the naive GEX rule (trailModel.ts:620, 638-640; `TRAIL_MODEL.sign` :104) |
| Delta, vanna, charm, vega | turned over (−raw) | turned over (−raw) | short both legs (the simulator's −0.55 / −0.53 on every leg but put gamma, :857-875; feedStrike negates UW's call vanna and charm and keeps UW's put vanna and charm, which UW already negated, :233-234) |

Measured below: UW's put vanna and put charm come negated. So the feed's mapping gives −raw on both legs, which is the
simulator's rule. The model's own delta does the same: `dex: -dc - dp` (trailModel.ts:640), and `dealerDeltaAt` uses
`-oi * 100 * spot * delta` (:536).

**WHAT UW'S BOOK BY STRIKE CARRIES.**

- `/spot-exposures/strike` and `/spot-exposures/expiry-strike` carry gamma, delta, charm and vanna by open interest,
  and gamma by volume and side. There is **no vega** (`UwStrikeExposure`, src/data/feed/uw.ts:308-330; the sample rows,
  docs/data-feed-samples.md:362-402 and :607-646).
- Per contract, `/option-contracts` carries gamma, delta, vega, theta and rho. There is no vanna and no charm
  (data-feed-samples.md:919-921).
- The recorder keeps the every-expiry book with delta, charm and vanna (`KEEP`, server/fieldRecorder.ts:90). It keeps
  the 60-day book with gamma only, summed per strike and by partition (:509-519, :527-533). It keeps no per-expiry rows.
- Approval 1 names the 60-day book as UW's figure, never the every-expiry one. So **today only gamma has a like-for-like
  UW figure**.

**THE UNITS UW'S VANNA AND CHARM CARRY: measured here, not stated by UW** (docs/research-2026-10-13/notes/
formulas_units_conventions.md:110 and :136 say UW documents neither).

The method (check-units.ts): one recorded minute, the model's per-strike Σ OI × raw greek on the recorder's chain
reads, against UW's every-expiry book read within a minute of it. The ratio is UW ÷ model, median over the strikes
within $12 of the price.

| Sample | Gamma, 60-day book ÷ OI·Γ·S² (calls, puts) | Gamma, every-expiry book (calls, puts) | Delta ÷ OI·Δ·S² (calls, puts) | Vanna ÷ OI·vanna (calls, puts) | Charm ÷ OI·charm per year (calls, puts) | 365·S |
|---|---|---|---|---|---|---|
| SPY 2026-10-15, 2:00 pm, 24 strikes | 1.005, −1.013 | 1.041, −1.076 | 1.149, 1.186 | 101.4, −115.5 | 2.712e5, −2.535e5 | 2.815e5 |
| SPY 2026-10-13, 1:00 pm | 0.991, −1.041 | 1.033, −1.131 | 1.065, 1.252 | 99.98, −114.2 | 2.750e5, −2.561e5 | 2.837e5 |
| QQQ 2026-10-15, 3:00 pm | 0.928, −0.836 | 1.045, −0.974 | 0.915, 1.215 | 146.3, −156.5 | 1.864e5, −1.559e5 | 2.650e5 |

(A fourth run, SPY 2026-10-14 at 11:30 am, found only a pre-market book from 12:27 am and is not comparable.)

Read so:

- **Gamma.** The pipeline holds: the 60-day book equals OI × Γ × S² within 1% on SPY. UW negates its puts.
- **Delta.** UW's unit is OI × Δ × S² in the holder's sign, as data-feed-samples.md:915-916 states. The gap of 7–25%
  is the expiries past 60 days, which only the every-expiry book holds.
- **Vanna.** UW's figure is **100 × OI × vanna (per 1.00 σ)**, shares of delta for a whole unit of vol. Calls come out
  at 97–103 on SPY's cleanest strikes. UW negates its puts. There is no price factor.
- **Charm.** UW's figure is **≈ 365 × S × OI × charm (per year)**, at 0.96–0.97 of that on SPY and 0.70 on QQQ. The
  every-expiry universe is the likely reason for the gap. It is not proven like for like.
- **So uw.ts:341-344's `÷ 365` gives OI × S × charm per year, not "a day's".** A dollar delta per calendar day is
  OI × 100 × S × charm ÷ 365, which is UW × 100 ÷ 365². The uw.ts figure is 3.65× that.
- This touches every reader of the feed's charm, for example Pinpoint on the feed (`feedStrike` charm, levels.ts:234).
  It is outside this port. I report it rather than fix it, and say plainly that it stands on three minutes against the
  every-expiry book.

### The table the owner asked for

| Greek | Per-contract formula (core/greeks.ts) | Panel unit (proposed), house sign | UW figure beside it at the strike | Verdict |
|---|---|---|---|---|
| **Gamma (GEX)** | Γ = e^{−qτ} φ(d1) ÷ (S σ √τ), :88 | −OI·Γ·S² calls, +OI·Γ·S² puts. Dollars per 1% move: the field's own figure, UW's units (trailModel.ts:103, 608-620). Its legs come from the column exactly: puts = (value + gross) ÷ 2, calls = (value − gross) ÷ 2 (:640, gross = Σ\|leg\|). That works on a tile too (tiles.ts:110-112) | **Yes.** The 60-day book read at or before the minute's end and within 10 minutes (books60: fieldRecorder.ts:489-536; levels.ts:934-950). The window is through `book60Window` (trailModel.ts:30-44). Never the every-expiry fallback that `measuredAt` makes (trailField.ts:243-249) | **Compute.** It IS the field |
| **Delta (DEX)** | Δc = e^{−qτ}N(d1), Δp = e^{−qτ}(N(d1)−1), :84-85 | The field's `dex` = −OI·Δ·S² (trailModel.ts:612-615, 640), UW's odd unit. Print it as **dollars of the underlying**, −OI·100·Δ·S = dex × 100 ÷ S. That is the drift's unit (:518-536) and the house tape's (simulator.ts:857-858). Do not use Noah's "1σ move" (\|Δ\|·OI·100·S·σ₁, revamp exposureSurface.ts:130, 176): it is unsigned and stands on an assumed σ | Partly. UW's delta is in the expiry-strike answer the recorder already fetches, but is dropped (fieldRecorder.ts:510-511). Keep `call_delta_oi` and `put_delta_oi` per strike and per partition: no extra call. Convert with UW's own row price: −UW × 100 ÷ P_uw. Until then the cell shows "—" with the reason | **Compute.** The same inputs as the field's dex. The field already carries the net (the fourth figure of a tile cell, tiles.ts:112) |
| **Vanna** | −e^{−qτ} φ(d1) d2 ÷ σ, per 1.00 σ, the same for calls and puts, :98 | −OI·100·vanna·0.01·S: **dollars of delta per vol point**, dealers short both legs. The simulator's footing (simulator.ts:865-871) | Partly. It is in the same answer and dropped. Keep `call_vanna_oi` and `put_vanna_oi`. Convert UW × 0.01 × P_uw, with the put sign taken as measured (UW negates its puts). **Ship UW's figure only after a like-for-like proof on the 60-day book**: the factor of 100 is measured here only against the every-expiry book | **Compute** |
| **Charm** | −∂Δ/∂τ per year, :100-105 (equal for calls and puts at q = 0) | −OI·100·S·charm ÷ 365: **dollars of delta per calendar day**, on the model's calendar clock (`uwYears`, trailModel.ts:68-72). A later expiry's τ is whole days and does not move inside a session. Today's expiry's τ runs to its end, so its charm grows without bound near the bell. Print it as computed, never capped, and say so in the card. Not the simulator's ÷252 (simulator.ts:873-874): the clock is calendar | Partly. Keep `call_charm_oi` and `put_charm_oi`. Convert UW × 100 ÷ 365² (measured, see above), after the same like-for-like proof | **Compute, owner to confirm.** Item 10 holds the charm-to-close drift to "ONE NUMBER IN HOW SURE … never more space than that until the track record earns it". A per-strike charm column is the greek UW's book also carries, not the drift. But it is close, so I ask (§7) |
| **Vega (VEX)** | S e^{−qτ} √τ φ(d1) ÷ 100, per vol point, :91 | −OI·100·vega: **dollars per vol point**, dealers short both legs. The simulator's (simulator.ts:861-863, 543) | **None in any UW book** (uw.ts:308-330; `KEEP`, fieldRecorder.ts:90). The slot shows "—", labelled "not in Unusual Whales' book". One option for the owner: UW gives each contract's own `vega` in the chain read every 10 minutes (data-feed-samples.md:919-921), and the recorder drops it (fieldRecorder.ts:563). Keeping it would allow "Σ OI × UW's own vega" as a measured figure, labelled as that, never as UW's book | **Compute.** Same inputs. There is no UW figure to stand beside it |
| Rho | :94-95 | — | none | **Leave out.** Not in Noah's matrix (`GREEKS`, revamp exposureSurface.ts:41-47). No UW figure |
| Theta | not in core/greeks.ts | — | per contract only | **Leave out.** No formula in the house's pricer |
| Speed, zomma, color, vomma, veta | not in core/greeks.ts | — | none | **Leave out.** Not in the pricer, not in UW's book, not in Noah's matrix |
| Gamma by volume (UW's `gexVol`) | — | — | UW only (levels.ts:220, 235) | **Leave out of the matrix.** It is not the model's input (the model weights by open interest), so it is never on one screen as the model's |

Noah's matrix has five columns (`GREEKS` gex, dex, vex, vanna, charm; revamp exposureSurface.ts:41-47). All five can be
computed honestly on Terrain's model. **None needs leaving out.** Charm waits on the owner's word because of item 10.

Each cell keeps the field's own provenance, computed over the contracts behind it as `modelColumn` does
(trailModel.ts:593-640):

- `prov` is 'modeled' at a coverage of 0.5 or more, else 'carried';
- `staleShare`;
- `readGap`;
- `wideShare`.

So a carried or stale cell wears the same soft edge and words in every tab as on the chart.

## 2 · Where the inputs live, mode by mode

| Mode | The universe it prices on | Where the page gets it | The panel's cost |
|---|---|---|---|
| **Live, today** | Today's chain reads, seed and open interest as received. The UW day comes from `loadServerDay` into `takeServerInputs` (levels.ts:984-1008; trailField.ts:156-178) | Already in the page: `NameTrail.us`, a Universe per day (trailField.ts:261, 351-357). Add one accessor, as `straddlesAtMinute` already reads it (trailField.ts:506-522) | Full set and calendar 2.8–5.5 ms a minute (time-greeks.ts: SPY 2026-10-15, 1,637 contracts priced, 911 strike × expiry cells, this container). No call, no byte |
| **Replay of today** (cursor ≤ now) | The same universe. `obsAt` and `oiAt` read by the cursor bar's end, so nothing after it is read, by construction (trailModel.ts:458-479) | The same accessor, at `rp.frame.bar` | The same. In a proof, `setPitProbe` (:451-455) and `pitGuard` (replayFrame.ts:57-70) show every read ≤ cursor + 60 s |
| **Replay of a kept or rebuilt session** | The twin's universe for a session the recorder kept whole (`takeRecordedSession`, trailField.ts:195-203). The live trail's universe for one the server rebuilt (`takePastSession`, :181-187). This is `straddlesAtMinute`'s rule (:510-513) | Already in the page while replaying: `useServerPastSessions(…, !tilesOn \|\| replay)` loads the inputs (Terrain.tsx:1355; levels.ts:1044-1058, 1096-1123) | The same per minute |
| **History, a tiled session** (the page holds tiles, not inputs: Terrain.tsx:1296-1340, 1355) | The session's kept inputs: past.json.gz (server/fieldBackfill.ts:102-128) | **Cheapest honest route (proposed):** the panel loads only the **viewed** session's inputs through the existing route, `/feed/field/<NAME>/day/<D>` (server/feed.ts:690-694; levels.ts:1049-1052, `pastInputs` trailModel.ts:693-697). It builds that one session's universe and prices only the minutes viewed. **No server change, no vendor call**. It is the code path the replay already runs | **Bytes:** 200–345 KB gzipped a session (SPY's past.json.gz on disk, 2026-10-12 to 2026-10-15; 1.4 MB as JSON). **CPU:** the universe 109–121 ms once a session, then 2.8 ms a minute (time-greeks.ts, `past`, SPY 2026-10-15). On a phone, assume 3–5× and build the universe in 8 ms slices, as trailField does (`SLICE_MS`, trailField.ts:274) |

**The Ladder's and the Net tab's gamma in history** is the 1-minute tile's column, the number the chart drew. Its legs
come from net and gross, exact to the tile's precision. Tile money is kept to about 1/20,000 of the column's largest
figure (tiles.ts:99-101). DEX net is the fourth figure of a tile cell (tiles.ts:112). A tile needs no inputs: `tileDay(name, 1, w, day)`
(tileClient.ts:113), as the day panel already reads it (Terrain.tsx:1898).

**The alternative**, if the owner would rather not send 300 KB to a phone: a server route,
`/feed/field/<NAME>/minute?day=&m=&w=`, priced from the same past.json.gz with an LRU of universes:

- about 110 ms for a session's first ask, then about 3 ms, plus about 40–60 ms for a profile;
- an answer of about 60 strikes × 10 leg figures, 911 calendar cells × 11 and 81 × 17 profile points;
- about 80 KB as JSON, roughly 25 KB gzipped (an estimate, not measured).

It is the same function, since trailModel is pure and the server already imports it.

**What cannot be had, and what the panel does there:**

- **A session priced on the session before's close vols alone.** `vols: 'close'` covers sessions before 2025-04-01
  outside the tape-built span (fieldBackfill.ts:38-41, 122-125). The field marks every cell 'carried'
  (trailField.ts:89-94). The panel prices on the same carried vols and marks every cell carried, with the same soft edge
  and words. **Do the same; never hide it.**
- **A Theta-built session.** server/thetaRebuild.ts:638-648 writes theta-final.jsonl and the tiles, and hands its
  inputs (`b.past`) to the tile builder, but **never keeps them**. The panel reads GEX (net and legs) and DEX net off the
  1-minute tile. DEX legs, vanna, charm, vega, the Calendar and the Profile show "—" with "this session's inputs are not
  kept". The fix is one write at :648: keep `b.past` as its own file, say theta-past.json.gz, so `finalRowsOf`'s
  UW-first rule is untouched. Its size per session is not measured; measure it on the owner's machine.
- **A session with neither inputs nor tiles,** before UW's dated window of about two years (fieldBackfill.ts:42-44).
  There is no field, so every figure is "—" with the reason. The boxes stand.
- **UW's figure for any past minute** the recorder did not keep: "—", "Unusual Whales serves no book by strike for a
  past minute" (the replay's own words, Terrain.tsx:2059).
- **Recorder-kept days do have point-in-time 60-day books on disk.** For SPY that is books60.jsonl.gz on 2026-10-13,
  14 and 15, with 42 reads on 10-15. The `/recorded/<D>` route serves chains, seed and total but not books60
  (fieldRecorder.ts:810-813). Add books60 to that answer so history and replay show UW beside on those days.
- **An expiry cut** (one listed date) is the field on that date's contracts alone (`universeOf(…, cut)`,
  trailModel.ts:340, 360).
    - Live: UW beside comes from `/spot-exposures/expiry-strike` for the date, which carries all four of UW's greeks
      (levels.ts:525-537).
    - Replay and history: "—". That poll is not point-in-time.

**Recorder changes, all with no extra calls.** In `readBook60`, keep each strike's `call/put_delta_oi`,
`call/put_vanna_oi` and `call/put_charm_oi`, and their partitions, beside gamma (fieldRecorder.ts:509-519).

- Today SPY's books60 is 326 KB gzipped a day (42 reads × 192 strikes × 13 figures).
- With three more greeks it is about 3.3× that, roughly 1.1 MB gzipped a day per name (estimated).
- The calendar's UW figure per (strike, expiry) needs the per-expiry rows kept as well. That is about 2,000 rows × 9
  figures a read, roughly 4–6 MB gzipped a day per name (estimated). Kept to the field's ±30 strikes it is about half.
  The owner's call (§7); it is shown on the card only.

## 3 · The Calendar and the Profile

**THE CALENDAR: strike × expiry at minute m.**

- Built in the same pass as the greek set. Each contract's figure adds to the cell (strike, its expiry), keyed by
  `u.expiry[j]` and `u.part[j]` (trailModel.ts:259-262).
- Units and house sign are the same as §1. Open interest per cell is `oiAt` at the minute.
- A cell's at-the-money vol for Noah's `SurfaceExpiry.iv` is the nearest strike's call and put vols knowable at the
  minute.
- **Identity:** the cells of a strike, summed over the window's expiries, equal the field's value at that strike. That
  is the chart's number. It belongs in the proof.
- **Columns** are the listed dates within 60 days (`CHAIN_MAX_DTE`, trailModel.ts:51). There are 16 on SPY on 10-15
  and 15 in the books60 read. Noah's reach to 91 days (`CALENDAR_DTES`) has no inputs here: say so, add no column.
- The expiry window filters the columns (`WINDOW_TOP`, :302).
- On an index's third Friday the AM root (SPX) and the PM root (SPXW) share a date but not an end (`endOf`, :206-215).
  Keep them as two columns, or one with both named. Do not merge them silently.
- **Cost:** included in the 2.8–5.5 ms above.
- **Not Noah's surface.** Noah's surface anchors far expiries to the front leg on a desk chain (revamp
  exposureSurface.ts:21-28, 132-193). Our copy of `buildExposureSurface` reads UW's live book on the feed
  (src/data/exposureSurface.ts:121-129). That is not point-in-time and not the field, so Terrain must not use it.

**THE PROFILE: the dealers' gamma across price at minute m.**

- **Definition (proposed): "the field's column if the price stood at S′".**
    - Each contract keeps its own vol, knowable at the minute (sticky strike).
    - The clock is the minute's on UW's convention. It does not move with S′.
    - Open interest is as of the minute.
    - The 30-strike window recentres at each S′, as `modelColumn` does (:576).
    - Units are OI × Γ(S′) × S′², dollars per 1% at S′. House sign: calls −, puts +.
    - One line per listed date in the window, plus the total.
- **Why recentre:** at S′ = spot the curve then equals the column's net, which is the regime strip's figure, to seven
  figures:

| Sample | Column net | Curve at spot, recentred | Curve at spot, over all chain strikes |
|---|---|---|---|
| SPY 10-15, 2:00 pm | 1.267715e9 | 1.267715e9 | 3.4587e9 (192 strikes) |
| SPY 10-13, 1:00 pm | −2.321665e9 | −2.321665e9 | +2.0064e7, the other sign |
| QQQ 10-15, 3:00 pm | 8.808441e9 | 8.808441e9 | 8.9031e9 |

  So the band's total can disagree in sign with what the chart shows.
- **This replaces Noah's curve.** Noah's (revamp src/data/exposureCurve.ts:55-124) rescales each cell by one ATM vol
  per expiry. It is an approximation; the per-contract repricing is not.
- **Cost (profile-check.ts):** 81 spots over ±4% took 38–62 ms a minute, over the 2,725–3,100 contracts the chain
  holds at the minute. 41 spots took about 23 ms (time-greeks.ts). Run it only while the Profile is open, once a new
  minute. While a replay plays, at most every 250 ms, and always labelled with its own minute, never ahead of the
  cursor. Slice it on a phone.
- **The curve's zero crossing is NOT the flip.**
    - The flip is the linear zero crossing of the per-strike net nearest the price (core/walls.ts `pickFlip` :124,
      `zeroCrossings` :146).
    - The curve's zero is the price at which the whole window's net would turn, if the price moved there with vols
      held.
    - Measured, they differ: SPY 10-15 flip 771.94 against curve zero 771.66; SPY 10-13 777.52 against 776.39;
      QQQ 10-15 728.93 against 737.23.
    - Noah labels the curve's zero "flip" (revamp exposureCurve.ts:42, 107-120). The port must rename it, for example
      "Curve crosses zero". The flip rule on the Profile stays the field's `pickFlip` flip, drawn as the flip.
    - Never "regime boundary", never "zero gamma". "Zero gamma" is the trade's other name for the flip.
- **The Flow lane** (today `buildFlowFromRows`, src/data/hedgeFlow.ts:81-102, on the ladder's rows; Terrain.tsx:2392)
  keeps working on the minute's column rows. Optionally its "dealer buying or selling to K" can become exact: the
  dealers' delta repriced at S′ = K minus at the price, through `dealerDeltaAt` (trailModel.ts:522-540) with `close: K`.
  That is about 60 × 1,600 greeks, roughly 30 ms. Owner's choice.

## 4 · How the panel learns the minute being viewed

| Mode | The minute | The column (gamma, as the chart drew it) | The hook to reuse | A new figure each minute |
|---|---|---|---|---|
| Live (feed) | The newest 1-minute column of today | `fTrail.snaps[last]` (Terrain.tsx:1295, 1356) | `useFeedTrailField` (trailField.ts:440-488). Recompute when the last column's `time`, or its inputs (`trailMeta(snap).readAt`, trailField.ts:142, 372), changes | Yes. The trail models each new bar in its work loop (trailField.ts:362-381) and publishes (:384, 391-411) |
| Replay | `rp.frame.cursor` | `rp.frame.column` (`columnAt`, 2-minute slack, same day: replayFrame.ts:201-206, 212-241) | `useTerrainReplay` (useTerrainReplay.ts:89-120); the cut is a `GrowingCut` (replayFrame.ts:101-129) | Yes, per cursor step. Never past it: every read is stamped ≤ `knowableAt(cursor)` (replayFrame.ts:53) |
| History (feed) | **To decide (§7).** Proposed: the newest 1-minute column at or before the view's right edge, once the view has left live; a click on a bar pins that bar's last minute | The 1-minute tile column, `tileDay(ticker, 1, win, day)` (tileClient.ts:113), even when the pane draws 5m and up | StrikeChart tells the host only *whether* the view left live (`onViewEdge(atLive)`, StrikeChart.tsx:865, 2707-2718). The visible range is already read at :2696 (`data-chart-view`). Hand `vr.to` to the host. `onBarClick` exists (:872), but Terrain passes it on daily only (Terrain.tsx:1870-1878) | Static: the minute moves when the view does |
| House's tape | The newest house column, or the replay's cursor | `Simulator.getGexHistory` (Terrain.tsx:2083), `houseReplay.cols` (:1436-1439) | `revision` (the market store's scan) | Yes |

**On a folded timeframe the chart's bead is not the minute.** A 5m+ cell keeps each strike's PEAK minute (`at`,
timeframe.ts:194-208), and its delta is an independent peak (:209-212). If every tab reads one minute, the bar's last
closed minute, the Ladder matches the bead on 1m only. On 5m+ the row's card can add "on the chart: the bar's heaviest
minute, $X at 12:39 pm" (the bead card's own words). The alternative is a Ladder that shows the bar's peak cells while
the other tabs show a minute, with mixed minutes on one panel. I recommend the single minute (§7).

**The one current price.** Δ from spot keeps the one live quote while live (the house rule: the ladder's Δ spot equals
the rail's price, `feedRail` liveSpot, Terrain.tsx:489-493). The figures are the newest column's, priced at that bar's
close. In replay and history, the price is the minute's close (`rp.frame.spot`, replayFrame.ts:219).

**Ghost dots and "since the open" follow the source the Ladder reads** (CLAUDE.md, item 8). Live, today they come off
UW's books (`liveLagged`, Terrain.tsx:2080-2095). Once the Ladder reads the field's column, they must come off the
field's columns 10, 30 and 60 minutes back: `laggedAt` on `fTrail.snaps` (replayFrame.ts:259-282). `feedOpenRatio`
already reads the field (Terrain.tsx:2397-2401).

**The UW figure beside, per minute,** is the newest 60-day read at or before the minute's end and within 10 minutes
(the `MEASURED_60_WITHIN_MS` rule, trailField.ts:226, 234-242), with **no** every-expiry fallback (:243-249). Use a
60-day-only variant of `measuredAt` that returns null and a reason. `measuredBooks60` holds today's reads only
(levels.ts:946-950). Past recorder days need the `/recorded/<D>` addition from §2.

## 5 · The house's tape (no feed): the same boxes

Each simulator bar carries, per strike, `value`, `gross`, `dex`, `vex`, `callOI` and `putOI`
(simulator.ts:530-546, 565-593). From those:

- **Gamma legs** are exact: put = (value + gross) ÷ 2, call = (value − gross) ÷ 2, because callGex ≤ 0 and
  putGex ≥ 0 (:540-541).
- **Delta** is `dex`: OI·100·Δ·S, dealers short both legs. That is the panel's DEX unit already.
- **Vega** is `vex`: OI·100·vega per point, dealers short both legs. That is the panel's VEX unit already.
- **Vanna and charm are not on a bar.** They live on the live chain alone (`snapshotFor`, then `generateOptionsChain`,
  :816-903; vanna and charm at :865-875, τ = 0.003 at :841). That chain prices off the current book (`oiBook`), so in a
  replay it would read past the cursor. Price them for the bar viewed from the bar's own `callOI`, `putOI` and spot, the
  name's iv (TICKERS) and the simulator's τ, by :865-875's arithmetic. Use ÷365 per calendar day for charm, not ÷252, so
  the unit is the feed's.
- **The Calendar.** The house has no per-expiry book. Its calendar is the desk-chain surface (our
  src/data/exposureSurface.ts:121), priced off the live simulator. For a past bar, port Noah's `pricedOff: 'snapshot'`
  (revamp exposureSurface.ts:122-125, 139), which hands the bar's snapshot to the desk. Our copy lacks it.
- **The Profile** reprices the bar's strikes at a grid of prices with the house's one iv and τ.
- **UW beside** is "—" everywhere, with words for the house's tape and no vendor named as a source.
- **Noah's GEX tab** reads `Simulator.snapshotFor` every 10 s (revamp ProfilePanel.tsx:426-458; the interval at :436,
  the read at :458). On Terrain it reads neither that nor any snapshot "now": always the viewed bar's.

## 6 · What the build touches (all in the owner's tree; listed here, not done)

1. **trailModel.ts** gains a pure `greekColumn(u, bar, { half, only })`. It is `modelColumn`'s loop keeping both legs
   of gamma, delta, vanna, charm and vega by strike, by partition and by (strike, expiry), plus the provenance fields.
   It also gains `profileAt(u, bar, spots)`, recentred as §3 defines. State the sign and units for the new greeks
   beside `TRAIL_MODEL`, with a version of their own that rides on the panel's figures.
2. **trailField.ts** gains an accessor for the universe of (ticker, cut, recorded, day), as `straddlesAtMinute` already
   reads it.
3. **The history route:** the panel loads one viewed session through `/day/<D>`. Or, the server minute route (§2).
4. **fieldRecorder.ts** `readBook60` keeps delta, vanna and charm (and optionally the per-expiry rows). `recorded()`
   serves books60. Neither costs a call.
5. **thetaRebuild.ts:648** keeps `b.past`.
6. **StrikeChart** hands the view's right edge time with `onViewEdge`.
7. **Proofs** (scripts/, in `npm test`):
    - `greekColumn`'s gamma equals `modelColumn`'s value and gross, and its delta equals `dex`, to the cell;
    - the calendar's strike sums equal the column;
    - the profile at spot equals `netOf`;
    - no read past the cursor (`setPitProbe`);
    - UW's vanna and charm units, like for like on the new 60-day rows, before UW's figure is shown for them;
    - keys in and keys out draw the same boxes.

## 7 · For the owner

1. **Charm in the matrix.** Item 10 limits the charm-to-close drift to one number in How sure. A per-strike charm
   column is the greek, as UW's own book carries it, not the drift. May it stand? If not, the matrix has four columns
   and charm is left out "until the track record earns it".
2. **UW's charm and vanna units** (§1). The feed's charm as uw.ts divides it reads 3.65× a dollar delta per day, and
   the feed's vanna is shares per whole unit of vol where the house's tape prints dollars per vol point. This is
   measured on three minutes against the every-expiry book. It touches Pinpoint on the feed too. Fix it as a task of its
   own, after the like-for-like check?
3. **"History" for the minute viewed.** The proposal is the view's right edge once off live, with a click pinning a bar.
   The alternatives are a click only, or the crosshair, which moves too fast for a whole panel.
4. **On 5m and up,** one minute for every tab (the bar's last), with the chart's peak-minute figure on the row's card?
   Or the Ladder on the bar's peak cells?
5. **UW figures for the Calendar's cells** need the recorder to keep the per-expiry rows: about 4–6 MB gzipped a day
   per name, estimated. Keep them, or show "—" on the calendar's card?
6. **Vega:** show "Σ OI × Unusual Whales' per-contract vega" beside the model's (the recorder would keep one more
   figure per chain row), or "—"?
7. **The sign words for DEX, vanna and charm.** Gold absorbs and violet amplifies is gamma's meaning. For the other
   greeks the sign is the dealers' hedge direction. The bars need words of their own on the card. "Absorb" and
   "amplify" must not be borrowed for them.
