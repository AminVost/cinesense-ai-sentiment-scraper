require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { fetchComments, closeScraper } = require("./scraper");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

app.post("/api/fetch-comments", async (req, res) => {
  try {
    const { url , maxComments } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const result = await fetchComments(url ,maxComments);
    res.json(result);
  } catch (error) { 
    console.error("❌ Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
