// Runs only in the separate MySQL GitHub Actions service job.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {database,sql} from "../lib/db.js";
import {cachedMovieSource,CACHE_DAYS} from "../lib/shared-cache.js";
import {sharedRateLimit} from "../lib/db-rate.js";
import {passwordHash,passwordVerify,createSession,currentUser,validateEmail} from "../lib/auth.js";

if(!process.env.DATABASE_URL)throw Error("DATABASE_URL is required for real DB integration tests");
await database().query(readFileSync(new URL("../db/schema.sql",import.meta.url),"utf8"));

test("MySQL source cache reuses film data between independent users",async()=>{
  let upstream=0;
  const load=async()=>{upstream++;return{source:"tmdb",category:"film",comments:[
    {id:"a",text:"Movie A",source:"tmdb"},{id:"b",text:"Movie B",source:"tmdb"}],hasMore:false};};
  const first=await cachedMovieSource(157336,"tmdb",2,load);
  const second=await cachedMovieSource(157336,"tmdb",2,load);
  assert.equal(first.cache.status,"refreshed");
  assert.equal(second.cache.status,"hit");
  assert.equal(upstream,1);
  assert.equal(CACHE_DAYS,20);
  const expiry=Date.parse(second.cache.expiresAt)-Date.parse(second.cache.fetchedAt);
  assert.ok(expiry>=19.99*86400000 && expiry<=20.01*86400000);
});

test("20-day cache automatically refreshes when expired",async()=>{
  await sql("UPDATE cs_source_cache SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE tmdb_id=? AND source=?",[157336,"tmdb"]);
  let calls=0;
  const result=await cachedMovieSource(157336,"tmdb",2,async()=>{
    calls++;return{source:"tmdb",category:"film",comments:[{id:"fresh",text:"new data"}],hasMore:false};
  });
  assert.equal(result.cache.status,"refreshed");
  assert.equal(result.data.comments[0].id,"fresh");
  assert.equal(calls,1);
});
test("same film+source concurrent requests only perform one upstream fetch",async()=>{
  let calls=0;
  const loader=async()=>{
    calls++;await new Promise(resolve=>setTimeout(resolve,1100));
    return {source:"youtube",category:"trailer",comments:[{id:"vid1",text:"nice"}],hasMore:false};
  };
  const a=cachedMovieSource(157336,"youtube",1,loader);
  await new Promise(resolve=>setTimeout(resolve,80));
  const b=cachedMovieSource(157336,"youtube",1,loader);
  const [first,second]=await Promise.all([a,b]);
  assert.equal(calls,1);
  assert.equal(first.data.comments.length,1);
  assert.equal(second.data.comments.length,1);
  assert.equal(second.cache.status,"hit");
});
test("different comment page sizes trigger a new upstream request when necessary",async()=>{
  let calls=0;
  const loader=async()=>{calls++;return {source:"tmdb",category:"film",comments:Array.from({length:10},(_,i)=>({id:String(i),text:"Review "+i})),hasMore:false};};
  await cachedMovieSource(991227,"tmdb",5,loader);
  await cachedMovieSource(991227,"tmdb",10,loader);
  const sliced=await cachedMovieSource(991227,"tmdb",3,loader);
  assert.equal(calls,2);
  assert.equal(sliced.data.comments.length,3);
});
test("global MySQL rate limiter counts across requests",async()=>{
  const id="test-user-once";
  assert.equal((await sharedRateLimit("test-auth",id,2,60)).allowed,true);
  assert.equal((await sharedRateLimit("test-auth",id,2,60)).allowed,true);
  assert.equal((await sharedRateLimit("test-auth",id,2,60)).allowed,false);
});
test("verified user sessions use opaque httpOnly cookies; password hashes are not plain text",async()=>{
  const email="test+"+Date.now()+"@example.org";
  assert.ok(validateEmail(email));
  const hashed=await passwordHash("sufficiently-long-secret");
  assert.ok(hashed.startsWith("scrypt:"));
  assert.ok(await passwordVerify("sufficiently-long-secret",hashed));
  assert.equal(await passwordVerify("incorrect-secret",hashed),false);
  const u=await sql("INSERT INTO cs_users(email,password_hash,verified_at) VALUES(?,?,UTC_TIMESTAMP(3))",[email,hashed]);
  const cookie=await createSession(u.insertId);
  assert.match(cookie,/HttpOnly/);
  const req=new Request("http://localhost:3000/api/auth/me",{headers:{cookie:cookie.split(";")[0]}});
  const user=await currentUser(req);
  assert.equal(user.email,email);
  await sql("DELETE FROM cs_users WHERE id=?",[u.insertId]);
  assert.equal(await currentUser(req),null);
});
test("MySQL cleanup of expired source cache is safe",async()=>{
  const {purgeExpiredPublicCache}=await import("../lib/shared-cache.js");
  const result=await purgeExpiredPublicCache();
  assert.ok(result.purged>=0);
});

test.after(async()=>{await database().end();});
