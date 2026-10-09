const test = require("node:test");
const assert = require("node:assert/strict");

// Stub provider boundaries before loading the orchestration/server modules.
const tmdb = require("../providers/tmdb");
const youtube = require("../providers/youtube");
const inference = require("../analyzeComments");

tmdb.searchMovies = async query => [{ id: 157336, title: query, release_date: "2014-01-01" }];
tmdb.fetchTmdbReviews = async () => ({
  reviews: [{ id: "review-1", text: "Great film", source: "tmdb", reviewType: "film", sourceUrl: "https://www.themoviedb.org/review/1" }],
  hasMore: false,
});
youtube.fetchYoutubeComments = async () => ({
  reviews: [{ id: "video-1", text: "Awful trailer", source: "youtube", reviewType: "trailer", sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }],
  hasMore: false,
});
inference.analyzeComments = async texts => texts.map((text, index) => ({
  id: index + 1, text, sentiment: text.includes("Great") ? "Positive" : "Negative",
  positive: text.includes("Great") ? "95%" : "5%",
  negative: text.includes("Great") ? "5%" : "95%", neutral: "0%",
  model: "mock",
}));

const app = require("../server");
let server;
let base;

test.before(async () => {
  await new Promise(resolve => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = "http://127.0.0.1:" + server.address().port;
});
test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

async function post(path, body) {
  const response = await fetch(base + path, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

test("movie search serves TMDB results", async () => {
  const r = await post("/api/search-movie", { query: "Interstellar" });
  assert.equal(r.status, 200);
  assert.equal(r.data.results[0].id, 157336);
});

test("movie reviews and trailer reactions are kept separate", async () => {
  const r = await post("/api/analyze-movie", {
    tmdbId: 157336, sources: ["tmdb", "youtube"], youtubeVideoId: "dQw4w9WgXcQ", maxComments: 5,
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.sources.length, 2);
  assert.equal(r.data.summary.positivePercent, 100);
  assert.equal(r.data.summary.total, 1);
  assert.equal(r.data.trailerSummary.positivePercent, 0);
  assert.equal(r.data.trailerSummary.total, 1);
});

test("invalid URLs and oversized requests fail before the browser starts", async () => {
  const invalid = await post("/api/fetch-comments", { url: "http://127.0.0.1/admin", maxComments: 20 });
  assert.equal(invalid.status, 400);
  const overLimit = await post("/api/analyze-movie", { tmdbId: 157336, sources: ["tmdb"], maxComments: 9999 });
  assert.equal(overLimit.status, 400);
});

test("one failed provider does not discard results from successful providers", async () => {
  const original = youtube.fetchYoutubeComments;
  youtube.fetchYoutubeComments = async () => { throw new Error("Provider unavailable"); };
  try {
    const r = await post("/api/analyze-movie", {
      tmdbId: 157336, sources: ["tmdb", "youtube"], youtubeVideoId: "dQw4w9WgXcQ", maxComments: 5,
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.sources.length, 1);
    assert.equal(r.data.errors.length, 1);
    assert.equal(r.data.summary.positivePercent, 100);
  } finally {
    youtube.fetchYoutubeComments = original;
  }
});
