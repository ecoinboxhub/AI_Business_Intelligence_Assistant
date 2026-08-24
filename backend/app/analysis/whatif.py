"""Proactive 'What-If' scenario simulation — deterministic, data-grounded.

Every scenario quantifies a hypothetical management lever in naira using the
live dataset, converting passive reporting into decision support. The LLM may
narrate these but never computes them.
"""
from typing import Any, Dict, List

from app.data.mock_dataset import ds


def _fmt(x: float) -> str:
    ax = abs(x)
    sign = "-" if x < 0 else ""
    if ax >= 1e9:
        return f"{sign}₦{ax / 1e9:.1f}B"
    if ax >= 1e6:
        return f"{sign}₦{ax / 1e6:.1f}M"
    if ax >= 1e3:
        return f"{sign}₦{ax / 1e3:.0f}K"
    return f"{sign}₦{ax:,.0f}"


def _delivery_scenarios() -> List[Dict[str, Any]]:
    d = ds("deliveries")
    delayed = int(d["is_delayed"].sum())
    sales = ds("sales")
    active = sales[~sales["is_returned"]]
    aov = float(active["sales_amount"].sum()) / max(len(active), 1)
    exposure = delayed * 0.15 * aov
    return [{
        "lever": "Reduce delivery delays by 15%",
        "question": "What if we cut delivery delays by 15% this quarter?",
        "impact": f"{_fmt(exposure)} of refund/expedite exposure removed",
        "basis": f"{delayed:,} delayed deliveries × 15% × { _fmt(aov) } average order value",
    }]


def _returns_scenarios() -> List[Dict[str, Any]]:
    df = ds("sales")
    g = df.groupby("product_id", observed=True).agg(
        orders=("order_id", "count"),
        returned=("is_returned", "sum"),
        revenue=("sales_amount", "sum"),
    )
    g["rate"] = g["returned"] / g["orders"]
    mean = float(g["rate"].mean())
    hot = g[g["rate"] > mean * 1.5]
    preserved = float((hot["rate"] - mean).clip(lower=0).mul(hot["revenue"]).sum())
    return [{
        "lever": "Normalise flagged-SKU return rates to company mean",
        "question": "What if high-return products performed at the average return rate?",
        "impact": f"{_fmt(preserved)} of revenue preserved per cycle",
        "basis": f"{len(hot)} flagged SKU(s) above the 1.5× anomaly threshold",
    }]


def _target_scenarios() -> List[Dict[str, Any]]:
    sales = ds("sales")
    active = sales[~sales["is_returned"]].copy()
    active["month"] = active["date"].dt.to_period("M").astype(str)
    actual = active.groupby("region", observed=True)["sales_amount"].sum()
    targets = ds("targets").groupby("region")["revenue_target"].sum()
    joined = actual.to_frame("actual").join(targets.to_frame("target")).dropna()
    gap = float((joined["target"] - joined["actual"]).clip(lower=0).sum())
    return [{
        "lever": "Close the regional revenue gap to 100% of plan",
        "question": "What incremental revenue closes every region to 100% of target?",
        "impact": f"{_fmt(gap)} incremental net revenue required",
        "basis": f"{int((joined['actual'] < joined['target']).sum())} region(s) currently below plan",
    }]


def _campaign_scenarios() -> List[Dict[str, Any]]:
    c = ds("campaigns")
    c["roi_pct"] = (c["attributed_revenue"] - c["spend"]) / c["spend"] * 100
    best, worst = c.iloc[0], c.iloc[-1]
    gain = float(worst["spend"] * 0.5 * (best["roi_pct"] - worst["roi_pct"]) / 100)
    return [{
        "lever": "Shift 50% of weakest-campaign budget to the strongest",
        "question": f"What if half of '{worst['campaign_name']}' budget moved to '{best['campaign_name']}'?",
        "impact": f"{_fmt(gain)} incremental attributed revenue",
        "basis": f"ROI spread {best['roi_pct']:.0f}% vs {worst['roi_pct']:.0f}% on {_fmt(float(worst['spend']) * 0.5)} reallocated",
    }]


_SCENARIO_SOURCES = {
    "delivery_partners": _delivery_scenarios,
    "return_anomalies": _returns_scenarios,
    "target_attainment": _target_scenarios,
    "campaign_roi": _campaign_scenarios,
}

_DEFAULTS = _target_scenarios


def scenarios_for(intent_id: str, limit: int = 2) -> List[Dict[str, Any]]:
    """Deterministic what-if cards attached to every analysis payload."""
    source = _SCENARIO_SOURCES.get(intent_id, _DEFAULTS)
    return source()[:limit]


# ---------------------------------------------------------------------------
# /api/simulate — parametrised scenario engine
# ---------------------------------------------------------------------------

