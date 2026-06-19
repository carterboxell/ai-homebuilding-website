# AI Feature Specs

## 1. AI Chat Assistant

**Goal:** Answer buyer questions 24/7 without requiring a sales rep.

**Implementation:** Streaming chat via `POST /api/chat`. Uses a homebuilding-specific system prompt to keep responses on-topic. Falls back gracefully when questions are outside scope.

**Model:** `claude-sonnet-4-6` — balances response quality and latency for conversational use.

---

## Future Features

- **Virtual Staging** — upload an empty room photo, get AI-staged versions in different styles
- **Material & Finish Advisor** — describe a style (e.g. "modern farmhouse") and receive curated material palettes
- **Construction Timeline Estimator** — estimate build timeline based on scope and permit complexity
- **Neighborhood Insights** — AI summaries of school ratings, commute times, and local amenities
