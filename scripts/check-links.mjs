/*
  EVERY LINK ON THE SITE, WALKED (2026-09-19) — `npm run links:check`, with the dev server up.

  The app is a single page, so a wrong address does not 404 at the server: the router simply matches nothing and draws
  NOTHING. A broken link here is a blank screen, which no build step catches. This walks the site the way a reader does:

    1. every page the nav knows (the rail, each section's pages, the settings' pages) plus a name's own pages
    2. on each: every <a href> — inside the site, to another site, to a #section, to a mailbox
    3. every address written in the source (`to=`, `navigate(`, `launch(`, `path:`), so a door behind a click counts too
    4. each inside address is OPENED and must draw a page; each #section must exist on the page it points at;
       each outside address must answer

  It prints what is broken and exits 1 if anything is. A page that is a redirect is fine and is shown as one.
*/
import { chromium } from 'playwright';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:5199';
const SRC = resolve(process.cwd(), 'src');

// ── 3. the addresses written in the source ──
const walk = dir => readdirSync(dir).flatMap(f => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : /\.(tsx?|ts)$/.test(f) ? [join(dir, f)] : []));
const written = new Map();
const RX = /(?:\bto=|\bhref=|navigate\(|launch\(|\bpath:\s*|\bto:\s*)\{?\s*['"`](\/[A-Za-z0-9/_#?=&.-]*)['"`]/g;
for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(RX)) {
    const addr = m[1];
    /* a route PATTERN is the router's own, not a door */
    if (addr.includes(':') || addr.endsWith('/*') || addr.startsWith('/fonts') || addr.startsWith('/src')) continue;
    if (!written.has(addr)) written.set(addr, file.slice(SRC.length + 1).replace(/\\/g, '/'));
  }
}

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  try {
    if (!localStorage.getItem('slayer_theme')) localStorage.setItem('slayer_theme', 'dark');
  } catch {}
});
const page = await ctx.newPage();

/** open an address the way a reader's browser would, and say what stood there */
const open = async addr => {
  await page.goto(BASE + addr, { waitUntil: 'load' });
  await page.waitForTimeout(2600);
  return page.evaluate(() => {
    const root = document.getElementById('root');
    const words = (root?.innerText ?? '').replace(/\s+/g, ' ').trim();
    return { at: location.pathname + location.hash, words: words.length, title: document.title, notFound: !!document.querySelector('[data-not-found]') };
  });
};
const links = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('a[href]')].map(a => ({ href: a.getAttribute('href'), text: (a.textContent || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40) }))
  );

// ── 1. the pages the nav knows ──
const seeds = ['/', '/review', '/pulse', '/pulse/board', '/terrain', '/compass', '/compass/tracker', '/weigher', '/trace', '/pinpoint', '/record', '/community', '/settings'];
for (const a of written.keys()) if (/^\/(pinpoint|trace|record|review|settings|compass)\/[a-z0-9-]+$/.test(a)) seeds.push(a);
seeds.push('/record/stocks/NVDA', '/record/earnings/NVDA');

const inside = new Map(); // address → where it was found
const hashes = []; // { on, href }
const outside = new Map();
const mail = new Map();
const pages = [];
const note = (map, key, where) => {
  if (!map.has(key)) map.set(key, where);
};

for (const seed of [...new Set(seeds)]) {
  const r = await open(seed);
  pages.push({ addr: seed, ...r });
  for (const l of await links()) {
    const h = l.href ?? '';
    const where = `${seed} · "${l.text}"`;
    if (h.startsWith('mailto:')) note(mail, h, where);
    else if (/^https?:\/\//.test(h)) note(outside, h, where);
    else if (h.startsWith('#')) hashes.push({ on: seed, href: h, where });
    else if (h.startsWith('/')) {
      const [path, hash] = h.split('#');
      note(inside, path || '/', where);
      if (hash) hashes.push({ on: path || '/', href: '#' + hash, where });
    }
  }
}
for (const [addr, file] of written) note(inside, addr.split('#')[0] || '/', `source · ${file}`);

// ── 4. open every inside address ──
const broken = [];
const redirects = [];
const seen = new Map(pages.map(p => [p.addr, p]));
for (const [addr, where] of inside) {
  const r = seen.get(addr) ?? (await open(addr));
  seen.set(addr, r);
  const blank = r.words < 40;
  if (blank || r.notFound) broken.push({ addr, where, why: r.notFound ? 'the not-found page' : `a blank screen (${r.words} characters drawn)` });
  else if (r.at.split('#')[0].replace(/\/$/, '') !== addr.split('?')[0].replace(/\/$/, '')) redirects.push(`${addr} → ${r.at}`);
}
for (const h of hashes) {
  await page.goto(BASE + h.on, { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const ok = await page.evaluate(sel => {
    try {
      return !!document.querySelector(sel);
    } catch {
      return false;
    }
  }, h.href);
  if (!ok) broken.push({ addr: `${h.on}${h.href}`, where: h.where, why: 'no such section on that page' });
}
const outsideReport = [];
for (const [url, where] of outside) {
  let status = 'no answer';
  try {
    const res = await ctx.request.get(url, { timeout: 12000, maxRedirects: 5 });
    status = String(res.status());
  } catch (e) {
    status = 'failed: ' + String(e).slice(0, 60);
  }
  outsideReport.push({ url, status, where });
}

console.log(`pages walked: ${pages.length} · inside addresses opened: ${inside.size} · #sections: ${hashes.length} · outside: ${outside.size} · mailboxes: ${mail.size}`);
console.log('titles:', [...new Set([...seen.values()].map(r => r.title))].length, 'distinct of', seen.size, 'addresses');
if (redirects.length) console.log('redirects (fine):\n  ' + redirects.join('\n  '));
console.log('outside:\n  ' + outsideReport.map(o => `${o.status}  ${o.url}  (${o.where})`).join('\n  '));
console.log('mailboxes:\n  ' + [...mail].map(([m, w]) => `${m}  (${w})`).join('\n  '));
if (broken.length) {
  console.log(`\nBROKEN: ${broken.length}`);
  for (const b of broken) console.log(`  ${b.addr}  — ${b.why}\n      found at: ${b.where}`);
} else console.log('\nOK: no broken links');
await browser.close();
process.exit(broken.length ? 1 : 0);
