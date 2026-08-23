# Data Dictionary - NexaSphere AI BI Assistant

All tables are produced by `backend/app/data/mock_dataset.py`, which resolves each table from an **external file when configured**, falling back to seeded synthetic generators (pure random, vectorized NumPy, cached via `lru_cache`). Scale of the synthetic data is controlled by env vars:

| Env var | Default | Controls |
|---|---|---|
| `MOCK_DATASET_SIZE` | `2000000` | Sales row count (up to ~2M entries) |
| `MOCK_DELIVERY_SIZE` | `400000` | Deliveries row count |
| `MOCK_DATASET_SEED` | `8` | RNG seed (pinned so accuracy benchmarks hold) |

## External Data Sources

Per-table source selection (checked in order, first hit wins):

1. `NEXASPHERE_{TABLE}_URI` — direct path to a file for one table
   (`SALES`, `CAMPAIGNS`, `DELIVERIES`, `INVENTORY`, `TARGETS`).
2. `NEXASPHERE_DATA_DIR` — folder scanned for `<table>.parquet|.pq|.csv|.txt|.xlsx|.xls|.json`.
3. Synthetic generator fallback.

Supported formats: CSV, TSV (`.txt`), Excel (`openpyxl`), Parquet (`pyarrow`), JSON (records). Missing/unparseable files raise at startup — there is no silent fallback after a URI is set.

Before entering the analysis layer every external frame passes `coerce_schema()`, which enforces the column contracts below: required columns must exist; numeric columns → `float64`; date columns → `datetime64[ns]`; boolean columns accept `true/false, yes/no, t/f, y/n, 1/0` (any other value is rejected); string-like columns → `category`.

Frames returned by the generators are **read-only by contract** — analysis functions must never mutate them. Call `reload_datasets()` to drop cached frames and re-read env/files.

Currency: Nigerian Naira (NGN).

---

## Table 1 — Sales (grain: one row per order line)

| Column | Type | Description / Domain |
|---|---|---|
| `order_id` | str | Unique. Format `ORD########` (zero-padded sequence) |
| `date` | datetime64[ns] | Order date between 2025-08-01 and 2026-08-22 |
| `store_id` | category | One of `STORE_LAGOS`, `STORE_LAGOS_II`, `STORE_ABUJA`, `STORE_KANO`, `STORE_PH`, `STORE_ONLINE` |
| `region` | category | Derived from store: `Lagos`, `Abuja`, `Kano`, `Port Harcourt`, `Online` |
| `product_id` | category | One of `PROD_TV`, `PROD_FRIDGE`, `PROD_PHONE`, `PROD_LAPTOP`, `PROD_AUDIO` |
| `category` | category | Product family: `Appliances` (TV, Fridge), `Phones`, `Computers` (Laptop), `Audio` |
| `sales_amount` | float | Gross sale value in NGN; lognormal distribution around product base price |
| `cost_amount` | float | COGS in NGN; `sales_amount × U(0.55, 0.85)` |
| `is_returned` | bool | `True` with probability ≈ 12% |
| `employee_id` | category | Sales rep, `EMP01`–`EMP30` |

## Table 2 — Marketing Campaigns (grain: one row per campaign)

| Column | Type | Description / Domain |
|---|---|---|
| `campaign_id` | str | `CAMP##` |
| `campaign_name` | str | Human-readable campaign title (12 campaigns) |
| `spend` | float | Total media/production spend NGN; `U(500k, 6M)` |
| `attributed_revenue` | float | Revenue attributed to campaign; `spend × U(0.6, 5.0)` |

## Table 3 — Deliveries (grain: one row per delivery)

| Column | Type | Description / Domain |
|---|---|---|
| `delivery_id` | str | `DEL########` |
| `partner_name` | category | `ExpressWay Logistics`, `SwiftCourier`, `GIG Logistics`, `Kwik Delivery` |
| `is_delayed` | bool | `True` with probability ≈ 18% |
| `rating` | float | Customer delivery rating, clipped to `[1.0, 5.0]`; on-time ≈ `N(4.5, 0.45)`, delayed ≈ `N(3.1, 0.7)` |

