import {redeemEmailToken,passwordVerify} from "../../../../lib/auth.js";
import {sql} from "../../../../lib/db.js";
import {createHash} from "node:crypto";
import {sharedRateLimit} from "../../../../lib/db-rate.js";
import {readAuthBody,credentialsAvailable,unavailable,secureReply} from "../../../../lib/api-auth.js";
import {jsonError} from "../../../../lib/vercel-api.js";
export const runtime="nodejs";
export async function POST(request){
  if(!credentialsAvailable())return unavailable();
  try{
    const body=await readAuthBody(request);
    // A confirmation link alone cannot activate an attacker-created account:
    // require the password chosen by the real registering visitor.
    if(typeof body.token!=="string"||!/^[a-f0-9]{64}$/.test(body.token))
      return secureReply({error:"این لینک معتبر نیست."},400);
    const hash=createHash("sha256").update(body.token).digest("hex");
    const attempt=await sharedRateLimit("verify-token-attempt",hash,5,900);
    if(!attempt.allowed)return secureReply({error:"تلاش بیش‌ازحد؛ دوباره امتحان کنید."},429);
    const rows=await sql(`SELECT u.password_hash FROM cs_email_tokens t
      JOIN cs_users u ON u.id=t.user_id
      WHERE t.token_hash=? AND t.purpose='verify' AND t.expires_at>UTC_TIMESTAMP(3) LIMIT 1`,[hash]);
    if(!rows.length||!(await passwordVerify(body.password,rows[0].password_hash)))
      return secureReply({error:"رمز ثبت‌نام یا لینک تأیید نادرست است."},401);
    if(!(await redeemEmailToken(body.token,"verify")))
      return secureReply({error:"این لینک معتبر نیست یا منقضی شده است."},400);
    return secureReply({message:"ایمیل تأیید شد. اکنون وارد حساب شوید."});
  }catch(e){return jsonError(e);}
}
