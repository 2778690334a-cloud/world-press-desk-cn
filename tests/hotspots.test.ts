import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { buildHotspotReport, loadHotspots, parseHotspotRequest } from "../app/lib/hotspots.ts";
import type { ArchiveDatabase } from "../app/lib/archive-store.ts";
import type { IndexedArticle } from "../app/lib/rss.ts";

const date = "2026-10-08";
const now = new Date(`${date}T12:00:00Z`);
const request = (query = "") => parseHotspotRequest(new URLSearchParams(`date=${date}&${query}`));
function article(title: string, path: string, domain = "bbc.com", snapshotDate = date): IndexedArticle {
  return { title, url: `https://${domain}/${path}`, domain, snapshotDate,
    sourceType: "rss", fetchedAt: `${snapshotDate}T12:00:00Z`, publishedAt: `${snapshotDate}T10:00:00Z` };
}
function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../drizzle/0000_opposite_taskmaster.sql", import.meta.url), "utf8"));
  const queries: { sql: string; values: (string | number | null)[] }[] = [];
  const db: ArchiveDatabase = {
    prepare(sql) {
      const query = { sql, values: [] as (string | number | null)[] };
      queries.push(query);
      const statement = { bind(...values: (string | number | null)[]) { query.values = values; return statement; },
        async all<T>() { return { results: sqlite.prepare(sql).all(...query.values) as T[] }; } };
      return statement;
    },
    async batch() { throw new Error("Reads must never write or backfill"); },
  };
  function insert(value: IndexedArticle) {
    sqlite.prepare("INSERT INTO news_links(snapshot_date,url,title,domain,published_at,fetched_at,source_type) VALUES(?,?,?,?,?,?,?)")
      .run(value.snapshotDate!, value.url, value.title, value.domain, value.publishedAt!, value.fetchedAt!, value.sourceType!);
  }
  return { db, sqlite, queries, insert };
}

test("groups actual multilingual titles, with one count per link and safe Latin boundaries", () => {
  const result = buildHotspotReport(request(), [
    article("Iran and Iranian officials in Tehran", "one?utm_source=rss"),
    article("Iran and Iranian officials in Tehran", "one"),
    article("イラン情勢をめぐる動き", "jp", "nhk.or.jp"),
    article("Novas negociações com o Irã", "pt", "folha.uol.com.br"),
    article("Officials said the train was delayed", "unrelated"),
    { ...article("Local football results", "summary-only"), summary: "Iran AI nuclear" },
    article("OpenAI announces a new model", "ai"),
  ], "archive", null);
  const iran = result.topics.find(topic => topic.id === "iran")!;
  assert.equal(iran.count, 3);
  assert.equal(iran.mediaCount, 3);
  assert.equal(result.topics.find(topic => topic.id === "artificial-intelligence")?.count, 1);
  assert.equal(result.topics.some(topic => topic.id === "nuclear"), false);
  assert.equal(result.articleCount, 6);
  assert.equal(iran.articles[0].publishedAt, `${date}T10:00:00Z`);
  assert.equal(iran.articles.find(item => item.domain === "bbc.com")?.url, "https://bbc.com/one");
});

test("media period isolates the selected source and deduplicates across dates while retaining daily counts", () => {
  const recent = article("Iran talks resume", "repeat", "news.web.nhk");
  const result = buildHotspotReport(request("domain=nhk.or.jp&days=3"), [
    recent, { ...recent, url: `${recent.url}?utm_campaign=feed`, domain: "nhk.or.jp" },
    { ...recent, snapshotDate: "2026-10-06", fetchedAt: "2026-10-06T12:00:00Z" },
    article("Iran trade talks", "other", "www3.nhk.or.jp", "2026-10-06"),
    article("Iran talks", "foreign", "bbc.com"),
    article("Iran talks", "too-old", "nhk.or.jp", "2026-10-05"),
  ], "archive", null);
  assert.equal(result.articleCount, 2);
  assert.equal(result.mediaCount, 1);
  const iran = result.topics.find(topic => topic.id === "iran")!;
  assert.equal(iran.count, 2);
  assert.equal(iran.articles.find(item => item.url === recent.url)?.snapshotDate, date);
  assert.deepEqual(iran.dailyCounts, [
    { date: "2026-10-06", count: 2 }, { date: "2026-10-07", count: null }, { date, count: 1 },
  ]);
  assert.deepEqual(result.dailyArticleCounts, iran.dailyCounts);
  assert.deepEqual(result.coverage, { datesWithData: ["2026-10-06", date], missingDates: ["2026-10-07"], availableDays: 2, totalDays: 3 });
});

