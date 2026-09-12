import type React from 'react';

/**
 * The contract for a clickable row.
 *
 * Hand-rolled clickable rows tend to carry `onClick` and `cursor-pointer` and
 * nothing else, so the row looks interactive, responds to a mouse, and is
 * invisible to the keyboard. Anything that renders its own rows spreads these
 * instead of re-deriving them.
 */
export const ROW_INTERACTIVE =
  'cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-select/60';

/** Enter (and Space, which browsers do not fire click for on a `tr`) activates. */
export const rowKeyDown =
  (activate: () => void) =>
  (e: React.KeyboardEvent): void => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    // A nested button inside the row handles its own keys and stops
    // propagation, so reaching here means the row itself is the target.
    e.preventDefault();
    activate();
  };

/**
 * What the element should be called, once it is clickable.
 *
 * - `button`   — a standalone clickable region that is nothing else: a gamma
 *                band, an entry on the key-levels rail. It contains text only.
 * - `listitem` — one card in a list of cards. A card may hold its own button,
 *                and `listitem` is the one of these three whose children are
 *                still exposed, so that nested button keeps its own name and
 *                its own focus stop.
 * - `native`   — leave the element's own role alone. This is what a `<tr>`
 *                needs: it is already a row inside its table, and overriding
 *                that to `button` deletes it from the table for every screen
 *                reader.
 */
export type RowRole = 'button' | 'listitem' | 'native';

/**
 * Props every clickable row needs. Spread onto the `<tr>` (or row div).
 *
 * Selection travels as `aria-current`, not `aria-selected`. `aria-selected`
 * belongs to a listbox option, a tab, or a row inside a grid — none of which
 * these are — and setting it on a `button` is invalid. `aria-current` is a
 * global attribute, valid on every role here, and it says the true thing:
 * this is the one the desk is showing you right now.
 */
export const interactiveRowProps = (
  activate: () => void,
  selected?: boolean,
  role: RowRole = 'button'
): {
  tabIndex: number;
  role: 'button' | 'listitem' | undefined;
  'aria-current': true | undefined;
  onKeyDown: (e: React.KeyboardEvent) => void;
} => ({
  tabIndex: 0,
  role: role === 'native' ? undefined : role,
  'aria-current': selected ? true : undefined,
  onKeyDown: rowKeyDown(activate),
});
