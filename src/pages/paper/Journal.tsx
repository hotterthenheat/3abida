/*
==================================================
  SLAYER TERMINAL - THE JOURNAL (pages/paper/Journal.tsx)

  What the desk actually did, on a calendar and in
  a table:

    THE MATRIX   every day of the month with its
                 net, its trades and its volume,
                 shaded by how the day went, with
                 each week's total down the side
    THE NUMBERS  profit factor first, because it is
                 the one figure that says whether
                 the edge is real: gross profit
                 over gross loss
    MAE / MFE    per round trip — how far each
                 trade went AGAINST you before it
                 worked, and how far it went FOR
                 you before you took it. The gap
                 between the high water and the
                 realised number is the one most
                 readers never look at.

  Nothing here is computed twice: every figure
  comes from core/paper/analytics.ts reading the
  engine's own closed trades, which carry their own
  excursions (sampled on every quote while the lot
  was open). No number on this page was invented.
==================================================
*/

import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ClipboardPen } from 'lucide-react';
import type { CSSProperties } from 'react';
import { NAV_INK } from '../../components/layout/nav';
import { Fact } from '../../components/trace/TraceBox';
import { TraceGrid } from '../../components/trace/TraceBox';
import type { Column } from '../../components/ui/DataTable';
import CardTabs from '../../components/ui/CardTabs';
import Term from '../../components/ui/Term';
import { fmtMoney, fmtPrice, tagWord } from '../../core/paper/instruments';
import { usePaper, type Trade } from '../../core/paper/engine';
import { byDay, dayKeyOf, excursions, monthGrid, statsOf, type DayCell } from '../../core/paper/analytics';
import { Money, PaperPill, fmtHold, fmtStamp } from './paperKit';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Cut = 'all' | 'month';

/** A day's wash — green when it paid, red when it cost, deeper as it mattered more */
const dayWash = (net: number, scale: number): string => {
  if (Math.abs(net) < 0.005 || scale <= 0) return 'transparent';
  const a = Math.min(0.3, 0.06 + (Math.abs(net) / scale) * 0.24);
  return `color-mix(in srgb, ${net > 0 ? 'rgb(var(--bull))' : 'rgb(var(--bear))'} ${Math.round(a * 100)}%, transparent)`;
};

