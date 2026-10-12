import { jsonError, readInput } from "../../../lib/vercel-api";
import { isAuthorizedScrape, scraperEnabled } from "../../../lib/scraper-access";
import { discoverAndScrapeDigiMoviez } from "../../../lib/digimoviez";
import { unstable_cache } from "next/cache";
import { acquireSlot, consumeLimit, limitResponse, requesterKey } from "../../../lib/request-guard";
import { currentUser, recordHistory } from "../../../lib/auth.js";
import { sharedRateLimit } from "../../../lib/db-rate.js";
import { cachedMovieSource } from "../../../lib/shared-cache.js";

export const runtime="nodejs";
export const maxDuration=60;
const cachedScrape=unstable_cache(
  async(tmdbId,max)=>discoverAndScrapeDigiMoviez(tmdbId,max),
  ["digimoviez-public-comments-v1"],{revalidate:1800}
);

export async function POST(request){
  const owner=scraperEnabled()&&isAuthorizedScrape(request);
  let user=null;
  try{
    if(!owner){
      user=await currentUser(request);
      if(!user)return Response.json({error:"برای DigiMoviez وارد حساب تأییدشده شوید یا کد خصوصی را وارد کنید."},
        {status:401,headers:{"Cache-Control":"no-store"}});
      const quota=await sharedRateLimit("digimoviez-user-minute",user.id,3,60);
      if(!quota.allowed)return limitResponse(quota.retryAfter);
    }
    const input=await readInput(request);
    const max=input.maxComments===undefined?10:Number(input.maxComments);
    const tmdbId=Number(input.tmdbId);
    if(!Number.isInteger(max)||max<1||max>10)
      return Response.json({error:"Select 1–10 DigiMoviez comments."},{status:400});
    if(!Number.isSafeInteger(tmdbId)||tmdbId<1||tmdbId>1_000_000_000)
      return Response.json({error:"Choose a movie by name before searching DigiMoviez."},{status:400});

    const perClient=consumeLimit("digi-client",requesterKey(request),3);
    if(!perClient.allowed)return limitResponse(perClient.retryAfter);
    const perWorker=consumeLimit("digi-instance","shared",8);
    if(!perWorker.allowed)return limitResponse(perWorker.retryAfter);

    const {data,cache}=await cachedMovieSource(tmdbId,"digimoviez",max,async()=>{
      const release=acquireSlot("digi-browser",1);
      if(!release){
        const err=new Error("Crawler is busy; try again shortly.");
        err.publicMessage=true;err.status=503;throw err;
      }
      try{
        const item=await cachedScrape(tmdbId,max);
        return {comments:item.reviews,matchedSource:item.matchedSource,hasMore:item.hasMore};
      }finally{release();}
    });
    await recordHistory(request,tmdbId,input.movieTitle,Array.isArray(input.requestedSources)?input.requestedSources:["digimoviez"]).catch(()=>{});
    return Response.json({comments:data.comments,matchedSource:data.matchedSource,
      hasMore:data.hasMore,totalComments:data.comments.length,cache},
      {headers:{"Cache-Control":"no-store"}});
  }catch(error){return jsonError(error);}
}
