# AI_Business_Intelligence_Assistant — NexaSphere AI BI Assistant

Local-first AI Business Intelligence assistant: ask nine management questions in
natural language and get structured answers with charts, findings and
recommendations. **Every number is computed deterministically by Pandas** — the
Gemini LLM only writes the narrative, never the math.

## Applications

| App | Stack | Dev URL |
|---|---|---|
| Backend API | FastAPI + Uvicorn | http://localhost:5050 |
| Web Dashboard | React 18 (Vite) + Recharts + lucide-react | http://localhost:3030 |
| Mobile App | Expo / React Native + gifted-charts | Metro :8081 |

## Quick start

```bash
# Backend (Python 3.10+)
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --port 5050

# Web dashboard
cd frontend
npm install
npm run dev        # strict port 3030

# Mobile
cd mobile
npm install
npx expo start --port 8081
```

Optional `.env` in `backend/`: `GEMINI_API_KEY` (offline narrative fallback is
used automatically when absent), `AI_PROVIDER`, `AI_MODEL`.

Data sources are configurable without code changes — point env vars at external
files or fall back to seeded synthetic data:

```
NEXASPHERE_{SALES|CAMPAIGNS|DELIVERIES|INVENTORY|TARGETS}_URI=path/to/file.csv
NEXASPHERE_DATA_DIR=/folder/with/sales.csv,...
```

Supported formats: CSV, TSV, Excel, Parquet, JSON.

## The nine business questions

1. Which products, stores or regions generate the most revenue and profit?
2. Is revenue growth leading to stronger profitability?
3. Which products have unusually high return rates?
4. Which marketing campaigns generate the best return on investment?
5. Which stores are experiencing stockouts or excess inventory?
6. Which delivery partners are associated with delays or poor customer ratings?
7. Which customer segments are the most valuable?
8. Which employees perform well based on both revenue and profitability?
9. Where is the business failing to meet its targets?

## CI/CD (GitHub Actions)

`.github/workflows/deploy.yml` runs on push/PR to `main` and on `v*` tags:

- **test-backend** — installs Python deps and runs the full pytest suite
  (unit, accuracy benchmark, data-source resolution).
- **deploy-frontend** — builds the Vite app and publishes it to GitHub Pages
  (pushes to `main` only).
- **release-mobile** — on version tags (`v*`), exports the Expo web bundle and
  publishes it as a GitHub Release asset (`mobile-release.zip`).

No repository secrets are required — `GEMINI_API_KEY` is optional at runtime.

## Documentation

See `docs/` for PRD, architecture, data dictionary (incl. external source
loading contract), security and responsible-AI notes.
