import { analyzeMovie, jsonError, readInput } from "../../../lib/vercel-api";
import { isAuthorizedScrape, scraperEnabled } from "../../../lib/scraper-access";
import { consumeLimit, limitResponse, requesterKey } from "../../../lib/request-guard";

export const runtime = "nodejs";
export async function POST(req) {
  try {
    const input = await readInput(req);
    const youtube = Array.isArray(input.sources) && input.sources.includes("youtube");
    if (youtube) {
      if (!scraperEnabled()) return Response.json({error:"Owner access is not configured."},{status:503});
      if (!isAuthorizedScrape(req)) return Response.json({error:"Incorrect owner access code."},{status:401});
    }
    // Enforce this after authentication, so anonymous callers cannot exhaust owner quota.
    const client = requesterKey(req);
    const clientLimit = consumeLimit(youtube ? "youtube-client" : "reviews-client", client, youtube ? 5 : 24);
    if (!clientLimit.allowed) return limitResponse(clientLimit.retryAfter);
    if (youtube) {
      const globalLimit = consumeLimit("youtube-instance", "shared", 12);
      if (!globalLimit.allowed) return limitResponse(globalLimit.retryAfter);
    }
    return Response.json(await analyzeMovie(input), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
