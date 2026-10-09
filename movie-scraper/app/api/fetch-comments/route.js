export const runtime = "nodejs";
export async function POST() {
  return Response.json({ error: "DigiMoviez scraping needs the separate self-hosted Playwright backend and is disabled on Vercel Hobby." }, { status: 503 });
}
