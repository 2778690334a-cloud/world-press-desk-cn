import { NextRequest, NextResponse } from "next/server";
import { canManageDesk } from "../lib/admin";
import { sameOriginWrite } from "../lib/admin-policy";
import { collectAndSave } from "../lib/collect-and-save";
import { readArchive } from "../lib/archive-store";
import { getArchiveDb } from "../../db";
import { requestedDay } from "../lib/headline-index";
import { currentDeskDate } from "../lib/rss";
import { boundedRequestText } from "../lib/request-limits";
export const dynamic = "force-dynamic";
const supportedProtocols = ["2025-03-26","2025-06-18","2025-11-25"];
const headers = {"Cache-Control":"private, no-store"};
const dateSchema = {type:"object",properties:{date:{type:"string",pattern:"^\\d{4}-\\d{2}-\\d{2}$",description:"Beijing collection date YYYY-MM-DD"}},required:["date"],additionalProperties:false};
const tools = [
  {name:"desk_identity",description:"Read only: return your platform-verified identity for owner configuration; grants no access.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false}},
  {name:"collect_daily_news",description:"Owner only: save today's Beijing news links, titles, media and dates. Idempotent; no full text, images or summaries. Never backfills past days.",inputSchema:dateSchema,annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true}},
  {name:"read_daily_archive",description:"Owner only: independently verify a saved date's count and collection attempt timestamp.",inputSchema:dateSchema,annotations:{readOnlyHint:true,destructiveHint:false}},
];
export async function GET() { return new NextResponse(null,{status:405,headers:{...headers,Allow:"POST"}}); }
export async function POST(request: NextRequest) {
  if (!sameOriginWrite(request.headers, request.nextUrl.origin)) return new NextResponse(null,{status:403,headers});
  if (!request.headers.get("content-type")?.startsWith("application/json")) return new NextResponse(null,{status:415,headers});
  const raw = await boundedRequestText(request,8192);
  if (raw === null) return new NextResponse(null,{status:413,headers});
  let body: {jsonrpc?:string;id?:string|number|null;method?:string;params?:{name?:string;arguments?:Record<string,unknown>;protocolVersion?:string}};
  try { body = JSON.parse(raw); } catch { return NextResponse.json({jsonrpc:"2.0",id:null,error:{code:-32700,message:"Parse error"}},{status:400,headers}); }
  if (!body || Array.isArray(body) || body.jsonrpc !== "2.0") return NextResponse.json({jsonrpc:"2.0",id:null,error:{code:-32600,message:"Invalid request"}},{status:400,headers});
  const respond = (result: unknown) => NextResponse.json({jsonrpc:"2.0",id:body.id ?? null,result},{headers});
  const failure = (code:number,message:string,status=200) => NextResponse.json({jsonrpc:"2.0",id:body.id ?? null,error:{code,message}},{status,headers});
  const protocol = request.headers.get("MCP-Protocol-Version");
  if (body.method !== "initialize" && protocol && !supportedProtocols.includes(protocol)) return failure(-32600,"Unsupported protocol version",400);
  if (body.method === "notifications/initialized" || body.method === "notifications/cancelled") return new NextResponse(null,{status:202,headers});
  if (body.id === undefined) return failure(-32600,"Request id required",400);
  if (body.method === "initialize") {
    const requested = body.params?.protocolVersion;
    return respond({protocolVersion:requested && supportedProtocols.includes(requested) ? requested : "2025-06-18",capabilities:{tools:{listChanged:false}},serverInfo:{name:"world-press-desk",version:"1.0.0"}});
  }
  if (body.method === "ping") return respond({});
  if (body.method === "tools/list") return respond({tools});
  if (body.method !== "tools/call") return failure(-32601,"Method not found");
  const identity = request.headers.get("oai-authenticated-user-id");
  if (!identity) return failure(-32001,"Platform sign-in required",401);
  if (body.params?.name === "desk_identity") {
    const result={siteUserId:identity,email:request.headers.get("oai-authenticated-user-email"),canManage:canManageDesk(request.headers)};
    return respond({content:[{type:"text",text:JSON.stringify(result)}],structuredContent:result,isError:false});
  }
  if (!canManageDesk(request.headers)) return failure(-32003,"Owner permission required",403);
  const name = body.params?.name;
  if (name !== "collect_daily_news" && name !== "read_daily_archive") return failure(-32602,"Unknown tool");
  const args = body.params?.arguments;
  if (!args || typeof args.date !== "string" || Object.keys(args).some(key=>key!=="date")) return failure(-32602,"Only a date argument is accepted");
  let date: string;
  try { date = requestedDay(args.date); } catch { return failure(-32602,"Invalid Beijing date"); }
  if (name === "collect_daily_news" && date !== currentDeskDate()) return failure(-32602,"Collection is limited to today's Beijing date");
  try {
    const data = name === "collect_daily_news" ? await collectAndSave(date) : await readArchive(getArchiveDb(),date);
    const result={requestedDate:data.requestedDate,archivedCount:data.archivedCount,collection:data.collection,status:data.status};
    return respond({content:[{type:"text",text:JSON.stringify(result)}],structuredContent:result,isError:false});
  } catch {
    return respond({content:[{type:"text",text:"Collection/read failed. Read back before retrying; existing records were not intentionally deleted."}],isError:true});
  }
}
