import { useState } from 'react';
import RichRead from '../ui/RichRead';
import type { MarketNote } from '../../types/gex';

interface MarketNotesProps {
  notes: MarketNote[];
  onAddNote: (text: string) => void;
}

/**
 * Timestamped session commentary — engine observations arrive on the scan
 * cadence; the trader can append their own lines.
 */
const MarketNotes = ({ notes, onAddNote }: MarketNotesProps) => {
  const [draft, setDraft] = useState('');

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onAddNote(text);
    setDraft('');
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-grow overflow-y-auto min-h-0 flex flex-col gap-2 pr-1">
        {notes.length === 0 && (
          <span className="font-mono text-[10px] text-textMuted uppercase tracking-widest py-4 text-center">
            Awaiting first observation…
          </span>
        )}
        {notes.map((note, i) => (
          <div key={`${note.time}-${i}`} className="flex items-start gap-2 animate-slide-in">
            <span className="shrink-0 font-mono text-[9px] tnum text-textMuted pt-px">{note.time}</span>
            <p className={`text-[11px] leading-snug ${note.manual ? 'text-textPrimary' : 'text-textSecondary'}`}>
              {note.manual && <span className="font-mono text-[8px] uppercase tracking-wider text-textMuted mr-1.5">you</span>}
              <RichRead text={note.text} />
            </p>
          </div>
        ))}
      </div>
      <div className="pt-2 mt-2 border-t border-borderSubtle">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Add a note…"
          className="w-full bg-inputBg border border-borderSubtle rounded-md px-2.5 py-1.5 font-mono text-[11px] text-textPrimary placeholder:text-textMuted focus:border-borderMuted outline-none transition-colors"
        />
      </div>
    </div>
  );
};

export default MarketNotes;
