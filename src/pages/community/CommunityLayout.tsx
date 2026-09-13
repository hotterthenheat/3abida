/*
==================================================
  SLAYER TERMINAL - THE COMMUNITY'S SHELL
  (pages/community/CommunityLayout.tsx)

  One head over the room, a profile and a name's
  page (2026-09-13: the requests and the feedback
  left for their own page; the community is one
  room). The head names where you are; the page
  under it cross-fades.
==================================================
*/

import { Suspense } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Users } from 'lucide-react';
import ScrollHome from '../../components/layout/ScrollHome';
import { useAccount } from '../../data/account';
import { unreadNotes, useRoom } from '../../data/room';

const CommunityLayout = () => {
  const location = useLocation();
  const outlet = useOutlet();
  useRoom();
  const account = useAccount();
  const unread = unreadNotes();
  const where = location.pathname.startsWith('/community/u/') || location.pathname === '/community/me' ? 'A profile' : location.pathname.startsWith('/community/t/') ? 'A name' : 'The room';
  return (
    <>
      <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" data-shell data-community-shell>
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-2.5" data-shell-page>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-borderSubtle text-textSecondary shrink-0" aria-hidden="true">
              <Users className="w-3.5 h-3.5" />
            </span>
            <h1 className="text-[15px] font-semibold leading-tight text-textPrimary">Community</h1>
            <span className="font-mono text-[10px] uppercase tracking-widest text-textSecondary">· {where}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-textSecondary whitespace-nowrap truncate">Traders, setups and the record they build — every $name a door, every @handle a person</p>
        </div>
        <dl className="grid grid-flow-col auto-cols-max gap-x-6" data-shell-facts>
          <div className="min-w-0">
            <dt className="text-[10px] text-textSecondary whitespace-nowrap">You</dt>
            <dd className="mt-0.5 font-mono text-[12px] text-textPrimary whitespace-nowrap">@{account.handle}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] text-textSecondary whitespace-nowrap">Unread</dt>
            <dd className={`mt-0.5 font-mono text-[12px] tnum whitespace-nowrap ${unread ? 'text-bear' : 'text-textPrimary'}`}>{unread}</dd>
          </div>
        </dl>
      </header>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} className="flex flex-col gap-4">
          <ScrollHome />
          <Suspense fallback={<div className="h-[400px]" />}>{outlet}</Suspense>
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default CommunityLayout;
