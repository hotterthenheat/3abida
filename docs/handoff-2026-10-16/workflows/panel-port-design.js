export const meta = {
  name: 'panel-port-design',
  description: "Design the port of Noah's strike panel into Terrain on the real field: read both panels, the matrix and the field views, the data each tab needs, the house rules; shoot Noah's panel; write the build plan",
  phases: [
    { title: 'Read', detail: "Noah's panel, his matrix and field, our ladder, the data design, the rules" },
    { title: 'Check', detail: 'the data design and the must-not-lose list checked against the code' },
    { title: 'Plan', detail: 'one build plan in units, with the open questions' },
  ],
}

const S = args.S
const OUT = `${S}/panel-port`
const RULES = `
HARD RULES (read twice):
- Two codebases. OURS = /home/user/3abida (the owner's Slayer). Another workflow is editing its src right now: NEVER edit, create or delete anything under /home/user/3abida; read only. NOAH'S = /home/user/revamp, checked out at 1ebc5bb (read only; its node_modules are installed).
- Write only under ${OUT}/ (create it). Temporary scripts in ${OUT}/tools/.
- Never print or copy /home/user/3abida/.env. Never start a Theta Terminal. Never \`pkill -f\`/\`killall\`; stop only your own processes by PID; never touch ports 5180 or 5190.
- Local HTTP needs no_proxy=127.0.0.1,localhost NO_PROXY=127.0.0.1,localhost. Chromium: executablePath '/opt/pw-browsers/chromium'; resolve playwright from /home/user/3abida/node_modules.
- "The owner" for ours, "Noah" for the revamp; no pronouns for either.
- Every claim cites file:line. Say plainly when you are unsure.

THE OWNER'S TASK (verbatim, the source of truth):
"Port the revamp repo's strike panel (Noah's) into Terrain. Source: https://github.com/Nuh00/revamp (commit 1ebc5bb).
- The panel: src/components/gex/ProfilePanel.tsx, with Ladder · Net · GEX tabs.
- The matrix chart: src/components/gex/ExposureMatrix.tsx.
- The GEX tab hosts src/components/gex/ExposureField.tsx (Calendar · Matrix · Profile).
What I want:
- Replace Terrain's current strike ladder with his panel: its look, the Ladder view (puts left, calls right, the spine), the tab rail, the sash, the width tiers and its hover card.
- The Net tab shows the matrix chart (one row per strike, each greek's net as a figure and a bar), not his net dashes.
- The GEX tab keeps Calendar and Profile. Drop Matrix from its picker so the matrix isn't in two places.
Rules for the port:
- Real data only. His GEX tab reads Simulator.snapshotFor every 10 s. In Terrain, every tab reads the field for the minute being viewed (live, replay, history), updates with each new minute, and never shows a minute past the replay cursor.
- Matrix columns: compute each greek from Terrain's own per-minute repricing of the real book, with the same inputs and house sign as the field. Leave out any greek you can't compute honestly, and say which.
- Approval 1 still holds: the panel shows the chart's number for the minute, with UW's figure beside it, labelled (on the card where a row can't fit it).
- Terrain's colours, not his. His House palette makes gold mean amplify, the opposite of our ovals, and his Thermal ramp uses red. Use Terrain's Colours setting (gold absorb, violet amplify, or the colour-vision pair) so a strike reads the same on the panel and the chart. No second palette switch.
- Our rules apply to every ported line: the approved type scale, nothing under 11 px, the words check, global tokens and house components, 12-hour times, Terrain's 40% width cap, and rows aligned with the chart's strike rows.
- Nothing the current ladder does may be lost (the Flow lane, Δ from spot, the phone overlay, the R key and Strikes button, the UW comparison). List anything his panel lacks, then port it or ask.
Order: after the colour rule and the node look, ahead of the remaining approvals. Then apply approvals 1, 2 and 17 to the new panel, so the old ladder isn't fixed and then thrown away. Send screenshots of each tab at 1 and 4 panes, desk and phone, with your report."

APPROVAL 1 (owner): "Ladder vs chart: approved. The ladder shows the chart's number for the minute being viewed, with UW's figure beside it, labelled." UW's figure = the 60-day book by strike (levels.ts FeedBook60 / books60), never the every-expiry book.
APPROVAL 2 (owner): "Spacing and type scale: approved as proposed, including sentence case and 9 px → 11 px." The proposal: /home/user/3abida/docs/terrain-audit-2026-10-15/README.md §6f — tokens --fs-tick 10/12 (chart ticks only), --fs-label 11/16, --fs-body 12/16, --fs-strong 13/20, --fs-head 15/20, --fs-display 20/24; weights 400/500/600; sentence case, no tracking; the 4 px spacing grid; control heights 16/20/24/32; icons 12 in a row, 16 in a menu or a 32 px button.
APPROVAL 17 (owner): "Lane names on narrow ladders: approved." — at every panel width the lane names with their Term tooltips stand whole (first head row where they fit, else a second head row), never cut, reachable by keys; the chart's fit accounts for the taller head so no strike row hides under it.`

