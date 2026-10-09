# Deploy CineSense to Vercel Hobby (free, non-commercial)

The web frontend is in **`movie-scraper/`**, not the repository root. This folder now contains self-contained Next.js API routes for **TMDB** movie lookup/reviews and optional **YouTube** trailer comments.

> The existing Express + Playwright and Python BERT services are not bundled into the Vercel app. The cloud edition displays TMDB author's explicit numeric ratings (if present) and the raw review text; it does **not** label that result as AI sentiment. YouTube trailer comments are separate and unclassified. A complete AI+scraping installation still requires appropriate independent hosting.

## Vercel project setup

1. Import Git repository `AminVost/cinesense-ai-sentiment-scraper` using Vercel → Add New → Project. **Do not modify** the existing `amin-vost` or `shab` projects.
2. Name the new project `cinesense` (or another unique project name).
3. Framework Preset: **Next.js**.
4. Root Directory: **`movie-scraper`**. Leave Install Command, Build Command and Output Directory at Next.js detected defaults.
5. Environment Variables: `TMDB_READ_ACCESS_TOKEN` with your existing **server-only** TMDB token. (Alternative `TMDB_API_KEY`.) Optionally add `YOUTUBE_API_KEY`. Set scope to **Production** and **Preview** if needed. **Never use `NEXT_PUBLIC_` for API secrets.** Do not set `SCRAPER_API_URL` on Vercel.
6. Create a Preview deployment from branch `feat/free-multi-source-reviews`, test `GET /api/providers`, movie search, and live TMDB reviews. Once verified and reviewed, merge PR #1 into `main` and deploy from `main`.
7. In the new Vercel project's Settings → Domains, add **`cinesense.aminvost.ir`** and make it the production domain. If your domain currently uses Vercel nameservers, Vercel may configure it automatically. Otherwise follow the **exact CNAME target shown by Vercel** (DNS record name `cinesense`); do not change the apex/NS/MX or other project DNS records.
8. Confirm HTTPS and the public URL's API routes work. Make sure the Vercel Hobby and TMDB **non-commercial** use terms fit this project.

## Deploy checks

- `https://<preview>.vercel.app/api/providers`: Should list `tmdb.enabled=true` after adding the environment variable.
- Search for `Interstellar` and select the correct movie; press "دریافت نظرات".
- Compare returned reviews against `https://www.themoviedb.org/movie/157336/reviews`.
- With YouTube API key, paste a valid **11-character video ID** from an appropriate trailer.
- No manual DNS record is needed if Vercel automatically configures the domain. Never hardcode a guessed target.

## Notes

- The Vercel IP/location does **not guarantee** TMDB reachability or reachability of your site from every Iranian ISP; verify with a real deployment.
- The included application is suitable for personal/non-commercial use within Vercel Hobby included limits, not as an unlimited public paid SaaS.
- The TMDB API also requires attribution and an approved TMDB logo. The UI includes the official TMDB logo and disclaimer.
- The application enforces up to **30 reviews per provider per request**, with a maximum of three TMDB pages, a 12-second outbound timeout and a ten-minute TMDB upstream cache.
- Do not share TMDB secrets in chat, screenshots, Git, or client-side code.

Official docs:
- https://vercel.com/docs/monorepos
- https://vercel.com/docs/domains/set-up-custom-domain
- https://vercel.com/docs/plans/hobby
- https://developer.themoviedb.org/docs/faq
