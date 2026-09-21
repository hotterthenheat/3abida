/*
==================================================
  SLAYER TERMINAL - NO SUCH ADDRESS
  (pages/NotFound.tsx)

  A path that does not exist says so.
==================================================

  A TYPO USED TO BECOME A DIFFERENT PAGE. The catch-all route sent every
  unknown address to /pulse, silently: type `/paper/jurnal` and the terminal
  showed you the market dashboard as though that is what you had asked for.
  The reader is then looking at a real page that is not the one they wanted,
  with nothing to tell them which of the two of you was wrong — and the URL
  in the bar has been rewritten, so they cannot even see what they typed.

  THE REDIRECTS THAT REMAIN ARE THE ONES THAT MEAN SOMETHING: a bare
  `/record` opens the news, `/trace` opens the tape, and thirty-odd old
  addresses still carry their readers to where those pages moved. Those are
  answers. "I do not know what that is" is also an answer, and it is this
  one.

  IT OFFERS THE DOORS rather than a link home, because a reader who typed a
  wrong address usually knows roughly where they were going.
*/

import { Link, useLocation } from 'react-router-dom';
import DataState from '../components/ui/DataState';

const DOORS: { to: string; label: string; blurb: string }[] = [
  { to: '/pulse', label: 'Pulse', blurb: 'What the whole market is doing right now' },
  { to: '/compass', label: 'Compass', blurb: 'The setups the scanner is finding' },
  { to: '/weigher', label: 'Weigher', blurb: 'A name, its chain and its chart' },
  { to: '/trace/live-tape', label: 'Trace', blurb: 'The options tape, print by print' },
  { to: '/pinpoint/map', label: 'Pinpoint', blurb: 'Dealer exposure and the levels it makes' },
  { to: '/paper', label: 'Paper', blurb: 'The practice desk' },
];

const NotFound = () => {
  const { pathname } = useLocation();
  return (
    <div className="flex flex-col gap-4 pb-8" data-page="not-found">
      <section className="border border-borderSubtle rounded-md bg-panel">
        <DataState
          kind="unavailable"
          title="No such address"
          body={
            <>
              Nothing in this terminal answers to{' '}
              <span className="font-mono text-textSecondary">{pathname}</span>. It may have been a typo, or a link from
              somewhere that has not caught up.
            </>
          }
          pad="lg"
        />
      </section>

      <section className="border border-borderSubtle rounded-md bg-panel">
        <div className="px-5 pt-4 pb-3">
          <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">Where you were probably going</h3>
          <p className="mt-0.5 text-[11px] text-textSecondary">The six doors, in the order the sidebar carries them</p>
        </div>
        <div className="border-t border-borderSubtle grid sm:grid-cols-2 lg:grid-cols-3">
          {DOORS.map(d => (
            <Link
              key={d.to}
              to={d.to}
              className="px-5 py-3 border-b border-r border-borderSubtle/50 hover:bg-ink/[0.03] transition-colors"
              data-notfound-door={d.label}
            >
              <span className="block text-[12px] font-semibold text-textPrimary">{d.label}</span>
              <span className="block mt-0.5 text-[11px] text-textSecondary">{d.blurb}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default NotFound;
