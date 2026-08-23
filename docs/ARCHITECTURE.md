# Architecture - NexaSphere AI Business Intelligence Assistant

## 1. Overview

NexaSphere is a lightweight, local-first AI Business Intelligence assistant composed of three applications that share a single backend:

| Application | Stack | URL |
|---|---|---|
| Backend API | FastAPI + Uvicorn | http://localhost:5050 |
| Web Dashboard | React (Vite) | http://localhost:3030 |
| Mobile App | React Native (Expo) | Consumes backend APIs over LAN/emulator loopback |

All business mathematics are executed by deterministic **Pandas** functions. The **Gemini** LLM is a language layer only — it never produces numbers.

## 2. Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Presentation Layer                                     │
│  React Dashboard (:3030)   │   Expo Mobile App          │
└──────────────┬──────────────────────────┬───────────────┘
               │      HTTP / JSON         │
┌──────────────▼──────────────────────────▼───────────────┐
│  API Layer (FastAPI :5050)                              │
│  Routers, request validation, CORS, error envelopes     │
└──────────────┬──────────────────────────────────────────┘
┌──────────────▼──────────────────────────────────────────┐
│  Orchestration Layer (app/ai)                           │
│  Gemini wrapper: NLU intent parsing, narrative          │
│  generation, interpretation, recommendations, follow-ups│
└──────────────┬──────────────────────────────────────────┘
┌──────────────▼──────────────────────────────────────────┐
│  Analysis Layer (app/analysis)                          │
│  Pure Pandas KPI/analysis functions — the ONLY place    │
│  where math happens. Returns verified numeric results.  │
└──────────────┬──────────────────────────────────────────┘
┌──────────────▼──────────────────────────────────────────┐
│  Data Layer (app/data)                                  │
│  Source resolution (env URI / DATA_DIR / synthetic),    │
│  format readers (CSV·TSV·Excel·Parquet·JSON),           │
│  schema coercion + caching for Pandas                   │
└─────────────────────────────────────────────────────────┘
```

### Request Flow

```
User question
  → POST /api/questions { question }
  → resolve_intent(): deterministic keyword scoring against
    INTENT_REGISTRY (9 registered analyses) — no LLM involved
  → Router invokes the corresponding Pandas analysis function
  → Pandas returns structured numeric results incl. a chart payload
    (label, facts, chart{type,x_axis,y_axis,data}, metrics, findings,
     risks, recommendations seeds)
  → AI Service (Gemini): generates ONLY the natural-language answer,
    strictly grounded in those results (NarrativeInsight schema)
  → Chart/metrics are merged verbatim from the Pandas payload;
    StructuredBIResponse returned to client
```

If no intent matches, the API still returns a valid envelope with
`chart: null`, `confidence: "medium"`, and suggested `follow_up_questions`
drawn from the catalog — never free-form numeric guessing.

## 3. Non-Reliance on Direct LLM Math Execution

This is a hard architectural invariant:

1. **The AI NEVER executes math directly.** Every number in every response originates from programmatic Pandas execution.
2. The LLM's role is strictly:
   - **NLU**: map a natural-language question to a registered analysis function plus typed parameters.
   - **Narrative**: generate summaries, interpretations, recommendations, and follow-up questions *describing* results it received — never inventing them.
3. LLM output is treated as untrusted prose. Numeric answers are never parsed out of model text; they are injected from the Pandas result payload.
4. Intent routing itself is deterministic (`resolve_intent()` keyword scoring over `INTENT_REGISTRY`); the LLM is invoked only after numeric results exist, under a `NarrativeInsight` response schema, and a deterministic offline fallback produces equivalent narrative from result seeds if Gemini is unavailable.
5. This guarantees reproducibility, auditability, and testability (`backend/tests` covers analysis functions with exact-value assertions).

## 4. Port Constraints

Ports are fixed and must not be changed:

| Service | Port | Notes |
|---|---|---|
| FastAPI Backend | **5050** | `uvicorn app.main:app --port 5050` |
| Vite Frontend | **3030** | `vite --port 3030` (strictPort) |
| Metro Bundler (Expo) | **8081** | `npx expo start --port 8081` |

- Backend CORS allows origin `http://localhost:3030`.
- Mobile builds target the backend via LAN IP or emulator loopback alias
  (`http://10.0.2.2:5050/api` on the Android emulator), configurable in the
  mobile Settings screen and persisted via AsyncStorage.

## 5. Repository Layout

```
nexasphere-bi-assistant/
├── docs/                    # PRD, architecture, data dictionary, security, responsible AI
├── backend/
│   ├── requirements.txt
│   ├── app/
│   │   ├── core/            # config, settings (config.py)
│   │   ├── models/          # schemas.py (StructuredBIResponse, NarrativeInsight)
│   │   ├── analysis/        # kpi_engine, revenue_analysis, risk_analysis,
│   │   │                    # value_analysis, common (fmt_naira, make_chart, result)
│   │   ├── ai/              # service.py: narrative-only Gemini wrapper + offline fallback
│   │   └── data/            # mock_dataset.py: source resolution (NEXASPHERE_*_URI /
│   │                        # NEXASPHERE_DATA_DIR → CSV/TSV/Excel/Parquet/JSON readers →
│   │                        # schema coercion) + seeded synthetic fallbacks; ds() accessor
│   └── tests/               # test_api, test_accuracy (+ accuracy_benchmark.json),
│                            # test_intents, test_data_sources
├── frontend/
│   └── src/
│       ├── components/      # ChartRenderer, ChatMessage, ui (Sidebar/BottomNav/KPICard)
│       ├── pages/           # Dashboard, Assistant, Performance
│       ├── utils/           # format.js (₦ formatting, sanitized md-lite)
│       └── services/        # api.js client for :5050
└── mobile/
    ├── App.js               # NavigationContainer + bottom tabs (dark navy chrome)
    └── src/
        ├── screens/         # DashboardScreen, AssistantScreen, ReportsScreen,
        │                    # SettingsScreen (persisted API base URL)
        ├── components/      # ChartView (react-native-gifted-charts)
        ├── theme.js         # shared design tokens + ₦ formatting
        └── services/        # api.js client (AsyncStorage-configurable base URL)
```

