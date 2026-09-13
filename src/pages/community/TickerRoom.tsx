/*
==================================================
  SLAYER TERMINAL - A NAME IN THE ROOM
  (pages/community/TickerRoom.tsx)

  Everything the room is saying about one name
  (Noah, 2026-09-13: "make every ticker like $SPY
  clickable so if someone clicks it, it takes them
  to that ticker page and you can see everything
  people are saying about it").

  AND WHAT THE TERMINAL SAYS ABOUT IT (2026-09-13).
  This page was the Twitter half on its own: a price
  and a pile of posts. The brief was "a trading
  terminal + Twitter, all connected together", and
  the one place those two things obviously meet is
  a name — so the head carries both readings side by
  side. The flip, the walls, the supreme strike and
  the dealers' posture, off the same book Pinpoint
  and Terrain read; and beside it how many people
  are talking, how many have a trade on, and which
  way they lean.

  Neither side is told what to think of the other.
  The two readings are printed next to each other,
  which is the whole point: a room leaning one way
  under a book that damps every move is a thing
  worth seeing, and nobody needs to be told what to
  do about it.
==================================================
*/

import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Simulator from '../../core/simulator';
import { exposureNowFor, fmtUsd, spotChangePct } from '../../data/gex';
import { postsOn, useRoom } from '../../data/room';
import PostCard from '../../components/community/PostCard';
import CompanyLogo from '../../components/ui/CompanyLogo';
import { useMarketData } from '../../context/MarketDataContext';

/** One level and how far the price is from it */
const Level = ({ label, at, spot, ink }: { label: string; at: number | null; spot: number | null; ink: string }) => (
  <div className="min-w-0">
    <div className="text-[10px] text-textSecondary whitespace-nowrap">{label}</div>
    <div className={`font-mono text-[14px] font-bold tnum ${at == null ? 'text-textMuted' : ink}`}>{at == null ? '—' : at.toFixed(2)}</div>
    <div className="font-mono text-[10px] tnum text-textSecondary">{at == null || spot == null || spot <= 0 ? 'not in this book' : `${((at - spot) / spot) * 100 >= 0 ? '+' : ''}${(((at - spot) / spot) * 100).toFixed(1)}% away`}</div>
  </div>
);

const Fact = ({ label, value, ink = 'text-textPrimary' }: { label: string; value: string | number; ink?: string }) => (
  <div className="min-w-0">
    <div className="text-[10px] text-textSecondary whitespace-nowrap">{label}</div>
    <div className={`font-mono text-[14px] font-bold tnum ${ink}`}>{value}</div>
  </div>
);

