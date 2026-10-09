# CineSense — Free Multi-Source Movie Review Analysis

CineSense gathers film opinions from permitted sources and analyzes sentiment with locally hosted AI. Free API keys, quotas, platform terms and your own compute resources still apply.

## Providers

- TMDB: official API for movie search and reviews. Configure a free TMDB v4 Read Access Token or API key (non-commercial API terms and attribution apply).
- DigiMoviez: optional pre-existing Playwright scraper restricted to allowlisted HTTPS domains, subject to permission and changes to page structure.
- YouTube: optional YouTube Data API for top-level trailer comments. Needs an API key and free quota. Trailer reactions are never mixed into film review satisfaction.

## Local start

1. In bertModel: pip install -r requirements.txt and uvicorn fastApi:app --host 127.0.0.1 --port 8000
2. In express-scraper: copy .env.example to .env, configure TMDB credential, npm ci, npx playwright install chromium, npm start
3. In movie-scraper: npm ci, npm run dev
4. Open http://localhost:3000 (legacy UI remains at /direct-url).

## API

GET /api/providers
POST /api/search-movie — JSON body: {"query":"Interstellar"}
POST /api/analyze-movie — JSON body: {"tmdbId":157336,"sources":["tmdb"],"maxComments":20}
Optional source-specific fields: digimoviezUrl (digimoviez), youtubeVideoId (youtube).
POST /api/fetch-comments — legacy extractor, now restricted by the configured HTTPS host allowlist.

The response separates source summaries, movie satisfaction, trailer reaction statistics and per-source errors.

## Important limitations

Do not publish the scraper as a public open proxy. URL redirects, rate limiting, authentication, quotas and provider licenses still require production hardening.
The original AI model is a Persian binary classifier, not a validated multilingual review model. International reviews require a multilingual classifier before percentage outputs can be trusted. Self-labelled fine-tuning data are not a reliable accuracy benchmark.

Repository code license: MIT. Third-party content follows each provider's terms.
