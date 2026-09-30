"""
THE DECISION JOURNAL (ported from src/types/journal.ts and src/core/journal.ts,
2026-09-17).

The spine of the loop: choice -> record -> resolve -> recalibrate. Every record
here describes a Compass decision, what the engine SAW when it decided, what
the market later DID about it, and how the weights were retuned in response.
The live writer and the replay harness write the SAME shapes, distinguished
only by FeatureSnapshot.provenance.

THE WIRE IS THE TYPESCRIPT SEAM. Rows travel as JSON with the field names of
types/journal.ts (camelCase), because the Node API and the browser read them.
`to_wire` and `from_wire` are the only doors: a Python record is snake_case
inside and camelCase outside, an unknown or missing key is an error at the
door (a hand-rolled row that pads wrong is a silent join failure months
later), and absent optionals are absent, never null.

THE SEMANTICS THE TYPESCRIPT STATES IN COMMENTS ARE CHECKED HERE IN CODE:
  - every record is FROZEN: a decision is never edited after write, only
    resolved by an OutcomeEvent
  - identities are BUILT, never typed: a ContractId's `occ` must be what
    `occ_symbol` builds, a DecisionEvent's `id` what `decision_id` builds
  - SIM is never evaluated as market truth: `assert_evaluable` is how the
    evaluation layer refuses
  - the literal sets (instruments, scanners, sleeves, horizons, verdicts, close
    rules, exit reasons, provenances) are held to the TypeScript by the parity
    fixture, so a literal added on one side fails the test on the other

WHAT IS NOT HERE, ON PURPOSE. The spec's gap-check (docs/compass-backtest-spec.md
section 5) lists the additive fields the seam will grow: ev / pop / utility
beside `score`, no-trade records per scan, availability timestamps per
feature, assignment on LEAPS, the raw level and buffer beside the buffered
invalidation. Each lands in both copies at once, with the fixture regenerated;
none is invented here first.
"""

from __future__ import annotations

import math
import types
from dataclasses import MISSING, dataclass, fields, is_dataclass
from datetime import date as _date
from datetime import datetime
from typing import Any, Literal, Mapping, Union, get_args, get_origin, get_type_hints

from .calendar import iso_date

# ---- the engine build stamp -----------------------------------------------------------------

# BUMP THIS on any change to scoring math, weights, thresholds or candidate generation: it is
# what keeps eras comparable after recalibration. The suffix names the data regime: -sim until
# real feeds land. Held equal to core/journal.ts by the parity test.
ENGINE_VERSION = "compass@0.2.0-sim"

# ---- the literal sets (held to the TypeScript by the fixture) ---------------------------------

Instrument = Literal["OPTION", "STOCK", "SINGLE_NAME_FUTURE"]
Right = Literal["C", "P"]
ScannerKey = Literal["top-setups", "quick-scalp", "discounted", "rebounds", "whale-sweeps", "all"]
SleeveKey = Literal["odte", "weekly", "swing", "leaps"]
Horizon = Literal["SAMEDAY", "WEEKLIES", "SWINGS", "LEAPS"]
Verdict = Literal["ENTER", "EXIT", "WATCH"]
CloseRule = Literal["SESSION_CLOSE_THROUGH", "TOUCH"]
Side = Literal["BELOW", "ABOVE"]
ExitReason = Literal["EXPIRY", "INVALIDATED", "ALL_TARGETS_HIT", "ENGINE_EXIT"]
FeatureProvenance = Literal["SIM", "LIVE", "REPLAY"]

INSTRUMENTS = frozenset(get_args(Instrument))
RIGHTS = frozenset(get_args(Right))
SCANNER_KEYS = frozenset(get_args(ScannerKey))
SLEEVE_KEYS = frozenset(get_args(SleeveKey))
HORIZONS = frozenset(get_args(Horizon))
VERDICTS = frozenset(get_args(Verdict))
CLOSE_RULES = frozenset(get_args(CloseRule))
SIDES = frozenset(get_args(Side))
EXIT_REASONS = frozenset(get_args(ExitReason))
PROVENANCES = frozenset(get_args(FeatureProvenance))

