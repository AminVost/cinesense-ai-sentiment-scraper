// One-run preview build smoke for automated YouTube trailer discovery.
// Does not print/forward the API key or include it in logs.
import { analyzeMovie } from "../lib/vercel-api.js";

if (process.env.VERCEL_ENV !== "preview") {
  console.log("YOUTUBE_AUTO_DISCOVERY_SMOKE skipped outside preview.");
} else if (!process.env.YOUTUBE_API_KEY?.trim() || !process.env.TMDB_READ_ACCESS_TOKEN?.trim()) {
  console.log("YOUTUBE_AUTO_DISCOVERY_SMOKE unavailable: missing server-only credentials.");
} else {
  const report=await analyzeMovie({sources:["youtube"],tmdbId:157336,maxComments:3});
  const group=report.sources?.find(x=>x.source==="youtube");
  if(report.errors?.length) {
    console.log("YOUTUBE_AUTO_DISCOVERY_SMOKE FAIL",String(report.errors[0].error).slice(0,150));
    throw Error("YouTube trailer could not be automatically resolved.");
  }
  const valid=Boolean(group?.matchedSource?.videoId)&&group.comments?.length>0 &&
    group.comments.every(x=>x.source==="youtube"&&x.reviewType==="trailer");
  console.log("YOUTUBE_AUTO_DISCOVERY_SMOKE",valid?"PASS":"FAIL",
    "videoId="+(group?.matchedSource?.videoId||"none"),
    "confidence="+(group?.matchedSource?.confidence??"none"),
    "comments="+(group?.comments?.length??0));
  if(!valid)throw Error("YouTube automatically discovered comments are unavailable.");
}
