import {createHash} from "node:crypto";
import {dbReady,sql} from "./db.js";

export async function sharedRateLimit(group,subject,limit,windowSeconds=60) {
  if(!dbReady())return {allowed:false,retryAfter:60};
  const slot=Math.floor(Date.now()/(windowSeconds*1000));
  const key=createHash("sha256").update(group+":"+subject+":"+slot).digest("hex");
  const expires=new Date((slot+2)*windowSeconds*1000);
  await sql(`INSERT INTO cs_rate_counters (bucket_key,count,expires_at) VALUES (?,1,?)
             ON DUPLICATE KEY UPDATE count=count+1`,[key,expires]);
  const rows=await sql("SELECT count FROM cs_rate_counters WHERE bucket_key=? LIMIT 1",[key]);
  return {allowed:Number(rows[0]?.count||0)<=limit,
    retryAfter:Math.max(1,Math.ceil(((slot+1)*windowSeconds*1000-Date.now())/1000))};
}
