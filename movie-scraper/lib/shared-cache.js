import { randomBytes } from "node:crypto";
import { dbReady, sql } from "./db.js";
import {sharedRateLimit} from "./db-rate.js";

const DAY_MS = 86_400_000;
export const CACHE_DAYS = 20;
export const CACHE_TTL_MS = CACHE_DAYS * DAY_MS;
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));

export async function cachedMovieSource(tmdbId, source, maxComments, load) {
  if (!["tmdb","youtube","digimoviez"].includes(source)) throw Error("Unknown movie source");
  if (!Number.isSafeInteger(tmdbId) || tmdbId < 1 || tmdbId > 1_000_000_000) throw Error("Invalid TMDB movie ID");
  if (!Number.isInteger(maxComments) || maxComments < 1 || maxComments > 30) throw Error("Invalid comment count");
  if (!dbReady()) {
    return {data:await load(),cache:{status:"disabled"}};
  }
  async function snapshot() {
    const rows=await sql(
      `SELECT payload_json, fetched_count, fetched_at, expires_at
         FROM cs_source_cache WHERE tmdb_id=? AND source=?
         AND expires_at>UTC_TIMESTAMP(3) LIMIT 1`,
      [tmdbId,source]
    );
    if (!rows.length) return null;
    let data;
    try {data=JSON.parse(rows[0].payload_json);} catch {return null;}
    if (!data || !Array.isArray(data.comments)) return null;
    // A complete source with fewer public comments than requested is still a
    // cache hit. A truncated requested subset has additional saved comments.
    if (Number(rows[0].fetched_count)<maxComments && data.hasMore!==false) return null;
    return {
      data:{...data,comments:data.comments.slice(0,maxComments),
        hasMore:data.comments.length>maxComments||Boolean(data.hasMore)},
      cache:{status:"hit",fetchedAt:new Date(rows[0].fetched_at).toISOString(),
        expiresAt:new Date(rows[0].expires_at).toISOString()}
    };
  }
  let cached;
  try {cached=await snapshot();} catch(e) {
    console.error("[shared-cache] MySQL read unavailable:",e?.code||e?.name);
    // Fail open: current public sources remain usable if MySQL has an outage.
    return {data:await load(),cache:{status:"db_unavailable"}};
  }
  if (cached) return cached;

  const token=randomBytes(32).toString("hex");
  const leaseSeconds=source==="digimoviez"?90:45;
  async function claim() {
    await sql(`INSERT IGNORE INTO cs_refresh_locks (tmdb_id,source,owner_token,expires_at)
               VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? SECOND))`,
      [tmdbId,source,token,leaseSeconds]);
    await sql(`UPDATE cs_refresh_locks SET owner_token=?,expires_at=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? SECOND)
               WHERE tmdb_id=? AND source=? AND expires_at<UTC_TIMESTAMP(3)`,
      [token,leaseSeconds,tmdbId,source]);
    const rows=await sql("SELECT owner_token FROM cs_refresh_locks WHERE tmdb_id=? AND source=? LIMIT 1",[tmdbId,source]);
    return rows[0]?.owner_token===token;
  }
  let acquired=false;
  try {acquired=await claim();} catch(e) {
    console.error("[shared-cache] MySQL lock unavailable:",e?.code||e?.name);
    return {data:await load(),cache:{status:"db_unavailable"}};
  }
  if(!acquired) {
    // Other Vercel instance is fetching the same movie. Never start a parallel crawl.
    for(let retry=0;retry<10;retry++){
      await wait(1000);
      const fresh=await snapshot().catch(()=>null);
      if(fresh)return fresh;
    }
    const busy=new Error("دریافت اطلاعات این فیلم در حال انجام است؛ چند لحظه دیگر امتحان کنید.");
    busy.status=503; busy.publicMessage=true; throw busy;
  }
  try {
    // Another fetch may have won between our initial SELECT and lock acquisition.
    const rechecked=await snapshot();
    if(rechecked)return rechecked;
    const budget=await sharedRateLimit("provider-daily-misses",source,
      source==="youtube"?40:source==="digimoviez"?30:500,86400);
    if(!budget.allowed){const e=new Error("سهمیه دریافت داده جدید این منبع امروز تکمیل شده است.");e.status=429;e.publicMessage=true;throw e;}
    const data=await load();
    if(!data || !Array.isArray(data.comments))throw Error("Source returned an invalid response");
    const time=new Date();
    const until=new Date(time.getTime()+CACHE_TTL_MS);
    const saved={...data,comments:data.comments.slice(0,30)};
    // Cache entries are keyed by movie+source, and a smaller later query
    // must not overwrite a larger, fresher snapshot needlessly.
    await sql(`INSERT INTO cs_source_cache
      (tmdb_id,source,fetched_count,payload_json,fetched_at,expires_at)
      VALUES(?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
      fetched_count=VALUES(fetched_count),
      payload_json=VALUES(payload_json),
      fetched_at=VALUES(fetched_at), expires_at=VALUES(expires_at)`,
      [tmdbId,source,maxComments,JSON.stringify(saved),time,until]
    );
    return {data:{...saved,comments:saved.comments.slice(0,maxComments)},
      cache:{status:"refreshed",fetchedAt:time.toISOString(),expiresAt:until.toISOString()}};
  } catch(e) {
    // Never conceal a source API failure as a fresh cache hit.
    throw e;
  } finally {
    await sql("DELETE FROM cs_refresh_locks WHERE tmdb_id=? AND source=? AND owner_token=?",
      [tmdbId,source,token]).catch(()=>{});
  }
}

export async function purgeExpiredPublicCache() {
  if(!dbReady())return {purged:0};
  const a=await sql("DELETE FROM cs_source_cache WHERE expires_at<UTC_TIMESTAMP(3)");
  const b=await sql("DELETE FROM cs_refresh_locks WHERE expires_at<UTC_TIMESTAMP(3)");
  return {purged:(a.affectedRows||0)+(b.affectedRows||0)};
}
