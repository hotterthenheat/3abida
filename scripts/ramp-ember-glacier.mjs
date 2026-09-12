// Generates arc-length-even stops (OKLab) for the ember/glacier ramp.
const srgb2lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lin2srgb = c => { const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(v * 255))); };
function rgb2oklab([r, g, b]) {
  const [lr, lg, lb] = [srgb2lin(r), srgb2lin(g), srgb2lin(b)];
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const [l_, m_, s_] = [Math.cbrt(l), Math.cbrt(m), Math.cbrt(s)];
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}
function oklab2rgb([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const [l, m, s] = [l_ ** 3, m_ ** 3, s_ ** 3];
  return [
    lin2srgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    lin2srgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    lin2srgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}
const hex = ([r, g, b]) => '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0').toUpperCase()).join('');

function evenStops(anchorsHex, n = 9) {
  const anchors = anchorsHex.map(h => rgb2oklab([parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]));
  // dense piecewise-linear path in OKLab
  const path = [];
  const SEG = 600;
  for (let i = 0; i < anchors.length - 1; i++)
    for (let j = 0; j < SEG; j++) {
      const t = j / SEG;
      path.push(anchors[i].map((v, k) => v + (anchors[i + 1][k] - v) * t));
    }
  path.push(anchors[anchors.length - 1]);
  // cumulative perceptual arc length
  const cum = [0];
  for (let i = 1; i < path.length; i++) {
    const d = Math.hypot(...path[i].map((v, k) => v - path[i - 1][k]));
    cum.push(cum[i - 1] + d);
  }
  const total = cum[cum.length - 1];
  const stops = [];
  for (let i = 0; i < n; i++) {
    const target = (i / (n - 1)) * total;
    let lo = 0;
    while (cum[lo] < target && lo < cum.length - 1) lo++;
    stops.push(oklab2rgb(path[lo]));
  }
  // audit: delta spread between consecutive stops
  const ds = [];
  for (let i = 1; i < stops.length; i++) {
    const a = rgb2oklab(stops[i - 1]), b = rgb2oklab(stops[i]);
    ds.push(Math.hypot(...a.map((v, k) => v - b[k])));
  }
  const spread = Math.max(...ds) / Math.min(...ds);
  return { stops, spread };
}

// EMBER — amplify: neutral -> oxblood -> rust -> fire -> honey gold (the established pole)
const ember = evenStops(['#2A2A2A', '#5C1512', '#A32A15', '#E06A1F', '#F5C542']);
// GLACIER — absorb: neutral -> navy -> deep azure -> cyan -> ice (light pole, keeps the platinum-class luminance gap)
const glacier = evenStops(['#2A2A2A', '#16324F', '#14608A', '#2D9DC0', '#D6EDF8']);

const fmt = (name, r) => {
  console.log(`${name}: spread ${r.spread.toFixed(2)}x`);
  r.stops.forEach((s, i) => console.log(`      [${(i / 8).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}, [${s.join(', ')}]], // ${hex(s)}`));
};
fmt('EMBER', ember);
fmt('GLACIER', glacier);

// the 17-stop scale gradient (pos leads at top)
const g = [...ember.stops.slice(1).reverse(), ...glacier.stops].map(hex);
const pct = g.map((h, i) => `${h} ${Math.round((i / (g.length - 1)) * 100)}%`).join(', ');
console.log(`GRADIENT: linear-gradient(to bottom, ${pct})`);
