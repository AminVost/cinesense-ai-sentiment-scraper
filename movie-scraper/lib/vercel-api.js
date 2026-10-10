/**
 * Server-only free-provider API.
 * Source discovery uses free official API + bounded serverless scraper.
 * TMDB labels below describe AUTHOR RATINGS, never inferred AI sentiment.
 */
const TMDB_BASE = "https://api.themoviedb.org/3";
import { movieIdentity, rankYouTubeCandidate, chooseMatchingCandidate } from "./movie-discovery.js";
const YOUTUBE_BASE = "https://www.googleapis.com/youtube/v3/commentThreads";
const YOUTUBE_SEARCH = "https://www.googleapis.com/youtube/v3/search";

export class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function available() {
  return {
    tmdb: { enabled: Boolean(process.env.TMDB_READ_ACCESS_TOKEN || process.env.TMDB_API_KEY), type: "film", metric: "author_rating" },
    persianModel: { enabled: Boolean(process.env.PERSIAN_BROWSER_MODEL_ID), model: process.env.PERSIAN_BROWSER_MODEL_ID || null, type: "browser_ai", note: "Requires a verified public Transformers.js-compatible Persian ONNX repository." },
    youtube: { enabled: Boolean(process.env.YOUTUBE_API_KEY), type: "trailer", autoDiscover: true, metric: "unclassified" },
    digimoviez: { enabled: Boolean(process.env.CINESENSE_SCRAPER_ACCESS_CODE?.length >= 24), type: "film", autoDiscover: true, requiresUrl: false, requiresAccessCode: true, experimental: true, metric: "browser_ai_optional" },
  };
}

export function jsonError(error) {
  const status = error instanceof ApiError ? error.status : 502;
  if (!(error instanceof ApiError)) {
    // Do not log request configs or authorization credentials.
    console.error("[CineSense API]", error?.name || "unknown", error?.cause?.code || "");
  }
  return Response.json({ error: error instanceof ApiError ? error.message : "External service unavailable." }, { status });
}

export async function readInput(request) {
  const MAX_BYTES = 4096;
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BYTES) throw new ApiError("Request body is too large.", 413);
  // Content-Length can be absent or forged. Limit the actual streamed bytes.
  if (!request.body) throw new ApiError("Invalid JSON request.");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0, text = "";
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel().catch(() => {});
        throw new ApiError("Request body is too large.", 413);
      }
      text += decoder.decode(value, {stream:true});
    }
    text += decoder.decode();
  } catch(error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Invalid JSON request.");
  } finally { reader.releaseLock(); }
  let data;
  try { data = JSON.parse(text); } catch { throw new ApiError("Invalid JSON request."); }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new ApiError("Invalid JSON object.");
  return data;
}

function timeoutRequest(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(12000), next: { revalidate: 600, ...options.next } });
}

