"""Revenue & performance analysis — pure Pandas, deterministic.

Functions: analyze_revenue_profit_drivers, analyze_growth_vs_profitability,
rank_employee_performance.
"""
import pandas as pd

from app.analysis.common import fmt_naira, make_chart, require_rows, result
from app.data.mock_dataset import ds


def _net_frame() -> pd.DataFrame:
    df = ds("sales")
    active = df[~df["is_returned"]].copy()
    active["gross_profit"] = active["sales_amount"] - active["cost_amount"]
    return df, active


def analyze_revenue_profit_drivers() -> dict:
    df, active = _net_frame()
    require_rows(active, "sales")

    by_dim = {}
    for dim in ("region", "store_id", "product_id"):
        g = active.groupby(dim, observed=True).agg(
            revenue=("sales_amount", "sum"), profit=("gross_profit", "sum")
        )
        by_dim[dim] = g.sort_values("revenue", ascending=False)

    top_region = by_dim["region"].index[0]
    top_store = by_dim["store_id"].index[0]
    top_product = by_dim["product_id"].index[0]
    total_rev = float(by_dim["region"]["revenue"].sum())

    region_rows = [
        {"name": str(idx), "Revenue": round(float(r["revenue"]), 2), "Profit": round(float(r["profit"]), 2)}
        for idx, r in by_dim["region"].iterrows()
    ]
    product_shares = by_dim["product_id"]["revenue"].head(5)
    donut_rows = [
        {"name": str(idx), "value": round(float(v), 2)} for idx, v in product_shares.items()
    ]
    other = total_rev - float(product_shares.sum())
    donut_rows.append({"name": "Other", "value": round(other, 2)})
    top_share_pct = float(product_shares.iloc[0]) / total_rev * 100

    return result(
        label="Top revenue & profit drivers",
        facts={
            "top_region": top_region,
            "top_region_revenue": round(float(by_dim['region'].iloc[0]['revenue']), 2),
            "top_store": top_store,
            "top_product": top_product,
            "total_net_revenue": round(total_rev, 2),
        },
        chart=make_chart("grouped_column", "Region", ["Revenue", "Profit"], region_rows),
        secondary_chart=make_chart("donut", "Product", ["value"], donut_rows),
        metrics=[
            {"label": "Top Region", "value": f"{top_region} · {fmt_naira(float(by_dim['region'].iloc[0]['revenue']))}"},
            {"label": "Top Store", "value": f"{top_store} · {fmt_naira(float(by_dim['store_id'].iloc[0]['revenue']))}"},
            {"label": "Top Product", "value": f"{top_product} · {fmt_naira(float(by_dim['product_id'].iloc[0]['revenue']))}"},
        ],
        findings=[
            f"Observed Fact: {top_region} leads all regions with {fmt_naira(float(by_dim['region'].iloc[0]['revenue']))} net revenue and {fmt_naira(float(by_dim['region'].iloc[0]['profit']))} profit.",
            f"Observed Fact: {top_store} is the strongest single store; {top_product} is the highest-grossing product.",
            f"Observed Fact: The top product contributes {top_share_pct:.1f}% of company-wide revenue.",
        ],
        risks=(
            [f"Concentration risk: {top_share_pct:.1f}% of revenue depends on a single product line."]
            if top_share_pct > 30
            else ["Revenue spread across products is moderately balanced; monitor for concentration drift."]
        ),
        recommendations=[
            f"Protect and expand {top_region}'s inventory depth — it funds the widest margin base.",
            f"Replicate {top_store}'s staffing and layout playbook across sister stores.",
            "Bundle the top product with accessories to lift basket size without discounting.",
        ],
    )


