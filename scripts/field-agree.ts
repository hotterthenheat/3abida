/*
  THE STORE'S AGREEMENT CHECK (2026-10-13 — the owner: "Shown vs final is checked to a tolerance: median ≤1%, p90 ≤5%,
  walls and flip equal in ≥95% of columns, on gap-free recorder days … Final rows must equal the rebuild exactly (same
  code path)").

    npm run field:agree -- SPY 2026-10-14            shown against final, the tolerance
    npm run field:agree -- SPY 2026-10-14 --rebuild  and final against the session's full rebuild, to the cell

  Reads .feed-cache/field/<NAME>/<day>/{shown,final}.jsonl(.gz). The tolerance is judged on a gap-free day alone (every
  regular minute with both rows); a day with gaps is reported, never judged. --rebuild needs the UW key in .env (read
  the way the recorder reads it, never printed) and costs a session's calls (SPY about 1,650). Exit 1 on a FAIL.
*/
import { existsSync, readFileSync } from 'node:fs';
import { createFeedClient } from '../server/feed';
import { createFieldBackfill } from '../server/fieldBackfill';
import { createFieldStore, type Bar, type StoreRow } from '../server/fieldStore';

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flags = new Set(process.argv.slice(2).filter(a => a.startsWith('--')));
const NAME = (args[0] ?? 'SPY').toUpperCase();
const DAY = args[1] ?? '';
if (!/^\d{4}-\d{2}-\d{2}$/.test(DAY)) {
  console.error('usage: npm run field:agree -- <NAME> <YYYY-MM-DD> [--rebuild]');
  process.exit(2);
}

const med = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const pct = (a: number[], p: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN;
};
const f1 = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : 'n/a');
const ny = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
const sameFlip = (a: number | null, b: number | null) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) <= 0.25);

/** The owner's tolerance, judged on the minutes both rows hold */
function tolerance(shown: StoreRow[], final: StoreRow[]): { judged: boolean; pass: boolean; lines: string[] } {
  const byM = new Map(shown.filter(r => r.session === 'r').map(r => [r.m, r]));
  const rel: number[] = [];
  let cols = 0;
  let walls = 0;
  let flips = 0;
  let cells = 0;
  const top: number[] = [];
  for (const F of final) {
    const S = byM.get(F.m);
    if (!S) continue;
    cols++;
    if (S.cw === F.cw && S.pw === F.pw) walls++;
    if (sameFlip(S.flip, F.flip)) flips++;
    const fs = new Set(F.top.map(t => t[0]));
    top.push(S.top.filter(t => fs.has(t[0])).length / Math.max(1, F.top.length));
    const maxF = Math.max(...F.cells.map(c => Math.abs(c[1])), 1);
    const sm = new Map(S.cells.map(c => [c[0], c[1]] as [number, number]));
    for (const [k, v] of F.cells) {
      if (Math.abs(v) < 0.02 * maxF) continue;
      const sv = sm.get(k);
      if (sv == null) continue;
      cells++;
      rel.push(Math.abs(sv - v) / Math.abs(v));
    }
  }
  const lines: string[] = [];
  if (!cols) return { judged: false, pass: false, lines: ['no minute holds both rows'] };
  const m = med(rel);
  const p90 = pct(rel, 0.9);
  const w = walls / cols;
  const fl = flips / cols;
  lines.push(`${cols} minutes with both rows, ${cells} cells: |shown − final| ÷ |final| median ${f1(m)}, p90 ${f1(p90)}; walls equal ${f1(w)}, flip within $0.25 ${f1(fl)}, top-5 shared ${f1(med(top))}`);
  const pass = m <= 0.01 && p90 <= 0.05 && w >= 0.95 && fl >= 0.95;
  return { judged: true, pass, lines };
}

