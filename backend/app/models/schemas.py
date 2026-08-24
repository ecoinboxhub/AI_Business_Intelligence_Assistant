from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class QuestionRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None


class SimulateRequest(BaseModel):
    scenario: str  # reduce_delivery_delays | reduce_returns | close_target_gap | shift_campaign_spend
    pct: float = 15.0


class MetricItem(BaseModel):
    label: str
    value: str


class ChartConfig(BaseModel):
    type: str  # "bar", "line", "pie"
    x_axis: str
    y_axis: List[str]
    data: List[Dict[str, Any]]


class StructuredBIResponse(BaseModel):
    question: str
    answer: str
    summary: str
    category: Optional[str] = None
    metrics: List[MetricItem]
    findings: List[str]
    risks: List[str]
    recommendations: List[str]
    chart: Optional[ChartConfig] = None
    chart_type: Optional[str] = None
    chart_title: Optional[str] = None
    chart_data: Optional[List[Dict[str, Any]]] = None
    follow_up_questions: List[str]
    confidence: str = "high"
    # --- Innovation layer (additive, computed deterministically) ---
    severity_score: Optional[int] = None          # 0-100 executive escalation score
    action_urgency: Optional[str] = None          # MONITOR / STANDARD / HIGH_PRIORITY / CRITICAL
    severity_rationale: Optional[str] = None
    what_if: Optional[List[Dict[str, Any]]] = None  # quantified scenario levers
    engine: Optional[str] = None                    # "duckdb" | "pandas" provenance


class NarrativeInsight(BaseModel):
    """Narrative-only schema the LLM is allowed to fill. No numbers authored here."""

    answer: str
    summary: str
    findings: List[str]
    risks: List[str]
    recommendations: List[str]
    follow_up_questions: List[str]
