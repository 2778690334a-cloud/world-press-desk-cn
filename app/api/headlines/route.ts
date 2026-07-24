import { NextRequest, NextResponse } from "next/server";
import {
  articleMatchesDate,
  broadUtcRange,
  currentDeskDate,
  fetchPublicArticles,
  type IndexedArticle,
} from "../../lib/rss";

const ALLOWED_DOMAINS = [
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
];

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

function normalizeGdeltDate(value?: string) {
  if (!value) return undefined;
  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/,
  );
  return match
    ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`
    : value;
}

function canonicalDomain(value: string) {
  const normalized = value.toLowerCase().replace(/^www\./, "");
  return ALLOWED_DOMAINS.find(
    (domain) => normalized === domain || normalized.endsWith(`.${domain}`),
  );
}

async function fetchGdeltFallback(
  domains: string[],
  requestedDate: string,
) {
  if (!domains.length) return [];
  const { start, end } = broadUtcRange(requestedDate);
  const domainBlock = domains.map((domain) => `domain:${domain}`).join(" OR ");
  const params = new URLSearchParams({
    query: `(${domainBlock})`,
    mode: "artlist",
    maxrecords: "250",
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
          "User-Agent": "WorldPressDesk/1.1 (news metadata index)",
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) return [];
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) return [];

    const payload = (await response.json()) as { articles?: GdeltArticle[] };
    return (payload.articles ?? [])
      .filter((article) => article.title && article.url && article.domain)
      .map((article): IndexedArticle | null => {
        const domain = canonicalDomain(article.domain!);
        if (!domain || !domains.includes(domain)) return null;
        return {
          title: article.title!.trim(),
          url: article.url!,
          domain,
          seenAt: normalizeGdeltDate(article.seendate),
          language: article.language,
          sourceCountry: article.sourcecountry,
          sourceType: "gdelt",
        };
      })
      .filter((article): article is IndexedArticle => article !== null)
      .filter((article) => articleMatchesDate(article, requestedDate));
  } catch {
    return [];
  }
}

function requestedDay(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : currentDeskDate();
}

function deduplicateAndLimit(
  articles: IndexedArticle[],
  requestedDate: string,
) {
  const seen = new Set<string>();
  const perDomain = new Map<string, number>();
  return [...articles]
    .sort((left, right) => {
      const leftIsExact = left.localDate === requestedDate ? 1 : 0;
      const rightIsExact = right.localDate === requestedDate ? 1 : 0;
      if (leftIsExact !== rightIsExact) return rightIsExact - leftIsExact;
      return (right.seenAt ?? "").localeCompare(left.seenAt ?? "");
    })
    .filter((article) => {
      if (seen.has(article.url)) return false;
      const count = perDomain.get(article.domain) ?? 0;
      if (count >= 20) return false;
      seen.add(article.url);
      perDomain.set(article.domain, count + 1);
      return true;
    });
}

export async function GET(request: NextRequest) {
  const date = requestedDay(request.nextUrl.searchParams.get("date"));

  try {
    const publicArticles = (await fetchPublicArticles()).filter((article) =>
      articleMatchesDate(article, date),
    );
    const publicDomains = new Set(
      publicArticles.map((article) => article.domain),
    );
    const missingDomains = ALLOWED_DOMAINS.filter(
      (domain) => !publicDomains.has(domain),
    );
    const gdeltArticles = await fetchGdeltFallback(missingDomains, date);
    const articles = deduplicateAndLimit(
      [...publicArticles, ...gdeltArticles],
      date,
    );

    const sourceStatus = Object.fromEntries(
      ALLOWED_DOMAINS.map((domain) => {
        const article = articles.find((item) => item.domain === domain);
        return [domain, article?.sourceType ?? "missing"];
      }),
    );

    return NextResponse.json(
      {
        status: articles.length ? "live" : "empty",
        generatedAt: new Date().toISOString(),
        requestedDate: date,
        sourceStatus,
        articles,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=180, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "fallback",
        generatedAt: new Date().toISOString(),
        requestedDate: date,
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
