import Anthropic from '@anthropic-ai/sdk';
import { MCPClient, runAgentLoop } from '../services/mcp-manager.js';
import { MCP_CONFIGS } from '../config/mcp.js';
import type { HistoricalDataPoint } from '../types/index.js';

const SYSTEM_PROMPT = `You are HistoricalAgent. Your only job is to fetch historical stock prices using
the get_historical_prices tool and return the result as a valid JSON array of data points:
[
  {
    "date": "2024-01-01",
    "open": 100.00,
    "high": 105.00,
    "low": 99.00,
    "close": 103.00,
    "volume": 1000000
  }
]
Return ONLY a valid JSON array — no markdown fences, no prose. Sort by date ascending.
Use null for any unavailable OHLCV fields. Dates must be in YYYY-MM-DD format.`;

export class HistoricalAgent {
  private anthropic: Anthropic;
  private mcpClient: MCPClient | null = null;

  constructor(anthropic: Anthropic) {
    this.anthropic = anthropic;
  }

  async initialize(): Promise<void> {
    this.mcpClient = new MCPClient('historical-yahoo');
    await this.mcpClient.connectStdio(MCP_CONFIGS.yahooFinance);
  }

  async getHistoricalPrices(
    symbol: string,
    period = '3mo',
    interval = '1d'
  ): Promise<HistoricalDataPoint[]> {
    if (!this.mcpClient) throw new Error('HistoricalAgent not initialized');

    const tools = await this.mcpClient.listTools();
    const toolExecutor = (name: string, input: Record<string, unknown>) =>
      this.mcpClient!.callTool(name, input);

    const raw = await runAgentLoop(
      this.anthropic,
      SYSTEM_PROMPT,
      `Get historical prices for ${symbol.toUpperCase()} for the period "${period}" with interval "${interval}".`,
      tools,
      toolExecutor,
      { maxTokens: 4096, maxIterations: 5 }
    );

    return this.parseHistoricalData(raw, symbol);
  }

  private parseHistoricalData(raw: string, symbol: string): HistoricalDataPoint[] {
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) throw new Error('Expected array');
      return parsed as HistoricalDataPoint[];
    } catch {
      console.error(`[HistoricalAgent] Failed to parse historical data for ${symbol}:`, raw.slice(0, 200));
      return [];
    }
  }

  async close(): Promise<void> {
    await this.mcpClient?.close();
  }
}
