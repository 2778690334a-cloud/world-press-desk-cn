import test from "node:test";
import assert from "node:assert/strict";
import {createPublicCache} from "../app/lib/public-cache.ts";
test("public requests share one upstream operation and cache only bounded keys",async()=>{
 let time=100_000,count=0;const cache=createPublicCache(2,1000,4,()=>time);
 const work=async()=>++count;
 assert.deepEqual(await Promise.all([cache("a",work),cache("a",work)]),[1,1]);
 await cache("b",work);await cache("c",work);assert.equal(count,3);
 assert.equal(await cache("a",work),4);
 await assert.rejects(cache("d",work),/budget/);
 time+=60_000;assert.equal(await cache("d",work),5);
});
test("cache expires and failures are not cached as successful data",async()=>{
 let time=100_000;const cache=createPublicCache(2,1000,5,()=>time);
 assert.equal(await cache("a",async()=>1),1);time+=1001;
 assert.equal(await cache("a",async()=>2),2);
 await assert.rejects(cache("x",async()=>{throw Error("source down");}));
 assert.equal(await cache("x",async()=>3),3);
});
