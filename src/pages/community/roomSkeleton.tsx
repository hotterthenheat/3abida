/*
==================================================
  SLAYER TERMINAL - THE ROOM'S SKELETON
  (pages/community/roomSkeleton.tsx)

  The room standing in as itself while its code
  travels: the shell's head, then the three
  columns — the profile card and the trending box,
  the composer and the feed box, the notices and
  who to follow. Imports nothing heavy.
==================================================
*/

import { Users } from 'lucide-react';
import { Block, Line, SubLine, Trigger } from '../../components/ui/skeletonKit';

/* THE ROOM'S SHAPE — the page reads these too. Three columns from `lg`; a
   phone gets ONE, the feed first (the phone pass, 2026-09-13 — the 300px
   right column used to run off a 390px screen). */
export const ROOM_GRID = 'grid gap-2.5 items-start grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_300px]';
export const ROOM_POST_H = 100;
export const ROOM_TREND_H = 36;
export const ROOM_NOTICE_H = 52;
export const ROOM_FOLLOW_H = 50;

const Box = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <div className={`border border-borderSubtle rounded-md bg-panel overflow-hidden ${className}`}>{children}</div>;

export const RoomRouteSkeleton = () => (
  <>
    <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" aria-hidden data-skeleton="room-head">
      <div className="min-w-0 flex-1">
        <div className="h-6 flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-borderSubtle text-textSecondary shrink-0">
            <Users className="w-3.5 h-3.5" />
          </span>
          <span className="text-[15px] font-semibold leading-tight text-textPrimary">Community</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">· the room</span>
        </div>
        <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">Traders, their setups and the record they build — every $name a door, every @handle a person</p>
      </div>
    </header>
    <div className={ROOM_GRID} aria-hidden data-skeleton="room">
      {/* the left column */}
      <div className="flex flex-col gap-2.5">
        <Box>
          <div className="px-4 pt-4 pb-3 flex items-center gap-3">
            <Block w={44} h={44} className="rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Line w={96} h={12} />
              <Line w={60} h={10} />
            </div>
          </div>
          <div className="px-4 pb-3 flex gap-6">
            {[0, 1, 2].map(i => (
              <div key={i}>
                <div className="h-5 flex items-center">
                  <Line w={28} h={14} />
                </div>
                <div className="h-[15px] flex items-center">
                  <Line w={44} h={9} />
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-borderSubtle/60 h-[38px] flex items-center">
            <Line w={130} h={10} />
          </div>
          <div className="px-4 py-2.5 border-t border-borderSubtle/60 flex gap-2">
            <Trigger w={70} />
            <Trigger w={76} />
          </div>
        </Box>
        <Box>
          <div className="px-4 h-10 flex items-center">
            <Line w={64} h={12} />
            <Line w={52} h={8} className="ml-auto" />
          </div>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="px-4 flex items-center gap-2.5 border-t border-borderSubtle/60" style={{ height: ROOM_TREND_H }}>
              <Line w={10} h={9} />
              <Block w={15} h={15} className="rounded-full" />
              <Line w={44} h={11} />
              {i % 2 === 0 && <Line w={42} h={8} />}
              <Line w={40} h={9} className="ml-auto" />
            </div>
          ))}
        </Box>
      </div>
      {/* the middle column */}
      <div className="flex flex-col gap-2.5 min-w-0">
        <Box>
          <div className="px-4 py-3 flex gap-3">
            <Block w={32} h={32} className="rounded-full" />
            <div className="flex-1 flex flex-col gap-3">
              <Block w="100%" h={56} className="rounded-md" />
              <div className="flex items-center gap-2">
                <Trigger w={104} />
                <Line w={44} h={9} />
                <Trigger w={64} className="ml-auto" />
              </div>
            </div>
          </div>
        </Box>
        <Box>
          <div className="px-5 pt-4 pb-3 flex items-start gap-6">
            <div className="min-w-0 flex-1">
              <div className="h-6 flex items-center">
                <Line w={90} h={14} />
              </div>
              <SubLine w={420} />
            </div>
            <div className="flex gap-6">
              {[40, 48, 90].map((w, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <Line w={Math.min(64, w + 20)} h={10} />
                  <Line w={w} h={12} />
                </div>
              ))}
            </div>
          </div>
          <div className="px-5 pb-2 flex items-center gap-2">
            <Trigger w={110} />
            <Trigger w={130} />
            <Trigger w={130} />
          </div>
          <div className="px-5 pb-3 h-[32px] flex items-center">
            <Line w="60%" h={11} />
          </div>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="px-4 flex gap-3 border-t border-borderSubtle/60 py-3" style={{ height: ROOM_POST_H }}>
              <Block w={32} h={32} className="rounded-full" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Line w={80} h={12} />
                  <Line w={90} h={10} />
                  <Line w={20} h={10} />
                  {i % 2 === 1 && <Line w={48} h={8} className="ml-auto" />}
                </div>
                <Line w={`${[88, 72, 94, 60, 80, 70][i]}%`} h={12} />
                <div className="flex items-center gap-4">
                  <Line w={36} h={10} />
                  <Line w={24} h={10} />
                  <Line w={14} h={10} />
                </div>
              </div>
            </div>
          ))}
        </Box>
      </div>
      {/* the right column */}
      <div className="flex flex-col gap-2.5">
        <Box>
          <div className="px-4 h-10 flex items-center">
            <Line w={90} h={12} />
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="px-4 flex items-center gap-3 border-t border-borderSubtle/60" style={{ height: ROOM_NOTICE_H }}>
              <Block w={24} h={24} className="rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Line w={[180, 110, 150][i]} h={11} />
                <Line w={34} h={9} />
              </div>
            </div>
          ))}
        </Box>
        <Box>
          <div className="px-4 h-10 flex items-center">
            <Line w={90} h={12} />
          </div>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="px-4 flex items-center gap-3 border-t border-borderSubtle/60" style={{ height: ROOM_FOLLOW_H }}>
              <Block w={28} h={28} className="rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Line w={84} h={11} />
                <Line w={110} h={9} />
              </div>
              <Trigger w={64} className="ml-auto" />
            </div>
          ))}
        </Box>
        <div className="px-1 flex flex-col gap-[8px]">
          <Line w="100%" h={10} />
          <Line w="96%" h={10} />
          <Line w="92%" h={10} />
          <Line w="48%" h={10} />
        </div>
      </div>
    </div>
  </>
);
