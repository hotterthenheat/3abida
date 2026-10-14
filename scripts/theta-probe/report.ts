/*
  THE REPORT: one table (probe id, exact URL, HTTP status, error text, rows, bytes, seconds, first/last date found, one
  line of conclusion), the notes under it, then the short list the owner asked for — the confirmed start dates per
  ticker and piece, the rate entitlement, the chain-day sizing, the clock mapping, T12's result — written to a file
  after every probe, so a run cut short leaves what it learned.
*/
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findings, fmtBytes, log, notes, report, type ProbeRow } from './lib';
import type { Ctx } from './ctx';

const ORDER = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'U1', 'U2', 'U3', 'U4', 'X1', 'X2', 'X3'];
const groupOf = (id: string): string => /^(T1[0-2]|T\d|U\d|X\d)/.exec(id)?.[1] ?? id;
const esc = (s: string | number): string => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const cell = (v: string | number): string => (typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString('en-US') : v.toFixed(1)) : esc(v));

function table(rows: ProbeRow[]): string {
  const sorted = [...rows].sort((a, b) => ORDER.indexOf(groupOf(a.id)) - ORDER.indexOf(groupOf(b.id)) || a.id.localeCompare(b.id));
  const head = '| Probe | URL | HTTP | Error | Rows | Bytes | Seconds | First | Last | Conclusion |\n|---|---|---|---|---|---|---|---|---|---|';
  const body = sorted.map(r => `| ${r.id} | \`${esc(r.url)}\` | ${cell(r.status)} | ${esc(r.error)} | ${cell(r.rows)} | ${typeof r.bytes === 'number' ? fmtBytes(r.bytes) : esc(r.bytes)} | ${cell(r.seconds)} | ${esc(r.first)} | ${esc(r.last)} | ${esc(r.conclusion)} |`);
  return [head, ...body].join('\n');
}

export function summary(ctx: Ctx): string {
  const g = (k: string) => findings[k] ?? '—';
  const lines = [
    `- **Terminal**: MDDS ${g('mdds')}; subscriptions ${g('subscriptions')}.`,
    `- **Entitlement**: options second-order greeks ${g('optionsPro')}; stock flat file ${g('stocksPro')}; index flat file ${g('indicesPro')}.`,
    `- **Rates**: SOFR ${g('rateSofr')}; TREASURY_M3 ${g('rateTreasury')}.`,
    `- **Start dates, stocks**: SPY trades from ${g('SPY.stockFirstTrade')} (quotes ${g('SPY.stockFirstQuote')}); QQQ trades from ${g('QQQ.stockFirstTrade')} (quotes ${g('QQQ.stockFirstQuote')}). Venue: ${g('venue')}.`,
    `- **Start dates, index**: SPX from ${g('SPX.indexFirst')}.`,
    `- **Start dates, options**: SPY expirations from ${g('SPY.firstExpiration')}, quoted from ${g('SPY.firstQuoteDate')}; QQQ ${g('QQQ.firstExpiration')} / ${g('QQQ.firstQuoteDate')}; SPX ${g('SPX.firstExpiration')} / ${g('SPX.firstQuoteDate')}; SPXW ${g('SPXW.firstExpiration')} / ${g('SPXW.firstQuoteDate')}. Contracts quoting 2012-06-01: ${g('contracts20120601')}. SPXW on Tuesday 2019-06-04: ${g('spxwTuesday2019')}.`,
    `- **Chain-day sizing (1m quotes, 09:30–16:15)**: ${['T7a', 'T7b', 'T7c', 'T7d'].map(k => g(`chainDay.${k}`)).join('; ')}. SPXW under symbol=SPX: ${g('spxwUnderSpx')}.`,
    `- **Open interest**: ${g('oi.T8a')}; ${g('oi.T8b')}.`,
    `- **IV history**: ${['T9a', 'T9b', 'T9c', 'T9d', 'T9e'].map(k => g(`iv.${k}`)).join('; ')}.`,
    `- **Limits**: bursts of 8 / 24 / 30 → ${g('burst.8')} / ${g('burst.24')} / ${g('burst.30')}; a 1m range over a month → ${g('overMonth')}; multi-year EOD → ${g('multiYearEod')}.`,
    `- **Parity (T11)**: ${g('parity')}.`,
    `- **The bead field from Theta's inputs (T12)**: ${g('t12')}.`,
    `- **UW**: limits ${g('uwLimits')}; the earliest tape date E ${g('uwEarliest')}; SPX labels on the tape: ${g('tapeSpxLabels')}; option_symbol prefixes on SPX: ${g('spxOptionSymbolPrefixes')}.`,
    `- **Clock mapping (U4)**: Theta's 1m quote row stamped T is ${g('quoteStamp')}; an OHLC bar: ${g('ohlcStamp')}; Terrain's label: ${g('terrainLabel')}.`,
    `- **Item 4a**: Theta's SPX against the tape (X1): ${g('spxThetaVsTape')}. Real time (X2): ${g('spxRealtime')}.`,
    `- **Item 4b**: the 10:00 am straddle (X3): ${g('straddle1000')}.`,
  ];
  if (ctx.skipped.length) lines.push(`- **Not run**: ${ctx.skipped.join('; ')}.`);
  return lines.join('\n');
}

export function writeReport(dir: string, ctx: Ctx, meta: { startedAt: string; probes: string; base: string; done: boolean }): void {
  mkdirSync(dir, { recursive: true });
  const md = [
    `# Theta Data probe — Phase 0 (${meta.startedAt})`,
    '',
    `Run on the owner's machine against the terminal at \`${meta.base}\` (never started by the script). Probes: ${meta.probes}. ${meta.done ? 'Complete.' : '**Still running or cut short** — the rows below are what had come in.'}`,
    '',
    '## The table',
    '',
    table(report),
    '',
    '## Notes',
    '',
    ...notes.map(n => `- **${n.id}** ${n.text}`),
    '',
    '## The short list',
    '',
    summary(ctx),
    '',
    '## Log',
    '',
    '```',
    ...log,
    '```',
    '',
  ].join('\n');
  writeFileSync(join(dir, 'report.md'), md);
  writeFileSync(join(dir, 'results.json'), JSON.stringify({ meta, rows: report, notes, findings, skipped: ctx.skipped }, null, 1));
}
