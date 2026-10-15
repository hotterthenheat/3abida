/*
  Acceptance test for the bead scale, legend and disclosure (the owner's item 5, 2026-10-14):
  (i)   the legend's value equals the reference the renderer used at that minute — the primitive's own hand-off, every
        column against the session's per-minute count (data/feed/beadScale.ts, the store's one code)
  (ii)  THE MARK'S COLOUR (B3, 2026-10-14 — size is geometry now, so no greyscale order to keep): the side's ink mixed
        from the neutral by the colour strength moves away from the grey monotonically (OKLab), on both grounds, both
        sides; and the two sides stay apart from half strength up under the three colour-vision deficiencies
  (iii) the size step a mark draws at in replay equals the live capture's, on the recorder's own sessions (run when
        this machine holds one)
  and the pieces: ten steps a side, the floor, the size by gross and the strength by |net| ÷ gross (B3), the three
  staleness steps, the fixed and prior bases.
  (iv), the frame time at full zoom-out, is measured in the browser (docs/data-feed.md "The bead scale").
*/
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BEAD_STEPS, RunningScale, columnGross, minuteMaxRefs, minuteRefs, pooledRef, stepOf, stepT, strengthOf } from '../src/data/feed/beadScale';
import { DARK_MARK_INKS, GexTrailsPrimitive, STRENGTH_STEPS, markInk, type MarkInks } from '../src/components/gex/gexNodesPrimitive';
import { heatRampColorFor, HEAT_MODE } from '../src/components/gex/heatmap';
import { aggregateSnapshots } from '../src/data/timeframe';
import { rng } from '../src/data/feed/trackRecord';
import type { GexSnapshot } from '../src/types/market';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (ok) pass++;
  else fail++;
};
const nyDay = (sec: number) => new Date(sec * 1000 - 4 * 3600_000).toISOString().slice(0, 10);

/* the steps */
{
  const ks = Array.from({ length: 1001 }, (_, i) => stepOf(i / 1000));
  const mono = ks.every((k, i) => i === 0 || k >= ks[i - 1]);
  check(`ten steps a side: nothing at 0, the first above it, full at 1 (${stepOf(0)}, ${stepOf(1e-6)}, ${stepOf(1)}), never down as strength rises`, stepOf(0) === 0 && stepOf(1e-6) === 1 && stepOf(1) === BEAD_STEPS && BEAD_STEPS === 10 && mono && new Set(ks.filter(k => k > 0)).size === 10);
  check('a step draws at its top, so the top step is full brightness', stepT(BEAD_STEPS) === 1 && stepT(5) === 0.5);
}

/* a synthetic store: three sessions of 390 minutes, 40 strikes, some cells carried or stale */
const draw = rng(5);
const base: GexSnapshot[] = [];
const days = ['2026-10-07', '2026-10-08', '2026-10-09'];
for (const [di, day] of days.entries()) {
  const open = Date.parse(`${day}T13:30:00Z`) / 1000;
  const loud = di === 1 ? 3 : 1;
  for (let m = 0; m < 390; m++) {
    const levels = Array.from({ length: 40 }, (_, k) => {
      const v = (draw() - 0.45) * 1e9 * loud * (k === 20 ? 4 : 1) * (1 + m / 390);
      const u = draw();
      /* the gross (B3): the net plus a balanced part, so |net| ÷ gross runs 0.5 to 1 */
      return { strike: 560 + k, value: v, gross: Math.abs(v) * (1 + draw()), dex: v * 20, prov: u < 0.1 ? ('carried' as const) : ('modeled' as const), staleShare: u < 0.2 ? 0.6 : 0.1 };
    });
    base.push({ time: open + m * 60, spot: 580, levels } as unknown as GexSnapshot);
  }
}
const maxima = base.map(s => Math.max(...s.levels.map(l => Math.abs(l.value))));
const maximaG = base.map(s => columnGross(s.levels));