# the provenances an evaluation may learn from; SIM data is never market truth
EVALUABLE_PROVENANCES = frozenset({"LIVE", "REPLAY"})


class JournalError(ValueError):
    """A record that breaks the journal's rules: an identity not built by the builders, a literal
    outside its set, an instant that does not parse, a provenance the evaluation may not use."""


class WireError(JournalError):
    """A row that does not match the seam at the door: an unknown key, a missing key, a wrong type."""


class ProvenanceError(JournalError):
    """SIM offered as market truth."""


# ---- identities, built never typed (core/journal.ts) ----------------------------------------

def _js_round(x: float) -> int:
    """JavaScript's Math.round: half UP (2.5 -> 3, -2.5 -> -2), not Python's banker's rounding."""
    return math.floor(x + 0.5)


def occ_symbol(ticker: str, expiry: str, right: str, strike: float) -> str:
    """
    OCC 21-character option symbol: root padded to 6, YYMMDD, C/P, strike x 1000
    left-padded to 8. "SPY   260731C00500000". The industry-standard name for one
    real contract: the journal's join key.
    """
    root = ticker.upper().ljust(6, " ")
    y, m, d = expiry.split("-")
    return f"{root}{y[2:]}{m}{d}{right}{str(_js_round(strike * 1000)).rjust(8, '0')}"


def iso_day(d: _date | datetime) -> str:
    """YYYY-MM-DD, local calendar: the journal's date format."""
    return iso_date(d)


def _check_literal(value: Any, allowed: frozenset, what: str) -> None:
    if value not in allowed:
        raise JournalError(f"{what} {value!r} is not one of {sorted(allowed)}")


def _check_instant(value: str, what: str) -> None:
    """An ISO instant with a zone: the live writer stamps the wall clock in UTC, the replay the
    pinned engine clock. A naive stamp cannot be joined to a tape and is refused."""
    try:
        parsed = datetime.fromisoformat(value)
    except (TypeError, ValueError) as e:
        raise JournalError(f"{what} {value!r} is not an ISO instant") from e
    if parsed.tzinfo is None:
        raise JournalError(f"{what} {value!r} carries no zone")


def _check_day(value: str, what: str) -> None:
    try:
        if _date.fromisoformat(value).isoformat() != value:
            raise ValueError
    except (TypeError, ValueError) as e:
        raise JournalError(f"{what} {value!r} is not YYYY-MM-DD") from e


@dataclass(frozen=True, kw_only=True)
class ContractId:
    """
    Canonical contract identity. Display ids are not stable; the journal joins on
    `occ`, which names one real contract forever. OPTION: the OCC symbol. STOCK:
    the ticker. SINGLE_NAME_FUTURE: "FUT:TICKER:YYYY-MM-DD".
    """

    instrument: Instrument
    ticker: str
    right: Right | None = None
    strike: float | None = None
    expiry: str | None = None  # the real expiry session, YYYY-MM-DD
    occ: str

    def __post_init__(self) -> None:
        _check_literal(self.instrument, INSTRUMENTS, "instrument")
        if self.ticker != self.ticker.upper():
            raise JournalError(f"ticker {self.ticker!r} is not upper case: identities are built, never typed")
        if self.instrument == "OPTION":
            if self.right is None or self.strike is None or self.expiry is None:
                raise JournalError("an OPTION identity needs right, strike and expiry")
            _check_literal(self.right, RIGHTS, "right")
            _check_day(self.expiry, "expiry")
            want = occ_symbol(self.ticker, self.expiry, self.right, self.strike)
        elif self.instrument == "STOCK":
            want = self.ticker
        else:
            if self.expiry is None:
                raise JournalError("a SINGLE_NAME_FUTURE identity needs an expiry")
            _check_day(self.expiry, "expiry")
            want = f"FUT:{self.ticker}:{self.expiry}"
        if self.occ != want:
            raise JournalError(f"occ {self.occ!r} is not the built identity {want!r}")


