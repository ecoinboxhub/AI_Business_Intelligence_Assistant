"""Value & efficiency analysis — pure Pandas, deterministic.

Functions: rank_campaign_roi, audit_inventory_health,
profile_customer_segments.
"""
import pandas as pd

from app.analysis.common import fmt_naira, make_chart, require_rows, result
from app.data.mock_dataset import ds


def rank_campaign_roi() -> dict:
    c = ds("campaigns")
    require_rows(c, "campaigns")
    c["roi_pct"] = (c["attributed_revenue"] - c["spend"]) / c["spend"] * 100
    c = c.sort_values("roi_pct", ascending=False)

    best, worst = c.iloc[0], c.iloc[-1]
    bars = [
        {"Campaign": str(r["campaign_name"]), "ROI %": round(float(r["roi_pct"]), 2)}
        for _, r in c.iterrows()
    ]
    funnel = [
        {"stage": "Total Spend", "value": round(float(c["spend"].sum()), 2)},
        {"stage": "Attributed Revenue", "value": round(float(c["attributed_revenue"].sum()), 2)},
        {"stage": "Net Return", "value": round(float(c["attributed_revenue"].sum() - c["spend"].sum()), 2)},
    ]
    losers = c[c["roi_pct"] < 100]

    return result(
        label="Marketing campaign ROI ranking",
        facts={
            "best_campaign": str(best["campaign_name"]),
            "best_roi_pct": round(float(best["roi_pct"]), 2),
            "worst_campaign": str(worst["campaign_name"]),
            "worst_roi_pct": round(float(worst["roi_pct"]), 2),
            "total_spend": round(float(c["spend"].sum()), 2),
            "below_1x_campaigns": [str(x) for x in losers["campaign_name"]],
        },
        chart=make_chart("horizontal_bar", "Campaign", ["ROI %"], bars),
        secondary_chart=make_chart("funnel", "Stage", ["value"], funnel),
        metrics=[
            {"label": "Best ROI", "value": f"{best['campaign_name']} · {best['roi_pct']:.0f}%"},
            {"label": "Worst ROI", "value": f"{worst['campaign_name']} · {worst['roi_pct']:.0f}%"},
            {"label": "Portfolio ROAS", "value": f"{c['attributed_revenue'].sum() / c['spend'].sum():.2f}×"},
        ],
        findings=[
            f"Observed Fact: {best['campaign_name']} returned {best['roi_pct']:.0f}% on spend — the strongest campaign.",
            f"Observed Fact: {worst['campaign_name']} is the weakest at {worst['roi_pct']:.0f}% ROI.",
            f"Observed Fact: {len(losers)} of {len(c)} campaigns fail to return even 1× spend."
            if len(losers) else "Observed Fact: Every campaign returns at least 1× spend.",
            f"Interpretation: Portfolio-level every-₦1-spent returns {fmt_naira(float(c['attributed_revenue'].sum() - c['spend'].sum()))} net across {len(c)} campaigns.",
        ],
        risks=["Low-ROI campaigns consume budget that higher-performing channels could compound."],
        recommendations=[
            f"Reallocate at least half of {worst['campaign_name']}'s budget into a variant of {best['campaign_name']}.",
            "Standardise post-campaign ROI review within 7 days of each campaign close.",
        ],
    )


