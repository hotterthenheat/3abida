/*
==================================================
  SLAYER TERMINAL - UNDO, IN PLACE OF "ARE YOU SURE?" (ui/undo.tsx)

  A destructive action happens AT ONCE, and a chip in
  the shell's toast column says what went, with an
  Undo and a countdown — "Removed Live chart · Undo
  6s" (the audit's X5, 2026-10-09: Flatten, a new
  account, a deleted session or desk, an untrack, a
  cleared log all acted in one click with no way
  back). A confirm dialog asks before every click; an
  undo asks nothing and forgives the one that was
  wrong. The chip lives in the one toast column
  (AlertToasts), never a second stack over it.
==================================================

  USAGE. Do the destructive thing first, keeping what it takes to put it back, then hand the way back to
  `undoable`: `const gone = desks[i]; removeDesk(i); undoable({ label: \`Removed ${gone.name}\`, undo: () => restoreDesk(gone, i) });`
  The chip shows "<label> · Undo" for `ms` (6 s by default), its countdown pausing while a pointer is over it or
  focus is in it; Undo runs `undo` once and the chip goes, and Ctrl+Z (⌘Z) runs the newest chip's Undo from anywhere
  that is not a text field. `onExpire` runs if the time runs out instead — for an action whose last step must wait
  (a delete that also tells a server later). A second chip with the same `key` replaces the first (removing several
  widgets one after another keeps one chip, so give it an undo that restores them all). The label is the plain past
  tense of what happened, in the house's words ("Closed 2 positions", "Untracked SPY 475C"), and never "Undo" itself.
  `undoable` returns a function that takes the chip away without undoing. Nothing to mount on a page: the terminal
  shell renders <UndoToasts /> once, inside AlertToasts' column.
*/

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

export interface UndoOptions {
  /** What happened, in the past tense: "Removed Live chart" */
  label: string;
  /** Put it back. Runs at most once. */
  undo: () => void;
  /** How long the way back stays open, in ms (default 6000) */
  ms?: number;
  /** Runs once if the time runs out (or the chip is replaced) without an Undo */
  onExpire?: () => void;
  /** A chip with the same key replaces this one */
  key?: string;
}

interface Entry {
  id: number;
  label: string;
  undo: () => void;
  onExpire?: () => void;
  key?: string;
  ms: number;
  /** ms left on the clock when it last started running */
  left: number;
  /** when it last started running (Date.now()), or null while held */
  since: number | null;
  /** where focus was when the action happened — it goes back there after an Undo */
  from: HTMLElement | null;
}

const AT_MOST = 3;
let entries: Entry[] = [];
let seq = 1;
const subs = new Set<() => void>();
const emit = () => {
  entries = [...entries];
  subs.forEach(f => f());
};
const timers = new Map<number, number>();

const remaining = (e: Entry) => (e.since === null ? e.left : Math.max(0, e.left - (Date.now() - e.since)));

function arm(e: Entry) {
  window.clearTimeout(timers.get(e.id));
  if (e.since === null) return;
  timers.set(e.id, window.setTimeout(() => expire(e.id), remaining(e)));
}

function drop(id: number): Entry | undefined {
  const e = entries.find(x => x.id === id);
  if (!e) return undefined;
  window.clearTimeout(timers.get(id));
  timers.delete(id);
  entries = entries.filter(x => x.id !== id);
  emit();
  return e;
}

function expire(id: number) {
  drop(id)?.onExpire?.();
}

/** Run a chip's Undo, once, and take the chip away */
function runUndo(id: number) {
  const e = drop(id);
  if (!e) return;
  e.undo();
  /* the chip held focus (or the key was pressed from where the action was): hand it back to where the reader acted,
     else to the page itself, never to the page's body */
  requestAnimationFrame(() => {
    const at = document.activeElement;
    if (at && at !== document.body && document.contains(at)) return;
    const back = e.from && document.contains(e.from) ? e.from : document.getElementById('content');
    back?.focus({ preventScroll: true });
  });
}

