/*
==================================================
  SLAYER TERMINAL - THE STOCK OVERVIEW
  (pages/record/StockOverview.tsx)

  A name's own page under the Record (Noah,
  2026-09-13: "when I click on it stop sending me
  to the pinpoint page, I need a thing like the
  compass analysis where it tells me all about the
  stock overview…"). Every section of the list he
  gave, in the information grammar: a label, a
  figure, one line under it. Read top to bottom —

    THE VERDICT      the name, the price, the
                     market's status, good buy or
                     bad, buy · hold · sell, the
                     stance, the overall score, the
                     four sleeves as bars
    THE SLEEVES      Trend · Numbers · Money · News,
                     each with its figures
    VALUATION · OPTIONS POSITIONING · DARK POOL
    THE WIRE         the headlines, the catalysts
    THE SCORE        how it is put together, what
                     would change it, its history,
                     the method, whether the
                     factors agree, the timeline,
                     the sensitivity, the timestamps
    WHY NOW          the changes that matter, what
                     is driving the stock, one
                     paragraph from the raw data to
                     the signal
    THE PEOPLE       the insiders, Congress, the
                     option flow's biggest buys and
                     sells

  The numbers are data/stockOverview.ts; the page
  is a reader. A jump list rides the top so the
  long page is one screen away from any section.
==================================================
*/

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useMarketData } from '../../context/MarketDataContext';
import { buildStockOverview, type Fact, type Sleeve, type Tone } from '../../data/stockOverview';
import { bracketLabel } from '../../data/congress';
import { TX_CODES } from '../../data/insiders';
import CompanyLogo from '../../components/ui/CompanyLogo';
import ContractLabel from '../../components/ui/ContractLabel';
import { Name } from '../../components/ui/Name';
import RichRead from '../../components/ui/RichRead';
import CatTag from '../../components/news/CatTag';
import { RecordTableBoxSkeleton } from './recordSkeletons';

/** The page re-reads the name on the scan cadence — a verdict must not vibrate with every tick */
const SCAN_INTERVAL_MS = 10_000;
const TONE: Record<Tone, string> = { bull: 'text-bull', bear: 'text-bear', warn: 'text-warn', plain: 'text-textPrimary', silver: 'text-silver' };
const STATUS: Record<Sleeve['status'], string> = { Strong: 'bg-bull/10 text-bull border-bull/25', Neutral: 'bg-ink/[0.05] text-textPrimary border-borderSubtle', Weak: 'bg-bear/10 text-bear border-bear/25' };
const SECTIONS = [
  ['verdict', 'Verdict'],
  ['trend', 'Trend'],
  ['numbers', 'Numbers'],
  ['money', 'Money'],
  ['news', 'News'],
  ['valuation', 'Valuation'],
  ['options', 'Options'],
  ['dark', 'Dark pool'],
  ['wire', 'The wire'],
  ['score', 'The score'],
  ['history', 'History'],
  ['method', 'Method'],
  ['agree', 'Agreement'],
  ['timeline', 'Timeline'],
  ['why', 'Why now'],
  ['people', 'Insiders & Congress'],
  ['flow', 'Option flow'],
] as const;

