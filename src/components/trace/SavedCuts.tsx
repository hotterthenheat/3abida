/*
  SAVED CUTS — the Link / Save / N-saved control, and the chips that open
  them. Every Trace surface whose cut can be written as a query string wears
  this same one.

  It lived inline in the Screener: sixty lines of one-off buttons, a prompt,
  a status line and a chip list, all of it bound to that page's filters. The
  tape — the surface a trader most wants to hand someone — had none of it,
  because copying sixty lines to get it is a cost nobody pays. That is what a
  one-off pattern does to a product: it makes the second surface worse.

  The control owns the words and the wiring; the page owns only the two
  things that are actually its own — what its cut says as a query string, and
  what to do when one is opened.
*/

import { useEffect, useRef, useState } from 'react';
import { Check, Link2, Save, Trash2, X } from 'lucide-react';
import type { ViewStore } from '../../data/savedViews';
import { undoable } from '../ui/undo';

const BTN =
  'hit h-7 px-2 inline-flex items-center gap-1 rounded-md border border-borderSubtle text-[11px] text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors';

export interface SavedCutsProps {
  store: ViewStore;
  /** This surface's cut, as a query string without the leading '?' */
  query: string;
  /** Open a saved cut — the page decides what that means for its own state */
  onOpen: (query: string) => void;
  /** What one of these is called here: "screen", "cut", "view" */
  noun: string;
  /** A data-* prefix for probes */
  testId: string;
  /** Said back to the reader — rendered by the page, beside its sentence */
  onSay: (said: string) => void;
}

/** The three buttons. They belong on the controls line. */
export const SavedCutsControl = ({ store, query, noun, testId, onSay, open, onToggleOpen }: SavedCutsProps & { open: boolean; onToggleOpen: () => void }) => {
  const views = store.useViews();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const nameRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (naming) nameRef.current?.focus();
  }, [naming]);
  const save = () => {
    if (!name.trim()) {
      onSay('That needs a name.');
      return;
    }
    /* Echo what was SAVED, not what was typed. The store caps a name at forty characters. */
    const saved = store.saveView(name.trim(), query);
    onSay(saved ? `Saved as "${saved.name}".` : 'That needs a name.');
    setNaming(false);
  };
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ''}`;
    try {
      await navigator.clipboard.writeText(url);
      onSay('Link copied. It opens on this exact view.');
    } catch {
      /* A blocked clipboard is not a failure worth a dialog — say where it is. */
      onSay(url);
    }
  };
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={share} title={`Copy a link that opens this exact ${noun}`} aria-label={`Copy a link to this ${noun}`} className={BTN} data-cuts-share={testId}>
        <Link2 className="w-3 h-3" aria-hidden /> Link
      </button>
      {/* AN INLINE NAME, NOT THE BROWSER'S PROMPT (the audit's TR-9): Save opens a field in its place — Enter keeps the
          cut under that name, Esc or the × lets it go */}
      {naming ? (
        <span className="inline-flex items-center gap-1 h-7 pl-2 pr-1 rounded-md border border-borderMuted bg-ink/[0.03]">
          <input
            ref={nameRef}
            value={name}
            onChange={e => setName(e.target.value.slice(0, 40))}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                save();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setNaming(false);
              }
            }}
            placeholder={`Name this ${noun}`}
            aria-label={`Name this ${noun}`}
            className="w-[128px] bg-transparent text-[11px] text-textPrimary placeholder:text-textMuted focus:outline-none"
            data-cuts-name={testId}
          />
          <button type="button" onClick={save} aria-label={`Save this ${noun}`} className="hit p-1 rounded text-textSecondary hover:text-textPrimary">
            <Check className="w-3 h-3" aria-hidden />
          </button>
          <button type="button" onClick={() => setNaming(false)} aria-label="Cancel" className="hit p-1 rounded text-textMuted hover:text-textPrimary">
            <X className="w-3 h-3" aria-hidden />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => {
            setName('');
            setNaming(true);
          }}
          title={`Save this ${noun} by name`}
          aria-label={`Save this ${noun}`}
          className={BTN}
          data-cuts-save={testId}
        >
          <Save className="w-3 h-3" aria-hidden /> Save
        </button>
      )}
      {views.length > 0 && (
        <button type="button" onClick={onToggleOpen} aria-expanded={open} className={BTN} data-cuts-open={testId}>
          {views.length} saved
        </button>
      )}
    </span>
  );
};

/** The chips. They belong above the page's sentence. */
export const SavedCutsList = ({ store, onOpen, noun, testId, onSay, open }: SavedCutsProps & { open: boolean }) => {
  const views = store.useViews();
  if (!open || views.length === 0) return null;
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5" data-cuts-list={testId}>
      {views.map(v => (
        <span key={v.id} className="inline-flex items-center rounded-md border border-borderSubtle overflow-hidden">
          <button
            type="button"
            onClick={() => {
              onOpen(v.query);
              onSay(`Opened "${v.name}".`);
            }}
            className="hit h-6 px-2 text-[11px] text-textSecondary hover:text-textPrimary hover:bg-ink/[0.04] transition-colors"
            data-cuts-view={v.name}
          >
            {v.name}
          </button>
          {/* FORGET AT ONCE, WITH AN UNDO (the audit's X5): no "Forget?" second press — the chip goes, and the toast brings
              it back under its own name */}
          <button
            type="button"
            onClick={() => {
              store.removeView(v.id);
              undoable({ label: `Forgot "${v.name}"`, undo: () => store.saveView(v.name, v.query) });
            }}
            title={`Forget this ${noun}`}
            aria-label={`Forget the ${noun} "${v.name}"`}
            className="hit h-6 px-1.5 inline-flex items-center text-textMuted hover:text-bear border-l border-borderSubtle"
            data-cuts-forget={v.name}
          >
            <Trash2 className="w-2.5 h-2.5" aria-hidden />
          </button>
        </span>
      ))}
    </div>
  );
};

/** The pair, with the open/closed state they share. What was said clears itself after a few seconds (the audit's
    TR-20: "Link copied" stood for good). */
export function useSavedCuts() {
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => {
    if (!said) return;
    const t = window.setTimeout(() => setSaid(null), 4000);
    return () => window.clearTimeout(t);
  }, [said]);
  return { open, toggle: () => setOpen(o => !o), said, say: setSaid };
}
