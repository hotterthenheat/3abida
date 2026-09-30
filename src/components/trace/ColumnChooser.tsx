/*
  The column chooser — the Live Tape's "COLUMNS 17/17" door, promoted to a
  shared component (Noah, 2026-08-30: "youve missed columns"). Same grammar:
  a counted button, a popover with All · None, a checklist; groups optional.

  State is kept as the HIDDEN set, not the visible one — a page's column list
  is built inside its render, so a store that only names what to hide never
  has to know the list up front, and a column added later is visible by
  default instead of vanishing.
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react';

export interface ChooserColumn {
  key: string;
  label: string;
  group?: string;
}

/**
 * @param defaultHidden Columns a table opens CLOSED — the facts a compound
 *   cell already shows, which keep their own column only so a reader can sort
 *   by them. Applied on a first visit only: once the reader has opened one,
 *   the stored set is their answer and the default never argues with it.
 */
export function useHiddenColumns(storageKey: string, defaultHidden?: string[]) {
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) return new Set(defaultHidden ?? []);
      const arr: unknown = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
    } catch {
      return new Set(defaultHidden ?? []);
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...hidden]));
    } catch {
      /* non-fatal */
    }
  }, [hidden, storageKey]);
  const toggle = useCallback(
    (key: string) =>
      setHidden(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      }),
    []
  );
  const showAll = useCallback(() => setHidden(new Set()), []);
  const hideAll = useCallback((keys: string[]) => setHidden(new Set(keys)), []);
  return { hidden, toggle, showAll, hideAll };
}

const ColumnChooser = ({
  columns,
  hidden,
  onToggle,
  onAll,
  onNone,
  groupOrder,
}: {
  columns: ChooserColumn[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
  onAll: () => void;
  onNone: () => void;
  groupOrder?: string[];
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const shownCount = columns.filter(c => !hidden.has(c.key)).length;
  const groups = groupOrder ?? [...new Set(columns.map(c => c.group ?? ''))];

  const row = (c: ChooserColumn) => {
    const checked = !hidden.has(c.key);
    return (
      <button
        key={c.key}
        onClick={() => onToggle(c.key)}
        className="w-full flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded hover:bg-ink/[0.03] transition-colors"
      >
        <span
          className={`inline-flex w-3.5 h-3.5 shrink-0 items-center justify-center rounded-[3px] border transition-colors ${
            checked ? 'bg-silverFill border-silverFill' : 'border-borderMuted'
          }`}
        >
          {checked && <Check className="w-2.5 h-2.5 text-[#0a0a0a]" />}
        </span>
        <span className={`font-mono text-[11px] ${checked ? 'text-textPrimary' : 'text-textSecondary'}`}>{c.label}</span>
      </button>
    );
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border font-mono text-[10px] uppercase tracking-wider transition-colors ${
          open ? 'border-borderMuted bg-ink/[0.05] text-textPrimary' : 'border-borderSubtle bg-ink/[0.02] text-textSecondary hover:text-textPrimary'
        }`}
      >
        <SlidersHorizontal className="w-3 h-3" />
        Columns
        <span className="tnum text-textMuted">
          {shownCount}/{columns.length}
        </span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-40 w-[236px] border border-borderMuted bg-panel rounded-md shadow-2xl shadow-black/60 overflow-hidden animate-slide-in">
          <div className="flex items-center justify-between px-3 py-2 border-b border-borderSubtle">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-textPrimary">Row columns</span>
            <div className="flex items-center gap-2">
              <button onClick={onAll} className="font-mono text-[9px] uppercase tracking-wider text-textSecondary hover:text-select transition-colors">
                All
              </button>
              <span className="text-borderMuted">·</span>
              <button onClick={onNone} className="font-mono text-[9px] uppercase tracking-wider text-textSecondary hover:text-select transition-colors">
                None
              </button>
            </div>
          </div>
          <div className="max-h-[340px] overflow-y-auto py-1">
            {groups.map(group => {
              const cols = columns.filter(c => (c.group ?? '') === group);
              if (cols.length === 0) return null;
              return (
                <div key={group || '_'} className="px-1 py-0.5">
                  {group && (
                    <div className="flex items-center justify-between px-2 py-1">
                      <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-textMuted">{group}</span>
                      <span className="font-mono text-[9px] tnum text-textMuted">
                        {cols.filter(c => !hidden.has(c.key)).length}/{cols.length}
                      </span>
                    </div>
                  )}
                  {cols.map(row)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ColumnChooser;
