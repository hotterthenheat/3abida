/* PULSE'S ACTS (2026-10-02 — the owner: "make sure the videos really show the features of every page", "make them
   move fast"). The desk is used the way its reader uses it: the chart read under the pointer and put on another timeframe,
   the ladder's strikes read one by one and its read opened, a setup opened to its full analysis and shut, the catalogue of
   panels browsed, another desk put up and this one brought back. The 4-way board: a chart on another timeframe, another
   name typed into a chart's own chip, one chart taking the whole screen with its session levels switched on and off. */
export default ({ on, near, btn, tf, at, off, SEARCH_MENU, tfButtonNow, tfVia, tfNow }) => {
  /* the catalogue's names down its left (Pulse.tsx, "Add a panel": data-pulse-add): only hovered — a press would add the panel */
  const CATALOGUE = 'div[class*="w-[228px]"] > button';
  /* the 4-way board's cell that has the screen (PulseBoard: the expanded cell is lifted into a fixed layer) */
  const LIFTED = 'div[class*="z-[80]"]';
  /* a point on the n-th `sel`, wherever it stands — on a phone a chart lifted to the whole screen wears its taskbar where
     the top bar was, and on() keeps out of that band */
  const anywhere = (sel, n = 0, fx = 0.5, fy = 0.5) => async ({ frame }) => {
    const b = await frame.locator(sel).nth(n).boundingBox({ timeout: 1500 }).catch(() => null);
    return b && b.width > 2 && b.height > 2 ? [b.x + b.width * fx, b.y + b.height * fy] : null;
  };
  /* the timeframe the strip opened on, pressed only when the strip has left it */
  const tfBack = (n = 0) => async c => ((await tfNow(n)(c)) === c.memo.tf ? null : tf(c.memo.tf, n)(c));
  /* …and a phone's: its one timeframe button, pressed only when it no longer says the timeframe the film began on */
  const tfButtonBack = (n = 0) => async c => ((await tfButtonNow(n)(c)) === c.memo.tf ? null : on('button[title="Timeframe"]', n)(c));
  return {
    DESK: {
      '/pulse': [
        { remember: 'tf', of: tfNow(0) },
        /* the chart read under the pointer, then on five-minute bars */
        { to: on('[data-chart-ground]', 0, 0.4, 0.5), dur: 0.4 }, { to: on('[data-chart-ground]', 0, 0.8, 0.4), dur: 0.5 },
        { press: tf('5m', 0), dur: 0.4 }, { hold: 0.5 },
        /* down the ladder: each strike's own card rides with the pointer; then the book's read, opened and shut */
        { to: near('[data-ladder-row]', -3, 0.55), dur: 0.4 }, { to: near('[data-ladder-row]', 0, 0.55), dur: 0.3 }, { to: near('[data-ladder-row]', 3, 0.55), dur: 0.3 },
        { press: on('[data-ledger-read]', 0), dur: 0.45 }, { hold: 0.8 },
        { press: on('[data-ledger-read]', 0), dur: 0.3 }, { hold: 0.2 },
        /* a setup's card opens its whole analysis over the desk; "The desk" brings the desk back */
        { press: on('[data-compass-card]', 1, 0.45, 0.4), dur: 0.5 }, { hold: 0.7 },
        { to: at(0.42, 0.5), dur: 0.35 }, { to: at(0.62, 0.42), dur: 0.35 },
        { press: btn('The desk'), dur: 0.5 }, { hold: 0.35 },
        /* the catalogue of panels: each name hovered draws that panel, live, beside the list — nothing is added */
        { press: on('[data-pulse-add]', 0), dur: 0.5 }, { hold: 0.3 },
        { to: on(`${CATALOGUE}:has-text("The range")`, 0, 0.4), dur: 0.35 }, { hold: 0.3 },
        { to: on(`${CATALOGUE}:has-text("At the wall")`, 0, 0.4), dur: 0.3 }, { hold: 0.3 },
        { to: on(`${CATALOGUE}:has-text("Where the walls are heading")`, 0, 0.4), dur: 0.3 }, { hold: 0.3 },
        { press: on('[data-pulse-add]', 0), dur: 0.4 }, { hold: 0.2 },
        /* another desk put up, its panels named as the pointer comes to its chip, and this one brought back: a desk mounts
           its panels afresh, so the chart comes back on its first timeframe */
        { to: btn('The Day Ahead'), dur: 0.45 }, { hold: 0.25 },
        { press: btn('The Day Ahead'), dur: 0.1 }, { hold: 0.8 },
        { press: btn('Market Structure'), dur: 0.45 }, { hold: 0.5 },
        /* …and should it ever keep the one it was left on, it is put back (a quick press, only then) */
        { press: tfBack(0), dur: 0.15, optional: true },
      ],
      '/pulse/board': [
        { remember: 'tf0', of: tfNow(0) },
        { to: on('[data-chart-ink]', 0, 0.3, 0.55), dur: 0.45 }, { to: on('[data-chart-ink]', 0, 0.85, 0.42), dur: 0.55 },
        { press: tf('5m', 0), dur: 0.4 }, { hold: 0.5 },
        /* a name of the chart's own: the third turned to TSLA, typed into its chip */
        { press: on('[data-scope-pick]', 2), dur: 0.45 }, { hold: 0.2 },
        { type: 'TSLA' }, { key: 'Enter' }, { hold: 0.8 },
        { to: on('[data-chart-ink]', 2, 0.35, 0.5), dur: 0.4 }, { to: on('[data-chart-ink]', 2, 0.85, 0.45), dur: 0.5 },
        /* one chart takes the whole screen, and yesterday's high, low and close and the opening range are switched on over
           it, named on their lines, and off again */
        { press: on('button[title="Fullscreen chart"]', 3), dur: 0.45 }, { hold: 0.6 },
        { press: on(`${LIFTED} button[title="Overlays"]`, 0), dur: 0.4 }, { hold: 0.25 },
        /* (the menu is drawn at the page's top level, not inside the cell: data-toolbar-menu) */
        { press: on('[data-toolbar-menu] button[role="checkbox"]:has-text("Session levels")', 0, 0.3), dur: 0.35 }, { hold: 0.8 },
        { press: true }, { hold: 0.25 },
        { press: on(`${LIFTED} button[title="Overlays"]`, 0), dur: 0.3 }, { hold: 0.2 },
        { to: at(0.5, 0.5), dur: 0.4 }, { to: at(0.75, 0.42), dur: 0.4 },
        { press: on('button[title="Exit fullscreen (Esc)"]', 0), dur: 0.45 }, { hold: 0.5 },
        /* the third chart back on its own name, the first back on its own timeframe */
        { press: on('[data-scope-pick]', 2), dur: 0.45 }, { hold: 0.2 },
        { type: 'AAPL' }, { key: 'Enter' }, { hold: 0.5 },
        { press: tf(c => c.memo.tf0, 0), dur: 0.45 }, { hold: 0.3 },
      ],
    },
    PHONE: {
      /* a phone's Pulse is one chart, full screen (Pulse.tsx): the chart is worked — another timeframe, another name typed
         into its own search and the first one brought back (a name change builds the chart afresh, on its first timeframe) */
      '/pulse': [
        { remember: 'tf', of: tfButtonNow(0) },
        { to: at(0.3, 0.42), dur: 0.45 }, { to: at(0.8, 0.36), dur: 0.55 },
        ...tfVia('5m'),
        { to: at(0.35, 0.45), dur: 0.4 }, { to: at(0.82, 0.4), dur: 0.5 },
        { press: on('button[title="Switch ticker"]', 0), dur: 0.45 }, { hold: 0.2 },
        { type: 'NVDA' }, { key: 'Enter' }, { hold: 0.8 },
        { to: at(0.3, 0.45), dur: 0.4 }, { to: at(0.8, 0.38), dur: 0.5 },
        { press: on('button[title="Switch ticker"]', 0), dur: 0.45 }, { hold: 0.2 },
        { type: 'SPY' }, { key: 'Enter' }, { hold: 0.6 },
        /* …and should the chart ever keep the timeframe it was left on, it is put back (two quick presses, only then) */
        { press: tfButtonBack(0), dur: 0.15, optional: true }, { press: c => tf(c.memo.tf, 0)(c), dur: 0.15, optional: true },
      ],
      /* no timeframe round trip here: a board cell is a dark island, and a chart built again on a new timeframe fades in
         over it — on a light phone the restore landed on a black frame (measured). The phone shows the board's other
         freedoms: a chart lifted to the whole screen with its own overlays, and the names under it. */
      '/pulse/board': [
        { to: at(0.3, 0.38), dur: 0.45 }, { to: at(0.8, 0.34), dur: 0.55 },
        /* the first chart takes the phone's whole screen; yesterday's levels and the opening range go on over it */
        { press: on('button[title="Fullscreen chart"]', 0), dur: 0.45 }, { hold: 0.5 },
        { press: anywhere(`${LIFTED} button[title="Overlays"]`, 0), dur: 0.45 }, { hold: 0.2 },
        { press: anywhere('[data-toolbar-menu] button[role="checkbox"]:has-text("Session levels")', 0, 0.3), dur: 0.35 }, { hold: 0.25 },
        { press: anywhere(`${LIFTED} button[title="Overlays"]`, 0), dur: 0.3 }, { hold: 0.2 },
        { to: at(0.35, 0.55), dur: 0.4 }, { to: at(0.75, 0.45), dur: 0.45 }, { hold: 0.3 },
        /* …and off again, by the same menu, and the chart given back to the board */
        { press: anywhere(`${LIFTED} button[title="Overlays"]`, 0), dur: 0.4 }, { hold: 0.2 },
        { press: anywhere('[data-toolbar-menu] button[role="checkbox"]:has-text("Session levels")', 0, 0.3), dur: 0.35 }, { hold: 0.2 },
        { press: anywhere(`${LIFTED} button[title="Overlays"]`, 0), dur: 0.3 }, { hold: 0.2 },
        { press: anywhere('button[title="Exit fullscreen (Esc)"]', 0), dur: 0.45 }, { hold: 0.4 },
        /* down the board: three more names, each on its own */
        { scroll: 820, dur: 1.0 }, { hold: 0.3 }, { to: at(0.4, 0.5), dur: 0.4 }, { to: at(0.8, 0.45), dur: 0.4 },
        { scroll: -820, dur: 0.9 }, { hold: 0.3 },
      ],
    },
  };
};
