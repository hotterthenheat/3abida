/*
==================================================
  SLAYER TERMINAL - HOW TO READ THE CALENDAR
  (components/gex/LedgerGuide.tsx)

  The card behind the Exposure Ledger's "How to
  read" door (Noah, 2026-09-06: "i love this, keep
  it in the design pattern style. i think the
  heatmap needs one as well"). Two figures drawn
  in the ledger's own hand — capsules in a grid,
  strikes down, expiry dates across, the supreme
  starred — and today's calendar read in plain
  words from the live numbers.
==================================================
*/

import { fmtUsd } from '../../data/gex';
import type { ExposureSurface, Greek } from '../../data/exposureSurface';

const INK = 'rgb(var(--text-primary))';
const INK_2 = 'rgb(var(--text-secondary))';
const INK_3 = 'rgb(var(--text-muted))';
const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const SUPREME = 'rgb(var(--supreme))';
const GRID = 'rgba(255,255,255,0.07)';
const COOL_1 = '#ABD9E9';
const COOL_2 = '#74ADD1';
const COOL_3 = '#4575B4';
const WARM_1 = '#FDAE61';
const WARM_2 = '#F46D43';
const WARM_3 = '#D73027';
const PALE = '#FFFFBF';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SANS = '-apple-system, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

const Cell = ({ x, y, w, fill, text, ink = '#0a0a0a', ring }: { x: number; y: number; w: number; fill: string; text?: string; ink?: string; ring?: string }) => (
  <g>
    <rect x={x} y={y - 6} width={w} height={12} rx={6} fill={fill} />
    {ring && <rect x={x - 1.5} y={y - 7.5} width={w + 3} height={15} rx={7.5} fill="none" stroke={ring} strokeWidth="1.25" />}
    {text && (
      <text x={x + w - 5} y={y + 0.5} textAnchor="end" dominantBaseline="middle" fontFamily={MONO} fontSize="8" fontWeight="600" fill={ink}>
        {text}
      </text>
    )}
  </g>
);

const Label = ({ x, y, children, anchor = 'start', fill = INK_2, size = 9.5, mono = false }: { x: number; y: number; children: string; anchor?: 'start' | 'middle' | 'end'; fill?: string; size?: number; mono?: boolean }) => (
  <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontFamily={mono ? MONO : SANS} fontSize={size} fill={fill}>
    {children}
  </text>
);

const COLS = [
  { x: 50, head: 'Sep 8 · today' },
  { x: 132, head: 'Sep 9' },
  { x: 214, head: 'Sep 11' },
  { x: 296, head: 'Sep 18' },
];
const CELL_W = 72;

/** FIGURE 1 — the grid: a strike per row, an expiry per column, the supreme starred */
const GridFigure = () => {
  const rows = [
    { y: 44, k: '496', cells: [[COOL_1, '$94M'], [COOL_1, '$81M'], [PALE, '$40M'], [PALE, '$22M']] },
    { y: 66, k: '495', wall: 'call', cells: [[COOL_3, '$256M', '#fff', true], [COOL_3, '$231M', '#fff'], [COOL_2, '$188M'], [COOL_2, '$150M']] },
    { y: 88, k: '494', cells: [[WARM_1, '$61M'], [PALE, '$38M'], [PALE, '$19M'], [PALE, '$9M']] },
    { y: 110, k: '493', wall: 'put', cells: [[WARM_3, '$131M', '#fff'], [WARM_2, '$104M'], [WARM_2, '$96M'], [WARM_1, '$70M']] },
  ] as { y: number; k: string; wall?: string; cells: (string | boolean)[][] }[];
  return (
    <svg viewBox="0 0 368 150" width="100%" role="img" aria-label="A grid of capsules: one strike per row, one expiry per column, the heaviest cell ringed in magenta with a star" data-guide-figure="grid">
      {/* Column heads — the dates, today first */}
      {COLS.map((c, i) => (
        <Label key={c.head} x={c.x + CELL_W / 2} y={18} anchor="middle" fill={i === 0 ? INK : INK_3} size={8.5} mono>
          {c.head}
        </Label>
      ))}
      <line x1={50} x2={368} y1={27.5} y2={27.5} stroke={GRID} />
      {rows.map(r => (
        <g key={r.k}>
          <Label x={40} y={r.y} anchor="end" fill={r.wall === 'put' ? SUPREME : r.wall === 'call' ? 'rgb(var(--bull))' : INK_2} size={9} mono>
            {r.k}
          </Label>
          {r.cells.map((c, i) => (
            <Cell key={i} x={COLS[i].x} y={r.y} w={CELL_W} fill={c[0] as string} text={c[1] as string} ink={(c[2] as string) ?? '#0a0a0a'} ring={c[3] ? SUPREME : undefined} />
          ))}
        </g>
      ))}
      {/* The heaviest cell's star, left of its strike; the supreme is the strike printed in magenta */}
      <text x={12} y={66.5} textAnchor="middle" dominantBaseline="middle" fontFamily={SANS} fontSize="9" fill={INK}>
        ★
      </text>
      {/* Spot, between the rows it sits between — the chip at the line's end */}
      <line x1={50} x2={322} y1={99.5} y2={99.5} stroke={INK} strokeOpacity="0.35" strokeDasharray="2 3" />
      <rect x={326} y={93.5} width={42} height={12} rx={3} fill={INK} />
      <Label x={347} y={99.5} anchor="middle" fill="#0a0a0a" size={8} mono>
        493.60
      </Label>
      <Label x={50} y={131} fill={INK_3} size={9}>
        one strike per row, one date per column · the figure is the hedging there
      </Label>
      <text x={50} y={144} dominantBaseline="middle" fontFamily={SANS} fontSize="9" fill={INK_2}>
        ★ the heaviest cell
      </text>
      <text x={138} y={144} dominantBaseline="middle" fontFamily={SANS} fontSize="9" fill={SUPREME}>
        magenta strike: the supreme
      </text>
      <Label x={250} y={144} fill={INK_3} size={9}>
        white line: the market now
      </Label>
    </svg>
  );
};

