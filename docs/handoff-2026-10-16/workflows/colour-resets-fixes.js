export const meta = {
  name: 'colour-resets-fixes',
  description: 'Fix the open review findings of the colour rule and the four resets, each built, checked and adversarially verified',
  phases: [
    { title: 'Build', detail: 'one unit at a time in the main tree: implement, a check that fails on the old code, commit (no push)' },
    { title: 'Verify', detail: 'an independent reviewer re-runs the checks and tries to break the unit' },
    { title: 'Fix', detail: 'confirmed findings fixed and committed' },
  ],
}

const ENV = `
ENVIRONMENT (read carefully, it is not the usual one):
- Repo /home/user/3abida, branch claude/trusting-planck-o77m11. Other units run before and after you in this SAME tree, one at a time; start by running \`git status --short\` (it should be clean) and \`git log --oneline -3\`.
- The Vite dev server for this tree runs on http://127.0.0.1:5180 and must stay up. Check it first: \`no_proxy=127.0.0.1,localhost NO_PROXY=127.0.0.1,localhost curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5180/terrain\` (200). If it is dead, restart it: list PIDs with \`pgrep -af "vite --port 5180"\`, kill ONLY those PIDs by number, then \`cd /home/user/3abida && NODE_USE_ENV_PROXY=1 nohup npx vite --port 5180 --host 127.0.0.1 > /tmp/claude-0/-home-user-3abida/3f13cba1-d81b-5e53-bbee-8bc889ed9a96/scratchpad/vite-wf.log 2>&1 &\`. NEVER use \`pkill -f\`. Never start a second dev server on this tree. A preview server on 5183 may be running; leave it.
- Every curl or Playwright run against 127.0.0.1 needs \`no_proxy=127.0.0.1,localhost NO_PROXY=127.0.0.1,localhost\`. Node scripts that reach the network need NODE_USE_ENV_PROXY=1. Playwright's Chromium is /opt/pw-browsers/chromium (the proof script finds it). Never run \`playwright install\`.
- Browser checks live in scripts/terrain-ui-proof.mjs: add a \`check('<area>: <what it guarantees>', async () => { ... })\` using the \`terrain(panes, { width, height, layout, at, railCut, cvd, theme, init, block })\` helper already there (read the file's top and two existing checks first; mirror their style). Run one with \`no_proxy=127.0.0.1,localhost NO_PROXY=127.0.0.1,localhost npm run -s terrain:check -- "--only=<a substring of its name>"\`. Pages other than Terrain can be checked the same way with your own small page setup inside a check.
- Unit proofs are scripts/*-proof.ts, run with \`NODE_USE_ENV_PROXY=1 npx tsx scripts/<name>-proof.ts\`; \`npm test\` runs the list in package.json (add a new proof there if you create one).
- Typecheck: \`npx tsc -p tsconfig.json --noEmit\` and \`npx tsc -p tsconfig.node.json --noEmit\`; words: \`npm run -s words:check\`.
- Temporary scripts go in scripts/_tmp/ (git-ignored). Screenshots you take for yourself go in /tmp/claude-0/-home-user-3abida/3f13cba1-d81b-5e53-bbee-8bc889ed9a96/scratchpad/wf/.
- .env holds API keys: never print it, stage it, copy it or put a key anywhere. No VITE_ keys.
- While a browser check of yours is running, do not edit src (the dev server reloads the page under it).
- EVERY NEW CHECK MUST FAIL ON THE OLD CODE: prove it by putting the old version of your src change back temporarily (copy your changed src files aside, \`git show HEAD:<path> > <path>\`, wait ~4 s for the dev server, run the check, then restore your files), and report what the old code printed. A check that passes on the old code does not count.
- COMMIT when done (never push): \`git add\` only the files you changed (never .env, .theta/, node_modules, .claude/settings.json, .feed-cache, scripts/_tmp), run \`git diff --cached --name-only\` to confirm, then write a message file and run \`GIT_AUTHOR_NAME=hotterthenheat GIT_AUTHOR_EMAIL=zakali6122@gmail.com GIT_COMMITTER_NAME=hotterthenheat GIT_COMMITTER_EMAIL=zakali6122@gmail.com git commit -q -F <file>\`. The message: a title line, then plain sentences on what changed and why, ending with exactly these two lines:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015XTNkHRGmjQJChtMRb5zEu
  No model name anywhere else. Leave the tree clean (\`git status --short\` empty apart from untracked scratch you did not create).
- Do not edit .claude/CLAUDE.md or docs/ — return a short docs note instead.
- The project rules in CLAUDE.md all apply: every colour a token (canvas inks through readToken/resolveInk), no word under 11 px (chart ticks 10), every figure through core/format, every printed time on the reader's clock in 12-hour form, house pieces (ui/layers useOverlay/useEscapeLayer, PopoverCard, undoable, .hit), the banned words (npm run words:check), "the UI is the owner's; the feed fills it" (keys in or out draw the same boxes).
- If something cannot be done, or a choice is genuinely the owner's, leave it unchanged and say so in \`held\` with one line on what the owner would lose or gain. Never fake a check or a number.
`

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    done: { type: 'boolean' },
    commits: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    checks: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, passesNow: { type: 'boolean' }, failsOnOld: { type: 'boolean' }, oldOutput: { type: 'string' } }, required: ['name', 'passesNow', 'failsOnOld', 'oldOutput'] } },
    held: { type: 'array', items: { type: 'string' } },
    docNote: { type: 'string' },
  },
  required: ['done', 'commits', 'summary', 'files', 'checks', 'held', 'docNote'],
}
const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['bug', 'rule', 'spec', 'nit'] }, what: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'what', 'evidence', 'fix'] } },
    notes: { type: 'string' },
  },
  required: ['pass', 'findings', 'notes'],
}

