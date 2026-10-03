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
  The moving holographic silver only in the S, the signature's live dot and on "Launch terminal" (.launch-pill); every
  other door is the plain ink pill. THE ACCENT IS SILVER (the owner, 2026-10-02: "remove all lime/green accent color it
  should be holographic silver"): no lime anywhere — the Logo System's lime Live is overridden. --select, --select-fill
  and --live-* (theme/tokens.css) are the silver family: the pale silver on black, the deep steel as an ink on paper,
  a silver highlighter with the dark word as a surface; a canvas or chart option reads them through
  readToken/resolveInk. Up-green and down-red (--bull/--bear), the supreme's magenta and the other data colours are
  unchanged; a user-chosen candle theme ("Neon") or drawing swatch that is lime by name may stay. Type: Helvetica for
  every word (--font-sans / theme/fonts.ts), tabular figures; no hosted font. The only monospace is the drawn wordmark;
  the signature ("slayer:~ $ ● live" — the market's own word, live while it is open and closed when it is shut; live
  wears the moving silver dot and the silver word) and code use --font-code. Product one-liners are nav.ts's (the brand's own); never write grade, score, win
  rate, signal (as a trade call), guaranteed, confluence, market intelligence. Pages outside the terminal (status,
  about, legal, the account forms, invite) use pages/outside/OutsideFrame; the account forms send nothing until a
  backend exists, and signing in opens the terminal. The static icons and og.jpg are drawn by `npm run brand:assets`
  (scripts/make-brand-assets.ts); the landing's stills by `npm run landing:shots`.
