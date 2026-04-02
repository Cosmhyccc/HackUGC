import { getTrendingFeed } from "@/lib/scrapecreators";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const videos = await getTrendingFeed("US");

    // Only keep videos that have a real ID, real handle, and some views
    const filtered = videos.filter(
      (v) => v.id && v.handle && v.handle !== "@" && v.views > 0
    );

    return NextResponse.json({ videos: filtered });
  } catch (err) {
    console.error("trending feed error:", err);
    return NextResponse.json({ videos: [] }, { status: 500 });
  }
}
