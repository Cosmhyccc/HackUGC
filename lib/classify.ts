import Anthropic from "@anthropic-ai/sdk";
import type { TrendingVideo } from "./scrapecreators";

// ── Types ─────────────────────────────────────────────────────────────────────

export type VideoFormat =
  | "Talking Head"
  | "Silent UGC"
  | "App Demo"
  | "Animation"
  | "Text-Heavy"
  | "Slideshow"
  | "Hook+Demo"
  | "Reaction+Demo"
  | "Other";

export type VideoIndustry =
  | "Games"
  | "Finance"
  | "Health"
  | "Education"
  | "Entertainment"
  | "Lifestyle"
  | "B2B"
  | "Unknown";

export interface ClassifiedVideo {
  id: string;
  url: string;
  handle: string;
  caption: string;
  views: number;
  likes: number;
  engRate: string;
  classifiedAt: string;
  format: VideoFormat;
  industry: VideoIndustry;
  hook: string;         // The likely opening hook strategy
  insight: string;      // Why this video is high-performing
}

export interface UGCIntelligence {
  lastUpdated: string;
  totalClassified: number;
  videos: ClassifiedVideo[];
  patterns: {
    topFormats: { format: VideoFormat; count: number; avgEngRate: number }[];
    topIndustries: { industry: VideoIndustry; count: number; avgViews: number }[];
    formatIndustryMatrix: { format: VideoFormat; industry: VideoIndustry; count: number }[];
    topHooks: string[];
    keyInsights: string[];
  };
}

// ── Classifier ────────────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

export async function classifyVideoBatch(videos: TrendingVideo[]): Promise<ClassifiedVideo[]> {
  const input = videos.slice(0, 10).map((v) => ({
    id: v.id,
    caption: v.caption.slice(0, 400),
    handle: v.handle,
    musicTitle: v.musicTitle,
    musicAuthor: v.musicAuthor,
    duration: v.duration,
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    shares: v.shares,
    engRate: v.views > 0
      ? (((v.likes + v.comments + v.shares) / v.views) * 100).toFixed(2)
      : "0",
  }));

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a TikTok UGC intelligence analyst for app founders who run paid user acquisition.

Classify each video by FORMAT and INDUSTRY using the caption, metadata, and engagement signals.

FORMATS — pick exactly one:
- Talking Head: person speaking directly to camera
- Silent UGC: hands-on product usage, no voiceover, often aesthetic/satisfying
- App Demo: screen recording or in-app walkthrough
- Animation: animated content, not live footage
- Text-Heavy: mostly text overlays, minimal moving footage
- Slideshow: series of images/screenshots set to music
- Hook+Demo: punchy opening statement then app walkthrough
- Reaction+Demo: creator reacting while the app is shown (reaction cam + screen)
- Other: genuinely doesn't fit

INDUSTRIES — pick exactly one (what product/app is this promoting or in):
- Games: mobile games, gaming content
- Finance: fintech, investing, savings apps
- Health: fitness, mental health, wellness apps
- Education: learning apps, productivity, courses
- Entertainment: streaming, music, media apps
- Lifestyle: dating, food, social, travel apps
- B2B: tools, SaaS, business software
- Unknown: can't determine

For each video, identify:
- hook: the likely opening line or hook strategy in 1 short sentence
- insight: what specific signal makes this high-performing (eng rate, share pattern, etc.) in 1 sentence

Input videos:
${JSON.stringify(input, null, 2)}

Return ONLY a valid JSON array, no explanation:
[
  {
    "id": "video_id",
    "format": "FORMAT_VALUE",
    "industry": "INDUSTRY_VALUE",
    "hook": "hook description",
    "insight": "performance insight"
  }
]`,
      },
    ],
  });

  const text = msg.content.find((b) => b.type === "text")?.text ?? "[]";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];

  const raw = JSON.parse(match[0]) as {
    id: string;
    format: VideoFormat;
    industry: VideoIndustry;
    hook: string;
    insight: string;
  }[];

  const now = new Date().toISOString();
  return raw.map((r) => {
    const v = videos.find((x) => x.id === r.id);
    if (!v) return null;
    return {
      id: v.id,
      url: v.url,
      handle: v.handle,
      caption: v.caption,
      views: v.views,
      likes: v.likes,
      engRate: v.views > 0
        ? (((v.likes + v.comments + v.shares) / v.views) * 100).toFixed(2)
        : "0",
      classifiedAt: now,
      format: r.format,
      industry: r.industry,
      hook: r.hook,
      insight: r.insight,
    } satisfies ClassifiedVideo;
  }).filter(Boolean) as ClassifiedVideo[];
}

// ── Pattern analysis ──────────────────────────────────────────────────────────

export function buildPatterns(videos: ClassifiedVideo[]): UGCIntelligence["patterns"] {
  // Format stats
  const formatMap = new Map<VideoFormat, { count: number; totalEng: number }>();
  for (const v of videos) {
    const cur = formatMap.get(v.format) ?? { count: 0, totalEng: 0 };
    formatMap.set(v.format, { count: cur.count + 1, totalEng: cur.totalEng + parseFloat(v.engRate) });
  }
  const topFormats = [...formatMap.entries()]
    .map(([format, { count, totalEng }]) => ({ format, count, avgEngRate: totalEng / count }))
    .sort((a, b) => b.count - a.count);

  // Industry stats
  const industryMap = new Map<VideoIndustry, { count: number; totalViews: number }>();
  for (const v of videos) {
    const cur = industryMap.get(v.industry) ?? { count: 0, totalViews: 0 };
    industryMap.set(v.industry, { count: cur.count + 1, totalViews: cur.totalViews + v.views });
  }
  const topIndustries = [...industryMap.entries()]
    .map(([industry, { count, totalViews }]) => ({ industry, count, avgViews: Math.round(totalViews / count) }))
    .sort((a, b) => b.count - a.count);

  // Format × Industry matrix
  const matrixMap = new Map<string, number>();
  for (const v of videos) {
    const key = `${v.format}||${v.industry}`;
    matrixMap.set(key, (matrixMap.get(key) ?? 0) + 1);
  }
  const formatIndustryMatrix = [...matrixMap.entries()]
    .map(([key, count]) => {
      const [format, industry] = key.split("||");
      return { format: format as VideoFormat, industry: industry as VideoIndustry, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return {
    topFormats,
    topIndustries,
    formatIndustryMatrix,
    topHooks: videos.map((v) => v.hook).slice(0, 10),
    keyInsights: videos
      .filter((v) => parseFloat(v.engRate) > 2)
      .sort((a, b) => parseFloat(b.engRate) - parseFloat(a.engRate))
      .slice(0, 8)
      .map((v) => `[${v.format} / ${v.industry}] ${v.insight}`),
  };
}
