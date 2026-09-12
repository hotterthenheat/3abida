/*
  The contract door, in prose (Noah, 2026-08-30: "if these sentences are
  stating contracts in any way shape or form ... it should have an underline
  that allows the user to go to the in depth review of it").

  The tables already speak this affordance — the contract cell's white
  underline is the door to the in-depth card — so a sentence that names a
  contract wears the SAME line and opens the SAME card. One affordance,
  learned once. Inline and baseline-aligned so the sentence never learns
  it is holding a button. (White since 2026-08-30 — Noah: "i dont like how
  the blue looks".)
*/

import type { ReactNode } from 'react';
import { DOOR, DOOR_HOVER_TEXT } from './door';

const ReadDoor = ({
  onOpen,
  title = 'Open the in-depth review',
  children,
}: {
  onOpen: () => void;
  title?: string;
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onOpen}
    title={title}
    className={`inline align-baseline font-semibold text-textPrimary pb-[1px] ${DOOR} ${DOOR_HOVER_TEXT}`}
  >
    {children}
  </button>
);

export default ReadDoor;
