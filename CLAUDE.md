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

## After Making Changes

After every code change, rebuild and restart. The server runs on port **3001** when paired with the DNN test site:

```powershell
$env:Path += ";C:\Program Files\nodejs"
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Set-Location "C:\ClaudeCodeTest\ai-homebuilding-website"
npm run build
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "node_modules/next/dist/bin/next","start","-p","3001" -RedirectStandardOutput "logs\stdout.log" -RedirectStandardError "logs\stderr.log"
```

Verify with: `Invoke-WebRequest http://localhost:3001 -UseBasicParsing` → 200.

## DNN Integration (test.kenharveyhomes.com)

The Next.js app is not accessed directly by users — it runs as a backend service on port 3001. The user-facing widget lives in the DNN Aperture skin:

- **ASHX proxy**: `C:\DNN_Platform_10.2.2_Install\ai-chat.ashx` — forwards browser POSTs from DNN to `http://localhost:3001/api/chat`. Same-origin to the browser, so no CORS. All buttons must have `type="button"` and no `<form>` tags — DNN wraps every page in `<form runat="server">` which captures submits.
- **Widget**: Appended to `C:\DNN_Platform_10.2.2_Install\Portals\_default\Skins\Aperture\default.ascx`. Pure static HTML/CSS/vanilla JS — **never use `<%= %>`, `<%: %>`, or `<%# %>` render blocks** in this file, they crash DNN with "Controls collection cannot be modified". The widget's `renderMessage()` function HTML-escapes text, converts `\n` to `<br>`, and converts `[text](url)` markdown links to `<a target="_blank">` tags.

## Architecture

**Stack:** Next.js 14 (App Router, JSX, `src/` layout) + Tailwind CSS + `@anthropic-ai/sdk`

**Page:** `src/app/page.jsx` renders three sections in order: `HeroSection` → `FeatureGrid` → `AIChatWidget`.

**Chat data flow:**
1. `AIChatWidget` (client component) sends full message history + `sessionId` to `POST /api/chat`
2. `src/app/api/chat/route.js` calls `getRelevantContext(currentText, recentText)` from `src/lib/db.js`. `currentText` is the latest message only; `recentText` is the last 3 messages combined. City/location is always parsed from `currentText` so a new city in the current message overrides prior context. Price, bedroom count, and floor plan features are parsed from `recentText` to inherit those filters across follow-up turns.
3. DB context (if found) is injected into Claude's system prompt as Ken Harvey Homes data; Claude also has the `web_search_20260209` server-side tool
4. If `stop_reason === 'pause_turn'` (web search hit iteration limit), the route re-sends to continue
5. Response text blocks are joined with `' '` (a space) and returned as `{ reply }` — joining without a separator produces run-together sentences when Claude returns multiple blocks
6. Each exchange is appended to `chat-logs/{sessionId}.md` for testing reference; `chat-logs/` is in `.gitignore` so logs stay local

**Database context (`src/lib/db.js`):** Queries two SQL Server Express databases via `spawnSync('sqlcmd', [...])` — no npm driver needed. Windows Authentication (no credentials in code). The `runQuery(sql, db)` function accepts a `db` parameter defaulting to `'WinStarHomes'`. `getRelevantContext(currentText, contextText)` runs two strategies:

- **Structured:** Parses `maxPrice`, `minBeds`, city mentions, and floor plan features via regex, then queries structured filters against all relevant tables. IDXPlus listings are always queried first. `parseMinBeds` normalises written-out numbers ("three" → 3) before applying digit regex, so "at least three bedrooms" works the same as "at least 3 bedrooms".
- **Keyword LIKE:** Extracts content keywords (stop words removed) and runs `LOWER(col) LIKE '%kw%'` against FAQs, communities, and floor plans. Only runs when no structured filters were detected. `'ken'` and `'harvey'` are in the stop words list — they are builder-name words, not content keywords, and would otherwise false-match community/city names like "Kenlan Farms" or "Kenly".

## Databases

### IDXPlus (`localhost\SQLEXPRESS`, database `IDXPlus`)
Primary source for **individual home listings**.

- `vwBuilderProperties_TABLE` — 134 rows, all Ken Harvey. Active statuses: `'ACT'`, `'PEND'`, `'Coming Soon'` (32 listings). Exclude `'Closed'` (102 rows).
  - Key columns: `Address`, `City`, `State`, `Price`, `Bedrooms`, `Bathrooms`, `SquareFeet`, `CommunityName`, `CommunityNameEncoded`, `MLS`, `Status`, `CompletionDate`, `SchoolElem`, `SchoolJunior`, `SchoolHigh`
  - `CompletionDate = '2199-12-31'` is a placeholder meaning "TBD" — skip in output when `>= '2100-01-01'`
  - Active listing cities: Raleigh (10), Youngsville (9), Louisburg (7), Selma (3), Wendell (2), Durham (1)
- `vwResidentialSearch_TABLE` — 139 Ken Harvey rows, 170 columns. Not currently queried (too wide; `vwBuilderProperties_TABLE` is sufficient).
- `vwResidentialSearch_Media_TABLE` — 263k image/media rows. Not queried.

### WinStarHomes (`localhost\SQLEXPRESS`, database `WinStarHomes`)
Source for **communities, floor plans, and FAQs**.

