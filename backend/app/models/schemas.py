from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class QuestionRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None


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


class NarrativeInsight(BaseModel):
    """Narrative-only schema the LLM is allowed to fill. No numbers authored here."""

    answer: str
    summary: str
    findings: List[str]
    risks: List[str]
    recommendations: List[str]
    follow_up_questions: List[str]
