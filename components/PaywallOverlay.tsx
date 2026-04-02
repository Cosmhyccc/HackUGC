"use client";

interface Props {
  onSubscribe: () => void;
  count: number; // how many items are locked
}

export default function PaywallOverlay({ onSubscribe, count }: Props) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.97) 60%, rgba(0,0,0,0.5) 100%)" }}>
      <div className="text-center px-6 max-w-xs">
        <div className="text-[#00ff41] font-mono text-xs tracking-widest uppercase mb-2">
          + {count} more locked
        </div>
        <p className="text-white font-mono text-sm font-bold mb-1">
          Unlock the full feed
        </p>
        <p className="text-[#555] font-mono text-xs mb-5">
          Subscribe to see every video, all insights, and the full research dashboard.
        </p>
        <button
          onClick={onSubscribe}
          className="bg-[#00ff41] text-black font-mono font-bold text-xs px-6 py-3 rounded tracking-widest uppercase hover:bg-[#00cc33] transition-colors"
        >
          SUBSCRIBE →
        </button>
      </div>
    </div>
  );
}
