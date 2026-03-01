import { Router } from 'express';
import type { Request, Response } from 'express';
import NodeCache from 'node-cache';
import type { RecommendationsResponse, StockRecommendation } from '../types/index.js';
import { getAgents } from '../agents/registry.js';

export const recommendationsRouter = Router();

// Cache for 60 minutes — Reddit scraping is expensive
const cache = new NodeCache({ stdTTL: 3600 });
const CACHE_KEY = 'recommendations';

// In-flight guard: all concurrent cache-miss requests share one Reddit fetch
let fetchInFlight: Promise<RecommendationsResponse> | null = null;

async function doFetchRecommendations(): Promise<RecommendationsResponse> {
  const { wallstreet, quotes, historical, github } = await getAgents();

  // Step 1: Get WSB recommendations
  const { buy: rawBuy, sell: rawSell } = await wallstreet.getRecommendations();

  // Step 2: Enrich with real-time quotes and historical data in parallel
  const enrichStock = async (stock: typeof rawBuy[number]) => {
    const [quote, historicalData, intradayData] = await Promise.allSettled([
      quotes.getQuote(stock.symbol),
      historical.getHistoricalPrices(stock.symbol, '3mo', '1d'),
      historical.getHistoricalPrices(stock.symbol, '5d', '1h', true),
    ]);
    return {
      ...stock,
      quote: quote.status === 'fulfilled' ? quote.value : undefined,
      historicalData: historicalData.status === 'fulfilled' ? historicalData.value : undefined,
      intradayData: intradayData.status === 'fulfilled' ? intradayData.value : undefined,
    };
  };

  let [buy, sell]: [StockRecommendation[], StockRecommendation[]] = await Promise.all([
    Promise.all(rawBuy.map(enrichStock)),
    Promise.all(rawSell.map(enrichStock)),
  ]);

  let fromHistory = false;
  let historicalDate: string | undefined;

  // If Reddit returned nothing, fall back to the most recent GitHub snapshot
  if (buy.length === 0 && sell.length === 0) {
    console.log('[recommendations] Reddit returned no data — trying GitHub history fallback');
    const history = await github.getRecentHistory(1).catch(() => []);
    if (history.length > 0) {
      buy = history[0].buy;
      sell = history[0].sell;
      fromHistory = true;
      historicalDate = history[0].date;
      console.log(`[recommendations] Using historical data from ${historicalDate}`);
    }
  }

  const result: RecommendationsResponse = {
    buy,
    sell,
    lastUpdated: new Date().toISOString(),
    ...(fromHistory && { fromHistory: true, historicalDate }),
  };

  cache.set(CACHE_KEY, result);

  // Fire-and-forget: persist to GitHub without blocking the response (skip if no data or using history)
  if (!fromHistory && (buy.length > 0 || sell.length > 0)) {
    github.saveRecommendations({
      buy,
      sell,
      timestamp: result.lastUpdated,
    }).catch((e) => console.warn('[recommendations] GithubAgent save failed:', e.message));
  }

  return result;
}

recommendationsRouter.get('/', async (_req: Request, res: Response) => {
  const cached = cache.get<RecommendationsResponse>(CACHE_KEY);
  if (cached) return res.json({ ...cached, fromCache: true });

  try {
    if (!fetchInFlight) {
      fetchInFlight = doFetchRecommendations().finally(() => { fetchInFlight = null; });
    } else {
      console.log('[recommendations] Joining in-flight fetch');
    }
    const result = await fetchInFlight;
    return res.json(result);
  } catch (err) {
    console.error('[recommendations] Error:', err);
    return res.status(500).json({
      error: 'Failed to fetch recommendations',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

// Force-refresh endpoint: clears cache and resets in-flight so next GET starts a fresh fetch
recommendationsRouter.post('/refresh', async (_req: Request, res: Response) => {
  cache.del(CACHE_KEY);
  fetchInFlight = null;
  return res.json({ message: 'Cache cleared. Next GET will fetch fresh data.' });
});
