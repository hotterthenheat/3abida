/*
==================================================
  SLAYER TERMINAL - THE REBUILD FROM THETA'S HISTORY (the CLI)
  (scripts/theta-rebuild.ts — `npm run theta:rebuild -- SPY QQQ [--days N] [--again]`)

  2026-10-14 — the owner, section C3: "Rebuild newest first, using the probe's answers on 4a and 4b. Store per
  minute beside the field: spread, top-of-book size, minute volume, VIX, ATM IV. Where a live-recorded day exists,
  the rebuild must match it (same tolerance as before) before older days are trusted."

  Runs on the always-on machine over the downloader's rows (HISTORY_ROOT, .feed-cache/history) and writes the
  rebuilt days beside the field (.feed-cache/field/<NAME>/<D>/theta-final.jsonl, theta-extras.jsonl,
  theta-build.json; the verdicts in <NAME>/theta-trust.json). It asks nothing of any server: no Theta Terminal is
  started or signed in, no call leaves the machine. The choices the probe decides (4a the SPX source, 4b the quote
  clock, and the rate) are THETA_REBUILD in server/thetaRebuild.ts — set them from docs/theta-probe's report, and the
  version with them: a changed version rebuilds every day on the next run.
==================================================
*/
import { existsSync, readFileSync } from 'node:fs';
import { rebuildTheta, THETA_REBUILD, type ThetaRebuildConfig } from '../server/thetaRebuild';

const env: Record<string, string | undefined> = { ...process.env };
if (existsSync('.env'))
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }

const args = process.argv.slice(2);
const names: string[] = [];
let maxDays = 0;
let again = false;
let quoteClock: ThetaRebuildConfig['quoteClock'] | null = null;
let spxSource: ThetaRebuildConfig['spxSource'] | null = null;
let rate: ThetaRebuildConfig['rate'] | null = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--days') maxDays = Math.max(0, Number(args[++i]) || 0);
  else if (a === '--again') again = true;
  else if (a === '--quote-clock') quoteClock = args[++i] === 'at-stamp' ? 'at-stamp' : 'last-in-interval';
  else if (a === '--spx') spxSource = args[++i] === 'tape' ? 'tape' : 'theta';
  else if (a === '--rate') rate = args[++i] === 'uw' ? 'uw' : 'dtb3';
  else if (a === '--help' || a === '-h') {
    console.log('npm run theta:rebuild -- SPY QQQ SPX [--days N] [--again] [--quote-clock last-in-interval|at-stamp] [--spx theta|tape] [--rate dtb3|uw]');
    process.exit(0);
  } else if (/^[A-Z]{1,6}$/.test(a)) names.push(a);
  else {
    console.error(`unknown argument ${a}`);
    process.exit(2);
  }
}
if (!names.length) names.push(...(env.HISTORY_CHAIN_ROOTS ?? 'SPY,QQQ,SPX').split(',').map(s => s.trim().toUpperCase()).filter(s => s && s !== 'SPXW'));

/* a flag overrides the file's choice for this run only, and the version says so, so its days stand apart */
const cfg: ThetaRebuildConfig = { ...THETA_REBUILD };
const overrides: string[] = [];
if (quoteClock && quoteClock !== cfg.quoteClock) (cfg.quoteClock = quoteClock), overrides.push(`quote-clock=${quoteClock}`);
if (spxSource && spxSource !== cfg.spxSource) (cfg.spxSource = spxSource), overrides.push(`spx=${spxSource}`);
if (rate && rate !== cfg.rate) (cfg.rate = rate), overrides.push(`rate=${rate}`);
if (overrides.length) cfg.version = `${cfg.version}+${overrides.join('+')}`;

const histRoot = env.HISTORY_ROOT || '.feed-cache/history';
const fieldRoot = env.FIELD_ROOT || '.feed-cache/field';
if (!existsSync(histRoot)) {
  console.error(`no history at ${histRoot} — run npm run theta:history first (HISTORY_ROOT names another folder)`);
  process.exit(1);
}
const stamp = () => new Date().toISOString().slice(11, 19);
console.log(`theta rebuild ${cfg.version}: ${names.join(', ')} from ${histRoot} into ${fieldRoot}${maxDays ? `, ${maxDays} days a name` : ''}${again ? ', built again' : ''} — quote clock ${cfg.quoteClock}, SPX ${cfg.spxSource}, rate ${cfg.rate}`);
const t0 = Date.now();
const trust = await rebuildTheta({ histRoot, fieldRoot, names, maxDays, cfg, again, log: l => console.log(`${stamp()}  ${l}`) });
let stopped = 0;
for (const [name, t] of Object.entries(trust)) {
  if (t.stoppedAt) stopped++;
  console.log(`${name}: reached ${t.reached ?? '—'} · ${t.checked.filter(c => c.pass).length} of ${t.checked.length} recorder days pass · ${t.trusted ? 'trusted' : `STOPPED at ${t.stoppedAt?.day}: ${t.stoppedAt?.why}`}`);
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
if (stopped) process.exit(3);
