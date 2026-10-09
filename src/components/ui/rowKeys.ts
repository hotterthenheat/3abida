import type { KeyboardEvent, MouseEvent } from 'react';

/*
==================================================
  SLAYER TERMINAL - A ROW THE KEYS CAN OPEN (ui/rowKeys.ts)

  A clickable thing that is not a <button> — a div
  row, a table's <tr>, an SVG <g> on a chart — opens
  from the keys too (the audit's X6, 2026-10-09:
  Pinpoint's Building, Every-wall and Targets rows,
  Trace's grids and Compass's Tracker opened by mouse
  only). Spread the props on the element:

    <div {...rowProps(() => open(row), `Open ${row.name}`)}>…</div>
    <tr {...rowProps(() => go(path), `${sym} on the Map`, { role: 'link' })}>…</tr>
    <g {...rowProps(() => focusStrike(k), `Strike ${k}`)}>…</g>

  It gives the element a role ("button", or "link"
  when it goes to another page), a place in the Tab
  order, a label when one is passed, the click, and
  Enter (and Space for a button) on the element
  itself — a key pressed on a control INSIDE the row
  (a bookmark, a remove ×) is left to that control.
  Selected-state rows add aria-pressed or
  aria-current themselves. The ring is the global
  :focus-visible one; a row that clips it (overflow
  hidden on a parent) can draw it inset with
  focus-visible:outline-offset-[-2px].
==================================================
*/

export interface RowPropsOptions {
  /** "link" when opening goes to another page (Enter only, as a link), "button" otherwise (Enter and Space) */
  role?: 'button' | 'link';
  /** A row that cannot open now: out of the Tab order, and the keys and the click do nothing */
  disabled?: boolean;
}

export interface RowProps {
  role: 'button' | 'link';
  tabIndex: number;
  'aria-label'?: string;
  'aria-disabled'?: true;
  onClick: (e: MouseEvent<Element>) => void;
  onKeyDown: (e: KeyboardEvent<Element>) => void;
}

export function rowProps(onOpen: () => void, label?: string, { role = 'button', disabled = false }: RowPropsOptions = {}): RowProps {
  return {
    role,
    tabIndex: disabled ? -1 : 0,
    ...(label ? { 'aria-label': label } : {}),
    ...(disabled ? { 'aria-disabled': true as const } : {}),
    onClick: () => {
      if (!disabled) onOpen();
    },
    onKeyDown: e => {
      if (disabled || e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'Enter' || (role === 'button' && e.key === ' ')) {
        /* Space would scroll the page, Enter would reach a form round the row */
        e.preventDefault();
        onOpen();
      }
    },
  };
}

export default rowProps;
