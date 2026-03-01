import { useState, useEffect, useCallback } from 'react';
import { WarningModal } from './components/WarningModal';
import { Header } from './components/Header';
import { StockCard } from './components/StockCard';
import { PostsModal } from './components/PostsModal';
import { ManualLookup } from './components/ManualLookup';
import { LoadingState, CardSkeleton, ErrorState } from './components/LoadingState';
import { MobileBottomNav } from './components/MobileBottomNav';
import type { MobileTab } from './components/MobileBottomNav';
import { api } from './api/client';
import type { RecommendationsResponse, StockRecommendation } from './types';

const WARNING_KEY = 'wfa_warning_accepted';

export default function App() {
  const [warningAccepted, setWarningAccepted] = useState(
    () => sessionStorage.getItem(WARNING_KEY) === 'true'
  );
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keeps loading screen visible for at least 4s after the disclaimer is dismissed
  const [holdLoading, setHoldLoading] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockRecommendation | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('buy');

  const fetchRecommendations = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      if (forceRefresh) {
        await api.refreshRecommendations();
      }
      const data = await api.getRecommendations();
      setRecommendations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (warningAccepted) {
      fetchRecommendations();
    }
  }, [warningAccepted, fetchRecommendations]);

  const handleAcceptWarning = () => {
    sessionStorage.setItem(WARNING_KEY, 'true');
    setWarningAccepted(true);
    setHoldLoading(true);
    setTimeout(() => setHoldLoading(false), 5000);
  };

  const handleRefresh = () => fetchRecommendations(true);

  const isContentLoading = loading || holdLoading;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {!warningAccepted && <WarningModal onAccept={handleAcceptWarning} />}
      {selectedStock && <PostsModal stock={selectedStock} onClose={() => setSelectedStock(null)} />}

      <Header
        lastUpdated={recommendations?.lastUpdated}
        fromHistory={recommendations?.fromHistory}
        historicalDate={recommendations?.historicalDate}
        onRefresh={handleRefresh}
        isLoading={loading}
        hasError={!!error}
      />

      {/* ─── Desktop layout (sm and above) ─────────────────────────────── */}
      <main className="hidden sm:block mx-auto max-w-[2400px] px-4 py-8 space-y-10">
        {isContentLoading && <LoadingState />}

        {error && !isContentLoading && (
          <ErrorState message={error} />
        )}

        {recommendations && !isContentLoading && (
          <>
            {recommendations.fromHistory && (
              <div className="rounded-xl border border-yellow-700/50 bg-yellow-950/30 px-5 py-3 flex items-center gap-3">
                <span className="text-yellow-400 text-lg">⚠</span>
                <p className="text-sm font-mono text-yellow-300">
                  Live data unavailable — showing saved picks from{' '}
                  <span className="font-bold">{recommendations.historicalDate}</span>.
                  Hit Refresh to try again.
                </p>
              </div>
            )}

            {/* BUY panel */}
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-6 w-1 rounded bg-buy" />
                <h2 className="text-base font-bold font-mono text-white uppercase tracking-wider">
                  Top {recommendations.buy.length} Meme Stocks & ETFs to Buy Now
                </h2>
              </div>

              {recommendations.buy.length === 0 ? (
                <div className="rounded-xl border border-gray-800 bg-surface-card p-8 text-center">
                  <p className="text-sm text-gray-500 font-mono">Not enough WSB hype to recommend buys right now. Probably a good sign.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {recommendations.buy.map((stock, i) => (
                    <StockCard key={stock.symbol} stock={stock} rank={i + 1} onSelect={() => setSelectedStock(stock)} />
                  ))}
                  {loading && recommendations.buy.length < 5 && (
                    Array.from({ length: 5 - recommendations.buy.length }).map((_, i) => (
                      <CardSkeleton key={`skeleton-buy-${i}`} />
                    ))
                  )}
                </div>
              )}
            </section>

            {/* SELL panel */}
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-6 w-1 rounded bg-sell" />
                <h2 className="text-base font-bold font-mono text-white uppercase tracking-wider">
                  Top {recommendations.sell.length} Meme Stocks & ETFs to Sell NOW
                </h2>
              </div>

              {recommendations.sell.length === 0 ? (
                <div className="rounded-xl border border-gray-800 bg-surface-card p-8 text-center">
                  <p className="text-sm text-gray-500 font-mono">No active exit signals. Stay alert.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {recommendations.sell.map((stock, i) => (
                    <StockCard key={stock.symbol} stock={stock} rank={i + 1} onSelect={() => setSelectedStock(stock)} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* Manual lookup */}
        <ManualLookup />

        {/* Footer */}
        <footer className="border-t border-gray-800 pt-6 text-center space-y-1">
          <p className="text-xs text-gray-600 font-mono">
            WFA — Wallace Financial Advisor
          </p>
          <p className="text-xs text-red-900/60 font-mono">
            This app provides zero financial advice. Don't do it. Seriously.
          </p>
        </footer>
      </main>

      {/* ─── Mobile layout (below sm) ──────────────────────────────────── */}
      <div className="sm:hidden flex flex-col">
        {/* Historical data banner */}
        {recommendations?.fromHistory && !isContentLoading && (
          <div className="mx-3 mt-3 rounded-lg border border-yellow-700/50 bg-yellow-950/30 px-4 py-2 flex items-center gap-2">
            <span className="text-yellow-400 text-sm">⚠</span>
            <p className="text-xs font-mono text-yellow-300">
              Cached data from{' '}
              <span className="font-bold">{recommendations.historicalDate}</span>
            </p>
          </div>
        )}

        {/* Scrollable tab content — pb-20 clears the fixed bottom nav */}
        <div className="px-3 pt-3 pb-20 space-y-3">
          {/* LOOKUP tab: always available regardless of loading state */}
          {mobileTab === 'analyze' && <ManualLookup />}

          {/* BUY / SELL tabs */}
          {mobileTab !== 'analyze' && (
            <>
              {isContentLoading && <LoadingState />}

              {error && !isContentLoading && <ErrorState message={error} />}

              {recommendations && !isContentLoading && (
                <>
                  {mobileTab === 'buy' && (
                    recommendations.buy.length === 0 ? (
                      <div className="rounded-xl border border-gray-800 bg-surface-card p-8 text-center">
                        <p className="text-sm text-gray-500 font-mono">
                          Not enough WSB hype to recommend buys right now. Probably a good sign.
                        </p>
                      </div>
                    ) : (
                      recommendations.buy.map((stock, i) => (
                        <StockCard
                          key={stock.symbol}
                          stock={stock}
                          rank={i + 1}
                          onSelect={() => setSelectedStock(stock)}
                        />
                      ))
                    )
                  )}

                  {mobileTab === 'sell' && (
                    recommendations.sell.length === 0 ? (
                      <div className="rounded-xl border border-gray-800 bg-surface-card p-8 text-center">
                        <p className="text-sm text-gray-500 font-mono">No active exit signals. Stay alert.</p>
                      </div>
                    ) : (
                      recommendations.sell.map((stock, i) => (
                        <StockCard
                          key={stock.symbol}
                          stock={stock}
                          rank={i + 1}
                          onSelect={() => setSelectedStock(stock)}
                        />
                      ))
                    )
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Fixed bottom tab bar */}
        <MobileBottomNav
          tab={mobileTab}
          onTabChange={setMobileTab}
          buyCount={recommendations?.buy.length}
          sellCount={recommendations?.sell.length}
        />
      </div>
    </div>
  );
}
