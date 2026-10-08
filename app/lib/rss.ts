import { decodeFeedBytes } from "./feed-encoding.ts";
export type ArticleSource = "rss" | "homepage" | "gdelt";

export type IndexedArticle = {
  title: string;
  url: string;
  domain: string;
  seenAt?: string;
  publishedAt?: string;
  fetchedAt?: string;
  indexedAt?: string;
  snapshotDate?: string;
  localDate?: string;
  language?: string;
  sourceCountry?: string;
  summary?: string;
  sourceType?: ArticleSource;
};

export const SOURCE_TIME_ZONES: Record<string, string> = {
  "news.cn": "Asia/Shanghai",
  "nhk.or.jp": "Asia/Tokyo",
  "nikkei.com": "Asia/Tokyo",
  "bbc.com": "Europe/London",
  "theguardian.com": "Europe/London",
  "lemonde.fr": "Europe/Paris",
  "dw.com": "Europe/Berlin",
  "cnn.com": "America/New_York",
  "nytimes.com": "America/New_York",
  "aljazeera.com": "Asia/Qatar",
  "abc.net.au": "Australia/Sydney",
  "folha.uol.com.br": "America/Sao_Paulo",
};

type RssSource = {
  domain: string;
  country: string;
  language: string;
  url: string;
};

type HomepageSource = {
  domain: string;
  country: string;
  language: string;
  url: string;
  pathPattern: RegExp;
  allowedHosts: string[];
};

const RSS_SOURCES: RssSource[] = [
  {
    domain: "bbc.com",
    country: "United Kingdom",
    language: "English",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
  },
  {
    domain: "theguardian.com",
    country: "United Kingdom",
    language: "English",
    url: "https://www.theguardian.com/world/rss",
  },
  {
    domain: "nytimes.com",
    country: "United States",
    language: "English",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
  },
  {
    domain: "aljazeera.com",
    country: "Qatar",
    language: "English",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
  },
  {
    domain: "nhk.or.jp",
    country: "Japan",
    language: "Japanese",
    url: "https://news.web.nhk/n-data/conf/na/rss/cat0.xml",
  },
  {
    domain: "lemonde.fr",
    country: "France",
    language: "English",
    url: "https://www.lemonde.fr/en/international/rss_full.xml",
  },
  {
    domain: "dw.com",
    country: "Germany",
    language: "English",
    url: "https://rss.dw.com/rdf/rss-en-all",
  },
  {
    domain: "folha.uol.com.br",
    country: "Brazil",
    language: "Português",
    url: "https://feeds.folha.uol.com.br/emcimadahora/rss091.xml",
  },
];