def analyze_growth_vs_profitability() -> dict:
    df, active = _net_frame()
    require_rows(active, "sales", minimum=4)  # need recent + prior 3-month windows
    active["month"] = active["date"].dt.to_period("M").astype(str)

    m = active.groupby("month").agg(revenue=("sales_amount", "sum"), cost=("cost_amount", "sum"))
    m["profit"] = m["revenue"] - m["cost"]
    m["margin_pct"] = m["profit"] / m["revenue"] * 100
    m = m.reset_index()
    corr = float(m["revenue"].corr(m["margin_pct"]))

    recent = m.tail(3)
    prior = m.tail(6).head(3)
    rev_growth = (recent["revenue"].mean() / prior["revenue"].mean() - 1) * 100
    margin_delta = recent["margin_pct"].mean() - prior["margin_pct"].mean()

    rows = [
        {
            "Month": r["month"],
            "Revenue": round(float(r["revenue"]), 2),
            "Margin %": round(float(r["margin_pct"]), 2),
        }
        for _, r in m.iterrows()
    ]

    if rev_growth > 0 and margin_delta >= 0:
        verdict = "Growth IS translating into stronger profitability."
        recs = ["Scale the current product mix — unit economics improve with volume.",
                "Lock in supplier pricing now to defend the improving margin trend."]
    elif rev_growth > 0:
        verdict = "Revenue is growing but profitability is NOT keeping pace."
        recs = ["Rebalance mix toward high-margin categories before scaling spend further.",
                "Audit discounting and delivery surcharges eroding marginal revenue."]
    else:
        verdict = "Both revenue momentum and profitability are softening."
        recs = ["Trigger demand-gen campaigns in the strongest historical quarters.",
                "Review cost side first — procurement and logistics — before chasing volume."]

    return result(
        label="Revenue growth vs profitability",
        facts={
            "revenue_growth_recent_3m_pct": round(rev_growth, 2),
            "margin_delta_recent_3m_pp": round(margin_delta, 2),
            "revenue_margin_correlation": round(corr, 3),
            "best_margin_month": str(m.loc[m["margin_pct"].idxmax(), "month"]),
        },
        chart=make_chart("combo", "Month", ["Revenue", "Margin %"], rows),
        metrics=[
            {"label": "Recent 3-Mo Revenue Growth", "value": f"{rev_growth:+.1f}%"},
            {"label": "Margin Change", "value": f"{margin_delta:+.2f} pp"},
            {"label": "Rev–Margin Correlation", "value": f"{corr:.2f}"},
        ],
        findings=[
            f"Observed Fact: Recent 3-month revenue growth is {rev_growth:+.1f}% vs the prior 3 months.",
            f"Observed Fact: Gross margin moved {margin_delta:+.2f} percentage points over the same window.",
            f"Interpretation: Revenue–margin correlation of {corr:.2f} suggests "
            + ("healthy operating leverage." if corr > 0.2 else "growth currently costs more than it earns." if corr < -0.2 else "no strong coupling either way."),
        ],
        risks=[r for r in [
            "Margin compression while revenue climbs — classic over-discounting signal."
            if margin_delta < 0 and rev_growth > 0 else None
        ] if r],
        recommendations=recs,
    )


def rank_employee_performance() -> dict:
    df, active = _net_frame()
    require_rows(active, "sales")

    g = (
        active.groupby("employee_id", observed=True)
        .agg(revenue=("sales_amount", "sum"), profit=("gross_profit", "sum"), orders=("order_id", "count"))
        .sort_values("profit", ascending=False)
    )
    best = g.index[0]
    rows = [
        {
            "Employee": str(idx),
            "Revenue": round(float(r["revenue"]), 2),
            "Profit": round(float(r["profit"]), 2),
        }
        for idx, r in g.head(10).iterrows()
    ]
    scatter = [
        {"x": round(float(r["revenue"]), 2), "y": round(float(r["profit"]), 2), "z": int(r["orders"]), "name": str(idx)}
        for idx, r in g.iterrows()
    ]

    return result(
        label="Employee performance (revenue & profitability)",
        facts={
            "best_employee": best,
            "best_revenue": round(float(g.iloc[0]["revenue"]), 2),
            "best_profit": round(float(g.iloc[0]["profit"]), 2),
            "employees_ranked": int(len(g)),
        },
        chart=make_chart("grouped_column", "Employee", ["Revenue", "Profit"], rows),
        secondary_chart=make_chart("scatter_quadrant", "Revenue", ["Profit"], scatter),
        metrics=[
            {"label": "Top Performer", "value": f"{best} · {fmt_naira(float(g.iloc[0]['profit']))} profit"},
            {"label": "Orders Led", "value": f"{int(g.iloc[0]['orders']):,}"},
        ],
        findings=[
            f"Observed Fact: {best} combines {fmt_naira(float(g.iloc[0]['revenue']))} revenue with {fmt_naira(float(g.iloc[0]['profit']))} profit — the strongest dual scorecard.",
            f"Observed Fact: The top 10 employees generate {100 * float(g.head(10)['profit'].sum() / g['profit'].sum()):.1f}% of employee-attributed profit.",
        ],
        risks=["High per-employee concentration creates key-person dependency in sales continuity."],
        recommendations=[
            f"Pair {best}'s closing techniques with mid-table reps through structured shadowing.",
            "Add profitability (not just revenue) to sales incentive weighting to protect margins.",
        ],
    )

