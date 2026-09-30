/*
  THE TICKER LOGOS (2026-09-20) — `npm run logos:fetch`

  A name with no file in public/logos/ wears the grey letter tile (ui/CompanyLogo.tsx). Noah, that day: "a few icons for
  the tickers… just show a gray lifeless ticker background" — nothing was broken, the files were never there (17 of ~118
  names). With his word ("yes you can download them all") this fetches the rest from thesvg.org — his pick, an open
  library with a static address per logo (https://thesvg.org/icons/<slug>/default.svg) and a licence per entry — and
  writes what it took, from where and under what licence to docs/logo-sources.md.

  THE LIST IS THE SCRIPT. ticker → the library's slug. A name is here only after its picture was LOOKED AT on both
  grounds at 16px, the size the app draws:
    · a long thin wordmark is nothing at 16px, so it is CROPPED TO ITS SYMBOL by viewBox alone (Delta's widget, Pepsi's
      globe, Colgate's smile, Rivian's compass, CVS's heart) — the drawing itself is untouched;
    · where there is no symbol to crop to (Morgan Stanley, Johnson & Johnson, Lockheed Martin, Honeywell, Micron, Disney,
      Intel — and CrowdStrike, whose falcon sits ON its first letter) the name is LEFT OUT: three bold letters read better
      than a hairline of type;
    · a mark that is black, white or a deep navy cannot sit on both grounds as an <img> — those are listed in
      CompanyLogo.tsx (INK_MARKS · DEEP_MARKS), which draws them as a mask in the page's own ink.
  Not in the library at all (2026-09-20): most of energy, utilities, real estate and materials, TSMC, ASML, the Chinese
  EV names, UnitedHealth, BlackRock. They keep the letters until a source with a licence is chosen.

  It never touches a file it does not list (the first 17, and the three drawn by hand — MSFT · ORCL · COIN — are not here).
  Logos are trademarks of their owners; they are used only to name the company whose ticker is on screen.
*/

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'logos');
const NOTE = join(ROOT, 'docs', 'logo-sources.md');
const BASE = 'https://thesvg.org';

/** ticker → the library's slug */
const SLUGS = {
  // the simulator's names — what Trace, Compass and Pulse show most. NOT Micron, Disney or Intel (Noah, 2026-09-20, after
  // seeing them in a list: "swap those three back to the letter tile") — all three are wordmarks with no symbol to crop
  // to, a hairline of type at 15px where MU · DIS · INTC in bold letters read at once
  PLTR: 'palantir', UBER: 'uber',
  // the Record's sectors
  SCHW: 'charles-schwab', V: 'visa', LLY: 'eli-lilly', PFE: 'pfizer', ABBV: 'abbvie', MRK: 'merck', CVS: 'cvs', ABT: 'abbott',
  HD: 'home-depot', MCD: 'mcdonald-s', NKE: 'nike', SBUX: 'starbucks', LOW: 'lowes', BABA: 'alibaba', EBAY: 'ebay',
  DE: 'john-deere', UPS: 'ups', T: 'atandt', VZ: 'verizon', SPOT: 'spotify', TMUS: 'deutsche-telekom', CHTR: 'spectrum',
  COST: 'costco', PG: 'procter-and-gamble', KO: 'coca-cola', PEP: 'pepsico', MDLZ: 'mondelez-international', CL: 'colgate', MNST: 'monster',
  NEE: 'nextera-energy', EQIX: 'equinix-badge', NEM: 'newmont',
  // household names the search box can land on
  MSTR: 'microstrategy', SMCI: 'supermicro', HOOD: 'robinhood', SHOP: 'shopify', PYPL: 'paypal', ADBE: 'adobe', QCOM: 'qualcomm',
  CSCO: 'cisco', IBM: 'ibm', SNOW: 'snowflake', ABNB: 'airbnb', RIVN: 'rivian', LCID: 'lucid', F: 'ford', GM: 'general-motors',
  SOFI: 'sofi-badge', RBLX: 'roblox', ARM: 'arm', DELL: 'dell', PANW: 'palo-alto-networks', MA: 'mastercard',
  AXP: 'american-express', WFC: 'wells-fargo', C: 'citibank', TGT: 'target', FDX: 'fedex', DAL: 'delta', PINS: 'pinterest',
  SNAP: 'snapchat', ZM: 'zoom', ROKU: 'roku',
};

