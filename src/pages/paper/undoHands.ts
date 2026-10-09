/*
==================================================
  SLAYER TERMINAL - PAPER · THE HANDS THAT CAN BE TAKEN BACK
  (pages/paper/undoHands.ts)

  The audit's X5 (2026-10-09): Flatten, Close, a new
  practice account and "Take them here" each acted in
  one click with no way back. Each still acts AT ONCE —
  and the shell's undo chip (ui/undo.tsx) offers the
  way back for a few seconds: the account as it stood
  before the hand, put back while nothing else has
  happened to it (data/paper/store.ts `undoMark`).
==================================================
*/

import undoable from '../../components/ui/undo';
import { contractWords, type ContractId } from '../../data/review/quotes';
import { optBookOf, type PaperAccount } from '../../data/paper/engine';
import { closeOpt, flattenAccount, handBack, readPaper, startPractice, takeHere, undoMark, undoStartPractice, withMark } from '../../data/paper/store';

const many = (n: number, one: string, more = `${one}s`) => `${n} ${n === 1 ? one : more}`;

/** Close a position at the bid — "Closed SPY 480C · Undo" */
export function closeWithUndo(accountId: string, c: ContractId, qty: number): void {
  const mark = withMark(accountId, () => closeOpt(accountId, c, qty));
  if (!mark) return;
  undoable({ label: `Closed ${qty} × ${contractWords(c)}`, undo: () => undoMark(mark), key: `paper-close:${accountId}` });
}

/** Flat, now — "Flattened · 2 positions closed, 1 order cancelled · Undo" */
export function flattenWithUndo(a: PaperAccount): void {
  const open = optBookOf(a).positions.length;
  const working = a.opt.orders.filter(o => o.status === 'working').length;
  const mark = withMark(a.id, () => flattenAccount(a.id));
  if (!mark) return;
  const parts = [open ? `${many(open, 'position')} closed` : '', working ? `${many(working, 'order')} cancelled` : ''].filter(Boolean).join(', ');
  undoable({ label: `Flattened${parts ? ` · ${parts}` : ''}`, undo: () => undoMark(mark), key: `paper-flatten:${a.id}` });
}

/** A new practice account — the one it closes comes back with an Undo, while nothing was traded on the new one */
export function startPracticeWithUndo(size: number): void {
  const before = readPaper();
  const closed = before.accounts.find(a => a.kind === 'practice' && a.status === 'open') ?? null;
  const made = startPractice(size);
  if (!made) return;
  const name = readPaper().accounts.find(a => a.id === made)?.name ?? 'a practice account';
  undoable({ label: `Started ${name}${closed ? ` · ${closed.name} closed` : ''}`, undo: () => undoStartPractice(made, closed, before.inHand), key: 'paper-new' });
}

/** Take the accounts from the other tab — handed back with an Undo */
export function takeHereWithUndo(): void {
  takeHere();
  undoable({ label: 'Your paper accounts moved to this tab', undo: handBack, key: 'paper-take' });
}
