"""Tests for the DuckDB engine, risk scoring, what-if simulation and SSE stream."""
import json

import pytest
from fastapi.testclient import TestClient

from app.analysis import whatif
from app.analysis.duckdb_engine import (
    execute_spec,
    init_duckdb_tables,
    run_fast_query,
    validate_spec,
)
from app.analysis.risk_scoring import score_analysis, urgency_for
from app.main import INTENT_REGISTRY, app

client = TestClient(app)


# ---------------------------------------------------------------------------
# DuckDB engine
# ---------------------------------------------------------------------------

def test_top_regions_matches_pandas_math():
    rows = run_fast_query("top_regions")
    assert len(rows) == 5
    revenues = [r["revenue"] for r in rows]
    assert revenues == sorted(revenues, reverse=True)
    for r in rows:
        assert r["margin_pct"] == pytest.approx(r["profit"] / r["revenue"] * 100, abs=0.01)


def test_duckdb_kpis_agree_with_pandas_engine():
    from app.analysis.kpi_engine import calculate_top_level_kpis

    duck = run_fast_query("kpis")[0]
    pandas = calculate_top_level_kpis()
    assert duck["net_revenue"] == pytest.approx(pandas["net_revenue"], abs=1.0)
    assert duck["gross_profit"] == pytest.approx(pandas["gross_profit"], abs=1.0)
    assert duck["return_rate_pct"] == pytest.approx(pandas["return_rate_pct"], abs=0.01)


def test_high_returns_threshold_semantics():
    rows = run_fast_query("high_returns")
    # Ground truth: products whose rate exceeds 1.5x the company mean.
    all_rows = execute_spec({"table": "sales", "metric": "return_rate_pct",
                             "group_by": "product_id", "order": "desc", "limit": 50})
    mean = sum(r["return_rate_pct"] for r in all_rows) / len(all_rows)
    expected = [r["product_id"] for r in all_rows if r["return_rate_pct"] > mean * 1.5]
    assert [r["product_name"] for r in rows] == expected
    rates = [r["return_rate_pct"] for r in rows]
    assert rates == sorted(rates, reverse=True)


def test_named_query_unknown_key_returns_empty():
    assert run_fast_query("does_not_exist") == []


def test_validate_spec_rejects_free_form_tokens():
    with pytest.raises(ValueError):
        validate_spec({"table": "sales; DROP TABLE sales", "metric": "revenue", "group_by": "region"})
    with pytest.raises(ValueError):
        validate_spec({"table": "sales", "metric": "credit_card", "group_by": "region"})
    with pytest.raises(ValueError):
        validate_spec({"table": "sales", "metric": "revenue", "group_by": "password"})
    clean = validate_spec({"table": "sales", "metric": "revenue", "group_by": "region",
                           "order": "desc", "limit": 3})
    assert clean["limit"] == 3


def test_execute_spec_runs_allowlisted_query():
    rows = execute_spec({"table": "sales", "metric": "profit", "group_by": "category",
                         "order": "desc", "limit": 5})
    assert 0 < len(rows) <= 5
    assert {"category", "profit"} <= set(rows[0])
    profits = [r["profit"] for r in rows]
    assert profits == sorted(profits, reverse=True)


def test_execute_spec_supports_filters_and_virtual_month():
    rows = execute_spec({"table": "sales", "metric": "revenue", "group_by": "region",
                         "filters": {"month": "2026-07"}, "limit": 10})
    assert rows, "expected revenue rows for 2026-07"
    assert {"region", "revenue"} <= set(rows[0])


# ---------------------------------------------------------------------------
# Risk scoring & what-if
# ---------------------------------------------------------------------------

def test_urgency_bands_are_monotonic():
    assert urgency_for(10) == "MONITOR"
    assert urgency_for(40) == "STANDARD"
    assert urgency_for(65) == "HIGH_PRIORITY"
    assert urgency_for(95) == "CRITICAL"


