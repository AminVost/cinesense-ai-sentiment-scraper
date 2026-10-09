const axios = require("axios");
const { RequestError, validateVideoId } = require("../lib/validation");

function configured() { return Boolean(process.env.YOUTUBE_API_KEY); }

async function fetchYoutubeComments(videoId, maxComments) {
  validateVideoId(videoId);
  if (!configured()) throw new RequestError("YouTube API key is not configured.", 503);
  const reviews = [];
  let pageToken;
  let hasMore = false;
  try {
    do {
      const response = await axios.get("https://www.googleapis.com/youtube/v3/commentThreads", {
        params: {
          key: process.env.YOUTUBE_API_KEY, part: "snippet", videoId,
          maxResults: Math.min(100, maxComments - reviews.length),
          textFormat: "plainText", order: "relevance",
          ...(pageToken ? { pageToken } : {}),
        },
        timeout: 15000,
      });
      const data = response.data;
      for (const thread of data.items || []) {
        const comment = thread.snippet?.topLevelComment;
        const text = String(comment?.snippet?.textOriginal || comment?.snippet?.textDisplay || "").trim();
        if (!text) continue;
        reviews.push({
          id: String(comment.id), text, source: "youtube",
          sourceUrl: "https://www.youtube.com/watch?v=" + videoId + "&lc=" + comment.id,
          author: comment.snippet?.authorDisplayName || null, reviewType: "trailer",
        });
      }
      pageToken = data.nextPageToken;
      hasMore = Boolean(pageToken);
    } while (pageToken && reviews.length < maxComments);
    return { reviews: reviews.slice(0, maxComments), hasMore };
  } catch (error) {
    if (error.status) throw error;
    if (error.response?.status === 403) throw new RequestError("YouTube API denied access or quota is exhausted.", 502);
    throw new RequestError("YouTube comment request failed.", 502);
  }
}

module.exports = { configured, fetchYoutubeComments };