/* (i) the legend equals the renderer's reference — and the store's count */
{
  const { ref } = minuteRefs(
    base.map(s => s.time),
    maxima,
    nyDay
  );
  const run = new RunningScale();
  let d = '';
  const manual = base.map((s, i) => {
    if (nyDay(s.time) !== d) {
      d = nyDay(s.time);
      run.reset();
    }
    return run.push(maxima[i]);
  });
  check(`the per-minute count is the store's (RunningScale pushed a minute at a time, reset each session): ${base.length} minutes equal`, manual.every((r, i) => r === ref[i]));
  for (const texture of [1, 5]) {
    const prim = new GexTrailsPrimitive();
    const cols = aggregateSnapshots(base, texture);
    prim.setData(cols, 1, true, texture * 60, 'gex', base);
    let worst = 0;
    for (let i = 0; i < cols.length; i++) {
      const end = cols[i].time + texture * 60 - 1;
      let j = -1;
      for (let k = 0; k < base.length && base[k].time <= end; k++) j = k;
      const r = prim.refAt(i).ref;
      worst = Math.max(worst, Math.abs(r - ref[j]) / ref[j]);
      if (prim.columnAt(i).ref !== r) worst = Infinity;
    }
    const l = prim.legend()!;
    check(`${texture}m texture: every column drawn against its last minute's reference (worst gap ${worst}); the legend's ${l.ref.toExponential(4)} is the newest column's`, worst === 0 && l.ref === prim.columnAt(cols.length - 1).ref && l.ref === ref[base.length - 1] && l.basis === 'session');
    /* THE SIZE REFERENCE (B3; the orbs' second round): the session's largest peak gross at or before each minute */
    const refG = minuteMaxRefs(
      base.map(s => s.time),
      maximaG,
      nyDay
    );
    let worstG = 0;
    for (let i = 0; i < cols.length; i++) {
      const end = cols[i].time + texture * 60 - 1;
      let j = -1;
      for (let k = 0; k < base.length && base[k].time <= end; k++) j = k;
      worstG = Math.max(worstG, Math.abs(prim.refAt(i).refG - refG[j]) / refG[j]);
    }
    check(`${texture}m texture: the size reference is the session's largest node so far, the store's own rule (worst gap ${worstG}); the legend's ${l.refG.toExponential(4)} sizes by ${l.sizeBy}`, worstG === 0 && l.refG === refG[base.length - 1] && l.sizeBy === 'gross');
  }
}

/* the bases, the floor, the ring, the staleness */
{
  const prim = new GexTrailsPrimitive();
  prim.setData(base, 1, true, 60, 'gex', base);
  const lastDay = base.length - 1;
  const day2 = maxima.slice(390, 780);
  prim.setBasis('prior', 0);
  const prior = prim.refAt(lastDay);
  const want = pooledRef(day2, 1)!;
  check(`prior: the session before's p85 of per-minute peaks (${prior.ref.toExponential(3)}, ${prior.priorDay})`, prior.basis === 'prior' && prior.ref === want.ref && prior.ring === want.ring && prior.priorDay === days[1]);
  prim.setBasis('fixed', 0);
  const fixed = prim.refAt(lastDay);
  const pooled = pooledRef(maxima.slice(0, 780), 2)!;
  check(`fixed: pooled over the sessions before the day (${fixed.sessions}), the same all day`, fixed.basis === 'fixed' && fixed.ref === pooled.ref && fixed.sessions === 2 && prim.refAt(780).ref === fixed.ref);
  prim.setExternal(new Map([[days[2], { fixed: { ref: 7e9, ring: 9e9, minutes: 23400, sessions: 60 }, prior: null, priorDay: days[1] }]]));
  check("the server's fixed reference wins where it has one (60 sessions)", prim.refAt(lastDay).ref === 7e9 && prim.refAt(lastDay).sessions === 60);
  prim.setExternal(new Map());
  const first = prim.refAt(10);
  check('a basis with no session before it falls back to the session so far, and says so', first.basis === 'session');
  prim.setBasis('session', 0);
  const col = prim.columnAt(lastDay);
  const r = prim.refAt(lastDay);
  const lv = base[lastDay].levels;
  check(`floor off: every strike above zero draws (${col.top.length} of ${lv.filter(l => l.value !== 0).length})`, col.top.length === lv.filter(l => l.value !== 0).length);
  prim.setBasis('session', 0.1);
  const col2 = prim.columnAt(lastDay);
  check(`floor 10%: the strikes under a tenth of the size reference are hidden (${col2.top.length} draw), measured on the gross against the size reference`, col2.top.every(b => lv.find(l => l.strike === b.strike)!.gross >= 0.1 * r.refG) && col2.top.length === lv.filter(l => l.gross >= 0.1 * r.refG).length);
  prim.setBasis('session', 0);
  const beads = [...prim.columnAt(lastDay).all.values()];
  check('staleness, three steps: carried 2, half its gamma on old vols 1, else 0', beads.every(b => {
    const l = lv.find(x => x.strike === b.strike)!;
    return b.stale === (l.prov === 'carried' ? 2 : (l.staleShare ?? 0) >= 0.5 ? 1 : 0);
  }));
  /* THE ENCODING (B3): a mark's size step is √(gross ÷ the size reference) in steps; its colour strength |net| ÷ gross;
     its side the net's sign; the three heaviest BY SIZE are the column's top set (B4's ring and ghost read it) */
  check("a mark's step is its gross against the size reference", beads.every(b => b.step === stepOf(strengthOf(lv.find(l => l.strike === b.strike)!.gross, r.refG))));
  check("a mark's colour strength is |net| ÷ gross, its side the net's sign", beads.every(b => {
    const l = lv.find(x => x.strike === b.strike)!;
    return Math.abs(b.strength - Math.min(1, Math.abs(l.value) / l.gross)) < 1e-12 && b.put === l.value >= 0 && b.gross === l.gross;
  }));
  const bySize = [...lv].sort((a, b) => b.gross - a.gross).slice(0, 3).map(l => l.strike);
  check(`the top set is the three heaviest by size (${bySize.join(', ')})`, bySize.every(k => col.topSet.has(k)) && col.topSet.size === 3 && col.top[0].strike === bySize[0]);
}

