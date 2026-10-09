import { jsonError, readInput, searchMovies } from "../../../lib/vercel-api";
export const runtime = "nodejs";
export async function POST(req) {
  try {
    const input = await readInput(req);
    return Response.json({ results: await searchMovies(input.query) });
  } catch (error) {
    return jsonError(error);
  }
}
