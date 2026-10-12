/*
==================================================
  SLAYER TERMINAL - PINPOINT ON THE FEED, ITS PARTS
  (pages/pinpoint/feed/parts.tsx)

  PINPOINT READS UNUSUAL WHALES (2026-10-12): the
  pieces every feed page stands on — the room's book
  for a name (useLevelsFeed), a box's head, the
  stamp that says when and at what price the book
  was figured, the levels with their "How sure",
  and the line that names what the feed does not
  carry on a page. The figures are UW's; the words
  and the reads stay the house's.
==================================================
*/

import { useMemo, type ReactNode } from 'react';
import { nyClock } from '../../../core/nyTime';
import { pctSigned, usdCompact } from '../../../core/format';
import { CALL_WALL, FLIP, LONG_GAMMA, PUT_WALL, SHORT_GAMMA, SUPREME } from '../../../components/gex/paletteInk';
import { HowSureBook } from '../../../components/levels/HowSure';
import {
  feedProfile,
  feedSureness,
  nearMaxPain,
  NOT_IN_FEED,
  useFeedBook,
  useFeedMaxPain,
  useFeedOi,
  useFeedVolume,
  type FeedBook,
  type FeedOi,
} from '../../../data/feed/levels';
import type { FeedFail } from '../../../data/feed/client';
import type { UwMaxPain } from '../../../data/feed/uw';
import type { ExposureProfileData } from '../../../types/gex';
import type { Sureness } from '../../../data/levelSureness';

export const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
export const real = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

/* ---- the room's book for a name ------------------------------------------------------------------------------- */

export interface LevelsFeed {
  ticker: string;
  book: FeedBook | null;
  profile: ExposureProfileData | null;
  oi: FeedOi | null;
  oiBefore: FeedOi | null;
  volume: Map<number, { call: number; put: number }> | null;
  maxPainRows: UwMaxPain[] | null;
  /** The nearest listed date's max pain */
  maxPain: UwMaxPain | null;
  sure: Record<'call wall' | 'put wall' | 'flip' | 'supreme', Sureness> | null;
  failed: FeedFail | null;
}

/** A name's book on the feed with what the pages hang on it — `prev` asks the session before's open interest too */
export function useLevelsFeed(ticker: string, opts: { prev?: boolean; volume?: boolean; on?: boolean; lite?: boolean } = {}): LevelsFeed {
  const on = opts.on ?? true;
  /* `lite`: the book alone — a Board row asks nothing else */
  const lite = !!opts.lite;
  const { book, failed } = useFeedBook(on, ticker);
  const { today, before } = useFeedOi(on && !lite, ticker, !!opts.prev);
  const volume = useFeedVolume(on && !lite && opts.volume !== false, ticker);
  const maxPainRows = useFeedMaxPain(on && !lite, ticker);
  const profile = useMemo(() => (book ? feedProfile(book, today, volume) : null), [book, today, volume]);
  const sure = useMemo(() => (book ? feedSureness(book, today) : null), [book, today]);
  return { ticker: ticker.toUpperCase(), book, profile, oi: today, oiBefore: before, volume, maxPainRows, maxPain: nearMaxPain(maxPainRows), sure, failed };
}

/* ---- a box ---------------------------------------------------------------------------------------------------------- */

export const Box = ({ children, testId, className = '' }: { children: ReactNode; testId: string; className?: string }) => (
  <section className={`border border-borderSubtle rounded-md bg-panel flex flex-col min-w-0 ${className}`} data-feed-box={testId}>
    {children}
  </section>
);

export const BoxHead = ({ title, sub, right, lead }: { title: string; sub?: ReactNode; right?: ReactNode; lead?: ReactNode }) => (
  <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-[15px] font-semibold leading-tight text-textPrimary">{title}</h2>
        {lead}
      </div>
      {sub && <p className="mt-0.5 text-[11px] leading-snug text-textMuted">{sub}</p>}
    </div>
    {right}
  </div>
);

/** When and at what price UW figured the book — said once a box, in New York's clock */
export const Stamp = ({ book, failed }: { book: FeedBook; failed?: FeedFail | null }) => (
  <span className="font-mono text-[11px] tnum text-textMuted whitespace-nowrap" data-feed-stamp title={failed ? 'The last ask did not answer — the book is the last one that did' : undefined}>
    Unusual Whales · figured at {book.spot.toFixed(2)}, {nyClock(book.at, { seconds: true, zone: true })}
    {failed ? ' · waiting on the next answer' : ''}
  </span>
);

