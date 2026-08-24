"""Ultra-fast in-process analytical engine (DuckDB) over the NexaSphere datasets.

The coerced Pandas frames from ``app.data.mock_dataset.ds()`` are registered as
zero-copy DuckDB views, so external CSV/Excel/Parquet/JSON sources flow straight
into columnar execution with no re-parsing. All aggregations remain fully
deterministic — the LLM never touches this layer.

Public surface:
  * init_duckdb_tables()            - (re)register dataset views
  * run_fast_query(query_key)       - cached named analytical queries
  * execute_spec(spec)              - validated intent-to-SQL dynamic routing
  * clear_query_cache()             - drop LRU caches (after data reload)
"""
import functools
from typing import Any, Dict, List

import duckdb

from app.data.mock_dataset import ds

con = duckdb.connect(database=":memory:")

_registered = False

TABLES = ("sales", "campaigns", "deliveries", "inventory", "targets")


def init_duckdb_tables(force: bool = False) -> None:
    """Register the coerced dataset frames as DuckDB views (idempotent)."""
    global _registered
    if _registered and not force:
        return
    for table in TABLES:
        con.register(table, ds(table))
    _registered = True


def clear_query_cache() -> None:
    run_fast_query.cache_clear()
    execute_spec.cache_clear()


# ---------------------------------------------------------------------------
# Named analytical queries (LRU cached — repeat KPIs served in <5ms)
# ---------------------------------------------------------------------------