const TickerRoom = () => {
  const rev = useRoom();
  const navigate = useNavigate();
  const { changeTicker } = useMarketData();
  const { ticker: raw = 'SPY' } = useParams();
  const ticker = raw.toUpperCase();
  const posts = useMemo(() => postsOn(ticker), [ticker, rev]);
  const setups = posts.filter(p => p.setup?.ticker === ticker);
  const bulls = setups.filter(p => p.setup!.bias === 'bullish').length;
  const bears = setups.length - bulls;
  const open = setups.filter(p => p.setup!.outcome === 'open').length;

  /* THE BOOK, off the same reader the alerts and the strike chart use — so a
     level printed here is the level printed there, never a second opinion */
  const book = useMemo(() => {
    try {
      Simulator.ensureTicker(ticker);
      return { spot: Simulator.TICKERS[ticker]?.currentPrice ?? null, change: spotChangePct(ticker), exposure: exposureNowFor(ticker) };
    } catch {
      return { spot: null, change: 0, exposure: null };
    }
    /* re-read on every room change, which is also the five-second sweep */
  }, [ticker, rev]);
  const { spot, change, exposure } = book;

  const posture = exposure ? (exposure.netGex >= 0 ? 'long gamma' : 'short gamma') : null;
  const side = exposure?.flip != null && spot != null ? (spot >= exposure.flip ? 'above the flip' : 'under the flip') : null;
  const lean = setups.length === 0 ? null : bulls > bears ? 'bullish' : bears > bulls ? 'bearish' : 'split';

  return (
    <div className="flex flex-col gap-4" data-ticker-room={ticker}>
      <div className="border border-borderSubtle rounded-md bg-panel">
        <div className="px-5 py-3 flex items-center gap-4 flex-wrap border-b border-borderSubtle">
          <CompanyLogo ticker={ticker} size={34} />
          <div>
            <div className="font-mono text-[18px] font-bold text-textPrimary">${ticker}</div>
            {spot != null && (
              <div className="font-mono text-[12px] tnum">
                <span className="text-textPrimary">{spot.toFixed(2)}</span>{' '}
                <span className={change >= 0 ? 'text-bull' : 'text-bear'}>
                  {change >= 0 ? '+' : ''}
                  {change.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link to={`/record/stocks/${ticker}`} className="h-8 px-3 rounded-full border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary inline-flex items-center">
              Stock overview
            </Link>
            {/* THE MAP, ON THIS NAME. The desk reads the terminal's active
                ticker rather than a query string, so the door sets it before
                it opens — a link to /pinpoint/map alone would land on whatever
                name the terminal was already on, which is not this one. */}
            <button
              type="button"
              onClick={() => {
                changeTicker(ticker);
                navigate('/pinpoint/map');
              }}
              className="h-8 px-3 rounded-full border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary inline-flex items-center"
              data-ticker-map
            >
              Read the map
            </button>
            <Link to="/community" className="h-8 px-3 rounded-full border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary inline-flex items-center">
              The room
            </Link>
          </div>
        </div>

        {/* THE TWO READINGS, SIDE BY SIDE — the book, and the people */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] divide-y lg:divide-y-0 lg:divide-x divide-borderSubtle">
          <div className="px-5 py-3" data-ticker-book>
            <div className="font-mono text-[9px] uppercase tracking-widest text-textSecondary">What the terminal says</div>
            {exposure ? (
              <>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3">
                  <Level label="Flip" at={exposure.flip} spot={spot} ink="text-select" />
                  <Level label="Put wall" at={exposure.putWall} spot={spot} ink="text-bear" />
                  <Level label="Call wall" at={exposure.callWall} spot={spot} ink="text-bull" />
                  <Level label="Supreme" at={exposure.supreme} spot={spot} ink="text-supreme" />
                </div>
                <p className="mt-2.5 text-[12px] leading-relaxed text-textPrimary">
                  Net GEX <span className="font-mono tnum">{fmtUsd(exposure.netGex)}</span> — dealers are <span className={exposure.netGex >= 0 ? 'text-bull' : 'text-bear'}>{posture}</span>
                  {side && <> with spot {side}</>}, so a move here is {exposure.netGex >= 0 ? 'sold into' : 'chased'}.
                </p>
              </>
            ) : (
              <p className="mt-2 text-[12px] text-textSecondary">No book on ${ticker} yet — the terminal has not loaded its chain.</p>
            )}
          </div>

          <div className="px-5 py-3" data-ticker-room-read>
            <div className="font-mono text-[9px] uppercase tracking-widest text-textSecondary">What the room says</div>
            <div className="mt-2 grid grid-cols-3 gap-x-5 gap-y-3">
              <Fact label="Posts" value={posts.length} />
              <Fact label="Open setups" value={open} ink="text-select" />
              {/* A SCORE NEEDS A SIDE. "3–1" on its own does not say which way
                  the room is leaning, and the ink alone is not a reading. */}
              <Fact
                label="The lean"
                value={lean === null ? '—' : lean === 'split' ? `${bulls}–${bears} split` : `${Math.max(bulls, bears)}–${Math.min(bulls, bears)} ${lean}`}
                ink={lean === 'bullish' ? 'text-bull' : lean === 'bearish' ? 'text-bear' : 'text-textPrimary'}
              />
            </div>
            <p className="mt-2.5 text-[12px] leading-relaxed text-textPrimary">
              {setups.length === 0 ? (
                <>
                  ${ticker} is being talked about, not traded — {posts.length} {posts.length === 1 ? 'post' : 'posts'} and nobody with a setup on it.
                </>
              ) : (
                <>
                  {setups.length} {setups.length === 1 ? 'setup' : 'setups'} posted, leaning <span className={lean === 'bullish' ? 'text-bull' : lean === 'bearish' ? 'text-bear' : 'text-textPrimary'}>{lean}</span>
                  {open > 0 ? <> · {open} still open and graded on the tape</> : <> · all of them settled</>}.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="border border-borderSubtle rounded-md bg-panel">
        <div className="px-4 py-2 border-b border-borderSubtle font-mono text-[9px] uppercase tracking-widest text-textSecondary">What the room is saying about ${ticker}</div>
        {posts.length === 0 && <div className="px-4 py-10 text-center font-mono text-[10px] uppercase tracking-widest text-textSecondary">Nobody has named ${ticker} yet — be first</div>}
        {posts.map(p => (
          <PostCard key={p.id} post={p} />
        ))}
      </div>
    </div>
  );
};

export default TickerRoom;