/** What a page shows on the house's book that the feed does not carry — one quiet line, its reason in the title */
export const NotOnFeed = ({ what, testId }: { what: string; testId?: string }) => (
  <p className="flex items-center gap-2 px-1 text-[11px] text-textMuted" title={NOT_IN_FEED} data-not-in-feed={testId ?? ''}>
    <span className="font-mono">—</span>
    <span>
      {what} · {NOT_IN_FEED}
    </span>
  </p>
);

/** A dash for a figure no answer carried */
export const Dash = ({ className = '' }: { className?: string }) => (
  <span className={`text-textMuted ${className}`} title={NOT_IN_FEED} data-missing>
    —
  </span>
);

/** The page's stand-in while the first answer is out */
export const Waiting = ({ ticker, failed }: { ticker: string; failed: FeedFail | null }) => (
  <div className="border border-borderSubtle rounded-md bg-panel px-5 py-6 text-[12px] text-textMuted" data-feed-waiting>
    {failed && failed !== 'rate'
      ? `Unusual Whales has not answered for ${ticker} (${failed === 'plan' ? 'the plan does not reach this name' : failed === 'shape' ? 'no book for this name' : 'the ask failed'}) — the page waits for its book.`
      : `Asking Unusual Whales for ${ticker}'s book…`}
  </div>
);

/* ---- the levels ------------------------------------------------------------------------------------------------ */

const Fact = ({ label, children, title, testId }: { label: string; children: ReactNode; title?: string; testId: string }) => (
  <div className="min-w-0" data-feed-fact={testId}>
    <dt className="text-[11px] text-textMuted whitespace-nowrap">{label}</dt>
    <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" title={title}>
      {children}
    </dd>
  </div>
);

const away = (strike: number, spot: number) => <span className="text-textMuted"> · {pctSigned(((strike - spot) / spot) * 100)}</span>;

/** The book's named levels as a row of labelled facts, the "How sure" door after them */
export const LevelFacts = ({ feed }: { feed: LevelsFeed }) => {
  const { book, profile, maxPain, sure } = feed;
  if (!book || !profile) return null;
  const lv = profile.levels;
  const spot = book.spot;
  const level = (v: number, ink: string) => (real(v) ? (
    <>
      <span className="font-semibold" style={{ color: ink }}>
        {fmtStrike(v)}
      </span>
      {away(v, spot)}
    </>
  ) : (
    <Dash />
  ));
  return (
    <dl className="flex flex-wrap items-end gap-x-6 gap-y-2" data-feed-levels>
      <Fact label="Call wall" testId="call-wall">
        {level(lv.callWall, CALL_WALL)}
      </Fact>
      <Fact label="Put wall" testId="put-wall">
        {level(lv.putWall, PUT_WALL)}
      </Fact>
      <Fact label="Flip" testId="flip">
        {level(lv.flip, FLIP)}
      </Fact>
      <Fact label="Supreme" testId="supreme" title="The heaviest strike of the book">
        {level(lv.supreme, SUPREME)}
      </Fact>
      <Fact label="Most open interest" testId="pin">
        {real(lv.pin) ? <>{fmtStrike(lv.pin)}{away(lv.pin, spot)}</> : <Dash />}
      </Fact>
      <Fact label={maxPain ? `Max pain · ${maxPain.expiry.slice(5).replace('-', '/')}` : 'Max pain'} testId="max-pain" title="Where the nearest date's open interest pays least at expiry">
        {maxPain && real(maxPain.strike) ? <>{fmtStrike(maxPain.strike)}{away(maxPain.strike, spot)}</> : <Dash />}
      </Fact>
      <Fact label="Net GEX" testId="net-gex" title="The book's gamma per 1% move, summed over the strikes read — the house's sign: positive put-heavy, negative call-heavy">
        <span style={{ color: book.netGex > 0 ? SHORT_GAMMA : book.netGex < 0 ? LONG_GAMMA : undefined }}>{usdCompact(book.netGex)}</span>
      </Fact>
      {sure && <HowSureBook sures={[sure['call wall'], sure['put wall'], sure.flip, sure.supreme]} align="end" />}
    </dl>
  );
};
