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


// Lookup-only archive.today links and Folha wrapper normalization.
import {archiveTodayLookupUrl, archiveTargetUrl} from "../app/lib/wayback.ts";
test("archive.today uses the official exact-URL lookup path, never submit",()=>{
 const target="https://www.bbc.com/news/story?a=1&b=two#section";
 const link=archiveTodayLookupUrl(target);
 assert.equal(new URL(link).origin,"https://archive.ph");
 assert.equal(decodeURIComponent(new URL(link).pathname.slice(1)),target.split("#")[0]);
 assert.equal(new URL(link).search,"");assert.equal(new URL(link).hash,"");
 assert.doesNotMatch(link,/\/submit|\/save/);
 assert.equal(archiveTodayLookupUrl("javascript:alert(1)"),"https://archive.ph/");
 assert.equal(archiveTodayLookupUrl("https://secret@bbc.com/news"),"https://archive.ph/");
});
test("Folha archive lookups use the actual article without altering stored URL",()=>{
 const target="https://www1.folha.uol.com.br/mundo/2026/10/story.shtml";
 const wrapper=`https://redir.folha.com.br/redir/online/emcimadahora/rss091/*${target}`;
 assert.equal(archiveTargetUrl(wrapper),target);
 assert.equal(new URL(archiveLookupPath(wrapper,"2026-10-08"),"https://local.test").searchParams.get("url"),target);
 assert.equal(decodeURIComponent(new URL(archiveTodayLookupUrl(wrapper)).pathname.slice(1)),target);
 const bad="https://redir.folha.com.br/redir/*https://evil.example/story";
 assert.equal(archiveTargetUrl(bad),bad);assert.equal(archiveTodayLookupUrl(bad),"https://archive.ph/");
});
