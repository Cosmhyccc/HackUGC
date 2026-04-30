"use client";

import { useEffect, useRef, useState } from "react";
import { Block } from "./Block";

export type AiObserverMode = "watching" | "listening" | "thinking" | "idle";

function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefers(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefers(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return prefers;
}

// ── The eye ──────────────────────────────────────────────────────────────────
function AiEye({
  mode = "watching",
  color = "#00ff41",
}: {
  mode?: AiObserverMode;
  color?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(0);
  const [mouseFollow, setMouseFollow] = useState(false);
  const mouseTimerRef = useRef<number | null>(null);
  const reduced = usePrefersReducedMotion();

  // Saccade / mode-driven target loop
  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;
    const loop = () => {
      if (!mounted) return;
      if (!mouseFollow) {
        if (mode === "thinking") {
          const now = performance.now() / 1000;
          setTarget({ x: Math.cos(now * 0.8) * 0.8, y: Math.sin(now * 0.8) * 0.8 });
        } else if (mode === "listening") {
          const now = performance.now() / 1000;
          setTarget({
            x: Math.sin(now * 0.6) * 0.15 + (Math.random() - 0.5) * 0.05,
            y: Math.cos(now * 0.4) * 0.1 + (Math.random() - 0.5) * 0.05,
          });
        } else {
          const ang = Math.random() * Math.PI * 2;
          const mag = 0.25 + Math.random() * 0.65;
          setTarget({ x: Math.cos(ang) * mag, y: Math.sin(ang) * mag * 0.7 });
        }
      }
      const baseDelay = mode === "thinking" ? 16 : 800 + Math.random() * 1800;
      const nextDelay = reduced ? Math.max(baseDelay, 2400) : baseDelay;
      timer = window.setTimeout(loop, nextDelay);
    };
    loop();
    return () => {
      mounted = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [mode, mouseFollow, reduced]);

  // Blink loop
  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;
    const doBlink = () => {
      if (!mounted) return;
      const start = performance.now();
      const dur = 140;
      const step = (now: number) => {
        if (!mounted) return;
        const t = (now - start) / dur;
        if (t < 0.5) setBlink(t * 2);
        else if (t < 1) setBlink(1 - (t - 0.5) * 2);
        else {
          setBlink(0);
          schedule();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const schedule = () => {
      timer = window.setTimeout(doBlink, 2200 + Math.random() * 3800);
    };
    schedule();
    return () => {
      mounted = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  // Mouse follow — over the whole window so the eye tracks the cursor
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = hostRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cxp = r.left + r.width / 2;
      const cyp = r.top + r.height / 2;
      const dx = (e.clientX - cxp) / (r.width * 0.8);
      const dy = (e.clientY - cyp) / (r.height * 0.8);
      const mag = Math.min(1, Math.hypot(dx, dy));
      if (mag > 0) {
        setMouseFollow(true);
        setTarget({
          x: Math.max(-1, Math.min(1, dx)),
          y: Math.max(-1, Math.min(1, dy)),
        });
        if (mouseTimerRef.current) window.clearTimeout(mouseTimerRef.current);
        mouseTimerRef.current = window.setTimeout(() => setMouseFollow(false), 900);
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Smooth pos toward target
  useEffect(() => {
    let running = true;
    let raf = 0;
    const tick = () => {
      if (!running) return;
      setPos((p) => ({
        x: p.x + (target.x - p.x) * 0.12,
        y: p.y + (target.y - p.y) * 0.12,
      }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [target]);

  // Geometry
  const W = 220,
    H = 160;
  const cx = W / 2,
    cy = H / 2;
  const eyeRx = 92,
    eyeRy = 62;
  const irisR = 44;
  const pupilR = 18;
  const travelX = 30,
    travelY = 20;
  const px = cx + pos.x * travelX;
  const py = cy + pos.y * travelY;
  const lidScale = blink;

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label="AI observer eye, watching the video"
      className="relative w-full flex flex-col items-center"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{
          maxWidth: 320,
          display: "block",
          filter: `drop-shadow(0 0 14px ${color}44)`,
        }}
      >
        <defs>
          <radialGradient id="aieye-irisGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity="0.05" />
            <stop offset="55%" stopColor={color} stopOpacity="0.25" />
            <stop offset="90%" stopColor={color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </radialGradient>
          <radialGradient id="aieye-pupilGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" />
            <stop offset="80%" stopColor="#000" />
            <stop offset="100%" stopColor={color} stopOpacity="0.6" />
          </radialGradient>
          <radialGradient id="aieye-glowGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity="0.5" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
          <clipPath id="aieye-eyeClip">
            <ellipse cx={cx} cy={cy} rx={eyeRx} ry={eyeRy} />
          </clipPath>
          <pattern id="aieye-scan" width="3" height="3" patternUnits="userSpaceOnUse">
            <rect width="3" height="3" fill="transparent" />
            <rect width="3" height="1" fill={color} opacity="0.08" />
          </pattern>
        </defs>

        {/* outer glow */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={eyeRx + 14}
          ry={eyeRy + 14}
          fill="url(#aieye-glowGrad)"
          opacity="0.6"
        />

        {/* sclera */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={eyeRx}
          ry={eyeRy}
          fill="#050505"
          stroke="#1a1a1a"
          strokeWidth="1"
        />

        <g clipPath="url(#aieye-eyeClip)">
          {/* faint vertical grid */}
          <g opacity="0.08">
            {Array.from({ length: 9 }).map((_, i) => (
              <line
                key={i}
                x1={cx - eyeRx + ((i + 1) * (eyeRx * 2)) / 10}
                y1={cy - eyeRy}
                x2={cx - eyeRx + ((i + 1) * (eyeRx * 2)) / 10}
                y2={cy + eyeRy}
                stroke={color}
                strokeWidth="0.5"
              />
            ))}
          </g>

          {/* crosshair tracking lines */}
          <g opacity="0.35">
            <line
              x1={px}
              y1={cy - eyeRy}
              x2={px}
              y2={cy + eyeRy}
              stroke={color}
              strokeWidth="0.6"
              strokeDasharray="2 3"
            />
            <line
              x1={cx - eyeRx}
              y1={py}
              x2={cx + eyeRx}
              y2={py}
              stroke={color}
              strokeWidth="0.6"
              strokeDasharray="2 3"
            />
          </g>

          {/* iris */}
          <g>
            <circle cx={px} cy={py} r={irisR} fill="url(#aieye-irisGrad)" />
            <circle
              cx={px}
              cy={py}
              r={irisR}
              fill="none"
              stroke={color}
              strokeWidth="1.2"
              opacity="0.95"
            />
            <circle
              cx={px}
              cy={py}
              r={irisR - 6}
              fill="none"
              stroke={color}
              strokeWidth="0.6"
              opacity="0.4"
            />
            <circle
              cx={px}
              cy={py}
              r={irisR - 14}
              fill="none"
              stroke={color}
              strokeWidth="0.5"
              opacity="0.25"
              strokeDasharray="3 2"
            />

            {/* radial striations */}
            {Array.from({ length: 36 }).map((_, i) => {
              const a = (i / 36) * Math.PI * 2;
              const r1 = irisR - 3;
              const r2 = irisR - 10 - (i % 3) * 3;
              return (
                <line
                  key={i}
                  x1={px + Math.cos(a) * r1}
                  y1={py + Math.sin(a) * r1}
                  x2={px + Math.cos(a) * r2}
                  y2={py + Math.sin(a) * r2}
                  stroke={color}
                  strokeWidth="0.6"
                  opacity={0.35 + (i % 4) * 0.08}
                />
              );
            })}

            {/* rotating HUD arc A */}
            {!reduced && (
              <g
                style={{
                  transformOrigin: `${px}px ${py}px`,
                  animation: "aieye-spin 6s linear infinite",
                }}
              >
                <circle
                  cx={px}
                  cy={py}
                  r={irisR - 2}
                  fill="none"
                  stroke={color}
                  strokeWidth="1.4"
                  strokeDasharray={`${2 * Math.PI * (irisR - 2) * 0.18} ${
                    2 * Math.PI * (irisR - 2)
                  }`}
                />
              </g>
            )}

            {/* rotating HUD arc B (reverse) */}
            {!reduced && (
              <g
                style={{
                  transformOrigin: `${px}px ${py}px`,
                  animation: "aieye-spin-rev 9s linear infinite",
                }}
              >
                <circle
                  cx={px}
                  cy={py}
                  r={irisR - 9}
                  fill="none"
                  stroke={color}
                  strokeWidth="0.8"
                  strokeDasharray={`${2 * Math.PI * (irisR - 9) * 0.1} ${
                    2 * Math.PI * (irisR - 9) * 0.06
                  }`}
                  opacity="0.7"
                />
              </g>
            )}

            {/* pupil */}
            <circle cx={px} cy={py} r={pupilR} fill="url(#aieye-pupilGrad)" />
            <circle
              cx={px}
              cy={py}
              r={pupilR}
              fill="none"
              stroke={color}
              strokeWidth="0.8"
              opacity="0.8"
            />

            {/* highlights */}
            <circle cx={px - 5} cy={py - 6} r={3.2} fill="#fff" opacity="0.9" />
            <circle cx={px + 7} cy={py + 5} r={1.2} fill="#fff" opacity="0.5" />
          </g>

          {/* sweep scanline */}
          {!reduced && (
            <rect
              x={px - irisR}
              y={py - 1}
              width={irisR * 2}
              height="1"
              fill={color}
              opacity="0.9"
              style={{
                animation: "aieye-sweep 2.4s ease-in-out infinite",
                transformOrigin: `${px}px ${py}px`,
              }}
            />
          )}

          {/* scanline overlay */}
          <rect x={0} y={0} width={W} height={H} fill="url(#aieye-scan)" />
        </g>

        {/* eyelids */}
        <g>
          <rect
            x={cx - eyeRx - 2}
            y={cy - eyeRy - 2}
            width={(eyeRx + 2) * 2}
            height={(eyeRy + 2) * (0.5 + 0.5 * lidScale)}
            fill="#000"
            style={{
              transformOrigin: `${cx}px ${cy - eyeRy}px`,
              transform: `scaleY(${0.5 + 0.5 * lidScale})`,
            }}
          />
          <rect
            x={cx - eyeRx - 2}
            y={cy + eyeRy - (eyeRy + 2) * (0.5 + 0.5 * lidScale)}
            width={(eyeRx + 2) * 2}
            height={(eyeRy + 2) * (0.5 + 0.5 * lidScale)}
            fill="#000"
            style={{ transformOrigin: `${cx}px ${cy + eyeRy}px` }}
          />
          <ellipse
            cx={cx}
            cy={cy}
            rx={eyeRx}
            ry={eyeRy}
            fill="none"
            stroke="#222"
            strokeWidth="1"
          />
          {lidScale > 0.02 && (
            <ellipse
              cx={cx}
              cy={cy}
              rx={eyeRx - 1}
              ry={eyeRy * (1 - lidScale)}
              fill="none"
              stroke={color}
              strokeWidth="0.6"
              opacity="0.4"
            />
          )}
        </g>
      </svg>
    </div>
  );
}

// ── The card ─────────────────────────────────────────────────────────────────
export function AiObserver({
  mode = "watching",
  delay = 0,
}: {
  mode?: AiObserverMode;
  delay?: number;
}) {
  const [hoverTalk, setHoverTalk] = useState(false);
  const labels: Record<AiObserverMode, string> = {
    watching: "WATCHING",
    listening: "LISTENING",
    thinking: "ANALYZING",
    idle: "IDLE",
  };
  const statusText = labels[mode];

  // Audio-level bars
  const [bars, setBars] = useState<number[]>(() =>
    Array.from({ length: 14 }, () => 0.3)
  );
  useEffect(() => {
    const id = window.setInterval(() => {
      const base =
        mode === "listening" ? 0.6 : mode === "thinking" ? 0.5 : 0.3;
      const jitter = mode === "thinking" ? 0.6 : 0.4;
      setBars(() =>
        Array.from({ length: 14 }, () => base + Math.random() * jitter)
      );
    }, 120);
    return () => window.clearInterval(id);
  }, [mode]);

  return (
    <Block title="AI OBSERVER" delay={delay} accent="#00ff41" rightLabel="LIVE">
      <div className="flex flex-col" style={{ height: 348 }}>
        {/* status row */}
        <div className="flex justify-between items-center mb-1.5">
          <div className="flex items-center gap-1.5">
            <span
              className="rounded-[3px]"
              style={{
                width: 6,
                height: 6,
                background: "#00ff41",
                boxShadow: "0 0 8px #00ff41",
                animation: "aiobs-pulse 1.4s ease-in-out infinite",
              }}
            />
            <span
              className="text-[9px] text-[#00ff41]"
              style={{
                fontFamily: "var(--font-space-mono)",
                letterSpacing: "0.22em",
              }}
            >
              {statusText}
            </span>
          </div>
          <span
            className="text-[8px] text-[#444]"
            style={{
              fontFamily: "var(--font-space-mono)",
              letterSpacing: "0.22em",
            }}
          >
            v0.3 · MUSE
          </span>
        </div>

        {/* the eye */}
        <div className="relative flex-1 flex items-center justify-center py-1">
          <AiEye mode={mode} />
        </div>

        {/* audio-level bars */}
        <div
          className="flex items-end justify-center mb-2"
          style={{ gap: 3, height: 22 }}
        >
          {bars.map((v, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: `${Math.max(2, v * 100)}%`,
                background: "#00ff41",
                opacity: 0.45 + v * 0.5,
                boxShadow: "0 0 4px #00ff4188",
                transition: "height 110ms ease",
                borderRadius: 1,
              }}
            />
          ))}
        </div>

        {/* "Talk to the observer" — disabled */}
        <button
          onMouseEnter={() => setHoverTalk(true)}
          onMouseLeave={() => setHoverTalk(false)}
          disabled
          aria-disabled="true"
          title="Coming soon — talk to the AI about your video"
          className="flex items-center justify-between"
          style={{
            background: "transparent",
            border: `1px solid ${hoverTalk ? "#00ff4133" : "#1a1a1a"}`,
            borderRadius: 8,
            padding: "8px 10px",
            color: hoverTalk ? "#00ff41" : "#555",
            fontFamily: "var(--font-space-mono)",
            fontSize: 9,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            cursor: "not-allowed",
            transition: "color 200ms, border-color 200ms",
          }}
        >
          <span>▸ Talk to the observer</span>
          <span style={{ color: "#333", fontSize: 8 }}>SOON</span>
        </button>
      </div>
    </Block>
  );
}
