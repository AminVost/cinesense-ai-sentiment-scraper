import { available } from "../../../lib/vercel-api";
export const runtime = "nodejs";
export async function GET() {
  return Response.json(available(), { headers: { "Cache-Control": "no-store" } });
}
