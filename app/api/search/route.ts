import { NextRequest, NextResponse } from "next/server";
import { fetchRssArticles, type IndexedArticle } from "../../lib/rss";

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

const TOPIC_ALIASES = [
  ["人工智能", "artificial intelligence"],
  ["供应链", "supply chain"],
  ["全球经济", "global economy"],
  ["中东", "Middle East"],
  ["加沙", "Gaza"],
  ["巴以", "Israel Palestine"],
  ["以色列", "Israel"],
  ["巴勒斯坦", "Palestine"],
  ["俄乌", "Ukraine"],
  ["乌克兰", "Ukraine"],
  ["气候变化", "climate change"],
  ["气候", "climate"],
  ["能源", "energy"],
  ["科技", "technology"],
  ["贸易", "trade"],
  ["关税", "tariffs"],
  ["经济", "economy"],
  ["选举", "election"],
  ["美国", "United States"],
  ["中国", "China"],
  ["日本", "Japan"],
  ["欧洲", "Europe"],
  ["非洲", "Africa"],
  ["台海", "Taiwan"],
] as const;

const TOPIC_KEYWORDS: Record<string, string[]> = {
  "middle east": [
    "middle east",
    "israel",
    "gaza",
    "iran",
    "palestine",
    "lebanon",
    "syria",
  ],
  "artificial intelligence": [
    "artificial intelligence",
    "openai",
    "machine learning",
    " ai ",
  ],
  "supply chain": [
    "supply chain",
    "shipping",
    "manufacturing",
    "logistics",
  ],
  ukraine: ["ukraine", "russia", "kyiv", "moscow"],
  "climate change": ["climate", "global warming", "emissions"],
  climate: ["climate", "warming", "emissions", "weather"],
  economy: ["economy", "economic", "inflation", "growth", "interest rate"],
  "global economy": [
    "economy",
    "economic",
    "inflation",
    "growth",
    "interest rate",
  ],
  energy: ["energy", "oil", "gas", "electricity", "renewable"],
};

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

function expandTopic(topic: string) {
  const matched = TOPIC_ALIASES.find(([chinese]) => topic.includes(chinese));
  return matched?.[1] ?? topic;
}

function safeQueryTerm(value: string) {
  const trimmed = value.trim().replaceAll('"', "");
  return trimmed.includes(" ") ? `"${trimmed}"` : trimmed;
}

function canonicalDomain(value: string) {
  const normalized = value.toLowerCase().replace(/^www\./, "");
  return SOURCE_DOMAINS.find(
    (domain) => normalized === domain || normalized.endsWith(`.${domain}`),
  );
}

function matchesTopic(article: IndexedArticle, searchedAs: string) {
  const normalizedTopic = searchedAs.toLowerCase();
  const keywords = TOPIC_KEYWORDS[normalizedTopic] ?? [normalizedTopic];
  const haystack = ` ${article.title} ${article.summary ?? ""} `.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

async function searchDomainGroup(
  topic: string,
  domains: string[],
  start: Date,
  end: Date,
) {
  const domainBlock = domains.map((domain) => `domain:${domain}`).join(" OR ");
  const params = new URLSearchParams({
    query: `${safeQueryTerm(topic)} (${domainBlock})`,
    mode: "artlist",
    maxrecords: "60",
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
          "User-Agent": "WorldPressDesk/1.0 (topic search)",
        },
        signal: AbortSignal.timeout(18000),
      },
    );
    if (!response.ok) return [];
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) return [];
    const payload = (await response.json()) as { articles?: GdeltArticle[] };
    return payload.articles ?? [];
  } catch {
    return [];
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

  const requestedDate = request.nextUrl.searchParams.get("date");
  const chosen = requestedDate
    ? new Date(`${requestedDate}T00:00:00.000Z`)
    : new Date();
  const start = Number.isNaN(chosen.getTime()) ? new Date() : chosen;
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const requestedDay = start.toISOString().slice(0, 10);
  const searchedAs = expandTopic(topic);

  const groups = [
    SOURCE_DOMAINS.slice(0, 4),
    SOURCE_DOMAINS.slice(4, 8),
    SOURCE_DOMAINS.slice(8, 12),
  ];
  const [groupResults, rssArticles] = await Promise.all([
    Promise.all(
      groups.map((group) => searchDomainGroup(searchedAs, group, start, end)),
    ),
    fetchRssArticles(),
  ]);

  const rssMatches = rssArticles.filter(
    (article) =>
      (!article.seenAt || article.seenAt.slice(0, 10) === requestedDay) &&
      matchesTopic(article, searchedAs),
  );

  const gdeltMatches = groupResults
    .flat()
    .filter((article) => article.title && article.url && article.domain)
    .map((article): IndexedArticle | null => {
      const domain = canonicalDomain(article.domain!);
      return domain
        ? {
            title: article.title!.trim(),
            url: article.url!,
            domain,
            seenAt: article.seendate,
            language: article.language,
            sourceCountry: article.sourcecountry,
          }
        : null;
    })
    .filter((article): article is IndexedArticle => article !== null);

  const seen = new Set<string>();
  const articles = [...rssMatches, ...gdeltMatches]
    .filter((article) => {
      if (seen.has(article.url)) return false;
      seen.add(article.url);
      return true;
    })
    .sort((left, right) =>
      (right.seenAt ?? "").localeCompare(left.seenAt ?? ""),
    )
    .slice(0, 60);

  return NextResponse.json(
    {
      status: articles.length ? "live" : "empty",
      topic,
      searchedAs,
      requestedDate: requestedDay,
      generatedAt: new Date().toISOString(),
      articles,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
      },
    },
  );
}
