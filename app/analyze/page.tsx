"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Block } from "./Block";
import { AiObserver } from "./AiObserver";

const TABS = ["Explore", "Research", "Analyze"] as const;

// ── Demo analysis payload ─────────────────────────────────────────────────────
// This is placeholder output shaped like what the real model will return.

const DEMO = {
  viralScore: 84,
  scoreBreakdown: [
    { label: "HOOK",     value: 62, color: "#ffaa00" },
    { label: "PACING",   value: 88, color: "#00ff41" },
    { label: "CLARITY",  value: 74, color: "#00ff41" },
    { label: "PAYOFF",   value: 91, color: "#00ff41" },
    { label: "CTA",      value: 41, color: "#ff3b5c" },
  ],
  hookStrength: 6.2,
  originalHook: "Wait until you see this new app I found...",
  suggestedHook: "I made $2,400 in 30 days using this ONE app — here's exactly how.",
  hookNotes: [
    "Opens with filler ('wait until you see') — burns 1.2s of attention.",
    "No specificity. Viewer can't tell if this is for them.",
    "Promise is vague — rewrite with a number, timeframe, and outcome.",
  ],
  retentionCurve: [100, 94, 86, 71, 69, 66, 63, 61, 59, 58, 57, 55, 53, 52, 51, 50, 49, 48, 47, 47, 46],
  dropoffZones: [2, 11, 17],
  predictedViews: { low: 120_000, mid: 210_000, high: 340_000 },
  predictedMetrics: [
    { label: "ENG RATE",   value: "4.8",  unit: "%", tone: "good" as const,    benchmark: "cat. avg 3.1%" },
    { label: "SAVE RATE",  value: "1.2",  unit: "%", tone: "good" as const,    benchmark: "cat. avg 0.7%" },
    { label: "SHARE RATE", value: "0.4",  unit: "%", tone: "weak" as const,    benchmark: "needs 0.9%+" },
    { label: "FOLLOW RATE",value: "2.1",  unit: "%", tone: "good" as const,    benchmark: "strong" },
  ],
  pacing: { cutsPerMin: 42, wordsPerMin: 165, tone: "fast" },
  emotionArc: [
    { t: 0,   label: "CURIOSITY",    y: 55 },
    { t: 18,  label: "CONFUSION",    y: 38 },
    { t: 36,  label: "BUILD",        y: 62 },
    { t: 58,  label: "TENSION",      y: 85 },
    { t: 82,  label: "PAYOFF",       y: 92 },
    { t: 100, label: "CTA",          y: 48 },
  ],
  issues: [
    { severity: "high" as const, title: "Weak opening hook",        detail: "Hook too vague — 38% of viewers bounce by 0:03." },
    { severity: "high" as const, title: "No face in first 2s",      detail: "Faceless openings reduce trust and watch-through on app niches by ~22%." },
    { severity: "med"  as const, title: "CTA arrives too late",     detail: "Viewer retention at 0:18 is only 47% — move CTA earlier." },
    { severity: "med"  as const, title: "Music overpowers VO",      detail: "Background track peaks at -6dB; drop to -14dB under speech." },
    { severity: "low"  as const, title: "Caption has 3 filler words", detail: "'really', 'thing', 'just' — replace with specifics." },
  ],
  captionTokens: [
    { w: "You", t: "ok" as const },
    { w: "won't", t: "ok" as const },
    { w: "believe", t: "weak" as const },
    { w: "this", t: "weak" as const },
    { w: "really", t: "weak" as const },
    { w: "insane", t: "strong" as const },
    { w: "app", t: "ok" as const },
    { w: "that", t: "ok" as const },
    { w: "made", t: "ok" as const },
    { w: "me", t: "ok" as const },
    { w: "$2,400", t: "strong" as const },
    { w: "in", t: "ok" as const },
    { w: "30", t: "strong" as const },
    { w: "days", t: "ok" as const },
  ],
  radar: [
    { axis: "HOOK",     you: 62, top: 92 },
    { axis: "STORY",    you: 74, top: 86 },
    { axis: "PACE",     you: 88, top: 90 },
    { axis: "VISUAL",   you: 71, top: 85 },
    { axis: "AUDIO",    you: 58, top: 83 },
    { axis: "CTA",      you: 41, top: 88 },
  ],
  frames: [
    { t: "0:00", tag: "HOOK",   note: "Low contrast, no face" },
    { t: "0:03", tag: "BROLL",  note: "Unrelated cutaway" },
    { t: "0:07", tag: "FACE",   note: "First direct eye contact" },
    { t: "0:14", tag: "PROOF",  note: "Screenshot shown — good" },
    { t: "0:22", tag: "CTA",    note: "Arrives late" },
  ],
  similarHits: [
    { handle: "@appdealsdaily", views: 2_400_000, match: 94 },
    { handle: "@sidehustlesam",  views: 1_100_000, match: 88 },
    { handle: "@thefinanceguy",  views: 780_000,   match: 82 },
  ],
  bestPostTime: "Tue 7:42 PM ET",
  confidence: 91,
};

const DEFAULT_TIKTOK_URL = "https://www.tiktok.com/@stoolpresidente/video/7436381391217429803";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractVideoId(url: string): string | null {
  const m = url.match(/\/video\/(\d+)/);
  return m ? m[1] : null;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

function useCountUp(target: number, duration = 1400, enabled = true): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!enabled) { setVal(0); return; }
    let raf = 0;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);
  return val;
}

