import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

export const newsLinks = sqliteTable("news_links", {
  snapshotDate: text("snapshot_date").notNull(),
  url: text("url").notNull(),
  title: text("title").notNull(),
  domain: text("domain").notNull(),
  publishedAt: text("published_at"),
  fetchedAt: text("fetched_at").notNull(),
  indexedAt: text("indexed_at"),
  sourceType: text("source_type").notNull(),
}, table => [
  primaryKey({ columns: [table.snapshotDate, table.url] }),
  index("idx_news_links_date_domain").on(table.snapshotDate, table.domain),
]);

export const collectionRuns = sqliteTable("collection_runs", {
  snapshotDate: text("snapshot_date").primaryKey(),
  attemptedAt: text("attempted_at").notNull(),
  status: text("status").notNull(),
  articleCount: integer("article_count").notNull(),
  sourcesJson: text("sources_json").notNull(),
});
