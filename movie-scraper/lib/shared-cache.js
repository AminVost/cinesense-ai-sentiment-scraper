import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
let pool;
export function databaseEnabled(){return Boolean(process.env.CINESENSE_DATABASE_URL?.trim());}
export function getDatabase(){
  if(!databaseEnabled())throw Error("CINESENSE_DATABASE_URL has not been configured.");
  if(!pool){
    const parsed=new URL(process.env.CINESENSE_DATABASE_URL);
    if(!["mysql:","mysqls:"].includes(parsed.protocol))throw Error("Expected a MySQL connection URL.");
    const tls=process.env.CINESENSE_DB_SSL === "true";
    pool=mysql.createPool({
      host:parsed.hostname,port:Number(parsed.port)||3306,
      user:decodeURIComponent(parsed.username),
      password:decodeURIComponent(parsed.password),
      database:decodeURIComponent(parsed.pathname.slice(1)),
      waitForConnections:true,connectionLimit:3,queueLimit:10,
      connectTimeout:7500,enableKeepAlive:true,
      ...(tls?{ssl:{minVersion:"TLSv1.2"}}:{})
    });
  }
  return pool;
}
const validSources=new Set(["tmdb","youtube","digimoviez"]);
function validate(id,source){
  if(!Number.isSafeInteger(Number(id))||Number(id)<1||Number(id)>1e9||!validSources.has(source))
    throw Error("Invalid movie/source cache key.");
}
function deserialize(record){
  if(!record)return null;
  const payload=typeof record.payload==="string"?JSON.parse(record.payload):record.payload;
  return {payload,cachedCount:Number(record.cached_count),fetchedAt:new Date(record.fetched_at).toISOString(),
    fresh:new Date(record.expires_at).getTime()>Date.now()};
}
export async function getCachedSource(tmdbId,source,maxComments){
  validate(tmdbId,source);
  if(!databaseEnabled())return null;
  const [rows]=await getDatabase().execute(
    "SELECT payload,cached_count,fetched_at,expires_at FROM cs_review_cache WHERE tmdb_id=? AND source=?",
    [Number(tmdbId),source]);
  const entry=deserialize(rows[0]);
  // Empty results and fully fetched short lists remain valid for larger requests.
  if(!entry?.fresh)return null;
  if(entry.cachedCount>=maxComments || !entry.payload.hasMore)return entry;
  return null;
}
export async function saveCachedSource(tmdbId,source,result){
  validate(tmdbId,source);
  const payload=JSON.stringify(result);
  // Bound persisted external content and keep the shared database predictable.
  if(Buffer.byteLength(payload)>1024*1024)return;
  await getDatabase().execute(
    `INSERT INTO cs_review_cache(tmdb_id,source,payload,cached_count,fetched_at,expires_at)
     VALUES(?,?,?, ?,UTC_TIMESTAMP(3),DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 20 DAY))
     ON DUPLICATE KEY UPDATE payload=VALUES(payload),cached_count=VALUES(cached_count),
     fetched_at=VALUES(fetched_at),expires_at=VALUES(expires_at)`,
    [Number(tmdbId),source,payload,result.comments?.length||0]);
}
export async function acquireFetchLease(tmdbId,source){
  validate(tmdbId,source);
  const holder=randomUUID();
  const [result]=await getDatabase().execute(
    `INSERT INTO cs_fetch_leases(tmdb_id,source,holder,expires_at)
     VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 55 SECOND))
     ON DUPLICATE KEY UPDATE
       holder=IF(expires_at<UTC_TIMESTAMP(3),VALUES(holder),holder),
       expires_at=IF(expires_at<UTC_TIMESTAMP(3),VALUES(expires_at),expires_at)`,
    [Number(tmdbId),source,holder]);
  const [rows]=await getDatabase().execute(
    "SELECT holder FROM cs_fetch_leases WHERE tmdb_id=? AND source=?",[Number(tmdbId),source]);
  return rows[0]?.holder===holder?holder:null;
}
export async function releaseFetchLease(tmdbId,source,holder){
  if(holder)await getDatabase().execute(
    "DELETE FROM cs_fetch_leases WHERE tmdb_id=? AND source=? AND holder=?",
    [Number(tmdbId),source,holder]);
}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
/** Distributed single-flight around the external fetch. No overlapping crawler starts. */
export async function withSharedSourceCache(tmdbId,source,maxComments,fetcher){
  if(!databaseEnabled())return {...await fetcher(),cacheStatus:"disabled"};
  const cached=await getCachedSource(tmdbId,source,maxComments);
  if(cached)return {...cached.payload,comments:cached.payload.comments.slice(0,maxComments),
    cacheStatus:"hit",lastFetchedAt:cached.fetchedAt};
  let holder=null;
  for(let attempt=0;attempt<8;attempt++){
    holder=await acquireFetchLease(tmdbId,source);
    if(holder)break;
    await wait(600+attempt*150);
    const recovered=await getCachedSource(tmdbId,source,maxComments);
    if(recovered)return {...recovered.payload,comments:recovered.payload.comments.slice(0,maxComments),
      cacheStatus:"hit",lastFetchedAt:recovered.fetchedAt};
  }
  if(!holder){
    const error=Error("Another request is fetching this film. Please retry shortly.");
    error.status=503;throw error;
  }
  try{
    const last=await getCachedSource(tmdbId,source,maxComments);
    if(last)return {...last.payload,comments:last.payload.comments.slice(0,maxComments),cacheStatus:"hit"};
    const result=await fetcher();
    await saveCachedSource(tmdbId,source,result);
    return {...result,cacheStatus:"miss",lastFetchedAt:new Date().toISOString()};
  }finally{await releaseFetchLease(tmdbId,source,holder);}
}
