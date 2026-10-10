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

import Glossary from '../levels/Glossary';
import { fmtUsd } from '../../data/gex';
import type { ExposureSurface, Greek } from '../../data/exposureSurface';
import { maxPainOf, MAX_PAIN_WORDS } from '../../data/maxPain';
import type { LedgerView } from './ledgerView';
import type { MarketSnapshot } from '../../types/market';
import { FONT_SANS } from '../../theme/fonts';
import { GuideSvg } from '../ui/GuideSvg';

const INK = 'rgb(var(--text-primary))';
const INK_2 = 'rgb(var(--text-secondary))';
const INK_3 = 'rgb(var(--text-muted))';
const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const SUPREME = 'rgb(var(--supreme))';
const GRID = 'rgb(var(--ink) / 0.07)';
const COOL_1 = '#ABD9E9';
const COOL_2 = '#74ADD1';
const COOL_3 = '#4575B4';
const WARM_1 = '#FDAE61';
const WARM_2 = '#F46D43';
const WARM_3 = '#D73027';
const PALE = '#FFFFBF';
/* the figures' voice — Helvetica's digits are tabular (theme/fonts.ts) */
const FIG = FONT_SANS;
const SANS = FONT_SANS;

const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

const Cell = ({ x, y, w, fill, text, ink = '#0a0a0a', ring, s }: { x: number; y: number; w: number; fill: string; text?: string; ink?: string; ring?: string; s: number }) => (
  <g>
    <rect x={x} y={y - 6} width={w} height={12} rx={6} fill={fill} />
    {ring && <rect x={x - 1.5} y={y - 7.5} width={w + 3} height={15} rx={7.5} fill="none" stroke={ring} strokeWidth="1.25" />}
    {text && (
      <text x={x + w - 5} y={y + 0.5} textAnchor="end" dominantBaseline="middle" fontFamily={FIG} fontSize={s} fontWeight="600" fill={ink}>
        {text}
      </text>
    )}
  </g>
);

const Label = ({ x, y, children, anchor = 'start', fill = INK_2, size, mono = false }: { x: number; y: number; children: string; anchor?: 'start' | 'middle' | 'end'; fill?: string; size: number; mono?: boolean }) => (
  <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontFamily={mono ? FIG : SANS} fontSize={size} fill={fill}>
    {children}
  </text>
);

/* THE FIGURES' DATES ARE THE BOOK'S OWN (PP-2): they read "Sep 8 · today" a month after Sep 8 */
const COL_X = [50, 132, 214, 296];
type Col = { x: number; head: string };
const colsOf = (heads: string[]): Col[] => COL_X.map((x, i) => ({ x, head: heads[i] ?? '' }));
const CELL_W = 72;

/** FIGURE 1 — the grid: a strike per row, an expiry per column, the supreme starred */
const GridFigure = ({ COLS }: { COLS: Col[] }) => {
  const rows = [
    { y: 44, k: '496', cells: [[COOL_1, '$94M'], [COOL_1, '$81M'], [PALE, '$40M'], [PALE, '$22M']] },
    { y: 66, k: '495', wall: 'call', cells: [[COOL_3, '$256M', '#fff', true], [COOL_3, '$231M', '#fff'], [COOL_2, '$188M'], [COOL_2, '$150M']] },
    { y: 88, k: '494', cells: [[WARM_1, '$61M'], [PALE, '$38M'], [PALE, '$19M'], [PALE, '$9M']] },
    { y: 116, k: '493', wall: 'put', cells: [[WARM_3, '$131M', '#fff'], [WARM_2, '$104M'], [WARM_2, '$96M'], [WARM_1, '$70M']] },
  ] as { y: number; k: string; wall?: string; cells: (string | boolean)[][] }[];
  return (
    <GuideSvg w={368} h={184} word={9.75} label="A grid of capsules: one strike per row, one expiry per column, the heaviest cell ringed in magenta with a star" figure="grid">
      {({ w, t }) => (
        <>
          {/* Column heads — the dates, today first */}
          {COLS.map((c, i) => (
            <Label key={c.head} x={c.x + CELL_W / 2} y={18} anchor="middle" fill={i === 0 ? INK : INK_3} size={w * 1.053} mono>
              {c.head}
            </Label>
          ))}
          <line x1={50} x2={368} y1={27.5} y2={27.5} stroke={GRID} />
          {rows.map(r => (
            <g key={r.k}>
              <Label x={40} y={r.y} anchor="end" fill={r.wall === 'put' ? SUPREME : r.wall === 'call' ? 'rgb(var(--bull))' : INK_2} size={w * 1.053} mono>
                {r.k}
              </Label>
              {r.cells.map((c, i) => (
                <Cell s={w} key={i} x={COLS[i].x} y={r.y} w={CELL_W} fill={c[0] as string} text={c[1] as string} ink={(c[2] as string) ?? '#0a0a0a'} ring={c[3] ? SUPREME : undefined} />
              ))}
            </g>
          ))}
          {/* The heaviest cell's star, left of its strike; the supreme is the strike printed in magenta */}
          <text x={12} y={66.5} textAnchor="middle" dominantBaseline="middle" fontFamily={SANS} fontSize={w * 1.053} fill={INK}>
            ★
          </text>
          {/* Spot, between the rows it sits between — the chip at the line's end, the rows apart enough for its 11 px figure */}
          <line x1={50} x2={320} y1={102.5} y2={102.5} stroke={INK} strokeOpacity="0.35" strokeDasharray="2 3" />
          <rect x={322} y={95.5} width={46} height={14} rx={3} fill={INK} />
          {/* the chip is the page's ink, its figure the ground's — near-black on paper printed black on black (2026-09-30) */}
          <Label x={345} y={102.5} anchor="middle" fill="rgb(var(--panel))" size={w} mono>
            493.60
          </Label>
          <Label x={50} y={136} fill={INK_3} size={w * 1.053}>
            one strike per row, one date per column
          </Label>
          <Label x={50} y={149} fill={INK_3} size={w * 1.053}>
            the figure is the hedging there
          </Label>
          <text x={50} y={163} dominantBaseline="middle" fontFamily={SANS} fontSize={w * 1.053} fill={INK_2}>
            ★ the heaviest cell
          </text>
          <text x={166} y={163} dominantBaseline="middle" fontFamily={SANS} fontSize={w * 1.053} fill={SUPREME}>
            magenta strike: the supreme
          </text>
          {/* its own line — beside the supreme it ran into it; and the line is dashed in the page's ink on either ground, never white */}
          <Label x={50} y={176} fill={INK_3} size={w * 1.053}>
            the dashed line: the market now
          </Label>
        </>
      )}
    </GuideSvg>
  );
};

