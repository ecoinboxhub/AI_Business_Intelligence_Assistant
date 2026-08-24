import asyncio
import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.ai.service import ai_service
from app.analysis.duckdb_engine import init_duckdb_tables, run_fast_query
from app.analysis.kpi_engine import calculate_top_level_kpis, generate_executive_insights
from app.analysis.revenue_analysis import (
    analyze_growth_vs_profitability,
    analyze_revenue_profit_drivers,
    rank_employee_performance,
)
from app.analysis.risk_analysis import (
    detect_return_anomalies,
    evaluate_delivery_partners,
    evaluate_target_attainment,
)
from app.analysis.risk_scoring import score_analysis
from app.analysis.value_analysis import (
    audit_inventory_health,
    profile_customer_segments,
    rank_campaign_roi,
)
from app.analysis.whatif import scenarios_for, simulate
from app.core.config import settings
from app.models.schemas import QuestionRequest, SimulateRequest, StructuredBIResponse
from app.services.llm_service import get_llm_service

INTENT_REGISTRY = [
    {
        "id": "revenue_profit_drivers",
        "label": "Which products, stores or regions generate the most revenue and profit?",
        "patterns": ["most revenue", "generate the most", "top product", "top store",
                      "top region", "revenue and profit", "highest profit", "best selling"],
        "fn": analyze_revenue_profit_drivers,
    },
    {
        "id": "growth_vs_profitability",
        "label": "Is revenue growth leading to stronger profitability?",
        "patterns": ["growth", "leading to stronger", "profitability trend", "month over month",
                      "growing profitability"],
        "fn": analyze_growth_vs_profitability,
    },
    {
        "id": "return_anomalies",
        "label": "Which products have unusually high return rates?",
        "patterns": ["return rate", "unusually high return", "high return", "returned most"],
        "fn": detect_return_anomalies,
    },
    {
        "id": "campaign_roi",
        "label": "Which marketing campaigns generate the best return on investment?",
        "patterns": ["campaign", "roi", "roas", "marketing", "return on investment"],
        "fn": rank_campaign_roi,
    },
    {
        "id": "inventory_health",
        "label": "Which stores are experiencing stockouts or excess inventory?",
        "patterns": ["stockout", "stock out", "inventory", "excess stock", "overstock",
                      "out of stock"],
        "fn": audit_inventory_health,
    },
    {
        "id": "delivery_partners",
        "label": "Which delivery partners are associated with delays or poor customer ratings?",
        "patterns": ["delivery", "delayed", "delays", "partner", "rating", "courier"],
        "fn": evaluate_delivery_partners,
    },
    {
        "id": "customer_segments",
        "label": "Which customer segments are the most valuable?",
        "patterns": ["customer segment", "segments", "valuable customer"],
        "fn": profile_customer_segments,
    },
    {
        "id": "employee_performance",
        "label": "Which employees perform well based on both revenue and profitability?",
        "patterns": ["employees perform well", "employee", "staff", "rep performance", "salesperson"],
        "fn": rank_employee_performance,
    },
    {
        "id": "target_attainment",
        "label": "Where is the business failing to meet its targets?",
        "patterns": ["target", "failing to meet", "goals", "quota", "miss"],
        "fn": evaluate_target_attainment,
    },
]


def resolve_intent(question: str):
    """Deterministic keyword scoring. Score = total length of matched patterns,
    so specific long phrases outrank generic short keywords on ties."""
    q = question.lower()
    best, best_score = None, 0
    for entry in INTENT_REGISTRY:
        score = sum(len(p) for p in entry["patterns"] if p in q)
        if score > best_score:
            best, best_score = entry, score
    return best


def _run_analysis(entry: dict) -> dict:
    """Execute an analysis function, converting data errors into HTTP errors."""
    try:
        return entry["fn"]()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


DUCKDB_QUERY_BY_INTENT = {
    "revenue_profit_drivers": "top_regions",
    "return_anomalies": "high_returns",
    "campaign_roi": "campaign_roi",
    "delivery_partners": "delivery_perf",
    "inventory_health": "inventory_health",
    "customer_segments": "segment_value",
    "growth_vs_profitability": "monthly_growth",
    "employee_performance": "employee_perf",
    "target_attainment": "target_attainment",
}


