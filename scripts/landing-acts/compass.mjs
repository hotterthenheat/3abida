/* COMPASS'S ACTS (2026-10-02 — the owner: "reshoot compass and click on analysis so you can see the inside the con page",
   "make them move fast", and then "reshoot compass to click inside the contract please"). THE BOARD: SPY searched on its
   Name card, the board narrowed to SPY's setups, the card it keeps chosen; THE CONTRACT ITSELF PRESSED — a chosen card's
   second press opens its own page — and inside the contract: the setup's facts, its premium chart under the pointer, the
   trade card's Setup tab (its targets, its entry, its floor) after "Why we chose this", which it opens on — and back to
   the board by the page's own link, every name again, on the card the board opened on. The phone the same, the card
   scrolled to and the page brought home on the way back.
   THE TRACKER: its cards, the same setups as a table sorted by a column's head, and the cards again. */
export default ({ on, btn }) => {
  /* THE NAME IS SPY, the terminal's own: a contract opened on another name repoints the whole terminal to it (the name in
     the side rail's corner, the phone's top bar), and the film would end on that name. Searched on the Name card, not hunted down
     the board: the board re-ranks every 10 s of the page's time, and a card aimed at can be another by the time the
     pointer lands (measured: a phone film that chose AAPL's card for SPY's and never left the board) — narrowed to one
     name, it holds still */
  const NAME = '[data-dropdown="compass-name"]';
  const nameLine = v => on(`[data-dropdown-card="compass-name"] [data-search-option="${v}"]`, 0, 0.3);
  const narrow = [
    { press: on(NAME, 0), dur: 0.5 }, { hold: 0.15 },
    { type: 'SPY' }, { hold: 0.15 },
    { press: nameLine('SPY'), dur: 0.35 },
  ];
  const widen = [
    { press: on(NAME, 0), dur: 0.5 }, { hold: 0.2 },
    { press: nameLine('ALL'), dur: 0.35 },
  ];
  /* A ROUTE'S FADE, KEPT TO THE FILM'S TIME. Compass's shell cross-fades a page out and the next in (CompassLayout:
     framer-motion, which hands the opacity to the browser's own animation clock) — started at the page's held time. A
     phone's frames are shot faster than the film's clock runs, so the page's time runs ahead of the browser's, and the
     fade waits out the difference in real time: the setup page stayed 40 frames after its board link was pressed, then
     the board stood blank, and the two beats after it found nothing (measured: a fade started at 12538 ms on a browser
     clock at 11679). A fade that has not begun by then is played to its end — it is shorter than one of the film's frames
     — once as the old page leaves and again as the new one comes in. (A desk's frames are slower than its clock: nothing
     is waiting, and nothing is touched.) */
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
  /* THE CONTRACT ON THE CHOSEN CARD: its name and strike in its side's ink, top left of the card — and only while the card
     chosen is SPY's (a contract on another name repoints the whole terminal, and the film would end there): on any other
     name's card the beat finds nothing, and the run says so */
  const CHOSEN_LABEL = async c => {
    const id = await c.frame.locator('[data-compass-card][data-selected]').first().getAttribute('data-compass-card', { timeout: 1500 }).catch(() => null);
    if (!id || !/^SPY-/.test(id)) return null;
    return on(`[data-compass-card="${id}"]`, 0, 0.24, 0.13)(c);
  };
  /* the card the board opened on, chosen again — aimed, then pressed where it stands by then (the board re-ranks under
     the glide), and not at all if the board already has it (a chosen card's second press opens its page). The board is
     live: forty seconds of its time on, the card can be gone (NVDA's 120P became its 120.50P as the name moved) — then the
     first card is chosen, as the board chose it when it opened */
  const sel = async c => (await on(`[data-compass-card="${c.memo.sel}"]`, 0, 0.45, 0.4)(c)) ?? on('[data-compass-card]', 0, 0.45, 0.4)(c);
  const chooseAgain = [
    { to: sel, dur: 0.45 },
    { press: sel, dur: 0.15, unless: '[data-compass-card][data-selected]' }, { hold: 0.4 },
    /* THE BOARD HOLDS STILL UNDER THE HAND (Board.tsx, 2026-10-09): a sweep that lands while the pointer is on the board
       waits behind a line, "The sweep has a new order", and the film ended on that line where it began with none
       (measured: a phone take). Where it stands, its "Show it" is pressed, so the board ends on its own order */
    { press: on('[data-board-new-order]', 0), dur: 0.3, optional: true }, { hold: 0.2 },
  ];

  return {
    DESK: {
      '/compass': [
        /* SPY searched on the Name card: the board narrows to its setups and chooses the one it keeps */
        ...narrow, { hold: 0.5 },
        /* the contract read on its card, then pressed: the card is chosen, so the press opens its page — inside the contract */
        { to: CHOSEN_LABEL, dur: 0.45 }, { hold: 0.25 },
        { press: CHOSEN_LABEL, dur: 0.15 }, ...fadesOn, { hold: 0.8 },
        { to: on('[data-setup-facts]', 0, 0.12, 0.5), dur: 0.4 }, { to: on('[data-setup-facts]', 0, 0.8, 0.5), dur: 0.45 },
        { press: btn('Premium'), dur: 0.45 }, { hold: 0.6 },
        { to: on('[data-premium-track]', 0, 0.5, 0.55), dur: 0.4 }, { to: on('[data-premium-track]', 0, 0.82, 0.45), dur: 0.55 },
        /* the trade's card opens on why it is on the board; Setup holds its targets, its entry and its floor */
        { press: btn('Setup'), dur: 0.45 }, { hold: 0.8 },
        { press: btn('The board'), dur: 0.5 }, ...fadesOn, { hold: 0.5 },
        ...widen, { hold: 0.4 },
        ...chooseAgain,
      ],
      /* THE TRACKER: the setups kept, live — the cards, the same setups as a table, sorted by a column's head (the move
         each expects, then its premium: three rows that change places), and the cards again (the table's sort goes with it).
         Review is not pressed: it puts the whole terminal on the setup's name (NVDA's, AVGO's, AAPL's — the board's first
         three when the stage kept them), and the film would end on that name */
      '/compass/tracker': [
        { to: on('[data-tracker-read]', 0, 0.25, 0.5), dur: 0.45 }, { to: on('[data-tracker-read]', 2, 0.75, 0.5), dur: 0.55 }, { hold: 0.2 },
        { press: btn('Table'), dur: 0.45 }, { hold: 0.5 },
        { press: on('th:nth-child(5)', 0, 0.7), dur: 0.45 }, { hold: 0.7 },
        { press: on('th:nth-child(3)', 0, 0.7), dur: 0.45 }, { hold: 0.7 },
        { to: on('tr[data-row]', 0, 0.4), dur: 0.35 }, { to: on('tr[data-row]', 2, 0.6), dur: 0.4 },
        { press: btn('Cards'), dur: 0.45 }, { hold: 0.5 },
        { to: btn('Review', 'body', 1), dur: 0.45 }, { hold: 0.3 },
        { to: on('[data-tracker-read]', 1, 0.8, 0.5), dur: 0.4 }, { hold: 0.2 },
      ],
    },
    PHONE: {
      '/compass': [
        /* narrowed to SPY, the board is its one or two cards: the chosen one brought up the screen, its contract read and
           pressed — inside the contract */
        ...narrow, { hold: 0.3 },
        { scrollTo: '[data-compass-card][data-selected]', at: 0.42, dur: 0.7 },
        { to: CHOSEN_LABEL, dur: 0.4 }, { hold: 0.2 },
        { press: CHOSEN_LABEL, dur: 0.15 }, ...fadesOn, { hold: 0.6 },
        { press: btn('Premium'), dur: 0.45 }, { hold: 0.6 },
        /* down to the trade's card: why it is on the board, then its targets */
        { scrollTo: '[data-setup-card]', at: 0.1, dur: 0.8 },
        { press: btn('Setup'), dur: 0.4 }, { hold: 0.5 },
        { scroll: -4000, dur: 0.9 },
        { press: btn('The board'), dur: 0.45 }, ...fadesOn, { hold: 0.4 },
        { scroll: -4000, dur: 0.6 },
        ...widen, { hold: 0.4 },
        ...chooseAgain,
      ],
      /* the table's premium column sorts it (the move each expects stands past the phone's edge), then the cards, read down */
      '/compass/tracker': [
        { to: on('[data-tracker-read]', 0, 0.3, 0.5), dur: 0.45 },
        { press: btn('Table'), dur: 0.45 }, { hold: 0.5 },
        /* pressed again, the column sorts the other way */
        { press: on('th:nth-child(3)', 0, 0.7), dur: 0.45 }, { hold: 0.7 },
        { press: on('th:nth-child(3)', 0, 0.7), dur: 0.25 }, { hold: 0.7 },
        { to: on('tr[data-row]', 2, 0.5), dur: 0.4 },
        { press: btn('Cards'), dur: 0.45 }, { hold: 0.5 },
        { scroll: 420, dur: 0.9 }, { to: btn('Review', 'body', 1), dur: 0.4 }, { hold: 0.3 },
        { scroll: -420, dur: 0.8 }, { hold: 0.3 },
      ],
    },
    /* the Compass board's chosen card, read before either act begins */
    REMEMBER: {
      '/compass': [{ remember: 'sel', of: async ({ frame }) => frame.locator('[data-compass-card][data-selected]').first().getAttribute('data-compass-card', { timeout: 1500 }).catch(() => null) }],
    },
  };
};
