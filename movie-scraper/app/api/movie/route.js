import {getSelectedMovie,jsonError} from "../../../lib/vercel-api.js";
import {consumeLimit,requesterKey,limitResponse} from "../../../lib/request-guard.js";
export const runtime="nodejs";
export async function GET(request){
  const limit=consumeLimit("movie-details",requesterKey(request),15);
  if(!limit.allowed)return limitResponse(limit.retryAfter);
  try{
    const tmdbId=Number(new URL(request.url).searchParams.get("tmdbId"));
    if(!Number.isSafeInteger(tmdbId)||tmdbId<1||tmdbId>1_000_000_000)
      return Response.json({error:"Invalid movie ID"},{status:400});
    const film=await getSelectedMovie(tmdbId);
    return Response.json({movie:{id:film.id,title:film.title,original_title:film.title,
      release_date:film.year?film.year+"-01-01":"",poster_path:null}},
      {headers:{"Cache-Control":"public, max-age=0, s-maxage=600"}});
  }catch(e){return jsonError(e);}
}
