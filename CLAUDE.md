# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
1. `AIChatWidget` (client component) sends full message history to `POST /api/chat`
2. `src/app/api/chat/route.js` calls `getRelevantContext(lastMessage)` from `src/lib/db.js`
3. DB context (if found) is injected into Claude's system prompt; Claude also always has the `web_search_20260209` server-side tool
4. If `stop_reason === 'pause_turn'` (web search hit iteration limit), the route re-sends to continue
5. Response text blocks are concatenated and returned as `{ reply }`

**Database context (`src/lib/db.js`):** Queries SQL Server Express (`localhost\SQLEXPRESS`, database `WinStarHomes`) via `spawnSync('sqlcmd', [...])` — no npm driver needed. Windows Authentication is used (no credentials in code). The function `getRelevantContext(question)` runs two query strategies:

- **Structured:** Parses `maxPrice`, `minBeds`, and city mentions from the question text using regex, then runs `WHERE City IN (...)`, `WHERE MinPrice <= N`, `WHERE MinBedrooms >= N` clauses against `Admin_tblCommunities` and `Admin_tblFloorplans`. City names expand to nearby Triangle NC cities via the `CITY_GROUPS` map.
- **Keyword LIKE:** Extracts content keywords (stop words removed) and runs `LOWER(col) LIKE '%kw%'` against FAQ, community, and floor plan tables. Only runs community/floorplan keyword search when no structured filters were detected.

**Key DB schema facts:**
- `Admin_tblFAQs` — columns are lowercase: `question`, `answer`, `portalid`. Ken Harvey Homes entries use `portalid=38`.
- `Admin_tblCommunities` — `CommunityName`, `City`, `State` (nullable), `MinPrice`, `MaxPrice`. 457 rows across multiple builders.
- `Admin_tblFloorplans` — `FloorplanName`, `MinBedrooms`, `MaxBedrooms`, `MinBaths`, `MaxBaths`, `MinSquareFeet`, `MaxSquareFeet`, `MinPrice`, `MaxPrice`, `Style`. 576 rows. **`CommunityID` is 0 for all rows** — floor plans are not linked to communities via JOIN.
- `Admin_tblInventory` — 84 rows, 11 active (`CurrentStatus='ACT'`). Only 26 rows have `City` populated (Raleigh, Fuquay-Varina, Clayton, Wendell in NC; several TN cities). `Community` and `Floorplan` columns are NULL for all rows.

**sqlcmd quirks:**
- `-No -C` flags are required to bypass SSL certificate errors on this instance.
- `-h -1` suppresses column headers. `-W` and `-y 0` are mutually exclusive with `-h -1`, so format output using `CAST(... AS nvarchar(N))` inside the SQL instead of relying on display-width flags.
- Use `ISNULL(col, '')` on nullable columns in string concatenation — SQL string + NULL = NULL, which produces empty output rows.
- Strip `(N rows affected)` lines and HTML tags from stdout in `runQuery()`.

**Claude API:**
- Shared client in `src/lib/claude.js` (exported as `client`).
- Model: `claude-sonnet-4-6`.
- Web search uses the server-side tool `{ type: 'web_search_20260209', name: 'web_search' }`. Claude executes searches automatically — no client-side tool loop needed. Handle `stop_reason === 'pause_turn'` by re-sending with the assistant turn appended.

## Environment

Copy `.env.example` to `.env.local` and fill in:
- `ANTHROPIC_API_KEY` — required for all AI features
- `NEXT_PUBLIC_SITE_NAME` — displayed as the page `<title>`

The DB connection uses Windows Authentication; no connection string or credentials are needed in `.env.local`.

## Path alias

`@/*` maps to `./src/*` via `jsconfig.json`. PostCSS config (`postcss.config.js`) is required for Tailwind — do not delete it.
