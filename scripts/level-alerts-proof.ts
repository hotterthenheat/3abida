/*
  Acceptance test for the tiered level alerts (data/levelAlerts.ts, the owner's item 7, 2026-10-14):
  the rules on built minutes — a flip cross a Tier-2 notice after N closed minutes beyond it (3 by default since the
  owner's second rule of 2026-10-14: "make a flip cross Tier 2 with 3 closed-minute confirmation (default). Tier 1 =
  wall touches only"); a whipsaw inside the re-arm distance never noticed twice; a wall touch — the one Tier-1 alert —
  only after the wall has stood 15 minutes; a wall followed by its identity (a move of two strikes a Tier-2 notice, a
  smaller one Tier 3); the stale guard; the global Tier-1 cap; the outcomes at +15 and +30 minutes on the track
  record's definitions — and the owner's acceptance on the sessions this machine has rebuilt:
  (i)   replaying the 10 sessions with the most flip crossings: no 15 minutes hold more than the cap of Tier-1 alerts,
        and no two alerts with one tag fall inside one cooldown (the same minute, or before price moved the re-arm
        distance away); the alerts of each session by tier are printed (a new heavy strike is Tier 3 since the owner's
        third rule of 2026-10-14: "Move 'new top-3' to Tier 3 (log only). Keep wall moves and flip crosses at Tier 2")
  (ii)  a 3-minute gap in the data drops a Tier-1 alert to Tier 2, said "stale"
  (iii) every alert old enough joins its +15 and +30 minute outcome
*/
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { LEVEL_ALERT_DEFAULTS, LevelAlertEngine, LEVEL_IDS, outcomesOf, type LevelBar, type LevelEvent, type LevelInputs, type TierCap } from '../src/data/levelAlerts';
import { createFieldStore } from '../server/fieldStore';
import type { PastDay } from '../server/fieldBackfill';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (ok) pass++;
  else fail++;
};
const T0 = Date.UTC(2026, 9, 14, 13, 30) / 1000;
const lv = (o: Partial<LevelInputs> = {}): LevelInputs => ({ flip: 600, callWall: 605, putWall: 595, top: [600, 605, 595], step: 1, sigma: null, ...o });
const bar = (i: number, close: number, closed = true, hi = close, lo = close): LevelBar => ({ time: T0 + i * 60, high: Math.max(hi, close), low: Math.min(lo, close), close, closed });
const run = (e: LevelAlertEngine, closes: number[], inputs: (i: number) => LevelInputs = () => lv(), age = () => 0) => closes.flatMap((c, i) => e.observe(bar(i, c), inputs(i), (T0 + i * 60 + 60) * 1000, age()));

/* the flip — a Tier-2 notice after three closed minutes beyond it by default (the owner, 2026-10-14) */
{
  check('the default confirmation is three closed minutes', LEVEL_ALERT_DEFAULTS.confirmBars === 3);
  const e = new LevelAlertEngine('SPY', ['flip']);
  const ev = run(e, [599, 599.5, 600.4, 600.8, 601]);
  check(`three closed minutes beyond the flip call the cross, a Tier-2 notice ("${ev[0]?.words}")`, ev.length === 1 && ev[0].tier === 2 && ev[0].kind === 'flip-cross' && ev[0].side === 'up' && ev[0].tag === 'SPY-flip' && ev[0].bar === T0 + 240);
  const e1 = new LevelAlertEngine('SPY', ['flip']);
  const ev1 = run(e1, [599, 600.4, 600.6, 599.8, 600.4, 600.6]);
  check('by default two minutes beyond and one back is no cross', ev1.length === 0);
  const e2 = new LevelAlertEngine('SPY', ['flip'], { confirmBars: 2 });
  const ev2 = run(e2, [599, 600.4, 599.8, 600.4, 600.6]);
  check('with two confirmation minutes, one minute beyond and back is no cross; two in a row are', ev2.length === 1 && ev2[0].bar === T0 + 240);
  const e3 = new LevelAlertEngine('SPY', ['flip'], { confirmBars: 1 });
  const ev3 = run(e3, [599, 600.3, 599.8, 600.2, 599.9, 600.3]);
  check(`at one confirmation minute a whipsaw inside half a strike is noticed once (${ev3.length})`, ev3.length === 1);
  const e4 = new LevelAlertEngine('SPY', ['flip'], { confirmBars: 1 });
  const ev4 = run(e4, [599, 600.3, 599.4, 600.6]);
  check(`once price has moved half a strike away, the next cross is noticed (${ev4.length}: ${ev4.map(x => x.side).join(', ')})`, ev4.length === 3 && ev4[1].side === 'down');
  const e5 = new LevelAlertEngine('SPY', ['flip'], { confirmBars: 1 });
  const forming = e5.observe(bar(0, 599), lv(), T0 * 1000, 0).length + e5.observe(bar(1, 600.5, false), lv(), (T0 + 70) * 1000, 0).length;
  check('a forming minute beyond the flip confirms nothing until it closes', forming === 0 && e5.observe(bar(1, 600.5, true), lv(), (T0 + 120) * 1000, 0).length === 1);
}

