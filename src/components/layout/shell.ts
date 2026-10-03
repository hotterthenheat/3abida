/*
==================================================
  SLAYER TERMINAL - THE SHELL, FETCHED ON ITS OWN
  (components/layout/shell.ts)

  The terminal's shell (AppShell: the rail, the palette, the alerts' watcher and drawer, the paper runner, every page's
  skeleton) is its own chunk since 2026-10-03. It rode in the first script every visitor loads, so the landing waited for
  most of the terminal before it could draw a word — four seconds to its picture on a phone's connection. Now the landing
  loads without it and fetches it once it stands (warmShell), and a launch fetches it as its gate goes up, so the
  terminal still opens at once.
==================================================
*/

export const loadShell = () => import('./AppShell');

/** fetch the shell ahead of need (the module is kept: the route's own import finds it in) */
export const warmShell = (): void => {
  void loadShell().catch(() => {
    /* a failed fetch is tried again by the route itself, which has its own net (AppShell's) */
  });
};
