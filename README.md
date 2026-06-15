# AI Homebuilding Website

A Next.js web platform that integrates AI features to enhance the homebuilding and home-buying experience. Built for homebuilders, real estate developers, and their customers.

## Features

- **AI Chat Assistant** — answers buyer questions about floor plans, materials, and pricing 24/7
- **Virtual Staging** — AI-generated room staging previews using the Claude API
- **Smart Cost Estimator** — estimate build costs based on location, size, and material selections
- **Floor Plan Recommender** — personalized floor plan suggestions based on buyer lifestyle inputs
- **Material & Finish Advisor** — AI-curated material palettes matched to buyer style preferences

## Tech Stack

- [Next.js 14](https://nextjs.org/) — React framework with App Router
- [Tailwind CSS](https://tailwindcss.com/) — utility-first styling
- [Claude API](https://anthropic.com) — AI features (chat, recommendations, generation)
- [Vercel](https://vercel.com/) — deployment

## Getting Started

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
  app/           # Next.js App Router pages
  components/    # Reusable UI components
  lib/           # API clients and utilities
  hooks/         # Custom React hooks
docs/            # Feature specs and design notes
```

## Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key from console.anthropic.com |
| `NEXT_PUBLIC_SITE_NAME` | Builder company name shown in UI |

## License

MIT
