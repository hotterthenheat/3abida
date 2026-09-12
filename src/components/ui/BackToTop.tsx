/*
==================================================
  SLAYER TERMINAL - THE DOOR HOME (components/ui/BackToTop.tsx)

  The page's own way back to the top (Noah,
  2026-09-11, the Compass walk: "a back to top
  button should be then added like we have for
  trace") — the same door TraceGrid keeps in its
  window's corner, lifted to the page: it watches
  the app's scroller (<main>), shows once the
  reader is a screen or so deep, and glides home
  on the house curve with absolute writes each
  frame so a tick cannot shove the scroll
  mid-glide; reduced motion jumps.
==================================================
*/

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

const SHOW_AFTER = 600;
const DUR = 450;

const scroller = () => document.querySelector<HTMLElement>('main');

const BackToTop = ({ testId = 'page' }: { testId?: string }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = scroller();
    if (!el) return;
    const read = () => setShow(el.scrollTop > SHOW_AFTER);
    read();
    el.addEventListener('scroll', read, { passive: true });
    return () => el.removeEventListener('scroll', read);
  }, []);

  const glide = () => {
    const el = scroller();
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.scrollTop = 0;
      setShow(false);
      return;
    }
    const start = el.scrollTop;
    const t0 = performance.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.scrollTop = 0;
      setShow(false);
    };
    const step = (now: number) => {
      if (done) return;
      const t = Math.min(1, (now - t0) / DUR);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic, the house curve
      el.scrollTop = Math.round(start * (1 - eased));
      if (t < 1) requestAnimationFrame(step);
      else finish();
    };
    requestAnimationFrame(step);
    window.setTimeout(finish, DUR + 100);
  };

  if (!show) return null;
  return (
    <button
      onClick={glide}
      title="Back to top"
      aria-label="Scroll back to the top"
      data-back-to-top={testId}
      className="fixed bottom-6 right-8 z-[70] inline-flex items-center justify-center w-9 h-9 rounded-full border border-borderMuted bg-panel/90 backdrop-blur-sm text-textSecondary hover:text-textPrimary hover:bg-panelHover shadow-lg shadow-black/40 transition-colors animate-soft-in"
    >
      <ArrowUp className="w-4 h-4" />
    </button>
  );
};

export default BackToTop;
