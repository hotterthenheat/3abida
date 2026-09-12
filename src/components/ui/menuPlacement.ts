/*
==================================================
  SLAYER TERMINAL - WHERE A MENU LANDS
  (components/ui/menuPlacement.ts)

  The arithmetic behind an anchored dropdown, kept
  out of the component so it can be tested.

  IT EXISTS BECAUSE THE CSS VERSION WAS WRONG in a
  way CSS could not fix. The menu used to be
  `position: absolute` inside the toolbar, and on the
  Terrain desk that toolbar floats inside a pane whose
  box is `overflow-hidden` — which it has to be, for
  its rounded corners and to contain the chart. So the
  menu was CLIPPED at the pane's bottom edge. Measured
  at 1440x900 with four panes: the Overlays menu ran
  to y=696 against a pane clipping at y=475, and three
  of its eight rows were rendered, invisible and
  unclickable.

  A portal puts the menu at the body where nothing can
  clip it. What a portal cannot do is know where to
  put it — that is this file.

  ANCHORED BY EDGES, NOT BY A CORNER. "The menu's
  right edge sits on the trigger's right edge" is a
  `right` offset from the window, and needs no idea
  how wide the menu is. Anchoring by a top-left corner
  would mean measuring the menu first, which means
  rendering it somewhere invisible, which flickers and
  is a frame behind on every scroll.
==================================================
*/

export type MenuSide = 'bottom' | 'top' | 'left' | 'right';

