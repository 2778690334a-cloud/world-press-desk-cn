import { NextRequest, NextResponse } from "next/server";

const ALLOWED_DOMAINS = new Set([
  "news.cn",
  "nhk.or.jp",
  "nikkei.com",
  "bbc.com",
  "theguardian.com",
  "lemonde.fr",
  "dw.com",
  "cnn.com",
  "nytimes.com",
  "aljazeera.com",
  "abc.net.au",
  "folha.uol.com.br",
]);

type GdeltArticle = {
  title?: string;
  url?: string;
  domain?: string;
  seendate?: string;
  language?: string;
  sourcecountry?: string;
};

function utcStamp(date: Date) {
  return date
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14);
}

async function fetchLatestForDomain(
  domain: string,
  start: Date,
  end: Date,
) {
  const params = new URLSearchParams({
    query: `domain:${domain}`,
    mode: "artlist",
    maxrecords: "8",
    format: "json",
    sort: "datedesc",
    startdatetime: utcStamp(start),
    enddatetime: utcStamp(end),
  });

  try {
    const response = await fetch(
      `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "WorldPressDesk/1.0 (news metadata index)",
        },
      },
    );
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) return null;

    const payload = (await response.json()) as { articles?: GdeltArticle[] };
    const match = (payload.articles ?? []).find(
      (article) => article.title && article.url,
    );
    if (!match?.title || !match.url) return null;

    return {
      title: match.title.trim(),
      url: match.url,
      domain,
      seenAt: match.seendate,
      language: match.language,
      sourceCountry: match.sourcecountry,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const requestedDate = request.nextUrl.searchParams.get("date");
  const chosen = requestedDate
    ? new Date(`${requestedDate}T00:00:00.000Z`)
    : new Date();
  const validDate = Number.isNaN(chosen.getTime()) ? new Date() : chosen;
  const end = new Date(validDate);
  end.setUTCDate(end.getUTCDate() + 1);

  try {
    const domains = [...ALLOWED_DOMAINS];
    const articles = [];

    // Keep concurrency deliberately low so the public index is treated politely.
    for (let index = 0; index < domains.length; index += 3) {
      const batch = domains.slice(index, index + 3);
      const results = await Promise.all(
        batch.map((domain) => fetchLatestForDomain(domain, validDate, end)),
      );
      articles.push(...results.filter((article) => article !== null));
    }

    return NextResponse.json(
      {
        status: articles.length ? "live" : "empty",
        generatedAt: new Date().toISOString(),
        requestedDate: validDate.toISOString().slice(0, 10),
        articles,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "fallback",
        generatedAt: new Date().toISOString(),
        requestedDate: validDate.toISOString().slice(0, 10),
        articles: [],
        message:
          error instanceof Error
            ? error.message
            : "The news index is temporarily unavailable.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
