import { analyzeMovie, jsonError, readInput } from "../../../lib/vercel-api";
import { isAuthorizedScrape, scraperEnabled } from "../../../lib/scraper-access";
import { consumeLimit, limitResponse, requesterKey } from "../../../lib/request-guard";
import { currentUser, recordHistory } from "../../../lib/auth.js";
import { sharedRateLimit } from "../../../lib/db-rate.js";

export const runtime = "nodejs";
export async function POST(req) {
  try {
    const input = await readInput(req);
    const youtube = Array.isArray(input.sources) && input.sources.includes("youtube");
    let user = null;
    if (youtube) {
      const owner = scraperEnabled() && isAuthorizedScrape(req);
      if (!owner) {
        user = await currentUser(req);
        if (!user) return Response.json({error:"برای YouTube وارد حساب تأییدشده شوید یا کد خصوصی را وارد کنید."},{status:401});
        const allowance = await sharedRateLimit("youtube-user-minute",user.id,6,60);
        if (!allowance.allowed) return limitResponse(allowance.retryAfter);
      }
    }
    const client = requesterKey(req);
    const clientLimit = consumeLimit(youtube ? "youtube-client" : "reviews-client", client, youtube ? 5 : 24);
    if (!clientLimit.allowed) return limitResponse(clientLimit.retryAfter);
    if (youtube) {
      const instanceLimit = consumeLimit("youtube-instance", "shared", 12);
      if (!instanceLimit.allowed) return limitResponse(instanceLimit.retryAfter);
    }
    const result = await analyzeMovie(input);
    if (result.sources?.length) {
      // Store only the user's film selection; review snapshots are shared
      // independently in the source cache. Never persist owner credentials.
      await recordHistory(req,Number(input.tmdbId),input.movieTitle,result.sources.map(x=>x.source)).catch(()=>{});
    }
    return Response.json(result,{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    return jsonError(error);
  }
}
