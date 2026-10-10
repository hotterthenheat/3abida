/*
==================================================
  SLAYER TERMINAL - THE ROOM'S WORDS
  (components/levels/Glossary.tsx)

  The audit's PP-27, 2026-10-09: Pinpoint speaks a
  few words of its own — trapdoor, shelf, the 50%
  run, the strikes' pull, "beyond the ruler" — and
  no guide said what they meant. One list, at the
  foot of every "How to read" that uses them, so
  each word means one thing on every page.
==================================================
*/

export type GlossaryWord = 'wall' | 'shelf' | 'trapdoor' | 'pocket' | 'flip' | 'supreme' | 'pin' | 'maxPain' | 'run' | 'pull' | 'ruler' | 'reach' | 'sign';

/** The room's words — read by the guides' foot and by the glossary page (data/glossary.ts) */
export const ROOM_WORDS: Record<GlossaryWord, [string, string]> = {
  wall: ['Wall', 'A strike whose dealer hedging pushes back on price. The call wall is the heaviest such strike above spot, the put wall the heaviest below.'],
  shelf: ['Shelf', 'A strike that pushes back with at least a third of the heaviest strike’s hedging, but is not one of the named walls.'],
  trapdoor: ['Trapdoor', 'A strike whose hedging pushes a move along rather than back — price tends to travel through it, not stop at it.'],
  pocket: ['Empty stretch', 'Strikes with almost no hedging between two shelves; a break into one has little in its way until the next shelf.'],
  flip: ['Flip', 'The price where dealer hedging changes sides: above it the hedging absorbs moves, below it the hedging amplifies them.'],
  supreme: ['Supreme', 'The heaviest strike of the whole book. Magenta marks it, and nothing else.'],
  pin: ['Gamma pin', 'The strike with the most open contracts near spot.'],
  maxPain: ['Max pain', 'The close at which today’s contracts would pay their holders least — arithmetic on open interest, marked, not a target.'],
  run: ['The 50% run', 'The narrowest run of strikes, grown out from the likeliest close, that holds half the odds of where the close lands (and the 80% run, four in five).'],
  pull: ['The strikes’ pull', 'How the hedging bends the close odds: absorbing strikes draw the close toward them, amplifying ones push it off, more so as the bell nears.'],
  ruler: ['Beyond the ruler', 'Strikes past the distance the ruler shows; they are counted, not drawn. Too light to draw: strikes under the drawing’s threshold, drawn as ticks.'],
  reach: ['In reach', 'Reached more than 15% of the time by the close, on the expected move for the minutes left.'],
  sign: ['The sign', 'In this terminal negative hedging is call-heavy and absorbs moves, positive is put-heavy and amplifies them — the street’s usual sign turned over.'],
};

/** The words a guide uses, defined — a short list at its foot */
const Glossary = ({ words }: { words: GlossaryWord[] }) => (
  <div className="border-t border-borderSubtle/60 pt-2.5" data-glossary>
    <p className="text-[12px] text-textMuted">The words on this page</p>
    <dl className="mt-1 grid gap-y-1.5" style={{ gridTemplateColumns: 'max-content minmax(0,1fr)', columnGap: 12 }}>
      {words.map(w => (
        <div key={w} className="contents">
          <dt className="text-[12px] font-semibold text-textPrimary">{ROOM_WORDS[w][0]}</dt>
          <dd className="text-[12px] leading-relaxed text-textSecondary">{ROOM_WORDS[w][1]}</dd>
        </div>
      ))}
    </dl>
  </div>
);

export default Glossary;
