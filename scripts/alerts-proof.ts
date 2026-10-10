/*
  Acceptance test for the alerts on drawn lines and the AND across conditions (2026-10-10). Runs the ACTUAL store's pure
  rules — gex/alertStore.ts evaluateLine, evaluateAll, condHolds, lineAt — no browser, no chart.

  Proves:
  1. A line alert reads its side first and never fires on that first read
  2. Touch fires when the live price reaches the line from its side, and not before
  3. Break needs a CLOSED bar beyond the line — a wick through it is not a break
  4. Bounce fires on a bar that reaches the line and closes back; a close beyond turns its side over
  5. A bar before the alert was set, or the bar it fired on, never fires it
  6. A sloped line is read on the bars, and runs on past its second anchor
  7. An AND reads where it starts, fires only when its conditions COME together, and re-arms when they part
  8. A condition that cannot be read holds the AND back; it never guesses
  9. Each condition kind reads the house's way (dealers' sign, net flow, levels, averages, RSI)
*/
import { condHolds, evaluateAll, evaluateLine, lineAt, type AllAlert, type AllContext, type LineAlert, type LineBar } from '../src/components/gex/alertStore';

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  ok ? pass++ : fail++;
};

const NOW = 1_700_000_000_000;
/** One-minute bars from a list of [high, low, close] */
const barsOf = (rows: [number, number, number][], t0 = 1_000_000): LineBar[] => rows.map(([high, low, close], i) => ({ time: t0 + i * 60, high, low, close }));

const line = (over: Partial<LineAlert> = {}): LineAlert => ({
  id: 'a',
  kind: 'line',
  drawingId: 'd',
  shape: 'flat',
  p1: { time: 1_000_000, price: 100 },
  mode: 'touch',
  tf: '1m',
  side: 0,
  armedBar: 0,
  lastBar: 0,
  firedAt: 0,
  ...over,
});

// 1. the first read sets the side, and does not fire
{
  const bars = barsOf([[99, 98, 98.5], [99.2, 98.4, 99]]);
  const v = evaluateLine(line(), bars, 99, NOW);
  check('the first read sets the side below the line, no firing', !v.fire && v.armed?.kind === 'line' && v.armed.side === -1 && v.armed.armedBar === bars[1].time);
}

// 2. touch
{
  const bars = barsOf([[99, 98, 98.5], [99.6, 98.4, 99.5]]);
  const a = line({ side: -1, armedBar: bars[1].time });
  check('touch waits while price stays under the line', !evaluateLine(a, bars, 99.5, NOW).fire);
  const v = evaluateLine(a, bars, 100.02, NOW);
  check('touch fires when the live price reaches it', v.fire && v.bar === bars[1].time);
  check('touch never fires twice on one bar', !evaluateLine({ ...a, lastBar: bars[1].time }, bars, 100.02, NOW).fire);
}

// 3. break
{
  const armedBar = 1_000_060;
  const wick = barsOf([[99, 98, 98.5], [100.8, 98.9, 99.6], [99.8, 99.4, 99.7]]);
  const a = line({ mode: 'break', side: -1, armedBar });
  check('a wick through the line is not a break', !evaluateLine(a, wick, 99.7, NOW).fire);
  const closed = barsOf([[99, 98, 98.5], [100.8, 98.9, 100.4], [100.6, 100.2, 100.5]]);
  const v = evaluateLine(a, closed, 100.5, NOW);
  check('a closed bar beyond the line is a break', v.fire && v.bar === closed[1].time);
  const live = barsOf([[99, 98, 98.5], [99.5, 98.9, 99.2], [101, 99.4, 100.9]]);
  check('the bar still forming does not count', !evaluateLine(a, live, 100.9, NOW).fire);
}

// 4. bounce
{
  const armedBar = 1_000_060;
  const a = line({ mode: 'bounce', side: 1, armedBar });
  const bounced = barsOf([[101, 100.5, 100.8], [100.9, 99.9, 100.6], [100.9, 100.5, 100.7]]);
  check('a bar that reaches the line from above and closes back above is a bounce', evaluateLine(a, bounced, 100.7, NOW).fire);
  const broke = barsOf([[101, 100.5, 100.8], [100.7, 99.5, 99.6], [99.8, 99.4, 99.7]]);
  const v = evaluateLine(a, broke, 99.7, NOW);
  check('a close beyond is no bounce, and turns the side over', !v.fire && v.armed?.kind === 'line' && v.armed.side === -1);
  const away = barsOf([[101, 100.5, 100.8], [101.5, 100.9, 101.2], [101.4, 101, 101.3]]);
  check('a bar that never reaches the line is no bounce', !evaluateLine(a, away, 101.3, NOW).fire);
}

