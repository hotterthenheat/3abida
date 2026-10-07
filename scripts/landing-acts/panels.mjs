/* THE PANELS' ACTS (2026-10-06 — the owner's directive: "for each room's selected row, show the panel that row describes,
   not the whole page"; re-framed 2026-10-07 — the owner: "we're having a problem with my landing page's recordings and the
   aspect ratios", and of the fix, "re-frame close-ups"). Each page the rooms show may have a PANEL: ONE WHOLE PART of the
   desk its row is about — a widget with its head, a card from its title, a table from its column heads, a column of cards —
   `box` [x, y, w, h] in the desk's CSS px, its shape that part's own, filmed alone at three device pixels a point
   (make-landing-clips.mjs, size "panel"). NOTHING IS CUT AT ITS EDGES: a box ends in a gutter, between two rows or at a
   card's edge, never through a word, a bar or a chart; the landing's window shows it whole on its own ground (fit.ts).

   A PANEL IS AS WIDE AS ITS WORDS ALLOW: the landing's window is about 780 px wide at 1440, so a part whose smallest words
   are 8 px stays near 660 px of the desk (they read at 9.5 px or more), and a table of 11–12 px figures may run to 900.
   A page whose part cannot be taken whole at a readable size (the four charts, the wall, net flow — each as wide as the
   desk) has no panel: the window plays its whole page.

   The pointer stays inside the panel: it reads the panel the way its reader would — a row hovered, a card, a chart's
   crosshair — and presses nothing a panel could not take back (a second press on a Compass card opens its page; a SELL
   is a trade). The live feed moves underneath at the film's speed. */
export default ({ near, inPanel }) => {
  /* a short read of the panel: the pointer to each point in turn, resting a moment on each */
  const read = (...points) =>
    points.flatMap(([fx, fy, rest = 0.85], i) => [{ to: inPanel(fx, fy), dur: i ? 0.45 : 0.55 }, { hold: rest }]);
  return {
    PANEL: {
      /* Pulse — the desk: the strike pressure ladder, its rows read one by one (each strike's own card rides with the
         pointer) */
      '/pulse': {
        box: [752, 185, 664, 484],
        beats: [
          { to: near('[data-ladder-row]', -4, 0.25), dur: 0.55 }, { hold: 0.75 },
          { to: near('[data-ladder-row]', -1, 0.3), dur: 0.45 }, { hold: 0.9 },
          { to: near('[data-ladder-row]', 2, 0.3), dur: 0.45 }, { hold: 0.9 },
          { to: near('[data-ladder-row]', 5, 0.35), dur: 0.45 }, { hold: 0.75 },
        ],
      },
      /* Compass — the board: the cards, the strongest first */
      '/compass': { box: [88, 240, 434, 332], beats: read([0.36, 0.22], [0.3, 0.58], [0.84, 0.26], [0.72, 0.6, 0.7]) },
      /* Compass — the tracker: what you kept, live */
      '/compass/tracker': { box: [72, 88, 444, 264], beats: read([0.3, 0.42], [0.62, 0.42], [0.2, 0.7], [0.86, 0.44, 0.7]) },
      /* Terrain — the chart and the strike rail beside it */
      '/terrain': { box: [60, 298, 682, 380], beats: read([0.12, 0.5], [0.22, 0.36], [0.55, 0.42], [0.58, 0.62], [0.5, 0.78, 0.7]) },
      /* Pinpoint — the Map: the book by strike, a cell's own card under the pointer */
      '/pinpoint/map': { box: [76, 140, 592, 396], beats: read([0.42, 0.22], [0.6, 0.45], [0.35, 0.72], [0.75, 0.82, 0.7]) },
      /* Pinpoint — what was added today, strike by strike */
      '/pinpoint/building': { box: [90, 236, 640, 488], beats: read([0.42, 0.18], [0.5, 0.48], [0.46, 0.8], [0.7, 0.62, 0.7]) },
      /* Pinpoint — two names' books on one ruler */
      '/pinpoint/compare': { box: [88, 100, 906, 470], beats: read([0.3, 0.55], [0.68, 0.58], [0.5, 0.76], [0.22, 0.82, 0.7]) },
      /* Trace — the live tape, the newest print first */
      '/trace/live-tape': { box: [80, 240, 880, 456], beats: read([0.3, 0.42], [0.52, 0.58], [0.42, 0.78], [0.66, 0.66, 0.7]) },
      /* Trace — the dark pool: the shelves, and the crosses that made them */
      '/trace/dark-pool': { box: [80, 250, 546, 370], beats: read([0.25, 0.55], [0.22, 0.75], [0.75, 0.52], [0.72, 0.76, 0.7]) },
      /* Trace — the screener: every contract that traded */
      '/trace/screener': { box: [80, 272, 780, 422], beats: read([0.4, 0.6], [0.5, 0.75], [0.3, 0.9], [0.62, 0.68, 0.7]) },
      /* the Weigher — the chain, and the position card */
      '/weigher': { box: [750, 160, 660, 458], beats: read([0.3, 0.1], [0.4, 0.26], [0.35, 0.6], [0.3, 0.86, 0.7]) },
      /* Dossier — news: the story the wire is carrying, opened beside the map */
      '/dossier/news': { box: [1015, 205, 392, 346], beats: read([0.3, 0.5], [0.62, 0.68], [0.4, 0.88], [0.72, 0.4, 0.7]) },
      /* Dossier — earnings: the week's reports, each priced */
      '/dossier/earnings': { box: [880, 238, 530, 420], beats: read([0.2, 0.33], [0.42, 0.33], [0.2, 0.7], [0.42, 0.7, 0.7]) },
      /* Dossier — insiders: the names to know, and who filed */
      '/dossier/insiders': { box: [80, 256, 666, 436], beats: read([0.2, 0.15], [0.56, 0.15], [0.4, 0.55], [0.45, 0.8, 0.7]) },
      /* Dossier — Congress: the reports to know, and the members' filings */
      '/dossier/congress': { box: [80, 280, 666, 384], beats: read([0.2, 0.15], [0.56, 0.15], [0.42, 0.55], [0.45, 0.8, 0.7]) },
      /* Dossier — stocks: every name's plain read */
      '/dossier/stocks': { box: [80, 352, 650, 376], beats: read([0.3, 0.3], [0.5, 0.55], [0.4, 0.8], [0.7, 0.42, 0.7]) },
      /* Practice — paper: the chain, the contract held, its greeks and the ticket */
      '/practice/paper': { box: [857, 336, 558, 400], beats: read([0.25, 0.27], [0.25, 0.42], [0.3, 0.48], [0.45, 0.72], [0.6, 0.66, 0.7]) },
      /* Practice — the backtest: the past day's chart with its orders, and the replay */
      '/practice/backtest': { box: [77, 170, 888, 610], beats: read([0.4, 0.45], [0.68, 0.3], [0.62, 0.55], [0.5, 0.92, 0.7]) },
      /* Practice — the journal: the month, day by day */
      '/practice/journal': { box: [77, 248, 988, 534], beats: read([0.25, 0.25], [0.45, 0.25], [0.65, 0.55], [0.45, 0.8, 0.7]) },
    },
  };
};
