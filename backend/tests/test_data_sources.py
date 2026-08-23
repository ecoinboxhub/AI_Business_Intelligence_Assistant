"""Tests for external data source resolution, format readers and schema coercion.

Covers the env-configured loading contract documented in DATA_DICTIONARY.md:
NEXASPHERE_{TABLE}_URI / NEXASPHERE_DATA_DIR -> read_table() -> coerce_schema()
with synthetic generators as fallback.
"""
from pathlib import Path

import pandas as pd
import pytest

import app.data.mock_dataset as md
from app.analysis.value_analysis import rank_campaign_roi

TABLES = ("sales", "campaigns", "deliveries", "inventory", "targets")


@pytest.fixture(autouse=True)
def _isolate_env(monkeypatch):
    """Clear every source-selection env var and reset the frame cache."""
    for table in TABLES:
        monkeypatch.delenv(f"NEXASPHERE_{table.upper()}_URI", raising=False)
    monkeypatch.delenv("NEXASPHERE_DATA_DIR", raising=False)
    md.reload_datasets()
    yield
    md.reload_datasets()


def campaigns_frame() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "campaign_id": ["CAMP01", "CAMP02"],
            "campaign_name": ["Alpha Push", "Beta Blitz"],
            "spend": [1_000_000.0, 2_000_000.0],
            "attributed_revenue": [3_500_000.0, 1_000_000.0],
        }
    )


# ---------------------------------------------------------------------------
# read_table: supported formats round-trip
# ---------------------------------------------------------------------------

def test_read_table_csv(tmp_path: Path):
    path = tmp_path / "campaigns.csv"
    campaigns_frame().to_csv(path, index=False)
    out = md.read_table(path)
    assert len(out) == 2
    assert set(out.columns) == md.REQUIRED_COLUMNS["campaigns"]


def test_read_table_tsv(tmp_path: Path):
    path = tmp_path / "campaigns.txt"
    campaigns_frame().to_csv(path, sep="\t", index=False)
    out = md.read_table(path)
    assert list(out["campaign_name"]) == ["Alpha Push", "Beta Blitz"]


def test_read_table_json(tmp_path: Path):
    path = tmp_path / "targets.json"
    md.get_mock_targets_df().head(6).to_json(path, orient="records")
    out = md.read_table(path)
    assert len(out) == 6
    assert md.REQUIRED_COLUMNS["targets"] <= set(out.columns)


def test_read_table_parquet(tmp_path: Path):
    pytest.importorskip("pyarrow")
    path = tmp_path / "deliveries.parquet"
    md.get_mock_deliveries_df(n_rows=50).to_parquet(path, index=False)
    out = md.read_table(path)
    assert len(out) == 50


def test_read_table_excel(tmp_path: Path):
    pytest.importorskip("openpyxl")
    path = tmp_path / "inventory.xlsx"
    md.get_mock_inventory_df().to_excel(path, index=False)
    out = md.read_table(path)
    assert len(out) == 30


def test_read_table_rejects_unknown_format(tmp_path: Path):
    path = tmp_path / "dump.feather"
    path.write_bytes(b"nope")
    with pytest.raises(ValueError, match="Unsupported data format"):
        md.read_table(path)


# ---------------------------------------------------------------------------
# coerce_schema: dtype contracts + validation errors
# ---------------------------------------------------------------------------

def test_coerce_schema_converts_strings_to_numbers_dates_bools():
    raw = pd.DataFrame(
        {
            "order_id": ["ORD1", "ORD2"],
            "date": ["2026-01-05", "2026-02-11"],
            "store_id": ["STORE_LAGOS", "STORE_KANO"],
            "region": ["Lagos", "Kano"],
            "product_id": ["PROD_TV", "PROD_PHONE"],
            "category": ["Appliances", "Phones"],
            "sales_amount": ["450000", "280000"],
            "cost_amount": ["300000", "200000"],
            "is_returned": ["yes", "0"],
            "employee_id": ["EMP01", "EMP02"],
            "customer_id": ["CUS1", "CUS2"],
            "customer_segment": ["Retail Walk-in", "Wholesale"],
        }
    )
    out = md.coerce_schema("sales", raw)
    assert str(out["date"].dtype).startswith("datetime64")
    assert out["sales_amount"].dtype == "float64"
    assert out["is_returned"].dtype == bool
    assert bool(out.loc[0, "is_returned"]) is True
    assert bool(out.loc[1, "is_returned"]) is False
    for col in ("store_id", "region", "category"):
        assert isinstance(out[col].dtype, pd.CategoricalDtype)


