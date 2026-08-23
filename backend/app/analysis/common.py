"""Shared helpers for deterministic analysis functions."""
import pandas as pd


def fmt_naira(x: float) -> str:
    ax = abs(x)
    if ax >= 1e12:
        return f"₦{x / 1e12:.2f}T"
    if ax >= 1e9:
        return f"₦{x / 1e9:.2f}B"
    if ax >= 1e6:
        return f"₦{x / 1e6:.1f}M"
    if ax >= 1e3:
        return f"₦{x / 1e3:.1f}K"
    return f"₦{x:,.2f}"


def require_rows(df: pd.DataFrame | None, table: str, minimum: int = 1) -> None:
    """Fail fast with a clear error when a source frame is too small to analyse."""
    n = 0 if df is None else len(df)
    if n < minimum:
        raise ValueError(
            f"Insufficient '{table}' data for analysis: {n} row(s) available, {minimum} required."
        )


def make_chart(chart_type: str, x_axis: str, y_axis: list, data: list, **extra) -> dict:
    chart = {"type": chart_type, "x_axis": x_axis, "y_axis": y_axis, "data": data}
    chart.update(extra)
    return chart


def result(label: str, facts: dict, chart: dict, metrics: list, findings: list,
           risks: list, recommendations: list, secondary_chart: dict | None = None) -> dict:
    return {
        "label": label,
        "facts": facts,
        "chart": chart,
        "secondary_chart": secondary_chart,
        "metrics": metrics,
        "findings": findings,
        "risks": risks,
        "recommendations": recommendations,
    }