## 6. API Contract

### Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Liveness + AI availability |
| `/api/kpis` | GET | Top-level KPI dict (net revenue, gross profit, margins, return rate, delivery delays, target attainment, …) |
| `/api/insights` | GET | Proactive anomaly insights **computed live by Pandas** (`generate_executive_insights()`): weakest-margin region, delay leader, return hotspot, below-target regions + matching recommendations |
| `/api/catalog` | GET | The 9 registered analyses `{id, label}` for UI chips |
| `/api/analysis/{intent_id}` | GET | Run one registered analysis directly |
| `/api/questions` | POST | Natural-language question → routed via `resolve_intent()` (specificity-weighted keyword scoring: total length of matched patterns decides ties) |

### Intent Catalog (`INTENT_REGISTRY`)

| id | Analysis function | Chart type(s) |
|---|---|---|
| `revenue_profit_drivers` | analyze_revenue_profit_drivers | grouped_column + donut |
| `growth_vs_profitability` | analyze_growth_vs_profitability | combo (dual axis) |
| `return_anomalies` | detect_return_anomalies | bar_threshold (ReferenceLine) |
| `campaign_roi` | rank_campaign_roi | horizontal_bar + funnel |
| `inventory_health` | audit_inventory_health | treemap (status-colored) |
| `delivery_partners` | evaluate_delivery_partners | bubble + bar |
| `customer_segments` | profile_customer_segments | pie + column |
| `employee_performance` | rank_employee_performance | grouped_column + scatter_quadrant |
| `target_attainment` | evaluate_target_attainment | bullet_column |

### StructuredBIResponse (success envelope)

The response carries the nested `chart` payload **plus** flat convenience fields
(`category`, `chart_type`, `chart_title`, `chart_data`) derived from it — both
shapes stay in sync and either may be consumed by clients.

```json
{
  "question": "Which marketing campaigns generate the best return on investment?",
  "label_context": "see chart_title",
  "category": "campaign_roi",
  "answer": "AI narrative — grounded ONLY in the numeric payload below.",
  "summary": "One-line summary of what was computed.",
  "confidence": "high",
  "metrics": [{ "label": "Best ROI", "value": "Festive Blitz · 312%" }],
  "chart_type": "horizontal_bar",
  "chart_title": "Marketing campaign ROI ranking",
  "chart_data": [{ "Campaign": "Festive Blitz", "ROI %": 312.4 }],
  "chart": {
    "type": "horizontal_bar",
    "x_axis": "Campaign",
    "y_axis": ["ROI %"],
    "data": [{ "Campaign": "Festive Blitz", "ROI %": 312.4 }]
  },
  "secondary_chart": { "type": "funnel", "...": "..." },
  "findings": ["Programmatic observations computed in Pandas"],
  "risks": ["Risk notes derived from thresholds"],
  "recommendations": ["Actionable next steps"],
  "follow_up_questions": ["Suggested drill-downs"]
}
```

Unknown questions return the same envelope with `chart: null`,
`confidence: "medium"`, a generic answer, and catalog suggestions in
`follow_up_questions`.

### Error Response

```json
{
  "detail": "Unknown analysis id 'xyz'. See /api/catalog."
}
```

(404 from `/api/analysis/{intent_id}` when the id is not registered.)

## 7. Technology Constraints

- Zero heavy infrastructure: **no Docker, no Kubernetes, no Next.js**.
- All services run as local processes during the MVP phase.
- Configuration via `.env` loaded through `pydantic-settings` (`backend/app/core/config.py`): `GEMINI_API_KEY`, `AI_PROVIDER`, `AI_MODEL`, `PORT`.
- Data sources (loaded by `app/data/mock_dataset.py`): per-table `NEXASPHERE_{SALES|CAMPAIGNS|DELIVERIES|INVENTORY|TARGETS}_URI` file paths or a `NEXASPHERE_DATA_DIR` folder; synthetic generators are the fallback. External frames are schema-checked and dtype-coerced before analysis — see DATA_DICTIONARY.md → *External Data Sources*.
- Brand system (web `frontend/src/theme.js`, mobile `mobile/src/theme.js`): Deep Slate surfaces `#0F172A`/`#1E293B`, Indigo primary `#4F46E5`, Sky `#0EA5E9`, Emerald `#10B981`, Amber `#F59E0B`, Crimson `#EF4444`, light background `#F8FAFC`. Icons via `lucide-react` (web) and `@expo/vector-icons` Ionicons (mobile).
