# NMSA — Not MEME Stocks Advice

> **DISCLAIMER**: This app provides absolutely terrible financial advice. Do NOT buy or sell anything based on what this app says. Seriously.

## What is this?

NMSE-APP is a web application that monitors r/wallstreetbets to surface the most hyped meme stocks, then uses AI agents to analyze, rate, and summarize them — all while firmly reminding you that none of this is financial advice.

## Agents

| Agent | MCP Server | Responsibility |
|---|---|---|
| **WallstreetAgent** | `vinod827/mcp-server-reddit` | Scrapes r/wallstreetbets, scores popularity, picks top 5 buy & sell |
| **GithubAgent** | `https://api.githubcopilot.com/mcp/` | Reads/stores recommendation history in this repo |
| **QuotesAgent** | Yahoo Finance (`get_stock_quote`) | Fetches real-time stock prices |
| **HistoricalAgent** | Yahoo Finance (`get_historical_prices`) | Fetches historical price data for charts |
| **BasicFinancialsAgent** | Stock Market (`get_basic_financials`) | Fetches fundamentals for manual stock lookup |

## Setup

### Prerequisites

- Node.js >= 18
- npm >= 9
- API Keys (see below)

### Environment Variables

Copy `.env.example` to `.env` in the `server/` directory and fill in:

```bash
cp .env.example server/.env
```

**Required:**
- `ANTHROPIC_API_KEY` — Get at https://console.anthropic.com
- `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` — Get at https://www.reddit.com/prefs/apps (create a "script" app)
- `GITHUB_TOKEN` — Get at https://github.com/settings/tokens (needs `repo` scope)

### MCP Servers

The app uses the following MCP servers. Install them globally or they will be fetched via `npx`:

```bash
# Reddit MCP
npx -y @vinod827/mcp-server-reddit

# Yahoo Finance MCP (provides get_stock_quote, get_historical_prices)
npx -y mcp-yahoo-finance

# Stock Market MCP (provides get_basic_financials)
npx -y mcp-stock-market
```

> **Note**: If the exact npm package names differ, update `server/src/config/mcp.ts` accordingly.

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
server/          Express + TypeScript + Anthropic SDK + MCP clients
```
