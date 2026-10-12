/*
==================================================
  SLAYER TERMINAL - THE BOOK BY STRIKE, ON THE FEED
  (pages/pinpoint/feed/FeedCalendar.tsx)

  The Map's calendar on Unusual Whales' figures: the
  house's own heatmap (ExposureLedger) with a column
  a listed date, and its ladder (ExposureLadder) on
  the whole book, every date together. The lenses
  are the greeks the feed carries by strike — gamma,
  delta, vanna and charm; vega is not in the answer,
  so it is not offered. The levels the rows wear are
  the whole book's, core/walls.ts's pick.
==================================================
*/

import { useMemo, useState, type ReactNode } from 'react';
import { useResolvedTheme } from '../../../theme/theme';
import DropdownSelect, { type DropdownOption } from '../../../components/ui/DropdownSelect';
import ExposureLedger from '../../../components/gex/ExposureLedger';
import ExposureLadder from '../../../components/gex/ExposureLadder';
import ColoursSwitch from '../../../components/gex/ColoursSwitch';
import { STRIKE_OPTIONS, type RoomWindow } from '../../../data/pinpointBook';
import { bookColumn, dateColumns, FEED_DATES, FEED_GREEKS, feedSurface, listedDates, useFeedByExpiry } from '../../../data/feed/levels';
import type { Greek } from '../../../data/exposureSurface';
import type { LevelsFeed } from './parts';

type View = 'ledger' | 'ladder';
const VIEWS: DropdownOption<View>[] = [
  { value: 'ledger', label: 'Heatmap', hint: 'A column a listed date — the book cut by expiry' },
  { value: 'ladder', label: 'Ladder', hint: 'One row a strike — every date together, the puts and calls behind the net' },
];
type Lens = Greek | 'all';
const LENSES: DropdownOption<Lens>[] = [
  { value: 'gex', label: 'GEX', hint: 'Gamma per 1% move — where hedging pushes back or along' },
  { value: 'dex', label: 'DEX', hint: 'Delta — what dealers hold against the open contracts' },
  { value: 'vanna', label: 'Vanna', hint: 'How the hedge moves when implied vol moves' },
  { value: 'charm', label: 'Charm', hint: 'How the hedge moves as the clock runs' },
  { value: 'all', label: 'All four', hint: 'Gamma, delta, vanna and charm side by side' },
];

interface Props {
  feed: LevelsFeed;
  /** The book's day change, where UW gives the name a day state */
  changePct: number;
  half: RoomWindow;
  onHalf: (w: RoomWindow) => void;
  focus: number | null;
  onPick: (strike: number) => void;
  lead?: ReactNode;
  after?: ReactNode;
}

let viewMemory: View = 'ledger';
let lensMemory: Lens = 'gex';

const FeedCalendar = ({ feed, changePct, half, onHalf, focus, onPick, lead, after }: Props) => {
  const paper = useResolvedTheme() === 'light';
  const [view, setViewState] = useState<View>(viewMemory);
  const [lens, setLensState] = useState<Lens>(lensMemory);
  const [palette, setPalette] = useState<'house' | 'thermal'>('thermal');
  const setView = (v: View) => setViewState((viewMemory = v));
  const setLens = (l: Lens) => setLensState((lensMemory = l));
  const greeks: Greek[] = lens === 'all' ? FEED_GREEKS : [lens];

  const { book, profile, oi, maxPainRows } = feed;
  const dates = useMemo(() => listedDates(maxPainRows).slice(0, FEED_DATES), [maxPainRows]);
  const byDate = useFeedByExpiry(view === 'ledger', feed.ticker, dates);
  const surface = useMemo(() => {
    if (!book || !profile) return null;
    if (view === 'ladder') return feedSurface(book, profile, [bookColumn(book, oi)], changePct);
    if (!byDate) return null;
    return feedSurface(book, profile, dateColumns(byDate, dates), changePct);
  }, [book, profile, oi, byDate, dates, view, changePct]);

  return (
    <div className="flex flex-col min-h-0 h-full" data-feed-calendar data-view={view}>
      <div className="shrink-0 px-3 py-2 flex items-center gap-2 flex-wrap border-b border-borderSubtle">
        {lead}
        <DropdownSelect label="View" value={view} options={VIEWS} onChange={setView} testId="feed-view" />
        <DropdownSelect label="Greek" value={lens} options={LENSES} onChange={setLens} title="The greek the rows read — the feed carries these four by strike" testId="feed-greek" />
        <DropdownSelect label="Strikes" value={half} options={STRIKE_OPTIONS} onChange={onHalf} title="How many strikes around spot the page draws — the levels are read on every strike either way" testId="feed-strikes" />
        <ColoursSwitch palette={palette} onChange={setPalette} paper={paper} testId="feed-colours" />
        <span className="ml-auto inline-flex items-center gap-2">{after}</span>
      </div>
      <div data-theme={paper ? 'light' : 'dark'} className={`relative flex-1 min-h-0 ${paper ? 'bg-inset' : 'bg-panel'}`} data-field-island>
        {!surface ? (
          <p className="px-5 py-6 text-[12px] text-textMuted">{view === 'ledger' ? 'Asking Unusual Whales for the book by date…' : 'Asking Unusual Whales for the book…'}</p>
        ) : view === 'ledger' ? (
          <ExposureLedger
            surface={surface}
            liveSpot={surface.spot}
            greeks={greeks}
            expiries={surface.expiries.map((_, i) => i)}
            rings={half}
            palette={palette}
            selectedStrike={focus}
            onSelectStrike={onPick}
            paper={paper}
          />
        ) : (
          <ExposureLadder surface={surface} liveSpot={surface.spot} greeks={greeks} expiries={[0]} rings={half} palette={palette} selectedStrike={focus} onSelectStrike={onPick} />
        )}
      </div>
    </div>
  );
};

export default FeedCalendar;
