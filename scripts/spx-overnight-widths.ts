/*
==================================================
  SLAYER TERMINAL - SPX'S OVERNIGHT QUOTES, MEASURED (scripts/spx-overnight-widths.ts — `npm run spx:widths`)

  2026-10-15 — the owner: "On my first recorded night, report the share of overnight SPX cells the 2-point cutoff marks
  stale, and the overnight quote-width percentiles. The cutoff came from one after-curb snapshot."

    npm run spx:widths                     the first night the recorder holds (the oldest SPX trading day with overnight reads)
    npm run spx:widths -- 2026-10-16       that trading day's night (the evening before it, 8:15 pm, to 9:25 am)
    npm run spx:widths -- --all            every night held, one after another

  RUN ON THE ALWAYS-ON MACHINE, after a night the recorder read through Theta's terminal (server/overnightReader.ts
  writes the quotes, each with its width in vol, to .feed-cache/field/SPX/<D>/chain.jsonl and the forward a minute to
  fwd.jsonl). It reads only those files — no call leaves the machine — and writes docs/spx-overnight/<D>/widths.md and
  widths.json beside what it prints:

    · THE WIDTHS: every overnight quote's (ask − bid) ÷ vega, in vol points, within 5% of the forward's spot — the
      basis the 2-point cutoff was set on (gamma × open interest weighted, SPX's after-curb snapshot of 2026-10-14:
      p50 0.29, p90 1.06, p95 2.06, p99 5.90, 5.3% of the gamma over 2) — weighted and plain, the percentiles and the
      share over 1, 2, 3 and 5 points, the whole night and by hour;
    · THE CELLS THE CUTOFF MARKS: the field modeled at each overnight minute the forward priced (the page's own model,
      data/feed/trailModel.ts), and the share of its cells with half their gamma or more on vols solved from a quote
      wider than 2 points (`wideShare` ≥ 0.5 — the soft edge, gexNodesPrimitive staleOf), by count and by gross gamma,
      the whole night and by hour; and how the share moves were the cutoff 1, 3 or 5 points.
==================================================
*/
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blackScholesGreeks } from '../src/core/greeks';
import { fieldSessionAt } from '../src/core/sessions';
import { WIDE_VOL } from '../src/data/feed/forward';
import { endOf, modelColumn, parseOcc, universeOf, uwYears, UW_VOL_CONVENTION, type ChainRow, type ServerInputs } from '../src/data/feed/trailModel';

const args = process.argv.slice(2);
const root = process.env.FIELD_ROOT ?? join('.feed-cache', 'field');
const dirOf = (day: string) => join(root, 'SPX', day);
const readLines = <T>(file: string): T[] => {
  if (!existsSync(file)) return [];
  const out: T[] = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    try {
      out.push(JSON.parse(line) as T);
    } catch {
      /* a line cut short */
    }
  }
  return out;
};
const readJson = <T>(file: string): T | null => {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
};
interface Chain {
  receivedAt: number;
  rows: ChainRow[];
  src?: string;
}
interface Fwd {
  receivedAt: number;
  spot: number;
  forward: number;
  at: number;
}
const isNight = (ms: number) => fieldSessionAt('SPX', ms)?.session === 'gth';
const nightReads = (day: string) => readLines<Chain>(join(dirOf(day), 'chain.jsonl')).filter(c => c.src === 'theta' && isNight(c.receivedAt));

const days = existsSync(join(root, 'SPX'))
  ? readdirSync(join(root, 'SPX'))
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()
  : [];
const withNights = days.filter(d => nightReads(d).length > 0);
const asked = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
const pick = args.includes('--all') ? withNights : asked ? [asked] : withNights.slice(0, 1);
if (!pick.length) {
  console.log(`No SPX night recorded under ${join(root, 'SPX')}: the recorder writes one once it runs through 8:15 pm–9:25 am New York with Theta's terminal signed in on this machine (the SPX overnight field, docs/spx-overnight/README.md).`);
  process.exit(0);
}

