/* TRACE'S DARK POOL AND SCREENER (2026-10-02 — the owner: "make sure the videos really show the features of every page",
   and "make them move fast").
   THE DARK POOL: a shelf pressed cuts the grid to the crosses that printed on it and says how the level has been used; a
   cross on it pressed puts its whole read on the card under the shelves (who is most likely behind it, how sure, where it
   printed), and pressed again puts it away; the chip lets the shelf go; the Read card keeps only the accumulation; and
   down the page, where the dark money went across the market, one sector's names.
   THE SCREENER: the book asked another question (Unusually bullish); a row opens the contract's card — the print, what it
   means, the Compass scale and its tape on one clock, read under the pointer and widened to five sessions — ↓ steps the
   card to the next contract, and the card is shut; the expiry calendar cuts the book to one date and to every date again;
   and the book is asked its first question again. */
export default ({ on }) => {
  /* THE GRID'S ROWS AS THE READER SEES THEM, top first. AG Grid keeps its rows in the order it made them, not the order
     they stand in (measured on the Screener: the second row in the page's own order stood 900 points under the first,
     past the screen's foot, once the screen had changed) — so the rows wholly on screen, by where they stand */
  const ROWS = grid => `[data-trace-grid="${grid}"] .ag-row`;
  const row = (grid, k, fx = 0.4) => async ({ frame, size }) => {
    const top = size.form === 'phone' ? 48 : 2;
    const all = (await frame.locator(ROWS(grid)).evaluateAll(els =>
      els.map(e => {
        const r = e.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height];
      })
    ).catch(() => []))
      .filter(([x, y, w, h]) => w > 2 && h > 2 && y >= top && y + h <= size.h - 14)
      .sort((a, b) => a[1] - b[1]);
    if (!all.length) return null;
    const [x, y, w, h] = all[Math.max(0, Math.min(all.length - 1, k))];
    /* a grid wider than the screen (a phone's, the Screener's seventeen columns) is aimed inside the screen */
    return [Math.min(x + w * fx, size.w - 40), y + h / 2];
  };
  /* A ROW PRESSED IS PRESSED ON ITS CELL'S BARE GROUND. The page rebuilds every row's cells on each tick (the grid's
     columns are made again with the marks they earn), and a press spans a frame of the page's time: a press that began on
     a cell's words and let go on the new words that replaced them was no click at all (measured: four presses in six lost
     on the Dark Pool, and a film's card that never closed). The cell itself is kept from tick to tick — so a row is
     pressed where its cell has no words: `col` names the cell, `fx` a place in it the words do not reach */
  const press = (grid, k, col, fx) => async c => {
    const r = await row(grid, k, 0.5)(c);
    if (!r) return null;
    return cellOf(`${ROWS(grid)}`, r[1], col, fx)(c);
  };
  const cellOf = (rows, y, col, fx) => async ({ frame }) => {
    const b = await frame.locator(`${rows} .ag-cell[col-id="${col}"]`).evaluateAll((els, y) => {
      const e = els.find(e => {
        const r = e.getBoundingClientRect();
        return r.top <= y && r.bottom >= y;
      });
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height];
    }, y).catch(() => null);
    return b && [b[0] + b[2] * fx, b[1] + b[3] / 2];
  };

  /* THE CROSS ON THE CARD: the card names the print it holds — the same row pressed again puts it away. Aimed, then
     pressed where it stands by then: a new cross arriving at the top pushes every row down a line */
  const held = { remember: 'print', of: async ({ frame }) => frame.locator('[data-dark-pool-card]').first().getAttribute('data-dark-pool-card', { timeout: 1500 }).catch(() => null) };
  const heldRow = (col, fx) => async c => {
    if (!c.memo.print || c.memo.print === 'none') return null;
    const r = await on(`${ROWS('dark-pool')}[row-id="${c.memo.print}"]`, 0, 0.5)(c);
    return r && cellOf(`${ROWS('dark-pool')}[row-id="${c.memo.print}"]`, r[1], col, fx)(c);
  };
  const putAway = (col, fx) => [{ to: heldRow(col, fx), dur: 0.35 }, { press: heldRow(col, fx), dur: 0.12 }];
  /* the shelf's chip, among the cards: a press lets the shelf go. A shelf is a price drawn from the session's range, and
     the range slides now and then (the highest shelf held a minute and a half of the page's time, then moved): a shelf
     that moved under the cut lets itself go, and then there is no chip to press */
  const CHIP = '[data-dark-pool-shelf-chip]';

  /* THE CONTRACT'S CARD (PrintDrilldown, in the house Modal) */
  const CARD = '[role="dialog"]';
  /* THE EXPIRY CALENDAR (ExpiryCalendar): its trigger among the cards, and the month it opens on — the days a contract on
     the book expires are the live ones: the film's Thursday the 1st, Friday the 2nd, the 6th, the 9th, the 16th, the 30th
     (measured). Unusually bullish keeps five of its fifty on the 6th, seven on the 2nd and none on the 9th, which is only
     passed over. The 6th, not the 2nd: the calendar shuts as a day is picked, and the 2nd stands on the month's first row,
     level with the grid's head — the pointer was left on the Sweep column's head and raised its tooltip over the book */
  const EXPIRY = '[data-dropdown="screener-expiry"]';
  const DAY = k => on('[data-date-picker="screener-expiry"] [data-expiry-day]', k);
  const EVERY = on('[data-date-picker="screener-expiry"] [data-expiry-clear]', 0);

  /* THE SEAM, ON THE LIVE PILL'S BREATH. A film loops: its last frame runs on into its first. The LIVE pill breathes on
     the film's own clock (live-breathe, 1.4 s each way: a breath is 2.8 s of the page's time, 21 frames at four times
     speed), and a film that is not a whole number of breaths long turns the loop with the pill at another point of its
     breath — bright on the last frame, dim on the first (measured: both pages' ends, desk and phone). So the breath's own
     clock is read as the act begins and again as it ends, and the act's last hold is made just long enough that the film
     comes to a whole number of breaths. The breath's clock, not the page's: the page's moves 134 ms a frame (the clock
     rounds each step up), the held loops exactly 133⅓. */
  const STEP = (1000 / 30) * 4;
  const BREATH = 21;
  /* what the film shoots around the act: the first frame and the pointer's eight coming in before it; the way home (16),
     the pointer's eight going out and a rest of five after it */
  const LEAD = 8;
  const TAIL = 29;
  const breathNow = ({ frame }) =>
    frame.locator('body').evaluate(() => {
      const a = document.getAnimations().find(a => a.animationName === 'live-breathe');
      return a ? Number(a.currentTime) : null;
    }).catch(() => null);
  const seam = () => {
    const at = { first: null };
    const rest = { hold: 0 };
    return {
      begin: {
        remember: '_breath',
        of: async c => {
          rest.hold = 0;
          const t = await breathNow(c);
          at.first = t == null ? null : t - LEAD * STEP;
        },
      },
      end: [
        {
          remember: '_seam',
          of: async c => {
            const t = await breathNow(c);
            if (t == null || at.first == null) return (rest.hold = 0);
            const shot = Math.round((t - at.first) / STEP) + 1;
            const pad = (BREATH - ((shot + TAIL) % BREATH)) % BREATH;
            /* a hold of `pad` frames: the film's thirty a second at its pace of three quarters */
            rest.hold = pad / (30 * 0.75);
            return pad;
          },
        },
        rest,
      ],
    };
  };
  const S = { deskPool: seam(), deskBook: seam(), phonePool: seam(), phoneBook: seam() };

  return {
    DESK: {
      '/trace/dark-pool': [
        S.deskPool.begin,
        { to: row('dark-pool', 2, 0.4), dur: 0.35 },
        /* the highest shelf: the grid cut to the crosses on it — short enough now that the card stands on screen */
        { press: on('[data-dark-pool-shelf]', 0, 0.5), dur: 0.45 }, { hold: 0.5 },
        { press: press('dark-pool', 1, 'shelf', 0.94), dur: 0.4 }, held, { hold: 0.2 },
        { to: on('[data-dark-pool-card]', 0, 0.62, 0.5), dur: 0.4 }, { hold: 0.5 },
        ...putAway('shelf', 0.94), { hold: 0.2 },
        /* the shelf let go by its chip, the grid whole again */
        { press: on(CHIP, 0, 0.5), dur: 0.45, optional: true }, { hold: 0.3 },
        { pick: 'dark-pool-read', option: 'Accumulation', dur: 0.45 }, { hold: 0.55 },
        { to: row('dark-pool', 2, 0.62), dur: 0.35 },
        { unpick: 'dark-pool-read', dur: 0.4 }, { hold: 0.2 },
        /* down to where the dark money went across the market: one sector's names, then every sector again. The card
           stands near the screen's middle — a sector is ten names, and with the card higher the page's foot came up past
           the scroll and the screen jumped as the list shortened */
        { scrollTo: '[data-dropdown="dark-pool-sector"]', at: 0.47, dur: 0.7 },
        { pick: 'dark-pool-sector', option: 'Technology', dur: 0.45 }, { hold: 0.55 },
        { unpick: 'dark-pool-sector', dur: 0.4 }, { hold: 0.2 },
        { scroll: -4000, dur: 0.7 }, { hold: 0.2 },
        ...S.deskPool.end,
      ],
      '/trace/screener': [
        S.deskBook.begin,
        { to: row('screener', 2, 0.3), dur: 0.4 },
        /* the question asked of the book: calls bought and puts sold, ranked by their money */
        { pick: 'screener-screen', option: 'Unusually bullish', dur: 0.45 }, { hold: 0.6 },
        /* a row opens the contract's card; the pointer reads its prints across the session */
        { press: press('screener', 1, 'vol', 0.12), dur: 0.45 }, { hold: 0.7 },
        { to: on(`${CARD} .recharts-wrapper`, 0, 0.3, 0.45), dur: 0.4 }, { to: on(`${CARD} .recharts-wrapper`, 0, 0.72, 0.5), dur: 0.5 },
        /* the tape over five sessions, then ↓ steps the card to the next contract in the book (the card keeps its window
           while it is shut — unseen: the film does not open it again) */
        { press: on(`${CARD} button[title="Show 5D"]`, 0), dur: 0.4 }, { hold: 0.6 },
        { press: on(`${CARD} button[title="Next print (↓)"]`, 0), dur: 0.45 }, { hold: 0.6 },
        { press: on(`${CARD} button[aria-label="Close"]`, 0), dur: 0.4 }, { hold: 0.3 },
        /* the calendar of the dates on the book: a day picked off it, and the book is that day's five */
        { press: on(EXPIRY, 0), dur: 0.45 }, { hold: 0.3 },
        { to: DAY(4), dur: 0.3 }, { press: DAY(2), dur: 0.35 }, { hold: 0.6 },
        { to: row('screener', 2, 0.4), dur: 0.35 },
        /* every expiry again, by the calendar's own foot */
        { press: on(EXPIRY, 0), dur: 0.4 }, { hold: 0.25 },
        { press: EVERY, dur: 0.35 }, { hold: 0.3 },
        { unpick: 'screener-screen', dur: 0.45 }, { hold: 0.3 },
        ...S.deskBook.end,
      ],
    },
    PHONE: {
      /* the shelves stand over the grid on a phone, the card between them: down to the shelves, one pressed, down to the
         card and the crosses under it, one read and put away; on down to where the dark money went, one sector and every
         sector again; and home, where the shelf's chip stands among the cards and lets it go */
      '/trace/dark-pool': [
        S.phonePool.begin,
        { scrollTo: '[data-dark-pool-shelves]', at: 0.08, dur: 0.7 }, { hold: 0.15 },
        { press: on('[data-dark-pool-shelf]', 0, 0.5), dur: 0.45 }, { hold: 0.5 },
        { scrollTo: '[data-dark-pool-card]', at: 0.4, dur: 0.6 },
        { press: press('dark-pool', 0, 'time', 0.9), dur: 0.4 }, held, { hold: 0.7 },
        ...putAway('time', 0.9), { hold: 0.2 },
        /* the Sector card a little over a quarter down: its card of eleven sectors opens under it, and a sector's ten names
           still reach past the screen's foot (with the card higher, the page's foot came up past the scroll as the list
           shortened — measured, a margin of sixty points at 0.3) */
        { scrollTo: '[data-dropdown="dark-pool-sector"]', at: 0.28, dur: 0.8 },
        { pick: 'dark-pool-sector', option: 'Technology', dur: 0.4 }, { hold: 0.6 },
        { unpick: 'dark-pool-sector', dur: 0.4 }, { hold: 0.15 },
        { scroll: -4000, dur: 0.8 }, { hold: 0.15 },
        { press: on(CHIP, 0, 0.5), dur: 0.45, optional: true }, { hold: 0.3 },
        ...S.phonePool.end,
      ],
      '/trace/screener': [
        S.phoneBook.begin,
        { pick: 'screener-screen', option: 'Unusually bullish', dur: 0.5 }, { hold: 0.45 },
        /* the calendar first, up among the cards: a day picked off it, and the book below is that day's five */
        { press: on(EXPIRY, 0), dur: 0.45 }, { hold: 0.3 },
        { press: DAY(2), dur: 0.35 }, { hold: 0.45 },
        { scrollTo: '[data-trace-grid="screener"]', at: 0.32, dur: 0.8 },
        /* the card fills the phone: the print, what it means, and ↓ to the next contract */
        { press: press('screener', 1, 'ticker', 0.92), dur: 0.45 }, { hold: 0.7 },
        { press: on(`${CARD} button[title="Next print (↓)"]`, 0), dur: 0.45 }, { hold: 0.55 },
        { press: on(`${CARD} button[aria-label="Close"]`, 0), dur: 0.4 }, { hold: 0.25 },
        { scroll: -4000, dur: 0.8 },
        { press: on(EXPIRY, 0), dur: 0.4 }, { hold: 0.25 },
        { press: EVERY, dur: 0.35 }, { hold: 0.25 },
        { unpick: 'screener-screen', dur: 0.45 }, { hold: 0.3 },
        ...S.phoneBook.end,
      ],
    },
  };
};
