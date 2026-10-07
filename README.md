# Landing sweeps

Contact sheets for the landing directive of 2026-10-06, one folder per pull request. They are kept on this branch so
the pull requests can show them without adding pictures to the app's own history.

## How a sweep is taken

`tools/sweep.mjs` opens the landing, scrolls in small steps (45 px, a frame or two apart) to a stop every three-quarters
of a screen, holds each stop for 1.5 s, then captures it. It runs at 1440×900, 1280×720 and 390×844 in dark and light,
plus one 1440×900 dark run with reduced motion on.

`tools/sheets.py` lays each run out as one contact sheet, with the run before the change on the left and the run after
it on the right.

`tools/rooms-stops.mjs` and `tools/stops_sheet.py` check the rooms stage on its own. They stop every 4 svh through the
whole stage, hold each stop 1.5 s, and record whether any part of the stage is still mid-way. A part counts as mid-way
when the wall is partly dealt, or when the frame, the words or the turn's lines sit between 0 and 1.

## Folders

- `p0-1-rooms/`: the rooms animation never stops halfway.
