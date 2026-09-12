import {
  DATA_STATE_NOTES, DATA_STATE_WORDS, PROVENANCE_NOTES, PROVENANCE_WORDS,
  weakest, type DataState, type ProvenanceKind, type ProvenanceKey,
} from '../../data/provenance';

/*
  P-1's chip, grown to the full vocabulary. Names what a panel is standing
  on, in one word, with the sentence on hover.

  NO PALETTE INK, still. The dealer colours all mean market things and
  red/green is price direction; "where this number came from" is none of
  those. So the chip is steel and carries its kind in the WORD plus the
  DOT'S TREATMENT — which gives five distinguishable states without
  borrowing a single meaning from the map:

    live        a filled dot with a ring, the only one that moves
    measured    filled
    derived     hollow
    model       hollow, with a slash — our opinion, and it should not look
                like a reading
    simulated   hollow and dimmed

  A reader scanning a screen for the weakest source is looking for dim; one
  checking whether a number is OURS is looking for the slash.

  STATE IS A SUFFIX, NOT A SIXTH WORD. "measured · stale" says two true
  things; a single word would have to drop one of them. Unavailable is the
  exception that earns different treatment — a struck-through dot and the
  word "no data" — because there is no value behind it to qualify.

  THE WARN INK IS THE ONE BORROWED COLOUR, and only for stale and partial.
  Those are the two states a reader must not scroll past, and the rule
  against palette ink is about not implying a MARKET meaning; amber here
  reads as "attention", which is what it means everywhere else on the desk.
*/

const DOT: Record<ProvenanceKind, string> = {
  live: 'bg-textSecondary ring-1 ring-textSecondary/40',
  measured: 'bg-textSecondary',
  derived: 'border border-current',
  model: 'border border-current',
  simulated: 'border border-current opacity-60',
};

export interface ProvenanceChipProps {
  sources: readonly ProvenanceKey[];
  /** Overrides the kind derived from `sources` — for a panel that IS a model. */
  kind?: ProvenanceKind;
  /** How the value is doing right now. Defaults to ok. */
  state?: DataState;
  /** Extra sentence appended to the hover text. */
  note?: string;
  className?: string;
}

const ProvenanceChip = ({ sources, kind, state = 'ok', note, className = '' }: ProvenanceChipProps) => {
  const e = weakest(sources);
  const k = kind ?? e.kind;
  const word = PROVENANCE_WORDS[k];
  const stateWord = DATA_STATE_WORDS[state];
  const dim = k === 'simulated' || state === 'unavailable';

  const title = [
    PROVENANCE_NOTES[k],
    e.note,
    state !== 'ok' ? DATA_STATE_NOTES[state] : '',
    note ?? '',
  ].filter(Boolean).join(' ');

  return (
    <span
      title={title}
      aria-label={`Data provenance: ${word}${stateWord ? `, ${stateWord}` : ''} — ${title}`}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
        state === 'stale' || state === 'partial'
          ? 'border-warn/40 text-warn'
          : `border-borderSubtle ${dim ? 'text-textMuted' : 'text-textSecondary'}`
      } ${className}`}
    >
      <span aria-hidden className="relative inline-flex items-center justify-center w-1.5 h-1.5">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${DOT[k]}`} />
        {/* The slash marks OUR judgment — see the header */}
        {k === 'model' && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="block w-[3px] h-px bg-current rotate-45" />
          </span>
        )}
        {state === 'unavailable' && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="block w-2 h-px bg-current rotate-45" />
          </span>
        )}
      </span>
      {word}
      {stateWord && <span className="opacity-80">&nbsp;· {stateWord}</span>}
    </span>
  );
};

export default ProvenanceChip;