/** The action is done; offer the way back. Returns a function that takes the chip away without undoing. */
export function undoable({ label, undo, ms = 6000, onExpire, key }: UndoOptions): () => void {
  if (key) {
    const old = entries.find(e => e.key === key);
    if (old) expire(old.id);
  }
  const from = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
  const e: Entry = { id: seq++, label, undo, onExpire, key, ms, left: ms, since: Date.now(), from };
  entries = [e, ...entries];
  /* the oldest beyond the column's room run out now — their way back closes, as if their time had gone */
  for (const old of entries.slice(AT_MOST)) expire(old.id);
  arm(e);
  emit();
  return () => {
    drop(e.id);
  };
}

/** Hold a chip's clock (a pointer over it, focus in it) or let it run again */
function hold(id: number, held: boolean) {
  const e = entries.find(x => x.id === id);
  if (!e || (e.since === null) === held) return;
  if (held) {
    e.left = remaining(e);
    e.since = null;
  } else {
    e.since = Date.now();
  }
  arm(e);
  emit();
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};
const snapshot = () => entries;

/* Ctrl+Z / ⌘Z runs the newest chip's Undo — but never inside a text field, whose own undo the key belongs to */
const editable = (el: Element | null): boolean =>
  !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable);

const Chip = ({ e }: { e: Entry }) => {
  const [, tick] = useState(0);
  /* the seconds left, once a second while the clock runs (the bar under the chip is one CSS run) */
  useEffect(() => {
    if (e.since === null) return;
    const id = window.setInterval(() => tick(t => t + 1), 250);
    return () => window.clearInterval(id);
  }, [e.since]);
  const left = remaining(e);
  const seconds = Math.ceil(left / 1000);
  const box = useRef<HTMLDivElement | null>(null);
  return (
    <div
      ref={box}
      className="undo-toast pointer-events-auto relative overflow-hidden inline-flex items-center gap-2 h-8 pl-3 pr-1 rounded-md border border-borderMuted bg-canvas/90 backdrop-blur-md backdrop-saturate-150 shadow-lg shadow-black/40 text-[12px] text-textPrimary select-none"
      onPointerEnter={() => hold(e.id, true)}
      onPointerLeave={() => {
        if (!box.current?.contains(document.activeElement)) hold(e.id, false);
      }}
      onFocus={() => hold(e.id, true)}
      onBlur={ev => {
        if (!box.current?.contains(ev.relatedTarget as Node | null)) hold(e.id, false);
      }}
      data-undo-toast
    >
      <span>{e.label}</span>
      <span className="text-textMuted" aria-hidden>
        ·
      </span>
      <button
        type="button"
        onClick={() => runUndo(e.id)}
        aria-keyshortcuts="Control+Z Meta+Z"
        title="Undo (Ctrl+Z)"
        className="hit relative h-6 px-2 rounded font-semibold text-textPrimary underline decoration-borderMuted underline-offset-4 hover:bg-ink/[0.06] hover:decoration-textPrimary transition-colors"
        data-undo
      >
        Undo
      </button>
      {/* the countdown: words for a glance, a hairline for the eye — hidden from a screen reader, which hears the chip once */}
      <span className="w-6 pr-1 text-right font-mono text-[11px] tnum text-textMuted" aria-hidden>
        {seconds}s
      </span>
      <span
        className="undo-count absolute left-0 bottom-0 h-px w-full bg-silver origin-left"
        style={{ animationDuration: `${e.ms}ms`, animationPlayState: e.since === null ? 'paused' : 'running' }}
        aria-hidden
      />
    </div>
  );
};

/** The chips, newest on top — rendered once, at the top of the shell's toast column (AlertToasts) */
export const UndoToasts = () => {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    if (list.length === 0) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key.toLowerCase() !== 'z' || !(ev.ctrlKey || ev.metaKey) || ev.shiftKey || ev.altKey || ev.defaultPrevented) return;
      if (editable(document.activeElement)) return;
      ev.preventDefault();
      runUndo(list[0].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [list]);
  return (
    <>
      {list.map(e => (
        <Chip key={e.id} e={e} />
      ))}
    </>
  );
};

export default undoable;
