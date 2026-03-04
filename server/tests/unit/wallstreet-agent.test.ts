import { describe, it, expect } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { parseCSVRow, parseXpozText, WallstreetAgent } from '../../src/agents/wallstreet-agent.js';

// ─── parseCSVRow ─────────────────────────────────────────────────────────────

describe('parseCSVRow', () => {
  it('splits simple comma-separated values', () => {
    expect(parseCSVRow('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted field containing a comma', () => {
    expect(parseCSVRow('"hello, world",b,c')).toEqual(['hello, world', 'b', 'c']);
  });

  it('preserves empty fields', () => {
    expect(parseCSVRow('a,,c')).toEqual(['a', '', 'c']);
  });

  it('handles trailing empty field', () => {
    expect(parseCSVRow('a,b,')).toEqual(['a', 'b', '']);
  });

  it('handles single value', () => {
    expect(parseCSVRow('only')).toEqual(['only']);
  });
});

// ─── parseXpozText ───────────────────────────────────────────────────────────

const XPOZ_FIXTURE = `
results[2]{title,score,commentsCount,createdAtTimestamp,url,author,selftext}:
    NVDA to the moon,1500,200,2026-02-01T10:00:00Z,https://reddit.com/r/wsb/1,trader1,Time to load up on NVDA calls
    "SPY puts, printing",800,150,2026-01-15T00:00:00.000Z,https://reddit.com/r/wsb/2,trader2,null
  count: 2
`.trim();

describe('parseXpozText', () => {
  it('parses all rows from a valid response', () => {
    const posts = parseXpozText(XPOZ_FIXTURE);
    expect(posts).toHaveLength(2);
  });

  it('maps title, score, and num_comments correctly', () => {
    const [first] = parseXpozText(XPOZ_FIXTURE);
    expect(first.title).toBe('NVDA to the moon');
    expect(first.score).toBe(1500);
    expect(first.num_comments).toBe(200);
  });

  it('parses ISO timestamp to unix seconds', () => {
    const [first] = parseXpozText(XPOZ_FIXTURE);
    const expected = Math.floor(new Date('2026-02-01T10:00:00Z').getTime() / 1000);
    expect(first.created_utc).toBe(expected);
  });

  it('handles quoted title containing a comma', () => {
    const [, second] = parseXpozText(XPOZ_FIXTURE);
    expect(second.title).toBe('SPY puts, printing');
  });

  it('sets selfText to undefined when field is "null"', () => {
    const [, second] = parseXpozText(XPOZ_FIXTURE);
    expect(second.selfText).toBeUndefined();
  });

  it('returns [] when there is no results header', () => {
    expect(parseXpozText('no header here\njust some text')).toEqual([]);
  });

  it('returns [] for empty string', () => {
    expect(parseXpozText('')).toEqual([]);
  });

  it('defaults created_utc to ~30 days ago when timestamp is "null"', () => {
    const posts = parseXpozText(XPOZ_FIXTURE);
    const second = posts[1];
    // "null" createdAtTimestamp → date parses to NaN → falls back
    // The fixture has a real date for second post so it's parsed normally;
    // test the null branch with a dedicated fixture
    expect(second.created_utc).toBeGreaterThan(0);
  });

  it('defaults created_utc to ~30 days ago for null timestamp', () => {
    const fixture = [
      'results[1]{title,score,commentsCount,createdAtTimestamp,url,author,selftext}:',
      '    Null timestamp post,100,10,null,https://reddit.com/r/wsb/3,u1,null',
    ].join('\n');
    const [post] = parseXpozText(fixture);
    const thirtyDaysAgoSec = Math.floor(Date.now() / 1000) - 30 * 86400;
    expect(post.created_utc).toBeCloseTo(thirtyDaysAgoSec, -2); // within ~100s
  });
});

// ─── WallstreetAgent.parseRecommendations ────────────────────────────────────

describe('WallstreetAgent.parseRecommendations', () => {
  const agent = new WallstreetAgent({} as Anthropic);
  // Access private method via casting
  const parse = (raw: string) => (agent as unknown as { parseRecommendations(r: string): { buy: unknown[]; sell: unknown[] } }).parseRecommendations(raw);

  it('parses a valid JSON response', () => {
    const raw = JSON.stringify({
      buy: [{ symbol: 'NVDA', companyName: 'NVIDIA', recommendation: 'BUY', reason: 'Moon', popularityScore: 90, instrumentType: 'STOCK' }],
      sell: [{ symbol: 'AMC', companyName: 'AMC', recommendation: 'SELL', reason: 'Bag', popularityScore: 60, instrumentType: 'STOCK' }],
    });
    const result = parse(raw);
    expect(result.buy).toHaveLength(1);
    expect(result.sell).toHaveLength(1);
    expect((result.buy[0] as { symbol: string }).symbol).toBe('NVDA');
  });

  it('strips markdown code fences before parsing', () => {
    const inner = JSON.stringify({ buy: [], sell: [{ symbol: 'GME', companyName: 'GameStop', recommendation: 'SELL', reason: 'Rug', popularityScore: 50 }] });
    const raw = `\`\`\`json\n${inner}\n\`\`\``;
    const result = parse(raw);
    expect(result.sell).toHaveLength(1);
  });

  it('returns empty arrays for invalid JSON', () => {
    const result = parse('this is not json at all');
    expect(result.buy).toEqual([]);
    expect(result.sell).toEqual([]);
  });

  it('truncates buy array to 5 items', () => {
    const picks = Array.from({ length: 8 }, (_, i) => ({
      symbol: `T${i}`, companyName: `Co${i}`, recommendation: 'BUY', reason: 'reason', popularityScore: 50,
    }));
    const result = parse(JSON.stringify({ buy: picks, sell: [] }));
    expect(result.buy).toHaveLength(5);
  });

  it('forces recommendation field to BUY/SELL regardless of input', () => {
    const raw = JSON.stringify({
      buy: [{ symbol: 'TSLA', companyName: 'Tesla', recommendation: 'HOLD', reason: 'meh', popularityScore: 40 }],
      sell: [],
    });
    const result = parse(raw);
    expect((result.buy[0] as { recommendation: string }).recommendation).toBe('BUY');
  });

  it('defaults missing buy/sell keys to empty arrays', () => {
    const result = parse(JSON.stringify({}));
    expect(result.buy).toEqual([]);
    expect(result.sell).toEqual([]);
  });
});
