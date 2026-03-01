import { useEffect } from 'react';
import type { StockRecommendation } from '../types';

interface Props {
  stock: StockRecommendation;
  onClose: () => void;
}

function formatAge(createdUtc: number): string {
  const ageSec = Math.floor(Date.now() / 1000) - createdUtc;
  const days = Math.floor(ageSec / 86400);
  if (days >= 30) return `${Math.floor(days / 30)}mo ago`;
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(ageSec / 3600);
  if (hours >= 1) return `${hours}h ago`;
  return 'just now';
}

export function PostsModal({ stock, onClose }: Props) {
  const isBuy = stock.recommendation === 'BUY';
  const posts = stock.sourcePosts ?? [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`text-xl font-bold font-mono ${isBuy ? 'text-buy' : 'text-sell'}`}>
              {stock.symbol}
            </span>
            <span className="text-sm text-gray-500 font-mono truncate">
              Contributing WSB Posts
            </span>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 ml-4 text-gray-600 hover:text-white transition-colors font-mono text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Post list */}
        <div className="overflow-y-auto divide-y divide-gray-800/50">
          {posts.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-600 font-mono">
              No posts matching {stock.symbol} found
            </p>
          ) : (
            posts.map((post, i) => (
              <div key={i} className="px-6 py-4">
                <div className="flex items-center gap-3 text-xs text-gray-600 font-mono mb-1.5 flex-wrap">
                  <span className="text-gray-400 font-bold">▲ {post.score.toLocaleString()}</span>
                  <span>💬 {post.numComments.toLocaleString()}</span>
                  <span>·</span>
                  <span>{formatAge(post.createdUtc)}</span>
                  {post.author && (
                    <span className="text-gray-500">u/{post.author}</span>
                  )}
                </div>
                <p className="text-sm text-gray-200 leading-relaxed">{post.title}</p>
                {post.body && (
                  <p className="text-xs text-gray-500 leading-relaxed mt-1.5 line-clamp-3">
                    {post.body.length > 400 ? post.body.slice(0, 400) + '…' : post.body}
                  </p>
                )}
                {post.url && (
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-700 hover:text-yellow-400 font-mono mt-1 inline-block transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    ↗ view on reddit
                  </a>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {posts.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-800 text-xs text-gray-700 font-mono shrink-0">
            {posts.length} post{posts.length !== 1 ? 's' : ''} mentioning {stock.symbol} · sorted by score
          </div>
        )}
      </div>
    </div>
  );
}
