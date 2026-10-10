# CineSense — Film Review Intelligence

**Production:** [cinesense.aminvost.ir](https://cinesense.aminvost.ir) — Next.js 15 + Vercel Functions.

This repository contains an active free-tier web app **and two older R&D projects**. For authoritative architectural details, operational limitations, security boundaries and deployment commands, read **[movie-scraper/README.md](movie-scraper/README.md)**.

## Current production architecture

| Directory | Status | Purpose |
| --- | --- | --- |
| `movie-scraper/` | **ACTIVE / deployed** | Next.js Frame Room web UI, TMDB and YouTube Data APIs, DigiMoviez Chromium crawler, client-side Transformers.js and Persian ONNX |
| `express-scraper/` | Local legacy prototype | Express-based scraper for local R&D; not used by Vercel |
| `bertModel/` | Local/offline ML R&D | Python training, evaluation and optional FastAPI service; **not running** on Vercel |

**Workflow:** choose a film from TMDB → automatically resolve its matching sources → fetch movie reviews and trailer reactions independently → optionally run browser-local AI sentiment → explore source-labeled results. No user-supplied DigiMoviez URL or YouTube video ID is required. The current UI is `/` or `/multi-source`. Legacy paths redirect to the current UI.

**Credentials:** `TMDB_READ_ACCESS_TOKEN`, `YOUTUBE_API_KEY` and `CINESENSE_SCRAPER_ACCESS_CODE` are server-only. The public Persian model ID is `PERSIAN_BROWSER_MODEL_ID`. See [sample configuration](movie-scraper/.env.example). Do not commit credentials.

**Usage limits:** YouTube has a strict API-unit quota and the Vercel Hobby plan has usage ceilings. DigiMoviez is an owner-code-protected on-demand serverless Chromium task, not an always-running crawler. Public source-derived DigiMoviez results cache for 30 minutes. Basic rate controls and in-process Chromium slots are **per warm instance only**; these are *not* a globally distributed limiter or durable queue. Use a shared quota/queue before expanding to public access.

**License & data:** App source code uses the repository license; it does not grant rights to third-party movie reviews. Verify TMDB, YouTube and website usage terms before external/commercial launch.

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

\n## Automatic source discovery (October 2026)\n\nThe movie picker is TMDB-backed. When the user presses **Fetch reviews**, the server verifies movie title, original title and release year against TMDB. YouTube runs **one** official Data API `search.list` query for a likely trailer and ranks its candidate titles, years and channels; it rejects fan-made videos and unrelated years. Discovery is cached for **six hours** to conserve the free API search quota. DigiMoviez performs at most two website searches by title using an isolated Playwright browser, checks canonical movie URLs and year compatibility, and opens a film page only when the match is sufficiently confident. Unmatched/ambiguous sources return explicit errors and do not silently mix movies. The UI displays the chosen title, video/channel or movie page, link and approximate match confidence. Comments from the trailer are kept separate from film reviews.\n\nBoth optional sources retain the **private owner code** guard before external requests. An unauthorized user cannot consume YouTube search quota or launch Chromium; only TMDB name search is public. No paid AI API is used. These source discovery features remain best-effort: YouTube quotas can be depleted and DigiMoviez website HTML/terms can change.\n