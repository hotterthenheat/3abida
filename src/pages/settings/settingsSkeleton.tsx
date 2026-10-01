/*
==================================================
  SLAYER TERMINAL - THE SETTINGS PAGE'S SKELETON
  (pages/settings/settingsSkeleton.tsx)

  The page standing in as itself while its code
  travels: the shell head with the mark and two
  facts, the rail of seven sections, and THE ONE
  BOX the route names (each section is its own
  page since 2026-09-12) — the three theme tiles
  for Appearance, the rows for the rest. Imports
  nothing heavy.
==================================================
*/

import { Fragment } from 'react';
import { Block, Facts, Line, SubLine, Trigger } from '../../components/ui/skeletonKit';
import SlayerMark from '../../brand/SlayerMark';

const Head = () => (
  <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" aria-hidden data-skeleton="settings-head">
    <div className="min-w-0 flex-1">
      <div className="h-6 flex items-center gap-2.5">
        <SlayerMark size={20} bare state="idle" label="" />
        <span className="text-[15px] font-semibold leading-tight text-textPrimary">Settings</span>
      </div>
      <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">How the terminal looks, what the desk opens on, what it says out loud</p>
    </div>
    <Facts widths={[60, 72]} />
  </header>
);

/** The keyboard page's group head: pt-3 + a 13px line + pb-1.5 + the hairline */
const KEY_GROUP_HEAD_H = 32;

/** A box: the head (title + line), then rows of a name, its line and a control.
    A setting's row is 60px (two lines of text on py-3); a keyboard row is 42.
    `groups` (the keyboard page): rows in groups, each under a whisper head. */
const Box = ({ rows, rowH = 60, control = 0, groups, children, after }: { rows: number; rowH?: number; control?: number; groups?: number[]; children?: React.ReactNode; after?: React.ReactNode }) => {
  const row = (i: number) => (
    <div key={i} className="px-5 border-t border-borderSubtle/60 flex items-center justify-between gap-6" style={{ height: rowH }}>
      {rowH < 50 ? (
        <Line w={240 + (i % 3) * 60} h={11} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <Line w={90 + (i % 3) * 30} h={11} />
          <Line w={260 + (i % 2) * 80} h={10} />
        </div>
      )}
      {control > 0 ? <Trigger w={control} /> : <Block w={rowH < 50 ? 64 : 92} h={rowH < 50 ? 20 : 18} className="rounded" />}
    </div>
  );
  return (
    <div className="border border-borderSubtle rounded-md bg-panel overflow-hidden" aria-hidden data-skeleton="settings-box">
      <div className="px-5 pt-4 pb-3">
        <div className="h-[18px] flex items-center">
          <Line w={110} h={14} />
        </div>
        <SubLine w={460} />
      </div>
      {children}
      {groups
        ? groups.map((n, g) => (
            <Fragment key={g}>
              <div className="px-5 border-t border-borderSubtle/60 flex items-end pb-1.5" style={{ height: KEY_GROUP_HEAD_H }}>
                <Line w={70 + (g % 2) * 40} h={9} />
              </div>
              {Array.from({ length: n }, (_, i) => row(g * 10 + i))}
            </Fragment>
          ))
        : Array.from({ length: rows }, (_, i) => row(i))}
      {after}
    </div>
  );
};

