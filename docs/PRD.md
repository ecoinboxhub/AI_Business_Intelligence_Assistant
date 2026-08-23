# Product Requirements Document (PRD) - NexaSphere AI Business Intelligence Assistant

## 1. Problem & Context
NexaSphere Retail Ltd. operates omnichannel physical, online, corporate, and fulfillment hubs. Management receives standard static reports but lacks fast context into profitability drivers, return anomalies, inventory stockouts, and delivery performance.

## 2. Goals & Objectives
Build a fast, lightweight MVP featuring:
- FastAPI Backend running on http://localhost:5050
- React (Vite) Frontend running on http://localhost:3030
- React Native (Expo) Mobile application consuming backend APIs
- Pure Pandas execution for all mathematical/KPI calculations
- Gemini AI Service wrapper for NLU, summary, interpretations, recommendations, and follow-up generation.

## 3. Personas
- Regional Manager: Evaluates regional profit targets & stock distribution.
- Store Manager: Monitors store sales, employee outputs, and product returns.
- Marketing Manager: Reviews ROI across channels and campaigns.
- Executive: Monitors macro revenue vs profit, key business risks, and high-level strategy.

## 4. Architectural Rules
- Zero heavy infrastructure (No Docker, No Kubernetes, No Next.js).
- AI NEVER executes math directly. All numbers are derived programmatically via Pandas analysis functions first.
