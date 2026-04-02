import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse(null, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: {
        Referer: "https://www.tiktok.com/",
        Origin: "https://www.tiktok.com",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "image/webp,image/avif,image/*,*/*;q=0.8",
      },
    });

    if (!res.ok) return new NextResponse(null, { status: res.status });

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "image/webp";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
