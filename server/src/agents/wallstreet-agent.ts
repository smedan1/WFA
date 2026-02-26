import Anthropic from '@anthropic-ai/sdk';
import type { StockRecommendation } from '../types/index.js';

const USER_AGENT = 'WFA-App/1.0';
const SUBREDDIT = 'wallstreetbets';

const SYSTEM_PROMPT = `You are WallstreetAgent, an AI that lives and breathes r/wallstreetbets.
Your job is to analyze posts and comments from r/wallstreetbets over the last 3 months to identify:
1. The top 5 stocks that degens are hyping up to BUY (rockets, tendies, moon talk)
2. The top 5 stocks that are getting dumped, exposed as scams, or getting exit calls (rug pull, bag holders, etc.)

SCORING RULES:
- Weight posts from the last week 10x more than older posts
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

interface RedditPost {
  title: string;
  score: number;
  num_comments: number;
  created_utc: number;
}

async function fetchPosts(path: string): Promise<RedditPost[]> {
  try {
    const res = await fetch(`https://www.reddit.com/r/${SUBREDDIT}/${path}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return [];
    const json = await res.json() as { data?: { children?: { data: RedditPost }[] } };
    return (json.data?.children ?? []).map((c) => c.data);
  } catch {
    return [];
  }
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
    const [hot, topWeek, topMonth] = await Promise.all([
      fetchPosts('hot.json?limit=100'),
      fetchPosts('top.json?t=week&limit=100'),
      fetchPosts('top.json?t=month&limit=100'),
    ]);

    // Deduplicate by title
    const seen = new Set<string>();
    const posts: RedditPost[] = [];
    for (const post of [...hot, ...topWeek, ...topMonth]) {
      if (!seen.has(post.title)) {
        seen.add(post.title);
        posts.push(post);
      }
    }

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
