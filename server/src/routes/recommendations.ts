import { Router } from 'express';
import type { Request, Response } from 'express';
import NodeCache from 'node-cache';
import type { RecommendationsResponse } from '../types/index.js';
import { getAgents } from '../agents/registry.js';

export const recommendationsRouter = Router();

// Cache for 10 minutes — Reddit scraping is expensive
const cache = new NodeCache({ stdTTL: 600 });
const CACHE_KEY = 'recommendations';

recommendationsRouter.get('/', async (_req: Request, res: Response) => {
  const cached = cache.get<RecommendationsResponse>(CACHE_KEY);
  if (cached) {
    return res.json({ ...cached, fromCache: true });
  }

  try {
    const { wallstreet, quotes, historical } = await getAgents();

    // Step 1: Get WSB recommendations
    const { buy: rawBuy, sell: rawSell } = await wallstreet.getRecommendations();

    // Step 2: Enrich with real-time quotes and historical data in parallel
    const enrichStock = async (stock: typeof rawBuy[number]) => {
      const [quote, historicalData] = await Promise.allSettled([
        quotes.getQuote(stock.symbol),
        historical.getHistoricalPrices(stock.symbol, '3mo', '1d'),
      ]);
      return {
        ...stock,
        quote: quote.status === 'fulfilled' ? quote.value : undefined,
        historicalData: historicalData.status === 'fulfilled' ? historicalData.value : undefined,
      };
    };

    const [buy, sell] = await Promise.all([
      Promise.all(rawBuy.map(enrichStock)),
      Promise.all(rawSell.map(enrichStock)),
    ]);

    const result: RecommendationsResponse = {
      buy,
      sell,
      lastUpdated: new Date().toISOString(),
    };

    cache.set(CACHE_KEY, result);
    return res.json(result);
  } catch (err) {
    console.error('[recommendations] Error:', err);
    return res.status(500).json({
      error: 'Failed to fetch recommendations',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

// Force-refresh endpoint (bypasses cache)
recommendationsRouter.post('/refresh', async (_req: Request, res: Response) => {
  cache.del(CACHE_KEY);
  return res.json({ message: 'Cache cleared. Next GET will fetch fresh data.' });
});
