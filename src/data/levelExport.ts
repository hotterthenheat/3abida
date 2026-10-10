/*
==================================================
  SLAYER TERMINAL - TODAY'S LEVELS, TO TAKE AWAY
  (data/levelExport.ts)

  The ideas report's "copy today's levels" (2026-10-10):
  the day's walls, flip, supreme, gamma pin and max pain,
  off Pinpoint's one book (data/pinpointBook.ts profileOf,
  data/maxPain.ts), written three ways for another tool:

    Pine     a TradingView Pine v5 indicator — one price
             line a level, named, on the chart's own
             scale
    prices   a plain list, a level a line
    CSV      ticker, level, price, the moment it was read

  Each says when it was read (New York's clock) and what
  the dealer levels assume — a copied level carries its
  footing with it. Pure: the levels in, the text out.
==================================================
*/

import { nyClock, nyDay, nyIsoDate } from '../core/nyTime';
import { ASSUMPTION_WORDS } from './levelSureness';

export interface DayLevels {
  ticker: string;
  spot: number;
  callWall: number | null;
  putWall: number | null;
  flip: number | null;
  supreme: number | null;
  pin: number | null;
  maxPain: number | null;
  /** When the book was read, epoch ms */
  at: number;
}

export type LevelFormat = 'pine' | 'prices' | 'csv';

interface Named {
  key: string;
  name: string;
  price: number;
}

const fmt = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const real = (v: number | null): v is number => v != null && Number.isFinite(v) && v > 0;

/** The levels that are there, top of the book down */
export function namedLevels(l: DayLevels): Named[] {
  const all: [string, string, number | null][] = [
    ['call_wall', 'Call wall', l.callWall],
    ['put_wall', 'Put wall', l.putWall],
    ['flip', 'Flip', l.flip],
    ['supreme', 'Supreme', l.supreme],
    ['gamma_pin', 'Gamma pin', l.pin],
    ['max_pain', 'Max pain', l.maxPain],
  ];
  return all.filter((x): x is [string, string, number] => real(x[2])).map(([key, name, price]) => ({ key, name, price })).sort((a, b) => b.price - a.price);
}

const when = (at: number) => `${nyDay(at)}, ${nyClock(at, { zone: true })}`;

/** Pine's own string, quotes and backslashes escaped */
const pineStr = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/* THE PINE SCRIPT: hline() a level — a horizontal price line with its name, drawn on whatever the chart shows, so it is
   put on the name it was read for. The supreme wears magenta as it does here; the flip is dashed, max pain dotted (it is
   marked, never a pull). */
const PINE_STYLE: Record<string, { color: string; style: string; width: number }> = {
  call_wall: { color: 'color.new(color.gray, 0)', style: 'hline.style_solid', width: 2 },
  put_wall: { color: 'color.new(color.gray, 0)', style: 'hline.style_solid', width: 2 },
  flip: { color: 'color.new(color.silver, 0)', style: 'hline.style_dashed', width: 1 },
  supreme: { color: 'color.new(color.fuchsia, 0)', style: 'hline.style_solid', width: 2 },
  gamma_pin: { color: 'color.new(color.gray, 30)', style: 'hline.style_dashed', width: 1 },
  max_pain: { color: 'color.new(color.gray, 30)', style: 'hline.style_dotted', width: 1 },
};

export function pineScript(l: DayLevels): string {
  const levels = namedLevels(l);
  const lines = [
    '//@version=5',
    `// ${l.ticker} levels from Slayer, read ${when(l.at)} — spot ${fmt(l.spot)}.`,
    `// The dealer levels ${ASSUMPTION_WORDS.replace(/^Assumes/, 'assume')}`,
    '// Max pain is arithmetic on open interest, marked, not a target. Put this on a chart of ' + l.ticker + '.',
    `indicator(${pineStr(`Slayer · ${l.ticker} · ${nyDay(l.at)}`)}, overlay = true)`,
    '',
    ...levels.map(v => {
      const s = PINE_STYLE[v.key];
      return `hline(${fmt(v.price)}, ${pineStr(`${v.name} ${fmt(v.price)}`)}, color = ${s.color}, linestyle = ${s.style}, linewidth = ${s.width})`;
    }),
  ];
  return lines.join('\n') + '\n';
}

export function priceList(l: DayLevels): string {
  return [`${l.ticker} levels · ${when(l.at)} · spot ${fmt(l.spot)}`, ...namedLevels(l).map(v => `${v.name} ${fmt(v.price)}`)].join('\n') + '\n';
}

/** "2026-10-10T14:32:00 New York" as an ISO date and clock — the moment the book was read */
const isoNy = (at: number) => `${nyIsoDate(at)}T${nyClock(at, { seconds: true })}`;

export function levelsCsv(l: DayLevels): string {
  const stamp = isoNy(l.at);
  return ['ticker,level,price,read_at_new_york', ...namedLevels(l).map(v => `${l.ticker},${v.key},${fmt(v.price)},${stamp}`)].join('\n') + '\n';
}

export const LEVEL_FORMATS: { value: LevelFormat; label: string; as: string; hint: string; make: (l: DayLevels) => string }[] = [
  { value: 'pine', label: 'Pine script', as: 'a Pine script', hint: 'A TradingView Pine v5 indicator — a price line a level', make: pineScript },
  { value: 'prices', label: 'Price list', as: 'a price list', hint: 'A level a line — for a note, a chat or another chart', make: priceList },
  { value: 'csv', label: 'CSV', as: 'CSV', hint: 'Ticker, level, price and when it was read — for a sheet', make: levelsCsv },
];

/** Put text on the clipboard — the browser's own, else the old copy command; false when neither could */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* refused (no focus, no permission) — the old way below */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
