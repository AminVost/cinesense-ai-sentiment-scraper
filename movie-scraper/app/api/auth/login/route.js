import {sql} from "../../../../lib/db.js";
import {authThrottle,passwordVerify,validateEmail,createSession} from "../../../../lib/auth.js";
import {readAuthBody,credentialsAvailable,unavailable,secureReply} from "../../../../lib/api-auth.js";
import {jsonError} from "../../../../lib/vercel-api.js";
export const runtime="nodejs";
export async function POST(request){
  if(!credentialsAvailable())return unavailable();
  try{
    const data=await readAuthBody(request);
    const email=validateEmail(data.email);
    if(!email||typeof data.password!=="string"||data.password.length>128)
      return secureReply({error:"ایمیل یا رمز عبور نادرست است."},401);
    const limit=await authThrottle(request,email,"login");
    if(!limit.allowed)return secureReply({error:"تلاش ورود بیش‌ازحد؛ بعداً دوباره تلاش کنید."},429,{"Retry-After":String(limit.retryAfter)});
    const rows=await sql("SELECT id,email,password_hash,verified_at FROM cs_users WHERE email=? LIMIT 1",[email]);
    if(!rows.length||!(await passwordVerify(data.password,rows[0].password_hash)))
      return secureReply({error:"ایمیل یا رمز عبور نادرست است."},401);
    if(!rows[0].verified_at)
      return secureReply({error:"ابتدا ایمیل خود را با لینک ارسال‌شده تأیید کنید."},403);
    const cookie=await createSession(rows[0].id);
    return secureReply({user:{id:String(rows[0].id),email:rows[0].email}},200,{"Set-Cookie":cookie});
  }catch(e){return jsonError(e);}
}
