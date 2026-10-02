# Landing and footer notes — Eclipse Space and Yu-Hsin Lin (2026-10-02)

The owner, 2026-10-02: "take notes from this landing pages and footers... https://www.yuhsinlin.com/ and
https://www.eclipse.space/". The skylit.ai rule holds: "dont steal just get inspired". Their words, layouts and marks
are theirs; what transfers is the thinking.

**How these notes were taken.** The owner allowed both hosts, so each page's HTML, its custom CSS and its custom scripts
were read whole: every word, the structure, the footers' markup and the code behind every movement. Their stylesheets,
pictures and films are served from Webflow's CDN (cdn.prod.website-files.com), which is still blocked, along with jQuery
(d3e54v103j8qbb.cloudfront.net) and the GSAP plugins (cdn.jsdelivr.net). So the type scale, the spacing and the films
themselves were not seen; how things move and react was read from their code.

## Eclipse Space — eclipse.space

A satellite-constellation company, site by the studio Omoi, on Webflow with GSAP (ScrollTrigger, Flip), Lenis smooth
scrolling and SplitType. Black, white and light grey; one typeface (GT Mechanik).

The page, top to bottom:
1. **Arrival.** The logo's strokes come in one after another, hold for 200 ms, then the logo flies into the navbar (GSAP
   Flip) as the bar fades in. Behind it a film of the corona that **plays as you scroll** (the scroll position is the
   film's playhead; seeks are gated so it never steps). Two small lines: "Designed by us" / "Owned by you". At the
   foot, **LOCAL TIME**, a live clock beside a location marker, and "Space infrastructure is finally within reach."
2. **A statement read by scrolling.** "For anyone with a mission to run. Eclipse builds the system. You own it." Every
   letter starts pale (#eaeaea) and turns black in step with the scroll, one character at a time, so reading the line is
   the scroll. The "o" of "mission" is the live corona.
3. **The globe**, also played by the scroll: "A whole constellation you own outright. No dependencies. No conditions."
4. **Tabs that play themselves** with a progress line (satellites, ground infrastructure, user terminal, launch): "We
   deliver the system. You operate it."
5. **What you get**: 01 Control, 02 Speed, 03 Scale, 04 Reliability, one plain paragraph each.
6. Team proof, then the ask, then the **closing line at display size**, "Designed by eclipse. owned by you.",
   **sliding sideways as you scroll**. It is a marquee the reader drives, not a timer. The promise opens the page and
   closes it.

**The footer**:
- A film of the corona behind it, cut separately for desk and phone; on a phone it is masked so it fades in from the top.
- One line, "Own your own future."
- Three short link groups (Company, Technology, Connect). Hovering one dims its other links to half, and a 5 px marker
  grows in front of the hovered link (cubic-bezier(.16, 1, .3, 1)).
- The legal row.
- **Three orbit icons.** Once the pointer touches them, they circle it (40–70 px out, a full turn about every ten
  seconds) and follow it anywhere in the footer. They ease home when the pointer leaves, and only on a desk with a mouse.
- "Creative direction by Omoi".

Elsewhere on the site:
- Buttons tilt toward the cursor and sink when pressed (spring physics, two separate shadows).
- **The mark is a live generative corona**, never the same twice (blur, choke, radial zoom blur, halftone dots).
- Every effect has a reduced-motion fallback.

## Yu-Hsin Lin — yuhsinlin.com

A product designer's portfolio on Webflow, with GSAP (ScrollSmoother, Inertia, PhysicsProps), Lenis and Matter.js (a 2D
physics engine). Type is Inter with Lora for accents, on white and near-black, with one yellow (#F4C739).

The page, top to bottom:
1. **A loader once per visit.** "Just a sneak peek" and her name, a counter running 0 to 100 in 1.8 s, a short hold,
   then a black curtain lifts. It is skipped on later pages in the same visit and under reduced motion.
2. **The nav**: "✱ Yu-Hsin Lin"; Work, Playground, About, Résumé; and **"My time"**, her clock in New York, updated
   on the minute.
3. **The hero**: "I design products and systems that work well, with a little spark." One line of credentials, then
   "Think we should work together? See how we match" (it opens her AI twin). Project pictures float around the line.
   Three pointer effects:
   - over a picture, a "sneak peek" label trails the cursor;
   - in the hero, a chain of ten soft blobs follows the cursor;
   - anywhere on the page, a 52 px grid cell lights under the pointer and fades in a second.
4. **Selected works (2021–2026)**: four cards. Each has the company, a title that states the outcome, one line with the
   number ("increasing CSAT to 93%"), tags, and "View" on hover.
5. **"Made for everyday moments"**: side projects as a list; hovering a row shows its picture.
6. **"Curious to know me better?"**: the résumé, and "Talk to Yu", an AI chat with suggested questions.

**The footer** (black):
- A status tag, "available for work", whose dot breathes.
- "Before you go, leave a little doodle. Press the star to start." The star opens a drawing pad and a gallery of
  visitors' drawings.
- Link labels in parentheses: (Explore), (Contact).
- **The doodles drop in.** The moment the reader reaches the bottom, up to twenty visitors' doodles fall into the footer
  as cards with physics: gravity, collisions, and they can be grabbed and thrown. The bodies go to sleep when still, so
  the pile costs nothing at rest.

## What the two share

- **A live clock as proof the page is now**: Eclipse's local time in the hero, Lin's own time in the nav.
- **One pointer toy at the end of the page**, as a reward for reaching it (the orbiting icons; the throwable doodles). It
  comes to rest when nobody touches it.
- **Scroll as the playhead.** Films, letters and the closing line all move with the reader's scroll rather than on a
  timer.
- **The promise said twice.** Eclipse opens on "Designed by us / Owned by you" and closes on "Designed by eclipse. owned
  by you." Each footer has its own closing line ("Own your own future." / "Before you go, leave a little doodle.").
- **Short, declarative lines; outcomes, not features.**

## For Slayer — ours, not theirs (proposals, best first)

1. **A footer line and one toy in Slayer's own grammar: "Before you go, mark a level."** A press on the live band drops
   a dashed level where the pointer is. The line walks on, and when it crosses the reader's level the level lights and
   its tag reads the time it was crossed. That is the terminal's alerts idea in miniature. It rests when untouched, needs
   no backend (the levels last the visit), and a second press takes a level away.
2. **The closing words read by scrolling.** "Seen enough? Step inside." turns from the muted ink to the full ink a
   character at a time as it scrolls into view, stepped, in Slayer's type. Under reduced motion it stands in full ink.
3. **The market's own clock beside the signature** in the hero ("slayer:~ $ ● live · New York 1:42 PM"). It is
   truthful, it is the one live figure on the first screen, and it is the same reading the signature already uses.
4. **Footer links that answer the pointer**: hovering a column dims its other links and grows a small marker in front of
   the hovered one. Use colour and a marker, not weight, because weight changes reflow the line.
5. **The promise said twice**: the first screen's line and the footer's closing line made into a pair, in the house
   voice.

Not for Slayer, and why:
- **A film behind the footer**: Slayer's films are the product; a decorative film would compete with them.
- **A loader counter**: the landing should open at once, and the terminal already has its loading screen.
- **An AI twin chat**: there is no backend, and a chat bubble is ruled out on the landing.
- **A visitors' doodle gallery**: it needs a backend and moderation.
- **Cursor trails and the pixel grid**: decoration that draws on every frame.
- **The logo flying into the nav**: the mark stands still by the owner's rule.
- **Tilting buttons**: a gimmick next to the plain ink pill.
