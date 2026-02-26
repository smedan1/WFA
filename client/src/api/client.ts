import type { RecommendationsResponse, StockQuote, HistoricalDataPoint, StockAnalysis } from '../types';

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.message ?? err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getRecommendations: (): Promise<RecommendationsResponse> =>
    fetchJSON('/recommendations'),

  refreshRecommendations: (): Promise<void> =>
    fetch(`${BASE}/recommendations/refresh`, { method: 'POST' }).then(() => undefined),

  getQuote: (symbol: string): Promise<StockQuote> =>
    fetchJSON(`/stocks/quote/${symbol}`),

  getHistorical: (symbol: string, period = '3mo'): Promise<HistoricalDataPoint[]> =>
    fetchJSON(`/stocks/historical/${symbol}?period=${period}`),

  analyzeStock: (symbol: string): Promise<StockAnalysis> =>
    fetchJSON(`/stocks/analyze/${symbol}`),
};
