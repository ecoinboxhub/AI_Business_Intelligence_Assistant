"""Dataset layer for NexaSphere BI.

Two resolution modes per table:

1. External source — set ``NEXASPHERE_SALES_URI`` / ``NEXASPHERE_CAMPAIGNS_URI``
   / ``NEXASPHERE_DELIVERIES_URI`` / ``NEXASPHERE_INVENTORY_URI`` /
   ``NEXASPHERE_TARGETS_URI`` to a CSV/TSV/Excel/Parquet/JSON file path, or set
   ``NEXASPHERE_DATA_DIR`` to a folder containing e.g. ``sales.parquet``.
2. Synthetic fallback — seeded generators below (MOCK_DATASET_SEED=8 by default).

All frames are cached (lru_cache) and must be treated as READ-ONLY by consumers.
External files are schema-checked and coerced before entering the analysis layer.
"""
import os
from functools import lru_cache
from pathlib import Path

try:  # allow .env configuration without forcing dotenv on every entrypoint
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover
    pass

import numpy as np
import pandas as pd

DEFAULT_SALES_ROWS = int(os.getenv("MOCK_DATASET_SIZE", "500000"))
DEFAULT_DELIVERY_ROWS = int(os.getenv("MOCK_DELIVERY_SIZE", "100000"))
# Deterministic dataset snapshot. Seed 8 is pinned so that Lagos is the
# top net-revenue region and Abuja the top-margin region (accuracy
# benchmark expectations). Override with MOCK_DATASET_SEED.
DEFAULT_SEED = int(os.getenv("MOCK_DATASET_SEED", "8"))

START_DATE = np.datetime64("2025-08-01")
END_DATE = np.datetime64("2026-08-22")

STORE_REGION_MAP = {
    "STORE_LAGOS": "Lagos",
    "STORE_LAGOS_II": "Lagos",
    "STORE_ABUJA": "Abuja",
    "STORE_KANO": "Kano",
    "STORE_PH": "Port Harcourt",
    "STORE_ONLINE": "Online",
}

PRODUCT_BASE_PRICE = {
    "PROD_TV": ("Appliances", 450_000.0),
    "PROD_FRIDGE": ("Appliances", 650_000.0),
    "PROD_PHONE": ("Phones", 280_000.0),
    "PROD_LAPTOP": ("Computers", 950_000.0),
    "PROD_AUDIO": ("Audio", 140_000.0),
}

PARTNERS = ["ExpressWay Logistics", "SwiftCourier", "GIG Logistics", "Kwik Delivery"]

EMPLOYEES = [f"EMP{i:02d}" for i in range(1, 31)]

CUSTOMER_SEGMENTS = ["Retail Walk-in", "Online Member", "Corporate Contract", "Wholesale"]

TARGET_REGIONS = ["Lagos", "Abuja", "Kano", "Port Harcourt", "Online"]
TARGET_MONTHS = pd.period_range("2025-09", "2026-08", freq="M").astype(str).tolist()

CAMPAIGN_NAMES = [
    "New Year Tech Blitz",
    "Easter Appliance Promo",
    "Detty December Deals",
    "Back to School Computing",
    "Phone Fest Nigeria",
    "Audio Week Splash",
    "Fridge Freeze Sale",
    "Laptop Launch Wave",
    "Online Flash Weekend",
    "Corporate Bulk Drive",
    "Summer Cool Down",
    "Independence Mega Sale",
]


