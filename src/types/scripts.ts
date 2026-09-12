/*
==================================================
  SLAYER TERMINAL - SCRIPTS (types/scripts.ts)

  The shape of a script — the Pine v6 subset a user
  writes, saves, puts on a pane and, one day, shares.
  Written down FIRST (Noah, 2026-09-10: "i dont just
  want to create something before having the
  blueprint for it") so the editor, the library, the
  runtime and the chart all agree on it, and so the
  place scripts are kept can change underneath them:
  the browser keeps them today, the server keeps them
  later, and nothing above this file changes.

  THE SEAM, like types/record.ts. Two ideas only:

    A SCRIPT is text a person wrote, with what we
    learned from that text when they saved it (its
    inputs, its plots, its alerts, whether it draws on
    the tape or takes its own pane), and its history —
    every Save is a version.

    A CHART SCRIPT is one script placed on one pane
    with that person's own settings for it. The same
    script can sit on two panes with different inputs.

  Everything reaches storage through ONE door, the
  ScriptStore at the bottom. Today a browser driver
  answers it (data/scriptStore.ts); the server's
  driver answers the same questions later.
==================================================
*/

/* ---- what a script is ------------------------------------------------------------ */

/** What Pine calls the script's role; indicators first, strategies and libraries when the runtime grows into them */
export type ScriptKind = 'indicator' | 'strategy' | 'library';

/** Who can see it: yours alone, anyone with the link, or in the community library */
export type ScriptVisibility = 'private' | 'unlisted' | 'public';

/** Where the library found it: shipped with the terminal, written by you, or published by someone */
export type ScriptShelf = 'built-in' | 'mine' | 'community';

/** Where it draws: on the tape (overlay = true) or in its own pane under the tape */
export type ScriptPane = 'overlay' | 'own';

export type ScriptInputKind = 'int' | 'float' | 'bool' | 'string' | 'color' | 'source' | 'timeframe';
export type ScriptInputValue = number | boolean | string;

/** One input the script declares (`input.int(9, "Conversion", minval = 1)`) — read from the source when it is saved */
export interface ScriptInput {
  /** The variable it is assigned to, unique in the script */
  id: string;
  kind: ScriptInputKind;
  /** The words shown beside the control — the input's title, or its variable name */
  title: string;
  default: ScriptInputValue;
  min?: number;
  max?: number;
  step?: number;
  /** For a string input with options — a dropdown */
  options?: string[];
  /** `group = "…"` — inputs under one heading in the settings */
  group?: string;
  tooltip?: string;
}

export type ScriptPlotStyle = 'line' | 'stepline' | 'histogram' | 'columns' | 'area' | 'circles' | 'cross';

/** One line, histogram or marker the script draws */
export interface ScriptPlot {
  /** Its position in the script, stable across edits that do not add or remove plots */
  id: string;
  title: string;
  /** The ink the script asked for — a hex; the reader may override it per pane (ChartScript.inks) */
  ink: string;
  style: ScriptPlotStyle;
  width: number;
}

/** One `alertcondition(...)` — a name and a message the alert engine can fire */
export interface ScriptAlert {
  id: string;
  title: string;
  message: string;
}

/** What the parser learned from the source at the last Save — kept beside the text so the library never parses to list */
export interface ScriptMeta {
  /** The Pine version the header declared — 6 is the only one we run */
  version: 6;
  /** `indicator("Ichimoku Cloud", …)` — the title inside the script, which may differ from the saved title */
  title: string;
  kind: ScriptKind;
  pane: ScriptPane;
  inputs: ScriptInput[];
  plots: ScriptPlot[];
  /** How many `fill(...)` calls — a count is all the library needs */
  fills: number;
  alerts: ScriptAlert[];
  /** Reads the terminal's own data through the `slayer.*` namespace — the one thing beyond Pine, and the one thing TradingView cannot run */
  usesSlayer: boolean;
}

/** Why a script does not run — the line and the plain words, never a stack */
export interface ScriptError {
  line: number;
  column?: number;
  message: string;
}

export interface Script {
  id: string;
  /** Who owns it; 'slayer' for the built-ins */
  ownerId: string;
  shelf: ScriptShelf;
  /** The name in the library — yours to change; the script's own header title lives in meta */
  title: string;
  /** One or two plain sentences for the library row */
  description: string;
  tags: string[];
  visibility: ScriptVisibility;
  /** The source text as saved — the whole script, nothing compiled */
  source: string;
  /** A hash of the source, so identical saves and copies are known for what they are */
  sourceHash: string;
  /** null when the source has never parsed clean */
  meta: ScriptMeta | null;
  status: 'ok' | 'error';
  error?: ScriptError;
  /** The script this one was copied from, when it was */
  forkedFrom?: string;
  /** The current version number — versions start at 1 and every Save adds one */
  version: number;
  /** A built-in cannot be edited in place — Make a copy first */
  readOnly: boolean;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
  /** Soft delete — kept so a pane that still names it can say so */
  deletedAt?: number;
}

