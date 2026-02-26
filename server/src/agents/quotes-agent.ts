import Anthropic from '@anthropic-ai/sdk';
import type { StockQuote } from '../types/index.js';

const YF_BASE = 'https://query1.finance.yahoo.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; WFA-App/1.0)',
  'Accept': 'application/json',
};

export class QuotesAgent {
  constructor(_anthropic: Anthropic) {}

  async initialize(): Promise<void> {}

  async getQuote(symbol: string): Promise<StockQuote> {
    const url = `${YF_BASE}/v8/finance/chart/${symbol}?interval=1d&range=1d&includePrePost=false`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status} for ${symbol}`);

    const json = await res.json() as { chart?: { result?: { meta: Record<string, number | string> }[] } };
    const meta = json.chart?.result?.[0]?.meta;
    if (!meta) throw new Error(`No data returned for ${symbol}`);

    const ts = typeof meta.regularMarketTime === 'number' ? meta.regularMarketTime : Date.now() / 1000;

    return {
      symbol: String(meta.symbol ?? symbol),
      price: Number(meta.regularMarketPrice ?? 0),
      change: Number(meta.regularMarketChange ?? 0),
      changePercent: Number(meta.regularMarketChangePercent ?? 0),
      volume: Number(meta.regularMarketVolume ?? 0),
      marketCap: meta.marketCap != null ? Number(meta.marketCap) : undefined,
      dayHigh: meta.regularMarketDayHigh != null ? Number(meta.regularMarketDayHigh) : undefined,
      dayLow: meta.regularMarketDayLow != null ? Number(meta.regularMarketDayLow) : undefined,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh != null ? Number(meta.fiftyTwoWeekHigh) : undefined,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow != null ? Number(meta.fiftyTwoWeekLow) : undefined,
      timestamp: new Date(ts * 1000).toISOString(),
    };
  }

  async getQuotes(symbols: string[]): Promise<StockQuote[]> {
    return Promise.all(symbols.map((s) => this.getQuote(s)));
  }

  async close(): Promise<void> {}
}
