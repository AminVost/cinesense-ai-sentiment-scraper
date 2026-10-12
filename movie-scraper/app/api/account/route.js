import { readInput } from "../../../lib/vercel-api";
import {accountConfigured,signup,signIn,createSession,authResponse,currentUser,removeSession,cookieHeader} from "../../../lib/accounts";
import {consumeLimit,requesterKey,limitResponse} from "../../../lib/request-guard";
export const runtime="nodejs";
export async function GET(req){
  if(!accountConfigured())return Response.json({enabled:false,user:null},{headers:{"Cache-Control":"no-store"}});
  try{
    return Response.json({enabled:true,user:await currentUser(req)},{headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({error:"Account service unavailable."},{status:503,headers:{"Cache-Control":"no-store"}});}
}
export async function POST(req){
  if(!accountConfigured())return Response.json({error:"Accounts not configured."},{status:503});
  const origin=req.headers.get("origin");
  if(!origin || new URL(origin).host!==new URL(req.url).host)
    return Response.json({error:"Invalid request origin."},{status:403});
  const limit=consumeLimit("accounts-client",requesterKey(req),5,60_000);
  if(!limit.allowed)return limitResponse(limit.retryAfter);
  try{
    const body=await readInput(req);
    if(!["register","login","logout"].includes(body.action))
      return Response.json({error:"Unknown action."},{status:400});
    if(body.action==="logout"){
      await removeSession(req);
      return Response.json({user:null},{headers:{"Set-Cookie":cookieHeader("",true),"Cache-Control":"no-store"}});
    }
    let user;
    if(body.action==="register"){
      user=await signup(body.email,body.password);
    }else{
      user=await signIn(body.email,body.password);
      if(!user)return Response.json({error:"Email or password is incorrect."},{status:401});
    }
    const token=await createSession(user);
    return authResponse(user,token);
  }catch(error){
    if(error?.code==="ER_DUP_ENTRY")return Response.json({error:"Account already exists."},{status:409});
    if(/Invalid email|Password must/.test(error?.message||""))
      return Response.json({error:error.message},{status:400});
    console.error("[accounts]",error?.code||error?.name||"unavailable");
    return Response.json({error:"Account service unavailable."},{status:503});
  }
}
