import Anthropic from '@anthropic-ai/sdk';
import { MCPClient, runAgentLoop } from '../services/mcp-manager.js';
import { MCP_CONFIGS } from '../config/mcp.js';
import type { BasicFinancials, StockAnalysis } from '../types/index.js';

const SYSTEM_PROMPT = `You are BasicFinancialsAgent. Your job is to:
1. Fetch fundamental financial data for a stock using the get_basic_financials tool.
2. Analyze the data and produce a BUY or SELL recommendation with a brief 2-sentence reason.
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

export class BasicFinancialsAgent {
  private anthropic: Anthropic;
  private mcpClient: MCPClient | null = null;

  constructor(anthropic: Anthropic) {
    this.anthropic = anthropic;
  }

  async initialize(): Promise<void> {
    this.mcpClient = new MCPClient('basic-financials-market');
    await this.mcpClient.connectStdio(MCP_CONFIGS.stockMarket);
  }

  async analyzeStock(symbol: string): Promise<StockAnalysis> {
    if (!this.mcpClient) throw new Error('BasicFinancialsAgent not initialized');

    const tools = await this.mcpClient.listTools();
    const toolExecutor = (name: string, input: Record<string, unknown>) =>
      this.mcpClient!.callTool(name, input);

    const raw = await runAgentLoop(
      this.anthropic,
      SYSTEM_PROMPT,
      `Fetch basic financials for ${symbol.toUpperCase()} and produce a BUY or SELL recommendation.`,
      tools,
      toolExecutor,
      { maxTokens: 2048, maxIterations: 5 }
    );

    return this.parseAnalysis(raw, symbol);
  }

  async getFinancials(symbol: string): Promise<BasicFinancials> {
    const analysis = await this.analyzeStock(symbol);
    return analysis.financials;
  }

  private parseAnalysis(raw: string, symbol: string): StockAnalysis {
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned) as StockAnalysis;
    } catch {
      console.error(`[BasicFinancialsAgent] Failed to parse analysis for ${symbol}:`, raw.slice(0, 200));
      return {
        symbol: symbol.toUpperCase(),
        recommendation: 'SELL',
        reason: 'Could not retrieve financial data. When in doubt, sell.',
        financials: { symbol: symbol.toUpperCase() },
      };
    }
  }

  async close(): Promise<void> {
    await this.mcpClient?.close();
  }
}
