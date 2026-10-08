import { currentDeskDate, type IndexedArticle } from "./rss.ts";

// A narrow prepared-statement interface also allows real SQLite regression tests.
export interface ArchiveStatement {
  bind(...values: (string | number | null)[]): ArchiveStatement;
  all<T>(): Promise<{ results: T[] }>;
}
export interface ArchiveDatabase {
  prepare(sql: string): ArchiveStatement;
  batch(statements: ArchiveStatement[]): Promise<unknown>;
}
export function canonicalUrl(value: string) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error("Invalid article URL");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
}
export function archiveRecord(article: IndexedArticle, date: string, fetchedAt: string) {
  const published = article.publishedAt ?? (article.sourceType === "rss" ? article.seenAt : undefined);
  return {
    snapshotDate: date, url: canonicalUrl(article.url), title: article.title.slice(0, 1000), domain: article.domain,
    publishedAt: published && !Number.isNaN(Date.parse(published)) ? new Date(published).toISOString() : null,
    fetchedAt: article.fetchedAt ?? fetchedAt,
    indexedAt: article.indexedAt ?? (article.sourceType === "gdelt" ? article.seenAt : undefined) ?? null,
    sourceType: article.sourceType ?? "rss",
  };
}
export async function saveArchive(db: ArchiveDatabase, date: string, articles: IndexedArticle[], sources: unknown, status: string, now = new Date()) {
  if (date !== currentDeskDate(now)) throw new Error("Only the current collection day may be saved");
  const fetchedAt = now.toISOString();
  const records = new Map<string, ReturnType<typeof archiveRecord>>();
  for (const article of articles) {
    try { const row = archiveRecord(article, date, fetchedAt); records.set(row.url, row); }
    catch { console.warn("Skipped invalid archive URL", article.domain); }
  }
  const statements = [...records.values()].map(row => db.prepare(
    `INSERT INTO news_links (snapshot_date,url,title,domain,published_at,fetched_at,indexed_at,source_type)
     VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(snapshot_date,url) DO UPDATE SET
     title=excluded.title,published_at=COALESCE(excluded.published_at,news_links.published_at)`
  ).bind(row.snapshotDate,row.url,row.title,row.domain,row.publishedAt,row.fetchedAt,row.indexedAt,row.sourceType));
  statements.push(db.prepare(
    `INSERT INTO collection_runs(snapshot_date,attempted_at,status,article_count,sources_json) VALUES(?,?,?,?,?)
     ON CONFLICT(snapshot_date) DO UPDATE SET attempted_at=excluded.attempted_at,status=excluded.status,
     article_count=excluded.article_count,sources_json=excluded.sources_json`
  ).bind(date,fetchedAt,status,records.size,JSON.stringify(sources)));
  // D1 batch is transactional. A failed write must not claim successful storage.
  await db.batch(statements);
  return readArchive(db, date);
}
export async function readArchive(db: ArchiveDatabase, date: string) {
  const [data,runs] = await Promise.all([
    db.prepare(`SELECT snapshot_date AS snapshotDate,url,title,domain,published_at AS publishedAt,
      fetched_at AS fetchedAt,indexed_at AS indexedAt,source_type AS sourceType
      FROM news_links WHERE snapshot_date=? ORDER BY domain,published_at DESC,url`).bind(date).all<IndexedArticle>(),
    db.prepare(`SELECT attempted_at AS attemptedAt,status,article_count AS articleCount,sources_json AS sourcesJson
      FROM collection_runs WHERE snapshot_date=?`).bind(date).all<{attemptedAt:string;status:string;articleCount:number;sourcesJson:string}>(),
  ]);
  const run = runs.results[0];
  return {
    requestedDate: date,
    articles: data.results.map(article => ({...article, seenAt: article.publishedAt ?? article.indexedAt ?? article.fetchedAt})),
    archivedCount: data.results.length,
    collection: run ? {...run, sources: JSON.parse(run.sourcesJson), sourcesJson: undefined} : null,
    generatedAt: run?.attemptedAt ?? null,
    status: data.results.length ? "archived" : run ? run.status : "not-collected",
  };
}
