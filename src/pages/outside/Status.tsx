/*
==================================================
  SLAYER TERMINAL - STATUS (/status)

  "What's up, what's new." (Slayer Logo System, Web and App · Status and changelog.) The signature in the market's own
  word, the parts of the terminal and how each one is, the market's last thirty days, the changelog and the newest
  change.

  WHAT IT DOES NOT CLAIM: there is no uptime history to show on a terminal that runs on this machine, so the thirty days
  are the MARKET's days (a filled square an open day, an outlined one a closed day — 2026-10-09, the audit's OU-S1: the
  grey said "closed" read as the open days on black, under 3:1 apart), not a record of outages.

  A LINE'S DOOR (OU-S5): a change inside the terminal opens it through the gate, as every door into the terminal does;
  one on the front page is a plain link there.
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
import { isTerminalPath, useLaunch } from '../../components/layout/LaunchTransition';

const PARTS: { name: string; state: string; tone: 'normal' | 'muted' }[] = [
  { name: 'Website', state: 'Normal', tone: 'normal' },
  { name: 'Terminal', state: 'Normal', tone: 'normal' },
  { name: 'Market data', state: 'Normal', tone: 'normal' },
  { name: 'Alerts', state: 'Normal', tone: 'normal' },
];
const TONE = { normal: 'text-textPrimary', muted: 'text-textMuted' } as const;

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
  const openDays = days.filter(d => d.open).length;
  /** a door to where a change is: through the gate into the terminal, else a plain link */
  const door = (path: string) => (isTerminalPath(path) ? { href: path, onClick: (e: React.MouseEvent) => (e.preventDefault(), launch(path)) } : null);
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
          <Signature detail="· all systems normal" className="text-[12px] w-full" />
          <ul className="mt-5 flex flex-col">
            {PARTS.map(p => (
              <li key={p.name} className="flex items-center justify-between py-3 border-b border-borderSubtle/70 last:border-b-0 text-[15px]" data-status-part={p.name}>
                <span className="text-textPrimary">{p.name}</span>
                <span className={TONE[p.tone]}>{p.state}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6" data-status-days>
            {/* the strip says itself whole to a reader that hears it; each square keeps its day for a pointer */}
            <div role="img" aria-label={`The market’s last 30 days: open on ${openDays} of them, closed on ${30 - openDays}.`} className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(30, minmax(0, 1fr))' }}>
              {days.map(d => (
                <span key={d.key} title={`${d.label} · ${d.open ? 'market open' : 'market closed'}`} className={`h-6 rounded-[3px] ${d.open ? 'bg-silver/85' : 'border border-borderMuted'}`} data-status-day={d.open ? 'open' : 'closed'} />
              ))}
            </div>
            <p className="mt-3 text-[13px] text-textMuted">
              The market’s last 30 days <span aria-hidden="true">·</span> filled: open <span aria-hidden="true">·</span> outlined: closed <span aria-hidden="true">·</span> {market.line}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-borderSubtle bg-panel p-6 sm:p-8" data-status-changelog>
          <h2 className="text-[20px] font-medium tracking-tight">Changelog</h2>
          <ul className="mt-4 flex flex-col">
            {CHANGELOG.map(r => (
              /* on a phone the version stands over its line, so the line has the width (the audit's OU-S4) */
              <li key={`${r.version}-${r.line}`} className="grid grid-cols-[22px_1fr] sm:grid-cols-[120px_24px_1fr] items-start gap-x-3 py-3.5 border-t border-borderSubtle/70">
                <span className="col-span-2 sm:col-span-1 text-[13px] text-textMuted tnum sm:pt-[3px] max-sm:mb-1">{r.version}</span>
                <ProductGlyph name={glyphFor(r.product)} size={20} bare className="mt-[2px]" />
                <span className="text-[15px] leading-snug text-textPrimary">
                  {r.path ? (
                    door(r.path) ? (
                      <a {...door(r.path)!} className="hover:underline decoration-borderMuted underline-offset-4">
                        {r.line}
                      </a>
                    ) : (
                      <Link to={r.path} className="hover:underline decoration-borderMuted underline-offset-4">
                        {r.line}
                      </Link>
                    )
                  ) : (
                    r.line
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="self-start max-w-[560px] rounded-2xl border border-borderSubtle bg-panel p-6 flex items-start gap-4" data-status-whats-new>
          <ProductGlyph name={glyphFor(news.product)} size={26} bare className="shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] text-textMuted">What’s new</p>
            <p className="mt-1 text-[16px] leading-snug text-textPrimary">{news.line}</p>
            {news.path &&
              (door(news.path) ? (
                <a {...door(news.path)!} className="mt-4 h-11 px-5 inline-flex items-center rounded-full bg-textPrimary text-canvas text-[13.5px] font-medium">
                  Open in {news.product ?? 'the terminal'}
                </a>
              ) : (
                <Link to={news.path} className="mt-4 h-11 px-5 inline-flex items-center rounded-full bg-textPrimary text-canvas text-[13.5px] font-medium">
                  See it
                </Link>
              ))}
          </div>
        </section>
      </div>
    </OutsideFrame>
  );
};

export default Status;