const UNITS = [
  {
    id: 'U1-dead-code', title: 'Approval 3: deletions and merges (dead code and exact duplicates only)',
    spec: `The owner approved (§6j item 3, docs/terrain-audit-2026-10-15/README.md §6i): "Deletions and merges (§6i): approved for dead code and for controls that exactly duplicate another control. For anything else I can see on screen, list it with one line on what I lose, and wait."
Read README §6i in full. Do:
- Every row under "Code with no reader or no effect": verify with grep and the typechecker that it truly has no reader before deleting; delete it. Keep: StrikeChart's own ReplayStrip props (another room uses them), the pop-out itself, and core/pine's barcolor path (another unit implements barcolor() now — leave every barcolor-related piece alone). The regime chip's dead title: remove the title. The under-lg Strikes door [data-narrow-ladder] only if its condition can truly never hold (prove it).
- Code-level merges that change nothing on screen: WINDOW_CHOICES (Terrain.tsx) with WINDOW_OPTS (PaneHead.tsx) into one list; REPLAY_PACES (Terrain.tsx) with REPLAY_SPEEDS (data/replayFrame.ts) into one list. Where their words differ, keep the words the reader sees today in each place unless they are the same control (say which you kept).
- Controls that EXACTLY duplicate another control (same effect, same place in the reading order): delete the duplicate. Do NOT touch: the Key levels switch, the two level-alert systems, the duplicate Pine scripts, "heaviest" — other units own them.
- Anything else in §6i that a user can see on screen (and is not an exact duplicate): do not change it; list it in \`held\` with one line on what the owner loses.
Check: a unit proof or a terrain:check that would catch the removed code coming back is not required for pure dead code; instead prove nothing on screen changed: run the existing terrain:check checks that cover the touched files (header, replay, window, ladder) and report them. For the merges add one check that the window list and the replay paces offered on screen are what they were (fails if a list loses or gains an entry).`,
  },
  {
    id: 'U2-pine-inks', title: 'Approvals 4, 5, 11: indicator inks off gold/violet, drop six duplicate Pine scripts, remove "The flip" red wash',
    spec: `Owner: "4. Indicator colours off gold/violet: approved. 5. Drop the six Pine scripts that duplicate built-ins: approved. 11. 'The flip' script's red wash: remove it. Red carries no meaning on Terrain."
From the audit (§6d, area D in docs/terrain-audit-2026-10-15/exercise/area-b.md): EMA 9, SMA 200, RSI, MACD, Moving average, EMA ribbon, Ichimoku, Keltner, RSI (Pine), MACD (Pine), Stochastic, ATR and Williams %R wear a hue within OKLab ΔE 0.15 of the field's gold (--absorb) or violet (--amplify); several share an ink with each other and with the compare lines (EMA 9 with the Pine averages, VWAP with the Pine VWAP, Donchian, MFI). The audit's measure is scripts/terrain-exercise/area-b.mjs fieldClash (OKLab).
Do:
- Give every built-in indicator (the Indicators menu: EMA 9/21/50, SMA 200, VWAP and VWAP bands, Bollinger, RSI, MACD, ATR) and every remaining shipped Pine script (src/data/builtinScripts.ts) its own ink: ΔE ≥ 0.15 (OKLab) from gold and violet on the dark and the paper ground, ≥ 0.08 from every other indicator/script ink and from every compare-line ink, ≥ 3:1 contrast on the paper tape (the indicators already have a light pair — keep that mechanism), and keep the colour-vision (blue-orange) behaviour. Keep the walls scripts in the walls' own inks (they name the walls) and the supreme in its magenta.
- Remove from the shipped library shelf the six Pine scripts that repeat a built-in: EMA ribbon, VWAP, Bollinger Bands, RSI, MACD, ATR. A reader who already put one on a pane must not lose it silently: find how an added shipped script is stored; if it is stored as source, it keeps working as the reader's own script; if it references the shelf by id, migrate it once (turn on the equivalent built-in or keep its source) and say which you did.
- "The flip" script: remove its red wash (the region painted under the flip); it keeps its flip line in the flip's own ink. Check no other shipped script paints a region red or green as a wash; report any (do not change direction inks of lines like Supertrend unless they are a wash).
Checks: a unit proof (extend an existing proof or add scripts/indicator-inks-proof.ts to npm test) that measures every built-in and shipped-script ink against gold and violet (both grounds), against each other and against the compare inks, and the paper contrast — fails on the old inks; a check that the shelf no longer lists the six and that "The flip" draws no fill/bgcolor.`,
  },
  {
    id: 'U3-barcolor', title: 'Approval 13: implement Pine barcolor()',
    spec: `Owner: "13. barcolor(): implement it." Today core/pine runs barcolor() but nothing draws it (README §6e, §6i: barcolors has no reader).
Do: a script's barcolor(color, offset, editable, show_last, title, display) colours the candles of its pane's price series for the bars it returns a colour on (body, wick and border, the house's candle edge rule kept), na leaves the bar its own colour; offset shifts as Pine does; several scripts: the last one drawn wins, as TradingView; turning the script off or removing it gives the candles back; works in replay (only bars up to the cursor); colour inks pass through the same path Pine's other colours use. Respect the candle themes (Neon/Market hollow bodies under colour vision keep their form). If the chart library cannot colour individual candles with the current series type, use the per-point color fields the library supports (lightweight-charts candlestick data points accept color, wickColor, borderColor).
Checks: scripts/pine-proof.ts gains barcolor cases (values per bar, na, offset); a terrain:check adds a script with \`barcolor(close > open ? color.blue : na)\` to a pane and reads the candle series' data for per-bar colours (fails on the old code).`,
  },
  {
    id: 'U4-readout', title: 'Approval 15: indicator values under the crosshair, in the readout',
    spec: `Owner: "15. Indicator values under the crosshair: add them to the readout." Today components/terrain/CrosshairReadout.tsx names only the price pane's single-line overlays (D-06…D-10 in the audit).
Do: with the pointer on a bar the readout also prints, at that bar, every built-in indicator's values (VWAP and its bands' upper/lower, Bollinger basis/upper/lower, EMA/SMA, RSI, MACD line/signal/histogram, ATR) and every Pine script's plotted series by its plot title, each with its ink as a small swatch and its value through core/format (prices to the cent; oscillators to one or two decimals as the house prints them). Group by pane in reading order. It must never cover the plot's chrome (it already clears the hover row) and must never cut a word: on a narrow pane wrap by series and cap its height, or shorten to values only with the names in a title — never off the pane. Off the plot (no hover) it shows nothing, as today. In replay it reads the cut tape only.
Check: a terrain:check that turns on RSI, MACD and Bollinger plus one Pine script, hovers a bar, and compares each printed value with the series' own data at that time (fails on the old code), at 1440 and in a 4-pane desk at 1280 (no text past the pane's box).`,
  },
  {
    id: 'U5-key-levels', title: 'Approval 6: the Key levels switch shows and hides the level lines and their chips',
    spec: `Owner: "6. 'Key levels' switch: make it show/hide the level lines and their chips. If another control already does exactly that, delete the switch." Today Layers → "Key levels" (ChartToolbar.tsx overlay key 'levels', hint "Call & put walls, flip and supreme, marked on the field") changes no pixel (B-41): gexNodesPrimitive's setWalls/setSupreme fields are unread, StrikeChart LINE_LEVELS = [].
First establish whether any other control already shows/hides exactly the level lines (the wall lines drawn per column, the flip's dashed rule) and their chips (the axis chips CW/PW/Flip/Sup/Top and the in-plot wall-move chips / pills that name a level). If one does exactly that, delete the Key levels switch (and its stored config key, migrated). Otherwise make the switch do it: off hides the wall lines, the flip rule, the axis chips and the level chips on the plot (the ovals stay; the ladder stays); on (the default as today) shows them. Persist per pane like the other overlays; the hint says what it does in plain words.
Check: a terrain:check toggles it and measures the plot's level pixels and the axis chips' DOM (fails on the old code: nothing changed).`,
  },
  {
    id: 'U6-heaviest', title: 'Approval 8: one meaning of "heaviest" — the oval\'s size measure at the minute viewed',
    spec: `Owner: "8. 'Heaviest' = largest by the oval's size measure (total gamma at the strike) at the minute being viewed, everywhere, same as 'Top'." The audit (§6i) found three definitions on one screen: by gross (the Top axis chip, the pills — beadScale largestNodeOf), by |net| (the bead card's rank "#n", the right-click level menu's top-3 candidates, the level alerts' top-3 identity), raw walls (level card, day panel).
Do: one function for "the N heaviest strikes at a column" (by GexLevel.gross, falling back to |net| only where a tape carries no gross, as the legend already says), used by every surface that names "heaviest", "top", a rank or "the three heaviest": the axis Top chip, the pills, the header's Nearest Top, the bead card's rank, the right-click menu's top-3, the level card, the day panel's strikes, the How sure text, the tiered level alerts' top-3 watch (data/levelAlerts.ts) and the session recap's list. "At the minute being viewed": the newest column live, the replay cursor's column in a replay, the day's last column in the day panel. The server's scorecard "three heaviest strikes" (server/scorecard.ts, data/feed/trackRecord.ts): switch it to the same measure, bump the scorecard config version (server/scorecard.config.json) so the nightly run recomputes, and say in the docs note that the track record's heaviest-strike numbers will change on the next run.
Checks: a unit proof that the shared function ranks by gross (and the fallback); a terrain:check that the Top chip, the first pill, the bead card's rank 1 and the right-click top-3 all name the same strike at the same minute (fails on the old code where they differ — find a minute where gross and |net| disagree on this machine's data, or construct one with a fixture).`,
  },
  {
    id: 'U7-ladder-source', title: 'Approval 1: the ladder shows the chart\'s number for the minute viewed, Unusual Whales\' figure beside it, labelled',
    spec: `Owner: "1. Ladder vs chart: approved. The ladder shows the chart's number for the minute being viewed, with UW's figure beside it, labelled." Background: README §6c — on the feed the ladder (components/gex/ProfilePanel.tsx, fed by Terrain's rail rows from UW's book) and the chart's ovals (the modeled field column) differ by −12% to +44% at one strike; the recommendation was that the ladder reads the field's column at the minute the chart shows (the newest live, the replay cursor's in a replay) with UW's figure beside it as the measured reference.
Do:
- On the feed, for gamma (the field's greek), the ladder's Net view figure per strike is the field column's net at the minute viewed (newest column live; the cursor's column in a replay; when the field has no column yet, the ladder says so in its head and shows UW's book labelled as UW's, never a silent swap). The Sides view's puts and calls per strike come from the same column: in the house's sign puts amplify (positive) and calls absorb (negative), so with net and gross per strike puts = (net + gross)/2 and calls = (net − gross)/2 — verify the sign convention in data/feed/trailModel.ts before using it; where a column carries no gross, Sides shows UW's split labelled.
- UW's figure for the same strike and window (the 60-day book by strike — levels.ts FeedBook60 / the books60 reads; never the every-expiry book) stands beside it, labelled "UW" (or "Unusual Whales") with its time: in the read line under the ladder, in the ladder's hover card, and in the bead card; the ladder's head says what the bars are ("Modeled · <minute on the reader's clock>"). Choose a placement that never cuts a word at 240 px (thin ladder) and say what you chose.
- Greeks the field does not model (delta, vega, charm, vanna lanes and "What a move forces" if it reads UW's delta): they stay UW's book, and the head says so.
- On the house's tape (no feed) the ladder and the chart must also agree for the same strike and minute: check whether they already do and make them if not.
- The scale: the ladder's spine, ghost dots, walls/flip marks and the σ column keep working from the new numbers.
Checks: a terrain:check that, on SPY 1m and 5m on the feed, reads the ladder's figure for ten strikes round the price and the chart's newest field column (window.__charts entry's trails snapshots) and finds them equal within 0.5% (fails on the old code: 0/10 within 1%), and that UW's labelled figure is present for the hovered strike; the same in a replay at a cursor minute. Re-run the existing ladder/colour-vision/Net-view checks.`,
  },
  {
    id: 'U8-one-alert-system', title: 'Approval 7: one level-alert system',
    spec: `Owner: "7. One level-alert system: approved." The recommendation (§6i, §6j item 7): one system — the tiered level watches (data/levelAlerts.ts, LevelAlertWatcher, the drawer's Levels shelf, set by Terrain's right-click LevelAlertMenu) — with the toolbar's level chips (ChartToolbar → AlertsMenu: Call wall, Put wall, Flip, Wall ±2/±4 …, stored in gex/alertStore) arming a watch instead of their own alert.
Do: read both systems fully. Make every level-based alert in the toolbar's Alerts menu arm/disarm the tiered watch for that level identity (call wall, put wall, flip, top 3, ±σ), so there is one list (the drawer's Levels shelf), one log and one cooldown rule for a level. Price alerts, line (drawing) alerts and "all" (combined) alerts in gex/alertStore are not level alerts — keep them. Migrate once: any stored alertStore alert of the level kind becomes the equivalent watch (keep the reader's flip confirmation choice where present); one with no tiered equivalent (e.g. "Wall ±2/±4" if it means something the tiers do not cover) is kept working as before and listed in \`held\` with one line on what the owner would lose by removing it. The alerts-proof and level-alerts-proof must still pass; extend them.
Checks: alerts-proof/level-alerts-proof cases for the migration; a terrain:check that arming "Flip" from the toolbar's Alerts menu creates the tiered watch (visible in the drawer's Levels shelf and the right-click card offers Stop), and no alertStore level alert is created (fails on the old code).`,
  },
  {
    id: 'U9-session-chip', title: 'Approval 9: the session chip names the instrument\'s own session',
    spec: `Owner: "9. Session chip: no futures names on a stock or options chart. Name the session of the instrument shown (SPX: 'Overnight · Cboe GTH', 'Curb'; SPY/QQQ: 'Pre-market', 'After hours'), or hide it." Today Terrain's desk bar chip prints core/calendar FUTURES_PHASE_WORDS[futuresPhaseAt(now)] ("GLOBEX · EUROPE"), is not focusable, and its title points to the Session phases overlay (audit A-226).
Do: the chip names the session of the ACTIVE pane's instrument, from core/sessions.ts (one schedule): SPX (and its weekly root) — "Overnight · Cboe GTH" (8:15 pm–9:25 am New York, none into a weekend or holiday), "Curb" (4:15–5:00 pm), regular hours; equities and ETFs (SPY, QQQ, any stock) — "Pre-market" (4:00–9:30 am New York), "After hours" (4:00–8:00 pm); a weekend or holiday or outside every session — "Closed". During regular hours hide the chip (the header's Live already says it) unless you find a reason not to — say which. Times in its title on the reader's clock, 12-hour (core/nyTime). It becomes focusable with its title readable by the keys (a house tooltip or a title on a focusable element), follows the active pane when it changes, sentence case. No futures words anywhere on Terrain.
Checks: a unit proof for the session naming at fixed instants (SPX 9:00 pm, 4:30 pm; SPY 8:00 am, 5:00 pm; a Saturday; a holiday); a terrain:check with the page clock held (terrain() \`at\`) that reads the chip for SPX and SPY at those instants and finds no futures words (fails on the old code).`,
  },
  {
    id: 'U10-toasts', title: 'Approval 10: toasts never cover controls',
    spec: `Owner: "10. Toasts: never cover controls; move them where they cover nothing." Today the toasts (components/alerts/AlertToasts.tsx — the session recap toasts, alert toasts; and the undo chips from components/ui/undo.tsx) stand at the top right over Terrain's ladder head (Net/Sides tabs, the Expiry card) and, in full screen, over Overlays, Theme and Collapse; on the phone over the ladder head.
Do: find a place for the toast stack (and the undo chips) that covers no interactive element on any terminal page at 1440×900, 1280×720, 1920×1080, 768×1024 and 390×844, with Terrain at 1–4 panes and a pane expanded (F), and on Pulse, Trace, Pinpoint, Paper and the Journal — measured, not assumed. If no fixed place covers nothing everywhere, give the toasts their own reserved lane (e.g. the shell's own space) rather than floating over a page; say what you chose and why. Keep them readable (11 px floor, contrast), keep their dismiss/undo doors working by mouse and keys, keep reduced-motion behaviour.
Check: a terrain:check that raises a toast (a recap toast or an undoable action) on Terrain at 1440×900 (1 pane and F) and 390×844 and on two other rooms, then tests a grid of points over each toast's box with elementsFromPoint: no button, link, input, tab or [role=button] beneath any toast (fails on the old code).`,
  },
  {
    id: 'U11-drawings-per-ticker', title: 'Approval 12: drawings kept per ticker, whatever the data source',
    spec: `Owner: "12. Drawings: keep them per ticker, whatever the data source." Today a line drawn on SPY with the feed's keys in does not appear on SPY's house tape and back (§6j item 12): the store key splits by tape (components/gex/drawingsPrimitive.ts storageKey and whoever passes the ticker/tape key; find where the split happens).
Do: one drawings store per ticker (and whatever else the store rightly keys on, e.g. never per timeframe if it is not today), the same whether the pane reads the feed or the house's tape. Migrate once: merge existing split keys for a ticker into the ticker's key, de-duplicated by drawing id, keeping alerts attached to drawings working (gex/alertStore 'line' alerts reference drawing ids; saveDrawings moves an alert with its drawing). Pop-out windows read the same store.
Checks: a terrain:check that draws a line on SPY on the feed tape, then switches the pane to the house's tape (find how a reader does that, or block the feed routes with the helper's \`block\` option on a second load) and finds the same drawing (fails on the old code); a unit check of the migration (two old keys → one, ids kept, no duplicates).`,
  },
  {
    id: 'U12-popout-keys', title: 'Approval 14: keys work in the Terrain pop-out window',
    spec: `Owner: "14. Keys in the pop-out window: make them work." Today /out/terrain (src/pages/popout/TerrainPopOut.tsx inside PopOutFrame) gets none of the desk's keys (no AppShell key handler outside the shell); 9115af0 removed its "?" door because nothing worked.
Do: the pane's own keys work in the pop-out exactly as on the desk for one pane: P (replay), Shift ↓ / Shift → in a replay, Esc, R (ladder/rail as on the desk), T (calendar), W (expiry window), L (legend), timeframe keys and − / =, the chart's own keys (Alt+R reset), and "?" opens the key sheet listing exactly the keys that work there (components/layout/keys.ts is the one list — add a pop-out scope rather than a second list). Keys never fire while typing in an input. Desk-only keys (1–4 pane count, [ ] walk panes, g-room jumps, the command line) do not apply in a pop-out — they are not listed there.
Checks: a terrain:check that opens /out/terrain (find how the desk opens it and its URL/params) and drives P, T, L, W and ? by the keyboard, asserting each visible effect, and that "?" lists only keys that work (fails on the old code).`,
  },
  {
    id: 'U13-replay-any-day', title: 'Approval 16: replay any day, loading its minutes on demand',
    spec: `Owner: "16. Replay any day: approved; load the day's minutes on demand." Today the day panel's "Replay this day" (Terrain.tsx dayPanel, onReplayDay; useTerrainReplay holdsOpen) is enabled only where the chart already holds the day's minutes (Oct 14 and Oct 12 of nine days probed) and disabled with a reason otherwise (audit A-168).
Do: for any session on the tape (any day bar on 1D, any day in the T calendar / Go-to / random start), "Replay this day" fetches that day's minute bars and its field columns on demand — the tiles hold them (data/feed/tileClient.ts, GET /feed/field/<NAME>/tiles?tf=1m&w=…&from=D&to=D; read server/fieldTiles.ts for the shape), and the house's tape for the house — adds them to what the replay reads (useTerrainReplay's bars/cols), then starts the replay at 9:30 am New York that day on 5m. While loading: the button says it is loading (no frozen click), Esc cancels. Where the server truly has nothing for the day (no tiles, no minutes), the button says why and stays disabled — measured, not assumed. A replay never reads past its cursor (the existing replay-cursor proof must still pass).
Checks: a terrain:check that opens the day panel on a day the chart does not hold (5–9 sessions back on this machine), presses Replay this day, and finds the replay badge on that day at 9:30 am New York (6:30 am on the check's Los Angeles clock) on 5m with candles and field columns at the cursor (fails on the old code: disabled).`,
  },
  {
    id: 'U14-lane-names', title: 'Approval 17: lane names on narrow ladders',
    spec: `Owner: "17. Lane names on narrow ladders: approved." The proposal (§6j item 17): today the ladder's lane names (ProfilePanel.tsx data-lane-head, laneNames = panelW >= 640) stand only from a 640 px ladder; below it the column heads name the lanes and the definitions are only in How to read, so the lane's own tooltip (Term) is missing. Approved: a second head row for the names when the first is full.
Do: at every ladder width (240 thin, 340, 520, the reader's dragged widths, the phone's overlay 308) the lane names with their Term tooltips stand whole: in the first row where they fit, else in a second head row (the existing two-row head mechanism twoRowHead/HEAD_TOP_2 may already exist — reuse it), never cut, never 0 px, reachable by keys (Term focusable). The chart's fit must account for the taller head (ProfilePanel's data-plot-inset feeds StrikeChart applyFitMargins) so no strike row hides under it.
Checks: a terrain:check at 1, 2, 3 and 4 panes and the phone overlay that measures each [data-lane-head] (width ≥ its text's scrollWidth, ≥ 40 px), opens its tooltip by focus, and checks no ladder row's figure stands under the head (fails on the old code: no names under 640 px).`,
  },
  {
    id: 'U15-autoscale-trace-compass', title: 'Owner\'s addendum: Trace Net Flow pane and Compass campaign chart axis follows the data in view',
    spec: `Owner: "Also: Trace's Net Flow pane and Compass's campaign chart have the same autoscale freeze. Fix them the same way (the axis follows the candles in view; dragging the price axis turns that off)." On Terrain this was fixed in StrikeChart (2026-10-15): a pan or a wheel never switches autoscale off; only a drag on the price axis does (the library's own rule), kept through the ticks until a double-click, the Reset pill or a new world; terrain-ui-proof's first check "axis: a pan and a wheel keep the candles in view; an axis drag is the reader's" proves it.
Do: find the charts — src/components/trace/NetFlowPane.tsx and src/components/compass/CampaignAnalysis.tsx (each may build its own lightweight-charts chart or use StrikeChart; check) — reproduce the freeze first (pan back and see the data leave the axis), then apply the same rule, ideally through the same shared code StrikeChart uses rather than a copy. A double-click (or the chart's reset) gives autoscale back.
Checks: two browser checks in the style of the axis check (they can live in terrain-ui-proof.mjs with their own page setup for /trace/… and /compass/… — find the routes): drag back, wheel, the data in view stays inside the axis; an axis drag holds; a double-click restores (each fails on the old code).`,
  },
  {
    id: 'U16-type-scale-dom', title: 'Approval 2 (part 1): the spacing and type scale — tokens and Terrain\'s DOM',
    spec: `Owner: "2. Spacing and type scale: approved as proposed, including sentence case and 9 px → 11 px." The proposal is docs/terrain-audit-2026-10-15/README.md §6f — read it whole. Part 1 (this unit): the tokens and every DOM element Terrain draws; part 2 (the next unit) does the canvas words and the ladder.
Do:
- Tokens in src/theme/tokens.css and names in tailwind.config.ts: --fs-tick 10/12 (chart ticks only), --fs-label 11/16, --fs-body 12/16, --fs-strong 13/20, --fs-head 15/20, --fs-display 20/24 (text-tick, text-label, text-body, text-strong, text-head, text-display, each setting size and line height).
- Sweep Terrain.tsx, components/terrain/*, PaneHead, DecisionStrip, CrosshairReadout, ProfilePanel's DOM parts, ChartToolbar and the DOM parts of StrikeChart Terrain shows (axis chips, cards, menus, legend, foot row, day panel, replay strip): every font size onto the six tokens (nothing under 11 px), weights 400/500/600 only (700 → 600), sentence case with no letter-spacing (no uppercase/tracking classes), spacing on the 4 px grid (0, 4, 8, 12, 16, 24, 32; 2 px only inside a control under 20 px; 1 px hairlines), control heights 16/20/24/32 whole pixels (a coarse pointer keeps its .hit box), icons 12 in a row and 16 in a menu or a 32 px button.
- Shared components (ChartToolbar, StrikeChart DOM) are also drawn by other rooms (Pulse, Paper, the Backtest, the Weigher, Four charts): their look will change there too — check each of those pages still lays out (no overlap, no cut text) and report what changed visibly.
- Before/after screenshots of Terrain (1 pane and 4 panes at 1440×900, the phone 390×844, dark and paper) into docs/terrain-audit-2026-10-15/scale/ (before-*.png taken BEFORE you change anything, after-*.png at the end, same sizes), committed with the change.
Checks: a terrain:check that scans every visible element in Terrain's panes (1 pane and 4 panes) and asserts: computed font-size ∈ {10 only inside the chart's tick areas, 11, 12, 13, 15, 20}, font-weight ∈ {400, 500, 600}, text-transform none and letter-spacing normal/0, and no height/padding/gap in the off-grid list (fails on the old code: 13 sizes, 30 tracked-capital sites). Re-run the header, legend, layouts, phone and hover-row checks.`,
  },
  {
    id: 'U17-type-scale-canvas', title: 'Approval 2 (part 2): canvas words and the ladder to the scale (9 px → 11 px)',
    spec: `Owner: "2. … including sentence case and 9 px → 11 px." Part 2: every word Terrain draws on a canvas — the ladder (ProfilePanel's canvas: column heads like "Δ SPOT · σ", strike labels, figures, the σ column, VPOC, lane heads drawn on canvas), gexNodesPrimitive (pills, wall chips, gap notes), expectedMovePrimitive (σ labels, the readout, the EM tag), sessionPhasesPrimitive, the regime/flow/vol drift panes' words, the chart library's own labels Terrain configures (crosshair labels, the price/time axis: ticks may stay 10 px as the house allows), the PNG export header.
Do: every canvas word ≥ 11 px CSS (ticks 10), sentence case, weights 400/500/600, from the --fs-* tokens read through readToken where the canvas reads tokens. The ladder: its 9 px figures go to 11; on the thin ladder (3–4 panes) a row prints its figure only where the row pitch holds it (~20 px), and the hover card carries the figure below that (the proposal's rule) — never overlapping text. Keep crispness at DPR 1, 1.5 and 2 (font sizes multiplied by the bitmap ratio as the code already does).
Checks: a terrain:check that records every fillText on Terrain's canvases (the existing recordCanvasWords/cssPx helpers in terrain-ui-proof.mjs) at 1 and 4 panes and asserts every word ≥ 11 px CSS except axis ticks at 10, and that no two words' boxes on the ladder overlap (fails on the old code: 20 ladder words at 9 px). Before/after crops of the ladder at 520, 340 and 240 px into docs/terrain-audit-2026-10-15/scale/.`,
  },
]