// 5. before arming
{
  const bars = barsOf([[99, 98, 98.5], [100.8, 98.9, 100.4], [100.6, 100.2, 100.5]]);
  const a = line({ mode: 'break', side: -1, armedBar: bars[2].time });
  check('a bar before the alert was set never fires it', !evaluateLine(a, bars, 100.5, NOW).fire);
}

// 6. a sloped line
{
  const bars = barsOf(Array.from({ length: 10 }, (_, i) => [100 + i + 0.2, 100 + i - 0.2, 100 + i] as [number, number, number]));
  const a = { shape: 'sloped' as const, p1: { time: bars[0].time, price: 100 }, p2: { time: bars[4].time, price: 104 } };
  check('a sloped line is read on the bars', Math.abs(lineAt(a, bars, 2) - 102) < 1e-9);
  check('…and runs on past its second anchor', Math.abs(lineAt(a, bars, 9) - 109) < 1e-9);
  check('…and past the last bar, at the bars’ own spacing', Math.abs(lineAt({ ...a, p2: { time: bars[9].time + 120, price: 111 } }, bars, 9) - 109) < 1e-9);
}

// 7–8. an AND
{
  const ctx = (close: number, flow: number): AllContext => ({
    close,
    levels: { callWall: 110, putWall: 90, flip: 100, supreme: 105 },
    netGex: -5e8,
    values: { '5m': { vwap: 99, rsi: 64 } },
    flowNet: { 15: flow },
  });
  const all: AllAlert = {
    id: 'b',
    kind: 'all',
    conds: [
      { t: 'level', op: 'above', level: 'flip' },
      { t: 'flow', op: 'bullish', mins: 15 },
    ],
    met: 0,
    firedAt: 0,
  };
  const first = evaluateAll(all, ctx(101, 2e6), NOW);
  check('an AND reads where it starts, no firing', !first.fire && first.armed?.kind === 'all' && first.armed.met === 1);
  check('…and does not fire while they stay together', !evaluateAll({ ...all, met: 1 }, ctx(101, 2e6), NOW).fire);
  const parted = evaluateAll({ ...all, met: 1 }, ctx(99, 2e6), NOW);
  check('…notes when they part', !parted.fire && parted.armed?.kind === 'all' && parted.armed.met === -1);
  check('…fires when they come together again', evaluateAll({ ...all, met: -1 }, ctx(101, 2e6), NOW).fire);
  check('…not with one of them still apart', !evaluateAll({ ...all, met: -1 }, ctx(101, -1e6), NOW).fire);
  const blind = { ...ctx(101, 2e6), levels: { callWall: 110, putWall: 90, flip: null, supreme: 105 } };
  check('a level that cannot be read holds the AND back', !evaluateAll({ ...all, met: -1 }, blind, NOW).fire && evaluateAll({ ...all, met: 0 }, blind, NOW).armed === undefined);
  check('a resting AND does nothing', !evaluateAll({ ...all, met: -1, quietUntil: NOW + 1000 }, ctx(101, 2e6), NOW).fire);
}

// 9. each condition, the house's way
{
  const c: AllContext = { close: 101, levels: { callWall: 110, putWall: 90, flip: 100, supreme: 105 }, netGex: -5e8, values: { '5m': { vwap: 99, rsi: 64 } }, flowNet: { 15: -3e5 } };
  check('price above a price', condHolds({ t: 'price', op: 'above', value: 100.5 }, c) === true);
  check('price below the call wall', condHolds({ t: 'level', op: 'below', level: 'callWall' }, c) === true);
  check('price above VWAP on 5m', condHolds({ t: 'average', op: 'above', source: 'vwap', tf: '5m' }, c) === true);
  check('an average on a timeframe not read is unknown', condHolds({ t: 'average', op: 'above', source: 'ema21', tf: '5m' }, c) === null);
  check('RSI below 70', condHolds({ t: 'rsi', op: 'below', value: 70, tf: '5m' }, c) === true);
  check('a call-heavy book (negative) is dealers absorbing', condHolds({ t: 'dealers', op: 'absorbing' }, c) === true && condHolds({ t: 'dealers', op: 'amplifying' }, c) === false);
  check('net flow bearish over 15 min', condHolds({ t: 'flow', op: 'bearish', mins: 15 }, c) === true && condHolds({ t: 'flow', op: 'bullish', mins: 15 }, c) === false);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
