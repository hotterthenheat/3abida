/* THE WEIGHER'S ACTS (2026-10-02 — the owner: "make sure the videos really show the features of every page", "make
   them move fast"). THE DESK is used as its one-liner says — pick a name, pick a contract, watch it: a position pressed in
   Your positions puts its contract on the whole desk (TSLA's chart, its chain on the puts with the 250 open, the card's
   projected returns); the chart turned to that contract's own premium and read under the pointer; the card's ruler dragged
   by the cent, the return and its curve moving with it, then the payoff by price; the first position pressed again, and the
   desk is home in one press; and the chain put on next week's Friday off its calendar, and back.
   THE PHONE (a first visit's desk: nothing held, nothing watched): down to the chain, the strike under the market opened to
   its weigh-up, up to the chart to read that contract's premium, and the strike closed again. */
export default ({ on, btn, at, off }) => {
  /* a row of Your positions, by its name (the stage enters five, one a name; the press lands on the row's date, clear of
     its trash bin at the far end) */
  const held = name => on(`[data-list="positions"] .ag-row:has-text("${name}")`, 0, 0.45);

  /* THE CHAIN COMES HOME TO THE ROW IT BEGAN ON. A position pressed points the whole desk at its contract, and the chain
     brings that strike to its top third (ChainCard's reveal, a smooth scroll); a new expiry centres it on the market's
     line. The stage leaves it either way — centred in five stills of six, the strike at the top third in the sixth
     (measured) — and the market often crosses the held strike (the stage holds the strike just under it: crossed while the
     film ran in two films of five, and before the first frame in a third), so neither re-centring nor the reveal finds
     the first frame's rows again. The film remembers where the picked strike stood, and at the end the reader's wheel over
     the chain puts it back there: a wheel scrolls the chain by just its delta, at once (measured), so the delta is given
     in three steps a frame apart, a flick and not a jump. Where it already stands, the wheel does nothing. */
  const selTop = async ({ frame }) => frame.locator('[data-chain-grid] .ag-row.ag-row-selected').first().evaluate(r => r.getBoundingClientRect().top, null, { timeout: 1500 }).catch(() => null);
  const wheelHome = share => ({
    remember: 'wheeled',
    of: async c => {
      const now = await selTop(c);
      if (now == null || c.memo.selTop == null) return 0;
      const dy = Math.round((now - c.memo.selTop) * share);
      if (Math.abs(dy) >= 2) await c.page.mouse.wheel(0, dy);
      return dy;
    },
  });
  const CAL = '[data-dropdown-card="weigher-expiry"]';
  const EXPIRY = on('[data-dropdown="weigher-expiry"]', 0);
  /* the day the calendar has picked, while it is open — the way back */
  const pickedDay = async ({ frame }) => frame.locator(`${CAL} [data-day][data-selected]`).first().getAttribute('data-day', { timeout: 1500 }).catch(() => null);
  /* the same weekday a week on (the calendar takes any trading day ninety days out) */
  const weekOn = async c => {
    if (!c.memo.day) return null;
    const d = new Date(`${c.memo.day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    return on(`${CAL} [data-day="${d.toISOString().slice(0, 10)}"] button`, 0)(c);
  };
  const dayBack = c => (c.memo.day ? on(`${CAL} [data-day="${c.memo.day}"] button`, 0)(c) : null);

  /* THE STRIKE `k` ROWS UNDER THE MARKET'S LINE (1: the first under it), by where the rows stand — the grid lays its rows
     out by transform, so the page's order is not the screen's. Under the line, not over it: a strike opened above the
     line pushes the rows over it up the chain's own scroll (measured on a phone: the row went from 479 to 130, under the
     card's head, while the rows under the line held), and the press that would close it again has nothing to land on; one
     opened under the line unfolds downward, and closed again the chain is where it was (measured) */
  const underMarket = (k = 1, fx = 0.3) => async ({ frame, size }) => {
    const rows = await frame.locator('[data-chain-grid] .ag-row').evaluateAll(els =>
      els.map(e => {
        const r = e.getBoundingClientRect();
        return { id: e.getAttribute('row-id'), x: r.x, y: r.y, w: r.width, h: r.height };
      })
    ).catch(() => []);
    rows.sort((a, b) => a.y - b.y);
    const d = rows.findIndex(r => r.id === 'divider');
    const r = d >= 0 ? rows[d + k] : null;
    return r && r.id?.startsWith('s') && r.y > (size.form === 'phone' ? 48 : 2) && r.y + r.h < size.h - 14 ? [r.x + r.w * fx, r.y + r.h / 2] : null;
  };
  const picked = on('[data-chain-grid] .ag-row.ag-row-selected', 0, 0.3);

  return {
    DESK: {
      '/weigher': [
        /* a position pressed: the whole desk turns to its contract — the chart, the chain (puts, its strike opened), the card */
        { press: held('TSLA'), dur: 0.5 }, { hold: 0.8 },
        /* the chart reads the contract itself: its premium, under the pointer */
        { press: btn('Premium'), dur: 0.45 }, { hold: 0.45 },
        { to: on('[data-chart-ground]', 0, 0.5, 0.58), dur: 0.35 }, { to: on('[data-chart-ground]', 0, 0.84, 0.42), dur: 0.4 },
        /* what it is worth if the stock moves: the ruler slides under its marker, the return and its curve move with it */
        { to: on('[data-price-ruler]', 0, 0.5, 0.5), dur: 0.45 },
        { drag: on('[data-price-ruler]', 0, 0.12, 0.5), dur: 0.7 }, { hold: 0.3 },
        { drag: on('[data-price-ruler]', 0, 0.88, 0.5), dur: 0.85 }, { hold: 0.3 },
        /* …and the same contract by price: the payoff, the dragged price pinned on it */
        { press: btn('By price'), dur: 0.45 }, { hold: 0.6 },
        /* the first position again, and the desk is home in one press: its name, its calls, the stock's tape, and the card by
           date at the market's price (the card sets its price and its view aside when its row changes) */
        { press: held('NVDA'), dur: 0.5 }, { hold: 0.6 },
        /* the chain on next week's Friday, off its calendar — and this Friday again */
        { press: EXPIRY, dur: 0.5 }, { hold: 0.2 },
        { remember: 'day', of: pickedDay },
        { press: weekOn, dur: 0.4 }, { hold: 0.7 },
        { press: EXPIRY, dur: 0.45 }, { hold: 0.2 },
        { press: dayBack, dur: 0.35 }, { hold: 0.3 },
        /* the wheel over the chain, the picked strike back where the film found it */
        { to: on('[data-chain-grid]', 0, 0.55, 0.62), dur: 0.4 },
        wheelHome(0.35), { hold: 0.05 }, wheelHome(0.5), { hold: 0.05 }, wheelHome(1), { hold: 0.3 },
      ],
    },
    PHONE: {
      '/weigher': [
        /* down to the chain: the strike under the market's line opened — its stats, its greeks, the book at it */
        { scroll: 760, dur: 0.9 }, { hold: 0.15 },
        { press: underMarket(1), dur: 0.45 }, { hold: 0.8 },
        { to: off(underMarket(1, 0.5), 30, 230), dur: 0.4 }, { hold: 0.2 },
        /* up to the chart: that contract's own premium, and the stock's tape again */
        { scroll: -760, dur: 0.9 },
        { press: btn('Premium'), dur: 0.45 }, { hold: 0.5 },
        { to: at(0.4, 0.55), dur: 0.35 }, { to: at(0.78, 0.47), dur: 0.4 },
        { press: btn('Stock'), dur: 0.4 }, { hold: 0.3 },
        /* the strike closed where it was opened */
        { scroll: 760, dur: 0.9 },
        { press: picked, dur: 0.45 }, { hold: 0.3 },
        { scroll: -760, dur: 0.9 }, { hold: 0.3 },
      ],
    },
    /* where the chain's picked strike stands as the film begins (the phone's chain has none picked: nothing is kept) */
    REMEMBER: {
      '/weigher': [{ remember: 'selTop', of: selTop }],
    },
  };
};