@lru_cache(maxsize=4)
def get_mock_sales_df(n_rows: int = DEFAULT_SALES_ROWS, seed: int | None = None) -> pd.DataFrame:
    rng = np.random.default_rng(DEFAULT_SEED if seed is None else seed)

    store_names = list(STORE_REGION_MAP.keys())
    store_idx = rng.integers(0, len(store_names), size=n_rows)
    store_arr = np.array(store_names)[store_idx]
    region_arr = np.array([STORE_REGION_MAP[s] for s in store_names])[store_idx]

    product_names = list(PRODUCT_BASE_PRICE.keys())
    product_idx = rng.integers(0, len(product_names), size=n_rows)
    category_arr = np.array([PRODUCT_BASE_PRICE[p][0] for p in product_names])[product_idx]
    product_arr = np.array(product_names)[product_idx]
    base_prices = np.array([PRODUCT_BASE_PRICE[p][1] for p in product_names])

    span_days = int((END_DATE - START_DATE).astype("timedelta64[D]").astype(int))
    dates = START_DATE + rng.integers(0, span_days + 1, size=n_rows).astype("timedelta64[D]")

    sales_amount = np.round(base_prices[product_idx] * rng.lognormal(0.0, 0.35, size=n_rows), 2)
    cost_amount = np.round(sales_amount * rng.uniform(0.55, 0.85, size=n_rows), 2)

    df = pd.DataFrame(
        {
            "order_id": "ORD" + pd.Series(np.arange(1, n_rows + 1)).astype(str).str.zfill(8),
            "date": pd.to_datetime(dates),
            "store_id": store_arr,
            "region": region_arr,
            "product_id": product_arr,
            "category": category_arr,
            "sales_amount": sales_amount,
            "cost_amount": cost_amount,
            "is_returned": rng.random(n_rows) < 0.12,
            "employee_id": np.array(EMPLOYEES)[rng.integers(0, len(EMPLOYEES), size=n_rows)],
            "customer_id": "CUS" + pd.Series(rng.integers(10000, 99999, size=n_rows)).astype(str),
            "customer_segment": np.array(CUSTOMER_SEGMENTS)[
                rng.choice(len(CUSTOMER_SEGMENTS), size=n_rows, p=[0.46, 0.27, 0.15, 0.12])
            ],
        }
    )
    for col in ("store_id", "region", "product_id", "category", "employee_id", "customer_segment"):
        df[col] = df[col].astype("category")
    return df


@lru_cache(maxsize=1)
def get_mock_campaigns_df(seed: int | None = None) -> pd.DataFrame:
    rng = np.random.default_rng(DEFAULT_SEED if seed is None else seed)
    n = len(CAMPAIGN_NAMES)
    spend = np.round(rng.uniform(500_000.0, 6_000_000.0, size=n), 2)
    roas = rng.uniform(0.6, 5.0, size=n)
    return pd.DataFrame(
        {
            "campaign_id": [f"CAMP{i:02d}" for i in range(1, n + 1)],
            "campaign_name": CAMPAIGN_NAMES,
            "spend": spend,
            "attributed_revenue": np.round(spend * roas, 2),
        }
    )


@lru_cache(maxsize=4)
def get_mock_deliveries_df(n_rows: int = DEFAULT_DELIVERY_ROWS, seed: int | None = None) -> pd.DataFrame:
    rng = np.random.default_rng(DEFAULT_SEED if seed is None else seed)
    delayed = rng.random(n_rows) < 0.18
    ratings = rng.normal(4.5, 0.45, size=n_rows)
    ratings[delayed] = np.clip(rng.normal(3.1, 0.7, size=int(delayed.sum())), 1.0, 5.0)
    return pd.DataFrame(
        {
            "delivery_id": "DEL" + pd.Series(np.arange(1, n_rows + 1)).astype(str).str.zfill(8),
            "partner_name": pd.Categorical(rng.choice(PARTNERS, size=n_rows), categories=PARTNERS),
            "is_delayed": delayed,
            "rating": np.round(np.clip(ratings, 1.0, 5.0), 2),
        }
    )


