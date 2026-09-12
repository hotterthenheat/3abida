/*
==================================================
  SLAYER TERMINAL - YOUR REASONS (the builder)

  Watchers ships six reasons the desk watches
  for. This is the door for the reader's own.

  WHAT THE READER WRITES AND WHAT THEY DON'T. They
  write the conditions and the handle. They never
  write the explanation — the Reason column's
  sentence is composed from the conditions
  themselves (data/flowReasons.ts), so the words in
  the feed can never drift from the test that put
  the row there.

  THE COUNT IS THE VERDICT. Every draft says how
  many of today's contracts it catches, live, as
  you move the numbers. That is the honest answer
  to "is this any good": a reason that catches 400
  rows is a reason that says nothing, and a reason
  that catches none is a reason you will never
  hear from. We show the number and let the reader
  decide — no score, no grade, no advice.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';

/** The door's width — measured against the viewport before it opens. */
const DOOR_W = 400;
import { ChevronDown, ListPlus, Plus, Trash2, X } from 'lucide-react';
import Chip from '../ui/Chip';
import {
  MAX_REASONS,
  MAX_TERMS,
  REASON_FIELDS,
  REASON_FIELD_ORDER,
  reasonMatchCount,
  reasonSentence,
  removeReason,
  saveReason,
  suggestedName,
  useReasons,
  type Comparator,
  type ReasonField,
  type ReasonTerm,
  type UserReason,
} from '../../data/flowReasons';
import type { BookContract } from '../../types/trace';

/* The house dropdown, not a native <select> (Noah, 2026-08-30: "the dropdown
   menu ... need to be more readable") — the OS paints native option lists in
   its own colours and fonts, outside every token we own. Same anchored-popover
   grammar as the chart toolbar's pickers; long lists scroll. */
