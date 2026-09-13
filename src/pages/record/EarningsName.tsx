/*
==================================================
  SLAYER TERMINAL - A NAME'S EARNINGS PAGE
  (pages/record/EarningsName.tsx)

  Everything on the record about one name before it
  reports (/record/earnings/:ticker), in reading
  order and in the house grammar (2026-09-09; the
  old dossier's uppercase panels and dotted-leader
  facts are gone, its charts kept):

    THE NAME       the mark, the company, when and
                   whether the date is set, the
                   facts — the options price, the
                   usual move, how it is priced, the
                   beat count
    TODAY'S PRICE, today's straddle replayed over
    REPLAYED       the last eight real prints — money,
                   not statistics — with the odds
    BEATS AND      estimate against actual, and the
    MISSES ·       stock's move after each of the
    PAST MOVES     last eight reports
    AFTER THE      what the options lose overnight
    PRINT
    THE BUSIEST    the three busiest calls and puts
    CONTRACTS      into the print, facts not picks
    ON THE RECORD  what this name's insiders did and
                   what Congress reported in it — the
                   other two pages of the Record,
                   read for one name

  Everything speaks the engines that were here
  (data/earnings.ts, data/insiders.ts,
  data/congress.ts).
==================================================
*/

import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, LayoutGrid } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AnimatedNumber from '../../components/ui/AnimatedNumber';
import CompanyLogo from '../../components/ui/CompanyLogo';
import HoverReadout from '../../components/ui/HoverReadout';
import { stateOf } from '../../components/earnings/volState';
import { BULL } from '../../components/gex/paletteInk';
import { useMarketData } from '../../context/MarketDataContext';
import Simulator from '../../core/simulator';
import { fmtDollars } from '../../data/ahead';
import { bracketLabel, buildCongress } from '../../data/congress';
import { buildEarningsDossier, type ActiveContract, type EarningsDossier } from '../../data/earnings';
import { TX_CODES, insiderFlow, isChosenBuy } from '../../data/insiders';
import { PRICED_INK, PRICED_WORD, SlotMark, slotWord } from './Earnings';
import { Name } from '../../components/ui/Name';

