CREATE TABLE `collection_runs` (
	`snapshot_date` text PRIMARY KEY NOT NULL,
	`attempted_at` text NOT NULL,
	`status` text NOT NULL,
	`article_count` integer NOT NULL,
	`sources_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `news_links` (
	`snapshot_date` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`domain` text NOT NULL,
	`published_at` text,
	`fetched_at` text NOT NULL,
	`indexed_at` text,
	`source_type` text NOT NULL,
	PRIMARY KEY(`snapshot_date`, `url`)
);
--> statement-breakpoint
CREATE INDEX `idx_news_links_date_domain` ON `news_links` (`snapshot_date`,`domain`);