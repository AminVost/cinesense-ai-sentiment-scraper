import {authReady,checkOrigin} from "./auth.js";
import {readInput} from "./vercel-api.js";

export async function readAuthBody(request){
  if(!checkOrigin(request))throw Object.assign(Error("Forbidden request origin"),{status:403});
  const input=await readInput(request);
  return input;
}
export function unavailable(){
  return Response.json({error:"حساب کاربری هنوز فعال نشده است؛ اتصال دیتابیس و ایمیل لازم است."},
    {status:503,headers:{"Cache-Control":"no-store"}});
}
export function credentialsAvailable(){return authReady();}
export function secureReply(data,status=200,headers={}){
  return Response.json(data,{status,headers:{"Cache-Control":"no-store",...headers}});
}
