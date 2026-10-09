const { fetchComments } = require("../scraper");
const { analyzeComments } = require("../analyzeComments");
const tmdb = require("../providers/tmdb");
const youtube = require("../providers/youtube");
const { validateMovieUrl, validateVideoId, positiveInt, normalizeSources, RequestError } = require("./validation");
const { summarize } = require("./summary");

async function analyzeRawReviews(reviews) {
  if (!reviews.length) return [];
  const analyzed = await analyzeComments(reviews.map(r => String(r.text).slice(0, 12000)));
  if (analyzed.length !== reviews.length) throw new RequestError("AI returned an incomplete result.", 502);
  return reviews.map((review, index) => ({
    ...review, sentiment: analyzed[index].sentiment,
    positive: analyzed[index].positive, negative: analyzed[index].negative,
    neutral: analyzed[index].neutral ?? null,
    model: analyzed[index].model || "unknown", language: analyzed[index].language || null,
  }));
}

async function analyzeMovie(body = {}) {
  const sources = normalizeSources(body.sources);
  const maxComments = positiveInt(body.maxComments, 20, 100);
  if (sources.includes("tmdb") && (!Number.isSafeInteger(Number(body.tmdbId)) || Number(body.tmdbId) <= 0)) {
    throw new RequestError("Select a TMDB movie first.");
  }
  if (sources.includes("digimoviez")) validateMovieUrl(body.digimoviezUrl);
  if (sources.includes("youtube")) validateVideoId(body.youtubeVideoId);

  const tasks = sources.map(async source => {
    let reviews, hasMore;
    if (source === "tmdb") {
      ({ reviews, hasMore } = await tmdb.fetchTmdbReviews(Number(body.tmdbId), maxComments));
      reviews = await analyzeRawReviews(reviews);
    } else if (source === "digimoviez") {
      const url = validateMovieUrl(body.digimoviezUrl);
      const legacy = await fetchComments(url, maxComments);
      if (legacy.error) throw new RequestError(legacy.error, 502);
      hasMore = legacy.hasMore;
      reviews = legacy.comments.map((c, i) => ({
        ...c, id: "digimoviez-" + i, source: "digimoviez",
        sourceUrl: url, reviewType: "film", neutral: c.neutral || "0.00%",
      }));
    } else {
      ({ reviews, hasMore } = await youtube.fetchYoutubeComments(body.youtubeVideoId, maxComments));
      reviews = await analyzeRawReviews(reviews);
    }
    return { source, comments: reviews, hasMore, summary: summarize(reviews),
      category: source === "youtube" ? "trailer" : "film" };
  });

  const settled = await Promise.allSettled(tasks);
  const results = [], errors = [];
  settled.forEach((entry, index) => {
    if (entry.status === "fulfilled") results.push(entry.value);
    else errors.push({ source: sources[index], error: entry.reason?.message || "Source unavailable" });
  });
  const filmComments = results.flatMap(r => r.comments).filter(c => c.reviewType === "film");
  const trailerComments = results.flatMap(r => r.comments).filter(c => c.reviewType === "trailer");
  return {
    sources: results, errors,
    summary: summarize(filmComments), trailerSummary: summarize(trailerComments),
    note: "YouTube trailer reactions are excluded from the movie satisfaction score.",
  };
}
module.exports = { analyzeMovie, analyzeRawReviews };
