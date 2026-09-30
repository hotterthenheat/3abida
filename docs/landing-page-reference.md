# Landing page v1 — reference archive (retired 2026-09-19)

Noah, 2026-09-19: "the one we have right now was something we came up quite a
long time ago and its not up to my standards. the landing page is the heart of
the website, it makes or breaks you." The page at `/` was torn down to a blank
canvas so the new one starts from nothing. This document preserves what it
was, so anything worth keeping can be re-absorbed piece by piece.

The full source lives in git at commit `4ef506f`, the last one holding it:

```
git show 4ef506f:src/pages/landing/Landing.tsx
git show 4ef506f:src/pages/landing/LiveSections.tsx
git show 4ef506f:src/pages/landing/PricingExtras.tsx
git show 4ef506f:src/pages/landing/CodeRain.tsx
git show 4ef506f:src/pages/landing/TiltBox.tsx
git show 4ef506f:src/pages/landing/Reveal.tsx
git show 4ef506f:src/pages/landing/WorkspaceLoop.tsx
```

Pictures, taken at 1440 × 900 the day it came down, are in
`docs/reference/landing-v1/`: `00-whole-page.jpg` (all 8,600 px of it), then
`01-hero`, `02-chart-showcase`, `03-live-engines`, `04-workspace-loop`,
`05-pricing`, `06-faq`.

## What the page was

"Statement-first hero, then the product proves itself: every section below the
fold runs the real panels on the simulated feed." A dark page outside the app
shell (its own error boundary in `App.tsx`), seven files and 1,761 lines,
about nine and a half screens tall on a desktop. One idea carried it and is
the part worth keeping: **nothing on it was a screenshot.** The chart, the
heatmap, the tape and the setup card were the terminal's own components,
running on the simulator.

## Layout, top to bottom

1. **GlassNav** — a fixed floating bar, `backdrop-blur-xl` over `bg-ink/[0.045]`,
   max width 5xl. The wordmark `> slayer_terminal` with a blinking block cursor
   (white here; it only turns holo inside the terminal). Four tabs — Product,
   Engines, Pulse, Pricing — that smooth-scroll to `#showcase`, `#live`,
   `#pulse`, `#pricing`, with a white pill that springs between them on a
   shared `layoutId`. A holo "Launch terminal" button at the right.
2. **Hero**, 94vh (min 620px). Behind the words, **CodeRain**. Kicker in holo
   text: "Dealer-flow analytics". Headline: "See the forces that move the
   market." Sub: "Market makers have to hedge. That hedging pushes price toward
   some levels and away from others — every session, mechanically. Slayer maps
   those forces, then grades the trades." Two buttons: "Launch terminal" (holo,
   glowing) and "See it live" (to `#showcase`). A bouncing "Scroll" cue.
