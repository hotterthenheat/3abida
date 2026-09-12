/*
==================================================
  SLAYER TERMINAL - THE WIDTH HOLD (components/ui/useGlideHold.ts)

  The Weigher's rule (2026-09-11), made a hook: a
  column whose content is heavy — a grid grown to
  its rows, a strip of cards — holds its width for
  the sidebar's glide and takes the new width once
  when the glide ends. Without it every frame of
  the 300ms glide re-lays every rendered row (the
  lag Noah named first). main clips the overlap
  (index.css [data-glide]).

  The width only — NOT the Weigher's compositor
  layer: the desk is a screen tall, but a grid
  grown to 400 rows is sixteen screens, and
  promoting that to a layer rasters the whole of it
  before the first frame moves (measured 229ms).

  A callback ref, so a wrapper that remounts on
  navigation (the section shells' keyed cross-fade)
  re-subscribes with its new element.
==================================================
*/

import { useEffect, useState } from 'react';
import { onGlide } from '../../core/glide';

export function useGlideHold<T extends HTMLElement>(): (el: T | null) => void {
  const [el, setEl] = useState<T | null>(null);
  useEffect(() => {
    if (!el) return;
    return onGlide(
      () => {
        el.style.width = `${el.getBoundingClientRect().width}px`;
      },
      () => {
        el.style.width = '';
      }
    );
  }, [el]);
  return setEl;
}

export default useGlideHold;
