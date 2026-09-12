// What does the minute turn COST? Times the generators cold (a fresh minute —
// every cache misses) and warm (same minute — every cache hits), headless.
//   npx tsx scripts/probe-minute-cost.ts
import { withEngineClock } from '../src/core/clock';
import Simulator from '../src/core/simulator';
import { buildFlowBook, buildFlowAlerts, buildSpreadFlow, buildNetFlowView } from '../src/data/flowBook';

const quotes = Simulator.universeQuotes('SPY');
const at = (min: number) => {
  const d = new Date();
  d.setHours(12, min, 0, 0);
  return d;
};
const time = (label: string, fn: () => unknown) => {
  const t0 = performance.now();
  fn();
  console.log(`${label.padEnd(34)} ${(performance.now() - t0).toFixed(1).padStart(7)} ms`);
};

const start = new Date();
start.setHours(9, 30, 0, 0);
const times = Array.from({ length: 390 }, (_, i) => Math.floor(start.getTime() / 1000) + i * 60);

for (const [minute, tag] of [
  [1, 'COLD minute 1'],
  [1, 'WARM minute 1'],
  [2, 'COLD minute 2'],
] as const) {
  console.log(`— ${tag} —`);
  withEngineClock(at(minute), () => {
    let book: ReturnType<typeof buildFlowBook> = [];
    time('buildFlowBook', () => (book = buildFlowBook(quotes)));
    time('buildFlowAlerts', () => buildFlowAlerts(book, []));
    time('buildSpreadFlow (multi-leg)', () => buildSpreadFlow(quotes));
    time('buildNetFlowView (0DTE all)', () => buildNetFlowView(book, 'all', 'all', times, 1));
  });
}
