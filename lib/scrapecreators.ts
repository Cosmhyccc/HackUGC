const BASE_URL = "https://api.scrapecreators.com";
const API_KEY = process.env.SCRAPECREATORS_API_KEY ?? "";

async function get<T>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
  const url = new URL(BASE_URL + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const res = await fetch(url.toString(), {
    headers: { "x-api-key": API_KEY },
    next: { revalidate: 43200 }, // cache 12 hours
  });

  if (!res.ok) throw new Error(`ScrapeCreators ${path} → ${res.status}`);
  return res.json();
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface TikTokVideo {
  aweme_id: string;
  desc: string;
  create_time: number;
  url?: string;
  region?: string;
  statistics: {
    play_count: number;
    digg_count: number;
    comment_count: number;
    share_count: number;
    collect_count: number;
  };
  video: {
    cover?: { url_list: string[] };
    origin_cover?: { url_list: string[] };
    duration?: number;
    width?: number;
    height?: number;
  };
  music?: {
    title: string;
    author: string;
    id_str?: string;
  };
  author: {
    unique_id: string;
    nickname: string;
    avatar_thumb?: { url_list: string[] };
    follower_count?: number;
  };
}

export interface TrendingVideo {
  id: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  bookmarks: number;
  handle: string;
  nickname: string;
  avatarUrl: string;
  thumbnailUrl: string;
  musicTitle: string;
  musicAuthor: string;
  duration: number;
  url: string;
}

// ── Normalizer ───────────────────────────────────────────────────────────────

function toWebp(url: string): string {
  // TikTok CDN serves .heic by default — swap to .webp which browsers support
  return url.replace(/\.heic(\?|$)/, ".webp$1");
}

function normalizeVideo(v: TikTokVideo): TrendingVideo {
  const rawThumb =
    v.video?.origin_cover?.url_list?.[0] ??
    v.video?.cover?.url_list?.[0] ??
    "";
  const thumb = toWebp(rawThumb);

  return {
    id: v.aweme_id,
    caption: v.desc ?? "",
    views: v.statistics?.play_count ?? 0,
    likes: v.statistics?.digg_count ?? 0,
    comments: v.statistics?.comment_count ?? 0,
    shares: v.statistics?.share_count ?? 0,
    bookmarks: v.statistics?.collect_count ?? 0,
    handle: `@${v.author?.unique_id ?? ""}`,
    nickname: v.author?.nickname ?? "",
    avatarUrl: v.author?.avatar_thumb?.url_list?.[0] ?? "",
    thumbnailUrl: thumb,
    musicTitle: v.music?.title ?? "",
    musicAuthor: v.music?.author ?? "",
    duration: Math.round((v.video?.duration ?? 0) / 1000),
    url: v.url ?? `https://www.tiktok.com/@${v.author?.unique_id}/video/${v.aweme_id}`,
  };
}

// ── API calls ────────────────────────────────────────────────────────────────

export async function getTrendingFeed(region = "US"): Promise<TrendingVideo[]> {
  const data = await get<{ aweme_list: TikTokVideo[] }>("/v1/tiktok/get-trending-feed", { region });
  return (data.aweme_list ?? []).map(normalizeVideo);
}

export async function getPopularVideos(period: 7 | 30 = 7, orderBy: "hot" | "like" | "comment" = "hot"): Promise<TrendingVideo[]> {
  const data = await get<{ videos: { item_url: string; title: string; cover: string; id: string }[] }>(
    "/v1/tiktok/videos/popular",
    { period, orderBy, countryCode: "US" }
  );
  // Popular endpoint returns limited fields — map what we have
  return (data.videos ?? []).map((v) => ({
    id: v.id,
    caption: v.title ?? "",
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    bookmarks: 0,
    handle: "",
    nickname: "",
    avatarUrl: "",
    thumbnailUrl: v.cover ?? "",
    musicTitle: "",
    musicAuthor: "",
    duration: 0,
    url: v.item_url ?? "",
  }));
}

export async function searchKeyword(query: string, sortBy: "most-liked" | "relevance" | "date-posted" = "most-liked"): Promise<TrendingVideo[]> {
  const data = await get<{ search_item_list: { aweme_info: TikTokVideo }[] }>("/v1/tiktok/search/keyword", {
    query,
    sort_by: sortBy,
    date_posted: "this-month",
  });
  return (data.search_item_list ?? [])
    .map((item) => item.aweme_info)
    .filter(Boolean)
    .map(normalizeVideo);
}

export async function searchHashtag(hashtag: string): Promise<TrendingVideo[]> {
  const data = await get<{ aweme_list: TikTokVideo[] }>("/v1/tiktok/search/hashtag", { hashtag });
  return (data.aweme_list ?? []).map(normalizeVideo);
}

export async function getTrendingHashtags(period: 7 | 30 | 120 = 7) {
  return get<{
    list: { hashtag_name: string; video_views: number; publish_cnt: number; rank: number; rank_diff: number }[]
  }>("/v1/tiktok/hashtags/popular", { period, countryCode: "US" });
}

export async function getSurgingSounds(period: 7 | 30 | 130 = 7) {
  return get<{
    sound_list: { title: string; author: string; clip_id: string; rank: number; rank_diff: number; trend: number[] }[]
  }>("/v1/tiktok/songs/popular", { timePeriod: period, rankType: "surging", countryCode: "US" });
}
