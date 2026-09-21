/*
  How tall a dropdown may be before it runs into something that will cut it
  off (Noah, 2026-09-03, the 0DTE cut menu: "this doesnt seem to scroll yet
  i see words bleeding from underneath?"). A menu positioned INSIDE a box
  that clips its overflow — a chart pane, a card — is sliced at that box's
  floor, and the sliced rows show through the edge as half-words. So a menu
  asks for the room it actually has: down to the nearest clipping ancestor
  (marked `data-menu-clip`) or the window, whichever comes first, and scrolls
  inside that instead of pretending.
*/

import { MENU_EDGE, MENU_OFFSET } from './menuPlacement';

/** Never so short that the menu shows a header and half a row. */
const MENU_ROOM_FLOOR = 120;

/** Pixels available below `anchor` for a menu hung from its bottom edge. */
export function roomBelow(anchor: HTMLElement | null): number {
  if (!anchor) return MENU_ROOM_FLOOR;
  const rect = anchor.getBoundingClientRect();
  const clip = anchor.closest<HTMLElement>('[data-menu-clip]');
  const floor = Math.min(window.innerHeight, clip ? clip.getBoundingClientRect().bottom : Infinity);
  return Math.max(MENU_ROOM_FLOOR, Math.floor(floor - rect.bottom - MENU_OFFSET - MENU_EDGE));
}

/* THE ONE LINE A MENU SAYS WHEN IT HAS NOTHING. A full DataState with its
   icon and its second line is right for a panel and far too heavy inside a
   200px dropdown, so menus get their own single line — but ONE line, shared,
   not each menu's own guess at the padding and the ink. */
export const MENU_EMPTY = 'px-2.5 py-4 text-center font-mono text-[10px] text-textMuted';