def option_contract_id(ticker: str, expiry: str, right: str, strike: float) -> ContractId:
    return ContractId(instrument="OPTION", ticker=ticker.upper(), right=right, strike=strike, expiry=expiry, occ=occ_symbol(ticker, expiry, right, strike))


def stock_contract_id(ticker: str) -> ContractId:
    return ContractId(instrument="STOCK", ticker=ticker.upper(), occ=ticker.upper())


def future_contract_id(ticker: str, expiry: str) -> ContractId:
    return ContractId(instrument="SINGLE_NAME_FUTURE", ticker=ticker.upper(), expiry=expiry, occ=f"FUT:{ticker.upper()}:{expiry}")


@dataclass(frozen=True, kw_only=True)
class ScannerSource:
    """A scanner setup: scanner = thesis, sleeve = tenor (optional: pre-sleeve decisions carry none)."""

    kind: Literal["scanner"] = "scanner"
    scanner: ScannerKey
    sleeve: SleeveKey | None = None

    def __post_init__(self) -> None:
        if self.kind != "scanner":
            raise JournalError(f"a ScannerSource's kind is 'scanner', not {self.kind!r}")
        _check_literal(self.scanner, SCANNER_KEYS, "scanner")
        if self.sleeve is not None:
            _check_literal(self.sleeve, SLEEVE_KEYS, "sleeve")


@dataclass(frozen=True, kw_only=True)
class WeigherSource:
    """A Weigher grade on one horizon."""

    kind: Literal["weigher"] = "weigher"
    horizon: Horizon

    def __post_init__(self) -> None:
        if self.kind != "weigher":
            raise JournalError(f"a WeigherSource's kind is 'weigher', not {self.kind!r}")
        _check_literal(self.horizon, HORIZONS, "horizon")


DecisionSource = ScannerSource | WeigherSource


def source_key(source: DecisionSource) -> str:
    """Stable text key for a source, half of every decision id. A sleeve, when present, is part of
    the identity: the same contract from the same scanner on two tenors is two decisions."""
    if isinstance(source, WeigherSource):
        return f"weigher:{source.horizon}"
    return f"scanner:{source.scanner}@{source.sleeve}" if source.sleeve else f"scanner:{source.scanner}"


def decision_id(contract: ContractId, source: DecisionSource, decided_at_iso: str) -> str:
    """Journal-unique: same contract, same source, same instant is one decision; a re-emit on a
    later scan is a new one."""
    return f"{contract.occ}|{source_key(source)}|{decided_at_iso}"


# ---- the records ----------------------------------------------------------------------------

@dataclass(frozen=True, kw_only=True)
class Marks:
    """What the market showed at the decision instant."""

    bid: float
    ask: float
    mid: float
    spot: float  # the underlying


@dataclass(frozen=True, kw_only=True)
class PlannedTarget:
    """One rung of the plan as PLANNED, premium space. Whether it was reached is the outcome's."""

    level: float
    target_premium: float
    expected_pct: float


@dataclass(frozen=True, kw_only=True)
class Invalidation:
    """The level that kills the thesis, on the UNDERLYING: the BUFFERED threshold fixed at entry
    (partner ruling 5), and which way through it means dead."""

    price: float
    side: Side
    rule: CloseRule

    def __post_init__(self) -> None:
        _check_literal(self.side, SIDES, "invalidation.side")
        _check_literal(self.rule, CLOSE_RULES, "invalidation.rule")