/* the walls */
{
  const e = new LevelAlertEngine('SPY', ['callWall']);
  const closes = Array.from({ length: 30 }, (_, i) => (i === 10 || i === 20 ? 605 : 603));
  const ev = run(e, closes);
  check(`a touch of a wall that has stood under 15 minutes is quiet; after, Tier 1 (${ev.map(x => (x.bar - T0) / 60).join(', ')})`, ev.length === 1 && ev[0].bar === T0 + 20 * 60 && ev[0].tier === 1 && ev[0].kind === 'wall-touch' && ev[0].tag === 'SPY-callwall');
  const e2 = new LevelAlertEngine('SPY', ['callWall']);
  const moved = run(e2, Array.from({ length: 12 }, () => 603), i => lv({ callWall: i < 4 ? 605 : i < 8 ? 606 : 608 }));
  check(`the watch follows the wall: 605 → 606 a Tier-3 line, 606 → 608 a Tier-2 notice, each once the strike has held three minutes (${moved.map(x => `${x.from}→${x.to} T${x.tier}`).join(', ')})`, moved.length === 2 && moved[0].tier === 3 && moved[0].kind === 'wall-rekey' && moved[1].tier === 2 && moved[1].kind === 'wall-move' && moved[1].bar === T0 + 10 * 60);
  const flick = run(new LevelAlertEngine('SPY', ['callWall']), Array.from({ length: 10 }, () => 603), i => lv({ callWall: i % 2 ? 608 : 605 }));
  check('a wall trading places for a minute at a time is not a move', flick.length === 0);
}

/* the three heaviest and the σ levels */
{
  const e = new LevelAlertEngine('SPY', ['top3']);
  const ev = run(e, Array.from({ length: 8 }, () => 600), i => lv({ top: i < 2 ? [600, 605, 595] : [600, 610, 605] }));
  check(`a strike entering the three heaviest and holding three minutes: Tier 3, the log alone (${ev.map(x => `${x.price} T${x.tier}`).join(', ')})`, ev.length === 1 && ev[0].price === 610 && ev[0].tier === 3);
  const s = new LevelAlertEngine('SPY', ['sigma']);
  const evs = run(s, [600, 602, 604.1, 603, 601], () => lv({ sigma: { prevClose: 600, s: 2 } }));
  check(`±σ: +1σ at 602 and +2σ at 604 touched, each once (${evs.map(x => x.tag).join(', ')})`, evs.length === 2 && evs.every(x => x.tier === 2) && evs[0].tag === 'SPY-sigmaup1' && evs[1].tag === 'SPY-sigmaup2');
}