async function tmdb(path, params = {}) {
  const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  const key = process.env.TMDB_API_KEY?.trim();
  if (!token && !key) throw new ApiError("Set TMDB_READ_ACCESS_TOKEN in Vercel Environment Variables.", 503);
  const url = new URL(TMDB_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  if (!token) url.searchParams.set("api_key", key);
  let response;
  try {
    response = await timeoutRequest(url.toString(), {
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
  } catch (error) {
    console.error("[TMDB] outbound network error:", error?.cause?.code || error?.name || "unknown");
    throw new ApiError("Cannot reach TMDB from the deployment.", 502);
  }
  if (response.status === 429) throw new ApiError("TMDB request quota reached; try later.", 429);
  if ([401, 403].includes(response.status)) throw new ApiError("TMDB API credentials were rejected.", 502);
  if (!response.ok) throw new ApiError("TMDB returned HTTP " + response.status, 502);
  return response.json();
}

export async function searchMovies(query) {
  if (typeof query !== "string" || query.trim().length < 2 || query.length > 100) {
    throw new ApiError("Enter 2–100 characters for the movie name.");
  }
  const data = await tmdb("/search/movie", { query: query.trim(), include_adult: false, page: 1 });
  return (data.results || []).slice(0, 12).map(m => ({
    id: m.id, title: m.title, original_title: m.original_title,
    release_date: m.release_date || "", poster_path: m.poster_path || null,
  }));
}

export async function getSelectedMovie(tmdbId) {
  if (!Number.isSafeInteger(Number(tmdbId)) || Number(tmdbId) < 1 || Number(tmdbId) > 1000000000)
    throw new ApiError("Choose a valid movie from search results.");
  const data = await tmdb("/movie/" + Number(tmdbId), { language: "en-US" });
  try { return movieIdentity(data); } catch { throw new ApiError("Movie metadata could not be verified.", 502); }
}

/**
 * Exactly one search request per selected movie; never run discovery per keystroke.
 * API key stays server-side. Fail closed rather than commenting on a random video.
 */
export async function discoverYouTubeTrailer(movie) {
  const apiKey=process.env.YOUTUBE_API_KEY?.trim();
  if(!apiKey) throw new ApiError("YouTube API is not configured.",503);
  const query=[movie.title, movie.year, "official trailer"].filter(Boolean).join(" ").slice(0,150);
  const url=new URL(YOUTUBE_SEARCH);
  for(const [key,value] of Object.entries({
    key:apiKey, part:"snippet", q:query, type:"video", order:"relevance", maxResults:"15",
    safeSearch:"moderate"
  }))url.searchParams.set(key,value);
  let response;
  try{response=await timeoutRequest(url.toString(),{next:{revalidate:21600}});}
  catch{throw new ApiError("YouTube search could not be reached.",502);}
  if(response.status===403||response.status===429)
    throw new ApiError("YouTube search quota or API permissions prevented discovery.",429);
  if(!response.ok)throw new ApiError("YouTube search returned HTTP "+response.status,502);
  const data=await response.json();
  const entries=(data.items||[]).filter(item=>/^[a-zA-Z0-9_-]{11}$/.test(item.id?.videoId||""))
    .map(item=>({
      id:item.id.videoId,title:String(item.snippet?.title||"").slice(0,200),
      channel:String(item.snippet?.channelTitle||"").slice(0,150),
      publishedAt:item.snippet?.publishedAt||""
    }));
  const choice=chooseMatchingCandidate(entries,item=>rankYouTubeCandidate(movie,item),0.76,0);
  if(!choice.match)
    throw new ApiError("No reliable official YouTube trailer matched this movie and year.",404);
  const selected=choice.match;
  return {videoId:selected.id,title:selected.title,channel:selected.channel,
    confidence:Number(selected.match.score.toFixed(2)),
    url:"https://www.youtube.com/watch?v="+selected.id};
}

export function summary(comments, method = "none") {
  const counts = { positive: 0, negative: 0, neutral: 0, unclassified: 0 };
  let ratingTotal = 0, ratingCount = 0;
  for (const comment of comments) {
    const sentiment = String(comment.sentiment || "").toLowerCase();
    if (sentiment in counts) counts[sentiment]++;
    else counts.unclassified++;
    if (Number.isFinite(comment.rating)) { ratingTotal += comment.rating; ratingCount++; }
  }
  const classified = counts.positive + counts.negative + counts.neutral;
  return {
    ...counts, classified, total: comments.length, method,
    positivePercent: classified ? Math.round(counts.positive * 100 / classified) : null,
    negativePercent: classified ? Math.round(counts.negative * 100 / classified) : null,
    neutralPercent: classified ? Math.round(counts.neutral * 100 / classified) : null,
    averageRating: ratingCount ? Math.round(100 * ratingTotal / ratingCount) / 100 : null,
    rated: ratingCount,
  };
}

async function tmdbReviews(tmdbId, max) {
  if (!Number.isSafeInteger(tmdbId) || tmdbId < 1 || tmdbId > 1000000000) {
    throw new ApiError("Choose a valid TMDB movie.");
  }
  const reviews = [], seen = new Set();
  let page = 1, totalPages = 1;
  while (page <= totalPages && page <= 3 && reviews.length < max) {
    const data = await tmdb("/movie/" + tmdbId + "/reviews", { page });
    totalPages = Math.max(1, Math.min(1000, Number(data.total_pages) || 1));
    for (const item of data.results || []) {
      if (!item.id || seen.has(item.id)) continue;
      const content = String(item.content || "").trim().slice(0, 12000);
      if (!content) continue;
      seen.add(item.id);
      const raw = item.author_details?.rating;
      const rating = typeof raw === "number" && raw > 0 && raw <= 10 ? raw : null;
      reviews.push({
        id: String(item.id), text: content, source: "tmdb", reviewType: "film",
        sourceUrl: "https://www.themoviedb.org/review/" + encodeURIComponent(item.id),
        author: item.author || null, rating,
        sentiment: rating === null ? "Unclassified" : rating >= 7 ? "Positive" : rating > 4 ? "Neutral" : "Negative",
        model: null, metric: "author_rating",
      });
      if (reviews.length >= max) break;
    }
    page++;
  }
  return { reviews, hasMore: page <= totalPages };
}

async function youtubeComments(videoId, max) {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) throw new ApiError("YouTube API is not configured.", 503);
  if (typeof videoId !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(videoId))
    throw new ApiError("Provide a valid 11-character YouTube video ID.");

  const comments = [], seenIds = new Set(), visitedTokens = new Set();
  let token = "", hasMore = false, page = 0;
  // A repeated/empty page token must never hold a serverless function open.
  do {
    if (token && visitedTokens.has(token)) break;
    if (token) visitedTokens.add(token);
    page++;
    const url = new URL(YOUTUBE_BASE);
    for (const [k, v] of Object.entries({
      key, part: "snippet", videoId, maxResults: Math.min(100, max - comments.length),
      textFormat: "plainText", ...(token ? { pageToken: token } : {}),
    })) url.searchParams.set(k, String(v));
    let response;
    try { response = await timeoutRequest(url.toString(), { next: { revalidate: 600 } }); }
    catch { throw new ApiError("Could not reach YouTube Data API.", 502); }
    if (response.status === 403 || response.status === 429)
      throw new ApiError("YouTube API quota or permissions prevented comment retrieval.", 429);
    if (!response.ok) throw new ApiError("YouTube Data API failed (HTTP " + response.status + ").", 502);
    const data = await response.json();
    for (const item of data.items || []) {
      const comment = item.snippet?.topLevelComment;
      const id = String(comment?.id || "");
      const text = String(comment?.snippet?.textOriginal || "").trim().slice(0, 12000);
      if (!id || !text || seenIds.has(id)) continue;
      seenIds.add(id);
      comments.push({
        id, text, source: "youtube", reviewType: "trailer",
        sourceUrl: "https://www.youtube.com/watch?v=" + videoId + "&lc=" + encodeURIComponent(id),
        author: comment.snippet?.authorDisplayName || null, rating: null,
        sentiment: "Unclassified", metric: "none", model: null,
      });
      if (comments.length >= max) break;
    }
    token = String(data.nextPageToken || "");
    hasMore = Boolean(token);
  } while (token && comments.length < max && page < 3);
  return { reviews: comments, hasMore };
}

export async function analyzeMovie(data) {
  const sources = data.sources === undefined ? ["tmdb"] : data.sources;
  if (!Array.isArray(sources) || sources.length < 1 || sources.length > 2 ||
    sources.some(s => !["tmdb", "youtube"].includes(s))) throw new ApiError("Choose one or two enabled sources.");
  const unique = [...new Set(sources)];
  const max = data.maxComments === undefined ? 20 : data.maxComments;
  if (!Number.isInteger(max) || max < 1 || max > 30) throw new ApiError("Select 1–30 reviews per source.");
  if (unique.includes("tmdb") && (!Number.isSafeInteger(Number(data.tmdbId)) || Number(data.tmdbId) < 1)) throw new ApiError("Choose a movie first.");
  if (unique.includes("youtube") && (!Number.isSafeInteger(Number(data.tmdbId)) || Number(data.tmdbId) < 1)) throw new ApiError("Choose a movie for automatic trailer discovery.");

  const result = await Promise.allSettled(unique.map(async source => {
    if(source==="tmdb"){
      const {reviews,hasMore}=await tmdbReviews(Number(data.tmdbId),max);
      return {source,hasMore,comments:reviews,category:"film",
        summary:summary(reviews,"author_rating")};
    }
    const movie=await getSelectedMovie(data.tmdbId);
    const matched=await discoverYouTubeTrailer(movie);
    const {reviews,hasMore}=await youtubeComments(matched.videoId,max);
    return {source,hasMore,comments:reviews,category:"trailer",
      matchedSource:matched,
      summary:summary(reviews,"none")};
  }));
  const successes = [], errors = [];
  result.forEach((entry, index) => {
    if (entry.status === "fulfilled") successes.push(entry.value);
    else errors.push({ source: unique[index], error: entry.reason?.message || "Provider unavailable" });
  });
  const films = successes.flatMap(x => x.category === "film" ? x.comments : []);
  const trailers = successes.flatMap(x => x.category === "trailer" ? x.comments : []);
  return {
    sources: successes, errors,
    summary: summary(films, "author_rating"),
    trailerSummary: summary(trailers),
    note: "Source reviews and trailer comments are separate. Browser AI inference runs on user request; trailer feedback is not film audience satisfaction.",
  };
}