def test_coerce_schema_missing_required_column_raises():
    bad = campaigns_frame().drop(columns=["spend"])
    with pytest.raises(ValueError, match="missing required column.*spend"):
        md.coerce_schema("campaigns", bad)


def test_coerce_schema_unparseable_boolean_raises():
    df = md.get_mock_deliveries_df(n_rows=5).copy()
    df["is_delayed"] = ["maybe"] * 5
    with pytest.raises(ValueError, match="not recognizable booleans"):
        md.coerce_schema("deliveries", df)


# ---------------------------------------------------------------------------
# resolve_table: env selection, discovery, precedence, failure modes
# ---------------------------------------------------------------------------

def test_env_uri_routes_external_csv_through_ds(tmp_path: Path, monkeypatch):
    path = tmp_path / "external_campaigns.csv"
    campaigns_frame().to_csv(path, index=False)
    monkeypatch.setenv("NEXASPHERE_CAMPAIGNS_URI", str(path))
    md.reload_datasets()

    c = md.ds("campaigns")
    assert float(c.loc[c["campaign_id"] == "CAMP01", "attributed_revenue"].iloc[0]) == 3_500_000.0
    assert md.get_mock_campaigns_df is not None  # generator untouched, just unused


def test_data_dir_discovery_finds_targets_json(tmp_path: Path, monkeypatch):
    (tmp_path / "targets.json").write_text(
        pd.DataFrame(
            {
                "target_id": ["TG001"],
                "month": ["2026-08"],
                "region": ["Lagos"],
                "revenue_target": [15_000_000_000.0],
                "profit_target": [5_000_000_000.0],
            }
        ).to_json(orient="records"),
        encoding="utf-8",
    )
    monkeypatch.setenv("NEXASPHERE_DATA_DIR", str(tmp_path))
    md.reload_datasets()

    t = md.ds("targets")
    assert len(t) == 1
    assert t["revenue_target"].sum() == 15_000_000_000.0


def test_explicit_uri_wins_over_data_dir(tmp_path: Path, monkeypatch):
    data_dir = tmp_path / "dir"
    data_dir.mkdir()
    campaigns_frame().to_json(data_dir / "campaigns.json", orient="records")
    uri_file = tmp_path / "explicit.csv"
    campaigns_frame().to_csv(uri_file, index=False)

    monkeypatch.setenv("NEXASPHERE_DATA_DIR", str(data_dir))
    monkeypatch.setenv("NEXASPHERE_CAMPAIGNS_URI", str(uri_file))
    md.reload_datasets()

    c = md.ds("campaigns")
    assert c["spend"].dtype == "float64"  # CSV variant loaded, not JSON dir file


def test_missing_source_file_raises_file_not_found(monkeypatch):
    monkeypatch.setenv("NEXASPHERE_INVENTORY_URI", "Z:/nowhere/inventory.csv")
    md.reload_datasets()
    with pytest.raises(FileNotFoundError, match="inventory"):
        md.ds("inventory")


def test_reload_datasets_picks_up_new_config(tmp_path: Path, monkeypatch):
    assert md.ds("targets")["region"].nunique() == 5  # synthetic baseline
    (tmp_path / "only_one.csv").write_text(
        "target_id,month,region,revenue_target,profit_target\nTG999,2026-08,Kano,1e9,2e8\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("NEXASPHERE_TARGETS_URI", str(tmp_path / "only_one.csv"))
    md.reload_datasets()
    assert len(md.ds("targets")) == 1


# ---------------------------------------------------------------------------
# Engines are fed by load_all_datasets()/ds() regardless of source
# ---------------------------------------------------------------------------

def test_engine_computes_from_external_csv(tmp_path: Path, monkeypatch):
    path = tmp_path / "campaigns.csv"
    campaigns_frame().to_csv(path, index=False)  # CAMP01 ROAS=3.5, CAMP02 ROAS=0.5
    monkeypatch.setenv("NEXASPHERE_CAMPAIGNS_URI", str(path))
    md.reload_datasets()

    res = rank_campaign_roi()
    best = max(res["chart"]["data"], key=lambda r: r["ROI %"])
    assert best["Campaign"] == "Alpha Push"
    assert best["ROI %"] == 250.0  # (3.5M − 1M) / 1M × 100 from the external file


def test_load_all_datasets_returns_every_table_with_contract_dtypes():
    frames = md.load_all_datasets()
    assert set(frames) == set(TABLES)
    sales = frames["sales"]
    assert str(sales["date"].dtype).startswith("datetime64")
    assert sales["is_returned"].dtype == bool
    assert isinstance(sales["region"].dtype, pd.CategoricalDtype)


def test_ds_is_cached_identity():
    assert md.ds("inventory") is md.ds("inventory")
