/*
  THE STORE'S TOLERANCE (2026-10-13 — the owner: "Shown vs final is checked to a tolerance: median ≤1%, p90 ≤5%, walls
  and flip equal in ≥95% of columns, on gap-free recorder days"), ONE function for the agree script (scripts/
  field-agree.ts) and the Theta rebuild (server/thetaRebuild.ts — the owner, section C, 2026-10-14: "Where a
  live-recorded day exists, the rebuild must match it (same tolerance as before) before older days are trusted").
*/
import type { StoreRow } from './fieldStore';

const med = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const pct = (a: number[], p: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN;
};
const f1 = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : 'n/a');
const sameFlip = (a: number | null, b: number | null) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) <= 0.25);

/** The owner's tolerance, judged on the minutes both rows hold */
export function tolerance(shown: StoreRow[], final: StoreRow[]): { judged: boolean; pass: boolean; lines: string[] } {
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

