import Anthropic from '@anthropic-ai/sdk';
import type { StockRecommendation } from '../types/index.js';

const XPOZ_URL = 'https://mcp.xpoz.ai/mcp';
const SUBREDDIT = 'wallstreetbets';
// Broad WSB-relevant query — space-separated terms are OR'd by Xpoz
const WSB_QUERY = 'stocks options ETF calls puts yolo moon tendies DD loss gain buy sell';

const SYSTEM_PROMPT = `You are WallstreetAgent, an AI that lives and breathes r/wallstreetbets.
Your job is to analyze posts and comments from r/wallstreetbets over the last 3 months to identify:
1. Up to 5 instruments (stocks OR ETFs) that the bravely uninformed are hyping up to BUY (rockets, tendies, moon talk)
2. Up to 5 instruments (stocks OR ETFs) that are getting dumped, exposed as scams, or getting exit calls (rug pull, bag holders, earnings disasters, short attacks, FDA rejections, margin calls, etc.)

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
      "buyReason": "short squeeze|gamma squeeze|catalyst play|earnings beat|oversold bounce|breakout|sector rotation|deep value|turnaround play|insider accumulation|buyback bonanza|GARP|spinoff|activist entry",
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
      "exitReason": "rug pull|pool drain|honeypot|dead cat bounce|pump and dump|liquidity crisis|earnings crater|short attack|FDA rejection|margin call cascade|greater fool exit|reverse split trap",
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

// 1000ms between Xpoz calls — no QPM limit, just polite spacing
const INTER_REQUEST_DELAY_MS = 1000;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function callXpozTool(args: Record<string, unknown>): Promise<string> {
  const token = process.env.XPOZ_TOKEN;
  if (!token) throw new Error('XPOZ_TOKEN not set');

  const res = await fetch(XPOZ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'getRedditPostsByKeywords', arguments: args },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Xpoz HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const body = await res.text();
  // Response is SSE: find the "data: {...}" line
  const dataLine = body.split('\n').find((l) => l.startsWith('data: '));
  if (!dataLine) throw new Error('No SSE data line in Xpoz response');

  const json = JSON.parse(dataLine.slice(6)) as {
    result?: { content?: Array<{ type: string; text: string }> };
    error?: { message: string };
  };
  if (json.error) throw new Error(`Xpoz tool error: ${json.error.message}`);

  const textContent = json.result?.content?.find((c) => c.type === 'text');
  if (!textContent) throw new Error('No text content in Xpoz response');

  return textContent.text;
}

// Parse a single CSV row, handling quoted fields that may contain commas
function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const ch of line) {
    if (ch === '"' && !inQuotes) {
      inQuotes = true;
    } else if (ch === '"' && inQuotes) {
      inQuotes = false;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// Parse Xpoz's compact text response into RedditPost[]
// Format: results[N]{col1,col2,...}:\n    row,...\n  count: N\n  ...
function parseXpozText(text: string): RedditPost[] {
  const lines = text.split('\n');

  const headerIdx = lines.findIndex((l) => l.trim().startsWith('results['));
  if (headerIdx === -1) return [];

  const headerMatch = lines[headerIdx].match(/results\[(\d+)\]\{([^}]+)\}:/);
  if (!headerMatch) return [];

  const totalCount = parseInt(headerMatch[1], 10);
  const columns = headerMatch[2].split(',');

  const posts: RedditPost[] = [];
  let rowsParsed = 0;

  for (let i = headerIdx + 1; i < lines.length && rowsParsed < totalCount; i++) {
    const line = lines[i];
    if (!line.startsWith('    ')) continue; // data rows have 4-space indent

    const trimmed = line.trim();
    if (!trimmed) continue;

    const values = parseCSVRow(trimmed);
    if (values.length < columns.length) continue;

    const get = (col: string): string => {
      const idx = columns.indexOf(col);
      return idx >= 0 ? (values[idx] ?? '') : '';
    };

    const tsRaw = get('createdAtTimestamp');
    const created_utc =
      tsRaw && tsRaw !== 'null'
        ? Math.floor(new Date(tsRaw).getTime() / 1000)
        : Math.floor(Date.now() / 1000) - 30 * 86400; // default: 30 days ago

    posts.push({
      title: get('title'),
      score: parseInt(get('score'), 10) || 0,
      num_comments: parseInt(get('commentsCount'), 10) || 0,
      created_utc,
    });
    rowsParsed++;
  }

  return posts;
}

async function fetchXpozPosts(sort: string, time?: string): Promise<RedditPost[]> {
  try {
    const args: Record<string, unknown> = {
      query: WSB_QUERY,
      subreddit: SUBREDDIT,
      sort,
      fields: ['title', 'score', 'commentsCount', 'createdAtTimestamp'],
      responseType: 'fast',
    };
    if (time) args.time = time;

    const text = await callXpozTool(args);
    const posts = parseXpozText(text);
    console.log(`[WallstreetAgent] Xpoz ${sort}/${time ?? 'all'}: ${posts.length} posts`);
    return posts;
  } catch (e) {
    console.error(`[WallstreetAgent] Xpoz fetch error (${sort}/${time ?? 'all'}):`, e);
    return [];
  }
}

export class WallstreetAgent {
  private anthropic: Anthropic;

  constructor(anthropic: Anthropic) {
    this.anthropic = anthropic;
  }

  async initialize(): Promise<void> {
    // No initialization needed
  }

  async getRecommendations(): Promise<WallstreetRecommendations> {
    const hot = await fetchXpozPosts('hot');
    await sleep(INTER_REQUEST_DELAY_MS);
    const topWeek = await fetchXpozPosts('top', 'week');
    await sleep(INTER_REQUEST_DELAY_MS);
    const topMonth = await fetchXpozPosts('top', 'month');

    console.log(`[WallstreetAgent] Xpoz fetch: hot=${hot.length} topWeek=${topWeek.length} topMonth=${topMonth.length}`);

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
