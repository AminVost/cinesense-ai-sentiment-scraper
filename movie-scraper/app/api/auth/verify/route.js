import {redeemEmailToken} from "../../../../lib/auth.js";
import {readAuthBody,credentialsAvailable,unavailable,secureReply} from "../../../../lib/api-auth.js";
import {jsonError} from "../../../../lib/vercel-api.js";
export const runtime="nodejs";
export async function POST(request){
  if(!credentialsAvailable())return unavailable();
  try{
    const body=await readAuthBody(request);
    if(!(await redeemEmailToken(body.token,"verify")))
      return secureReply({error:"این لینک معتبر نیست یا منقضی شده است."},400);
    return secureReply({message:"ایمیل تأیید شد. اکنون وارد حساب شوید."});
  }catch(e){return jsonError(e);}
}
