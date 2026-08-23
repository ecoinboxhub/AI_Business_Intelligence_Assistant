"""Deterministic KPI engine — the ONLY place business math is executed.

All formulas follow docs/DATA_DICTIONARY.md and are computed with pure Pandas.
Returned values are JSON-safe Python primitives, rounded to 2 decimals.
"""
import pandas as pd

from app.analysis.common import fmt_naira, require_rows
from app.data.mock_dataset import ds


def calculate_top_level_kpis() -> dict:
    df: pd.DataFrame = ds("sales")
    require_rows(df, "sales")
    active = df[~df["is_returned"]]

    deliveries = ds("deliveries")
    delivery_delay_pct = float(deliveries["is_delayed"].mean()) * 100

    total_revenue = float(df["sales_amount"].sum())
    net_revenue = float(active["sales_amount"].sum())
    net_cogs = float(active["cost_amount"].sum())
    gross_profit = net_revenue - net_cogs
    total_cost = float(df["cost_amount"].sum())

    return {
        "total_orders": int(len(df)),
        "returned_orders": int(df["is_returned"].sum()),
        "total_revenue": round(total_revenue, 2),
        "total_cost": round(total_cost, 2),
        "total_profit": round(total_revenue - total_cost, 2),
        "net_revenue": round(net_revenue, 2),
        "net_cogs": round(net_cogs, 2),
        "gross_profit": round(gross_profit, 2),
        "profit_margin_pct": round(gross_profit / net_revenue * 100, 2),
        "return_rate_pct": round(float(df["is_returned"].mean()) * 100, 2),
        "delivery_delay_pct": round(delivery_delay_pct, 2),
        "average_order_value": round(net_revenue / len(active), 2),
        "target_attainment_pct": round(
            net_revenue / float(ds("targets")["revenue_target"].sum()) * 100, 2
        ),
    }


def analyze_regional_performance() -> dict:
    df: pd.DataFrame = ds("sales")
    require_rows(df, "sales")
    active = df[~df["is_returned"]]

    agg = active.groupby("region", observed=True).agg(
        net_revenue=("sales_amount", "sum"),
        net_cogs=("cost_amount", "sum"),
        orders=("order_id", "count"),
    )
    return_rates = df.groupby("region", observed=True)["is_returned"].mean() * 100

    agg["gross_profit"] = agg["net_revenue"] - agg["net_cogs"]
    agg["profit_margin_pct"] = agg["gross_profit"] / agg["net_revenue"] * 100
    agg["return_rate_pct"] = return_rates
    agg = agg.sort_values("gross_profit", ascending=False)

    breakdown = [
        {
            "region": region,
            "orders": int(row["orders"]),
            "net_revenue": round(float(row["net_revenue"]), 2),
            "net_cogs": round(float(row["net_cogs"]), 2),
            "gross_profit": round(float(row["gross_profit"]), 2),
            "profit_margin_pct": round(float(row["profit_margin_pct"]), 2),
            "return_rate_pct": round(float(row["return_rate_pct"]), 2),
        }
        for region, row in agg.iterrows()
    ]

    return breakdown


def generate_executive_insights() -> dict:
    """Proactive anomaly insights — computed from the live dataset, never static.

    Surfaces the weakest-margin region, dominant delay partner, worst return
    hotspot and below-target regions with matching recommendations.
    """
    df = ds("sales")
    require_rows(df, "sales")
    active = df[~df["is_returned"]].copy()
    active["gross_profit"] = active["sales_amount"] - active["cost_amount"]

    findings: list[str] = []
    recommendations: list[str] = []

    # 1. Margin laggard by region
    reg = active.groupby("region", observed=True).agg(
        revenue=("sales_amount", "sum"), profit=("gross_profit", "sum")
    )
    if len(reg) >= 2:
        reg["margin_pct"] = reg["profit"] / reg["revenue"] * 100
        weakest = reg.sort_values("margin_pct").index[0]
        best = reg.sort_values("margin_pct", ascending=False).index[0]
        gap = float(reg.loc[best, "margin_pct"] - reg.loc[weakest, "margin_pct"])
        findings.append(
            f"{weakest} runs the thinnest regional margin at "
            f"{reg.loc[weakest, 'margin_pct']:.1f}% — {gap:.1f} pp behind {best}."
        )
        recommendations.append(
            f"Rebalance {weakest}'s product mix toward the categories driving {best}'s margin."
        )

    # 2. Delivery delay concentration
    deliveries = ds("deliveries")
    require_rows(deliveries, "deliveries")
    delay_share = deliveries.groupby("partner_name", observed=True)["is_delayed"].mean() * 100
    top_delay_partner = delay_share.idxmax()
    network_delay = float(deliveries["is_delayed"].mean()) * 100
    findings.append(
        f"{top_delay_partner} is the most delayed logistics partner at "
        f"{delay_share.max():.1f}% vs a {network_delay:.1f}% network average."
    )
    recommendations.append(
        f"Audit {top_delay_partner} SLA compliance and shift volume toward on-time partners."
    )

    # 3. Return hotspot
    ret = df.groupby("product_id", observed=True)["is_returned"].mean() * 100
    worst_product = ret.idxmax()
    mean_rate = float(ret.mean())
    findings.append(
        f"{worst_product} returns at {ret.max():.1f}% against a company mean of {mean_rate:.1f}%."
    )
    if ret.max() > mean_rate * 1.5:
        recommendations.append(
            f"Open a listing/spec audit for {worst_product} — its return rate breaches the 1.5× anomaly line."
        )

    # 4. Target attainment
    t = ds("targets")
    require_rows(t, "targets")
    attainment = float(active["sales_amount"].sum()) / float(t["revenue_target"].sum()) * 100
    month_region = active.copy()
    month_region["month"] = month_region["date"].dt.to_period("M").astype(str)
    actual = (
        month_region.groupby(["month", "region"], observed=True)["sales_amount"]
        .sum()
        .groupby("region", observed=True)
        .sum()
    )
    target_by_region = t.groupby("region")["revenue_target"].sum()
    joined = pd.concat([actual.rename("actual"), target_by_region.rename("target")], axis=1).dropna()
    below = sorted(joined[joined["actual"] < joined["target"]].index.tolist())
    findings.append(
        f"Cumulative net revenue sits at {attainment:.1f}% of plan; "
        + (f"{len(below)} region(s) are behind: {', '.join(map(str, below))}." if below else "every region is at or above plan.")
    )
    if below:
        recommendations.append(
            f"Build month-by-month recovery plans for {', '.join(map(str, below))}, starting with stock availability."
        )
    else:
        recommendations.append("Raise next-cycle targets to keep stretch pressure now that all regions are above plan.")

    return {"findings": findings, "recommendations": recommendations}
