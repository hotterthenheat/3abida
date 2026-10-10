/*
==================================================
  SLAYER TERMINAL - REVIEW · A TRADE'S TAGS
  (components/review/TagCards.tsx)

  What turns a journal's words into something that can
  be COUNTED: on a closed trade, the setup it was, the
  mistakes made in it, and whether the plan was
  followed. One line of labelled cards — the house's
  approved look, never a row of chips — and beside
  them the door to the reader's own lists: the tags
  are theirs to add to and take from (a tag taken off
  a list stays on the trades that carry it).
==================================================
*/

import { useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ListPlus, Plus, X } from 'lucide-react';
import DropdownMulti from '../ui/DropdownMulti';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import { MOODS, addTag, removeTag, useTags, type JournalEntry, type TagLists } from '../../data/review/journal';

const NONE = '—';
const PLAN: DropdownOption<string>[] = [
  { value: NONE, label: 'Not said', quiet: true },
  { value: 'yes', label: 'Yes', hint: 'It was the trade I meant to take, taken the way I meant to', tone: 'bull' },
  { value: 'no', label: 'No', hint: 'I left the plan — in the way in, the size, or the way out', tone: 'bear' },
];

/** The reader's two lists: a row a tag with a × to take it off, a field to add one */
const ListEditor = ({ list, title, placeholder, words }: { list: keyof TagLists; title: string; placeholder: string; words: string[] }) => {
  const [draft, setDraft] = useState('');
  const field = useRef<HTMLInputElement | null>(null);
  return (
    <div className="min-w-0 flex-1" data-tag-list={list}>
      <div className="font-mono text-[10px] uppercase tracking-widest text-textMuted">{title}</div>
      <div className="mt-1.5 flex flex-col">
        {words.map(w => (
          <div key={w} className="group flex items-center gap-2 h-7 border-b border-borderSubtle/60 text-[12px] text-textPrimary">
            <span className="min-w-0 flex-1 truncate">{w}</span>
            <button type="button" onClick={() => removeTag(list, w)} title={`Take “${w}” off the list — trades that carry it keep it`} aria-label={`Take ${w} off the list`} className="hit inline-flex items-center justify-center w-5 h-5 rounded text-textMuted hover:text-bear hover:bg-ink/[0.06] transition-colors" data-tag-remove={w}>
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {words.length === 0 && <div className="h-7 flex items-center text-[11px] text-textMuted">Nothing on this list yet</div>}
      </div>
      <form
        className="mt-2 flex items-center gap-1.5"
        onSubmit={e => {
          e.preventDefault();
          addTag(list, draft);
          setDraft('');
          field.current?.focus();
        }}
      >
        <input ref={field} value={draft} onChange={e => setDraft(e.target.value)} maxLength={40} placeholder={placeholder} aria-label={placeholder} className="h-7 min-w-0 flex-1 px-2 rounded-md border border-borderSubtle bg-panel text-[12px] text-textPrimary placeholder:text-textMuted outline-none focus:border-silver/60 transition-colors" data-tag-add={list} />
        <button type="submit" disabled={!draft.trim()} title="Add it to the list" aria-label="Add it to the list" className="hit inline-flex items-center justify-center w-7 h-7 rounded-md border border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted disabled:opacity-30 transition-colors">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};

/** The door to the reader's lists */
export const TagListsDoor = () => {
  const tags = useTags();
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" title="Your own lists of setups and mistakes — add to them, take from them" className="hit inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-dashed border-borderMuted font-mono text-[10px] text-textMuted hover:text-textPrimary hover:border-textSecondary data-[state=open]:text-silver data-[state=open]:border-silver/50 transition-colors" data-tag-lists-door>
          <ListPlus className="w-3 h-3" /> Your lists
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} collisionPadding={12} className="z-[95] w-[min(520px,calc(100vw-24px))] rounded-md border border-borderMuted bg-panel p-4 shadow-[0_14px_40px_rgba(0,0,0,0.45)] outline-none animate-soft-in" data-tag-lists-card>
          <div className="text-[13px] font-semibold text-textPrimary">Your lists</div>
          <p className="mt-0.5 text-[11px] text-textMuted">The words you tag a trade with. They are yours — name what you actually trade, and what you actually get wrong.</p>
          <div className="mt-3 flex flex-col sm:flex-row gap-5">
            <ListEditor list="setups" title="Setups" placeholder="Add a setup…" words={tags.setups} />
            <ListEditor list="mistakes" title="Mistakes" placeholder="Add a mistake…" words={tags.mistakes} />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

const MOOD_OPTIONS: DropdownOption<string>[] = [{ value: NONE, label: 'Not said', quiet: true }, ...MOODS.map(m => ({ value: m, label: m }))];

/** A NEW TAG, WRITTEN RIGHT HERE (the audit's PR-14: only the lists' door could add one, so how to tag a trade was unclear):
    the word goes on the list and on this trade at once — as its setup, or as one of its mistakes */
const NewTag = ({ entry, onChange }: { entry: JournalEntry; onChange: (patch: Partial<JournalEntry>) => void }) => {
  const [draft, setDraft] = useState('');
  const word = draft.trim().slice(0, 40);
  const put = (as: 'setup' | 'mistake') => {
    if (!word) return;
    addTag(as === 'setup' ? 'setups' : 'mistakes', word);
    onChange(as === 'setup' ? { setup: word } : { mistakes: [...new Set([...(entry.mistakes ?? []), word])] });
    setDraft('');
  };
  return (
    <form
      className="inline-flex items-center gap-1.5"
      onSubmit={e => {
        e.preventDefault();
        put('setup');
      }}
      data-tag-new
    >
      <input value={draft} onChange={e => setDraft(e.target.value)} maxLength={40} placeholder="A new tag…" aria-label="A new tag for this trade" className="h-7 w-[150px] px-2 rounded-md border border-borderSubtle bg-panel text-[12px] text-textPrimary placeholder:text-textMuted outline-none focus:border-silver/60 transition-colors" data-tag-new-field />
      <button type="submit" disabled={!word} className="hit h-7 px-2 rounded-md border border-borderSubtle font-mono text-[10px] text-textSecondary hover:text-textPrimary hover:border-borderMuted disabled:opacity-30 transition-colors" data-tag-new-as="setup">
        As the setup
      </button>
      <button type="button" disabled={!word} onClick={() => put('mistake')} className="hit h-7 px-2 rounded-md border border-borderSubtle font-mono text-[10px] text-textSecondary hover:text-textPrimary hover:border-borderMuted disabled:opacity-30 transition-colors" data-tag-new-as="mistake">
        As a mistake
      </button>
    </form>
  );
};

/** The cards on a trade — the setup, the mistakes, the plan, the mood — a new tag, and the door to the lists */
const TagCards = ({ entry, onChange }: { entry: JournalEntry; onChange: (patch: Partial<JournalEntry>) => void }) => {
  const tags = useTags();
  /* a tag the trade carries stays a choice even after it left the list */
  const setups = entry.setup && !tags.setups.includes(entry.setup) ? [...tags.setups, entry.setup] : tags.setups;
  const mistakes = [...tags.mistakes, ...(entry.mistakes ?? []).filter(m => !tags.mistakes.includes(m))];
  const setupOptions: DropdownOption<string>[] = [{ value: NONE, label: 'Not said', quiet: true }, ...setups.map(s => ({ value: s, label: s }))];
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-journal-tags>
      <DropdownSelect label="Setup" value={entry.setup ?? NONE} options={setupOptions} onChange={v => onChange({ setup: v === NONE ? undefined : v })} title="What kind of trade it was" testId="journal-setup" />
      <DropdownMulti label="Mistakes" values={entry.mistakes ?? []} groups={[{ title: 'What went wrong — as many as apply', options: mistakes.map(m => ({ value: m, label: m })) }]} onChange={v => onChange({ mistakes: v })} emptyWord="None" title="Mistakes made in it" testId="journal-mistakes" align="start" tone="warn" />
      <DropdownSelect label="Followed the plan" value={entry.plan ?? NONE} options={PLAN} onChange={v => onChange({ plan: v === NONE ? undefined : (v as 'yes' | 'no') })} title="Was it the trade you meant to take, taken the way you meant to" testId="journal-plan" />
      <DropdownSelect label="Mood" value={entry.mood ?? NONE} options={MOOD_OPTIONS} onChange={v => onChange({ mood: v === NONE ? undefined : v })} title="How you felt going in" testId="journal-mood" />
      <NewTag entry={entry} onChange={onChange} />
      <TagListsDoor />
    </div>
  );
};

export default TagCards;
