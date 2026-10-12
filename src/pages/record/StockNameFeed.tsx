/*
==================================================
  SLAYER TERMINAL - A NAME'S PAGE, FROM THE FEED
  (pages/record/StockNameFeed.tsx)

  /dossier/stocks/<T> when the Dossier reads the
  vendors (2026-10-12; data/feed/rooms.ts). ALL OR
  NOTHING: the house's overview (the read, the pillars,
  the money, the wire, the score, the timeline, the
  tape) is the house's book, so none of it stands here
  — one quiet line says it is not in the feed. What the
  vendors carry, in the page's grammar:

    THE NAME       Massive's company record (the
                   name, the industry as filed, the
                   listing, the description) and UW's
                   real-time quote — the last trade,
                   the day's change from the session
                   before, the quote, the day's range
    THE SESSIONS   Massive's daily bars, the sixty
                   days to the session before
    NEXT REPORT    UW's earnings record — a door to
                   the name's earnings page
    ON THE RECORD  UW's insider filings and Congress
                   reports naming the name — what was
                   filed, never what to do

  A NAME MASSIVE HAS NO RECORD OF IS NOT FOUND (its
  404), said plainly with the way back. Massive's five
  calls a minute: the record is asked once a name (the
  proxy keeps it a day), the bars once a half hour.
==================================================
*/

