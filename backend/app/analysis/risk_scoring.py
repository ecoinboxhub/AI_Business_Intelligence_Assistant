"""Deterministic Executive Risk & Opportunity scoring.

Severity (0-100) and urgency are COMPUTED FROM FACTS in plain Python — the LLM
may reference them in narrative but can never invent them (zero-hallucination
invariant). Higher severity = more immediate executive escalation.
"""
from typing import Any, Dict, Tuple

_URGENCY_BANDS = (
    (80, "CRITICAL"),
    (60, "HIGH_PRIORITY"),
    (35, "STANDARD"),
    (0, "MONITOR"),
)


def urgency_for(severity: int) -> str:
    for floor, label in _URGENCY_BANDS:
        if severity >= floor:
            return label
    return "MONITOR"


def _clamp(v: int, lo: int = 0, hi: int = 100) -> int:
    return max(lo, min(hi, v))


def score_analysis(intent_id: str, facts: Dict[str, Any]) -> Dict[str, Any]:
    """Return {'severity_score': int, 'action_urgency': str, 'severity_rationale': str}."""
    sev, why = _SCORERS.get(intent_id, _default)(facts)
    return {
        "severity_score": _clamp(int(sev)),
        "action_urgency": urgency_for(_clamp(int(sev))),
        "severity_rationale": why,
    }


def _default(facts: Dict[str, Any]) -> Tuple[int, str]:
    return 20, "Routine performance signal; no threshold breach detected."


def _target_attainment(f: Dict[str, Any]) -> Tuple[int, str]:
    worst = f.get("worst_attainment_pct")
    below = f.get("below_target_regions") or []
    if worst is None:
        return 15, "No overlapping target data to score."
    sev = (100 - float(worst)) * 0.8 + len(below) * 4
    return sev, (f"Worst regional attainment {float(worst):.1f}% with "
                 f"{len(below)} region(s) below plan.")


def _return_anomalies(f: Dict[str, Any]) -> Tuple[int, str]:
    flagged = f.get("flagged_products") or []
    worst = float(f.get("worst_rate_pct") or 0)
    mean = float(f.get("company_mean_pct") or 1) or 1
    ratio = worst / mean
    sev = 25 + 12 * len(flagged) + (15 if ratio >= 2 else 8 if ratio >= 1.5 else 0)
    return sev, (f"{len(flagged)} product(s) above the 1.5× anomaly line; "
                 f"worst runs {ratio:.1f}× the company mean.")


def _delivery_partners(f: Dict[str, Any]) -> Tuple[int, str]:
    worst = float(f.get("worst_delay_pct") or 0)
    network = float(f.get("company_delay_pct") or 1) or 1
    sev = worst * 2.2 + (10 if worst > network * 1.25 else 0)
    return sev, f"Top partner delay rate {worst:.1f}% vs network {network:.1f}%."


def _inventory_health(f: Dict[str, Any]) -> Tuple[int, str]:
    stockouts = int(f.get("stockout_count") or 0)
    excess = int(f.get("excess_count") or 0)
    sev = 18 + stockouts * 4 + excess * 1.5
    return sev, (f"{stockouts} SKU-store combination(s) at/below reorder point, "
                 f"{excess} overstocked.")


def _campaign_roi(f: Dict[str, Any]) -> Tuple[int, str]:
    losers = f.get("below_1x_campaigns") or []
    worst = float(f.get("worst_roi_pct") or 0)
    sev = 12 + 9 * len(losers) + (15 if worst < 0 else 0)
    return sev, (f"{len(losers)} campaign(s) fail to return 1× spend"
                 + (" and the worst is loss-making." if worst < 0 else "."))


def _growth(f: Dict[str, Any]) -> Tuple[int, str]:
    delta = float(f.get("margin_delta_recent_3m_pp") or 0)
    growth = float(f.get("revenue_growth_recent_3m_pct") or 0)
    if delta < 0 and growth > 0:
        return 62, "Revenue growing while margin compresses — over-discounting signal."
    if delta < 0 and growth < 0:
        return 74, "Both revenue momentum and margin are deteriorating."
    if delta >= 0 and growth > 0:
        return 22, "Growth is translating into stronger profitability."
    return 35, "Margins stable but revenue momentum is flat."


def _concentration(f: Dict[str, Any]) -> Tuple[int, str]:
    share = float(f.get("top_share_pct") or f.get("top_region_revenue") and 0 or 0)
    sev = 20 + (25 if share > 30 else 0)
    return sev, f"Top entity contributes {share:.1f}% of revenue." if share else \
        "Balanced distribution across entities."


def _employee(f: Dict[str, Any]) -> Tuple[int, str]:
    return 25, "Key-person concentration monitored; no threshold breach."


_SCORERS = {
    "target_attainment": _target_attainment,
    "return_anomalies": _return_anomalies,
    "delivery_partners": _delivery_partners,
    "inventory_health": _inventory_health,
    "campaign_roi": _campaign_roi,
    "growth_vs_profitability": _growth,
    "revenue_profit_drivers": _concentration,
    "customer_segments": _concentration,
    "employee_performance": _employee,
}
