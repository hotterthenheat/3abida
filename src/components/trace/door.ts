/*
  THE DOOR, defined once (Noah, 2026-08-30: "make all of my blue underlines
  white... there should also be a hover effect on them").

  Every contract door on every Trace page — the table's contract cell, the
  prose door inside a read, the Multi-Leg strike doors — wears this same
  line and answers the pointer the same way: the line fills to solid white
  and the name takes holographic silver, the ink that means "where you
  are" everywhere else (the search's active state, the focus ring). Lime is
  live; silver is here. One affordance, learned once.
*/

/** The line and its hover. */
export const DOOR = 'border-b border-ink/55 hover:border-white transition-colors';

/** The name's hover ink — on the element the pointer lands on. */
export const DOOR_HOVER_TEXT = 'hover:text-silver';

/** The same ink for a name INSIDE a hovered door (the cell is `group/door`). */
export const DOOR_GROUP_TEXT = 'group-hover/door:text-silver transition-colors';