/* the stale guard and the global cap — on Tier 1, which is a wall touch alone */
{
  const wallTouch = (n = 21) => Array.from({ length: n }, (_, i) => (i === n - 1 ? 605 : 603));
  const e = new LevelAlertEngine('SPY', ['callWall']);
  const ev = run(e, wallTouch(), () => lv(), () => 3 * 60_000);
  check('(ii) inputs three minutes old at the trigger: a wall touch drops from Tier 1 to Tier 2, said stale', ev.length === 1 && ev[0].kind === 'wall-touch' && ev[0].tier === 2 && ev[0].stale);
  const cap: TierCap = { at: [] };
  const names = ['SPY', 'QQQ', 'IWM', 'NVDA'].map(t => new LevelAlertEngine(t, ['callWall'], {}, cap));
  const fired = names.flatMap((n, k) => run(n, wallTouch(), () => lv(), () => 0).map(x => ({ ...x, k })));
  check(`the Tier-1 cap is global: four names touching a wall in one minute ring three, the fourth a Tier-2 notice said capped (${fired.map(x => `${x.ticker} T${x.tier}`).join(', ')})`, fired.length === 4 && fired.filter(x => x.tier === 1).length === 3 && fired.filter(x => x.capped).length === 1);
  const f = new LevelAlertEngine('SPY', ['flip'], { confirmBars: 1 }, { at: [] });
  const crossed = run(f, [599, 600.6], () => lv(), () => 3 * 60_000);
  check('a flip cross is never Tier 1: it rings nothing, counts against no cap and is never said stale', crossed.length === 1 && crossed[0].tier === 2 && !crossed[0].stale && !crossed[0].capped);
}

/* the outcomes */
{
  const touch: LevelEvent = { key: 'k', tag: 'SPY-callwall', ticker: 'SPY', tier: 1, level: 'callWall', kind: 'wall-touch', price: 605, spot: 605, at: 0, bar: T0, age: 0, stale: false, capped: false, side: 'up', words: '' };
  const bars = Array.from({ length: 40 }, (_, i) => ({ time: T0 + i * 60, close: 605 - i * 0.1 }));
  const [o15, o30] = outcomesOf(touch, bars);
  check(`a touch from below that closes back under at +15 and +30 held (the track record's bounce): ${o15?.points.toFixed(1)} and ${o30?.points.toFixed(1)} points`, !!o15 && !!o30 && o15.held && o30.held && Math.abs(o15.points - 1.5) < 1e-9);
  const cross: LevelEvent = { ...touch, kind: 'flip-cross', level: 'flip', price: 600 };
  const up = outcomesOf(cross, bars.map(b => ({ ...b, close: 600 + (b.time - T0) / 600 })));
  check('a cross up still above at +15 held; a horizon not reached is null', !!up[0]?.held && outcomesOf(cross, bars.slice(0, 20))[1] === null);
}

