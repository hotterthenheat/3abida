/*
==================================================
  SLAYER TERMINAL - PINPOINT GEX TYPES (gex.ts)
  Strike chart overlays, strike×expiry matrix,
  multi-ticker flow board & dark pool prints
==================================================
*/

export type GexMetric = 'GEX' | 'VEX' | 'GEX+VEX';

export type StrikeRange = 10 | 20;

/** Key dealer-structure price levels drawn on the strike chart. */
export interface KeyLevels {
  spot: number;
  callWall: number;
  putWall: number;
  flip: number;
  /** Strike holding the largest absolute exposure */
  supreme: number;
}

/** The heat field read as ONE regime — the engine names the configuration
    (our vocabulary, not the street's): where spot sits against the flip and
    how close the absorbing walls are decides what the map is saying. */
export type HeatPatternKey = 'SPRINGBOARD' | 'TRAPDOOR' | 'PINNED' | 'WHIPSAW';
export interface HeatPatternRead {
  key: HeatPatternKey;
  direction: 'BULLISH' | 'BEARISH' | 'RANGE' | 'VOLATILE';
  read: string;
}

/** One horizontal exposure node on the price axis. */
export interface NodeLevel {
  strike: number;
  /** Signed metric value in dollars */
  value: number;
}

export interface MatrixCell {
  value: number;
  supreme?: boolean;
}

export interface GexMatrixData {
  /** Column labels, nearest expiry first (e.g. 0DTE, 1D, …) */
  expiries: string[];
  /** Row strikes, descending */
  strikes: number[];
  /** cells[rowIndex][colIndex] */
  cells: MatrixCell[][];
  maxAbs: number;
  spotRowIndex: number;
  callWallIndex: number;
  putWallIndex: number;
}

export interface DarkPoolPrint {
  price: number;
  /** Notional in $B */
  notional: number;
  date: string;
  /** Shares crossed */
  size: number;
  /** HH:MM:SS print time */
  time: string;
}

export interface LadderRow {
  strike: number;
  value: number;
  supreme?: boolean;
}

export interface BoardTicker {
  ticker: string;
  spot: number;
  changePercent: number;
  prints: DarkPoolPrint[];
  ladder: LadderRow[];
  ladderMaxAbs: number;
}

export interface GexView {
  levels: KeyLevels;
  nodes: NodeLevel[];
  nodesMaxAbs: number;
  matrix: GexMatrixData;
  board: BoardTicker[];
}

// ---- Exposure Profile (GEX / DEX / VEX by strike + the pressure ladder) -----

export type ExposureExpiry = '0DTE' | '1D' | '2D' | '5D' | '7D' | 'OPEX' | 'ALL';

/** Put / call legs and their net, signed dollars. */
export interface GreekSplit {
  put: number;
  call: number;
  net: number;
}

export interface StrikeExposure {
  strike: number;
  /** Marks the pin strike (max open-interest magnet) in the rail */
  pin?: boolean;
  gex: GreekSplit;
  dex: GreekSplit;
  vex: GreekSplit;
  /** Dollars of dealer delta per one point of vol — positive: a vol drop makes them buy there (2026-09-09) */
  vanna: GreekSplit;
  /** Dollars of dealer delta the clock takes per session — negative: they buy there as it runs */
  charm: GreekSplit;
  /** Contracts outstanding at the strike, both sides */
  oi: number;
  /** Session volume at the strike — the same figure Ranked Targets ranks by */
  volume: number;
}

/* His P-5 adds `air-pocket`: a run of strikes with almost no dealer gamma
   between two shelves — where price does NOT stop. */
export type ZoneKind = 'call-wall' | 'put-wall' | 'friction' | 'air-pocket';

/** Contiguous strike band the exposure profile annotates (strikes descending: from ≥ to). */
export interface ZoneBand {
  from: number;
  to: number;
  kind: ZoneKind;
  label: string;
}

export type DealerBias = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface ExposureLevels {
  spot: number;
  callWall: number;
  putWall: number;
  pin: number;
  flip: number;
  /** Largest |net gamma| strike on the FULL book — may sit outside the
      rendered window, in which case the map crowns nothing rather than
      promoting a runner-up. */
  supreme: number;
}

