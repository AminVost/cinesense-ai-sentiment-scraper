# CineSense: active architecture and operating limits

## Production (Vercel)
`movie-scraper/` is the **only production application**. It runs Next.js App Router (Node.js routes) on Vercel. The current interface is `/multi-source` (also exposed through `/`). The old `/direct-url` and `/direct-name` routes redirect to it.

```
TMDB title search ──> /api/search-movie ──> TMDB API (public search)
                  └──> selected TMDB film ID
Movie fetch ─────────> /api/analyze-movie ──> TMDB reviews
                                   └─────────> YouTube Data API trailer search + comments
                    └─> /api/fetch-comments ─> DigiMoviez: Playwright + Chromium on Vercel
Reviews in browser ─> Web Worker ──────────> Transformers.js + ONNX inference
```

### Model execution
- The server **does not run BERT, Python, GPU or model inference**. The user explicitly starts the browser worker `/sentiment.worker.js`.
- Multilingual: `Xenova/bert-base-multilingual-uncased-sentiment` via Transformers.js/WASM, quantized q8. Label distribution from the model's 1–5 stars is collapsed into negative/neutral/positive.
- Persian: public model configured by `PERSIAN_BROWSER_MODEL_ID` (the project's `Aminvost/cinesense-persian-sentiment-onnx`). It is binary positive/negative; **do not invent a neutral label**.
- Inference happens in the user's browser, downloads models on first use, and is subject to device memory, browser permissions and model-host availability. Unsupported comments remain `Unclassified`. A failure loading one model no longer blocks another language.
- TMDB *author ratings* are independent of AI text predictions. YouTube trailer feedback is not counted as film satisfaction.

### Data sources
- `TMDB_READ_ACCESS_TOKEN` (or `TMDB_API_KEY`) for TMDB public movie lookup and film reviews.
- `YOUTUBE_API_KEY` for official YouTube Data API search and trailer commentThreads, kept server-only. Searches reuse a 6-hour Next.js fetch cache; commentThreads cache 10 minutes.
- DigiMoviez uses a Chromium browser inside the Vercel `/api/fetch-comments` serverless function, not in the user's browser. Domain allowlisting, no cross-domain subresources, no downloads, and title/year checks bound activity to one selected film. Fetching comments is **not** a continuously running background crawler. Public source-derived results are cached for **30 minutes** by Next.js Data Cache.
- `CINESENSE_SCRAPER_ACCESS_CODE` is a server-side secret, required for YouTube and DigiMoviez. Never commit, send or print it. Rotate it if disclosed.

### Request budgets (best effort only)
- Maximum POST JSON size: 4 KB of **actual streamed bytes**.
- Public movie search: 18 per minute per client and 90 per minute per warm instance.
- YouTube analysis requests: 5 per minute per client and 12 per minute per warm instance.
- TMDB-only analysis: 24 per minute per client.
- DigiMoviez: 3 per minute per client, 8 per minute per warm instance, at most **one active Chromium job per warm instance**.
- All limits above are **per warm serverless function instance**, not global across Vercel's instances or regions. There is **no distributed queue or globally consistent rate limiter**. Before releasing this app for anonymous/public crawling, integrate a shared Redis-backed limiter or platform WAF and a queue, plus durable monitoring.
- Each DigiMoviez request returns at most 10 comments; TMDB and YouTube return up to 30 each. Scraper's maxDuration is 60 seconds at route level; the actual effective runtime is governed by plan limits.
- External API quotas remain independent (especially YouTube `search.list` is quota-expensive). Cache is not a guarantee for every region/instance.

## Research and development (not on Vercel)
- `express-scraper/`: **legacy/local-only** Express and Playwright prototype, defaults to loopback. Not served by the deployed Next app.
- `bertModel/`: optional Python training, offline evaluation and local FastAPI inference. Not running in production or billed to Vercel.
- Keep these separated to avoid inadvertently deploying a second crawler or Python inference service.

## Development / verification
```bash
cd movie-scraper
npm ci
node --test test/*.test.mjs
npm run build
npm run dev
```
All credentials are configured as server-only Vercel Environment Variables, never `NEXT_PUBLIC_*`.
Real browser UI tests live in GitHub Actions; the expensive live DigiMoviez smoke should remain opt-in. Tests use fixtures and must not burn YouTube production quota in CI.

### Priorities for a larger public launch
1. Replace per-instance limiter with centralized token bucket (Redis or platform WAF), queue and distributed locks.
2. Add durable structured tracing and alerting; set provider quota/budget alerts.
3. Establish automated *human-labeled* Persian/English model evaluation before claiming classification accuracy.
4. Split UI from `app/multi-source/page.js` into small modules (data hooks, source selector, report, reviews), with explicit integration tests.
