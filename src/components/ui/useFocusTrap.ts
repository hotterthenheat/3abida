import { useEffect, useRef, type RefObject } from 'react';

/*
==================================================
  SLAYER TERMINAL - FOCUS TRAP (ui/useFocusTrap.ts)

  Keeps the keyboard inside an open overlay, and
  puts it back where it came from on the way out.
==================================================

  WHAT WAS ACTUALLY WRONG, MEASURED RATHER THAN ASSUMED.

  An earlier sweep walked 457 tab stops and proved every one shows a focus
  ring. That is a property of the RESTING page and it says nothing about the
  part a keyboard user gets stuck in. Driving both overlays from the keyboard:

      print drilldown   opening it did not move focus at all — focus stayed
                        on the tape row behind, so the very first Tab went to
                        that row's own "Mark this print" button, and kept
                        walking the page underneath the card
      command palette   focused its input correctly, and then the first Tab
                        landed on "Compass Options chooser — week", a control
                        on the desk behind it

  Both overlays dim the page behind and neither hides it from the keyboard, so
  a reader who cannot see the dim tabs into content that is not there for
  them. That is the whole defect, and it is the same defect twice, which is
  why this is a hook and not two copies.

  WHAT IT DOES, in the order it matters:

    1. Remembers what was focused when the overlay opened.
    2. Moves focus INTO the overlay if it is not already there — first
       focusable child, or the container itself as a fallback, which is why
       callers put tabIndex={-1} on it.
    3. Cycles Tab and Shift+Tab within the overlay, wrapping at both ends.
    4. On close, returns focus to whatever opened it — but only if that
       element is still in the document, since the overlay may have been what
       removed it.

  The opener is captured in a ref rather than a local, so that an effect that
  re-runs for any other reason cannot quietly re-capture something INSIDE the
  overlay as the thing to return to.

  The keydown listener is on `document` in the CAPTURE phase: an overlay that
  handles its own keys (the palette runs ArrowUp/ArrowDown/Enter through a
  React handler on its container) must not be able to swallow Tab before the
  trap sees it.
*/

/*
  EVERY branch has to exclude tabindex="-1", not just the last one.

  `button:not([disabled])` matches a button whatever its tabindex, so a
  deliberately untabbable control still counted as trappable. Measured: with
  the compare menu open, its 23 rows of scale buttons — all tabindex="-1" —
  were collected here, which put `last` two hundred elements away from the
  search box. Tab from the box was therefore never "at the end", the trap
  stood aside, and focus walked out of the menu onto a control behind it. The
  trap looked installed and did nothing.
*/
const FOCUSABLE = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/* THE OPENER, EVEN WHEN THE OVERLAY TOOK FOCUS FIRST (2026-10-09, the audit's X13): an input with autoFocus is focused
   in the same commit that mounts its overlay, before this hook's effect runs — so "what was focused" was already inside
   the overlay, and on close focus went back to the very box that was leaving (and from there to the page's body). The
   element focused before the last one is kept, so the hook can step past one that is inside. */
let current: HTMLElement | null = null;
let previous: HTMLElement | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener(
    'focusin',
    e => {
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t && t !== current) {
        previous = current;
        current = t;
      }
    },
    true
  );
}

export interface FocusTrapOptions {
  /** Where focus goes on open: the first control inside ('first', the default), the box itself ('container' — give
      it tabIndex={-1}; a dialog whose first control is not where the reader starts), or a given element */
  initialFocus?: 'first' | 'container' | RefObject<HTMLElement | null>;
  /** Where focus goes on close: the opener (the default), a given element (the palette hands it to the subject
      button), or false to leave it alone (the close itself moves focus, e.g. by navigating) */
  returnTo?: RefObject<HTMLElement | null> | false;
}

/**
 * Keep the keyboard inside an open overlay and put it back where it came from.
 *
 *   const box = useRef<HTMLDivElement>(null);
 *   useFocusTrap(open, box);                                  // focus the first control, back to the opener on close
 *   useFocusTrap(open, box, { initialFocus: 'container' });   // focus the box itself (tabIndex={-1})
 *   useFocusTrap(open, box, { initialFocus: inputRef, returnTo: triggerRef });
 *
 * For Escape as well, use useOverlay (ui/layers.ts), which pairs this with the layer stack.
 */
export function useFocusTrap(active: boolean, ref: RefObject<HTMLElement | null>, options: FocusTrapOptions = {}): void {
  const openerRef = useRef<HTMLElement | null>(null);
  const opts = useRef(options);
  opts.current = options;

  useEffect(() => {
    if (!active) return undefined;
    let container = ref.current;
    let onKey: ((e: KeyboardEvent) => void) | null = null;
    let frame = 0;
    let tries = 0;

    const start = () => {
      container = ref.current;
      /* the box may mount a frame after `active` turns on (a lazy or animated overlay): look again, a few frames */
      if (!container) {
        if (tries++ < 10) frame = requestAnimationFrame(start);
        return;
      }
      const box = container;
      const here = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
      openerRef.current = here && box.contains(here) ? (previous && !box.contains(previous) ? previous : null) : here;

      /* Rendered ones only — a zero-box control is not somewhere focus can
         usefully land, and a collapsed section full of them would otherwise
         make Tab appear to do nothing. */
      const inside = () =>
        Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement
        );

      /* a control inside that took focus itself (autoFocus) keeps it, unless a given element asks for it */
      const initial = opts.current.initialFocus ?? 'first';
      if (typeof initial === 'object' && initial.current) initial.current.focus();
      else if (!box.contains(document.activeElement)) (initial === 'container' ? box : inside()[0] ?? box).focus();

      onKey = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;
        const list = inside();
        if (list.length === 0) {
          e.preventDefault();
          box.focus();
          return;
        }
        const first = list[0];
        const last = list[list.length - 1];
        const at = document.activeElement;
        if (!box.contains(at) || at === box) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        } else if (e.shiftKey && at === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && at === last) {
          e.preventDefault();
          first.focus();
        }
      };
      document.addEventListener('keydown', onKey, true);
    };
    start();

    return () => {
      cancelAnimationFrame(frame);
      if (onKey) document.removeEventListener('keydown', onKey, true);
      const back = opts.current.returnTo;
      const opener = back === false ? null : back?.current ?? openerRef.current;
      openerRef.current = null;
      if (back === false) return;
      /* only if focus is still in the closing box, or nowhere — a close that already moved it elsewhere is left be */
      const at = document.activeElement;
      const stray = !at || at === document.body || (container?.contains(at) ?? false);
      if (opener && document.contains(opener) && stray) opener.focus({ preventScroll: true });
    };
  }, [active, ref]);
}

export default useFocusTrap;
