# AI Feature Specs

## 1. AI Chat Assistant

**Goal:** Answer buyer questions 24/7 without requiring a sales rep.

**Implementation:** Streaming chat via `POST /api/chat`. Uses a homebuilding-specific system prompt to keep responses on-topic. Falls back gracefully when questions are outside scope.

**Model:** `claude-sonnet-4-6` — balances response quality and latency for conversational use.

---

## 2. Floor Plan Recommender

**Goal:** Match buyers to floor plan styles based on lifestyle inputs rather than spec-shopping.

**Implementation:** Structured JSON output from Claude. The prompt asks for 3 recommendations with `name`, `sqft_range`, `bedrooms`, `bathrooms`, `highlights[]`, and `rationale`. Displayed as cards.

**Inputs collected:** bedrooms, bathrooms, lifestyle description (free text), priority tags.

---

## 3. AI Cost Estimator

**Goal:** Give buyers a realistic ballpark before they engage a sales rep, reducing unqualified leads.

**Implementation:** Structured JSON output including `low_estimate`, `high_estimate`, `cost_per_sqft_range`, `currency`, and `notes`. Displayed as a dark summary card.

**Inputs collected:** square footage, location (city/state), finish level, special features.

---

## Future Features

- **Virtual Staging** — upload an empty room photo, get AI-staged versions in different styles
- **Material & Finish Advisor** — describe a style (e.g. "modern farmhouse") and receive curated material palettes
- **Construction Timeline Estimator** — estimate build timeline based on scope and permit complexity
- **Neighborhood Insights** — AI summaries of school ratings, commute times, and local amenities