/** FIGURE 2 — read across, read down: what stays, what expires at the bell */
const ReadFigure = () => (
  <svg viewBox="0 0 368 150" width="100%" role="img" aria-label="The same grid: one row stays heavy across every column, another is heavy only today; the today column expires at the bell" data-guide-figure="read">
    {COLS.map((c, i) => (
      <Label key={c.head} x={c.x + CELL_W / 2} y={18} anchor="middle" fill={i === 0 ? INK : INK_3} size={8.5} mono>
        {c.head}
      </Label>
    ))}
    <line x1={50} x2={368} y1={27.5} y2={27.5} stroke={GRID} />
    {/* A wall that stays: heavy across the row */}
    <Label x={40} y={48} anchor="end" fill="#30D158" size={9} mono>
      495
    </Label>
    {COLS.map((c, i) => (
      <Cell key={`a${i}`} x={c.x} y={48} w={CELL_W} fill={COOL_3} text={['$256M', '$231M', '$188M', '$150M'][i]} ink="#fff" />
    ))}
    <path d={`M${COLS[3].x + CELL_W + 4} 41 h5 v14 h-5`} fill="none" stroke={SILVER} />
    {/* A one-day wall: heavy today, gone after */}
    <Label x={40} y={78} anchor="end" fill={INK_2} size={9} mono>
      492
    </Label>
    {COLS.map((c, i) => (
      <Cell key={`b${i}`} x={c.x} y={78} w={CELL_W} fill={i === 0 ? WARM_3 : PALE} text={['$148M', '$6M', '$3M', '$1M'][i]} ink={i === 0 ? '#fff' : '#0a0a0a'} />
    ))}
    <Label x={50} y={104} fill={SILVER} size={9}>
      read across → heavy in every column, the level stays for weeks
    </Label>
    <Label x={50} y={117} fill={SILVER} size={9}>
      heavy today only → a one-day wall, gone after the bell
    </Label>
    {/* The today column, bracketed */}
    <path d={`M${COLS[0].x} 128 v4 h${CELL_W} v-4`} fill="none" stroke={INK_2} />
    <Label x={50} y={141} fill={INK_2} size={9}>
      read down today's column → what expires at 4:00
    </Label>
  </svg>
);

interface LedgerGuideProps {
  surface: ExposureSurface;
  greek: Greek;
}