@dataclass(frozen=True, kw_only=True)
class DecisionEvent:
    """The choice, recorded the instant it was made. Append-only."""

    id: str  # `{occ}|{source_key}|{decided_at}`
    engine_version: str
    decided_at: str  # ISO instant: the wall clock live, the pinned engine clock in a replay
    source: DecisionSource
    contract: ContractId
    marks: Marks
    score: float  # the composite at decision time (the utility percentile once the top layer lands)
    verdict: Verdict  # WATCH is written for EVERY scored candidate, below the floor too (spec 26)
    targets: list[PlannedTarget]
    invalidation: Invalidation
    sessions_to_expiry: int  # trading sessions of runway at decision time
    feature_snapshot_id: str

    def __post_init__(self) -> None:
        _check_literal(self.verdict, VERDICTS, "verdict")
        _check_instant(self.decided_at, "decidedAt")
        want = decision_id(self.contract, self.source, self.decided_at)
        if self.id != want:
            raise JournalError(f"decision id {self.id!r} is not the built identity {want!r}")
        if self.sessions_to_expiry < 0:
            raise JournalError("sessionsToExpiry cannot be negative")


@dataclass(frozen=True, kw_only=True)
class GexLevels:
    """The dealer-positioning levels the engine saw."""

    call_wall: float
    put_wall: float
    flip: float
    supreme: float
    net_gex: float


@dataclass(frozen=True, kw_only=True)
class DarkPoolRead:
    posture: float  # -100 (distributing) .. +100 (accumulating); an association, never a confirmation

    def __post_init__(self) -> None:
        if not -100 <= self.posture <= 100:
            raise JournalError(f"darkPool.posture {self.posture} is outside -100..100")


@dataclass(frozen=True, kw_only=True)
class NewsRead:
    lean: float  # -1 (bearish) .. +1 (bullish)
    volume: float  # how loud the tape was

    def __post_init__(self) -> None:
        if not -1 <= self.lean <= 1:
            raise JournalError(f"news.lean {self.lean} is outside -1..1")


@dataclass(frozen=True, kw_only=True)
class FactorScored:
    """One row of the factor board as scored: key, 0-100 score, the weight applied."""

    key: str
    score: float
    weight: float


@dataclass(frozen=True, kw_only=True)
class FeatureSnapshot:
    """
    What the engine SAW when it decided: the photograph that makes "why was that a
    bad choice" answerable later. Stored apart from the decision because outcomes
    join to decisions far more often than anyone re-reads the inputs.
    """

    id: str
    decided_at: str
    ticker: str
    provenance: FeatureProvenance
    data_version: str | None = None  # the pipeline that produced the inputs; inputs recalibrate too
    spot: float
    iv_rank: float
    base_iv_pct: float  # annualised base IV, percent
    rsi: float
    gex: GexLevels
    dark_pool: DarkPoolRead
    news: NewsRead
    factors: list[FactorScored]

    def __post_init__(self) -> None:
        _check_literal(self.provenance, PROVENANCES, "provenance")
        _check_instant(self.decided_at, "decidedAt")


def assert_evaluable(what: FeatureSnapshot | str) -> None:
    """The evaluation layer's refusal: SIM is never market truth."""
    provenance = what.provenance if isinstance(what, FeatureSnapshot) else what
    if provenance not in EVALUABLE_PROVENANCES:
        raise ProvenanceError(f"provenance {provenance!r} cannot be evaluated as market truth")


def gex_levels_from_profile(profile) -> GexLevels:
    """The snapshot's levels straight off an ExposureProfile (exposure.build_exposure_profile)."""
    lv = profile.levels
    return GexLevels(call_wall=lv.call_wall, put_wall=lv.put_wall, flip=lv.flip, supreme=lv.supreme, net_gex=profile.net_gex)


@dataclass(frozen=True, kw_only=True)
class TargetCross:
    """A real crossing of a planned target: a timestamped market fact."""

    level: float
    at: str
    mark: float  # premium at the crossing

    def __post_init__(self) -> None:
        _check_instant(self.at, "targetsHit[].at")


@dataclass(frozen=True, kw_only=True)
class Exit:
    reason: ExitReason
    at: str
    mark: float

    def __post_init__(self) -> None:
        _check_literal(self.reason, EXIT_REASONS, "exit.reason")
        _check_instant(self.at, "exit.at")


@dataclass(frozen=True, kw_only=True)
class PathStats:
    """Over the whole life, premium space: the best mark, then MFE and MAE as % of entry mid."""

    high_water: float
    max_favorable_pct: float
    max_adverse_pct: float


