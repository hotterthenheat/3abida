"""
PARITY WITH THE JOURNAL SEAM. scripts/journal-ref.ts writes
tests/fixtures/journal_ref.json: the identities built by src/core/journal.ts,
the literal sets enumerated through the TypeScript types, and one typed sample
of every record shape. Every identity here must match exactly, every literal
set must be the same set, and every sample must round-trip through the wire
unchanged - then the door's strictness and the records' own rules are tried.
"""

import copy
import json
from pathlib import Path

import numpy as np
import pytest

from slayer_core.exposure import FRONT_T, build_exposure_profile, chain_exposures
from slayer_core.journal import (
    CLOSE_RULES,
    ENGINE_VERSION,
    EXIT_REASONS,
    HORIZONS,
    INSTRUMENTS,
    PROVENANCES,
    RIGHTS,
    SCANNER_KEYS,
    SIDES,
    SLEEVE_KEYS,
    VERDICTS,
    ContractId,
    DecisionEvent,
    DecisionSource,
    EvaluationRun,
    FeatureSnapshot,
    JournalError,
    OutcomeEvent,
    ProvenanceError,
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

REF = Path(__file__).parent / "fixtures" / "journal_ref.json"

SHAPES = {
    "snapshot": FeatureSnapshot,
    "snapshotLive": FeatureSnapshot,
    "snapshotSim": FeatureSnapshot,
    "decision": DecisionEvent,
    "watch": DecisionEvent,
    "stockDecision": DecisionEvent,
    "outcome": OutcomeEvent,
    "evaluation": EvaluationRun,
    "revision": WeightsRevision,
}


@pytest.fixture(scope="module")
def ref():
    if not REF.exists():
        pytest.skip("run `npx tsx scripts/journal-ref.ts` first to write the reference")
    return json.loads(REF.read_text())


# ---- the sets and the stamp ----------------------------------------------------------------

def test_literal_sets_match_typescript(ref):
    lit = ref["literals"]
    assert INSTRUMENTS == set(lit["instruments"])
    assert RIGHTS == set(lit["rights"])
    assert SCANNER_KEYS == set(lit["scanners"])
    assert SLEEVE_KEYS == set(lit["sleeves"])
    assert HORIZONS == set(lit["horizons"])
    assert VERDICTS == set(lit["verdicts"])
    assert CLOSE_RULES == set(lit["closeRules"])
    assert SIDES == set(lit["sides"])
    assert EXIT_REASONS == set(lit["exitReasons"])
    assert PROVENANCES == set(lit["provenances"])


def test_engine_version_matches_typescript(ref):
    assert ENGINE_VERSION == ref["engineVersion"], "bump both copies together"


# ---- the identities ------------------------------------------------------------------------

def test_occ_symbols_and_option_ids_match(ref):
    for c in ref["occ"]:
        assert occ_symbol(c["ticker"], c["expiry"], c["right"], c["strike"]) == c["occ"], c
        assert to_wire(option_contract_id(c["ticker"], c["expiry"], c["right"], c["strike"])) == c["contract"], c


def test_stock_and_future_ids_match(ref):
    assert to_wire(stock_contract_id("spy")) == ref["ids"]["stock"]
    assert to_wire(future_contract_id("tsla", "2026-12-18")) == ref["ids"]["future"]


def test_source_keys_match(ref):
    for row in ref["sourceKeys"]:
        assert source_key(from_wire(DecisionSource, row["source"])) == row["key"], row


def test_decision_ids_match(ref):
    for row in ref["decisionIds"]:
        got = decision_id(from_wire(ContractId, row["contract"]), from_wire(DecisionSource, row["source"]), row["decidedAt"])
        assert got == row["id"], row


# ---- the shapes, through the door and back --------------------------------------------------

def test_every_sample_round_trips(ref):
    for name, cls in SHAPES.items():
        sample = ref["samples"][name]
        record = from_wire(cls, sample)
        assert to_wire(record) == sample, name


def test_absent_optionals_stay_absent(ref):
    live = from_wire(FeatureSnapshot, ref["samples"]["snapshotLive"])
    assert live.data_version is None
    assert "dataVersion" not in to_wire(live)
    watch = from_wire(DecisionEvent, ref["samples"]["watch"])
    assert watch.source.kind == "weigher"


def test_the_door_is_strict(ref):
    sample = ref["samples"]["decision"]
    renamed = copy.deepcopy(sample)
    renamed["decided_at"] = renamed.pop("decidedAt")
    with pytest.raises(WireError):
        from_wire(DecisionEvent, renamed)
    extra = copy.deepcopy(sample)
    extra["marks"]["last"] = 3.16
    with pytest.raises(WireError, match="marks"):
        from_wire(DecisionEvent, extra)
    missing = copy.deepcopy(sample)
    del missing["targets"]
    with pytest.raises(WireError, match="targets"):
        from_wire(DecisionEvent, missing)
    wrong_type = copy.deepcopy(sample)
    wrong_type["sessionsToExpiry"] = 2.5
    with pytest.raises(WireError, match="sessionsToExpiry"):
        from_wire(DecisionEvent, wrong_type)
    bad_literal = copy.deepcopy(sample)
    bad_literal["verdict"] = "BUY"
    with pytest.raises(JournalError):
        from_wire(DecisionEvent, bad_literal)
    bad_kind = copy.deepcopy(sample)
    bad_kind["source"] = {"kind": "board", "scanner": "all"}
    with pytest.raises(WireError, match="source"):
        from_wire(DecisionEvent, bad_kind)


def test_records_are_frozen(ref):
    d = from_wire(DecisionEvent, ref["samples"]["decision"])
    with pytest.raises(Exception):
        d.score = 99  # type: ignore[misc]


def test_identities_are_built_never_typed(ref):
    sample = ref["samples"]["decision"]
    tampered = copy.deepcopy(sample)
    tampered["id"] = tampered["id"].replace("weekly", "swing")
    with pytest.raises(JournalError, match="decision id"):
        from_wire(DecisionEvent, tampered)
    padded_wrong = copy.deepcopy(sample)
    padded_wrong["contract"]["occ"] = "SPY 260731C500000"
    with pytest.raises(JournalError, match="occ"):
        from_wire(DecisionEvent, padded_wrong)
    with pytest.raises(JournalError):
        ContractId(instrument="STOCK", ticker="spy", occ="spy")
    with pytest.raises(JournalError):
        ContractId(instrument="OPTION", ticker="SPY", occ="SPY   260731C00500000")


def test_instants_carry_a_zone(ref):
    naive = copy.deepcopy(ref["samples"]["outcome"])
    naive["resolvedAt"] = "2026-07-31T20:00:00"
    with pytest.raises(JournalError, match="zone"):
        from_wire(OutcomeEvent, naive)


def test_sim_is_never_evaluated(ref):
    assert_evaluable(from_wire(FeatureSnapshot, ref["samples"]["snapshot"]))
    assert_evaluable(from_wire(FeatureSnapshot, ref["samples"]["snapshotLive"]))
    with pytest.raises(ProvenanceError):
        assert_evaluable(from_wire(FeatureSnapshot, ref["samples"]["snapshotSim"]))


def test_a_revision_must_move_the_version(ref):
    still = copy.deepcopy(ref["samples"]["revision"])
    still["engineVersion"] = still["previousVersion"]
    with pytest.raises(JournalError, match="silently"):
        from_wire(WeightsRevision, still)


def test_snapshot_levels_come_off_the_profile():
    strikes = np.arange(90.0, 111.0)
    chain = chain_exposures(100.0, strikes, np.full(21, 1000.0), np.full(21, 1200.0), FRONT_T, 0.2)
    profile = build_exposure_profile(chain, 100.0, 10)
    levels = gex_levels_from_profile(profile)
    assert (levels.call_wall, levels.put_wall, levels.flip, levels.supreme) == (
        profile.levels.call_wall,
        profile.levels.put_wall,
        profile.levels.flip,
        profile.levels.supreme,
    )
    assert levels.net_gex == profile.net_gex
    assert set(to_wire(levels)) == {"callWall", "putWall", "flip", "supreme", "netGex"}
