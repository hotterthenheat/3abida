/*
==================================================
  SLAYER TERMINAL - THE WEIGHER'S SKELETON
  (pages/weigherSkeleton.tsx)

  The desk standing in as itself (the walk,
  2026-09-11): the shell head with its two facts,
  then the four cards on the same 3:2 grid — the
  chart with its floating strip, the chain with its
  line of cards over a grid of 30px rows, the
  scanner with its Kind card over 34px rows, the
  contract card's empty ground. Landed geometry
  measured 2026-09-11 at 1905×960: head 56, frame
  from 80, cells 515 · 343, card heads 33. Imports
  nothing heavy.
==================================================
*/

import { Scale } from 'lucide-react';
import { Block, ChartGround, Facts, Line, Trigger } from '../components/ui/skeletonKit';

/* the desk's cards are panels now (the 55% wash read as a grey slab on paper) */
const CARD_FILL = 'rgb(var(--panel))';

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-0 min-w-0">
    <div className="h-full flex flex-col overflow-hidden rounded-md border border-ink/[0.07]" style={{ background: CARD_FILL }}>
      {children}
    </div>
  </div>
);

/** A desk card's head: the title at the left, its cards at the right — 33px with a line of h-7 cards in it */
const Head = ({ title = 48, children }: { title?: number; children?: React.ReactNode }) => (
  <div className="shrink-0 flex items-center gap-2 pr-2.5 py-0.5 min-h-8 border-b border-ink/[0.05]">
    <div className="flex items-center gap-2 pl-2.5 self-stretch shrink-0">
      <Line w={title} h={10} />
    </div>
    <span className="ml-auto flex flex-1 flex-wrap items-center justify-end gap-1.5 min-w-0">{children}</span>
  </div>
);

/** A grid window's head and rows in the house's clothes */
const Rows = ({ cols, rows, rowH, headH }: { cols: number[]; rows: number; rowH: number; headH: number }) => (
  <div className="flex-grow min-h-0 overflow-hidden">
    <div className="flex items-center gap-3 px-2 border-b border-ink/[0.06]" style={{ height: headH }}>
      {cols.map((w, i) => (
        <Line key={i} w={w} h={8} className={i > 0 ? 'ml-auto' : ''} />
      ))}
    </div>
    {Array.from({ length: rows }, (_, r) => (
      <div key={r} className="flex items-center gap-3 px-2 border-b border-ink/[0.04]" style={{ height: rowH, opacity: 1 - Math.min(0.55, Math.abs(r - Math.floor(rows / 2)) * 0.06) }}>
        {cols.map((w, i) => (
          <Line key={i} w={w + 6} h={i === 0 ? 11 : 10} className={i > 0 ? 'ml-auto' : ''} />
        ))}
      </div>
    ))}
  </div>
);

export const WeigherPageSkeleton = () => (
  <div className="relative flex-1 min-h-0 flex flex-col" aria-hidden aria-busy="true" aria-label="Loading" data-skeleton="weigher">
    {/* the shell head as static chrome, the two facts as lines */}
    <header className="shrink-0 flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle">
      <div className="min-w-0 flex-1">
        <div className="h-6 flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-borderSubtle text-textSecondary shrink-0">
            <Scale className="w-3.5 h-3.5" />
          </span>
          <span className="text-[15px] font-semibold leading-tight text-textPrimary">Weigher</span>
          <Line w={72} h={12} />
        </div>
        <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">Chart, chain and scanner on one desk — pick a name, pick a contract, read what it has to clear</p>
      </div>
      <Facts widths={[110, 118]} />
    </header>
    <div className="relative flex-1 min-h-0 mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] grid-rows-[minmax(0,3fr)_minmax(0,2fr)] gap-2.5">
      {/* the chart, its strip floating over the top: the name capsule, Stock/Premium, the toolbar */}
      <div className="min-h-0 min-w-0">
        <div className="h-full relative overflow-hidden rounded-md border border-ink/[0.07]" style={{ background: CARD_FILL }}>
          <div className="absolute inset-0">
            <ChartGround />
          </div>
          <div className="absolute top-0 inset-x-0 z-20 flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-2 pr-[76px] py-1">
            <Block w={112} h={28} className="rounded-full" />
            <Line w={56} h={11} />
            <Line w={52} h={11} />
            <span className="inline-flex items-center gap-4 ml-1">
              <Line w={34} h={9} />
              <Line w={46} h={9} />
            </span>
            {[44, 28, 40, 40, 44].map((w, i) => (
              <Block key={i} w={w} h={24} className="rounded" />
            ))}
          </div>
        </div>
      </div>
      {/* the chain: the name's pill and four cards over a grid of 30px rows, the market's hairline mid-window */}
      <Card>
        <Head title={40}>
          <Block w={60} h={24} className="rounded-full" />
          <Trigger w={96} />
          <Trigger w={150} />
          <Trigger w={100} />
          <Trigger w={170} />
          <Line w={30} h={9} />
          <Block w={20} h={20} className="rounded" />
        </Head>
        <Rows cols={[40, 40, 40, 30, 50, 34, 34]} rows={15} rowH={30} headH={29} />
      </Card>
      {/* the scanner: the Kind card over 34px rows */}
      <Card>
        <Head title={58}>
          <Trigger w={150} />
        </Head>
        <Rows cols={[70, 40, 50, 50, 24]} rows={8} rowH={34} headH={28} />
      </Card>
      {/* the contract, empty until a strike is weighed */}
      <Card>
        <Head title={88} />
        <div className="flex-grow min-h-0 flex flex-col items-center justify-center gap-1.5">
          <Line w={150} h={11} />
          <Line w={330} h={9} />
        </div>
      </Card>
    </div>
  </div>
);

export default WeigherPageSkeleton;
