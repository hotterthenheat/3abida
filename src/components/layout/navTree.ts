/*
==================================================
  SLAYER TERMINAL - THE PAGES UNDER EACH PRODUCT
  (components/layout/navTree.ts)

  One answer to "which pages sit under this product",
  read by the side rail's tree and by the phone's menu
  (MobileMenu.tsx, 2026-09-19) — so a page added to a
  section appears in both, and the phone cannot fall
  behind the desk. It lived inside SideNav until the
  phone needed it too.
==================================================
*/

import { GEX_SUBPAGES } from '../../pages/pinpoint/subnav';
import { RECORD_SUBPAGES } from '../../pages/record/subnav';
import { TRACE_SUBPAGES } from '../../pages/trace/subnav';

export interface NavLeaf {
  path: string;
  label: string;
}

/** The pages nested under a product while you are inside it */
const SUBPAGES: Record<string, NavLeaf[]> = {
  /* Pulse's second page, on the rail as on the command line (the audit's PU-8: it was reachable from the chart's toolbar alone) */
  '/pulse': [
    { path: '/pulse', label: 'The desk' },
    { path: '/pulse/board', label: 'Four charts' },
  ],
  '/pinpoint': GEX_SUBPAGES.map(p => ({ path: p.path, label: p.label })),
  '/dossier': RECORD_SUBPAGES.map(p => ({ path: p.path, label: p.label })),
  /* Trace's nine moved here from its fused strip (Noah, 2026-09-09: "should we
     have the different subtabs on the sub-bar or stay on the top section") */
  '/trace': TRACE_SUBPAGES.map(p => ({ path: p.path, label: p.label })),
};

/** COMPASS'S PAGES ON THE TREE (Noah, 2026-09-13, with his partner's sidebar: "the tracker for compass and the board should be sub pages
    of the compass page"): the board always, the Tracker always, and "Inside the contract" once a contract has been chosen — it points
    at the LAST contract's page landed on (the store's `chosenId`, set by that page) and stays through the board and the Tracker until
    another contract takes its place (Noah, the same day); it cannot be on the tree before one is chosen (2026-09-12). */
export const subpagesFor = (path: string, pathname: string, chosenId: string | null): NavLeaf[] | undefined => {
  if (path === '/compass') {
    const m = pathname.match(/^\/compass\/([^/?#]+)/);
    const here = m && m[1] !== 'tracker' ? m[1] : null;
    const id = here ?? chosenId;
    return [{ path: '/compass', label: 'The board' }, ...(id ? [{ path: `/compass/${id}`, label: 'Inside the contract' }] : []), { path: '/compass/tracker', label: 'Tracker' }];
  }
  return SUBPAGES[path];
};
