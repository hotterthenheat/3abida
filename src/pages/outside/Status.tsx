/*
==================================================
  SLAYER TERMINAL - STATUS (/status)

  "What's up, what's new." (Slayer Logo System, Web and App · Status and changelog.) The signature with the one word
  that matters — simulated — the parts of the terminal and how each one is, the market's last thirty days, the
  changelog and the newest change.

  WHAT IT DOES NOT CLAIM: there is no uptime history to show on a terminal that runs on this machine, so the thirty days
  are the MARKET's days (grey is a closed day), not a record of outages. Market data says "Simulated", in the silver,
  until a feed is signed; sign-in says it opens at launch.
==================================================
*/

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import OutsideFrame from './OutsideFrame';
import Signature from '../../brand/Signature';
import ProductGlyph from '../../brand/ProductGlyph';
import { PRODUCTS } from '../../brand/products';
import { CHANGELOG, WHATS_NEW } from '../../data/release';
import { isTradingDay, isoDate } from '../../core/calendar';
import { readMarketState } from '../../data/marketState';
import { useLaunch } from '../../components/layout/LaunchTransition';

const PARTS: { name: string; state: string; tone: 'normal' | 'simulated' | 'muted' }[] = [
  { name: 'Website', state: 'Normal', tone: 'normal' },
  { name: 'Terminal', state: 'Normal', tone: 'normal' },
  { name: 'Market data', state: 'Simulated', tone: 'simulated' },
  { name: 'Alerts', state: 'Normal', tone: 'normal' },
  { name: 'Sign-in', state: 'Opens at launch', tone: 'muted' },
];
const TONE = { normal: 'text-textPrimary', simulated: 'text-silver', muted: 'text-textMuted' } as const;

const glyphFor = (product?: string) => PRODUCTS.find(p => p.name === product)?.glyph ?? 'terminal';

const Status = () => {
  const { launch } = useLaunch();
  const market = readMarketState();
  /* the market's last thirty days, oldest first */
  const days = useMemo(() => {
    const out: { key: string; open: boolean; label: string }[] = [];
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const day = new Date(d);
      day.setDate(d.getDate() - i);
      out.push({ key: isoDate(day), open: isTradingDay(day), label: day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) });
    }
    return out;
  }, []);
  const news = WHATS_NEW;
  return (
    <OutsideFrame testId="status">
      <div className="w-full max-w-[880px] mx-auto px-5 sm:px-8 pt-10 pb-20 flex flex-col gap-6">
        <div>
          <p className="text-[13px] text-textMuted">Status and changelog</p>
          <span className="mt-2.5 block w-10 h-[3px] rounded-full bg-silver" aria-hidden />
          <h1 className="mt-5 text-[40px] sm:text-[56px] font-light tracking-[-0.04em] leading-[1.02]">
            What’s up, <span className="text-textMuted">what’s new.</span>
          </h1>
        </div>

        <section className="rounded-2xl border border-borderSubtle bg-panel p-6 sm:p-8" data-status-parts>
          <Signature state="simulated" detail="· all systems normal" className="text-[12px] w-full" />
          <ul className="mt-5 flex flex-col">
            {PARTS.map(p => (
              <li key={p.name} className="flex items-center justify-between py-3 border-b border-borderSubtle/70 last:border-b-0 text-[15px]" data-status-part={p.name}>
                <span className="text-textPrimary">{p.name}</span>
                <span className={TONE[p.tone]}>{p.state}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6" data-status-days>
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(30, minmax(0, 1fr))' }}>
              {days.map(d => (
                <span key={d.key} title={`${d.label} · ${d.open ? 'market open' : 'market closed'}`} className={`h-6 rounded-[3px] ${d.open ? 'bg-silver/45' : 'bg-ink/[0.09]'}`} />
              ))}
            </div>
            <p className="mt-3 text-[13px] text-textMuted">The market’s last 30 days · gray is a closed market day · {market.line}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-borderSubtle bg-panel p-6 sm:p-8" data-status-changelog>
          <h2 className="text-[20px] font-medium tracking-tight">Changelog</h2>
          <ul className="mt-4 flex flex-col">
            {CHANGELOG.map(r => (
              <li key={`${r.version}-${r.line}`} className="grid grid-cols-[96px_22px_1fr] sm:grid-cols-[120px_24px_1fr] items-start gap-x-3 py-3.5 border-t border-borderSubtle/70">
                <span className="text-[13px] text-textMuted tnum pt-[3px]">{r.version}</span>
                <ProductGlyph name={glyphFor(r.product)} size={20} bare className="mt-[2px]" />
                <span className="text-[15px] leading-snug text-textPrimary">
                  {r.path ? (
                    <Link to={r.path} className="hover:underline decoration-borderMuted underline-offset-4">
                      {r.line}
                    </Link>
                  ) : (
                    r.line
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="self-start max-w-[560px] rounded-2xl border border-borderSubtle bg-panel p-6 flex items-start gap-4" data-status-whats-new>
          <ProductGlyph name={glyphFor(news.product)} size={40} className="shrink-0 rounded-[9px]" />
          <div className="min-w-0">
            <p className="text-[13px] text-textMuted">What’s new</p>
            <p className="mt-1 text-[16px] leading-snug text-textPrimary">{news.line}</p>
            {news.path && (
              <a
                href={news.path}
                onClick={e => {
                  e.preventDefault();
                  launch(news.path!);
                }}
                className="mt-4 h-9 px-4 inline-flex items-center rounded-full bg-textPrimary text-canvas text-[13px] font-medium"
              >
                Open in {news.product ?? 'the terminal'}
              </a>
            )}
          </div>
        </section>
      </div>
    </OutsideFrame>
  );
};

export default Status;
