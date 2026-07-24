import { NextRequest, NextResponse } from "next/server";
import {
  articleMatchesDate,
  broadUtcRange,
  currentDeskDate,
  fetchPublicArticles,
  type IndexedArticle,
} from "../../lib/rss";

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
    "中东",
    "以色列",
    "加沙",
    "伊朗",
    "巴勒斯坦",
    "黎巴嫩",
    "叙利亚",
  ],
  "artificial intelligence": [
    "artificial intelligence",
    "openai",
    "machine learning",
    " ai ",
    "人工智能",
    "生成式",
    "大模型",
  ],
  "supply chain": [
    "supply chain",
    "shipping",
    "manufacturing",
    "logistics",
    "供应链",
    "物流",
    "制造业",
  ],
  ukraine: ["ukraine", "russia", "kyiv", "moscow", "乌克兰", "俄罗斯", "俄乌"],
  "climate change": [
    "climate",
    "global warming",
    "emissions",
    "气候",
    "全球变暖",
    "排放",
  ],
  climate: ["climate", "warming", "emissions", "weather", "气候", "天气"],
  economy: [
    "economy",
    "economic",
    "inflation",
    "growth",
    "interest rate",
    "经济",
    "通胀",
    "增长",
    "利率",
  ],
  "global economy": [
    "economy",
    "economic",
    "inflation",
    "growth",
    "interest rate",
    "全球经济",
    "通胀",
    "增长",
  ],
  energy: [
    "energy",
    "oil",
    "gas",
    "electricity",
    "renewable",
    "能源",
    "石油",
    "天然气",
    "电力",
  ],
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

function normalizeGdeltDate(value?: string) {
  if (!value) return undefined;
  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/,
  );
  return match
    ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`
    : value;
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

function matchesTopic(
  article: IndexedArticle,
  topic: string,
  searchedAs: string,
) {
  const normalizedTopic = searchedAs.toLowerCase();
  const keywords = [
    topic.toLowerCase(),
    ...(TOPIC_KEYWORDS[normalizedTopic] ?? [normalizedTopic]),
  ].filter(Boolean);
  const haystack = ` ${article.title} ${article.summary ?? ""} `.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

async function searchGdelt(
  topic: string,
  requestedDate: string,
): Promise<IndexedArticle[]> {
  const { start, end } = broadUtcRange(requestedDate);
  const domainBlock = SOURCE_DOMAINS.map(
    (domain) => `domain:${domain}`,
  ).join(" OR ");
  const params = new URLSearchParams({
    query: `${safeQueryTerm(topic)} (${domainBlock})`,
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
    if (!response.ok) return [];
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) return [];
    const payload = (await response.json()) as { articles?: GdeltArticle[] };

    return (payload.articles ?? [])
      .filter((article) => article.title && article.url && article.domain)
      .map((article): IndexedArticle | null => {
        const domain = canonicalDomain(article.domain!);
        return domain
          ? {
              title: article.title!.trim(),
              url: article.url!,
              domain,
              seenAt: normalizeGdeltDate(article.seendate),
              language: article.language,
              sourceCountry: article.sourcecountry,
              sourceType: "gdelt",
            }
          : null;
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

export async function GET(request: NextRequest) {
  const topic = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (topic.length < 2 || topic.length > 80) {
    return NextResponse.json(
      { articles: [], message: "请输入 2–80 个字符的议题。" },
      { status: 400 },
    );
  }

  const date = requestedDay(request.nextUrl.searchParams.get("date"));
  const searchedAs = expandTopic(topic);
  const [publicArticles, gdeltArticles] = await Promise.all([
    fetchPublicArticles(),
    searchGdelt(searchedAs, date),
  ]);

  const publicMatches = publicArticles
    .filter((article) => articleMatchesDate(article, date))
    .filter((article) => matchesTopic(article, topic, searchedAs));

  const seen = new Set<string>();
  const articles = [...publicMatches, ...gdeltArticles]
    .filter((article) => {
      if (seen.has(article.url)) return false;
      seen.add(article.url);
      return true;
    })
    .sort((left, right) =>
      (right.seenAt ?? "").localeCompare(left.seenAt ?? ""),
    )
    .slice(0, 80);

  return NextResponse.json(
    {
      status: articles.length ? "live" : "empty",
      topic,
      searchedAs,
      requestedDate: date,
      generatedAt: new Date().toISOString(),
      articles,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    },
  );
}
