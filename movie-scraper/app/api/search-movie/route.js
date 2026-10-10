import { jsonError, readInput, searchMovies } from "../../../lib/vercel-api";
import { consumeLimit, requesterKey, limitResponse } from "../../../lib/request-guard";

export const runtime = "nodejs";
export async function POST(req) {
  const client = requesterKey(req);
  // Best-effort per-client AND shared limits for the current serverless worker.
  const local = consumeLimit("movie-search-client", client, 18);
  if (!local.allowed) return limitResponse(local.retryAfter);
  const pooled = consumeLimit("movie-search-instance", "shared", 90);
  if (!pooled.allowed) return limitResponse(pooled.retryAfter);
  try {
    const input = await readInput(req);
    return Response.json({ results: await searchMovies(input.query) },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