const fmtUsd = (v: number) => (Math.abs(v) >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v.toFixed(0)}`);

/* ---- the grammar ------------------------------------------------------------------------ */

const Box = ({ id, title, line, children, right }: { id: string; title: string; line?: string; children: React.ReactNode; right?: React.ReactNode }) => (
  <section id={`so-${id}`} className="border border-borderSubtle rounded-md bg-panel scroll-mt-4" data-so-box={id}>
    <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">{title}</h3>
        {line && <p className="mt-0.5 text-[11px] text-textSecondary">{line}</p>}
      </div>
      {right}
    </div>
    <div className="border-t border-borderSubtle">{children}</div>
  </section>
);

/** The information rows: a label, the figure in its ink, one line under it */
const Facts = ({ facts, cols = 4 }: { facts: Fact[]; cols?: number }) => (
  <dl className={`grid gap-x-6 gap-y-3 px-5 py-4 ${cols === 4 ? 'grid-cols-2 md:grid-cols-4' : cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`} data-so-facts>
    {facts.map(f => (
      <div key={f.k} className="min-w-0" data-so-fact={f.k}>
        <dt className="text-[10px] text-textSecondary whitespace-nowrap truncate">{f.k}</dt>
        <dd className={`mt-0.5 font-mono text-[13px] font-semibold tnum leading-tight ${TONE[f.tone ?? 'plain']}`}>{f.v}</dd>
        {f.note && <dd className="mt-0.5 text-[10.5px] leading-snug text-textSecondary">{f.note}</dd>}
      </div>
    ))}
  </dl>
);

const Lines = ({ title, items, ink = 'text-textPrimary' }: { title: string; items: string[]; ink?: string }) => (
  <div className="min-w-0">
    <div className="text-[9px] uppercase tracking-widest text-textSecondary">{title}</div>
    <ul className="mt-1 space-y-1">
      {items.map((t, i) => (
        <li key={i} className={`text-[11.5px] leading-snug ${ink}`}>
          <RichRead text={t} />
        </li>
      ))}
    </ul>
  </div>
);

const ScoreBar = ({ score, label, status }: { score: number; label: string; status?: Sleeve['status'] }) => (
  <div className="min-w-0" data-so-bar={label}>
    <div className="flex items-center justify-between font-mono text-[10px]">
      <span className="text-textSecondary uppercase tracking-widest">{label}</span>
      <span className="text-textPrimary font-semibold tnum">
        {score}
        {status && <span className={`ml-2 inline-flex items-center h-4 px-1.5 rounded border text-[8px] font-bold uppercase tracking-wider ${STATUS[status]}`}>{status}</span>}
      </span>
    </div>
    <div className="mt-1 h-[6px] rounded-full bg-ink/[0.06] overflow-hidden">
      <span className="block h-full rounded-full" style={{ width: `${score}%`, background: score >= 62 ? 'rgb(var(--bull))' : score >= 42 ? 'rgb(var(--silver))' : 'rgb(var(--bear))' }} />
    </div>
  </div>
);

/* ---- the page ------------------------------------------------------------------------ */

const StockOverview = () => {
  const { ticker = 'SPY' } = useParams();
  const { flowTape } = useMarketData();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick(t => t + 1), SCAN_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);
  const so = useMemo(() => buildStockOverview(ticker, flowTape), [ticker, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!so) return <RecordTableBoxSkeleton rows={10} cols={6} />;
  const v = so.verdict;
  const stanceInk = v.stance === 'Bullish' ? 'text-bull' : v.stance === 'Bearish' ? 'text-bear' : 'text-textPrimary';
  const sleeve = (key: Sleeve['key']) => so.sleeves.find(s => s.key === key)!;

  return (
    <div className="flex flex-col gap-4" data-stock-overview={so.ticker}>
      {/* THE JUMP LIST */}
      <div className="flex items-center gap-2 flex-wrap font-mono text-[9px] uppercase tracking-widest" data-so-jumps>
        <Link to="/record/stocks" className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-borderSubtle bg-chip text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors">
          <ArrowLeft className="w-3 h-3" /> Stocks
        </Link>
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#so-${id}`} className="inline-flex items-center h-6 px-2 rounded-md text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06] transition-colors">
            {label}
          </a>
        ))}
      </div>

      {/* THE VERDICT */}
      <Box id="verdict" title="Stock overview" line={`${so.name} · ${so.sector} · the whole read on one page`}>
        <div className="px-5 py-4 flex items-start gap-8 flex-wrap">
          <div className="flex items-center gap-3">
            <CompanyLogo ticker={so.ticker} size={40} />
            <div>
              <div className="font-mono text-[22px] font-bold leading-none text-textPrimary">{so.ticker}</div>
              <div className="mt-1 text-[12px] text-textSecondary">{so.name}</div>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-textSecondary">Price</div>
            <div className="font-mono text-[22px] font-bold tnum leading-none text-textPrimary">${so.price.toFixed(2)}</div>
            <div className={`mt-1 font-mono text-[12px] tnum ${so.changePct >= 0 ? 'text-bull' : 'text-bear'}`}>
              {so.changePct >= 0 ? '+' : ''}
              {so.changePct.toFixed(2)}% today
            </div>
          </div>
          <div>
            <div className="text-[10px] text-textSecondary">Market status</div>
            <div className="mt-1 font-mono text-[13px] text-textPrimary">{so.marketStatus}</div>
          </div>
          <div className="grid grid-cols-3 gap-x-6">
            <div>
              <div className="text-[10px] text-textSecondary">Good buy / bad buy</div>
              <div className={`mt-1 font-mono text-[15px] font-bold ${v.quality === 'Good buy' ? 'text-bull' : v.quality === 'Bad buy' ? 'text-bear' : 'text-textPrimary'}`}>{v.quality}</div>
            </div>
            <div>
              <div className="text-[10px] text-textSecondary">Buy / hold / sell</div>
              <div className={`mt-1 font-mono text-[15px] font-bold ${stanceInk}`}>{v.action}</div>
            </div>
            <div>
              <div className="text-[10px] text-textSecondary">Bullish / neutral / bearish</div>
              <div className={`mt-1 font-mono text-[15px] font-bold ${stanceInk}`}>{v.stance}</div>
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[10px] text-textSecondary">Overall stock score</div>
            <div className={`font-mono text-[34px] font-bold tnum leading-none ${stanceInk}`}>{v.score}</div>
            <div className="text-[10px] text-textSecondary">of 100</div>
          </div>
        </div>
        <div className="px-5 pb-4 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3" data-so-sleeve-bars>
          {so.sleeves.map(s => (
            <ScoreBar key={s.key} score={s.score} label={`${s.label} score`} status={s.status} />
          ))}
        </div>
      </Box>

      {/* THE SLEEVES */}
      {(['trend', 'numbers', 'money', 'news'] as const).map(key => {
        const s = sleeve(key);
        return (
          <Box
            key={key}
            id={key}
            title={s.label}
            line={s.read}
            right={
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center h-6 px-2 rounded-md border font-mono text-[10px] font-bold uppercase tracking-wider ${STATUS[s.status]}`}>{s.status}</span>
                <span className="font-mono text-[20px] font-bold tnum text-textPrimary">{s.score}</span>
              </div>
            }
          >
            <Facts facts={s.facts} />
          </Box>
        );
      })}

      {/* VALUATION · OPTIONS · DARK POOL */}
      <Box id="valuation" title="Valuation" line="Fair value against the price — a range, not a promise">
        <Facts facts={so.valuation} />
      </Box>
      <Box id="options" title="Options positioning" line="The dealer book on the name — the same figures the Map and the greek board read">
        <Facts facts={so.options} />
      </Box>
      <Box id="dark" title="Dark pool" line={so.darkPool.view.postureNote}>
        <Facts facts={so.darkPool.facts} />
      </Box>

      {/* THE WIRE */}
      <Box id="wire" title="The wire" line="The headlines on the name today, and the catalysts ahead">
        {so.headlines.length === 0 ? (
          <div className="px-5 py-5 text-center font-mono text-[10px] uppercase tracking-widest text-textSecondary">Nothing on the wire for this name today</div>
        ) : (
          <div>
            {so.headlines.slice(0, 8).map(h => (
              <div key={h.id} className="px-5 py-2 border-b border-borderSubtle/40 grid items-center gap-x-3" style={{ gridTemplateColumns: '64px 96px minmax(0,1fr) 96px 90px' }} data-so-headline={h.id}>
                <span className="font-mono text-[10px] tnum text-textSecondary">{h.time}</span>
                <CatTag category={h.category} size={9} />
                <span className="min-w-0 truncate text-[12px] text-textPrimary">{h.headline}</span>
                <span className={`font-mono text-[10px] uppercase tracking-widest ${h.sentiment > 0.15 ? 'text-bull' : h.sentiment < -0.15 ? 'text-bear' : 'text-textSecondary'}`}>{h.sentiment > 0.15 ? 'positive' : h.sentiment < -0.15 ? 'negative' : 'neutral'}</span>
                <span className="font-mono text-[10px] text-textSecondary text-right">{h.source}</span>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-borderSubtle">
          <Facts facts={so.catalysts} />
        </div>
      </Box>

      {/* THE SCORE */}
      <Box id="score" title="Score composition" line={`Previous ${so.composition.previous} → current ${so.composition.current} · confidence ${so.composition.confidence}% · data completeness ${so.composition.completeness}%`}>
        <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-textSecondary">Raw inputs · weights · contributions</div>
            <table className="mt-2 w-full font-mono text-[11px] tnum">
              <tbody>
                {so.composition.inputs.map(i => (
                  <tr key={i.label} className="border-t border-borderSubtle/40">
                    <td className="py-1.5 text-textSecondary">{i.label}</td>
                    <td className="py-1.5 text-textPrimary">{i.raw}</td>
                    <td className="py-1.5 text-textPrimary">×{i.weight.toFixed(2)}</td>
                    <td className={`py-1.5 text-right font-semibold ${i.contribution >= 0 ? 'text-bull' : 'text-bear'}`}>
                      {i.contribution >= 0 ? '+' : ''}
                      {i.contribution}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <Lines title="Positive contributors" items={so.composition.positives} ink="text-bull" />
            <Lines title="Negative contributors" items={so.composition.negatives} ink="text-bear" />
            <Lines title="What would change the score" items={so.composition.wouldChange} />
          </div>
        </div>
      </Box>
      <Box id="history" title="The score's history" line="Where today's reading sits against its own past">
        <Facts facts={so.history} />
      </Box>
      <Box id="method" title="Method" line="What was observed, what was derived from it, what was inferred">
        <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Lines title="Observed · raw data" items={so.method.observed} />
          <Lines title="Derived calculations" items={so.method.derived} />
          <Lines title="Inference" items={[...so.method.inference, so.method.crossFactor]} />
        </div>
      </Box>
      <Box id="agree" title="Do the factors agree?" line={`${so.confirmation.aligned} of 4 factors aligned with the ${v.stance.toLowerCase()} read`}>
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            {so.confirmation.statuses.map(s => (
              <span key={s.label} className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-md border font-mono text-[10px] font-bold uppercase tracking-wider ${STATUS[s.status]}`}>
                {s.label} · {s.status}
              </span>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Lines title="Confirming factors" items={so.confirmation.confirming.length ? so.confirmation.confirming : ['none']} ink="text-textPrimary" />
            <Lines title="Contradictions · conflicting factors" items={so.confirmation.contradictions.length ? so.confirmation.contradictions : ['none']} ink="text-textPrimary" />
            <Lines title="Primary disagreement" items={[so.confirmation.primaryDisagreement]} />
            <Lines title="Main risk from the conflict" items={[so.confirmation.mainRisk]} ink="text-warn" />
          </div>
        </div>
      </Box>
      <Box id="timeline" title="Signal timeline" line="Earnings, news, volume spikes, breakouts and positioning changes on the sessions on hand — with the score as it stood">
        {so.timeline.length === 0 ? (
          <div className="px-5 py-5 text-center font-mono text-[10px] uppercase tracking-widest text-textSecondary">A quiet stretch — nothing to mark</div>
        ) : (
          so.timeline.map((t, i) => (
            <div key={i} className="px-5 py-2 border-b border-borderSubtle/40 last:border-b-0 grid items-center gap-x-3" style={{ gridTemplateColumns: '72px 84px minmax(0,1fr) 60px' }} data-so-timeline={t.kind}>
              <span className="font-mono text-[10px] tnum text-textSecondary">{t.when}</span>
              <span className={`font-mono text-[9px] font-bold uppercase tracking-widest ${t.kind === 'earnings' ? 'text-warn' : t.kind === 'breakout' ? 'text-bull' : t.kind === 'news' ? 'text-silver' : 'text-textSecondary'}`}>{t.kind}</span>
              <span className="min-w-0 truncate text-[12px] text-textPrimary">{t.text}</span>
              <span className="font-mono text-[11px] tnum text-right text-textPrimary">score {t.score}</span>
            </div>
          ))
        )}
        <div className="border-t border-borderSubtle px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-textSecondary">Score sensitivity · drivers</div>
            <table className="mt-2 w-full font-mono text-[11px] tnum">
              <tbody>
                {so.sensitivity.drivers.map(d => (
                  <tr key={d.label} className="border-t border-borderSubtle/40">
                    <td className="py-1.5 text-textSecondary">{d.label}</td>
                    <td className="py-1.5 text-textPrimary">{d.hypothetical}</td>
                    <td className={`py-1.5 text-right font-semibold ${d.delta >= 0 ? 'text-bull' : 'text-bear'}`}>
                      {d.delta >= 0 ? '+' : ''}
                      {d.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-widest text-textSecondary">Component weights · timestamps</div>
            <div className="mt-2 flex items-center gap-4 font-mono text-[11px] tnum text-textPrimary">
              {so.sensitivity.weights.map(w => (
                <span key={w.label}>
                  {w.label} <span className="text-textSecondary">×{w.weight.toFixed(2)}</span>
                </span>
              ))}
            </div>
            <Facts facts={so.timestamps} cols={3} />
          </div>
        </div>
      </Box>

      {/* WHY NOW */}
      <Box id="why" title="Why now" line={`What is driving ${so.ticker} right now`}>
        <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Lines title="Most important current changes" items={so.whyNow.changes} />
          <div>
            <Lines title="What is driving the stock" items={[so.whyNow.driving]} />
            <div className="mt-3 text-[9px] uppercase tracking-widest text-textSecondary">From the raw data to the signal</div>
            <p className="mt-1 text-[12px] leading-relaxed text-textPrimary">
              <RichRead text={so.whyNow.explanation} />
            </p>
          </div>
        </div>
      </Box>

      {/* THE PEOPLE */}
      <Box id="people" title="Insiders and Congress" line={`${so.insiders.read} · ${so.congress.read}`}>
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="border-b lg:border-b-0 lg:border-r border-borderSubtle">
            <div className="px-5 h-[26px] flex items-center gap-4 font-mono text-[9px] uppercase tracking-widest text-textSecondary">
              <span>Who holds it · what they did</span>
              <span className="ml-auto normal-case tracking-normal text-[10px] tnum">
                bought <span className="text-bull">{fmtUsd(so.insiders.bought)}</span> · sold <span className="text-bear">{fmtUsd(so.insiders.sold)}</span>
              </span>
            </div>
            {so.insiders.trades.length === 0 ? (
              <div className="px-5 py-5 text-center font-mono text-[10px] uppercase tracking-widest text-textSecondary">Nothing filed in 90 days</div>
            ) : (
              so.insiders.trades.map(t => (
                <div key={t.id} className="px-5 py-2 border-t border-borderSubtle/40 grid items-center gap-x-3" style={{ gridTemplateColumns: 'minmax(0,1fr) 64px 80px 80px' }} data-so-insider={t.id}>
                  <span className="min-w-0">
                    <span className="block text-[12px] text-textPrimary truncate">{t.person}</span>
                    <span className="block text-[10px] text-textSecondary truncate">
                      {t.role} · holds {t.heldAfter.toLocaleString('en-US')} after · {t.daysAgo === 0 ? 'today' : `${t.daysAgo}d ago`}
                    </span>
                  </span>
                  <span className={`font-mono text-[10px] font-bold uppercase tracking-wider ${t.code === 'P' ? 'text-bull' : t.code === 'S' ? 'text-bear' : 'text-textSecondary'}`}>{TX_CODES[t.code].label}</span>
                  <span className="font-mono text-[11px] tnum text-textPrimary text-right">{fmtUsd(t.value)}</span>
                  <span className="font-mono text-[10px] tnum text-textSecondary text-right">{t.plan === 'plan' ? 'on a plan' : t.plan === 'discretionary' ? 'chosen' : 'unstated'}</span>
                </div>
              ))
            )}
          </div>
          <div>
            <div className="px-5 h-[26px] flex items-center font-mono text-[9px] uppercase tracking-widest text-textSecondary">Congress · who traded it, and the boards they sit on</div>
            {so.congress.trades.length === 0 ? (
              <div className="px-5 py-5 text-center font-mono text-[10px] uppercase tracking-widest text-textSecondary">No member reported trading it in 180 days</div>
            ) : (
              so.congress.trades.map(t => (
                <div key={t.id} className="px-5 py-2 border-t border-borderSubtle/40 grid items-center gap-x-3" style={{ gridTemplateColumns: 'minmax(0,1fr) 72px 120px' }} data-so-congress={t.id}>
                  <span className="min-w-0">
                    <span className="block text-[12px] text-textPrimary truncate">
                      {t.member.name} <span className="text-textSecondary">· {t.member.chamber} · {t.member.party}-{t.member.state}</span>
                    </span>
                    <span className="block text-[10px] text-textSecondary truncate">
                      {t.overlap ? <span className="text-warn">sits on {t.overlap} · </span> : null}
                      {t.member.committees.join(' · ')} · filed {t.filedDaysAgo}d ago{t.late ? ' · late' : ''}
                    </span>
                  </span>
                  <span className={`font-mono text-[10px] font-bold uppercase tracking-wider ${t.type === 'Purchase' ? 'text-bull' : 'text-bear'}`}>{t.type.toLowerCase()}</span>
                  <span className="font-mono text-[10px] tnum text-textSecondary text-right">{bracketLabel(t.bracket)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </Box>

      {/* THE OPTION FLOW */}
      <Box id="flow" title="Option flow" line={`The biggest buys and sells on the tape today · calls ${fmtUsd(so.flow.callPremium)} · puts ${fmtUsd(so.flow.putPremium)}`}>
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {[
            ['Biggest buys', so.flow.buys, 'text-bull'],
            ['Biggest sells', so.flow.sells, 'text-bear'],
          ].map(([title, rows, ink]) => (
            <div key={title as string} className="first:border-b lg:first:border-b-0 lg:first:border-r border-borderSubtle">
              <div className={`px-5 h-[26px] flex items-center font-mono text-[9px] uppercase tracking-widest ${ink as string}`}>{title as string}</div>
              {(rows as typeof so.flow.buys).length === 0 ? (
                <div className="px-5 py-5 text-center font-mono text-[10px] uppercase tracking-widest text-textSecondary">
                  No rich prints on <Name t={so.ticker} size={11} /> yet
                </div>
              ) : (
                (rows as typeof so.flow.buys).map(p => (
                  <div key={p.id} className="px-5 h-8 border-t border-borderSubtle/40 flex items-center gap-3 font-mono text-[10px] tnum" data-so-print={p.id}>
                    <span className="text-textSecondary w-10">{p.time}</span>
                    <ContractLabel contract={`${p.ticker} ${p.strike}${p.right}`} right={p.right} logo={p.ticker} size="sm" />
                    <span className="text-textPrimary">
                      {p.size.toLocaleString('en-US')} @ ${p.fill.toFixed(2)} · {p.dte}d
                    </span>
                    <span className="ml-auto font-semibold text-textPrimary">{fmtUsd(p.premium)}</span>
                    {p.sweep && <span className="text-[9px] font-semibold text-warn">SWEEP</span>}
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </Box>
    </div>
  );
};

export default StockOverview;
