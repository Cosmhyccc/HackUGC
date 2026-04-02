import { searchKeyword } from "@/lib/scrapecreators";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) {
    return NextResponse.json({ videos: [] }, { status: 400 });
  }

  try {
    const videos = await searchKeyword(q.trim());
    return NextResponse.json({ videos });
  } catch (err) {
    console.error("search error:", err);
    return NextResponse.json({ videos: [] }, { status: 500 });
  }
}