@dataclass(frozen=True, kw_only=True)
class PnlHorizon:
    sessions: int
    pct: float


@dataclass(frozen=True, kw_only=True)
class Pnl:
    """P&L as % of entry mid: at exit, plus fixed horizons for calibration."""

    at_exit_pct: float
    horizons: list[PnlHorizon]


@dataclass(frozen=True, kw_only=True)
class OutcomeEvent:
    """
    How it ended. ONE terminal outcome per decision, written when the campaign
    resolves; every number derived from real market data after the decision,
    nothing copied forward from its hopes. `targets_hit` holds a level iff price
    actually reached it, in rung order.
    """

    decision_id: str
    resolved_at: str
    exit: Exit
    targets_hit: list[TargetCross]
    path: PathStats
    pnl: Pnl
    sessions_held: int

    def __post_init__(self) -> None:
        _check_instant(self.resolved_at, "resolvedAt")
        if self.sessions_held < 0:
            raise JournalError("sessionsHeld cannot be negative")


# ---- evaluation -> recalibration --------------------------------------------------------------

@dataclass(frozen=True, kw_only=True)
class CalibrationBucket:
    """One score band's real-world performance: the calibration curve's point."""

    score_min: float
    score_max: float
    samples: int
    tp1_hit_rate: float  # share of the band whose first target was actually crossed
    avg_pnl_pct: float


@dataclass(frozen=True, kw_only=True)
class FactorAttribution:
    """Which factor lied, tallied over misses: mean score across losers minus across winners."""

    factor_key: str
    miss_bias: float
    samples: int


@dataclass(frozen=True, kw_only=True)
class Window:
    from_: str  # YYYY-MM-DD
    to: str

    def __post_init__(self) -> None:
        _check_day(self.from_, "window.from")
        _check_day(self.to, "window.to")


@dataclass(frozen=True, kw_only=True)
class EvaluationRun:
    """One evaluation pass over a window of resolved decisions, per source."""

    id: str
    ran_at: str
    engine_version: str
    source: DecisionSource
    window: Window
    samples: int
    target_hit_rates: list[float]  # per rung, rung order
    expectancy_r: float  # mean R multiple, risk = entry to invalidation
    calibration: list[CalibrationBucket]
    attribution: list[FactorAttribution]

    def __post_init__(self) -> None:
        _check_instant(self.ran_at, "ranAt")


@dataclass(frozen=True, kw_only=True)
class WeightsRevision:
    """
    A deliberate weights change: the ONLY way scoring parameters move. Versioned,
    justified by an evaluation, activated at a known instant, so any decision can
    be replayed under the exact weights that scored it.
    """

    engine_version: str
    previous_version: str
    horizon: Horizon
    weights: dict[str, float]  # factor key -> new weight
    based_on_evaluation_id: str
    activated_at: str
    note: str

    def __post_init__(self) -> None:
        _check_literal(self.horizon, HORIZONS, "horizon")
        _check_instant(self.activated_at, "activatedAt")
        if self.engine_version == self.previous_version:
            raise JournalError("a revision must move the engine version: weights never change silently")


# ---- the wire: camelCase JSON, the TypeScript seam's field names --------------------------------

def _camel(name: str) -> str:
    name = name.rstrip("_")  # from_ -> from
    head, *rest = name.split("_")
    return head + "".join(p[:1].upper() + p[1:] for p in rest)


def _is_union(hint: Any) -> bool:
    return get_origin(hint) in (Union, types.UnionType)


def _allows_none(hint: Any) -> bool:
    return _is_union(hint) and type(None) in get_args(hint)


