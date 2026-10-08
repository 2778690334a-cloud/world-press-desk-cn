import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {logicalMediaDomain,mediaQueryDomains} from "../app/lib/media-domains.ts";
import {parseFeed,articleMatchesDate} from "../app/lib/rss.ts";
import {isArchivableMediaUrl,archiveTodayLookupUrl,archiveLookupPath} from "../app/lib/wayback.ts";
test("NHK uses the new subscription URL with the old logical identity",()=>{
 const source=readFileSync(new URL("../app/lib/rss.ts",import.meta.url),"utf8");
 assert.match(source,/https:\/\/news\.web\.nhk\/n-data\/conf\/na\/rss\/cat0\.xml/);
 assert.doesNotMatch(source,/www3\.nhk\.or\.jp\/rss\/news\/cat0\.xml/);
 assert.equal(logicalMediaDomain("news.web.nhk"),"nhk.or.jp");
 assert.equal(logicalMediaDomain("www3.nhk.or.jp"),"www3.nhk.or.jp");
 assert.equal(logicalMediaDomain("news.web.nhk.evil.example"),"news.web.nhk.evil.example");
 assert.deepEqual(mediaQueryDomains(["bbc.com","nhk.or.jp"]),["bbc.com","nhk.or.jp","news.web.nhk"]);
});
test("new NHK article URLs keep the NHK card identity and Beijing date filtering",()=>{
 const url="https://news.web.nhk/news/example";
 const [article]=parseFeed(`<rss><item><title>日本のニュース テスト</title><link>${url}</link><pubDate>Thu, 08 Oct 2026 08:00:00 GMT</pubDate></item></rss>`,{domain:"nhk.or.jp",country:"Japan",language:"Japanese",url:"https://news.web.nhk/n-data/conf/na/rss/cat0.xml"});
 assert.equal(article.domain,"nhk.or.jp");assert.equal(article.url,url);
 assert.equal(articleMatchesDate(article,"2026-10-08"),true);
 assert.equal(articleMatchesDate(article,"2026-10-07"),false);
 assert.equal(isArchivableMediaUrl(url),true);
 assert.equal(new URL(archiveLookupPath(url,"2026-10-08"),"https://local.test").searchParams.get("url"),url);
 assert.equal(decodeURIComponent(new URL(archiveTodayLookupUrl(url)).pathname.slice(1)),url);
 assert.equal(isArchivableMediaUrl("https://news.web.nhk.evil.example/news"),false);
});
