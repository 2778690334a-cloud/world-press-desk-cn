import { NextRequest, NextResponse } from "next/server";
import { canManageDesk } from "../../lib/admin";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  return NextResponse.json({canCollect:canManageDesk(request.headers)}, {headers:{"Cache-Control":"private, no-store"}});
}
