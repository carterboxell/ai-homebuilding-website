# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Goal

This is a **Ken Harvey Homes** AI assistant — a Next.js web app with an embedded chatbot that answers homebuyer questions specifically for Ken Harvey Homes, a new construction homebuilder in North Carolina. The bot draws on two SQL Server databases and falls back to live web search when the databases have no relevant data.

## Commands

```bash
# Development
npm run dev        # starts Next.js dev server at localhost:3000

# Production (required to see Tailwind styles in screenshots/headless browsers)
npm run build      # compile production build
npm start          # serve the production build

# Node.js must be in PATH on Windows:
# $env:Path += ";C:\Program Files\nodejs"
```

There are no tests or linting scripts configured beyond `next lint`.

## Architecture

**Stack:** Next.js 14 (App Router, JSX, `src/` layout) + Tailwind CSS + `@anthropic-ai/sdk`

**Page:** `src/app/page.jsx` renders three sections in order: `HeroSection` → `FeatureGrid` → `AIChatWidget`.

**Chat data flow:**
1. `AIChatWidget` (client component) sends full message history + `sessionId` to `POST /api/chat`
2. `src/app/api/chat/route.js` calls `getRelevantContext()` from `src/lib/db.js` using the last 3 user messages combined (for follow-up context inheritance)
3. DB context (if found) is injected into Claude's system prompt as Ken Harvey Homes data; Claude also has the `web_search_20260209` server-side tool
4. If `stop_reason === 'pause_turn'` (web search hit iteration limit), the route re-sends to continue
5. Response text blocks are concatenated and returned as `{ reply }`
6. Each exchange is appended to `chat-logs/{sessionId}.md` for testing reference

**Database context (`src/lib/db.js`):** Queries two SQL Server Express databases via `spawnSync('sqlcmd', [...])` — no npm driver needed. Windows Authentication (no credentials in code). The `runQuery(sql, db)` function accepts a `db` parameter defaulting to `'WinStarHomes'`. `getRelevantContext(question)` runs two strategies:

- **Structured:** Parses `maxPrice`, `minBeds`, city mentions, and floor plan features from the question via regex, then queries structured filters against all relevant tables. IDXPlus listings are always queried first.
- **Keyword LIKE:** Extracts content keywords (stop words removed) and runs `LOWER(col) LIKE '%kw%'` against FAQs, communities, and floor plans. Only runs when no structured filters were detected.

## Databases

### IDXPlus (`localhost\SQLEXPRESS`, database `IDXPlus`)
Primary source for **individual home listings**.

- `vwBuilderProperties_TABLE` — 134 rows, all Ken Harvey. Active statuses: `'ACT'`, `'PEND'`, `'Coming Soon'` (32 listings). Exclude `'Closed'` (102 rows).
  - Key columns: `Address`, `City`, `State`, `Price`, `Bedrooms`, `Bathrooms`, `SquareFeet`, `CommunityName`, `Status`, `CompletionDate`, `SchoolElem`, `SchoolJunior`, `SchoolHigh`
  - `CompletionDate = '2199-12-31'` is a placeholder meaning "TBD" — skip in output when `>= '2100-01-01'`
  - Active listing cities: Raleigh (10), Youngsville (9), Louisburg (7), Selma (3), Wendell (2), Durham (1)
- `vwResidentialSearch_TABLE` — 139 Ken Harvey rows, 170 columns. Not currently queried (too wide; `vwBuilderProperties_TABLE` is sufficient).
- `vwResidentialSearch_Media_TABLE` — 263k image/media rows. Not queried.

### WinStarHomes (`localhost\SQLEXPRESS`, database `WinStarHomes`)
Source for **communities, floor plans, and FAQs**.

- `Admin_tblFAQs` — 13 rows, all Ken Harvey (`portalid = 38`). Columns are lowercase: `question`, `answer`, `portalid`. Always filter `WHERE portalid = 38`.
- `Admin_tblCommunities` — 457 rows. `CommunityName`, `City`, `State` (nullable), `MinPrice`, `MaxPrice`.
- `Admin_tblFloorplans` — 576 rows. `FloorplanName`, `MinBedrooms`, `MaxBedrooms`, `MinBaths`, `MaxBaths`, `MinSquareFeet`, `MaxSquareFeet`, `MinPrice`, `MaxPrice`, `Style`, `FirstFloorMaster` (int 0/1), `BonusRoom` (varchar 'Yes'/'No'/'Optional'), `Study` (int), `Basement` (int). **`CommunityID` is 0 for all rows** — floor plans cannot be JOINed to communities.
- `Admin_tblInventory` — not queried. Data is too incomplete (sparse city coverage, NULL community/floorplan links). IDXPlus replaced it.

## sqlcmd quirks

- `-No -C` flags bypass SSL certificate errors on this instance.
- `-h -1` suppresses column headers. `-W` and `-y 0` are mutually exclusive with `-h -1` — use `CAST(... AS nvarchar(N))` in SQL to control output width instead.
- Use `ISNULL(col, '')` on nullable columns in string concatenation — `col + NULL = NULL` produces empty rows.
- Strip `(N rows affected)` lines and HTML tags from stdout in `runQuery()`.

## Claude API

- Shared client in `src/lib/claude.js` (exported as `client`).
- Model: `claude-sonnet-4-6`.
- Web search: server-side tool `{ type: 'web_search_20260209', name: 'web_search' }`. Claude executes automatically — no client-side tool loop needed. Handle `stop_reason === 'pause_turn'` by re-sending with the assistant turn appended.
- System prompt identifies Claude as "the AI assistant for Ken Harvey Homes". Format rules prohibit tables, pipes, horizontal rules, blockquotes, and emojis.

## Environment

Copy `.env.example` to `.env.local` and fill in:
- `ANTHROPIC_API_KEY` — required for all AI features
- `NEXT_PUBLIC_SITE_NAME` — displayed as the page `<title>`

Both DB connections use Windows Authentication — no connection string or credentials needed in `.env.local`.

## Path alias

`@/*` maps to `./src/*` via `jsconfig.json`. PostCSS config (`postcss.config.js`) is required for Tailwind — do not delete it.
