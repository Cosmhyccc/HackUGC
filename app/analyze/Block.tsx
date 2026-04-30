"use client";

import type { ReactNode } from "react";

export function Block({
  title,
  children,
  className = "",
  delay = 0,
  accent,
  rightLabel = "AI",
}: {
  title: string;
  children: ReactNode;
  className?: string;
  delay?: number;
  accent?: string;
  rightLabel?: string;
}) {
  return (
    <div
      className={`relative bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 overflow-hidden opacity-0 ${className}`}
      style={{
        animation: `blockIn 500ms ${delay}ms forwards cubic-bezier(0.2, 0.8, 0.2, 1)`,
      }}
    >
      {accent && (
        <div
          className="absolute top-0 left-0 right-0 h-[1px]"
          style={{ background: accent, opacity: 0.6 }}
        />
      )}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[9px] tracking-[0.2em] uppercase text-[#555]"
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          {title}
        </span>
        <span
          className="text-[8px] tracking-widest text-[#333]"
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          {rightLabel}
        </span>
      </div>
      {children}
    </div>
  );
}
