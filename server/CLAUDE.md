# WFA Server

Express + TypeScript API server. Entry point: `src/index.ts`. Built with `tsc` to `dist/`. Runs as ESM (`"type": "module"`).

## Agent architecture
Agents are lazy-initialized singletons via `src/agents/registry.ts`. All agents are initialized once on first request and reused.

### WallstreetAgent (`src/agents/wallstreet-agent.ts`)
- Fetches posts from `old.reddit.com/r/wallstreetbets` (hot + top week + top month, 100 each)
- User-Agent: `script:WFA:1.0 (by /u/wfa_bot)` — Reddit's required format
- Deduplicates posts by title, formats with age/score/comments for Claude
- Sends to `claude-sonnet-4-6` with a structured prompt to identify up to 5 BUY and 5 SELL instruments (stocks or ETFs)
- WSB community referred to as "the bravely uninformed" in the prompt
- Weighting: last week = 10x, last 2 weeks = 3x, last month = 2x
- Returns `{ buy: StockRecommendation[], sell: StockRecommendation[] }`
- Minimum 5 mentions to qualify; exits labelled as: rug pull, pool drain, honeypot, dead cat bounce, pump and dump, liquidity crisis

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

### GithubAgent (`src/agents/github-agent.ts`)
- Uses GitHub REST API directly (no MCP) — `PUT /repos/{owner}/{repo}/contents/{path}`
- `saveRecommendations()`: saves daily snapshot to `data/recommendations/YYYY-MM-DD.json`
- `getRecentHistory(days)`: lists directory, sorts by filename desc (YYYY-MM-DD), fetches N most recent
- Falls back gracefully (returns `[]`) if `GITHUB_TOKEN` is not set
- **Do NOT use `api.githubcopilot.com/mcp/`** — that requires a Copilot subscription token, not a PAT

## Recommendations route (`src/routes/recommendations.ts`)
Flow on cache miss:
1. WallstreetAgent fetches Reddit + calls Claude → raw buy/sell lists
2. QuotesAgent + HistoricalAgent enrich each stock in parallel
3. If buy and sell are both empty → GithubAgent fetches most recent snapshot (fallback)
4. Result cached for 30 minutes (`stdTTL: 1800`)
5. If not a fallback and picks exist → GithubAgent saves snapshot (fire-and-forget)
6. Response includes `fromHistory: true` + `historicalDate` when serving fallback data

## Types (`src/types/index.ts`)
- `StockRecommendation` — shared buy/sell pick type (includes `instrumentType: 'STOCK' | 'ETF'`)
- `BasicFinancials` — manual analysis financials (stock + ETF fields)
- `RecommendationsResponse` — includes `fromHistory?` and `historicalDate?`

## CORS
`CORS_ORIGIN` env var is comma-separated. Defaults to localhost:5173 for local dev. In production, set to the Railway client URL.
