import Anthropic from '@anthropic-ai/sdk';
import { MCPClient, runAgentLoop } from '../services/mcp-manager.js';
import { MCP_CONFIGS } from '../config/mcp.js';
import type { StockQuote } from '../types/index.js';

const SYSTEM_PROMPT = `You are QuotesAgent. Your only job is to fetch real-time stock quotes using the
get_stock_quote tool and return the result as valid JSON matching this exact structure:
{
  "symbol": "TICKER",
  "price": 123.45,
  "change": 1.23,
  "changePercent": 1.01,
  "volume": 1000000,
  "marketCap": 1000000000,
  "dayHigh": 125.00,
  "dayLow": 121.00,
  "fiftyTwoWeekHigh": 200.00,
  "fiftyTwoWeekLow": 80.00,
  "timestamp": "2024-01-01T00:00:00Z"
}
Return ONLY valid JSON — no markdown fences, no prose. Use null for any unavailable fields.`;

export class QuotesAgent {
  private anthropic: Anthropic;
  private mcpClient: MCPClient | null = null;

  constructor(anthropic: Anthropic) {
    this.anthropic = anthropic;
  }

  async initialize(): Promise<void> {
    this.mcpClient = new MCPClient('quotes-yahoo');
    await this.mcpClient.connectStdio(MCP_CONFIGS.yahooFinance);
  }

  async getQuote(symbol: string): Promise<StockQuote> {
    if (!this.mcpClient) throw new Error('QuotesAgent not initialized');

    const tools = await this.mcpClient.listTools();
    const toolExecutor = (name: string, input: Record<string, unknown>) =>
      this.mcpClient!.callTool(name, input);

    const raw = await runAgentLoop(
      this.anthropic,
      SYSTEM_PROMPT,
      `Get the real-time quote for stock symbol: ${symbol.toUpperCase()}`,
      tools,
      toolExecutor,
      { maxTokens: 1024, maxIterations: 5 }
    );

    return this.parseQuote(raw, symbol);
  }

  async getQuotes(symbols: string[]): Promise<StockQuote[]> {
    return Promise.all(symbols.map((s) => this.getQuote(s)));
  }

  private parseQuote(raw: string, symbol: string): StockQuote {
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned) as StockQuote;
    } catch {
      console.error(`[QuotesAgent] Failed to parse quote for ${symbol}:`, raw.slice(0, 200));
      return {
        symbol: symbol.toUpperCase(),
        price: 0,
        change: 0,
        changePercent: 0,
        volume: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async close(): Promise<void> {
    await this.mcpClient?.close();
  }
}
