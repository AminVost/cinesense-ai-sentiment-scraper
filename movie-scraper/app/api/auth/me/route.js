import {dbReady,sql} from "../../../../lib/db.js";
import {currentUser,authReady} from "../../../../lib/auth.js";
import {secureReply} from "../../../../lib/api-auth.js";
export const runtime="nodejs";
export async function GET(req){
  if(!dbReady())return secureReply({enabled:false,user:null});
  try{
    if(!authReady())return secureReply({enabled:false,user:null});
    await sql("SELECT id FROM cs_users LIMIT 0");
    return secureReply({enabled:true,user:await currentUser(req)});
  }
  catch{return secureReply({enabled:false,user:null},503);}
}