/** A wordmark cropped to its symbol: the new viewBox, measured off the drawn file. The drawing is not edited. */
const CROP = {
  DAL: '-0.2 9.35 5.4 5.4',
  PEP: '5.9 8.2 104 104',
  CL: '0 -7.5 48 48',
  RIVN: '-1 -1.5 43 43',
  CVS: '-0.5 -2.8 28.2 28.2',
};

/** Cisco's file is its white-on-dark cut; the brand's own blue sits on both grounds */
const RECOLOUR = { CSCO: [[/fill="(?:#fff|#ffffff|white)"/gi, 'fill="#1BA0D7"']] };

const clean = (ticker, svg) => {
  let s = svg.replace(/<\?xml[^>]*\?>\s*/i, '').replace(/<!DOCTYPE[^>]*>\s*/i, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  if (/<script|<foreignObject|\son[a-z]+=|href="(?!#)/i.test(s)) throw new Error(`${ticker}: the file carries something a logo has no use for`);
  /* a root with a width and a height but no viewBox cannot be scaled by a mask — give it the box it implies */
  const root = s.match(/<svg[^>]*>/i)?.[0] ?? '';
  if (!/viewBox=/i.test(root)) {
    const w = parseFloat(root.match(/\swidth="([\d.]+)/i)?.[1] ?? '');
    const h = parseFloat(root.match(/\sheight="([\d.]+)/i)?.[1] ?? '');
    if (!w || !h) throw new Error(`${ticker}: no viewBox and no size to make one from`);
    s = s.replace(root, root.replace(/<svg/i, `<svg viewBox="0 0 ${w} ${h}"`));
  }
  if (CROP[ticker]) s = s.replace(/viewBox="[^"]*"/i, `viewBox="${CROP[ticker]}"`);
  for (const [re, to] of RECOLOUR[ticker] ?? []) s = s.replace(re, to);
  /* the box decides the size, never the file */
  s = s.replace(/<svg([^>]*)>/i, (_, attrs) => `<svg${attrs.replace(/\s(?:width|height|x|y)="[^"]*"/gi, '')}>`);
  return s + '\n';
};

const registry = await (await fetch(`${BASE}/api/registry.json`)).json();
const bySlug = new Map(registry.icons.map(i => [i.slug, i]));

mkdirSync(OUT, { recursive: true });
const rows = [];
let bytes = 0;
for (const [ticker, slug] of Object.entries(SLUGS)) {
  const entry = bySlug.get(slug);
  if (!entry) throw new Error(`${ticker}: the library has no "${slug}" any more`);
  const res = await fetch(`${BASE}/icons/${slug}/default.svg`);
  if (!res.ok) throw new Error(`${ticker}: ${res.status} for ${slug}`);
  const svg = clean(ticker, await res.text());
  writeFileSync(join(OUT, `${ticker}.svg`), svg);
  bytes += svg.length;
  rows.push(`| ${ticker} | ${entry.title} | [${slug}](${BASE}/icons/${slug}/default.svg) | ${entry.license ?? 'not stated'} | ${CROP[ticker] ? 'cropped to its symbol' : RECOLOUR[ticker] ? 'recoloured to the brand blue' : ''} |`);
}

writeFileSync(
  NOTE,
  `# Where the ticker logos came from

Written by \`npm run logos:fetch\` (scripts/fetch-logos.mjs) — do not edit by hand; change the script's list and run it again.

Source: [thesvg.org](${BASE}) (the library's code is MIT; each logo carries its own licence, below). Logos are trademarks of
their owners and are used only to name the company whose ticker is on screen. "Fair Use" and "Unknown" are the library's
own labels: the file is the company's artwork rather than a redrawn public-domain glyph — the ones to look at again when
the Terms page is written.

Not from here: the first 17 (the simple-icons set, CC0) and MSFT · ORCL · COIN, drawn by hand.

| Ticker | Company | File | Licence | Changed |
| --- | --- | --- | --- | --- |
${rows.join('\n')}
`,
);
console.log(`${rows.length} logos · ${(bytes / 1024).toFixed(0)} KB → public/logos/ · the note → docs/logo-sources.md`);
