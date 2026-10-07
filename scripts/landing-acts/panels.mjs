/* THE PANELS' ACTS (2026-10-06 — the owner's directive: "for each room's selected row, show the panel that row describes,
   not the whole page", and "the smallest product text inside any window is at least 11 px at 1440 wide"). Each page the
   rooms show has a PANEL: the part of the desk its row is about, `box` [x, y, w] in the desk's CSS px (its height is the
   window's shape, 1440 × 1000), filmed alone at three device pixels a point (make-landing-clips.mjs, size "panel").

   A PANEL IS AS WIDE AS ITS SMALLEST WORDS ALLOW: the landing's window is about 780 px wide at 1440, so a panel whose
   smallest words are 8 px is at most 570 px of the desk (8 × 780 / 570 ≥ 11), 9 px at most 640, 7.5 px at most 530 —
   measured on each page as it is staged, and the panel drawn round what its row names.

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
        box: [752, 226, 560],
        beats: [
          { to: near('[data-ladder-row]', -4, 0.25), dur: 0.55 }, { hold: 0.75 },
          { to: near('[data-ladder-row]', -1, 0.3), dur: 0.45 }, { hold: 0.9 },
          { to: near('[data-ladder-row]', 2, 0.3), dur: 0.45 }, { hold: 0.9 },
          { to: near('[data-ladder-row]', 5, 0.35), dur: 0.45 }, { hold: 0.75 },
        ],
      },
      /* Pulse — four charts: two of the four names side by side, each read under the crosshair */
      '/pulse/board': { box: [440, 60, 560], beats: read([0.12, 0.62], [0.3, 0.55, 0.45], [0.66, 0.5], [0.86, 0.45, 0.7]) },
      /* Compass — the board: the cards, the strongest first */
      '/compass': { box: [88, 240, 560], beats: read([0.36, 0.22], [0.3, 0.58], [0.84, 0.26], [0.72, 0.6, 0.7]) },
      /* Compass — the tracker: what you kept, live */
      '/compass/tracker': { box: [72, 88, 460], beats: read([0.3, 0.42], [0.62, 0.42], [0.2, 0.7], [0.86, 0.44, 0.7]) },
      /* Terrain — the chart and the strike rail beside it */
      '/terrain': { box: [180, 300, 560], beats: read([0.12, 0.5], [0.22, 0.36], [0.55, 0.42], [0.58, 0.62], [0.5, 0.78, 0.7]) },
      /* Pinpoint — the Map: the book by strike, a cell's own card under the pointer */
      '/pinpoint/map': { box: [76, 330, 530], beats: read([0.42, 0.22], [0.6, 0.45], [0.35, 0.72], [0.75, 0.82, 0.7]) },
      /* Pinpoint — what was added today, strike by strike */
      '/pinpoint/building': { box: [60, 330, 560], beats: read([0.42, 0.18], [0.5, 0.48], [0.46, 0.8], [0.7, 0.62, 0.7]) },
      /* Pinpoint — at the wall: holds or breaks, and where each way goes */
      '/pinpoint/wall': { box: [430, 470, 560], beats: read([0.5, 0.35], [0.28, 0.48], [0.72, 0.42], [0.55, 0.86, 0.7]) },
      /* Pinpoint — two names' books on one ruler */
      '/pinpoint/compare': { box: [280, 611, 560], beats: read([0.3, 0.55], [0.68, 0.58], [0.5, 0.76], [0.22, 0.82, 0.7]) },
      /* Trace — the live tape, the newest print first */
      '/trace/live-tape': { box: [60, 150, 560], beats: read([0.3, 0.42], [0.52, 0.58], [0.42, 0.78], [0.66, 0.66, 0.7]) },
      /* Trace — net flow: the names ranked by where their money leans, and the session's lines */
      '/trace/net-flow': { box: [55, 100, 560], beats: read([0.2, 0.5], [0.25, 0.7], [0.78, 0.72], [0.9, 0.62, 0.7]) },
      /* Trace — the dark pool: the shelves, and the crosses that made them */
      '/trace/dark-pool': { box: [55, 100, 560], beats: read([0.25, 0.55], [0.22, 0.75], [0.75, 0.52], [0.72, 0.76, 0.7]) },
      /* Trace — the screener: every contract that traded */
      '/trace/screener': { box: [60, 100, 560], beats: read([0.4, 0.6], [0.5, 0.75], [0.3, 0.9], [0.62, 0.68, 0.7]) },
      /* the Weigher — the chain, and the position card */
      '/weigher': { box: [740, 280, 530], beats: read([0.3, 0.1], [0.4, 0.26], [0.35, 0.6], [0.3, 0.86, 0.7]) },
      /* Dossier — news: the story the wire is carrying, opened beside the map */
      '/dossier/news': { box: [1005, 200, 400], beats: read([0.3, 0.5], [0.62, 0.68], [0.4, 0.88], [0.72, 0.4, 0.7]) },
      /* Dossier — earnings: the week's reports, each priced */
      '/dossier/earnings': { box: [840, 222, 560], beats: read([0.2, 0.33], [0.42, 0.33], [0.2, 0.7], [0.42, 0.7, 0.7]) },
      /* Dossier — insiders: the names to know, and who filed */
      '/dossier/insiders': { box: [60, 230, 560], beats: read([0.2, 0.15], [0.56, 0.15], [0.4, 0.55], [0.45, 0.8, 0.7]) },
      /* Dossier — Congress: the reports to know, and the members' filings */
      '/dossier/congress': { box: [60, 230, 560], beats: read([0.2, 0.15], [0.56, 0.15], [0.42, 0.55], [0.45, 0.8, 0.7]) },
      /* Dossier — stocks: every name's plain read */
      '/dossier/stocks': { box: [60, 330, 560], beats: read([0.3, 0.3], [0.5, 0.55], [0.4, 0.8], [0.7, 0.42, 0.7]) },
      /* Practice — paper: the chain, the contract held, its greeks and the ticket */
      '/practice/paper': { box: [800, 330, 560], beats: read([0.25, 0.27], [0.25, 0.42], [0.3, 0.48], [0.45, 0.72], [0.6, 0.66, 0.7]) },
      /* Practice — the backtest: the past day's chart with its orders, and the replay */
      '/practice/backtest': { box: [380, 330, 560], beats: read([0.4, 0.45], [0.68, 0.3], [0.62, 0.55], [0.5, 0.92, 0.7]) },
      /* Practice — the journal: the month, day by day */
      '/practice/journal': { box: [210, 240, 560], beats: read([0.25, 0.25], [0.45, 0.25], [0.65, 0.55], [0.45, 0.8, 0.7]) },
    },
  };
};
