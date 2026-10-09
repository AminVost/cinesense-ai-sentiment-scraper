import { analyzeMovie, jsonError, readInput } from "../../../lib/vercel-api";
export const runtime = "nodejs";
export async function POST(req) {
  try {
    const input = await readInput(req);
    return Response.json(await analyzeMovie(input));
  } catch (error) {
    return jsonError(error);
  }
}
