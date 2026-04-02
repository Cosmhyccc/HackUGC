"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { TrendingVideo } from "@/lib/scrapecreators";

// ── Intelligence types ────────────────────────────────────────────────────────

interface ClassifiedVideo {
  id: string;
  url: string;
  handle: string;
  caption: string;
  views: number;
  engRate: string;
  classifiedAt: string;
  format: string;
  industry: string;
  hook: string;
  insight: string;
}

interface Intelligence {
  lastUpdated: string;
  totalClassified: number;
  learnings: string[];
  videos: ClassifiedVideo[];
  patterns: {
    topFormats: { format: string; count: number; avgEngRate: number }[];
    topIndustries: { industry: string; count: number; avgViews: number }[];
    formatIndustryMatrix: { format: string; industry: string; count: number }[];
  };
}

// ── Research Tab ──────────────────────────────────────────────────────────────

const FORMAT_KEYWORDS = [
  "Talking Head", "Silent UGC", "App Demo", "Animation",
  "Text-Heavy", "Slideshow", "Hook+Demo", "Reaction+Demo",
];

const INDUSTRY_KEYWORDS = [
  "Games", "Finance", "Health", "Education",
  "Entertainment", "Lifestyle", "B2B",
];

function extractFormat(text: string): string | null {
  return FORMAT_KEYWORDS.find(f => text.toLowerCase().includes(f.toLowerCase())) ?? null;
}
function extractIndustry(text: string): string | null {
  return INDUSTRY_KEYWORDS.find(i => text.toLowerCase().includes(i.toLowerCase())) ?? null;
}

