import Anthropic from '@anthropic-ai/sdk';
import type { HistoricalDataPoint } from '../types/index.js';

const YF_BASE = 'https://query1.finance.yahoo.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; WFA-App/1.0)',
  'Accept': 'application/json',
};

const PERIOD_TO_RANGE: Record<string, string> = {
  '1d': '1d', '5d': '5d', '1mo': '1mo', '3mo': '3mo',
  '6mo': '6mo', '1y': '1y', '2y': '2y', '5y': '5y', 'max': 'max',
};

export class HistoricalAgent {
  constructor(_anthropic: Anthropic) {}

  async initialize(): Promise<void> {}

  // includeTime=true stores "YYYY-MM-DDTHH:MM" (UTC) — used for intraday data
  async getHistoricalPrices(symbol: string, period = '3mo', interval = '1d', includeTime = false): Promise<HistoricalDataPoint[]> {
    const range = PERIOD_TO_RANGE[period] ?? '3mo';
    const url = `${YF_BASE}/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status} for ${symbol}`);

    const json = await res.json() as {
      chart?: {
        result?: {
          timestamp?: number[];
          indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }[] };
        }[];
      };
    };

    const result = json.chart?.result?.[0];
    if (!result) throw new Error(`No historical data for ${symbol}`);

    const timestamps = result.timestamp ?? [];
    const q = result.indicators?.quote?.[0] ?? {};

    return timestamps
      .map((ts, i) => {
        const close = q.close?.[i];
        if (close == null || close === 0) return null;
        return {
          date: includeTime
            ? new Date(ts * 1000).toISOString().slice(0, 16)  // "YYYY-MM-DDTHH:MM"
            : new Date(ts * 1000).toISOString().split('T')[0], // "YYYY-MM-DD"
          open: q.open?.[i] ?? close,
          high: q.high?.[i] ?? close,
          low: q.low?.[i] ?? close,
          close,
          volume: q.volume?.[i] ?? 0,
        };
      })
      .filter((p): p is HistoricalDataPoint => p !== null);
  }

  async close(): Promise<void> {}
}