export interface ExposureProfileData {
  ticker: string;
  expiry: ExposureExpiry;
  /** Strikes descending, window around spot */
  strikes: StrikeExposure[];
  /** Per-greek scaling for bars (max |leg| across the window) */
  maxAbs: { gex: number; dex: number; vex: number; vanna: number; charm: number };
  netGex: number;
  netDex: number;
  netVex: number;
  levels: ExposureLevels;
  zones: ZoneBand[];
  bias: DealerBias;
  biasNote: string;
  /** Generated narrative — levels translated to English */
  insights: string[];
  /** Row index after which the spot marker renders (-0.5 = above all rows) */
  spotAfterIndex: number;
}

// ---- Command cockpit ---------------------------------------------------------

export interface PressureSide {
  /** Signed dealer pressure, dollars */
  pressure: number;
  /** Open-interest change vs prior session, contracts */
  deltaOI: number;
  volume: number;
}

export interface PressureRow {
  strike: number;
  pin?: boolean;
  flip?: boolean;
  call: PressureSide;
  put: PressureSide;
  /** Net dealer pressure across both sides */
  net: number;
}

export type KeyLevelKind = 'call-wall' | 'spot' | 'put-wall' | 'pin' | 'flip' | 'supreme';

export interface KeyLevelRow {
  kind: KeyLevelKind;
  label: string;
  price: number;
  /** Signed % distance from spot (spot row = 0) */
  distPct: number;
  /** Exposure magnitude parked at the level, dollars */
  pressure: number;
}

export interface PulseView {
  pressure: PressureRow[];
  /** Max |pressure| across rows for bar scaling */
  pressureMaxAbs: number;
  keyLevels: KeyLevelRow[];
  bias: DealerBias;
  biasNote: string;
}

// ---- Volatility Lab ------------------------------------------------------------

// ---- Vanna & Charm (exposure migration) -----------------------------------------

/** CHARM = decay into the close · VANNA = shift under an IV move */
export type ShiftMode = 'CHARM' | 'VANNA';

export type IvShift = -2 | -1 | 1 | 2;

export interface ShiftBarRow {
  strike: number;
  pin?: boolean;
  /** Net GEX now, signed dollars */
  current: number;
  /** Net GEX under the scenario */
  projected: number;
}

export interface LevelShift {
  label: string;
  kind: KeyLevelKind;
  current: number;
  projected: number;
}

export interface WallDriftPoint {
  /** Unix seconds, bar-aligned */
  time: number;
  spot: number;
  callWall: number;
  putWall: number;
  flip: number;
}

// ---- Ranked Targets (strike scoring engine) ---------------------------------------

// ---- Vanna & Charm view -------------------------------------------------------------

/** One measured level in the migration read — price + signed distance from spot */
export interface ReadLevel {
  price: number;
  distPct: number;
}

/** The migration read, as MEASUREMENTS (Mo, 2026-08-19: "walls hold — expect
    the morning structure to govern the close" reads as a prediction). Facts
    plus ONE short computation-statement line. */
export interface MigrationRead {
  flip: ReadLevel;
  callWall: ReadLevel;
  putWall: ReadLevel;
  /** The strike where charm (decay repositioning) concentrates */
  charm: ReadLevel;
  /** Largest per-strike net-gex change vs the previous scan, if history allows */
  delta: { strike: number; changeUsd: number; distPct: number } | null;
  /** One short sentence — states what THIS SCENARIO computes, never what the
      market will do */
  line: string;
}

export interface VannaCharmView {
  ticker: string;
  spot: number;
  mode: ShiftMode;
  ivShift: IvShift;
  /** Strikes descending */
  rows: ShiftBarRow[];
  /** Max |value| across current + projected, for bar scaling */
  maxAbs: number;
  flipCurrent: number;
  flipProjected: number;
  shifts: LevelShift[];
  drift: WallDriftPoint[];
  read: MigrationRead;
}