@functools.lru_cache(maxsize=128)
def run_fast_query(query_key: str) -> List[Dict[str, Any]]:
    """Cached analytical execution layer returning clean dictionaries."""
    init_duckdb_tables()

    if query_key == "top_regions":
        res = con.execute("""
            SELECT region,
                   ROUND(SUM(sales_amount), 2) AS revenue,
                   ROUND(SUM(sales_amount - cost_amount), 2) AS profit,
                   ROUND((SUM(sales_amount - cost_amount) / SUM(sales_amount)) * 100, 2) AS margin_pct
            FROM sales
            WHERE NOT is_returned
            GROUP BY region
            ORDER BY revenue DESC
        """).fetchdf()
        return res.to_dict(orient="records")

    if query_key == "high_returns":
        res = con.execute("""
            WITH per_product AS (
                SELECT product_id AS product_name,
                       COUNT(*) AS total_orders,
                       SUM(CASE WHEN is_returned THEN 1 ELSE 0 END) AS returned_count,
                       ROUND(SUM(CASE WHEN is_returned THEN 1 ELSE 0 END)::FLOAT
                             / COUNT(*) * 100, 2) AS return_rate_pct
                FROM sales
                GROUP BY product_id
            )
            SELECT * FROM per_product
            WHERE return_rate_pct > (SELECT AVG(return_rate_pct) * 1.5 FROM per_product)
            ORDER BY return_rate_pct DESC
        """).fetchdf()
        return res.to_dict(orient="records")

    if query_key == "campaign_roi":
        res = con.execute("""
            SELECT campaign_name,
                   ROUND(SUM(spend), 2) AS spend,
                   ROUND(SUM(attributed_revenue), 2) AS attributed_revenue,
                   ROUND((SUM(attributed_revenue) - SUM(spend)) / SUM(spend) * 100, 2) AS roi_pct
            FROM campaigns
            GROUP BY campaign_name
            ORDER BY roi_pct DESC
        """).fetchdf()
        return res.to_dict(orient="records")

    if query_key == "delivery_perf":
        res = con.execute("""
            SELECT partner_name,
                   COUNT(*) AS volume,
                   ROUND(AVG(CASE WHEN is_delayed THEN 1.0 ELSE 0.0 END) * 100, 2) AS delay_rate_pct,
                   ROUND(AVG(rating), 2) AS avg_rating
            FROM deliveries
            GROUP BY partner_name
            ORDER BY delay_rate_pct DESC
        """).fetchdf()
        return res.to_dict(orient="records")

    if query_key == "inventory_health":
        res = con.execute("""
            SELECT store_id, product_id,
                   ROUND(stock_on_hand * unit_cost, 2) AS stock_value,
                   CASE
                     WHEN stock_on_hand <= reorder_point THEN 'STOCKOUT RISK'
                     WHEN stock_on_hand > reorder_point * 3 THEN 'EXCESS'
                     ELSE 'HEALTHY'
                   END AS status
            FROM inventory
            ORDER BY stock_value DESC
        """).fetchdf()
        return res.to_dict(orient="records")

    if query_key == "segment_value":
        res = con.execute("""
            SELECT customer_segment,
                   ROUND(SUM(sales_amount), 2) AS revenue,
                   COUNT(*) AS orders,
                   ROUND(SUM(sales_amount) / COUNT(*), 2) AS aov
            FROM sales
            WHERE NOT is_returned
            GROUP BY customer_segment
            ORDER BY revenue DESC
        """).fetchdf()
        return res.to_dict(orient="records")

    if query_key == "monthly_growth":
        res = con.execute("""
            SELECT strftime(date, '%Y-%m') AS month,
                   ROUND(SUM(sales_amount), 2) AS revenue,
                   ROUND(SUM(sales_amount - cost_amount), 2) AS profit,
                   ROUND((SUM(sales_amount - cost_amount) / SUM(sales_amount)) * 100, 2) AS margin_pct
            FROM sales
            WHERE NOT is_returned
            GROUP BY month
            ORDER BY month
        """).fetchdf()
        return res.to_dict(orient="records")

    if query_key == "employee_perf":
        res = con.execute("""
            SELECT employee_id,
                   ROUND(SUM(sales_amount), 2) AS revenue,
                   ROUND(SUM(sales_amount - cost_amount), 2) AS profit,
                   COUNT(*) AS orders
            FROM sales
            WHERE NOT is_returned
            GROUP BY employee_id
            ORDER BY profit DESC
        """).fetchdf()
        return res.to_dict(orient="records")

    if query_key == "target_attainment":
        res = con.execute("""
            WITH actual AS (
                SELECT region, ROUND(SUM(sales_amount), 2) AS actual_revenue
                FROM sales WHERE NOT is_returned GROUP BY region
            ),
            goal AS (
                SELECT region, ROUND(SUM(revenue_target), 2) AS target_revenue
                FROM targets GROUP BY region
            )
            SELECT goal.region,
                   actual.actual_revenue,
                   goal.target_revenue,
                   ROUND(actual.actual_revenue / goal.target_revenue * 100, 2) AS attainment_pct
            FROM goal JOIN actual USING (region)
            ORDER BY attainment_pct ASC
        """).fetchdf()
        return res.to_dict(orient="records")

    if query_key == "kpis":
        res = con.execute("""
            SELECT
                COUNT(*) AS total_orders,
                ROUND(SUM(sales_amount), 2) AS total_revenue,
                ROUND(SUM(CASE WHEN NOT is_returned THEN sales_amount ELSE 0 END), 2) AS net_revenue,
                ROUND(SUM(CASE WHEN NOT is_returned THEN sales_amount - cost_amount ELSE 0 END), 2) AS gross_profit,
                ROUND(AVG(CASE WHEN is_returned THEN 1.0 ELSE 0.0 END) * 100, 2) AS return_rate_pct
            FROM sales
        """).fetchdf()
        return res.to_dict(orient="records")

    return []


# ---------------------------------------------------------------------------
# LLM intent-to-SQL dynamic routing (allowlist-validated, never free-form SQL)
# ---------------------------------------------------------------------------

