import test from "node:test";
import assert from "node:assert/strict";
import { isDeskAdmin, sameOriginWrite } from "../app/lib/admin-policy.ts";
test("public and service callers cannot become administrators",()=>{
  const h=new Headers({"OAI-Sites-Authorization":"Bearer untrusted", "oai-authenticated-user-email":"owner@example.com"});
  assert.equal(isDeskAdmin(h,"owner-id"),false);
  assert.equal(isDeskAdmin(h,undefined),false);
  h.set("oai-authenticated-user-id","other-id");assert.equal(isDeskAdmin(h,"owner-id"),false);
  h.set("oai-authenticated-user-id","owner-id");assert.equal(isDeskAdmin(h,"owner-id"),true);
  assert.equal(isDeskAdmin(h,""),false);
});
test("cross-site browser writes are rejected",()=>{
  assert.equal(sameOriginWrite(new Headers({origin:"https://evil.example"}),"https://desk.example"),false);
  assert.equal(sameOriginWrite(new Headers({"sec-fetch-site":"cross-site"}),"https://desk.example"),false);
  assert.equal(sameOriginWrite(new Headers({origin:"https://desk.example"}),"https://desk.example"),true);
  assert.equal(sameOriginWrite(new Headers(),"https://desk.example"),true);
});
import {boundedRequestText} from "../app/lib/request-limits.ts";
test("body limits apply to actual streamed bytes, not only declared length",async()=>{
  assert.equal(await boundedRequestText(new Request("https://x",{method:"POST",body:"hello"}),5),"hello");
  assert.equal(await boundedRequestText(new Request("https://x",{method:"POST",body:"hello"}),4),null);
  assert.equal(await boundedRequestText(new Request("https://x",{method:"POST",body:"世界"}),5),null);
});
