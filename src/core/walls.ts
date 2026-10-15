/*
==================================================
  SLAYER TERMINAL - NAMING THE WALLS (core/walls.ts)

  Which strike is THE call wall, and which is THE
  put wall. One rule, in one place, because it was
  written twice and the two copies disagreed.
==================================================
*/

/** Anything carrying a strike. The exposure is read through an accessor
    because the two callers spell the SAME NUMBER differently: the GEX
    snapshot's levels call it `value`, the option chain's nodes call it
    `netGex`, and `computeGexSnapshot` is literally
    `chain.map(n => ({ strike: n.strike, value: n.netGex }))` (simulator.ts).
    An accessor makes that identity visible at each call site and costs no
    per-tick array to convert between the two spellings. */
export interface Struck {
  readonly strike: number;
}

/**
 * The heaviest CALL-dominant strike in the window, and the heaviest PUT-dominant strike in the window — WHEREVER they
 * stand against the price (the owner, 2026-10-14: "Choose walls from the book, not from price's side: Call wall =
 * heaviest calls-absorb strike in the window. Put wall = heaviest puts-amplify strike in the window. Price crossing a
 * wall no longer moves it").
 *
 * ---------------------------------------------------------------------------
 * WHY THE SIDE OF THE PRICE WENT (2026-10-14)
 * ---------------------------------------------------------------------------
 * Until that day the call wall had to stand ABOVE the price and the put wall BELOW it. So a wall the price walked
 * through stopped being a candidate the next minute and the name jumped to the next strike, then back when the price
 * returned: SPY's put wall went 772 → 770 → 772 seven times between 10:52 and 11:24 am on 2026-10-14, and 770 → 765 →
 * 770 five times after noon, each time the minute the price crossed the wall's own strike (the strike it jumped to
 * held 0.65–0.87 of the wall's gamma — never a near-equal swap). No hold time fixes that: it is the definition. A
 * wall is now named by the book alone, and a price on the far side of it is said as the wall BROKEN (and RECLAIMED
 * when the price comes back — data/feed/trailModel.ts WallStick), never as a new wall.
 *
 * ---------------------------------------------------------------------------
 * WHY THE SIGN IS CHECKED (2026-08, kept)
 * ---------------------------------------------------------------------------
 * The sign IS the measured option side. `netGex = callGex + putGex` with
 * `dealerCallDirection = -0.55` and `dealerPutDirection = -0.53 * -1`
 * (simulator.ts), so NEGATIVE is call-dominant and POSITIVE is put-dominant.
 * Every other surface reads it that way: the heat ramps, the strike field's
 * `put: l.value >= 0`, and the rail's own bar colour. A put-dominant shelf is
 * never the call wall, whatever side of the price it stands on (SPY 505.17,
 * 2026-08: strike 505 carried −$436.8M, CALL-dominant, and was named the put
 * wall under the first rule — the sign check ended that).
 *
 * ---------------------------------------------------------------------------
 * AND WHY IT IS SHARED RATHER THAN FIXED TWICE
 * ---------------------------------------------------------------------------
 * This rule existed in two places — `buildLevelsFor` (data/gex.ts) and
 * `generateTradePlan` (core/simulator.ts) — over the same numbers, and the two
 * disagreed off one book. So it lives here, and every surface — Terrain's field
 * and rail, Pinpoint, Pulse, the scorecard, the alerts, the recap — reads it.
 *
 * @param points  strikes to consider (THE WINDOW: the book's 30 strikes each side, the field's column); order does
 *                not matter
 * @param _spot   the price — kept in the signature for the callers, no longer read: a wall is the book's, not the
 *                price's side's
 * @param valueOf net dealer exposure at a strike — negative call-dominant, positive put-dominant
 * @returns each wall, or `null` where NOTHING in the window is call- (or put-) dominant — callers choose how to render
 *          that
 */
