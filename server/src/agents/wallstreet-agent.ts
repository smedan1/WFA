import Anthropic from '@anthropic-ai/sdk';
import { MCPClient, runAgentLoop } from '../services/mcp-manager.js';
import { MCP_CONFIGS } from '../config/mcp.js';
import type { StockRecommendation } from '../types/index.js';

const SYSTEM_PROMPT = `You are WallstreetAgent, an AI that lives and breathes r/wallstreetbets.
Your job is to analyze posts and comments from r/wallstreetbets over the last 3 months to identify:
1. The top 5 stocks that degens are hyping up to BUY (rockets, tendies, moon talk)
2. The top 5 stocks that are getting dumped, exposed as scams, or getting exit calls (rug pull, bag holders, etc.)

SCORING RULES:
- Weight posts from the last 2 weeks 3x more than older posts
- Weight posts from the last month 2x more than 2-3 month old posts
- A stock is "popular" if people are actively discussing trading it (either direction)
- Look for: tickers in ALL CAPS, rocket references, loss porn, DD posts, YOLO plays
- Minimum 5 mentions in the last 3 months to qualify

OUTPUT FORMAT:
Return a JSON object (and ONLY valid JSON, no markdown fences) with this exact structure:
{
  "buy": [
    {
      "symbol": "TICKER",
      "companyName": "Company Name",
      "popularityScore": 0-100,
      "reason": "Funny 2-sentence max reason to buy. Must be irreverent and reference WSB culture.",
      "recommendation": "BUY"
    }
  ],
  "sell": [
    {
      "symbol": "TICKER",
      "companyName": "Company Name",
      "popularityScore": 0-100,
      "reason": "Funny 2-sentence max reason to sell. Name the specific exit type.",
      "exitReason": "rug pull|pool drain|honeypot|dead cat bounce|pump and dump|liquidity crisis",
      "recommendation": "SELL"
    }
  ]
}

The buy array must have at most 5 items. The sell array must have at most 5 items. Include fewer if there isn't enough signal.
Keep reasons under 2 sentences and make them funny — WSB humor: degenerate, self-aware, irreverent.`;

interface WallstreetRecommendations {
  buy: StockRecommendation[];
  sell: StockRecommendation[];
}

export class WallstreetAgent {
  private anthropic: Anthropic;
  private mcpClient: MCPClient | null = null;

  constructor(anthropic: Anthropic) {
    this.anthropic = anthropic;
  }

  async initialize(): Promise<void> {
    this.mcpClient = new MCPClient('wallstreet-reddit');
    await this.mcpClient.connectStdio(MCP_CONFIGS.reddit);
  }

  async getRecommendations(): Promise<WallstreetRecommendations> {
    if (!this.mcpClient) throw new Error('WallstreetAgent not initialized');

    const tools = await this.mcpClient.listTools();
    const toolExecutor = (name: string, input: Record<string, unknown>) =>
      this.mcpClient!.callTool(name, input);

    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const userMessage = `
Search r/wallstreetbets for the most discussed stocks between ${threeMonthsAgo.toISOString().split('T')[0]} and ${now.toISOString().split('T')[0]}.

Search for:
1. Hot/trending posts with stock tickers (look for ticker symbols in CAPS)
2. DD (Due Diligence) posts
3. YOLO posts
4. Loss porn posts (these indicate sells)
5. Recent pump discussions

Use the available Reddit tools to search for relevant posts and comments.
Collect data, tally mentions with recency weighting, then produce your final JSON recommendation.
    `.trim();

    const raw = await runAgentLoop(
      this.anthropic,
      SYSTEM_PROMPT,
      userMessage,
      tools,
      toolExecutor,
      { maxTokens: 8096, maxIterations: 15 }
    );

    return this.parseRecommendations(raw);
  }

  private parseRecommendations(raw: string): WallstreetRecommendations {
    try {
      // Strip any accidental markdown fences
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned) as WallstreetRecommendations;
      return {
        buy: (parsed.buy ?? []).slice(0, 5).map((s) => ({
          ...s,
          recommendation: 'BUY' as const,
        })),
        sell: (parsed.sell ?? []).slice(0, 5).map((s) => ({
          ...s,
          recommendation: 'SELL' as const,
        })),
      };
    } catch {
      console.error('[WallstreetAgent] Failed to parse JSON response:', raw.slice(0, 500));
      return { buy: [], sell: [] };
    }
  }

  async close(): Promise<void> {
    await this.mcpClient?.close();
  }
}
