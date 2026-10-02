/* THE DOSSIER'S FILINGS AND ITS STOCKS (2026-10-02 — the owner: "make sure the videos really show the features of every
   page" and "make them move fast").
   INSIDERS: a name to know pressed (the grid kept to it) and let go; every filing shown, the grants and withholdings among
   the trades; the biggest trades first by Value's head, then newest first again by When's; the chief executives alone.
   CONGRESS: a report to know pressed (the grid kept to its member) and let go; the late filings alone; the biggest brackets
   first by the Amount's head, then the newest filing first again; one chamber.
   STOCKS: the board by its trend (the Trend's head), the leading sector of the rotation pressed (the grid kept to its names),
   one of them opened on its own page — its read, its four pillars, why now, its trend — and back by the page's own link to
   the board as it opened; the strong screens alone.
   A row of Insiders or Congress is never pressed: it opens the name on the Map and puts the whole terminal on that name (the
   name in the side rail's corner), and the film would end there. */
export default ({ on, near, off, at }) => {
  /* A ROUTE'S FADE, KEPT TO THE FILM'S TIME (Compass's act, measured there): the Dossier's shell cross-fades a page out and
     the next in (RecordLayout: framer-motion, on the browser's own animation clock), started at the page's held time. A
     phone's frames are shot faster than the film's clock runs, and the fade waits out the difference in real time — a fade
     that has not begun by then is played to its end, once as the old page leaves and again as the new one comes in */
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
  /* a grid's column head, by its column */
  const head = (grid, col, fx = 0.5) => on(`[${grid}] .ag-header-cell[col-id="${col}"]`, 0, fx);
  /* a column's head pressed: the pointer comes up from the rows under it and presses in the same short glide, on the head
     two frames before it presses (an AG Grid head raises its tooltip after 350 ms of the page's time: three frames) */
  const sortBy = (grid, col, fx = 0.5) => [
    { to: off(head(grid, col, fx), 0, 140), dur: 0.35 },
    { press: head(grid, col, fx), dur: 0.25 },
  ];
  /* THE NAME OPENED is JPM, in the leading sector (Financials, on the film's day): the board's screen word and the name's own
     page read it alike — good (measured: of the 36 names, 14 read the same on both; OXY, the Energy card's first, read GOOD
     on the board and caution on its page) */
  const LEADER = '[data-stocks-sector="Financials"]';
  const NAME_ROW = '[data-stocks-grid] .ag-row[row-id="JPM"]';
  /* a grid's row by its place on screen (the DOM keeps AG Grid's rows in the order they were made, not where they stand) */
  const row = (grid, i, fx = 0.4) => on(`[${grid}] .ag-row[row-index="${i}"]`, 0, fx);

  return {
    DESK: {
      '/dossier/insiders': [
        /* the names to know — where someone chose to buy with their own money: one keeps the grid to it, pressed again lets it go */
        { to: on('[data-insiders-name]', 0, 0.5, 0.5), dur: 0.45 },
        { press: on('[data-insiders-name]', 1), dur: 0.35 }, { hold: 0.8 },
        { to: row('data-insiders-grid', 0, 0.45), dur: 0.4 }, { hold: 0.15 },
        { press: on('[data-insiders-name]', 1), dur: 0.4 }, { hold: 0.35 },
        /* every filing: the grants, conversions and withholdings join the trades, named for what they are */
        { pick: 'insiders-show', option: 1, dur: 0.45 }, { hold: 0.8 },
        { to: near('[data-insiders-grid] .ag-row', -1, 0.45), dur: 0.35 }, { to: near('[data-insiders-grid] .ag-row', 2, 0.45), dur: 0.35 },
        { unpick: 'insiders-show', dur: 0.45 }, { hold: 0.3 },
        /* the biggest trades first: Value's head pressed twice (the second press turns it biggest first), then When's — newest
           first, as the page opened. A head is reached from the rows under it, in a short glide: a pointer that rests on a
           head a third of a second raises its tooltip over the rows (measured: a box over the grid for three frames) */
        ...sortBy('data-insiders-grid', 'value', 0.5), { hold: 0.15 }, { press: true }, { hold: 0.15 },
        { to: row('data-insiders-grid', 1, 0.75), dur: 0.3 }, { hold: 0.5 },
        ...sortBy('data-insiders-grid', 'daysAgo', 0.35), { hold: 0.35 },
        /* whose filings: the chief executives alone */
        { pick: 'insiders-role', option: 'CEO', dur: 0.45 }, { hold: 0.8 },
        { unpick: 'insiders-role', dur: 0.45 }, { hold: 0.3 },
      ],
      '/dossier/congress': [
        /* the reports to know — trades in a sector the member's own committee oversees: one keeps the grid to its member */
        { to: on('[data-congress-report]', 1, 0.5, 0.5), dur: 0.45 },
        { press: on('[data-congress-report]', 0), dur: 0.35 }, { hold: 0.8 },
        { to: row('data-congress-grid', 0, 0.45), dur: 0.4 }, { hold: 0.15 },
        { press: on('[data-congress-report]', 0), dur: 0.4 }, { hold: 0.35 },
        /* how long they took to say so: the reports filed past the 45-day deadline */
        { pick: 'congress-show', option: 'Late', dur: 0.45 }, { hold: 0.8 },
        { to: row('data-congress-grid', 0, 0.93), dur: 0.4 }, { to: row('data-congress-grid', 3, 0.93), dur: 0.35 },
        { unpick: 'congress-show', dur: 0.45 }, { hold: 0.3 },
        /* the biggest brackets first: the Amount's head pressed twice, then Filed's — the newest filing first, as it opened */
        ...sortBy('data-congress-grid', 'bracket', 0.4), { hold: 0.15 }, { press: true }, { hold: 0.15 },
        { to: row('data-congress-grid', 1, 0.62), dur: 0.3 }, { hold: 0.5 },
        ...sortBy('data-congress-grid', 'filedDaysAgo', 0.35), { hold: 0.35 },
        /* one chamber */
        { pick: 'congress-chamber', option: 'Senate', dur: 0.45 }, { hold: 0.8 },
        { unpick: 'congress-chamber', dur: 0.45 }, { hold: 0.3 },
      ],
      '/dossier/stocks': [
        /* the board by its trend: the Trend's head pressed twice, the strongest trends first */
        ...sortBy('data-stocks-grid', 'momentum', 0.4), { hold: 0.15 }, { press: true }, { hold: 0.45 },
        { to: row('data-stocks-grid', 2, 0.52), dur: 0.3 }, { hold: 0.2 },
        /* the rotation: the leading sector pressed keeps the grid to its names */
        { press: on(LEADER), dur: 0.45 }, { hold: 0.7 },
        /* a row opens the name's own page: its read in a word, its four pillars, why now, its trend and its money */
        { to: on(NAME_ROW, 0, 0.3), dur: 0.35 },
        { press: on(NAME_ROW, 0, 0.12), dur: 0.2 }, ...fadesOn, { hold: 0.9 },
        { to: on('[data-stock-pillars]', 0, 0.15, 0.5), dur: 0.4 }, { to: on('[data-stock-pillars]', 0, 0.85, 0.5), dur: 0.55 },
        { to: on('[data-stock-sessions]', 0, 0.35, 0.5), dur: 0.4 }, { to: on('[data-stock-sessions]', 0, 0.85, 0.45), dur: 0.5 },
        /* back by the page's own link: the board as it opened — every sector, in its own order */
        { press: on('[data-name-back] a', 0, 0.5), dur: 0.5 }, ...fadesOn, { hold: 0.5 },
        /* the strong screens alone */
        { pick: 'stocks-screen', option: 'Strong', dur: 0.45 }, { hold: 0.8 },
        { unpick: 'stocks-screen', dur: 0.45 }, { hold: 0.3 },
      ],
    },
    PHONE: {
      /* a phone stacks the head, the cards and the grid: down until the cards stand over the grid's first rows. The grid
         shows When, Name and Who at a phone's width, so the cut that reads is by role: every Who line then says CEO */
      '/dossier/insiders': [
        { scroll: 300, dur: 0.8 }, { hold: 0.2 },
        { press: on('[data-insiders-name]', 1), dur: 0.45 }, { hold: 0.8 },
        { press: on('[data-insiders-name]', 1), dur: 0.35 }, { hold: 0.35 },
        { pick: 'insiders-role', option: 'CEO', dur: 0.45 }, { hold: 0.8 },
        { unpick: 'insiders-role', dur: 0.45 }, { hold: 0.3 },
        { scroll: -300, dur: 0.8 }, { hold: 0.3 },
      ],
      /* the Lag stands past the phone's edge: the purchases alone read in the Type column */
      '/dossier/congress': [
        { scroll: 300, dur: 0.8 }, { hold: 0.2 },
        { press: on('[data-congress-report]', 0), dur: 0.45 }, { hold: 0.8 },
        { press: on('[data-congress-report]', 0), dur: 0.35 }, { hold: 0.35 },
        { pick: 'congress-show', option: 'Purchases', dur: 0.45 }, { hold: 0.8 },
        { unpick: 'congress-show', dur: 0.45 }, { hold: 0.3 },
        { scroll: -300, dur: 0.8 }, { hold: 0.3 },
      ],
      /* a sector, a name opened on its own page and read down, and back by its link — the board opens at its head again */
      '/dossier/stocks': [
        { scroll: 330, dur: 0.8 }, { hold: 0.2 },
        { press: on(LEADER), dur: 0.45 }, { hold: 0.8 },
        { press: on(NAME_ROW, 0, 0.06), dur: 0.4 }, ...fadesOn, { hold: 0.8 },
        /* down the name's page: why now, then its trend, read under the pointer */
        { scroll: 420, dur: 0.9 }, { hold: 0.4 },
        { scrollTo: '[data-stock-sessions]', at: 0.3, dur: 0.8 },
        { to: on('[data-stock-sessions]', 0, 0.3, 0.45), dur: 0.4 }, { to: on('[data-stock-sessions]', 0, 0.8, 0.4), dur: 0.5 }, { hold: 0.2 },
        { to: at(0.5, 0.2), dur: 0.35 },
        { scroll: -4000, dur: 0.8 }, { hold: 0.1 },
        { press: on('[data-name-back] a', 0, 0.5), dur: 0.45 }, ...fadesOn, { hold: 0.5 },
      ],
    },
  };
};
