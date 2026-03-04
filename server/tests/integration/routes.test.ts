import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

// Mock the agent registry before importing anything that uses it
vi.mock('../../src/agents/registry.js', () => ({
  getAgents: vi.fn(),
  closeAgents: vi.fn().mockResolvedValue(undefined),
}));

import { getAgents } from '../../src/agents/registry.js';
import { createApp } from '../../src/app.js';

const mockAnalysis = {
  symbol: 'AAPL',
  recommendation: 'BUY' as const,
  reason: 'Strong fundamentals.',
  financials: { symbol: 'AAPL', instrumentType: 'STOCK' as const, marketCap: 3e12 },
};

const mockQuote = {
  symbol: 'NVDA',
  price: 900,
  change: 10,
  changePercent: 0.011,
  volume: 50_000_000,
  timestamp: new Date().toISOString(),
};

const mockAgents = {
  wallstreet: {
    getRecommendations: vi.fn().mockResolvedValue({
      buy: [{ symbol: 'NVDA', companyName: 'NVIDIA', recommendation: 'BUY', reason: 'Moon', popularityScore: 85, instrumentType: 'STOCK' }],
      sell: [{ symbol: 'AMC', companyName: 'AMC', recommendation: 'SELL', reason: 'Bags', popularityScore: 70, instrumentType: 'STOCK' }],
    }),
    close: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
  },
  quotes: {
    getQuote: vi.fn().mockResolvedValue(mockQuote),
    close: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
  },
  historical: {
    getHistoricalPrices: vi.fn().mockResolvedValue([]),
    close: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
  },
  basicFinancials: {
    analyzeStock: vi.fn().mockResolvedValue(mockAnalysis),
    generateAdskReason: vi.fn().mockResolvedValue('Autodesk is the future of everything!'),
    getFinancials: vi.fn().mockResolvedValue(mockAnalysis.financials),
    close: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
  },
  github: {
    getAdskResult: vi.fn().mockResolvedValue(null),
    saveAdskResult: vi.fn().mockResolvedValue(undefined),
    getStockAnalysis: vi.fn().mockResolvedValue(null),
    saveStockAnalysis: vi.fn().mockResolvedValue(undefined),
    getRecentHistory: vi.fn().mockResolvedValue([]),
    saveRecommendations: vi.fn().mockResolvedValue(undefined),
  },
};

let app: Express;

beforeAll(() => {
  vi.mocked(getAgents).mockResolvedValue(mockAgents as never);
  app = createApp();
});

// ─── Health ──────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
  });
});

// ─── Recommendations ─────────────────────────────────────────────────────────

describe('GET /api/recommendations', () => {
  it('returns 200 with buy and sell arrays', async () => {
    const res = await request(app).get('/api/recommendations');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.buy)).toBe(true);
    expect(Array.isArray(res.body.sell)).toBe(true);
  });

  it('buy items have required fields', async () => {
    const res = await request(app).get('/api/recommendations');
    const item = res.body.buy[0];
    expect(item).toHaveProperty('symbol');
    expect(item).toHaveProperty('recommendation', 'BUY');
  });
});

describe('POST /api/recommendations/refresh', () => {
  it('returns 200 with a message', async () => {
    const res = await request(app).post('/api/recommendations/refresh');
    expect(res.status).toBe(200);
    expect(typeof res.body.message).toBe('string');
  });
});

// ─── Stock analysis ──────────────────────────────────────────────────────────

describe('GET /api/stocks/analyze/:symbol', () => {
  it('returns 200 with symbol and recommendation for a regular stock', async () => {
    const res = await request(app).get('/api/stocks/analyze/AAPL');
    expect(res.status).toBe(200);
    expect(res.body.symbol).toBe('AAPL');
    expect(['BUY', 'SELL']).toContain(res.body.recommendation);
  });

  it('ADSK Easter egg always returns BUY', async () => {
    const res = await request(app).get('/api/stocks/analyze/ADSK');
    expect(res.status).toBe(200);
    expect(res.body.recommendation).toBe('BUY');
  });

  it('response body can be parsed (no Content-Length mismatch)', async () => {
    const res = await request(app).get('/api/stocks/analyze/MSFT');
    expect(res.status).toBe(200);
    // Supertest validates that the body is fully received — this is the core regression check
    expect(res.body).toBeTruthy();
  });
});
