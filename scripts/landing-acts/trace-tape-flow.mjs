/* TRACE'S TAPE AND FLOW (2026-10-02 — the owner: "make sure the videos really show the features of every page", "make them
   move fast", and of the tape: a row opens the print). THE LIVE TAPE: the stream read under the pointer; SPY searched and the
   tape narrowed to its prints; a print's row pressed, and its card opens over the tape — the money and the side it hit, the
   summary, the contract graded on the Compass scale, the same contract's other prints on the tape, its prints through the
   day read bar by bar under the pointer and made five minutes wide, the next print stepped to in the same card — and the
   card shut, the search cleared, the whole tape again. THE NET FLOW: the pane's session read under the pointer (the glide
   card: the minute, the price, the net calls and puts), a name low on the board put on the pane, its same-day contracts
   alone and every clock again, the busiest name off the head's champion, and the board's own leader back on the pane by
   clearing the search. */
export default ({ on, SEARCH_MENU }) => {
  const SEARCH = 'Search by ticker or contract';
  /* a print's row by its place on the tape (AG Grid lays its rows out of order in the page: row-index is the place) */
  const row = (i, fx) => on(`[data-tape-body] .ag-row[row-index="${i}"]`, 0, fx);
  /* the print's card is a dialog over the tape */
  const CARD = '[role="dialog"]';
  const PRINTS = `${CARD} .recharts-wrapper`;
  /* the pane's chart, axes and all (its first canvas is the left axis: the plot is read by a share of the whole) */
  const PANE = '[data-menu-clip] > div.relative';
  /* THE NAME IS SPY, the terminal's own: the card grades a print on the Compass scale only when the terminal is on its
     name (on NVDA it asked for the terminal to be switched — a door that would leave the whole terminal on NVDA), and
     SPY's prints come in runs on one contract, so the card's sequence has rows of its own. Picking the name applies it
     and closes the menu (the line pressed is gone from the menu as it turns to the name's contracts, and the menu reads
     the press as one outside it) */
  const narrow = [
    { press: on(`input[aria-label="${SEARCH}"]`, 0, 0.4), dur: 0.45 },
    { type: 'SPY' }, { hold: 0.2 },
    { press: on(SEARCH_MENU(SEARCH), 0, 0.3), dur: 0.35 }, { hold: 0.7 },
  ];
  return {
    DESK: {
      '/trace/live-tape': [
        { to: row(2, 0.3), dur: 0.4 }, { to: row(6, 0.5), dur: 0.4 },
        ...narrow,
        /* a row opens the print: its card over the tape */
        { press: row(1, 0.42), dur: 0.45 }, { hold: 0.8 },
        /* the contract's prints through the day, read bar by bar, then five minutes to a bar */
        { to: on(PRINTS, 0, 0.3, 0.5), dur: 0.4 }, { to: on(PRINTS, 0, 0.78, 0.45), dur: 0.7 },
        { press: on(`${CARD} button[title="5-minute bars"]`, 0), dur: 0.4 }, { hold: 0.6 },
        { to: on(PRINTS, 0, 0.55, 0.5), dur: 0.4 },
        /* the next print on the name, in the same card */
        { press: on(`${CARD} button[title="Next print (↓)"]`, 0), dur: 0.45 }, { hold: 0.8 },
        { press: on(`${CARD} button[aria-label="Close"]`, 0), dur: 0.45 }, { hold: 0.4 },
        { press: on('button[aria-label="Clear the search"]', 0), dur: 0.5 }, { hold: 0.5 },
      ],
      /* (no expiry cut: the board's figures are read once a minute, but a cut and its clearing read them again at once —
         META and DIS stand a few hundred thousand apart at the film's minute, and two takes out of two came back with DIS
         on top and DIS on the pane, where the film began on META)
         THE FILM RUNS A WHOLE NUMBER OF LIVE'S BREATHS. The hold's LIVE breathes 1.4 s each way, and the film steps it on
         its own clock: 21 frames a breath. Its last hold is cut so the last frame lies a whole number of breaths after the
         first (274 frames, 273 = 13 × 21), and LIVE stands at the seam as it began — at 276 the light film's chip went from
         its pale wash to its full silver as the loop turned. A beat lengthened or shortened here moves the seam off it. */
      '/trace/net-flow': [
        { to: on(PANE, 0, 0.3, 0.5), dur: 0.45 }, { to: on(PANE, 0, 0.75, 0.42), dur: 0.7 },
        /* a name low on the board — its session goes on the pane */
        { press: on('[data-ticker]', 12), dur: 0.5 }, { hold: 0.6 },
        { to: on(PANE, 0, 0.4, 0.5), dur: 0.4 }, { to: on(PANE, 0, 0.78, 0.45), dur: 0.6 },
        /* only the contracts that end today, and every clock again */
        { pick: 'pane-clock', option: '0DTE', dur: 0.45 }, { hold: 0.7 },
        { to: on(PANE, 0, 0.35, 0.5), dur: 0.4 }, { to: on(PANE, 0, 0.7, 0.45), dur: 0.5 },
        { unpick: 'pane-clock' }, { hold: 0.25 },
        /* a champion in the head is a door: the busiest name on the pane */
        { press: on('[data-trace-champion="busiest"] button', 0), dur: 0.5 }, { hold: 0.6 },
        { to: on(PANE, 0, 0.55, 0.5), dur: 0.45 },
        /* the search cleared: the board's leader back on the pane */
        { press: on('button[aria-label="Clear the search"]', 0), dur: 0.5 }, { hold: 0.4 },
      ],
    },
    PHONE: {
      '/trace/live-tape': [
        ...narrow,
        /* down to the tape, and a row opens the print — its card fills the phone */
        { scroll: 300, dur: 0.8 },
        { press: row(0, 0.12), dur: 0.45 }, { hold: 0.9 },
        { press: on(`${CARD} button[title="Next print (↓)"]`, 0), dur: 0.45 }, { hold: 0.8 },
        { press: on(`${CARD} button[aria-label="Close"]`, 0), dur: 0.45 }, { hold: 0.35 },
        { scroll: -300, dur: 0.8 },
        { press: on('button[aria-label="Clear the search"]', 0), dur: 0.5 }, { hold: 0.5 },
      ],
      /* (a whole number of LIVE's breaths as on the desk: 232 frames, 231 = 11 × 21) */
      '/trace/net-flow': [
        { press: on('[data-ticker]', 1), dur: 0.5 }, { hold: 0.5 },
        /* the board stands over the pane on a phone: down to the picked name's session */
        { scroll: 640, dur: 0.9 }, { hold: 0.2 },
        { to: on(PANE, 0, 0.25, 0.5), dur: 0.4 }, { to: on(PANE, 0, 0.75, 0.42), dur: 0.6 },
        { pick: 'pane-clock', option: '0DTE', dur: 0.45 }, { hold: 0.6 },
        { unpick: 'pane-clock' }, { hold: 0.2 },
        { scroll: -640, dur: 0.9 }, { hold: 0.2 },
        { press: on('button[aria-label="Clear the search"]', 0), dur: 0.5 }, { hold: 0.28 },
      ],
    },
  };
};
