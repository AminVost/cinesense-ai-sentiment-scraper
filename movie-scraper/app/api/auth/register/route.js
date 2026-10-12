import {sql} from "../../../../lib/db.js";
import {authThrottle,passwordHash,validateEmail,validatePassword,newEmailToken,sendAccountMail} from "../../../../lib/auth.js";
import {readAuthBody,credentialsAvailable,unavailable,secureReply} from "../../../../lib/api-auth.js";
import {jsonError} from "../../../../lib/vercel-api.js";
export const runtime="nodejs";
export async function POST(request){
  if(!credentialsAvailable())return unavailable();
  try{
    const input=await readAuthBody(request);
    const email=validateEmail(input.email);
    if(!email||!validatePassword(input.password))
      return secureReply({error:"ایمیل معتبر و رمز حداقل ۱۲ کاراکتری وارد کنید."},400);
    const limit=await authThrottle(request,email,"register");
    if(!limit.allowed)return secureReply({error:"درخواست‌های زیادی ثبت شده؛ بعداً امتحان کنید."},429,{"Retry-After":String(limit.retryAfter)});
    const hashed=await passwordHash(input.password);
    const existing=await sql("SELECT id,verified_at FROM cs_users WHERE email=? LIMIT 1",[email]);
    let userId;
    if(existing.length){
      if(existing[0].verified_at)return secureReply({message:"اگر این ایمیل قابل ثبت باشد، راهنمای تأیید برای آن ارسال می‌شود."});
      userId=existing[0].id;
    }else{
      try{
        const saved=await sql("INSERT INTO cs_users (email,password_hash) VALUES(?,?)",[email,hashed]);
        userId=saved.insertId;
      }catch(e){
        if(e.code==="ER_DUP_ENTRY")return secureReply({message:"در صورت ثبت‌نام موفق، ایمیل تأیید ارسال می‌شود."});
        throw e;
      }
    }
    const oneTime=await newEmailToken(userId,"verify");
    await sendAccountMail(email,"verify",oneTime);
    return secureReply({message:"لینک تأیید ایمیل ارسال شد. پوشه Spam را هم بررسی کنید."},201);
  }catch(e){return jsonError(e);}
}
