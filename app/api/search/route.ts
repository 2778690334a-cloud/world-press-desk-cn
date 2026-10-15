import { cachedPublicSource } from "../../lib/public-cache";
import { logicalMediaDomain, mediaQueryDomains } from "../../lib/media-domains";
import { readArchive } from "../../lib/archive-store";
import { getArchiveDb } from "../../../db";
import { requestedDay } from "../../lib/headline-index";
import { NextRequest, NextResponse } from "next/server";
import {
  articleMatchesDate,
  broadUtcRange,
  currentDeskDate,
  fetchPublicArticles,
  type IndexedArticle,
} from "../../lib/rss";
import {
  buildTopicIntent,
  matchTopicArticle,
  type TopicIntent,
} from "../../lib/topic-search";

const SOURCE_DOMAINS = [
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
  const normalized = logicalMediaDomain(value);
  return SOURCE_DOMAINS.find(
    (domain) => normalized === domain || normalized.endsWith(`.${domain}`),
  );
}

type GdeltStatus =
  | "ok"
  | "http-error"
  | "invalid-response"
  | "timeout"
  | "network-error";

type GdeltSearchResult = {
  articles: IndexedArticle[];
  status: GdeltStatus;
};

async function searchGdelt(
  intent: TopicIntent,
  requestedDate: string,
): Promise<GdeltSearchResult> {
  const { start, end } = broadUtcRange(requestedDate);
  const domainBlock = mediaQueryDomains(SOURCE_DOMAINS).map(
    (domain) => `domain:${domain}`,
  ).join(" OR ");
  const params = new URLSearchParams({
    query: `${intent.gdeltQuery} (${domainBlock})`,
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
          "User-Agent": "WorldPressDesk/1.1 (topic search)",
        },
        signal: AbortSignal.timeout(18000),
      },
    );
    if (!response.ok) return { articles: [], status: "http-error" };
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) {
      return { articles: [], status: "invalid-response" };
    }
    const payload = (await response.json()) as { articles?: GdeltArticle[] };

    return {
      status: "ok",
      articles: (payload.articles ?? [])
        .filter((article) => article.title && article.url && article.domain)
        .map((article): IndexedArticle | null => {
          const domain = canonicalDomain(article.domain!);
          return domain
            ? {
                title: article.title!.trim(),
                url: article.url!,
                domain,
                seenAt: normalizeGdeltDate(article.seendate),
                indexedAt: normalizeGdeltDate(article.seendate),
                fetchedAt: new Date().toISOString(),
                language: article.language,
                sourceCountry: article.sourcecountry,
                sourceType: "gdelt",
              }
            : null;
        })
        .filter((article): article is IndexedArticle => article !== null)
        .filter((article) => articleMatchesDate(article, requestedDate)),
    };
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      articles: [],
      status: isTimeout ? "timeout" : "network-error",
    };
  }
}

function canonicalArticleUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}

export async function GET(request: NextRequest) {
  const topic = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (topic.length < 2 || topic.length > 80) {
    return NextResponse.json(
      { articles: [], message: "请输入 2–80 个字符的议题。" },
      { status: 400 },
    );
  }

  let date: string;
  try { date = requestedDay(request.nextUrl.searchParams.get("date")); }
  catch { return NextResponse.json({articles:[],message:"日期无效。"},{status:400}); }
  const intent = buildTopicIntent(topic);
  if (date !== currentDeskDate()) {
    try {
      const archive = await readArchive(getArchiveDb(),date);
      const articles = archive.articles.flatMap(article => {
        const match=matchTopicArticle(article,intent); return match ? [{...article,...match}] : [];
      }).sort((a,b)=>b.score-a.score).slice(0,80);
      return NextResponse.json({articles,requestedDate:date,status:articles.length?"live":archive.collection?.status === "ok" ? "empty":"incomplete",
        searchedAs:intent.canonicalQuery,expandedTerms:intent.expandedTerms,generatedAt:archive.generatedAt,
        coverage:{publicIndexCount:archive.articles.length,publicMatchCount:articles.length,externalIndexStatus:"ok",externalMatchCount:0,domains:12}},
        {headers:{"Cache-Control":"no-store"}});
    } catch(error) { console.error("Archive search failed",error); return NextResponse.json({articles:[],status:"error"},{status:503}); }
  }
  const [publicArticles, gdeltResult] = await Promise.all([
    fetchPublicArticles().catch(()=>[]),
    cachedPublicSource("search:"+date+":"+intent.gdeltQuery,()=>searchGdelt(intent, date)).catch(()=>({articles:[],status:"network-error" as const})),
  ]);

  const publicArticlesForDate = publicArticles.filter((article) =>
    articleMatchesDate(article, date),
  );
  const rank = (article: IndexedArticle) => {
    const match = matchTopicArticle(article, intent);
    return match ? { ...article, ...match } : null;
  };
  const publicMatches = publicArticlesForDate
    .map(rank)
    .filter((article) => article !== null);
  const gdeltMatches = gdeltResult.articles
    .map(rank)
    .filter((article) => article !== null);

  const seen = new Set<string>();
  const articles = [...publicMatches, ...gdeltMatches]
    .filter((article) => {
      const canonicalUrl = canonicalArticleUrl(article.url);
      if (seen.has(canonicalUrl)) return false;
      seen.add(canonicalUrl);
      return true;
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        (right.seenAt ?? "").localeCompare(left.seenAt ?? ""),
    )
    .slice(0, 80);

  const status = articles.length
    ? "live"
    : gdeltResult.status === "ok"
      ? "empty"
      : "incomplete";

  return NextResponse.json(
    {
      status,
      topic,
      searchedAs: intent.canonicalQuery,
      expandedTerms: intent.expandedTerms.slice(0, 12),
      requestedDate: date,
      generatedAt: new Date().toISOString(),
      coverage: {
        publicIndexCount: publicArticlesForDate.length,
        publicMatchCount: publicMatches.length,
        externalIndexStatus: gdeltResult.status,
        externalMatchCount: gdeltMatches.length,
        domains: SOURCE_DOMAINS.length,
      },
      articles,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    },
  );
}
