/*
  The contract door, in prose (Noah, 2026-08-30: "if these sentences are
  stating contracts in any way shape or form ... it should have an underline
  that allows the user to go to the in depth review of it").

  The tables already speak this affordance — the contract cell turns silver
  under the pointer and opens the in-depth card — so a sentence that names a
  contract wears the SAME hover and opens the SAME card. One affordance,
  learned once. Inline and baseline-aligned so the sentence never learns
  it is holding a button. (The line under it: blue, then white from
  2026-08-30, then gone from 2026-09-16 — Noah: "I want it gone for them all
  but keep the holo silver hover effect".)
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
