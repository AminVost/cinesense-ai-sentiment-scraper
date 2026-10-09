// Checks the real YouTube Data API at Vercel production BUILD time.
// Never prints, forwards or exposes the API key. This check uses 1+ quota unit.
import { analyzeMovie } from "../lib/vercel-api.js";

if (process.env.VERCEL_ENV !== "production") {
  console.log("YOUTUBE_LIVE_SMOKE skipped outside Vercel production build.");
} else if (!process.env.YOUTUBE_API_KEY?.trim()) {
  console.log("YOUTUBE_LIVE_SMOKE unavailable: YOUTUBE_API_KEY not configured for the build.");
} else {
  try {
    // Official Interstellar trailer by Warner Bros UK; this tests a real public video.
    const report = await analyzeMovie({
      sources: ["youtube"],
      youtubeVideoId: "zSWdZVtXT7E",
      maxComments: 3,
    });
    const youtube = report.sources?.find(source => source.source === "youtube");
    if (report.errors?.length) {
      // No request URLs or secrets are ever logged.
      console.log("YOUTUBE_LIVE_SMOKE API_ERROR", String(report.errors[0].error).slice(0,150));
    } else if (!youtube?.comments?.length) {
      console.log("YOUTUBE_LIVE_SMOKE NO_PUBLIC_COMMENTS for official trailer.");
    } else {
      const ok = youtube.comments.every(c => c.source === "youtube" && c.reviewType === "trailer" && c.metric === "none");
      console.log("YOUTUBE_LIVE_SMOKE", ok ? "PASS" : "UNEXPECTED_SCHEMA", "comments="+youtube.comments.length, "trailerOnly="+ok);
    }
  } catch (e) {
    console.log("YOUTUBE_LIVE_SMOKE ERROR", String(e?.name || "Unknown").slice(0,60));
  }
}
