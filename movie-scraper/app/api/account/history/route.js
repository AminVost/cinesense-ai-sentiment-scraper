import {currentUser} from "../../../../lib/auth.js";
import {sql} from "../../../../lib/db.js";
import {secureReply} from "../../../../lib/api-auth.js";
export const runtime="nodejs";
export async function GET(request){
  try{
    const user=await currentUser(request);
    if(!user)return secureReply({error:"ابتدا وارد حساب شوید."},401);
    const rows=await sql(`SELECT tmdb_id,movie_title,sources_json,last_viewed_at
      FROM cs_user_history WHERE user_id=? ORDER BY last_viewed_at DESC LIMIT 30`,[user.id]);
    return secureReply({history:rows.map(row=>({
      tmdbId:Number(row.tmdb_id),title:row.movie_title,
      sources:JSON.parse(row.sources_json),lastViewedAt:new Date(row.last_viewed_at).toISOString()
    }))});
  }catch{return secureReply({error:"تاریخچه در دسترس نیست."},503);}
}
