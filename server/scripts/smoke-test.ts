#!/usr/bin/env tsx
/**
 * Post-deploy smoke test — run after every Railway deployment:
 *   npm run smoke
 *   SMOKE_BASE_URL=http://localhost:3001 npm run smoke
 */

const BASE_URL = (process.env.SMOKE_BASE_URL ?? 'https://wfaserver-production.up.railway.app').replace(/\/$/, '');
const TIMEOUT_MS = 30_000;

interface Check { name: string; pass: boolean; detail?: string }

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function check(name: string, fn: () => Promise<void>): Promise<Check> {
  try {
    await fn();
    return { name, pass: true };
  } catch (e) {
    return { name, pass: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

async function runSmoke(): Promise<void> {
  console.log(`\nSmoke test → ${BASE_URL}\n`);

  const checks = await Promise.all([
    check('GET /health → status: ok', async () => {
      const res = await fetchWithTimeout(`${BASE_URL}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { status?: string };
      if (body.status !== 'ok') throw new Error(`Expected status "ok", got "${body.status}"`);
    }),

    check('GET /api/recommendations → has buy[] and sell[]', async () => {
      const res = await fetchWithTimeout(`${BASE_URL}/api/recommendations`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { buy?: unknown[]; sell?: unknown[] };
      if (!Array.isArray(body.buy)) throw new Error('Missing buy array');
      if (!Array.isArray(body.sell)) throw new Error('Missing sell array');
    }),

    check('GET /api/stocks/quote/SPY → has numeric price', async () => {
      const res = await fetchWithTimeout(`${BASE_URL}/api/stocks/quote/SPY`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { price?: unknown };
      if (typeof body.price !== 'number') throw new Error(`price is ${typeof body.price}, expected number`);
    }),
  ]);

  let failed = 0;
  for (const c of checks) {
    const icon = c.pass ? '✓' : '✗';
    console.log(`  ${icon} ${c.name}`);
    if (c.detail) console.log(`      ${c.detail}`);
    if (!c.pass) failed++;
  }

  const passed = checks.length - failed;
  console.log(`\n  ${passed}/${checks.length} passed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runSmoke().catch((e) => {
  console.error('Smoke test runner error:', e);
  process.exit(1);
});
