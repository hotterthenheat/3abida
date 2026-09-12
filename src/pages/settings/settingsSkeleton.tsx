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

import { Block, Facts, Line, SubLine, Trigger } from '../../components/ui/skeletonKit';

const Head = () => (
  <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" aria-hidden data-skeleton="settings-head">
    <div className="min-w-0 flex-1">
      <div className="h-6 flex items-center gap-2.5">
        <span className="holo-bg w-6 h-6 rounded-[7px] shrink-0 inline-flex items-center justify-center font-mono text-[10px] font-bold text-[#0a0a0a]">&gt;_</span>
        <span className="text-[15px] font-semibold leading-tight text-textPrimary">Settings</span>
      </div>
      <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">How the terminal looks, what the desk opens on, what it says out loud</p>
    </div>
    <Facts widths={[60, 72]} />
  </header>
);

/** A box: the head (title + line), then rows of a name, its line and a control.
    A setting's row is 60px (two lines of text on py-3); a keyboard row is 42. */
const Box = ({ rows, rowH = 60, control = 0, children }: { rows: number; rowH?: number; control?: number; children?: React.ReactNode }) => (
  <div className="border border-borderSubtle rounded-md bg-panel overflow-hidden" aria-hidden data-skeleton="settings-box">
    <div className="px-5 pt-4 pb-3">
      <div className="h-[18px] flex items-center">
        <Line w={110} h={14} />
      </div>
      <SubLine w={460} />
    </div>
    {children}
    {Array.from({ length: rows }, (_, i) => (
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
    ))}
  </div>
);

/** The one box the route names, in its own shape */
const SectionBox = ({ section }: { section: string }) => {
  switch (section) {
    case 'desk':
      return <Box rows={4} control={110} />;
    case 'keyboard':
      return <Box rows={6} rowH={41} />;
    case 'account':
    case 'billing':
    case 'data':
      return <Box rows={1} />;
    case 'about':
      return (
        <Box rows={3}>
          {/* The mark, the wordmark and the version, then the credits */}
          <div className="px-5 border-t border-borderSubtle/60 flex items-center gap-4 h-[73px]">
            <span className="holo-bg w-10 h-10 rounded-[7px] shrink-0" />
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

export const SettingsPageSkeleton = ({ section = 'appearance' }: { section?: string }) => (
  <>
    <Head />
    <div className="grid grid-cols-1 xl:grid-cols-[168px_minmax(0,1fr)] gap-4 items-start" aria-hidden data-skeleton="settings">
      <div className="flex flex-col gap-0.5">
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className={`flex items-center gap-2 px-2.5 h-8 ${i === 3 || i === 6 ? 'mt-2' : ''}`}>
            <Block w={14} h={14} className="rounded-sm" />
            <Line w={[76, 58, 62, 54, 46, 36, 44][i]} h={11} />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-4 min-w-0">
        <SectionBox section={section} />
      </div>
    </div>
  </>
);

export default SettingsPageSkeleton;
