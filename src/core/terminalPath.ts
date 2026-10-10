/*
==================================================
  SLAYER TERMINAL - THE TERMINAL'S ADDRESSES (core/terminalPath.ts)

  Its rooms and the old addresses that land in them (App.tsx). A full load of
  anything else — the front page, the pages outside the terminal, a wrong
  address's prompt — opens without the launch gate (LaunchTransition) and on
  the visitor's own ground (theme/theme.ts firstGround). index.html's pre-paint
  script keeps the same list: change both together.
==================================================
*/

const TERMINAL = /^\/(pulse|terrain|compass|weigher|dossier|practice|pinpoint|trace|settings|community|alerts|home|live-terminal|workspace|record|paper|review|stocks|news|newsroom|earnings|watchlist|tracker|skys-vision|liquidity|flow-desk|pinpoint-gex|auditor-log)(\/|$)/i;

export const isTerminalPath = (path: string): boolean => TERMINAL.test(path);
