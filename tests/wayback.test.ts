import assert from "node:assert/strict";
import test from "node:test";
import {
  archiveLookupPath,
  isArchivableMediaUrl,
  safeWaybackSnapshotUrl,
  waybackFallbackUrl,
  waybackTimestamp,
} from "../app/lib/wayback.ts";

test("accepts collected media URLs and rejects arbitrary redirect targets", () => {
  assert.equal(
    isArchivableMediaUrl("https://edition.cnn.com/2026/07/24/world/story"),
    true,
  );
  assert.equal(
    isArchivableMediaUrl("https://www.news.cn/20260724/example.html"),
    true,
  );
  assert.equal(isArchivableMediaUrl("https://example.com/story"), false);
  assert.equal(isArchivableMediaUrl("javascript:alert(1)"), false);
});

test("builds date-aware Wayback lookup and fallback URLs", () => {
  const target = "https://www.bbc.com/news/articles/example?a=1";
  assert.equal(waybackTimestamp("2026-07-24"), "20260724120000");
  assert.equal(
    waybackFallbackUrl(target, "2026-07-24"),
    `https://web.archive.org/web/20260724120000/${target}`,
  );
  assert.match(archiveLookupPath(target, "2026-07-24"), /^\/api\/archive\?/);
  assert.match(archiveLookupPath(target, "2026-07-24"), /date=2026-07-24/);
});

test("allows only validated Wayback snapshot destinations", () => {
  assert.equal(
    safeWaybackSnapshotUrl(
      "http://web.archive.org/web/20260724115900/https://www.bbc.com/news/test",
    ),
    "https://web.archive.org/web/20260724115900/https://www.bbc.com/news/test",
  );
  assert.equal(
    safeWaybackSnapshotUrl("https://malicious.example/redirect"),
    null,
  );
});

