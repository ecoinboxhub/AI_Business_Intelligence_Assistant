# Security Framework - NexaSphere AI BI Assistant

Demarcation of **implemented MVP controls** versus **recommended production enhancements**.

## 1. Implemented Controls (MVP)

### 1.1 Deterministic Execution Plane
- The LLM cannot execute code, queries, or arithmetic. Questions are mapped to a fixed registry of Pandas functions; parameters flow through typed Pydantic validation (`QuestionRequest`) before reaching the analysis layer.
- No `eval`/`exec`, no SQL, no shell invocation anywhere in the request path. Natural-language input never touches data storage — Pandas operates on in-memory frames only.

### 1.2 Output Contract Enforcement
- All `/api/questions` responses are validated against `StructuredBIResponse` (FastAPI `response_model`). Malformed or injected content in narrative fields cannot alter the JSON contract or execute client-side logic beyond normal text rendering.

### 1.3 Secrets Handling
- `GEMINI_API_KEY`, `AI_PROVIDER`, `AI_MODEL` load from environment / `.env` via `pydantic-settings` (`app/core/config.py`). No secrets in source control.
- Graceful degraded mode: with no API key configured, the app runs fully on the fallback path and makes zero external calls.

### 1.4 Read-Only Data Plane
- Dataset generators return cached frames treated as immutable; analysis functions never mutate source data. There is no write endpoint in the entire API surface.

### 1.5 CORS
- Explicit origin allowlist enforced via `CORSMiddleware` (default: `http://localhost:3030`, `http://127.0.0.1:3030`, `https://ecoinboxhub.github.io`; override with the `CORS_ORIGINS` env var). Native mobile clients send no `Origin` header and are unaffected.

## 2. Recommended Production Enhancements

| Area | Enhancement |
|---|---|
| Transport | TLS termination; HSTS behind reverse proxy |
| AuthN/AuthZ | JWT/OAuth2 per PRD persona (Regional/Store/Marketing/Executive) with RBAC-scoped endpoints and row-level region filtering |
| Rate limiting | Per-client throttling (e.g., slowapi) on `/api/questions` to bound LLM cost & abuse |
| Prompt injection | Input length caps; strip/flag instruction-like payloads; keep intent mapping allowlist-based (already structural); log-and-review flagged inputs |
| Content safety | Server-side content filtering on LLM output before display; profanity/PII screening |
| CORS | Allowlist already enforced; extend `CORS_ORIGINS` when adding new dashboard origins |
| Secrets | Move to a managed secret store (e.g., Azure Key Vault); rotate keys; per-environment isolation |
| Auditability | Append-only query + response audit log (who asked what, which analysis function ran, data snapshot hash) |
| Data integrity | Checksum/sign datasets; validate schema on load; version ground-truth benchmarks |
| Supply chain | Pin dependencies (done), run `pip-audit` / `npm audit` in CI; SBOM generation |
| Mobile | Certificate pinning for `:5050` API calls in release builds |

## 3. Known MVP Gaps (Accepted for Local Development)

1. No authentication on API endpoints — anyone with network reach to :5050 can query all business data.
2. Single shared dataset in memory — no multi-tenant isolation.
3. Narrative text from the LLM is rendered without sanitization beyond framework defaults — apply explicit escaping if rich text is ever introduced.
