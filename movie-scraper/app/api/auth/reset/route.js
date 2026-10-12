import {redeemEmailToken,validatePassword} from "../../../../lib/auth.js";
import {readAuthBody,credentialsAvailable,unavailable,secureReply} from "../../../../lib/api-auth.js";
import {jsonError} from "../../../../lib/vercel-api.js";
export const runtime="nodejs";
export async function POST(request){
  if(!credentialsAvailable())return unavailable();
  try{
    const body=await readAuthBody(request);
    if(!validatePassword(body.password))return secureReply({error:"رمز باید حداقل ۱۲ کاراکتر باشد."},400);
    if(!(await redeemEmailToken(body.token,"reset",body.password)))
      return secureReply({error:"لینک بازیابی نامعتبر یا منقضی شده است."},400);
    return secureReply({message:"رمز تغییر کرد؛ دوباره وارد شوید."});
  }catch(e){return jsonError(e);}
}