function fmtNumR(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

function LearningCard({ learning, videos, index }: {
  learning: string;
  videos: ClassifiedVideo[];
  index: number;
}) {
  const [open, setOpen] = useState(false);

  const format = extractFormat(learning);
  const industry = extractIndustry(learning);

  const examples = videos
    .filter(v => {
      const fmatch = !format || v.format === format;
      const imatch = !industry || v.industry === industry;
      return fmatch || imatch;
    })
    .sort((a, b) => parseFloat(b.engRate) - parseFloat(a.engRate))
    .slice(0, 3);

  // Bold the **text** markdown
  const parts = learning.split(/(\*\*[^*]+\*\*)/g);
  const rendered = parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <span key={i} className="text-[#00ff41]">{p.slice(2, -2)}</span>
      : <span key={i}>{p}</span>
  );

  return (
    <div className="border border-[#1a1a1a] rounded-lg overflow-hidden">
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-[#0d0d0d] transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-[#333] text-[10px] mt-0.5 flex-shrink-0 w-4 text-right" style={{ fontFamily: "var(--font-space-mono)" }}>
          {index + 1}
        </span>
        <p className="text-white text-xs leading-relaxed flex-1" style={{ fontFamily: "var(--font-space-mono)" }}>
          {rendered}
        </p>
        {examples.length > 0 && (
          <span className="text-[#333] text-[10px] flex-shrink-0 ml-2 mt-0.5" style={{ fontFamily: "var(--font-space-mono)" }}>
            {open ? "▲" : "▼"}
          </span>
        )}
      </div>

      {open && examples.length > 0 && (
        <div className="border-t border-[#1a1a1a] bg-[#060606] px-4 py-3 space-y-2">
          {examples.map(v => (
            <a
              key={v.id}
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 py-1.5 px-2 rounded hover:bg-[#0d0d0d] transition-colors group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[#00ff41] text-[9px] border border-[#1a3a1a] px-1.5 py-0.5 rounded flex-shrink-0" style={{ fontFamily: "var(--font-space-mono)" }}>
                  {v.format}
                </span>
                <span className="text-[#555] text-[10px] truncate" style={{ fontFamily: "var(--font-space-mono)" }}>
                  {v.handle}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-white text-[10px]" style={{ fontFamily: "var(--font-space-mono)" }}>
                  {fmtNumR(v.views)} views
                </span>
                <span className="text-[#00ff41] text-[10px] font-bold" style={{ fontFamily: "var(--font-space-mono)" }}>
                  {v.engRate}%
                </span>
                <span className="text-[#333] group-hover:text-white text-[10px]">↗</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function BarChart({ title, rows, valueKey, labelKey, unit = "" }: {
  title: string;
  rows: Record<string, number | string>[];
  valueKey: string;
  labelKey: string;
  unit?: string;
}) {
  const max = Math.max(...rows.map(r => Number(r[valueKey])));
  return (
    <div>
      <p className="text-[#555] text-[9px] tracking-widest uppercase mb-3" style={{ fontFamily: "var(--font-space-mono)" }}>{title}</p>
      <div className="space-y-2">
        {rows.map((row, i) => {
          const val = Number(row[valueKey]);
          const pct = max > 0 ? (val / max) * 100 : 0;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-white text-[9px] w-24 truncate flex-shrink-0" style={{ fontFamily: "var(--font-space-mono)" }}>
                {String(row[labelKey])}
              </span>
              <div className="flex-1 h-4 bg-[#0d0d0d] rounded overflow-hidden border border-[#111]">
                <div
                  className="h-full rounded transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, #00ff41 0%, #00cc33 100%)`,
                    opacity: 0.7 + (i === 0 ? 0.3 : 0),
                  }}
                />
              </div>
              <span className="text-[#00ff41] text-[9px] w-12 text-right flex-shrink-0 font-bold" style={{ fontFamily: "var(--font-space-mono)" }}>
                {typeof val === "number" && val >= 1000 ? fmtNumR(val) : val}{unit}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResearchTab() {
  const [intel, setIntel] = useState<Intelligence | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/intelligence")
      .then(r => r.json())
      .then(d => setIntel(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-[#333] text-xs tracking-widest animate-pulse" style={{ fontFamily: "var(--font-space-mono)" }}>
          LOADING INTELLIGENCE...
        </span>
      </div>
    );
  }

  if (!intel || !intel.totalClassified) {
    return (
      <div className="flex items-center justify-center h-64 flex-col gap-3">
        <p className="text-[#333] text-xs tracking-widest uppercase" style={{ fontFamily: "var(--font-space-mono)" }}>No data yet</p>
        <p className="text-[#222] text-[10px]" style={{ fontFamily: "var(--font-space-mono)" }}>
          Run <span className="text-[#444]">node scripts/learn.mjs</span> to seed intelligence
        </p>
      </div>
    );
  }

  const updatedAgo = (() => {
    if (!intel.lastUpdated) return "";
    const diff = Date.now() - new Date(intel.lastUpdated).getTime();
    const h = Math.floor(diff / 3_600_000);
    if (h < 1) return "updated just now";
    if (h < 24) return `updated ${h}h ago`;
    return `updated ${Math.floor(h / 24)}d ago`;
  })();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-pulse" />
        <span className="text-white text-xs tracking-widest uppercase" style={{ fontFamily: "var(--font-space-mono)" }}>
          {intel.totalClassified} videos classified · {updatedAgo}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: Learnings */}
        <div className="lg:col-span-3 space-y-3">
          <p className="text-white text-[9px] tracking-widest uppercase mb-4" style={{ fontFamily: "var(--font-space-mono)" }}>
            What the data says — click any insight to see source videos
          </p>
          {intel.learnings.map((l, i) => (
            <LearningCard key={i} learning={l} videos={intel.videos} index={i} />
          ))}
        </div>

        {/* Right: Charts */}
        <div className="lg:col-span-2 space-y-8">
          {intel.patterns.topFormats?.length > 0 && (
            <BarChart
              title="Format · Avg Engagement Rate"
              rows={intel.patterns.topFormats}
              labelKey="format"
              valueKey="avgEngRate"
              unit="%"
            />
          )}
          {intel.patterns.topIndustries?.length > 0 && (
            <BarChart
              title="Industry · Video Count"
              rows={intel.patterns.topIndustries}
              labelKey="industry"
              valueKey="count"
            />
          )}
          {intel.patterns.topIndustries?.length > 0 && (
            <BarChart
              title="Industry · Avg Views"
              rows={intel.patterns.topIndustries}
              labelKey="industry"
              valueKey="avgViews"
            />
          )}
        </div>
      </div>
    </div>
  );
}

const TABS = ["Explore", "Research"] as const;
type Tab = typeof TABS[number];

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

// Only load iframe when card enters viewport
function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { rootMargin: "200px" }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref]);
  return inView;
}

// ── Video Modal ───────────────────────────────────────────────────────────────

function VideoModal({
  video,
  onClose,
  onPrev,
  onNext,
}: {
  video: TrendingVideo;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const engRate = video.views > 0
    ? (((video.likes + video.comments + video.shares) / video.views) * 100).toFixed(1)
    : null;
  const saveRate = video.views > 0
    ? ((video.bookmarks / video.views) * 100).toFixed(2)
    : null;
  const shareRate = video.views > 0
    ? ((video.shares / video.views) * 100).toFixed(2)
    : null;

  // Start as iframe immediately — fetch MP4 and analysis in parallel
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  useEffect(() => {
    setPlayUrl(null);
    setAnalysis(null);
    fetch(`/api/tiktok/video?url=${encodeURIComponent(video.url)}`)
      .then((r) => r.json())
      .then((d) => { if (d.playUrl) setPlayUrl(d.playUrl); })
      .catch(() => {});
    // Analyze in parallel — passes thumbnailUrl so server can attempt vision
    fetch("/api/tiktok/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...video, thumbUrl: video.thumbnailUrl ?? null }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.analysis) setAnalysis(d.analysis); })
      .catch(() => {});
  }, [video.url]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, onPrev, onNext]);

  const stats = [
    { label: "VIEWS",    value: video.views    > 0 ? formatNum(video.views)    : "—", green: true },
    { label: "LIKES",    value: video.likes    > 0 ? formatNum(video.likes)    : "—" },
    { label: "COMMENTS", value: video.comments > 0 ? formatNum(video.comments) : "—" },
    { label: "SHARES",   value: video.shares   > 0 ? formatNum(video.shares)   : "—" },
    { label: "SAVES",    value: video.bookmarks > 0 ? formatNum(video.bookmarks) : "—" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/92 backdrop-blur-sm flex items-center justify-center p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl flex bg-[#080808] border border-[#1a1a1a] rounded-xl overflow-hidden"
        style={{ height: "min(90vh, 780px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Left: Stats ── */}
        <div className="w-48 flex-shrink-0 border-r border-[#1a1a1a] p-4 overflow-y-auto flex flex-col gap-5">
          <div className="flex items-center gap-2 pt-1">
            <div className="w-9 h-9 rounded-full bg-[#111] flex-shrink-0 overflow-hidden">
              {video.avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={video.avatarUrl} alt="" className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-white text-[11px] font-bold truncate" style={{ fontFamily: "var(--font-space-mono)" }}>
                {video.handle || "—"}
              </p>
              {video.duration > 0 && (
                <p className="text-white text-[9px]" style={{ fontFamily: "var(--font-space-mono)" }}>{video.duration}s</p>
              )}
            </div>
          </div>

          <div className="space-y-2.5">
            {stats.map(({ label, value, green }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-white text-[9px] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>{label}</span>
                <span className="text-[11px] font-bold" style={{ fontFamily: "var(--font-space-mono)", color: green ? "#00ff41" : "#fff" }}>{value}</span>
              </div>
            ))}
          </div>

          {(engRate || saveRate || shareRate) && (
            <div className="border-t border-[#1a1a1a] pt-3 space-y-2.5">
              {engRate && (
                <div className="flex items-center justify-between">
                  <span className="text-white text-[9px] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>ENG RATE</span>
                  <span className="text-[11px] font-bold text-[#00ff41]" style={{ fontFamily: "var(--font-space-mono)" }}>{engRate}%</span>
                </div>
              )}
              {saveRate && (
                <div className="flex items-center justify-between">
                  <span className="text-white text-[9px] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>SAVE RATE</span>
                  <span className="text-[11px] font-bold text-white" style={{ fontFamily: "var(--font-space-mono)" }}>{saveRate}%</span>
                </div>
              )}
              {shareRate && (
                <div className="flex items-center justify-between">
                  <span className="text-white text-[9px] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>SHARE RATE</span>
                  <span className="text-[11px] font-bold text-white" style={{ fontFamily: "var(--font-space-mono)" }}>{shareRate}%</span>
                </div>
              )}
            </div>
          )}

          {video.musicTitle && (
            <div className="border-t border-[#1a1a1a] pt-3">
              <p className="text-white text-[9px] tracking-widest mb-1.5" style={{ fontFamily: "var(--font-space-mono)" }}>SOUND</p>
              <p className="text-white text-[10px] leading-snug" style={{ fontFamily: "var(--font-space-mono)" }}>{video.musicTitle}</p>
              {video.musicAuthor && (
                <p className="text-white text-[9px] mt-0.5" style={{ fontFamily: "var(--font-space-mono)" }}>{video.musicAuthor}</p>
              )}
            </div>
          )}
        </div>

        {/* ── Center: Native video player ── */}
        <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden">
          <div
            className="relative bg-black"
            style={{ width: "min(340px, 100%)", height: "100%" }}
          >
            {playUrl ? (
              /* Native HTML5 player — swaps in silently once URL is ready */
              <video
                key={playUrl}
                src={playUrl}
                controls
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-contain"
                style={{ background: "black" }}
              />
            ) : (
              /* TikTok embed shows immediately — no wait */
              <div className="absolute inset-0 overflow-hidden">
                <iframe
                  key={video.id}
                  src={`https://www.tiktok.com/embed/v2/${video.id}?autoplay=1`}
                  style={{ border: "none", position: "absolute", top: 0, left: 0, width: "100%", height: "calc(100% + 260px)" }}
                  allowFullScreen
                  allow="encrypted-media; autoplay"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black pointer-events-none z-10" style={{ height: "260px" }} />
              </div>
            )}
          </div>

          {/* Prev / Next */}
          <button onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/70 border border-[#222] rounded text-[#555] hover:text-white hover:border-[#00ff41] transition-all text-xl z-20">
            ‹
          </button>
          <button onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/70 border border-[#222] rounded text-[#555] hover:text-white hover:border-[#00ff41] transition-all text-xl z-20">
            ›
          </button>
        </div>

        {/* ── Right: Analysis ── */}
        <div className="w-72 flex-shrink-0 border-l border-[#1a1a1a] p-4 overflow-y-auto flex flex-col gap-4">
          <div>
            <p className="text-white text-[9px] tracking-widest mb-2" style={{ fontFamily: "var(--font-space-mono)" }}>CAPTION</p>
            <p className="text-white text-[13px] leading-relaxed" style={{ fontFamily: "var(--font-inter)" }}>
              {video.caption || "—"}
            </p>
          </div>

          {video.views > 0 && (
            <div className="border border-[#1a1a1a] rounded-lg p-3 bg-[#0d0d0d]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white text-[9px] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>VIRALITY SIGNAL</span>
                <span className="text-[#00ff41] text-xs font-bold" style={{ fontFamily: "var(--font-space-mono)" }}>{shareRate}%</span>
              </div>
              <p className="text-white text-[9px] leading-relaxed" style={{ fontFamily: "var(--font-space-mono)" }}>
                Share rate — strongest signal for organic reach
              </p>
            </div>
          )}

          <div className="border border-[#1a1a1a] rounded-lg p-3 bg-[#0a0a0a] flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white text-[9px] tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>AI ANALYSIS</span>
              {!analysis && (
                <span className="text-[#444] text-[8px] tracking-widest animate-pulse" style={{ fontFamily: "var(--font-space-mono)" }}>THINKING...</span>
              )}
            </div>
            {analysis ? (
              <p className="text-white text-[11px] leading-relaxed" style={{ fontFamily: "var(--font-inter)" }}>{analysis}</p>
            ) : (
              <div className="space-y-2">
                {[1, 0.7, 0.85, 0.6].map((w, i) => (
                  <div key={i} className="h-2.5 bg-[#111] rounded animate-pulse" style={{ width: `${w * 100}%` }} />
                ))}
              </div>
            )}
          </div>

          <a href={video.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-white hover:text-white hover:border-[#00ff41] transition-all text-[10px] tracking-widest uppercase mt-auto"
            style={{ fontFamily: "var(--font-space-mono)" }}>
            Open on TikTok ↗
          </a>
        </div>

        <button onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center bg-black/80 border border-[#1a1a1a] rounded text-[#555] hover:text-white hover:border-[#00ff41] transition-all z-10 text-base">
          ×
        </button>
      </div>
    </div>
  );
}

// ── Video Card ────────────────────────────────────────────────────────────────

function VideoCard({ video, onClick }: { video: TrendingVideo; onClick: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(cardRef);

  const engRate = video.views > 0
    ? (((video.likes + video.comments + video.shares) / video.views) * 100).toFixed(1)
    : null;

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className="group relative w-full cursor-pointer rounded-xl overflow-hidden border border-[#1a1a1a] hover:border-[#00ff41] transition-colors duration-200 bg-[#080808]"
      style={{ aspectRatio: "9/16" }}
    >
      {/* TikTok embed — loads once card enters viewport */}
      {inView ? (
        <div className="absolute inset-0 overflow-hidden">
          <iframe
            src={`https://www.tiktok.com/embed/v2/${video.id}`}
            style={{
              border: "none",
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "calc(100% + 100px)",
              pointerEvents: "none",
            }}
            allow="encrypted-media"
            tabIndex={-1}
          />
          {/* Clip TikTok's white footer */}
          <div className="absolute bottom-0 left-0 right-0 bg-[#080808] pointer-events-none z-10" style={{ height: "100px" }} />
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#080808]">
          <svg className="w-5 h-5 text-[#1a1a1a] ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </div>
      )}

      {/* Stats overlay — sits on top of black footer cover */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-3 pb-3 pt-6 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 50%, transparent 100%)" }}>
        <div className="flex items-end justify-between gap-2">
          {video.views > 0 && (
            <div>
              <span className="text-[#00ff41] text-3xl font-bold leading-none" style={{ fontFamily: "var(--font-space-mono)" }}>
                {formatNum(video.views)}
              </span>
              <span className="text-white text-xs ml-1" style={{ fontFamily: "var(--font-space-mono)" }}>views</span>
            </div>
          )}
          {engRate && (
            <span className="text-white text-sm font-bold" style={{ fontFamily: "var(--font-space-mono)" }}>{engRate}%</span>
          )}
        </div>
        {video.handle && (
          <div className="text-white text-xs mt-0.5 truncate" style={{ fontFamily: "var(--font-space-mono)" }}>{video.handle}</div>
        )}
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
        style={{ boxShadow: "inset 0 0 0 2px rgba(0,255,65,0.3)" }} />
    </div>
  );
}

// ── Video Grid ────────────────────────────────────────────────────────────────

function VideoGrid({ videos, loading, onCardClick }: {
  videos: TrendingVideo[];
  loading: boolean;
  onCardClick: (i: number) => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="aspect-[9/16] bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }
  if (!videos.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#333] text-xs tracking-widest" style={{ fontFamily: "var(--font-space-mono)" }}>No results found.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {videos.map((video, i) => (
        <VideoCard key={video.id || `v-${i}`} video={video} onClick={() => onCardClick(i)} />
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

function ExploreContent() {
  const [activeTab, setActiveTab] = useState<Tab>("Explore");
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState<TrendingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("Trending Now · US · Last 7 Days");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";

  useEffect(() => {
    async function load() {
      setLoading(true);
      setSelectedIndex(null);
      try {
        const endpoint = initialQ
          ? `/api/tiktok/search?q=${encodeURIComponent(initialQ)}`
          : `/api/tiktok/trending`;
        const res = await fetch(endpoint);
        const data = await res.json();
        setVideos(data.videos ?? []);
        setLabel(initialQ ? `Results for "${initialQ}"` : "Trending Now · US · Last 7 Days");
      } catch {
        setVideos([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [initialQ]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/explore?q=${encodeURIComponent(query.trim())}`);
  };

  const closeModal = useCallback(() => setSelectedIndex(null), []);
  const prevVideo = useCallback(() => setSelectedIndex((i) => (i !== null && i > 0 ? i - 1 : i)), []);
  const nextVideo = useCallback(() => setSelectedIndex((i) => (i !== null && i < videos.length - 1 ? i + 1 : i)), [videos.length]);

  return (
    <div className="relative min-h-screen bg-black flex flex-col">
      <div className="fixed inset-0 opacity-[0.025] pointer-events-none"
        style={{ backgroundImage: `linear-gradient(rgba(0,255,65,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,65,1) 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />

      <header className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a] bg-black/80 backdrop-blur-sm sticky top-0">
        <a href="/" className="text-[#00ff41] text-base font-bold tracking-widest uppercase" style={{ fontFamily: "var(--font-space-mono)" }}>
          HACK<span className="text-white">UGC</span>
        </a>
        <div className="flex items-center gap-1 border border-[#1a1a1a] rounded p-1">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-1.5 text-xs rounded tracking-widest uppercase transition-all duration-150 ${activeTab === tab ? "bg-[#00ff41] text-black font-bold" : "text-[#555] hover:text-white"}`}
              style={{ fontFamily: "var(--font-space-mono)" }}>
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-pulse" />
          <span className="text-[10px] text-[#444]" style={{ fontFamily: "var(--font-space-mono)" }}>LIVE</span>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-6 pt-6 pb-28">
        {activeTab === "Explore" ? (
          <>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-pulse" />
              <h2 className="text-xs text-white tracking-[0.3em] uppercase" style={{ fontFamily: "var(--font-space-mono)" }}>{label}</h2>
            </div>
            <VideoGrid videos={videos} loading={loading} onCardClick={setSelectedIndex} />
          </>
        ) : (
          <ResearchTab />
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-20 px-6 pb-6 pt-3 bg-gradient-to-t from-black via-black/95 to-transparent">
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 bg-[#0d0d0d] border-2 border-[#1a1a1a] rounded-lg px-4 py-3 focus-within:border-[#00ff41] transition-colors duration-200">
            <svg className="w-4 h-4 text-[#444] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" strokeWidth="1.5"/><path d="m21 21-4.35-4.35" strokeWidth="1.5"/>
            </svg>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anything — niche, hook, app name..."
              className="flex-1 bg-transparent text-white text-sm placeholder-[#333] outline-none"
              style={{ fontFamily: "var(--font-inter)" }} />
            <button type="submit"
              className="flex-shrink-0 bg-[#00ff41] text-black text-[10px] font-bold px-4 py-2 rounded tracking-widest uppercase hover:bg-[#00cc33] active:scale-95 transition-all"
              style={{ fontFamily: "var(--font-space-mono)" }}>
              Search
            </button>
          </div>
        </form>
      </div>

      {selectedIndex !== null && videos[selectedIndex] && (
        <VideoModal video={videos[selectedIndex]} onClose={closeModal} onPrev={prevVideo} onNext={nextVideo} />
      )}
    </div>
  );
}

export default function ExplorePage() {
  return <Suspense><ExploreContent /></Suspense>;
}
