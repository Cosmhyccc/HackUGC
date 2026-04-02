import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const CACHE_PATH = path.join(process.cwd(), "data", "analysis_cache.json");

function readCache(): Record<string, string> {
  try {
    return existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf-8")) : {};
  } catch { return {}; }
}

function writeCache(cache: Record<string, string>) {
  try { writeFileSync(CACHE_PATH, JSON.stringify(cache)); } catch {}
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mediaType: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 4s max
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Referer: "https://www.tiktok.com/",
        Origin: "https://www.tiktok.com",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "image/webp,image/avif,image/*,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const data = Buffer.from(buffer).toString("base64");
    const mediaType = res.headers.get("content-type")?.split(";")[0] ?? "image/webp";
    return { data, mediaType };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const video = await req.json();

  // Return cached analysis if we've seen this video before
  if (video.id) {
    const cache = readCache();
    if (cache[video.id]) return NextResponse.json({ analysis: cache[video.id] });
  }

  const engRate = video.views > 0
    ? (((video.likes + video.comments + video.shares) / video.views) * 100).toFixed(1)
    : "0";
  const saveRate = video.views > 0
    ? ((video.bookmarks / video.views) * 100).toFixed(2)
    : "0";

  // Try to get a frame from the video to send to Claude Vision
  const thumbUrl = video.thumbUrl ?? video.thumbnailUrl ?? null;
  const image = thumbUrl ? await fetchImageAsBase64(thumbUrl) : null;

  const metadataText = `Video metadata:
- Handle: ${video.handle}
- Caption: "${video.caption?.slice(0, 300) || "none"}"
- Views: ${video.views?.toLocaleString()}
- Engagement rate: ${engRate}%
- Save rate: ${saveRate}%
- Duration: ${video.duration}s
- Sound: ${video.musicTitle || "original audio"}`;

  const prompt = `You are a sharp TikTok UGC analyst helping mobile app founders understand what makes videos go viral.
${image ? "You can see a frame from this video." : "You only have metadata for this video."}

${metadataText}

Write 4-5 sentences of punchy, specific commentary. Cover: what the hook likely was (reference what you see in the frame if available), why the format worked, what emotion or tension drove the high engagement, and one actionable takeaway for a mobile app founder wanting to replicate this. Be direct and specific — no generic advice.`;

  const content = image
    ? [
        {
          type: "image",
          source: { type: "base64", media_type: image.mediaType, data: image.data },
        },
        { type: "text", text: prompt },
      ]
    : [{ type: "text", text: prompt }];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content }],
    }),
  });

  const data = await res.json();
  const analysis = data.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";

  // Persist to cache
  if (video.id && analysis) {
    const cache = readCache();
    cache[video.id] = analysis;
    writeCache(cache);
  }

  return NextResponse.json({ analysis });
}