/** The one box the route names, in its own shape */
const SectionBox = ({ section }: { section: string }) => {
  switch (section) {
    case 'desk':
      return <Box rows={4} control={110} />;
    case 'keyboard':
      /* five groups — everywhere, the desk, the active chart, Review's desk, the editor — 29 keys (Settings.tsx KEY_GROUPS) */
      return <Box rows={31} rowH={41} groups={[4, 3, 9, 11, 2, 2]} />;
    /* THE LAUNCH PAGES (2026-09-12) — each block built from the page's own
       paddings, so the heights match by construction */
    case 'account':
      return (
        <Box
          rows={4}
          control={200}
          after={
            <>
              {/* after the rows: the devices, then the foot */}
              <div className="px-5 py-3 border-t border-borderSubtle/60">
                <div className="h-[18px] flex items-center">
                  <Line w={130} h={11} />
                </div>
                <div className="h-[17px] flex items-center">
                  <Line w={300} h={10} />
                </div>
                <div className="mt-2.5 flex flex-col gap-1">
                  {[0, 1].map(i => (
                    <div key={i} className="h-8 px-3 rounded-md bg-ink/[0.03] flex items-center gap-3">
                      <Block w={14} h={14} className="rounded-sm" />
                      <Line w={i ? 96 : 118} h={11} />
                      <Line w={60} h={10} className="ml-auto" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-5 py-3 border-t border-borderSubtle/60 flex items-center justify-between gap-6">
                <Line w={420} h={10} />
                <div className="flex items-center gap-2">
                  <Trigger w={86} />
                  <Trigger w={124} />
                </div>
              </div>
            </>
          }
        >
          {/* the picture: a 56 disc, two lines, a door */}
          <div className="px-5 py-4 border-t border-borderSubtle/60 flex items-center gap-4">
            <span className="w-14 h-14 rounded-full shrink-0 border-2 border-silver/50" />
            <div className="flex-1 flex flex-col gap-1.5">
              <Line w={80} h={11} />
              <Line w={360} h={10} />
            </div>
            <Trigger w={118} />
          </div>
        </Box>
      );
    case 'billing':
      return (
        <Box
          rows={1}
          control={72}
          after={
            <div className="px-5 py-3 border-t border-borderSubtle/60">
              <div className="h-[18px] flex items-center">
                <Line w={56} h={11} />
              </div>
              <div className="h-[17px] flex items-center">
                <Line w={170} h={10} />
              </div>
              <div className="mt-2 flex flex-col">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className={`h-8 flex items-center justify-between ${i ? 'border-t border-borderSubtle/40' : ''}`}>
                    <Line w={88} h={11} />
                    <Line w={56} h={11} />
                    <Line w={52} h={11} />
                    <Block w={44} h={16} className="rounded" />
                    <Line w={34} h={10} />
                  </div>
                ))}
              </div>
            </div>
          }
        >
          {/* the plan, the three tiers; the card row comes from Box; the invoices after it */}
          <div className="px-5 py-4 border-t border-borderSubtle/60 flex items-center gap-6">
            <div className="flex-1">
              <div className="h-[26px] flex items-center gap-3">
                <Line w={92} h={18} />
                <Line w={84} h={11} />
                <Block w={52} h={16} className="rounded" />
              </div>
              <div className="mt-1 h-[17px] flex items-center">
                <Line w={260} h={10} />
              </div>
            </div>
            <Trigger w={128} />
          </div>
          <div className="px-5 pb-4 border-t border-borderSubtle/60 pt-3">
            <div className="h-[18px] flex items-center">
              <Line w={40} h={11} />
            </div>
            <div className="h-[17px] flex items-center">
              <Line w={330} h={10} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="rounded-md border border-borderSubtle p-3 flex flex-col gap-1">
                  <div className="h-[18px] flex items-center">
                    <Line w={[56, 62, 54][i]} h={11} />
                  </div>
                  <div className="h-[21px] flex items-center">
                    <Line w={[78, 78, 96][i]} h={13} />
                  </div>
                  <div className="h-[17px] flex items-center">
                    <Line w={[128, 112, 108][i]} h={10} />
                  </div>
                  <div className="mt-2 h-7 flex items-center">
                    <Trigger w={i === 1 ? 74 : 68} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Box>
      );
    case 'data':
      return <Box rows={3} control={92} />;
    case 'about':
      return (
        <Box rows={1}>
          {/* The mark, the wordmark and the version, then the licences door */}
          <div className="px-5 border-t border-borderSubtle/60 flex items-center gap-4 h-[73px]">
            <SlayerMark size={32} bare state="idle" label="" />
            <div className="flex flex-col gap-1.5">
              <Line w={118} h={13} />
              <Line w={92} h={10} />
            </div>
            <Trigger w={112} className="ml-auto" />
          </div>
        </Box>
      );
    default:
      return (
        <Box rows={1} control={150}>
          <div className="px-5 pb-4 border-t border-borderSubtle/60 pt-3 grid grid-cols-3 gap-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-md border border-borderSubtle p-2">
                <Block w="100%" h={132} className="rounded" />
                <div className="mt-2 h-[18px] flex items-center">
                  <Line w={[34, 36, 108][i]} h={11} />
                </div>
                <div className="h-[16px] flex items-center">
                  <Line w={[120, 160, 150][i]} h={10} />
                </div>
              </div>
            ))}
          </div>
        </Box>
      );
  }
};

export const SettingsPageSkeleton = ({ section = 'account' }: { section?: string }) => (
  <>
    <Head />
    <div className="grid grid-cols-1 xl:grid-cols-[168px_minmax(0,1fr)] gap-4 items-start w-full max-w-[1072px] mx-auto" aria-hidden data-skeleton="settings">
      {/* the rail in the page's order (2026-09-14): Account · Billing · Data | Appearance · The desk · Keyboard | About */}
      <div className="flex flex-col gap-0.5">
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className={`flex items-center gap-2 px-2.5 h-8 ${i === 3 || i === 6 ? 'mt-2' : ''}`}>
            <Block w={14} h={14} className="rounded-sm" />
            <Line w={[54, 46, 36, 76, 58, 62, 44][i]} h={11} />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-4 min-w-0">
        <SectionBox section={section} />
      </div>
    </div>
  </>
);
