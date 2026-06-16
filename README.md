# AI Homebuilding Website

A Next.js web platform with an AI chat assistant that answers homebuyer questions using a live SQL Server database of communities and floor plans, falling back to live web search when the database has no relevant information.

## How it works

The chat assistant uses a two-tier approach for every question:

1. **Database-first** — parses the user's question for structured filters (city, price range, bedroom count, floor plan features) and queries a SQL Server database of communities and floor plans. Supports natural language like "under 750k", "at least 3 bedrooms", "first floor master", "near Apex NC".
2. **Web search fallback** — when the database has no relevant info, Claude uses the `web_search_20260209` server-side tool to fetch current information from the web.

Follow-up questions ("do any of these have a bonus room?") automatically inherit the filters from the previous turn.

## Database

Connects to a SQL Server Express instance (`localhost\SQLEXPRESS`, database `WinStarHomes`) via Windows Authentication. Key tables:

| Table | Contents |
|---|---|
| `Admin_tblCommunities` | 457 communities with city, price range, amenities |
| `Admin_tblFloorplans` | 576 floor plans with beds, baths, sq ft, features (first floor master, bonus room, etc.) |
| `Admin_tblFAQs` | Builder FAQs searchable by keyword |

## Tech Stack

- [Next.js 14](https://nextjs.org/) — React framework with App Router
- [Tailwind CSS](https://tailwindcss.com/) — utility-first styling
- [Claude API](https://anthropic.com) — `claude-sonnet-4-6` with built-in web search
- SQL Server Express — queried via `sqlcmd` (no ORM or driver needed)

## Getting Started

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

A SQL Server Express instance with the `WinStarHomes` database must be running locally. The connection uses Windows Authentication — no credentials needed in `.env.local`.

For production-accurate Tailwind rendering (e.g. screenshots), use the production build:

```bash
npm run build
npm start
```

## Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key from console.anthropic.com |
| `NEXT_PUBLIC_SITE_NAME` | Company name shown in the page title |

## License

MIT
