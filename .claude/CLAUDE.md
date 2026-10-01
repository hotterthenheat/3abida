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
  buttons, calendar days that are not expiries, the landing tour's waiting steps, Terrain's receding chrome, Trace's
  breathing Live. The drawing rail stays black on either ground.
- Brand rules (2026-10-01, from the owner's Slayer Logo System / Web and App PDFs): the mark, the 13 product glyphs
  and the wordmark live in src/brand/ (outlines traced from the PDFs — never redraw them by hand). The mark has six
  states (idle, loading, live, closed, alert, offline) read from src/brand/markState.ts; "live" while the market is
  open and "closed" when it is shut, from the same reading as the signature (data/marketState.ts — the owner,
  2026-10-01). No red or green on the mark. Its S pans by transform inside a CSS mask, so it never repaints (keep it
  that way). Below 64 px: no ">" and no brackets. A product's page head wears its glyph (PageHeader, the Compass,
  Weigher and Practice heads and their skeletons); a sub-page (Map, Live Tape, News) keeps its line icon. Holographic
  silver only in the S and on "Launch terminal" (.launch-pill); every other door is the plain ink pill. Type:
  Helvetica for every word (--font-sans / theme/fonts.ts), tabular figures; no hosted font. The only monospace is the
  drawn wordmark; the signature ("slayer:~ $ ● live" — the market's own word, live while it is open and closed when it
  is shut) and code use --font-code. Product one-liners are nav.ts's (the brand's own); never write grade, score, win
  rate, signal (as a trade call), guaranteed, confluence, market intelligence. Pages outside the terminal (status,
  about, legal, the account forms, invite) use pages/outside/OutsideFrame; the account forms send nothing until a
  backend exists, and signing in opens the terminal. The static icons and og.jpg are drawn by `npm run brand:assets`
  (scripts/make-brand-assets.ts); the landing's stills by `npm run landing:shots`.
- Landing films (2026-10-01 — the owner, of the stills: "why are my photos just a photo and dont move so you cant see
  all the features"): every page the tour names is FILMED from the real app by `npm run landing:clips`
  (scripts/make-landing-clips.mjs — the page staged as its still, then worked by a drawn pointer; the page's clock is
  held and stepped a frame at a time, so films are a smooth 30 fps with crisp charts; H.264 MP4, desk 2160×1500, phone
  780×1520; it needs an ffmpeg with libx264, named by FFMPEG). The staging (SEED, PREPARE) is shared with the stills
  in scripts/landing-stage.mjs; each film's words and timings live in src/pages/landing/clips.json, and the still
  under a film is its first frame. The window (TerminalWindow.tsx) plays one film at a time, only on screen and with
  the tab in front; reduced motion, Save-Data, a browser without H.264 and the visitor's pause keep the stills.
  Re-film a page when its look changes.
