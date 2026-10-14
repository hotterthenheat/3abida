/*
  Acceptance test for the expiry windows (the owner's item 6, 2026-10-14: "pills for 0DTE / To Friday / To monthly
  OPEX / All 60 days … Acceptance: (i) partition: the sum over disjoint windows equals All per strike per minute within
  float tolerance; (ii) switching windows makes zero network requests; (iii) the equality test passes per window"):
  - the window ends: a session's Friday and the monthly OPEX (the third Friday on or after it)
  - (i) each column's four disjoint partitions sum to the whole, gamma and delta, per strike per minute
  - (iii) a window's view of a column equals the column modeled on the window's contracts alone — an independent run
  - a past minute is never moved by a window (the views are of the same columns), and the window's regime reference
    stands on its own nets
  - UW's 60-day book seen through a window sums its partitions
  (ii) is a browser check: a switch reads columns the page holds (docs/data-feed.md "The expiry windows").
*/
import { book60Window, buildRegimeReference, modelColumn, partOf, PARTS, PART_STRIDE, universeOf, windowEnds, windowNet, windowView, WINDOWS, type ExpiryWindow, type FeedBook60, type ServerInputs, type SeedRow } from '../src/data/feed/trailModel';
import { nyMinuteOf } from '../src/data/feed/trackRecord';
import { nyWallTime } from '../src/core/nyTime';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (ok) pass++;
  else fail++;
};

/* the window ends */
{
  const e = (d: string) => windowEnds(d);
  check('Monday Oct 12 2026: to Friday Oct 16, the monthly OPEX Oct 16 (October\'s third Friday)', e('2026-10-12').fri === '2026-10-16' && e('2026-10-12').opex === '2026-10-16');
  check('on the Friday itself the window ends that day', e('2026-10-16').fri === '2026-10-16' && e('2026-10-16').opex === '2026-10-16');
  check('past the third Friday the OPEX is the next month\'s (Oct 19: Friday Oct 23, OPEX Nov 20)', e('2026-10-19').fri === '2026-10-23' && e('2026-10-19').opex === '2026-11-20');
  check('across the year (Dec 21 2026: OPEX Jan 15 2027)', e('2026-12-21').opex === '2027-01-15');
  check('the partitions: the day 0, to Friday 1, to OPEX 2, after 3', partOf('2026-10-19', '2026-10-19') === 0 && partOf('2026-10-21', '2026-10-19') === 1 && partOf('2026-10-23', '2026-10-19') === 1 && partOf('2026-11-06', '2026-10-19') === 2 && partOf('2026-11-20', '2026-10-19') === 2 && partOf('2026-11-27', '2026-10-19') === 3);
}

/* a day with an expiry in every partition: Monday Oct 19 2026 — the 19th, the 21st and 23rd, Nov 6 and Nov 20, Dec 18 */
const day = '2026-10-19';
const at = (h: number, m: number) => nyWallTime(2026, 10, 19, h, m);
const EXPS = ['261019', '261021', '261023', '261106', '261120', '261218'];
const STRIKES = [595, 596, 597, 598, 599, 600, 601, 602, 603, 604, 605];
const occ = (exp: string, r: 'C' | 'P', k: number) => `SPY${exp}${r}${String(k * 1000).padStart(8, '0')}`;
const syms = EXPS.flatMap(e => STRIKES.flatMap(k => (['C', 'P'] as const).map(r => occ(e, r, k))));
const oiOf = (s: string) => 500 + (s.charCodeAt(s.length - 3) * 37 + s.charCodeAt(9) * 11) % 2000;
const ivOf = (s: string, base: number) => base + ((s.charCodeAt(s.length - 4) + s.charCodeAt(8)) % 9) / 100;
const read = (h: number, m: number, base: number, keep = (_s: string) => true) => ({
  receivedAt: at(h, m),
  rows: syms.filter(keep).map(s => [s, oiOf(s), ivOf(s, base), at(h, m) - 60_000] as [string, number, number | null, number | null]),
});
const seed = (keep = (_s: string) => true) => ({ date: '2026-10-16', receivedAt: at(8, 0), rows: syms.filter(keep).map(s => [s, ivOf(s, 0.15), at(8, 0), oiOf(s)] as SeedRow) });
const inputs = (keep = (_s: string) => true): ServerInputs => ({ chains: [read(10, 0, 0.12, keep), read(12, 0, 0.14, keep)], seed: seed(keep), total: null });
const u = universeOf('SPY', day, inputs());
const minutes = [at(9, 45), at(10, 30), at(12, 15), at(15, 50)].map((ms, i) => ({ time: ms / 1000, close: 599.4 + i * 0.6 }));
const cols = minutes.map(b => modelColumn(u, b));

