# WFA Client

React 18 + TypeScript + Vite 6 + Tailwind CSS SPA. Entry: `src/main.tsx` → `src/App.tsx`.

## Key components

| Component | Purpose |
|---|---|
| `App.tsx` | Root — manages state, fetches recommendations, renders all panels |
| `Header.tsx` | Sticky header with title, tagline, timestamp, Refresh button (with countdown), disclaimer bar |
| `WarningModal.tsx` | Full-screen disclaimer modal on first visit (sessionStorage key: `wfa_warning_accepted`) |
| `StockCard.tsx` | Individual buy/sell card — shows symbol, price, chart, "Wallace Says:" reason, metrics |
| `ManualLookup.tsx` | Manual ticker analysis — search form + result with BUY/SELL badge, chart, fundamentals |
| `StockChart.tsx` | Recharts line chart for 3-month historical prices |
| `LoadingState.tsx` | Spinning loader with rotating humorous messages (pool of 30, cycles every 5 seconds) |

## API client (`src/api/client.ts`)
Base URL: `VITE_API_URL + '/api'`. In local dev, `VITE_API_URL` is empty and Vite proxies `/api` → `localhost:3001`. In production, set `VITE_API_URL` to the Railway server public URL.

## Tailwind custom tokens (`tailwind.config.js`)
```
buy.DEFAULT    #22c55e   (green text)
buy.bg         #052e16   (green background)
buy.border     #166534   (green border)
sell.DEFAULT   #ef4444   (red text)
sell.bg        #2d0a0a   (red background)
sell.border    #991b1b   (red border)
surface.DEFAULT      #111827
surface.elevated     #1f2937
surface.card         #1a2035
accent         #fbbf24   (yellow)
```
Font: JetBrains Mono (loaded from Google Fonts in `index.html`).

## Mobile responsiveness
- Viewport meta is set in `index.html`
- Stock grid: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5` (single column on mobile)
- WarningModal: `items-start sm:items-center overflow-y-auto py-4 sm:py-0` — scrollable on mobile so checkbox and button are reachable
- ManualLookup result header: `flex-col sm:flex-row` — stacks on mobile, side-by-side on sm+
- Header hides timestamp on small screens (`hidden md:block`)

## Refresh button behaviour (`Header.tsx`)
- `CACHE_TTL_MS = 60 * 60 * 1000` — must match server's `stdTTL: 3600`
- Countdown computed from `lastUpdated + CACHE_TTL_MS`; ticks every second via `setInterval`
- Button shows `MM:SS` countdown and is disabled while `remaining > 0`
- `showCountdown = remaining > 0 && !hasError && !fromHistory` — error or historical fallback bypasses countdown so users can retry immediately
- `isDisabled = isLoading || showCountdown`
- Button shows `Loading...` while `isLoading`, `MM:SS` while locked, `Refresh` when ready

## Loading screen behaviour (`App.tsx`)
- Initial disclaimer dismiss: `holdLoading = true` for 5 seconds so users can read humorous messages even if data arrives early
- Loading screen shown whenever `loading || holdLoading` — this includes during Refresh (cards are hidden)
- Cards shown only when `recommendations && !loading && !holdLoading`
- Error shown only when `error && !loading && !holdLoading`

## Historical data fallback UI
When `recommendations.fromHistory === true`:
- Amber banner below header: "Live data unavailable — showing saved picks from YYYY-MM-DD. Hit Refresh to try again."
- Header timestamp changes from `Updated HH:MM:SS` (grey) to `Cached data from YYYY-MM-DD` (yellow)

## ETF support
- ETFs show a blue "ETF" badge on StockCard
- Market cap label shows "AUM" instead of "MCap" for ETFs
- Buy/sell headings: "Top N Meme Stocks & ETFs to Buy/Sell Now"

## Deployment (Railway)
- Root Directory: `client`
- `railway.toml` build: `npm install && npm run build`
- `railway.toml` start: `npx vite preview --host 0.0.0.0 --port $PORT --base=/`
- `vite.config.ts` must have `preview: { allowedHosts: true }` (boolean, not string `'all'`)
- Must have `client/src/vite-env.d.ts` with `/// <reference types="vite/client" />` for `import.meta.env` TypeScript support
