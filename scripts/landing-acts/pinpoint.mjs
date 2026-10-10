/* PINPOINT'S ACTS (2026-10-02 — the owner: "make sure the videos really show the features of every page", and "make them
   move fast"). THE MAP: a strike's card under the pointer, the book's read opened beside the matrix and the strike under
   the pointer read in it, the same book as the calendar, a second name's book laid beside the first and taken off, the
   matrix again. BUILDING: the line over the rows reading each strike the pointer crosses, the strikes by most built,
   the fastest one kept (the rest recede, its chip in the head) and let go, then down to where the walls are heading. AT THE
   WALL: the beam and its reasons, the call wall picked off the menu, two walls picked off the table — the beam, the
   reasons and the two paths re-read each time — let go, and the page's own guide opened and shut. COMPARE: the two names
   head to head, swapped and swapped back, the two books on one ruler taken to the whole screen, all five greeks side by
   side and gamma again, and back; then the day, both names from their own open with the minute under the pointer read,
   and the pair's usual range. */
export default ({ on, near, at }) => {
  /* the strike a Pinpoint page keeps is the whole terminal's (FocusContext): the chip in the page's head lets it go */
  const LET_GO = 'button[aria-label="Let go of the strike"]';
  const NET = '[data-matrix-row] [data-matrix-leg="net"]';
  /* the table of every wall re-orders as price moves, so a wall is picked off it by what it is, not where it stands: the
     strongest in reach (tagged), and an untagged shelf — never the strongest twice, and seldom the wall the page opened on
     (the nearest, often the weakest; measured: a phone take whose row 1 was the page's own wall, and the press changed
     nothing but the chip) */
  const STRONGEST = '[data-wall-row][data-tag="strongest"]';
  const SHELF = '[data-wall-row]:not([data-tag])';
  /* the strongest, or the fourth row on a board too thin to name one */
  const strongest = async c => (await on(STRONGEST, 0, 0.3)(c)) ?? on('[data-wall-row]', 3, 0.3)(c);
  /* THE MATRIX COMES BACK A ROW OFF. It centres itself on spot each time it is drawn, and its first centring is measured
     before the band has settled to one row (measured: 196 px down at the still, 179 when it comes back from the calendar)
     — so the film's last frame stood a row lower than its first. Where it opened is read before the act, and the box is
     put back there as it fades in again: BY ITS STRIKE, not its pixels — the rows are the strikes round spot, and a film
     whose price crossed a strike came back with every row one strike over at the same scroll (measured on a phone: 480 at
     the top at the start, 479 at the end, spot 470.13 → 469.23), so the strike that stood at the box's top edge is put
     back exactly where it stood. AND KEPT THERE: put back once, the moment the matrix appeared, the box did not always stay
     (measured: a take that opened with 479 at the top and ended on 480, its price on the same strike throughout) — so it
     is put back until it has stood there for four looks in a row, the page's clock held all the while (only the
     browser's own work runs between them). The hold before this beat gives the view's swap its time on the page's clock:
     the matrix must be on the page when it runs. */
  const MATRIX = '[data-matrix-scroll]';
  /* where the box stands: its scroll, and the strike row nearest its top edge with that row's place under the edge */
  const matrixAt = async ({ frame }) =>
    frame.locator(MATRIX).first().evaluate(b => {
      const edge = b.getBoundingClientRect().top;
      let best = null;
      for (const r of b.querySelectorAll('[data-matrix-row]')) {
        const d = r.getBoundingClientRect().top - edge;
        if (!best || Math.abs(d) < Math.abs(best.d)) best = { k: r.getAttribute('data-matrix-row'), d };
      }
      return { top: b.scrollTop, k: best?.k ?? null, d: best?.d ?? 0 };
    }, null, { timeout: 1500 }).catch(() => null);
  const matrixHome = {
    remember: 'matrixBack',
    of: async ({ frame, page, memo }) => {
      const at = memo.matrixAt;
      if (!at) return null;
      let held = 0;
      for (let k = 0; k < 40 && held < 4; k++) {
        const there = await frame.locator(MATRIX).first().evaluate((b, at) => {
          const row = at.k != null ? b.querySelector(`[data-matrix-row="${at.k}"]`) : null;
          /* the scroll that puts the strike back at its place under the edge (or, its row gone, the scroll it had) */
          const want = row ? b.scrollTop + (row.getBoundingClientRect().top - b.getBoundingClientRect().top) - at.d : at.top;
          if (Math.abs(b.scrollTop - want) < 1) return true;
          b.scrollTop = want;
          return false;
        }, at, { timeout: 300 }).catch(() => false);
        held = there ? held + 1 : 0;
        await page.waitForTimeout(50);
      }
      return held >= 4;
    },
  };
  /* THE GUIDE'S FADE, KEPT TO THE FILM'S TIME (Compass's own safeguard). The guide fades in and out by framer-motion, which
     hands the opacity to the browser's animation clock but starts it at the page's held time; when the page's clock has run
     ahead of the browser's, the fade waits out the difference in real time — measured on At the wall (light, with another
     film shooting beside it): the guide came up over a second of film after its door was pressed, as the pointer was
     already on its way to shut it, and went only as the pointer went home. A fade that has not begun is played to its end
     — it is shorter than one of the film's frames — once the press has landed, and twice more as it mounts. */
  const fadeOn = {
    remember: 'fade',
    of: async ({ frame, page }) => {
      await page.waitForTimeout(40);
      return frame.locator('body').evaluate(() => {
        let k = 0;
        for (const a of document.getAnimations())
          if (a.effect?.getComputedTiming?.().iterations !== Infinity && a.playState === 'running' && Number(a.currentTime) < 0) {
            a.finish();
            k++;
          }
        return k;
      }).catch(() => 0);
    },
  };
  const fadesOn = [fadeOn, { hold: 0.05 }, fadeOn, { hold: 0.05 }, fadeOn];
  return {
    DESK: {
      '/pinpoint/map': [
        /* the still has a row under the pointer and its card: down two rows, the card following */
        { to: near(NET, 1, 0.6), dur: 0.35 }, { to: near(NET, 3, 0.6), dur: 0.3 },
        /* THE READ: the net, the levels, the heaviest strikes — and the strike under the pointer, read as it moves */
        { press: on('[data-ledger-read]', 0), dur: 0.5 }, { hold: 0.5 },
        { to: near(NET, -4, 0.6), dur: 0.4 }, { to: near(NET, 2, 0.6), dur: 0.4 }, { hold: 0.2 },
        { press: on('[data-ledger-read]', 0), dur: 0.5 }, { hold: 0.2 },
        /* the same book as the calendar: strike by expiry, a capsule a cell */
        { pick: 'ledger-view', option: 'Calendar', dur: 0.5 }, { hold: 0.7 },
        { to: on('[data-cell]', 'mid', 0.5), dur: 0.4 }, { to: at(0.62, 0.62), dur: 0.35 },
        /* a second name's book beside the first — typed, picked, and taken off by its × */
        { press: on('[data-ledger-add]', 0), dur: 0.45 }, { hold: 0.15 },
        { type: 'QQQ' }, { hold: 0.15 },
        { press: on('[data-ledger-add-menu] button', 0, 0.3), dur: 0.35 }, { hold: 0.9 },
        { to: on('[data-field-column="QQQ"]', 0, 0.45, 0.42), dur: 0.4 }, { to: on('[data-field-column="QQQ"]', 0, 0.7, 0.6), dur: 0.35 },
        { press: on('[data-field-remove="QQQ"]', 0), dur: 0.45 }, { hold: 0.5 },
        { unpick: 'ledger-view' }, { hold: 0.1 }, matrixHome, { hold: 0.3 },
      ],
      '/pinpoint/building': [
        /* the line over the rows reads the strike under the pointer */
        { to: on('[data-build-row]', 1, 0.3), dur: 0.4 }, { to: on('[data-build-row]', 4, 0.35), dur: 0.35 },
        /* the strikes by most built — the pointer off the menu's line at once, to a row: the rows re-sort under it. Sorted
           first, while every row is sharp: a strike kept first dims the rest, and the re-sort under them did not read */
        { pick: 'build-order', option: 'Most built', dur: 0.45 }, { to: on('[data-build-row]', 2, 0.6), dur: 0.3 }, { hold: 0.6 },
        /* the strike building fastest kept: the others recede and its chip stands in the page's head — then let go there */
        { press: on('[data-build-row]', 0, 0.3), dur: 0.35 }, { hold: 0.6 },
        { press: on(LET_GO, 0), dur: 0.5 }, { hold: 0.3 },
        /* back by strike: the menu's first line stands over the column's head once the menu shuts, and the term there
           opens its card — so the pointer stays a moment and the card is read (what "the wall now" measures), then
           goes; hurried off, the card only flashed (measured: four frames) */
        { unpick: 'build-order' }, { hold: 0.55 }, { to: on('[data-build-row]', 3, 0.6), dur: 0.35 }, { hold: 0.2 },
        /* down to where the walls are heading: each level at the open, now, and by the close — the level under the
           pointer read on the line above the drawing, the others dimmed */
        { scrollTo: '[data-heading]', at: 0.3, dur: 0.9 },
        { to: on('[data-heading-figure] [data-level]', 0, 0.5), dur: 0.4 }, { hold: 0.3 },
        { to: on('[data-heading-figure] [data-level]', -1, 0.5), dur: 0.4 }, { hold: 0.4 },
        { scroll: -3000, dur: 0.8 }, { hold: 0.2 },
      ],
      '/pinpoint/wall': [
        { to: on('[data-wall-beam]', 0, 0.25, 0.5), dur: 0.45 }, { to: on('[data-wall-beam]', 0, 0.6, 0.5), dur: 0.4 },
        { to: on('[data-wall-factor]', 1, 0.45), dur: 0.35 }, { to: on('[data-wall-factor]', 4, 0.45), dur: 0.3 },
        /* the call wall off the menu: the beam, the reasons and the two paths read it */
        { pick: 'wall-pick', option: 'call wall', dur: 0.5 }, { hold: 0.7 },
        { to: on('[data-wall-paths]', 0, 0.62, 0.55), dur: 0.4 }, { hold: 0.2 },
        /* two more off the table of every wall */
        { press: strongest, dur: 0.5 }, { hold: 0.5 },
        { to: on('[data-wall-factor]', 2, 0.6), dur: 0.35 }, { hold: 0.2 },
        { press: on(SHELF, 1, 0.3), dur: 0.45 }, { hold: 0.5 },
        { to: on('[data-wall-paths]', 0, 0.4, 0.5), dur: 0.35 }, { hold: 0.2 },
        /* a wall picked is the page's focus (the chip in its head): letting go puts the page back on its own wall */
        { press: on(LET_GO, 0), dur: 0.55 }, { hold: 0.4 },
        /* how to read it: the beam, the reasons and the two paths, drawn small in the page's own guide */
        { press: on('[data-guide-door="wall-guide"]', 0), dur: 0.45 }, ...fadesOn, { hold: 0.9 },
        { press: on('[data-guide-close]', 0), dur: 0.45 }, ...fadesOn, { hold: 0.3 },
      ],
      '/pinpoint/compare': [
        { to: on('[data-h2h-row]', 1, 0.35), dur: 0.4 }, { to: on('[data-h2h-row]', 4, 0.55), dur: 0.3 },
        /* the two names trade places — every read, the ruler and the lines with them — and trade back (the first name is
           the terminal's own: a swap moves the whole terminal to the second, so it is always swapped back) */
        { press: on('[data-h2h-swap]', 0), dur: 0.45 }, { hold: 0.8 },
        { press: on('[data-h2h-swap]', 0), dur: 0.25 }, { hold: 0.4 },
        /* the two books on one ruler, taken to the whole screen; all five greeks side by side, then gamma alone again (a
           tick on GEX leaves "All five") */
        { press: on('[data-axis-full]', 0), dur: 0.5 }, { hold: 0.5 },
        { to: at(0.62, 0.55), dur: 0.4 },
        { pick: 'compare-greek', option: 'All five', dur: 0.45 }, { hold: 0.9 },
        { pick: 'compare-greek', option: 'GEX', dur: 0.4 }, { hold: 0.3 },
        { press: on('[data-axis-full]', 0), dur: 0.45 }, { hold: 0.4 },
        /* down to the day: both names as percent from their own open, the minute under the pointer read in its card, then
           the pair's usual range */
        { scrollTo: '[data-compare-tapes]', at: 0.1, dur: 0.8 },
        { to: on('[data-tapes-chart]', 0, 0.3, 0.5), dur: 0.4 }, { to: on('[data-tapes-chart]', 0, 0.78, 0.45), dur: 0.6 }, { hold: 0.2 },
        { to: on('[data-pair-chart]', 0, 0.62, 0.5), dur: 0.4 }, { hold: 0.3 },
        { scroll: -4000, dur: 0.8 }, { hold: 0.2 },
      ],
    },
    PHONE: {
      '/pinpoint/map': [
        { pick: 'ledger-view', option: 'Calendar', dur: 0.55 }, { hold: 0.6 },
        /* (since the band took the "Read this" icon and the matrix's legend, 2026-10-10, the read's door stands near 300 px
           down: a scroll of 300 took it under the phone's top bar) */
        { scroll: 180, dur: 0.8 }, { hold: 0.2 },
        { press: on('[data-ledger-read]', 0), dur: 0.5 }, { hold: 0.8 },
        { scroll: 340, dur: 0.8 }, { hold: 0.5 },
        { scroll: -340, dur: 0.7 },
        { press: on('[data-ledger-read]', 0), dur: 0.5 }, { hold: 0.3 },
        { scroll: -180, dur: 0.7 },
        { unpick: 'ledger-view' }, { hold: 0.1 }, matrixHome, { hold: 0.3 },
      ],
      '/pinpoint/building': [
        /* (300, not 400, since the page's head grew on 2026-10-10: at 400 the Order menu stood under the phone's top bar) */
        { scroll: 300, dur: 0.9 }, { hold: 0.2 },
        /* the strikes by most built first — before one is kept: a kept strike dims the rest, and the re-sort under them
           did not read */
        { pick: 'build-order', option: 1, dur: 0.5 }, { hold: 0.8 },
        { press: on('[data-build-row]', 1, 0.3), dur: 0.5 }, { hold: 0.7 },
        { unpick: 'build-order' }, { hold: 0.4 },
        /* up to the page's head, where the kept strike's chip lets it go */
        { scroll: -300, dur: 0.8 },
        { press: on(LET_GO, 0), dur: 0.55 }, { hold: 0.4 },
      ],
      '/pinpoint/wall': [
        /* (280 and 620, not 380 and 520, since the page's head grew on 2026-10-10: at 380 the Wall menu stood under the
           phone's top bar) */
        { scroll: 280, dur: 0.9 }, { hold: 0.2 },
        { pick: 'wall-pick', option: 'call wall', dur: 0.55 }, { hold: 0.9 },
        /* down to every wall: another one picked off the table, and up to the head, where the box reads it */
        { scroll: 620, dur: 1.0 }, { hold: 0.2 },
        { press: strongest, dur: 0.45 }, { hold: 0.5 },
        { scroll: -900, dur: 1.1 }, { hold: 0.5 },
        { press: on(LET_GO, 0), dur: 0.55 }, { hold: 0.5 },
      ],
      '/pinpoint/compare': [
        /* the two names trade places and trade back, at the head */
        { press: on('[data-h2h-swap]', 0), dur: 0.55 }, { hold: 0.7 },
        { press: on('[data-h2h-swap]', 0), dur: 0.3 }, { hold: 0.4 },
        /* the two books on one ruler, the whole screen and back */
        { scrollTo: '[data-axis-full]', at: 0.25, dur: 1.0 }, { hold: 0.1 },
        { press: on('[data-axis-full]', 0), dur: 0.5 }, { hold: 0.8 },
        { press: on('[data-axis-full]', 0), dur: 0.4 }, { hold: 0.3 },
        /* down to the day: both names from their own open, the minute under the pointer read in its card */
        { scrollTo: '[data-compare-tapes]', at: 0.08, dur: 1.0 },
        { to: on('[data-tapes-chart]', 0, 0.3, 0.5), dur: 0.4 }, { to: on('[data-tapes-chart]', 0, 0.75, 0.45), dur: 0.5 }, { hold: 0.3 },
        { scroll: -4000, dur: 1.2 }, { hold: 0.3 },
      ],
    },
    REMEMBER: {
      /* where the matrix opened, read before either act begins (matrixHome puts it back) */
      '/pinpoint/map': [{ remember: 'matrixAt', of: matrixAt }],
    },
  };
};
