import { jsonError, readInput } from "../../../lib/vercel-api";
import { scrapeDigiMoviez } from "../../../lib/digimoviez";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(req){
  try{
    const data=await readInput(req);
    if(!Number.isInteger(data.maxComments)||data.maxComments<1||data.maxComments>10)
      return Response.json({error:"Select 1–10 comments."},{status:400});
    const fetched=await scrapeDigiMoviez(data.url,data.maxComments);
    return Response.json({comments:fetched.reviews,hasMore:fetched.hasMore,totalComments:fetched.reviews.length},
      {headers:{"Cache-Control":"no-store"}});
  }catch(error){return jsonError(error);}
}