def audit_inventory_health() -> dict:
    inv = ds("inventory").copy()
    require_rows(inv, "inventory")
    inv["stock_value"] = inv["stock_on_hand"] * inv["unit_cost"]

    def status(row):
        if row["stock_on_hand"] <= row["reorder_point"]:
            return "STOCKOUT RISK"
        if row["stock_on_hand"] > row["reorder_point"] * 3:
            return "EXCESS"
        return "HEALTHY"

    inv["status"] = inv.apply(status, axis=1)
    counts = inv["status"].value_counts()

    treemap = [
        {
            "name": f"{r['store_id']} · {r['product_id']}",
            "size": round(float(r["stock_value"]), 2),
            "status": r["status"],
            "store": str(r["store_id"]),
            "product": str(r["product_id"]),
        }
        for _, r in inv.iterrows()
    ]
    stockout_rows = inv[inv["status"] == "STOCKOUT RISK"]
    excess_rows = inv[inv["status"] == "EXCESS"]

    findings = [
        f"Observed Fact: {counts.get('STOCKOUT RISK', 0)} SKU-store combinations are at or below reorder point.",
        f"Observed Fact: {counts.get('EXCESS', 0)} combinations hold excess stock (>{3}× reorder point) tying up {fmt_naira(float(excess_rows['stock_value'].sum()))}." if len(excess_rows) else "No excess-stock combinations detected.",
        f"Interpretation: Total inventory at risk of lost sales equals {fmt_naira(float(stockout_rows['stock_value'].sum()))} in unfillable demand value.",
    ]

    return result(
        label="Stockouts & excess inventory audit",
        facts={
            "stockout_count": int(counts.get("STOCKOUT RISK", 0)),
            "excess_count": int(counts.get("EXCESS", 0)),
            "healthy_count": int(counts.get("HEALTHY", 0)),
            "stockout_skus": [
                {"store": str(r["store_id"]), "product": str(r["product_id"])}
                for _, r in stockout_rows.iterrows()
            ],
            "excess_value": round(float(excess_rows["stock_value"].sum()), 2),
            "total_inventory_value": round(float(inv["stock_value"].sum()), 2),
        },
        chart=make_chart("treemap", "SKU Store", ["size"], treemap),
        metrics=[
            {"label": "Stockout Risk SKUs", "value": str(counts.get("STOCKOUT RISK", 0))},
            {"label": "Excess Stock SKUs", "value": str(counts.get("EXCESS", 0))},
            {"label": "Inventory Value", "value": fmt_naira(float(inv["stock_value"].sum()))},
        ],
        findings=findings,
        risks=["Every stockout day converts directly into competitor sales with no recovery path."],
        recommendations=[
            "Trigger emergency replenishment for STOCKOUT RISK rows starting with highest-velocity stores.",
            f"Run clearance bundles on EXCESS lines to release {fmt_naira(float(excess_rows['stock_value'].sum()))} of working capital."
            if len(excess_rows) else "Maintain current ordering cadence — no excess buildup detected.",
            "Move to weekly automated reorder-point review instead of monthly.",
        ],
    )


def profile_customer_segments() -> dict:
    df = ds("sales")
    require_rows(df, "sales")
    active = df[~df["is_returned"]]

    g = (
        active.groupby("customer_segment", observed=True)
        .agg(revenue=("sales_amount", "sum"), orders=("order_id", "count"))
        .sort_values("revenue", ascending=False)
    )
    require_rows(g, "sales")
    g["aov"] = g["revenue"] / g["orders"]
    total_rev = float(g["revenue"].sum())

    pie = [{"name": str(idx), "value": round(float(r["revenue"]), 2)} for idx, r in g.iterrows()]
    cols = [{"Segment": str(idx), "Avg Order Value": round(float(r["aov"]), 2)} for idx, r in g.iterrows()]
    top = g.index[0]
    top_share = float(g.iloc[0]["revenue"]) / total_rev * 100
    premium = g["aov"].idxmax()

    return result(
        label="Most valuable customer segments",
        facts={
            "top_segment": top,
            "top_share_pct": round(top_share, 2),
            "top_revenue": round(float(g.iloc[0]["revenue"]), 2),
            "highest_aov_segment": premium,
            "highest_aov": round(float(g.loc[premium, "aov"]), 2),
        },
        chart=make_chart("pie", "Segment", ["value"], pie),
        secondary_chart=make_chart("column", "Segment", ["Avg Order Value"], cols),
        metrics=[
            {"label": "Most Valuable Segment", "value": f"{top} · {fmt_naira(float(g.iloc[0]['revenue']))}"},
            {"label": "Revenue Share", "value": f"{top_share:.1f}%"},
            {"label": "Highest AOV", "value": f"{premium} · {fmt_naira(float(g.loc[premium, 'aov']))}"},
        ],
        findings=[
            f"Observed Fact: {top} drives {top_share:.1f}% of net revenue ({fmt_naira(float(g.iloc[0]['revenue']))}).",
            f"Observed Fact: {premium} customers spend the most per order ({fmt_naira(float(g.loc[premium, 'aov']))} AOV).",
            "Interpretation: Volume leadership and per-order value are different levers — retention plays should differ by segment.",
        ],
        risks=["Over-dependence on one segment exposes revenue to that segment's cycle downturns."],
        recommendations=[
            f"Create a loyalty tier for {top} to defend its share before competitors target it.",
            f"Build an upsell path for {premium} accounts — their basket economics justify dedicated account management.",
        ],
    )


