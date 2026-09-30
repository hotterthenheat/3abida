/*
==================================================
  SLAYER TERMINAL - "DID YOU MEAN"
  (pages/notFound/suggest.ts)

  A wrong address is nearly always one of three things,
  and each has its own answer:

    A SLIP OF THE HAND   /pinpont/map · /trace/darkpool
        → the nearest real address, by edit distance —
          on the whole address, and on its last part
          against every page's own last part and name
    A PAGE BY ITS NAME   /ahead · /insiders · /billing
        → the page that carries that name, wherever it
          lives (/pinpoint/ahead, /record/insiders…)
    A GUESS FROM OUTSIDE /pricing · /login · /charts
        → the words people type by hand, mapped by hand
          (ALIASES). /login is the honest one: there is
          no sign-in yet, and it says so.

  Everything it can suggest is READ FROM THE NAV'S OWN
  LISTS (nav.ts, the three subnavs, the settings'
  sections), so a page added to the terminal can be
  suggested the day it ships. It never suggests an
  address it has not been given, and it says nothing
  rather than guess wildly (a score bar, tighter for
  short words).
==================================================
*/

import { NAV_ITEMS } from '../../components/layout/nav';
import { GEX_SUBPAGES } from '../pinpoint/subnav';
import { TRACE_SUBPAGES } from '../trace/subnav';
import { RECORD_SUBPAGES } from '../record/subnav';

export interface Suggestion {
  path: string;
  label: string;
  /** The product it sits under — "Pinpoint", "Settings", "Front page" */
  where?: string;
  /** Said with it when the address asked for something that does not exist yet */
  note?: string;
}

const SETTINGS: [string, string][] = [
  ['account', 'Account'],
  ['billing', 'Billing'],
  ['data', 'Data'],
  ['appearance', 'Appearance'],
  ['desk', 'The desk'],
  ['keyboard', 'Keyboard'],
  ['about', 'About'],
];

/** Every address the terminal can point at */
export const KNOWN: Suggestion[] = [
  { path: '/', label: 'Front page' },
  ...NAV_ITEMS.map(i => ({ path: i.path, label: i.label })),
  { path: '/pulse/board', label: 'Four charts', where: 'Pulse' },
  { path: '/compass/tracker', label: 'Tracker', where: 'Compass' },
  ...GEX_SUBPAGES.map(p => ({ path: p.path, label: p.label, where: 'Pinpoint' })),
  ...TRACE_SUBPAGES.map(p => ({ path: p.path, label: p.label, where: 'Trace' })),
  ...RECORD_SUBPAGES.map(p => ({ path: p.path, label: p.label, where: 'Dossier' })),
  ...SETTINGS.map(([id, label]) => ({ path: `/settings/${id}`, label, where: 'Settings' })),
  { path: '/#tools', label: 'The tools', where: 'Front page' },
  { path: '/#pricing', label: 'Pricing', where: 'Front page' },
  { path: '/#faq', label: 'Questions', where: 'Front page' },
];
const byPath = (path: string): Suggestion => KNOWN.find(k => k.path === path) ?? { path, label: path };

const NO_SIGN_IN = 'There is no sign-up yet. The terminal opens without one.';
/** The words people type by hand → where they meant. Keys are already squashed (see `squash`). */
const ALIASES: Record<string, { path: string; note?: string }> = {
  pricing: { path: '/#pricing' }, prices: { path: '/#pricing' }, price: { path: '/#pricing' }, plans: { path: '/#pricing' }, plan: { path: '/#pricing' }, subscribe: { path: '/#pricing' }, buy: { path: '/#pricing' }, upgrade: { path: '/#pricing' },
  faq: { path: '/#faq' }, faqs: { path: '/#faq' }, questions: { path: '/#faq' }, help: { path: '/#faq' }, support: { path: '/#faq' },
  tools: { path: '/#tools' }, features: { path: '/#tools' }, products: { path: '/#tools' }, tour: { path: '/#tools' },
  login: { path: '/pulse', note: NO_SIGN_IN }, signin: { path: '/pulse', note: NO_SIGN_IN }, signup: { path: '/pulse', note: NO_SIGN_IN }, register: { path: '/pulse', note: NO_SIGN_IN }, join: { path: '/pulse', note: NO_SIGN_IN }, auth: { path: '/pulse', note: NO_SIGN_IN },
  app: { path: '/pulse' }, terminal: { path: '/pulse' }, dashboard: { path: '/pulse' }, launch: { path: '/pulse' }, desk: { path: '/pulse' }, start: { path: '/pulse' },
  chart: { path: '/terrain' }, charts: { path: '/terrain' }, charting: { path: '/terrain' },
  flow: { path: '/trace/live-tape' }, tape: { path: '/trace/live-tape' }, optionsflow: { path: '/trace/live-tape' },
  darkpool: { path: '/trace/dark-pool' }, darkpools: { path: '/trace/dark-pool' },
  gex: { path: '/pinpoint/map' }, gamma: { path: '/pinpoint/map' }, levels: { path: '/pinpoint/map' }, heatmap: { path: '/pinpoint/map' }, ladder: { path: '/pinpoint/map' },
  shortcuts: { path: '/settings/keyboard' }, keys: { path: '/settings/keyboard' }, hotkeys: { path: '/settings/keyboard' },
  theme: { path: '/settings/appearance' }, themes: { path: '/settings/appearance' }, profile: { path: '/settings/account' }, invoices: { path: '/settings/billing' },
  discord: { path: '/community' }, room: { path: '/community' }, chat: { path: '/community' },
  scanner: { path: '/trace/screener' }, weigh: { path: '/weigher' }, chain: { path: '/weigher' }, contracts: { path: '/compass' }, setups: { path: '/compass' },
};

