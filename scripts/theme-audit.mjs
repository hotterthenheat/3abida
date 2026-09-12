/*
  THE THEME AUDIT (2026-09-12) — the guard that keeps every colour a token.

  Fails when a source file writes a colour the theme cannot flip:
    · a `bg-white/`, `border-white/`, `from-white/`, `to-white/` wash
      (the ink is `bg-ink/…` — white on dark, near-black on light)
    · a surface or ink hex as an arbitrary Tailwind value
      (`bg-[#0a0a0a]`, `text-[#ededed]`, `border-[#1c1c1c]` … — the tokens are
      bg-panel, text-textPrimary, border-borderSubtle …)
    · `rgba(255,255,255,…)` on a JSX className or style line
      (`rgb(var(--ink) / …)`)

  Lists, without failing, every remaining colour literal per file — the
  worklist for the light walk: chart and canvas code reads its inks through
  theme/theme.ts readToken(), guide figures and SVGs page by page.

    node scripts/theme-audit.mjs          the guard + the worklist summary
    node scripts/theme-audit.mjs --list   every remaining literal, by file
*/

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const LIST = process.argv.includes('--list');

/* Colour literals that are allowed to stay literal: the candle themes, the
   chart palette and the categorical inks are identity, not surface. */
/* heatmap.ts is colour MATH shared with the canvases (inks chosen by a fill's
   own luminance — theme-independent by design); ContractFlowChart's inks feed
   lightweight-charts on a canvas inside a dark island. */
const ALLOW_FILES = [/candleTheme\.ts$/, /palette\.ts$/, /heatmap\.ts$/, /ContractFlowChart\.tsx$/, /nav\.ts$/, /theme\/tokens\.css$/];

const FORBIDDEN = [
  { re: /\b(?:hover:|group-hover:|focus:|data-\[[^\]]+\]:)*(?:bg|border|from|to|via)-white\//g, why: 'a white wash — use the ink token (bg-ink/…)' },
  /* A surface hex as a ground or a hairline; the ink hexes as text. `text-[#0a0a0a]`
     is NOT here: it is the dark word on a lime or silver pill, the same in both
     themes — a pill's fill is an accent, not a surface. */
  { re: /\b(?:bg|border)-\[#(?:0a0a0a|050505|070707|101010|0c0c0c|121212|1c1c1c|2a2a2a|ededed|a3a3a3|7d7d7d)\]/g, why: 'a surface hex — use its token (bg-panel, bg-chip, border-borderSubtle …)' },
  { re: /\btext-\[#(?:ededed|a3a3a3|7d7d7d)\]/g, why: 'an ink hex — use text-textPrimary / textSecondary / textMuted' },
  { re: /\b(?:text|bg|border|ring)-\[#C7D3E8\]/g, why: 'the silver where-you-are — use the silver token (text-silver, bg-silver/[…], border-silver …)' },
];
const JSX_RGBA_WHITE = /rgba\(255, ?255, ?255, ?[0-9.]+\)/g;
const ANY_LITERAL = /#[0-9a-fA-F]{6}\b|rgba?\((?:\d+, ?){2}\d+(?:, ?[0-9.]+)?\)/g;

const files = [];
const walk = dir => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(name)) files.push(p);
  }
};
walk(ROOT);

let failures = 0;
const worklist = [];
for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const allowed = ALLOW_FILES.some(re => re.test(rel));
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (allowed) return;
    for (const { re, why } of FORBIDDEN) {
      re.lastIndex = 0;
      const m = re.exec(line);
      if (m) {
        failures++;
        console.log(`FAIL ${rel}:${i + 1}  ${m[0]}  — ${why}`);
      }
    }
    if (/className=|style=/.test(line)) {
      JSX_RGBA_WHITE.lastIndex = 0;
      const m = JSX_RGBA_WHITE.exec(line);
      if (m) {
        failures++;
        console.log(`FAIL ${rel}:${i + 1}  ${m[0]}  — a white wash in JSX — use rgb(var(--ink) / …)`);
      }
    }
  });
  if (!allowed) {
    const n = (src.match(ANY_LITERAL) ?? []).length;
    if (n) worklist.push({ rel, n });
  }
}

worklist.sort((a, b) => b.n - a.n);
const total = worklist.reduce((s, w) => s + w.n, 0);
console.log(`\n${failures === 0 ? 'OK' : 'FAILED'}: ${failures} forbidden literal${failures === 1 ? '' : 's'} · ${total} colour literal${total === 1 ? '' : 's'} still to walk across ${worklist.length} files`);
if (LIST) for (const w of worklist) console.log(`  ${String(w.n).padStart(4)}  ${w.rel}`);
else for (const w of worklist.slice(0, 12)) console.log(`  ${String(w.n).padStart(4)}  ${w.rel}`);
process.exit(failures === 0 ? 0 : 1);
