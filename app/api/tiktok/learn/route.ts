import { NextResponse } from "next/server";
import { getTrendingFeed, searchKeyword } from "@/lib/scrapecreators";
import { classifyVideoBatch, buildPatterns } from "@/lib/classify";
import type { ClassifiedVideo, UGCIntelligence } from "@/lib/classify";
import { promises as fs } from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "ugc_intelligence.json");

const OBSIDIAN_PATH =
  "/Users/saifali/Desktop/Playground/agentspace/obsidian/agents/HackUGC_Agent.md";

// ── Load/save intelligence store ──────────────────────────────────────────────

async function loadStore(): Promise<UGCIntelligence> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    return JSON.parse(raw) as UGCIntelligence;
  } catch {
    return {
      lastUpdated: new Date().toISOString(),
      totalClassified: 0,
      videos: [],
      patterns: {
        topFormats: [],
        topIndustries: [],
        formatIndustryMatrix: [],
        topHooks: [],
        keyInsights: [],
      },
    };
  }
}

async function saveStore(store: UGCIntelligence) {
  await fs.writeFile(DATA_PATH, JSON.stringify(store, null, 2));
}

// ── Obsidian sync ─────────────────────────────────────────────────────────────

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

async function syncObsidian(store: UGCIntelligence) {
  const { patterns } = store;
  const date = new Date(store.lastUpdated).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const formatRows = patterns.topFormats
    .map((f) => `| ${f.format} | ${f.count} | ${f.avgEngRate.toFixed(1)}% |`)
    .join("\n");

  const industryRows = patterns.topIndustries
    .map((i) => `| ${i.industry} | ${i.count} | ${formatNum(i.avgViews)} |`)
    .join("\n");

  const matrixRows = patterns.formatIndustryMatrix.slice(0, 10)
    .map((m) => `| ${m.format} | ${m.industry} | ${m.count} |`)
    .join("\n");

  const md = `# HackUGC Agent

**Role:** TikTok UGC Intelligence Feed
**Last Updated:** ${date}
**Total Videos Classified:** ${store.totalClassified}
**Status:** ACTIVE

---

## Top Formats (by volume)

| Format | Count | Avg Eng Rate |
|--------|-------|-------------|
${formatRows}

---

## Top Industries (by volume)

| Industry | Count | Avg Views |
|----------|-------|-----------|
${industryRows}

---

## Format × Industry Matrix (top combinations)

| Format | Industry | Count |
|--------|----------|-------|
${matrixRows}

---

## Hook Patterns

${patterns.topHooks.map((h, i) => `${i + 1}. ${h}`).join("\n")}

---

## Key Insights (high-engagement videos)

${patterns.keyInsights.map((ins) => `- ${ins}`).join("\n")}

---

## Recent Classifications (last 20)

${store.videos.slice(-20).reverse().map((v) =>
  `**${v.handle}** · ${v.format} · ${v.industry} · ${formatNum(v.views)} views · ${v.engRate}% eng\n> ${v.hook}`
).join("\n\n")}

---

## Links

- [[AgentSpace]] — Hub
- [[CMO]] — Primary consumer of this data
- [[BookBuds]] — App to apply learnings
- [[LingoBear]] — App to apply learnings
`;

  await fs.writeFile(OBSIDIAN_PATH, md, "utf-8");
}

// ── Main route handler ────────────────────────────────────────────────────────

export async function GET() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  try {
    // Fetch from multiple sources for diversity
    const [trending, search1, search2] = await Promise.allSettled([
      getTrendingFeed("US"),
      searchKeyword("app marketing tiktok"),
      searchKeyword("mobile app launch"),
    ]);

    const allVideos = [
      ...(trending.status === "fulfilled" ? trending.value : []),
      ...(search1.status === "fulfilled" ? search1.value : []),
      ...(search2.status === "fulfilled" ? search2.value : []),
    ];

    // Deduplicate by id
    const seen = new Set<string>();
    const unique = allVideos.filter((v) => {
      if (!v.id || seen.has(v.id)) return false;
      seen.add(v.id);
      return v.views > 0;
    });

    if (unique.length === 0) {
      return NextResponse.json({ error: "no videos to classify" }, { status: 400 });
    }

    // Classify with Claude (up to 20 per batch)
    const classified: ClassifiedVideo[] = await classifyVideoBatch(unique);

    // Load existing store and merge
    const store = await loadStore();

    // Deduplicate against existing — don't reclassify videos we've seen
    const existingIds = new Set(store.videos.map((v) => v.id));
    const newVideos = classified.filter((v) => !existingIds.has(v.id));

    store.videos = [...store.videos, ...newVideos].slice(-500); // keep last 500
    store.totalClassified += newVideos.length;
    store.lastUpdated = new Date().toISOString();
    store.patterns = buildPatterns(store.videos);

    // Persist
    await saveStore(store);
    await syncObsidian(store);

    return NextResponse.json({
      success: true,
      newVideosClassified: newVideos.length,
      totalClassified: store.totalClassified,
      patterns: store.patterns,
    });
  } catch (err) {
    console.error("learn route error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
