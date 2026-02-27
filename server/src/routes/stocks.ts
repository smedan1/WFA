import { Router } from 'express';
import type { Request, Response } from 'express';
import NodeCache from 'node-cache';
import { getAgents } from '../agents/registry.js';

export const stocksRouter = Router();

// Short-lived cache: quotes expire in 15s, historical in 1h, analysis in 5m
const quoteCache = new NodeCache({ stdTTL: 15 });
const histCache = new NodeCache({ stdTTL: 3600 });
const analysisCache = new NodeCache({ stdTTL: 300 });
// ADSK Easter egg reason — refreshed at most every 30 min
const adskReasonCache = new NodeCache({ stdTTL: 1800 });
const ADSK_REASON_TTL_MS = 30 * 60 * 1000;

stocksRouter.get('/quote/:symbol', async (req: Request<{ symbol: string }>, res: Response) => {
  const { symbol } = req.params;
  const key = symbol.toUpperCase();

  const cached = quoteCache.get(key);
  if (cached) return res.json(cached);

  try {
    const { quotes } = await getAgents();
    const quote = await quotes.getQuote(key);
    quoteCache.set(key, quote);
    return res.json(quote);
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch quote for ${key}`, message: String(err) });
  }
});

stocksRouter.get('/historical/:symbol', async (req: Request<{ symbol: string }>, res: Response) => {
  const { symbol } = req.params;
  const { period = '3mo', interval = '1d' } = req.query as Record<string, string>;
  const key = `${symbol.toUpperCase()}:${period}:${interval}`;

  const cached = histCache.get(key);
  if (cached) return res.json(cached);

  try {
    const { historical } = await getAgents();
    const data = await historical.getHistoricalPrices(symbol.toUpperCase(), period, interval);
    histCache.set(key, data);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch historical data for ${symbol}`, message: String(err) });
  }
});

stocksRouter.get('/analyze/:symbol', async (req: Request<{ symbol: string }>, res: Response) => {
  const { symbol } = req.params;
  const key = symbol.toUpperCase();

  const cached = analysisCache.get(key);
  if (cached) return res.json(cached);

  try {
    const { basicFinancials, quotes, historical, github } = await getAgents();

    const [analysis, quote, hist] = await Promise.allSettled([
      basicFinancials.analyzeStock(key),
      quotes.getQuote(key),
      historical.getHistoricalPrices(key, '3mo', '1d'),
    ]);

    const result = {
      ...(analysis.status === 'fulfilled' ? analysis.value : { symbol: key, recommendation: 'SELL', reason: 'Data unavailable', financials: { symbol: key } }),
      quote: quote.status === 'fulfilled' ? quote.value : null,
      historicalData: hist.status === 'fulfilled' ? hist.value : [],
    };

    if (key === 'ADSK') {
      // Resolve the Easter egg reason — fresh every 30 min, persisted to GitHub
      let adskReason = adskReasonCache.get<string>('reason');

      if (!adskReason) {
        // Try GitHub for a recently generated reason
        const saved = await github.getAdskReason().catch(() => null);
        if (saved) {
          const ageMs = Date.now() - new Date(saved.generatedAt).getTime();
          if (ageMs < ADSK_REASON_TTL_MS) {
            adskReason = saved.reason;
            adskReasonCache.set('reason', adskReason, Math.floor((ADSK_REASON_TTL_MS - ageMs) / 1000));
            console.log('[ADSK] Using cached Easter egg reason from GitHub');
          }
        }
      }

      if (!adskReason) {
        // Generate fresh reason from Claude based on actual financials
        console.log('[ADSK] Generating new Easter egg reason via Claude');
        adskReason = await basicFinancials.generateAdskReason(result.financials ?? result);
        adskReasonCache.set('reason', adskReason);
        github.saveAdskReason(adskReason).catch((e: Error) =>
          console.warn('[ADSK] Failed to save Easter egg reason to GitHub:', e.message)
        );
      }

      result.recommendation = 'BUY';
      result.reason = adskReason;
    }

    analysisCache.set(key, result);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: `Failed to analyze ${symbol}`, message: String(err) });
  }
});
