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

import {
  CellStyleModule,
  ClientSideRowModelApiModule,
  ClientSideRowModelModule,
  ExternalFilterModule,
  PaginationModule,
  RowApiModule,
  RowSelectionModule,
  RowStyleModule,
  ScrollApiModule,
  TooltipModule,
  ValidationModule,
  themeQuartz,
  type Module,
} from 'ag-grid-community';

/* THE MODULES THE GRIDS USE, NOT ALL OF THEM (2026-09-30, the perf pass): AllCommunityModule carried every feature AG
   Grid has — filters, editors, export, drag, the lot — into every page with a table, 668KB of it before a row was drawn.
   These are what the terminal's grids ask for: rows handed in, one row selected, row and cell classes, the header
   tooltips, the rest cap's pages (TraceGrid), the Board's own search (an external filter), and the row and scroll calls
   the Weigher's chain makes (and the client-side row calls under them). A grid that reaches for anything else says so
   by name in the console — in full while developing (the validation module), as an error #200 in a build. */
export const GRID_MODULES: Module[] = [
  ClientSideRowModelModule,
  RowSelectionModule,
  RowStyleModule,
  CellStyleModule,
  TooltipModule,
  PaginationModule,
  ExternalFilterModule,
  RowApiModule,
  ScrollApiModule,
  ClientSideRowModelApiModule,
  /* the names of what is missing, while building — the production build leaves the validation out */
  ...(import.meta.env.DEV ? [ValidationModule] : []),
];

export const GRID_THEME = themeQuartz.withParams({
  backgroundColor: 'rgb(var(--panel))',
  foregroundColor: 'rgb(var(--text-primary))',
  headerBackgroundColor: 'rgb(var(--chip))',
  /* grey on the dark terminal, black on paper (tokens.css --grid-head, the light sweep 2026-09-19) */
  headerTextColor: 'rgb(var(--grid-head))',
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
