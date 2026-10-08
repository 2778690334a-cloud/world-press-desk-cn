import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { saveArchive, readArchive, archiveRecord, type ArchiveDatabase } from "../app/lib/archive-store.ts";
import { articleMatchesDate, parseFeed, parseHomepage, currentDeskDate } from "../app/lib/rss.ts";
import { requestedDay } from "../app/lib/headline-index.ts";
const date="2026-10-08", now=new Date("2026-10-08T12:00:00Z");
function database() {
 const sqlite=new DatabaseSync(":memory:");
 sqlite.exec(readFileSync(new URL("../drizzle/0000_opposite_taskmaster.sql",import.meta.url),"utf8"));
 const db: ArchiveDatabase={prepare(sql) {
   let values:(string|number|null)[]=[];
   const statement={bind(...args:(string|number|null)[]){values=args;return statement;},
     async all<T>(){return {results:sqlite.prepare(sql).all(...values) as T[]};},
     run(){sqlite.prepare(sql).run(...values);}};
   return statement;
 },async batch(statements){sqlite.exec("BEGIN");try{for(const s of statements)(s as unknown as {run():void}).run();sqlite.exec("COMMIT");}catch(e){sqlite.exec("ROLLBACK");throw e;}}};
 return {db,sqlite};
}
const article={title:"A real headline",url:"https://www.bbc.com/news/test?utm_source=rss",domain:"bbc.com",sourceType:"rss" as const, publishedAt:"2026-10-08T10:00:00Z",summary:"must not be stored"};
test("archives survive a fresh read; retries are idempotent and no article body is stored",async()=>{
 const {db,sqlite}=database();
 await saveArchive(db,date,[article],{},"ok",now);
 await saveArchive(db,date,[{...article,url:"https://www.bbc.com/news/test"}],{},"ok",now);
 const result=await readArchive(db,date);
 assert.equal(result.archivedCount,1);assert.equal(result.articles[0].title,article.title);
 assert.equal(result.articles[0].summary,undefined);assert.equal(result.articles[0].snapshotDate,date);
 assert.equal(result.articles[0].publishedAt,new Date(article.publishedAt).toISOString());
 assert.equal((sqlite.prepare("SELECT COUNT(*) AS n FROM news_links").get() as {n:number}).n,1);
 sqlite.close();
});
test("source failure keeps previously collected records; empty day is not fabricated",async()=>{
 const {db,sqlite}=database();await saveArchive(db,date,[article],{},"ok",now);
 const result=await saveArchive(db,date,[],{error:true},"incomplete",now);
 assert.equal(result.archivedCount,1);assert.equal(result.collection?.status,"incomplete");
 assert.equal((await readArchive(db,"2026-10-07")).status,"not-collected");
 await assert.rejects(()=>saveArchive(db,"2026-10-07",[article],{},"ok",now));sqlite.close();
});
test("database failure is propagated rather than reported as saved",async()=>{
 const {db,sqlite}=database();db.batch=async()=>{throw new Error("quota unavailable");};
 await assert.rejects(()=>saveArchive(db,date,[article],{},"ok",now),/quota/);sqlite.close();
});
test("date matching uses Beijing boundary and never invents publication time",()=>{
 assert.equal(currentDeskDate(new Date("2026-10-07T16:00:00Z")),date);
 assert.equal(articleMatchesDate({...article,seenAt:"2026-10-07T23:30:00Z",publishedAt:"2026-10-07T23:30:00Z"},date),true);
 assert.equal(articleMatchesDate({...article,publishedAt:"2026-10-07T23:30:00Z"},"2026-10-07"),false);
 assert.equal(articleMatchesDate({title:"no date",url:article.url,domain:article.domain},date),false);
 assert.equal(articleMatchesDate({...article,sourceType:"homepage",publishedAt:undefined,fetchedAt:now.toISOString(),localDate:"2026-10-07"},date),false);
 const homepage=archiveRecord({...article,sourceType:"homepage",publishedAt:undefined,seenAt:now.toISOString()},date,now.toISOString());
 assert.equal(homepage.publishedAt,null);
 const gdelt=archiveRecord({...article,sourceType:"gdelt",publishedAt:undefined,seenAt:now.toISOString()},date,now.toISOString());
 assert.equal(gdelt.publishedAt,null);assert.equal(gdelt.indexedAt,now.toISOString());
 assert.throws(()=>requestedDay("2026-02-30"));assert.throws(()=>requestedDay("bad"));
});
test("RSS publication and homepage observation stay distinct",()=>{
 const rss=parseFeed('<rss><item><title>Test headline</title><link>https://bbc.com/news/a</link><pubDate>Thu, 08 Oct 2026 10:00:00 GMT</pubDate></item></rss>',{domain:"bbc.com",country:"UK",language:"English",url:"https://feeds.bbci.co.uk"});
 assert.equal(rss[0].publishedAt,"2026-10-08T10:00:00.000Z");
 const page=parseHomepage('<a href="https://cnn.com/2026/10/08/test">Long enough title</a>',{domain:"cnn.com",country:"US",language:"English",url:"https://cnn.com",pathPattern:/\/2026\//,allowedHosts:["cnn.com"]},now);
 assert.equal(page[0].publishedAt,undefined);assert.equal(page[0].fetchedAt,now.toISOString());
});

test("Atom updated alone is not treated as publication",()=>{
 const [article]=parseFeed('<feed><entry><title>Updated only item</title><link href="https://bbc.com/test"/><updated>2026-10-08T10:00:00Z</updated></entry></feed>',{domain:"bbc.com",country:"UK",language:"English",url:"https://feeds.bbci.co.uk"});
 assert.equal(article.publishedAt,undefined);assert.equal(articleMatchesDate(article,date),false);
});
