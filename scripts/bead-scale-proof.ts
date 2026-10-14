/*
  Acceptance test for the bead scale, legend and disclosure (the owner's item 5, 2026-10-14):
  (i)   the legend's value equals the reference the renderer used at that minute — the primitive's own hand-off, every
        column against the session's per-minute count (data/feed/beadScale.ts, the store's one code)
  (ii)  a greyscale render keeps the magnitude order: each step's ink over the ground, at its alpha, is lighter (on the
        dark tape) or darker (on paper) than the step below it, for both sides and every staleness step; and the two
        sides stay apart under the three colour-vision deficiencies
  (iii) the brightness step a bead draws at in replay equals the live capture's, on the recorder's own sessions (run
        when this machine holds one)
  and the pieces: ten steps a side, the floor, the ring above p95, the three staleness steps, the fixed and prior bases.
  (iv), the frame time at full zoom-out, is measured in the browser (docs/data-feed.md "The bead scale").
*/
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BEAD_STEPS, RunningScale, minuteRefs, pooledRef, stepOf, stepT, strengthOf } from '../src/data/feed/beadScale';
import { GexTrailsPrimitive, STALE_ALPHA, STALE_COVER, coreAlpha, stepColourT } from '../src/components/gex/gexNodesPrimitive';
import { heatRampColor, heatRampColorFor, HEAT_MODE } from '../src/components/gex/heatmap';
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
      return { strike: 560 + k, value: v, dex: v * 20, prov: u < 0.1 ? ('carried' as const) : ('modeled' as const), staleShare: u < 0.2 ? 0.6 : 0.1 };
    });
    base.push({ time: open + m * 60, spot: 580, levels } as unknown as GexSnapshot);
  }
}
const maxima = base.map(s => Math.max(...s.levels.map(l => Math.abs(l.value))));

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
  check(`floor 10%: the strikes under a tenth of the reference are hidden (${col2.top.length} draw), measured against the reference`, col2.top.every(b => Math.abs(lv.find(l => l.strike === b.strike)!.value) >= 0.1 * r.ref) && col2.top.length === lv.filter(l => Math.abs(l.value) >= 0.1 * r.ref).length);
  prim.setBasis('session', 0);
  const beads = [...prim.columnAt(lastDay).all.values()];
  /* every column of the last session: a bead wears the ring exactly when it stands above its column's p95 */
  let ringed = 0;
  let wrong = 0;
  for (let i = 780; i < base.length; i++) {
    const ri = prim.refAt(i);
    for (const b of prim.columnAt(i).all.values()) {
      const above = Math.abs(base[i].levels.find(l => l.strike === b.strike)!.value) > ri.ring;
      if (b.ring !== above) wrong++;
      if (b.ring) ringed++;
    }
  }
  check(`the ring: a bead above its column's p95 and no other (${ringed} ringed over the session, ${wrong} wrong; at the last minute p95 is ${r.ring.toExponential(3)})`, wrong === 0 && ringed > 0);
  check('staleness, three steps: carried 2, half its gamma on old vols 1, else 0', beads.every(b => {
    const l = lv.find(x => x.strike === b.strike)!;
    return b.stale === (l.prov === 'carried' ? 2 : (l.staleShare ?? 0) >= 0.5 ? 1 : 0);
  }));
  check('a bead\'s step is its strength against the reference', beads.every(b => b.step === stepOf(strengthOf(lv.find(l => l.strike === b.strike)!.value, r.ref))));
}

