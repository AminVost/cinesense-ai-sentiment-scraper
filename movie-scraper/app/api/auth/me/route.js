import {dbReady} from "../../../../lib/db.js";
import {currentUser,authReady} from "../../../../lib/auth.js";
import {secureReply} from "../../../../lib/api-auth.js";
export const runtime="nodejs";
export async function GET(req){
  if(!dbReady())return secureReply({enabled:false,user:null});
  try{return secureReply({enabled:authReady(),user:await currentUser(req)});}
  catch{return secureReply({enabled:false,user:null},503);}
}
