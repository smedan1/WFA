import { describe, it, expect } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { BasicFinancialsAgent } from '../../src/agents/basic-financials-agent.js';
import type { BasicFinancials, StockAnalysis } from '../../src/types/index.js';

const mockFinancials: BasicFinancials = {
  symbol: 'AAPL',
  companyName: 'Apple Inc.',
  instrumentType: 'STOCK',
  marketCap: 3_000_000_000_000,
  peRatio: 30,
};

describe('BasicFinancialsAgent.parseAnalysis', () => {
  const agent = new BasicFinancialsAgent({} as Anthropic);
  // Access private method via casting
  const parse = (raw: string) =>
    (agent as unknown as { parseAnalysis(r: string, sym: string, fin: BasicFinancials): StockAnalysis })
      .parseAnalysis(raw, 'AAPL', mockFinancials);

  it('parses a valid JSON response', () => {
    const payload: StockAnalysis = {
      symbol: 'AAPL',
      recommendation: 'BUY',
      reason: 'Strong fundamentals.',
      financials: mockFinancials,
    };
    const result = parse(JSON.stringify(payload));
    expect(result.symbol).toBe('AAPL');
    expect(result.recommendation).toBe('BUY');
    expect(result.reason).toBe('Strong fundamentals.');
  });

  it('strips ```json fences before parsing', () => {
    const payload: StockAnalysis = { symbol: 'AAPL', recommendation: 'SELL', reason: 'Too expensive.', financials: mockFinancials };
    const raw = '```json\n' + JSON.stringify(payload) + '\n```';
    const result = parse(raw);
    expect(result.recommendation).toBe('SELL');
  });

  it('strips plain ``` fences before parsing', () => {
    const payload: StockAnalysis = { symbol: 'AAPL', recommendation: 'BUY', reason: 'Solid.', financials: mockFinancials };
    const raw = '```\n' + JSON.stringify(payload) + '\n```';
    const result = parse(raw);
    expect(result.recommendation).toBe('BUY');
  });

  it('returns a SELL fallback for completely invalid JSON', () => {
    const result = parse('Sorry, I cannot analyze this stock right now.');
    expect(result.recommendation).toBe('SELL');
    expect(result.reason).toBe('Could not retrieve financial data. When in doubt, sell.');
    expect(result.symbol).toBe('AAPL');
    expect(result.financials).toBe(mockFinancials);
  });

  it('returns SELL fallback for truncated JSON', () => {
    const result = parse('{"symbol":"AAPL","recommendation":"BUY"');
    expect(result.recommendation).toBe('SELL');
  });

  it('passes through unexpected extra fields without crashing', () => {
    const payload = { symbol: 'AAPL', recommendation: 'BUY', reason: 'Good.', financials: mockFinancials, extra: 'ignored' };
    const result = parse(JSON.stringify(payload));
    expect(result.symbol).toBe('AAPL');
  });
});
