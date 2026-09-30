"""
SLAYER TERMINAL - THE ENGINE (slayer_core)

The one implementation of the math. The live loop imports it; the replay
harness imports it; nothing else computes a Greek, a wall or a score. Ported
from the TypeScript engines in src/core and src/data (2026-09-17), function by
function, each one held to the TypeScript output by tests/test_greeks_parity.py
until the port is total and the TypeScript copy is retired.

Layout, in the order the port lands:
  carry     - the rate and the yield every greek is priced against (a seam)
  greeks    - Black-Scholes price, greeks, implied vol (scalar and vectorised)
  clock     - the engine clock: wall clock live, pinned by the replay
  calendar  - sessions, holidays, expiries, the futures clock
  walls     - the wall, the flip, the heaviest strike, the air pockets
  exposure  - the chain into exposures, the profile, the strike x expiry surface
  journal   - the decision journal's records, identities and wire format
  indicators - RSI, the EMAs, the squeeze (the simulator's getIndicators)
  tape      - the market as it was: Parquet, written once, read as a filter
  theta     - ThetaData v3's wire: the request URLs and the parsers into the tape
  snapshot  - a tape frame into the photograph the engine scores
  fixture   - the partner spec's worked numbers (tests/test_fixture.py)
"""

from .indicators import Indicators, indicators
from .snapshot import Photograph, build_photograph, feature_market
from .tape import TapeError, TapeFrame, read_frame

from .journal import (
    ENGINE_VERSION,
    ContractId,
    DecisionEvent,
    DecisionSource,
    EvaluationRun,
    FeatureSnapshot,
    JournalError,
    OutcomeEvent,
    ProvenanceError,
    ScannerSource,
    WeigherSource,
    WeightsRevision,
    WireError,
    assert_evaluable,
    decision_id,
    from_wire,
    future_contract_id,
    gex_levels_from_profile,
    occ_symbol,
    option_contract_id,
    source_key,
    stock_contract_id,
    to_wire,
)

from .exposure import (
    CALENDAR_DTES,
    DEALER_CALL,
    DEALER_PUT,
    DESK_DTES,
    GREEKS,
    DeskExpiry,
    ExposureProfile,
    ExposureSurface,
    LegFacts,
    Levels,
    build_exposure_profile,
    build_exposure_surface,
    chain_exposures,
    chain_from_rows,
    desk_expiry_from_rows,
)
from .walls import AirPocket, find_air_pockets, heaviest, pick_flip, pick_walls
from .calendar import (
    MARKET_HOLIDAYS,
    RTH_HOURS,
    RTH_MINUTES,
    Expiry,
    expiry_for,
    fmt_expiry,
    futures_phase_at,
    is_trading_day,
    iso_date,
    next_session,
    sessions_between,
    today,
)
from .carry import Carry, get_carry, reset_carry, set_carry
from .clock import engine_clock, now, set_engine_clock
from .greeks import Greeks, black_scholes_greeks, black_scholes_price, implied_vol_from_price

__all__ = [
    "Carry",
    "get_carry",
    "set_carry",
    "reset_carry",
    "Greeks",
    "black_scholes_greeks",
    "black_scholes_price",
    "implied_vol_from_price",
    "MARKET_HOLIDAYS",
    "RTH_HOURS",
    "RTH_MINUTES",
    "Expiry",
    "expiry_for",
    "fmt_expiry",
    "futures_phase_at",
    "is_trading_day",
    "iso_date",
    "next_session",
    "sessions_between",
    "today",
    "now",
    "set_engine_clock",
    "engine_clock",
    "CALENDAR_DTES",
    "DEALER_CALL",
    "DEALER_PUT",
    "DESK_DTES",
    "GREEKS",
    "DeskExpiry",
    "ExposureProfile",
    "ExposureSurface",
    "LegFacts",
    "Levels",
    "build_exposure_profile",
    "build_exposure_surface",
    "chain_exposures",
    "chain_from_rows",
    "desk_expiry_from_rows",
    "AirPocket",
    "find_air_pockets",
    "heaviest",
    "pick_flip",
    "pick_walls",
    "ENGINE_VERSION",
    "ContractId",
    "DecisionEvent",
    "DecisionSource",
    "EvaluationRun",
    "FeatureSnapshot",
    "JournalError",
    "OutcomeEvent",
    "ProvenanceError",
    "ScannerSource",
    "WeigherSource",
    "WeightsRevision",
    "WireError",
    "assert_evaluable",
    "decision_id",
    "from_wire",
    "future_contract_id",
    "gex_levels_from_profile",
    "occ_symbol",
    "option_contract_id",
    "source_key",
    "stock_contract_id",
    "to_wire",
    "Indicators",
    "indicators",
    "Photograph",
    "build_photograph",
    "feature_market",
    "TapeError",
    "TapeFrame",
    "read_frame",
]
