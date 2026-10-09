/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Chromium must remain external so executablePath() can locate its packaged /bin files.
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
  outputFileTracingIncludes: {
    "/api/fetch-comments": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  // Self-hosted development may continue to route /api to its Express service.
  // Vercel always uses the Next.js API handlers included in movie-scraper/app/api.
  async rewrites() {
    if (!process.env.VERCEL && process.env.SCRAPER_API_URL) {
      return [{ source: "/api/:path*", destination: process.env.SCRAPER_API_URL.replace(/\/+$/, "") + "/api/:path*" }];
    }
    return [];
  },
};
export default nextConfig;