const ANATOMY = { type: 'object', properties: { markdown: { type: 'string', description: 'the full write-up (also saved to the note file)' }, items: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, what: { type: 'string' }, where: { type: 'string' }, inputs: { type: 'string' }, notes: { type: 'string' } }, required: ['name', 'what', 'where', 'inputs', 'notes'] } } }, required: ['markdown', 'items'] }

phase('Read')
const reads = await parallel([
  () => agent(`${RULES}

Write the anatomy of NOAH'S STRIKE PANEL at 1ebc5bb: /home/user/revamp/src/components/gex/ProfilePanel.tsx (whole file) and how /home/user/revamp/src/pages/terrain/Terrain.tsx mounts and feeds it (PROFILE_MIN_W, profileRestWidth, ProfileLane, ProfilePalette, PALETTE_OPTIONS, every prop and where its value comes from), plus every module it imports for drawing (heatmap.ts heatCellStyle/heatRampColorFor/HEAT_MODE, StrikePressureLadder splinePath, palette.ts, paletteInk.ts, data/hedgeFlow, data/volumeProfile, levelview sinceOpenRead, ProfileGuide.tsx).
Cover, each with file:line: the tab rail (Ladder · Net · GEX — how it switches, what it remembers, keys), the Ladder view (puts left, calls right, the spine — geometry, what a row draws, figures, the strike column, walls/flip/supreme/spot marks, lanes, the head), the Net view (his "net dashes" — which the owner replaces), the GEX tab (how it hosts ExposureField and with what inputs), the SASH (the drag handle: min/max, what it stores, keys, double-click), the WIDTH TIERS (each breakpoint and what changes at it), the HOVER CARD (what it shows, where it stands, how it follows the pointer, pin), the palettes (House, Thermal — exact colours and meanings), every font size and weight used (list each with its line; flag every one under 11 px), every colour literal, every read of Simulator / snapshotFor / a timer, how rows align with the chart (if they do), the phone layout (if any), the keys.
Then RUN Noah's app for reference pictures: \`cd /home/user/revamp && nohup npx vite --port 5196 --host 127.0.0.1 --strictPort > ${OUT}/revamp-vite.log 2>&1 & echo $!\`; find how its Terrain desk is configured (localStorage keys in its Terrain.tsx/layouts.ts/paneKeys.ts; read ${S}/nodes-compare/tools/ for the script that shot revamp earlier and reuse its setup), and shoot Noah's panel on each tab (Ladder, Net, GEX › Calendar, GEX › Matrix, GEX › Profile) at 1 pane and 4 panes at 1920×1080, and on a phone 390×844, plus a close-up of the hover card (hover a row) and the sash being dragged to its narrowest and widest tier → ${OUT}/noah/*.png. Stop the server by PID. Save the write-up to ${OUT}/notes/noah-panel.md.`, { label: 'read:noah-panel', phase: 'Read', schema: ANATOMY }),

  () => agent(`${RULES}

Write the anatomy of NOAH'S MATRIX and FIELD VIEWS at 1ebc5bb: /home/user/revamp/src/components/gex/ExposureMatrix.tsx (whole) and /home/user/revamp/src/components/gex/ExposureField.tsx (whole: Calendar · Matrix · Profile), and every data module they read (data/greekSurfaces.ts, data/exposureCurve.ts, data/gexSeries.ts, data/exposureCompare.ts, data/optionChain.ts, core/higherGreeks.ts, core/greeks.ts, Simulator.snapshotFor — whatever they import).
For EACH view say exactly: what one row/cell/line is; every column or axis and its unit; which greeks (name each: gamma, delta, vanna, charm, vega, speed, vomma, zomma, colour …) and the formula each uses (per contract and the summed unit: e.g. OI × 100 × greek × S² × 0.01), the sign convention, the reference/scale of each bar, the colours, every font size (flag < 11 px), interactions (hover, sort, pick, keys), and every place it reads the simulator or a timer. For the Calendar: its axes (strike × expiry? time?), what a cell is. For the Profile: the price range, how it reprices (sticky strike? the clock?), what lines it draws (per expiry, total, zero crossing, walls).
Save to ${OUT}/notes/noah-matrix-field.md.`, { label: 'read:noah-matrix-field', phase: 'Read', schema: ANATOMY }),

  () => agent(`${RULES}

Write the complete inventory of OUR CURRENT STRIKE LADDER in Terrain — everything it does, so nothing is lost in the port: /home/user/3abida/src/components/gex/ProfilePanel.tsx (whole file), how /home/user/3abida/src/pages/terrain/Terrain.tsx mounts and feeds it (rail rows, the feed's book, book60, the field, HowSureBook / Sureness, feedFreshness, the expiry card and windows, the read line, palettes/rails Colours, the width cap at 40%, the R key, the Strikes button and the phone overlay/peek, data-plot-inset and StrikeChart applyFitMargins (rows aligned with the chart's strike rows), pin/focus with the chart (onPinStrike), hover card, the Net/Sides toggle, the σ column, Δ from spot, the Flow lane and every other lane (Size, VPOC/volume profile, What a move forces …), ghost dots in a replay, walls/flip/supreme/broken-reclaimed marks, the expiry windows on the feed, the ladder's own keys, its How to read guide, words, its tests in scripts/terrain-ui-proof.mjs (list every check that touches the ladder by name) and its proofs.
Also the house rules in /home/user/3abida/.claude/CLAUDE.md that bear on it (quote the lines: THE TERRAIN UI PASS, PASS 2, PASS 3, Section A, the orbs' colours, approval-related notes) and the audit's open items about the ladder in /home/user/3abida/docs/terrain-audit-2026-10-15/README.md (§6c, §6f, §6j items 1, 2, 17, and any ladder finding).
For every feature: what the user sees, file:line, the data it reads (feed and house), and whether it is live/replay/history aware. Save to ${OUT}/notes/our-ladder.md.`, { label: 'read:our-ladder', phase: 'Read', schema: ANATOMY }),

  () => agent(`${RULES}

DATA DESIGN: how each tab of the new panel can read Terrain's real field honestly, for the minute being viewed (live: the newest; replay: the cursor's, never past it; history: the day/minute shown), updating with each new minute.
Read in OURS: src/data/feed/trailModel.ts (the model: Universe, OI as received, vols knowable at the minute, the clock UW solves under — uwYears/UW_VOL_CONVENTION, the house sign, units OI × greek × price², netOf, partOf/parts by expiry, driftToClose (delta), wallMovesOf, openColumn), src/data/feed/trailField.ts (how the page models today), src/core/greeks.ts (which greeks it has: gamma, delta, vanna, charm, vega …), src/data/feed/levels.ts (the feed's books: /spot-exposures/strike, FeedBook60/books60, fieldSnaps, useServerPastSessions), src/data/feed/uw.ts (which greeks UW's book by strike carries, its units and signs, charm ÷ 365), src/data/feed/tiles.ts + src/data/feed/tileClient.ts + server/fieldTiles.ts (what a past session's tiles hold — only net/gross per strike? the 12th/13th cell figures), server/fieldBackfill.ts and server/fieldStore.ts (what inputs are kept per session on disk: open interest, per-contract minute vols, the chain), src/data/replayFrame.ts and src/components/terrain/useTerrainReplay.ts (the cursor; frameAt), docs/data-feed.md (the trail, the tiles, the store, UW's units), docs/data-feed-samples.md.
Answer, with file:line:
1. Per strike at minute m, which greeks can be computed by the SAME model with the SAME inputs and house sign as the field's gamma (gamma; delta — the drift uses it; vanna; charm on the model's clock, per day; vega; any higher greek) — for each: the per-contract formula in core/greeks.ts (or missing), the summed unit that matches the field's convention and UW's for the comparison, the sign rule (the house's: which side is negated), whether UW's book carries the same greek at the strike for the "UW beside it" figure, and an HONEST verdict: compute / leave out (why). Note: the feed's book has no vega; UW Basic's limits.
2. Where the inputs live for each case: LIVE today (the client's universe in trailField), REPLAY of today (cursor ≤ now), HISTORY (a past session drawn from tiles — the client does not hold the inputs): propose the cheapest honest route for history (e.g. a server route that models one minute's full greek set from the kept inputs on demand, cached; or extending the tiles) with its cost (calls, CPU, bytes) and what is impossible (a session whose minute vols are not kept: say what the field does there — 'carried' cells — and do the same).
3. The CALENDAR (strike × expiry at minute m?) and the PROFILE (exposure across price at minute m: reprice the minute's book at a grid of spots, vols held per contract, on the model's clock) — how to compute each from the same universe; units; cost per minute; the house sign; what a "zero crossing" means there vs the field's flip (never relabel the flip).
4. How the panel learns "the minute being viewed" in each mode and gets a new figure each minute (the chart's newest column / the replay cursor / a history view) — the existing hooks to reuse.
5. On the HOUSE's tape (no feed): what the simulator's book provides, so keys in or out draw the same boxes ("the UI is the owner's; the feed fills it").
Save to ${OUT}/notes/data-design.md.`, { label: 'read:data-design', phase: 'Read', schema: ANATOMY }),

  () => agent(`${RULES}

RULES AND LOOK MAPPING for the port. Read in OURS: src/theme/tokens.css (the type tokens if approval 2's exist yet; the colour tokens --absorb/--amplify and the data-cvd pairs), src/components/gex/palette.ts, paletteInk.ts, heatmap.ts (HEAT_MODE 'gold-violet', the rails' Colours: House/Thermal in TerrainCfg rails), how the chart's ovals get their inks (gexNodesPrimitive legend().inks, beadScale), how our ladder gets its inks today, the 40% width cap (find it in Terrain.tsx), the row alignment (ProfilePanel data-plot-inset, StrikeChart applyFitMargins, FIT_GAP_PX), the house components a panel must use (ui/FilterTabs, ui/DropdownSelect, ui/PopoverCard, ui/PointerCard CardRow/PointerFollowCard, ui/Term, ui/layers useOverlay/useEscapeLayer, .hit), core/format (every figure), core/nyTime clock (12-hour reader's clock), scripts/check-words.mjs (what it scans) and docs/terrain-audit-2026-10-15/README.md §6f (the approved scale).
Read in NOAH'S: ProfilePanel.tsx, ExposureMatrix.tsx, ExposureField.tsx — every colour literal, palette and font size.
Produce: (a) a colour mapping table — each of Noah's inks/ramps/palettes → our token or reader (gold = absorb = calls side, violet = amplify = puts side, grey balanced, the colour-vision pair under data-cvd; candles' up/down only for direction; magenta only the supreme) so a strike reads the same on the panel and the chart, and what to do with his House/Thermal palette switch (there must be no second palette switch — say what replaces it: Terrain's Colours setting); (b) a type mapping table — each of his sizes/weights → the approved token (nothing under 11; ticks 10 only on a chart axis); (c) the house components replacing each of his bespoke controls; (d) every string of his that would fail our words check or our rules (banned words, 24-hour/ET times, trade instructions, tracked caps) with the replacement; (e) the width-cap and row-alignment requirements as concrete acceptance checks.
Save to ${OUT}/notes/rules-mapping.md.`, { label: 'read:rules-mapping', phase: 'Read', schema: ANATOMY }),
])
const [noahPanel, noahMatrix, ourLadder, dataDesign, rulesMap] = reads

