import test from "node:test";
import assert from "node:assert/strict";
import { consumeLimit, acquireSlot, requesterKey, resetGuardForTests } from "../lib/request-guard.js";
import { readInput, ApiError } from "../lib/vercel-api.js";

test("shared in-process budget denies excess requests and resets after window", () => {
  resetGuardForTests();
  const first=consumeLimit("unit","caller-a",2,60000,100000);
  const second=consumeLimit("unit","caller-a",2,60000,100001);
  const denied=consumeLimit("unit","caller-a",2,60000,100002);
  assert.equal(first.allowed,true);
  assert.equal(second.allowed,true);
  assert.equal(denied.allowed,false);
  assert.ok(denied.retryAfter>=1 && denied.retryAfter<=60);
  assert.equal(consumeLimit("unit","caller-b",2,60000,100002).allowed,true);
  assert.equal(consumeLimit("unit","caller-a",2,60000,160002).allowed,true);
});
test("a running crawler occupies only one slot; release is idempotent", () => {
  resetGuardForTests();
  const release=acquireSlot("browser-test",1);
  assert.equal(typeof release,"function");
  assert.equal(acquireSlot("browser-test",1),null);
  release();release();
  const again=acquireSlot("browser-test",1);
  assert.equal(typeof again,"function");
  again();
});
test("client identity is hashed, not stored as raw IP or secret", () => {
  const req=new Request("https://example.com",{headers:{"x-vercel-forwarded-for":"192.0.2.12"}});
  const key=requesterKey(req);
  assert.equal(key.length,24);
  assert.ok(!key.includes("192"));
  assert.equal(key,requesterKey(req));
});
test("JSON limit checks actual payload bytes even when Content-Length is absent",async()=>{
  const small=new Request("https://example.com",{method:"POST",body:JSON.stringify({query:"Interstellar"})});
  const payload=await readInput(small);
  assert.equal(payload.query,"Interstellar");
  const oversized=new Request("https://example.com",{method:"POST",body:JSON.stringify({q:"a".repeat(5000)})});
  oversized.headers.delete("content-length");
  await assert.rejects(readInput(oversized),e=>e instanceof ApiError&&e.status===413);
});
test("malformed JSON and JSON arrays are rejected without fetching upstream",async()=>{
  await assert.rejects(readInput(new Request("https://example.com",{method:"POST",body:"{invalid"})),
    e=>e instanceof ApiError&&e.status===400);
  await assert.rejects(readInput(new Request("https://example.com",{method:"POST",body:"[1,2]"})),
    e=>e instanceof ApiError&&e.status===400);
});
test("multi-byte characters are accounted for by UTF-8 byte length",async()=>{
  const oversized=new Request("https://example.com",{method:"POST",body:JSON.stringify({query:"فیلم".repeat(600)})});
  oversized.headers.delete("content-length");
  await assert.rejects(readInput(oversized),e=>e instanceof ApiError&&e.status===413);
});
