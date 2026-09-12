import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import PageHeader from '../../components/ui/PageHeader';
import SubNav from '../../components/ui/SubNav';
import { COMMUNITY_SUBPAGES } from './subnav';
import ScrollHome from '../../components/layout/ScrollHome';

/** Section shell for Community — header and subpage tabs; body cross-fades. */
const CommunityLayout = () => {
  const location = useLocation();
  const outlet = useOutlet();

  const active = COMMUNITY_SUBPAGES.find(page => location.pathname.startsWith(page.path)) ?? COMMUNITY_SUBPAGES[0];

  return (
    <>
      <PageHeader
        breadcrumb={['Terminal', 'Community', active.label]}
        title="Community"
        subtitle={active.subtitle}
      />
      <SubNav ariaLabel="Community subpages" items={COMMUNITY_SUBPAGES} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-4"
        >
          {/* A subpage opens at its head, not where the last one's scroll was (2026-09-11) */}
          <ScrollHome />
          {outlet}
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default CommunityLayout;
