/*
==================================================
  SLAYER TERMINAL - THE TAB'S MARK (brand/favicon.ts)

  "The app swaps the SVG favicon. PNG fallbacks stay still." (Slayer Logo System, Favicon states.) The tab shows the
  mark's state — still, loading, live, alert, closed — the moment it changes, and only then: one attribute write per
  change, never per frame. The PNG and the touch icon in index.html are never touched.
==================================================
*/

import { useEffect } from 'react';
import { useMarkState, type MarkState } from './markState';
import { markSvg, svgDataUrl } from './iconSvg';

const cache = new Map<MarkState, string>();
const urlFor = (state: MarkState): string => {
  let url = cache.get(state);
  if (!url) {
    url = svgDataUrl(markSvg({ state, theme: 'dark' }));
    cache.set(state, url);
  }
  return url;
};

/** Keep the tab's SVG icon on the mark's state — mounted once, at the root */
export function useFaviconFollowsMark(): void {
  const state = useMarkState();
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]');
    if (!link) return;
    const next = urlFor(state);
    if (link.href !== next) link.href = next;
  }, [state]);
}

/** The hook as an element, for the root's list of providers */
export const FaviconFollowsMark = (): null => {
  useFaviconFollowsMark();
  return null;
};