const PickMenu = <V extends string>({
  value,
  options,
  onPick,
  ariaLabel,
  className = '',
  menuClass = 'left-0',
}: {
  value: V;
  options: { value: V; label: string }[];
  onPick: (v: V) => void;
  ariaLabel: string;
  className?: string;
  /** Popover geometry. Defaults hug the anchor (right-aligned menus for
      triggers near the door's edge must not bleed out of the container). */
  menuClass?: string;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);
  const active = options.find(o => o.value === value);
  return (
    <div ref={ref} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1 rounded border border-borderSubtle bg-ink/[0.03] px-2 py-1 text-[10px] text-textPrimary hover:border-borderMuted transition-colors"
      >
        <span className="truncate">{active?.label ?? value}</span>
        <ChevronDown className={`ml-auto w-3 h-3 shrink-0 text-textMuted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className={`absolute top-full mt-1 z-[70] min-w-full max-h-60 overflow-y-auto border border-borderMuted bg-panel rounded-md shadow-2xl shadow-black/60 animate-slide-in ${menuClass}`}
        >
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onPick(o.value);
                setOpen(false);
              }}
              className={`w-full px-2.5 py-1.5 text-left text-[10.5px] transition-colors ${
                o.value === value ? 'bg-ink/[0.06] text-textPrimary font-semibold' : 'text-textSecondary hover:bg-ink/[0.04] hover:text-textPrimary'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* Groups as the reader types (Noah: "you should be listening to user input and
   putting commas where need be like 100,000 or 1,000,000"). The field holds
   the formatted TEXT; the parsed number flows out. A native number input
   forbids commas, which is exactly why it read as a wall of digits. */
const fmtNum = (raw: string): string => {
  const clean = raw.replace(/[^\d.]/g, '');
  const dot = clean.indexOf('.');
  const int = dot === -1 ? clean : clean.slice(0, dot);
  const frac = dot === -1 ? null : clean.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  const grouped = int ? Number(int).toLocaleString('en-US') : '';
  return frac === null ? grouped : `${grouped}.${frac}`;
};
const parseNum = (text: string): number => Number(text.replace(/,/g, '')) || 0;

const CommaInput = ({
  value,
  onChange,
  ariaLabel,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  ariaLabel: string;
  /** The field's sensible preset, as a GHOST — everyone knows where the
      number goes; the ghost shows the shape and dies at the first keystroke. */
  placeholder?: string;
}) => {
  const [text, setText] = useState(value ? fmtNum(String(value)) : '');
  // A field swap hands in a fresh preset — resync only when the numbers differ,
  // so mid-typing states ("1,000." ) are never stomped.
  useEffect(() => {
    if (parseNum(text) !== value) setText(value ? fmtNum(String(value)) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onChange={e => {
        const shown = fmtNum(e.target.value);
        setText(shown);
        onChange(parseNum(shown));
      }}
      className="shrink-0 w-[92px] bg-ink/[0.04] border border-borderSubtle rounded px-1.5 py-1 font-mono text-[10px] tnum text-textPrimary text-right outline-none focus:border-borderMuted placeholder:text-textMuted/60"
    />
  );
};

interface Draft {
  id?: string;
  name: string;
  right: 'ANY' | 'C' | 'P';
  terms: ReasonTerm[];
}

const freshTerm = (field: ReasonField = 'premium'): ReasonTerm => ({
  field,
  // Days-to-expiry and earnings-distance are ceilings in every question a
  // reader actually asks of them ("inside a week", "before the report").
  cmp: field === 'dte' || field === 'earnDays' ? 'atMost' : 'atLeast',
  value: REASON_FIELDS[field].preset,
});

const blankDraft = (): Draft => ({ name: '', right: 'ANY', terms: [freshTerm()] });

const asReason = (d: Draft): UserReason => ({
  id: d.id ?? 'draft',
  name: d.name.trim() || suggestedName(d.terms),
  right: d.right,
  terms: d.terms,
  createdAt: 0,
});

const ReasonDoor = ({ book }: { book: BookContract[] }) => {
  const reasons = useReasons();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setDraft(null);
    };
    // Esc backs out one step at a time: the form first, then the door.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (draft) setDraft(null);
      else setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, draft]);

  const preview = useMemo(() => (draft ? asReason(draft) : null), [draft]);
  const previewCount = useMemo(
    () => (preview && preview.terms.length ? reasonMatchCount(preview, book) : null),
    [preview, book]
  );

  const [align, setAlign] = useState<'left' | 'right'>('left');
  const full = reasons.length >= MAX_REASONS;
  /* A cleared value is an unfinished thought, not a zero threshold — the
     door refuses to ship "Over $0 traded" and says what is missing. */
  const incomplete = draft != null && draft.terms.some(t => !t.value);

  const commit = () => {
    if (!draft || draft.terms.length === 0 || incomplete) return;
    if (saveReason(draft)) setDraft(null);
  };

  /* Edge-aware like FilterDoor (Noah, 2026-08-30: "all my filters are
     literally bleeding outside of the page"): this button sits at the left
     of the controls row, so a door hung from its right edge ran 400px off
     the page. Open from the left edge; flip only when that would cross the
     viewport. */
  const toggle = () => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) setAlign(r.left + DOOR_W + 8 > window.innerWidth ? 'right' : 'left');
    setOpen(o => !o);
    setDraft(null);
  };

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-borderSubtle text-textSecondary hover:text-textPrimary hover:bg-ink/[0.04] font-mono text-[10px] uppercase tracking-wider transition-colors"
      >
        <ListPlus className="w-3 h-3" />
        Your reasons
        {/* Weight, not neon: the count is data (see the 2026-08-30 ink law). */}
        {reasons.length > 0 && <span className="font-bold text-textPrimary tnum">{reasons.length}</span>}
      </button>

      {open && (
        <div
          style={{ width: DOOR_W }}
          className={`absolute top-full mt-1.5 z-[60] max-h-[62vh] overflow-y-auto border border-borderMuted bg-panel/80 backdrop-blur-xl backdrop-saturate-150 rounded-md shadow-2xl shadow-black/60 p-3 animate-slide-in ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {!draft && (
            <>
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">
                  Reasons you wrote
                </span>
                <span className="font-mono text-[9px] text-textMuted tnum">
                  {reasons.length} of {MAX_REASONS}
                </span>
              </div>

              {reasons.length === 0 && (
                <p className="text-[11px] text-textSecondary leading-snug mb-2.5">
                  The desk watches for six things. Write your own and every contract that meets it joins the
                  feed, under your words.
                </p>
              )}

              <div className="flex flex-col gap-1.5 mb-2.5">
                {reasons.map(r => (
                  <div key={r.id} className="group border border-borderSubtle rounded px-2 py-1.5 bg-ink/[0.02]">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => setDraft({ id: r.id, name: r.name, right: r.right, terms: r.terms })}
                        className="font-bold text-[11px] text-textPrimary hover:text-select transition-colors truncate text-left"
                      >
                        {r.name}
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[9px] text-textMuted tnum">
                          {reasonMatchCount(r, book)} today
                        </span>
                        <button
                          onClick={() => removeReason(r.id)}
                          title="Remove this reason"
                          className="text-textMuted hover:text-bear transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="text-[10px] text-textSecondary leading-snug mt-0.5">{reasonSentence(r)}</div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setDraft(blankDraft())}
                disabled={full}
                title={full ? `Ten reasons is the most a feed stays readable with` : undefined}
                className={`w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  full
                    ? 'border-borderSubtle text-textMuted cursor-not-allowed'
                    : 'border-borderMuted text-textPrimary hover:bg-ink/[0.05]'
                }`}
              >
                <Plus className="w-3 h-3" />
                {full ? 'Shelf is full' : 'Write a reason'}
              </button>
            </>
          )}

          {draft && (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">
                  {draft.id ? 'Edit reason' : 'New reason'}
                </span>
                <button onClick={() => setDraft(null)} className="text-textMuted hover:text-textPrimary">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <label className="block mb-2.5">
                <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">Call it</span>
                <input
                  type="text"
                  value={draft.name}
                  maxLength={28}
                  placeholder={suggestedName(draft.terms)}
                  onChange={e => setDraft(d => (d ? { ...d, name: e.target.value } : d))}
                  className="mt-1 w-full bg-ink/[0.04] border border-borderSubtle rounded px-2 py-1 text-[11px] text-textPrimary outline-none focus:border-borderMuted"
                />
              </label>

              <div className="mb-2.5">
                <div className="font-mono text-[9px] uppercase tracking-widest text-textMuted mb-1">Side</div>
                <div className="flex flex-wrap gap-1">
                  {(['ANY', 'C', 'P'] as const).map(s => (
                    <Chip
                      key={s}
                      active={draft.right === s}
                      onClick={() => setDraft(d => (d ? { ...d, right: s } : d))}
                    >
                      {s === 'ANY' ? 'Both' : s === 'C' ? 'Calls' : 'Puts'}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="font-mono text-[9px] uppercase tracking-widest text-textMuted mb-1">
                All of these are true
              </div>
              <div className="flex flex-col gap-1.5 mb-2">
                {draft.terms.map((t, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <PickMenu
                      ariaLabel="What to watch"
                      className="flex-1"
                      menuClass="left-0 min-w-[210px]"
                      value={t.field}
                      options={REASON_FIELD_ORDER.map(f => ({ value: f, label: REASON_FIELDS[f].label }))}
                      onPick={f =>
                        setDraft(d =>
                          d
                            ? {
                                ...d,
                                // A new fact brings its own sensible number — the
                                // old one meant something else entirely.
                                terms: d.terms.map((x, j) => (j === i ? freshTerm(f) : x)),
                              }
                            : d
                        )
                      }
                    />
                    <PickMenu
                      ariaLabel="At least or at most"
                      className="shrink-0 w-[76px]"
                      menuClass="right-0 whitespace-nowrap"
                      value={t.cmp}
                      options={[
                        { value: 'atLeast' as Comparator, label: 'at least' },
                        { value: 'atMost' as Comparator, label: 'at most' },
                      ]}
                      onPick={cmp =>
                        setDraft(d =>
                          d ? { ...d, terms: d.terms.map((x, j) => (j === i ? { ...x, cmp } : x)) } : d
                        )
                      }
                    />
                    <CommaInput
                      ariaLabel="Value"
                      placeholder={fmtNum(String(REASON_FIELDS[t.field].preset))}
                      value={t.value}
                      onChange={v =>
                        setDraft(d =>
                          d ? { ...d, terms: d.terms.map((x, j) => (j === i ? { ...x, value: v } : x)) } : d
                        )
                      }
                    />
                    <button
                      onClick={() =>
                        setDraft(d => (d ? { ...d, terms: d.terms.filter((_, j) => j !== i) } : d))
                      }
                      title="Drop this condition"
                      className="shrink-0 text-textMuted hover:text-bear transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() =>
                  setDraft(d => (d && d.terms.length < MAX_TERMS ? { ...d, terms: [...d.terms, freshTerm()] } : d))
                }
                disabled={draft.terms.length >= MAX_TERMS}
                className={`inline-flex items-center gap-1 mb-2.5 font-mono text-[10px] transition-colors ${
                  draft.terms.length >= MAX_TERMS
                    ? 'text-textMuted cursor-not-allowed'
                    : 'text-textSecondary hover:text-textPrimary'
                }`}
              >
                <Plus className="w-3 h-3" />
                Add a condition
              </button>

              {/* What it will say in the feed, and what it catches — live. */}
              <div className="border-t border-borderSubtle pt-2 mb-2.5">
                <div className="font-mono text-[9px] uppercase tracking-widest text-textMuted mb-1">
                  Reads as
                </div>
                <div className={`text-[11px] leading-snug ${incomplete ? 'text-textMuted' : 'text-textPrimary'}`}>
                  {!preview || preview.terms.length === 0
                    ? 'Add a condition to begin.'
                    : incomplete
                      ? 'Set a number to finish the condition.'
                      : reasonSentence(preview)}
                </div>
                {previewCount !== null && !incomplete && (
                  <div className="text-[10px] text-textSecondary mt-1 tnum">
                    Catches <span className="font-bold text-textPrimary">{previewCount}</span> of today&apos;s{' '}
                    {book.length.toLocaleString('en-US')} contracts
                    {previewCount === 0
                      ? ' — nothing on the book meets it right now.'
                      : previewCount > 120
                        ? ' — loud enough that it may not narrow much.'
                        : '.'}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={commit}
                  disabled={draft.terms.length === 0 || incomplete}
                  className={`flex-1 px-2 py-1.5 rounded border font-mono text-[10px] uppercase tracking-wider transition-colors ${
                    draft.terms.length === 0 || incomplete
                      ? 'border-borderSubtle text-textMuted cursor-not-allowed'
                      : 'border-borderMuted text-textPrimary hover:bg-ink/[0.05]'
                  }`}
                >
                  {draft.id ? 'Save changes' : 'Add to the feed'}
                </button>
                <button
                  onClick={() => setDraft(null)}
                  className="px-2 py-1.5 rounded border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ReasonDoor;
