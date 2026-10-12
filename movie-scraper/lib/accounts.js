import {randomBytes,createHash,randomUUID,scrypt as scryptCb,timingSafeEqual} from "node:crypto";
import {promisify} from "node:util";
import {getDatabase,databaseEnabled} from "./shared-cache.js";
const scrypt=promisify(scryptCb);
const COOKIE="cs_session";
const SESSION_DAYS=30;
export const accountConfigured=()=>databaseEnabled();
function digest(value){return createHash("sha256").update(value).digest("hex");}
export function cleanEmail(value){
  if(typeof value!=="string")throw Error("Invalid email.");
  const email=value.trim().toLowerCase();
  if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))throw Error("Invalid email.");
  return email;
}
export function checkPassword(value){
  if(typeof value!=="string"||value.length<12||value.length>128)
    throw Error("Password must be between 12 and 128 characters.");
  return value;
}
export async function hashPassword(password){
  checkPassword(password);
  const salt=randomBytes(16).toString("hex");
  const key=await scrypt(password,salt,64);
  return "scrypt$"+salt+"$"+key.toString("hex");
}
export async function verifyPassword(password,stored){
  if(typeof password!=="string"||password.length>128)return false;
  const [kind,salt,hash]=String(stored).split("$");
  if(kind!=="scrypt"||!/^[a-f0-9]{32}$/.test(salt||"")||!/^[a-f0-9]{128}$/.test(hash||""))return false;
  const computed=await scrypt(password,salt,64);
  return timingSafeEqual(Buffer.from(hash,"hex"),computed);
}
export async function signup(email,password){
  const value=cleanEmail(email);
  const hash=await hashPassword(password);
  const [r]=await getDatabase().execute("INSERT INTO cs_users(email,password_hash) VALUES(?,?)",[value,hash]);
  return {id:Number(r.insertId),email:value};
}
export async function signIn(email,password){
  const value=cleanEmail(email);
  const [users]=await getDatabase().execute("SELECT id,email,password_hash FROM cs_users WHERE email=? LIMIT 1",[value]);
  const user=users[0];
  // Time to hash even when email unknown; reduce enumeration timing.
  const matched=await verifyPassword(password,user?.password_hash||"scrypt$"+"0".repeat(32)+"$"+"0".repeat(128));
  if(!user||!matched)return null;
  return {id:Number(user.id),email:user.email};
}
export async function createSession(user){
  const token=randomBytes(32).toString("base64url");
  const hash=digest(token);
  await getDatabase().execute("INSERT INTO cs_sessions(token_hash,user_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 30 DAY))",
    [hash,user.id]);
  return token;
}
function sessionValue(cookie){return cookie?.split(";").map(s=>s.trim()).find(s=>s.startsWith(COOKIE+"="))?.slice(COOKIE.length+1)||null;}
export async function currentUser(request){
  if(!accountConfigured())return null;
  const raw=sessionValue(request.headers.get("cookie"));
  if(!raw||raw.length>128)return null;
  const [users]=await getDatabase().execute(
    `SELECT u.id,u.email FROM cs_sessions s
     JOIN cs_users u ON u.id=s.user_id
     WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP(3) LIMIT 1`,[digest(raw)]);
  if(!users.length)return null;
  return {id:Number(users[0].id),email:users[0].email};
}
export async function removeSession(request){
  const raw=sessionValue(request.headers.get("cookie"));
  if(raw&&accountConfigured())await getDatabase().execute("DELETE FROM cs_sessions WHERE token_hash=?",[digest(raw)]);
}
export function cookieHeader(token,clear=false){
  const secure=process.env.NODE_ENV==="production"?" Secure;":"";
  return `${COOKIE}=${clear?"":token}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${clear?0:SESSION_DAYS*86400}`;
}
export function authResponse(user,token){
  return Response.json({user},{headers:{
    "Set-Cookie":cookieHeader(token),
    "Cache-Control":"no-store"
  }});
}
export async function addHistory(userId,tmdbId){
  if(!userId||!Number.isSafeInteger(Number(tmdbId))||Number(tmdbId)<1)return;
  await getDatabase().execute(
    "INSERT INTO cs_user_history(user_id,tmdb_id) VALUES(?,?) ON DUPLICATE KEY UPDATE last_viewed_at=UTC_TIMESTAMP()",
    [userId,Number(tmdbId)]);
}