3. **Chart showcase** (`#showcase`), kicker "Charting": "The chart that knows
   where dealers stand." — the real `StrikeChart` in a big frame, live, with
   floating callout chips pinned over it (Skylit's "Atlas" pattern, done live).
4. **Marquee** of fourteen terms drifting sideways: Call wall · Put wall · Gamma
   flip · Supreme strike · Net GEX · DEX · VEX · Pin zones · Dark pool · 0DTE
   levels · Ranked strikes · Expected move · Whale sweeps · Options tape.
5. **Three pillars**, "Price doesn't move randomly.": 01 The walls ("Dealer
   hedging piles up at a handful of strikes — the call and put walls that cap
   and floor the move."), 02 The flip ("Above it, dealer hedging calms the
   market. Below it, it chases the move. Crossing it changes the whole day."),
   03 The flow ("Sweeps, blocks and dark-pool prints — positioning that shows
   up on the tape before it shows up in price.").
6. **The terminal, live** (`#live`): "Not screenshots. The actual panels,
   printing." Four `EngineBox`es in **TiltBox**es, each a real panel with a
   live pill and a door into the app: Pinpoint ("Strike × expiry heat —
   repriced every second", `GexMatrix`), Compass ("Setups graded 0–100, in
   plain English", the top setup card), Trace ("The tape, with the noise
   removed", a mini tape fed by the 1.5s tick), Pulse ("Walls, pin, flip &
   supreme — with distance", `KeyLevelsRail`).
7. **The enter/exit story**, "It calls the fade, too.": one real setup shown in
   both of its states, "same card, opposite call".
8. **Your desk, your layout** (`#pulse`): **WorkspaceLoop**, a miniature desk of
   four real tiles (GEX heatmap, Key levels, Options tape, Top setup) that
   rearranges itself on a loop to demonstrate drag, resize and persist without
   a video.
9. **Community**, "One room.": three seed posts with their likes, name, lean
   chip and handle, and a door to `/community`.
10. **Pricing** (`#pricing`): three tier cards in TiltBoxes, the middle one
    featured with a holo "Most popular" badge, then **ComparePlans** — a
    ladder where each tier inherits the one before it.
11. **FAQ** (`#faq`): no accordion; every question a prompt line, every answer
    its output, all visible.
12. **Closing CTA**: "Trade with the machine, not against it." — Launch
    terminal, See pricing.
13. **SiteFooter** with `home` on (in-page anchors, the launch gate on
    `/pulse`).

## The pricing it showed (the facts survive in `src/data/billing.ts`)

| Tier | Price | It listed |
|---|---|---|
| Pinpoint — "The dealer-GEX terminal" | $125 /mo | Live strike pressure GEX · DEX · VEX; gamma exposure by strike; 0DTE levels and dealer dynamics; Trace + Pulse; Tracker; real-time Discord chat and alerts |
| Compass — "Everything included", featured | $275 /mo | Everything in Pinpoint; Compass; Stocks, News and Earnings; chain momentum; Quant Lab (marked soon) |
| Lifetime — "Everything, forever" | Custom, "talk to us" | Everything in Compass forever; one payment; private 1-on-1 onboarding; early beta access |

Under the cards: "Prices in USD · sign in to check out — access is granted at
payment · cancel anytime". The compare ladder's rows: Pulse, Pinpoint, Ranked
Targets, Trace, Tracker and the Pulse desk, Discord chat and alerts; then
Compass, Stocks, News, Earnings, Vanna and Charm, chain momentum reads, Quant
Lab; then onboarding and early access.

## The FAQ, verbatim

- **Do you offer alerts and signals?** "Alerts, yes — signals, no. Slayer never
  tells you to enter anything. Compass surfaces the setups where the
  confluences line up — structure, flow, volatility — grades each one 0–100,
  and carries a live state: ACTIVE while the thesis holds, WATCH while it
  proves itself, FADING when the structure breaks. Discord pings you the
  moment one appears. What you do with it is entirely yours."
- **Is the data live?** "Yes. Every panel runs on live market data — the tape,
  the walls, the greeks and the dark-pool prints all update in real time
  through the session."
- **What makes Slayer different from other GEX tools?** "Every GEX tool can
  draw a flip and a wall — the structure itself is table stakes. Slayer's
  difference is everything after the map: it reads structure, tape, dark pool
  and volatility as one confluence, weighs the actual contracts against it,
  keeps reading the idea live while it plays out, and keeps its own record on
  the page — every state change a setup goes through stays visible. The map is
  a commodity. An engine that stands behind its reads isn't."
- **Do I need to be an options expert?** "No. Every page explains itself in
  plain English — what a wall is, why the flip matters, what dealers are
  forced to do at each level. Real trading terms stay; jargon and buzzwords
  were deliberately purged."
- **Can I cancel anytime?** "Yes — subscriptions are month to month and stop at
  the end of your billing cycle, no questions. Lifetime is a single payment,
  forever. Billing questions: info@slayerterminal.com."

## Mechanics worth keeping (hard-won)

- **The live block wakes late.** One scan context (`LandingCtx`: snapshot, gex,
  matrix, exposure, pulse, setups) feeds every demo, and it only starts once
  the block is near the viewport, so a reader parked on the hero pays nothing.
  Same two-tier cadence as the terminal: a 10-second structural scan, a
  1-second heat pulse, the tape on the 1.5-second tick.
- **Skeleton first.** Until the context exists, four pulsing boxes at the
  panels' own height (340px) hold the layout.
- **CodeRain**: DOM columns and one CSS mask, GPU-cheap. The cursor is a
  flashlight, the only place the code turns legible; it eases shut on leaving
  the hero. Tints are decoration-tier (muted steel and moss), never the
  semantic tokens, "so the rain can't impersonate live data". Reduced motion
  freezes it to a dim static field. The hero copy is `pointer-events-none` so
  it never blocks the flashlight; the buttons re-enable their own.
- **TiltBox**: mouse-tracked perspective with a moving glare and a lime edge,
  no runtime cost, content inside keeps running. It clips overflow, so a badge
  must live INSIDE the card, never straddling the border.
- **Reveal**: drift up and fade in once, the first time in view; scrolling back
  never replays it; reduced motion respected through `MotionConfig`.
- **The launch gate**: any link into the terminal (`/pulse`) plays
  `useLaunch().launch(to)` instead of jumping. `LaunchTransition` is ALIVE and
  the blank canvas still uses it.
- **WorkspaceLoop**: the way to demo drag and resize without a video.
- A hotter demo-only colour scale for the landing's heatmap, because the real
  page normalises against one heaviest cell and the miniature looked flat.

## DO NOT CARRY OVER — rulings the old page breaks

- **No grading in public** (Noah, 2026-09-19: "we do NOT grade or score any of
  our cons in public. thats for our own backtesting and backend information").
  The old page says it four times: the hero's "then grades the trades", the
  Compass box's "Setups graded 0–100", the FAQ's "grades each one 0–100" and
  "keeps its own record on the page… an engine that stands behind its reads",
  the tier's "graded setups". None of that returns. Where the site must
  describe a read, the public words are **strong · good · caution · poor**,
  and the engine's record stays internal.
- **No refunds** is policy (2026-09-17). "Cancel anytime" may stay true, but
  the page must say plainly what it does and does not refund.
- **"Is the data live? Yes"** is a licensing statement. It is only true to the
  extent ThetaData's contract says so (launch-costs chapter 2); write it then.
- **Quant Lab / the backtester** is gone (Prove It was deleted 2026-09-17).
- **Discord** chat and alerts were a promise of the old plan; confirm before
  it appears again.
- The prices ($125, $275, custom) predate the launch-costs walk. Re-decide.
- Plain English holds here harder than anywhere: "confluence", "table stakes"
  and "commodity" in the FAQ would not pass the rule today.

## What the teardown left behind

- `/` is a blank canvas (`src/pages/landing/Landing.tsx`): the wordmark, one
  line, the door into the terminal through the launch gate. No claim of any
  kind is on it.
- **Orphaned but kept**: `src/components/gex/GexMatrix.tsx` (only the landing
  mounted it; its cousin `pulseMatrix` still feeds the Pulse desk).
  `KeyLevelsRail`, `StrikePressureLadder` and `StrikeChart` are used elsewhere.
- **The footer still points at `/#pricing` and `/#faq`** on every terminal page
  (`SiteFooter`, and its `home` mode). Those anchors come back with the new
  page; until then the links land on the blank canvas. The price facts live in
  `src/data/billing.ts` and Settings › Billing.
- CSS the landing used and the app still uses stays: `holo-bg`, `holo-glow`,
  `holo-text`, `animate-cursor-blink`.

## The direction agreed for v2 (2026-09-19, before any layout)

Minimal layout, flat surfaces, glass only where a card floats over the live
product, no neumorphism. The product is the hero: real components, not
screenshots. Designed phone-first, because the paid traffic arrives from X on
phones, with short cropped loops of single panels for mobile. No refunds means
the page itself must let a visitor try before paying: a live sandbox with no
sign-up. No performance claims and no grades. Pricing on the page. First
decide the one sentence the hero says and what its single button does.