const nyHour = (ms: number) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: 'numeric' }).format(new Date(ms)));
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? ' am' : ' pm'} New York`;
const pts = (v: number) => (Number.isFinite(v) ? (v * 100).toFixed(2) : '—');
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—');

interface W {
  w: number;
  g: number;
  hour: number;
}
const quantile = (xs: readonly W[], p: number, weighted: boolean): number => {
  const s = [...xs].sort((a, b) => a.w - b.w);
  const tot = s.reduce((a, x) => a + (weighted ? x.g : 1), 0);
  let acc = 0;
  for (const x of s) {
    acc += weighted ? x.g : 1;
    if (acc >= p * tot) return x.w;
  }
  return NaN;
};
const over = (xs: readonly W[], thr: number) => {
  const tot = xs.reduce((a, x) => a + x.g, 0);
  return tot > 0 ? xs.filter(x => x.w > thr).reduce((a, x) => a + x.g, 0) / tot : NaN;
};

for (const day of pick) {
  const dir = dirOf(day);
  const reads = nightReads(day);
  const allChains = readLines<Chain>(join(dir, 'chain.jsonl'));
  const fwd = readLines<Fwd>(join(dir, 'fwd.jsonl')).filter(f => isNight(f.receivedAt)).sort((a, b) => a.receivedAt - b.receivedAt);
  const seed = readJson<ServerInputs['seed']>(join(dir, 'seed.json'));
  const spotAt = (ms: number) => {
    let s: number | null = null;
    for (const f of fwd) if (f.receivedAt <= ms) s = f.spot;
    return s ?? fwd[0]?.spot ?? null;
  };

  /* ---- the widths --------------------------------------------------------------------------------------------- */
  const ws: W[] = [];
  let quotes = 0;
  for (const read of reads) {
    const S = spotAt(read.receivedAt);
    if (S == null) continue;
    for (const r of read.rows) {
      const width = r[7];
      const iv = r[2];
      const p = parseOcc(r[0]);
      if (!p || width == null || !Number.isFinite(width) || iv == null || !(iv > 0)) continue;
      quotes++;
      if (Math.abs(p.strike - S) > S * 0.05) continue;
      const t = uwYears(read.receivedAt, endOf(p.root, p.expiry), p.expiry, day);
      if (!(t > 0)) continue;
      const g = blackScholesGreeks(S, p.strike, t, iv, UW_VOL_CONVENTION.r, 0).gamma * Math.max(1, r[1] ?? 0);
      ws.push({ w: width, g, hour: nyHour(read.receivedAt) });
    }
  }
  const hours = [...new Set(ws.map(x => x.hour))].sort((a, b) => ((a + 12) % 24) - ((b + 12) % 24));
  const widthRow = (label: string, xs: readonly W[]) =>
    `| ${label} | ${xs.length.toLocaleString()} | ${pts(quantile(xs, 0.5, true))} | ${pts(quantile(xs, 0.9, true))} | ${pts(quantile(xs, 0.95, true))} | ${pts(quantile(xs, 0.99, true))} | ${pts(quantile(xs, 0.5, false))} | ${pts(quantile(xs, 0.95, false))} | ${pct(over(xs, 0.01), 1)} | ${pct(over(xs, 0.02), 1)} | ${pct(over(xs, 0.03), 1)} | ${pct(over(xs, 0.05), 1)} |`;

  /* ---- the cells the cutoff marks --------------------------------------------------------------------------------- */
  const inputs: ServerInputs = { chains: allChains.map(c => ({ receivedAt: c.receivedAt, rows: c.rows })), seed: seed ?? null, total: null } as ServerInputs;
  /* the cutoff moved: the same rows with the eighth figure read against another threshold (WIDE_VOL is the model's) */
  const at = (thr: number): ServerInputs =>
    thr === WIDE_VOL ? inputs : ({ ...inputs, chains: inputs.chains.map(c => ({ ...c, rows: c.rows.map(r => (r[7] == null ? r : ([r[0], r[1], r[2], r[3], r[4], r[5], r[6], (r[7] as number) > thr ? WIDE_VOL * 10 : 0] as ChainRow))) })) } as ServerInputs);
  const minutes = [...new Set(fwd.map(f => Math.floor(f.receivedAt / 60_000) * 60))];
  const cellsBy = (thr: number) => {
    const u = universeOf('SPX', day, at(thr));
    const out = { cells: 0, wide: 0, gross: 0, wideGross: 0, byHour: new Map<number, { cells: number; wide: number; gross: number; wideGross: number }>() };
    for (const m of minutes) {
      const S = spotAt(m * 1000 + 59_000);
      if (S == null) continue;
      const snap = modelColumn(u, { time: m, close: S });
      const h = nyHour(m * 1000);
      const hb = out.byHour.get(h) ?? { cells: 0, wide: 0, gross: 0, wideGross: 0 };
      for (const l of snap.levels) {
        const g = l.gross ?? Math.abs(l.value);
        const wide = (l.wideShare ?? 0) >= 0.5;
        out.cells++;
        out.gross += g;
        hb.cells++;
        hb.gross += g;
        if (wide) {
          out.wide++;
          out.wideGross += g;
          hb.wide++;
          hb.wideGross += g;
        }
      }
      out.byHour.set(h, hb);
    }
    return out;
  };
  const at2 = cellsBy(WIDE_VOL);
  const alt = [0.01, 0.03, 0.05].map(t => [t, cellsBy(t)] as const);

  const lines: string[] = [];
  lines.push(`# SPX's night before ${day} — quote widths and the cells the 2-point cutoff marks`, '');
  lines.push(`From the recorder's files on this machine (${dir}): ${reads.length} overnight chain reads through Theta's terminal (${quotes.toLocaleString()} quotes solved), ${fwd.length} forwards, ${minutes.length} minutes modeled. A quote's width is (ask − bid) ÷ vega, in vol points; "within 5%" of the forward's spot at the read.`, '');
  lines.push('## The widths', '');
  lines.push('| quotes within 5% | count | p50 (γ×OI) | p90 | p95 | p99 | p50 (plain) | p95 (plain) | γ over 1 pt | over 2 | over 3 | over 5 |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  lines.push(widthRow('the night', ws));
  for (const h of hours) lines.push(widthRow(hourLabel(h), ws.filter(x => x.hour === h)));
  lines.push('| reference: after the curb, 2026-10-14 (UW snapshot, the cutoff\'s basis) | 4,440 | 0.29 | 1.06 | 2.06 | 5.90 | — | — | 11.7% | 5.3% | 3.0% | — |', '');
  lines.push('## The cells the cutoff marks (wideShare ≥ 0.5 — the soft edge)', '');
  lines.push('| | cells | marked | share of cells | share of gross gamma |', '|---|---|---|---|---|');
  lines.push(`| the night, 2-point cutoff | ${at2.cells.toLocaleString()} | ${at2.wide.toLocaleString()} | ${pct(at2.wide, at2.cells)} | ${pct(at2.wideGross, at2.gross)} |`);
  for (const h of hours) {
    const b = at2.byHour.get(h);
    if (b) lines.push(`| ${hourLabel(h)} | ${b.cells.toLocaleString()} | ${b.wide.toLocaleString()} | ${pct(b.wide, b.cells)} | ${pct(b.wideGross, b.gross)} |`);
  }
  for (const [t, c] of alt) lines.push(`| were the cutoff ${t * 100} points | ${c.cells.toLocaleString()} | ${c.wide.toLocaleString()} | ${pct(c.wide, c.cells)} | ${pct(c.wideGross, c.gross)} |`);
  lines.push('');
  const text = lines.join('\n');
  console.log(text);
  const out = join('docs', 'spx-overnight', day);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'widths.md'), text + '\n');
  writeFileSync(
    join(out, 'widths.json'),
    JSON.stringify({
      day,
      reads: reads.length,
      quotes,
      forwards: fwd.length,
      minutes: minutes.length,
      widths: { count: ws.length, weighted: [0.5, 0.9, 0.95, 0.99].map(p => quantile(ws, p, true)), plain: [0.5, 0.9, 0.95, 0.99].map(p => quantile(ws, p, false)), over: [0.01, 0.02, 0.03, 0.05].map(t => over(ws, t)) },
      cells: { cutoff: WIDE_VOL, cells: at2.cells, marked: at2.wide, grossShare: at2.gross > 0 ? at2.wideGross / at2.gross : null, byHour: Object.fromEntries([...at2.byHour].map(([h, b]) => [h, b])), alt: Object.fromEntries(alt.map(([t, c]) => [t, { cells: c.cells, marked: c.wide, grossShare: c.gross > 0 ? c.wideGross / c.gross : null }])) },
    })
  );
  console.log(`written: ${join(out, 'widths.md')}`);
}
