/*
==================================================
  SLAYER TERMINAL - DOWN FOR MAINTENANCE (/maintenance)

  The Logo System's maintenance card (Web and App · System pages): the mark at rest, when it will be back, and the
  status page. Nothing sends a visitor here yet — a deploy that needs downtime points the host's maintenance page at it.
==================================================
*/

import { Link } from 'react-router-dom';
import OutsideFrame from './OutsideFrame';
import BracketCard from '../../brand/BracketCard';
import SlayerMark from '../../brand/SlayerMark';

const Maintenance = () => (
  <OutsideFrame footer={false} testId="maintenance">
    <div className="flex-1 flex items-center justify-center px-5 pb-[12vh]">
      <BracketCard className="w-full max-w-[480px] p-8 sm:p-10" label="maintenance">
        <SlayerMark size={56} state="closed" label="" />
        <h1 className="mt-7 text-[30px] font-light tracking-[-0.02em] leading-tight">Down for maintenance until 6:00 ET.</h1>
        <p className="mt-3 text-[15px] text-textSecondary">Follow along on the status page.</p>
        <Link to="/status" className="mt-7 h-10 px-5 inline-flex items-center rounded-full border border-borderMuted text-[14px] text-textPrimary hover:bg-ink/[0.05]">
          Status
        </Link>
      </BracketCard>
    </div>
  </OutsideFrame>
);

export default Maintenance;