def simulate(scenario: str, pct: float = 15.0) -> Dict[str, Any]:
    """Project KPI impact of a management lever. pct is clamped to [1, 90]."""
    pct = max(1.0, min(90.0, float(pct)))
    sales = ds("sales")
    active = sales[~sales["is_returned"]]
    net_revenue = float(active["sales_amount"].sum())
    aov = net_revenue / max(len(active), 1)

    if scenario == "reduce_delivery_delays":
        d = ds("deliveries")
        base_rate = float(d["is_delayed"].mean()) * 100
        proj_rate = base_rate * (1 - pct / 100)
        recovered = int(round(len(d) * (base_rate - proj_rate) / 100))
        return {
            "scenario": "reduce_delivery_delays", "pct": pct,
            "baseline": {"delay_rate_pct": round(base_rate, 2),
                         "delayed_deliveries": int(d["is_delayed"].sum())},
            "projected": {"delay_rate_pct": round(proj_rate, 2),
                          "delayed_deliveries": int(d["is_delayed"].sum()) - recovered},
            "delta": {"on_time_deliveries_recovered": recovered,
                      "estimated_exposure_removed_naira": round(recovered * aov, 2)},
            "impact": f"{_fmt(recovered * aov)} of refund/expedite exposure removed",
            "basis": f"recovered deliveries × {_fmt(aov)} AOV",
        }

    if scenario == "reduce_returns":
        base_rate = float(sales["is_returned"].mean()) * 100
        proj_rate = base_rate * (1 - pct / 100)
        saved_orders = int(round(len(sales) * (base_rate - proj_rate) / 100))
        preserved = saved_orders * aov
        return {
            "scenario": "reduce_returns", "pct": pct,
            "baseline": {"return_rate_pct": round(base_rate, 2)},
            "projected": {"return_rate_pct": round(proj_rate, 2)},
            "delta": {"orders_saved_from_return": saved_orders,
                      "revenue_preserved_naira": round(preserved, 2)},
            "impact": f"{_fmt(preserved)} revenue preserved per cycle",
            "basis": f"saved orders × {_fmt(aov)} AOV",
        }

    if scenario == "close_target_gap":
        active2 = active.copy()
        active2["month"] = active2["date"].dt.to_period("M").astype(str)
        actual = active2.groupby("region", observed=True)["sales_amount"].sum()
        targets = ds("targets").groupby("region")["revenue_target"].sum()
        j = actual.to_frame("actual").join(targets.to_frame("target")).dropna()
        boosted = j["actual"] * (1 + pct / 100)
        gap_before = float((j["target"] - j["actual"]).clip(lower=0).sum())
        gap_after = float((j["target"] - boosted).clip(lower=0).sum())
        closed = int(((boosted >= j["target"]) & (j["actual"] < j["target"])).sum())
        return {
            "scenario": "close_target_gap", "pct": pct,
            "baseline": {"regions_below_plan": int((j["actual"] < j["target"]).sum()),
                         "revenue_gap_naira": round(gap_before, 2)},
            "projected": {"regions_below_plan": int((boosted < j["target"]).sum()),
                          "revenue_gap_naira": round(gap_after, 2)},
            "delta": {"regions_brought_to_plan": closed,
                      "gap_reduction_naira": round(gap_before - gap_after, 2)},
            "impact": f"{closed} region(s) brought to plan; gap cut by {_fmt(gap_before - gap_after)}",
            "basis": f"uniform +{pct:.0f}% regional sales uplift",
        }

    if scenario == "shift_campaign_spend":
        c = ds("campaigns")
        c = c.assign(roi_pct=(c["attributed_revenue"] - c["spend"]) / c["spend"] * 100)
        best, worst = c.iloc[0], c.iloc[-1]
        moved = float(worst["spend"]) * pct / 100
        gain = moved * (float(best["roi_pct"]) - float(worst["roi_pct"])) / 100
        return {
            "scenario": "shift_campaign_spend", "pct": pct,
            "baseline": {"worst_campaign": str(worst["campaign_name"]),
                         "worst_roi_pct": round(float(worst["roi_pct"]), 2),
                         "best_campaign": str(best["campaign_name"]),
                         "best_roi_pct": round(float(best["roi_pct"]), 2)},
            "projected": {"budget_moved_naira": round(moved, 2)},
            "delta": {"incremental_attributed_revenue_naira": round(gain, 2)},
            "impact": f"{_fmt(gain)} incremental attributed revenue",
            "basis": f"{pct:.0f}% of worst-campaign spend at the ROI spread",
        }

    raise ValueError(
        f"Unknown scenario '{scenario}'. Valid: reduce_delivery_delays, "
        "reduce_returns, close_target_gap, shift_campaign_spend"
    )
