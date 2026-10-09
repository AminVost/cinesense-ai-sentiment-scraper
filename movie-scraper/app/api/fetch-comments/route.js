import { jsonError, readInput } from "../../../lib/vercel-api";
import { isAuthorizedScrape, scraperEnabled } from "../../../lib/scraper-access";
import { scrapeDigiMoviez } from "../../../lib/digimoviez";

export const runtime="nodejs";
export const maxDuration=60;
export async function POST(req){
  if(!scraperEnabled())return Response.json({error:"Scraper access code is not configured."},
    {status:503,headers:{"Cache-Control":"no-store"}});
  if(!isAuthorizedScrape(req))return Response.json({error:"Incorrect scraper access code."},
    {status:401,headers:{"Cache-Control":"no-store"}});
  try{
    const data=await readInput(req);
    if(!Number.isInteger(data.maxComments)||data.maxComments<1||data.maxComments>10)
      return Response.json({error:"Select 1–10 comments."},{status:400});
    const extracted=await scrapeDigiMoviez(data.url,data.maxComments);
    return Response.json({comments:extracted.reviews,hasMore:extracted.hasMore,totalComments:extracted.reviews.length},
      {headers:{"Cache-Control":"no-store"}});
  }catch(e){return jsonError(e);}
}
