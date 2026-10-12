import {randomBytes,createHash,scrypt as scryptCb,timingSafeEqual} from "node:crypto";
import {promisify} from "node:util";
import {database,dbReady,sql} from "./db.js";
import {sharedRateLimit} from "./db-rate.js";

const scrypt=promisify(scryptCb);
const SESSION_AGE_SECONDS=30*24*60*60;
const cookieName=process.env.NODE_ENV==="production"?"__Host-cs_session":"cs_session";
const emailRE=/^[^\s@\u0000-\u001f]{1,64}@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
export const authReady=()=>dbReady()&&Boolean(process.env.RESEND_API_KEY?.trim()) &&
  Boolean(process.env.AUTH_EMAIL_FROM?.trim());
const digest=value=>createHash("sha256").update(value).digest("hex");
const token=()=>randomBytes(32).toString("hex");
export function validateEmail(value){
  const email=String(value||"").trim().toLowerCase();
  return email.length<=254&&emailRE.test(email)?email:null;
}
export function validatePassword(value){
  return typeof value==="string" && value.length>=12 && value.length<=128 &&
    Buffer.byteLength(value,"utf8")<=256;
}
export async function passwordHash(password){
  if(!validatePassword(password))throw Error("Password must have 12-128 characters");
  const salt=randomBytes(16).toString("hex");
  const hashed=await scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:32*1024*1024});
  return "scrypt:16384:8:1:"+salt+":"+hashed.toString("hex");
}
export async function passwordVerify(password,stored){
  if(typeof password!=="string"||password.length>128||typeof stored!=="string")return false;
  const parts=stored.split(":");
  if(parts.length!==6||parts[0]!=="scrypt"||parts[1]!=="16384"||parts[2]!=="8"||parts[3]!=="1")return false;
  try {
    const left=Buffer.from(parts[5],"hex");
    if(left.length!==64)return false;
    const right=await scrypt(password,parts[4],64,{N:16384,r:8,p:1,maxmem:32*1024*1024});
    return timingSafeEqual(left,right);
  } catch {return false;}
}
export function sessionCookie(raw,maxAge=SESSION_AGE_SECONDS){
  return `${cookieName}=${encodeURIComponent(raw)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${process.env.NODE_ENV==="production"?"; Secure":""}`;
}
export function cookieToken(request){
  const cookies=request.headers.get("cookie")||"";
  const pair=cookies.split(";").map(x=>x.trim()).find(x=>x.startsWith(cookieName+"="));
  const value=pair?.slice(cookieName.length+1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export async function currentUser(request){
  if(!dbReady())return null;
  const value=cookieToken(request);
  if(!value)return null;
  const rows=await sql(`SELECT u.id,u.email,u.verified_at FROM cs_sessions s
    JOIN cs_users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP(3) LIMIT 1`,[digest(value)]);
  if(!rows.length || !rows[0].verified_at)return null;
  return {id:String(rows[0].id),email:rows[0].email};
}
export async function createSession(userId){
  const raw=token();
  await sql("INSERT INTO cs_sessions (token_hash,user_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 30 DAY))",
    [digest(raw),userId]);
  return sessionCookie(raw);
}
export async function revokeSession(request){
  const raw=cookieToken(request);
  if(raw&&dbReady())await sql("DELETE FROM cs_sessions WHERE token_hash=?",[digest(raw)]);
}
export function checkOrigin(request){
  const origin=request.headers.get("origin");
  const primary=process.env.SITE_URL?.trim() || "https://cinesense.aminvost.ir";
  const permitted=[new URL(request.url).origin,new URL(primary).origin];
  if(origin&&!permitted.includes(origin))return false;
  if(request.headers.get("sec-fetch-site")==="cross-site")return false;
  return true;
}
export async function authThrottle(request,email,operation){
  const ip=(request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "unknown")
    .split(",")[0].slice(0,80);
  const first=await sharedRateLimit("auth:"+operation+":ip",digest(ip),operation==="login"?12:4,900);
  if(!first.allowed)return first;
  return sharedRateLimit("auth:"+operation+":email",digest(email),operation==="login"?6:3,900);
}
export async function newEmailToken(userId,purpose){
  const raw=token();
  await sql("DELETE FROM cs_email_tokens WHERE user_id=? AND purpose=?",[userId,purpose]);
  await sql("INSERT INTO cs_email_tokens (token_hash,user_id,purpose,expires_at) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 30 MINUTE))",
    [digest(raw),userId,purpose]);
  return raw;
}
export async function sendAccountMail(email,purpose,raw){
  if(!authReady())throw Error("Email provider is not configured");
  const base=new URL(process.env.SITE_URL||"https://cinesense.aminvost.ir");
  if(base.protocol!=="https:")throw Error("SITE_URL must use HTTPS");
  const url=new URL("/account",base);
  url.searchParams.set(purpose==="verify"?"verify":"reset",raw);
  const msg=purpose==="verify"?"تأیید ایمیل CineSense":"بازیابی رمز CineSense";
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{"Authorization":"Bearer "+process.env.RESEND_API_KEY,
      "Content-Type":"application/json"},
    body:JSON.stringify({from:process.env.AUTH_EMAIL_FROM,to:[email],subject:msg,
      text:`${msg}\n\n${url.toString()}\n\nاین لینک فقط ۳۰ دقیقه اعتبار دارد. اگر درخواست نداده‌اید آن را نادیده بگیرید.`}),
    signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)throw Error("Email delivery is unavailable");
}
export async function redeemEmailToken(raw,purpose,password){
  if(typeof raw!=="string"||!/^[a-f0-9]{64}$/.test(raw))return false;
  if(purpose==="reset"&&!validatePassword(password))return false;
  const hashed=purpose==="reset"?await passwordHash(password):null;
  const conn=await database().getConnection();
  try {
    await conn.beginTransaction();
    const [rows]=await conn.execute(`SELECT user_id FROM cs_email_tokens
      WHERE token_hash=? AND purpose=? AND expires_at>UTC_TIMESTAMP(3) FOR UPDATE`,
      [digest(raw),purpose]);
    if(!rows.length){await conn.rollback();return false;}
    if(purpose==="verify")await conn.execute("UPDATE cs_users SET verified_at=UTC_TIMESTAMP(3) WHERE id=?",[rows[0].user_id]);
    else {
      await conn.execute("UPDATE cs_users SET password_hash=? WHERE id=?",[hashed,rows[0].user_id]);
      await conn.execute("DELETE FROM cs_sessions WHERE user_id=?",[rows[0].user_id]);
    }
    await conn.execute("DELETE FROM cs_email_tokens WHERE token_hash=?",[digest(raw)]);
    await conn.commit();
    return true;
  } catch(e){await conn.rollback();throw e;} finally{conn.release();}
}
export async function recordHistory(request,tmdbId,movieTitle,sources){
  let user;
  try{user=await currentUser(request);}catch{return;}
  if(!user)return;
  await sql(`INSERT INTO cs_user_history (user_id,tmdb_id,movie_title,sources_json,last_viewed_at)
    VALUES (?,?,?,?,UTC_TIMESTAMP(3))
    ON DUPLICATE KEY UPDATE movie_title=VALUES(movie_title),
      sources_json=VALUES(sources_json),last_viewed_at=UTC_TIMESTAMP(3)`,
    [user.id,tmdbId,String(movieTitle||"Movie").slice(0,220),
      JSON.stringify(sources.filter(x=>["tmdb","youtube","digimoviez"].includes(x)))]);
}
