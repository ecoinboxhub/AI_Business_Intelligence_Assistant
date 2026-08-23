"""Risk & operations analysis — pure Pandas, deterministic.

Functions: detect_return_anomalies, evaluate_delivery_partners,
evaluate_target_attainment.
"""
import pandas as pd

from app.analysis.common import fmt_naira, make_chart, require_rows, result
from app.data.mock_dataset import ds


def detect_return_anomalies() -> dict:
    df = ds("sales")

    g = (
        df.groupby("product_id", observed=True)
        .agg(orders=("order_id", "count"), returned=("is_returned", "sum"))
    )
    require_rows(g, "sales")
    g["return_rate_pct"] = g["returned"] / g["orders"] * 100
    threshold = float(g["return_rate_pct"].mean()) * 1.5
    g = g.sort_values("return_rate_pct", ascending=False)
    flagged = g[g["return_rate_pct"] > threshold]

    rows = [
        {"Product": str(idx), "Return Rate %": round(float(r["return_rate_pct"]), 2)}
        for idx, r in g.iterrows()
    ]
    worst = g.index[0]

    return result(
        label="Products with unusually high return rates",
        facts={
            "threshold_pct": round(threshold, 2),
            "flagged_products": [str(i) for i in flagged.index],
            "worst_product": worst,
            "worst_rate_pct": round(float(g.iloc[0]["return_rate_pct"]), 2),
            "company_mean_pct": round(float(g["return_rate_pct"].mean()), 2),
        },
        chart=make_chart("bar_threshold", "Product", ["Return Rate %"], rows,
                         threshold=round(threshold, 2)),
        metrics=[
            {"label": "Highest Return Rate", "value": f"{worst} · {g.iloc[0]['return_rate_pct']:.2f}%"},
            {"label": "Anomaly Threshold", "value": f">{threshold:.2f}% (1.5× mean)"},
            {"label": "Flagged Products", "value": f"{len(flagged)} of {len(g)}"},
        ],
        findings=[
            f"Observed Fact: {worst} returns at {g.iloc[0]['return_rate_pct']:.2f}% vs a company mean of {g['return_rate_pct'].mean():.2f}%.",
            f"Observed Fact: {len(flagged)} product(s) exceed the 1.5× anomaly threshold ({threshold:.2f}%).",
            "Interpretation: Elevated return clusters usually indicate sizing/spec mismatch or listing accuracy issues rather than random quality noise.",
        ],
        risks=["Unchecked return hotspots silently erode margin through reverse-logistics cost."],
        recommendations=[
            f"Audit {worst} listings, specs and packaging against the top return reasons this quarter.",
            "Add a pre-purchase clarification step (size guide / spec sheet) for every flagged SKU.",
            "Set a monthly review so any product crossing the threshold triggers a listing audit automatically.",
        ],
    )


def evaluate_delivery_partners() -> dict:
    d = ds("deliveries")
    require_rows(d, "deliveries")

    g = (
        d.groupby("partner_name", observed=True)
        .agg(volume=("delivery_id", "count"), delay_rate=("is_delayed", "mean"), avg_rating=("rating", "mean"))
    )
    require_rows(g, "deliveries")
    g["delay_rate_pct"] = g["delay_rate"] * 100
    g = g.sort_values("delay_rate_pct", ascending=False)

    worst = g.index[0]
    best_rated = g["avg_rating"].idxmax()
    bubbles = [
        {
            "Partner": str(idx),
            "Delay Rate %": round(float(r["delay_rate_pct"]), 2),
            "Avg Rating": round(float(r["avg_rating"]), 2),
            "Volume": int(r["volume"]),
        }
        for idx, r in g.iterrows()
    ]
    bars = [{"Partner": str(idx), "Delay Rate %": round(float(r["delay_rate_pct"]), 2)} for idx, r in g.iterrows()]

    return result(
        label="Delivery partner delays & customer ratings",
        facts={
            "worst_partner": worst,
            "worst_delay_pct": round(float(g.iloc[0]["delay_rate_pct"]), 2),
            "best_rated_partner": best_rated,
            "best_rating": round(float(g.loc[best_rated, "avg_rating"]), 2),
            "company_delay_pct": round(float(d["is_delayed"].mean() * 100), 2),
        },
        chart=make_chart("bubble", "Delay Rate %", ["Avg Rating"], bubbles),
        secondary_chart=make_chart("bar", "Partner", ["Delay Rate %"], bars),
        metrics=[
            {"label": "Most Delayed", "value": f"{worst} · {g.iloc[0]['delay_rate_pct']:.1f}%"},
            {"label": "Best Rated", "value": f"{best_rated} · {g.loc[best_rated, 'avg_rating']:.2f}★"},
            {"label": "Network Delay Rate", "value": f"{d['is_delayed'].mean() * 100:.1f}%"},
        ],
        findings=[
            f"Observed Fact: {worst} is the most delayed partner at {g.iloc[0]['delay_rate_pct']:.1f}% vs the network average of {d['is_delayed'].mean() * 100:.1f}%.",
            f"Observed Fact: {best_rated} holds the highest customer rating ({g.loc[best_rated, 'avg_rating']:.2f}/5).",
            f"Interpretation: {'Delayed partners also score lower — delay is the dominant driver of delivery dissatisfaction.' if g.iloc[0]['avg_rating'] == g['avg_rating'].min() else 'Ratings do not perfectly track delays; other service factors are at play.'}",
        ],
        risks=["Concentrating volume with high-delay partners compounds penalty costs and churn risk."],
        recommendations=[
            f"Shift at least 20% of {worst}'s volume to {best_rated} and re-measure within one month.",
            "Tie partner payout bonuses to a combined delay-rate + rating SLA scorecard.",
        ],
    )


