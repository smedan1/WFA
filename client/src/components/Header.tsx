import { useState, useEffect } from 'react';

// Must match the server-side cache TTL in recommendations.ts
const CACHE_TTL_MS = 60 * 60 * 1000;

interface Props {
  lastUpdated?: string;
  fromHistory?: boolean;
  historicalDate?: string;
  onRefresh: () => void;
  isLoading: boolean;
  hasError?: boolean;
}

export function Header({ lastUpdated, fromHistory, historicalDate, onRefresh, isLoading, hasError }: Props) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!lastUpdated) return;
    const expiresAt = new Date(lastUpdated).getTime() + CACHE_TTL_MS;
    const tick = () => setRemaining(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const isDisabled = isLoading || (remaining > 0 && !hasError);

  const buttonLabel = isLoading
    ? 'Loading...'
    : remaining > 0
      ? `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`
      : 'Refresh';

  return (
    <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/95 backdrop-blur-sm">
      <div className="mx-auto max-w-screen-2xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="hidden sm:block h-8 w-1 rounded bg-yellow-500" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold font-mono text-white leading-none truncate">
              WFA
            </h1>
            <p className="text-xs text-gray-500 font-mono truncate">
              Wallace Financial Advisor — Powered by Artificial Conviction
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {fromHistory && historicalDate ? (
            <span className="hidden md:block text-xs text-yellow-600 font-mono">
              Cached data from {historicalDate}
            </span>
          ) : lastUpdated && (
            <span className="hidden md:block text-xs text-gray-600 font-mono">
              Updated {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={isDisabled}
            className={`rounded-lg px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider border transition-all duration-200 ${
              isDisabled
                ? 'cursor-not-allowed border-gray-700 bg-gray-900 text-gray-600'
                : 'border-yellow-600/50 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 active:scale-95'
            }`}
          >
            {buttonLabel}
          </button>
        </div>
      </div>

      {/* Disclaimer bar */}
      <div className="bg-red-950/50 border-t border-red-900/30 px-4 py-1.5 text-center">
        <p className="text-xs text-red-400/80 font-mono">
          NOT FINANCIAL ADVICE — Entertainment only — Do not buy or sell based on this app
        </p>
      </div>
    </header>
  );
}