test("zero records and titles outside the dictionary remain distinct honest empty states", () => {
  const empty = buildHotspotReport(request("domain=bbc.com"), [], "archive", null);
  assert.equal(empty.status, "no-data");
  assert.deepEqual(empty.topics, []);
  assert.equal(empty.coverage.missingDates.length, 7);
  assert.ok(empty.dailyArticleCounts.every(day => day.count === null));
  const unmatched = buildHotspotReport(request(), [article("Local football results", "sport")], "archive", null);
  assert.equal(unmatched.status, "no-topics");
  assert.equal(unmatched.articleCount, 1);
  assert.deepEqual(unmatched.topics, []);
});

test("request validation reuses desk calendar, permits bounded media periods and rejects unknown domains", () => {
  assert.equal(request().days, 1);
  assert.equal(request("domain=bbc.com").days, 7);
  assert.equal(request("domain=world.news.web.nhk&days=3").domain, "nhk.or.jp");
  assert.equal(request("domain=www.bbc.com&days=1").domain, "bbc.com");
  for (const query of ["domain=evilbbc.com", "domain=bbc.com.evil", "domain=", "days=7", "domain=bbc.com&days=365", "domain=bbc.com&days=07"]) {
    assert.throws(() => request(query), query);
  }
  for (const invalid of ["2026-02-30", "bad", "2999-01-01"]) {
    assert.throws(() => parseHotspotRequest(new URLSearchParams({ date: invalid })));
  }
});

test("archive loading performs prepared bounded media reads, includes NHK aliases and never fetches history", async () => {
  const { db, sqlite, queries, insert } = database();
  try {
    insert(article("Iran talks", "one", "news.web.nhk", "2026-10-06"));
    insert(article("Iran talks", "two", "www3.nhk.or.jp"));
    insert(article("Iran talks", "foreign", "bbc.com"));
    insert(article("Iran talks", "old", "nhk.or.jp", "2026-09-30"));
    let fetches = 0;
    const sources = { database: () => db, collectCurrent: async () => { fetches++; throw new Error("History must not fetch"); } };
    const result = await loadHotspots(request("domain=nhk.or.jp&days=3"), sources, now);
    assert.equal(result.mode, "archive");
    assert.equal(result.articleCount, 2);
    assert.equal(fetches, 0);
    assert.equal(queries.length, 1);
    assert.match(queries[0].sql, /snapshot_date >= \? AND snapshot_date <= \?/);
    assert.deepEqual(queries[0].values, ["2026-10-06", date, "nhk.or.jp", "%.nhk.or.jp", "news.web.nhk", "%.news.web.nhk"]);
    const past = await loadHotspots(parseHotspotRequest(new URLSearchParams("date=2026-10-05")), sources, now);
    assert.equal(past.status, "no-data");
    assert.equal(fetches, 0);
    const emptyMedia = await loadHotspots(request("domain=cnn.com"), sources, now);
    assert.equal(emptyMedia.status, "no-data");
    assert.equal(emptyMedia.generatedAt, null);
  } finally { sqlite.close(); }
});

test("current world reads current collection without opening or writing the archive; failures propagate", async () => {
  let collectedDate = "";
  const result = await loadHotspots(request(), {
    database() { throw new Error("Current world should not need archive"); },
    async collectCurrent(value) { collectedDate = value; return { articles: [article("Iran talks", "one")] }; },
  }, now);
  assert.equal(collectedDate, date);
  assert.equal(result.mode, "live");
  assert.equal(result.generatedAt, now.toISOString());
  assert.equal(result.topics.find(topic => topic.id === "iran")?.count, 1);
  await assert.rejects(() => loadHotspots(request("domain=bbc.com"), {
    database() { throw new Error("Archive unavailable"); },
    async collectCurrent() { throw new Error("Must not be reached"); },
  }, now), /Archive unavailable/);
});
