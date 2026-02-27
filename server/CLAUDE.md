# WFA Server

Express + TypeScript API server. Entry point: `src/index.ts`. Built with `tsc` to `dist/`. Runs as ESM (`"type": "module"`).

## Agent architecture
Agents are lazy-initialized singletons via `src/agents/registry.ts`. All agents are initialized once on first request and reused.

### WallstreetAgent (`src/agents/wallstreet-agent.ts`)
- Fetches posts from **Xpoz** (`https://mcp.xpoz.ai/mcp`) — a Reddit data aggregator with no QPM limit
- Requires `XPOZ_TOKEN` env var (Bearer token from xpoz.ai account)
- Makes 3 serialized calls with 1000ms spacing: `sort=hot`, `sort=top&time=week`, `sort=top&time=month`
- Each call uses the `getRedditPostsByKeywords` MCP tool via raw JSON-RPC over HTTP (no MCP SDK dependency)
- Xpoz returns up to 300 results per call in a compact CSV-like text format; parsed by `parseXpozText`
- Response field mapping: `title`→`title`, `score`→`score`, `commentsCount`→`num_comments`, `createdAtTimestamp` (ISO string)→`created_utc` (Unix seconds)
- Deduplicates posts by title, formats with age/score/comments for Claude
- Sends to `claude-sonnet-4-6` with a structured prompt to identify up to 5 BUY and 5 SELL instruments (stocks or ETFs)
- WSB community referred to as "the bravely uninformed" in the prompt
- Weighting: last week = 10x, last 2 weeks = 3x, last month = 2x
- Returns `{ buy: StockRecommendation[], sell: StockRecommendation[] }`
- Minimum 5 mentions to qualify; exits labelled as: rug pull, pool drain, honeypot, dead cat bounce, pump and dump, liquidity crisis
- If `XPOZ_TOKEN` is missing or Xpoz returns 0 posts, falls through to the GitHub history fallback

### QuotesAgent (`src/agents/quotes-agent.ts`)
- Fetches real-time quotes from Yahoo Finance

### HistoricalAgent (`src/agents/historical-agent.ts`)
- Fetches OHLCV historical data from Yahoo Finance

### BasicFinancialsAgent (`src/agents/basic-financials-agent.ts`)
- Used for manual stock/ETF analysis via the Analyze button
- **Yahoo Finance v10 auth**: Must fetch A3 cookie from `https://fc.yahoo.com`, then crumb from `query2.finance.yahoo.com/v1/test/getcrumb`. Retries on 401.
- Detects ETFs via `quoteType === 'ETF'`; uses `fundProfile` module for ETF-specific data
- Two separate Claude prompts: `STOCK_PROMPT` and `ETF_PROMPT`
- ETF metrics: AUM, expense ratio, category, NAV, yield, beta, inception date
- Stock metrics: market cap, P/E, EPS, revenue, profit margin, debt/equity, current ratio, beta, short float, dividend yield, P/B
- Tone: humorous but financially accurate; dry wit only, no vulgarity
- `generateAdskReason(financials)`: special Claude call for ADSK Easter egg — returns an exaggeratedly bullish BUY reason acknowledging the user is probably an Autodesk employee

### GithubAgent (`src/agents/github-agent.ts`)
- Uses GitHub REST API directly (no MCP) — `PUT /repos/{owner}/{repo}/contents/{path}`
- `saveRecommendations()`: saves hourly snapshot to `data/recommendations/YYYY-MM-DD-HH.json` (UTC hour)
- `getRecentHistory(days)`: lists directory, sorts by filename desc, returns `date` as `YYYY-MM-DD` (hour stripped for display)
- `saveAdskResult(result)`: saves full ADSK Easter egg result to `data/easter-eggs/adsk.json` with `generatedAt` timestamp
- `getAdskResult()`: returns `{ result, generatedAt }` or null; used to check if cached reason is < 30 min old
- `saveStockAnalysis(symbol, result)`: saves manual stock analysis to `data/stock-analysis/YYYY-MM-DD-HH_{SYMBOL}.json` with `generatedAt` timestamp (hourly snapshots like recommendations)
- `getStockAnalysis(symbol)`: returns `{ result, generatedAt }` or null; looks up current-hour file; used to check if cached analysis is < 30 min old
- Falls back gracefully (returns `[]` / `null`) if `GITHUB_TOKEN` is not set
- **Do NOT use `api.githubcopilot.com/mcp/`** — that requires a Copilot subscription token, not a PAT

## Recommendations route (`src/routes/recommendations.ts`)
Cache TTL: 60 minutes (`stdTTL: 3600`). In-flight guard: `fetchInFlight` promise shared across concurrent requests; reset by POST `/refresh`.

Flow on cache miss:
1. If `fetchInFlight` is null, start `doFetchRecommendations()` and store the promise; otherwise join the existing promise
2. WallstreetAgent fetches from Xpoz + calls Claude → raw buy/sell lists
3. QuotesAgent + HistoricalAgent enrich each stock in parallel
4. If buy and sell are both empty → GithubAgent fetches most recent snapshot (fallback)
5. Result cached; if not a fallback and picks exist → GithubAgent saves snapshot (fire-and-forget)
6. Response includes `fromHistory: true` + `historicalDate` when serving fallback data

## Stocks route (`src/routes/stocks.ts`)
Cache TTLs: quotes 15s, historical 1h, analysis 5min in-memory + 30min on GitHub (hourly `YYYY-MM-DD-HH_{SYMBOL}.json` files).

ADSK Easter egg (`GET /api/stocks/analyze/ADSK`):
- Checks `adskResultCache` (30-min NodeCache) first
- Then checks `github.getAdskResult()` — if `generatedAt` < 30 min ago, uses saved result (whole snapshot: financials + reason)
- On cache miss: fetches fresh financial data, calls `basicFinancials.generateAdskReason()`, forces `recommendation: 'BUY'`, saves full result to GitHub (fire-and-forget), caches 30 min
- Financial data and reason are always saved together so they stay consistent

## Types (`src/types/index.ts`)
- `StockRecommendation` — shared buy/sell pick type (includes `instrumentType: 'STOCK' | 'ETF'`)
- `BasicFinancials` — manual analysis financials (stock + ETF fields)
- `RecommendationsResponse` — includes `fromHistory?` and `historicalDate?`

## CORS
`CORS_ORIGIN` env var is comma-separated. Defaults to localhost:5173 for local dev. In production, set to the Railway client URL.
