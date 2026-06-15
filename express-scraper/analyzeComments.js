const axios = require("axios");

/**
 * Send extracted comments to AI model for parallel sentiment analysis.
 * @param {Array} comments - List of comments to be analyzed.
 * @returns {Promise<Array>} - Processed comments with sentiment analysis.
 */
async function analyzeComments(comments) {
  console.log(`Starting analyzeComments for ${comments.length} items`);

  try {
    // Define the chunk size for parallel processing (10 comments per request)
    const chunkSize = 10;
    const chunkedRequests = [];

    // Split the array into smaller chunks
    for (let i = 0; i < comments.length; i += chunkSize) {
      const chunk = comments.slice(i, i + chunkSize);
      
      const requestData = {
        comments: chunk.map((text, index) => ({ id: i + index + 1, text })),
      };

      // Create a promise for each chunk request
      const requestPromise = axios.post("http://127.0.0.1:8000/analyze", requestData, {
        headers: { "Content-Type": "application/json" },
      });

      chunkedRequests.push(requestPromise);
    }

    console.log(`🚀 Dispatching ${chunkedRequests.length} parallel requests to AI model...`);

    // Execute all chunk requests simultaneously using Promise.all
    const responses = await Promise.all(chunkedRequests);

    // Merge the results from all responses into a single flat array
    const mergedResults = responses.flatMap(response => response.data.results);

    console.log("✅ AI parallel analysis completed successfully!");

    return mergedResults;
  } catch (error) {
    console.error("❌ Error analyzing comments:", error.message);
    throw new Error("🚨 Failed to analyze comments. Please try again later.");
  }
}

module.exports = { analyzeComments };