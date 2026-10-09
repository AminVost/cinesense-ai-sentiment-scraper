const axios = require("axios");
const AI_URL = (process.env.AI_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "") + "/analyze/";

async function analyzeComments(comments) {
  if (!Array.isArray(comments) || !comments.length) return [];
  const chunks = [];
  for (let i = 0; i < comments.length; i += 10) chunks.push({ index: i, texts: comments.slice(i, i + 10) });
  const results = [];
  for (let i = 0; i < chunks.length; i += 2) {
    const responses = await Promise.all(chunks.slice(i, i + 2).map(async chunk => {
      const response = await axios.post(AI_URL, {
        comments: chunk.texts.map((text, offset) => ({ id: chunk.index + offset + 1, text })),
      }, { timeout: 90000, headers: { "Content-Type": "application/json" } });
      if (!Array.isArray(response.data.results) || response.data.results.length !== chunk.texts.length) {
        throw new Error("AI model returned an invalid response.");
      }
      return response.data.results;
    }));
    results.push(...responses.flat());
  }
  return results;
}
module.exports = { analyzeComments };
