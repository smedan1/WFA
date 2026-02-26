import Anthropic from '@anthropic-ai/sdk';
import type { BasicFinancials, StockAnalysis } from '../types/index.js';

const YF_BASE = 'https://query2.finance.yahoo.com';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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
  private cookie: string | null = null;
  private crumb: string | null = null;

  constructor(anthropic: Anthropic) {
    this.anthropic = anthropic;
  }

  async initialize(): Promise<void> {
    await this.refreshCrumb();
  }

  private async refreshCrumb(): Promise<void> {
    // Step 1: hit fc.yahoo.com to get the A3 session cookie
    const cookieRes = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': BROWSER_UA },
    });
    const setCookieHeader = cookieRes.headers.get('set-cookie') ?? '';
    const a3Match = setCookieHeader.match(/A3=([^;]+)/);
    if (!a3Match) throw new Error('Could not obtain Yahoo Finance session cookie');
    this.cookie = `A3=${a3Match[1]}`;

    // Step 2: get the crumb using that cookie
    const crumbRes = await fetch(`${YF_BASE}/v1/test/getcrumb`, {
      headers: { 'User-Agent': BROWSER_UA, 'Cookie': this.cookie },
    });
    if (!crumbRes.ok) throw new Error(`Crumb fetch failed: ${crumbRes.status}`);
    this.crumb = await crumbRes.text();
    console.log('[BasicFinancialsAgent] Crumb refreshed');
  }

  private async fetchFinancials(symbol: string): Promise<BasicFinancials> {
    if (!this.crumb || !this.cookie) await this.refreshCrumb();

    const modules = 'defaultKeyStatistics,financialData,summaryDetail,price';
    const url = `${YF_BASE}/v10/finance/quoteSummary/${symbol}?modules=${modules}&crumb=${encodeURIComponent(this.crumb!)}`;

    let res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, 'Cookie': this.cookie!, 'Accept': 'application/json' },
    });

    // On 401, refresh crumb once and retry
    if (res.status === 401) {
      console.log('[BasicFinancialsAgent] 401 — refreshing crumb and retrying');
      await this.refreshCrumb();
      const retryUrl = `${YF_BASE}/v10/finance/quoteSummary/${symbol}?modules=${modules}&crumb=${encodeURIComponent(this.crumb!)}`;
      res = await fetch(retryUrl, {
        headers: { 'User-Agent': BROWSER_UA, 'Cookie': this.cookie!, 'Accept': 'application/json' },
      });
    }

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
