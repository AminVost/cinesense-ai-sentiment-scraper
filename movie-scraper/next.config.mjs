/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
  outputFileTracingIncludes: {
    "/api/fetch-comments": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  async rewrites() {
    // The serverless Vercel build always uses its native API routes.
    // For local self-hosted Express development only.
    if (!process.env.VERCEL && process.env.SCRAPER_API_URL) {
      return [{
        source: "/api/:path*",
        destination: process.env.SCRAPER_API_URL.replace(/\/+$/, "") + "/api/:path*",
      }];
    }
    return [];
  },
};
export default nextConfig;
