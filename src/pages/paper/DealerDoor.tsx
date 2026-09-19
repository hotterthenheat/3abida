/*
==================================================
  SLAYER TERMINAL - DEALER POSITIONING
  (pages/paper/DealerDoor.tsx)

  What the other side is carrying, drawn on the
  tape you trade: gamma, delta or vanna by strike,
  as heat-mapped bands behind the candles.

  TWO SOURCES, AND THE CARD SAYS WHICH. By default
  it is the terminal's own exposure profile (the
  one Terrain and Pinpoint read), at the expiry
  chosen here. Paste a vendor's CSV or JSON and
  that name reads YOURS instead, until it is
  cleared — the chip on the chart changes with it,
  because a level is only worth what its source is.

  A futures tape gets the index's own strikes moved
  onto it by the family ratio and the basis, the
  same arithmetic the twin quotes use, so a wall on
  NDX lands where it really sits on NQ.
==================================================
*/

import { useState } from 'react';
import { Flame } from 'lucide-react';
import PopoverCard from '../../components/ui/PopoverCard';
import CardTabs from '../../components/ui/CardTabs';
import type { ExposureExpiry } from '../../types/gex';
import type { Instrument } from '../../core/paper/instruments';
import { updatePaperPrefs, usePaperPrefs } from '../../core/paper/prefs';
import { DEALER_GREEKS, clearImport, dealerBook, parseDealerRows, setImport, useImports, type DealerGreek } from '../../core/paper/dealer';
import { Toggle } from './paperKit';

const DOOR = 'inline-flex items-center justify-center w-7 h-7 rounded-md border border-borderSubtle bg-chip text-textMuted hover:text-textPrimary hover:border-borderMuted data-[state=open]:border-silver/50 transition-colors';
const EXPIRIES: ExposureExpiry[] = ['0DTE', '1D', '2D', '5D', 'OPEX', 'ALL'];

const DealerDoor = ({ instrument }: { instrument: Instrument }) => {
  const prefs = usePaperPrefs();
  const d = prefs.dealer;
  const imports = useImports();
  const name = instrument.underlying.toUpperCase();
  const mine = imports[name];
  const [text, setText] = useState('');
  const [said, setSaid] = useState<string | null>(null);
  const book = d.on ? dealerBook(instrument, d.greek as DealerGreek, d.expiry as ExposureExpiry) : null;
  const drawable = instrument.kind === 'stock' || instrument.kind === 'future';
  return (
    <PopoverCard
      title="Dealer positioning"
      meta={d.on ? (book ? `${book.levels.length} levels · ${book.source}` : 'nothing here') : 'off'}
      width={344}
      testId="paper-dealer"
      trigger={
        <button
          type="button"
          title={d.on ? `${DEALER_GREEKS.find(g => g.key === d.greek)?.label} by strike, on the tape` : 'Dealer positioning — gamma, delta or vanna behind the tape'}
          aria-label="Dealer positioning"
          aria-pressed={d.on}
          className={`${DOOR} ${d.on ? 'text-textPrimary border-silver/40' : ''}`}
          data-paper-dealer
        >
          <Flame className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="px-3 py-2 border-b border-borderSubtle/70 flex items-center gap-2">
        <Toggle checked={d.on} onChange={v => updatePaperPrefs({ dealer: { on: v } })} label="Dealer positioning" />
        <span className="font-mono text-[10px] text-textPrimary">Draw it on the tape</span>
        {!drawable && <span className="ml-auto font-mono text-[9px] text-warn">not on a premium tape</span>}
      </div>
      <div className="px-3 py-2 border-b border-borderSubtle/70 flex flex-col gap-2">
        <CardTabs
          ariaLabel="Which greek"
          value={d.greek}
          onChange={v => updatePaperPrefs({ dealer: { greek: v } })}
          options={DEALER_GREEKS.map(g => ({ value: g.key, label: g.label }))}
        />
        <p className="font-mono text-[9px] text-textMuted leading-tight">{DEALER_GREEKS.find(g => g.key === d.greek)?.hint}</p>
      </div>
      <div className="px-3 py-2 border-b border-borderSubtle/70 flex items-center gap-1 flex-wrap">
        <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted mr-1">Expiry</span>
        {EXPIRIES.map(e => (
          <button
            key={e}
            type="button"
            onClick={() => updatePaperPrefs({ dealer: { expiry: e } })}
            aria-pressed={d.expiry === e}
            data-dealer-expiry={e}
            className={`h-5 px-1.5 rounded border font-mono text-[9px] tnum transition-colors ${d.expiry === e ? 'border-silver/50 text-textPrimary bg-ink/[0.05]' : 'border-borderSubtle text-textMuted hover:text-textSecondary'}`}
          >
            {e}
          </button>
        ))}
        {mine && <span className="ml-auto font-mono text-[9px] text-warn">your file wins</span>}
      </div>
      <div className="px-3 py-1.5 border-b border-borderSubtle/70 flex items-center gap-2">
        <Toggle checked={d.labels} onChange={v => updatePaperPrefs({ dealer: { labels: v } })} label="Label the heaviest" />
        <span className="font-mono text-[10px] text-textPrimary">Name the heaviest few</span>
      </div>
      <div className="px-3 pt-2 pb-1 font-mono text-[9px] uppercase tracking-widest text-textMuted">Bring your own · {name}</div>
      <div className="px-3 pb-2 font-mono text-[9px] text-textMuted leading-tight">
        CSV with a header — <span className="text-textSecondary">strike,gex,dex,vanna,oi</span> — or a JSON array of the same. Whatever is here is drawn for {name} on every chart until it is cleared.
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        spellCheck={false}
        placeholder={'strike,gex,dex,oi\n18000,-2.4e9,1.1e9,42000'}
        aria-label="Dealer levels to import"
        data-dealer-paste
        className="mx-3 mb-2 block w-[calc(100%-24px)] h-[88px] p-2 rounded border border-borderSubtle bg-inputBg font-mono text-[9px] leading-snug text-textSecondary placeholder:text-textMuted/60 outline-none focus:border-silver/60 resize-none"
      />
      <div className="px-3 pb-2.5 flex items-center gap-1.5">
        <button
          type="button"
          data-dealer-read
          onClick={() => {
            try {
              const rows = parseDealerRows(text);
              setImport(name, rows);
              updatePaperPrefs({ dealer: { on: true } });
              setSaid(`${rows.length} levels read for ${name}`);
            } catch (e) {
              setSaid(e instanceof Error ? e.message : 'That file could not be read');
            }
          }}
          className="h-6 px-2 rounded border border-borderSubtle font-mono text-[9px] uppercase tracking-widest text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors"
        >
          Read it
        </button>
        {mine && (
          <button
            type="button"
            onClick={() => {
              clearImport(name);
              setSaid(`${name} is back on the desk's own profile`);
            }}
            className="h-6 px-2 rounded border border-borderSubtle font-mono text-[9px] uppercase tracking-widest text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors"
          >
            Clear {name}
          </button>
        )}
        <span className="ml-auto font-mono text-[9px] text-textSecondary text-right leading-tight max-w-[150px]">{said ?? (mine ? `${mine.length} of yours` : 'the desk’s own profile')}</span>
      </div>
    </PopoverCard>
  );
};

export default DealerDoor;
