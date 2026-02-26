import Anthropic from '@anthropic-ai/sdk';
import type { BasicFinancials, StockAnalysis } from '../types/index.js';

const YF_BASE = 'https://query1.finance.yahoo.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; WFA-App/1.0)',
  'Accept': 'application/json',
};

const SYSTEM_PROMPT = `You are BasicFinancialsAgent. Your job is to:
1. Analyze the fundamental financial data provided for a stock.
2. Produce a BUY or SELL recommendation with a brief 2-sentence reason.
3. The reason should be grounded in the fundamentals (P/E, debt, revenue growth, short float, beta, etc.).
4. Keep the tone slightly humorous but financially accurate.

Return ONLY valid JSON matching this structure (no markdown fences, no prose):
{
  "symbol": "TICKER",
  "recommendation": "BUY" | "SELL",
  "reason": "2 sentence max reason.",
  "financials": {
    "symbol": "TICKER",
    "companyName": "Company Name",
    "marketCap": 1000000000,
    "peRatio": 25.5,
    "eps": 4.20,
    "revenue": 10000000000,
    "profitMargin": 0.15,
    "debtToEquity": 0.5,
    "currentRatio": 2.1,
    "beta": 1.3,
    "shortFloat": 0.05,
    "dividendYield": 0.02,
    "priceToBook": 3.5
  }
}
Use null for any unavailable fields.`;

interface YFRaw {
  raw?: number;
}

interface YFQuoteSummary {
  quoteSummary?: {
    result?: {
      defaultKeyStatistics?: Record<string, YFRaw>;
      financialData?: Record<string, YFRaw>;
      summaryDetail?: Record<string, YFRaw>;
      price?: { longName?: string; shortName?: string; marketCap?: YFRaw };
    }[];
  };
}

export class BasicFinancialsAgent {
  private anthropic: Anthropic;

  constructor(anthropic: Anthropic) {
    this.anthropic = anthropic;
  }

  async initialize(): Promise<void> {}

  private async fetchFinancials(symbol: string): Promise<BasicFinancials> {
    const modules = 'defaultKeyStatistics,financialData,summaryDetail,price';
    const url = `${YF_BASE}/v10/finance/quoteSummary/${symbol}?modules=${modules}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status} for ${symbol}`);

    const json = await res.json() as YFQuoteSummary;
    const result = json.quoteSummary?.result?.[0];
    if (!result) throw new Error(`No financial data for ${symbol}`);

    const ks = result.defaultKeyStatistics ?? {};
    const fd = result.financialData ?? {};
    const sd = result.summaryDetail ?? {};
    const p = result.price ?? {};

    return {
      symbol: symbol.toUpperCase(),
      companyName: p.longName ?? p.shortName ?? symbol,
      marketCap: p.marketCap?.raw,
      peRatio: sd.trailingPE?.raw ?? ks.trailingPE?.raw,
      eps: ks.trailingEps?.raw,
      revenue: fd.totalRevenue?.raw,
      profitMargin: fd.profitMargins?.raw,
      debtToEquity: fd.debtToEquity?.raw,
      currentRatio: fd.currentRatio?.raw,
      beta: ks.beta?.raw ?? sd.beta?.raw,
      shortFloat: ks.shortPercentOfFloat?.raw,
      dividendYield: sd.dividendYield?.raw,
      priceToBook: ks.priceToBook?.raw,
    };
  }

  async analyzeStock(symbol: string): Promise<StockAnalysis> {
    const financials = await this.fetchFinancials(symbol);

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Analyze these financials for ${symbol} and give a BUY or SELL recommendation:\n${JSON.stringify(financials, null, 2)}`,
      }],
    });

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return this.parseAnalysis(raw, symbol, financials);
  }

  async getFinancials(symbol: string): Promise<BasicFinancials> {
    const analysis = await this.analyzeStock(symbol);
    return analysis.financials;
  }

  private parseAnalysis(raw: string, symbol: string, financials: BasicFinancials): StockAnalysis {
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned) as StockAnalysis;
    } catch {
      console.error(`[BasicFinancialsAgent] Failed to parse analysis for ${symbol}:`, raw.slice(0, 200));
      return {
        symbol: symbol.toUpperCase(),
        recommendation: 'SELL',
        reason: 'Could not retrieve financial data. When in doubt, sell.',
        financials,
      };
    }
  }

  async close(): Promise<void> {}
}