import { useMemo, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { SayPage } from '../../components/layout/PageMeta';
import CompanyLogo from '../../components/ui/CompanyLogo';
import SessionsChart from '../../components/record/SessionsChart';
import { When } from '../../components/record/when';
import { Missing, MissingLine, missing } from '../../components/record/Missing';
import { fmtDayLocal } from '../../components/gex/chartTime';
import type { UTCTimestamp } from 'lightweight-charts';
import { changeTicker } from '../../context/MarketDataContext';
import { expiryLabel, isoDayLabel, numCompact, usd, usdCompact } from '../../core/format';
import { nyClock } from '../../core/nyTime';
import { fmtDollars } from '../../data/ahead';
import { bracketLabel, seatOf } from '../../data/congress';
import { TX_CODES, isChosenBuy } from '../../data/insiders';
import { nextReportOf, useFeedBars, useFeedCongressFor, useFeedInsidersFor, useFeedNameRecord, useFeedQuote, useFeedReports } from '../../data/feed/dossier';
import { StockNameSkeleton } from './recordSkeletons';

const pct = (v: number, d = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}%`;

const Box = ({ title, sub, testId, children }: { title: string; sub?: ReactNode; testId: string; children: ReactNode }) => (
  <div className="border border-borderSubtle rounded-md bg-panel flex flex-col" data-stock-box={testId}>
    <div className="px-5 pt-4 pb-3">
      <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">{title}</h3>
      {sub && <p className="mt-0.5 text-[11px] text-textMuted truncate">{sub}</p>}
    </div>
    {children}
  </div>
);
const Fact = ({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) => (
  <div className="min-w-0">
    <dt className="text-[11px] text-textMuted whitespace-nowrap">{label}</dt>
    <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap truncate" data-stock-fact={testId}>
      {children}
    </dd>
  </div>
);
const Door = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button type="button" onClick={onClick} className="hit inline-flex items-center gap-1 h-6 px-2 rounded-md border border-borderSubtle bg-chip hover:border-borderMuted font-mono text-[11px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors">
    <ArrowUpRight className="w-3 h-3" />
    {children}
  </button>
);
const M = () => <Missing className="text-[12px]" />;

/** No such name: said plainly, with the way back to the list */
const NotFound = ({ T }: { T: string }) => (
  <div className="border border-borderSubtle rounded-md bg-panel px-6 py-10 flex flex-col items-center gap-3 text-center" data-stock-missing={T}>
    <SayPage words="Not found" />
    <p className="text-[15px] font-semibold text-textPrimary">Not found — no listed name called {T || 'that'}</p>
    <p className="text-[12px] text-textMuted max-w-[420px]">No company record answers to this ticker. Check the ticker, or pick a name from the list.</p>
    <Link to="/dossier/stocks" className="hit inline-flex items-center h-8 px-4 rounded-full border border-borderMuted text-[12px] font-semibold text-textPrimary hover:border-silver/60 transition-colors">
      Back to the stocks
    </Link>
  </div>
);

const StockNameFeed = ({ T }: { T: string }) => {
  const navigate = useNavigate();
  const record = useFeedNameRecord(true, T);
  /* nothing else is asked until the record says the name exists */
  const known = !!(record?.ok && record.data.details);
  const quote = useFeedQuote(known, T);
  const bars = useFeedBars(known, T);
  const reports = useFeedReports(known, T);
  const insiders = useFeedInsidersFor(known, T);
  const congress = useFeedCongressFor(known, T);

  const back = (
    <div className="flex items-center gap-4 flex-wrap" data-name-back>
      <Link to="/dossier/stocks" className="hit group inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors">
        <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" /> The list
      </Link>
    </div>
  );

  const points = useMemo(() => (bars?.ok ? bars.data.map(b => ({ time: Math.round(b.t / 1000), value: b.c })) : []), [bars]);
  const range = useMemo((): readonly [number, number] | undefined => {
    if (!bars?.ok || bars.data.length < 2) return undefined;
    return [Math.min(...bars.data.map(b => b.l)), Math.max(...bars.data.map(b => b.h))];
  }, [bars]);

  if (record === null)
    return (
      <>
        {back}
        <StockNameSkeleton />
      </>
    );
  if (record.ok && !record.data.details)
    return (
      <>
        {back}
        <NotFound T={T} />
      </>
    );
  if (!record.ok)
    return (
      <>
        {back}
        <div className="border border-borderSubtle rounded-md bg-panel h-40 flex flex-col items-center justify-center gap-2" data-stock-unanswered={T}>
          <span className="font-mono text-[13px] font-bold text-textPrimary">{T}</span>
          <span className="font-mono text-[11px] uppercase tracking-widest text-textMuted">no company record came back — asked again shortly</span>
        </div>
      </>
    );

  const d = record.data.details!;
  const q = quote?.ok ? quote.data.quote : null;
  const st = quote?.ok ? quote.data.state : null;
  const last = q?.last ?? st?.close ?? NaN;
  const prev = st?.prevClose ?? NaN;
  const change = !missing(last) && !missing(prev) && prev > 0 ? last - prev : NaN;
  const changePct = !missing(change) ? (change / prev) * 100 : NaN;
  const next = reports?.ok ? nextReportOf(reports.data) : null;
  const flow = insiders?.ok ? insiders.data : null;
  const market = flow ? flow.trades.filter(t => TX_CODES[t.code].openMarket).slice(0, 5) : [];
  const reportsFiled = congress?.ok ? congress.data.slice(0, 5) : [];
  const firstBar = bars?.ok && bars.data.length ? bars.data[0] : null;
  const lastBar = bars?.ok && bars.data.length ? bars.data[bars.data.length - 1] : null;
  const spanPct = firstBar && lastBar && firstBar.c > 0 ? ((lastBar.c - firstBar.c) / firstBar.c) * 100 : NaN;

  return (
    <>
      {back}

      {/* THE NAME */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-stock-name={T} data-stock-source="feed">
        <SayPage words={d.name || T} />
        <div className="px-5 pt-4 pb-4 flex items-start gap-6 flex-wrap">
          <div className="min-w-0 flex-1 flex items-center gap-3">
            <CompanyLogo ticker={T} size={34} />
            <div className="min-w-0">
              <div className="h-6 flex items-center gap-2.5">
                <h3 className="min-w-0 truncate text-[15px] font-semibold leading-tight text-textPrimary">{d.name || T}</h3>
                <span className="font-mono text-[11px] font-bold text-textSecondary">{T}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-textMuted flex flex-wrap gap-x-1.5" data-stock-industry>
                {d.sicDescription ? <span className="capitalize">{d.sicDescription.toLowerCase()}</span> : <Missing />}
                {d.primaryExchange && <span>· {d.primaryExchange}</span>}
                {d.type && <span>· {d.type === 'CS' ? 'common stock' : d.type}</span>}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2" data-stock-quote>
            <Fact label="Last" testId="last">
              {missing(last) ? <M /> : usd(last)}
            </Fact>
            <Fact label="Today" testId="today">
              {missing(changePct) ? (
                <M />
              ) : (
                <span className={changePct >= 0 ? 'text-bull' : 'text-bear'} data-dir={changePct >= 0 ? 'up' : 'down'}>
                  {pct(changePct)} <span className="text-textMuted">· {change >= 0 ? '+' : '−'}{usd(Math.abs(change))}</span>
                </span>
              )}
            </Fact>
            <Fact label="Bid · ask" testId="quote">
              {q && !missing(q.bid ?? NaN) && !missing(q.ask ?? NaN) ? (
                <>
                  {usd(q.bid!)} <span className="text-textMuted">·</span> {usd(q.ask!)}
                </>
              ) : (
                <M />
              )}
            </Fact>
            <Fact label="As of" testId="asof">
              {q && Number.isFinite(q.lastTime) ? <>{nyClock(q.lastTime, { zone: true })}</> : <M />}
            </Fact>
            <Fact label="Day's range" testId="range">
              {st && !missing(st.low ?? NaN) && !missing(st.high ?? NaN) ? (
                <>
                  {usd(st.low!)} <span className="text-textMuted">–</span> {usd(st.high!)}
                </>
              ) : (
                <M />
              )}
            </Fact>
            <Fact label="Opened" testId="open">
              {st && !missing(st.open ?? NaN) ? usd(st.open!) : <M />}
            </Fact>
            <Fact label="Volume" testId="volume">
              {st && st.totalVolume > 0 ? numCompact(st.totalVolume) : <M />}
            </Fact>
            <Fact label="Market value" testId="cap">
              {missing(d.marketCap) ? <M /> : d.marketCap! >= 1e12 ? `$${(d.marketCap! / 1e12).toFixed(2)}T` : usdCompact(d.marketCap!)}
            </Fact>
          </dl>
        </div>
        {d.description && (
          <p className="px-5 pb-3 text-[12px] leading-relaxed text-textSecondary max-w-[980px]" data-stock-description>
            {d.description}
          </p>
        )}
        <dl className="px-5 pb-3 flex flex-wrap gap-x-6 gap-y-2" data-stock-company>
          <Fact label="Listed since">{d.listDate ? expiryLabel(d.listDate) : <M />}</Fact>
          <Fact label="Employees">{missing(d.totalEmployees) ? <M /> : d.totalEmployees!.toLocaleString('en-US')}</Fact>
          <Fact label="Shares out">{missing(d.sharesOutstanding) ? <M /> : numCompact(d.sharesOutstanding!)}</Fact>
          <Fact label="Website">{d.homepage ? d.homepage.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : <M />}</Fact>
        </dl>
        <div className="px-5 pb-3 flex items-center gap-2 flex-wrap" data-name-doors>
          <Door
            onClick={() => {
              changeTicker(T);
              navigate('/pinpoint/map');
            }}
          >
            The Map
          </Door>
          <Door onClick={() => navigate('/weigher', { state: { weigh: { ticker: T } } })}>Weigh it</Door>
          <Door onClick={() => navigate(`/dossier/earnings/${T}`)}>Earnings</Door>
        </div>
      </div>

      {/* THE SESSIONS */}
      <Box
        title="The sessions"
        sub={
          bars?.ok && bars.data.length
            ? `Daily closes, the last ${bars.data.length} sessions to ${isoDayLabel(new Date(lastBar!.t).toISOString())} · ${missing(spanPct) ? '' : `${pct(spanPct, 1)} over them`}`
            : 'Daily closes'
        }
        testId="sessions"
      >
        {points.length >= 2 ? (
          <div className="px-3 pb-3">
            <SessionsChart
              testId="feed-sessions"
              kind="line"
              height={200}
              ink="rgb(var(--text-primary))"
              points={points}
              range={range}
              zone="ny"
              card={({ point: p, prev: pp }) =>
                p && (
                  <>
                    <span className="font-mono text-[11px] font-bold tnum text-textPrimary">{fmtDayLocal(p.time as UTCTimestamp, 'ny')}</span>
                    <span className="font-mono tnum">
                      closed <span className="text-textPrimary">{p.value.toFixed(2)}</span>
                      {pp && (
                        <span className={p.value >= pp.value ? 'text-bull' : 'text-bear'}>
                          {' '}
                          {pct(((p.value - pp.value) / pp.value) * 100)}
                        </span>
                      )}
                    </span>
                  </>
                )
              }
            />
          </div>
        ) : bars === null ? (
          <div className="px-5 pb-4 h-[200px]" />
        ) : (
          <MissingLine what="The sessions" />
        )}
      </Box>

      {/* THE NEXT REPORT */}
      <Box title="The next report" sub="When the company reports next, and the move its options price for it" testId="report">
        {next ? (
          <dl className="px-5 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2" data-stock-report>
            <Fact label="Reports">
              {isoDayLabel(next.reportDate)} <span className="text-textMuted">· {next.reportTime === 'premarket' ? 'before the open' : 'after the close'}</span>
            </Fact>
            <Fact label="Options price">{next.expectedMovePct == null ? <M /> : `±${(next.expectedMovePct * 100).toFixed(1)}%`}</Fact>
            <Fact label="Estimate">{next.streetMeanEst == null ? <M /> : `$${next.streetMeanEst.toFixed(2)} a share`}</Fact>
            <div className="flex items-end">
              <Door onClick={() => navigate(`/dossier/earnings/${T}`)}>Its earnings page</Door>
            </div>
          </dl>
        ) : reports === null ? (
          <div className="px-5 pb-4 h-[40px]" />
        ) : (
          <div className="px-5 pb-4 pt-1 font-mono text-[11px] uppercase tracking-widest text-textMuted">No report date ahead on the record</div>
        )}
      </Box>

      {/* WHAT THE FEED DOES NOT CARRY */}
      <Box title="The read" sub="The screen, the four pillars, the money, the wire, what carries the read, the timeline and the tape" testId="read">
        <MissingLine what="The house's read of the name" />
      </Box>

      {/* ON THE RECORD */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch" data-name-record>
        <Box title="What its insiders did" sub={flow ? `Open-market trades among the latest filings · ${flow.trades.length ? flow.signal : 'nothing filed'}` : 'Open-market trades'} testId="insiders">
          {market.length === 0 ? (
            <div className="px-5 pb-5 pt-1 font-mono text-[11px] uppercase tracking-widest text-textMuted">{insiders === null ? '' : 'No open-market trade among the latest filings'}</div>
          ) : (
            <>
              {market.map(t => (
                <div key={t.id} className="px-5 h-[38px] grid items-center gap-x-3 border-t border-borderSubtle/40 grid-cols-[96px_minmax(0,1fr)_64px_80px_72px] max-lg:grid-cols-[96px_minmax(0,1fr)_64px_80px]" data-name-insider={t.id}>
                  <When days={t.daysAgo} iso={t.tradedOn} />
                  <span className="min-w-0 flex flex-col leading-tight">
                    <span className="text-[11px] font-semibold text-textPrimary truncate">{t.person}</span>
                    <span className="text-[11px] text-textMuted truncate">{t.title || t.role}</span>
                  </span>
                  <span className={`font-mono text-[11px] ${t.kind === 'BUY' ? 'text-bull' : 'text-bear'}`}>{t.kind === 'BUY' ? 'Bought' : 'Sold'}</span>
                  <span className="text-right font-mono text-[11px] tnum font-semibold text-textPrimary">{missing(t.value) ? <Missing /> : fmtDollars(t.value)}</span>
                  <span className={`text-right font-mono text-[11px] uppercase tracking-widest max-lg:hidden ${t.plan === 'discretionary' ? (isChosenBuy(t) ? 'text-textPrimary font-bold' : 'text-textSecondary') : 'text-textMuted'}`}>
                    {t.plan === 'discretionary' ? 'chosen' : t.plan === 'plan' ? 'planned' : 'unstated'}
                  </span>
                </div>
              ))}
              <div className="mt-auto px-5 py-2.5 border-t border-borderSubtle/40 flex items-center gap-4 font-mono text-[11px] tnum" data-name-foot="insiders">
                <Link to="/dossier/insiders" className="hit ml-auto inline-flex items-center gap-1 text-[11px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors">
                  <ArrowUpRight className="w-3 h-3" /> every insider
                </Link>
              </div>
            </>
          )}
        </Box>
        <Box title="What Congress reported" sub="Reports naming this stock, the latest filed first" testId="congress">
          {reportsFiled.length === 0 ? (
            <div className="px-5 pb-5 pt-1 font-mono text-[11px] uppercase tracking-widest text-textMuted">{congress === null ? '' : 'No report names this stock'}</div>
          ) : (
            <>
              {reportsFiled.map(t => (
                <div key={t.id} className="px-5 h-[38px] grid items-center gap-x-3 border-t border-borderSubtle/40 grid-cols-[96px_minmax(0,1fr)_88px_132px] max-lg:grid-cols-[96px_minmax(0,1fr)_88px]" data-name-congress={t.id}>
                  <When days={t.filedDaysAgo} iso={t.filedOn} />
                  <span className="min-w-0 flex flex-col leading-tight">
                    <span className="text-[11px] font-semibold text-textPrimary truncate">{t.member.name}</span>
                    <span className="text-[11px] text-textMuted truncate">{[seatOf(t.member), t.member.chamber, t.owner].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className={`font-mono text-[11px] ${t.type === 'Purchase' ? 'text-bull' : t.type === 'Exchange' ? 'text-textMuted' : 'text-bear'}`}>{t.type === 'Purchase' ? 'Purchase' : t.type === 'Exchange' ? 'Exchange' : t.type === 'Sale (Partial)' ? 'Sale · partial' : 'Sale'}</span>
                  <span className="font-mono text-[11px] tnum text-textPrimary truncate max-lg:hidden">{bracketLabel(t.bracket)}</span>
                </div>
              ))}
              <div className="mt-auto px-5 py-2.5 border-t border-borderSubtle/40 flex items-center font-mono text-[11px]" data-name-foot="congress">
                <Link to="/dossier/congress" className="hit ml-auto inline-flex items-center gap-1 text-[11px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors">
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

export default StockNameFeed;
