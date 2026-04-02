# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Vision

HackUGC is a TikTok UGC intelligence platform built for app founders who run paid UA. The premise: most founders are flying blind on UGC — they don't know which hooks, formats, or sounds are actually driving installs right now. HackUGC fixes that.

**The end goal** is a live intelligence dashboard + AI agent that:
1. Continuously ingests trending TikTok content via ScrapeCreators
2. Identifies the patterns, hooks, and formats that drive app installs
3. Generates actionable briefs for UGC creators — ready to film
4. Eventually operates autonomously as a CMO-level AI that knows exactly what's working

**Comparable products:** SpyTok, MadMobile — but HackUGC goes deeper with AI pattern recognition, not just raw data.

**Owner:** Saif Ali — solo iOS app founder (BookBuds, LingoBear), goal $1M ARR in 2026
**Domain:** hackugc.com
**Status:** MVP in progress — UI shell complete, real data connected

---

## What's Been Built

### Phase 1 — Explore Feed (complete)
- Landing page (`/`) with retro Xbox aesthetic, bottom search bar
- Explore page (`/explore`) — masonry grid of trending TikTok videos
- Fetches real data from ScrapeCreators API (trending feed or keyword search)
- VideoCard: thumbnail, views, likes, handle — click opens original TikTok
- Fixed bottom search bar — search any niche/hook/keyword
- Tab switcher: Explore (live) / Research (Phase 2)
- Loading skeletons, empty states

### Phase 2 — Research Tab (planned)
- Deep competitor analysis: paste a TikTok handle → see their top videos, hooks, patterns
- Hook library: a searchable database of proven UGC openers
- Sound intelligence: surging sounds + what niches they work in
- Hashtag trends over time

### Phase 3 — AI Agent (in progress)
- `lib/classify.ts` — Claude Opus 4.6 classifies each video by FORMAT + INDUSTRY
- `GET /api/tiktok/learn` — fetches trending feed, classifies batch, saves to `data/ugc_intelligence.json`, syncs to Obsidian
- Obsidian sync target: `agentspace/obsidian/agents/HackUGC_Agent.md` (CMO reads this)
- CMO agent in AgentSpace reads HackUGC_Agent.md every daily run to ground format/hook recommendations in real classified data
- Remaining: UGC brief generator, scheduled daily cron, deployed URL for Railway CMO to hit

---

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Data:** ScrapeCreators API (`https://api.scrapecreators.com`)
- **AI (Phase 3):** Anthropic Claude API

## Design System

- **Theme:** Dark mode only. Retro 2000s / original Xbox aesthetic.
- **Background:** `#000000`
- **Surface/cards:** `#0d0d0d` with `#1a1a1a` borders
- **Green accent:** `#00ff41` — CTAs, active states, highlights, glows
- **Muted text:** `#555` / `#444` / `#333`
- **Fonts:** `Space Mono` for brand/headings (retro mono), `Inter` for body
- **Motion:** Subtle — hover border glows, pulse dots, scale on active
- **Grid background:** Green lines at 4% opacity, 40px spacing

---

## Project Structure

```
hackugc/
├── app/
│   ├── page.tsx                        # Landing page
│   ├── layout.tsx                      # Root layout, fonts, metadata
│   ├── globals.css                     # CSS vars, Tailwind, scrollbar
│   ├── explore/
│   │   └── page.tsx                    # Explore tab — video grid + search
│   └── api/
│       └── tiktok/
│           ├── trending/route.ts       # GET → getTrendingFeed("US")
│           └── search/route.ts         # GET ?q=... → searchKeyword(q)
└── lib/
    └── scrapecreators.ts               # Full ScrapeCreators API client
```

---

## ScrapeCreators API

Base URL: `https://api.scrapecreators.com`
Auth: `x-api-key` header
Key: in `.env.local` as `SCRAPECREATORS_API_KEY`
Cache: 5 min (`next: { revalidate: 300 }`)

### Implemented endpoints:
| Function | Endpoint | Used in |
|---|---|---|
| `getTrendingFeed(region)` | `/v1/tiktok/get-trending-feed` | `/api/tiktok/trending` |
| `getPopularVideos(period, orderBy)` | `/v1/tiktok/videos/popular` | (available) |
| `searchKeyword(query, sortBy)` | `/v1/tiktok/search/keyword` | `/api/tiktok/search` |
| `searchHashtag(hashtag)` | `/v1/tiktok/search/hashtag` | (available) |
| `getTrendingHashtags(period)` | `/v1/tiktok/hashtags/popular` | (Phase 2) |
| `getSurgingSounds(period)` | `/v1/tiktok/songs/popular` | (Phase 2) |

### Planned endpoints (Phase 2):
- `GET /v3/tiktok/profile/videos?handle=X&sort_by=popular` — competitor video analysis
- `GET /v2/tiktok/video?url=X` — single video deep data

### Video data shape (TrendingVideo):
```ts
{ id, caption, views, likes, comments, shares, bookmarks,
  handle, nickname, avatarUrl, thumbnailUrl,
  musicTitle, musicAuthor, duration, url }
```

---

## API Routes

- `GET /api/tiktok/trending` → returns `{ videos: TrendingVideo[] }` from US trending feed
- `GET /api/tiktok/search?q=<query>` → returns `{ videos: TrendingVideo[] }` from keyword search
- `GET /api/tiktok/video?url=<tiktokUrl>` → returns `{ playUrl, thumbUrl }` native MP4 URL
- `GET /api/tiktok/learn` → classifies trending videos with Claude, saves to `data/ugc_intelligence.json` + Obsidian

## Agent Learning Architecture

```
ScrapeCreators API → /api/tiktok/learn → Claude Opus 4.6 (classify)
                                        ↓
                              data/ugc_intelligence.json (local store, max 500 videos)
                                        ↓
                 agentspace/obsidian/agents/HackUGC_Agent.md (CMO reads this)
```

**Classification labels:**
- FORMAT: Talking Head, Silent UGC, App Demo, Animation, Text-Heavy, Slideshow, Hook+Demo, Reaction+Demo, Other
- INDUSTRY: Games, Finance, Health, Education, Entertainment, Lifestyle, B2B, Unknown

**Pattern outputs:** topFormats, topIndustries, format×industry matrix, hook patterns, key insights

**To trigger a learning run:** `curl localhost:3000/api/tiktok/learn`

---

## Environment Variables

File: `.env.local` (never commit)

```
SCRAPECREATORS_API_KEY=...
ANTHROPIC_API_KEY=          # for Phase 3 AI agent
```

---

## Commands

```bash
npm run dev      # start dev server on localhost:3000
npm run build    # production build
npm run lint     # eslint check
```

---

## Obsidian Sync (Phase 3)

Agent learnings will sync to:
`/Users/saifali/Desktop/Playground/agentspace/obsidian/agents/HackUGC_Agent.md`
