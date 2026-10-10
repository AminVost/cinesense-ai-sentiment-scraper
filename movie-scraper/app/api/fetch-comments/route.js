import { jsonError, readInput } from "../../../lib/vercel-api";
import { isAuthorizedScrape, scraperEnabled } from "../../../lib/scraper-access";
import { discoverAndScrapeDigiMoviez } from "../../../lib/digimoviez";
import { acquireSlot, consumeLimit, limitResponse, requesterKey } from "../../../lib/request-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  if (!scraperEnabled())
    return Response.json({error:"Scraper access code is not configured."},{status:503});
  if (!isAuthorizedScrape(request))
    return Response.json({error:"Incorrect private access code."},{status:401});

  let release = null;
  try {
    const input = await readInput(request);
    const max = input.maxComments === undefined ? 10 : Number(input.maxComments);
    if (!Number.isInteger(max) || max < 1 || max > 10)
      return Response.json({error:"Select 1–10 DigiMoviez comments."},{status:400});
    if (!Number.isSafeInteger(Number(input.tmdbId)) || Number(input.tmdbId) < 1)
      return Response.json({error:"Choose a movie by name before searching DigiMoviez."},{status:400});

    const perClient = consumeLimit("digi-client", requesterKey(request), 3);
    if (!perClient.allowed) return limitResponse(perClient.retryAfter);
    const perWorker = consumeLimit("digi-instance", "shared", 8);
    if (!perWorker.allowed) return limitResponse(perWorker.retryAfter);
    release = acquireSlot("digi-browser", 1);
    if (!release)
      return Response.json({error:"Crawler is busy; try again shortly."},{
        status:503,headers:{"Retry-After":"10","Cache-Control":"no-store"}
      });

    const extracted = await discoverAndScrapeDigiMoviez(Number(input.tmdbId), max);
    return Response.json({
      comments: extracted.reviews, matchedSource: extracted.matchedSource,
      hasMore: extracted.hasMore, totalComments: extracted.reviews.length,
    }, {headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    return jsonError(error);
  } finally {
    release?.();
  }
}
