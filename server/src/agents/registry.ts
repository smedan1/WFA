/**
 * Agent registry — initializes all agents once and reuses them across requests.
 * Agents are lazy-initialized on first use so the server starts up fast.
 */
import Anthropic from '@anthropic-ai/sdk';
import { WallstreetAgent } from './wallstreet-agent.js';
import { GithubAgent } from './github-agent.js';
import { QuotesAgent } from './quotes-agent.js';
import { HistoricalAgent } from './historical-agent.js';
import { BasicFinancialsAgent } from './basic-financials-agent.js';

interface Agents {
  wallstreet: WallstreetAgent;
  github: GithubAgent;
  quotes: QuotesAgent;
  historical: HistoricalAgent;
  basicFinancials: BasicFinancialsAgent;
}

let agents: Agents | null = null;
let initPromise: Promise<Agents> | null = null;

async function initializeAgents(): Promise<Agents> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const repoOwner = process.env.GITHUB_REPO_OWNER ?? 'nmsa';
  const repoName = process.env.GITHUB_REPO_NAME ?? 'NMSA';

  const wallstreet = new WallstreetAgent(anthropic);
  const github = new GithubAgent(anthropic, repoOwner, repoName);
  const quotes = new QuotesAgent(anthropic);
  const historical = new HistoricalAgent(anthropic);
  const basicFinancials = new BasicFinancialsAgent(anthropic);

  console.log('[Registry] Initializing agents...');

  await Promise.all([
    wallstreet.initialize().catch((e) => console.warn('[Registry] WallstreetAgent init failed:', e.message)),
    quotes.initialize().catch((e) => console.warn('[Registry] QuotesAgent init failed:', e.message)),
    historical.initialize().catch((e) => console.warn('[Registry] HistoricalAgent init failed:', e.message)),
    basicFinancials.initialize().catch((e) => console.warn('[Registry] BasicFinancialsAgent init failed:', e.message)),
  ]);

  console.log('[Registry] All agents ready');

  return { wallstreet, github, quotes, historical, basicFinancials };
}

export async function getAgents(): Promise<Agents> {
  if (agents) return agents;
  if (!initPromise) {
    initPromise = initializeAgents().then((a) => {
      agents = a;
      return a;
    });
  }
  return initPromise;
}

export async function closeAgents(): Promise<void> {
  if (!agents) return;
  await Promise.all([
    agents.wallstreet.close(),
    agents.quotes.close(),
    agents.historical.close(),
    agents.basicFinancials.close(),
  ]);
  agents = null;
  initPromise = null;
}
