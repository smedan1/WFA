export function LoadingState() {
  return (
    <div className="py-12 text-center space-y-4">
      <div className="mx-auto h-10 w-10 rounded-full border-2 border-yellow-500/30 border-t-yellow-500 animate-spin" />
      <div className="space-y-1">
        <p className="text-sm font-bold font-mono text-yellow-400">Consulting the degens...</p>
        <p className="text-xs text-gray-600 font-mono">Scanning r/wallstreetbets for the latest hot takes</p>
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-800 bg-surface-card p-4 animate-pulse space-y-3">
      <div className="flex justify-between">
        <div className="space-y-1.5">
          <div className="h-5 w-16 rounded bg-gray-800" />
          <div className="h-3 w-28 rounded bg-gray-800" />
        </div>
        <div className="h-5 w-12 rounded bg-gray-800" />
      </div>
      <div className="h-6 w-24 rounded bg-gray-800" />
      <div className="h-20 rounded bg-gray-800" />
      <div className="flex gap-4">
        <div className="h-3 w-16 rounded bg-gray-800" />
        <div className="h-3 w-20 rounded bg-gray-800" />
      </div>
      <div className="h-12 rounded bg-gray-800" />
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-6 text-center space-y-2">
      <p className="text-sm font-bold text-red-400 font-mono">Agent error</p>
      <p className="text-xs text-gray-500 font-mono">{message}</p>
    </div>
  );
}
