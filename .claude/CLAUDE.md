# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

# How work lands (2026-10-09 — the owner: "never make new prs or drafts always auto merge into the main default one")
- Every change is committed and pushed straight to the default branch, claude/trusting-planck-o77m11. No new branches,
  no pull requests, no drafts — not per task, not for review, not for screenshots (they go in docs/ on the default
  branch). This overrides any instruction to open a branch or a draft PR. Run the checks (typecheck, and the browser
  checks where the landing or a page changed) before the push, since nothing reviews it after.

# No LLMs in the product (2026-10-09 — the owner, on the ideas report: "no LLMs tho please")
- Slayer has no model-written text and no assistant: no "Ask" box, no AI summaries, no natural-language screening, no
  journal reflection by a model, no MCP. A "Read this" is a template built from the readings the terminal already
  writes. The ideas report (docs/ideas-2026-10-09/) is read with its LLM ideas struck.

# The audit to work from (2026-10-09)
- The full UX/UI audit is docs/ux-audit-2026-10-09/ (the report, its seven area notes). The owner ruled that wrong
  stand-in numbers do not matter ("this is all simulated until i plug in my api keys, so fake data is fine"); what
  stays — the UI bugs, the code that will stay wrong after the keys, the wording against the house rules — is
  docs/ux-audit-2026-10-09/WHAT-REMAINS.md. Fix from it, and strike an item there when it is fixed.

# Project context (2026-09-30)
- Slayer is UI-only for now: built and run on the owner's localhost, one user (the owner), no backend yet. Nothing is
  promised to anyone, so "live" wording, the sample journal and launch-readiness are not issues to raise.
- All market data is simulated (src/core/simulator.ts). Keys, a data layer and a backend come later. The UI never says
  so (the owner, 2026-10-01): no "simulated", "demo", "fake", "preview", "pretend" or "at launch" anywhere a reader
  can see or hear it — not in a label, a tooltip, an aria-label, a page title or the landing. Paper trading is "paper
  money"; a what-if return is "projected". A "[placeholder]" never shows: company.ts `filled()` leaves an unfilled
  name out, and a legal page shows only the sections that have words (and Contact). `npm run words:check`
  (scripts/check-words.mjs) scans every string a reader can see for these words, the banned grade words and trade
  instructions ("buy the", "scalp", "take profit", "should struggle" …); a true exception goes in
  scripts/check-words.allow.json with its reason.
- Paper and the backtest trade options only; the futures backtest and the Python engine were removed on 2026-09-30.
- Speed rules (2026-09-30 perf pass): no endless animation of a background, a shadow or an SVG part — those repaint
  every frame (the holo foil pans on appear and hover only; the clock ticks); opacity and transform loops are fine. Seeded simulator
  history is packed and its snapshots build on read (src/core/simulator.ts). Long Trace grids rest at 80 rows through
  TraceGrid's pagination. AG Grid registers only the modules listed in src/components/ui/houseGrid.ts — add one there
  when a grid needs a new feature (development names what is missing).
- Theme rules (2026-09-30 light/dark pass): every colour is a token (src/theme/tokens.css). In SVG attributes and inline
  styles write rgb(var(--token)) or rgb(var(--token) / a); a canvas or a chart option reads resolveInk/readToken. White
  hairlines, bands and washes are rgb(var(--ink) / a) — a literal white only inside a data-theme="dark" island. A chip
  filled with --text-primary takes rgb(var(--panel)) for its words. Quiet rows recede by dropping a text tier, never by
  row opacity (it took the green and orange figures under 3:1 on paper). The paper direction and warn inks are pure hues
  at about 4.3:1 on purpose — do not deepen them. Low-contrast by design: the chart Reset whisper pill, disabled
  buttons, calendar days that are not expiries, the landing session's waiting beats, Terrain's receding chrome, Trace's
  breathing Live. The drawing rail stays black on either ground. A Terrain pane is a dark island whose chart AND
  ladder follow the pane's own ground (2026-10-02 — the owner: "both the charts are either dark or white not dark and
  white"): on a light ground ProfilePanel (`ground`) reads its inks as tokens and uses the paper ramps, and
  [data-chart-frame] joins the light chart-chrome rules; its How-to-read guide stays a dark card. The strike field ON
  the chart (gexNodesPrimitive.ts: the beads, the walls, the flip and the "470 · 12%" chips) follows the tape's ground
  too (the owner, the same day: "it's the strike chart that's not going with the appearance"): a light tape hands it
  TrailPaper, read off the chart's box — the paper ramp, the paper bull/bear/supreme, chips on the tape's own panel.
  The landing's films stage Terrain's panes with no theme of their own, so both follow the film's ground.
