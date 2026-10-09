require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { fetchComments } = require("./scraper");
const { analyzeMovie } = require("./lib/multiSource");
const { positiveInt, validateMovieUrl, RequestError } = require("./lib/validation");
const tmdb = require("./providers/tmdb");
const youtube = require("./providers/youtube");

const app = express();
app.use(express.json({ limit: "16kb" }));
const origins = (process.env.CORS_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000").split(",").map(value => value.trim()).filter(Boolean);
app.use(cors({ origin(origin, callback) {
  if (!origin || origins.includes(origin)) return callback(null, true);
  return callback(new RequestError("Origin not allowed.", 403));
} }));

function replyError(res, error) {
  console.error("[API]", error.message);
  return res.status(error.status || 500).json({ error: error.status ? error.message : "Internal Server Error" });
}

app.get("/api/providers", (_req, res) => res.json({
  tmdb: { enabled: tmdb.configured(), type: "movie" },
  digimoviez: { enabled: true, type: "movie", requiresUrl: true },
  youtube: { enabled: youtube.configured(), type: "trailer", requiresVideoId: true },
}));

app.post("/api/search-movie", async (req, res) => {
  try { res.json({ results: await tmdb.searchMovies(req.body?.query) }); }
  catch (error) { replyError(res, error); }
});

app.post("/api/analyze-movie", async (req, res) => {
  try { res.json(await analyzeMovie(req.body)); }
  catch (error) { replyError(res, error); }
});

app.post("/api/fetch-comments", async (req, res) => {
  try {
    const url = validateMovieUrl(req.body?.url);
    const maxComments = positiveInt(req.body?.maxComments, 20, 100);
    const result = await fetchComments(url, maxComments);
    if (result.error) throw new RequestError(result.error, 502);
    res.json(result);
  } catch (error) { replyError(res, error); }
});
// Bind only to loopback by default: this service is not a public proxy.
app.use((error, _req, res, _next) => replyError(res, error));
if (require.main === module) {
  app.listen(Number(process.env.PORT) || 5000, process.env.HOST || "127.0.0.1",
    () => console.log("CineSense scraper API started"));
}
module.exports = app;
