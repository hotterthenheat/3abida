/*
  Canonical GEX chart colors — single source for JS-API consumers
  (lightweight-charts price lines, canvas primitives). The same values live in
  tailwind.config.ts as `flip` / `supreme` / `darkpool` tokens for class usage.
  Change here + there together, never one alone.
*/

/** Apple system green — the market's bullish voice (matches the `bull`
    tailwind token). JS-side chart code imports THIS; class-side uses `bull`. */
export const BULL = '#30D158';
/** Neon lime — the interface's voice (matches `select`). Selection, brand,
    extreme importance. Never market direction. */
export const LIME = '#D2FF00';

export const CALL_WALL = BULL; // green, not mint — reversed by Noah 2026-08-18
export const PUT_WALL = '#FF3B30'; // bear (hot red)
/* INDECISION GRAY (Noah, 2026-08-29): the flip is the price where the book
   is on the verge of two sides — neither's color belongs to it. Gray IS the
   read. (The old baby blue moved up: it is the supreme's now.) */
export const FLIP = '#9CA3AF';
// The `supreme` token — one supreme color everywhere: MAGENTA, restored (Noah,
// 2026-08-29, after a full odyssey magenta → silver → baby blue → neon:
// "i reveried and skylit doesnt have those colors"). Nothing else on any
// chart is magenta, so the supreme marker is unmistakable — and FOCUS lime
// gets its selection voice back to itself. Mirrors tailwind's `supreme`.
export const SUPREME = '#EA00FF';
export const DARK_POOL = '#2dd4bf'; // teal — institutional reference prints
export const FOCUS = LIME; // neon lime — what the user clicked (selection language)


// The alert ink — the one ORANGE on the desk, reserved for "something you
// asked to be told about". Direction pair, dealer golds, supreme magenta and
// flip blue are all spoken for; a fired alert must not impersonate any of
// them. (Arrived with the alert system, 2026-08-28.)
export const ALERT = '#FF9500';

