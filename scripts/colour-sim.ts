/*
  COLOUR VISION, SIMULATED (scripts/colour-sim.ts) — the dichromat simulations the proofs measure under: Machado,
  Oliveira and Fernandes (2009) at full severity, applied in linear sRGB and clamped, and the OKLab distance there.
  One copy, read by scripts/orbs-proof.ts (the ovals against the candles) and scripts/indicator-inks-proof.ts (the
  owner's colour rule under every Colours option). Not a proof of its own.
*/
export type RGB = readonly [number, number, number];
export type Deficiency = 'protan' | 'deutan' | 'tritan';

export const DEFICIENCIES: Record<Deficiency, readonly (readonly number[])[]> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

/** OKLab of a colour already in linear sRGB */
export const oklabOfLinear = (l3: readonly number[]): [number, number, number] => {
  const [r, g, b] = l3;
  const L = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const M = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const S = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * L + 0.793617785 * M - 0.0040720468 * S, 1.9779984951 * L - 2.428592205 * M + 0.4505937099 * S, 0.0259040371 * L + 0.7827717662 * M - 0.808675766 * S];
};

/** A colour (0–255 channels) as a dichromat of this kind sees it, in linear sRGB — as it is, with no deficiency named */
export const simulate = (rgb: RGB, d?: Deficiency): number[] => {
  const l = rgb.map(lin);
  if (!d) return l;
  return DEFICIENCIES[d].map(row => Math.max(0, Math.min(1, row[0] * l[0] + row[1] * l[1] + row[2] * l[2])));
};

/** The OKLab distance between two colours, as a dichromat of this kind sees them (normal vision with none named) */
export const distanceUnder = (a: RGB, b: RGB, d?: Deficiency): number => {
  const A = oklabOfLinear(simulate(a, d));
  const B = oklabOfLinear(simulate(b, d));
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
};

/** The distance under each deficiency */
export const apart = (a: RGB, b: RGB): Record<Deficiency, number> => ({ protan: distanceUnder(a, b, 'protan'), deutan: distanceUnder(a, b, 'deutan'), tritan: distanceUnder(a, b, 'tritan') });
