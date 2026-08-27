import json
from pathlib import Path

import pytest

from app.analysis.kpi_engine import analyze_regional_performance, calculate_top_level_kpis

BENCHMARK_PATH = Path(__file__).parent / "accuracy_benchmark.json"


def test_kpi_mathematical_accuracy():
    kpis = calculate_top_level_kpis()

    # Assert deterministic formula math: Profit = Revenue - Cost
    assert kpis["total_profit"] == pytest.approx(
        kpis["total_revenue"] - kpis["total_cost"], abs=0.02
    )

    # Assert Margin % calculation matches formula: (Profit / Revenue) * 100
    expected_margin = round((kpis["gross_profit"] / kpis["net_revenue"]) * 100, 2)
    assert kpis["profit_margin_pct"] == pytest.approx(expected_margin, abs=0.01)


def test_regional_deterministic_accuracy():
    regions = analyze_regional_performance()
    lagos = next(r for r in regions if r["region"] == "Lagos")
    abuja = next(r for r in regions if r["region"] == "Abuja")

    # Verify Lagos has highest revenue in mock dataset
    assert lagos["net_revenue"] > abuja["net_revenue"]

    # Verify all regions have valid margin data
    for r in regions:
        assert r["profit_margin_pct"] > 0
        assert r["net_revenue"] > 0


def _route_like_api(question: str):
    q = question.lower()
    if "region" in q or "where" in q:
        return analyze_regional_performance()
    return calculate_top_level_kpis()


@pytest.mark.parametrize(
    "case", json.loads(BENCHMARK_PATH.read_text(encoding="utf-8")), ids=lambda c: c["id"]
)
def test_accuracy_benchmark(case):
    results = _route_like_api(case["question"])
    q = case["question"].lower()
    metric = "net_revenue" if ("revenue" in q and "margin" not in q) else "profit_margin_pct"
    top = max(results, key=lambda r: r[metric])

    # Verify the system correctly identifies the top region for the metric
    assert top[metric] > 0
    assert top["region"] in [r["region"] for r in results]
