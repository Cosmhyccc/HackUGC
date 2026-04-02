"use client";
import { useState } from "react";

interface Props {
  onClose: () => void;
  onSignIn: () => void;
  isLoggedIn: boolean;
}

export default function PricingModal({ onClose, onSignIn, isLoggedIn }: Props) {
  const [loading, setLoading] = useState<"monthly" | "yearly" | null>(null);

  async function checkout(plan: "monthly" | "yearly") {
    if (!isLoggedIn) { onClose(); onSignIn(); return; }
    setLoading(plan);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setLoading(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-8">
        <button onClick={onClose}
          className="absolute top-4 right-4 text-[#555] hover:text-white transition-colors text-lg">✕</button>

        <div className="text-[#00ff41] font-mono text-xl font-bold mb-1">HACKUGC PRO</div>
        <p className="text-[#555] font-mono text-sm mb-8">
          Unlock the full TikTok UGC intelligence dashboard.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* Monthly */}
          <div className="border border-[#1a1a1a] rounded-lg p-5 flex flex-col gap-3">
            <div>
              <div className="text-white font-mono font-bold text-2xl">$59</div>
              <div className="text-[#555] font-mono text-xs">per month</div>
            </div>
            <ul className="space-y-1.5 flex-1">
              {["Full explore feed", "All research insights", "Charts & patterns", "AI video analysis"].map(f => (
                <li key={f} className="text-[#555] font-mono text-xs flex items-center gap-2">
                  <span className="text-[#00ff41]">✓</span> {f}
                </li>
              ))}
            </ul>
            <button onClick={() => checkout("monthly")} disabled={!!loading}
              className="w-full border border-[#1a1a1a] text-white font-mono font-bold text-xs py-2.5 rounded tracking-widest uppercase hover:border-[#00ff41] hover:text-[#00ff41] transition-colors disabled:opacity-40">
              {loading === "monthly" ? "LOADING..." : "SUBSCRIBE →"}
            </button>
          </div>

          {/* Yearly */}
          <div className="border border-[#00ff41] rounded-lg p-5 flex flex-col gap-3 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00ff41] text-black font-mono font-bold text-[9px] px-3 py-1 rounded-full tracking-widest">
              BEST VALUE
            </div>
            <div>
              <div className="text-white font-mono font-bold text-2xl">$99</div>
              <div className="text-[#555] font-mono text-xs">per year <span className="text-[#00ff41]">save $609</span></div>
            </div>
            <ul className="space-y-1.5 flex-1">
              {["Full explore feed", "All research insights", "Charts & patterns", "AI video analysis"].map(f => (
                <li key={f} className="text-[#555] font-mono text-xs flex items-center gap-2">
                  <span className="text-[#00ff41]">✓</span> {f}
                </li>
              ))}
            </ul>
            <button onClick={() => checkout("yearly")} disabled={!!loading}
              className="w-full bg-[#00ff41] text-black font-mono font-bold text-xs py-2.5 rounded tracking-widest uppercase hover:bg-[#00cc33] transition-colors disabled:opacity-40">
              {loading === "yearly" ? "LOADING..." : "SUBSCRIBE →"}
            </button>
          </div>
        </div>

        <p className="text-center text-[#333] font-mono text-[10px]">
          Billed via Stripe · Cancel anytime · Instant access
        </p>
      </div>
    </div>
  );
}
