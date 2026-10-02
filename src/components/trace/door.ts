/*
  THE DOOR, defined once (Noah, 2026-08-30: "make all of my blue underlines
  white... there should also be a hover effect on them"; then 2026-09-16:
  "the con that shows a white underline, I want it gone for them all but
  keep the holo silver hover effect").

  Every contract door on every Trace page — the table's contract cell, the
  prose door inside a read, the Multi-Leg strike doors, the head's
  champions — answers the pointer the same way: the name takes holographic
  silver, the ink that means "where you are" everywhere else (the search's
  active state, the focus ring). Silver is here (and, since 2026-10-02, live too). One
  affordance, learned once. THE LINE UNDER IT IS GONE (2026-09-16): it stood
  under every contract at rest and read as chrome on every row; the silver
  hover alone is the door.
*/

/** The door at rest and its motion. leading-normal, EXPLICIT: inside a grid cell a door
    inherited the cell's line-height (the row's 36px) and stood 40px tall in a 39px row (the
    sweep after Noah's 2026-09-14 "the con cards are bleeding out of their respected row");
    its own line keeps every door 21px. No border since 2026-09-16. */
export const DOOR = 'leading-normal transition-colors';

/** The name's hover ink — on the element the pointer lands on. */
export const DOOR_HOVER_TEXT = 'hover:text-silver';

/** The same ink for a name INSIDE a hovered door (the cell is `group/door`). */
export const DOOR_GROUP_TEXT = 'group-hover/door:text-silver transition-colors';
