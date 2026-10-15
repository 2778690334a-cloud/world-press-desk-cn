import { cachedPublicSource } from "./public-cache.ts";
import { logicalMediaDomain, mediaQueryDomains } from "./media-domains.ts";
import { articleMatchesDate, broadUtcRange, currentDeskDate, fetchPublicArticlesWithStatus, type IndexedArticle } from "./rss.ts";
export const ALLOWED_DOMAINS = [
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
  const domainBlock = mediaQueryDomains(domains).map((domain) => `domain:${domain}`).join(" OR ");
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
    if (!response.ok) throw new Error(`GDELT HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) throw new Error("GDELT invalid response");

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
          indexedAt: normalizeGdeltDate(article.seendate),
          fetchedAt: new Date().toISOString(),
          language: article.language,
          sourceCountry: article.sourcecountry,
          sourceType: "gdelt",
        };
      })
      .filter((article): article is IndexedArticle => article !== null)
      .filter((article) => articleMatchesDate(article, requestedDate));
  } catch (error) {
    console.warn("GDELT unavailable", error instanceof Error ? error.message : "fetch failed");
    throw error;
  }
}

export function requestedDay(value: string | null) {
  if (value === null) return currentDeskDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Invalid date");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value > currentDeskDate()) throw new Error("Invalid date");
  return value;
}

export function deduplicateAndLimit(
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


async function collectHeadlinesUncached(date: string) {
  const result = await fetchPublicArticlesWithStatus();
  const direct = result.articles.filter(article => articleMatchesDate(article, date));
  const present = new Set(direct.map(article => article.domain));
  const missing = ALLOWED_DOMAINS.filter(domain => !present.has(domain));
  let fallback: IndexedArticle[] = [];
  let gdeltStatus = "not-needed";
  if (missing.length) {
    try { fallback = await fetchGdeltFallback(missing, date); gdeltStatus = "ok"; }
    catch { gdeltStatus = "error"; }
  }
  const articles = deduplicateAndLimit([...direct, ...fallback], date);
  return { articles, sources: result.sources, gdeltStatus };
}

export async function collectHeadlines(date: string) {
  return cachedPublicSource("headlines:"+date,()=>collectHeadlinesUncached(date));
}