/** FIGURE 2 — read across, read down: what stays, what expires at the bell */
const ReadFigure = ({ COLS }: { COLS: Col[] }) => (
  <GuideSvg w={368} h={150} word={9.75} label="The same grid: one row stays heavy across every column, another is heavy only today; the today column expires at the bell" figure="read">
    {({ w, t }) => (
      <>
        {COLS.map((c, i) => (
          <Label key={c.head} x={c.x + CELL_W / 2} y={18} anchor="middle" fill={i === 0 ? INK : INK_3} size={w * 1.053} mono>
            {c.head}
          </Label>
        ))}
        <line x1={50} x2={368} y1={27.5} y2={27.5} stroke={GRID} />
        {/* A wall that stays: heavy across the row */}
        <Label x={40} y={48} anchor="end" fill="rgb(var(--bull))" size={w * 1.053} mono>
          495
        </Label>
        {COLS.map((c, i) => (
          <Cell s={w} key={`a${i}`} x={c.x} y={48} w={CELL_W} fill={COOL_3} text={['$256M', '$231M', '$188M', '$150M'][i]} ink="#fff" />
        ))}
        <path d={`M${COLS[3].x + CELL_W + 4} 41 h5 v14 h-5`} fill="none" stroke={SILVER} />
        {/* A one-day wall: heavy today, gone after */}
        <Label x={40} y={78} anchor="end" fill={INK_2} size={w * 1.053} mono>
          492
        </Label>
        {COLS.map((c, i) => (
          <Cell s={w} key={`b${i}`} x={c.x} y={78} w={CELL_W} fill={i === 0 ? WARM_3 : PALE} text={['$148M', '$6M', '$3M', '$1M'][i]} ink={i === 0 ? '#fff' : '#0a0a0a'} />
        ))}
        <Label x={50} y={104} fill={SILVER} size={w * 1.053}>
          read across → heavy in every column, the level stays for weeks
        </Label>
        <Label x={50} y={117} fill={SILVER} size={w * 1.053}>
          heavy today only → a one-day wall, gone after the bell
        </Label>
        {/* The today column, bracketed */}
        <path d={`M${COLS[0].x} 128 v4 h${CELL_W} v-4`} fill="none" stroke={INK_2} />
        <Label x={50} y={141} fill={INK_2} size={w * 1.053}>
          read down today's column → what expires at 4:00
        </Label>
      </>
    )}
  </GuideSvg>
);

interface LedgerGuideProps {
  surface: ExposureSurface;
  greek: Greek;
  /** The view on screen — the guide opens on it (the Map opens on the Matrix) */
  view?: LedgerView;
  snapshot?: MarketSnapshot | null;
}

