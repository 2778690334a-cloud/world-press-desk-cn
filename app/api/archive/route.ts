import { NextRequest, NextResponse } from "next/server";
import {
  isArchivableMediaUrl,
  safeWaybackSnapshotUrl,
  waybackFallbackUrl,
  waybackTimestamp,
} from "../../lib/wayback";

type WaybackAvailability = {
  archived_snapshots?: {
    closest?: {
      available?: boolean;
      status?: string;
      timestamp?: string;
      url?: string;
    };
  };
};

function redirectWithoutCache(destination: string) {
  const response = NextResponse.redirect(destination, 307);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get("url")?.trim() ?? "";
  const requestedDate = request.nextUrl.searchParams.get("date")?.trim() ?? "";

  if (!isArchivableMediaUrl(targetUrl)) {
    return NextResponse.json(
      { message: "只能查询本项目已收录媒体的网页存档。" },
      { status: 400 },
    );
  }

  const fallback = waybackFallbackUrl(targetUrl, requestedDate);
  const params = new URLSearchParams({
    url: targetUrl,
    timestamp: waybackTimestamp(requestedDate),
  });

  try {
    const response = await fetch(
      `https://archive.org/wayback/available?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "WorldPressDesk/1.2 (Wayback availability lookup)",
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) return redirectWithoutCache(fallback);

    const payload = (await response.json()) as WaybackAvailability;
    const closest = payload.archived_snapshots?.closest;
    const snapshotUrl =
      closest?.available && closest.status === "200"
        ? safeWaybackSnapshotUrl(closest.url)
        : null;

    return redirectWithoutCache(snapshotUrl ?? fallback);
  } catch {
    return redirectWithoutCache(fallback);
  }
}