const CHECK_SCHEMA = { type: 'object', properties: { corrections: { type: 'array', items: { type: 'object', properties: { claim: { type: 'string' }, verdict: { type: 'string', enum: ['confirmed', 'refuted', 'partly'] }, evidence: { type: 'string' }, correction: { type: 'string' } }, required: ['claim', 'verdict', 'evidence', 'correction'] } }, missing: { type: 'array', items: { type: 'string' } } }, required: ['corrections', 'missing'] }

phase('Check')
const [dataCheck, ladderCheck] = await parallel([
  () => agent(`${RULES}

Adversarially check this DATA DESIGN against the code. For every greek verdict ("compute"/"leave out"), every formula and unit, every sign rule, every claim about where inputs live (live / replay / history), the proposed history route and its cost, and the Calendar/Profile computations: try to refute it by reading the code (cite file:line). In particular: is each "compute" greek really computable with the field's own inputs at minute m without look-ahead (vols received by the minute's end, OI as received, the model's clock)? Does UW's book really carry each greek named for the "beside it" figure, in matching units after the house sign? Are the tiles really missing what the design says? Is anything in the design a second model that would disagree with the field's gamma? Also list what the design MISSED.
THE DESIGN: ${JSON.stringify(dataDesign).slice(0, 60000)}`, { label: 'check:data-design', phase: 'Check', schema: CHECK_SCHEMA }),
  () => agent(`${RULES}

Adversarially check the MUST-NOT-LOSE list of our current ladder, and find what it missed. Read /home/user/3abida/src/components/gex/ProfilePanel.tsx and Terrain.tsx's mounting yourself, grep every prop, lane, key, data attribute (data-*) used by scripts/terrain-ui-proof.mjs or other scripts, every feature named in .claude/CLAUDE.md for the ladder, and confirm each listed item exists as described (file:line). Add every feature the list missed. Then, against Noah's panel anatomy below, mark for each of our features whether Noah's panel has it (yes / partly / no) — the "his panel lacks" list the owner asked for.
OUR LIST: ${JSON.stringify(ourLadder).slice(0, 50000)}
NOAH'S PANEL: ${JSON.stringify(noahPanel).slice(0, 40000)}`, { label: 'check:must-not-lose', phase: 'Check', schema: CHECK_SCHEMA }),
])