/* (ii) greyscale and colour vision */
{
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const lum = (rgb: readonly number[]) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  const over = (ink: readonly number[], a: number, ground: readonly number[]) => ink.map((c, i) => ground[i] * (1 - a) + c * a);
  const grounds: { name: string; rgb: number[]; paper: boolean }[] = [
    { name: 'dark canvas', rgb: [5, 5, 5], paper: false },
    { name: 'dark panel', rgb: [10, 10, 10], paper: false },
    { name: 'paper canvas', rgb: [241, 240, 236], paper: true },
    { name: 'paper panel', rgb: [255, 255, 255], paper: true },
  ];
  let ok = true;
  const notes: string[] = [];
  for (const g of grounds)
    for (const side of [1, -1] as const)
      for (const stale of [0, 1, 2] as const) {
        const ls = Array.from({ length: BEAD_STEPS }, (_, i) => {
          const s = stepT(i + 1);
          const ink = g.paper ? heatRampColorFor(side, stepColourT(s), HEAT_MODE, true) : heatRampColor(side, stepColourT(s));
          /* a stale bead's dotted fill covers part of it: what the eye averages is the ink at alpha × its cover */
          return lum(over(ink, coreAlpha(s) * STALE_ALPHA[stale] * STALE_COVER[stale], g.rgb));
        });
        const mono = ls.every((l, i) => i === 0 || (g.paper ? l < ls[i - 1] : l > ls[i - 1]));
        if (!mono) {
          ok = false;
          notes.push(`${g.name} ${side > 0 ? 'put' : 'call'} stale ${stale}`);
        }
      }
  check(`greyscale keeps the order: every step lighter on black and darker on paper than the one below, both sides, all three staleness steps${notes.length ? ` — fails: ${notes.join(', ')}` : ''}`, ok);

  /* the two sides apart under protanopia, deuteranopia and tritanopia (Machado, Oliveira and Fernandes 2009, severity 1),
     in OKLab, on the drawn colour over the dark ground */
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
  const toLin = (rgb: readonly number[]) => rgb.map(lin);
  const sim = (rgb: readonly number[], m: number[][]) => {
    const l = toLin(rgb);
    return m.map(row => Math.max(0, Math.min(1, row[0] * l[0] + row[1] * l[1] + row[2] * l[2])));
  };
  const oklab = (l3: readonly number[]) => {
    const [r, g, b] = l3;
    const L = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const Mx = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const S = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * L + 0.793617785 * Mx - 0.0040720468 * S, 1.9779984951 * L - 2.428592205 * Mx + 0.4505937099 * S, 0.0259040371 * L + 0.7827717662 * Mx - 0.808675766 * S];
  };
  const mins: string[] = [];
  let worst = Infinity;
  for (const [name, m] of Object.entries(M)) {
    let lo = Infinity;
    for (let k = 3; k <= BEAD_STEPS; k++) {
      const s = stepT(k);
      const a = coreAlpha(s);
      const put = over(heatRampColor(1, stepColourT(s)), a, [5, 5, 5]);
      const call = over(heatRampColor(-1, stepColourT(s)), a, [5, 5, 5]);
      const p = oklab(sim(put, m));
      const c = oklab(sim(call, m));
      lo = Math.min(lo, Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]));
    }
    worst = Math.min(worst, lo);
    mins.push(`${name} ${lo.toFixed(3)}`);
  }
  check(`the two sides stay apart from the third step up under each deficiency (smallest OKLab distance: ${mins.join(', ')}; 0.02 is a just-noticeable difference)`, worst >= 0.04);
}

/* (iii) replay equals live on the recorder's own sessions */
{
  const root = join(process.cwd(), '.feed-cache', 'field');
  const sessions: { name: string; day: string; file: string }[] = [];
  if (existsSync(root))
    for (const name of readdirSync(root))
      for (const day of existsSync(join(root, name)) && /^[A-Z]/.test(name) ? readdirSync(join(root, name)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [])
        if (existsSync(join(root, name, day, 'shown.jsonl'))) sessions.push({ name, day, file: join(root, name, day, 'shown.jsonl') });
  if (!sessions.length) console.log('SKIP  replay against live: no recorder session on this machine');
  else {
    let minutes = 0;
    let beads = 0;
    let off = 0;
    const cut: string[] = [];
    for (const s of sessions) {
      type Row = { m: number; max: number; ref: number; cells: [number, number][] };
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
      if (rows.length < 5) continue;
      const pick = rng(rows.length);
      const replay = minuteRefs(
        rows.map(r => r.m / 1000),
        rows.map(r => r.max),
        nyDay
      ).ref;
      for (let n = 0; n < 20; n++) {
        const i = Math.floor(pick() * rows.length);
        const r = rows[i];
        minutes++;
        for (const [, v] of r.cells) {
          beads++;
          if (stepOf(strengthOf(v, r.ref)) !== stepOf(strengthOf(v, replay[i]))) off++;
        }
      }
    }
    for (const c of cut) console.log(`NOTE  ${c}`);
    /* a recorder that has just started holds a few minutes: a session under five is not read, and with none to read the
       check is skipped, not failed (2026-10-14 — the dev server restarted mid-session and every session held four) */
    if (minutes === 0) console.log(`SKIP  replay against live: ${sessions.length} recorder session${sessions.length === 1 ? '' : 's'} on this machine, none five minutes long yet`);
    else check(`replay equals live: ${beads} beads at ${minutes} random minutes of ${sessions.length} recorder session${sessions.length === 1 ? '' : 's'}, the step recomputed as of the minute against the step the recorder drew live — ${off} differ`, off === 0);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
