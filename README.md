# WFA — Wallace Financial Advisor

> **DISCLAIMER**: This app provides absolutely terrible financial advice. Do NOT buy or sell anything based on what this app says. Seriously.

## What is this?

WFA is a web application that monitors r/wallstreetbets to surface the most hyped meme stocks and ETFs, then uses AI agents to analyze, rate, and summarize them — all while firmly reminding you that none of this is financial advice.

## Agents

| Agent | Data Source | Responsibility |
|---|---|---|
| **WallstreetAgent** | Reddit public JSON API (no credentials needed) | Scrapes r/wallstreetbets, scores popularity, picks up to 5 buy & sell (stocks + ETFs) |
| **GithubAgent** | GitHub MCP API | Reads/stores recommendation history in this repo |
| **QuotesAgent** | Yahoo Finance v8 API (public) | Fetches real-time prices |
| **HistoricalAgent** | Yahoo Finance v8 API (public) | Fetches historical price data for charts |
| **BasicFinancialsAgent** | Yahoo Finance v10 API (cookie+crumb auth, automatic) | Fetches fundamentals and ETF data for manual lookup |

## Setup

### Prerequisites

- Node.js >= 18
- npm >= 9

### Environment Variables

Copy `.env.example` to `.env` in the `server/` directory and fill in:

```bash
cp .env.example server/.env
```

**Required:**
- `ANTHROPIC_API_KEY` — Get at https://console.anthropic.com

**Optional:**
- `GITHUB_TOKEN` — Get at https://github.com/settings/tokens (needs `repo` scope) — only needed for the GithubAgent feature
- `GITHUB_REPO_OWNER` / `GITHUB_REPO_NAME` — your repo details for GithubAgent

> No Reddit credentials are required. The app uses Reddit's public JSON API (`reddit.com/r/wallstreetbets/*.json`).
> Yahoo Finance authentication (cookie + crumb) is handled automatically by the server at startup.

### Install & Run

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Architecture

```
client/          React + TypeScript + Vite + Tailwind + Recharts
server/          Express + TypeScript + Anthropic SDK
```
