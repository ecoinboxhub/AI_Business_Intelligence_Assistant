# Responsible AI Framework

## 1. Zero Mathematical Hallucination Guarantee
The AI model is never permitted to perform numerical calculations directly. All aggregations, sums, margins, and ratios are calculated programmatically using Pandas in Python.

## 2. Explicit Fact vs Interpretation Segregation
Responses strictly separate:
- Observed Fact: Verified raw metrics derived directly from the underlying dataset.
- Interpretation: Analytical context explaining why the trend exists.
- Recommendation: Decision support suggestions requiring human executive oversight.

## 3. Human Oversight
The AI Business Intelligence Assistant provides decision-support analysis. Recommendations are designed to support human management decisions, not replace managerial discretion.

## 4. Implementation Mapping

| Guarantee | Enforcement Point |
|---|---|
| No AI math | `backend/app/analysis/kpi_engine.py` — sole computation layer; Gemini receives pre-computed facts and returns narrative only |
| Structured output | `StructuredBIResponse` schema (`app/models/schemas.py`) + `SYSTEM_INSTRUCTION` safety rules in `backend/app/ai/service.py` |
| Fact/Interpretation/Recommendation fields | Dedicated `findings`, `risks`, `recommendations` arrays in the response contract; the web & mobile UIs render them under separate labeled sections |
| Fallback integrity | If Gemini is unavailable or errors, `_generate_fallback_response` still serves only Pandas-derived facts |

## 5. Validation

The zero-hallucination guarantee is continuously verified by:
- `backend/tests/test_accuracy.py::test_kpi_mathematical_accuracy` — formula identities re-derived independently.
- `backend/tests/accuracy_benchmark.json` + `test_accuracy_benchmark` — ground-truth business questions answered deterministically through the same routing as `/api/questions`, proving answers derive from data rather than model invention.