/** One saved state of a script — Save writes one, restore brings one back */
export interface ScriptVersion {
  scriptId: string;
  version: number;
  source: string;
  /** What changed, in the writer's words, when they gave one */
  message?: string;
  createdAt: number;
}

/* ---- a script on a pane ---------------------------------------------------------- */

/** Which chart pane — stable names the charts already have: 'pulse:main', 'terrain:1'…'terrain:4', 'weigher', 'board:0'…'board:3' */
export type PaneId = string;

/** One script placed on one pane, with this reader's settings for it */
export interface ChartScript {
  id: string;
  paneId: PaneId;
  scriptId: string;
  /** 'latest' follows the script as it is edited; a number pins one version */
  version: number | 'latest';
  /** The reader's values for the script's inputs, by input id — missing ones take the script's defaults */
  inputs: Record<string, ScriptInputValue>;
  visible: boolean;
  /** Draw order on the pane, lowest first */
  order: number;
  /** The reader's inks per plot id, over the script's own */
  inks?: Record<string, string>;
}

export interface ScriptFavourite {
  scriptId: string;
  at: number;
}

/* ---- the limits ------------------------------------------------------------------ */

/** The terminal's tiers, as the pricing names them */
export type Tier = 'pinpoint' | 'compass' | 'lifetime';

/** What a tier may hold — the pane count is the one that costs anything, the rest are guards */
export interface ScriptLimits {
  /** Scripts drawn on one pane at once */
  onPane: number;
  /** Saved scripts of your own; null = no cap */
  saved: number | null;
  /** Publishes a day */
  publishesPerDay: number;
}

export const SCRIPT_LIMITS: Record<Tier, ScriptLimits> = {
  pinpoint: { onPane: 5, saved: 200, publishesPerDay: 10 },
  compass: { onPane: 15, saved: 1000, publishesPerDay: 10 },
  lifetime: { onPane: 25, saved: null, publishesPerDay: 10 },
};

/** The caps every script lives under, whoever wrote it */
export const SCRIPT_CAPS = {
  /** Source text, in bytes */
  sourceBytes: 100_000,
  plots: 64,
  inputs: 100,
  alerts: 40,
  /** Versions kept per script — older ones fall off the end */
  versions: 100,
  /** A recompute over the pane's bars must finish inside this, or the script pauses and says so */
  budgetMs: 200,
} as const;

/* ---- the one door ------------------------------------------------------------------- */

/** What a Save carries: a new script when `id` is empty, a new version of one when it is set */
export interface ScriptSave {
  id?: string;
  title: string;
  source: string;
  description?: string;
  tags?: string[];
  message?: string;
}

/** Every question the editor, the library and the chart ask of storage — and nothing else.
    The browser answers today; the server answers the same questions later. */
export interface ScriptStore {
  /** The scripts on a shelf, newest edited first; every shelf when none is named */
  list(shelf?: ScriptShelf): Promise<Script[]>;
  get(id: string): Promise<Script | null>;
  /** Parses the source, stores the text and what it learned, writes a version */
  save(input: ScriptSave): Promise<Script>;
  /** A copy of your own — the way to edit a built-in or a community script */
  fork(id: string, title?: string): Promise<Script>;
  remove(id: string): Promise<void>;
  versions(id: string): Promise<ScriptVersion[]>;
  restore(id: string, version: number): Promise<Script>;
  setVisibility(id: string, visibility: ScriptVisibility): Promise<Script>;

  favourites(): Promise<ScriptFavourite[]>;
  toggleFavourite(id: string): Promise<boolean>;

  /** The scripts on one pane, in draw order */
  onPane(paneId: PaneId): Promise<ChartScript[]>;
  /** Put a script on a pane with the script's defaults, or the inputs given */
  place(paneId: PaneId, scriptId: string, inputs?: Record<string, ScriptInputValue>): Promise<ChartScript>;
  /** Change a placed script's inputs, inks, order or visibility */
  update(chartScript: ChartScript): Promise<ChartScript>;
  /** Take a script off a pane — the script itself stays saved */
  lift(chartScriptId: string): Promise<void>;
}
