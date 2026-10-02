/*
==================================================
  SLAYER TERMINAL - THE BRAND KEEPS ONE CLOCK (brand/brandClock.ts)

  "It should be in sync" (the owner, 2026-10-02, of the cursor). Every mark, every wordmark cursor and the signature's
  dot on a page move together: the cursors blink on the same beat and the foil sits at the same point of its pan,
  whatever moment each one mounted. A CSS animation starts when its element is styled, so two marks mounted a second
  apart would blink a second apart; here every loop the brand runs is pinned to the document timeline's own origin
  (startTime 0), so its phase is the page's clock and nothing else.

  Two hands do it. The brand's components align their own loops before the first paint, on mount and whenever their
  state changes (alignBrandLoops in a layout effect) — so a mark never shows one frame out of step. And one listener on
  the document catches a loop that starts anywhere else (a menu that was hidden is shown and its mark's animation is
  made again) and pins it the same way.

  Only the loops that run for ever are pinned: the alert's two flashes and the wordmark's typing run once, from the
  moment they are asked for. A loop someone has paused (the landing's films hold every loop and step it on the film's
  clock) is left alone. Pinning moves an animation's start, not its keyframes: the S still slides by transform and the
  cursor still blinks by opacity, so the compositor runs both and nothing is painted (the speed rules).
==================================================
*/

/** the brand's loops by their keyframes' names (index.css) */
const BRAND_LOOPS = new Set(['sm-pan', 'sm-blink']);

const isBrandLoop = (a: Animation): a is CSSAnimation =>
  typeof CSSAnimation !== 'undefined' &&
  a instanceof CSSAnimation &&
  BRAND_LOOPS.has(a.animationName) &&
  a.effect?.getComputedTiming().iterations === Infinity;

const pin = (a: Animation): void => {
  if (!isBrandLoop(a) || a.playState === 'paused') return;
  if (a.startTime !== 0) a.startTime = 0;
};

/** Pin every brand loop inside an element (and the element's own) to the page's clock */
export function alignBrandLoops(root: Element | null | undefined): void {
  if (!root || typeof root.getAnimations !== 'function') return;
  root.getAnimations({ subtree: true }).forEach(pin);
}

/* THE SAFETY NET: a brand loop that starts anywhere — mounted outside a brand component, or shown again after its
   element was hidden — is pinned on its first frame */
let listening = false;
export function listenForBrandLoops(): void {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.addEventListener(
    'animationstart',
    e => {
      if (!BRAND_LOOPS.has(e.animationName) || !(e.target instanceof Element)) return;
      e.target.getAnimations().forEach(pin);
    },
    true
  );
}
listenForBrandLoops();
