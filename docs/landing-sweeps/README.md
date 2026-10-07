# Landing sweeps

Contact sheets for the landing directive of 2026-10-06, one folder per pull request. They were kept on their own
branch, claude/landing-sweeps, while the pull requests were open, and came here on 2026-10-07 once the work was
merged; the pull requests' pictures point at that branch's commits, which this history keeps.

## How a sweep is taken

`tools/sweep.mjs` opens the landing, scrolls in small steps (45 px, a frame or two apart) to a stop every three-quarters
of a screen, holds each stop for 1.5 s, then captures it. It runs at 1440×900, 1280×720 and 390×844 in dark and light,
plus one 1440×900 dark run with reduced motion on.

`tools/sheets.py` lays each run out as one contact sheet, with the run before the change on the left and the run after
it on the right.

`tools/rooms-stops.mjs` and `tools/stops_sheet.py` check the rooms stage on its own. They stop every 4 svh through the
whole stage, hold each stop 1.5 s, and record whether any part of the stage is still mid-way. A part counts as mid-way
when the wall is partly dealt, or when the frame, the words or the turn's lines sit between 0 and 1.

`tools/empty.py` measures each stop's empty space: the share of the screen in bands that hold only the ground, counting
a band only when it is taller than 5% of the screen (the space between two lines, or round a button, is not empty
space).

`tools/caps.mjs` lists any words on the landing set in capitals or spaced 0.05 em or more (the footer and the terminal's
own pictures aside). `tools/heads.mjs` captures each section's head, and `tools/pairsheet.py` lays captures out side by
side, before and after. `tools/first-screen.mjs` and `tools/first-screen.py` measure the first screen's empty space at many sizes.
`tools/pricing.mjs` captures the plans, `tools/edges.mjs` reads each section's left and right edges,
`tools/read-and-questions.mjs` captures those two sections whole, `tools/room-tab.mjs` picks a room by its tab and
`tools/glyph-rows.mjs` captures the glyph rows close up. `tools/phone-windows.mjs` captures the phone's windows with the
scale of each beat's picture, and `tools/targets.mjs` presses the screen outward from each control's centre to measure
its hit area.

## Folders

- `p0-1-rooms/`: the rooms animation never stops halfway.
- `p0-2-readable/`: the product is readable: the session's camera on each beat's level with its call, and the rooms'
  panels. `beats-*` are the session's stops at 1440×900; `panels-*-first-last` show each panel film's first and last
  frames.
- `p0-3-headings/`: each section headed its own way, no tracked caps. `heads-1440x900` shows the first screen and each
  section's head before and after.
- `p0-4-pricing/`: Compass is the recommended plan and every plan shows a price. `pricing` shows the plans before and
  after on a desk and a phone.
- `p1-1-type/`: the display words in Inter Display. `quote-1440x900` shows the quote before (the fallback face at its
  regular weight) and after; `heads-1440x900` shows the sections' heads.
- `p1-2-grid/`: the sessions' and rooms' windows end on the column's right edge.
- `p1-3-length/`: the page under 8,500 px on a desk and 10,000 on a phone. `trust-faq` shows Why Slayer and the
  questions before and after.
- `p1-4-colour/`: the glyphs in the page's ink and Dossier opening on Earnings. `glyphs-1440x900` and `colour-1440x900`
  show them before and after; `wall-1440x900` shows the rooms' wall, Dossier's tile included; `opening-shots-*` show each
  room's first page and panel in both themes.
- `p1-6-phone/`: the phone's windows readable and every control 44 px to a finger. `windows-390x844-*` show the first
  terminal and each beat before and after.
