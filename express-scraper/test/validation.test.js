const test = require("node:test");
const assert = require("node:assert/strict");
const { validateMovieUrl, validateVideoId, positiveInt, normalizeSources } = require("../lib/validation");
const { summarize } = require("../lib/summary");
test("rejects SSRF URLs and unknown hosts", () => {
  for (const url of ["http://127.0.0.1:8000", "https://localhost/", "https://example.com/", "file:///etc/passwd", "https://digimoviez44.top.evil.com/"]) {
    assert.throws(() => validateMovieUrl(url));
  }
  assert.equal(validateMovieUrl("https://digimoviez44.top/movie/"), "https://digimoviez44.top/movie/");
});
test("validates limits, video IDs and sources", () => {
  assert.equal(positiveInt(undefined), 20);
  assert.equal(positiveInt("10"), 10);
  assert.throws(() => positiveInt(-1));
  assert.throws(() => positiveInt(101));
  assert.throws(() => validateVideoId("bad"));
  assert.equal(validateVideoId("dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.deepEqual(normalizeSources(["tmdb", "tmdb", "youtube"]), ["tmdb", "youtube"]);
  assert.throws(() => normalizeSources(["forged"]));
});
test("summarizes classified and unclassified separately", () => {
  const summary = summarize([{ sentiment: "Positive" }, { sentiment: "Neutral" }, { sentiment: "Negative" }, { sentiment: "Unavailable" }]);
  assert.equal(summary.total, 4);
  assert.equal(summary.classified, 3);
  assert.equal(summary.positivePercent, 33);
  assert.equal(summary.unclassified, 1);
});
