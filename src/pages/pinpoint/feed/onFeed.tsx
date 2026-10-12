/*
==================================================
  SLAYER TERMINAL - ONE SWITCH A PINPOINT PAGE
  (pages/pinpoint/feed/onFeed.tsx)

  ALL OR NOTHING (2026-10-12): a Pinpoint page is the
  house's page or the feed's page, whole — chosen by
  the room's seam (rooms.ts pinpointSource, through
  usePinpointSource). While the shell's first probe
  is out the page stands as its own skeleton, so the
  house's book never flashes before the vendor's.
==================================================
*/

import type { ComponentType } from 'react';
import { usePinpointSource } from '../../../data/feed/levels';
import { PinpointPageSkeleton } from '../pinpointSkeletons';

export function onFeed(House: ComponentType, Feed: ComponentType, pathname: string): ComponentType {
  const Page = () => {
    const src = usePinpointSource();
    if (src === 'feed') return <Feed />;
    if (src === 'pending') return <PinpointPageSkeleton pathname={pathname} />;
    return <House />;
  };
  Page.displayName = `OnFeed(${House.displayName ?? House.name ?? 'Page'})`;
  return Page;
}