/* THE OWNER'S FOLLOW-UPS (2026-10-15, after the status): the colour rule and the four resets, ahead of the rest */
UNITS.push({
  id: 'U18-colour-rule', title: 'The owner\'s colour rule under every Colours option (amends approvals 4, 5, 11)',
  spec: `The owner (2026-10-15, after approvals 4, 5 and 11 landed — commits 03ca5ad, dbbdfab, 59d97da; read them first):
"Colours, one rule under every Colours option:
- Only the ovals use their two colours (gold/violet, or the colour-vision pair).
- Anything meaning up/down uses the candles' up and down colours.
- Everything else uses the indicator palette, kept clear of the ovals' colours.
Applying it:
- Ichimoku: keep the cloud, as a faint fill in the candles' up and down colours. No red or green.
- Compare lines and Pine plots with no colour set: indicator palette, no blue near the violet.
- Shipped scripts (Supertrend and the rest): up/down inks use the candles' colours, so they follow every Colours option. A user's own script keeps the colours its code sets.
- Check that candles, indicator inks and the two oval colours stay distinct under every Colours option, including colour-vision simulations. If the candles' blue clashes with the oval blue under blue–orange, propose a fix and wait."
WHAT "EVERY COLOURS OPTION" MEANS HERE (read the code to confirm and say if it differs): every candle theme (components/gex/candleTheme.ts CANDLE_THEME_OPTIONS — Glacier, Foil, Chrome, Velvet, Mono, Neon, Market, Tide, Harbor, Whipsaw, Contrast, Wire, Stone; each has its own up/down inks and ground), the rails' Colours for the ovals (House, Thermal — TerrainCfg rails), the page theme (dark, paper), and the reader's colour vision (data-cvd: none, blue-orange, high-contrast — theme/tokens.css, themeFor(key, vision)).
DO:
- One source for "the candles' up and down colours" for a chart (the theme the pane draws with, after colour vision) and every up/down ink on Terrain's chart reads it: the built-in indicators' direction parts (e.g. MACD histogram up/down, Ichimoku's cloud and its direction lines, any indicator with a bull/bear part), the shipped Pine scripts' direction inks (Supertrend, SAR and the rest — the script layer maps the shipped scripts' house direction inks to the chart's candle up/down; on a dark tape too: the last review found it mapped nothing there, so they drew the house green and red under blue-orange), and anything else on the chart that means up/down. A user's own script keeps exactly the colours its code sets (no mapping), and a placed shipped script the reader edited is the reader's own.
- Ichimoku's cloud: a faint fill in the candles' up and down colours (keep a low alpha comparable to today's), never a fixed red/green.
- Compare lines (Terrain/LiveChartWidget COMPARE_INKS) and a Pine plot with no colour set (core/pine DYNAMIC_INK '#5B9CF6' and wherever the default plot ink is chosen): from the indicator palette, with no ink near the ovals' violet (or gold) — use the same distance rule the indicator-inks proof already applies (read scripts/indicator-inks-proof.ts), under every colour-vision mode.
- Nothing but the ovals (and the ovals' own legend swatches, the ladder bars and the regime strip that the orbs rule already ties to them) wears the ovals' two colours.
- Every colour a token or read through the existing ink helpers (house rule: canvas inks through readToken/resolveInk; no new hex outside the palette modules already holding them).
CHECKS:
- Extend scripts/indicator-inks-proof.ts (in npm test): for EVERY candle theme × page theme × colour-vision mode (and the rails' Colours where the ovals' inks change), compute in OKLab the distances between (a) the candle up and down inks, (b) every indicator/compare/default-plot ink as drawn on that ground, (c) the two oval inks — also under protan, deutan and tritan simulation (scripts/orbs-proof.ts has the simulation; reuse it, do not copy it if it can be imported) — and assert: no indicator ink within the floor of either oval ink; every shipped script's and built-in's up/down part equals the theme's candle up/down; the Ichimoku cloud's two fills are the candle inks at its alpha. Print a compact table of the closest pairs per option. Where candles and oval inks fall under the floor (e.g. a blue-up theme against a blue/violet oval under blue-orange), DO NOT change the oval pair or the candle themes: put it in held as a proposal with the measured distances and one alternative, per the owner's "propose a fix and wait".
- A terrain:check: Market theme vs Glacier vs blue-orange — Supertrend (a shipped script) and MACD's histogram draw their up/down in each theme's candle inks (read the drawn pixels or the series options the chart was given), and a user's own script keeps its coded colour (fails on the old code).
- Re-run the existing inks checks (terrain:check --only=inks, --only=indicators, --only=scripts, --only='colour vision').
Report in held anything the rule leaves open (e.g. how a theme whose up and down are both blue-ish stays legible).`,
})
UNITS.push({
  id: 'U19-resets', title: 'Approval 3 follow-up: all four resets land on the identical view',
  spec: `The owner (2026-10-15): "Approval 3: keep all five items, as you advised. All four resets must land on the identical view." The four: the chart's Reset pill (components/gex/ResetViewControl.tsx), a double-click on the plot (StrikeChart wrapper onDoubleClick → resetView), Alt+R (the chart's key), and the right-click card's Reset (ResetViewControl's menu). Keep all four (and the other four items the owner kept: Back to live and the header's Today, the header's expiry chips and the rail's Expiry card, the Strikes button and R, "Exposure by strike").
DO: measure first — on Terrain (1 pane and 4 panes, 1m and 5m and 1D, after a pan back, a wheel zoom and a drag of the price axis, and in a replay), perform each reset and record what view it lands on: the visible logical range and time range, the price scale's range and autoscale state, the right offset, the bar spacing, and anything else the reset touches (the fit margins, a pinned strike, the crosshair, the Back to live state, the readout). If any of the four differs from the others in any of these, make them one code path (one function every entry calls) so they land on the identical view; if a difference is intended by the code (e.g. one of them also clears a pin), make all four do the same thing. Say in the docNote exactly what "the reset view" is.
CHECK: a terrain:check that, from the same disturbed state (pan back, zoom, price-axis drag), runs each of the four resets in turn (re-disturbing in between) and asserts the four resulting views are equal field by field (fails on the old code where they differ; if they were already identical on the old code, say so with the measured numbers — then the check stands as a guard and the unit makes no src change).`,
})
const byId = id => UNITS.find(u => u.id === id)
const J = s => JSON.stringify(s, null, 1)
const RUN = [
  {
    id: 'F18-colour-rule-open',
    title: "The colour rule's open review findings (drawing tools on the candles' up/down, indicator inks against the candles under colour-vision simulation, unedited copies, the proof's Ichimoku count, the walls held for the owner)",
    spec: `The owner's colour rule was built in d968aa2, 8367930 and 20d4204 (read all three). Its third review ended with these findings still open. The rule's own spec, in full, is under ORIGINAL SPEC at the end.

FINDINGS TO RESOLVE (from the third review, verbatim in substance):
1. [spec] The drawing tools still hard-code the house green and red: Long and Short position (target and stop zones, lines, labels), Price range (fill, label), Measure (band, headline) and the Arrow up / Arrow down stamps — src/components/gex/drawingKinds.ts:47-48 (UP/DOWN), :341-357, :375, :562; drawingsPrimitive.ts:327, :391. Under the rule anything that means up/down on the chart reads the candles' up and down (candleDirInks), so they follow every candle theme and colour vision. Fix: give the drawings primitive the chart's candleDirInks(theme) (e.g. setDirInks(up, down) beside setBars and on a theme or vision change); draw UP/DOWN and the Measure band from it; a drawing's own colour the reader set wins. Extend proof 9d to drawingKinds.ts and drawingsPrimitive.ts; add a terrain:check that seeds a Long position under Market with blue-orange and reads its zone pixels (the target in the candles' up, the stop in their down).
2. [spec] Indicator inks are never checked against the candles under the colour-vision simulations, though the owner asked: "Check that candles, indicator inks and the two oval colours stay distinct under every Colours option, including colour-vision simulations". Measured (scripts/colour-sim.ts distanceUnder): 169 of 6,448 ink–candle pairs fall under 0.05 once simulated — e.g. Bollinger #D394FE 0.004 from Neon/Market's blue-orange up candle #50A4FF under protanopia; IV #0DDBF5 (this unit's own pick) 0.005 from Glacier's up #93C9F2 under deuteranopia; MACD signal #D37C18 0.009 from Market's down #FF3B30 under deuteranopia (drawn over the MACD's down bars); EMA 50 0.003 from Mono's up under protanopia; hue gaps under blue-orange: EMA 21 #85B9FE 3° from the up #50A4FF, MACD signal 10° from the down #FF8526. Do: add the three simulations (protan, deutan, tritan) to proof 9i and to the per-option table; assert a floor of 0.05 (OKLab, after simulation) for every indicator, shipped-script, compare and default-plot ink against each option's two candle inks, and re-measure the 30° hue rule against each option's own candle pair. MOVE THE INDICATOR INKS (the family palette is the house's own and may move) until every pair clears, while keeping every floor the unit already asserts (0.15 from the ovals as drawn / 0.08 under simulation, 3:1 on its ground, the family's mutual separation, no red or green read). Where a pair CANNOT clear because of a candle theme's own inks — the themes the owner is deciding on now: Contrast (violet down), Tide and Harbor (blue down), Wire (white both), Glacier (faint down), Velvet (violet down), Stone (blue up), Whipsaw (violet) — do NOT change the candle theme (the owner has not answered); list each remaining clash in the proof's "HELD FOR THE OWNER" list naming the candle-theme decision it waits on, and in \`held\`. Report the before/after count of pairs under the floor.
3. [bug] builtinScripts inksBy classes an unedited copy as the reader's own when the house has since moved one of its inks (a Keltner copy with #7D7D74, an MFI copy with #447CAE draw at 2.21:1 and 2.35:1 on Stone). Fix: shelf 'mine' with forkedFrom a built-in id and version 1 is 'shipped' (mirroring keptAsWritten's version-1 rule); extend FORMER_DARK with script:keltner #7D7D74 and script:mfi #447CAE and apply it on the shipped path; add a 4⁗-style case for a pre-move copy.
4. [nit] Proof 9b skips Ichimoku's spans (the alpha < 0.6 filter runs before the BULL/BEAR test): test BULL/BEAR first so 9b counts them (8 parts an option).
5. [spec, the owner's call] The walls (shipped Walls / Distance to the walls / Wall approach scripts, the chart's wall chips and axis labels) wear the ovals' gold/violet. This is already before the owner as decision 7 ("walls keep gold/violet"). Make NO code change; add it to the proof's owner list with one line each way (keep: one meaning, the orbs rule; move: under "only the ovals" the distance and approach plots, and maybe the wall lines, take family inks).

ORIGINAL SPEC:
${byId('U18-colour-rule').spec}`,
  },
  {
    id: 'F19-resets-open',
    title: "The four resets' open review findings (the Backtest desk's pill under the replay strip; the canvas keep-out following the pill)",
    spec: `The owner: "All four resets must land on the identical view." Built in caebf7e, a2ea3e9 and 8f47e93 (read them). The third review found:
1. [bug] On the Backtest desk (/practice/backtest, "Start the session", 1440×900) the Reset pill sits under the replay clock strip and cannot be pressed: the pill [x 577, y 633, w 71, h 24], the strip's card [317, 577, 580, 78]; elementFromPoint at the pill's centre is the strip's SPAN; a Playwright click on [data-reset-pill] times out. The pill's box already carries --pane-foot-top (DeskShell mounts PaneFoot through \`layer\`, DeskShell.tsx ~802/872), but the pill only takes FOOT_PILL when \`footBar || (replay && !external)\` (StrikeChart.tsx, the ResetViewControl line). Fix: place the pill with FOOT_PILL whenever a PaneFoot in its own box writes --pane-foot-top (e.g. PaneFoot marks the box with a data attribute and the pill keys off it), and handle the split desk's single strip across both charts (DeskShell ~897), mounted outside both boxes. Add Backtest-desk cases (single and split) to the reset check: the pill is the top element at its centre and corners and pressable, and the four doors give equal views. Also check Paper's desk and the Weigher if they mount a foot strip the same way.
2. [nit] The canvas keep-out box for the Reset pill (gexNodesPrimitive.ts ~457-459, ~852-859: t = paneHCss - 30 - footKeep, b = paneHCss - 2 - footKeep) was not moved with the pill: in a replay the pill stands above the strip (FOOT_PILL), about 78 px above the box the words avoid. Hand the primitive the pill's measured top (or the foot's top) so its keep-out follows the pill; a check that a gap note or node pill near the pill's place does not overlap it in a replay.

ORIGINAL SPEC:
${byId('U19-resets').spec}`,
  },
]
const results = []
for (const u of RUN) {
  phase('Build')
  const built = await agent(
    `You are fixing open review findings on approved work in the Slayer terminal. ${u.title}.\n\nSPEC:\n${u.spec}\n${ENV}\nWork it through: read the code and the commits first, reproduce each finding, implement, typecheck, write the check(s) and prove each fails on the old code, run the related existing checks, commit (do not push). Return the structured result.`,
    { label: `build:${u.id}`, phase: 'Build', schema: BUILD_SCHEMA }
  )
  let verdict = null
  let fixes = []
  if (built && built.commits && built.commits.length) {
    for (let round = 0; round < 3; round++) {
      phase('Verify')
      verdict = await agent(
        `You are an independent, adversarial reviewer. A unit of work was just committed to /home/user/3abida (branch claude/trusting-planck-o77m11) for: ${u.title}.\n\nTHE SPEC IT HAD TO MEET:\n${u.spec}\n\nTHE BUILDER SAYS: ${JSON.stringify(built).slice(0, 6000)}\n${fixes.length ? `FIX ROUNDS SO FAR: ${JSON.stringify(fixes).slice(0, 4000)}\n` : ''}${ENV}\nYOU DO NOT EDIT ANY FILE (read-only review; temporary scripts in scripts/_tmp/ are fine, delete them after). Do: read the commits (\`git log --oneline -6\`, \`git show <hash>\`), read the code they touch, re-run every check the builder named and confirm it passes; for each new check confirm it would fail on the old code (put the old files back temporarily with \`git show <hash>~1:<path> > <path>\`, run, restore with \`git checkout -- <path>\` — leave the tree exactly as you found it). Then try to break the change: other states (replay, the phone 390×844, paper theme, 4 panes, the house tape with the feed routes blocked, a pop-out, reduced motion), edge cases, and the project rules (tokens, 11 px floor, core/format, the reader's 12-hour clock, house components, words:check, "keys in or out draw the same boxes"). Also check every finding in the spec was resolved or honestly held. Report findings with severity: bug, rule, spec, nit. pass = no bug/rule/spec findings. Evidence must be something you ran or read.`,
        { label: `verify:${u.id}:${round}`, phase: 'Verify', schema: VERIFY_SCHEMA }
      )
      const real = (verdict?.findings ?? []).filter(f => f.severity !== 'nit')
      if (!verdict || verdict.pass || real.length === 0) break
      if (round === 2) break
      phase('Fix')
      const fixed = await agent(
        `You are fixing confirmed review findings on a just-committed unit of work in /home/user/3abida: ${u.title}.\n\nTHE SPEC:\n${u.spec}\n\nTHE FINDINGS TO FIX:\n${JSON.stringify(real, null, 1).slice(0, 8000)}\n${ENV}\nFor each finding: reproduce it, fix it, add or extend a check that fails on the old code where the finding is behavioural, re-run the unit's checks, commit (do not push). If a finding is wrong, say why with evidence instead of changing code. Return the structured result (put findings you rejected, with the reason, in held).`,
        { label: `fix:${u.id}:${round}`, phase: 'Fix', schema: BUILD_SCHEMA }
      )
      fixes.push(fixed)
    }
  }
  results.push({ id: u.id, title: u.title, built, verdict, fixes })
  log(`${u.id}: ${built ? (built.done ? 'built' : 'partly built') : 'no result'}; verify ${verdict ? (verdict.pass ? 'pass' : `${(verdict.findings || []).length} findings`) : 'n/a'}; fix rounds ${fixes.length}`)
}
return results