## Table 4 — Inventory (grain: one row per store × product SKU, 6 × 5 = 30 rows)

| Column | Type | Description / Domain |
|---|---|---|
| `inventory_id` | str | `INV####` |
| `store_id` | category | Same domain as Sales |
| `product_id` | category | Same domain as Sales |
| `stock_on_hand` | int | Units available; `U{0..500}` |
| `reorder_point` | int | Restock threshold; `U{20..120}` |
| `unit_cost` | float | Valuation cost per unit; product base price × 0.70 |
| `last_restocked` | date | Random day within the 180 days ending 2026-08-22 |

## Table 5 — Targets (grain: one row per region × month, 5 × 12 = 60 rows)

| Column | Type | Description / Domain |
|---|---|---|
| `target_id` | str | `TG###` |
| `month` | str | Period `2025-09` … `2026-08` (`YYYY-MM`) |
| `region` | str | `Lagos`, `Abuja`, `Kano`, `Port Harcourt`, `Online` |
| `revenue_target` | float | Monthly net-revenue goal NGN; `U(14B, 21B)` |
| `profit_target` | float | Monthly gross-profit goal NGN; `U(4B, 6.5B)` |

---

## KPI Math Formulas (authoritative definitions)

Every formula below maps 1:1 to a pure-Pandas function in `backend/app/analysis`. Per the architecture rules, **the AI never computes any of these values**.

### Sales & Profit

```
Gross_Revenue      = Σ sales_amount                          (all rows)
Return_Rate_%      = count(is_returned == True) / count(all orders) × 100
Net_Revenue        = Σ sales_amount   where is_returned == False
Net_COGS           = Σ cost_amount    where is_returned == False
Gross_Profit       = Net_Revenue − Net_COGS
Profit_Margin_%    = Gross_Profit / Net_Revenue × 100
AOV                = Net_Revenue / distinct_count(order_id where is_returned == False)
```

Grouped variants (identical math with `groupby`):
- `Regional_Profit` → group by `region`
- `Store_Sales` / `Store_Profit` → group by `store_id`
- `Category_Revenue_Profit` → group by `category`
- `Employee_Output` → group by `employee_id` on `Net_Revenue`
- `Product_Return_Rate_%` → group by `product_id` on return counts

### Marketing ROI

```
Total_Spend          = Σ spend
Attributed_Revenue   = Σ attributed_revenue
ROAS                 = attributed_revenue / spend              (per campaign and overall)
ROI_%                = (attributed_revenue − spend) / spend × 100
```

### Delivery Performance

```
Delay_Rate_%         = count(is_delayed == True) / count(all deliveries) × 100
On_Time_Rate_%       = 100 − Delay_Rate_%
Avg_Rating           = mean(rating)                            (overall or per partner)
Partner_Delay_Rate_% = Delay_Rate_% grouped by partner_name
```

### Inventory Health

```
Restock_Flag         = stock_on_hand <= reorder_point          (boolean per SKU row)
Stockout_Rate_%      = count(Restock_Flag) / count(all SKUs) × 100
Inventory_Value      = Σ stock_on_hand × unit_cost
Store_Stockout_Rate  = Restock_Flag grouped by store_id
```

### Target Attainment

```
Rev_Attainment_%     = actual revenue / revenue_target × 100   (per region × month, rolled up to region)
Profit_Attainment_%  = actual profit / profit_target × 100
```

---

## Source Loading Contract (summary)

- Resolution order per table: `NEXASPHERE_{TABLE}_URI` → `NEXASPHERE_DATA_DIR/<table>.<ext>` → synthetic generator.
- Every externally loaded frame is validated + coerced (`read_table()` → `coerce_schema()`); contract violations fail fast with a `ValueError` naming the offending columns/values.
- Tests: `backend/tests/test_data_sources.py` covers readers, coercion, env routing, precedence and engine integration.
