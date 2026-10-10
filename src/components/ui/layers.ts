import { useEffect, useRef, type RefObject } from 'react';
import { useFocusTrap, type FocusTrapOptions } from './useFocusTrap';

/*
==================================================
  SLAYER TERMINAL - ESC CLOSES THE TOP LAYER (ui/layers.ts)

  One stack of the overlays that are open — a modal,
  a drawer, the palette, a guide — and ONE listener
  for Escape: it closes the layer opened last, and
  only that one, every time (the audit's TR-2 and
  X13, 2026-10-09: the Trace print card ignored an
  Escape some other handler had already marked, so
  Esc "stopped working" after the card's Next).

  How a key is judged, on the document as it bubbles:
    · nothing open on the stack → left alone;
    · a Radix menu, popover, select or tooltip was
      open when the key came down (it sits above every
      house layer, and its own capture-phase listener
      closes it) → left alone, so menu over modal
      closes the menu and not the modal. It is read
      as the key ARRIVES, on the window in the capture
      phase: by the time the key bubbles back up, React
      may already have taken the menu away;
    · otherwise the top layer closes, and the key is
      marked (preventDefault) so a full-screen
      takeover listening behind it stands still. A
      key some other handler marked — a grid, a
      button — no longer keeps a layer open.

  A house layer that stops the key itself in the
  capture phase (DatePicker, GuideFocus, ReasonDoor)
  still wins, as before: the key never reaches here.
==================================================

  USE
    useEscapeLayer(open, onClose)           Esc closes it when it is the top layer
    useOverlay({ open, ref, onClose })      the whole dialog contract: focus in on open, Tab trapped inside,
                                            Esc closes the top layer, focus back to the opener on close
                                            (pass initialFocus / returnTo — see useFocusTrap)
*/

interface Layer {
  id: number;
  close: RefObject<() => void>;
}

const stack: Layer[] = [];
let nextId = 1;
let listening = false;

/** A Radix layer that is open now (a menu, popover, select or tooltip): it takes Escape before any house layer */
const radixLayerOpen = (): boolean =>
  !!document.querySelector('[data-radix-popper-content-wrapper] [data-state]:not([data-state="closed"]), [data-radix-menu-content][data-state="open"], [role="dialog"][data-state="open"][data-radix-dialog-content]');

/** The Escape that came down while a Radix layer was open — that layer's, not ours */
let radixKey: Event | null = null;
function onKeyArrives(e: KeyboardEvent) {
  if (e.key === 'Escape') radixKey = stack.length > 0 && radixLayerOpen() ? e : null;
}

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.isComposing) return;
  const top = stack[stack.length - 1];
  if (!top || radixKey === e) return;
  e.preventDefault();
  top.close.current?.();
}

function listen() {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  window.addEventListener('keydown', onKeyArrives, true);
  document.addEventListener('keydown', onKey);
}

/** Is a house layer open? (For a page-level Escape handler that should stand still while one is.) */
export const layerOpen = (): boolean => stack.length > 0;

/** Esc closes this layer while it is open and on top of every other layer on the stack. It returns a reader of
    "is this layer on top now?" — for a layer that also stops the key itself in the capture phase (GuideFocus), so it
    acts only when nothing was opened over it. */
export function useEscapeLayer(open: boolean, onClose: () => void): () => boolean {
  const close = useRef(onClose);
  close.current = onClose;
  const mine = useRef<Layer | null>(null);
  useEffect(() => {
    if (!open) return undefined;
    listen();
    const layer: Layer = { id: nextId++, close };
    stack.push(layer);
    mine.current = layer;
    return () => {
      const i = stack.indexOf(layer);
      if (i >= 0) stack.splice(i, 1);
      if (mine.current === layer) mine.current = null;
    };
  }, [open]);
  return () => mine.current != null && stack[stack.length - 1] === mine.current;
}

export interface OverlayOptions extends FocusTrapOptions {
  open: boolean;
  /** The overlay's own box — give it tabIndex={-1} so it can hold focus itself */
  ref: RefObject<HTMLElement | null>;
  onClose: () => void;
}

/** The whole dialog contract for a drawer, a palette, a card or a guide: focus moves in on open (the first control,
    or `initialFocus`), Tab and Shift+Tab stay inside, Esc closes it when it is the top layer, and focus goes back to
    the opener (or `returnTo`) on close. The box still needs role="dialog", aria-modal and a label of its own. */
export function useOverlay({ open, ref, onClose, ...trap }: OverlayOptions): () => boolean {
  const onTop = useEscapeLayer(open, onClose);
  useFocusTrap(open, ref, trap);
  return onTop;
}
