/*
  Canonical GEX chart colors — single source for JS-API consumers
  (lightweight-charts price lines, canvas primitives). The same values live in
  tailwind.config.ts as `flip` / `supreme` / `darkpool` tokens for class usage.
  Change here + there together, never one alone.
*/

/** Apple system green — the market's bullish voice (matches the `bull`
    tailwind token). JS-side chart code imports THIS; class-side uses `bull`. */
export const BULL = '#30D158';
/** The down side of the direction pair — the candles', a change's, a flow leg's (the owner, 2026-10-14: "Bull/bear is
    for candles only" — direction, never a wall) */
export const BEAR = '#FF3B30';
/** The house accent — the holo family's flat silver (matches `select`, the dark
    set the chart islands wear). Selection, brand, what is live. Never market
    direction. A neon lime until 2026-10-02 (the owner: "remove all lime/green
    accent color it should be holographic silver"). A chart that can wear a
    light ground reads the token instead, off its own box (readToken('--select',
    …, box)), so a light tape gets the deep silver. */
export const ACCENT = '#C7D3E8';

/* THE WALLS WEAR THE GAMMA PAIR — GOLD ABSORBS, VIOLET AMPLIFIES (the owner, 2026-10-14, the orbs message: "Gold = absorb
   (calls side), Violet = amplify (puts side) — Skylit's meaning … Call wall chip gold, put wall chip violet"; from
   2026-10-14's earlier pass to that message the pair was ember/glacier the other way round, and green/red before it).
   The dark tokens' own values (tokens.css --absorb 240 196 70, --amplify 132 102 234). A surface that can wear a light
   ground reads the tokens off its own box (paletteInk, gexNodesPrimitive trailPaperFrom / axisInksFrom). */
export const CALL_WALL = '#F0C446';
export const PUT_WALL = '#8466EA';
/* INDECISION GRAY (Noah, 2026-08-29): the flip is the price where the book
   is on the verge of two sides — neither's color belongs to it. Gray IS the
   read. (The old baby blue moved up: it is the supreme's now.) */
export const FLIP = '#9CA3AF';
// The `supreme` token — one supreme color everywhere: MAGENTA, restored (Noah,
// 2026-08-29, after a full odyssey magenta → silver → baby blue → neon:
// "i reveried and skylit doesnt have those colors"). Nothing else on any
// chart is magenta, so the supreme marker is unmistakable — and the FOCUS
// accent gets its selection voice back to itself. Mirrors tailwind's `supreme`.
export const SUPREME = '#EA00FF';
export const DARK_POOL = '#2dd4bf'; // teal — institutional reference prints
export const FOCUS = ACCENT; // the silver accent — what the user clicked (selection language)


// The alert ink — the one ORANGE on the desk, reserved for "something you
// asked to be told about". Direction pair, dealer golds, supreme magenta and
// flip blue are all spoken for; a fired alert must not impersonate any of
// them. (Arrived with the alert system, 2026-08-28.)
export const ALERT = '#FF9500';

