import {timingSafeEqual} from "node:crypto";
import {dbReady,sql} from "../../../../lib/db.js";
import {purgeExpiredPublicCache} from "../../../../lib/shared-cache.js";
export const runtime="nodejs";
export const maxDuration=15;
export async function GET(request){
  const expected=process.env.CRON_SECRET?.trim();
  if(!expected||!dbReady())return Response.json({error:"Scheduled maintenance not configured"},{status:503});
  const supplied=(request.headers.get("authorization")||"").replace(/^Bearer /,"");
  const a=Buffer.from(supplied),b=Buffer.from(expected);
  if(a.length!==b.length||!timingSafeEqual(a,b))
    return Response.json({error:"Unauthorized"},{status:401});
  try{
    const {purged}=await purgeExpiredPublicCache();
    await sql("DELETE FROM cs_sessions WHERE expires_at<UTC_TIMESTAMP(3)");
    await sql("DELETE FROM cs_email_tokens WHERE expires_at<UTC_TIMESTAMP(3)");
    await sql("DELETE FROM cs_rate_counters WHERE expires_at<UTC_TIMESTAMP(3)");
    return Response.json({ok:true,expiredSourceRowsRemoved:purged,checkedAt:new Date().toISOString()},
      {headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({error:"Maintenance unavailable"},{status:503});}
}
