import type { StockRecommendation } from '../types';
import { StockChart } from './StockChart';

interface Props {
  stock: StockRecommendation;
  rank: number;
}

function formatPrice(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function formatVolume(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function PopularityBar({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, score));
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 font-mono w-14 shrink-0">Hype</span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-700"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs font-bold text-yellow-400 font-mono w-8 text-right">{clamped}</span>
    </div>
  );
}

export function StockCard({ stock, rank }: Props) {
  const isBuy = stock.recommendation === 'BUY';
  const quote = stock.quote;

  const borderClass = isBuy
    ? 'border-buy-border hover:border-buy hover:shadow-[0_0_20px_rgba(34,197,94,0.12)]'
    : 'border-sell-border hover:border-sell hover:shadow-[0_0_20px_rgba(239,68,68,0.12)]';

  const badgeClass = isBuy
    ? 'bg-buy-bg text-buy border border-buy-border'
    : 'bg-sell-bg text-sell border border-sell-border';

  const rankClass = isBuy ? 'text-buy' : 'text-sell';

  const priceChangeColor =
    quote && quote.changePercent >= 0 ? 'text-buy' : 'text-sell';

  return (
    <div
      className={`relative rounded-xl border bg-surface-card p-4 transition-all duration-300 ${borderClass}`}
    >
      {/* Rank badge */}
      <span
        className={`absolute -top-3 -left-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-950 text-xs font-bold font-mono border ${isBuy ? 'border-buy-border text-buy' : 'border-sell-border text-sell'}`}
      >
        {rank}
      </span>

      {/* Top row: symbol + badges */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={`text-xl font-bold font-mono ${rankClass}`}>
              {stock.symbol}
            </span>
            {stock.instrumentType === 'ETF' && (
              <span className="text-xs text-blue-400/80 font-mono uppercase tracking-wider border border-blue-400/30 rounded px-1 py-0.5">
                ETF
              </span>
            )}
            {stock.exitReason && (
              <span className="text-xs text-red-400/70 font-mono uppercase tracking-wider">
                [{stock.exitReason}]
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">{stock.companyName}</p>
        </div>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold font-mono uppercase ${badgeClass}`}>
          {isBuy ? 'BUY' : 'SELL'}
        </span>
      </div>

      {/* Real-time quote */}
      {quote ? (
        <div className="mb-3 flex items-baseline gap-3">
          <span className="text-lg font-bold font-mono text-white">
            {formatPrice(quote.price)}
          </span>
          <span className={`text-sm font-mono ${priceChangeColor}`}>
            {quote.change >= 0 ? '+' : ''}
            {formatPrice(quote.change)} ({quote.changePercent >= 0 ? '+' : ''}
            {quote.changePercent.toFixed(2)}%)
          </span>
        </div>
      ) : (
        <div className="mb-3 h-7 animate-pulse rounded bg-gray-800 w-32" />
      )}

      {/* Mini chart */}
      <div className="mb-3 -mx-1">
        {stock.historicalData ? (
          <StockChart data={stock.historicalData} type={stock.recommendation} />
        ) : (
          <div className="h-20 flex items-center justify-center text-xs text-gray-700 font-mono">
            Fetching chart...
          </div>
        )}
      </div>

      {/* Volume & Market Cap / AUM */}
      {quote && (
        <div className="mb-3 flex gap-4 text-xs font-mono text-gray-500">
          <span>Vol: <span className="text-gray-400">{formatVolume(quote.volume)}</span></span>
          {quote.marketCap && (
            <span>
              {stock.instrumentType === 'ETF' ? 'AUM' : 'MCap'}:{' '}
              <span className="text-gray-400">{formatVolume(quote.marketCap)}</span>
            </span>
          )}
        </div>
      )}

      {/* Popularity */}
      <div className="mb-3">
        <PopularityBar score={stock.popularityScore} />
      </div>

      {/* AI reason */}
      <div className={`rounded-lg p-3 text-xs leading-relaxed text-gray-300 ${isBuy ? 'bg-buy-bg/40 border border-buy-border/30' : 'bg-sell-bg/40 border border-sell-border/30'}`}>
        <span className={`text-xs font-bold font-mono uppercase tracking-wider ${isBuy ? 'text-buy' : 'text-sell'}`}>
          WSB Says:
        </span>
        <p className="mt-1">{stock.reason}</p>
      </div>
    </div>
  );
}
