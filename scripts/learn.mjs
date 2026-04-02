#!/usr/bin/env node
/**
 * HackUGC — Daily Learning Agent
 *
 * Runs once a day. Each run:
 *   1. Fetches fresh TikTok videos via ScrapeCreators
 *   2. Classifies new ones by FORMAT + INDUSTRY with Claude
 *   3. Synthesizes updated learnings from the full history
 *   4. Saves everything to data/ugc_intelligence.json
 *
 * The learnings compound — more data = sharper conclusions.
 * Run: node scripts/learn.mjs
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

// ── Config ────────────────────────────────────────────────────────────────────

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(ROOT, ".env.local");
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const [k, ...rest] = line.split("=");
  if (k?.trim() && rest.length) process.env[k.trim()] = rest.join("=").trim();
}

const SC_KEY = process.env.SCRAPECREATORS_API_KEY;
const AI_KEY = process.env.ANTHROPIC_API_KEY;
const DATA_PATH = path.join(ROOT, "data", "ugc_intelligence.json");
const LEARNINGS_DIR = path.join(ROOT, "data", "learnings");

// Intent-based queries — surfaces app marketing UGC specifically, not trending noise
const SEARCH_QUERIES = [
  "this app changed my life",
  "you need this app",
  "best app for",
  "iphone app that",
  "app review tiktok",
  "hidden iphone app",
  "app that does",
  "download this app",
  "app nobody talks about",
  "found this app",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

async function claude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": AI_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.find(b => b.type === "text")?.text ?? "";
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

function normalizeVideo(v) {
  return {
    id: v.aweme_id,
    caption: v.desc ?? "",
    views: v.statistics?.play_count ?? 0,
    likes: v.statistics?.digg_count ?? 0,
    comments: v.statistics?.comment_count ?? 0,
    shares: v.statistics?.share_count ?? 0,
    bookmarks: v.statistics?.collect_count ?? 0,
    handle: `@${v.author?.unique_id ?? ""}`,
    musicTitle: v.music?.title ?? "",
    duration: Math.round((v.video?.duration ?? 0) / 1000),
    url: v.url ?? `https://www.tiktok.com/@${v.author?.unique_id}/video/${v.aweme_id}`,
  };
}

async function fetchVideos() {
  async function scGet(path, params = {}) {
    const url = new URL("https://api.scrapecreators.com" + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const res = await fetch(url, { headers: { "x-api-key": SC_KEY } });
    if (!res.ok) throw new Error(`SC ${res.status}`);
    return res.json();
  }

  const sources = await Promise.allSettled([
    ...SEARCH_QUERIES.map(q =>
      scGet("/v1/tiktok/search/keyword", { query: q, sort_by: "most-liked", date_posted: "this-month" })
        .then(d => (d.search_item_list ?? []).map(i => i.aweme_info).filter(Boolean).map(normalizeVideo))
    ),
  ]);

  const all = sources.flatMap(r => r.status === "fulfilled" ? r.value : []);
  const seen = new Set();
  return all.filter(v => v.id && v.views >= 50000 && !seen.has(v.id) && seen.add(v.id));
}

// ── Classify ──────────────────────────────────────────────────────────────────

async function classifyBatch(batch) {
  const input = batch.map(v => ({
    id: v.id,
    caption: v.caption.slice(0, 300),
    handle: v.handle,
    music: v.musicTitle,
    duration: v.duration,
    views: v.views,
    engRate: v.views > 0
      ? (((v.likes + v.comments + v.shares) / v.views) * 100).toFixed(2)
      : "0",
  }));

  const text = await claude(`You are a TikTok UGC analyst specializing in app marketing content.

Your job is to classify videos that are promoting, reviewing, or demoing a mobile app — and filter out everything else.

For each video, first decide: is this app marketing UGC? A video qualifies if it's clearly promoting, reviewing, demoing, or recommending a specific app or digital tool. Reject anything that's just lifestyle, entertainment, travel, food, dancing, etc. with no app angle.

For qualifying videos, classify:

FORMATS (pick one): Talking Head | Silent UGC | App Demo | Animation | Text-Heavy | Slideshow | Hook+Demo | Reaction+Demo | Other
INDUSTRIES (pick one): Games | Finance | Health | Education | Entertainment | Lifestyle | B2B | Unknown

Also extract:
- hook: the opening hook strategy in 1 short sentence
- insight: what makes this video's format/angle effective for app marketing in 1 short sentence

Videos: ${JSON.stringify(input)}

Return ONLY a JSON array — no explanation. Set isAppUGC to false for non-app videos (still include them so we can filter):
[{"id":"...","isAppUGC":true,"format":"...","industry":"...","hook":"...","insight":"..."}]`);

  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];

  const now = new Date().toISOString();
  return JSON.parse(match[0]).filter(r => r.isAppUGC !== false).map(r => {
    const v = batch.find(x => x.id === r.id);
    if (!v) return null;
    return {
      id: v.id, url: v.url, handle: v.handle,
      caption: v.caption.slice(0, 200),
      views: v.views, likes: v.likes,
      engRate: v.views > 0
        ? (((v.likes + v.comments + v.shares) / v.views) * 100).toFixed(2) : "0",
      classifiedAt: now,
      format: r.format, industry: r.industry,
      hook: r.hook, insight: r.insight,
    };
  }).filter(Boolean);
}

async function classifyVideos(videos) {
  // Run 2 batches of 20 in sequence to avoid token limits
  const batch1 = await classifyBatch(videos.slice(0, 20));
  const batch2 = await classifyBatch(videos.slice(20, 40));
  return [...batch1, ...batch2];
}

// ── Synthesize learnings ──────────────────────────────────────────────────────

function getPreviousReportFiles(n = 3) {
  try {
    return readdirSync(LEARNINGS_DIR)
      .filter(f => f.endsWith(".md"))
      .sort()
      .slice(-n)
      .map(f => ({ name: f.replace(".md", ""), content: readFileSync(path.join(LEARNINGS_DIR, f), "utf-8") }));
  } catch { return []; }
}

async function synthesizeLearnings(videos, previousLearnings) {
  const summary = videos.slice(-100).map(v =>
    `${v.format} | ${v.industry} | ${v.views} views | ${v.engRate}% eng | hook: ${v.hook}`
  ).join("\n");

  const prev = previousLearnings?.length
    ? `Previous learnings to build on:\n${previousLearnings.join("\n")}`
    : "No previous learnings yet — derive from scratch.";

  const text = await claude(`You are a UGC intelligence agent for an iOS app studio.
Your job is to learn which TikTok content formats, hooks, and industries perform best —
specifically for promoting mobile apps.

${prev}

New classified video data (most recent 100):
${summary}

Based on ALL of this data, write 8-12 sharp, specific learnings.
Focus on: which formats drive the highest engagement, which industries dominate,
which hook styles work best, and what patterns would help an app founder create better UGC.

Format each learning as a single actionable sentence starting with a bolded keyword.
Example: "**Silent UGC** in Lifestyle drives 15%+ engagement — no voiceover, just aesthetic product footage."

Return ONLY a JSON array of learning strings:
["learning 1", "learning 2", ...]`);

  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return previousLearnings ?? [];
  return JSON.parse(match[0]);
}

// ── Patterns ──────────────────────────────────────────────────────────────────

function buildPatterns(videos) {
  const fmt = {}, ind = {}, matrix = {};
  for (const v of videos) {
    const eng = parseFloat(v.engRate);
    fmt[v.format] = fmt[v.format] ?? { count: 0, totalEng: 0 };
    fmt[v.format].count++; fmt[v.format].totalEng += eng;
    ind[v.industry] = ind[v.industry] ?? { count: 0, totalViews: 0 };
    ind[v.industry].count++; ind[v.industry].totalViews += v.views;
    const key = `${v.format}||${v.industry}`;
    matrix[key] = (matrix[key] ?? 0) + 1;
  }
  return {
    topFormats: Object.entries(fmt)
      .map(([f, { count, totalEng }]) => ({ format: f, count, avgEngRate: +(totalEng / count).toFixed(1) }))
      .sort((a, b) => b.avgEngRate - a.avgEngRate),
    topIndustries: Object.entries(ind)
      .map(([i, { count, totalViews }]) => ({ industry: i, count, avgViews: Math.round(totalViews / count) }))
      .sort((a, b) => b.count - a.count),
    formatIndustryMatrix: Object.entries(matrix)
      .map(([key, count]) => { const [format, industry] = key.split("||"); return { format, industry, count }; })
      .sort((a, b) => b.count - a.count).slice(0, 15),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🧠 HackUGC Agent — daily run\n");

  // Load store
  let store = { totalClassified: 0, videos: [], learnings: [], patterns: {} };
  if (existsSync(DATA_PATH)) {
    try { store = JSON.parse(readFileSync(DATA_PATH, "utf-8")); } catch {}
  }

  // Fetch
  process.stdout.write("  Fetching videos... ");
  const fetched = await fetchVideos();
  console.log(`${fetched.length} found`);

  // Skip already-classified
  const existingIds = new Set(store.videos.map(v => v.id));
  const fresh = fetched.filter(v => !existingIds.has(v.id));
  console.log(`  ${fresh.length} new to classify`);

  let newCount = 0;
  if (fresh.length > 0) {
    process.stdout.write("  Classifying with Claude... ");
    const classified = await classifyVideos(fresh);
    console.log(`${classified.length} done`);
    store.videos = [...store.videos, ...classified].slice(-500);
    store.totalClassified = (store.totalClassified ?? 0) + classified.length;
    newCount = classified.length;
  } else {
    console.log("  Nothing new to classify today");
  }

  // Read last 3 reports to give Claude historical context
  const previousReports = getPreviousReportFiles(3);

  // Synthesize learnings (always refresh — more data = sharper conclusions)
  process.stdout.write("  Synthesizing learnings... ");
  store.learnings = await synthesizeLearnings(store.videos, store.learnings);
  console.log("done");

  store.lastUpdated = new Date().toISOString();
  store.patterns = buildPatterns(store.videos);

  writeFileSync(DATA_PATH, JSON.stringify(store, null, 2));

  // Write dated report to data/learnings/
  const now = new Date(store.lastUpdated);
  const dateSlug = now.toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const reportFileName = `${dateSlug}.md`;
  const reportPath = path.join(LEARNINGS_DIR, reportFileName);

  const prevLinks = previousReports.length
    ? `## Previous Reports\n\n${previousReports.map(r => `- [[${r.name}]]`).join("\n")}\n`
    : "";

  const report = `# HackUGC Learnings — ${dateLabel}
*${store.totalClassified} videos classified*

${prevLinks}
## What We Know

${store.learnings.map((l, i) => `${i + 1}. ${l}`).join("\n")}

## Top Formats by Engagement

${store.patterns.topFormats.map(f => `- **${f.format}**: ${f.avgEngRate}% avg eng (${f.count} videos)`).join("\n")}

## Top Industries

${store.patterns.topIndustries.map(i => `- **${i.industry}**: ${i.count} videos, ${fmtNum(i.avgViews)} avg views`).join("\n")}

## Format × Industry — Top Combos

${store.patterns.formatIndustryMatrix.slice(0, 8).map(m => `- ${m.format} + ${m.industry}: ${m.count} videos`).join("\n")}
`;
  writeFileSync(reportPath, report);
  console.log(`  📝 Saved report: data/learnings/${reportFileName}`);

  // Print results
  console.log(`\n✅ Done — ${store.totalClassified} total videos classified\n`);
  console.log("💡 Current learnings:");
  store.learnings.forEach((l, i) => console.log(`   ${i + 1}. ${l}`));
  console.log("\n📊 Top formats by engagement:");
  store.patterns.topFormats.slice(0, 5).forEach(f =>
    console.log(`   ${f.format}: ${f.avgEngRate}% avg eng (${f.count} videos)`)
  );
}

main().catch(err => { console.error("❌", err.message); process.exit(1); });