/** THE MATRIX, in one small table drawn the way the page draws it */
const MatrixFigure = () => {
  const rows = [
    { k: '480', tag: 'call wall', tagInk: 'rgb(var(--bull))', put: '$12M', call: '−$214M', net: '−$202M', w: [0.06, 0.92, 0.88] },
    { k: '479', put: '$31M', call: '−$58M', net: '−$27M', w: [0.15, 0.25, 0.12] },
    { k: '478', tag: 'flip', tagInk: 'rgb(var(--flip))', put: '$66M', call: '−$61M', net: '$5M', w: [0.3, 0.27, 0.02] },
    { k: '477', put: '$118M', call: '−$22M', net: '$96M', w: [0.55, 0.1, 0.42] },
  ];
  const X = { strike: 8, put: 150, call: 236, net: 322 };
  return (
    <GuideSvg w={368} h={150} word={9.75} label="The matrix: a row per strike, and for the greek three cells, put, call and net, each a figure over a thin bar" figure="matrix">
      {({ w, t }) => (
        <>
          <Label x={X.put} y={14} anchor="end" fill={INK_3} size={w * 1.053} mono>
            put
          </Label>
          <Label x={X.call} y={14} anchor="end" fill={INK_3} size={w * 1.053} mono>
            call
          </Label>
          <Label x={X.net} y={14} anchor="end" fill={INK} size={w * 1.053} mono>
            net
          </Label>
          <line x1={0} x2={368} y1={24.5} y2={24.5} stroke={GRID} />
          {rows.map((r, i) => {
            const y = 40 + i * 24;
            return (
              <g key={r.k}>
                <Label x={X.strike} y={y} fill={INK} size={w * 1.105} mono>
                  {r.k}
                </Label>
                {r.tag && (
                  <Label x={X.strike + 30} y={y} fill={r.tagInk} size={w * 1.053}>
                    {r.tag}
                  </Label>
                )}
                {(['put', 'call', 'net'] as const).map((leg, j) => (
                  <g key={leg}>
                    <Label x={X[leg]} y={y - 3} anchor="end" fill={INK} size={w * 1.053} mono>
                      {r[leg]}
                    </Label>
                    <rect x={X[leg] - 56} y={y + 5} width={56} height={2.5} rx={1.25} fill="rgb(var(--ink) / 0.07)" />
                    <rect x={X[leg] - 56} y={y + 5} width={56 * r.w[j]} height={2.5} rx={1.25} fill={j === 1 || (j === 2 && r.net.startsWith('−')) ? COOL_2 : WARM_2} />
                  </g>
                ))}
                {i === 1 && <line x1={0} x2={368} y1={y + 12.5} y2={y + 12.5} stroke={INK} strokeOpacity="0.35" strokeDasharray="2 3" />}
              </g>
            );
          })}
          <Label x={8} y={142} fill={INK_3} size={w * 1.053}>
            the dashed line: the market now, between the strikes above and below it
          </Label>
        </>
      )}
    </GuideSvg>
  );
};

