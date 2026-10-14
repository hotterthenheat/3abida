/*
  THE REPLAY'S OWN TOOLS on Terrain's transport (the owner's item 8, 2026-10-14): go to a session and a time, a random
  start, and hide the future. They stand beside the way out of the replay bar (ReplayStrip `tools`).

  GO TO: the sessions the tape holds, and a time typed on the reader's own clock ("10:42 am" — the house's clock, never a
  24-hour time; without am or pm the reading inside the session is taken, data/replayFrame.ts minuteFromText). An empty
  time starts the session's first minute.
  RANDOM START: a session the replay can draw whole — every minute's bar, the field's column at every minute, its priced
  move — and a time in it with half an hour left (randomStart); never a session with an input missing (the owner's
  acceptance (iii)). With none ready it says why.
  HIDE THE FUTURE: on by default; off, the rest of the session stands faded right of the cursor — read by nothing.
*/
import { useState } from 'react';
import { CalendarClock, Eye, EyeOff, Shuffle } from 'lucide-react';
import PopoverCard from '../ui/PopoverCard';
import DropdownSelect from '../ui/DropdownSelect';
import { isoDayLabel } from '../../core/format';
import { marketClock } from '../../core/nyTime';

interface Props {
  /** The sessions the tape holds, New York dates, oldest first */
  days: string[];
  /** The session the cursor is in (the newest before a pick) */
  day: string;
  onJump: (day: string, text: string) => string | null;
  onRandom: () => string | null;
  /** How many sessions a random start can land on */
  ready: number;
  hideFuture: boolean;
  onHideFuture: (v: boolean) => void;
  /** The future toggle means nothing before a pick */
  picked: boolean;
}

const iconBtn = 'hit shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06] aria-pressed:text-textPrimary transition-colors';

const ReplayTools = ({ days, day, onJump, onRandom, ready, hideFuture, onHideFuture, picked }: Props) => {
  const [to, setTo] = useState(day);
  const [text, setText] = useState('');
  const [said, setSaid] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const go = () => setSaid(onJump(to, text));
  const options = [...days].reverse().map(d => ({ value: d, label: isoDayLabel(d) }));
  return (
    <span className="relative flex items-center gap-0.5" data-replay-tools>
      {note && (
        <span className="absolute bottom-full right-0 mb-2 w-[260px] rounded-md border border-borderMuted bg-panel px-2 py-1.5 text-[11px] text-textSecondary shadow-[0_6px_18px_rgba(0,0,0,0.45)]" role="status" data-replay-note>
          {note}
        </span>
      )}
      <PopoverCard
        trigger={
          <button type="button" className={iconBtn} title="Go to a session and a time" aria-label="Go to a session and a time" data-replay-goto>
            <CalendarClock className="w-3.5 h-3.5" />
          </button>
        }
        title="Go to"
        width={280}
        onOpenChange={o => {
          if (o) {
            setTo(day || days[days.length - 1] || '');
            setSaid(null);
          }
        }}
        testId="replay-goto"
      >
        <form
          className="px-3 py-2.5 flex flex-col gap-2"
          onSubmit={e => {
            e.preventDefault();
            go();
          }}
        >
          <DropdownSelect label="Session" value={to} options={options} onChange={v => setTo(v)} title="The session to replay" testId="replay-goto-day" size="sm" />
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-textMuted">Time, on your clock</span>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={to ? marketClock(10, 0, { on: new Date(`${to}T16:00:00Z`) }) : '10:00 am'}
              className="h-7 rounded-md border border-borderSubtle bg-canvas px-2 font-mono text-[12px] text-textPrimary outline-none focus:border-borderMuted"
              data-replay-goto-time
            />
          </label>
          {said && (
            <p className="text-[11px] text-textSecondary" role="alert" data-replay-goto-said>
              {said}
            </p>
          )}
          <button type="submit" className="hit self-end h-7 px-3 rounded-md border border-borderMuted text-[12px] text-textPrimary hover:bg-ink/[0.06]" data-replay-goto-go>
            Go
          </button>
        </form>
      </PopoverCard>
      <button
        type="button"
        className={iconBtn}
        onClick={() => {
          const why = onRandom();
          setNote(why);
          if (why) window.setTimeout(() => setNote(n => (n === why ? null : n)), 4000);
        }}
        title={ready ? `A random start — one of the ${ready} session${ready === 1 ? '' : 's'} the replay can draw whole, at a random time` : 'A random start — no session can be drawn whole yet'}
        aria-label="A random start"
        data-replay-random
      >
        <Shuffle className="w-3.5 h-3.5" />
      </button>
      {picked && (
        <button
          type="button"
          className={iconBtn}
          aria-pressed={!hideFuture}
          onClick={() => onHideFuture(!hideFuture)}
          title={hideFuture ? 'The rest of the session is hidden — show it, faded' : 'The rest of the session is showing, faded — hide it'}
          aria-label={hideFuture ? 'Show the rest of the session' : 'Hide the rest of the session'}
          data-replay-future={hideFuture ? 'hidden' : 'shown'}
        >
          {hideFuture ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      )}
    </span>
  );
};

export default ReplayTools;