def test_severity_is_deterministic_and_bounded():
    facts = {"worst_attainment_pct": 55.0, "below_target_regions": ["A", "B", "C"]}
    s1 = score_analysis("target_attainment", facts)
    s2 = score_analysis("target_attainment", facts)
    assert s1 == s2
    assert 0 <= s1["severity_score"] <= 100
    assert s1["action_urgency"] in {"MONITOR", "STANDARD", "HIGH_PRIORITY", "CRITICAL"}


def test_worse_facts_produce_higher_severity():
    mild = score_analysis("delivery_partners", {"worst_delay_pct": 12.0, "company_delay_pct": 11.9})
    severe = score_analysis("delivery_partners", {"worst_delay_pct": 40.0, "company_delay_pct": 12.0})
    assert severe["severity_score"] > mild["severity_score"]


def test_scenarios_attached_to_every_intent():
    for entry in INTENT_REGISTRY:
        cards = whatif.scenarios_for(entry["id"])
        assert cards, f"no what-if scenarios for {entry['id']}"
        for card in cards:
            assert {"lever", "question", "impact", "basis"} <= set(card)


# ---------------------------------------------------------------------------
# /api/simulate
# ---------------------------------------------------------------------------

def test_simulate_reduce_returns_monotonic():
    r = client.post("/api/simulate", json={"scenario": "reduce_returns", "pct": 50})
    assert r.status_code == 200
    d = r.json()
    assert d["projected"]["return_rate_pct"] < d["baseline"]["return_rate_pct"]
    assert d["delta"]["revenue_preserved_naira"] > 0


def test_simulate_unknown_scenario_422():
    r = client.post("/api/simulate", json={"scenario": "make_money_fast", "pct": 100})
    assert r.status_code == 422


@pytest.mark.parametrize("scenario", [
    "reduce_delivery_delays", "reduce_returns", "close_target_gap", "shift_campaign_spend",
])
def test_all_scenarios_serve(scenario):
    r = client.post("/api/simulate", json={"scenario": scenario, "pct": 15})
    assert r.status_code == 200
    assert "impact" in r.json() and "basis" in r.json()


# ---------------------------------------------------------------------------
# /api/questions/stream (SSE) + non-breaking contract
# ---------------------------------------------------------------------------

def _parse_sse_events(text: str):
    events = []
    for block in text.split("\n\n"):
        block = block.strip()
        if block.startswith("data: "):
            events.append(json.loads(block[len("data: "):]))
    return events


def test_stream_endpoint_emits_progress_then_complete_envelope():
    with client.stream("POST", "/api/questions/stream",
                       json={"question": "Which marketing campaigns generate the best return on investment?"}) as r:
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/event-stream")
        body = "".join(chunk for chunk in r.iter_text())
    events = _parse_sse_events(body)
    statuses = [e["status"] for e in events]
    assert statuses[0].startswith("Calculating metrics via DuckDB")
    assert any("metric_data" in e for e in events), "expected a metric_data preview event"
    final = events[-1]
    assert final["status"] == "complete"
    result = final["result"]
    for key in ("question", "answer", "findings", "recommendations",
                "follow_up_questions", "chart"):
        assert key in result, f"stream result dropped legacy key '{key}'"
    assert result["category"] == "campaign_roi"
    assert 0 <= result["severity_score"] <= 100
    assert result["what_if"]


def test_stream_unknown_question_still_completes():
    with client.stream("POST", "/api/questions/stream",
                       json={"question": "zzz gibberish qqq"}) as r:
        body = "".join(chunk for chunk in r.iter_text())
    events = _parse_sse_events(body)
    assert events[-1]["status"] == "complete"
    assert events[-1]["result"]["confidence"] == "medium"


def test_standard_questions_payload_gains_new_fields_without_breaking():
    r = client.post("/api/questions", json={"question": INTENT_REGISTRY[5]["label"]})
    assert r.status_code == 200
    d = r.json()
    for key in ("question", "answer", "findings", "recommendations", "follow_up_questions"):
        assert key in d
    assert isinstance(d["severity_score"], int)
    assert d["engine"] == "duckdb+pandas"
    assert d["what_if"]
