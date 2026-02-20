import Anthropic from '@anthropic-ai/sdk';
import { runAgentLoopWithUrlMCP } from '../services/mcp-manager.js';
import { MCP_CONFIGS } from '../config/mcp.js';
import type { StockRecommendation } from '../types/index.js';

const SYSTEM_PROMPT = `You are GithubAgent, responsible for reading and writing NMSA recommendation history
to the GitHub repository. You store recommendations as JSON files and can retrieve past snapshots.
When writing, commit the file with a descriptive message. When reading, return the parsed JSON content.
Always respond with valid JSON only — no markdown fences, no prose.`;

export class GithubAgent {
  private anthropic: Anthropic;
  private repoOwner: string;
  private repoName: string;

  constructor(anthropic: Anthropic, repoOwner: string, repoName: string) {
    this.anthropic = anthropic;
    this.repoOwner = repoOwner;
    this.repoName = repoName;
  }

  async saveRecommendations(recommendations: {
    buy: StockRecommendation[];
    sell: StockRecommendation[];
    timestamp: string;
  }): Promise<void> {
    if (!MCP_CONFIGS.github.authorizationToken) {
      console.warn('[GithubAgent] No GITHUB_TOKEN set — skipping save');
      return;
    }

    const filePath = `data/recommendations/${recommendations.timestamp.split('T')[0]}.json`;
    const content = JSON.stringify(recommendations, null, 2);

    const userMessage = `
Save the following JSON to the file "${filePath}" in the repository "${this.repoOwner}/${this.repoName}".
If the file already exists, overwrite it. Commit message: "chore: save NMSA recommendations for ${recommendations.timestamp.split('T')[0]}".

Content to save:
${content}
    `.trim();

    await runAgentLoopWithUrlMCP(
      this.anthropic,
      SYSTEM_PROMPT,
      userMessage,
      [
        {
          url: MCP_CONFIGS.github.url,
          name: 'github',
          authorizationToken: MCP_CONFIGS.github.authorizationToken,
        },
      ]
    );
  }

  async getRecentHistory(days = 7): Promise<Array<{
    date: string;
    buy: StockRecommendation[];
    sell: StockRecommendation[];
  }>> {
    if (!MCP_CONFIGS.github.authorizationToken) {
      console.warn('[GithubAgent] No GITHUB_TOKEN set — returning empty history');
      return [];
    }

    const userMessage = `
List all files in the "data/recommendations/" directory of repo "${this.repoOwner}/${this.repoName}".
Return the contents of the ${days} most recent files as a JSON array where each element has:
{ "date": "YYYY-MM-DD", "buy": [...], "sell": [...] }
Return ONLY valid JSON, no prose.
    `.trim();

    const raw = await runAgentLoopWithUrlMCP(
      this.anthropic,
      SYSTEM_PROMPT,
      userMessage,
      [
        {
          url: MCP_CONFIGS.github.url,
          name: 'github',
          authorizationToken: MCP_CONFIGS.github.authorizationToken,
        },
      ]
    );

    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      console.error('[GithubAgent] Failed to parse history response');
      return [];
    }
  }
}
