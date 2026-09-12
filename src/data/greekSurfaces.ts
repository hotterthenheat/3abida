import { exposureAt, higherGreeks, perDay, perVolPoint } from '../core/higherGreeks';
import type { StrikeNode } from '../types/market';

/*
==================================================
  SLAYER TERMINAL - HIGHER-GREEK SURFACES
  (data/greekSurfaces.ts)

  Color · Vomma · Speed · Veta · Zomma by strike —
  P-12, P-13, P-14.
==================================================

  ONE SURFACE, FIVE LENSES, because they are the same object read through
  different derivatives and building five pages would make them look like
  five unrelated products. A reader switches lens the way they switch
  GEX/DEX/VEX on the positioning map — same rows, same dealer signs, same
  ink — and the only thing that changes is which question the numbers
  answer.

  THE DEALER SIGN IS NOT RE-DECIDED HERE. It is the house convention every
  other surface reads (call side negative — see data/exposure.ts), passed
  into the shared `exposureAt` aggregator. A sixth surface inventing a sixth
  convention is exactly the failure core/walls.ts was extracted to stop, and
  this file is where it would most easily happen: five new greeks is five
  new chances to flip a sign nobody notices.

  UNITS ARE CONVERTED ONCE, AT THIS BOUNDARY. core/higherGreeks.ts returns
  raw partials on purpose; a reader wants vol greeks per POINT and clock
  greeks per DAY. That conversion happens here, through the sanctioned
  helpers, exactly once — and the lens carries its unit in its own label so
  a number on screen can never be read in the wrong one.
*/

export const GREEK_LENSES = ['color', 'vomma', 'speed', 'veta', 'zomma'] as const;
export type GreekLens = (typeof GREEK_LENSES)[number];

/** The house convention: the call side carries the negative sign. */
const CALL_SIGN = -1 as const;

export interface LensMeta {
  key: GreekLens;
  label: string;
  /** The unit a reader should hold in their head. */
  unit: string;
  /** What the lens answers, in one line. */
  question: string;
}

export const LENS_META: Record<GreekLens, LensMeta> = {
  color: {
    key: 'color',
    label: 'Color',
    unit: 'gamma per day',
    question: 'How fast the gamma profile is intensifying into the close — the clock on GAMMA, and the reason 0DTE pins tighten through the afternoon.',
  },
  vomma: {
    key: 'vomma',
    label: 'Vomma',
    unit: 'vega per vol point',
    question: 'Vol convexity. Large negative net vomma is the regime where a vol spike feeds on itself.',
  },
  speed: {
    key: 'speed',
    label: 'Speed',
    unit: 'gamma per $1',
    question: 'How fast the gamma wall moves toward or away as price travels — the mechanism behind an air-pocket move once price punches a level.',
  },
  veta: {
    key: 'veta',
    label: 'Veta',
    unit: 'vega per day',
    question: 'How much vega dealers shed per day, and therefore their appetite to roll vol as expiries approach.',
  },
  zomma: {
    key: 'zomma',
    label: 'Zomma',
    unit: 'gamma per vol point',
    question: 'How much each strike’s gamma responds to a move in vol — the per-strike detail behind the stability gauge.',
  },
};

export interface GreekStrikeRow {
  strike: number;
  call: number;
  put: number;
  net: number;
}

export interface GreekSurface {
  lens: GreekLens;
  rows: GreekStrikeRow[];
  /** Book total. */
  net: number;
  /** Largest |net| across rows — the bar scale. */
  maxAbs: number;
}

/**
 * One lens over a chain.
 *
 * @param t years to the expiry the surface is read at
 */
export function buildGreekSurface(
  chain: readonly StrikeNode[],
  spot: number,
  iv: number,
  lens: GreekLens,
  t = 1 / 12
): GreekSurface {
  const empty: GreekSurface = { lens, rows: [], net: 0, maxAbs: 0 };
  if (chain.length === 0 || !(spot > 0) || !(iv > 0)) return empty;

  let maxAbs = 0;
  let net = 0;
  const rows: GreekStrikeRow[] = [];
  for (const n of chain) {
    const g = higherGreeks(spot, n.strike, t, iv);
    /* The one conversion boundary — see the header. */
    const perContract =
      lens === 'color' || lens === 'veta'
        ? perDay(g[lens])
        : lens === 'vomma' || lens === 'zomma'
          ? perVolPoint(g[lens])
          : g.speed;
    const e = exposureAt(perContract, { callOI: n.callOI ?? 0, putOI: n.putOI ?? 0 }, CALL_SIGN);
    if (Math.abs(e.net) > maxAbs) maxAbs = Math.abs(e.net);
    net += e.net;
    rows.push({ strike: n.strike, call: e.call, put: e.put, net: e.net });
  }
  rows.sort((a, b) => b.strike - a.strike);
  return { lens, rows, net, maxAbs };
}

/** The book-level read a lens deserves, in the desk's voice. */
export function surfaceWords(s: GreekSurface): string {
  if (s.rows.length === 0) return 'No book to read';
  const dir = s.net >= 0 ? 'positive' : 'negative';
  switch (s.lens) {
    case 'color':
      return s.net >= 0
        ? 'Net color is positive — the gamma profile is INTENSIFYING as the clock runs, which is how a pin tightens into the close.'
        : 'Net color is negative — the gamma profile is flattening as the clock runs, so today’s levels lose their grip rather than gaining it.';
    case 'vomma':
      return s.net < 0
        ? 'Net vomma is NEGATIVE — short vol convexity, the regime where a vol spike feeds on itself.'
        : 'Net vomma is positive — dealer books gain vega as vol rises, which damps a spike rather than feeding it.';
    case 'speed':
      return `Net speed is ${dir} — this is how fast the gamma wall itself travels as price moves, and it is what turns a level break into an air-pocket move.`;
    case 'veta':
      return `Net veta is ${dir} — the vega dealers shed per day, and the pressure behind rolling vol as expiries approach.`;
    case 'zomma':
      return `Net zomma is ${dir} — the per-strike detail behind whether the map holds when vol moves.`;
  }
}
