import { NextRequest, NextResponse } from "next/server";
import { collectHeadlines } from "../../lib/headline-index";
import { loadHotspots, parseHotspotRequest, type HotspotRequest } from "../../lib/hotspots";
import { getArchiveDb } from "../../../db";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  let query: HotspotRequest;
  try { query = parseHotspotRequest(request.nextUrl.searchParams); }
  catch { return NextResponse.json({ status: "error", topics: [], message: "日期、媒体或统计天数无效。" }, { status: 400, headers }); }
  try {
    const report = await loadHotspots(query, { database: getArchiveDb, collectCurrent: collectHeadlines });
    return NextResponse.json(report, { headers });
  } catch (error) {
    console.error("Hotspot load failed", error);
    return NextResponse.json({ status: "error", topics: [], message: "热点数据暂不可用，请稍后重试。" }, { status: 503, headers });
  }
}