const LedgerGuide = ({ surface, greek, view = 'calendar', snapshot }: LedgerGuideProps) => {
  const ex = surface.expiries;
  const COLS = colsOf([ex[0] ? `${ex[0].date}${ex[0].dte === 0 ? ' · today' : ''}` : '', ex[1]?.date ?? '', ex[2]?.date ?? '', ex[Math.min(ex.length - 1, 5)]?.date ?? '']);
  const pain = snapshot ? maxPainOf(snapshot.chain) : null;
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
      {/* THE MATRIX FIRST — the view the Map opens on (PP-2: the guide described a calendar and a ladder the page did not show) */}
      {view === 'matrix' && (
        <div>
          <p className="text-[12px] font-semibold text-textPrimary">The matrix · one strike per row, put · call · net per greek</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-textSecondary">
            Each row is a strike. For every greek on the Greek card there are three cells: the hedging on the strike's puts, on its calls, and the two added — the net. The figure is dollars per the unit in the greek's head ("GEX · 1% move" is dollars of stock dealers trade for a 1% move). The thin bar under a figure is its share of the heaviest in its own column: blue where the hedging absorbs moves, orange where it amplifies them. The sign is the terminal's: negative is call-heavy and absorbs, positive put-heavy and amplifies — the street's usual sign turned over. The Expiries card says which dates are added in; the dashed line is the market now. The level's name rides on its strike: call wall, put wall, flip, supreme, pin, and max pain.
          </p>
          <div className="mt-2 rounded-md border border-borderSubtle/60 bg-panel px-2 py-2">
            <MatrixFigure />
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-textSecondary">
            Tab comes to the strike at spot (or the one you kept); the arrows walk the strikes, and Enter keeps one for every box on the page.
          </p>
        </div>
      )}
      <div>
        <p className="text-[12px] font-semibold text-textPrimary">The calendar · one strike per row, one date per column</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-textSecondary">
          The Calendar view is the same book spread by date. Each row is a strike, a price level. Each column is an expiry date, today first and later dates to the right. Each cell is a capsule: the figure inside is how much dealer hedging sits at that strike for that date. Brighter and longer means more. Blue pushes back against a move there, orange pushes it along. The strike printed in magenta is the supreme, the heaviest strike of the whole book — every Pinpoint page marks it in magenta; the cell with the star is the heaviest single cell.
        </p>
        <div className="mt-2 rounded-md border border-borderSubtle/60 bg-panel px-2 py-2">
          <GridFigure COLS={COLS} />
        </div>
      </div>
      <div>
        <p className="text-[12px] font-semibold text-textPrimary">Reading it · across for how long, down for what expires</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-textSecondary">
          Read across a row to see how long a level lasts. Heavy in every column means the level stays for weeks. Heavy today and empty after means it is a one-day wall that is gone at the bell. Read down today's column to see what expires at 4:00. The Show card's "After the close" takes today's contracts out of the book, as it will stand tomorrow morning.
        </p>
        <div className="mt-2 rounded-md border border-borderSubtle/60 bg-panel px-2 py-2">
          <ReadFigure COLS={COLS} />
        </div>
      </div>
      {/* THE LADDER (2026-09-21, the net bar and its tick, on Noah's "the tick has no legend") — Pulse's tile only now */}
      {view === 'ladder' && (
      <div>
        <p className="text-[12px] font-semibold text-textPrimary">The ladder · one row per strike</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-textSecondary">
          The Ladder view up top is the same book as one row per strike. With one greek drawn, each row shows the put side growing left from the centre line and the call side growing right, with their figures. With several drawn, each greek gets its own pane and each row one bar: the net at that strike, growing left when puts lead and right when calls lead. Each pane's bars are scaled so nine strikes in ten fit, and the pane's head says what a full bar stands for. The few past it are the walls: they run to the lane's end and wear a small tick, and their net figure says by how much. Panes are not on one scale, so a bar in GEX and a bar of the same length in DEX are not the same money. The pane in the silver ring is the lead: the line above the ladder and its verdict follow it. Click a pane's name to lead with it.
        </p>
      </div>
      )}
      {/* MAX PAIN, one sentence (the ideas' rank 6) */}
      <div>
        <p className="text-[12px] font-semibold text-textPrimary">Max pain{pain ? ` · ${fmtStrike(pain.strike)} today` : ''}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-textSecondary">{MAX_PAIN_WORDS} On the Matrix its strike carries a dashed rule and its name.</p>
      </div>
      <div className="border-t border-borderSubtle/60 pt-2.5">
        <p className="text-[12px] text-textMuted">Today's book, in words</p>
        <ul className="mt-1 flex flex-col gap-1.5">
          <li className="text-[12px] leading-relaxed text-textSecondary">
            The supreme is <span className="font-mono tnum font-semibold" style={{ color: SUPREME }}>{fmtStrike(supreme.strike)}</span>: <span className="font-mono tnum text-textPrimary">{fmtUsd(Math.abs(supreme.total))}</span> of {label} hedging across the whole book, most of it on{' '}
            <span className="text-textPrimary">{supremeDate}</span>. Every Pinpoint page marks it in magenta.
          </li>
          <li className="text-[12px] leading-relaxed text-textSecondary">
            The heaviest cell is <span className="font-mono tnum text-textPrimary">{fmtStrike(king.strike)}</span> on <span className="text-textPrimary">{kingDate}</span>, with{' '}
            <span className="font-mono tnum text-textPrimary">{fmtUsd(Math.abs(king.value))}</span> of {label} hedging. That is the star.
          </li>
          {share != null && (
            <li className="text-[12px] leading-relaxed text-textSecondary">
              <span className="font-mono tnum text-textPrimary">{share}%</span> of the hedging on this calendar expires today at 4:00. The rest is still there tomorrow.
            </li>
          )}
          {wallIdx >= 0 && wallToday > 0 && (
            <li className="text-[12px] leading-relaxed text-textSecondary">
              The call wall at <span className="font-mono tnum text-textPrimary">{fmtStrike(surface.levels.callWall)}</span> holds <span className="font-mono tnum text-textPrimary">{fmtUsd(wallToday)}</span> today and{' '}
              <span className="font-mono tnum text-textPrimary">{fmtUsd(wallFar)}</span> on {surface.expiries[last]?.date}. {stays ? 'It stays on the calendar.' : 'Most of it is gone after today.'}
            </li>
          )}
        </ul>
      </div>
      <p className="text-[11px] text-textMuted">Point at any row or cell for its card · a click keeps the strike for every box on the page.</p>
      <Glossary words={['wall', 'flip', 'supreme', 'pin', 'maxPain', 'sign']} />
    </div>
  );
};

export default LedgerGuide;
