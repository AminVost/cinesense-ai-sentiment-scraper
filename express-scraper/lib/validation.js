const { URL } = require("node:url");

class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

function positiveInt(value, fallback = 20, maximum = 100) {
  if (value === undefined || value === null || value === "") return fallback;
  if (!/^[1-9]\d*$/.test(String(value).trim())) {
    throw new RequestError("maxComments must be a positive integer.");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new RequestError("maxComments cannot exceed " + maximum + ".");
  }
  return parsed;
}

function allowedMovieHosts() {
  return (process.env.DIGIMOVIEZ_ALLOWED_HOSTS || "digimoviez44.top")
    .split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
}

function validateMovieUrl(value) {
  let url;
  try { url = new URL(value); } catch (_) {
    throw new RequestError("A valid movie URL is required.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new RequestError("Only HTTPS movie URLs without credentials or custom ports are allowed.");
  }
  const host = url.hostname.toLowerCase();
  if (!allowedMovieHosts().some(allowed => host === allowed || host === "www." + allowed)) {
    throw new RequestError("This domain is not enabled. Configure DIGIMOVIEZ_ALLOWED_HOSTS.");
  }
  return url.href;
}

function validateVideoId(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{11}$/.test(value)) {
    throw new RequestError("A valid 11-character YouTube video ID is required.");
  }
  return value;
}

function normalizeSources(sources) {
  if (sources === undefined) return ["tmdb"];
  if (!Array.isArray(sources) || !sources.length || sources.length > 3) {
    throw new RequestError("Select one or more review sources.");
  }
  const unique = [...new Set(sources)];
  if (unique.some(source => !["tmdb", "digimoviez", "youtube"].includes(source))) {
    throw new RequestError("Unknown review source.");
  }
  return unique;
}

module.exports = { RequestError, positiveInt, allowedMovieHosts, validateMovieUrl, validateVideoId, normalizeSources };
