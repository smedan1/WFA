import { useState, useEffect } from 'react';

const LOADING_MESSAGES = [
  "Scrolling WSB so you don't have to...",
  "Asking the internet's worst investors...",
  "Harvesting bad takes from r/wallstreetbets...",
  "Counting rocket emojis...",
  "Reading between the YOLO lines...",
  "Polling people who turned $50K into $800...",
  "Sifting through loss porn for hidden gems...",
  "Wallace is doing his research...",
  "Translating 🚀🚀🚀 into financial analysis...",
  "Consulting sources who definitely know what they're doing...",
  "Asking strangers on the internet for stock tips...",
  "Finding diamonds in the rough (mostly rough)...",
  "Locating the least bad idea on the internet...",
  "Performing rigorous due diligence (reading post titles)...",
  "Separating signal from the noise (it's mostly noise)...",
  "Wallace is stress-testing his conviction...",
  "Checking if anyone on WSB has a Series 7...",
  "Identifying stocks with strong meme fundamentals...",
  "Cross-referencing hype with vibes...",
  "Deploying sophisticated sentiment analysis (ctrl+F '🚀')...",
  "Turning FOMO into a structured investment thesis...",
  "Waiting for someone to say 'to the moon'...",
  "Doing the math so you can ignore it anyway...",
  "Wallace is putting on his thinking fedora...",
  "Absorbing the collective wisdom of people eating tendies...",
  "Running the numbers through the YOLO filter...",
  "Consulting the sacred texts of r/wallstreetbets...",
  "Finding the next stock a stranger on Reddit told me to buy...",
  "Wallace is confident. Worryingly confident...",
  "Generating financial advice that technically isn't financial advice...",
];

function randomMessage(exclude?: string) {
  const pool = exclude ? LOADING_MESSAGES.filter(m => m !== exclude) : LOADING_MESSAGES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function LoadingState() {
  const [message, setMessage] = useState(() => randomMessage());

  useEffect(() => {
    const id = setInterval(() => {
      setMessage(prev => randomMessage(prev));
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="py-12 text-center space-y-4">
      <div className="mx-auto h-10 w-10 rounded-full border-2 border-yellow-500/30 border-t-yellow-500 animate-spin" />
      <div className="space-y-1">
        <p className="text-sm font-bold font-mono text-yellow-400">{message}</p>
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