const LedgerGuide = ({ surface, greek }: LedgerGuideProps) => {
  const label = greek.toUpperCase();
  const net = surface.net[greek];
  const king = surface.king[greek];
  const kingDate = surface.expiries[king.e]?.date ?? '';
  const supreme = surface.supreme[greek];
  const supremeDate = surface.expiries[supreme.e]?.date ?? '';
  /* How much of the calendar expires at the bell */
  const todayIdx = surface.expiries.findIndex(e => e.dte === 0);
  let dies = 0;
  let total = 0;
  for (let e = 0; e < surface.expiries.length; e++) for (let s = 0; s < surface.strikes.length; s++) {
    const v = Math.abs(net[e]?.[s] ?? 0);
    total += v;
    if (e === todayIdx) dies += v;
  }
  const share = total > 0 && todayIdx >= 0 ? Math.round((100 * dies) / total) : null;
  /* The call wall's row, read across */
  const wallIdx = surface.strikes.findIndex(k => Math.abs(k - surface.levels.callWall) < 1e-9);
  const last = surface.expiries.length - 1;
  const wallToday = wallIdx >= 0 && todayIdx >= 0 ? Math.abs(net[todayIdx]?.[wallIdx] ?? 0) : 0;
  const wallFar = wallIdx >= 0 ? Math.abs(net[last]?.[wallIdx] ?? 0) : 0;
  const stays = wallToday > 0 && wallFar >= wallToday * 0.5;

  return (
    <div className="px-3 py-3 flex flex-col gap-3" data-ledger-guide-card>
      <div>
        <p className="text-[12px] font-semibold text-textPrimary">The grid · one strike per row, one date per column</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-textSecondary">
          Each row is a strike, a price level. Each column is an expiry date, today first and later dates to the right. Each cell is a capsule: the figure inside is how much dealer hedging sits at that strike for that date. Brighter and longer means more. Blue pushes back against a move there, orange pushes it along. The strike printed in magenta is the supreme, the heaviest strike of the whole book and the one the chart wears in magenta; the cell with the star is the heaviest single cell.
        </p>
        <div className="mt-2 rounded-md border border-borderSubtle/60 bg-panel px-2 py-2">
          <GridFigure />
        </div>
      </div>
      <div>
        <p className="text-[12px] font-semibold text-textPrimary">Reading it · across for how long, down for what expires</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-textSecondary">
          Read across a row to see how long a level lasts. Heavy in every column means the level stays for weeks. Heavy today and empty after means it is a one-day wall that is gone at the bell. Read down today's column to see what expires at 4:00. The "After the close" choice up top shows the same grid with today's column removed, the calendar as it will stand tomorrow morning.
        </p>
        <div className="mt-2 rounded-md border border-borderSubtle/60 bg-panel px-2 py-2">
          <ReadFigure />
        </div>
      </div>
      <div className="border-t border-borderSubtle/60 pt-2.5">
        <p className="text-[10px] text-textMuted">Today's calendar, in words</p>
        <ul className="mt-1 flex flex-col gap-1.5">
          <li className="text-[11.5px] leading-relaxed text-textSecondary">
            The supreme is <span className="font-mono tnum font-semibold" style={{ color: SUPREME }}>{fmtStrike(supreme.strike)}</span>: <span className="font-mono tnum text-textPrimary">{fmtUsd(Math.abs(supreme.total))}</span> of {label} hedging across the whole book, most of it on{' '}
            <span className="text-textPrimary">{supremeDate}</span>. The chart wears it in magenta.
          </li>
          <li className="text-[11.5px] leading-relaxed text-textSecondary">
            The heaviest cell is <span className="font-mono tnum text-textPrimary">{fmtStrike(king.strike)}</span> on <span className="text-textPrimary">{kingDate}</span>, with{' '}
            <span className="font-mono tnum text-textPrimary">{fmtUsd(Math.abs(king.value))}</span> of {label} hedging. That is the star.
          </li>
          {share != null && (
            <li className="text-[11.5px] leading-relaxed text-textSecondary">
              <span className="font-mono tnum text-textPrimary">{share}%</span> of the hedging on this calendar expires today at 4:00. The rest is still there tomorrow.
            </li>
          )}
          {wallIdx >= 0 && wallToday > 0 && (
            <li className="text-[11.5px] leading-relaxed text-textSecondary">
              The call wall at <span className="font-mono tnum text-textPrimary">{fmtStrike(surface.levels.callWall)}</span> holds <span className="font-mono tnum text-textPrimary">{fmtUsd(wallToday)}</span> today and{' '}
              <span className="font-mono tnum text-textPrimary">{fmtUsd(wallFar)}</span> on {surface.expiries[last]?.date}. {stays ? 'It stays on the calendar.' : 'Most of it is gone after today.'}
            </li>
          )}
        </ul>
      </div>
      <p className="text-[10px] text-textMuted">Hover any cell to read it in the line above the grid · click to keep it there.</p>
    </div>
  );
};

export default LedgerGuide;
