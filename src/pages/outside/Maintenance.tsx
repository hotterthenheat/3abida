/*
==================================================
  SLAYER TERMINAL - DOWN FOR MAINTENANCE (/maintenance)

  The Logo System's maintenance card (Web and App · System pages): the mark offline, when it will be back, and the
  status page. Nothing sends a visitor here yet — a deploy that needs downtime points the host's maintenance page at it.

  WHEN IT IS BACK (2026-10-09, the audit's OU-O7): "until 6:00 ET" had no day and no AM or PM, and was written into the
  page. The end is read from the window's config (data/company.ts MAINTENANCE_UNTIL, or `?until=` in the address) and
  said in New York's time with its day — "until 6:00 AM ET, Sat, Oct 10". The mark is in its offline state: the S still,
  no cursor (brand rules).
==================================================
*/

import { Link, useSearchParams } from 'react-router-dom';
import OutsideFrame from './OutsideFrame';
import BracketCard from '../../brand/BracketCard';
import SlayerMark from '../../brand/SlayerMark';
import { MAINTENANCE_UNTIL } from '../../data/company';
import { NY_TZ } from '../../core/nyTime';

/** "6:00 AM ET, Sat, Oct 10" — or null for no end, or one already passed */
const untilWords = (iso: string | null): string | null => {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) return null;
  const time = at.toLocaleTimeString('en-US', { timeZone: NY_TZ, hour: 'numeric', minute: '2-digit' });
  const day = at.toLocaleDateString('en-US', { timeZone: NY_TZ, weekday: 'short', month: 'short', day: 'numeric' });
  return `${time} ET, ${day}`;
};

const Maintenance = () => {
  const [params] = useSearchParams();
  const until = untilWords(params.get('until') ?? MAINTENANCE_UNTIL);
  return (
    <OutsideFrame testId="maintenance">
      <div className="flex-1 flex items-center justify-center px-5 pb-[12vh]">
        <BracketCard className="w-full max-w-[480px] p-8 sm:p-10" label="maintenance">
          <SlayerMark size={44} bare state="offline" label="" />
          <h1 className="mt-7 text-[30px] font-light tracking-[-0.02em] leading-tight" data-maintenance-until={until ?? undefined}>
            {until ? `Down for maintenance until ${until}.` : 'Down for maintenance.'}
          </h1>
          <p className="mt-3 text-[15px] text-textSecondary">Follow along on the status page.</p>
          <Link to="/status" className="mt-7 h-11 px-5 inline-flex items-center rounded-full border border-borderMuted text-[14px] text-textPrimary hover:bg-ink/[0.05]">
            Status
          </Link>
        </BracketCard>
      </div>
    </OutsideFrame>
  );
};

export default Maintenance;
