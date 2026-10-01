/*
==================================================
  SLAYER TERMINAL - FOCUS GOES BACK FOR THE KEYS
  (components/ui/focusBack.ts)

  A house menu (DropdownSelect, DropdownMulti, the
  script editor's) hands focus back to its trigger when
  it closes on a pick — right for the keys: the trigger
  is where a keyboard reader is, and the ring says so.
  With the mouse it
  drew that ring too, round the trigger, until the next
  click anywhere (found 2026-10-01 filming the landing:
  every film that used a menu ended on it). Radix keeps
  the press from focusing the trigger, so Chrome reads
  the hand-back as script focus and shows the ring
  (measured).

  A pick made with the pointer now leaves focus where a
  click leaves it; a menu worked with the keys still
  hands it back, ring and all. (A popover's trigger
  takes the mouse's own focus, so it draws no ring and
  needs none of this — measured on the expiry cards,
  DropdownSearch and Paper's ticker picker.)
==================================================
*/

/** whether the keys were the last thing used — a key pressed anywhere, until the next press of a pointer */
let keys = false;
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => (keys = true), true);
  window.addEventListener('pointerdown', () => (keys = false), true);
}

/** Radix's onCloseAutoFocus for a house menu: focus goes back to the trigger only for the keys */
export const focusBackForKeys = (e: Event): void => {
  if (!keys) e.preventDefault();
};
