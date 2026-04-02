import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "ugc_intelligence.json");

export async function GET() {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ totalClassified: 0, videos: [], learnings: [], patterns: {} });
  }
}
