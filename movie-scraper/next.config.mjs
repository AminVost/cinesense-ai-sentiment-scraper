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
    // Same-origin proxy for open-source ParsBERT assets hosted in the project's
    // public GitHub release; avoids direct GitHub cross-origin browser failures.
    const assets="https://github.com/AminVost/cinesense-ai-sentiment-scraper/releases/download/persian-sentiment-onnx-v1";
    const out=[
      {source:"/models/cinesense-persian-sentiment/onnx/:file",destination:assets+"/:file"},
      {source:"/models/cinesense-persian-sentiment/:file",destination:assets+"/:file"},
    ];
    if (!process.env.VERCEL && process.env.SCRAPER_API_URL) {
      out.push({source:"/api/:path*",destination:process.env.SCRAPER_API_URL.replace(/\/+$/,"")+"/api/:path*"});
    }
    return out;
  },
};
export default nextConfig;
