# CineSense — Multi-Source Movie Reviews

CineSense is a self-hosted prototype that collects permitted film reviews and classifies their sentiment. No paid AI subscription or paid API is required. You still need free API credentials, an internet connection for first-time model downloads, and your own CPU/RAM.

## Providers

| Provider | Data | Configuration | Notes |
| --- | --- | --- | --- |
| TMDB | Written movie reviews and search | Free `TMDB_READ_ACCESS_TOKEN` or `TMDB_API_KEY` | API is primarily for non-commercial use, with required attribution. |
| DigiMoviez | Comments for an individual movie URL | `DIGIMOVIEZ_ALLOWED_HOSTS` | Playwright; only enable sites you have permission to scrape. |
| YouTube | Trailer comments | Optional free `YOUTUBE_API_KEY` | A video ID must be entered manually; trailer reactions are not added to film satisfaction. |

*Note:* "free" is not synonymous with unlimited or commercially licensed. YouTube API has quota and separate data restrictions; TMDB's usage/attribution terms apply.


## Deploy on Vercel Hobby

Import the GitHub repository as a **new Vercel project** using Root Directory `movie-scraper`. Configure a server-only `TMDB_READ_ACCESS_TOKEN` in the project settings. The Vercel-compatible API routes are built into Next.js and do not require Express/Python for official source reviews. The cloud edition supports **browser-local, opt-in sentiment inference** with a quantized Hugging Face model (approximately 168 MB on first load) and an **experimental bounded Playwright scraper** for DigiMoviez on Vercel Functions. Browser AI supports English and five European languages; Persian model inference remains in the local Python service. The cloud UI shows author ratings and AI-inferred text sentiment separately; neither is a verified audience-satisfaction survey. DigiMoviez availability depends on the site's reachability, selectors, and permission to scrape. For the subdomain `cinesense.aminvost.ir`, see [VERCEL_DEPLOY.md](movie-scraper/VERCEL_DEPLOY.md). Vercel Hobby and TMDB developer API are for non-commercial usage subject to their conditions.

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
- For Vercel: use `POST /api/fetch-comments` with `{ "url": "https://digimoviez.com/the-invite-2026/", "maxComments": 10 }`; this on-demand Chromium endpoint is **experimental**. YouTube accepts `youtubeVideoId` (an 11-character ID).
- For self-hosted Express only: `POST /api/analyze-movie` also accepts `digimoviez` as a source.
- `POST /api/fetch-comments`: compatible legacy endpoint, restricted to enabled HTTPS movie hosts

Returned `sources[]` each have their own data, `summary` covers film reviews only, `trailerSummary` covers YouTube only, and `errors[]` indicates partial failures.

## Automated checks

GitHub Actions runs dependency-free validation tests, JavaScript/Python syntax checks, Node package installation, mocked API integration tests, and a Next.js production build. A green workflow does **not** imply real API credentials, successful live scraping, or validated sentiment accuracy. These still need end-to-end tests.

## Security and limitations

Express listens on `127.0.0.1` by default. The existing scraper blocks off-allowlist network requests, navigation redirects, WebSockets, and service workers, and limits concurrent browsers/pagination. Keep it behind a trusted gateway if deployed. Public deployment still requires user authentication, abuse/rate limiting, compliance with source terms, and real-world reliability testing. Some websites need scripts from external hosts, which are intentionally blocked until explicitly and safely supported.

The historical file `bertModel/fine_tuned_data.json` has duplicated pseudo-labels; it is **not used** for training. The repaired `hooshFineTune.py` now requires a manually reviewed JSONL file, at least 50 unique labeled texts with both classes represented, and a held-out split. To train (optional), install `bertModel/requirements-training.txt` and run `python hooshFineTune.py --data labeled_comments.jsonl`. Each line must be a JSON object such as `{"text":"فیلم خوبی بود","label":1}` (1 positive, 0 negative). A much larger annotated dataset is recommended for meaningful accuracy.

Repository source code is MIT licensed; this **does not** license third-party review content.

## Verified free cloud smoke tests (October 9, 2026)

- **TMDB:** Live search and review retrieval succeeded using the private Vercel environment token.
- **DigiMoviez:** Live on-demand headless Chromium extraction on Vercel returned HTTP 200 and **3 real comments** from `https://digimoviez.com/the-invite-2026/`. The deprecated `digimoviez44.top` no longer resolves on the deployment. This does not guarantee future access or permission from the source.
- **Browser AI:** A real headless Chrome instance loaded `Xenova/bert-base-multilingual-uncased-sentiment`, classified an English positive sentence and returned an estimated Positive probability of about **0.981**.
- **Persian browser model:** Verified free Hugging Face repo `Aminvost/cinesense-persian-sentiment-onnx`. End-to-end Chromium test successfully inferred **Positive** and **Negative** for two natural Persian review sentences on the production site. The binary model does not classify a neutral class and independent film-review accuracy evaluation is still pending.

Both cloud checks run without any paid AI endpoint. They rely on external availability (DigiMoviez and Hugging Face CDN) and Vercel Hobby's finite included usage limits. The Vercel scraper is now **owner-code protected**: requests without the sensitive `CINESENSE_SCRAPER_ACCESS_CODE` get HTTP 401 before starting Chromium. The access code is stored in Vercel Environment Variables and entered into the browser only when the owner uses DigiMoviez. This access gate protects the included Hobby quota from anonymous calls but does not replace a distributed rate limiter for a public SaaS. Vercel Firewall API rule creation returned 404 in this project; no firewall IP-limit is claimed.

### Persian browser AI status
Persian BERT was exported to quantized ONNX (~164 MB model weights) and published in the owner's [free Hugging Face public repository](https://huggingface.co/Aminvost/cinesense-persian-sentiment-onnx). Vercel Environment Variable `PERSIAN_BROWSER_MODEL_ID=Aminvost/cinesense-persian-sentiment-onnx` is active in Production and Preview. The real [Persian browser inference workflow](https://github.com/AminVost/cinesense-ai-sentiment-scraper/actions/runs/37983757358) passed after production redeployment with separate positive and negative Persian inputs. Models run locally inside the user's browser without a paid API or server GPU, but first download requires reliable access to model assets. Use [Persian hosting notes](movie-scraper/PERSIAN_ONNX_HOSTING.md) for maintenance and attribution.

### Real sentiment evaluation
Run `node movie-scraper/tools/evaluate-sentiment.mjs human-gold.jsonl actual-predictions.jsonl` using independent human-annotated review labels. Metrics include by-language accuracy, macro-F1 and coverage. Test fixtures are *only tests of the scoring formula*, not scientific evidence of model accuracy. Claim no accuracy rate without a sufficiently large real evaluation sample.

### Optional YouTube setup
Enable the free YouTube Data API v3 in your Google Cloud account, create a restricted key and store it as `YOUTUBE_API_KEY` on Vercel in Production (and Preview if used), then redeploy. Trailer reactions remain separate from movie satisfaction. No project access exists to create a Google Cloud key on the owner's behalf.