@lru_cache(maxsize=1)
def get_mock_inventory_df(seed: int | None = None) -> pd.DataFrame:
    rng = np.random.default_rng(DEFAULT_SEED if seed is None else seed)
    combos = [(s, p) for s in STORE_REGION_MAP for p in PRODUCT_BASE_PRICE]
    n = len(combos)
    return pd.DataFrame(
        {
            "inventory_id": "INV" + pd.Series(np.arange(1, n + 1)).astype(str).str.zfill(4),
            "store_id": pd.Categorical([s for s, _ in combos], categories=list(STORE_REGION_MAP)),
            "product_id": pd.Categorical([p for _, p in combos], categories=list(PRODUCT_BASE_PRICE)),
            "stock_on_hand": rng.integers(0, 501, size=n),
            "reorder_point": rng.integers(20, 121, size=n),
            "unit_cost": np.round([PRODUCT_BASE_PRICE[p][1] * 0.70 for _, p in combos], 2),
            "last_restocked": pd.to_datetime(
                END_DATE - rng.integers(0, 181, size=n).astype("timedelta64[D]")
            ).date,
        }
    )


@lru_cache(maxsize=1)
def get_mock_targets_df(seed: int | None = None) -> pd.DataFrame:
    rng = np.random.default_rng(DEFAULT_SEED if seed is None else seed)
    rows = [
        {
            "target_id": f"TG{i:03d}",
            "month": month,
            "region": region,
            "revenue_target": round(float(rng.uniform(14e9, 21e9)), 2),
            "profit_target": round(float(rng.uniform(4.0e9, 6.5e9)), 2),
        }
        for i, (month, region) in enumerate(
            ((m, r) for m in TARGET_MONTHS for r in TARGET_REGIONS), start=1
        )
    ]
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# External data source support (CSV/TSV/Excel/Parquet/JSON)
# ---------------------------------------------------------------------------

SUPPORTED_EXTENSIONS = (".parquet", ".pq", ".csv", ".txt", ".xlsx", ".xls", ".json")

REQUIRED_COLUMNS: dict[str, set[str]] = {
    "sales": {
        "order_id", "date", "store_id", "region", "product_id", "category",
        "sales_amount", "cost_amount", "is_returned", "employee_id",
        "customer_id", "customer_segment",
    },
    "campaigns": {"campaign_id", "campaign_name", "spend", "attributed_revenue"},
    "deliveries": {"delivery_id", "partner_name", "is_delayed", "rating"},
    "inventory": {
        "inventory_id", "store_id", "product_id", "stock_on_hand",
        "reorder_point", "unit_cost", "last_restocked",
    },
    "targets": {"target_id", "month", "region", "revenue_target", "profit_target"},
}

_CATEGORICAL_COLUMNS: dict[str, tuple[str, ...]] = {
    "sales": ("store_id", "region", "product_id", "category", "employee_id", "customer_segment"),
    "deliveries": ("partner_name",),
    "inventory": ("store_id", "product_id"),
}

_DATE_COLUMNS = {
    "sales": ("date",),
    "inventory": ("last_restocked",),
}

_BOOL_COLUMNS = {
    "sales": ("is_returned",),
    "deliveries": ("is_delayed",),
}

_NUMERIC_COLUMNS = {
    "sales": ("sales_amount", "cost_amount"),
    "campaigns": ("spend", "attributed_revenue"),
    "deliveries": ("rating",),
    "inventory": ("stock_on_hand", "reorder_point", "unit_cost"),
    "targets": ("revenue_target", "profit_target"),
}

_TRUTHY = {"true", "t", "yes", "y", "1", "returned", "delayed"}
_FALSY = {"false", "f", "no", "n", "0"}


def _env_uri(table: str) -> str | None:
    return os.getenv(f"NEXASPHERE_{table.upper()}_URI")


def _find_in_data_dir(table: str) -> str | None:
    data_dir = os.getenv("NEXASPHERE_DATA_DIR")
    if not data_dir:
        return None
    for ext in (".parquet", ".pq", ".csv", ".txt", ".xlsx", ".xls", ".json"):
        candidate = Path(data_dir) / f"{table}{ext}"
        if candidate.is_file():
            return str(candidate)
    return None


