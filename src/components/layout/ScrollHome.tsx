/*
==================================================
  SLAYER TERMINAL - THE PAGE GREETS AT ITS TOP (components/layout/ScrollHome.tsx)

  The terminal's scroller is <main>, one element
  under every route, so a page opened from the foot
  of another used to open at the foot too (Noah,
  2026-09-11: "i scroll all the way to the bottom
  and then choose to open a new page... i get
  transitioned into the bottom of the page i open
  and not the top where the header is"). The
  browser restores window scroll on its own; it
  knows nothing of ours.

  One instance sits inside every keyed transition
  wrapper — the shell's (a section change) and each
  section shell's (a subpage change) — and acts ON
  MOUNT, which is the moment the NEW page lands:
  after the old one has faded out where it was
  (mode="wait"), before the first frame paints. A
  reset on the route change itself would snap the
  leaving page to its top mid-fade.

  Forward, the page opens at its head. Back or
  forward through history (POP) returns the reader
  to where they were on that page, kept per
  location key — re-applied for up to two seconds
  while the page's boxes fill in (a page still
  short cannot hold the old position yet; the
  Compass board waits on its first sweep), and
  dropped the moment the reader scrolls, so a late
  restore never yanks the page from under them.
==================================================
*/

import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const positions = new Map<string, number>();
let currentKey = '';
let recording = false;

const scroller = () => document.querySelector<HTMLElement>('main');

/** One listener for the life of the app: where the reader is, per location */
function ensureRecorder(): void {
  if (recording) return;
  const el = scroller();
  if (!el) return;
  recording = true;
  el.addEventListener(
    'scroll',
    () => {
      if (currentKey) positions.set(currentKey, el.scrollTop);
    },
    { passive: true }
  );
}

const ScrollHome = () => {
  const location = useLocation();
  const type = useNavigationType();
  useLayoutEffect(() => {
    const el = scroller();
    if (!el) return;
    ensureRecorder();
    currentKey = location.key;
    const target = type === 'POP' ? (positions.get(location.key) ?? 0) : 0;
    el.scrollTop = target;
    if (target === 0) return;
    /* The page may still be filling in: keep the old position on it until
       it holds, for up to ~2s, unless the reader takes the scroll themselves */
    const until = performance.now() + 2000;
    let held = 0;
    let stop = false;
    const release = () => {
      stop = true;
    };
    const INPUTS: (keyof WindowEventMap)[] = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
    INPUTS.forEach(ev => window.addEventListener(ev, release, { passive: true, once: true }));
    const again = () => {
      if (stop || performance.now() > until) return;
      const max = el.scrollHeight - el.clientHeight;
      if (max >= target && Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
      held = Math.abs(el.scrollTop - target) <= 1 ? held + 1 : 0;
      if (held < 3) requestAnimationFrame(again);
    };
    requestAnimationFrame(again);
    return () => {
      stop = true;
      INPUTS.forEach(ev => window.removeEventListener(ev, release));
    };
    // On mount only — the wrapper this sits in is keyed by the route, so a
    // navigation this instance answers for remounts it (see the file's head)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

export default ScrollHome;