def to_wire(obj: Any) -> Any:
    """A record (or a list, dict or scalar of them) as the JSON the seam carries."""
    if is_dataclass(obj) and not isinstance(obj, type):
        hints = get_type_hints(type(obj))
        out: dict[str, Any] = {}
        for f in fields(obj):
            v = getattr(obj, f.name)
            if v is None:
                if _allows_none(hints[f.name]):
                    continue
                raise WireError(f"{type(obj).__name__}.{f.name} is None but the seam requires it")
            out[_camel(f.name)] = to_wire(v)
        return out
    if isinstance(obj, (list, tuple)):
        return [to_wire(x) for x in obj]
    if isinstance(obj, dict):
        return {str(k): to_wire(v) for k, v in obj.items()}
    return obj


def from_wire(cls: Any, data: Any, path: str = "") -> Any:
    """A record from the seam's JSON. Strict: an unknown key, a missing required key or a wrong
    type is a WireError naming the path; every record's own checks then run."""
    if not (isinstance(cls, type) and is_dataclass(cls)):
        return _coerce(cls, data, path or "<root>")
    if not isinstance(data, Mapping):
        raise WireError(f"{path or cls.__name__}: expected an object, got {type(data).__name__}")
    hints = get_type_hints(cls)
    by_wire = {_camel(f.name): f for f in fields(cls) if f.init}
    unknown = set(data) - set(by_wire)
    if unknown:
        raise WireError(f"{path or cls.__name__}: unknown key(s) {sorted(unknown)}")
    kwargs: dict[str, Any] = {}
    for wire, f in by_wire.items():
        here = f"{path}.{wire}" if path else wire
        if wire not in data:
            if f.default is not MISSING or f.default_factory is not MISSING:  # type: ignore[misc]
                continue
            raise WireError(f"{here}: missing")
        kwargs[f.name] = _coerce(hints[f.name], data[wire], here)
    try:
        return cls(**kwargs)
    except JournalError:
        raise
    except (TypeError, ValueError) as e:
        raise WireError(f"{path or cls.__name__}: {e}") from e


def _coerce(hint: Any, value: Any, path: str) -> Any:
    origin = get_origin(hint)
    if _is_union(hint):
        members = [a for a in get_args(hint) if a is not type(None)]
        if value is None:
            if len(members) < len(get_args(hint)):
                return None
            raise WireError(f"{path}: null where the seam requires a value")
        if len(members) == 1:
            return _coerce(members[0], value, path)
        # a tagged union (DecisionSource): the member whose `kind` default matches
        if isinstance(value, Mapping):
            for m in members:
                if is_dataclass(m):
                    kind = next((f.default for f in fields(m) if f.name == "kind"), MISSING)
                    if kind is not MISSING and value.get("kind") == kind:
                        return from_wire(m, value, path)
        raise WireError(f"{path}: no member of {hint} matches {value!r}")
    if origin is Literal:
        if value not in get_args(hint):
            raise WireError(f"{path}: {value!r} is not one of {list(get_args(hint))}")
        return value
    if origin in (list, tuple):
        if not isinstance(value, list):
            raise WireError(f"{path}: expected a list, got {type(value).__name__}")
        (item,) = get_args(hint)
        return [_coerce(item, v, f"{path}[{i}]") for i, v in enumerate(value)]
    if origin is dict:
        if not isinstance(value, Mapping):
            raise WireError(f"{path}: expected an object, got {type(value).__name__}")
        _, vt = get_args(hint)
        return {str(k): _coerce(vt, v, f"{path}.{k}") for k, v in value.items()}
    if isinstance(hint, type) and is_dataclass(hint):
        return from_wire(hint, value, path)
    if hint is float:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise WireError(f"{path}: expected a number, got {type(value).__name__}")
        return float(value)
    if hint is int:
        if isinstance(value, bool) or not isinstance(value, (int, float)) or (isinstance(value, float) and not value.is_integer()):
            raise WireError(f"{path}: expected an integer, got {value!r}")
        return int(value)
    if hint is str:
        if not isinstance(value, str):
            raise WireError(f"{path}: expected a string, got {type(value).__name__}")
        return value
    if hint is bool:
        if not isinstance(value, bool):
            raise WireError(f"{path}: expected a boolean, got {type(value).__name__}")
        return value
    raise WireError(f"{path}: the seam has no rule for {hint}")
