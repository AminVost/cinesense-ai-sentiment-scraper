import {sql} from "../../../../lib/db.js";
import {authThrottle,validateEmail,newEmailToken,sendAccountMail} from "../../../../lib/auth.js";
import {readAuthBody,credentialsAvailable,unavailable,secureReply} from "../../../../lib/api-auth.js";
import {jsonError} from "../../../../lib/vercel-api.js";
export const runtime="nodejs";
export async function POST(request){
  if(!credentialsAvailable())return unavailable();
  try{
    const body=await readAuthBody(request);
    const email=validateEmail(body.email);
    if(!email)return secureReply({error:"ایمیل نامعتبر است."},400);
    const limit=await authThrottle(request,email,"forgot");
    if(!limit.allowed)return secureReply({error:"درخواست زیادی ثبت شده است."},429,{"Retry-After":String(limit.retryAfter)});
    const rows=await sql("SELECT id FROM cs_users WHERE email=? AND verified_at IS NOT NULL LIMIT 1",[email]);
    if(rows.length){
      const raw=await newEmailToken(rows[0].id,"reset");
      await sendAccountMail(email,"reset",raw);
    }
    return secureReply({message:"اگر حسابی با این ایمیل وجود داشته باشد، لینک بازیابی ارسال می‌شود."});
  }catch(e){return jsonError(e);}
}
