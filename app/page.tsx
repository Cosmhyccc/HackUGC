"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/explore?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <main className="relative min-h-screen bg-black flex flex-col overflow-hidden">

      {/* Retro grid background */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,255,65,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,65,1) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-[#1a1a1a]">
        <span
          className="text-[#00ff41] text-lg font-bold tracking-widest uppercase"
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          HACK<span className="text-white">UGC</span>
        </span>
        <a
          href="/explore"
          className="text-xs text-[#555] hover:text-[#00ff41] tracking-widest uppercase transition-colors"
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          Explore →
        </a>
      </header>

      {/* Hero — centered */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">

        {/* Live badge */}
        <div className="mb-8 inline-flex items-center gap-2 border border-[#1a1a1a] rounded-full px-4 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-pulse" />
          <span
            className="text-[10px] text-[#555] tracking-[0.2em] uppercase"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            Live TikTok Intelligence · Updated Daily
          </span>
        </div>

        {/* Main headline */}
        <h1
          className="text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight mb-6 max-w-4xl"
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          THE UGC FORMATS
          <br />
          <span
            className="text-[#00ff41]"
            style={{ textShadow: "0 0 40px rgba(0,255,65,0.35)" }}
          >
            THAT PRINT INSTALLS.
          </span>
        </h1>

        <p className="text-[#555] text-base md:text-lg max-w-lg leading-relaxed">
          See what&apos;s actually working on TikTok right now.
          Real hooks, formats, and sounds — updated daily.
        </p>
      </div>

      {/* Search bar — bottom anchored */}
      <div className="relative z-10 px-6 pb-12 pt-6">
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 bg-[#0d0d0d] border-2 border-[#1a1a1a] rounded-lg px-5 py-4 focus-within:border-[#00ff41] transition-colors duration-200" style={{ boxShadow: "0 0 30px rgba(0,0,0,0.5)" }}>
            <svg className="w-4 h-4 text-[#444] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
              <path d="M12 2a14.5 14.5 0 0 0 0 20M12 2a14.5 14.5 0 0 1 0 20M2 12h20" strokeWidth="1.5"/>
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Paste your App Store link or search any niche..."
              className="flex-1 bg-transparent text-white text-sm placeholder-[#444] outline-none"
              style={{ fontFamily: "var(--font-inter)" }}
            />
            <button
              type="submit"
              className="flex-shrink-0 bg-[#00ff41] text-black text-xs font-bold px-5 py-2.5 rounded tracking-widest uppercase hover:bg-[#00cc33] active:scale-95 transition-all"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              Analyze
            </button>
          </div>
          <p
            className="text-center text-[10px] text-[#2a2a2a] mt-3 tracking-[0.2em] uppercase"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            Free · No credit card · Results in seconds
          </p>
        </form>
      </div>

    </main>
  );
}