/* (ii) the mark's colour, and colour vision */
{
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const toLin = (rgb: readonly number[]) => rgb.map(lin);
  const oklab = (l3: readonly number[]) => {
    const [r, g, b] = l3;
    const L = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const Mx = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const S = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * L + 0.793617785 * Mx - 0.0040720468 * S, 1.9779984951 * L - 2.428592205 * Mx + 0.4505937099 * S, 0.0259040371 * L + 0.7827717662 * Mx - 0.808675766 * S];
  };
  const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const paperInks: MarkInks = { put: heatRampColorFor(1, 1, HEAT_MODE, true), call: heatRampColorFor(-1, 1, HEAT_MODE, true), neutral: [64, 67, 74] };
  let ok = true;
  const notes: string[] = [];
  for (const [ground, inks] of [['dark', DARK_MARK_INKS], ['paper', paperInks]] as const)
    for (const side of [1, -1] as const) {
      const n = oklab(toLin(inks.neutral));
      const ds = Array.from({ length: STRENGTH_STEPS + 1 }, (_, k) => dist(oklab(toLin(markInk(side, k / STRENGTH_STEPS, inks))), n));
      const mono = ds.every((d, i) => i === 0 || d >= ds[i - 1] - 1e-9);
      if (!(mono && ds[0] === 0 && ds[STRENGTH_STEPS] > 0.1)) {
        ok = false;
        notes.push(`${ground} ${side > 0 ? 'put' : 'call'}`);
      }
    }
  check(`the colour strength walks from the grey to the side's ink without turning back (OKLab distance from the neutral, both grounds, both sides)${notes.length ? ` — fails: ${notes.join(', ')}` : ''}`, ok);

  /* the two sides apart under protanopia, deuteranopia and tritanopia (Machado, Oliveira and Fernandes 2009, severity 1),
     in OKLab, from half strength up on the dark ground */
  const M: Record<string, number[][]> = {
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
  const sim = (rgb: readonly number[], m: number[][]) => {
    const l = toLin(rgb);
    return m.map(row => Math.max(0, Math.min(1, row[0] * l[0] + row[1] * l[1] + row[2] * l[2])));
  };
  const mins: string[] = [];
  let worst = Infinity;
  for (const [name, m] of Object.entries(M)) {
    let lo = Infinity;
    for (let k = Math.ceil(STRENGTH_STEPS / 2); k <= STRENGTH_STEPS; k++) {
      const u = k / STRENGTH_STEPS;
      const p = oklab(sim(markInk(1, u, DARK_MARK_INKS), m));
      const c = oklab(sim(markInk(-1, u, DARK_MARK_INKS), m));
      lo = Math.min(lo, dist(p, c));
    }
    worst = Math.min(worst, lo);
    mins.push(`${name} ${lo.toFixed(3)}`);
  }
  check(`the two sides stay apart from half strength up under each deficiency (smallest OKLab distance: ${mins.join(', ')}; 0.02 is a just-noticeable difference)`, worst >= 0.04);
}

