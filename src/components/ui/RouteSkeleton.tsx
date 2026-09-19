/*
==================================================
  SLAYER TERMINAL - THE ROUTE'S SKELETON
  (components/ui/RouteSkeleton.tsx)

  What the shell shows while a page's code travels
  (App's lazy routes): the page's OWN shape, chosen
  by path (Noah, 2026-09-08: a generic skeleton
  "doesn't take the shape of its container… that's
  a design flaw"). Every section's skeletons live in
  a small file of their own that imports nothing
  heavy, so this can render before any chunk lands.
  Pages without a shape of their own yet fall back
  to the one page skeleton.
==================================================
*/

import { PageSkeleton } from './Skeleton';
import { PinpointRouteSkeleton } from '../../pages/pinpoint/pinpointSkeletons';
import { TraceRouteSkeleton } from '../../pages/trace/traceSkeletons';
import { WeigherPageSkeleton } from '../../pages/weigherSkeleton';
import { PaperPageSkeleton } from '../../pages/paper/paperSkeleton';
import { CompassHeadSkeleton, CompassRouteSkeleton } from '../../pages/compassSkeleton';
import { PulseBoardSkeleton, PulsePageSkeleton } from '../../pages/workspace/pulseSkeletons';
import { RecordRouteSkeleton } from '../../pages/record/recordSkeletons';
import { SettingsPageSkeleton } from '../../pages/settings/settingsSkeleton';

const RouteSkeleton = ({ pathname }: { pathname: string }) => {
  if (pathname.startsWith('/pinpoint')) return <PinpointRouteSkeleton pathname={pathname} />;
  if (pathname.startsWith('/settings')) return <SettingsPageSkeleton section={pathname.split('/')[2]} />;
  if (pathname.startsWith('/record')) return <RecordRouteSkeleton pathname={pathname} />;
  if (pathname.startsWith('/trace')) return <TraceRouteSkeleton pathname={pathname} />;
  if (pathname.startsWith('/weigher')) return <WeigherPageSkeleton />;
  if (pathname.startsWith('/paper')) return <PaperPageSkeleton />;
  if (pathname.startsWith('/compass'))
    return (
      <>
        <CompassHeadSkeleton />
        <CompassRouteSkeleton pathname={pathname} />
      </>
    );
  if (pathname.startsWith('/pulse/board')) return <PulseBoardSkeleton />;
  if (pathname.startsWith('/pulse')) return <PulsePageSkeleton />;
  return <PageSkeleton />;
};

export default RouteSkeleton;
