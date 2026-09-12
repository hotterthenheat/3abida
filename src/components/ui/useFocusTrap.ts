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

export function useFocusTrap(active: boolean, ref: RefObject<HTMLElement | null>): void {
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return undefined;
    const container = ref.current;
    if (!container) return undefined;

    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    /* Rendered ones only — a zero-box control is not somewhere focus can
       usefully land, and a collapsed section full of them would otherwise
       make Tab appear to do nothing. */
    const inside = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement
      );

    if (!container.contains(document.activeElement)) {
      const first = inside()[0];
      (first ?? container).focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = inside();
      if (list.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const here = document.activeElement;
      if (!container.contains(here)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && here === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && here === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      const opener = openerRef.current;
      openerRef.current = null;
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [active, ref]);
}

export default useFocusTrap;