/** Lower case, letters and digits only — "Dark-Pool", "dark_pool" and "darkpool" are one word */
const squash = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const lev = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
};
/** Edit distance as a share of the longer word; short words are held to a single slip */
const near = (a: string, b: string): number => {
  if (!a || !b) return 1;
  const d = lev(a, b);
  const len = Math.max(a.length, b.length);
  if (len <= 4 && d > 1) return 1;
  return d / len;
};

const BAR = 0.34;

/** Up to three places this address most likely meant, best first. Empty when nothing is close. */
export function suggest(pathname: string): Suggestion[] {
  let typed = pathname;
  try {
    typed = decodeURIComponent(pathname);
  } catch {
    /* a broken escape is matched as typed */
  }
  typed = typed.toLowerCase().replace(/\/+$/, '');
  const segs = typed.split('/').filter(Boolean);
  if (!segs.length) return [];
  const last = squash(segs[segs.length - 1]);
  const first = segs[0];
  const whole = squash(typed);

  const scored: { s: Suggestion; score: number }[] = [];
  /* the words people type by hand — the last part first, then any part */
  for (const seg of [...segs].reverse()) {
    const hit = ALIASES[squash(seg)];
    if (hit) {
      scored.push({ s: { ...byPath(hit.path), note: hit.note }, score: 0 });
      break;
    }
  }
  /* …and a slip in one of those words: /prcing meant pricing (measured: it found nothing). Longer words only — a short
     word one letter off is as likely another word. */
  if (!scored.length)
    for (const [word, hit] of Object.entries(ALIASES)) {
      if (word.length < 5) continue;
      const d = near(last, word);
      if (d <= 0.25) scored.push({ s: { ...byPath(hit.path), note: hit.note }, score: d + 0.05 });
    }
  for (const k of KNOWN) {
    if (k.path === '/' || k.path.startsWith('/#')) continue;
    const ks = k.path.split('/').filter(Boolean);
    const sameProduct = ks[0] === first || near(squash(ks[0]), squash(first)) <= BAR;
    /* a slip anywhere in the address */
    const byWhole = near(whole, squash(k.path));
    /* the last part against the page's own last part and its name; a page under another product costs a little */
    const byLast = Math.min(near(last, squash(ks[ks.length - 1])), near(last, squash(k.label))) + (sameProduct || segs.length === 1 ? 0 : 0.12);
    /* a deeper address whose product is right and whose page is not: /pinpoint/zzz is not "Pinpoint" */
    const score = Math.min(byWhole, byLast);
    if (score <= BAR) scored.push({ s: k, score: score + (ks.length > segs.length ? 0.02 : 0) });
  }
  /* nothing near the last part: an EARLIER part may be a page's exact name — /tracker/old meant the Tracker */
  if (!scored.length)
    for (const seg of segs.slice(0, -1).reverse()) {
      const word = squash(seg);
      const k = KNOWN.find(c => !c.path.startsWith('/#') && c.path !== '/' && (squash(c.label) === word || squash(c.path.split('/').pop() ?? '') === word));
      if (k) {
        scored.push({ s: k, score: 0.1 });
        break;
      }
    }
  scored.sort((a, b) => a.score - b.score);
  const out: Suggestion[] = [];
  /* ONE ANSWER, unless others are as good: a runner-up is only said when it is about as near as the best
     (/compare is two pages' name) — a list of loose guesses reads as the page not knowing */
  const best = scored[0]?.score ?? 0;
  for (const { s, score } of scored) {
    if (score > best + 0.08) break;
    if (out.some(o => o.path === s.path)) continue;
    out.push(s);
    if (out.length === 3) break;
  }
  return out;
}

/** The product an address sits under, when its first part is one — the inside-the-terminal page names it */
export function productOf(pathname: string): { path: string; label: string } | null {
  const first = `/${pathname.split('/').filter(Boolean)[0] ?? ''}`.toLowerCase();
  const item = NAV_ITEMS.find(i => i.path === first);
  return item ? { path: item.path, label: item.label } : null;
}