- `Admin_tblFAQs` — 13 rows, all Ken Harvey (`portalid = 38`). Columns are lowercase: `question`, `answer`, `portalid`. Always filter `WHERE portalid = 38`.
- `Admin_tblCommunities` — 457 rows from 29 builders. **Always filter using `COMM_BASE`** (defined in `db.js`): `PortalID = 38 AND Publish = 1 AND PresaleAvail = 1` — Ken Harvey has 22 total but only **17 published/presale-available** communities should be shown to users. Never show unpublished or presale=0 communities (e.g. `*NEW COMMUNITY`, `Bellingham`, `River Manor`, `Meadows of Banks`, `Waterstone`). Columns: `CommunityName`, `City`, `State` (nullable), `MinPrice`, `MaxPrice`, `PortalID`, `Publish` (bit), `PresaleAvail` (bit), `CommunityID`.
- `Admin_tblFloorplans` — 576 rows from 16 builders. **Always filter `WHERE PortalID = 38`** — Ken Harvey has 54 floor plans. Columns: `FloorplanName`, `MinBedrooms`, `MaxBedrooms`, `MinBaths`, `MaxBaths`, `MinSquareFeet`, `MaxSquareFeet`, `MinPrice`, `MaxPrice`, `Style`, `FirstFloorMaster` (int 0/1), `BonusRoom` (varchar 'Yes'/'No'/'Optional'), `Study` (int), `Basement` (int), `PortalID`, `FloorplanID`. **`MinPrice = 0` for all 54 KHH floor plans** — price data is not populated. When a user asks to filter floor plans by price, `db.js` detects this (no `| $` in results) and appends a NOTE to the context so Claude can acknowledge the limitation. **`CommunityID` is 0 for all rows** — floor plans cannot be JOINed to communities.
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
- System prompt identifies Claude as "the AI assistant for Ken Harvey Homes". Format rules prohibit tables, pipes, horizontal rules, blockquotes, and emojis. Claude is instructed to format floor plans, communities, and listings as markdown links `[Name](url)` when a URL is present in the database context (marked as `URL: https://...`). The DNN widget's `renderMessage()` renders these as clickable `<a target="_blank">` tags.

## URL Patterns (kenharveyhomes.com)

URLs are pre-built in SQL inside `db.js` and appended to each row as `| URL: https://kenharveyhomes.com/...`. All communities use `MarketID=29` (Raleigh, NC).

| Type | Pattern |
|------|---------|
| Floor plan | `/Find-Your-Home/New-Floor-Plans/Floorplan-Details/id/{FloorplanID}` |
| Community | `/Neighborhood/Raleigh-NC/{REPLACE(City,' ','-')}-NC/cid/{CommunityID}/{REPLACE(CommunityName,' ','-')}-Homes-For-Sale` |
| Listing | `/Find-Your-Home/Available-Homes/Details/MLS/{MLS}/{REPLACE(City,' ','-')}/Real-Estate/{CommunityNameEncoded}-Homes` |

`CommunityNameEncoded` for listings comes directly from `vwBuilderProperties_TABLE`. Community and floor plan names use `REPLACE(name, ' ', '-')` in SQL.

## Environment

Copy `.env.example` to `.env.local` and fill in:
- `ANTHROPIC_API_KEY` — required for all AI features
- `NEXT_PUBLIC_SITE_NAME` — displayed as the page `<title>`

Both DB connections use Windows Authentication — no connection string or credentials needed in `.env.local`.

## Path alias

`@/*` maps to `./src/*` via `jsconfig.json`. PostCSS config (`postcss.config.js`) is required for Tailwind — do not delete it.

---

## Planned Next Feature: Conversational Lead Capture

**Goal:** Get homebuyers to share contact info (email/phone) inside the chat, without popup forms. Claude asks naturally at high-intent moments; the user types into the normal chat box.

### Three trigger moments

| Moment | What Claude says | Info collected |
|---|---|---|
| User browses floor plans or specific listings | "Drop your email below and I'll have our team send you these details." | Email |
| No listings match the user's criteria | "Want us to notify you when something matching your search becomes available? Just leave your email." | Email |
| User asks about tours, financing, next steps, or timeline | "Want a quick call with our team? Leave your phone or email below." | Phone or email |

Claude offers contact collection **at most once per session** (enforced in system prompt via conversation history awareness).

### Files to create / modify

**`src/app/api/chat/route.js`** — Two additions:
1. Before calling Claude, run `extractContactInfo(currentUserText)` using email + phone regex. If contact info is found, write `leads/{sessionId}.json` (same pattern as `chat-logs/`).
2. Append lead-capture instructions to `formatRules` in the system prompt (when to ask, how to phrase it, not to repeat).

**`leads/`** folder (gitignored) — JSON files, one per session, written by route.js when email/phone is detected in a user message. Schema: `{ sessionId, email, phone, capturedAt }`.

**`.gitignore`** — Add `leads/`.

### Lead record file format (`leads/{sessionId}.md`)

One file per session, written when the user provides email or phone. All fields map directly to `ProspectsRevealed.admin_usermessages` columns:

- `uniqueID` — the session's `crypto.randomUUID()` value
- `PRClientID` — `fe5f5ca2-fbc0-4329-b2a9-7297f5ba0904` (Ken Harvey Homes in ProspectsRevealed)
- `usertype` — `chatbot`
- `ipaddress` — captured server-side from `x-forwarded-for` / `x-real-ip` headers
- `email` / `phone` — extracted from user message via regex
- `message` — the chat log filename (`{sessionId}.md`), not the chat content
- `URL` — `https://kenharveyhomes.com`

### Importing leads into the database

```powershell
node scripts/import-leads.js
```

Upserts all files in `leads/` into `ProspectsRevealed.admin_usermessages`, then moves each imported file to `leads/imported/`. Safe to re-run — already-imported files are not re-processed.

**Prerequisite (one-time, run in SSMS):**
```sql
ALTER TABLE admin_usermessages ADD phone VARCHAR(50) NULL
```

### What's deferred
- Email notification to Ken Harvey team (SMTP/SendGrid) — add credentials to `.env.local` when ready
- CRM integration
- Admin dashboard — use SSMS to query `ProspectsRevealed.dbo.admin_usermessages` for now