/* (i) and (iii) on the sessions this machine has rebuilt */
{
  const root = join(process.cwd(), '.feed-cache', 'field');
  const store = createFieldStore();
  type Sess = { name: string; day: string; rows: ReturnType<typeof store.rowsOf>; bars: { time: number; open?: number; high?: number; low?: number; close: number; session: string }[]; crossings: number };
  const sessions: Sess[] = [];
  if (existsSync(root))
    for (const name of readdirSync(root).filter(n => /^[A-Z]+$/.test(n)))
      for (const day of readdirSync(join(root, name)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))) {
        const pf = join(root, name, day, 'past.json.gz');
        const bf = join(root, name, day, 'bars.json.gz');
        if (!existsSync(pf) || !existsSync(bf)) continue;
        const past = JSON.parse(gunzipSync(readFileSync(pf)).toString('utf8')) as PastDay;
        const bars = (JSON.parse(gunzipSync(readFileSync(bf)).toString('utf8')) as Sess['bars']).filter(b => b.session === 'r').sort((a, b) => a.time - b.time);
        const rows = store.rowsOf(past, bars as never);
        let crossings = 0;
        for (let i = 1; i < rows.length; i++) {
          const a = rows[i - 1];
          const b = rows[i];
          if (a.flip != null && b.flip != null && Math.sign(a.spot - a.flip) !== Math.sign(b.spot - b.flip)) crossings++;
        }
        sessions.push({ name, day, rows, bars, crossings });
      }
  if (sessions.length === 0) console.log('SKIP  (i)–(iii) on rebuilt sessions: none on this machine');
  else {
    const picked = [...sessions].sort((a, b) => b.crossings - a.crossings).slice(0, 10);
    let tier1Max = 0;
    let sameTagInCooldown = 0;
    let events = 0;
    let joined = 0;
    let joinable = 0;
    let gapDowngraded = 0;
    let gapTier1 = 0;
    const kinds: Record<string, number> = {};
    const table: string[] = [];
    for (const s of picked) {
      const cap: TierCap = { at: [] };
      const e = new LevelAlertEngine(s.name, LEVEL_IDS, {}, cap);
      const byMinute = new Map(s.bars.map(b => [b.time, b]));
      const out: LevelEvent[] = [];
      const steps = s.rows.map(r => {
        const b = byMinute.get(r.m / 1000);
        const top = r.top.slice(0, 3).map(x => x[0]);
        const strikes = r.cells.map(c => c[0]);
        const step = strikes.length > 1 ? Math.min(...strikes.slice(1).map((k, i) => k - strikes[i]).filter(x => x > 0)) : 1;
        return { bar: { time: r.m / 1000, high: b?.high ?? r.spot, low: b?.low ?? r.spot, close: r.spot, closed: true } as LevelBar, lv: { flip: r.flip, callWall: r.cw, putWall: r.pw, top, step, sigma: null } as LevelInputs };
      });
      for (const st of steps) out.push(...e.observe(st.bar, st.lv, (st.bar.time + 60) * 1000, 0));
      events += out.length;
      for (const x of out) {
        kinds[x.kind] = (kinds[x.kind] ?? 0) + 1;
        kinds[`tier ${x.tier}${x.capped ? ' capped' : ''}`] = (kinds[`tier ${x.tier}${x.capped ? ' capped' : ''}`] ?? 0) + 1;
      }
      /* the session's alerts by tier (the owner, 2026-10-14: "report alerts per session by tier") */
      const n = (f: (x: LevelEvent) => boolean) => out.filter(f).length;
      table.push(
        `  ${s.name} ${s.day}  crossings ${String(s.crossings).padStart(2)} · alerts ${String(out.length).padStart(3)} · tier 1 ${String(n(x => x.tier === 1)).padStart(2)} (wall touches) · tier 2 ${String(n(x => x.tier === 2)).padStart(3)} (flip crosses ${n(x => x.kind === 'flip-cross')}, wall moves ${n(x => x.kind === 'wall-move')}, capped ${n(x => x.capped)}, stale ${n(x => x.stale)}) · tier 3 ${String(n(x => x.tier === 3)).padStart(3)} (new top-3 ${n(x => x.kind === 'new-top3')}, wall re-keys ${n(x => x.kind === 'wall-rekey')})`
      );
      /* the cap: no 15 minutes hold more than three Tier-1 alerts */
      const t1 = out.filter(x => x.tier === 1).map(x => x.at).sort((a, b) => a - b);
      for (let i = 0; i < t1.length; i++) tier1Max = Math.max(tier1Max, t1.filter(x => x >= t1[i] && x < t1[i] + 15 * 60_000).length);
      /* the cooldown: two alerts with one tag never in one minute, nor before price moved the re-arm distance */
      const byTag = new Map<string, LevelEvent[]>();
      for (const x of out) if (x.kind !== 'wall-move' && x.kind !== 'wall-rekey') byTag.set(`${x.tag}|${x.kind}|${x.kind === 'new-top3' ? x.price : ''}`, [...(byTag.get(`${x.tag}|${x.kind}|${x.kind === 'new-top3' ? x.price : ''}`) ?? []), x]);
      for (const list of byTag.values())
        for (let i = 1; i < list.length; i++) {
          const a = list[i - 1];
          const b = list[i];
          const d = 0.5 * (steps.find(st => st.bar.time === a.bar)?.lv.step ?? 1);
          const moved = steps.some(st => st.bar.time > a.bar && st.bar.time < b.bar && Math.max(Math.abs(st.bar.high - a.price), Math.abs(st.bar.low - a.price)) >= d) || Math.max(Math.abs((byMinute.get(b.bar)?.high ?? b.spot) - a.price), Math.abs((byMinute.get(b.bar)?.low ?? b.spot) - a.price)) >= d;
          if (a.bar === b.bar || !moved) sameTagInCooldown++;
        }
      /* (iii) every alert with 30 minutes of the session after it joins both outcomes */
      const last = s.bars[s.bars.length - 1]?.time ?? 0;
      for (const x of out) {
        if (x.bar + 30 * 60 > last) continue;
        joinable++;
        const o = outcomesOf(x, s.bars);
        if (o[0] && o[1]) joined++;
      }
      /* (ii) a three-minute gap before each Tier-1 alert, replayed: the alert is said stale at Tier 2 */
      const e2 = new LevelAlertEngine(s.name, LEVEL_IDS, {}, { at: [] });
      const t1Bars = new Set(out.filter(x => x.tier === 1).map(x => x.bar));
      let lastSeen = 0;
      for (const st of steps) {
        const gap = [...t1Bars].some(b => st.bar.time > b - 4 * 60 && st.bar.time < b);
        if (gap) continue;
        const age = lastSeen && st.bar.time - lastSeen > 60 ? (st.bar.time - lastSeen - 60) * 1000 : 0;
        const ev = e2.observe(st.bar, st.lv, (st.bar.time + 60) * 1000, age);
        lastSeen = st.bar.time;
        for (const x of ev)
          if (t1Bars.has(x.bar) && x.kind === 'wall-touch') {
            gapTier1++;
            if (x.tier === 2 && x.stale) gapDowngraded++;
          }
      }
    }
    /* how the confirmation minutes thin the flip's crosses on the same sessions */
    const byN = [1, 2, 3].map(n => {
      let crosses = 0;
      for (const s of picked) {
        const e = new LevelAlertEngine(s.name, ['flip'], { confirmBars: n }, { at: [] });
        const byMinute = new Map(s.bars.map(b => [b.time, b]));
        for (const r of s.rows) {
          const b = byMinute.get(r.m / 1000);
          const strikes = r.cells.map(c => c[0]);
          const step = strikes.length > 1 ? Math.min(...strikes.slice(1).map((k, i) => k - strikes[i]).filter(x => x > 0)) : 1;
          crosses += e.observe({ time: r.m / 1000, high: b?.high ?? r.spot, low: b?.low ?? r.spot, close: r.spot, closed: true }, { flip: r.flip, callWall: r.cw, putWall: r.pw, top: [], step, sigma: null }, r.m + 60_000, 0).length;
        }
      }
      return `${n} minute${n === 1 ? '' : 's'}: ${crosses} (${(crosses / picked.length).toFixed(1)} a session)`;
    });
    console.log('NOTE  the ten sessions, by tier (flip crosses at the default three closed minutes; Tier 1 a wall touch alone; a new heavy strike Tier 3, the log alone):');
    for (const l of table) console.log(l);
    console.log(`NOTE  flip crosses called, by confirmation minutes — ${byN.join('; ')}`);
    console.log(`NOTE  ${picked.length} sessions (${picked.map(s => `${s.name} ${s.day} ${s.crossings}`).join(', ')}), ${events} alerts: ${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(', ')}`);
    check(`(i) the cap holds: at most ${tier1Max} Tier-1 alerts in any 15 minutes (cap 3)`, tier1Max <= 3 && events > 0);
    check(`(i) no two alerts with one tag inside one cooldown (${sameTagInCooldown} found)`, sameTagInCooldown === 0);
    check(`(ii) a three-minute gap before a Tier-1 alert drops it to Tier 2, said stale: ${gapDowngraded} of the ${gapTier1} replayed after a gap`, gapTier1 > 0 && gapDowngraded === gapTier1);
    check(`(iii) every alert with half an hour of its session after it joins its +15 and +30 outcomes: ${joined} of ${joinable}`, joinable > 0 && joined === joinable);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
