# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

# Project context (2026-09-30)
- Slayer is UI-only for now: built and run on the owner's localhost, one user (the owner), no backend yet. Nothing is
  promised to anyone, so "live" wording, the sample journal and launch-readiness are not issues to raise.
- All market data is simulated (src/core/simulator.ts). Keys, a data layer and a backend come later. The UI never says
  so (the owner, 2026-10-01): no "simulated", "demo", "fake", "preview", "pretend" or "at launch" anywhere a reader
  can see or hear it — not in a label, a tooltip, an aria-label, a page title or the landing. Paper trading is "paper
  money"; a what-if return is "projected". A "[placeholder]" never shows: company.ts `filled()` leaves an unfilled
  name out, and a legal page shows only the sections that have words (and Contact).
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
  unchanged; a user-chosen candle theme ("Neon") or drawing swatch that is lime by name may stay. Type: Helvetica for
  every word (--font-sans / theme/fonts.ts), tabular figures; no hosted font — but for the landing's display words
  (2026-10-06 — the owner's pick, "Inter Display": Windows has no Helvetica, and Arial has no Light, so every light
  headline drew at regular weight there): the quote, the heads, the prices and the last words wear .landing-display
  (index.css), Inter Display self-hosted in public/fonts (the Latin cut, Light, Regular and Medium, swap, the Light
  preloaded for "/" by index.html), headlines tracked -0.03em. The terminal and every other word stay Helvetica. The only monospace is the drawn wordmark;
  the signature ("slayer:~ $ ● live" — the market's own word, live while it is open and closed when it is shut; live
  wears the moving silver dot and the silver word) and code use --font-code. Product one-liners are nav.ts's (the brand's own); never write grade, score, win
  rate, signal (as a trade call), guaranteed, confluence, market intelligence. Pages outside the terminal (status,
  about, legal, the account forms, invite) use pages/outside/OutsideFrame; the account forms send nothing until a
  backend exists, and signing in opens the terminal. The static icons and og.jpg are drawn by `npm run brand:assets`
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
  acts are scripts/landing-acts/panels.mjs: a panel is as wide as its smallest words allow (8 px → at most 570 px of
  the desk, 7.5 px → 530, measured on the staged page), and clips.json keeps its box (the rooms' hand-over zooms into
  it). The rooms' and the reveal's windows show the panel (TerminalWindow `panel`); a tablet's or a phone's form is
  unchanged. Every film is set in the same open-market minute (AT, New
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
  kinds of tool, a room each, never anybody's product), the full list folded under them. QUESTIONS (each answer folded under its question — a
  disclosure, found by the page's find), then the rooms' glyphs, "Seen enough? / Step inside."
  (LitLines: lit a letter at a time by the scroll) and "Sign up free". THE FOOTER as it is (SiteFooter — never touched
  here). A phone and less motion: the first screen still (FirstScreen), the answer over the terminal itself (Reveal: the
  Pulse film, "The terminal itself, in use — played three times as fast."), the session's head and beats, the rooms as
  tabs. GONE WITH v5: the hero's picture, the four systems' stage and its "more inside" list, the scatter (its words are
  the first screen's), two of the session's five moments. MOTION SAYS WHAT THE PRODUCT DOES: a room's pages resolve into
  the window along its own motion (Boot.tsx `sweep` — Compass dealt, Pinpoint and the Weigher from the middle, Terrain
  and Practice left to right, Trace and Dossier printing down); words come up a line at a time, 40 ms apart
  (useArrival); nothing is hidden before the script has run, nothing moves where less motion is asked for. A window lower
  on the page fetches nothing until the reader is near (TerminalWindow `lazy`); a phone's window shows the phone picture
  whole (390 × 760), never cropped. COMPASS IS THE RECOMMENDED PLAN (2026-10-06 — the owner's directive: "the eye lands
  on Compass first, and every plan shows a price"): raised on a panel (bg-panel, one border), a small "Recommended" in
  sentence case and the page's solid door; Pinpoint stands on the ground with the outline door; on a phone Compass comes
  first. Never "most popular" (we have no member data behind it). Lifetime is off the landing (the owner: "Remove
  Lifetime" — data/billing.ts keeps it for the terminal's Settings); a price says its currency on its own line ("$75 USD /
  month").
  THE LENGTH (2026-10-06 — the owner's directive: "under 8,500 px on desktop and under 10,000 px on a phone", and no
  screen more than 40% empty): 8,427 px at 1440 × 900 (7,748 under less motion), 9,963 at 390 × 844 — the turn's two
  screens cut, the opening's run 80 svh, the session's column ending just under its last beat, the questions folded, the
  sections' padding 8vh (6vh on a phone), and on a phone the first terminal cut at 70svh. Measure again when a run
  changes; the sweep's tools/empty.py measures the empty space.
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
  page, bigger: the root's font size is 16 px × the screen's width over 1920 or its height over 950, whichever is less,
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
  the session holds is never the whole desk at its 7 px, and never zoomed on a level whose call is not up. The beats' picture files are numbered by the run's five (`beat-N` is the run's beat N:
  Session.tsx maps the page's three through PICK — until 2026-10-06 the second and third showed 11:06 and 11:12). On a
  phone each beat carries its own picture, framed on what changed, with the call; under less motion a beat's focus and
  call change at once. Never edit src while it runs (the dev server reloads the desk); the run deletes and rewrites
  public/landing/session, after which a dev server serves those pictures only once restarted.
- THE ROOMS (pages/landing/Rooms.tsx; the rooms and their rows are Landing.tsx ROOMS, so the film script films every
  page a row names — a row with no `path` says what the room's page holds). ON A DESK ONE STAGE (sticky; SEG in svh: the
  deal 12, the wall 12, the wall becoming the tour 12, a room 16). THE SCROLL SAYS WHEN A
  STEP PLAYS, NEVER HOW FAR (the owner's directive, 2026-10-06: a reader who stopped mid-deal saw "a pile of half-dealt
  windows in grain, which reads as a broken render"): the deal and the wall becoming the tour each play whole on a timer once the scroll crosses into them, and backwards once it crosses back (one step at a time,
  a jump across several a little quicker; far from the stage they stand at once) — EVERY SCROLL STOP HELD 1.5 s SHOWS
  THE FINISHED WALL OR ONE ROOM (measured: stops every 4 svh, 1440 × 900 both themes and 1280 × 720). THE WALL — as its
  top row comes up to 85% of the screen the eight are dealt from its middle, 280 ms a card, 60 ms apart (700 ms), each
  name coming in as its card lands, no grain; nothing is drawn before the deal; each slot is a door to its room below
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