// ── Small building blocks ─────────────────────────────────────────────────────

function ViralScoreGauge({ score, ready }: { score: number; ready: boolean }) {
  const radius = 68;
  const circ = 2 * Math.PI * radius;
  const animated = useCountUp(score, 1600, ready);
  const pct = animated / 100;
  const color = score >= 80 ? "#00ff41" : score >= 60 ? "#ffaa00" : "#ff3b5c";

  return (
    <div className="flex items-center gap-5">
      <div className="relative" style={{ width: 160, height: 160 }}>
        <svg width="160" height="160" className="-rotate-90">
          <circle cx="80" cy="80" r={radius} stroke="#141414" strokeWidth="10" fill="none" />
          <circle
            cx="80" cy="80" r={radius}
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            style={{ filter: `drop-shadow(0 0 8px ${color}aa)`, transition: "stroke-dashoffset 80ms linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[9px] text-[#555] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>VIRAL</span>
          <span className="text-5xl font-bold" style={{ fontFamily: "var(--font-space-mono)", color }}>
            {Math.round(animated)}
          </span>
          <span className="text-[9px] text-[#555] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>/ 100</span>
        </div>
      </div>

      <div className="flex-1 space-y-1.5">
        {DEMO.scoreBreakdown.map((b, i) => {
          const val = ready ? b.value : 0;
          return (
            <div key={b.label} className="flex items-center gap-2">
              <span className="text-[9px] w-14 text-[#888] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>{b.label}</span>
              <div className="flex-1 h-1.5 bg-[#111] rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${val}%`,
                    background: b.color,
                    boxShadow: `0 0 6px ${b.color}aa`,
                    transition: `width 900ms cubic-bezier(0.2, 0.8, 0.2, 1) ${200 + i * 90}ms`,
                  }}
                />
              </div>
              <span className="text-[9px] w-6 text-right font-bold" style={{ fontFamily: "var(--font-space-mono)", color: b.color }}>
                {b.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RetentionCurve({ ready }: { ready: boolean }) {
  const w = 320;
  const h = 120;
  const pts = DEMO.retentionCurve;
  const step = w / (pts.length - 1);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (p / 100) * h}`).join(" ");
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  const pathRef = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);
  useEffect(() => {
    if (pathRef.current) setLen(pathRef.current.getTotalLength());
  }, []);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="text-white text-2xl font-bold" style={{ fontFamily: "var(--font-space-mono)" }}>
            {useCountUp(68, 1400, ready).toFixed(0)}<span className="text-sm text-[#555]">%</span>
          </div>
          <div className="text-[9px] text-[#555] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>AVG WATCH-THROUGH</div>
        </div>
        <div className="text-right">
          <div className="text-[#ff3b5c] text-xs font-bold" style={{ fontFamily: "var(--font-space-mono)" }}>-32%</div>
          <div className="text-[9px] text-[#555] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>DROP @ 0:03</div>
        </div>
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }}>
        <defs>
          <linearGradient id="ret-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00ff41" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00ff41" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[25, 50, 75].map((g) => (
          <line key={g} x1="0" x2={w} y1={(g / 100) * h} y2={(g / 100) * h} stroke="#141414" strokeDasharray="2 4" />
        ))}
        {DEMO.dropoffZones.map((z, i) => {
          const x = (z / (pts.length - 1)) * w;
          return (
            <g key={i}>
              <line x1={x} x2={x} y1="0" y2={h} stroke="#ff3b5c" strokeOpacity="0.5" strokeDasharray="3 3" />
              <circle cx={x} cy={h - (pts[z] / 100) * h} r="4" fill="#ff3b5c" />
              <circle cx={x} cy={h - (pts[z] / 100) * h} r="4" fill="#ff3b5c" opacity="0.3">
                <animate attributeName="r" values="4;10;4" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0;0.4" dur="1.6s" repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}
        <path d={area} fill="url(#ret-grad)" style={{
          opacity: ready ? 1 : 0,
          transition: "opacity 900ms 1200ms",
        }} />
        <path
          ref={pathRef}
          d={path}
          fill="none"
          stroke="#00ff41"
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            filter: "drop-shadow(0 0 4px rgba(0,255,65,0.6))",
            strokeDasharray: len,
            strokeDashoffset: ready ? 0 : len,
            transition: "stroke-dashoffset 1400ms cubic-bezier(0.6, 0, 0.4, 1)",
          }}
        />
      </svg>
    </div>
  );
}

function EmotionArc({ ready }: { ready: boolean }) {
  const w = 300, h = 90;
  const pts = DEMO.emotionArc;
  const xy = pts.map((p) => ({ x: (p.t / 100) * w, y: h - (p.y / 100) * h }));
  const path = xy.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = xy[i - 1];
    const cx = (prev.x + p.x) / 2;
    return acc + ` Q ${cx} ${prev.y} ${cx} ${(prev.y + p.y) / 2} T ${p.x} ${p.y}`;
  }, "");
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }}>
        <defs>
          <linearGradient id="emo-line" x1="0" x2="1">
            <stop offset="0%" stopColor="#00ff41" />
            <stop offset="50%" stopColor="#ffaa00" />
            <stop offset="100%" stopColor="#ff3b5c" />
          </linearGradient>
        </defs>
        <path d={path} fill="none" stroke="url(#emo-line)" strokeWidth="2.5" style={{
          opacity: ready ? 1 : 0,
          transition: "opacity 900ms 400ms",
          filter: "drop-shadow(0 0 4px rgba(0,255,65,0.4))",
        }} />
        {xy.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" style={{
            opacity: ready ? 1 : 0,
            transition: `opacity 400ms ${600 + i * 100}ms`,
          }} />
        ))}
      </svg>
      <div className="flex justify-between mt-1.5">
        {pts.map((p) => (
          <span key={p.t} className="text-[8px] text-[#555] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function RadarChart({ ready }: { ready: boolean }) {
  const size = 180, cx = size / 2, cy = size / 2, R = 70;
  const axes = DEMO.radar;
  const angle = (i: number) => (Math.PI * 2 * i) / axes.length - Math.PI / 2;
  const point = (val: number, i: number) => {
    const r = (val / 100) * R * (ready ? 1 : 0);
    return `${cx + Math.cos(angle(i)) * r},${cy + Math.sin(angle(i)) * r}`;
  };
  const youPath = axes.map((a, i) => point(a.you, i)).join(" ");
  const topPath = axes.map((a, i) => point(a.top, i)).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full" style={{ height: size }}>
      {[0.33, 0.66, 1].map((s, i) => (
        <polygon
          key={i}
          points={axes.map((_, j) => {
            const r = R * s;
            return `${cx + Math.cos(angle(j)) * r},${cy + Math.sin(angle(j)) * r}`;
          }).join(" ")}
          fill="none"
          stroke="#1a1a1a"
        />
      ))}
      {axes.map((_, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(angle(i)) * R} y2={cy + Math.sin(angle(i)) * R} stroke="#141414" />
      ))}
      <polygon points={topPath} fill="#ffffff10" stroke="#555" strokeWidth="1" style={{
        transition: "all 1200ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      }} />
      <polygon points={youPath} fill="#00ff4122" stroke="#00ff41" strokeWidth="1.5" style={{
        filter: "drop-shadow(0 0 4px rgba(0,255,65,0.5))",
        transition: "all 1200ms 200ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      }} />
      {axes.map((a, i) => {
        const labelR = R + 12;
        const lx = cx + Math.cos(angle(i)) * labelR;
        const ly = cy + Math.sin(angle(i)) * labelR;
        return (
          <text key={a.axis} x={lx} y={ly} fill="#666" fontSize="8" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: "var(--font-space-mono)" }}>
            {a.axis}
          </text>
        );
      })}
    </svg>
  );
}

function Counter({ value, format, enabled }: { value: number; format?: (v: number) => string; enabled: boolean }) {
  const v = useCountUp(value, 1400, enabled);
  return <>{format ? format(v) : Math.round(v)}</>;
}

function MiniBars({ count = 24, ready }: { count?: number; ready: boolean }) {
  const heights = useMemo(() => Array.from({ length: count }, () => 20 + Math.random() * 80), [count]);
  return (
    <div className="flex items-end gap-0.5 h-14">
      {heights.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: ready ? `${h}%` : "6%",
            background: i === Math.floor(count / 2) - 2 ? "#ff3b5c" : "#00ff41",
            opacity: 0.8,
            boxShadow: "0 0 4px currentColor",
            transition: `height 700ms cubic-bezier(0.2, 0.8, 0.2, 1) ${i * 25}ms`,
          }}
        />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Stage = "idle" | "scanning" | "ready";

export default function AnalyzePage() {
  const router = useRouter();
  const [urlInput, setUrlInput] = useState("");
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [scanStep, setScanStep] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  const isBlobUrl = activeUrl?.startsWith("blob:") ?? false;
  const videoId = activeUrl && !isBlobUrl ? extractVideoId(activeUrl) : null;

  const runAnalysis = (url: string) => {
    setActiveUrl(url);
    setStage("scanning");
    setScanStep(0);
  };

  const resetIntake = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setActiveUrl(null);
    setUploadedFile(null);
    setStage("idle");
    setUrlInput("");
    setUploadError(null);
  };

  const handleFile = (file: File) => {
    // Accept by MIME OR extension (some platforms — esp. iPhone .mov — report empty MIME)
    const validExt = /\.(mp4|mov|webm|m4v|avi|mkv|hevc|qt|3gp)$/i;
    const looksLikeVideo = file.type.startsWith("video/") || validExt.test(file.name);
    if (!looksLikeVideo) {
      setUploadError(`"${file.name}" doesn't look like a video file. Try MP4, MOV, or WEBM.`);
      return;
    }
    // 1 GB cap — generous for full-length phone clips, prevents truly massive files
    if (file.size > 1024 * 1024 * 1024) {
      setUploadError(`Too large — ${(file.size / 1024 / 1024).toFixed(0)} MB. Keep it under 1 GB.`);
      return;
    }
    setUploadError(null);
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const url = URL.createObjectURL(file);
    blobUrlRef.current = url;
    setUploadedFile({ name: file.name, size: file.size });
    runAnalysis(url);
  };

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (stage !== "scanning") return;
    const steps = [
      "DECODING VIDEO FRAMES",
      "TRANSCRIBING SPEECH",
      "DETECTING HOOK PATTERNS",
      "SCORING RETENTION CURVE",
      "BENCHMARKING vs 17K VIDEOS",
      "GENERATING FIXES",
    ];
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setScanStep(i);
      if (i >= steps.length) {
        clearInterval(interval);
        setTimeout(() => setStage("ready"), 300);
      }
    }, 420);
    return () => clearInterval(interval);
  }, [stage]);

  const ready = stage === "ready";

  return (
    <div className="relative min-h-screen bg-black text-white">
      <style jsx global>{`
        @keyframes blockIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scanSweep {
          0%   { transform: translateY(-10%); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateY(110%); opacity: 0; }
        }
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes aieye-spin { to { transform: rotate(360deg); } }
        @keyframes aieye-spin-rev { to { transform: rotate(-360deg); } }
        @keyframes aieye-sweep {
          0%   { transform: translateY(-44px); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(44px); opacity: 0; }
        }
        @keyframes aiobs-pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.35; }
        }
      `}</style>

      {/* grid bg */}
      <div className="fixed inset-0 opacity-[0.025] pointer-events-none"
        style={{ backgroundImage: `linear-gradient(rgba(0,255,65,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,65,1) 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a] bg-black/80 backdrop-blur-sm sticky top-0">
        <a href="/" className="text-[#00ff41] text-base font-bold tracking-widest uppercase" style={{ fontFamily: "var(--font-space-mono)" }}>
          HACK<span className="text-white">UGC</span>
        </a>
        <div className="flex items-center gap-1 border border-[#1a1a1a] rounded p-1">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => {
              if (tab === "Analyze") return;
              router.push(`/explore`);
            }}
              className={`px-5 py-1.5 text-xs rounded tracking-widest uppercase transition-all duration-150 ${tab === "Analyze" ? "bg-[#00ff41] text-black font-bold" : "text-[#555] hover:text-white"}`}
              style={{ fontFamily: "var(--font-space-mono)" }}>
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-pulse" />
          <span className="text-[10px] text-[#444]" style={{ fontFamily: "var(--font-space-mono)" }}>AI COACH</span>
        </div>
      </header>

      <main className="relative z-10 px-6 py-6 max-w-[1440px] mx-auto">
        {/* Intake state */}
        {stage === "idle" && !activeUrl && (
          <div className="max-w-2xl mx-auto pt-12 pb-24">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-pulse" />
              <span className="text-[10px] text-[#555] tracking-[0.3em] uppercase" style={{ fontFamily: "var(--font-space-mono)" }}>AI CONTENT COACH · v0.1</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4" style={{ fontFamily: "var(--font-space-mono)" }}>
              Drop a video.<br/>
              <span className="text-[#00ff41]" style={{ textShadow: "0 0 30px rgba(0,255,65,0.3)" }}>
                Get a frame-by-frame roast.
              </span>
            </h1>
            <p className="text-[#777] text-sm mb-8 max-w-lg leading-relaxed" style={{ fontFamily: "var(--font-inter)" }}>
              Paste a TikTok URL <span className="text-[#00ff41]">or upload your own clip</span>. We&apos;ll break down the hook,
              retention curve, pacing, emotional arc, and give you the exact rewrite that would&apos;ve 2x&apos;d your views.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); if (urlInput.trim()) runAnalysis(urlInput.trim()); }}>
              <div className="flex items-center gap-3 bg-[#0d0d0d] border-2 border-[#1a1a1a] rounded-lg px-4 py-3 focus-within:border-[#00ff41] transition-colors duration-200">
                <svg className="w-4 h-4 text-[#444] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth="1.5" d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 1 0-7-7l-1 1" />
                  <path strokeWidth="1.5" d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 1 0 7 7l1-1" />
                </svg>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://www.tiktok.com/@user/video/..."
                  className="flex-1 bg-transparent text-white text-sm placeholder-[#333] outline-none"
                  style={{ fontFamily: "var(--font-inter)" }}
                />
                <button type="submit"
                  className="flex-shrink-0 bg-[#00ff41] text-black text-[10px] font-bold px-4 py-2 rounded tracking-widest uppercase hover:bg-[#00cc33] active:scale-95 transition-all"
                  style={{ fontFamily: "var(--font-space-mono)" }}>
                  Analyze →
                </button>
              </div>
            </form>

            {/* OR divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-[#1a1a1a]" />
              <span className="text-[9px] text-[#444] tracking-[0.3em] uppercase" style={{ fontFamily: "var(--font-space-mono)" }}>
                OR
              </span>
              <div className="flex-1 h-px bg-[#1a1a1a]" />
            </div>

            {/* Drop zone / upload */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); }
              }}
              className={`relative cursor-pointer rounded-lg border-2 border-dashed transition-all duration-200 px-4 py-7 text-center ${
                dragActive
                  ? "border-[#00ff41] bg-[#00ff41]/[0.04]"
                  : "border-[#1a1a1a] hover:border-[#00ff41]/50 bg-[#0d0d0d]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,.mp4,.mov,.webm,.m4v,.avi,.mkv,.hevc,.qt,.3gp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
              <div className="flex items-center justify-center gap-3">
                <svg className={`w-5 h-5 transition-colors ${dragActive ? "text-[#00ff41]" : "text-[#555]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L6 10m6-6 6 6M4 20h16" />
                </svg>
                <span className={`text-[11px] tracking-[0.22em] uppercase transition-colors ${dragActive ? "text-[#00ff41]" : "text-[#888]"}`}
                  style={{ fontFamily: "var(--font-space-mono)" }}>
                  {dragActive ? "Drop to analyze" : "Upload your own video"}
                </span>
              </div>
              <div className="text-[9px] text-[#444] mt-2 tracking-widest uppercase" style={{ fontFamily: "var(--font-space-mono)" }}>
                MP4 · MOV · WEBM · drag & drop or click
              </div>
            </div>

            {uploadError && (
              <div className="mt-3 flex items-start gap-2 text-[10px] text-[#ff3b5c] border border-[#ff3b5c]/30 bg-[#ff3b5c]/[0.04] rounded-lg px-3 py-2"
                style={{ fontFamily: "var(--font-space-mono)" }}>
                <span className="flex-shrink-0">!</span>
                <span className="leading-snug">{uploadError}</span>
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => { setUrlInput(DEFAULT_TIKTOK_URL); runAnalysis(DEFAULT_TIKTOK_URL); }}
                className="text-[10px] text-[#555] hover:text-[#00ff41] tracking-widest uppercase transition-colors"
                style={{ fontFamily: "var(--font-space-mono)" }}>
                ► Try with a demo video
              </button>
              <span className="text-[#222]">·</span>
              <span className="text-[10px] text-[#333] tracking-widest uppercase" style={{ fontFamily: "var(--font-space-mono)" }}>
                Free for early users
              </span>
            </div>
          </div>
        )}

        {/* Main split layout */}
        {activeUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
            {/* LEFT: Video + scan overlay */}
            <div className="space-y-3">
              <div
                className="relative bg-[#080808] border border-[#1a1a1a] rounded-xl overflow-hidden"
                style={{ aspectRatio: "9/16" }}
              >
                {isBlobUrl && activeUrl ? (
                  <video
                    key={activeUrl}
                    src={activeUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    controls
                    className="absolute inset-0 w-full h-full object-cover bg-black"
                  />
                ) : videoId ? (
                  <div className="absolute inset-0 overflow-hidden">
                    <iframe
                      src={`https://www.tiktok.com/embed/v2/${videoId}?autoplay=1`}
                      style={{
                        border: "none",
                        position: "absolute",
                        top: 0, left: 0,
                        width: "100%",
                        height: "calc(100% + 100px)",
                      }}
                      allow="encrypted-media; autoplay"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-[#080808] pointer-events-none z-10" style={{ height: "100px" }} />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[#333] text-[10px]" style={{ fontFamily: "var(--font-space-mono)" }}>
                    INVALID URL
                  </div>
                )}

                {/* Uploaded file badge */}
                {isBlobUrl && uploadedFile && (
                  <div className="absolute bottom-2 left-2 right-2 z-30 flex items-center justify-between bg-black/70 border border-[#1a1a1a] rounded px-2 py-1 pointer-events-none">
                    <span className="text-[8px] text-[#888] tracking-widest truncate" style={{ fontFamily: "var(--font-space-mono)" }}>
                      ↑ {uploadedFile.name}
                    </span>
                    <span className="text-[8px] text-[#444] tracking-widest ml-2 flex-shrink-0" style={{ fontFamily: "var(--font-space-mono)" }}>
                      {(uploadedFile.size / (1024 * 1024)).toFixed(1)}MB
                    </span>
                  </div>
                )}

                {/* Scan overlay */}
                {stage === "scanning" && (
                  <>
                    <div className="absolute inset-0 z-30 pointer-events-none" style={{ background: "rgba(0,0,0,0.4)" }} />
                    <div
                      className="absolute left-0 right-0 z-30 h-[3px] pointer-events-none"
                      style={{
                        background: "linear-gradient(180deg, transparent, #00ff41, transparent)",
                        boxShadow: "0 0 20px #00ff41, 0 0 40px #00ff41",
                        animation: "scanSweep 1.6s linear infinite",
                      }}
                    />
                    {/* Bounding boxes */}
                    <div className="absolute top-[20%] left-[18%] w-16 h-20 border border-[#00ff41] z-30 pointer-events-none" style={{ boxShadow: "0 0 8px #00ff4166" }}>
                      <div className="absolute -top-4 left-0 text-[8px] text-[#00ff41] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>FACE · 96%</div>
                    </div>
                    <div className="absolute top-[55%] left-[40%] w-20 h-10 border border-[#ffaa00] z-30 pointer-events-none" style={{ boxShadow: "0 0 8px #ffaa0066" }}>
                      <div className="absolute -top-4 left-0 text-[8px] text-[#ffaa00] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>TEXT · 88%</div>
                    </div>
                  </>
                )}

                {/* READY HUD */}
                {ready && (
                  <>
                    <div className="absolute top-2 left-2 z-30 flex items-center gap-1.5 bg-black/70 border border-[#00ff41] rounded px-2 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-pulse" />
                      <span className="text-[8px] text-[#00ff41] tracking-widest font-bold" style={{ fontFamily: "var(--font-space-mono)" }}>
                        ANALYZED
                      </span>
                    </div>
                    <div className="absolute top-2 right-2 z-30 bg-black/70 border border-[#1a1a1a] rounded px-2 py-1">
                      <span className="text-[8px] text-[#888] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>
                        CONF · {DEMO.confidence}%
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Scan progress / Action strip */}
              {stage === "scanning" ? (
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-pulse" />
                    <span className="text-[10px] text-[#00ff41] tracking-widest uppercase" style={{ fontFamily: "var(--font-space-mono)" }}>
                      SCANNING
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {["DECODING VIDEO FRAMES","TRANSCRIBING SPEECH","DETECTING HOOK PATTERNS","SCORING RETENTION CURVE","BENCHMARKING vs 17K VIDEOS","GENERATING FIXES"].map((s, i) => (
                      <div key={s} className="flex items-center gap-2">
                        <span className="text-[9px] w-3" style={{ color: i < scanStep ? "#00ff41" : i === scanStep ? "#ffaa00" : "#333", fontFamily: "var(--font-space-mono)" }}>
                          {i < scanStep ? "✓" : i === scanStep ? "→" : "·"}
                        </span>
                        <span className="text-[9px] tracking-widest" style={{ color: i < scanStep ? "#888" : i === scanStep ? "#fff" : "#333", fontFamily: "var(--font-space-mono)" }}>
                          {s}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={resetIntake}
                    className="flex-1 text-[10px] text-[#555] hover:text-white border border-[#1a1a1a] hover:border-[#00ff41] rounded-lg px-3 py-2.5 tracking-widest uppercase transition-colors"
                    style={{ fontFamily: "var(--font-space-mono)" }}>
                    New video
                  </button>
                  <button
                    className="flex-1 bg-[#00ff41] text-black text-[10px] font-bold rounded-lg px-3 py-2.5 tracking-widest uppercase hover:bg-[#00cc33] transition-colors"
                    style={{ fontFamily: "var(--font-space-mono)" }}>
                    Export report ↗
                  </button>
                </div>
              )}

              {/* Frame timeline */}
              {ready && (
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3 opacity-0"
                  style={{ animation: `blockIn 500ms 900ms forwards cubic-bezier(0.2, 0.8, 0.2, 1)` }}>
                  <div className="text-[9px] tracking-widest text-[#555] uppercase mb-2" style={{ fontFamily: "var(--font-space-mono)" }}>
                    FRAME TIMELINE
                  </div>
                  <div className="space-y-1.5">
                    {DEMO.frames.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[9px] text-[#00ff41] w-9" style={{ fontFamily: "var(--font-space-mono)" }}>{f.t}</span>
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#111] text-[#999] tracking-widest w-14 text-center" style={{ fontFamily: "var(--font-space-mono)" }}>{f.tag}</span>
                        <span className="text-[10px] text-[#aaa] flex-1 truncate" style={{ fontFamily: "var(--font-inter)" }}>{f.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Stats grid — fade in when ready */}
            <div>
              {stage === "scanning" && (
                <div className="grid grid-cols-2 gap-5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 h-40 animate-pulse" />
                  ))}
                </div>
              )}

              {ready && (
                <div className="grid grid-cols-1 md:grid-cols-6 gap-5 auto-rows-min">
                  {/* AI Observer — spans 2 (sits to the right of the video, left of viral score) */}
                  <div className="md:col-span-2">
                    <AiObserver mode="watching" delay={0} />
                  </div>

                  {/* Viral score — spans 4 */}
                  <div className="md:col-span-4">
                    <Block title="OVERALL VIRAL SCORE" delay={60} accent="#00ff41">
                      <ViralScoreGauge score={DEMO.viralScore} ready={ready} />
                    </Block>
                  </div>

                  {/* Predicted views — spans 2 */}
                  <div className="md:col-span-2">
                    <Block title="PREDICTED REACH" delay={120} accent="#00ff41">
                      <div className="flex flex-col justify-center h-[152px]">
                        <div className="text-[9px] text-[#555] mb-1 tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>RANGE · 7 DAYS</div>
                        <div className="text-white text-3xl font-bold" style={{ fontFamily: "var(--font-space-mono)" }}>
                          <Counter value={DEMO.predictedViews.low} format={(v) => fmt(Math.round(v))} enabled={ready} /> – <Counter value={DEMO.predictedViews.high} format={(v) => fmt(Math.round(v))} enabled={ready} />
                        </div>
                        <div className="mt-2 h-2 bg-[#0d0d0d] rounded overflow-hidden relative">
                          <div
                            className="absolute inset-y-0 rounded bg-[#00ff41]"
                            style={{
                              left: "18%",
                              right: "18%",
                              boxShadow: "0 0 10px #00ff41aa",
                              transform: ready ? "scaleX(1)" : "scaleX(0)",
                              transformOrigin: "center",
                              transition: "transform 1200ms cubic-bezier(0.2, 0.8, 0.2, 1) 400ms",
                            }}
                          />
                          <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3" style={{ left: "50%", background: "#fff" }} />
                        </div>
                        <div className="flex justify-between text-[8px] text-[#555] mt-1 tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>
                          <span>P10</span><span>MEDIAN {fmt(DEMO.predictedViews.mid)}</span><span>P90</span>
                        </div>
                      </div>
                    </Block>
                  </div>

                  {/* Retention curve — spans 4 */}
                  <div className="md:col-span-4">
                    <Block title="RETENTION CURVE" delay={180} accent="#00ff41">
                      <RetentionCurve ready={ready} />
                    </Block>
                  </div>

                  {/* Emotion arc — spans 2 */}
                  <div className="md:col-span-2">
                    <Block title="EMOTIONAL ARC" delay={240} accent="#ffaa00">
                      <EmotionArc ready={ready} />
                    </Block>
                  </div>

                  {/* Hook rewrite — spans 4 */}
                  <div className="md:col-span-4">
                    <Block title="HOOK REWRITE" delay={300} accent="#ff3b5c">
                      <div className="space-y-2.5">
                        <div>
                          <div className="text-[9px] text-[#555] mb-1 tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>ORIGINAL · {DEMO.hookStrength}/10</div>
                          <div className="text-[#888] text-sm line-through decoration-[#ff3b5c]/60" style={{ fontFamily: "var(--font-inter)" }}>
                            &ldquo;{DEMO.originalHook}&rdquo;
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] text-[#00ff41] mb-1 tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>AI REWRITE · 9.1/10</div>
                          <div className="text-white text-sm font-medium" style={{ fontFamily: "var(--font-inter)", textShadow: "0 0 10px rgba(0,255,65,0.15)" }}>
                            &ldquo;{DEMO.suggestedHook}&rdquo;
                          </div>
                        </div>
                        <ul className="pt-2 border-t border-[#141414] space-y-1">
                          {DEMO.hookNotes.map((n, i) => (
                            <li key={i} className="text-[10px] text-[#888] flex gap-2 leading-snug" style={{ fontFamily: "var(--font-inter)" }}>
                              <span className="text-[#00ff41]">·</span> {n}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Block>
                  </div>

                  {/* Radar — spans 2 */}
                  <div className="md:col-span-2">
                    <Block title="vs TOP PERFORMERS" delay={360} accent="#00ff41">
                      <RadarChart ready={ready} />
                      <div className="flex gap-4 justify-center mt-1">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm bg-[#00ff41]" />
                          <span className="text-[9px] text-[#888] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>YOU</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm bg-[#555]" />
                          <span className="text-[9px] text-[#888] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>TOP 1%</span>
                        </div>
                      </div>
                    </Block>
                  </div>

                  {/* Issues — spans 4 (paired with Radar) */}
                  <div className="md:col-span-4">
                    <Block title="FIX LIST · PRIORITIZED" delay={420} accent="#ff3b5c">
                      <div className="space-y-2">
                        {DEMO.issues.map((iss, i) => {
                          const color = iss.severity === "high" ? "#ff3b5c" : iss.severity === "med" ? "#ffaa00" : "#00ff41";
                          return (
                            <div key={i} className="flex gap-3 items-start border border-[#141414] rounded-lg p-2.5 bg-[#060606]">
                              <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                                <span className="text-[8px] text-[#555] tracking-widest mt-1" style={{ fontFamily: "var(--font-space-mono)" }}>
                                  {iss.severity.toUpperCase()}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-white text-xs font-bold" style={{ fontFamily: "var(--font-space-mono)" }}>
                                  {iss.title}
                                </div>
                                <div className="text-[#888] text-[11px] leading-snug mt-0.5" style={{ fontFamily: "var(--font-inter)" }}>
                                  {iss.detail}
                                </div>
                              </div>
                              <span className="text-[#333] text-xs">↗</span>
                            </div>
                          );
                        })}
                      </div>
                    </Block>
                  </div>

                  {/* Predicted metrics — spans 3 */}
                  <div className="md:col-span-3">
                    <Block title="PREDICTED METRICS" delay={480} accent="#00ff41">
                      <div className="grid grid-cols-2 gap-3">
                        {DEMO.predictedMetrics.map((m) => (
                          <div key={m.label} className="border border-[#141414] rounded-lg p-2.5 bg-[#060606]">
                            <div className="text-[8px] text-[#555] tracking-widest mb-1" style={{ fontFamily: "var(--font-space-mono)" }}>{m.label}</div>
                            <div className="flex items-baseline gap-1">
                              <span
                                className="text-xl font-bold"
                                style={{
                                  fontFamily: "var(--font-space-mono)",
                                  color: m.tone === "good" ? "#00ff41" : "#ff3b5c",
                                }}>
                                {m.value}
                              </span>
                              <span className="text-[10px]" style={{ color: m.tone === "good" ? "#00ff41" : "#ff3b5c", fontFamily: "var(--font-space-mono)" }}>{m.unit}</span>
                            </div>
                            <div className="text-[8px] text-[#555] mt-0.5" style={{ fontFamily: "var(--font-space-mono)" }}>{m.benchmark}</div>
                          </div>
                        ))}
                      </div>
                    </Block>
                  </div>

                  {/* Pacing — spans 3 */}
                  <div className="md:col-span-3">
                    <Block title="PACING · AUDIO DENSITY" delay={540} accent="#ffaa00">
                      <div className="flex items-baseline gap-4 mb-2">
                        <div>
                          <div className="text-white text-2xl font-bold" style={{ fontFamily: "var(--font-space-mono)" }}>
                            <Counter value={DEMO.pacing.cutsPerMin} enabled={ready} />
                          </div>
                          <div className="text-[8px] text-[#555] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>CUTS/MIN</div>
                        </div>
                        <div>
                          <div className="text-white text-2xl font-bold" style={{ fontFamily: "var(--font-space-mono)" }}>
                            <Counter value={DEMO.pacing.wordsPerMin} enabled={ready} />
                          </div>
                          <div className="text-[8px] text-[#555] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>WORDS/MIN</div>
                        </div>
                        <div className="ml-auto">
                          <span className="text-[9px] px-2 py-0.5 rounded border border-[#00ff41]/30 text-[#00ff41] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>
                            OPTIMAL
                          </span>
                        </div>
                      </div>
                      <MiniBars ready={ready} />
                      <div className="text-[9px] text-[#555] mt-2 tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>
                        FLAG @ 0:08 · 2.4s of dead air
                      </div>
                    </Block>
                  </div>

                  {/* Similar hits — spans 3 */}
                  <div className="md:col-span-3">
                    <Block title="SIMILAR TOP VIDEOS" delay={600} accent="#00ff41">
                      <div className="space-y-2">
                        {DEMO.similarHits.map((s, i) => (
                          <div key={i} className="flex items-center gap-2 border border-[#141414] rounded-lg p-2 bg-[#060606]">
                            <div className="w-8 h-10 bg-[#111] rounded flex-shrink-0 overflow-hidden relative">
                              <div className="absolute inset-0" style={{
                                background: `linear-gradient(135deg, hsl(${i * 80}, 60%, 20%), hsl(${i * 80 + 40}, 70%, 30%))`
                              }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-white text-[11px] font-bold truncate" style={{ fontFamily: "var(--font-space-mono)" }}>{s.handle}</div>
                              <div className="text-[#00ff41] text-[10px]" style={{ fontFamily: "var(--font-space-mono)" }}>{fmt(s.views)} views</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-[#00ff41] text-sm font-bold" style={{ fontFamily: "var(--font-space-mono)" }}>{s.match}%</div>
                              <div className="text-[8px] text-[#555] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>MATCH</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Block>
                  </div>

                  {/* Best post time — spans 3 */}
                  <div className="md:col-span-3">
                    <Block title="BEST POST WINDOW" delay={660} accent="#00ff41">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="text-[#00ff41] text-3xl font-bold mb-1" style={{ fontFamily: "var(--font-space-mono)", textShadow: "0 0 12px rgba(0,255,65,0.4)" }}>
                            {DEMO.bestPostTime}
                          </div>
                          <div className="text-[10px] text-[#888]" style={{ fontFamily: "var(--font-inter)" }}>
                            Your audience density peaks — +38% reach vs avg.
                          </div>
                        </div>
                        {/* Day-of-week heat strip */}
                        <div className="flex gap-1">
                          {["M","T","W","T","F","S","S"].map((d, i) => {
                            const intensity = [0.3, 0.5, 0.9, 0.4, 0.7, 0.6, 0.35][i];
                            const isBest = i === 1;
                            return (
                              <div key={i} className="flex flex-col items-center gap-1">
                                <div className="w-5 h-12 rounded" style={{
                                  background: isBest ? "#00ff41" : `rgba(0,255,65,${intensity * 0.4})`,
                                  boxShadow: isBest ? "0 0 8px #00ff41" : "none",
                                }} />
                                <span className="text-[8px] text-[#555]" style={{ fontFamily: "var(--font-space-mono)" }}>{d}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </Block>
                  </div>

                  {/* Caption critique — full width at the bottom */}
                  <div className="md:col-span-6">
                    <Block title="CAPTION WORD-LEVEL" delay={720} accent="#ffaa00">
                      <div className="flex flex-wrap gap-1 text-sm" style={{ fontFamily: "var(--font-inter)" }}>
                        {DEMO.captionTokens.map((tok, i) => (
                          <span key={i} className="relative"
                            style={{
                              color: tok.t === "strong" ? "#00ff41" : tok.t === "weak" ? "#ff3b5c" : "#ccc",
                              textDecoration: tok.t === "weak" ? "line-through" : "none",
                              textDecorationColor: "#ff3b5c88",
                              textShadow: tok.t === "strong" ? "0 0 8px rgba(0,255,65,0.3)" : "none",
                            }}>
                            {tok.w}
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-3 mt-3 pt-3 border-t border-[#141414]">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm bg-[#00ff41]" />
                          <span className="text-[9px] text-[#888] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>STRONG 3</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm bg-[#ff3b5c]" />
                          <span className="text-[9px] text-[#888] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>WEAK 3</span>
                        </div>
                      </div>
                    </Block>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bottom ticker — runs when ready, makes it feel live */}
      {ready && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#1a1a1a] bg-black/90 backdrop-blur-sm py-2 overflow-hidden">
          <div className="flex" style={{ animation: "ticker 40s linear infinite", width: "max-content" }}>
            {Array.from({ length: 2 }).flatMap((_, dup) => [
              "● AI COACH LIVE",
              "HOOK RETENTION -32% @ 0:03",
              "REWRITE +46% PREDICTED LIFT",
              "CTA ARRIVES 18s LATE",
              "BENCHMARKED vs 17,248 VIDEOS",
              "CONFIDENCE 91%",
              "SHARE RATE NEEDS +0.5%",
              "OPTIMAL POST · TUE 7:42 PM ET",
            ].map((t, i) => (
              <span key={`${dup}-${i}`} className="text-[10px] tracking-[0.3em] text-[#555] px-6 whitespace-nowrap" style={{ fontFamily: "var(--font-space-mono)" }}>
                {t}
              </span>
            )))}
          </div>
        </div>
      )}
    </div>
  );
}
