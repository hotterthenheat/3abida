// The owner's tile logos → the marks alone, no square (the house rule: no box round any logo), each in two readings:
//   <SYM>.svg       for a light ground — what was white on a coloured square takes the square's colour, a white label
//                   holding the square's colour turns inside out, a colour too faint on paper takes the square's colour
//   <SYM>-dark.svg  for a dark ground, written only where it differs — a mark that was white on a dark square stays white
//                   (as drawn), a colour that sinks on black turns to the page's ink, and white sitting on such a part
//                   turns to the ground
// Each is cropped to its mark. Runs in a browser (playwright) for the geometry.
//   node scripts/logo-sheet/bare.mjs <tiles-dir> public/logos src/data/logoDark.json
// The last file lists the names with a dark reading — CompanyLogo lays both readings in the box and --logo-flip shows one.
import { chromium } from 'playwright';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const [src, dst, darkList] = process.argv.slice(2);
mkdirSync(dst, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}));
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
await page.setContent('<html><body style="margin:0"><div id="h"></div></body></html>');
const dual = [];
const notes = {};
for (const f of readdirSync(src).filter(n => n.endsWith('.svg')).sort()) {
  const sym = f.slice(0, -4);
  const out = await page.evaluate(text => {
    const DARK = '#050505', LIGHT = '#f1f0ec', INK = '#ededed';
    const host = document.getElementById('h');
    host.innerHTML = text;
    const svg = host.querySelector('svg');
    svg.setAttribute('width', '600');
    svg.setAttribute('height', '600');
    const hex = c => {
      if (!c || c === 'none') return null;
      const x = document.createElement('div');
      x.style.color = c;
      document.body.appendChild(x);
      const m = getComputedStyle(x).color.match(/\d+/g).map(Number);
      x.remove();
      return '#' + m.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('');
    };
    const lum = h => {
      const v = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    };
    const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const paths = [...svg.querySelectorAll('path')];
    const tile = paths[0];
    const marks = paths.slice(1);
    const T = hex(tile.getAttribute('fill'));
    const whiteTile = T === '#ffffff';
    const tileDark = contrast(T, DARK) < 2.4;
    const orig = marks.map(p => ({ fill: hex(p.getAttribute('fill') ?? '#000000'), stroke: hex(p.getAttribute('stroke')) }));
    const box = marks.map(p => p.getBoundingClientRect());
    const inside = (a, b) => a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5;
    const overlaps = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    /* the light reading */
    const light = orig.map(o => ({ ...o }));
    const labels = new Set();
    if (!whiteTile) {
      orig.forEach((o, i) => {
        if (o.fill === '#ffffff' && !o.stroke && orig.some((q, j) => j > i && q.fill === T && inside(box[j], box[i]))) labels.add(i);
      });
      orig.forEach((o, i) => {
        if (labels.has(i)) light[i].fill = T;
        else if ([...labels].some(l => l < i && inside(box[i], box[l])) && o.fill === T) light[i].fill = '#ffffff';
        else {
          if (o.fill === '#ffffff') light[i].fill = T;
          if (o.stroke === '#ffffff') light[i].stroke = T;
          /* lettering is thin: it takes the square's colour below 1.8:1 on paper (CSX's yellow); a shape reads to 1.3 (PG&E's
             and Valero's yellow triangles keep their yellow) */
          const faint = marks[i].hasAttribute('data-glyph') ? 1.8 : 1.3;
          if (o.fill && o.fill !== '#ffffff' && contrast(o.fill, LIGHT) < faint) light[i].fill = T;
          if (o.stroke && o.stroke !== '#ffffff' && contrast(o.stroke, LIGHT) < faint) light[i].stroke = T;
        }
      });
    }
    /* the dark reading */
    let dark;
    const sinks = c => c && c !== '#ffffff' && contrast(c, DARK) < 2.4;
    if (!whiteTile && tileDark) {
      dark = orig.map(o => ({ fill: sinks(o.fill) ? INK : o.fill, stroke: sinks(o.stroke) ? INK : o.stroke }));
    } else {
      dark = light.map(o => ({ fill: sinks(o.fill) ? INK : o.fill, stroke: sinks(o.stroke) ? INK : o.stroke }));
    }
    const flipped = dark.map((o, i) => (o.fill === INK && light[i].fill !== INK) || (o.stroke === INK && light[i].stroke !== INK));
    dark.forEach((o, i) => {
      if (o.fill === '#ffffff' && flipped.some((fl, j) => fl && j < i && overlaps(box[i], box[j]))) o.fill = DARK;
    });
    /* the crop: every mark's box, in the drawing's own units, a breath round it */
    const vb = svg.viewBox.baseVal;
    const r = svg.getBoundingClientRect();
    const k = vb.width / r.width;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, sw = 0;
    marks.forEach((p, i) => {
      const b = box[i];
      if (!b.width && !b.height) return;
      x0 = Math.min(x0, vb.x + (b.left - r.left) * k);
      y0 = Math.min(y0, vb.y + (b.top - r.top) * k);
      x1 = Math.max(x1, vb.x + (b.right - r.left) * k);
      y1 = Math.max(y1, vb.y + (b.bottom - r.top) * k);
      if (p.getAttribute('stroke') && p.getAttribute('stroke') !== 'none') sw = Math.max(sw, parseFloat(p.getAttribute('stroke-width') || '1'));
    });
    const pad = sw / 2 + Math.max(x1 - x0, y1 - y0) * 0.03;
    const view = [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad].map(v => +v.toFixed(3)).join(' ');
    const write = reading => {
      const c = svg.cloneNode(true);
      c.removeAttribute('width');
      c.removeAttribute('height');
      c.setAttribute('viewBox', view);
      const cp = [...c.querySelectorAll('path')];
      cp[0].remove();
      cp.slice(1).forEach((p, i) => {
        const o = reading[i];
        if (p.getAttribute('fill') !== 'none') p.setAttribute('fill', o.fill ?? '#000000');
        if (o.stroke) p.setAttribute('stroke', o.stroke);
        p.removeAttribute('data-glyph');
      });
      return c.outerHTML;
    };
    const L = write(light), D = write(dark);
    return { L, D, differs: L !== D, T, whiteTile, tileDark, labels: labels.size };
  }, readFileSync(`${src}/${f}`, 'utf8'));
  writeFileSync(`${dst}/${sym}.svg`, out.L + '\n');
  if (out.differs) {
    writeFileSync(`${dst}/${sym}-dark.svg`, out.D + '\n');
    dual.push(sym);
  }
  notes[sym] = { tile: out.T, whiteTile: out.whiteTile, tileDark: out.tileDark, labels: out.labels, dark: out.differs };
}
writeFileSync(darkList, JSON.stringify(dual) + '\n');
console.log(`${Object.keys(notes).length} marks · ${dual.length} with a dark reading: ${dual.join(' ')}`);
await browser.close();
