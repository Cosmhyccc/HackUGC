#!/usr/bin/env node
/**
 * HackUGC — Agentic Playbook Generator
 *
 * Claude autonomously researches a niche using web search + URL fetching,
 * then writes a grounded UGC creator playbook. No hardcoding. No manual research.
 *
 * Usage: node scripts/playbook.mjs lingobear
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf-8").split("\n")) {
  const [k, ...rest] = line.split("=");
  if (k?.trim() && rest.length) process.env[k.trim()] = rest.join("=").trim();
}

const slug = process.argv[2];
if (!slug) { console.error("Usage: node scripts/playbook.mjs <app-slug>"); process.exit(1); }

const appsConfig = JSON.parse(readFileSync(path.join(ROOT, "data", "apps.json"), "utf-8"));
const app = appsConfig.apps.find(a => a.slug === slug);
if (!app) { console.error(`App "${slug}" not found in data/apps.json`); process.exit(1); }

const intelligence = existsSync(path.join(ROOT, "data", "ugc_intelligence.json"))
  ? JSON.parse(readFileSync(path.join(ROOT, "data", "ugc_intelligence.json"), "utf-8"))
  : null;

// ── Tools ─────────────────────────────────────────────────────────────────────

async function searchWeb(query) {
  console.log(`  🔍 search: "${query}"`);
  try {
    const res = await fetch(
      `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)",
          "Accept": "text/html",
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    const html = await res.text();
    // Extract result links + snippets from DDG lite HTML
    const snippets = [];
    const snippetRegex = /class='result-snippet'[^>]*>([\s\S]*?)<\/td>/g;
    const linkRegex = /class='result-link'[^>]*href='([^']+)'[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    const links = [];
    while ((m = linkRegex.exec(html)) !== null) {
      links.push({ url: m[1], title: m[2].replace(/<[^>]+>/g, "").trim() });
    }
    while ((m = snippetRegex.exec(html)) !== null) {
      snippets.push(m[1].replace(/<[^>]+>/g, "").trim());
    }
    if (!snippets.length && !links.length) {
      // Fallback: strip all HTML and return first 2000 chars
      return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
    }
    return links.slice(0, 6).map((l, i) => `${l.title}\n${l.url}\n${snippets[i] || ""}`).join("\n\n");
  } catch (e) {
    return `Search failed: ${e.message}`;
  }
}

async function fetchUrl(url) {
  console.log(`  📄 fetch: ${url}`);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);
  } catch (e) {
    return `Fetch failed: ${e.message}`;
  }
}

// ── Tool definitions for Claude ───────────────────────────────────────────────

const tools = [
  {
    name: "search_web",
    description: "Search the web using DuckDuckGo. Use this to find what competitors are doing, which UGC formats are going viral in a niche, creator strategies, app reviews, Reddit discussions, etc. Search multiple times with different queries to get a full picture.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "fetch_url",
    description: "Fetch and read a specific URL. Use this to read Reddit threads, articles, App Store pages, YouTube descriptions, or any page from search results that looks relevant.",
    input_schema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
  {
    name: "write_playbook",
    description: "When you have done enough research and understand the niche, write the final creator playbook. This ends your research phase.",
    input_schema: {
      type: "object",
      properties: { playbook: { type: "string", description: "Full playbook in markdown" } },
      required: ["playbook"],
    },
  },
];

// ── Agentic loop ──────────────────────────────────────────────────────────────

async function run() {
  const classifiedContext = intelligence
    ? `\nClassified video intelligence (${intelligence.totalClassified} videos analyzed):\n${intelligence.learnings?.join("\n")}\n\nTop formats by engagement:\n${intelligence.patterns?.topFormats?.map(f => `${f.format}: ${f.avgEngRate}% avg eng`).join("\n")}`
    : "\nNo classified video data available yet.";

  const systemPrompt = `You are a UGC research analyst and strategist. Your job is to autonomously research what's ACTUALLY working on TikTok for a specific app niche, then write a specific creator playbook.

You have access to web search and URL fetching. Do 4-6 targeted searches, read 2-3 URLs, then call write_playbook. Do NOT keep searching indefinitely — you have a hard limit of 8 research actions total. After that you MUST call write_playbook with whatever you've found.

Focus your research: search competitors by name, find Reddit pain points, look for viral TikTok formats in the niche. Then synthesize and write.`;

  const userPrompt = `Write a UGC creator playbook for: ${app.name}

App details:
- Category: ${app.category}
- What it does: ${app.description}
- Key differentiator: ${app.differentiator}
- Target user: ${app.target}
- Status: ${app.status}
${classifiedContext}

Research the niche thoroughly before writing. Find out:
1. Who the top competitors are and what TikTok content they're making that goes viral
2. Which specific formats, hooks, and emotional angles are working RIGHT NOW
3. What pain points the target user has that make them stop scrolling
4. What makes someone share or save this type of content

Then write a specific, actionable playbook a creator can use tomorrow. Not generic — grounded in what you actually found.`;

  const messages = [{ role: "user", content: userPrompt }];

  console.log(`\n🧠 Researching ${app.name} niche...\n`);

  let iterations = 0;
  const MAX = 15;

  while (iterations < MAX) {
    iterations++;


    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 8000,
        system: systemPrompt,
        tools,
        messages,
      }),
    });

    const data = await res.json();

    if (data.error) {
      console.error("API error:", data.error);
      process.exit(1);
    }

    // Add assistant response to history
    messages.push({ role: "assistant", content: data.content });

    // Check stop reason
    if (data.stop_reason === "end_turn") {
      console.log("\nAgent finished without calling write_playbook.");
      break;
    }

    // Process tool calls
    const toolUses = data.content.filter(b => b.type === "tool_use");
    if (!toolUses.length) break;

    const toolResults = [];
    for (const tool of toolUses) {
      let result;
      if (tool.name === "search_web") {
        result = await searchWeb(tool.input.query);
      } else if (tool.name === "fetch_url") {
        result = await fetchUrl(tool.input.url);
      } else if (tool.name === "write_playbook") {
        const content = tool.input?.playbook ?? tool.input?.content ?? "";
        if (!content) { console.error("write_playbook called with empty content"); break; }
        const outPath = path.join(ROOT, "data", `${slug}_playbook.md`);
        writeFileSync(outPath, content);
        console.log("\n" + "─".repeat(60));
        console.log(content);
        console.log("─".repeat(60));
        console.log(`\n✅ Saved to data/${slug}_playbook.md`);
        return;
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: tool.id,
        content: (result ?? "").slice(0, 1500),
      });
    }

    // Trim old assistant messages: keep only tool_use blocks (drop verbose text)
    // to prevent input token explosion over 12 iterations
    messages.forEach((msg, i) => {
      if (msg.role === "assistant" && i < messages.length - 3 && Array.isArray(msg.content)) {
        msg.content = msg.content.filter(b => b.type === "tool_use");
      }
    });

    // After iteration 6, inject a hard write deadline
    if (iterations >= 6) {
      toolResults.push({
        type: "text",
        text: "⚠️ STOP RESEARCHING. You have gathered enough data. Call write_playbook NOW with your findings. No more searching.",
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  console.log("\n⚠️  Max iterations reached without completing playbook.");
}

run().catch(err => { console.error("❌", err.message); process.exit(1); });