_SPEC_ALLOWED: Dict[str, Dict[str, Dict[str, str]]] = {
    # table -> {output metric -> SQL expression}, plus groupable dimensions
    "sales": {
        "metrics": {
            "revenue": "ROUND(SUM(sales_amount), 2)",
            "profit": "ROUND(SUM(sales_amount - cost_amount), 2)",
            "orders": "COUNT(*)",
            "return_rate_pct": "ROUND(AVG(CASE WHEN is_returned THEN 1.0 ELSE 0.0 END) * 100, 2)",
        },
        "dimensions": {"region", "store_id", "product_id", "category",
                       "customer_segment", "employee_id", "month"},
    },
    "campaigns": {
        "metrics": {
            "spend": "ROUND(SUM(spend), 2)",
            "attributed_revenue": "ROUND(SUM(attributed_revenue), 2)",
            "roi_pct": "ROUND((SUM(attributed_revenue) - SUM(spend)) / SUM(spend) * 100, 2)",
        },
        "dimensions": {"campaign_name"},
    },
    "deliveries": {
        "metrics": {
            "volume": "COUNT(*)",
            "delay_rate_pct": "ROUND(AVG(CASE WHEN is_delayed THEN 1.0 ELSE 0.0 END) * 100, 2)",
            "avg_rating": "ROUND(AVG(rating), 2)",
        },
        "dimensions": {"partner_name"},
    },
    "inventory": {
        "metrics": {
            "stock_value": "ROUND(SUM(stock_on_hand * unit_cost), 2)",
            "avg_stock": "ROUND(AVG(stock_on_hand), 1)",
        },
        "dimensions": {"store_id", "product_id"},
    },
    "targets": {
        "metrics": {
            "revenue_target": "ROUND(SUM(revenue_target), 2)",
            "profit_target": "ROUND(SUM(profit_target), 2)",
        },
        "dimensions": {"region", "month"},
    },
}

_SPEC_EXTRA_DIMENSIONS = {
    # virtual dimensions expanded into SQL expressions on the sales table
    "month": "strftime(date, '%Y-%m')",
}


def validate_spec(spec: Dict[str, Any]) -> Dict[str, Any]:
    """Whitelist-validate a dynamic analytical spec. Raises ValueError on any
    token that is not explicitly allowed — free-form SQL can never pass."""
    table = str(spec.get("table", "")).lower()
    metric = str(spec.get("metric", "")).lower()
    dimension = str(spec.get("group_by", "")).lower()
    direction = str(spec.get("order", "desc")).lower()
    limit = int(spec.get("limit", 10))

    if table not in _SPEC_ALLOWED:
        raise ValueError(f"Unknown table '{table}' in analytical spec")
    table_spec = _SPEC_ALLOWED[table]
    if metric not in table_spec["metrics"]:
        raise ValueError(f"Unknown metric '{metric}' for table '{table}'")
    if dimension not in table_spec["dimensions"]:
        raise ValueError(f"Unknown dimension '{dimension}' for table '{table}'")
    if direction not in ("asc", "desc"):
        raise ValueError(f"Unknown order direction '{direction}'")
    limit = max(1, min(limit, 50))
    filters = spec.get("filters") or {}
    if not isinstance(filters, dict):
        raise ValueError("filters must be an object of dimension -> value")
    unknown = set(filters) - table_spec["dimensions"]
    if unknown:
        raise ValueError(f"Unknown filter dimension(s): {sorted(unknown)}")
    return {"table": table, "metric": metric, "group_by": dimension,
            "order": direction, "limit": limit, "filters": filters}


@functools.lru_cache(maxsize=128)
def _execute_spec_cached(spec_key: str) -> List[Dict[str, Any]]:
    import json as _json

    spec = validate_spec(_json.loads(spec_key))
    table_spec = _SPEC_ALLOWED[spec["table"]]

    dim_sql = _SPEC_EXTRA_DIMENSIONS.get(spec["group_by"], spec["group_by"])
    where_parts = []
    params: List[Any] = []
    for dim, value in (spec["filters"] or {}).items():
        dim_expr = _SPEC_EXTRA_DIMENSIONS.get(dim, dim)
        where_parts.append(f"{dim_expr} = ?")
        params.append(str(value))
    where_sql = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""
    if spec["table"] == "sales" and spec["metric"] != "return_rate_pct":
        where_sql = (where_sql + " AND " if where_sql else "WHERE ") + "NOT is_returned"

    sql = f"""
        SELECT {dim_sql} AS {spec['group_by']},
               {table_spec['metrics'][spec['metric']]} AS {spec['metric']}
        FROM {spec['table']}
        {where_sql}
        GROUP BY {spec['group_by']}
        ORDER BY {spec['metric']} {spec['order'].upper()}
        LIMIT {spec['limit']}
    """
    res = con.execute(sql, params).fetchdf()
    return res.to_dict(orient="records")


def execute_spec(spec: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Validate + run a dynamic analytical spec (cached on its canonical JSON)."""
    import json as _json

    clean = validate_spec(spec)
    init_duckdb_tables()
    return _execute_spec_cached(_json.dumps(clean, sort_keys=True))
