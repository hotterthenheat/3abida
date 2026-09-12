/*
==================================================
  SLAYER TERMINAL - ON SCREEN? (components/ui/useOnScreen.ts)

  Whether an element is inside the viewport, kept
  by an IntersectionObserver — so a box below the
  fold can be spared work nobody sees (the Map's
  replay, 2026-09-11: the calendar, the clock and
  the report rebuilt on every replayed minute
  behind a fullscreen chart, and each rebuild was
  the frame the ladder's easing stuttered on). A
  callback ref, so it binds whatever element the
  host renders, whenever it renders it.
==================================================
*/

import { useEffect, useState } from 'react';

export function useOnScreen<T extends HTMLElement>(margin = '120px'): [(el: T | null) => void, boolean] {
  const [el, setEl] = useState<T | null>(null);
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => setOn(entries[0]?.isIntersecting ?? true), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [el, margin]);
  return [setEl, on];
}

export default useOnScreen;