def evaluate_target_attainment() -> dict:
    df = ds("sales")
    require_rows(df, "sales")
    active = df[~df["is_returned"]].copy()
    require_rows(active, "sales")
    active["month"] = active["date"].dt.to_period("M").astype(str)

    actual = active.groupby(["month", "region"], observed=True).agg(
        revenue=("sales_amount", "sum"), profit=("sales_amount", "sum")
    )
    # recompute profit properly on cost basis
    cost = active.groupby(["month", "region"], observed=True)["cost_amount"].sum()
    actual["profit"] = actual["revenue"] - cost
    actual = actual.reset_index()

    t = ds("targets")
    require_rows(t, "targets")
    merged = actual.merge(t, on=["month", "region"], how="inner")
    merged["rev_attainment_pct"] = merged["revenue"] / merged["revenue_target"] * 100

    reg = (
        merged.groupby("region", observed=True)
        .agg(
            actual_revenue=("revenue", "sum"),
            target_revenue=("revenue_target", "sum"),
            actual_profit=("profit", "sum"),
            target_profit=("profit_target", "sum"),
        )
        .reset_index()
    )
    reg["rev_attainment_pct"] = reg["actual_revenue"] / reg["target_revenue"] * 100
    reg["profit_attainment_pct"] = reg["actual_profit"] / reg["target_profit"] * 100
    reg = reg.sort_values("rev_attainment_pct")
    if reg.empty:
        raise ValueError(
            "No overlapping month/region combinations between sales and targets — "
            "check that target months use 'YYYY-MM' and regions match the sales data."
        )

    rows = [
        {
            "Region": str(r["region"]),
            "Actual": round(float(r["actual_revenue"]), 2),
            "Target": round(float(r["target_revenue"]), 2),
            "Attainment %": round(float(r["rev_attainment_pct"]), 2),
        }
        for _, r in reg.iterrows()
    ]
    missing = reg[reg["rev_attainment_pct"] < 100]
    worst = reg.iloc[0] if len(reg) else None

    findings = [
        f"Observed Fact: {str(worst['region'])} has the lowest revenue attainment at {float(worst['rev_attainment_pct']):.1f}% of target."
        if worst is not None else "No overlapping target data."
    ]
    if len(missing):
        names = ", ".join(str(x) for x in missing["region"])
        findings.append(f"Observed Fact: {len(missing)} region(s) are below 100% of cumulative revenue target: {names}.")
    else:
        findings.append("Observed Fact: Every region is currently at or above its cumulative revenue target.")

    return result(
        label="Where the business is missing targets",
        facts={
            "below_target_regions": [str(x) for x in missing["region"]] if len(missing) else [],
            "worst_region": str(worst["region"]) if worst is not None else None,
            "worst_attainment_pct": round(float(worst["rev_attainment_pct"]), 2) if worst is not None else None,
        },
        chart=make_chart("bullet_column", "Region", ["Actual", "Target", "Attainment %"], rows),
        metrics=[
            {"label": "Lowest Attainment", "value": f"{worst['region']} · {worst['rev_attainment_pct']:.1f}%" if worst is not None else "n/a"},
            {"label": "Regions On Target", "value": f"{len(reg) - len(missing)} of {len(reg)}"},
        ],
        findings=findings,
        risks=["Persistent sub-100% attainment compounds into annual shortfall that becomes unrecoverable after Q3."],
        recommendations=[
            (f"Build a month-by-month recovery plan for {', '.join(str(x) for x in missing['region'])} focusing on pipeline and stock availability."
             if len(missing) else "Raise next-cycle targets to keep stretch pressure now that all regions are above plan."),
            "Review whether targets reflect seasonality before penalising regional managers.",
        ],
    )



