import test from "node:test";
import assert from "node:assert/strict";
import { available, searchMovies, analyzeMovie } from "../lib/vercel-api.js";

const originalFetch = globalThis.fetch;
const originalToken = process.env.TMDB_READ_ACCESS_TOKEN;
const originalYoutube = process.env.YOUTUBE_API_KEY;
test.before(() => {
  process.env.TMDB_READ_ACCESS_TOKEN = "unit-test-token";
  process.env.YOUTUBE_API_KEY = "unit-test-youtube";
  globalThis.fetch = async url => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("/search/movie"))
      return { ok: true, status: 200, json: async () => ({ results: [{ id: 157336, title: "Interstellar", release_date: "2014-11-05" }] }) };
    if (parsed.pathname.endsWith("/reviews"))
      return { ok: true, status: 200, json: async () => ({ total_pages: 1, results: [
        { id: "r1", content: "Incredible", author: "alice", author_details: { rating: 9 } },
        { id: "r2", content: "It was okay", author_details: { rating: 5 } },
        { id: "r3", content: "No score given", author_details: { rating: null } },
      ] }) };
    if (parsed.hostname === "www.googleapis.com")
      return { ok: true, status: 200, json: async () => ({ items: [
        { snippet: { topLevelComment: { id: "yc1", snippet: { textOriginal: "Cool trailer" } } } },
      ] }) };
    return { ok: false, status: 404 };
  };
});
test.after(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.TMDB_READ_ACCESS_TOKEN;
  else process.env.TMDB_READ_ACCESS_TOKEN = originalToken;
  if (originalYoutube === undefined) delete process.env.YOUTUBE_API_KEY;
  else process.env.YOUTUBE_API_KEY = originalYoutube;
});
test("provider flags and movie lookup are available with configured secrets", async () => {
  assert.equal(available().tmdb.enabled, true);
  assert.equal(available().digimoviez.enabled, false);
  const matches = await searchMovies("Interstellar");
  assert.equal(matches[0].id, 157336);
});
test("TMDB author ratings never masquerade as AI predictions", async () => {
  const data = await analyzeMovie({ sources: ["tmdb"], tmdbId: 157336, maxComments: 20 });
  assert.equal(data.summary.total, 3);
  assert.equal(data.summary.classified, 2);
  assert.equal(data.summary.positivePercent, 50);
  assert.equal(data.summary.averageRating, 7);
  assert.equal(data.sources[0].comments[2].sentiment, "Unclassified");
  assert.equal(data.sources[0].comments[0].model, null);
});
test("trailer comments are excluded from movie metrics", async () => {
  const data = await analyzeMovie({ sources: ["tmdb", "youtube"], tmdbId: 157336, youtubeVideoId: "dQw4w9WgXcQ", maxComments: 20 });
  assert.equal(data.summary.total, 3);
  assert.equal(data.trailerSummary.total, 1);
  assert.equal(data.trailerSummary.positivePercent, null);
});
test("invalid and scraper requests are rejected without upstream calls", async () => {
  await assert.rejects(analyzeMovie({ sources: ["digimoviez"], digimoviezUrl: "http://127.0.0.1" }));
  await assert.rejects(analyzeMovie({ sources: ["tmdb"], tmdbId: 157336, maxComments: 10000 }));
  await assert.rejects(searchMovies("a"));
});
