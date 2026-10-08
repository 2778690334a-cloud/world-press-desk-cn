import { NextRequest, NextResponse } from "next/server";
import { collectHeadlines, requestedDay } from "../../lib/headline-index";
import { currentDeskDate } from "../../lib/rss";
import { readArchive } from "../../lib/archive-store";
import { getArchiveDb } from "../../../db";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  let date: string;
  try { date=requestedDay(request.nextUrl.searchParams.get("date")); }
  catch { return NextResponse.json({message:"日期无效。",articles:[]},{status:400}); }
  try {
    if(date!==currentDeskDate()) return NextResponse.json(await readArchive(getArchiveDb(),date),{headers:{"Cache-Control":"no-store"}});
    const result=await collectHeadlines(date);
    return NextResponse.json({...result,status:result.articles.length?"live":"incomplete",requestedDate:date,generatedAt:new Date().toISOString()}, {headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    console.error("News load failed",error);
    return NextResponse.json({status:"error",requestedDate:date,articles:[],message:"新闻或历史档案暂不可用，请稍后重试。"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