/* (i) the partition */
{
  let worst = 0;
  let worstD = 0;
  let levels = 0;
  for (const c of cols) {
    const p = c.parts!;
    c.levels.forEach((l, i) => {
      let v = 0;
      let d = 0;
      for (let q = 0; q < PARTS; q++) {
        v += p[i * PART_STRIDE + q];
        d += p[i * PART_STRIDE + PARTS + q];
      }
      worst = Math.max(worst, Math.abs(v - l.value) / Math.max(1, Math.abs(l.value)));
      worstD = Math.max(worstD, Math.abs(d - (l.dex ?? 0)) / Math.max(1, Math.abs(l.dex ?? 0)));
      levels++;
    });
  }
  check(`(i) the four disjoint windows sum to All, per strike per minute: ${levels} cells, worst relative gap ${worst.toExponential(1)} (gamma), ${worstD.toExponential(1)} (delta) — the parts are kept as 32-bit floats`, levels > 30 && worst < 1e-6 && worstD < 1e-6);
  check('every partition holds contracts on this day (the test reaches all four)', [0, 1, 2, 3].every(q => cols.some(c => c.levels.some((_, i) => Math.abs(c.parts![i * PART_STRIDE + q]) > 0))));
  check("All is the column itself, not a view", cols.every(c => windowView(c, 'all') === c));
}

/* (iii) each window's view equals the column modeled on the window's contracts alone */
{
  const ends = windowEnds(day);
  const top: Record<ExpiryWindow, number> = { '0dte': 0, fri: 1, opex: 2, all: 3 };
  for (const w of WINDOWS.filter(x => x !== 'all')) {
    const keep = (s: string) => {
      const exp = `20${s.slice(3, 5)}-${s.slice(5, 7)}-${s.slice(7, 9)}`;
      return partOf(exp, day, ends) <= top[w];
    };
    const uw = universeOf('SPY', day, inputs(keep));
    let worst = 0;
    let cells = 0;
    let same = true;
    minutes.forEach((b, i) => {
      const view = windowView(cols[i], w);
      const alone = modelColumn(uw, b);
      const a = new Map(alone.levels.map(l => [l.strike, l]));
      if (view.levels.length !== alone.levels.length) same = false;
      for (const l of view.levels) {
        const o = a.get(l.strike);
        if (!o) {
          same = false;
          continue;
        }
        cells++;
        worst = Math.max(worst, Math.abs(l.value - o.value) / Math.max(1, Math.abs(o.value)), Math.abs((l.dex ?? 0) - (o.dex ?? 0)) / Math.max(1, Math.abs(o.dex ?? 0)), Math.abs((l.coverage ?? 0) - (o.coverage ?? 0)), Math.abs((l.staleShare ?? 0) - (o.staleShare ?? 0)));
        if (l.prov !== o.prov) same = false;
      }
    });
    check(`(iii) ${w}: the view equals the window's contracts modeled alone — ${cells} cells, the same strikes, worst gap ${worst.toExponential(1)}, the same provenance`, same && cells > 20 && worst < 1e-5);
  }
}

/* the windows nest, and a view is cached */
{
  const c = cols[2];
  const nets = WINDOWS.map(w => windowView(c, w).levels.reduce((s, l) => s + Math.abs(l.value), 0));
  check(`a view is the same object on a second ask (no work on a switch back): ${windowView(c, 'fri') === windowView(c, 'fri')}`, windowView(c, 'fri') === windowView(c, 'fri'));
  check(`the windows hold more as they widen (total |gamma| ${nets.map(n => (n / 1e6).toFixed(1)).join(' < ')} M)`, nets[0] < nets[1] && nets[1] < nets[2] && nets[2] < nets[3]);
}

/* UW's 60-day book through a window, and the regime's reference per window */
{
  const b: FeedBook60 = {
    at: at(12, 0),
    spot: 600,
    expiries: ['2026-10-19', '2026-10-21', '2026-11-06', '2026-12-18'],
    rows: [{ strike: 600, net: -10, call: -4, put: -6 }],
    parts: [{ strike: 600, call: [-1, -1, -1, -1], put: [-3, -1, -1, -1] }],
  };
  const fri = book60Window(b, 'fri')!;
  check("UW's 60-day book through To Friday: the partitions to Friday summed, the expiries in it named", fri.rows[0].net === -6 && fri.rows[0].call === -2 && fri.rows[0].put === -4 && fri.expiries.join() === '2026-10-19,2026-10-21' && book60Window(b, 'all') === b && book60Window({ ...b, parts: undefined }, 'fri') === null);
  const rows = (d: string, sign: number) => Array.from({ length: 13 }, (_, i) => ({ m: nyWallTime(...(d.split('-').map(Number) as [number, number, number]), 9, 45 + i * 30), net: sign * 10, netP: [sign * 1, sign * 2, sign * 3, sign * 4] }));
  const ref = buildRegimeReference('SPY', [{ day: '2026-10-15', rows: rows('2026-10-15', 1) }, { day: '2026-10-16', rows: rows('2026-10-16', -1) }], 250, nyMinuteOf);
  const span = (q?: number[] | null) => (q ? `${q[0]} to ${q[q.length - 1]}` : '—');
  check(`the regime keeps a reference per window off the rows' partitions (0DTE's first half-hour ${span(ref.windows?.['0dte']?.buckets[0])}, To Friday's ${span(ref.windows?.fri?.buckets[0])}, All's ${span(ref.buckets[0])})`, !!ref.windows?.['0dte'] && !!ref.windows.fri && !!ref.windows.opex && windowNet({ net: 10, netP: [1, 2, 3, 4] }, 'opex') === 6 && windowNet({ net: 10 }, 'fri') === null);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