export function pickWalls<T extends Struck>(
  points: readonly T[],
  _spot: number,
  valueOf: (p: T) => number
): { callWall: number | null; putWall: number | null } {
  let callWall: number | null = null;
  let cwAbs = 0;
  let putWall: number | null = null;
  let pwAbs = 0;

  for (const p of points) {
    const v = valueOf(p);
    if (!Number.isFinite(v)) continue;
    const a = Math.abs(v);
    if (v < 0 && a > cwAbs) {
      cwAbs = a;
      callWall = p.strike;
    }
    if (v > 0 && a > pwAbs) {
      pwAbs = a;
      putWall = p.strike;
    }
  }

  return { callWall, putWall };
}

/**
 * The gamma flip: the price where the net crosses zero, NEAREST SPOT — the linear crossing between the two
 * strikes on either side of the sign change (2026-10-13 — the owner: the ladder's rule said 777.50 while its spine
 * crossed zero at 777.12; the midpoint was the old rule, and the spine, the ladder, Pinpoint and the hover now all
 * read this one crossing).
 *
 * ---------------------------------------------------------------------------
 * THE WALLS' STORY, A SECOND TIME — caught before it finished happening
 * ---------------------------------------------------------------------------
 * This rule was written four times: `buildExposureProfile` (data/exposure.ts),
 * `buildLevelsFor` (data/gex.ts), `generateTradePlan` (core/simulator.ts) —
 * all three nearest-to-spot, hand-synced by comments asking the next reader to
 * keep them in step — and `levelsFrom` (data/vannacharm.ts), which walked up
 * the chain and BROKE ON THE FIRST crossing it met.
 *
 * First-from-the-bottom is the exact bug the other three were unified to fix
 * (2026-08-18): a noisy book can carry a jitter crossing deep in the put tail,
 * and breaking on the first hit names THAT the regime border while the
 * structural flip sits at spot. Every migration map, level-shift row and wall
 * drift timeline read the divergent copy, so the flip the Vanna & Charm page
 * projected could disagree with the flip the Exposure page drew, off one book.
 *
 * The fourth copy was found when P-4 needed a FIFTH reader of the rule. Same
 * decision as the walls above: the rule moves here, every caller points at it,
 * and the next surface that needs a flip cannot write its own.
 *
 * @returns the crossing nearest spot, or `null` when the field never changes
 *          sign — a one-sided book has no flip, and "no flip" is a real state
 *          the caller has to render deliberately rather than inherit as spot.
 */
export function pickFlip<T extends Struck>(
  points: readonly T[],
  spot: number,
  valueOf: (p: T) => number
): number | null {
  let flip: number | null = null;
  let flipDist = Infinity;
  for (const x of zeroCrossings(points, valueOf)) {
    const d = Math.abs(x - spot);
    if (d < flipDist) {
      flipDist = d;
      flip = x;
    }
  }
  return flip;
}

/**
 * Every price where the net crosses zero, ascending: between two neighbouring strikes of opposite sign, the linear
 * crossing — strike_a + (strike_b − strike_a) × |v_a| ÷ (|v_a| + |v_b|) — rounded to the cent; a strike whose value
 * is exactly zero is a crossing itself. The flip is the one nearest spot (pickFlip); the hover names the rest.
 */
export function zeroCrossings<T extends Struck>(points: readonly T[], valueOf: (p: T) => number): number[] {
  const asc = [...points].sort((a, b) => a.strike - b.strike);
  const out: number[] = [];
  for (let i = 1; i < asc.length; i++) {
    const va = valueOf(asc[i - 1]);
    const vb = valueOf(asc[i]);
    if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
    if (va === 0 && vb === 0) continue;
    if (Math.sign(va) === Math.sign(vb) && va !== 0 && vb !== 0) continue;
    const a = asc[i - 1].strike;
    const b = asc[i].strike;
    const x = va === 0 ? a : vb === 0 ? b : a + ((b - a) * Math.abs(va)) / (Math.abs(va) + Math.abs(vb));
    const r = Math.round(x * 100) / 100;
    if (!out.length || out[out.length - 1] !== r) out.push(r);
  }
  return out;
}
