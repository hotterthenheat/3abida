/*
==================================================
  SLAYER TERMINAL - REVIEW · A LADDER OF WAYS OUT
  (data/review/ladder.ts)

  What both engines share of "multiple targets and
  stops" (Noah, 2026-09-20: "some people have multiple
  tps and stop losses in place… how can we incorporate
  that"). The rules are the two rules pages' ("A
  ladder of ways out"); this file is the arithmetic
  they have in common, with nothing of an option or a
  future in it:

    a rung        a price, and a whole number of
                  contracts
    a bracket     what rides an order: up to three
                  targets and two stops (or the old
                  single `target` / `stop`), and two
                  switches — breakeven, trailing
    a split       contracts shared out between levels,
                  the NEARER level taking the odd one
    giving up     when one side fills, the other side
                  gives up that many contracts, the
                  FURTHEST rung first

  The engines own everything that needs a price of
  their own kind: which way is "further", what "would
  not wait" means, what a fill is.
==================================================
*/

export interface Rung {
  price: number;
  qty: number;
}
export const MAX_TARGETS = 3;
export const MAX_STOPS = 2;

/** What rides an order. `target` / `stop` are the single ways out a session saved before the ladder carries — and what a
    ticket with one of each still sends; `targets` / `stops` win where they are given. */
export interface LadderBracket {
  target?: number;
  stop?: number;
  targets?: Rung[];
  stops?: Rung[];
  /** When the first target fills, every stop moves to what was paid */
  breakeven?: boolean;
  /** Every stop keeps a distance from the best price since: `trailBy` where it is typed, else the distance it was set at */
  trail?: boolean;
  trailBy?: number;
}

/** Contracts shared between `parts` levels — the nearer level takes the odd one; never a level with none */
export function splitQty(qty: number, parts: number): number[] {
  const n = Math.max(1, Math.min(parts, qty));
  const base = Math.floor(qty / n);
  return Array.from({ length: n }, (_, i) => base + (i < qty - base * n ? 1 : 0));
}

/** The rungs a bracket asks for, for an order of `qty` contracts */
export function rungsOf(b: LadderBracket | undefined, qty: number): { targets: Rung[]; stops: Rung[] } {
  if (!b) return { targets: [], stops: [] };
  return {
    targets: b.targets?.length ? b.targets : b.target != null && b.target > 0 ? [{ price: b.target, qty }] : [],
    stops: b.stops?.length ? b.stops : b.stop != null && b.stop > 0 ? [{ price: b.stop, qty }] : [],
  };
}

/** Why a bracket's SHAPE cannot be taken (its prices are the engine's to judge), or null */
export function ladderShapeRefusal(b: LadderBracket | undefined, qty: number): string | null {
  const { targets, stops } = rungsOf(b, qty);
  if (targets.length > MAX_TARGETS) return 'No more than three targets';
  if (stops.length > MAX_STOPS) return 'No more than two stops';
  for (const [rungs, word] of [[targets, 'target'], [stops, 'stop']] as const) {
    if (rungs.some(r => !(r.price > 0))) return `Every ${word} needs a price`;
    if (rungs.some(r => !Number.isInteger(r.qty) || r.qty < 1)) return `Every ${word} needs a whole number of contracts`;
    if (rungs.reduce((a, r) => a + r.qty, 0) > qty) return `The ${word}s speak for more contracts than the order has`;
    if (new Set(rungs.map(r => r.price)).size !== rungs.length) return `Two ${word}s at one price are one ${word}`;
  }
  if (b?.trail && stops.length === 0) return 'A trailing stop needs a stop to trail';
  if (b?.trailBy != null && !(b.trailBy > 0)) return 'Trail by a distance above nothing';
  if (b?.breakeven && (stops.length === 0 || targets.length === 0)) return 'Breakeven moves the stop when the first target fills — it needs both';
  return null;
}

/** `q` contracts taken away from a side, the FURTHEST rung first (`farness`: bigger is further). What each rung is left
    with, by id — a rung left with none is gone. */
export function giveUp<T extends { id: string; qty: number }>(rungs: T[], q: number, farness: (r: T) => number): Map<string, number> {
  const left = new Map<string, number>();
  let owed = q;
  for (const r of [...rungs].sort((a, b) => farness(b) - farness(a))) {
    const take = Math.min(r.qty, Math.max(0, owed));
    owed -= take;
    left.set(r.id, r.qty - take);
  }
  return left;
}

/** A further pull off a position's chip: how many contracts the new level takes, and which rung gives them (null = the
    contracts no level covers yet). `cover`: the contracts the ladder may speak for. Null when the pull cannot be taken —
    the ladder is full, or no level has two contracts to give. */
export function nextRung<T extends { id: string; qty: number }>(rungs: T[], cover: number, max: number, farness: (r: T) => number): { qty: number; from: T | null } | null {
  if (rungs.length >= max) return null;
  const covered = rungs.reduce((a, r) => a + r.qty, 0);
  if (covered < cover) return { qty: cover - covered, from: null };
  const donor = [...rungs].sort((a, b) => b.qty - a.qty || farness(b) - farness(a))[0];
  if (!donor || donor.qty < 2) return null;
  return { qty: Math.floor(donor.qty / 2), from: donor };
}
