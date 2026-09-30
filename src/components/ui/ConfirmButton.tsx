/*
==================================================
  SLAYER TERMINAL - THE SECOND CLICK
  (components/ui/ConfirmButton.tsx)

  Nothing irreversible happens on one click.
==================================================

  FOUR THINGS ON THIS DESK DESTROYED WORK INSTANTLY AND ASKED NOTHING.
  Deleting a watchlist took up to a hundred symbols with it; "close every
  position" flattened an open book; "start the paper account over" wiped the
  account and its history; deleting a saved desk took a layout the reader had
  arranged. Each was one mis-click, with no dialog, no undo and no trace.

  A MODAL IS THE WRONG ANSWER for controls that live in a toolbar. It steals
  the screen, it has to be dismissed, and readers learn to click through it
  without reading — which is worse than no confirmation, because it looks
  like safety. The second click is the right weight: the button ARMS, says
  exactly what it is about to destroy, and commits only if you mean it.

  IT DISARMS ON ITS OWN. An armed button left on screen is a trap for the
  next person to touch the keyboard, so it goes back to rest after a few
  seconds, on blur, and on Escape. The accessible name changes with the
  state, so a reader who cannot see the colour still hears the escalation
  before the second click lands.
*/

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

const ARM_MS = 4000;

export interface ConfirmButtonProps {
  /** What actually happens, on the second click */
  onConfirm: () => void;
  /** The resting label */
  children: ReactNode;
  /** The armed label — say WHAT is about to go, not just "Sure?" */
  confirm: string;
  /** The resting title/tooltip */
  title?: string;
  className?: string;
  /** Extra classes while armed — the house default is the bear edge */
  armedClassName?: string;
  disabled?: boolean;
  /** A data-* hook for probes: data-confirm="<id>" */
  testId?: string;
}

const ConfirmButton = ({
  onConfirm,
  children,
  confirm,
  title,
  className = '',
  armedClassName = 'border-bear/60 text-bear',
  disabled,
  testId,
}: ConfirmButtonProps) => {
  const [armed, setArmed] = useState(false);
  const timer = useRef(0);

  const disarm = useCallback(() => {
    window.clearTimeout(timer.current);
    setArmed(false);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  /* A disabled control cannot be disarmed by clicking it, so it disarms
     itself the moment it goes disabled — otherwise it comes back armed. */
  useEffect(() => {
    if (disabled) disarm();
  }, [disabled, disarm]);

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={armed ? confirm : undefined}
      title={armed ? confirm : title}
      onBlur={disarm}
      onKeyDown={e => {
        if (e.key === 'Escape' && armed) {
          e.preventDefault();
          e.stopPropagation();
          disarm();
        }
      }}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setArmed(false), ARM_MS);
          return;
        }
        disarm();
        onConfirm();
      }}
      className={`${className} ${armed ? armedClassName : ''} transition-colors`}
      data-confirm={testId}
      data-armed={armed ? 'yes' : undefined}
    >
      {armed ? confirm : children}
    </button>
  );
};

export default ConfirmButton;