phase('Plan')
const plan = await agent(`${RULES}

Write the BUILD PLAN for the port, to ${OUT}/PLAN.md, and return it as your final text. Inputs:
- Noah's panel: ${JSON.stringify(noahPanel).slice(0, 40000)}
- Noah's matrix and field: ${JSON.stringify(noahMatrix).slice(0, 30000)}
- Our ladder: ${JSON.stringify(ourLadder).slice(0, 40000)}
- Must-not-lose check (with "his panel lacks"): ${JSON.stringify(ladderCheck).slice(0, 20000)}
- Data design: ${JSON.stringify(dataDesign).slice(0, 40000)}
- Data design check: ${JSON.stringify(dataCheck).slice(0, 20000)}
- Rules and look mapping: ${JSON.stringify(rulesMap).slice(0, 30000)}
The plan must have:
1. WHAT GETS BUILT: the new panel's structure (files: which of Noah's files are ported, renamed, or rewritten; which of ours are kept, retired or merged), the tab rail (Ladder · Net · GEX), each tab's content, the sash, width tiers, hover card, and how it mounts in Terrain (replacing the current ladder at every place it is mounted: desk, pop-out, phone overlay).
2. THE DATA, per tab and mode (live / replay / history / the house's tape): the exact source at the minute viewed, the update cadence, the never-past-the-cursor guarantee, and the history route (server work if any). The matrix's greek columns: the list computed, the list LEFT OUT and why (the owner asked to be told), units and the house sign, and UW's figure beside each (or "UW does not carry it").
3. COLOURS AND TYPE: Terrain's Colours setting only; the mapping; the approved type scale; no second palette switch.
4. NOTHING LOST: every feature of our ladder with where it lands in the new panel; "his panel lacks" — for each: port (how) or ASK (only where the choice is genuinely the owner's: one line on what the owner gains/loses each way).
5. UNITS OF WORK in order, each a commit with its acceptance checks (terrain-ui-proof checks that fail on the old code, unit proofs for the greek columns against the field's gamma and against UW where carried, the replay cursor proof extended to the panel), then approvals 1, 2 and 17 applied to the new panel as their own units, then the screenshot set (each tab at 1 and 4 panes, desk 1920×1080 and phone 390×844, dark; plus paper where cheap).
6. RISKS and the honest cost (lines, time, server CPU).
7. QUESTIONS FOR THE OWNER: only the genuinely open choices, each with a recommended answer.`, { label: 'plan', phase: 'Plan' })

return { plan, noahPanel, noahMatrix, ourLadder, dataDesign, rulesMap, dataCheck, ladderCheck }
