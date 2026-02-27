import { Router } from 'express';
import type { Request, Response } from 'express';
import NodeCache from 'node-cache';
import { getAgents } from '../agents/registry.js';

export const stocksRouter = Router();

// Short-lived cache: quotes expire in 15s, historical in 1h, analysis in 5m
const quoteCache = new NodeCache({ stdTTL: 15 });
const histCache = new NodeCache({ stdTTL: 3600 });
const analysisCache = new NodeCache({ stdTTL: 300 });
// ADSK Easter egg — full result (financials + reason) cached together for 30 min
const adskResultCache = new NodeCache({ stdTTL: 1800 });
const ADSK_TTL_MS = 30 * 60 * 1000;
// Stock analysis GitHub cache TTL: 30 minutes (cross-client dedup window)
const STOCK_ANALYSIS_TTL_MS = 30 * 60 * 1000;

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

    // ADSK Easter egg: serve the full saved result (financials + reason) together for 30 min
    if (key === 'ADSK') {
      // 1. In-memory cache (survives repeated requests within the same server instance)
      let adskResult = adskResultCache.get<Record<string, unknown>>('result');

      // 2. GitHub cache (survives server restarts)
      if (!adskResult) {
        const saved = await github.getAdskResult().catch(() => null);
        if (saved) {
          const ageMs = Date.now() - new Date(saved.generatedAt).getTime();
          if (ageMs < ADSK_TTL_MS) {
            adskResult = { ...saved.result, generatedAt: saved.generatedAt };
            adskResultCache.set('result', adskResult, Math.floor((ADSK_TTL_MS - ageMs) / 1000));
            console.log('[ADSK] Serving cached Easter egg result from GitHub');
          }
        }
      }

      if (adskResult) {
        analysisCache.set(key, adskResult);
        return res.json(adskResult);
      }

      // 3. Cache miss — fetch fresh data, generate new reason, save full result
      console.log('[ADSK] Generating fresh Easter egg result via Claude');
      const [analysis, quote, hist] = await Promise.allSettled([
        basicFinancials.analyzeStock(key),
        quotes.getQuote(key),
        historical.getHistoricalPrices(key, '3mo', '1d'),
      ]);

      const freshResult = {
        ...(analysis.status === 'fulfilled' ? analysis.value : { symbol: key, recommendation: 'SELL', reason: 'Data unavailable', financials: { symbol: key } }),
        quote: quote.status === 'fulfilled' ? quote.value : null,
        historicalData: hist.status === 'fulfilled' ? hist.value : [],
        generatedAt: new Date().toISOString(),
      };

      const adskReason = await basicFinancials.generateAdskReason(freshResult.financials ?? freshResult);
      freshResult.recommendation = 'BUY';
      freshResult.reason = adskReason;

      adskResultCache.set('result', freshResult as unknown as Record<string, unknown>);
      github.saveAdskResult(freshResult as unknown as Record<string, unknown>).catch((e: Error) =>
        console.warn('[ADSK] Failed to save Easter egg result to GitHub:', e.message)
      );
      analysisCache.set(key, freshResult);
      return res.json(freshResult);
    }

    // Check GitHub cache (survives server restarts) before burning AI tokens
    const saved = await github.getStockAnalysis(key).catch(() => null);
    if (saved) {
      const ageMs = Date.now() - new Date(saved.generatedAt).getTime();
      if (ageMs < STOCK_ANALYSIS_TTL_MS) {
        const remaining = Math.floor((STOCK_ANALYSIS_TTL_MS - ageMs) / 1000);
        const cachedResult = { ...saved.result, generatedAt: saved.generatedAt };
        analysisCache.set(key, cachedResult, Math.min(remaining, 300));
        console.log(`[stocks] Serving cached analysis for ${key} from GitHub (age: ${Math.floor(ageMs / 60000)}min)`);
        return res.json(cachedResult);
      }
    }

    const [analysis, quote, hist] = await Promise.allSettled([
      basicFinancials.analyzeStock(key),
      quotes.getQuote(key),
      historical.getHistoricalPrices(key, '3mo', '1d'),
    ]);

    const result = {
      ...(analysis.status === 'fulfilled' ? analysis.value : { symbol: key, recommendation: 'SELL', reason: 'Data unavailable', financials: { symbol: key } }),
      quote: quote.status === 'fulfilled' ? quote.value : null,
      historicalData: hist.status === 'fulfilled' ? hist.value : [],
      generatedAt: new Date().toISOString(),
    };

    analysisCache.set(key, result);
    github.saveStockAnalysis(key, result as unknown as Record<string, unknown>).catch((e: Error) =>
      console.warn(`[stocks] Failed to save analysis for ${key} to GitHub:`, e.message)
    );
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: `Failed to analyze ${symbol}`, message: String(err) });
  }
});
