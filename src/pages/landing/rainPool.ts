/*
  Content pool for the hero CodeRain — fake Slayer terminal output. OUR
  vocabulary: the engines, the states, the structure levels. Two quiet tints
  keyed by subject (struct = dealer/structure words, engine = engine/verdict
  words); everything else sits in neutral grays. Decoration-tier color — the
  semantic tokens (mint/lime/magenta) are deliberately NOT used here so the
  rain never impersonates live data.
*/

export type RainTint = 'struct' | 'engine' | 'bright' | '';

const BASE_POOL: string[] = [
  '> pulse --live SPY',
  'NET GEX +1.42bn · FLIP 498.50',
  'CALL WALL 505 · held 3x',
  'PUT WALL 490 · defended',
  'SUPREME 500 · 37% of book',
  'dealer hedge -212M/1%',
  'gamma regime: dampening',
  'vanna +86M per 1% IV',
  'charm drift into close',
  '> trace --tape',
  'SWEEP SPY 505C x1,240 ASK',
  'BLOCK QQQ 440P $2.1M MID',
  'DP $4.06B · 737.38',
  'dark pool: accumulating',
  'metaorder 62% complete',
  'fill @ ask · conviction 81',
  '> compass --scan weeklies',
  'SCREENS STRONG · conf 84%',
  'QUALIFIES · breakeven ±1.8%',
  'CONDITIONAL · theta 9.4%/day',
  'REJECTED · crush -44% overnight',
  'ACTIVE · TP1 hit +38%',
  'WATCH · testing floor 471.63',
  'FADING · structure broken',
  '> earnings GS',
  'expected ±15.2% · typical ±10.8%',
  'OVERPRICED 1.41x history',
  'beat rate 75% · 6 of 8',
  'IV crush -47% by open',
  'P(inside band) 66%',
  '> pinpoint --exposure',
  'GEX/DEX/VEX by strike',
  'positioning: calls stacked 505',
  'flip cross 2x today',
  'absorption 0.84 · PRESSURE',
  'replay 09:30 -> 16:00 · 4x',
  'wall drift: tightening',
  'p_touch 0.62 · edge +0.4R',
  'expectancy +0.31R · n=48',
  'RISK-ON · 11 up / 7 down',
  'half-life 6.5h · priced-in 58%',
  'book fades the headline',
  'sim -> live: same contract',
];

// Generated number-heavy lines — strikes, scores, prints — built once at load.
const TICKS = ['SPY', 'QQQ', 'NVDA', 'AAPL', 'TSLA', 'META', 'AMZN', 'GS', 'MSFT', 'AMD'];
const GENERATED_POOL: string[] = [];
for (let i = 0; i < 70; i++) {
  const t = TICKS[i % TICKS.length];
  const kind = i % 7;
  const px = 90 + ((i * 53) % 820);
  const pct = ((i * 37) % 190) / 10;
  const score = 40 + ((i * 29) % 59);
  if (kind === 0) GENERATED_POOL.push(`${t} ${px}C ${i % 3 === 0 ? '0DTE' : `${(i % 5) + 1}D`} · ${score}`);
  else if (kind === 1) GENERATED_POOL.push(`${t} ${px}P · ±${pct.toFixed(1)}% exp`);
  else if (kind === 2) GENERATED_POOL.push(`gex ${t} ${(i % 2 ? '+' : '-')}${(pct / 4).toFixed(2)}bn @ ${px}`);
  else if (kind === 3) GENERATED_POOL.push(`print ${t} $${(pct / 3).toFixed(1)}M ${i % 2 ? 'ASK' : 'BID'}`);
  else if (kind === 4) GENERATED_POOL.push(`oi ${px} · ${(1000 + i * 731) % 90000}`);
  else if (kind === 5) GENERATED_POOL.push(`iv ${t} ${(18 + (i % 40)).toFixed(0)}% · rank ${score}`);
  else GENERATED_POOL.push(`SCREENS ${score >= 68 ? 'STRONG' : score <= 46 ? 'WEAK' : 'MIXED'} · conf ${score}%`);
}

// Dedupe (case/space-insensitive) into the export
const seen = new Set<string>();
export const RAIN_POOL: string[] = [...BASE_POOL, ...GENERATED_POOL].filter(l => {
  const k = l.toLowerCase().replace(/\s+/g, ' ');
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

// Deliberately narrow — the field should be mostly quiet gray, with tinted
// lines landing like the occasional meaningful print, not a highlighter pass.
const STRUCT_RE = /\bgex\b|wall|flip|supreme|dealer|vanna|charm|gamma/i;
const ENGINE_RE = /compass|pulse|trace|pinpoint|screens|qualifies|rejected|expectancy|overpriced/i;
const BRIGHT_RE = /^>|sweep|block|dp \$|dark pool|metaorder/i;

export function tintFor(line: string): RainTint {
  if (BRIGHT_RE.test(line)) return 'bright'; // prompt lines stay prompt-colored
  if (STRUCT_RE.test(line)) return 'struct';
  if (ENGINE_RE.test(line)) return 'engine';
  return '';
}
