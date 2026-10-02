/* TERRAIN'S ACTS (2026-10-02 — the owner: "make sure the videos really show the features of every page", "make them move
   fast"): the strike ladder beside each chart read row by row and its Net view; three charts — the third pane's own
   timeframe, its thin rail's hover card, the rails' colours; a strike kept on SPY's rail, and back to two */
export default ({ on, tf, tfButtonNow }) => ({
  DESK: {
    '/terrain': [
      /* down SPY's ladder: the read line under it names each strike the pointer crosses */
      { to: on('[data-profile-panel]', 0, 0.56, 0.3), dur: 0.45 }, { to: on('[data-profile-panel]', 0, 0.56, 0.6), dur: 0.45 },
      /* the Net view: each strike's net as a figure and a row of dashes, read on two rows, and the ladder again */
      { press: on('[data-profile-view="net"]', 0), dur: 0.45 }, { hold: 0.45 },
      { to: on('[data-profile-panel]', 0, 0.3, 0.42), dur: 0.35 }, { to: on('[data-profile-panel]', 0, 0.3, 0.8), dur: 0.4 },
      { press: on('[data-profile-view="ladder"]', 0), dur: 0.45 }, { hold: 0.25 },
      /* three charts: a third pane across the foot, wide enough that its own timeframe reads — an hour a bar, off the button
         its chart wears. SPY and QQQ keep theirs (a pane's timeframe is its own) */
      { press: on('button[aria-label="3 charts"]', 0), dur: 0.5 }, { hold: 0.5 },
      { remember: 'tf', of: tfButtonNow(2) },
      { press: on('button[title="Timeframe"]', 2), dur: 0.5 }, { hold: 0.2 }, { press: tf('1h', 0), dur: 0.35 }, { hold: 0.55 },
      /* its rail is thin enough that a strike hovered opens its card */
      { to: on('[data-profile-panel]', 2, 0.55, 0.5), dur: 0.4 }, { to: on('[data-profile-panel]', 2, 0.55, 0.74), dur: 0.45 }, { hold: 0.3 },
      /* the rails' colours, Thermal to House on every pane at once, and back */
      { pick: 'terrain-colours', option: 'House', dur: 0.45 }, { hold: 0.6 },
      { unpick: 'terrain-colours' },
      { press: on('button[title="Timeframe"]', 2), dur: 0.45 }, { hold: 0.15 }, { press: tf(c => c.memo.tf, 0), dur: 0.3 }, { hold: 0.2 },
      /* a strike kept on SPY's rail: its row stays lit and its card says "Kept". A strike among the candles, below the
         market — not the heaviest one further down, whose row is lit already. The second press lands where the first did,
         the pointer not moved — the panel presses the strike it last hovered, so it lets go of the same one even if the rows
         have eased. Pressed in SPY's pane, it makes SPY the desk's active pane again (the third pane took that with its
         timeframe): going back to two, the desk would otherwise hand it to QQQ, and the foil ring with it */
      { press: on('[data-profile-panel]', 0, 0.5, 0.72), dur: 0.45 }, { hold: 0.8 },
      { press: true }, { hold: 0.25 },
      { press: on('button[aria-label="2 charts"]', 0), dur: 0.45 }, { hold: 0.4 },
    ],
  },
  PHONE: {
    /* a phone's Terrain is one chart (Terrain.tsx: a phone gets one pane, its rail off): the chart read, its name switched off
       the pane's own picker and its timeframe, each put back */
    '/terrain': [
      { remember: 'tf', of: tfButtonNow(0) },
      { to: on('[data-chart-ink]', 0, 0.3, 0.5), dur: 0.45 }, { to: on('[data-chart-ink]', 0, 0.78, 0.42), dur: 0.6 },
      /* the pane's own name, off its picker's list (a line is the symbol and the company in two spans, read by the company) */
      { press: on('[data-scope-pick]', 0), dur: 0.45 }, { hold: 0.3 },
      { press: on('button:has-text("NVIDIA Corporation")', 0, 0.3), dur: 0.4 }, { hold: 0.9 },
      { to: on('[data-chart-ink]', 0, 0.35, 0.55), dur: 0.45 }, { to: on('[data-chart-ink]', 0, 0.8, 0.45), dur: 0.55 },
      { press: on('button[title="Timeframe"]', 0), dur: 0.45 }, { hold: 0.25 }, { press: tf('5m', 0), dur: 0.35 }, { hold: 0.55 },
      { to: on('[data-chart-ink]', 0, 0.4, 0.5), dur: 0.45 },
      { press: on('button[title="Timeframe"]', 0), dur: 0.45 }, { hold: 0.25 }, { press: tf(c => c.memo.tf, 0), dur: 0.35 }, { hold: 0.4 },
      { press: on('[data-scope-pick]', 0), dur: 0.45 }, { hold: 0.3 },
      { press: on('button:has-text("SPDR S&P 500 ETF Trust")', 0, 0.3), dur: 0.4 }, { hold: 0.6 },
    ],
  },
});
