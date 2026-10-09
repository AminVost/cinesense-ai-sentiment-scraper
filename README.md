# CineSense — Multi-Source Movie Reviews

CineSense is a self-hosted prototype that collects permitted film reviews and classifies their sentiment. No paid AI subscription or paid API is required. You still need free API credentials, an internet connection for first-time model downloads, and your own CPU/RAM.

## Providers

| Provider | Data | Configuration | Notes |
| --- | --- | --- | --- |
| TMDB | Written movie reviews and search | Free `TMDB_READ_ACCESS_TOKEN` or `TMDB_API_KEY` | API is primarily for non-commercial use, with required attribution. |
| DigiMoviez | Comments for an individual movie URL | `DIGIMOVIEZ_ALLOWED_HOSTS` | Playwright; only enable sites you have permission to scrape. |
| YouTube | Trailer comments | Optional free `YOUTUBE_API_KEY` | A video ID must be entered manually; trailer reactions are not added to film satisfaction. |

*Note:* "free" is not synonymous with unlimited or commercially licensed. YouTube API has quota and separate data restrictions; TMDB's usage/attribution terms apply.

## Start locally

Requirements: Node.js 22, Python 3.10+, Chromium for Playwright, available RAM for local BERT models.

1. `cd bertModel`, create a Python virtual environment, then run `pip install -r requirements.txt` and `uvicorn fastApi:app --host 127.0.0.1 --port 8000`.
2. In `express-scraper`, copy `.env.example` to `.env` and put in a **free** TMDB token/key. Set `YOUTUBE_API_KEY` only if desired. Run `npm ci`, `npx playwright install chromium`, then `npm start`.
3. In `movie-scraper`, run `npm ci` and `npm run dev`.
4. Open `http://localhost:3000`. The original single-URL interface remains at `/direct-url`.

**AI model behavior:** The inference service starts without prompting for input or downloading models. It downloads a model from Hugging Face on the first matching request if it is not already cached. A disconnected machine must pre-download required models. Persian: `HooshvareLab/bert-fa-base-uncased-sentiment-deepsentipers-binary`, unless a `fine_tuned_model` folder exists. English, French, German, Spanish, Italian and Dutch: `nlptown/bert-base-multilingual-uncased-sentiment`. Other languages return `Unclassified` (not falsely `Negative`). Model outputs are estimates, not verified satisfaction or calibrated probabilities.

## API

- `GET /api/providers`: currently configured providers
- `POST /api/search-movie`: `{"query":"Interstellar"}`
- `POST /api/analyze-movie`: `{"tmdbId":157336,"sources":["tmdb"],"maxComments":20}`
- Add `digimoviezUrl` for `digimoviez` or `youtubeVideoId` for `youtube`. The latter is an **11-character ID**, not a full URL.
- `POST /api/fetch-comments`: compatible legacy endpoint, restricted to enabled HTTPS movie hosts

Returned `sources[]` each have their own data, `summary` covers film reviews only, `trailerSummary` covers YouTube only, and `errors[]` indicates partial failures.

## Automated checks

GitHub Actions runs dependency-free validation tests, JavaScript/Python syntax checks, Node package installation, mocked API integration tests, and a Next.js production build. A green workflow does **not** imply real API credentials, successful live scraping, or validated sentiment accuracy. These still need end-to-end tests.

## Security and limitations

Express listens on `127.0.0.1` by default. The existing scraper blocks off-allowlist network requests, navigation redirects, WebSockets, and service workers, and limits concurrent browsers/pagination. Keep it behind a trusted gateway if deployed. Public deployment still requires user authentication, abuse/rate limiting, compliance with source terms, and real-world reliability testing. Some websites need scripts from external hosts, which are intentionally blocked until explicitly and safely supported.

The training examples in `bertModel/fine_tuned_data.json` contain duplicates and self-generated labels, not a valid accuracy dataset. Create a human-reviewed evaluation dataset before claiming model accuracy.

Repository source code is MIT licensed; this **does not** license third-party review content.
