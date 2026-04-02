import { NextRequest, NextResponse } from "next/server";

const BASE = "https://api.scrapecreators.com";
const KEY = process.env.SCRAPECREATORS_API_KEY ?? "";

export async function GET(req: NextRequest) {
  const videoUrl = req.nextUrl.searchParams.get("url");
  if (!videoUrl) return NextResponse.json({ error: "missing url" }, { status: 400 });

  try {
    const res = await fetch(
      `${BASE}/v2/tiktok/video?url=${encodeURIComponent(videoUrl)}`,
      { headers: { "x-api-key": KEY }, next: { revalidate: false } }
    );
    if (!res.ok) return NextResponse.json({ error: "upstream failed" }, { status: res.status });

    const data = await res.json();
    const video = data?.aweme_detail?.video;

    const playUrl =
      video?.download_no_watermark_addr?.url_list?.[0] ??
      video?.play_addr?.url_list?.[0] ??
      null;

    const thumbUrl =
      video?.origin_cover?.url_list?.[0] ??
      video?.cover?.url_list?.[0] ??
      null;

    return NextResponse.json({ playUrl, thumbUrl });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