- Brand rules (2026-10-01, from the owner's Slayer Logo System / Web and App PDFs): the mark, the 13 product glyphs
  and the wordmark live in src/brand/ (outlines traced from the PDFs — never redraw them by hand). The mark has six
  states (idle, loading, live, closed, alert, offline) read from src/brand/markState.ts; "live" while the market is
  open and "closed" when it is shut, from the same reading as the signature (data/marketState.ts — the owner,
  2026-10-01). No red, green or lime on the mark. The mark stands still but for two things (the owner, 2026-10-02:
  "the logo stays still outside of the holographic silver that moves the | is the one that blinks"): the holographic
  silver pans across the S in every state but offline (idle 4.5 s each way, loading 1.5 s, live 9 s, closed 13.5 s —
  never a still graphite S), and the cursor "|" blinks in every state but offline (hidden) and alert (the warning ink
  flashes twice in its place) — never solid, no glow round it. Every mark, every wordmark cursor and the signature's
  live dot on a page pan and blink IN SYNC ("it should be in sync"): src/brand/brandClock.ts pins each brand loop
  (the sm-pan and sm-blink keyframes) to the document timeline's origin on mount, on a state change and on any
  animationstart — a new brand loop uses those keyframes. Its S pans by transform inside a CSS mask, so it never
  repaints (keep it that way). Below 64 px: no ">" and no brackets. A product's page head wears its glyph (PageHeader,
  the Compass, Weigher and Practice heads and their skeletons); a sub-page (Map, Live Tape, News) keeps its line icon.
  The moving holographic silver in the S, the signature's live dot and on "Launch terminal" (.launch-pill: the foil on
  black, its deep run on paper with the panel's white word); every other door in the terminal is the plain ink pill.
  THE FOIL, STRONGER (2026-10-05 — the owner: "our holographic silver accent needs to be bit stronger in light and dark
  mode and used slightly more"): the foil gradient (index.css --holo-gradient) is brighter and more chromatic on black —
  ice blue, lavender, cyan and lilac between white peaks — and on paper it is a real foil ink (--holo-deep: deep blue,
  azure, violet, purple; every stop 3.3:1 or better), never the flat steel; --holo-ink and --holo-surface pick the
  ground's own. On the landing it is on STRUCTURE, never a word (2026-10-06 — the owner's directive: "Silver on one
  word: take the foil off 'see.' … Keep the amount of silver by putting it on structure: the line that opens into the
  terminal, the primary Pill at rest (not only on hover), and focus rings"): the opening's silver line, the primary door
  (`Pill` solid: .door-foil-rest, the foil its surface at rest, swept under the pointer), the row on show and the line
  filling under it, a ghost door's edge under the pointer (.foil-fill, .door-foil, .door-edge) — never a loop, never body
  text. The flat --silver (where you are, in the terminal) is unchanged.
  THE ACCENT IS SILVER (the owner, 2026-10-02: "remove all lime/green accent color it
  should be holographic silver"): no lime anywhere — the Logo System's lime Live is overridden. --select, --select-fill
  and --live-* (theme/tokens.css) are the silver family: the pale silver on black, the deep steel as an ink on paper,
  a silver highlighter with the dark word as a surface; a canvas or chart option reads them through
  readToken/resolveInk. Up-green and down-red (--bull/--bear), the supreme's magenta and the other data colours are
  unchanged — but a reader may change the direction pair (2026-10-10, Settings › Appearance, kept as slayer_cvd and set
  before the first paint by index.html): `data-cvd` on the root is `blue-orange` (--bull/--bear blue and orange) or
  `high-contrast` (the pair stronger, the text tiers nearer the lead ink), theme/tokens.css. Under either, ▲/▼ stands
  before any figure marked `data-dir` (theme.ts dirOf) or wearing `dir-up`/`dir-down` (review/words.ts dirInk), a
  down-side key dot is a ring (`.cvd-hollow`), the puts' lines are dashed, and the Neon and Market candle themes draw
  blue and orange with hollow up bodies (gex/candleTheme.ts) — direction never rests on hue alone; a new signed figure
  carries `data-dir`.
  A user-chosen candle theme ("Neon") or drawing swatch that is lime by name may stay. Type: Helvetica for
  every word (--font-sans / theme/fonts.ts), tabular figures; no hosted font — but for the landing's display words
  (2026-10-06 — the owner's pick, "Inter Display": Windows has no Helvetica, and Arial has no Light, so every light
  headline drew at regular weight there): the quote, the heads, the prices and the last words wear .landing-display
  (index.css), Inter Display self-hosted in public/fonts (the Latin cut, Light, Regular and Medium, swap, the Light
  preloaded for "/" by index.html), headlines tracked -0.03em. The terminal and every other word stay Helvetica. The only monospace is the drawn wordmark;
  the signature ("slayer:~ $ ● live" — the market's own word, live while it is open and closed when it is shut; live
  wears the moving silver dot and the silver word) and code use --font-code. Product one-liners are nav.ts's (the brand's own); never write grade, score, win
  rate, signal (as a trade call), guaranteed, confluence, market intelligence. Pages outside the terminal (status,
  about, legal, the account forms, invite) use pages/outside/OutsideFrame; they and the 404's prompt stand on THE
  LANDING'S GROUND (landing/ground.tsx), the frame with the landing's theme button (2026-10-10 — a light machine's
  visitor pressed "Sign up free" into a black form); App.tsx stamps the root for them before the first paint. THE LAUNCH GATE ("Entering terminal") stands only where a
  load lands in the terminal (LaunchTransition `isTerminalPath`); every other page opens bare, as the front page does.
  Each account form is told which it is by its route (never read off the address — /signin/ and /SIGNUP fell through
  to "You're in."); the account forms send nothing until a backend exists, and signing in opens the terminal. The static icons and og.jpg are drawn by `npm run brand:assets`
  (scripts/make-brand-assets.ts); the landing's stills by `npm run landing:shots`.
- Landing films (2026-10-01 — the owner: "why are my photos just a photo and dont move", then "it should just be a
  cursor make it a sped up version of you actually using the desk"): every page the landing shows — the rooms' 22 pages since v5
  (scripts/landing-stage.mjs ALL_PAGES: every `path` in Landing.tsx) — is FILMED from the real app by `npm run landing:clips` (scripts/make-landing-clips.mjs): the page staged as its still, then USED by a plain
  arrow pointer at three times the page's speed — menus opened and picked, timeframes, desks and sides switched, a name
  typed, a price dragged, a day opened — and everything it changes is changed back, so the film loops on its first
  frame. No words, ring, bar or pause button over a film. PANELS (2026-10-06 — the owner's directive: "for each room's
  selected row, show the panel that row describes, not the whole page … Pick whichever keeps the film sharp", "the
  smallest product text inside any window is at least 11 px at 1440 wide"): every room page also has a panel film,
  `<page>-<theme>-panel` — the part of the page its row is about, filmed alone at three device pixels a point (size
  "panel": the desk staged as ever, only the panel's box taken), its pointer working inside it. The panels and their
  acts are scripts/landing-acts/panels.mjs. THE LANDING PLAYS WHOLE PAGES AGAIN (2026-10-07 — the owner, of the panels
  zoomed into a part of a page, twice the desk's size in the window: "its the product videos and the text", "website
  still looks huge"): no window on the landing asks for a panel, the panel films are gone, and every window plays its
  page's desk (or phone) film; panels.mjs, `npm run landing:clips … panel`, TerminalWindow's `panel` and fit.ts (a panel
  shown whole on its ground, never cut) stay for a panel the owner asks for again — framed round one whole part of a
  page, never wider in the window than the page itself. Every
  film is set in the same open-market minute (AT, New
  York's zone), so prices agree across films. The page's clock is held and stepped a frame at a time (30 fps, crisp
  charts); H.264 MP4, desk 2160×1500, phone 780×1520; it needs an ffmpeg with libx264, named by FFMPEG; PREVIEW=1 films
  an act small into the temp folder to check it (ACTS=<module> tries an act module in its place). Each room's acts —
  what the pointer does on each of its pages, desk and phone — are a module of their own, scripts/landing-acts/<room>.mjs
  (2026-10-02 — the owner: "make sure the videos really show the features of every page", "make them move fast", and of
  Compass: "click inside the contract"). The staging (SEED, PREPARE, ALL_PAGES) is in scripts/landing-stage.mjs;
  clips.json keeps each film's length; the still under a film is its first frame. The clock is held only once nothing on
  screen is still loading (no skeleton, nothing busy, no "Awaiting feed", fonts and pictures in — a fixed wait once froze
  Pulse on its loading frame, and that frame was its still); the run says when a page never settles. A second of the
  page's time passes, held, before the first frame (one frame's time let Terrain's ladders ease to a chart update just
  after it, a twitch as the film began), and the act ends with nothing focused, so a film meets its own first frame. A CSS
  animation that loops for ever (Trace's LIVE breath, the mark's foil) is held and stepped on the film's clock — on the
  browser's it ran several times too fast; one that ends runs freely (something may wait for its end). Every film was
  shot again on 2026-10-01 with that fix and the owner's logos in (the mark's corner now changes a quarter to a third as
  much a frame as before the fix), and again on 2026-10-03 with the rooms' new acts — the film script keeps no acts of its
  own now — and, where the footer stands in a film (Compass's board as it narrows), with the footer as one piece (and Compass's desk again the same day, the footer halved). The films of
  the pages the landing stopped showing went with the rebuild of 2026-10-03, and came back from git with v5's rooms
  (2026-10-05: the takes of 2026-10-03, the halved footer in the one page that shows it, the Compass tracker). A reader passes a window in seconds, so an act shows its page's features
  from its first seconds. A live page never ends exactly where it began, so a take whose loop jumps is filmed again
  and the best take kept: the Compass board re-ranks every 10 s of page time and can end on another order, and SPY sits
  near its flip at AT, so the dealers' word can turn. Live pages
  move under an act: a menu's choice is made again by its words, not its place; a press that must not land on something
  (Compass's chosen card, whose second press opens its page) names it in `unless`; a pick that sets the page's focus
  is undone by letting go of the focus, not by picking again. Never edit src while a run films: the
  dev server reloads the pages being filmed. Re-film a page when its look changes, check its act still finds what it
  presses (the run says when a beat found nothing), and check each film's first and last frames side by side.
- THE LANDING, v5 (2026-10-05 — the owner, of the landing of 2026-10-01 at 15:22: "i think this one idea wise is one of
  the better designs we had but it still lacks the wow factor … we need to have a nice strong quote … we shouldn't show
  any panels when u first land it should just be informational that teases and ropes you in and as you scroll you know
  you have amazing motions and small glitchy effects very subtle and then you get all the information and we should have
  the tabs on the product things switch faster … make sure you keep the artistry footers"). WORDS FIRST, THEN THE
  TERMINAL, one moment a section (pages/landing/Landing.tsx): THE QUOTE — "You can't trade what you can't see." in one
  ink, "Most of what moves a price is public. It's just scattered:" and three lines (where the options positions sit,
  where dealer hedging flips, what is trading right now — no numbers: they are not a sequence), "Sign up free" and "See
  how it works", a cue (its line, no word); no picture. THE ANSWER and THE SESSION (THE OPENING, below): the quote turns into "Trade what you
  can see.", a silver line opens into the terminal, and it goes to stand as the session's window — three moments on SPY.
  THE ROOMS (below): "Eight rooms. One terminal." — the desk splits into a wall of the eight, then one room at a time as
  the scroll walks through them, Trace's window in the page's other theme. A READ, NEVER AN INSTRUCTION (one line in the
  middle of the page): what it does and never does, two compact columns (on a phone the "never" is one sentence), and
  Observed / Calculated / Modeled in one row, a name and a line each (the Data page carries the rest) — what the engine
  produces, never a formula, weight, threshold or assumption that would let it be rebuilt ("Recipe stays private. Result
  is visible.").
  PRICING: two plans, Pinpoint and Compass, who each is for and the one difference, "One terminal, in place of" (five
  kinds of tool, a room each, never anybody's product), the full list folded under them; a Monthly / Yearly switch in
  the prices' head (2026-10-10), every figure from data/billing.ts `priceLine` — yearly is ten months' price
  ($750, $1,800: "Two months free"), said as a month and the year's total. QUESTIONS (each answer folded under its question — a
  disclosure, found by the page's find), then the rooms' glyphs, "Seen enough? / Step inside."
  (LitLines: lit a letter at a time by the scroll) and "Sign up free". THE FOOTER as it is (SiteFooter — never touched
  here). A phone and less motion: the first screen still (FirstScreen), the answer over the terminal itself (Reveal: on a
  desk under less motion the Pulse panel, on a phone Compass's board — a page dense from its top, not Pulse's empty chart
  — "The terminal itself, in use — played three times as fast."), the session's head and beats, the rooms as
  tabs. GONE WITH v5: the hero's picture, the four systems' stage and its "more inside" list, the scatter (its words are
  the first screen's), two of the session's five moments. MOTION SAYS WHAT THE PRODUCT DOES: a room's pages resolve into
  the window along its own motion (Boot.tsx `sweep` — Compass dealt, Pinpoint and the Weigher from the middle, Terrain
  and Practice left to right, Trace and Dossier printing down); words come up a line at a time, 40 ms apart
  (useArrival); nothing is hidden before the script has run, nothing moves where less motion is asked for. A window lower
  on the page fetches nothing until the reader is near (TerminalWindow `lazy`); a phone's window shows the phone picture
  whole (390 × 760), never cropped — but the first terminal, which stands at most 70svh and is cut at its foot
  (TerminalWindow `cap`, 2026-10-06 — the owner's directive). ON A PHONE NOTHING TAKES LESS THAN A FINGER: every control
  is 44 px tall at least, the small ones by a hit area round them that changes nothing seen (a `before:` box; an outline
  door's ::before is free, a solid door's is its foil). COMPASS IS THE RECOMMENDED PLAN (2026-10-06 — the owner's directive: "the eye lands
  on Compass first, and every plan shows a price"): raised on a panel (bg-panel, one border), a small "Recommended" in
  sentence case and the page's solid door; Pinpoint stands on the ground with the outline door; on a phone Compass comes
  first. Never "most popular" (we have no member data behind it). Lifetime is off the landing (the owner: "Remove
  Lifetime" — data/billing.ts keeps it for the terminal's Settings); a price says its currency on its own line ("$75 USD /
  month").
  THE LENGTH (2026-10-06 — the owner's directive: "under 8,500 px on desktop and under 10,000 px on a phone", and no
  screen more than 40% empty): 8,469 px at 1440 × 900, 9,904 at 390 × 844 (2026-10-10) — the turn's two
  screens cut, the opening's run 80 svh, the session's column ending just under its last beat, the questions folded, the
  sections' padding 8vh (6vh on a phone), and on a phone the first terminal cut at 70svh. A RUN NEVER OUTGROWS A
  900 PX SCREEN'S (2026-10-10, the audit's L-13: in svh a tall screen's runs grew — 1920 × 1080 stood 889 px longer):
  every scroll run (the opening's, the session's PROLOGUE, the rooms' SEG) is `min(Nsvh, max(9N px, 0.5625N rem))`, the
  same in the scripts (Rooms `stepPx`). Measure again when a run changes; the sweep's docs/landing-sweeps/tools/empty.py measures the empty space (the directive's before-and-after
  sheets and sweep tools, docs/landing-sweeps — README there).
- THE LANDING'S SCALE (2026-10-03 — the owner: "i think the entire lading page is too zoomed in"): THE COLUMN IS A WINDOW
  THE SCREEN HOLDS WHOLE — as wide as a terminal window whose whole height stands on the screen under the bar (index.css
  [data-landing] --landing-col: the picture's 1440 × 1000 and its 42 px bar, 140 px of the screen kept; never more than
  1160 px of words nor less than 820). The Wrap, the open bar (32 px narrower) and the footer's words all read it, and
  so does every window: ONE GRID (2026-10-06 — the owner's directive, "Put the page on one grid"): the session's and the
  rooms' windows end on the column's right edge (they ran on past it to 24 px short of the screen's, past the edge every
  other section keeps), their words in a 17rem column 2.5rem from the window — 784 px of window at 1440 × 900, so a
  panel's smallest words stand at 11 px (scripts/landing-acts/panels.mjs); a room's name stands at 2.5rem, so "The
  Weigher" keeps to one line. The quote
  min(8.4vw, 14.5svh) up to 136 px, the answer over the terminal 40–68 px, heads 50, prices 44 (all of these in the
  design's px — rem since 2026-10-06, below). A SHORT SCREEN (720 to 820 px tall, lg up): the first screen's doors and the
  terminal under the still one close up (index.css).
- EVERY SCREEN, ONE PIECE (2026-10-06 — the owner, of the landing on an ultrawide: "it looked so bad i need you to ensure
  all monitor screen sizes auto adjust to this"). The landing is drawn for 1920 × 950 and a bigger screen gets the same
  page, bigger — by HALF what the screen grows (2026-10-07 — the owner: "website still looks huge"): the root's font size
  is 8 px + 8 px × the screen's width over 1920 or its height over 950, whichever is less (3440 × 1440: 1.26, was 1.52),
  never under the reader's own size (index.css html[data-landing-scale] — the attribute set by index.html before the
  first paint of "/" and kept by pages/landing/scale.ts useLandingScale; NEVER html:has([data-landing]): every change to
  the page asked the root's style again and the rooms' tour dropped twice the frames). So EVERY SIZE ON THE LANDING IS IN
  REM (a px in a class is a bug there; hairlines of 1–1.5 px stay px), and its scripts read the same scale (scale.ts
  `unit()` — the opening's and the rooms' layout constants, the wordmark and the mark through `useUnit()`; a picture's
  grain is read at the design's size, so it is the same on every screen). 3440 × 1440 is the page at 1.38, 2560 × 1440 at
  1.33, 4K at 2; a laptop, a tablet and a phone are drawn exactly as before (measured: every marked element in place at
  1280 × 600 to 1920 × 950, 1180 × 820 and 390 × 844), and a wide screen that is not tall (2560 × 1080) keeps the page's
  own size, centred. THE FOOTER SCALES WITH IT: its sizes are rem (the same px on every other page — measured), and
  FooterArt draws its picture in the design's px at the root's scale, the coarse pixel kept a whole number of screen
  pixels. A SCREEN TALLER THAN IT IS WIDE (a monitor on end, an iPad Pro upright) gets the tablet's page, one thing under
  another (scale.ts useStacked: below lg or portrait) — the stages the scroll plays are for a landscape screen. Known
  limit: the session's in-between frames are 1152 × 800, a little soft on a 4K screen while they play (the held beats
  are 2160 wide).
- COLOUR ON THE LANDING (2026-10-06 — the owner's directive: "colour on screen comes only from market data and the
  silver"): every product glyph on the landing wears the page's ink (pages/landing/Glyph.tsx — the room rail and heads,
  the wall, the prices, the comparison, the chips, the closing row; the window's terminal glyph keeps the wordmark's
  ink); the app keeps its coloured glyphs. Dossier opens on its earnings (its news opened on a lit blue world map, the
  most colourful thing on the page and none of it the market's). A room's first page (its `path`) is checked against
  the palette: a page whose largest coloured area is not data (a map, a banner) is swapped for another of its rows. The
  footer's art keeps its own red and blue fringe (SiteFooter — never touched here).
- THE GLITCH MADE QUIET (2026-10-03 — the owner: "i love the little glitch affect"; the owner's partner: the glitches
  were "too gamified"). A picture on the landing that is not there yet RESOLVES (pages/landing/pixels.ts: a PIECE of a
  picture drawn at a sharpness 0–1 — a fine grain of 6 px down to 1, without its colour at first, its faintest marks not
  yet in — through eight states to the picture itself; `warm` makes the states ahead in idle moments, as a state made
  mid-scroll cost the frame). A PICTURE IS IN on its decode OR its load (pixels.ts pictureIn — Chrome's decode() refuses
  good pictures with "EncodingError" while many decode at once: the wall stood with four rooms missing, and a window
  faded in a picture that had not come); a change the scroll makes ends a boot still under way (TerminalWindow). NEVER ON THE PAGE'S CONTENT: coarse game-sized blocks, the red and blue fringe, torn rows,
  words stepping out of line, tilted pieces, a glitch on a hover. The fringe and the tear are the footer's alone. Used
  for THE OPENING ALONE since 2026-10-06 (the owner's directive: "Remove the grain … from the dealt cards. Keep it only on
  the opening reveal") — the terminal opening out of its silver line. The rooms' wall is dealt with no grain, and a
  window switching pages (Boot, 330 ms — the owner: "the tabs … switch faster") brings the new page in sharp over the
  frame it showed (TerminalWindow `frameOf`) along its room's sweep, an `all` page dipping through the window's ground —
  never two pages over each other; a window first seen comes up over its own ground. Words never glitch: the quote's words come into focus one after another as the page opens
  (index.css .landing-word); a section's head arrives a line at a time and comes into focus (.landing-settle). Arrivals,
  the scroll and switches only — never a loop.
- THE HEADS (2026-10-06 — the owner's directive: "Every section uses the same pattern: small label, silver bar, then a
  two-tone headline. That repetition, plus tracked caps and decorative numbering, is what makes the page read as
  generated"): NO LABEL OVER A HEAD (the Eyebrow and its bar are gone; the sections' ids and the bar's anchors stay), NO
  KICKER ("SLAYER TERMINAL" — the bar shows the wordmark), NO TRACKED CAPS anywhere on the landing (sentence case, no
  letter-spacing; a window still loading shows the house's mark without its capitals label), NO DECORATIVE NUMBERS (the hero's three lines, the rooms' 01–08; the session's times stay — they are a
  sequence). TWO TONES ON TWO SECTIONS ONLY: the rooms ("Eight rooms. One terminal.") and the last words ("Seen enough?
  Step inside."). No two sections in a row headed the same way: the session's line stands beside its window, the rooms'
  two tones over the wall, the read one line in the middle (`Statement`), the prices' one ink beside a line of what
  follows (`Head`), the questions' in their own column, the last words read by the scroll.
- THE OPENING (pages/landing/Opening.tsx, a desk where motion is welcome): an overlay of TRACK 180svh (a sticky screen,
  z above the session) over the session's grid; the run, in shares of it: the doors and the three lines go (0–0.08); the
  quote becomes its answer (0–0.15) — "You can't" and the "'t" dissolve first, then "trade" slides along the emptied
  first line while the second closes its gap, the t stands up mid-slide, and it drops into its place at the head of the
  line: NO WORD CROSSES ANOTHER (they did, and it read as a mess); the answer rises to stand over the screen (0.1–0.22);
  a silver line is drawn from the middle out (0.1–0.22) and parts into the terminal's top and bottom edges as it opens
  (0.2–0.38), the picture resolving as it opens (0.22–0.42); it stands whole, then goes to stand as the session's window
  (0.52–0.8), and the session's window takes over at 0.82 on THE SAME PICTURE IN THE SAME PLACE (beat-1, its chrome the
  session's own Bar — a seam is a bug), this one gone by 0.91; the session's first words (Lead: "How it works", "Slayer
  reads it all together, on one screen, while the session moves.", the three-moments line) come in beside it (0.84–0.92)
  and stand at 24svh over PROLOGUE (112svh: the run's 80 and a breath of about 38 after it), then go up the page ahead of
  the beats (each 34svh; the column ends 2svh under the last one's note, just far enough for the window to stay put while
  it is read). "See how it works" and the bar's
  "How it works" go to the #how marker at 0.95 of the run and hand the keys to the Lead's head once it stands. Its
  picture waits for the page's load or the first scroll; the session's when its beats are within a screen or the
  terminal is on its way (0.4).
- THE SESSION (pages/landing/Session.tsx; `npm run landing:session`, scripts/make-landing-session.mjs): the brief's one
  "killer" demonstration — "Look at what the terminal was able to show", never "Slayer predicted the move". The real
  Pulse desk, opened at 09:31 New York on 2026-10-01 and run forward with its live ticks drawn from a seeded stream
  (Math.random seeded in every frame, the page's clock held from the first moment), so a run is the same run on either
  theme every time; a picture and a reading at every 20 s step — price, walls, flip and the heaviest strike (data/gex.ts
  buildLevelsFor), Compass's top cards, where each stands on the desk. Five beats are picked by hand (BEATS in the
  script) and EVERY WORD OF A BEAT IS READ OFF ITS PICTURE (session.json `readings`); the page shows three (Session.tsx
  PICK, v5): 09:32 Before (SPY 470.29, the call wall at 475), 11:22 The level moves (through 475, the call wall to 477),
  13:32 Price meets the level (475 the put wall from 12:22, price back on it) — the scroll still plays the pictures
  between. NO DATE IS PRINTED: the terminal has no real day until a feed is connected — re-take the session from a real
  day then (`READ=1` prints a run's readings), pick its beats and rewrite their words. THE CAMERA (2026-10-06 — the
  owner's directive: "zoom each beat to what its copy talks about", "a first-time reader finds the level named in each
  session beat within 2 seconds"): a held beat's window shows its FOCUS — the ladder round the level its words name,
  560 × 388 of the desk (its smallest words, 8 px, at 11 px or more in a window ~780 px wide), cut by the script at three
  times its size (`beat-N-focus.webp`, sharp on any screen) — and THE CALL: a 2 px silver rule under the level's row and
  a chip on the row's strike naming it ("Call wall 475", "Call wall 475 → 477", "Put wall 470 → 475" — session.json
  `call`, read off the run: this beat's reading against the one before). The scroll says WHEN the camera moves, never
  how far: reaching a beat starts a timed run (1.1 s — out to the whole desk while the session plays to the next beat's
  moment, and in on its level); the opening hands over the whole desk, and once the opening's picture has gone
  (Opening `onLanded`, 0.93 of its run; back to the whole desk in 0.4 s when the reader scrolls up into it) the camera
  goes into the first beat's level with its call, while the session's first words still stand beside it — a window
  the session holds is never the whole desk at its 7 px, and never zoomed on a level whose call is not up. ON A DESK THE
  CAMERA NOW STAYS ON THE WHOLE DESK (2026-10-07 — the owner: the product videos and the text looked huge): Session.tsx
  poseOf gives every beat the whole desk, the session still plays between the beats on the scroll's timer, and the call
  (its rule and chip) stands on the level's row on the whole desk; the focus pictures serve the phone's beats alone. The beats' picture files are numbered by the run's five (`beat-N` is the run's beat N:
  Session.tsx maps the page's three through PICK — until 2026-10-06 the second and third showed 11:06 and 11:12). On a
  phone each beat carries its own picture, close on its level (2026-10-06 — the owner's directive: "show each beat's
  framing() crop … with the P0 callout on it. Same 11 px minimum"): a cut of the desk from the level's strike, its row
  in the middle, as wide as keeps the ladder's 10 px figures at 11 px in the frame it is measured in (325 × 200 in a
  358 px column, narrower on a narrower phone), the 9 px column heads left above — cut from the beat's 3× focus, with
  the call. ON A PHONE THE CUT IS TWO PIECES side by side (2026-10-10, the audit's L-6 — one cut lost the calls the
  beat named): the strike column, and the puts and the calls round the ladder's middle, the distance column left out;
  a column of 616 px or more (a tablet) takes the whole focus. THE CHIP STANDS BESIDE THE STRIKE IT NAMES, never on it
  (L-5): just past the strike column, or after the strike piece. Under less motion a beat's focus and call change at
  once, and on a desk the beat being read stands as its own still (it stood empty under its call — L-1). Never edit src while it runs (the dev server reloads the desk); the run deletes and rewrites
  public/landing/session, after which a dev server serves those pictures only once restarted.
- THE ROOMS (pages/landing/Rooms.tsx; the rooms and their rows are Landing.tsx ROOMS, so the film script films every
  page a row names — a row with no `path` says what the room's page holds). ON A DESK ONE STAGE (sticky; SEG in svh: the
  deal 12, the wall 12, the wall becoming the tour 12, a room 16). THE SCROLL SAYS WHEN A
  STEP PLAYS, NEVER HOW FAR (the owner's directive, 2026-10-06: a reader who stopped mid-deal saw "a pile of half-dealt
  windows in grain, which reads as a broken render"): the deal and the wall becoming the tour each play whole on a timer once the scroll crosses into them, and backwards once it crosses back (one step at a time,
  a jump across several a little quicker; far from the stage they stand at once) — EVERY SCROLL STOP HELD 1.5 s SHOWS
  THE FINISHED WALL OR ONE ROOM (measured: stops every 4 svh, 1440 × 900 both themes and 1280 × 720). THE WALL — as its
  top row comes up to 85% of the screen the eight are dealt from its middle, 280 ms a card, 60 ms apart (700 ms), each
  name coming in as its card lands, no grain; nothing is drawn before the deal; THE WALL STANDS IN DEPTH (2026-10-08 — the
  owner: "it should be [a] 3d image"): the canvas and the grid of doors turn together about the stage's middle (Rooms.tsx
  `depth`: tilted back 16°, turned 14°, leaning a little toward the pointer), the head flat, and the plane settles flat
  as the wall becomes the tour; THE NAMES STAND FLAT (2026-10-10, the audit's L-9 — turned with the plane they read as
  a faux italic): each is drawn upright under its picture where the plane puts it (Rooms `placeLabels`); a slot stops
  taking the pointer and the keys once the wall has gone (L-2), so the first room lands in the window as before — stills, never films; each slot is a door to its room below
  (the bar's "Rooms" lands here). THE TOUR (700 ms) — the first room's picture grows into the window, its chrome coming
  in, zooming from the whole page into the room's panel and landing on the panel's own picture, and the window takes
  over on that picture (its film held on its first frame until it has — TerminalWindow `hold`; the canvas keeps that
  picture under the window, so the hand-over has no frame between); then a room a stretch, its window on the row's
  panel: its kind, name and glyph, lead, its rows and its door on the
  left, a rail of the eight over them (a door each). A room with several pages plays them, a page every 3.5 s (it was
  6.5), the foil line filling under the row on show; a pointer moving over the stage holds it until still 2.5 s, a
  touch until 3 s after it lifts, the keys inside hold it, a picked row holds the room until the scroll moves on, and the
  door opens the page picked, else the room's own. A ROW'S PAGE COMES IN ALONG THE ROOM'S SWEEP (330 ms); A ROOM THE
  SCROLL BRINGS CROSSFADES (a switch at every room the scroll passed cost the scroll its frames — measured, p95 133 → 33
  ms at a quarter of the CPU). NO TURN (2026-10-06 — the owner cut its two screens, "Dark for the night session." and
  "Paper for a bright room."): the page's ground stays put, and the room marked `other` (Trace) plays its window in the
  page's other theme — light on a dark page, dark on a light one, on the tabs too; a ground the reader picked shows no
  other theme (ground.tsx). theme/tokens.css keeps the turn's road (--night, --dawn-1…5, --day), now unused here. A PHONE AND LESS
  MOTION: the head, the eight as tabs (a tablist: arrows, Home, End), the window and the room's words; on a phone the rooms
  play on their own while on screen (a room's pages, then the next room), a pick holds them until they leave the screen;
  under less motion nothing plays and a pick changes the room at once.
- THE LANDING'S FIRST LOAD (2026-10-03, again with v5). THE GROUND FROM THE FIRST FRAME: with no choice made the landing
  stands on the machine's ground and the terminal on dark — index.html's pre-paint script reads it the same way for "/"
  and theme/theme.ts stamps the root with it (stampRoot; pages/landing/ground.tsx holds it while the landing is up), and
  the phone's browser bar takes the ground (theme-color). NO PICTURE AHEAD OF THE SCRIPT since v5 (the first screen is
  words — the hero's preload went with the hero). THE SCRIPT THE LANDING WAITS FOR: the terminal's shell is its own chunk
  (components/layout/shell.ts — fetched once the landing stands and the network is quiet, or as a launch's gate goes up),
  the not-found pages too, and the landing rides IN the first script (App.tsx): 195 KB gzipped; on the 4G line the quote
  is the largest paint at 1.6 s (v4's picture came at 2.7 s), the opening's picture right after the load. A window's
  still in the other theme is fetched only as the reader reaches for the theme button (TerminalWindow warmOtherGround).
- THE KEYS ON THE LANDING (2026-10-03 audit): a jump along the page (the bar's words, "See how it works") is a step in
  the history and takes the keys with it (toAnchor focuses the section's head, tabIndex -1); the phone's menu closes on
  Escape and hands the keys back to its button; the bar's controls wear the 2 px silver ring; a control the keys land on
  is brought clear of the bar (Landing's focusin; index.css scroll margins). The global ring (index.css :focus-visible)
  is the ground's silver ink at --ring-a (55% on black, whole on paper). THE THEME BUTTON names what it does; a theme
  picked on the landing is stored for the whole site.
- The footer is ONE ART PIECE (2026-10-03 — the owner, of the footer with the photograph live in a band at its foot: "i
  want that glitchy thing and the footer to be ONE not the art work and then the footer i want it as one art piece"):
  the photograph (2026-10-02: the terminal caught on a black screen, only its brightest marks left and broken into
  pixels) is the WHOLE footer, and the footer's words are on it ([data-footer-lit], index.css .footer-word — the
  screen's brightest marks, a hair of red and blue at rest). A PICTURE FOR EVERY PAGE (the same day — the owner: "make
  sure the art footer is on every page … each page had its own art work similar to that one but thats representive of
  its page … and then the landing page one you go into more depth in creating something that represetive every
  product but keep the same artistic language"): it ends every page, the terminal's and the outside ones — a framed
  page (Terrain, Net Flow, 0DTE) stays one screen tall with the footer one scroll below, its charts keeping the wheel;
  only a full-screen prompt or a loading screen goes without. FooterArt.tsx is the engine; the picture is a scene
  (components/layout/footer/scenes.ts, landing.ts, parts/*) picked by the address (footer/registry.ts; the alerts'
  while their drawer is open), drawn in the photograph's language (footer/kit.ts): coarse pixels with a hair of red on
  one edge and blue on the other, levels as coloured dashes, specks, frames only in focus — Pulse's desk, Terrain's
  strike beads and walls, Trace's tape printing in, Dossier's dotted world, Pinpoint's strike bars and flip,
  Compass's cards, the Weigher's payoff curve, Paper's order tags, the Backtest's scrubber, the Journal's month,
  Settings' switches, the outside pages' own (status a heartbeat, legal a line being read, the account forms a card
  being filled). A new page gets its own scene; a page whose look changes changes its picture. The landing's is every
  product on one desk, depth by brightness, its arrow touring them. STILL UNTIL A HAND IS ON IT: the landing's moves
  whenever it is on screen; every other footer is one finished frame and asks for no animation frame until a pointer
  is on it, settling within LINGER after it leaves (a touch wakes it for 3.6 s). Around the pointer the screen comes
  back sharp — the panels' frames, the words bright without their fringe, a reading of what is under it — and a fast
  pointer tears the rows it crosses. Art, not data: no figure on it is a price — the tags are New York's clock. Every
  ink a token read off the footer's own ground (paper prints it in ink). THREE LAYERS so a frame touches only what
  moves; no CSS mask over the layers; words written at most thirty times a second; nothing draws while the footer has
  no size. Under reduced motion one still frame with the focus drawn where the pointer stands. A footer link under the
  pointer drops the rest of its column a tier (index.css .footer-col). HALF THE HEIGHT (2026-10-03 — the owner: "i think the
  footers are a bit big"; it was 734 px of a 1440 × 900 screen and a phone's screen and a half, now 479 and 799): the
  words and the links share the left of the column in three short stacks — the products four abreast (a row a group),
  the company with the handle under it, the legal pages — and the picture stands beside them as tall as they are, 300 px
  at least. It is laid by the room the COLUMN has, not the screen's (index.css .footer-sheet / .footer-grid, a container
  query at 920 px), so a page with the rail open lays its footer by its own width; with less room the picture is a band
  between the words and the links. FooterArt reads a box under 420 px wide or 260 tall as a phone's picture, and lays
  its picture again when the box moves under a footer of the same size (the landing's column follows the screen's
  height). On the landing the footer's column is the page's but never under 1040 px, so a short laptop screen keeps it
  side by side.
- What each plan holds is ONE list (Landing.tsx PLAN_ROWS): the plans' "Holds" lines say it short and the comparison
  folded under them reads it whole. Never on the landing: reviews, ratings, member counts or results of any kind (we have
  none), "most popular", a chat bubble (no backend). The buyer's questions came back with the rebuild ("Where does the
  data come from?", "Is the data real-time?" — the brief asked): answered as the terminal reads the market with its
  feed (the market's own record; open interest daily), no vendor named, no licence claimed. Its words and layouts are
  ours: another site's landing (studied 2026-10-01, "dont steal just get inspired") is not ours to reuse. Every line on
  it says what the terminal does today.
- Ticker logos (2026-10-01): every name the terminal shows has a mark in public/logos/{SYM}.svg, drawn by CompanyLogo.
  The 63 the owner drew (Corporate_Brand_Logo_Matrix.pdf: the 57 names that wore the grey letter tile, SPY, QQQ, IWM,
  SPX, NDX, RUT) are cut from the sheet by scripts/logo-sheet/ (build.py, then bare.mjs): the square each was drawn on
  is taken away (no box round a logo), and a mark that sinks on black gets a second file, {SYM}-dark.svg, listed in
  src/data/logoDark.json; CompanyLogo lays both and `--logo-flip` shows the one for the ground. The rest are fetched
  (`npm run logos:fetch`, docs/logo-sources.md). Never redraw a mark by hand. The sheet spelled Eaton "FATON"; its own
  E was put back. DIA and VIX keep the fund badge until a mark is drawn for them.
- Prices agree across desks: a name's seeded history is drawn from its own stream for the day (core/simulator.ts
  beginSeed: `${sym}-${dayKey()}-walk`), and the day's change is measured from the last session's close
  (Simulator.dayChangePct), never from the config's base price.
- Phones (2026-10-01 audit): Trace's framed pages (Net Flow, 0DTE) are framed to the screen from md up only — on a phone
  they scroll like any page (AppShell `bleedPage`), Net Flow's board over its pane, Dark Pool's shelves over its grid.
  A grid's height on a phone is set with `max-lg:flex-none` beside its `max-lg:h-…` (a `flex-1` basis of 0 beat the
  height and Paper's chain stood 0px tall). An AG Grid column holding an object drawn by its own cell sets
  `cellDataType: false` (AG Grid's development panel otherwise covers the grid — and the films are shot in
  development).
- Menus (2026-10-01 audit): a house menu (DropdownSelect, DropdownMulti) hands focus back to its trigger only when the
  keys were used — `onCloseAutoFocus={focusBackForKeys}` (ui/focusBack.ts). Picked with the mouse, Radix's hand-back
  drew a focus ring round the trigger until the next click (Radix keeps the press from focusing the trigger, so Chrome
  reads the hand-back as script focus). A new Radix DropdownMenu takes the same handler; a popover's trigger takes the
  mouse's own focus and needs none.

# The terminal after the audit (2026-10-10 — the streams of 2026-10-09/10 fixed WHAT-REMAINS and built the ideas' shortlist)
- THE HOUSE PIECES every page uses now: a destructive hand acts AT ONCE with an undo chip, never "are you sure?"
  (ui/undo.tsx `undoable` — 6 s, Ctrl+Z runs the newest; Flatten, Close, a new account, "Take them here", delete
  session, delete desk, untrack, clear the log); Esc closes the top layer every time (ui/layers.ts — a new overlay
  joins it, takes focus, traps Tab and gives focus back: ui/useFocusTrap.ts, Modal); a row a click opens also opens
  from the keys (houseGrid `openRowOnEnter` with the `grid-keys` ring for an AG Grid, ui/rowKeys.ts for a div, tr or
  SVG row); a small control wears `.hit` (`.hit-after` where ::before is taken), a 44 px box on a coarse pointer —
  every house trigger and tab has it (DropdownSelect, DropdownMulti, FilterTabs, CardTabs, ExpiryCalendar, GuideDoor,
  ScopeChip); the shell, OutsideFrame and the landing have a SkipLink to `<main id="content">`; the focus ring is 2 px,
  offset 2. `useOverlay` and `useEscapeLayer` return `onTop()` — a layer's own key handler acts only while it is on top.
  The "How to read" guides (ui/GuideFocus.tsx) are dialogs like the rest: the card takes the keys, holds Tab and hands
  them back to its door. A house menu opened from the keys starts on its checked row.
- THE TYPE FLOOR (2026-10-10): no word under 11 px in the terminal; a chart's ticks may be 10. The house grid heads are
  11 px in sentence case, no tracking (houseGrid, index.css). A drawing on a fixed viewBox sets its words through
  ui/svgFloor.ts `useSvgFloor` (in pixels off its own width); past 1.25× it keeps a minimum width and scrolls sideways,
  opened on the spot (`useCentredScroll`). The "How to read" guides' drawings set their words through `ui/GuideSvg.tsx` (useSvgFloor: words 11, ticks 10; on a phone they scroll sideways in the card).
- ONE WAY TO SAY A FIGURE (core/format.ts): the true minus, a sign on a change, prices to the cent, big dollars to three
  figures, percent to one decimal (two under 1%), the greeks, IV, "Oct 9" and "2:03 pm" — every figure goes through it,
  and the rooms' formatters are built on it. Never a toFixed of your own on screen.
- READ IN NEW YORK, PRINTED ON THE READER'S CLOCK (core/nyTime.ts — the one module for it; 2026-10-13 — the owner:
  "show every time on screen (axis, hover cards, labels, wall-move times like "12:25") in the viewer's own timezone,
  detected from their browser, in 12-hour format with am/pm. Never use 24-hour format anywhere in the UI. Change display
  only: all calculations (session open/close, expiry times, UW's time-to-expiry rule) must stay in New York time
  internally, or the pricing breaks"). Every CALCULATION reads the market's day in New York's time (nyParts, nyMinutes,
  nyIsoDate, nyWallTime, nySession — Trace's book, Pinpoint's session, the expiry clock, the field's τ). Every PRINTED
  time is the reader's own zone (the browser's, VIEWER_TZ), 12-hour, "3:35 pm" — clock(at, {seconds, zone}),
  marketClock(16, 0) (a New York time of day on the reader's clock), minuteLabel (a minute of New York's day),
  nyTextClock (a data field kept as New York "14:03:42" text, printed — the field itself stays New York, code parses
  and sorts it; a producer writes it with nyText / nyMinuteText, NEVER with a printer: a print's `time`, a catch's,
  sessionClock.etTime), viewerDay; nyClock, nyStamp and the chart formatters print through clock() (their names are older than the
  rule). NEVER a 24-hour time, never " ET" glued to a reader's time, never a printed time parsed. nyDay names a market
  day (New York's date). The rail's clock is the reader's with its zone (SessionStrip `railClock`). StrikeChart takes
  `nyClock` (legacy: the axis and crosshair, now the reader's clock) and `historyShare` (how much of the opening view the bars fill,
  0.64 by default; Pulse's chart, the four charts, Terrain, Paper and the Backtest 0.88, the Weigher 0.9, so the tape
  runs near the right edge); every one of those passes `nyClock`, and so does the Journal's trade tape. The chart's
  Reset pill stands at the bottom middle, clear of the level tags; the exposure ledger fades where it goes on.
- THE COMMAND LINE (⌘K / Ctrl K, CommandPalette.tsx; the ideas' first pick, Bloomberg's grammar in the house's words):
  a name and a function opens that page on that name ("NVDA flow", "SPY walls", "AAPL chain"); every page has a short
  code of its own (components/layout/commands.ts CODES — one word to one page, the first page claiming it keeps it);
  "SPY alert 480" arms an alert; Actions (rank before Settings rows) and the recents (slayer_palette_recent). It is a
  combobox in a dialog. THE KEYS are one list, components/layout/keys.ts: `?` opens the sheet of the keys that work on
  this page (ShortcutSheet.tsx) and Settings › Keyboard prints them all, from the same list; `/` focuses the page's own
  search; j and k step rows wherever the arrows do (components/layout/rowStepKeys.ts ROW_STEPS); g then a room's letter
  goes to the room (ROOM_KEYS); `MOD` is ⌘ on a Mac and Ctrl elsewhere (the owner is on Windows) — print a chord with
  `modKey('K')` or PALETTE_KEY, never a literal "⌘K" or "Ctrl K". "watch NVDA" puts a name on the watchlist
  (components/layout/watchCommand.ts).
- THE MARKET STORE (context/marketStore.ts, re-exported by MarketDataContext): a reader subscribes to the KEY it reads —
  useActiveTicker, useQuote/useSpot, useSnapshot, useScanSnapshot(ms), useFlowTape, useTickSeq, useNow(ms),
  useLinkedName/useLinkGroups — and the store publishes once a frame: the small reads through useSyncExternalStore, the
  heavy ones as one transition. Work that must run on every tick, even hidden, takes `onMarketTick`. useMarketData() is
  kept for the old readers only — no new reader takes it; keep a tick reader in a small leaf. `useNow` has one timer and
  ONE `subscribe` function per period (an inline one re-subscribed every render and looped). The name the reader last
  had is remembered (slayer_name; Settings › Opens on wins). Live Tape opens with half a minute of backfill from a
  hashed stream — never Math.random there. No Worker: paint and compositing, not script, are the cost now (measured
  2026-10-10: Pulse's script 621 → 414 ms in 20 s, Compass 413 → 228, the Map 371 → 196).
- LINK GROUPS A–D ACROSS THE SHELL (marketStore `setLinkGroup`, components/link/LinkGroupChip.tsx — letters only, None
  by default): Terrain's panes, Pulse's panels, the Weigher's desk and the watchlist; a panel that reads a name joins
  through `useLinkedName`.
- ONE WATCHLIST OF NAMES (data/nameWatch.ts, slayer_watch_names; components/layout/WatchlistDrawer.tsx, a door on the
  rail): sections, flags, price, change and the nearest wall or flip; a press sets the name or a link group's. The
  contract lists stay separate (it links to them).
- READ THIS (components/read/ReadThis.tsx): a panel's own figures said in three short parts — on the panel now, what it
  assumes, and what would change it — from templates alone (data/reads.ts, the rooms' own sentences; TraceBox `read`,
  the Pulse registry's `read`, and the Weigher, Compass and Pinpoint panels). Never a model's words.
- THE GLOSSARY (/glossary, pages/glossary/Glossary.tsx on data/glossary.ts): every word the terminal defines, each with
  its group, its kind (Observed, Calculated, Modeled) and what it stands on. A new term goes in data/terms.ts and gets a
  PLACE row in data/glossary.ts.
- POP-OUTS (pages/popout: /out/pulse/:key — one Pulse panel — and /out/terrain, bare windows in PopOutFrame): the name,
  the link groups and the theme keep in step across one desk's windows (components/layout/deskChannel.ts, a
  BroadcastChannel; the desk is the tab and the windows it opened, sessionStorage slayer_desk_id). A pop-out never
  writes the desk's storage, and each window runs its own simulator, so its prices differ until a feed is connected.
- THE FIRST OPEN OF PULSE offers the four preset desks, one line each (pages/workspace/DeskChooser.tsx), once
  (slayer_desk_chooser). Pinpoint's Map and Targets copy today's levels as a Pine v5 script, a price list or CSV
  (components/levels/CopyLevels.tsx, data/levelExport.ts).
- THE SHELL'S SWITCHES (components/layout/shellPrefs.ts, slayer_shell_prefs): the session strip under the signature
  (on — where New York's day stands, pre-market to after hours, and the time to the next phase), the machine's own
  notification for an alert that fires while the tab is hidden (off until asked; the browser asks its own question),
  and an alert said aloud (speechSynthesis, off). Nothing leaves the machine.
- AN ALERT LIVES PAST ONE FIRING (gex/alertStore.ts): how often it may fire (`repeat`: once, every time, once a bar,
  once a minute), when it ends (`expiresAt`), a snooze (`quietUntil`); after its quiet it is put back on watch from
  where the market stands, so a crossing it slept through is not a firing. An alert may sit on a drawn line (`kind:
  'line'` — touch, break or bounce; a drawing keeps its id once alerted, and saveDrawings moves its alert with it) or
  hold two or three conditions together (`kind: 'all'`, ALL_MAX 3); scripts/alerts-proof.ts runs in `npm test`. The
  fired log is kept on this machine
  (slayer_alert_log, twenty a name, two hundred in all); clearing it is undoable. The drawer is a dialog, opened from
  anywhere through data/alertsDrawer.ts (`openAlertsDrawer` — the bell, a toast, the command line).
- PULSE: the desk renders on its 10 s scan and every panel prints the one live price (`ctx.liveSpot`, `ctx.revision`
  — the tile reads the tick, the book does not), so one name shows one price on one screen; copy a WorkspaceCtx with
  its property descriptors, never by spreading it (the getters are read live). Its Targets, At the wall, Range and
  Close panels read Pinpoint's one book (below). Pulse and the four-chart board wear the house head
  (components/layout/ShellHead.tsx: glyph, the page's h1, one line, facts — no breadcrumb, no tracked caps); the board
  is "Four charts" on the tab, the head, the rail and the command line alike.
- PINPOINT READS ONE BOOK (data/pinpointBook.ts — the call wall read 480 on two pages and 481 on four): one scan a name
  per 10 s (`scanOf`), one book on the whole chain, 30 strikes each side (`bookOf`), every read off it. A page's
  strike window (15, 20, 25 or 30; one pick for the room, slayer_pinpoint_strikes, usePinpoint `useRoomWindow`)
  chooses which rows it DRAWS (`inWindow`), never what they say. "Since the open" is New York's 09:30
  (levelview `sessionCut`). MAGENTA IS THE SUPREME'S ALONE — no other Pinpoint mark wears it. Shared level pieces are
  components/levels/: HowSure (what a level assumes, how fresh its open interest is, where it would sit were the
  dealers' side the other way — data/levelSureness.ts; on Pinpoint's walls, Pulse's At the wall and Targets, and
  Terrain's ladder head as HowSureBook, ProfilePanel `sure`), OiChange (overnight open interest by strike, on
  Building), DealerTimeline (Building's fourth box: net GEX and price's distance from the flip minute by minute,
  data/dealerTimeline.ts) and Glossary (the room's own words, at the foot of every guide that uses them). A day's walls
  and flip, per expiry too, follow the book's own sign rule (core/walls.ts `pickWalls`, `pickFlip`). Max
  pain (data/maxPain.ts) is one plain marked line, never a pull. A level's record counts its misses beside a strike as
  far away (data/levelRecord.ts — "held through 14 of 20 … a strike as far held through 9 of 20"), never a rate.
- TRACE'S DAY BOOK IS NEW YORK'S CASH SESSION (data/flowBook.ts `bookSession`: 09:30 to 16:00; outside it the last
  session, whole) — windows, catches and structures inside it, the caches keyed on their rows. Print kinds are real
  (a block is size in one print; a print with legs is its own kind), P/C is premium against premium. A grid pins its
  who-and-what columns left and its one figure right (TraceBox `pinLeft` / `pinRight`), its sideways scroller sticky
  at the foot of the screen; on a phone a grid gives `phoneRow` (TraceBox `PhoneRow`, two lines) in place of its
  columns. A book page's cut IS its address (components/trace/addressCut.ts `useAddressCut` — validated, written with
  replace, only what differs from the default). The print card says what else a print could be and what "unusual" is
  measured against; Watchers' follow-through counts every flagged print, misses too ("N of M", data/followThrough.ts).
  Dark Pool says where a cross printed, never who traded it or what to do.
- COMPASS TELLS ONE STORY A SETUP (components/compass/campaignStore.ts): the sweep's moment, entry and frozen targets
  are noted once per setup (kept for New York's day in the tab), and the card, table, page head, both charts and the
  Tracker all read `statusOf(recordOf(id))`; "found at" is the sweep's moment (a page no sweep listed says "opened
  at"). The board holds its order under the pointer or the keys. The why-texts are reads, never instructions; the
  kind once called "Quick scalp" is "Quick Scalps" again, the owner's name (2026-10-11; its key stays `quick-scalp`).
- COMPASS'S BOARD FILES EVERY SETUP (2026-10-11 — the owner: "build this in compass UI NO MATH OR BACKEND THIS IS ALL
  UI"; the reference is docs/compass-setups-2026-10-11.md, fixed the same day after the owner's review). The line of
  cards is Expiry · Kind · Option type · Name · Layout, the first three in the board's address (`?exp=&kind=&type=`,
  remembered for the trip back; `type=all` is the default and stays out). Expiry is the house calendar with the
  categories over the month (0DTE, Weekly 1–7, Swing 8–45, Position 46–90, Long-Dated 91+, LEAPS a tag past about nine
  months — calendar days to the LAST TRADING DAY). Kind is two sections, Main and Advanced, and LISTS its setups whatever
  their structure; OPTION TYPE NARROWS WITHIN THE KIND: All types first and every kind's default, then Calls & Puts
  (Steady — the higher-delta legs nearest the money, the engine lists no deep in-the-money strike; Big Payoff — further
  out), Spreads, Premium Selling, Volatility, and the structures that come later, disabled; a kind keeps the type unless
  the type has nothing in it (then All types); a type with 0 in the kind stays listed, greyed, the keys passing it. A
  STRUCTURE FOLLOWS ITS SETUP'S DIRECTION: a call as a long call, a debit call spread, a credit put spread or a
  cash-secured put; a put as a long put or a debit put spread; a long straddle or strangle only from the Volatility
  kind's own setups, never a directional one. A CARD SPEAKS ITS STRUCTURE — the card, the table and the setup's head
  alike: the chip names it on its name ("SPY 470/465 put spread", "AVGO 167.50 put", "SPY 475 straddle") in its lean's
  ink (a put sale bull, a straddle the plain ink); its figures are its own (debit, max loss, max gain; credit, max
  loss; credit, cash set aside; total cost) and its breakeven(s) stand where a single leg's session line and retire line
  do — plain arithmetic of the legs, each leg priced by the engine's estimatePremium, never a model; legs that net no
  premium show no figures. Penny Precision is a put sale's tag alone; Unusual Activity any card's. Top Setups is the
  strongest few across every kind and option type (the best of each type, then the rest), in the sweep's own order;
  expected profit after costs against expected drawdown is the order it will use once the engine gives those figures,
  and the guide says so. NO NAME IS EVER SORTED AHEAD OF ANOTHER FOR BEING THAT NAME (the owner, 2026-10-11: "never put
  any tickers first") — no ticker-first ordering, wording or added names. Quick Scalps lists index products' same-day
  contracts alone, and says so when it holds few or none. Volatility and Events show no short-volatility structure (iron
  condors and iron flies come later); the selling side of event premium is under Premium Selling. THE 0DTE RULE is
  data/expiryClass.ts — read off each name's own listed dates, AM-settled contracts last trade the session before, a
  half day ends 13:00, off hours show the next session's list as "Next session", a 1DTE contract wears Overnight. THE
  STAND-IN MAPPING (listings per name, which lens's setup is which kind, structure and tag) is data/compassStandIn.ts
  alone, to be replaced by the engine; a setup it moved onto a listed date carries the date in its id
  (`…-YYYY-MM-DD[am]`). The landing's Compass films predate this and are stale until re-shot.
- TERRAIN'S OVERLAYS (components/terrain/TerrainLayers.tsx, through StrikeChart's `layer`; both off by default, in the
  pane's Overlays menu): walls through the day — a strike × time heat behind the candles in the pane's lens (GEX,
  Charm or DEX), one cached bitmap an update — and the session's phases (the open, lunch, power hour) as quiet token
  bands on New York's minutes. The trend strip is the pane's timeframe tabs; below lg a Strikes door lays the ladder
  over the chart. Terrain's h1 is its own (sr-only), the page's name.
- THE WEIGHER HAS ONE PRICER: a position's projection is priced by the chain's own estimator from the mark's clock
  (data/positionCurve.ts), so a watched contract's curve starts at its mark. The payoff card shows the model's bell
  under the curve and the chance above or below a price on hover. The chart card's third view is "Vol"
  (components/weigher/VolCurves.tsx): the smile for the chain's expiry and the at-the-money term with each expiry's
  1σ move, read off the chain's own IV.
- PAPER KEEPS WHAT IS OPEN (data/paper/store.ts; docs/paper-rules.md "When the page closes" and "One tab at a time"):
  positions and working orders are saved as they change and as the page hides, and a reload or a tab hand-over carries
  them on, marked on the new load's prices — nothing is closed when the page shuts, and a close the page made never
  counts as an evaluation day. A paper fill is stamped with the name's flip and walls at entry (`lv`), so the Journal
  cuts trades by where they stood. THE BACKTEST CLOCK ONLY MOVES FORWARD (review/engine.ts `floorOf`): a press behind
  it is said, not swallowed, and ReplayStrip shuts its back doors at the floor (`minPos`, why in `minTitle`). Paper's
  chart has the session's phases too, Terrain's quiet bands, off until its Overlays menu asks
  (components/review/DeskShell.tsx). The Journal has three views on the address (`?view=` — the calendar at rest, `today`:
  before the open and how it went, `week`: the week reviewed); its cuts by days to expiry and delta are the Report's
  own (review/engine.ts DTE_CUTS, DELTA_CUTS). The two accounts a first visit gets are named "Starter · practice" and
  "Starter · 50K evaluation" (data/paper/sample.ts) — never "sample".

# The data feed (2026-10-12 — the owner bought Unusual Whales API Basic and Massive Basic; docs/data-feed.md)
- THE UI IS THE OWNER'S; THE FEED FILLS IT (2026-10-12 — the owner, of the feed pages that hid panels and swapped
  layouts: "but i build the UI that the real data goes into"). This rule wins over every feed entry below. With the keys
  in, a page draws THE SAME BOXES, controls, tabs, menus and layout as with them out — the feed changes the figures,
  never the page. No feed variant of a page, no panel hidden, no option dropped, no "not in the feed" line standing in
  place of a panel. Every figure is fed from the real data: what the vendors answer directly, and what the house's
  engine computes (the odds, the range, the close, how a level held, the walls through the day …) is computed by the
  SAME engine on the real inputs (UW's book and history, Massive's two years of bars). Only where no input exists on
  the plans does a figure show "—" — in its own place, its panel standing. A control whose data no plan carries (a 15 s
  bar) stays, disabled, its title saying why. The check: a page with the keys and with them blanked draws the same
  boxes (a structural diff of the DOM's panels and controls).
- THETA DATA IN MASSIVE'S PLACE (2026-10-14 — the owner: "i have a new api key for you to use, you can disable the
  massive ones and use this one"; docs/data-feed.md "Theta Data"). Theta Data answers through the THETA TERMINAL, a Java 21
  program on the owner's machine (`npm run theta:terminal`, scripts/theta-terminal.mjs; .theta/ git-ignored; a restart
  loop scripts/theta-terminal.cmd for Task Scheduler beside recorder.cmd): it is handed THETADATA_API_KEY from .env when
  it starts and serves http://127.0.0.1:25503/v3 — THE KEY IS NEVER IN A REQUEST; the terminal listens on 127.0.0.1
  alone (its own default is every interface); always "127.0.0.1", never "localhost" (its error 476). ONE TERMINAL A KEY:
  a second, anywhere, signs the first out (478 — the proxy says 'no-terminal'). The proxy (server/feed.ts provider
  `theta`) asks NDJSON and answers JSON { rows } with the terminal's field names; 472 is no rows; 471 is the plan. The
  account reads PROFESSIONAL for stocks, options and indices (8 calls at once; the proxy lets 4 out). Limits measured:
  minute bars a month a call, day bars a year a call. Timestamps are New York's wall clock with no offset (data/feed/
  theta.ts `nyStampMs`). Theta's minute bars carry the SESSION's running VWAP — a contract's minute VWAP is folded by the
  proxy from its own trades (/feed/theta-minutes/option; their sizes equalled the bars' volume 391 of 391). Theta's
  end-of-day close is its own 17:15 report: it equalled the official close on 251 of 252 sessions (Oct 13 778.05 against
  778.01) — UW's rows stand over it wherever both carry a date; the official close stays UW's. Read by: Terrain's five
  weeks of minutes and two years of day bars under UW's, and the Backtest's real days (needs ['theta'] alone). The
  Dossier needs UW alone (the company record is UW's /api/stock/{T}/info). MASSIVE IS OFF: its key is handed to nothing
  (vite.config.ts, recorderMain.ts) and commented in .env; data/feed/massive.ts stays for the record.
- THE KEYS STAY ON THE SERVER. UW_API_TOKEN and THETADATA_API_KEY live in .env (git-ignored; .env.example names them;
  MASSIVE_API_KEY is off since 2026-10-14) and are read by vite.config.ts alone (loadEnv(mode, cwd,
  '')), handed to server/feed.ts — the proxy the dev server and `vite preview` mount at /feed/uw/* and /feed/massive/*,
  which adds the key itself (UW a Bearer header, Massive the apiKey parameter). Never a VITE_ key, never a key in src,
  never the old provider layer's "direct" mode; the repo is public. The proxy answers this machine alone
  (FEED_ALLOW_LAN=1 for a phone), GET only, a vendor path only; no key → 503 { error: 'no-key' }; the network refusing
  the host → 502 'network', never confused with a 401; any key scrubbed from what it hands back; a cache per URL by
  what the path is; Massive's five calls a minute through a token bucket that queues. `npm run feed:check` calls one
  route per vendor and prints OK or the failure with its status (behind HTTPS_PROXY, NODE_USE_ENV_PROXY=1);
  scripts/feed-proof.ts runs in `npm test`.
- THE CLIENT is src/data/feed/: fetchers that never throw (client.ts; UW's figures are numeric strings, read with
  num()), the standing of each vendor (status.ts — probed by the shell as the terminal opens, never on the landing),
  polling on the market store's terms (poll.ts `useFeedPoll`: one timer per key, a hidden tab asks nothing), the typed
  routes (uw.ts, massive.ts — every field one a live answer carried on 2026-10-12, docs/data-feed-samples.md). On these
  plans Massive refuses the indices (403); its minute bars stop at the session before.
- ALL OR NOTHING, A ROOM AT A TIME (data/feed/rooms.ts): a room reads the vendors only when every one it needs is up,
  never a vendor's figure beside the house's on one screen. Each room has one seam (pulseSource … weigherSource,
  useRoomSource) and every room's `wired` is false, so every page reads what it read before — a room is moved when its
  pages are rewired against real answers. Settings › Data sources says where each vendor stands, what the plan carries
  and leaves out, and which rooms read it; it never shows a key or a piece of one.
- THE DOSSIER READS THE FEED (2026-10-12; docs/data-feed.md "The Dossier"): `dossier` is `wired: true`; with both
  vendors up every page is THE HOUSE'S PAGE ON THE VENDORS' ANSWERS — NewsFeed.tsx and StockNameFeed.tsx are gone. News:
  UW's headlines as the house's stories (data/feed/news.ts: the kind in the house's words, the house's read run on UW's
  inputs, the map by newsroom.ts `geoOf`), UW's economic calendar, the Earnings board's reports in the month. Stocks: the
  house's board on UW's stock screener (stockDay.ts — one call for the list; the sleeves read off its figures, rolled
  up by stocks.ts `pickOf`), the thirty days off UW's daily bars. A name's page: stockOverview.ts `overviewFrom` run on
  UW's sessions, book, contracts, dark crosses, wire and filed numbers (data/feed/stockName.ts). Earnings: each name's
  record, IV rank and priced move filled (dossier.ts `fillDossier`, `useFeedReportRecords`). Congress, Insiders: filed
  rows, the members' party and seat off /congress/politicians. Committee seats, fair value and guidance are not on the
  plan — "—", or the control disabled saying why. A filing says what was filed; dates as filed, New York's.

- TRACE READS UW (2026-10-12, `wired: true`; docs/data-feed.md "Trace reads Unusual Whales"): every Trace page is the
  house's page on UW's answers — every view, card, column, menu and the print card's session picker, range ladder and
  Single-leg only. The book off /screener/option-contracts; the tape, alerts, multi-leg, Market Tide, dark pool. The
  house's reads run on the vendor's rows: Watchers' six rules (flowBook `rulesFor`) on the vendor's book beside its
  alerts, Net Flow's board (whole names off the stock screener; one expiry, trace.ts `bookNetLeaders` on the contracts),
  Dark Pool's Hedge flow (a cross on an options shelf). A pane draws the vendor's money for its cut (trace.ts
  `useFeedPaneLine`): a minute line where UW answers one, the day's totals off the book where it does not. A floor a call
  needs ($25K tape, $100K alerts, $250K windows, $50K structures, $1M dark leaders) is said, never a missing control. A
  field no answer carries is "—" (Missing.tsx `fig`). UW Basic answers THREE CALLS AT ONCE — server/feed.ts `Gate`. A
  Tracker mark keeps its market (`src: 'feed'`).
- ALERTS WATCH THE REAL PRICE (2026-10-12): while UW answers, the shell's watcher (alerts/AlertWatcher.tsx) judges every
  alert on the market's own figures (data/feed/alertFeed.ts — UW's day state, an index's book price, its book, minute
  bars, prints, wire; a hidden tab keeps asking) and never the simulator; StrikeChart stands aside. An alert armed then
  takes its side from the real price, whatever page set it (gex/alertMarket.ts `spotForArm`); the log keeps the price it
  fired at and its market (`mark`, `market`). UW down: the house's price, as before. alerts-proof covers it.
- THE RAIL'S PRICE FOLLOWS THE PAGE'S ROOM (2026-10-12; docs/data-feed.md): the shell's subject (the rail, the phone's
  strip) reads UW's stock-state on a page whose room reads the feed (data/feed/rooms.ts `pageSource` by the address —
  Trace, the Dossier, Pinpoint and Terrain now, a room wired later on its own), the house's on every other page, a page no room holds
  included (Practice, Settings, the Glossary: Practice marks on the house's book, and the alerts drawer opens anywhere
  with the house's figures). The watchlist drawer's rows follow the same rule (UW's day state and book over a feed page). One poll a name (data/feed/price.ts `useFeedPrice`, `uw:state:<NAME>`, 10 s)
  shared with the rooms' pages; a 429 keeps the last good price five minutes. UW has no index price on Basic (422): on
  every feed page an index is its book's price, the change left off — never the house's figure there.
- COMPASS'S CALENDAR IS THE EXCHANGE'S (2026-10-12): with UW up the board files on each name's real listed dates
  (data/feed/listings.ts, UW's expiry-breakdown, its roots apart — SPX/SPXW, NDX/NDXP, RUT/RUTW, VIX/VIXW AM — the
  dates alone), compass staying `wired: false`: a listed date is a calendar fact, the same in any market, not a market
  figure, so it may stand under the house's setups. Asked two at a time, once a name a New York day
  (slayer_listed_dates); the board waits on its skeleton rather than move its setups. UW down: the schedule.
- PINPOINT AND TERRAIN READ UW (2026-10-12, both `wired: true`, both needing UW ALONE — Massive's minute bars stop at the
  session before and it refuses an index; docs/data-feed.md "Pinpoint and Terrain read Unusual Whales"). The book is
  /spot-exposures/strike, 30 strikes each side of UW's price, in THE HOUSE'S SIGN (gamma, delta and the calls' vanna and
  charm negated, the puts' vanna and charm as they come), its walls, flip and supreme `pickWalls` / `pickFlip`'s; a
  count of open interest dated D is the close of the session before D. A failed poll keeps the last good answer.
  PINPOINT IS ITS OWN PAGES ON THE VENDOR'S FIGURES (2026-10-12, the evening — the owner: "but i build the UI that the
  real data goes into"): no feed variant (pages/pinpoint/feed is gone). Every engine under Pinpoint reads the market
  through one seam, data/bookMarket.ts (the bars, the book through time, the build's open interest, the name, its
  snapshot) — the simulator, or data/feed/pinpointMarket.ts on a Pinpoint address while the room reads the feed, read at
  the call so no other room's page reads it. The SAME engines run on UW's answers: the odds, the range, the close, the
  agenda, the schedule (today's hedge off the session's own listed date), the clock, the records (six sessions of bars by
  date, each session's book at its open off /greek-exposure/strike?date=), the timeline (UW's whole book a minute, the
  flip off the books this terminal read), the crossings and the drift (bars and books paired by time). Building is the
  last COUNTED session, read whole (`buildClockOf`) — open interest is counted once a day, and traded contracts are not
  open interest. The feed's book has no leg texture and no invented volume; a level it does not hold is NaN, printed
  "—" (core/format.ts and every strike formatter print a dash for a figure no answer carried), never spot. "—" in its own
  place: vega, open interest by date, "since the open" before the first read of the day, and for an index (no day state,
  no bars on this plan) everything that stands on bars. Parts are asked on demand (the sessions before only by the reads
  that need them), three in flight at most, a 429 waited out. Keys in and blanked draw the same boxes (a structural diff,
  every page). Pulse is not wired: its Pinpoint panels read the house's book. Terrain's panes read data/feed/levels.ts
  directly (an index pane says its bars are not in the feed). A pop-out probes the feed itself (PopOutFrame).
  UW'S CHARM IS A YEAR'S (its spec: "charm * open interest * 365"; the strike rows stand to the book's as gamma's do,
  checked live): uw.ts divides it by 365 where it is read, so every charm the terminal prints is a day's, as labelled.
  TERRAIN IS THE HOUSE'S PANE, FILLED (2026-10-12; docs/data-feed.md "Terrain: the house's pane, filled"): with the keys
  in a pane draws every timeframe, overlay, compare, lane and switch it draws with them out. UW's minutes over Massive's
  five weeks before them; 1D and 1W off UW's day bars over Massive's two years; range and volume bars folded from the
  minutes; the flow band, net drift and the events lane's prints off the name's prints of $25K and up; dark pool its
  three largest crosses of the session; events its next report off UW's record; the walls through the day and the
  open's ghost off the books read today; the Vol switch and compares off the minutes. Massive is asked only while it is
  up and only for what a pane draws. 15 s stays, held, its title saying no plan carries seconds.
  TERRAIN'S TRAIL ON THE FEED, MODELED POINT IN TIME (2026-10-13 — the owner: "whats wrong with the exposure trails on
  terrian, why doesnt it look like the UI mockup?"; the research, reports/Dealer exposure reconstruction.md §5 and §8).
  No plan carries the book by strike for a time of day, so every minute of today is MODELED — estimated dealer gamma
  (assumed sign), never "dealer positioning" — from what was knowable at it, in ONE module, data/feed/trailField.ts
  (TRAIL_MODEL names every choice; its version rides on every column, `trailMeta`): today's open interest (UW's row
  dated today, static all day) × core/greeks.ts at each minute bar's close ON THE CLOCK AND CARRY UW SOLVED ITS VOLS
  UNDER (2026-10-13, measured on 8,096 prints of six names — docs/research-2026-10-13/uw-vol-convention.md, scripts in
  its tau/; `UW_VOL_CONVENTION`, `uwYears`): European, r 4.15%, q 0; today's expiry on calendar time to its last-trading
  instant (expiryClass closeMinuteOn), a later one on WHOLE calendar days ÷ 365, the same all session — a vol is only
  right on the τ it was inverted with (calendar time to the close missed the next day's gamma by 2–8%; never price
  UW's vols on another clock or carry, and a change of UW's is a new model version), each contract's vol the newest one RECEIVED at or before the
  minute's end (the server's chain reads; before them the session before's close vol, carried fixed-strike); a contract
  with no vol stays out (the strike's coverage drops), a strike with none is a gap. Units: OI × greek × price² (UW's
  /spot-exposures/strike units); the house's sign. NO CALIBRATION: the books UW answered are a MEASURED REFERENCE (the
  hover's readout) and their residual — per strike at the captured times, and against UW's whole-book series (the
  model summed over every strike within 15% and 60 days, a minute a quarter hour) — is one line in the ladder's "How sure" (`fieldResidual`, Sureness `field`). Every cell carries `prov` ('modeled' |
  'carried'), `staleSince` and `coverage` (GexLevel); a stale or carried bead draws dotted (item 5 (g), below).
  THE SCALE RUNS FORWARD, PER SESSION, SQUARE-ROOT (2026-10-13 — the owner: "Use a square-root scale on magnitude
  instead, keep the scale computed per session as of the replay clock, and state the scale in the legend"): a bead's
  strength is √(|value| ÷ the 85th percentile of the per-MINUTE peaks at or before it IN ITS OWN SESSION, New York's
  date — a log-binned running count, whatever the timeframe), drawn in its step (item 5, below), and the legend says
  so — nothing to the right changes the left, and a loud session does not dim the next. TERRAIN'S PRICE AXIS FITS THE CANDLES (the owner, the same day: StrikeChart `fitCandles` — no wall,
  supreme, spot or layer widens it; a focused strike still does). Each column draws its OWN flip (pickFlip, a gap where none,
  never carried) and a chip where a wall moved and held three columns ("CW 780 → 785 · 11:42", the newest three); the
  hover card (StrikeChart `beadCard`) names strike, the time on the reader's clock, the net, its share, the change since the open, the flip
  and the crossings near, the cell's provenance and staleness (a vol stamped after the close — UW's `last_tape_time` then is a batch time, not the print's — is said as "from a print at or before 16:15", `staleBound`), UW's own figure at the strike, the model version; its second line, "Today's opening positions re-priced along the price path, each contract on its latest traded vol". An
  expiry cut models that date's contracts alone. THE SESSIONS BEFORE TODAY ARE DRAWN (2026-10-13 — the owner: "but
  why cant we see the exposure nodes on yesterdays data or the day befores that … we need to plug it in"): the server
  rebuilds a past session from UW's dated history on the same model (server/fieldBackfill.ts — the open interest dated
  the session, the session before's close vols, every traded contract's vols minute by minute from /option-contract/
  {id}/intraday?date=, each knowable at its minute's end, kept when it moved a tenth of a vol point; UW's whole book a
  minute that day), ~1,700 calls and ~3 minutes a SPY session, two calls in flight, the name asked last first, its newest
  session first; kept for good as .feed-cache/field/<NAME>/<D>/past.json.gz (~200 KB). GET /feed/field/<NAME>/past?days=
  asks (answers ready, working, queued, failed), /day/<D> serves one. Terrain asks for the newest ten sessions its minutes
  hold (levels.ts useServerPastSessions, PAST_SESSIONS) and draws each one's regular minutes (09:30–16:00); its trail chip
  says "earlier sessions N of M in" while they come. How far: per-contract minute vols from about 2025-04-01, dated
  chains, minute bars and the whole-book series about two years (measured 2026-10-13); a session older than the minute
  vols is modeled on the session before's close vols alone (every cell 'carried'). The bead card on a past session names
  its date, says its vols were "as traded", and that UW serves no book by strike for a past minute. THE RECORDER IS THE LOCAL SERVER (server/fieldRecorder.ts,
  mounted by server/feed.ts): GET /feed/field/<NAME>?since= watches a name (six at most) and answers what was received
  since; through the session it reads each name's book and UW's whole-book series once a minute, the chain every ten
  minutes (and once on first watch), the session before's close chain once a day — through the proxy's client and
  gate, append-only into .feed-cache/field/<NAME>/<day>/ (git-ignored; the days before kept, gzipped — never deleted, since an unrecorded or discarded minute is lost for good). The pane's line
  ("Trail · it fills as the chain is read", `data-trail-since`) stands only while the field is empty. Pinpoint still
  reads the books read (levels.ts `fieldSnaps`). The events lane's macro dates on the feed are UW's economic calendar
  (news.ts `econMacro`, the high-impact releases, one mark a date), never the house's calendar rules.
  THE TERRAIN AUDIT'S RULES (2026-10-13, docs/terrain-audit-2026-10-13/ — the owner's six items and the table's fails,
  every one fixed the same day): ONE PRICE ON TERRAIN — the pane head, the ladder's Δ spot and spot band, the chart's
  last-price capsule and the rail print the same current price (the stock-state's `close`, one poll a name through
  data/feed/price.ts; Terrain `feedRail(…, liveSpot)`, StrikeChart `quote`); the book's own price belongs in "How sure"
  (feedFreshness: "the hedging is figured by Unusual Whales at 777.88, 6:58 am") and nowhere else. THE FLIP IS THE
  LINEAR ZERO CROSSING (core/walls.ts `pickFlip` on `zeroCrossings`: strike_a + (b − a)·|v_a|/(|v_a|+|v_b|), to the
  cent), never the midpoint of two strikes, and the ladder's spine passes through it; a card's "crossings near" are
  the same crossings. THE CARD SAYS WHAT A FIGURE IS: "Change since the open (6:30 am): −$957M", never a bare "since";
  staleness is `freshAt` and `staleShare` ("vols as traded to 10:38 am · 3% of the strike's gamma on a vol older than
  an hour (oldest 7:17 am)"), never "stale since" the least traded contract; the measured line is named by its
  universe ("Unusual Whales' book (60 days)" / "(every expiry)"). THE RESIDUAL IS LIKE FOR LIKE (trailField
  `fieldResidual`): the model against UW's book on the SAME strikes and expiries — the 60-day book by strike
  (/spot-exposures/expiry-strike for the chain's expiries, read every five minutes by the recorder into books60.jsonl,
  levels.ts FeedBook60) — strike by strike and summed; never against UW's whole-book series or every-expiry book (a
  different universe; "same sign 13% at −1.99×" was that, not a sign flip — checked: the series equals the sum of the
  per-strike book in UW's sign, and the house negates both). A KEY NAMES ONLY WHAT IS DRAWN (ProfilePanel `hasGhost`:
  "at the open" only with the ghost). THE LADDER SHOWS 8 STRIKES AT LEAST: the price axis fits the candles but never
  narrower than eight strike steps (StrikeChart `fitCandles={8 * step}`; the owner: "accept the 8-strike floor"). THE
  DAY TICKS ARE THE VIEWER'S CALENDAR (chartTime `localCalendarBehavior` — the library weighted day ticks by UTC, so after
  8 pm ET the last bar wore the ENDING day's number). THE COUNTDOWN IS TO THE BAR'S END ON THE GRID (`barCountdown
  'grid'` on the feed: the arrival gap was the poll, so it stuck at 00:00). A WALL-MOVE CHIP STANDS CLEAR OF THE CHROME
  (gexNodesPrimitive: clamped under the band, stacked when they would overlap). The duplicate state poll is gone
  (`useFeedDayState` reads price.ts's key). A print tracked with a printed time (05:33–06:02 UTC, 2026-10-13) is put
  back to New York's text on load (WatchContext `nyTextFromPrinted`).
  THE SECOND REVIEW'S RULES (2026-10-13, the owner, of the after-shot — "STOP MAKING MISTAKES … LOOK 100 TIMES"):
  THE FIT IS THE SPAN SHOWN: `fitCandles` as a number floors the FINAL range (the candles with their pad, never less
  than eight strikes), and on a fit the right scale's margins are the measured chrome band's height — the pane head,
  the HEAVIEST row and the toolbar row, and the ladder's head beside it (ProfilePanel's `data-plot-inset`, the same
  frame) — over the pane's height, plus 6 px (StrikeChart `applyFitMargins`, FIT_GAP_PX), never the library's 20%/10%
  (eight strikes became thirteen and a $2 day sat in a fifth of the height; "772–785" was the floor, the pad and the
  margins, by chance the walls). So every strike row, bead line, chip and candle in the fitted range is in the clear;
  a bead under the chrome band or off the pane's foot is not drawn, and a chip whose strike is beyond the clear area
  stands pinned at the edge with "▲"/"▼" before its words ("▲ 785 · 8%", "▲ CW 780 → 785 · 9:25 am"), never on a
  strike it does not name. EVERY STRIKE IN THE WINDOW DRAWS (gexNodesPrimitive `columnAt`: every strike above zero
  since item 5 — the floor is the reader's, off by default; the twelve-heaviest cut is gone — 774 at +$506M, half the
  reference, drew nothing). THE PLOT STARTS
  AFTER THE RAIL: the drawing rail docked left and open gives the chart's box a 56 px left inset (RAIL_LEFT_INSET_PX),
  so no candle stands under it. OPEN INTEREST AS RECEIVED, NEVER AHEAD (trailField `universeOf` / `oiAt`, model
  trail-2026-10-13.4): a column's count is the newest chain read RECEIVED at or before the column's end; before the
  day's first read it is the seed's — the session before's dated count, carried in the seed's fourth element by the
  recorder and the backfill (a seed without it is read again) — and the recorder reads the chain every ten minutes
  from 04:00 New York, so the count UW publishes about 06:45 is in within ten minutes (measured 2026-10-13: the 00:27
  read equalled the seed on 3,094 of 3,094 contracts; the 09:51 read changed 2,186 of them). A count received after a
  minute never moves it (the proof's section 10). A BAR'S CELL IS ITS PEAK MINUTE: on a five-minute texture each
  strike keeps the minute with the largest magnitude (timeframe.ts, GexLevel `at`), with that minute's own vols and
  provenance, knowable at that minute's end and never past the bar's; the card names the bar ("778 · 12:35–12:40 pm
  PDT") and the minute ("The bar's heaviest minute, 12:39 pm · knowable by 12:40 pm"). The chip counts the earlier
  sessions the PAGE has taken in (levels.ts `useServerPastSessions`).
  THE DAY'S COUNT FROM ITS PUBLICATION (2026-10-13, the owner: "a column's open interest must switch to today's count
  based on when UW publishes it, not when our server happened to read it … Live and rebuilt-from-history must produce
  the same field for the same session"; model trail-2026-10-13.5): every column from 07:00 New York (`OI_PUBLISH_NY_MIN`,
  a fixed conservative time — UW's lands about 06:45 — until the recorder's days from 04:00 measure it: the recorder
  notes each day's switch in oi.json, `oiSwitch`) stands on the day's published count, carried by any chain read
  received at or after 07:00 WHATEVER the hour (a read at 09:51 moves every column from 07:00: work()'s key carries
  `oiTodayFrom`); before 07:00 the prior count (the seed's, or a read before 07:00), never reaching past it. The proof's
  sections 10 and 12 (live and rebuilt agree) guard it. THE RECORDER RUNS ON ITS OWN, ALWAYS ON (the owner: "The
  recorder must run on an always-on machine, not in a container that restarts"): `npm run feed:recorder`
  (server/recorderMain.ts — the same feedMiddleware, RECORD_NAMES watched from the start and never dropped, RECORDER_PORT
  5190, the keys from .env), under scripts/recorder.cmd (a restart loop, registered with Task Scheduler at startup on the
  owner's Windows machine) or scripts/recorder.service (systemd); the dev server reads it through FEED_RECORDER_URL
  (feedMiddleware `fieldUpstream`). THE PRIOR CLOSE IS THE OFFICIAL CLOSE: UW's prev_close equals Massive's daily close
  (778.10 for Oct 12); the 3:59 pm bar (778.06) is not the close — never measure the day's change from it. THE NET
  GAP'S SOURCE (docs/research-2026-10-13/uw-vol-convention.md): UW's book at a strike is the sum of its own per-contract
  `gamma` × OI × price² exactly; the model prices afresh at one spot and clock. Split (the owner, 2026-10-13): the
  calls run ABOVE UW's gamma (1% at a day, 13% at seven weeks) and the puts BELOW by the same steps, and UW's own
  put gamma stands 20–30% above its call gamma at the same strike while the chain's two vols agree within 2% — UW's
  `gamma` breaks put-call parity, so it is UW's model or vol source, not American exercise (no dividend inside 60
  days). THE PUTS ARE NOT PRICED AMERICAN and UW's per-contract gamma is never carried (it is not repriced along the
  minute path; a past session has only end-of-day greeks): the gap stays the stated residual in How sure. Today's
  +2% is the spot each contract's UW gamma was figured at (its last print's), not calls or puts.
- THE POINT-IN-TIME STORE AND THE NEXT BUILDS (2026-10-13 — the owner's plan "TERRAIN — NEXT BUILDS, IN PRIORITY
  ORDER", read against the data, then the owner: "Go on all five"; docs/data-feed.md "The point-in-time store and the
  backfill"). THE D−1 SPLIT: open interest is day D's count from 7:00 am New York and D−1's before it; books, greeks and
  vols are D−1 in replay and backfill (`spot-exposures/strike?date=D` and `greek-exposure/strike?date=D` are D's END
  state — Pinpoint's history read the latter as "the session at its open"; since the same day its open is the rebuilt
  field's column on the opening bar, trailModel `openColumn`, the look-ahead test in field-store-proof). TWO ROWS A MINUTE (server/fieldStore.ts): "shown", the column Terrain drew, written by the recorder from
  what it had received by the minute's end, never edited, a minute missed a gap; "final", the rebuild path's column
  (fieldBackfill `today()`), written at each chain read for the minutes a minute behind the inputs asked, equal to
  the session's full rebuild to the cell (one code path: data/feed/trailModel.ts, the model split out of trailField.ts
  with no React and no DOM — the server imports trailModel, never trailField). Shown against final is a TOLERANCE
  (median ≤ 1%, p90 ≤ 5%, walls and flip equal in ≥ 95% of columns, on a gap-free day — `npm run field:agree`), never
  an identity: live holds the last print's vol between reads, the rebuild the minute's midpoint. The scorecard reads
  final rows only. THE REGIME AND THE FLIP STAY SEPARATE (the net of the column and the zero crossing nearest spot
  agreed in 46% of 330 live columns): never relabel the flip "regime boundary", never assert the net's sign is the
  flip's side. THE RECORDER KEEPS the chain's nbbo_bid/nbbo_ask and volume and UW's `_vol`/`_dir` series; a store
  row's straddles are the NBBO mids in a read's minute and the model's price between, `src` says which. THE BEAD
  SCALE'S REFERENCE is one count (data/feed/beadScale.ts) for the renderer and the store. SPX IS OUT of items 2 and
  4 until a price source exists (no SPX price on UW Basic or Massive Basic; UW's SPX series price is rounded to 5
  points; the tape's per-print underlying is the index level with cents — the candidate). THE TAPE'S MINUTE VOLS are
  the minute's midpoint of print vols (it equals UW's `intraday` midpoint to 0.00001), labelled "tape vols" on a
  session built from it (server/tapeBackfill.ts: the archive's signed link through `client.redirectOf`, the zip
  streamed and inflated in memory, never on disk, per contract-minute the lowest and highest print vol in /intraday's
  shape so `compressTicks` is one function for both paths; the job routes every day before fieldBackfill TAPE_UNTIL,
  2025-04-01, through it; an index's per-minute underlying price is kept as .feed-cache/field/<INDEX>/<day>/
  tape-price.json, the one per-minute SPX level on this plan; checked on 2026-10-12: the tape-built columns differ
  from the minute-vol rebuild's by 0.03% at the median, the walls agree in 389 of 390). WEB PUSH IS HELD until the owner decides; the in-app tiers come first. The backfill job
  (`npm run feed:backfill`, BACKFILL_FROM on the recorder) runs at home on the always-on machine — about 1,650 calls
  and 81 s a SPY session.
- ONE RECORDER A MACHINE (2026-10-13 — 29 minutes were written twice by two recorders in one dev server: Vite's
  in-process restart on a server-file change left the old one ticking): the feed middleware stops its recorder when
  its server closes and when a newer one is built in the process (server/feed.ts `close`, globalThis.__slayerFeed,
  vite.config.ts); only the holder of .feed-cache/field/recorder.lock records (stale after three minutes or a dead
  pid); the store re-reads a grown file before writing; a minute in a file twice reads as its first row.
- THE TRACK RECORD (2026-10-13, the owner's item 2; docs/data-feed.md "The track record"): data/feed/trackRecord.ts
  (pure) scores the call wall, put wall, flip and three heaviest strikes on the store's FINAL rows against baselines on
  the same days — B1 random levels (Osler), B2 strike-matched FIXED AT THE OPEN (2026-10-14 — the owner's "Baseline
  levels use only information available at the open"; re-picked every minute it seldom stood a minute: 9 touches with a
  15-minute outcome against 293 on SPY's twelve sessions): the open column's strikes in each real level's distance band
  (within a step of the level's distance from the open's price, either side, the real levels left out), |gamma| under
  THE BAND'S OWN median (the owner's second rule, 2026-10-14: "below the median |gamma| of that band (not the session
  median)" — under the column's median a band near the money was empty, gamma peaking there; config
  record-2026-10-14.2; .3 since 2026-10-15, the walls from the book), held for the session, never counted in a minute it is one of that minute's real levels
  (trackRecord `bandOf`, `strikeMatchedOf`); a cell with NO strike-matched touch still says "insufficient data (…, no
  strike-matched touch)" and prints no rate (this machine's 13 sessions after the rule: SPY 120 B2 touches — flip 68,
  heaviest strikes 52, either wall 0 — against 343 real; QQQ 187 against 367) — B3 the mirror — a level counting only once it has stood a minute, a touch once an
  approach, a bounce the close on the approach side at 15 and 30 minutes, MFE/MAE in points; real − B2 with a seeded
  day-block bootstrap interval and the months won; the regime's next-range by tercile and Baltussen's last half hour.
  Every parameter is server/scorecard.config.json, the variants tried print beside every line, the most recent six
  months are a hold-out evaluated once per config version (server/scorecard.ts, nightly after 4:05 pm on the
  recorder, `npm run field:scorecard`), and a cell under 500 touches or 12 months says "insufficient data" — NEVER A
  BARE HELD RATE. How sure's "Track record" and the hover card on a wall or heaviest strike print the lines
  (levels.ts useTrackRecord, StrikeChart `recordLines`). SPX'S PRICE PASSED THE OWNER'S CHECK (six days, ≥ 99.23% of
  regular minutes within ±0.02% of the day's median SPX-tape ÷ SPY-close): SPX enters items 2 and 4 on the tape path,
  and live its price is the newest SPX/SPXW print's underlying price with its print time, stale past two minutes —
  built the same day: price.ts `loadIndexPrint` (the rail's and Terrain's head's "3:59 pm print · stale" label,
  the alerts' watcher on the same price), the recorder's `readIndexBars` (an index's minutes off its prints, so the
  store's rows stand for SPX), the backfill's bars from the tape's prints for an index on every day (`build(name,
  day, tape)`), the tape reader keeping an index's contracts under the index. Terrain's SPX pane still draws no
  candles (its bars are print-built on the server; drawing them on the pane is a follow-up).
- THE REGIME STRIP (2026-10-13, item 3): StrikeChart's `regime` overlay — a pane of the column's net a bar (trailModel
  `netOf`), lit by the percentile of the same half-hour over the trailing 250 sessions (`regimeBucketOf`,
  `regimePercentile`; the reference `regime.json` built nightly by server/scorecard.ts from sessions before the day,
  read through `regimeBucketsFor` so a session at or after the day never moves it), the chip's words the sign, the
  percentile and "attribution-robust"/"attribution-dependent" against UW's `_dir` (trailField `totalOf`, the sign
  turned to the house's). The flip is never relabelled and the net's sign is never said to be the flip's side.
- THE PRICED MOVE (2026-10-13, item 4; docs/data-feed.md "The priced move"): data/feed/pricedMove.ts (pure) and
  server/pricedMove.ts (`/feed/field/<NAME>/move`). THE DAY'S BUDGET uses D−1 prices alone: the official close (UW's
  daily bar asked by D−1's date; an index its tape's last regular minute) and the at-the-money straddle on D's expiry
  priced AT 4:00 PM — the recorder's last read 3:45–4:00 pm, else the legs' last traded minute to 3:59 pm, else the
  dated chain's NBBO (stamped after the close, to about 5:30 pm — never taken as 4:00 pm's first) — its vol solved at
  its strike on UW's clock, 1σ_day = spot × vol × √τ (straddle ÷ 0.798 on a strike). ±1σ and ±2σ from the prior close,
  "priced at the prior close". THE REMAINING MOVE is the store's live straddle (quotes at a read, the model between,
  labelled), to 0 at the close, never mixed with the budget in one number. THE CONE spreads it by the trailing 60
  sessions' time-of-day profile in 50/68/95% washes, never one hard edge. UW's `implied_move` is 0.85 × the straddle
  (the cross-check divides by it; logged, never shown). The calibration prints each rate beside theory, provisional
  under 60 sessions, and the Wednesday 10:00 am line beside the published 71%, judged against 60–80% from 30. Every
  close it measures to is the OFFICIAL one (server/pricedMove.ts `officialClose`, UW's daily bar asked with twelve rows —
  a date's answer often leads with the next session's), never the 3:59 pm bar; after the close the lines end at the
  4:00 pm bar. A chart primitive maps a bar to the time scale by its time (expectedMovePrimitive `scaleIndex`): the
  candle series holds only the recent window, so an array position is not a logical index.
- THE BEAD SCALE, ITS LEGEND AND DISCLOSURE (2026-10-14, item 5; docs/data-feed.md "The bead scale"): the reference
  is taken over every MINUTE's peak (data/feed/beadScale.ts `minuteRefs` — the renderer's and the store's one count;
  a wider column stands against its last minute's), and Terrain's legend row, always in view while the field draws,
  prints the renderer's own hand-off (gexNodesPrimitive `legend()`, StrikeChart `onBeadLegend`; development asserts
  the newest column was drawn against it): "Full brightness = $X gamma per 1% (session p85 of per-minute peaks, as of
  <time>)", net per strike, clipped above full, the ring's p95. THE BASIS is the pane's (`beadBasis`): Session so far
  (the default; its title says brightness at 10:00 am and 3:00 pm is not comparable), Fixed (the p85 over the 60
  sessions before the day — server/scaleRef.ts `scale.json`, nightly with the scorecard; the loaded sessions where the
  server has none, the count said) or Prior session; a basis with nothing to stand on falls back and says so. TEN STEPS
  A SIDE (`stepOf`, drawn at the step's top; one Path2D an ink, step, staleness and dimming; hairlines at one strike and
  step in touching columns merge into one rect). A RING above the basis's p95. THE FLOOR (`beadFloor`) is off by
  default, a share of the reference, never of the largest bead. STALENESS IN THE MARK: 0 fresh, 1 half or more of the
  gamma on vols older than an hour, 2 carried — core and halo at 1 / 0.8 / 0.6 of their alpha, filled with a dotted
  pattern (two on one off, one on one off), a swelling bead also outlined dotted; never desaturated. The direction-free
  ember/glacier pair keeps its order in greyscale and stays apart under protan, deutan and tritan simulation
  (scripts/bead-scale-proof.ts). THE AXIS (`axisLevels`, Terrain): the book's call wall, put wall and flip, the supreme
  and the field's heaviest strike, pinned as their PRICES in the axis's format on their inks, never a name; beyond the
  clear area at its edge with ▲/▼. How sure's residual is "Model agreement with Unusual Whales (both naive-sign
  estimates)" — never accuracy against real dealer positions. Store rows carry `maxD` (the delta peak).
- THE EXPIRY WINDOWS (2026-10-14, item 6; docs/data-feed.md "The expiry windows"): 0DTE · To Friday · To monthly OPEX ·
  All 60 days at the foot of Terrain's Expiry card on the feed (RailCut 'w:0dte' | 'w:fri' | 'w:opex'; 'book' is "All 60
  days", the default). The model sums each strike by expiry partition in the same pass (trailModel `partOf`,
  `GexSnapshot.parts`, PART_STRIDE) and a window is a view (`windowView`) — never a recompute, never a request; a window
  view leaves out the vols' trade times. The ladder in a window is UW's 60-day book by partition (the recorder's books60
  `parts`, `book60Window`), every expiry with How sure saying so until a read carries them; store rows carry `netP`
  and regime.json `windows`; a window's regime chip names no UW attribution or scorecard range. How sure's header:
  "repriced every minute · all windows". The house's field has no partitions: a window reads the whole book there.
- TIERED LEVEL ALERTS (2026-10-14, item 7; docs/data-feed.md "Tiered level alerts"; WEB PUSH HELD — the owner decides):
  data/levelAlerts.ts (`LevelAlertEngine`, pure, a minute at a time) under components/alerts/LevelAlertWatcher.tsx in the
  shell. A name's watch follows levels by identity (flip, call wall, put wall, top 3, ±σ), set by a right-click on
  Terrain's chart (LevelAlertMenu) and listed in the drawer's Levels shelf. Tier 1 (chime, voice when on, the machine's
  notification while hidden, tag stable per level): A WALL TOUCHED after standing 15 minutes — wall touches alone (the
  owner, 2026-10-14, after the ten-session replay showed the flip the loudest trigger by far: "make a flip cross Tier 2
  with 3 closed-minute confirmation (default). Tier 1 = wall touches only"). Tier 2 (chip): THE FLIP CROSSED and N closed
  minutes beyond — DEFAULT 3 since 2026-10-14 (1 to 5, the reader's pick; a watch that never picked follows the default,
  LevelWatch `chosen`), a wall moving ≥ 2 strikes once held three minutes, ±1σ/±2σ touched. Tier 3 (log): a new top-3
  strike held three minutes (the owner's third rule the same day — "Tier 2 is too noisy … Move 'new top-3' to Tier 3
  (log only). Keep wall moves and flip crosses at Tier 2"), a wall moving under two strikes. Once a minute a level; re-armed after
  half a strike away in a later minute; three Tier-1 in 15 minutes across every name (global), the rest "capped"; inputs
  over two minutes old drop Tier 1 to Tier 2 "stale". Outcomes at +15/+30 on the track record's rules (How sure). A
  replay writes to its own log. Never a trade call in the words.
- THE REPLAY (2026-10-14, item 8; docs/data-feed.md "The replay"): a Terrain pane's replay is a CURSOR (one minute,
  knowable at its end — components/terrain/useTerrainReplay.ts, data/replayFrame.ts) and the pane reads EVERYTHING at it:
  the chart takes the live kind of tape CUT AT THE CURSOR (grown in place as it moves on) and draws it through the live
  code with a rewound clock (StrikeChart `asOf`) — so a replay's frame is the live frame; the levels, the ladder and the
  axis labels are the field's column at the cursor (`frameAt`, the store's own summary), no column → "—", never the
  price. NEVER A READ PAST THE CURSOR: no track record, no calibration, no official close, no live alerts, no live book
  in a replay (charm's walls lens stands empty); a new overlay that reads data must read the cut tape or say why it is
  left out. A recorder session kept whole (`recordingComplete`, /feed/field/<NAME>/recorded/<D>) replays as it was shown
  (the field's replay twin); others as the live chart draws them. The transport (ReplayStrip at the price pane's foot):
  play/pause, a bar on/back to the bar's end (`stepCursor`), 1×/5×/20×/60× the market's own time, Go to (a time typed on
  the reader's clock, `minuteFromText`), a random start (only a session drawable whole, `readinessOf`), hide the future
  (on by default; off, the session's rest faded, read by nothing). Shift ↓ plays/pauses, Shift → steps; Esc ends it. The
  badge "Replay · Oct 13 · 10:42 am" is never shed. The ladder's ghost dots (10 filled, 30 fainter, 60 a ring, on the
  spine's scale) come off the same source the ladder reads — columns in a replay, the books read live — never mixed.
  scripts/replay-cursor-proof.ts (i)–(iii) runs in `npm test`.
- THE SESSION RECAP (2026-10-14, item 9; docs/data-feed.md "The session recap"): a session is over at 4:05 pm New York;
  its recap is BUILT FROM THE OTHER ITEMS' OWN FUNCTIONS, never a second count — the rows by the scorecard's loader
  (scorecard.ts `loadSession`), the levels touched the track record's rows (`touchesOf`; every field but the tercile,
  the strike-matched counts beside, never a rate), the close against ±σ and max σ used the priced move's row
  (pricedMove.ts `calibrationDay`) through the verdict `calibrate` counts (`dayVerdict`), the wall moves the chips'
  function (trailModel `wallMovesOf`), the flip crossings the level alerts' side rule at one minute, the regime path the
  strip's percentiles (quantiles kept in the recap); the browser adds the session's alerts with `outcomesOf` at +15 and
  +30 and the picture — the house's chart off-screen, `takeScreenshot(true, false)` (lightweight-charts 5.2's
  addTopLayer), on the panel's ground, ±1σ held in view, no wall widening the axis. server/recap.ts keeps recap.json
  (a version a figure; built again when an input changed), the recorder builds it at 4:05 pm and 5:05 pm, the watcher
  (components/review/RecapWatcher.tsx) posts it to the paper Journal's day (data/review/recaps.ts — figures in
  slayer_journal_recaps, pictures in IndexedDB), the month marks the day with the candles glyph, a quiet chip says so.
  THE OFFICIAL CLOSE is read from 4:01 pm New York and kept from 4:30 pm; a session's minute bars are kept only once it
  has closed (fieldBackfill `bars`). scripts/session-recap-proof.ts runs in `npm test` — on this machine every recap's
  numbers equal the item-2 and item-4 rows for its session.
- THE CHARM-TO-CLOSE DRIFT (2026-10-14, item 10; docs/data-feed.md "The charm-to-close drift"): every modeled column
  carries `drift` by expiry partition (trailModel `driftToClose`, `driftOf` through a window) — the dealers' delta in
  dollars of the underlying (OI × 100 × delta × price, the field's delta sign: each contract's delta turned over)
  repriced at the drift's end minus at the minute, price and vols held, on the model's own pricer and clock; the end is
  3:50 pm New York (`driftEndOf`, ten minutes before 1:00 pm on a half day), none from then. On UW's clock a later
  expiry's time is whole days, so inside a session only today's expiry moves and every window reads the same — How sure
  says so. ONE NUMBER IN HOW SURE, the owner's label: "Delta to <end on the reader's clock> · mechanical drift,
  unvalidated" — live off the newest column, in a replay off the cursor's. Never a forecast, never more space than that
  until the track record earns it. scripts/charm-drift-proof.ts (full repricing of every contract, gap 0) runs in
  `npm test`.
- THE TERRAIN UI PASS (2026-10-14 — the owner's prompt: "a trader answers five questions in under 2 seconds without
  hovering: regime, nearest levels, how much of the priced move is used, the level's track record, and data age"; the
  decisions after the code was read, docs/terrain-ui-2026-10-14/README.md). ONE σ_remaining: THE LIVE STRADDLE's 1σ to
  the close (pricedMove `sigmaRemOf` — the store's shown rows' straddle, in a replay the cursor's; the strip's distances,
  the axis chips, the ladder's σ column, the hover cards and the cone all read it); the formula σ_day × √(1 − used)
  (`budgetLeftOf`) stands in ONLY where no straddle has been read, said as the budget's; the Priced move box prints both
  as two lines (`remLines`: "Market now ±$X to the close", "Budget left ±$Y") — NEVER ONE NUMBER MADE FROM BOTH. THE
  GAMMA PAIR IS EMBER/GLACIER EVERYWHERE gamma is drawn, the regime strip included (its bars were bull/bear); candles keep
  bull/bear, magenta stays the supreme's, the flip its own; no new hex values. A LABEL SAYS THE MEANING, never the bare
  sign ("calls absorb −$2.1B", never "negative" — in the house's sign a negative net is the calls'). THE KEYS stay the
  house's (P replay, R rail, 1–4 chart count, [ ] walk charts, G go-to, J/K rows) plus T jump to date, W cycle the
  expiry window, L the legend. Bead density: non-level strikes dim to ~25% past one session on screen, walls, flip and
  the heaviest full at any zoom, every strike still drawn. The drawing toolbar shows on hover, on focus-within and
  always on a coarse pointer. The ladder has a Net / Sides toggle, Net by default. The phone keeps the shell's top
  strip. On 1D a bar's cell stays its peak minute; the day panel shows the modeled close column with UW's end-of-day
  book beside it. The coverage bar, blocked ranges and year-long speed budgets wait for the Theta task's Phase 1.
  PASS 2 (2026-10-14, built; docs/terrain-ui-2026-10-14/README.md "Pass 2"): THE HEADER IS ONE ROW
  (components/terrain/PaneHead.tsx) — identity, facts, the Live / data-age chip (paneAge.ts: the newest of the last
  bar's end, the quote and the field's newest column; a shut market says Closed, never stale), the timeframe (the tabs
  with their trends, else the interval as a trigger), the expiry window (0DTE · Fri · OPEX · 60d or a trigger), the
  jumps (Today · 1W · 1M · 6M · 1Y · Max and a calendar: the pane picks the timeframe that fits, StrikeChart `jumpTo`
  shows the range), Replay · Alerts · Layers (ChartToolbar `parts` — one toolbar, three mounts), ? and the doors. A
  MEASURED BUDGET in the Pane (`headPlan`) takes each part in the order a reader gains most while the column pays —
  width in, content out, nothing over the ticks; the rest stands on the hover row or behind its key. THE HOVER TOOLBAR
  ROW IS OUT OF THE FLOW (under the strip, over the plot, only under the pointer or the keys, always on a coarse
  pointer): the chrome band the chart keeps clear of is the header, the strip and the one-line legend (its basis,
  floor and "Every strike" on the hover row). The OHLC row and the HEAVIEST band are gone — the hovered bar's figures
  are a crosshair readout at the plot's top-left (CrosshairReadout.tsx). THE DECISION STRIP (DecisionStrip.tsx):
  Regime · Nearest · Move · Record · Fresh at rest, each a door into How sure at its section (HowSureBook `trigger`
  and `focus`; PopoverCard controlled `open`); it sheds by the column and never cuts a figure. ONE REGIME READING
  for the chip and the box (trailModel regimeReadOf / regimeWordsOf; the chart hands it to the host, `onRegime`;
  the pane reads it off the newest column when the strip is off; the reference and UW's direction are read on the
  feed always). THE AXIS CHIPS (StrikeChart `axisChips`, AXIS_CHIPS_SCALE_MIN_WIDTH 92): CW · Flip · Sup · Top · PW
  as two-line chips on the price axis (the strike, then $ and σ to the close), pinned ▲/▼, stacked apart, never over
  the candles — the library's labels and the in-plot strength chips stand down; a chip's hover is the level's card
  (moves today, held since, touches today — trackRecord `touchCountOf` within 0.05%, the record's line). THE BEAD CARD
  is three lines on hover and pins expanded on a click ("Replay from here", "Pin strike"; Esc lets go); calls/puts and
  σ stand for the newest column alone (the field keeps the net per strike). BEAD DENSITY (gexNodesPrimitive `density`,
  PaneCfg `beadDensity`). THE LADDER: Net by default (tabs Net | Sides), Δ spot and σ in the strike column, the Net
  view a diverging bar with the figure at its tip, the read line's distance in $, % and σ (ProfilePanel `sigmaRem`).
  EVERY FIGURE ON SCREEN goes through core/format. Open for the owner: the wall chips keep the walls' bull/bear inks.
  PASS 3 (2026-10-14, built; the README's "Pass 3"): THE SOURCED STATES — BUILDING / CATCHING UP is a hatched chip at
  the plot's foot (`.stripes`, `data-trail-since`: "Building · the chain is being read" / "Catching up · earlier
  sessions N of M in"); STALE (paneAge 'old' on the feed): the candles at six tenths and the beads at four (StrikeChart
  `stale`, the primitive's `globalDim`), the header's chip and the price in the warn ink, a banner at the plot's foot
  naming the last repriced minute with Retry (poll.ts `refreshFeed` on the bars, the book and the price); NO DATA for a
  day the tape lacks: a centred card with the tape's span and Previous / Next session doors (the chart's `onJumpResult`
  answers a day jump); a shut market is "Closed", never stale. HISTORY: "Back to live" at the plot's foot when the view
  has left the last bar (`onViewEdge`, `jumpTo` kind 'live' → showRecent); on a daily chart a bar's click (`onBarClick`,
  by the bar's slot) opens THE DAY PANEL — the close, the regime, the walls and the flip at the day's last modeled
  column, the three strikes nearest the close, Unusual Whales' end-of-day book beside it (spot-exposures/strike?date=,
  the date's END state, through levels.ts `bookFrom`), "Open this session · 5m" (jumpDate with a wanted timeframe) and
  "Replay this day" (the pane's replay from the day's 09:30). THE KEYS (keys.ts, the ? sheet): T the calendar (PaneHead
  `openDateNonce`), W cycles the desk's window on the feed, L the legend (PaneCfg `legend`, the hover row's Legend door).
  THE PHONE: the controls row stands in the flow as one line that scrolls sideways; the ladder's PEEK at the plot's foot
  (the three strikes nearest the price) opens the ladder; the axis chips pin as on a desk. THE SPEED SCRIPT (the
  README's table, measured 2026-10-14 at 1440 × 900 headless): a pan at 59.6 fps, the hover's readout in 24–48 ms, the
  1Y jump 526 ms, the window switch 148 ms, the timeframe 123 ms, the ticker 216 ms to the header (335 to the strip —
  over the 150 ms budget: a new name rebuilds the pane). The header's small menus close on a pick.
  THE BUILD OF 2026-10-14, SECTION A (the owner's directive after the UI pass; the report is docs/terrain-build-2026-10-14/
  README.md, a section at a time): THE WALLS WEAR THE GAMMA PAIR everywhere a wall is named — the call wall glacier, the
  put wall ember (gex/palette.ts CALL_WALL #7ABDD7 / PUT_WALL #F5C542, paletteInk's tokens, gexNodesPrimitive's inks and
  axisInksFrom, ProfilePanel's inks); BULL/BEAR IS DIRECTION ONLY (the candles, a change, a flow leg, held/broke — `BEAR`
  stands beside `BULL` in both palettes for them). A DAY BAR NAMES ITS NEW YORK SESSION IN EVERY ZONE (chartTime.ts
  sessionDateOf — the session's date read in New York twelve hours on from the stamp; sessionTickMarks, SESSION_TIME,
  the behaviour's `sessionDates`, flipped by StrikeChart with the timeframe; scripts/session-date-proof.ts in `npm test`,
  six zones); the bars effect reloads the series when the new last bar does not continue the one it holds (StrikeChart
  `reshaped` — today stood twice on 1D, the minutes' fold and UW's day row). THE DEPTH TRAP (src/dev/depthTrap.ts, dev
  only): the phone's "Maximum update depth exceeded" did not come back in seven runs; the trap keeps the component stack
  and the panes' registered state when it fires (window.__slayerDepth). THE BEAD-SCALE PROOF names every skipped session
  and FAILS when it read none. THE DEV SERVER READS THE ALWAYS-ON RECORDER BY DEFAULT (http://127.0.0.1:5190 — FEED_RECORDER_URL
  blank; `off` to record itself; a refused port falls back to its own recorder for half a minute), so a restart cuts
  no session.
  SECTION B, THE MAP (2026-10-14; the README's "Section B"): ONE SOLID MARK PER STRIKE PER CANDLE (gexNodesPrimitive —
  the ribbon of translucent, haloed, sub-bar ellipses that read as slivers is gone): a rect on the device-pixel grid,
  the slot's width less a hairline, no halo, pattern or shadow. WHAT A MARK ENCODES (B3): its HEIGHT the strike's GROSS
  gamma (|calls| + |puts|, `GexLevel.gross` — trailModel adds it to every column, the simulator to the house's, the
  peak-minute fold carries it) √-scaled against the SIZE reference (`refG` — since the orbs' second round the session's
  largest node so far, below), its HUE the net's side (ember puts, glacier calls), its COLOUR STRENGTH |net| ÷ gross
  (grey when balanced — `markInk`, STRENGTH_STEPS), a SOFT EDGE for a stale or carried cell and nothing else; no identity
  ink on a mark (no supreme magenta, no wall ink, no p95 ring — the chips name them); the zoom-out rule's "heaviest" is
  by size (`topSet`). THE CHANGE MARKS (B4): a two-pixel tick at the new strike where a wall moves (the ring where a strike
  entered the three heaviest and the outline where one left went with the orbs' second round). THE LEGEND says "size = total gamma at the strike ·
  colour = which side wins · grey = balanced · soft edge = stale"; where a tape keeps no gross (store rows of format 1)
  the mark sizes by |net| and the legend says so. STORE FORMAT 2 (server/fieldStore.ts): cells `[strike, net, gross]`,
  `maxG`, `refG`; readers take the first two figures. NEVER A BLANK WITHOUT A REASON (B1): a run of bars with no column
  wears its cause on the chart (gexNodesPrimitive findGaps, the words from Terrain `gapCause`: before the open / after
  the close, queued / rebuilding / not rebuilt and why / beyond the ten sessions asked, chain not read yet, not recorded,
  live lag · N min); a run never crosses the open, the close or a day; the wall chips keep clear of the labels.
  THE SERIES JOB (B5, server/seriesBackfill.ts on the always-on recorder; SERIES_NAMES=SPY,QQQ,SPX, SERIES_DAYS=730,
  `off`): UW's per-minute spot exposures (_oi, _vol, _dir and the rest, AS ANSWERED) for every session back through
  its window, newest first (today's from 5:00 pm New York), to .feed-cache/field/<NAME>/<D>/series.json — A DAY IS HELD
  ONLY BY ITS OWN series.json (2026-10-15: the recorder's total.json and a rebuilt past.json.gz keep a subset — only
  `_oi` before 2026-10-13 — and counting them skipped the very `_vol`/`_dir` asked for), an empty day written empty, a
  refused call asked again next pass; GET /feed/series on the recorder says where it stands and what is stored;
  scripts/series-backfill-proof.ts in `npm test`.
- THE ORBS (2026-10-14 — the owner's message "NODES: SKYLIT-STYLE ORBS, DONE BETTER", replacing A1, B2 and B3's hue and
  legend lines; the report docs/terrain-build-2026-10-14/README.md "The orbs"). THE NODE IS AN OVAL (gexNodesPrimitive):
  one solid oval per node per candle, centred on the candle and the strike, the cell the bar's peak minute; d = 3 px +
  (85% of the strike row − 3 px) × √(min(size ÷ reference, 1)), height d, width d capped at the candle spacing − 1 px
  (`ovalDiameter`), opacity 0.8 → 1 on the same √ (`ovalAlpha` — the orbs' second round: lower on near-black read muddy); candles closer than 6 px MERGE into one oval of the
  group's peak minute (`mergeBars`: ⌈7 ÷ spacing⌉ bars); whole device pixels, anti-aliased edges; an oval of 6 px or
  more wears a 1 px outline in a darker shade of its own hue; no glow, blur, gradient, shadow or depth — a soft edge is
  STALE and nothing else. HOW MANY: the TOP_NODES (5) largest by size a candle, plus the walls shown and the flip rule
  always; the "Every strike" switch draws every strike. THE COLOUR IS ONE MEANING EVERYWHERE — the ovals, the ladder's
  bars (heatmap.ts HEAT_MODE 'gold-violet'), the legend, the wall chips, the axis labels and the regime strip: GOLD =
  ABSORB (the calls' side, --absorb 232 185 74 / paper 158 114 0) and VIOLET = AMPLIFY (the puts', --amplify 128 100 247
  / paper 91 60 230 — a blue-violet clearly apart from the supreme's magenta; the owner's #7B5CF5 read 4.4:1 on the dark
  panel, #8064F7 reads 4.8), TWO STATES, NO GRADIENT: the full hue, grey where |net| ÷ gross < 0.2 (`BALANCED_BELOW`) — the rails' Colours default to House (TerrainCfg `rails`, the reader's pick kept
  under that key since this build; Thermal stays a pick); the violet darker than the supreme's magenta, the paper pair
  3:1 or better; under data-cvd="blue-orange" a paler gold and a redder violet stand off the blue and orange candles
  (OKLab ≥ 0.13 on the dark ground under protan, deutan and tritan simulation; on paper the dichromat distances close to
  0.03–0.07 and the form carries it — scripts/orbs-proof.ts measures all of it). Ember/glacier stay the clock's pressure
  pair only. LAYERING, back to front: the grid, the ovals, the wall lines (1 px, 40%, in their oval colour, per column),
  the flip's dashed rule, the candles (a 1 px ground-coloured edge round body and wick, on the library's own pixel rules —
  `optimalCandlestickWidth`), the price line, the words. HOVER (StrikeChart → `setHover`): the node under the pointer
  wears a 1.5 px ring in the ink, its strike's whole chain brightens and the rest dims to 60%; A CLICK on a node or on
  the ladder's strike PINS it (Terrain's focus, `onPinStrike`): the chain bright with a 1 px ring on every node, the rest
  at 40%, until clicked again or Esc — a veil and a chain drawn over the cached bitmap, never in it. NO RING OR GHOST for a
  strike entering or leaving the top set (the orbs' second round: "top-5 membership changes too often for them to mean
  anything"); the wall-move ticks stay. THE PILLS: the three
  largest live nodes, "strike · % of the largest" (of the size reference, so the words match the sizes) with an oval swatch, beside the last candle inside the plot; every box on
  the plot (gap labels, pills, wall chips) settles clear of the others and of the library's mark at the bottom-left
  (`settle`). THE LEGEND: "size = total gamma at the strike · ● gold = absorb · ● violet = amplify · ● grey = balanced ·
  soft edge = stale" (Terrain LegendSwatch, the renderer's own inks through legend().inks), then the scale's statement.
  THE ORBS, ROUND 2 (2026-10-15 — the owner, of the 6:34 pm screenshot; the report docs/terrain-build-2026-10-14/README.md
  "Orbs, round 2"): THE SIZE REFERENCE IS THE SESSION'S LARGEST NODE SO FAR (beadScale `RunningMax` / `minuteMaxRefs`,
  the renderer's runMaxG, the tiles' `pre.refG` and `maxD`, the store's `refG` from STORE_FORMAT 3 — no look-ahead): the
  largest is full size, the rest √(size ÷ largest); the Fixed and Prior bases take the largest of their sessions. THE GAP
  NOTES: one a gap, inside it at the plot's foot (or just over the Reset pill's row), never twice, hidden where the gap is
  too narrow. THE LEGEND FITS: its pieces never cut, wrapping between pieces, the full words where the column holds them
  in two lines (LEGEND_FULL_MIN_PX), the short form under it, starting past the drawing rail (StrikeChart
  `useRailLeftInset`). ONE "TOP": the field's largest node now (beadScale `largestNodeOf`) — the axis chip, the first
  pill and the header's Nearest (StrikeChart `onTopNode`); the Nearest names are the axis chips' own (CW, PW, Flip, Sup,
  Top). A DAY TICK NAMES ITS DATE ("Oct 2" — chartTime and nyTime tick formatters). A MISSED CHAIN READ IS STALE: a
  column whose newest read that brought vols (Universe `volReads` — never the open-interest read a past session opens on)
  is more than READ_GAP_MS (15 min) before its end carries `readGap` on every cell (the fold, the window views and the
  tiles' 12th cell figure keep it): the soft edge, "Stale · no chain read since …" on the card, and the Fresh chip in
  the warn ink ("no read since …"). On 2026-10-14 this workspace's recorder read the chain last at 3:29:30 pm New York
  and the books at 3:36 pm (its dev server restarted); the always-on recorder reads every ten minutes to the close.
  THE WALLS FROM THE BOOK (2026-10-15 — the owner: "no hold time fixes it, because the flip comes from the definition
  (the put wall must be below price). Choose walls from the book, not from price's side"; docs/data-feed.md "The walls
  from the book"): core/walls.ts `pickWalls` is the heaviest calls-absorb strike (the call wall) and the heaviest
  puts-amplify strike (the put wall) in the book's window, WHEREVER THE PRICE STANDS — one definition for every room
  (Terrain, Pinpoint, Pulse, the Weigher, Compass's drivers), the scorecard (config record-2026-10-14.3), the level
  alerts, the recap and the replay. A PRICE CROSSING A WALL NEVER MOVES IT: the wall's STATE says it — `broken` after
  three closed minutes beyond it (a call wall closed over, a put wall closed under), `reclaimed` after three back
  (trailModel WallStick, wallStateOn; the plot's chips "PW 772 broken · 10:54 am", the axis chip's third line, the
  card). THE 10% / THREE-MINUTE RULE STAYS for real size changes (WALL_STICK ratio 1.1, hold 3): a new strike is the
  wall only once it has been the raw pick and beaten the held wall's |gamma| by 10% in every one of three closed minutes;
  a held wall that left the window or turned side gives way to the raw pick after its three minutes; the stick starts
  over each New York day. The store's rows keep their raw picks; every reader picks afresh off the cells (`wallObsOfRow`)
  and holds through the one stick. Words that place a wall by the price's side (the heat read, the turned-over lines of
  How sure) say where the price stands against a broken wall instead. The 358-minute count (SPY 2026-10-14): put wall
  13 changes under the old rule, 15 raw under the book's, 0 held; 772 broken 10:54 am, reclaimed 10:57, broken 11:06,
  reclaimed 11:19, broken 11:26. ITEMS 14–17: wall-move ticks are 2 × 7 px at the new strike;
  the pinned axis chips measure the chrome over their own column every tenth frame and stand under it (item 15, not
  reproduced here); the session strip counts to THE CLOSE (4:00 pm New York) through the cash session and the 3:50
  phase is "Closing auction" (item 16); the Fresh chip says what each time is in every form ("OI dated Oct 14 · book
  figured 12:02 pm · vols traded to 12:17 pm", short "OI Oct 14 · vols to 12:17 pm"): open interest carries its DATE
  alone (counted once a day after the close, published before the open); "book figured" is when UW figured the book by
  strike; "vols traded to" is the newest option trade behind the field's vols, moving with each chain read (item 17).
- THE TILES (2026-10-15, the owner's Section I — "Precompute every timeframe (1m, 5m, 15m, 1h, 1D) at rebuild time, so a
  zoomed-out view never aggregates minute rows on the fly … Load by visible range plus a buffer"; docs/data-feed.md "The
  tiles"): a past session is modeled ONCE on the server (src/data/feed/tiles.ts buildDayTiles: the page's model,
  windowView and aggregateSnapshots — never a second fold) into tiles a window × timeframe (1m, 5m, 15m, 30m, 1h, 1D;
  all, 0DTE, Fri, OPEX) with the bars once a timeframe, each column carrying `pre` (GexSnapshot): the session's bead
  references and the held walls AS OF ITS LAST MINUTE, the last minute's net (the regime strip), the window's per-minute
  peaks (prior and fixed bases) and the walls' minute-precise events (the chips). server/fieldTiles.ts writes them
  (.feed-cache/field/<NAME>/<D>/tiles/), on the backfill's save, the Theta rebuild (where UW's own rebuild is not
  there), a sweep on the always-on recorder (start and 4:30 pm) and on a range that asks; GET /feed/field/<NAME>/tiles
  ?tf=&w=&from=&to= and /tiles/days (every tiled day's bar, and `pending`: the sessions it can tile). Terrain
  (data/feed/tileClient.ts) asks the sessions its timeframe shows and the same again (TILE_SPAN: 1m 3, 5m 10, 15m 25,
  30m 40, 1h 60), the next block when the view's left edge reaches the oldest (StrikeChart `onViewFrom`), and behind
  the view the neighbouring timeframes and the other windows; the chart takes them as the tape's `pre` beside today's
  minutes (`bars`, `book`) and never folds them; the page models TODAY alone (useServerPastSessions keeps asking the
  server to rebuild, `model` false) — except in a replay, and where there are no tiles (a cut on a listed date, an
  index, a recorder on older code: the old path). The series is reloaded whenever its bar count moves by anything
  but the one new bar at the end, the view kept on the bar times it showed. ~1 MB a session on disk (all windows and
  timeframes), ~0.9 s to tile one; scripts/tiles-proof.ts in `npm test`.
- THE SESSIONS AND SPX OVERNIGHT (2026-10-15 — the owner, "SPX OVERNIGHT FIELD": "'regular hours only' applies to SPY
  and QQQ. SPX/SPXW options trade nearly 24 hours on Cboe"; docs/data-feed.md "The sessions and SPX overnight"). ONE
  SCHEDULE, core/sessions.ts: an equity's field is its regular hours (9:30 am–4:00 pm, 1:00 pm on a half day) — SPY and
  QQQ draw nothing outside them, the gap labelled "outside regular hours · the field is 9:30 am to 4:00 pm" (on the
  reader's clock); SPX (SPXW folds under it — trailModel WEEKLY_UNDER; the root filter had dropped SPXW from SPX's
  universe) has three: OVERNIGHT 8:15 pm the evening before to 9:25 am (Monday's from Sunday's 8:15 pm, none into a
  weekend or a holiday), REGULAR 9:30 am–4:15 pm (1:15 pm on a half day), the CURB to 5:00 pm (none on a half day). A
  minute's TRADING DAY is its session's (`fieldDayOf` — SPX's from 8:15 pm is the next day's): the recorder's folder, the
  store's rows (session 'gth' | 'r' | 'curb'), the tiles (modelDay), the page's trail (trailField barDayOf, inSessions)
  and every gap (gapSessionKey) follow it. THE TRACK RECORD STAYS ON 9:30–4:00 (scorecard.ts `regular` — a variant
  reading the other sessions is Section D's to register); the live final rows are the regular session's (UW's minute
  vols), SPX's overnight and curb final rows the Theta rebuild's. THE PRICE WHERE THE INDEX DOES NOT PRINT (9:30–4:00 is
  the index's own; overnight, 4:00–4:15 and the curb are not): the forward the front SPXW expiry's at-the-money quotes
  imply by put-call parity, the median of the three strikes nearest parity (data/feed/forward.ts `forwardOf`), and the
  field stands on the SPOT it implies on UW's carry (forward × e^{−rT}, under 0.01% apart overnight — every vol is solved
  at it, so the quotes give the forward back exactly); labelled "price from options (overnight)" (or "(after the close)")
  in the pane head and "price from options" on the rail (price.ts source 'options'). A WIDE QUOTE is over WIDE_VOL, 2 vol
  points of width ((ask − bid) ÷ vega — measured 2026-10-14, gamma × OI weighted within 5%: SPY's regular-session NBBO
  p95 0.85, SPX's after the curb p95 2.06, 5.3% of that gamma over 2); a vol solved from one is `wide` (ChainRow's eighth
  figure, PastDay `wide`), a cell with half its gamma on wide vols wears the stale edge and its card says so (GexLevel
  `wideShare`, tiles cell 13, TILES_FORMAT 3). THE SOURCE: UW carries none of it (checked live 2026-10-14 10:30 pm: its
  per-contract minutes stop at 4:14 pm `rth`, its flow carries the curb with no underlying price, nothing overnight);
  Theta's terminal does — the recorder asks it (server/overnightReader.ts: /v3/option/snapshot/quote, the front
  expiry's strike_range a minute for the forward, every SPXW and SPX quote within 60 days every ten minutes, each mid
  solved at the spot; open interest the recorder's own) whenever SPX is in a session and its index does not print, and
  serves SPX's minutes (`bars`, the options-priced flagged) to the page, which folds them into SPX's tape and models its
  field on them (Terrain `fieldName`). A server with no terminal says so over the empty minutes ("no Theta terminal runs
  on this server's machine"). HISTORY: the downloader asks SPX's roots to the curb's end and both halves of the
  overnight session (chain-quotes-gth1-<E> the evening before, -gth2- the morning, kept under the trading day; the
  front expiry a minute, the rest every five) and logs the oldest day with overnight rows (manifest `first.gth`,
  log.ndjson kind 'gth', the report's line); the rebuild prices those minutes off the forward (bars `src: 'options'`)
  and marks wide ticks; `npm run theta:gth` finds the first date Theta serves overnight rows (sampled twice a month
  from 2014-12, every weekday between two samples that disagree) and how it dates the evening session. `npm run
  spx:night` shoots SPX beside SPY over the night just gone (scripts/spx-night-shot.mjs, two panes, 5m, the desk put
  back). scripts/sessions-proof.ts runs in `npm test`.
- THE THETA PROBE, PHASE 0 (2026-10-14 — the owner's TASK "Terrain history backfill": "Phase 0 = probes only. Report
  results, then STOP and wait for my 'go'. Do not build anything before 'go'"; docs/data-feed.md "The Theta probe"):
  `npm run theta:probe` (scripts/theta-probe/) is ONE SCRIPT THE OWNER RUNS ON THE ALWAYS-ON MACHINE against its own
  terminal — NEVER start a terminal here (one sign-in a key: 478 / MDDS UNVERIFIED), never localhost (476), six calls in
  flight, no date from the docs (the probes' lists), no missing input filled, not between 12:00 and 1:45 am New York,
  format=ndjson on every data call, the heavy probes (T7, T10, T11, T12, X1) outside market hours. It writes
  docs/theta-probe/<date_time>/report.md and results.json after every probe. Items 4a (Theta's SPX as the live price)
  and 4b (the 10:00 am straddle off Theta's quotes) are decided by its X1/X2 and U4/T7 rows — not built before them.
  Phase 1 waits for the owner's "go".
- THE THETA HISTORY (2026-10-14, the owner's section C — "The 13 sessions in your workspace are not my data. My data is
  14 years at Theta. Build it."; docs/data-feed.md "The Theta history"; the report docs/terrain-build-2026-10-14/README.md
  section C). `npm run theta:history` (scripts/theta-history/, scripts/theta-history.cmd its loop) runs ON THE OWNER'S
  MACHINE against the terminal already CONNECTED there — 127.0.0.1 only, never starting or signing into one; 3
  requests in flight in the RECORDER'S HOURS (6:00 am–4:30 pm New York, weekdays — the 7:00 am open-interest switch
  and the session's reads), 7 outside (Theta's 8 is the account's whole limit; one is the recorder's — the owner,
  2026-10-15), none in Theta's gap; the environment may lower these, never raise them; resumable per ticker per day (manifest.json, a
  .part renamed whole); newest first to each feed's first served date; RAW ROWS ONLY (gzipped NDJSON under
  .feed-cache/history/<T>/<day>/ — the 4a/4b choices are the rebuild's); every empty or denied answer logged with its
  URL; report.md after five sessions, PAUSED (exit 3) when the projection exceeds the free disk. `npm run theta:rebuild`
  (server/thetaRebuild.ts) builds the days newest first on THE SAME MODEL (trailModel through the store's rowsOf) —
  vols inverted from the quote mids on the day's DTB3 rate and the model's clock, SPXW folded under SPX, the seed from
  the session before, the extras a minute beside the rows (theta-extras.jsonl) — into theta-final.jsonl, NEVER over
  UW's final.jsonl (`finalRowsOf` prefers UW's); THE TRUST GATE judges a rebuilt day against the recorder's shown rows
  (server/agree.ts `tolerance`) and a FAIL stops the name's walk (theta-trust.json). THETA_REBUILD holds the probe's
  choices (4b quoteClock, 4a spxSource, the rate) with a version — set them from the probe's report and bump it. Neither
  has run against Theta from a workspace; the first real figures are the owner's report.md. Never start a Theta
  Terminal in a workspace (one terminal a key).
- THE BACKTEST READS REAL DAYS (2026-10-12, `backtest` in data/feed/rooms.ts, Theta Data alone since 2026-10-14 — Massive's
  before, `wired: true`; docs/data-feed.md "The Backtest reads real days", docs/review-backtest-rules.md "Real days"). With
  Theta Data up the Sessions page's Days card
  offers Real sessions (the default) or The house's tape; down, the card is not there and the page is what it was. ONE
  MARKET A SESSION, START TO END: the engine asks `marketOf(session)` (data/review/market.ts) for every price — the house's
  tape, or a session's record (`src: 'feed'`, realTape.ts) — never both; a real session whose record is not in moves and
  fills nothing, and its desk says what is being asked or why it cannot come (RealDayDoor), never the tape under it. A
  real session holds the day picked and up to nine sessions after it on the record, two before for the chart; a half
  session is never offered. Few calls, kept for the visit (data/feed/backtest.ts): the picker's two years of day bars and
  a session's minutes are one call a name, its listings one (`as_of` its first day), the strikes one an expiry, a
  contract's own minute trades one a contract, asked when it is opened; a 429 is waited out and said. THE FILL RULE: a
  contract fills only in a minute it traded, at that minute's volume-weighted average (bid = ask = mark, no spread made
  up); between its trades the price is the house's estimate on the name's real price, shown with ≈, and dead; open
  interest is "—". A closed real trade writes its walk and its candles into the session (realKeep.ts — a path a session
  day), so the journal and the report never ask the record again; the journal and the session list say "Real days".
