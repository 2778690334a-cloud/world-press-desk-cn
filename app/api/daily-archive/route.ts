import { NextRequest, NextResponse } from "next/server";
import { getArchiveDb } from "../../../db";
import { readArchive } from "../../lib/archive-store";
import { requestedDay } from "../../lib/headline-index";
import { currentDeskDate } from "../../lib/rss";
import { canManageDesk } from "../../lib/admin";
import { collectAndSave } from "../../lib/collect-and-save";
import { boundedRequestText } from "../../lib/request-limits";
export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"no-store"};

export async function GET(request: NextRequest) {
  let date: string;
  try { date = requestedDay(request.nextUrl.searchParams.get("date")); }
  catch { return NextResponse.json({message:"日期无效。"},{status:400,headers}); }
  try { return NextResponse.json(await readArchive(getArchiveDb(),date),{headers}); }
  catch (error) { console.error("Archive read failed",error); return NextResponse.json({status:"error",message:"链接档案暂时无法读取，请稍后重试。",articles:[]},{status:503,headers}); }
}

// Public visitors may read; only the configured platform-authenticated owner may write.
export async function POST(request: NextRequest) {
  if (!canManageDesk(request.headers)) return NextResponse.json({message:"仅管理员可以收录。"},{status:403,headers});
  const origin=request.headers.get("origin");
  if ((origin && origin!==request.nextUrl.origin) || request.headers.get("sec-fetch-site")==="cross-site") return NextResponse.json({message:"Forbidden"},{status:403,headers});
  if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({message:"JSON required"},{status:415,headers});
  const text=await boundedRequestText(request,1024);
  if(text===null) return NextResponse.json({message:"Request too large"},{status:413,headers});
  let date: string;
  try { const body=JSON.parse(text); date=requestedDay(body.date ?? null); }
  catch { return NextResponse.json({message:"日期或请求无效。"},{status:400,headers}); }
  if(date!==currentDeskDate()) return NextResponse.json({message:"只能采集北京时间今天，不能用今天的新闻源补造历史档案。"},{status:400,headers});
  try {
    return NextResponse.json(await collectAndSave(date),{headers});
  } catch(error) {
    console.error("Archive collection failed",error);
    return NextResponse.json({status:"error",message:"收录或保存失败，已有档案未删除，请稍后重试。"},{status:503,headers});
  }
}
