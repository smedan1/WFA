# WFA — Wallace Financial Advisor

> **Turning Reddit Chaos Into Structured Bad Advice**
>
> **DISCLAIMER**: This app provides absolutely terrible financial advice powered by r/wallstreetbets sentiment and AI hallucination. Do NOT buy or sell anything based on what this app says. Seriously.

## What is this?

WFA monitors r/wallstreetbets via the [Xpoz](https://xpoz.ai) aggregator, uses Claude AI to identify the most hyped buy and sell picks, enriches them with real-time financial data, and presents them in a dark-themed web UI.

## Agents

| Agent | Data Source | Responsibility |
|---|---|---|
| **WallstreetAgent** | Xpoz MCP aggregator (`XPOZ_TOKEN`) | Fetches r/wallstreetbets posts, picks up to 5 BUY & 5 SELL instruments with reasons |
| **GithubAgent** | GitHub REST API (`GITHUB_TOKEN`) | Saves/reads recommendation history and stock analysis cache in this repo |
| **QuotesAgent** | Yahoo Finance v8 (public) | Real-time prices |
| **HistoricalAgent** | Yahoo Finance v8 (public) | Historical OHLCV data for charts |
| **BasicFinancialsAgent** | Yahoo Finance v10 (auto cookie+crumb auth) | Fundamentals and ETF data for manual stock lookup |

## Setup

### Prerequisites

- Node.js >= 18

### Environment Variables

Copy `.env.example` to `.env` in the **repo root** (not `server/`) and fill in:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Get at https://console.anthropic.com |
| `XPOZ_TOKEN` | **Yes** | Bearer token from https://xpoz.ai — required for live Reddit data. Without it and without pre-existing GitHub history, the app has no data source. |
| `GITHUB_TOKEN` | Optional | PAT with `repo` scope — enables history saving and stock analysis cache |
| `GITHUB_REPO_OWNER` | Optional | Your GitHub username |
| `GITHUB_REPO_NAME` | Optional | Repo name (e.g. `WFA`) |
| `CORS_ORIGIN` | Production | Comma-separated allowed origins — defaults to `http://localhost:5173` |

### Install & Run

```bash
# Server
cd server && npm install && npm run dev

# Client (separate terminal)
cd client && npm install && npm run dev
```

- Client: http://localhost:5173
- Server API: http://localhost:3001

## Architecture

```
client/    React 18 + TypeScript + Vite + Tailwind CSS
server/    Express + TypeScript (ESM) + Anthropic SDK
data/
  recommendations/   YYYY-MM-DD-HH.json   hourly WSB pick snapshots
  stock-analysis/    YYYY-MM-DD-HH_*.json  manual analysis cache (30-min TTL)
```

## AI Cost Analysis

**Model**: `claude-sonnet-4-6` — **$3.00 / MTok input · $15.00 / MTok output**

> This section must be kept up to date as AI usage in the app changes.

### Per-operation costs

#### Full recommendations refresh (`POST /api/recommendations/refresh`)

One Claude call in `WallstreetAgent`. Xpoz returns up to 300 posts per call × 3 calls; after deduplication roughly 300–500 unique posts reach Claude. Each post includes title + metadata; posts with body text also include up to 300 chars of `selftext` (~40% of posts).

| Component | Tokens | Cost |
|---|---|---|
| System prompt + JSON schema | ~850 | — |
| Post titles + metadata (~400 × 25 tok) | ~10,000 | — |
| Post body snippets (~160 × 80 tok, ~40% of posts) | ~13,000 | — |
| **Total input** | **~23,850** | **~$0.072** |
| JSON output (10 picks + reasons) | ~700 | **~$0.011** |
| **Total per refresh** | | **~$0.08** |

#### Manual stock analysis (`GET /api/stocks/analyze/:symbol`)

One Claude call in `BasicFinancialsAgent` (skipped on cache hit — in-memory 5 min, GitHub 30 min).

| Component | Tokens | Cost |
|---|---|---|
| System prompt + financials data | ~600 | — |
| **Total input** | **~600** | **~$0.002** |
| JSON output (recommendation + reason) | ~200 | **~$0.003** |
| **Total per analysis** | | **~$0.005** |

### At scale

| Scenario | Refreshes/day | Analyses/day | Est. monthly |
|---|---|---|---|
| Light (personal use) | 1 | 2 | ~$2.70 |
| Moderate | 5 | 10 | ~$14 |
| Maximum (refresh every 60 min) | 24 | — | ~$58 |

The **60-minute recommendation cache** is the natural cost governor — no matter how many concurrent clients hit the server, Claude is called at most 24 times/day for recommendations. The **30-minute GitHub cache** for stock analyses means repeated lookups of the same symbol (across any client or server restart) burn zero AI tokens.
