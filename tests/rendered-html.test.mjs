import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
test("news UI has truthful comparison and cancels outdated requests", async () => {
 const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
 assert.doesNotMatch(page,/82%|全球经济与供应链调整/);
 assert.match(page,/controller.signal.aborted/);
 assert.match(page,/syncController.current\?\.abort/);
 assert.match(page,/收录今天/);
 assert.match(page,/不保证都是当天发布/);
});