const AXIS = { stroke: 'transparent', tick: { fill: 'rgb(var(--text-secondary))', fontSize: 10, fontFamily: 'inherit' } };
const GRID = { stroke: 'rgba(255,255,255,0.05)', vertical: false };
const BEAR = 'rgb(var(--bear))';
const WHITE_DIM = 'rgba(237,237,237,0.28)';
const ago = (d: number) => (d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`);

const TooltipShell = ({ children }: { children: React.ReactNode }) => <div className="border border-borderMuted bg-panel rounded-md px-2.5 py-2 shadow-xl shadow-black/60 font-mono text-[11px] text-textPrimary">{children}</div>;

/** A box in the house grammar: the 15px title, the 11px line, whatever follows */
const Box = ({ title, sub, children, testId, className = '' }: { title: string; sub?: React.ReactNode; children: React.ReactNode; testId: string; className?: string }) => (
  <div className={`border border-borderSubtle rounded-md bg-panel flex flex-col ${className}`} data-earnings-box={testId}>
    <div className="px-5 pt-4 pb-3">
      <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">{title}</h3>
      {sub && <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">{sub}</p>}
    </div>
    {children}
  </div>
);

const Fact = ({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) => (
  <div>
    <dt className="text-[10px] text-textMuted whitespace-nowrap">{label}</dt>
    <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-name-fact={testId}>
      {children}
    </dd>
  </div>
);

/** A door out — small, labelled */
const Door = ({ onClick, onWarm, children }: { onClick: () => void; onWarm?: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onClick} onMouseEnter={onWarm} className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-borderSubtle bg-chip hover:border-borderMuted font-mono text-[9px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors">
    <ArrowUpRight className="w-3 h-3" />
    {children}
  </button>
);

/* ---- today's price, replayed ---------------------------------------------------- */
/* The question a person asks is "is ±6.3% a fair price?" — answered with money: take
   today's price for the move and replay it over the last eight real prints. One bar
   per quarter, the actual move's dollar value minus today's cost. Green above the
   line covered it; red below fell short. (Noah, 2026-08-19: "so simple yet unique") */
const PriceReplay = ({ d }: { d: EarningsDossier }) => {
  const e = d.event;
  const cost = (e.price * e.impliedMovePct) / 100;
  const rows = useMemo(
    () =>
      d.quarters.map(q => {
        const moved = (e.price * Math.abs(q.movePct)) / 100;
        return { label: q.label, movePct: q.movePct, moved, pl: moved - cost };
      }),
    [d.quarters, e.price, cost]
  );
  const maxAbs = useMemo(() => Math.max(...rows.map(r => Math.abs(r.pl)), 0.01), [rows]);
  const winners = rows.filter(r => r.pl > 0).length;
  const avg = rows.reduce((a, r) => a + r.pl, 0) / (rows.length || 1);
  const [hover, setHover] = useState<{ r: (typeof rows)[number]; x: number; y: number } | null>(null);
  const H = 56;
  return (
    <div className="px-5 pb-4 flex flex-col gap-3" data-name-replay>
      <div className="flex items-baseline gap-2.5 flex-wrap font-mono tnum">
        <span className="text-[10px] text-textMuted">Today's price for the move</span>
        <span className="text-[16px] font-bold text-textPrimary">${cost.toFixed(2)}</span>
        <span className="text-[11px] text-textSecondary">per share · ±{e.impliedMovePct.toFixed(1)}%</span>
      </div>
      <div className="mx-auto w-full max-w-[640px] select-none">
        <div className="relative" style={{ height: 2 * H }} onMouseLeave={() => setHover(null)}>
          <span className="absolute inset-x-0 top-1/2 h-px bg-ink/25" />
          <span className="absolute left-0 -translate-y-full top-1/2 pb-0.5 font-mono text-[9px] uppercase tracking-widest text-textMuted">covered it</span>
          <span className="absolute left-0 top-1/2 pt-0.5 font-mono text-[9px] uppercase tracking-widest text-textMuted">fell short</span>
          <div className="absolute inset-y-0 left-24 right-0 flex items-stretch gap-1.5">
            {rows.map(r => (
              <button
                key={r.label}
                type="button"
                onMouseEnter={ev => setHover({ r, x: ev.clientX, y: ev.clientY })}
                onMouseMove={ev => setHover({ r, x: ev.clientX, y: ev.clientY })}
                className="relative flex-1 min-w-0 rounded hover:bg-ink/[0.04] transition-colors cursor-default"
                aria-label={`${r.label}: moved ${r.movePct >= 0 ? '+' : ''}${r.movePct.toFixed(1)}%, ${r.pl >= 0 ? 'covered' : 'fell short of'} today's price by $${Math.abs(r.pl).toFixed(2)} per share`}
                data-replay-bar={r.label}
              >
                <span className={`absolute left-1/2 -translate-x-1/2 w-[22px] rounded-[2px] ${r.pl >= 0 ? 'bg-bull/90' : 'bg-bear/80'}`} style={r.pl >= 0 ? { bottom: '50%', height: Math.max(3, (Math.abs(r.pl) / maxAbs) * H) } : { top: '50%', height: Math.max(3, (Math.abs(r.pl) / maxAbs) * H) }} />
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-1.5 mt-1 pl-24">
          {rows.map(r => (
            <span key={r.label} className="flex-1 min-w-0 text-center font-mono text-[9px] text-textMuted truncate">
              {r.label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2.5 flex-wrap font-mono tnum">
        <span className="text-[13px] font-bold text-textPrimary">covered today's price {winners} of {rows.length} times</span>
        <span className={`text-[11px] font-semibold ${avg >= 0 ? 'text-bull' : 'text-bear'}`}>
          avg {avg >= 0 ? '+' : '−'}${Math.abs(avg).toFixed(2)} per share
        </span>
      </div>
      {/* THE ODDS the pricing implies, and the smaller facts */}
      <dl className="grid grid-cols-5 gap-x-6 pt-3 border-t border-borderSubtle/60">
        <Fact label={`Closes inside ±${e.impliedMovePct.toFixed(1)}%`}>{d.probInsidePct}%</Fact>
        <Fact label="Moves beyond it">
          <span className="text-textSecondary">{d.probBeyondPct}%</span>
        </Fact>
        <Fact label="Up against down" testId="updown">
          <span className={d.probUpPct >= 56 ? 'text-bull' : d.probUpPct <= 44 ? 'text-bear' : 'text-textPrimary'}>{d.probUpPct}% up</span> <span className="text-textMuted">· {100 - d.probUpPct}% down</span>
        </Fact>
        <Fact label="Estimates">
          <span className={e.revisionTrend > 0.15 ? 'text-bull' : e.revisionTrend < -0.15 ? 'text-bear' : 'text-textSecondary'}>{e.revisionTrend > 0.15 ? 'rising' : e.revisionTrend < -0.15 ? 'falling' : 'flat'}</span>
        </Fact>
        <Fact label="IV rank">
          <span className={e.ivRank >= 80 ? 'text-warn' : 'text-textPrimary'}>{e.ivRank}</span> <span className="text-textMuted">of 100</span>
        </Fact>
      </dl>
      {hover && (
        <HoverReadout x={hover.x} y={hover.y}>
          <div className="font-mono text-[11px] font-bold text-textPrimary tnum">
            {hover.r.label} · moved {hover.r.movePct >= 0 ? '+' : ''}
            {hover.r.movePct.toFixed(1)}%
          </div>
          <div className="font-mono text-[10px] text-textSecondary tnum">
            that move was worth ${hover.r.moved.toFixed(2)} · today's price ${cost.toFixed(2)}
          </div>
          <div className={`font-mono text-[11px] font-bold tnum ${hover.r.pl >= 0 ? 'text-bull' : 'text-bear'}`}>
            {hover.r.pl >= 0 ? '+' : '−'}${Math.abs(hover.r.pl).toFixed(2)} per share against today's price
          </div>
        </HoverReadout>
      )}
    </div>
  );
};

/* ---- a busy contract ------------------------------------------------------------ */
/* Facts only — the contract's own arithmetic, no "why" (Noah, 2026-08-19: "we simply
   provide information like bloomberg"). The volume bar ranks it against the busiest. */
const ActiveRow = ({ c, maxVol }: { c: ActiveContract; maxVol: number }) => (
  <div className="px-5 py-2.5 border-t border-borderSubtle/40 flex flex-col gap-1" data-name-contract={c.id}>
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-[12px] font-bold text-textPrimary">{c.label}</span>
      <span className="ml-auto font-mono text-[12px] font-semibold text-textPrimary tnum">
        ~<AnimatedNumber value={c.mid} format={v => `$${v.toFixed(2)}`} />
      </span>
    </div>
    <div className="flex items-center gap-2">
      <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted shrink-0">vol</span>
      <span className="relative w-24 h-[4px] rounded-full bg-ink/[0.06] shrink-0">
        <span className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out ${c.right === 'CALL' ? 'bg-bull/80' : 'bg-bear/70'}`} style={{ width: `${Math.max(6, (c.volume / maxVol) * 100)}%` }} />
      </span>
      <span className="font-mono text-[11px] font-semibold text-textPrimary tnum">
        <AnimatedNumber value={c.volume} format={v => Math.round(v).toLocaleString()} />
      </span>
      <span className="font-mono text-[10px] text-textSecondary tnum">
        open interest {c.oi.toLocaleString()} · <AnimatedNumber value={c.volOverOi} format={v => `${v.toFixed(2)}×`} /> · IV {c.ivPct}%
      </span>
    </div>
    <span className="font-mono text-[10px] text-textMuted tnum">
      {c.fromSpotPct === 0 ? 'at the money' : `${c.fromSpotPct > 0 ? '+' : ''}${c.fromSpotPct}% from spot`} · breaks even {c.right === 'CALL' ? '+' : '−'}
      {c.breakevenPct}% by expiry
    </span>
  </div>
);

/* ---- the page ------------------------------------------------------------------- */

const EarningsName = () => {
  const { ticker = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { changeTicker } = useMarketData();
  const fromDesk = (location.state as { from?: string } | null)?.from === 'desk';
  /* The busiest contracts refresh on the scan tier (10s); everything structural is tick-stable */
  const [scanTick, setScanTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setScanTick(t => t + 1), 10_000);
    return () => window.clearInterval(id);
  }, []);
  const dossier = useMemo(() => buildEarningsDossier(ticker, scanTick), [ticker, scanTick]);
  const T = ticker.toUpperCase();
  /* ON THE RECORD — the other two pages read for this one name */
  const insiders = useMemo(() => insiderFlow(T, 90), [T]);
  const congress = useMemo(() => buildCongress(180).trades.filter(t => t.ticker === T).sort((a, b) => a.filedDaysAgo - b.filedDaysAgo), [T]);

  const back = (
    <div className="flex items-center gap-4" data-name-back>
      <Link to="/record/earnings" className="group inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors">
        <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" /> The calendar
      </Link>
      {fromDesk && (
        <Link to="/pulse" className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors">
          <LayoutGrid className="w-3.5 h-3.5" /> The desk
        </Link>
      )}
    </div>
  );

  if (!dossier) {
    return (
      <>
        {back}
        <div className="border border-borderSubtle rounded-md bg-panel h-40 flex flex-col items-center justify-center gap-2" data-name-missing>
          <span className="font-mono text-[13px] font-bold text-textPrimary">{T}</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-textMuted">no report on the next two weeks' calendar</span>
        </div>
      </>
    );
  }

  const { event: e, quarters } = dossier;
  const priced = stateOf(e);
  const epsBeats = quarters.filter(q => q.epsBeat).length;
  const revBeats = quarters.filter(q => q.revBeat).length;
  const moveData = quarters.map(q => ({ label: q.label, move: q.movePct }));
  const epsData = quarters.map(q => ({ label: q.label, est: q.epsEst, actual: q.epsActual, beat: q.epsBeat }));
  const maxActiveVol = Math.max(...dossier.activeCalls.map(c => c.volume), ...dossier.activePuts.map(c => c.volume), 1);
  const openOnMap = () => {
    changeTicker(e.ticker);
    navigate('/pinpoint/map');
  };
  const marketInsiders = insiders.trades.filter(t => TX_CODES[t.code].openMarket).slice(0, 6);

  return (
    <>
      {back}

      {/* THE NAME */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-earnings-name={e.ticker}>
        <div className="px-5 pt-4 pb-4 flex items-start gap-6 flex-wrap">
          <div className="min-w-0 flex-1 flex items-center gap-3">
            <CompanyLogo ticker={e.ticker} size={34} />
            <div className="min-w-0">
              <div className="h-6 flex items-center gap-2.5">
                <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">{e.name}</h3>
                <Name t={e.ticker} size={13} className="font-mono text-[11px] font-bold text-textSecondary" />
              </div>
              <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate inline-flex items-center gap-1.5">
                Reports {e.dateLabel} <SlotMark slot={e.slot} className="w-3 h-3" /> {slotWord(e)}
                <span className="text-textMuted">·</span>
                <span className={e.confirmed ? 'text-textMuted' : 'text-warn'}>{e.confirmed ? 'the company has confirmed the date' : 'the date is still an estimate'}</span>
                {e.daysOut === 0 && (
                  <>
                    <span className="text-textMuted">·</span>
                    <span className="text-silver">today</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-5 gap-x-6">
            <Fact label="Options price" testId="price">
              ±{e.impliedMovePct.toFixed(1)}% <span className="text-textMuted">· ${((e.price * e.impliedMovePct) / 100).toFixed(2)}</span>
            </Fact>
            <Fact label="Usually moves" testId="usual">
              ±{e.histAvgMovePct.toFixed(1)}%
            </Fact>
            <Fact label="Priced" testId="priced">
              <span className={PRICED_INK[priced]}>
                {e.richness.toFixed(2)}× {PRICED_WORD[priced]}
              </span>
            </Fact>
            <Fact label="Beat the estimate" testId="beat">
              {epsBeats} of 8 <span className="text-textMuted">· revenue {revBeats} of 8</span>
            </Fact>
            <Fact label="Last eight" testId="last8">
              <span className="inline-flex gap-[3px] align-middle" title="each square one quarter, oldest first — green beat, red missed">
                {quarters.map(q => (
                  <span key={q.label} className={`w-2 h-2 rounded-[2px] ${q.epsBeat ? 'bg-bull' : 'bg-bear/60'}`} />
                ))}
              </span>
            </Fact>
          </dl>
        </div>
        <div className="px-5 pb-3 flex items-center gap-2 flex-wrap" data-name-doors>
          <Door onWarm={() => Simulator.ensureTicker(e.ticker)} onClick={openOnMap}>
            The Map
          </Door>
          <Door onWarm={() => Simulator.ensureTicker(e.ticker)} onClick={() => navigate('/weigher', { state: { weigh: { ticker: e.ticker } } })}>
            Weigh it
          </Door>
          <Door onWarm={() => Simulator.ensureTicker(e.ticker)} onClick={() => navigate('/compass', { state: { tickerFilter: e.ticker } })}>
            Compass
          </Door>
          <Door onClick={() => navigate('/record/news')}>The wire</Door>
        </div>
      </div>

      {/* TODAY'S PRICE, REPLAYED */}
      <Box title="Today's price, replayed" sub="What the options charge now, tested against the last eight real prints — hover a bar" testId="replay">
        <PriceReplay d={dossier} />
      </Box>

      {/* THE RECEIPTS */}
      <div className="grid grid-cols-2 gap-4 items-stretch">
        <Box title="Beats and misses" sub={`Earnings per share, the estimate against the actual · beat ${epsBeats} of 8 on earnings, ${revBeats} of 8 on revenue`} testId="beats">
          <div className="px-5 pb-4">
            <div className="h-[132px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={epsData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }} barGap={2}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="label" {...AXIS} />
                  <YAxis {...AXIS} width={40} tickFormatter={(v: number) => `$${v}`} />
                  <Tooltip
                    isAnimationActive={false}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <TooltipShell>
                          <div className="text-textSecondary">{label}</div>
                          <div>estimate ${Number(payload[0]?.value).toFixed(2)}</div>
                          <div>actual ${Number(payload[1]?.value).toFixed(2)}</div>
                        </TooltipShell>
                      ) : null
                    }
                  />
                  <Bar dataKey="est" fill={WHITE_DIM} radius={[2, 2, 0, 0]} barSize={9} isAnimationActive={false} />
                  <Bar dataKey="actual" radius={[2, 2, 0, 0]} barSize={9} isAnimationActive={false}>
                    {epsData.map(q => (
                      <Cell key={q.label} fill={q.beat ? BULL : BEAR} fillOpacity={q.beat ? 0.9 : 0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-textMuted">
              grey the estimate · <span className="text-bull">green beat</span> · <span className="text-bear">red missed</span>
            </p>
          </div>
        </Box>
        <Box title="Past moves" sub="The stock's move the session after each of its last eight reports" testId="moves">
          <div className="px-5 pb-4">
            <div className="h-[132px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={moveData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="label" {...AXIS} />
                  <YAxis {...AXIS} width={40} tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`} />
                  <Tooltip
                    isAnimationActive={false}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <TooltipShell>
                          <div className="text-textSecondary">{label}</div>
                          <div>
                            {Number(payload[0]?.value) >= 0 ? '+' : ''}
                            {Number(payload[0]?.value).toFixed(1)}% next session
                          </div>
                        </TooltipShell>
                      ) : null
                    }
                  />
                  <ReferenceLine y={e.impliedMovePct} stroke="rgba(199,211,232,0.55)" strokeDasharray="4 3" />
                  <ReferenceLine y={-e.impliedMovePct} stroke="rgba(199,211,232,0.55)" strokeDasharray="4 3" />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
                  <Bar dataKey="move" radius={[2, 2, 0, 0]} barSize={16} isAnimationActive={false}>
                    {moveData.map(q => (
                      <Cell key={q.label} fill={q.move >= 0 ? BULL : BEAR} fillOpacity={q.move >= 0 ? 0.9 : 0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-textMuted">
              the dashed lines are the ±{e.impliedMovePct.toFixed(1)}% priced for this print
            </p>
          </div>
        </Box>
      </div>

      {/* AFTER THE PRINT */}
      <Box title="After the print" sub="What the options lose overnight once the number is out — a long option has to beat the move and this" testId="after">
        <dl className="px-5 pb-4 grid grid-cols-4 gap-x-6">
          <Fact label="Implied vol deflates" testId="crush">
            <span className="text-warn">−{dossier.ivCrushPct}%</span>
          </Fact>
          <Fact label="Extrinsic kept by next open">~{100 - dossier.premiumLostPct}%</Fact>
          <Fact label="Straddle today">${((e.price * e.impliedMovePct) / 100).toFixed(2)}</Fact>
          <Fact label="The stock">${e.price.toFixed(2)}</Fact>
        </dl>
      </Box>

      {/* THE BUSIEST CONTRACTS — a pair shares one bottom edge (Noah, 2026-09-09) */}
      <div className="grid grid-cols-2 gap-4 items-stretch">
        <Box title="Busiest calls" sub="The three busiest by volume into the print · refreshes every ten seconds" testId="calls">
          <div className="pb-2">
            {dossier.activeCalls.map(c => (
              <ActiveRow key={c.id} c={c} maxVol={maxActiveVol} />
            ))}
          </div>
        </Box>
        <Box title="Busiest puts" sub="The three busiest by volume into the print · refreshes every ten seconds" testId="puts">
          <div className="pb-2">
            {dossier.activePuts.map(c => (
              <ActiveRow key={c.id} c={c} maxVol={maxActiveVol} />
            ))}
          </div>
        </Box>
      </div>

      {/* ON THE RECORD — the other two pages, read for this name. The pair shares
          one bottom edge: a name with two insider rows beside one Congress row
          used to leave the boxes different lengths (Noah, 2026-09-09: "do you
          think thats a design flaw to push publicly?" — it was). The rows sit at
          the top, the door at the foot, the room between reads as room. */}
      <div className="grid grid-cols-2 gap-4 items-stretch" data-name-record>
        <Box title="What its insiders did" sub={`Open-market trades in the last 90 days · ${insiders.trades.length ? insiders.signal : 'nothing filed'}`} testId="insiders">
          {marketInsiders.length === 0 ? (
            <div className="px-5 pb-5 pt-1 font-mono text-[10px] uppercase tracking-widest text-textMuted">Nothing on the record in 90 days</div>
          ) : (
            <>
              <div className="px-5 h-[22px] grid items-center gap-x-3 text-[9px] uppercase tracking-widest text-textMuted" style={{ gridTemplateColumns: '64px minmax(0, 1fr) 64px 80px 80px 72px' }}>
                <span>When</span>
                <span>Who</span>
                <span>Trade</span>
                <span className="text-right">Shares</span>
                <span className="text-right">Value</span>
                <span className="text-right">Chose to?</span>
              </div>
              {marketInsiders.map(t => (
                <div key={t.id} className="px-5 h-[38px] grid items-center gap-x-3 border-t border-borderSubtle/40" style={{ gridTemplateColumns: '64px minmax(0, 1fr) 64px 80px 80px 72px' }} data-name-insider={t.id}>
                  <span className="font-mono text-[10px] tnum text-textSecondary">{ago(t.daysAgo)}</span>
                  <span className="min-w-0 flex flex-col leading-tight">
                    <span className="text-[11px] font-semibold text-textPrimary truncate">{t.person}</span>
                    <span className="text-[9px] text-textMuted truncate">{t.role}</span>
                  </span>
                  <span className={`font-mono text-[10px] ${t.kind === 'BUY' ? 'text-bull' : 'text-bear'}`}>{t.kind === 'BUY' ? 'Bought' : 'Sold'}</span>
                  <span className="text-right font-mono text-[10px] tnum text-textPrimary">{Math.round(t.shares).toLocaleString('en-US')}</span>
                  <span className="text-right font-mono text-[10px] tnum font-semibold text-textPrimary">{fmtDollars(t.value)}</span>
                  <span className={`text-right font-mono text-[8px] uppercase tracking-widest ${t.plan === 'discretionary' ? (isChosenBuy(t) ? 'text-textPrimary font-bold' : 'text-textSecondary') : 'text-textMuted'}`}>
                    {t.plan === 'discretionary' ? 'chosen' : t.plan === 'plan' ? 'planned' : 'unstated'}
                  </span>
                </div>
              ))}
              <div className="mt-auto px-5 py-2.5 border-t border-borderSubtle/40 flex items-center gap-4 font-mono text-[10px] tnum" data-name-foot="insiders">
                <span className="text-textSecondary">
                  bought <span className={insiders.bought > 0 ? 'text-bull' : 'text-textMuted'}>{insiders.bought > 0 ? fmtDollars(insiders.bought) : 'nothing'}</span> · sold{' '}
                  <span className={insiders.sold > 0 ? 'text-bear' : 'text-textMuted'}>{insiders.sold > 0 ? fmtDollars(insiders.sold) : 'nothing'}</span>
                </span>
                <Link to="/record/insiders" className="ml-auto inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors">
                  <ArrowUpRight className="w-3 h-3" /> every insider
                </Link>
              </div>
            </>
          )}
        </Box>
        <Box title="What Congress reported" sub="STOCK Act reports naming this stock in the last 180 days" testId="congress">
          {congress.length === 0 ? (
            <div className="px-5 pb-5 pt-1 font-mono text-[10px] uppercase tracking-widest text-textMuted">Nothing on the record in 180 days</div>
          ) : (
            <>
              <div className="px-5 h-[22px] grid items-center gap-x-3 text-[9px] uppercase tracking-widest text-textMuted" style={{ gridTemplateColumns: '64px minmax(0, 1fr) 88px 132px 64px' }}>
                <span>Filed</span>
                <span>Member</span>
                <span>Type</span>
                <span>Amount disclosed</span>
                <span className="text-right">Lag</span>
              </div>
              {congress.slice(0, 6).map(t => (
                <div key={t.id} className="px-5 h-[38px] grid items-center gap-x-3 border-t border-borderSubtle/40" style={{ gridTemplateColumns: '64px minmax(0, 1fr) 88px 132px 64px' }} data-name-congress={t.id}>
                  <span className="font-mono text-[10px] tnum text-textSecondary">{ago(t.filedDaysAgo)}</span>
                  <span className="min-w-0 flex flex-col leading-tight">
                    <span className="text-[11px] font-semibold text-textPrimary truncate">{t.member.name}</span>
                    <span className="text-[9px] text-textMuted truncate">
                      {t.member.party}-{t.member.state} · {t.committeeOverlap ? `${t.committeeOverlap} · own committee` : t.member.chamber}
                    </span>
                  </span>
                  <span className={`font-mono text-[10px] ${t.type === 'Purchase' ? 'text-bull' : t.type === 'Exchange' ? 'text-textMuted' : 'text-bear'}`}>{t.type === 'Purchase' ? 'Purchase' : t.type === 'Exchange' ? 'Exchange' : t.type === 'Sale (Partial)' ? 'Sale · partial' : 'Sale'}</span>
                  <span className="font-mono text-[10px] tnum text-textPrimary truncate">{bracketLabel(t.bracket)}</span>
                  <span className={`text-right font-mono text-[10px] tnum ${t.late ? 'text-bear' : 'text-textSecondary'}`}>
                    {t.lagDays}d{t.late ? ' late' : ''}
                  </span>
                </div>
              ))}
              <div className="mt-auto px-5 py-2.5 border-t border-borderSubtle/40 flex items-center font-mono text-[10px]" data-name-foot="congress">
                <Link to="/record/congress" className="ml-auto inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors">
                  <ArrowUpRight className="w-3 h-3" /> every report
                </Link>
              </div>
            </>
          )}
        </Box>
      </div>
    </>
  );
};

export default EarningsName;
