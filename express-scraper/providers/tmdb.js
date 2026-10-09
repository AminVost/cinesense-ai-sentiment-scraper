const axios = require("axios");
const { RequestError } = require("../lib/validation");

function configured() {
  return Boolean(process.env.TMDB_READ_ACCESS_TOKEN || process.env.TMDB_API_KEY);
}

async function tmdbGet(path, params = {}) {
  if (!configured()) throw new RequestError("TMDB key is not configured on the server.", 503);
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  try {
    const response = await axios.get("https://api.themoviedb.org/3" + path, {
      params: token ? params : { ...params, api_key: process.env.TMDB_API_KEY },
      headers: token ? { Authorization: "Bearer " + token } : {},
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    // Never log Axios' full error/config object: it can contain TMDB credentials.
    const status = error.response?.status;
    const rawCode = error.code || error.cause?.code || "UNKNOWN";
    const code = /^[A-Z_0-9]+$/.test(rawCode) ? rawCode : "UNKNOWN";
    console.error("[TMDB] request error", { path, status: status || "no_http_response", code });
    if (status === 429) throw new RequestError("TMDB rate limit reached.", 429);
    if (status === 401 || status === 403) throw new RequestError("TMDB credentials rejected.", 502);
    if (status === 404) throw new RequestError("Movie was not found in TMDB.", 404);
    if (!status) throw new RequestError("TMDB network connection failed (" + code + "). Check VPN/proxy/DNS from the Node.js process.", 502);
    throw new RequestError("TMDB request failed (HTTP " + status + ").", 502);
  }
}

async function searchMovies(query) {
  if (typeof query !== "string" || query.trim().length < 2 || query.length > 120) {
    throw new RequestError("Movie search requires 2 to 120 characters.");
  }
  const data = await tmdbGet("/search/movie", { query: query.trim(), include_adult: false, page: 1 });
  return (data.results || []).slice(0, 15).map(movie => ({
    id: movie.id, title: movie.title, original_title: movie.original_title,
    release_date: movie.release_date || "", poster_path: movie.poster_path || null,
  }));
}

async function fetchTmdbReviews(tmdbId, maxComments) {
  if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) {
    throw new RequestError("A valid TMDB movie ID is required.");
  }
  const reviews = [];
  const seen = new Set();
  let page = 1;
  let totalPages = 1;
  while (reviews.length < maxComments && page <= totalPages && page <= 10) {
    const data = await tmdbGet("/movie/" + tmdbId + "/reviews", { page });
    totalPages = Number(data.total_pages) || 1;
    for (const review of data.results || []) {
      const text = String(review.content || "").trim();
      if (!text || seen.has(review.id)) continue;
      seen.add(review.id);
      reviews.push({
        id: String(review.id), text, source: "tmdb",
        sourceUrl: review.url || "https://www.themoviedb.org/movie/" + tmdbId,
        author: review.author || null, reviewType: "film",
      });
    }
    page++;
  }
  return { reviews: reviews.slice(0, maxComments), hasMore: reviews.length > maxComments || page <= totalPages };
}

module.exports = { configured, searchMovies, fetchTmdbReviews };