def _attach_metadata(res: dict, entry: dict | None = None) -> dict:
    """Expose flat schema fields (category/chart_type/chart_title/chart_data),
    the deterministic risk score and what-if scenario cards."""
    res.setdefault("category", entry["id"] if entry else None)
    chart = res.get("chart")
    if chart:
        res["chart_type"] = chart.get("type")
        res["chart_title"] = res.get("label") or chart.get("x_axis")
        res["chart_data"] = chart.get("data", [])
    if entry is not None:
        res.update(score_analysis(entry["id"], res.get("facts", {})))
        res["what_if"] = scenarios_for(entry["id"])
        res["engine"] = "duckdb+pandas"
    return res


app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "port": settings.PORT, "data_loaded": True}


@app.get("/api/kpis")
def get_kpis():
    return calculate_top_level_kpis()


@app.get("/api/insights")
def get_insights():
    """Proactive anomaly insights — computed live from the dataset by Pandas."""
    return generate_executive_insights()


@app.get("/api/catalog")
def get_catalog():
    return [
        {"id": e["id"], "label": e["label"]}
        for e in INTENT_REGISTRY
    ]


@app.get("/api/analysis/{intent_id}")
def run_analysis(intent_id: str):
    entry = next((e for e in INTENT_REGISTRY if e["id"] == intent_id), None)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Unknown analysis '{intent_id}'")
    res = _run_analysis(entry)
    res["follow_ups"] = [e["label"] for e in INTENT_REGISTRY if e["id"] != intent_id][:3]
    _attach_metadata(res, entry)
    res.pop("follow_ups", None)
    return res


@app.post("/api/questions", response_model=StructuredBIResponse)
def ask_question(request: QuestionRequest):
    entry = resolve_intent(request.question)

    if entry is None:
        return StructuredBIResponse(
            question=request.question,
            answer=(
                "I couldn't map that to a supported analysis. "
                "I can answer questions like the ones suggested below — try one!"
            ),
            summary="Intent not recognized; no deterministic analysis was executed.",
            metrics=[],
            findings=[],
            risks=[],
            recommendations=[],
            chart=None,
            follow_up_questions=[e["label"] for e in INTENT_REGISTRY[:5]],
            confidence="medium",
        )

    analysis = _run_analysis(entry)
    analysis["follow_ups"] = [
        e["label"] for e in INTENT_REGISTRY if e["id"] != entry["id"]
    ][:3]
    _attach_metadata(analysis, entry)

    structured_res = ai_service.explain_analysis(
        question=request.question,
        analysis=analysis,
    )
    return structured_res


@app.post("/api/questions/stream")
async def ask_question_stream(payload: QuestionRequest):
    """Server-Sent Events stream: live progress states, then the full envelope
    as the final event. Contract-compatible with POST /api/questions."""
    entry = resolve_intent(payload.question)

    async def event_generator():
        if entry is None:
            fallback = StructuredBIResponse(
                question=payload.question,
                answer=(
                    "I couldn't map that to a supported analysis. "
                    "I can answer questions like the ones suggested below — try one!"
                ),
                summary="Intent not recognized; no deterministic analysis was executed.",
                metrics=[], findings=[], risks=[], recommendations=[],
                chart=None,
                follow_up_questions=[e["label"] for e in INTENT_REGISTRY[:5]],
                confidence="medium",
            )
            yield f"data: {json.dumps({'status': 'complete', 'result': fallback.model_dump()})}\n\n"
            return

        yield f"data: {json.dumps({'status': 'Calculating metrics via DuckDB engine...'})}\n\n"
        await asyncio.sleep(0.05)

        analysis = await asyncio.to_thread(_run_analysis, entry)
        analysis["follow_ups"] = [
            e["label"] for e in INTENT_REGISTRY if e["id"] != entry["id"]
        ][:3]
        _attach_metadata(analysis, entry)

        metric_key = DUCKDB_QUERY_BY_INTENT.get(entry["id"])
        metric_data = await asyncio.to_thread(run_fast_query, metric_key) if metric_key else []
        yield f"data: {json.dumps({'status': 'Synthesizing executive findings...', 'metric_data': metric_data})}\n\n"
        await asyncio.sleep(0.05)

        yield f"data: {json.dumps({'status': 'Scoring executive severity...'})}\n\n"

        final_response = await asyncio.to_thread(
            get_llm_service().explain_analysis,
            payload.question,
            analysis,
        )
        yield f"data: {json.dumps({'status': 'complete', 'result': final_response})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/simulate")
def run_simulation(request: SimulateRequest):
    """Deterministic what-if scenario engine (DuckDB/Pandas ground truth)."""
    init_duckdb_tables()
    try:
        return simulate(request.scenario, request.pct)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
