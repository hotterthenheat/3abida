/*
  Texture proof for the net-flow curve (Noah, 2026-08-30: "they are literally
  straight lines that look like a kid was drawing. no diversity... do they even
  match their cards").

  Runs the ACTUAL generator headless and measures the curve the way an eye
  does:
    turns      direction changes per 100 minutes of the net-call line — a
               ruler scores ~0, a tape scores dozens
    step tail  the biggest single-minute move ÷ the median move — prints land
               as steps, so a tape has a heavy tail; an interpolation has none
    flat       share of minutes that barely move (< 20% of the median) — real
               tapes have quiet stretches
    cards      the header figures MUST equal the line's last point
    build      milliseconds per view, mean of 20 — the tick budget
  Run:  npx tsx scripts/netflow-texture-proof.ts
*/
import Simulator from '../src/core/simulator';
import { buildFlowBook, buildNetFlowView } from '../src/data/flowBook';

const quotes = Simulator.universeQuotes('SPY');
if (!quotes || quotes.length === 0) {
  console.log('no universe quotes headless — cannot measure');
  process.exit(1);
}
const book = buildFlowBook(quotes);

// A session's worth of minutes, today, 09:30 → 16:00 local — the pane's own
// timeline shape, without needing the simulator's candles.
const start = new Date();
start.setHours(9, 30, 0, 0);
const times = Array.from({ length: 390 }, (_, i) => Math.floor(start.getTime() / 1000) + i * 60);

const measure = (label: string, run: () => ReturnType<typeof buildNetFlowView>) => {
  const t0 = performance.now();
  let view = run();
  for (let i = 1; i < 20; i++) view = run();
  const ms = (performance.now() - t0) / 20;
  const c = view.points.map(p => p.callPrem);
  const d = c.slice(1).map((v, i) => v - c[i]);
  let turns = 0;
  for (let i = 1; i < d.length; i++) if (Math.sign(d[i]) !== 0 && Math.sign(d[i]) !== Math.sign(d[i - 1]) && d[i - 1] !== 0) turns++;
  const abs = d.map(Math.abs).sort((a, b) => a - b);
  const median = abs[Math.floor(abs.length / 2)] || 1;
  const flat = abs.filter(x => x < 0.2 * median).length / abs.length;
  /* What the EYE measures. A curve can flip sign every minute and still read
     as a ruler if the flips are dust against the day's range, so:
       rough    path length ÷ net range — a straight monotone line is 1.0; a
                tape that gives ground and retakes it scores well above
       max step the biggest single-minute move as a share of the range — a
                print is a step you can see; an interpolation has none */
  const range = Math.max(...c) - Math.min(...c) || 1;
  const rough = abs.reduce((a, b) => a + b, 0) / range;
  const maxStep = (abs[abs.length - 1] / range) * 100;
  const last = view.points[view.points.length - 1];
  const cards = last.callPrem === view.ncp && last.putPrem === view.npp;
  const vols = view.points.map(p => p.vol).sort((a, b) => a - b);
  const volTail = vols[vols.length - 1] / (vols[Math.floor(vols.length / 2)] || 1);
  console.log(
    `${label.padEnd(22)} n ${String(view.count).padStart(4)} | turns/100 ${((turns / d.length) * 100).toFixed(0).padStart(3)} | rough ${rough
      .toFixed(2)
      .padStart(5)} | max step ${maxStep.toFixed(1).padStart(4)}% of range | flat ${(flat * 100).toFixed(0).padStart(3)}% | vol tail ×${volTail
      .toFixed(1)
      .padStart(5)} | cards ${cards ? 'match' : 'MISMATCH'} | build ${ms.toFixed(1)}ms`
  );
};

measure('0DTE everything', () => buildNetFlowView(book, 'all', 'all', times, 1));
measure('0DTE ATM', () => buildNetFlowView(book, 'all', 'atm', times, 1));
measure('Net Flow SPY (ticker)', () => buildNetFlowView(book, 'all', 'all', times, Infinity, 'SPY'));
measure('Net Flow NVDA (ticker)', () => buildNetFlowView(book, 'all', 'all', times, Infinity, 'NVDA'));
