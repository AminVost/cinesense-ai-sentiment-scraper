import {revokeSession,sessionCookie,checkOrigin} from "../../../../lib/auth.js";
import {secureReply} from "../../../../lib/api-auth.js";
export const runtime="nodejs";
export async function POST(req){
  if(!checkOrigin(req))return secureReply({error:"Forbidden"},403);
  try{await revokeSession(req);}catch{return secureReply({error:"خروج ناموفق بود."},503);}
  return secureReply({ok:true},200,{"Set-Cookie":sessionCookie("",0)});
}