def read_table(uri: str | Path) -> pd.DataFrame:
    """Read a tabular file by extension. Raises ValueError on unknown formats."""
    path = str(uri)
    low = path.lower()
    if low.endswith((".parquet", ".pq")):
        try:
            return pd.read_parquet(path)
        except ImportError as exc:
            raise ValueError(
                f"Parquet engine missing for '{path}'. Install it with: pip install pyarrow"
            ) from exc
    if low.endswith(".csv"):
        return pd.read_csv(path)
    if low.endswith(".txt"):
        return pd.read_csv(path, sep="\t")
    if low.endswith((".xlsx", ".xls")):
        try:
            return pd.read_excel(path)
        except ImportError as exc:
            raise ValueError(
                f"Excel engine missing for '{path}'. Install it with: pip install openpyxl"
            ) from exc
    if low.endswith(".json"):
        return pd.read_json(path)
    raise ValueError(
        f"Unsupported data format '{path}'. Supported: {', '.join(SUPPORTED_EXTENSIONS)}"
    )


def coerce_schema(table: str, df: pd.DataFrame) -> pd.DataFrame:
    """Validate required columns exist and coerce dtypes to engine contracts."""
    missing = REQUIRED_COLUMNS[table] - set(df.columns)
    if missing:
        raise ValueError(
            f"'{table}' source is missing required column(s): {', '.join(sorted(missing))}"
        )
    out = df.copy()
    for col in _NUMERIC_COLUMNS.get(table, ()):  # numbers
        if not pd.api.types.is_numeric_dtype(out[col]):
            out[col] = pd.to_numeric(out[col], errors="raise")
        if not pd.api.types.is_float_dtype(out[col]):
            out[col] = out[col].astype("float64")
    for col in _DATE_COLUMNS.get(table, ()):  # datetimes
        out[col] = pd.to_datetime(out[col], errors="raise")
    for col in _BOOL_COLUMNS.get(table, ()):  # booleans from strings
        if not pd.api.types.is_bool_dtype(out[col]):
            mapped = out[col].astype(str).str.strip().str.lower().map(
                {**dict.fromkeys(_TRUTHY, True), **dict.fromkeys(_FALSY, False)}
            )
            bad = mapped.isna().sum()
            if bad:
                raise ValueError(
                    f"'{table}.{col}' has {bad} value(s) that are not recognizable booleans "
                    f"(use true/false, yes/no or 1/0)"
                )
            out[col] = mapped.astype(bool)
    for col in _CATEGORICAL_COLUMNS.get(table, ()):
        out[col] = out[col].astype("category")
    return out.reset_index(drop=True)


def resolve_table(table: str) -> pd.DataFrame:
    """External file if configured (URI env or DATA_DIR discovery), else synthetic."""
    uri = _env_uri(table) or _find_in_data_dir(table)
    if uri:
        if not Path(uri).is_file():
            raise FileNotFoundError(f"NexaSphere data source for '{table}' not found: {uri}")
        return coerce_schema(table, read_table(uri))
    generators = {
        "sales": lambda: get_mock_sales_df(),
        "campaigns": lambda: get_mock_campaigns_df(),
        "deliveries": lambda: get_mock_deliveries_df(),
        "inventory": lambda: get_mock_inventory_df(),
        "targets": lambda: get_mock_targets_df(),
    }
    return generators[table]()


@lru_cache(maxsize=1)
def _cached_datasets() -> dict[str, pd.DataFrame]:
    return {table: resolve_table(table) for table in REQUIRED_COLUMNS}


def ds(table: str) -> pd.DataFrame:
    """Cached accessor used by the analysis engines. Treat result as read-only."""
    return _cached_datasets()[table]


def reload_datasets() -> None:
    """Drop the cached frames so new env config / files are picked up."""
    _cached_datasets.cache_clear()


def load_all_datasets() -> dict[str, pd.DataFrame]:  # noqa: F811 — public API now resolves sources
    return dict(_cached_datasets())