/* (iii) replay equals live on the recorder's own sessions */
{
  const root = join(process.cwd(), '.feed-cache', 'field');
  const sessions: { name: string; day: string; file: string }[] = [];
  if (existsSync(root))
    for (const name of readdirSync(root))
      for (const day of existsSync(join(root, name)) && /^[A-Z]/.test(name) ? readdirSync(join(root, name)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [])
        if (existsSync(join(root, name, day, 'shown.jsonl'))) sessions.push({ name, day, file: join(root, name, day, 'shown.jsonl') });
  /* EVERY SKIPPED SESSION IS NAMED WITH ITS REASON, AND A PROOF THAT READ NOTHING FAILS (2026-10-14 — the owner: "print
     every skipped session with its reason; fail if all are skipped"): a machine with no recorder session, or none five
     minutes long, cannot stand on this check */
  const skipped: string[] = [];
  if (!sessions.length) check('replay against live: a recorder session on this machine to read (none — .feed-cache/field holds no shown.jsonl)', false);
  else {
    let minutes = 0;
    let beads = 0;
    let off = 0;
    let read = 0;
    const cut: string[] = [];
    for (const s of sessions) {
      type Row = { f?: number; m: number; max: number; ref: number; maxG?: number; refG?: number; cells: [number, number, number?][] };
      const all = readFileSync(s.file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(l => {
          try {
            return JSON.parse(l) as Row;
          } catch {
            return null;
          }
        })
        .filter((r): r is Row => !!r);
      /* A MINUTE WRITTEN TWICE is a live capture two recorders shared (2026-10-13, before the one-recorder lock — docs/
         data-feed.md "One recorder a machine"): from there on the live count held minutes twice, so the capture is read
         only up to the first minute written again */
      const seen = new Set<number>();
      let firstDup = Infinity;
      for (const r of all) {
        if (seen.has(r.m)) firstDup = Math.min(firstDup, r.m);
        seen.add(r.m);
      }
      const once = new Set<number>();
      const rows = all.filter(r => r.m < firstDup && !once.has(r.m) && (once.add(r.m), true)).sort((a, b) => a.m - b.m);
      if (Number.isFinite(firstDup)) cut.push(`${s.name} ${s.day} read to ${new Date(firstDup).toISOString().slice(11, 16)} UTC (${rows.length} minutes), where two recorders wrote the same minutes`);
      if (rows.length < 5) {
        skipped.push(`${s.name} ${s.day}: ${rows.length === 0 ? 'no minute readable' : `${rows.length} minute${rows.length === 1 ? '' : 's'}`} on this machine${Number.isFinite(firstDup) ? ' before two recorders wrote the same minute' : ''} — under the five the check needs`);
        continue;
      }
      read++;
      const pick = rng(rows.length);
      /* THE SIZE (B3): rows of format 2 count the gross; older rows the net, on both sides alike. A row of format 3 was
         drawn against the session's largest node so far (the orbs' second round), one before it against the 85th
         percentile of the minutes' peaks — each is replayed on the rule it was drawn under */
      const replayP85 = minuteRefs(
        rows.map(r => r.m / 1000),
        rows.map(r => r.maxG ?? r.max),
        nyDay
      ).ref;
      const replayMax = minuteMaxRefs(
        rows.map(r => r.m / 1000),
        rows.map(r => r.maxG ?? r.max),
        nyDay
      );
      const replay = rows.map((r, i) => ((r.f ?? 0) >= 3 ? replayMax[i] : replayP85[i]));
      for (let n = 0; n < 20; n++) {
        const i = Math.floor(pick() * rows.length);
        const r = rows[i];
        minutes++;
        for (const c of r.cells) {
          beads++;
          const g = c[2] ?? Math.abs(c[1]);
          if (stepOf(strengthOf(g, r.refG ?? r.ref)) !== stepOf(strengthOf(g, replay[i]))) off++;
        }
      }
    }
    for (const c of cut) console.log(`NOTE  ${c}`);
    for (const s of skipped) console.log(`SKIP  ${s}`);
    /* a recorder that has just started holds a few minutes: a session under five is not read and is named above; with
       none read the check FAILS (the owner, 2026-10-14) — it stood as a skip until then */
    if (minutes === 0) check(`replay against live: at least one of the ${sessions.length} recorder session${sessions.length === 1 ? '' : 's'} on this machine five minutes long (every one skipped, each named above)`, false);
    else check(`replay equals live: ${beads} beads at ${minutes} random minutes of ${read} of ${sessions.length} recorder session${sessions.length === 1 ? '' : 's'} (${skipped.length} skipped, named above), the step recomputed as of the minute against the step the recorder drew live — ${off} differ`, off === 0);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
