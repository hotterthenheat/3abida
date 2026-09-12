// What does the Weigher's 3s SWEEP cost in compute, headless? The chain
// (±depth strikes, two contracts each) and the scanner, mean of 10.
//   npx tsx scripts/probe-sweep-cost.ts
import { buildDeskChain, buildScan } from '../src/data/weigherDesk';

const time = (label: string, fn: () => unknown) => {
  fn();
  const t0 = performance.now();
  for (let i = 0; i < 10; i++) fn();
  console.log(`${label.padEnd(40)} ${((performance.now() - t0) / 10).toFixed(1).padStart(7)} ms`);
};
const chain = buildDeskChain('NVDA', 7, 150);
console.log(`chain rows: ${chain.rows.length}`);
time('buildDeskChain NVDA ±150 (301 rows)', () => buildDeskChain('NVDA', 7, 150));
time('buildDeskChain NVDA ±60', () => buildDeskChain('NVDA', 7, 60));
time("buildScan('gainers')", () => buildScan('gainers' as never, 'NVDA'));