const Journal = () => {
  const paper = usePaper();
  const [at, setAt] = useState(() => new Date());
  const [cut, setCut] = useState<Cut>('all');
  const year = at.getFullYear();
  const month = at.getMonth();

  const days = useMemo(() => byDay(paper.trades), [paper.trades]);
  const grid = useMemo(() => monthGrid(year, month), [year, month]);
  const monthTrades = useMemo(() => paper.trades.filter(t => {
    const d = new Date(t.closedAt);
    return d.getFullYear() === year && d.getMonth() === month;
  }), [paper.trades, year, month]);
  const shown = cut === 'month' ? monthTrades : paper.trades;
  const stats = useMemo(() => statsOf(shown), [shown]);
  const rows = useMemo(() => excursions(shown), [shown]);
  const scale = useMemo(() => Math.max(1, ...[...days.values()].map(d => Math.abs(d.net))), [days]);

  const monthNet = useMemo(() => monthTrades.reduce((n, t) => n + t.realized, 0), [monthTrades]);
  const weeks = useMemo(() => {
    const out: { net: number; trades: number }[] = [];
    for (let i = 0; i < grid.length; i += 7) {
      let net = 0;
      let n = 0;
      for (const d of grid.slice(i, i + 7)) {
        if (!d) continue;
        const cell = days.get(dayKeyOf(d.getTime()));
        if (!cell) continue;
        net += cell.net;
        n += cell.trades;
      }
      out.push({ net, trades: n });
    }
    return out;
  }, [grid, days]);

  const step = (n: number) => setAt(d => new Date(d.getFullYear(), d.getMonth() + n, 1));

  const cols = useMemo<Column<(typeof rows)[number]>[]>(
    () => [
      { key: 'closed', header: 'Closed', width: '118px', render: r => <span className="font-mono text-[11px] tnum text-textPrimary">{fmtStamp(r.trade.closedAt)}</span>, sortValue: r => r.trade.closedAt },
      { key: 'symbol', header: 'Symbol', width: '160px', render: r => <span className="font-mono text-[11px] font-semibold text-textPrimary">{tagWord(r.trade.instrument)}</span> },
      { key: 'side', header: 'Side', width: '62px', render: r => <span className={`font-mono text-[10px] font-semibold uppercase ${r.trade.side === 'long' ? 'text-bull' : 'text-bear'}`}>{r.trade.side}</span> },
      { key: 'qty', header: 'Qty', width: '54px', align: 'right', render: r => <span className="font-mono text-[11px] tnum text-textPrimary">{r.trade.qty}</span> },
      { key: 'entry', header: 'Entry', width: '96px', align: 'right', render: r => <span className="font-mono text-[11px] tnum text-textPrimary">{fmtPrice(r.trade.instrument, r.trade.entryAvg)}</span> },
      { key: 'exit', header: 'Exit', width: '96px', align: 'right', render: r => <span className="font-mono text-[11px] tnum text-textPrimary">{fmtPrice(r.trade.instrument, r.trade.exitAvg)}</span> },
      {
        key: 'mae',
        header: <Term k="MAE">MAE</Term>,
        width: '128px',
        align: 'right',
        sortValue: r => r.trade.mae,
        render: r => (
          <span className="inline-flex items-center gap-1.5 justify-end w-full" title="Maximum adverse excursion — the deepest this lot was ever under while it was open">
            <span className="relative h-1.5 w-[54px] rounded-full bg-ink/[0.07] overflow-hidden">
              <span className="absolute right-0 top-0 h-full rounded-full bg-bear/70" style={{ width: `${Math.round(Math.min(1, r.maeShare) * 100)}%` }} />
            </span>
            <span className="font-mono text-[11px] tnum text-bear">{r.trade.mae < 0 ? fmtMoney(r.trade.mae) : '—'}</span>
          </span>
        ),
      },
      {
        key: 'mfe',
        header: <Term k="MFE">MFE</Term>,
        width: '128px',
        align: 'right',
        sortValue: r => r.trade.mfe,
        render: r => (
          <span className="inline-flex items-center gap-1.5 justify-end w-full" title="Maximum favourable excursion — the most this lot was ever worth while it was open">
            <span className="relative h-1.5 w-[54px] rounded-full bg-ink/[0.07] overflow-hidden">
              <span className="absolute left-0 top-0 h-full rounded-full bg-bull/70" style={{ width: `${Math.round(Math.min(1, r.mfeShare) * 100)}%` }} />
            </span>
            <span className="font-mono text-[11px] tnum text-bull">{r.trade.mfe > 0 ? fmtMoney(r.trade.mfe) : '—'}</span>
          </span>
        ),
      },
      {
        key: 'capture',
        header: 'Captured',
        width: '86px',
        align: 'right',
        sortValue: r => r.capture,
        render: r => (
          <span className="font-mono text-[11px] tnum" style={{ color: r.capture > 0.6 ? 'rgb(var(--bull))' : r.capture > 0.25 ? 'rgb(var(--text-primary))' : 'rgb(var(--text-muted))' }} title="What was taken of the most it was ever worth">
            {r.trade.mfe > 0 ? `${Math.round(r.capture * 100)}%` : '—'}
          </span>
        ),
      },
      { key: 'real', header: 'Realized', width: '104px', align: 'right', sortValue: r => r.trade.realized, render: r => <Money v={r.trade.realized} className="text-[11px] font-semibold" /> },
      { key: 'hold', header: 'Holding', width: '82px', align: 'right', sortValue: r => r.trade.holdMs, render: r => <span className="font-mono text-[11px] tnum text-textPrimary">{fmtHold(r.trade.holdMs)}</span> },
    ],
    []
  );

  const pf = Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : stats.grossProfit > 0 ? '∞' : '—';

  return (
    <div className="relative flex-1 min-h-0 flex flex-col" data-paper-journal>
      <header className="shrink-0 flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" data-shell>
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-2.5" data-shell-page>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-borderSubtle text-textSecondary shrink-0" aria-hidden="true" style={{ '--ink': NAV_INK.paper } as CSSProperties}>
              <ClipboardPen className="w-3.5 h-3.5" />
            </span>
            <h1 className="text-[15px] font-semibold leading-tight text-textPrimary">Journal</h1>
            <PaperPill />
            <Link to="/paper" className="ml-1 font-mono text-[9px] uppercase tracking-widest text-textMuted hover:text-textPrimary transition-colors" data-journal-back>
              ← The desk
            </Link>
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">Every closed round trip — what the days made, and how far each trade went both ways before it ended.</p>
        </div>
        <dl className="grid grid-flow-col auto-cols-max gap-x-6" data-shell-facts data-journal-facts>
          <Fact label="Profit factor" testId="pf">
            <span className="tnum" style={{ color: stats.profitFactor >= 1.5 ? 'rgb(var(--bull))' : stats.profitFactor < 1 && stats.trades > 0 ? 'rgb(var(--bear))' : undefined }}>{pf}</span>
          </Fact>
          <Fact label="Net" testId="net"><Money v={stats.net} /></Fact>
          <Fact label="Win rate" testId="winrate">{stats.trades ? `${Math.round(stats.winRate * 100)}%` : '—'}</Fact>
          <Fact label="Trades" testId="trades">{stats.trades}</Fact>
          <Fact label="Expectancy" testId="exp"><Money v={stats.expectancy} /></Fact>
          <Fact label="Max drawdown" testId="dd">{fmtMoney(-Math.abs(stats.maxDrawdown))}</Fact>
        </dl>
      </header>

      <div className="relative flex-1 min-h-0 mt-4 grid grid-rows-[minmax(0,1fr)_minmax(0,1fr)] grid-cols-[minmax(0,1fr)_288px] gap-2.5">
        {/* the matrix */}
        <div className="min-h-0 min-w-0 rounded-md border border-borderSubtle bg-panel flex flex-col overflow-hidden" data-journal-calendar>
          <div className="shrink-0 h-9 px-3 flex items-center gap-2 border-b border-borderSubtle/70">
            <button type="button" onClick={() => step(-1)} aria-label="The month before" className="inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] font-semibold text-textPrimary tnum w-[136px] text-center" data-journal-month>
              {MONTHS[month]} {year}
            </span>
            <button type="button" onClick={() => step(1)} aria-label="The month after" className="inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => setAt(new Date())} className="font-mono text-[9px] uppercase tracking-widest text-textMuted hover:text-textPrimary transition-colors">
              This month
            </button>
            <span className="ml-auto font-mono text-[10px] tnum">
              <span className="text-textMuted uppercase tracking-widest text-[9px] mr-1.5">Month</span>
              <Money v={monthNet} className="font-semibold" />
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-2">
            <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_62px] gap-1">
              {DOW.map(d => (
                <span key={d} className="font-mono text-[8px] uppercase tracking-widest text-textMuted text-center py-0.5">
                  {d}
                </span>
              ))}
              <span className="font-mono text-[8px] uppercase tracking-widest text-textMuted text-center py-0.5">Week</span>
              {grid.map((d, i) => {
                const cell: DayCell | undefined = d ? days.get(dayKeyOf(d.getTime())) : undefined;
                const isToday = d != null && dayKeyOf(d.getTime()) === dayKeyOf(Date.now());
                const endOfWeek = i % 7 === 6;
                const w = weeks[Math.floor(i / 7)];
                return (
                  <Fragment key={d ? d.toISOString() : `pad-${i}`}>
                    <div
                      className={`relative min-h-[54px] rounded border px-1.5 py-1 flex flex-col ${d ? 'border-borderSubtle' : 'border-transparent'} ${isToday ? 'ring-1 ring-silver/50' : ''}`}
                      style={{ background: cell ? dayWash(cell.net, scale) : 'transparent' }}
                      data-journal-day={d ? dayKeyOf(d.getTime()) : undefined}
                      title={cell ? `${cell.trades} trade${cell.trades === 1 ? '' : 's'} · ${cell.volume} traded · best ${fmtMoney(cell.best)} · worst ${fmtMoney(cell.worst)} · fees ${fmtMoney(-cell.fees)}` : undefined}
                    >
                      {d && <span className="font-mono text-[9px] tnum text-textMuted">{d.getDate()}</span>}
                      {cell && (
                        <>
                          <Money v={cell.net} className="mt-auto text-[11px] font-semibold leading-none" />
                          <span className="font-mono text-[8px] text-textMuted leading-none mt-0.5">
                            {cell.trades}t · {cell.volume}
                          </span>
                        </>
                      )}
                    </div>
                    {endOfWeek && (
                      <div className="min-h-[54px] rounded border border-borderSubtle/50 bg-ink/[0.02] px-1 py-1 flex flex-col items-end justify-end" data-journal-week>
                        {w && w.trades > 0 ? (
                          <>
                            <Money v={w.net} className="text-[10px] font-semibold leading-none" />
                            <span className="font-mono text-[8px] text-textMuted leading-none mt-0.5">{w.trades}t</span>
                          </>
                        ) : (
                          <span className="font-mono text-[9px] text-textMuted mt-auto">—</span>
                        )}
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* the numbers */}
        <div className="min-h-0 min-w-0 rounded-md border border-borderSubtle bg-panel flex flex-col overflow-hidden" data-journal-stats>
          <div className="shrink-0 h-9 px-3 flex items-center gap-2 border-b border-borderSubtle/70">
            <CardTabs
              ariaLabel="What the numbers cover"
              value={cut}
              onChange={setCut}
              options={[
                { value: 'all', label: 'All time' },
                { value: 'month', label: 'This month' },
              ]}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col gap-0.5">
            <Line label="Profit factor" hint="Gross profit over gross loss — over 1 is an edge, under 1 is not">
              <span className="font-semibold" style={{ color: stats.profitFactor >= 1.5 ? 'rgb(var(--bull))' : stats.profitFactor < 1 && stats.trades > 0 ? 'rgb(var(--bear))' : undefined }}>{pf}</span>
            </Line>
            <Line label="Gross profit"><Money v={stats.grossProfit} /></Line>
            <Line label="Gross loss"><Money v={-Math.abs(stats.grossLoss)} /></Line>
            <Rule />
            <Line label="Wins / losses">{stats.wins} / {stats.losses}{stats.scratches ? ` · ${stats.scratches} flat` : ''}</Line>
            <Line label="Average win"><Money v={stats.avgWin} /></Line>
            <Line label="Average loss"><Money v={stats.avgLoss} /></Line>
            <Line label="Best / worst"><span className="tnum"><Money v={stats.bestTrade} /> <span className="text-textMuted">/</span> <Money v={stats.worstTrade} /></span></Line>
            <Line label="Streaks" hint="The longest run of winners, and of losers">{stats.bestStreak}W · {stats.worstStreak}L</Line>
            <Rule />
            <Line label="Worst heat" hint="The deepest a single trade ever went against you"><Money v={stats.worstMae} /></Line>
            <Line label="Heat on a winner" hint="The average MAE of the trades that worked — how close the good ones came"><Money v={stats.avgWinnerMae} /></Line>
            <Line label="Given back" hint="The average MFE of the trades that lost — what was there and handed back"><Money v={stats.avgLoserMfe} /></Line>
            <Line label="Capture" hint="Realised against the most every trade was ever worth">{stats.trades ? `${Math.round(stats.captureRate * 100)}%` : '—'}</Line>
            <Rule />
            <Line label="Fees"><Money v={-Math.abs(stats.fees)} /></Line>
            <Line label="Slippage"><Money v={-Math.abs(stats.slippage)} /></Line>
            <Line label="Volume">{stats.volume}</Line>
          </div>
        </div>

        {/* the round trips */}
        <div className="min-h-0 min-w-0 col-span-2 rounded-md border border-borderSubtle bg-panel flex flex-col overflow-hidden">
          <div className="shrink-0 h-9 px-3 flex items-center gap-3 border-b border-borderSubtle/70">
            <span className="font-mono text-[9px] uppercase tracking-widest text-textSecondary">Round trips</span>
            <span className="font-mono text-[9px] text-textMuted">{shown.length} closed · how far each one went both ways before it ended</span>
          </div>
          <div className="flex-1 min-h-0">
            <TraceGrid<(typeof rows)[number]>
              rows={rows}
              columns={cols}
              rowKey={r => r.trade.id}
              height="100%"
              animate={false}
              initialSort={{ key: 'closed', dir: 'desc' }}
              emptyText="No closed paper trades yet — the desk writes them here as they close"
              testId="journal-trips"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const Line = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 h-[22px]" title={hint}>
    <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted whitespace-nowrap">{label}</span>
    <span className="font-mono text-[11px] tnum text-textPrimary whitespace-nowrap">{children}</span>
  </div>
);
const Rule = () => <span className="my-1 h-px bg-borderSubtle/70" aria-hidden />;

export type { Trade };
export default Journal;
