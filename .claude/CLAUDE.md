# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

# Project context (2026-09-30)
- Slayer is UI-only for now: built and run on the owner's localhost, one user (the owner), no backend yet. Nothing is
  promised to anyone, so "live" wording, the sample journal and launch-readiness are not issues to raise.
- All market data is simulated (src/core/simulator.ts). Keys, a data layer and a backend come later.
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
  buttons, calendar days that are not expiries, the landing tour's waiting steps, Terrain's receding chrome, Trace's
  breathing Live. The drawing rail stays black on either ground.
- Brand rules (2026-10-01, from the owner's Slayer Logo System / Web and App PDFs): the mark, the 13 product glyphs
  and the wordmark live in src/brand/ (outlines traced from the PDFs — never redraw them by hand). The mark has six
  states (idle, loading, live, closed, alert, offline) read from src/brand/markState.ts; "live" only once a real feed
  calls setFeedLive — the simulated feed never does. No red or green on the mark. Its S pans by transform inside a CSS
  mask, so it never repaints (keep it that way). Below 64 px: no ">" and no brackets. A product's page head wears its
  glyph (PageHeader, the Compass, Weigher and Practice heads and their skeletons); a sub-page (Map, Live Tape, News)
  keeps its line icon. Holographic silver only in the S and on "Launch terminal" (.launch-pill); every other door is
  the plain ink pill. Type: Helvetica for every word (--font-sans / theme/fonts.ts), tabular figures; no hosted font.
  The only monospace is the drawn wordmark; the signature ("slayer:~ $ ● simulated") and code use --font-code. Product
  one-liners are nav.ts's (the brand's own); never write grade, score, win rate, signal (as a trade call), guaranteed,
  confluence, market intelligence. Pages outside the terminal (status, about, legal, the account forms, invite) use
  pages/outside/OutsideFrame; the account forms send nothing until a backend exists and say so. The demo band sits
  over every terminal page and sets --demo-band; a page sized to the screen subtracts it. The static icons and og.jpg
  are drawn by `npm run brand:assets` (scripts/make-brand-assets.ts); the landing's stills by `npm run landing:shots`.