- Landing films (2026-10-01 — the owner: "why are my photos just a photo and dont move", then "it should just be a
  cursor make it a sped up version of you actually using the desk"): every page the landing shows — the hero's desk and the
  four systems (scripts/landing-stage.mjs ALL_PAGES: every `path` in Landing.tsx) — is FILMED from the real app by `npm run landing:clips` (scripts/make-landing-clips.mjs): the page staged as its still, then USED by a plain
  arrow pointer at three times the page's speed — menus opened and picked, timeframes, desks and sides switched, a name
  typed, a price dragged, a day opened — and everything it changes is changed back, so the film loops on its first
  frame. No words, ring, bar or pause button over a film. Every film is set in the same open-market minute (AT, New
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
  the pages the landing stopped showing went with the rebuild of 2026-10-03 (git keeps them). A reader passes a window in seconds, so an act shows its page's features
  from its first seconds. A live page never ends exactly where it began, so a take whose loop jumps is filmed again
  and the best take kept: the Compass board re-ranks every 10 s of page time and can end on another order, and SPY sits
  near its flip at AT, so the dealers' word can turn. Live pages
  move under an act: a menu's choice is made again by its words, not its place; a press that must not land on something
  (Compass's chosen card, whose second press opens its page) names it in `unless`; a pick that sets the page's focus
  is undone by letting go of the focus, not by picking again. Never edit src while a run films: the
  dev server reloads the pages being filmed. Re-film a page when its look changes, check its act still finds what it
  presses (the run says when a beat found nothing), and check each film's first and last frames side by side.
- THE LANDING, REBUILT (v4, 2026-10-03 — the owner's brief: "SHOW THE PRODUCT. DO NOT EXPLAIN THE ENTIRE PRODUCT …
  YOU CAN PUSH BACK AND USE UR OWN LOGIC"; the visitor should finish it thinking "I understand what this is, but I still
  need to see inside"). ONE QUESTION A SECTION, in the order a visitor asks (pages/landing/Landing.tsx): WHAT IS THIS? —
  "SLAYER TERMINAL", "Trade what you can see." ("see." in the foil), "Positioning, market structure, volatility and flow
  — brought together in one terminal.", "Sign up free" and "See how it works" (to the session), then the terminal
  itself: the Pulse desk's film as wide as the column, "The terminal itself, in use — played three times as fast." under
  it. WHY DOES IT MATTER? — "Most of what moves a price is public. It's just scattered.", shown (THE SCATTER, below).
  SHOW ME — the session (below). WHAT ELSE CAN IT SEE? — the four systems, Compass, Pinpoint, Terrain and Trace
  (Landing.tsx SYSTEMS) on ONE STAGE (below): a name, one line, the real page's film, a small door each; under it the
  terminal's other rooms, a door each in their own one-liners (Landing.tsx More, from brand/products.ts — never as `path:`
  literals in Landing.tsx, or the film script would film them). CAN I
  TRUST IT? — four principles (real data, deterministic calculations, transparent provenance, no black-box promises)
  and Observed / Calculated / Modeled: what the engine produces, never a formula, weight, threshold or assumption that
  would let it be rebuilt ("Recipe stays private. Result is visible."). HOW MUCH? — three plans, each with who it is for
  and the one difference; the full list folded under them. LET ME IN — the buyer's questions, then "See the market. Then
  trade it." (LitLines: lit a letter at a time by the scroll) over "Sign up free" and "Enter the terminal and see it
  yourself." GONE WITH v3: the tour of eight rooms and its turning ground, "Everything in it" (every page of every room
  — "a documentation index", the brief's words), the products menu of every page, the hero's row of rooms, the brand
  sheet's giant mark (the owner: "why genuinely is this a main part of the landing page?" — a logo the size of the screen
  tells a new visitor nothing; the product goes there), the dock (Wall.tsx) and the films of pages the page no longer
  shows. EVERY LINE UNDER A FILM SAYS WHAT THE FILM SHOWS: Compass is the board of contracts that fit the levels, so its
  line is "Know which contracts fit the market right now." (the brief's "know the current market condition" is
  Pinpoint's head, not Compass's screen — pushed back and told); a page that changes takes its line in SYSTEMS with it.
  MOTION SAYS WHAT THE PRODUCT DOES: each system's page boots into the stage's window along its own motion (Boot.tsx
  `sweep` — Compass dealt a strip at a time, Pinpoint opening from the middle, Terrain drawn left to right, Trace
  printing down); words come up a line at a time, 40 ms apart (Landing.tsx useArrival); nothing is hidden before the
  script has run, nothing moves where less motion is asked for. A window lower on the page fetches nothing until the
  reader is near (TerminalWindow `lazy`); a phone's window shows the phone picture whole (390 × 760), never cropped. No
  plan's door is drawn heavier than another's (that would be "most popular" by another name).
- THE LANDING'S SCALE (2026-10-03 — the owner: "i think the entire lading page is too zoomed in"; it was 1,360 px of
  words, a 107 px headline and every window taller than the screen): THE COLUMN IS A WINDOW THE SCREEN HOLDS WHOLE —
  as wide as a terminal window whose whole height stands on the screen under the bar (index.css [data-landing]
  --landing-col: the picture's 1440 × 1000 and its 42 px bar, 140 px of the screen kept; never more than 1160 px of
  words nor less than 820). The Wrap, the open bar (32 px narrower) and the footer's words all read it, so the words and
  the windows share their edges on every screen and every window is the column's width; the session's picture runs on
  past the column to 24 px short of the screen's right edge, so the demonstration does not shrink with it. The type a
  step down (the headline min(5.6vw, 10svh) up to 84 px, heads 50, the systems' lines 44, prices 44) and the sections'
  air a little less. THE HERO BOOTS (the same day — "the landing page is missing something like that snazz"): once a
  visit, as the page opens, the hero's window comes up out of the footer's photograph — its own still in coarse pixels
  (each the block's strongest mark: the brightest on black, the darkest on paper), only the strongest at first, a hair
  of red on one edge and blue on the other, a row or two torn aside — and sharpens to the desk in 1.1 s
  (pages/landing/Boot.tsx, TerminalWindow `boot`; it begins 320 ms in, once the window has risen into view); the headline settles out of the same fringe as it rises (index.css
  .landing-fringe, on `translate` so it adds to the rise). Never again on a return within the app, never under reduced
  motion, never in a tab behind, and not at all if the still takes over 1.2 s to come (the window never waits on its own
  entrance; it gives way 1.2 s in if it has not begun). The window holds its film on the first frame until the canvas
  has gone (Boot `onDone`), so the hand-over is seamless. The headline's fringe is a pair of drop-shadows of the drawn
  line (a text-shadow washed the foil's "see."). It is the hero's alone; the rest of the page keeps its arrival clips.
- THE GLITCH, IN MORE PLACES, AND THE WOW (2026-10-03 — the owner: "i love the little glitch affect i think we should
  implement that in more places but infomation and hiecrcy wise i still feel as if were missing that wow"). The footer's
  photograph is the landing's one way of drawing a picture broken (pages/landing/pixels.ts: a PIECE of a picture drawn at a
  sharpness 0–1 — coarse pixels, only its strongest marks, the red and blue fringe — through eight states to the picture
  itself), used for: the hero's boot; THE SCATTER (pages/landing/Scatter.tsx — WHY DOES IT MATTER, shown: the Pulse
  desk's own parts, cut from the hero's still at their measured boxes (PARTS; restage the desk and re-measure them), lie
  about a pinned screen broken into the footer's grain, each named in its own panel's words, around "Most of what moves a
  price is public. / It's just scattered." (the second line itself out of line, fringed); the scroll draws them home into
  one window, sharpening as they land, the bar types "open pulse" and "Slayer reads them together — on one screen, while
  the session moves." follows; a fast scroll tears a row; the session then plays on that desk. Where less motion is asked
  for, the words alone (Landing.tsx Matters)); THE STAGE (Landing.tsx Systems — the four as a player and its list: the
  window on one side running to the screen's edge, the list of four (number, glyph, name, line) on the other, the one on
  screen bright with a silver line filling under it and what it does and its door beneath; a tablist (arrows, Home, End).
  It plays itself a page every 6.5 s while on screen with the tab in front; a moving pointer holds it until still 2.5 s,
  the keys inside hold it, a touch holds it 3 s after the finger lifts, a pick holds it until the stage leaves the screen.
  The window (TerminalWindow boot="switch") boots each page as it is first seen and on every switch, holding the film on
  its first frame till the boot has gone. A phone: the four two by two, the line over the window, what it does under it.
  Less motion: no play, no boot). And as accents: every section's head arrives a line at a time and its two-tone line
  settles out of the fringe (Landing.tsx Head, index.css .landing-settle); the session's silver marks flicker in with it
  (index.css session-mark-in); the closing lines' unlit letters wear the footer's words-at-rest fringe and lose it as they
  light; a room's glyph under the pointer slips its fringe once (index.css landing-glyph-glitch). The glitch is for
  arrivals, switches and a hand's touch — never a loop.
- THE SESSION (pages/landing/Session.tsx; `npm run landing:session`, scripts/make-landing-session.mjs): the brief's one
  "killer" demonstration — "Look at what the terminal was able to show", never "Slayer predicted the move". The real
  Pulse desk, opened at 09:31 New York on 2026-10-01 and run forward with its live ticks drawn from a seeded stream
  (Math.random seeded in every frame, the page's clock held from the first moment), so a run is the same run on either
  theme every time (measured, tick for tick); a picture and a reading at every 20 s step — price, walls, flip and the
  heaviest strike (data/gex.ts buildLevelsFor, what the desk reads), Compass's top cards, where each stands on the desk.
  Five beats are picked by hand (BEATS in the script) and EVERY WORD OF A BEAT IS READ OFF ITS PICTURE (session.json
  `readings`): 09:32 Before (SPY 470.29, the call wall at 475), 11:06 Positioning shifts (the heaviest strike swings
  from the 475 calls to the 470 puts), 11:12 Compass updates (the SPY 475 call its top pick), 11:22 The level moves
  (through 475, the call wall to 477), 13:32 Price meets the level (475 the put wall from 12:22, price back on it). NO
  DATE IS PRINTED: the brief asked for "real historical data … dates", and the terminal has none until a feed is
  connected — the owner was told; re-take the session from a real day then (`READ=1` prints a run's readings), pick its
  beats and rewrite their words. On a desk the scroll is the playhead: the window holds a beat's full-size picture with a
  silver hairline round what changed, then plays every step to the next beat; on a phone each beat carries its own
  picture, framed on what changed; where less motion is asked for, a beat changes the picture at once. Its pictures load
  only when the reader comes near (the beats' own first). Never edit src while it runs (the dev server reloads the desk).
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
