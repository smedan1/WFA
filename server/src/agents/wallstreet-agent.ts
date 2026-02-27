import Anthropic from '@anthropic-ai/sdk';
import type { StockRecommendation } from '../types/index.js';

const USER_AGENT = 'wallace-financial-agent-humour-personal-pet-project:1.0 (by /u/ArenaClowner)';
const SUBREDDIT = 'wallstreetbets';

const SYSTEM_PROMPT = `You are WallstreetAgent, an AI that lives and breathes r/wallstreetbets.
Your job is to analyze posts and comments from r/wallstreetbets over the last 3 months to identify:
1. Up to 5 instruments (stocks OR ETFs) that the bravely uninformed are hyping up to BUY (rockets, tendies, moon talk)
2. Up to 5 instruments (stocks OR ETFs) that are getting dumped, exposed as scams, or getting exit calls (rug pull, bag holders, etc.)

INSTRUMENTS TO TRACK:
- Stocks: individual company tickers in ALL CAPS (TSLA, NVDA, GME, etc.)
- ETFs: fund tickers (SPY, QQQ, IWM, TQQQ, SQQQ, ARKK, GLD, etc.) — WSB loves leveraged ETFs and macro plays

SCORING RULES:
- Weight posts from the last week 10x more than older posts
- Weight posts from the last 2 weeks 3x more than older posts
- Weight posts from the last month 2x more than 2-3 month old posts
- An instrument is "popular" if people are actively discussing trading it (either direction)
- Look for: tickers in ALL CAPS, rocket references, loss porn, DD posts, YOLO plays, SPY puts/calls, leveraged ETF plays
- Minimum 5 mentions in the last 3 months to qualify

OUTPUT FORMAT:
Return a JSON object (and ONLY valid JSON, no markdown fences) with this exact structure:
{
  "buy": [
    {
      "symbol": "TICKER",
      "companyName": "Company Name or Fund Name",
      "instrumentType": "STOCK",
      "popularityScore": 0-100,
      "reason": "Funny 2-sentence max reason to buy. Must be irreverent and reference WSB culture.",
      "recommendation": "BUY"
    }
  ],
  "sell": [
    {
      "symbol": "TICKER",
      "companyName": "Company Name or Fund Name",
      "instrumentType": "ETF",
      "popularityScore": 0-100,
      "reason": "Funny 2-sentence max reason to sell. Name the specific exit type.",
      "exitReason": "rug pull|pool drain|honeypot|dead cat bounce|pump and dump|liquidity crisis",
      "recommendation": "SELL"
    }
  ]
}

The buy array must have at most 5 items. The sell array must have at most 5 items. Mix stocks and ETFs freely — include fewer if there isn't enough signal.
Keep reasons under 2 sentences and make them funny — WSB humor: self-aware, irreverent, dry wit. No vulgar language, body humor, or profanity. Think sharp and sardonic, not crude.`;

interface WallstreetRecommendations {
  buy: StockRecommendation[];
  sell: StockRecommendation[];
}

interface RedditPost {
  title: string;
  score: number;
  num_comments: number;
  created_utc: number;
}

declare function setTimeout(callback: () => void, ms?: number): unknown;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function fetchPage(basePath: string, limit: number, after?: string): Promise<{ posts: RedditPost[]; nextAfter: string | null }> {
  const sep = basePath.includes('?') ? '&' : '?';
  let url = `https://old.reddit.com/r/${SUBREDDIT}/${basePath}${sep}limit=${limit}`;
  if (after) url += `&after=${after}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });
    console.log(`[WallstreetAgent] GET ${basePath} after=${after ?? 'start'} → ${res.status}`);
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[WallstreetAgent] Non-OK response body (first 200): ${body.slice(0, 200)}`);
      return { posts: [], nextAfter: null };
    }
    const json = await res.json() as { data?: { children?: { data: RedditPost }[]; after?: string | null } };
    const posts = (json.data?.children ?? []).map((c) => c.data);
    return { posts, nextAfter: json.data?.after ?? null };
  } catch (e) {
    console.error(`[WallstreetAgent] Fetch error for ${basePath}:`, e);
    return { posts: [], nextAfter: null };
  }
}

async function fetchPosts(basePath: string): Promise<RedditPost[]> {
  const all: RedditPost[] = [];
  let after: string | undefined;
  while (all.length < 40) {
    await sleep(1000);
    const { posts, nextAfter } = await fetchPage(basePath, 10, after);
    all.push(...posts);
    if (!nextAfter || posts.length === 0) break;
    after = nextAfter;
  }
  return all;
}

export class WallstreetAgent {
  private anthropic: Anthropic;

  constructor(anthropic: Anthropic) {
    this.anthropic = anthropic;
  }

  async initialize(): Promise<void> {
    // No initialization needed — uses public Reddit JSON API
  }

  async getRecommendations(): Promise<WallstreetRecommendations> {
    const hot = await fetchPosts('hot.json');
    const topWeek = await fetchPosts('top.json?t=week');
    const topMonth = await fetchPosts('top.json?t=month');

    console.log(`[WallstreetAgent] Reddit fetch: hot=${hot.length} topWeek=${topWeek.length} topMonth=${topMonth.length}`);

    // Deduplicate by title
    const seen = new Set<string>();
    const posts: RedditPost[] = [];
    for (const post of [...hot, ...topWeek, ...topMonth]) {
      if (!seen.has(post.title)) {
        seen.add(post.title);
        posts.push(post);
      }
    }

    console.log(`[WallstreetAgent] Unique posts after dedup: ${posts.length}`);

    const nowSec = Date.now() / 1000;
    const postSummary = posts
      .map((p) => {
        const daysAgo = Math.floor((nowSec - p.created_utc) / 86400);
        return `[${daysAgo}d ago, score:${p.score}, comments:${p.num_comments}] ${p.title}`;
      })
      .join('\n');

    const userMessage = `Here are recent r/wallstreetbets posts:\n\n${postSummary}\n\nAnalyze these posts and return your JSON recommendations.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    console.log(`[WallstreetAgent] Claude raw response (first 300 chars): ${raw.slice(0, 300)}`);

    return this.parseRecommendations(raw);
  }

  private parseRecommendations(raw: string): WallstreetRecommendations {
    try {
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
    // Nothing to close
  }
}
