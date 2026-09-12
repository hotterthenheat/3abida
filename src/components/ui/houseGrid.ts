/*
==================================================
  SLAYER TERMINAL - THE HOUSE GRID (components/ui/houseGrid.ts)

  One AG Grid theme for every table on the terminal
  that is a grid: the Board first (2026-09-05), the
  Record's Insiders and Congress since 2026-09-09.
  Quartz on the house tokens — parameters, not CSS:
  the grid injects what it needs and our inks ride
  as values. THE VALUES ARE THE TOKENS (2026-09-12):
  each is a var() the grid writes into its own
  custom properties, so a theme flip re-inks every
  grid in the same frame with no re-theme call.
  Pair with the `slayer-board` class (index.css)
  for the mono uppercase heads.
==================================================
*/

import { AllCommunityModule, themeQuartz } from 'ag-grid-community';

export const GRID_MODULES = [AllCommunityModule];

export const GRID_THEME = themeQuartz.withParams({
  backgroundColor: 'rgb(var(--panel))',
  foregroundColor: 'rgb(var(--text-primary))',
  headerBackgroundColor: 'rgb(var(--chip))',
  headerTextColor: 'rgb(var(--text-secondary))',
  headerFontSize: 9,
  headerFontWeight: 600,
  headerHeight: 30,
  rowHeight: 44,
  fontSize: 11,
  fontFamily: 'inherit',
  borderColor: 'rgb(var(--border-subtle))',
  rowBorder: true,
  columnBorder: false,
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  headerColumnBorder: false,
  rowHoverColor: 'rgb(var(--ink) / 0.03)',
  selectedRowBackgroundColor: 'rgb(var(--silver) / 0.06)',
  accentColor: 'rgb(var(--silver))',
  cellHorizontalPadding: 12,
  iconSize: 12,
  /* The grid's own scrollbars and form controls follow the page's color-scheme */
  browserColorScheme: 'inherit',
});