async function main() {
  const store = createFieldStore();
  const shown = store.readRows(NAME, DAY, 'shown');
  const final = store.readRows(NAME, DAY, 'final');
  console.log(`${NAME} ${DAY}: ${shown.length} shown rows (${shown.filter(r => r.session === 'r').length} in the session), ${final.length} final rows`);
  if (!final.length || !shown.length) {
    console.log('nothing to compare');
    process.exit(flags.has('--rebuild') ? 0 : 1);
  }
  /* gaps: the regular minutes one side holds and the other does not */
  const sm = new Set(shown.filter(r => r.session === 'r').map(r => r.m));
  const fm = new Set(final.map(r => r.m));
  const first = Math.min(...final.map(r => r.m));
  const last = Math.max(...final.map(r => r.m));
  const shownGaps: number[] = [];
  const finalGaps: number[] = [];
  for (let m = first; m <= last; m += 60_000) {
    if (!sm.has(m)) shownGaps.push(m);
    if (!fm.has(m)) finalGaps.push(m);
  }
  const span = `${ny(first)} to ${ny(last)}`;
  console.log(`final rows span ${span}; shown gaps inside it ${shownGaps.length}${shownGaps.length ? ` (${shownGaps.slice(0, 4).map(ny).join(', ')}${shownGaps.length > 4 ? ', …' : ''})` : ''}, final gaps ${finalGaps.length}`);
  const t = tolerance(shown, final);
  for (const l of t.lines) console.log(l);
  let fail = false;
  if (!t.judged) console.log('TOLERANCE: not judged');
  else if (shownGaps.length || finalGaps.length) console.log(`TOLERANCE: ${t.pass ? 'would pass' : 'would FAIL'} — not judged, the day has gaps (the recorder was not up every minute)`);
  else {
    console.log(`TOLERANCE: ${t.pass ? 'PASS' : 'FAIL'}`);
    fail ||= !t.pass;
  }

  if (flags.has('--rebuild')) {
    const env: Record<string, string> = {};
    if (existsSync('.env'))
      for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
        const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
        if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
      }
    const key = process.env.UW_API_TOKEN || env.UW_API_TOKEN;
    if (!key) {
      console.log('REBUILD: no UW key in .env — skipped');
      process.exit(fail ? 1 : 0);
    }
    const client = createFeedClient({ keys: { uw: key, massive: undefined } as never });
    const bf = createFieldBackfill(client);
    const t0 = Date.now();
    const past = await bf.build(NAME, DAY);
    const a = await client.get('uw', `/api/stock/${NAME}/ohlc/1m?date=${DAY}&limit=2500`);
    const rows = (JSON.parse(a.body) as { data: Record<string, unknown>[] }).data;
    const bars: Bar[] = rows
      .map(r => ({ time: Date.parse(String(r.start_time)) / 1000, close: Number(r.close), session: (r.market_time === 'r' ? 'r' : r.market_time === 'pr' ? 'pre' : 'post') as Bar['session'] }))
      .filter(b => Number.isFinite(b.time) && Number.isFinite(b.close));
    const rebuilt = store.rowsOf(past, bars);
    console.log(`REBUILD: ${past.calls} calls, ${((Date.now() - t0) / 1000).toFixed(0)} s, ${rebuilt.length} minutes, vols '${past.vols}'`);
    const rb = new Map(rebuilt.map(r => [r.m, r]));
    let equal = 0;
    let differ = 0;
    const notes: string[] = [];
    for (const F of final) {
      const R = rb.get(F.m);
      if (!R) {
        differ++;
        if (notes.length < 6) notes.push(`${ny(F.m)}: no rebuilt column`);
        continue;
      }
      const why: string[] = [];
      if (F.spot !== R.spot) why.push('spot');
      if (!sameFlip(F.flip, R.flip) || (F.flip ?? null) !== (R.flip ?? null)) why.push('flip');
      if (F.cw !== R.cw) why.push('call wall');
      if (F.pw !== R.pw) why.push('put wall');
      if (F.cells.length !== R.cells.length) why.push(`cells ${F.cells.length} vs ${R.cells.length}`);
      else {
        let off = 0;
        let worst = 0;
        for (let i = 0; i < F.cells.length; i++) {
          const [k, v] = F.cells[i];
          const [k2, v2] = R.cells[i];
          const d = k !== k2 ? Infinity : Math.abs(v - v2) / Math.max(1, Math.abs(v2));
          if (d > 1e-9) off++;
          if (d > worst) worst = d;
        }
        if (off) why.push(`${off} cells (worst ${Number.isFinite(worst) ? f1(worst) : 'another strike'})`);
      }
      if (Math.abs(F.net - R.net) > 1e-6 * Math.max(1, Math.abs(R.net))) why.push('net');
      if (F.ref !== R.ref) why.push('ref');
      if (why.length) {
        differ++;
        if (notes.length < 6) notes.push(`${ny(F.m)}: ${why.join(', ')}`);
      } else equal++;
    }
    console.log(`REBUILD vs final: ${equal} minutes equal to the cell, ${differ} differ${notes.length ? ` — ${notes.join('; ')}` : ''}`);
    console.log(`EXACT: ${differ === 0 && equal > 0 ? 'PASS' : 'FAIL'}`);
    fail ||= !(differ === 0 && equal > 0);
  }
  process.exit(fail ? 1 : 0);
}
main().catch(e => {
  console.error('FAILED:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
