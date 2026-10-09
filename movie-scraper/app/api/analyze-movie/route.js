import { analyzeMovie, jsonError, readInput } from "../../../lib/vercel-api";
import { isAuthorizedScrape, scraperEnabled } from "../../../lib/scraper-access";
export const runtime = "nodejs";
export async function POST(req) {
  try {
    const input = await readInput(req);
    // YouTube's daily API quota is scarce even with a free key; keep it
    // behind the same owner-only code used for expensive browser scraping.
    if (Array.isArray(input.sources) && input.sources.includes("youtube")) {
      if (!scraperEnabled()) return Response.json({error:"Owner access is not configured."},{status:503});
      if (!isAuthorizedScrape(req)) return Response.json({error:"Incorrect owner access code."},{status:401});
    }
    return Response.json(await analyzeMovie(input));
  } catch (error) {
    return jsonError(error);
  }
}
