import json

from google import genai

from app.core.config import settings
from app.models.schemas import NarrativeInsight
from app.services.llm_service import SYSTEM_INSTRUCTION


class AIService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None

    def explain_analysis(self, question: str, analysis: dict) -> dict:
        """analysis = result dict from a deterministic Pandas function
        (label, facts, chart, secondary_chart, metrics, findings, risks,
        recommendations). Returns the full StructuredBIResponse-compatible dict
        with the chart merged verbatim — never authored by the LLM."""
        if not self.client:
            return self._generate_fallback_response(question, analysis)

        prompt = f"""
        {SYSTEM_INSTRUCTION}

        User Question: {question}
        Analysis Category: {analysis.get('label')}

        Pandas Derived Facts JSON:
        {json.dumps(analysis.get('facts', {}), indent=2, default=str)}

        Pre-computed Metrics:
        {json.dumps(analysis.get('metrics', []), indent=2)}

        Draft Findings (verify against facts, refine wording):
        {json.dumps(analysis.get('findings', []), indent=2)}

        Synthesize this into narrative JSON only (answer, summary, findings,
        risks, recommendations, follow_up_questions).
        """
        try:
            response = self.client.models.generate_content(
                model=settings.AI_MODEL,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": NarrativeInsight,
                },
            )
            narrative = json.loads(response.text)
            return self._merge(question, analysis, narrative)
        except Exception as e:
            print(f"Gemini API Error: {e}")
            return self._generate_fallback_response(question, analysis)

    def _merge(self, question: str, analysis: dict, narrative: dict) -> dict:
        out = {
            "question": question,
            "answer": str(narrative.get("answer", "")),
            "summary": str(narrative.get("summary", "")),
            "metrics": analysis.get("metrics", []),
            "findings": [str(x) for x in narrative.get("findings", [])],
            "risks": [str(x) for x in narrative.get("risks", [])],
            "recommendations": [str(x) for x in narrative.get("recommendations", [])],
            "chart": analysis.get("chart"),
            "follow_up_questions": [str(x) for x in narrative.get("follow_up_questions", [])],
            "confidence": "high",
        }
        self._passthrough_metadata(out, analysis)
        if not out["findings"]:
            out["findings"] = analysis.get("findings", [])
        if not out["risks"]:
            out["risks"] = analysis.get("risks", [])
        if not out["recommendations"]:
            out["recommendations"] = analysis.get("recommendations", [])
        if not out["follow_up_questions"]:
            out["follow_up_questions"] = analysis.get("follow_ups", [])
        return out

    @staticmethod
    def _passthrough_metadata(out: dict, analysis: dict) -> None:
        """Carry routing category, flat chart metadata, risk score and what-if
        cards from the deterministic payload into the final response."""
        for key in ("category", "chart_type", "chart_title", "chart_data",
                    "severity_score", "action_urgency", "severity_rationale",
                    "what_if", "engine"):
            value = analysis.get(key)
            if value is not None:
                out[key] = value
        if not out["findings"]:
            out["findings"] = analysis.get("findings", [])
        if not out["risks"]:
            out["risks"] = analysis.get("risks", [])
        if not out["recommendations"]:
            out["recommendations"] = analysis.get("recommendations", [])
        if not out["follow_up_questions"]:
            out["follow_up_questions"] = analysis.get("follow_ups", [])
        return out

    def _generate_fallback_response(self, question: str, analysis: dict) -> dict:
        label = analysis.get("label", "Analysis")
        facts = analysis.get("facts", {})
        fact_lines = "; ".join(f"{k.replace('_', ' ')}: {v}" for k, v in list(facts.items())[:4])
        out = {
            "question": question,
            "answer": f"{label} — computed deterministically from the dataset. {fact_lines}.",
            "summary": "Calculations processed deterministically via Pandas; AI narrative layer offline.",
            "metrics": analysis.get("metrics", []),
            "findings": analysis.get("findings", []),
            "risks": analysis.get("risks", []),
            "recommendations": analysis.get("recommendations", []),
            "chart": analysis.get("chart"),
            "follow_up_questions": analysis.get(
                "follow_ups",
                [
                    "Which products generate the most revenue and profit?",
                    "Where is the business failing to meet its targets?",
                ],
            ),
            "confidence": "high",
        }
        self._passthrough_metadata(out, analysis)
        return out


ai_service = AIService()
