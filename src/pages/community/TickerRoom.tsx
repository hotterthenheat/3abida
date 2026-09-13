/*
==================================================
  SLAYER TERMINAL - A NAME IN THE ROOM
  (pages/community/TickerRoom.tsx)

  Everything the room is saying about one name
  (Noah, 2026-09-13: "make every ticker like $SPY
  clickable so if someone clicks it, it takes them
  to that ticker page and you can see everything
  people are saying about it"): the name with its
  price, how the room leans on it, the open setups,
  then every post that names it.
==================================================
*/

import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import Simulator from '../../core/simulator';
import { postsOn, useRoom } from '../../data/room';
import PostCard from '../../components/community/PostCard';
import CompanyLogo from '../../components/ui/CompanyLogo';

const TickerRoom = () => {
  const rev = useRoom();
  const { ticker: raw = 'SPY' } = useParams();
  const ticker = raw.toUpperCase();
  const posts = useMemo(() => postsOn(ticker), [ticker, rev]);
  const setups = posts.filter(p => p.setup?.ticker === ticker);
  const bulls = setups.filter(p => p.setup!.bias === 'bullish').length;
  const bears = setups.length - bulls;
  const open = setups.filter(p => p.setup!.outcome === 'open').length;
  let price: number | null = null;
  try {
    Simulator.ensureTicker(ticker);
    price = Simulator.TICKERS[ticker]?.currentPrice ?? null;
  } catch {
    price = null;
  }
  return (
    <div className="flex flex-col gap-4" data-ticker-room={ticker}>
      <div className="border border-borderSubtle rounded-md bg-panel px-5 py-4 flex items-center gap-4 flex-wrap">
        <CompanyLogo ticker={ticker} size={36} />
        <div>
          <div className="font-mono text-[18px] font-bold text-textPrimary">${ticker}</div>
          {price != null && <div className="font-mono text-[12px] tnum text-textSecondary">${price.toFixed(2)}</div>}
        </div>
        <div className="grid grid-cols-4 gap-x-6 font-mono text-[11px] tnum ml-4">
          {[
            ['Posts', posts.length, 'text-textPrimary'],
            ['Open setups', open, 'text-select'],
            ['Bullish', bulls, 'text-bull'],
            ['Bearish', bears, 'text-bear'],
          ].map(([k, v, ink]) => (
            <div key={k as string}>
              <div className="text-[10px] text-textSecondary">{k as string}</div>
              <div className={`text-[16px] font-bold ${ink as string}`}>{v as number}</div>
            </div>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link to={`/record/stocks/${ticker}`} className="h-8 px-3 rounded-full border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary inline-flex items-center">
            Stock overview
          </Link>
          <Link to="/community" className="h-8 px-3 rounded-full border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary inline-flex items-center">
            The room
          </Link>
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
