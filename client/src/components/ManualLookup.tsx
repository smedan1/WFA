import { useState, useRef, useEffect } from 'react';

const ANALYSIS_MESSAGES = [
  'Bribing a Wall Street analyst for a hot tip...',
  'Calculating the ratio of hopium to fundamentals...',
  'Sifting through 10-Ks so you don\'t have to...',
  'Confirming the CEO hasn\'t fled to a non-extradition country...',
  'Running discounted cash flow model on vibes...',
  'Googling what P/E ratio means, again...',
  'Consulting the ancient prophecies of Yahoo Finance...',
  'Stress-testing earnings estimates with a coin flip...',
  'Verifying the CFO is still on speaking terms with the auditors...',
  'Running the numbers through our proprietary guessing engine...',
  'Reading the SEC filing footnotes nobody reads...',
  'Computing the ratio of hype to actual revenue...',
  'Asking Reddit, then immediately ignoring what they said...',
  'Squinting at the balance sheet until it makes sense...',
  'Cross-referencing insider trades with suspicious yacht purchases...',
  'Checking if the moon phase is bullish or bearish...',
  'Confirming this company sells something other than hope...',
  'Calculating how many Wendy\'s shifts this could cost you...',
  'Locating the earnings guidance buried on page 47...',
  'Determining if the stock price reflects reality or enthusiasm...',
];
import type { StockAnalysis } from '../types';
import { api } from '../api/client';
import { StockChart } from './StockChart';

function formatPrice(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function formatNumber(n: number | undefined, decimals = 2): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

function FinancialRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-gray-800/50 text-xs font-mono">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300 font-medium">{value}</span>
    </div>
  );
}

export function ManualLookup() {
  const [symbol, setSymbol] = useState('');
  const [result, setResult] = useState<StockAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msgIndex, setMsgIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) return;
    setMsgIndex(Math.floor(Math.random() * ANALYSIS_MESSAGES.length));
    const id = setInterval(() => {
      setMsgIndex((i) => (i + 1) % ANALYSIS_MESSAGES.length);
    }, 5000);
    return () => clearInterval(id);
  }, [loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await api.analyzeStock(sym);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze stock');
    } finally {
      setLoading(false);
    }
  };

  const isBuy = result?.recommendation === 'BUY';
  const priceChangeColor = result?.quote && result.quote.changePercent >= 0 ? 'text-buy' : 'text-sell';

  return (
    <section className="rounded-2xl border border-gray-800 bg-surface-elevated p-6">
      <h2 className="mb-1 text-base font-bold font-mono text-white uppercase tracking-wider">
        Analyze a Stock
      </h2>
      <p className="mb-5 text-xs text-gray-500 font-mono">
        Enter a ticker symbol to get a fundamental analysis and BUY/SELL recommendation.
      </p>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
        <input
          ref={inputRef}
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="e.g. GME, AMC, NVDA"
          maxLength={10}
          className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm font-mono text-white placeholder-gray-600 focus:border-yellow-500/60 focus:outline-none focus:ring-1 focus:ring-yellow-500/30 uppercase"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !symbol.trim()}
          className={`shrink-0 rounded-lg px-6 py-3 text-sm font-bold font-mono uppercase tracking-wider transition-all duration-200 ${
            loading || !symbol.trim()
              ? 'cursor-not-allowed bg-gray-800 text-gray-600'
              : 'bg-yellow-500 text-black hover:bg-yellow-400 active:scale-95'
          }`}
        >
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </form>

      {/* Loading state */}
      {loading && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-8 text-center space-y-3">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-yellow-500/30 border-t-yellow-500 animate-spin" />
          <p className="text-xs text-gray-500 font-mono">{ANALYSIS_MESSAGES[msgIndex]}</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-center">
          <p className="text-sm font-bold text-red-400 font-mono">Analysis failed</p>
          <p className="text-xs text-gray-500 mt-1 font-mono">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-4">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className={`text-3xl font-bold font-mono ${isBuy ? 'text-buy' : 'text-sell'}`}>
                  {result.symbol}
                </span>
                {result.financials.companyName && (
                  <span className="text-sm text-gray-400 truncate">{result.financials.companyName}</span>
                )}
              </div>
              {result.quote && (
                <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                  <span className="text-xl font-bold font-mono text-white">
                    {formatPrice(result.quote.price)}
                  </span>
                  <span className={`text-sm font-mono ${priceChangeColor}`}>
                    {result.quote.change >= 0 ? '+' : ''}{formatPrice(result.quote.change)}
                    {' '}({result.quote.changePercent >= 0 ? '+' : ''}{result.quote.changePercent.toFixed(2)}%)
                  </span>
                </div>
              )}
              {result.generatedAt && (
                <span className="text-xs text-gray-600 font-mono mt-0.5 block">
                  Updated {new Date(result.generatedAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            <div className={`shrink-0 rounded-xl px-6 py-3 text-center self-start ${isBuy ? 'bg-buy-bg border border-buy-border' : 'bg-sell-bg border border-sell-border'}`}>
              <p className={`text-2xl font-bold font-mono ${isBuy ? 'text-buy' : 'text-sell'}`}>
                {result.recommendation}
              </p>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                {isBuy ? 'Recommended' : 'Avoid'}
              </p>
            </div>
          </div>

          {/* Chart */}
          {result.historicalData && result.historicalData.length > 0 && (
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-3">
              <StockChart data={result.historicalData} type={result.recommendation} />
            </div>
          )}

          {/* Reason */}
          <div className={`rounded-xl p-4 ${isBuy ? 'bg-buy-bg/40 border border-buy-border/30' : 'bg-sell-bg/40 border border-sell-border/30'}`}>
            <p className={`text-xs font-bold font-mono uppercase tracking-wider mb-1.5 ${isBuy ? 'text-buy' : 'text-sell'}`}>
              Wallace Says:
            </p>
            <p className="text-sm text-gray-200 leading-relaxed">{result.reason}</p>
          </div>

          {/* Financials grid */}
          {result.financials && (
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
              <p className="text-xs font-bold font-mono text-gray-500 uppercase tracking-wider mb-3">
                Fundamentals
              </p>
              <div className="space-y-0">
                <FinancialRow label="Market Cap" value={result.financials.marketCap ? `$${(result.financials.marketCap / 1e9).toFixed(2)}B` : '—'} />
                <FinancialRow label="P/E Ratio" value={formatNumber(result.financials.peRatio)} />
                <FinancialRow label="EPS" value={result.financials.eps != null ? formatPrice(result.financials.eps) : '—'} />
                <FinancialRow label="Revenue" value={result.financials.revenue ? `$${(result.financials.revenue / 1e9).toFixed(2)}B` : '—'} />
                <FinancialRow label="Profit Margin" value={result.financials.profitMargin != null ? `${(result.financials.profitMargin * 100).toFixed(1)}%` : '—'} />
                <FinancialRow label="Debt/Equity" value={formatNumber(result.financials.debtToEquity)} />
                <FinancialRow label="Current Ratio" value={formatNumber(result.financials.currentRatio)} />
                <FinancialRow label="Beta" value={formatNumber(result.financials.beta)} />
                <FinancialRow label="Short Float" value={result.financials.shortFloat != null ? `${(result.financials.shortFloat * 100).toFixed(1)}%` : '—'} />
                <FinancialRow label="Price/Book" value={formatNumber(result.financials.priceToBook)} />
                <FinancialRow label="Dividend Yield" value={result.financials.dividendYield != null ? `${(result.financials.dividendYield * 100).toFixed(2)}%` : '—'} />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
