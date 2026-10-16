import { canonicalUrl, readArchive, readMediaArchiveRange, type ArchiveDatabase } from "./archive-store.ts";
import { ALLOWED_DOMAINS, requestedDay } from "./headline-index.ts";
import { logicalMediaDomain } from "./media-domains.ts";
import { currentDeskDate, type IndexedArticle } from "./rss.ts";
import { matchTitleTopics } from "./topic-search.ts";

export type HotspotRequest = {
  scope: "world" | "media";
  date: string;
  days: number;
  domain: string | null;
};
export type HotspotDayCount = { date: string; count: number | null };
export type HotspotTopic = {
  id: string;
  label: string;
  count: number;
  mediaCount: number;
  articles: IndexedArticle[];
  dailyCounts: HotspotDayCount[];
};
export type HotspotReport = HotspotRequest & {
  startDate: string;
  endDate: string;
  mode: "live" | "archive";
  classification: "title-keywords";
  topics: HotspotTopic[];
  articleCount: number;
  mediaCount: number;
  dailyArticleCounts: HotspotDayCount[];
  coverage: { datesWithData: string[]; missingDates: string[]; availableDays: number; totalDays: number };
  generatedAt: string | null;
  status: "ready" | "no-topics" | "no-data";
  message: string;
};

function mediaDomain(value: string) {
  const normalized = logicalMediaDomain(value);
  return ALLOWED_DOMAINS.find(domain => normalized === domain || normalized.endsWith(`.${domain}`));
}

export function parseHotspotRequest(params: URLSearchParams): HotspotRequest {
  const date = requestedDay(params.get("date"));
  const rawDomain = params.get("domain");
  const domain = rawDomain === null ? null : mediaDomain(rawDomain);
  if (domain === undefined) throw new Error("Invalid media domain");
  const rawDays = params.get("days") ?? (domain ? "7" : "1");
  if (!(domain ? ["1", "3", "7"] : ["1"]).includes(rawDays)) throw new Error("Invalid period");
  const days = Number(rawDays);
  // Stay inside the four-digit calendar accepted by the archive API.
  if (datesForPeriod(date, days).some(day => !/^\d{4}-\d{2}-\d{2}$/.test(day))) throw new Error("Invalid period");
  return { scope: domain ? "media" : "world", date, days, domain };
}

function datesForPeriod(date: string, days: number) {
  const end = new Date(`${date}T00:00:00Z`).getTime();
  return Array.from({ length: days }, (_, index) =>
    new Date(end - (days - index - 1) * 86400000).toISOString().slice(0, 10));
}

function compareArticles(left: IndexedArticle, right: IndexedArticle) {
  return (right.snapshotDate ?? "").localeCompare(left.snapshotDate ?? "") ||
    (right.publishedAt ?? right.indexedAt ?? right.fetchedAt ?? "").localeCompare(left.publishedAt ?? left.indexedAt ?? left.fetchedAt ?? "") ||
    left.url.localeCompare(right.url) || left.title.localeCompare(right.title);
}

export function buildHotspotReport(
  request: HotspotRequest,
  articles: IndexedArticle[],
  mode: "live" | "archive",
  generatedAt: string | null,
): HotspotReport {
  const dates = datesForPeriod(request.date, request.days);
  const perDay = new Map(dates.map(date => [date, new Set<string>()]));
  const uniqueArticles = new Map<string, IndexedArticle>();
  const grouped = new Map<string, { label: string; articles: Map<string, IndexedArticle>; days: Map<string, Set<string>> }>();
  for (const input of [...articles].sort(compareArticles)) {
    const domain = mediaDomain(input.domain);
    if (!domain || (request.domain && domain !== request.domain)) continue;
    // Archive dates are observation days, independent of original publication dates.
    const date = mode === "live" ? request.date : input.snapshotDate;
    if (!date || !perDay.has(date)) continue;
    let url: string;
    try { url = canonicalUrl(input.url); } catch { continue; }
    const article = { ...input, url, domain };
    perDay.get(date)!.add(url);
    if (!uniqueArticles.has(url)) uniqueArticles.set(url, article);
    for (const concept of matchTitleTopics(article.title)) {
      let topic = grouped.get(concept.id);
      if (!topic) {
        topic = { label: concept.label, articles: new Map(), days: new Map() };
        grouped.set(concept.id, topic);
      }
      if (!topic.articles.has(url)) topic.articles.set(url, article);
      if (!topic.days.has(date)) topic.days.set(date, new Set());
      topic.days.get(date)!.add(url);
    }
  }
  const datesWithData = dates.filter(date => perDay.get(date)!.size > 0);
  const missingDates = dates.filter(date => !perDay.get(date)!.size);
  const topics: HotspotTopic[] = [...grouped].map(([id, topic]) => ({
    id, label: topic.label, count: topic.articles.size,
    mediaCount: new Set([...topic.articles.values()].map(article => article.domain)).size,
    articles: [...topic.articles.values()].sort(compareArticles),
    dailyCounts: dates.map(date => ({ date, count: perDay.get(date)!.size ? topic.days.get(date)?.size ?? 0 : null })),
  })).sort((a, b) => b.count - a.count || b.mediaCount - a.mediaCount || a.id.localeCompare(b.id)).slice(0, 18);
  const status = uniqueArticles.size ? topics.length ? "ready" : "no-topics" : "no-data";
  return {
    ...request, startDate: dates[0], endDate: request.date, mode,
    classification: "title-keywords", topics, articleCount: uniqueArticles.size,
    mediaCount: new Set([...uniqueArticles.values()].map(article => article.domain)).size,
    dailyArticleCounts: dates.map(date => ({ date, count: perDay.get(date)!.size || null })),
    coverage: { datesWithData, missingDates, availableDays: datesWithData.length, totalDays: dates.length },
    generatedAt, status,
    message: status === "no-data" ? "所选日期没有可用新闻记录；缺失日期不表示零报道。" :
      status === "no-topics" ? "已有新闻记录，但标题未匹配当前主题词典。" :
      "按真实标题的多语主题词归类；大小表示期内去重链接数，一篇报道可归入多个主题。每日按当日去重链接计数，跨日重复链接在期内只计一次；缺失日期表示无可用记录。",
  };
}

export async function loadHotspots(
  request: HotspotRequest,
  sources: {
    database: () => ArchiveDatabase;
    collectCurrent: (date: string) => Promise<{ articles: IndexedArticle[] }>;
  },
  now = new Date(),
): Promise<HotspotReport> {
  if (request.scope === "world" && request.date === currentDeskDate(now)) {
    const result = await sources.collectCurrent(request.date);
    return buildHotspotReport(request, result.articles, "live", now.toISOString());
  }
  const dates = datesForPeriod(request.date, request.days);
  const result = request.domain
    ? await readMediaArchiveRange(sources.database(), request.domain, dates[0], request.date)
    : await readArchive(sources.database(), request.date);
  return buildHotspotReport(request, result.articles, "archive", result.generatedAt);
}
