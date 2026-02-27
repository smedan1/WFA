import type { StockRecommendation } from '../types/index.js';

const GH_API = 'https://api.github.com';

export class GithubAgent {
  private token: string | undefined;
  private repoOwner: string;
  private repoName: string;

  constructor(_anthropic: unknown, repoOwner: string, repoName: string) {
    this.token = process.env.GITHUB_TOKEN;
    this.repoOwner = repoOwner;
    this.repoName = repoName;
  }

  private get headers() {
    return {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${this.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };
  }

  async saveRecommendations(recommendations: {
    buy: StockRecommendation[];
    sell: StockRecommendation[];
    timestamp: string;
  }): Promise<void> {
    if (!this.token) {
      console.warn('[GithubAgent] No GITHUB_TOKEN set — skipping save');
      return;
    }

    const ts = new Date(recommendations.timestamp);
    const date = ts.toISOString().split('T')[0];
    const hour = String(ts.getUTCHours()).padStart(2, '0');
    const filePath = `data/recommendations/${date}-${hour}.json`;
    const content = Buffer.from(JSON.stringify(recommendations, null, 2)).toString('base64');
    const url = `${GH_API}/repos/${this.repoOwner}/${this.repoName}/contents/${filePath}`;

    // Check if file already exists (need sha to update)
    let sha: string | undefined;
    const existing = await fetch(url, { headers: this.headers });
    if (existing.ok) {
      const data = await existing.json() as { sha: string };
      sha = data.sha;
    }

    const body: Record<string, string> = {
      message: `chore: save WFA recommendations for ${date}`,
      content,
    };
    if (sha) body.sha = sha;

    const res = await fetch(url, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`[GithubAgent] Failed to save: ${res.status} ${err}`);
    }

    console.log(`[GithubAgent] Saved ${filePath}`);
  }

  async saveAdskResult(result: Record<string, unknown>): Promise<void> {
    if (!this.token) return;
    const filePath = 'data/easter-eggs/adsk.json';
    const payload = { result, generatedAt: new Date().toISOString() };
    const content = Buffer.from(JSON.stringify(payload, null, 2)).toString('base64');
    const url = `${GH_API}/repos/${this.repoOwner}/${this.repoName}/contents/${filePath}`;

    let sha: string | undefined;
    const existing = await fetch(url, { headers: this.headers });
    if (existing.ok) {
      const data = await existing.json() as { sha: string };
      sha = data.sha;
    }

    const body: Record<string, string> = { message: 'chore: update ADSK Easter egg result', content };
    if (sha) body.sha = sha;

    const res = await fetch(url, { method: 'PUT', headers: this.headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`[GithubAgent] Failed to save ADSK result: ${res.status} ${err}`);
    }
    console.log('[GithubAgent] Saved ADSK Easter egg result');
  }

  async getAdskResult(): Promise<{ result: Record<string, unknown>; generatedAt: string } | null> {
    if (!this.token) return null;
    const url = `${GH_API}/repos/${this.repoOwner}/${this.repoName}/contents/data/easter-eggs/adsk.json`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) return null;
    const data = await res.json() as { content: string };
    const json = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8')) as { result: Record<string, unknown>; generatedAt: string };
    return json;
  }

  async getRecentHistory(days = 7): Promise<Array<{
    date: string;
    buy: StockRecommendation[];
    sell: StockRecommendation[];
  }>> {
    if (!this.token) {
      console.warn('[GithubAgent] No GITHUB_TOKEN set — returning empty history');
      return [];
    }

    const dirUrl = `${GH_API}/repos/${this.repoOwner}/${this.repoName}/contents/data/recommendations`;
    const dirRes = await fetch(dirUrl, { headers: this.headers });
    if (!dirRes.ok) return [];

    const files = await dirRes.json() as Array<{ name: string; download_url: string }>;
    const sorted = files
      .filter(f => f.name.endsWith('.json'))
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, days);

    const results = await Promise.allSettled(
      sorted.map(async (f) => {
        const r = await fetch(f.download_url);
        const data = await r.json() as { buy: StockRecommendation[]; sell: StockRecommendation[]; timestamp: string };
        return { date: f.name.replace('.json', '').slice(0, 10), buy: data.buy, sell: data.sell };
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<{ date: string; buy: StockRecommendation[]; sell: StockRecommendation[] }> => r.status === 'fulfilled')
      .map(r => r.value);
  }
}
