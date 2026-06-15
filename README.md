# CineSense (Movie Scraper & AI Sentiment Analysis)

CineSense is an intelligent, microservices-based system that bridges the gap between streaming platforms and artificial intelligence. It acts as a real-time data pipeline, extracting user comments from various movie platforms and utilizing Natural Language Processing (NLP) to analyze sentiment, providing users with a "Net Satisfaction Score."

## 🎯 The Problem & Our Solution
**The Problem:** To decide if a movie is worth watching, users typically scroll through dozens of reviews. This leads to wasted time, a high risk of encountering spoilers, and users leaving the streaming platform to check external ratings (like IMDb).

**The Solution:** CineSense automates this workflow:
1. Users search for a movie using a blazing-fast autocomplete UI powered by the TMDB API.
2. The system seamlessly scrapes target websites in the background to gather user reviews.
3. A custom AI model reads every comment to determine the sentiment (Positive, Negative, or Neutral).
4. Users receive a clean, aggregated metric (e.g., "85% User Satisfaction") instead of reading through walls of text, entirely preventing spoilers.

## 🏛 Architecture & Tech Stack

The system is highly scalable and separated into three core microservices:

### 1. Frontend (User Interface)
A lightweight, lightning-fast UI responsible purely for data presentation and user interaction.
*   **Framework:** Next.js 15 (App Router & Turbopack)
*   **UI & Styling:** React 19, Material UI (MUI), Bootstrap, Emotion
*   **Data Fetching:** SWR

### 2. Middleware (Scraper Engine)
Acts as an internal search engine, handling network traffic and raw data collection.
*   **Environment:** Node.js
*   **Framework:** Express.js
*   **Web Scraping:** Playwright
*   **HTTP Client:** Axios

### 3. AI Backend (Sentiment Analysis)
The core intelligence of the system, transforming raw text into actionable data.
*   **Framework:** FastAPI (Python)
*   **Machine Learning:** PyTorch, Hugging Face Transformers
*   **Model:** Fine-tuned BERT for Sentiment Analysis
*   **Server:** Uvicorn

## 💼 Business & B2B Value (SaaS)
Beyond solving user problems, CineSense provides significant value to streaming platform operators:
*   **Increases Retention Rate:** Keeps users on the platform instead of leaving for external review sites.
*   **Boosts Engagement:** Encourages users to leave their own comments to influence the global sentiment score.
*   **Zero Database Overhead:** Provides heavy AI features via a simple API integration without taxing the platform's primary databases.

## 🚀 Getting Started

To run this project locally, you will need to start all three microservices. 

### Prerequisites
*   Node.js (v18+)
*   Python (3.8+)
*   Git

### 1. Start the AI Backend
```bash
cd bertModel
pip install -r requirements.txt
uvicorn main:app --reload
```

### 2. Start the Scraper Middleware
```bash
cd express-scraper
npm install
node index.js
```

### 3. Start the Frontend
```bash
cd movie-scraper
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`.

## 📄 License
This project is licensed under the ISC License.