/** A fixed-position box. Only the anchored edges are set. */
export interface MenuBox {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

/** Space between the trigger and its menu. */
export const MENU_OFFSET = 4;
/** The least a menu may keep to the window's own edge. */
export const MENU_EDGE = 8;
/**
 * Below this a menu is not worth opening on that side — it would show a header
 * and half a row.
 *
 * Used only to decide a FLIP, never to refuse to open: a menu that declines to
 * appear because the window is short is a control the reader cannot reach, and
 * unreachable is the exact failure this module exists to end.
 */
export const MENU_MIN_USEFUL = 160;
/** Never taller than this share of the window, even where there is room — a
    menu that runs the full height of the screen stops reading as a menu. */
export const MENU_MAX_SHARE = 0.7;
/**
 * The menu's own `min-width`, in px, mirrored from its class.
 *
 * Needed here because a menu anchored by its RIGHT edge has a left edge this
 * far away, and that left edge is the one that goes off screen. Anchoring
 * without knowing it produced a menu whose right edge sat neatly on the
 * trigger and whose first 186px hung off the left of the window.
 */
export const MENU_MIN_WIDTH = 210;

/** Just the fields of a DOMRect this needs, so a test need not fake the rest. */
export interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Place a menu against its trigger.
 *
 * The returned `side` may differ from the requested one: a side is a
 * PREFERENCE, not a promise. A menu squeezed against one edge opens off the
 * other, the way every native menu does — and the caller is told which way it
 * went so the trigger's caret can point at it rather than lying.
 */
export function placeMenu(
  rect: AnchorRect,
  side: MenuSide,
  vw: number,
  vh: number,
  /**
   * How wide the menu actually is, when the caller knows.
   *
   * The clamp below has to keep the FAR edge on screen, and to do that it has
   * to assume a width. It assumed MENU_MIN_WIDTH, which is true of the toolbar
   * menus this module was written for and false of the wider ones: the compare
   * popover is `w-[380px]` and the symbol quick-pick `w-72` (288). Measured
   * after those two were portalled through here — the compare menu in a
   * left-column pane landed at x = -162, so 162px of a 380px menu was off the
   * side of the window. The old default kept 210 of it on screen and called
   * that clamped.
   *
   * Defaults to MENU_MIN_WIDTH so every existing caller places exactly as it
   * did. A caller that knows its width passes it; one that does not is no
   * worse off than before.
   */
  menuWidth: number = MENU_MIN_WIDTH,
  /**
   * Which of the menu's edges sits on the trigger's matching edge.
   *
   * 'end' (the default, and every existing caller) pins the menu's RIGHT edge
   * to the trigger's right — the menu then extends its own width to the LEFT.
   * That is correct for a control at the right end of a toolbar and wrong for
   * one at the LEFT end of a pane: the symbol capsule sits at a Terrain
   * pane's left edge, so its 288px menu reached back across the pane's border
   * and opened over the NEIGHBOUR (Noah, 2026-08-29: "the ticker selection
   * should not exit the specific pane you choose to select a ticker for").
   *
   * 'start' pins the LEFT edges instead, so the menu opens rightward — into
   * its own pane, the way every native dropdown under a left-hand control
   * does. Both are still clamped to the window at both ends.
   */
  align: 'start' | 'end' = 'end'
): { box: MenuBox; side: MenuSide } {
  let s = side;
  const below = vh - rect.bottom - MENU_OFFSET - MENU_EDGE;
  const above = rect.top - MENU_OFFSET - MENU_EDGE;
  const roomRight = vw - rect.right - MENU_OFFSET - MENU_EDGE;
  const roomLeft = rect.left - MENU_OFFSET - MENU_EDGE;

  /* Flip only when the other side is genuinely better. `above > below` rather
     than `above >= MENU_MIN_USEFUL`: in a window too short for either, staying
     put beats swapping one cramped side for a worse one. */
  if (s === 'bottom' && below < MENU_MIN_USEFUL && above > below) s = 'top';
  else if (s === 'top' && above < MENU_MIN_USEFUL && below > above) s = 'bottom';
  /* The same rule sideways, and it is not symmetry for its own sake: a
     side-docked toolbox can sit at either margin, and a `left` menu on a
     trigger 4px from the window's left edge has nowhere to go. */
  else if (s === 'right' && roomRight < MENU_MIN_WIDTH && roomLeft > roomRight) s = 'left';
  else if (s === 'left' && roomLeft < MENU_MIN_WIDTH && roomRight > roomLeft) s = 'right';

  const ceiling = vh * MENU_MAX_SHARE;
  /*
    The floor stops a zero or negative max-height from collapsing the menu to
    an invisible line when the trigger sits hard against an edge; the ceiling
    then wins over the floor in a window too short for either, because a menu
    taller than its window has unreachable rows at the bottom and that is the
    failure this module exists to end.
  */
  const cap = (room: number) => Math.min(ceiling, Math.max(MENU_MIN_USEFUL, room));

  /*
    THE HORIZONTAL ANCHOR IS CLAMPED AT BOTH ENDS, and the far end is the one
    that was missing.

    A menu anchored by its RIGHT edge extends its own WIDTH to the LEFT of
    that anchor. A trigger within a menu-width of the window's left edge
    therefore produced a menu sitting neatly against the trigger with its first
    186px off the side of the screen — and a `Math.max(MENU_EDGE, …)` guard
    passed it, because it only ever checked the near end.

    The width is `menuWidth`, not MENU_MIN_WIDTH: assuming the minimum keeps
    exactly that much on screen and lets everything wider hang off the edge.
  */
  const farRight = Math.max(MENU_EDGE, vw - menuWidth - MENU_EDGE);
  const anchorRight = (v: number) => Math.min(Math.max(MENU_EDGE, v), farRight);
  const anchorLeft = (v: number) => Math.min(Math.max(MENU_EDGE, v), farRight);

  const hAnchor = align === 'start' ? { left: anchorLeft(rect.left) } : { right: anchorRight(vw - rect.right) };
  if (s === 'bottom') {
    return { side: s, box: { ...hAnchor, top: rect.bottom + MENU_OFFSET, maxHeight: cap(below) } };
  }
  if (s === 'top') {
    return {
      side: s,
      box: { ...hAnchor, bottom: Math.max(MENU_EDGE, vh - rect.top + MENU_OFFSET), maxHeight: cap(above) },
    };
  }
  /* Side-docked: the menu hangs from the trigger's TOP edge, so the room left
     is everything below that. */
  const beside = vh - rect.top - MENU_EDGE;
  if (s === 'right') {
    return { side: s, box: { left: anchorLeft(rect.right + MENU_OFFSET), top: rect.top, maxHeight: cap(beside) } };
  }
  return {
    side: s,
    box: { right: anchorRight(vw - rect.left + MENU_OFFSET), top: rect.top, maxHeight: cap(beside) },
  };
}
