# WFA — Wallace Financial Advisor

## What this app does
A humorous meme stock advisor that scrapes r/wallstreetbets, uses Claude AI to identify buy/sell picks, enriches them with real-time financial data, and presents them in a dark-themed web UI. It is entertainment only — not financial advice.

Tagline: **"Wallace Financial Advisor — Turning Reddit Chaos Into Structured Bad Advice"**

## Monorepo structure
```
WFA/
  client/         React + Vite + Tailwind frontend
  server/         Express + TypeScript backend (AI agents)
  data/
    recommendations/  YYYY-MM-DD-HH.json hourly snapshots (written by GithubAgent)
    easter-eggs/      adsk.json — ADSK Easter egg result (reason + financials, 30-min TTL)
    stock-analysis/   YYYY-MM-DD-HH_{SYMBOL}.json — manual stock analysis hourly snapshots (30-min TTL)
```

## Tech stack
- **Client**: React 18, TypeScript, Vite 6, Tailwind CSS, JetBrains Mono font
- **Server**: Node 18+, Express, TypeScript (ESM), Anthropic SDK (`claude-sonnet-4-6`)
- **Deployment**: Railway — two separate services (one per workspace root)
- **Data sources**: Xpoz (Reddit aggregator), Yahoo Finance v10, GitHub REST API

## Deployment (Railway)
Two Railway services from the same GitHub repo (`smedan1/WFA`):

**Server service** — Root Directory: `/` (repo root)
- `server/railway.toml`: builder=NIXPACKS, startCommand=`node server/dist/index.js`
- Build runs `tsc` in `server/`, output to `server/dist/`

**Client service** — Root Directory: `client`
- `client/railway.toml`: buildCommand=`npm install && npm run build`, startCommand=`npx vite preview --host 0.0.0.0 --port $PORT --base=/`
- `preview.allowedHosts: true` (boolean) in `vite.config.ts` — required for Railway

## Environment variables

### Server (required)
| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `CORS_ORIGIN` | Comma-separated allowed origins (e.g. `https://wfaclient-production.up.railway.app`) |

### Server (required)
| Variable | Description |
|---|---|
| `XPOZ_TOKEN` | Bearer token from xpoz.ai — required for live Reddit data. Without it and without pre-existing GitHub history, the app has no data source. |

### Server (optional)
| Variable | Description |
|---|---|
| `GITHUB_TOKEN` | Personal Access Token with repo write access — enables history saving |
| `GITHUB_REPO_OWNER` | GitHub username (e.g. `smedan1`) |
| `GITHUB_REPO_NAME` | Repo name (e.g. `WFA`) |

### Client (optional)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Server public URL. Omit for local dev (Vite proxy handles `/api` → localhost:3001) |

## Key design decisions
- **Xpoz for Reddit data**: Uses Xpoz (`https://mcp.xpoz.ai/mcp`) as the Reddit data source — no QPM limit, no IP bans. Calls `getRedditPostsByKeywords` via raw JSON-RPC over HTTP (no MCP SDK needed). `XPOZ_TOKEN` Bearer token required. 3 serialized calls (hot, top-week, top-month) with 1s spacing.
- **No MCP for GitHub**: Uses GitHub REST API (Contents API PUT) directly with a PAT. The Copilot MCP endpoint (`api.githubcopilot.com/mcp/`) requires a Copilot token, not a standard PAT.
- **Reactive server**: No scheduled jobs. Xpoz is only queried when a client requests recommendations.
- **60-minute cache**: Recommendations are cached in-memory (`node-cache`, `stdTTL: 3600`). GitHub history save is fire-and-forget after cache miss.
- **In-flight guard**: All concurrent cache-miss GET requests share a single fetch promise (`fetchInFlight`). POST `/refresh` resets it so forced refreshes always start fresh.
- **GitHub history fallback**: If Xpoz returns 0 posts (or `XPOZ_TOKEN` is unset), the server falls back to the most recent hourly snapshot from `data/recommendations/`. The UI shows an amber banner and "Cached data from YYYY-MM-DD" in the header.
- **GitHub save guard**: History is only saved when Xpoz returns actual picks (not when serving historical fallback data).
- **Stock analysis GitHub cache**: Manual stock lookups (`/api/stocks/analyze/:symbol`) are saved to `data/stock-analysis/YYYY-MM-DD-HH_{SYMBOL}.json` on GitHub (fire-and-forget, hourly snapshots). On subsequent requests within 30 minutes, the GitHub cache is served — enabling cross-client deduplication across server restarts. In-memory cache (5 min) is always checked first.
- **ADSK Easter egg**: When a user manually looks up `ADSK`, the server always returns BUY with a Claude-generated enthusiastic reason based on actual financials. The full result (financials + reason) is cached for 30 minutes in-memory and persisted to `data/easter-eggs/adsk.json` on GitHub for cross-restart persistence.

## Tone and humor guidelines
- Humor style: **dry wit, self-aware, sardonic** — think sharp commentary, not crude jokes
- No vulgar language, potty humor, or profanity in AI-generated text
- WSB community referred to as **"the bravely uninformed"**
- The term "tendies" is acceptable (WSB culture reference, not vulgar)
- Loading messages: pool of 20 rotating humorous messages in ManualLookup (cycle every 5 seconds)

## API routes
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/recommendations` | Get buy/sell picks (cached 60 min, in-flight guard) |
| POST | `/api/recommendations/refresh` | Clear cache |
| GET | `/api/stocks/quote/:symbol` | Real-time quote |
| GET | `/api/stocks/historical/:symbol` | Historical OHLCV data |
| GET | `/api/stocks/analyze/:symbol` | Manual stock/ETF analysis |

## Git conventions
- Commit with `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- Always `git pull --rebase` before push (GithubAgent auto-commits recommendation snapshots)
- `.claude/` and `*.bak` are in `.gitignore`