const HOMEPAGE_SOURCES: HomepageSource[] = [
  {
    domain: "news.cn",
    country: "China",
    language: "中文",
    url: "https://www.news.cn/",
    pathPattern: /\/20\d{6}\//i,
    allowedHosts: ["news.cn", "xinhuanet.com"],
  },
  {
    domain: "cnn.com",
    country: "United States",
    language: "English",
    url: "https://edition.cnn.com/world",
    pathPattern: /\/20\d{2}\/\d{2}\/\d{2}\//i,
    allowedHosts: ["cnn.com"],
  },
  {
    domain: "nikkei.com",
    country: "Japan",
    language: "日本語",
    url: "https://www.nikkei.com/",
    pathPattern: /\/article\/[a-z0-9]+/i,
    allowedHosts: ["nikkei.com"],
  },
  {
    domain: "abc.net.au",
    country: "Australia",
    language: "English",
    url: "https://www.abc.net.au/news/",
    pathPattern: /\/news\/20\d{2}-\d{2}-\d{2}\//i,
    allowedHosts: ["abc.net.au"],
  },
];

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function stripMarkup(value: string) {
  return decodeXml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tagValue(block: string, names: string[]) {
  for (const name of names) {
    const escaped = name.replace(":", "\\:");
    const match = block.match(
      new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"),
    );
    if (match?.[1]) return match[1];
  }
  return "";
}

function entryLink(block: string) {
  const textLink = stripMarkup(tagValue(block, ["link"]));
  if (textLink.startsWith("http")) return textLink;

  const atomLink = block.match(
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i,
  );
  return atomLink?.[1] ? decodeXml(atomLink[1]) : "";
}

function normaliseDate(value: string) {
  if (!value) return undefined;
  const parsed = new Date(stripMarkup(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function dateParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function currentDeskDate(now = new Date()) {
  return dateParts(now, "Asia/Shanghai");
}

export function articleMatchesDate(
  article: IndexedArticle,
  requestedDate: string,
) {
  // Saved records belong to their collection day, never a reconstructed date.
  if (article.snapshotDate) return article.snapshotDate === requestedDate;
  const value = article.sourceType === "homepage"
    ? article.fetchedAt ?? article.seenAt
    : article.publishedAt ?? article.indexedAt ?? article.seenAt;
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  if (article.sourceType === "homepage" && article.localDate && article.localDate !== requestedDate) return false;
  return requestedDate === currentDeskDate(parsed);
}

export function broadUtcRange(requestedDate: string) {
  const anchor = new Date(`${requestedDate}T00:00:00.000Z`);
  const start = new Date(anchor);
  start.setUTCHours(start.getUTCHours() - 14);
  const end = new Date(anchor);
  end.setUTCHours(end.getUTCHours() + 38);
  return { start, end };
}

export function parseFeed(
  xml: string,
  source: RssSource,
): IndexedArticle[] {
  const blocks =
    xml.match(/<item\b[\s\S]*?<\/item>/gi) ??
    xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ??
    [];

  const articles: IndexedArticle[] = [];
  for (const block of blocks) {
    const title = stripMarkup(tagValue(block, ["title"]));
    const url = entryLink(block);
    const rawSummary = tagValue(block, [
      "description",
      "summary",
      "content:encoded",
      "content",
    ]);
    const summary = stripMarkup(rawSummary);
    const seenAt = normaliseDate(
      tagValue(block, ["pubDate", "published", "dc:date"]),
    );

    if (!title || !url) continue;
    articles.push({
      title,
      url,
      domain: source.domain,
      seenAt,
      publishedAt: seenAt,
      language: source.language,
      sourceCountry: source.country,
      summary: summary ? summary.slice(0, 360) : undefined,
      sourceType: "rss",
    });
  }
  return articles;
}

async function fetchFeed(source: RssSource) {
  try {
    const response = await fetch(source.url, {
      headers: {
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
        "User-Agent": "WorldPressDesk/1.1 (public RSS reader)",
      },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseFeed(decodeFeedBytes(await response.arrayBuffer(), response.headers.get("content-type") ?? ""), source).map(article => ({ ...article, fetchedAt: new Date().toISOString() }));
  } catch (error) {
    console.warn("RSS unavailable", source.domain, error instanceof Error ? error.message : "fetch failed");
    throw error;
  }
}

function hostnameAllowed(hostname: string, allowedHosts: string[]) {
  const normalized = hostname.toLowerCase().replace(/^www\./, "");
  return allowedHosts.some(
    (host) => normalized === host || normalized.endsWith(`.${host}`),
  );
}

function isLikelyHeadline(title: string) {
  if (title.length < 8 || title.length > 180) return false;
  if (/function\s|class=|image__|onerror|javascript:/i.test(title)) return false;
  if (
    /^(terms|privacy|sign in|log in|subscribe|menu|home|トップ|速報|一覧)/i.test(
      title,
    )
  ) {
    return false;
  }
  const wordCount = title.split(/\s+/).length;
  if (
    wordCount <= 7 &&
    /(Getty Images|NurPhoto|Reuters|Associated Press|\/AP$|\/AFP$)/i.test(title)
  ) {
    return false;
  }
  return true;
}

function normalisePageUrl(value: string, baseUrl: string) {
  try {
    const decoded = decodeXml(value);
    if (/^(?:javascript:|mailto:|#)/i.test(decoded)) return null;
    return new URL(decoded, baseUrl);
  } catch {
    return null;
  }
}

function dateFromUrl(url: string) {
  const compact = url.match(/\/(20\d{2})(\d{2})(\d{2})\//);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const separated = url.match(/\/(20\d{2})\/(\d{2})\/(\d{2})\//);
  if (separated) return `${separated[1]}-${separated[2]}-${separated[3]}`;
  const dashed = url.match(/\/(20\d{2}-\d{2}-\d{2})\//);
  return dashed?.[1];
}

export function parseHomepage(
  html: string,
  source: HomepageSource,
  fetchedAt = new Date(),
) {
  const anchorPattern =
    /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  const articles: IndexedArticle[] = [];
  const seenUrls = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html)) !== null) {
    const parsedUrl = normalisePageUrl(match[2], source.url);
    if (!parsedUrl) continue;
    if (!hostnameAllowed(parsedUrl.hostname, source.allowedHosts)) continue;
    if (!source.pathPattern.test(parsedUrl.pathname)) continue;

    const title = stripMarkup(match[4]);
    if (!isLikelyHeadline(title)) continue;

    const url = parsedUrl.toString();
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    articles.push({
      title,
      url,
      domain: source.domain,
      seenAt: fetchedAt.toISOString(),
      fetchedAt: fetchedAt.toISOString(),
      localDate: dateFromUrl(url),
      language: source.language,
      sourceCountry: source.country,
      sourceType: "homepage",
    });
    if (articles.length >= 40) break;
  }
  return articles;
}

async function fetchHomepage(source: HomepageSource) {
  try {
    const fetchedAt = new Date();
    const response = await fetch(source.url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; WorldPressDesk/1.1; headline metadata reader)",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseHomepage(await response.text(), source, fetchedAt);
  } catch (error) {
    console.warn("Homepage unavailable", source.domain, error instanceof Error ? error.message : "fetch failed");
    throw error;
  }
}

export type SourceResult = { domain: string; status: "ok" | "empty" | "error"; count: number };
export async function fetchPublicArticlesWithStatus() {
  const jobs = [...RSS_SOURCES.map(source => ({ domain: source.domain, run: () => fetchFeed(source) })),
    ...HOMEPAGE_SOURCES.map(source => ({ domain: source.domain, run: () => fetchHomepage(source) }))];
  const results = await Promise.allSettled(jobs.map(job => job.run()));
  const articles: IndexedArticle[] = [];
  const sources: SourceResult[] = results.map((result, index) => {
    if (result.status === "rejected") return { domain: jobs[index].domain, status: "error", count: 0 };
    articles.push(...result.value);
    return { domain: jobs[index].domain, status: result.value.length ? "ok" : "empty", count: result.value.length };
  });
  return { articles, sources };
}
export async function fetchPublicArticles() {
  return (await fetchPublicArticlesWithStatus()).articles;
}
export async function fetchRssArticles() {
  const results = await Promise.allSettled(RSS_SOURCES.map(fetchFeed));
  return results.flatMap(result => result.status === "fulfilled" ? result.value : []);
}
